const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage9-1-mission9-ux-playtest.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

const clean = (errors) => Object.values(errors).every((entries) => entries.length === 0);
const inside = (b, width, height) => b && b.x >= -1 && b.y >= -1 && b.right <= width + 1 && b.bottom <= height + 1;
const intersects = (a, b) => a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

async function pointFor(page, sceneKey, name) {
  return page.evaluate(({ sceneKey, name }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Missing ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { sceneKey, name });
}

async function tap(page, name, touch = false, settle = 160) {
  const point = await pointFor(page, 'Mission9Scene', name);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(settle);
}

async function openMission9(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__
    && window.__ROBOTLAB_GAME__.textures.exists('robot-v2-repaired')
    && window.__ROBOTLAB_GAME__.textures.exists('bg-main-laboratory'));
  await page.evaluate(() => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission9Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  await sleep(240);
}

async function waitStage(page, stage) {
  await page.waitForFunction((expected) => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === expected, stage, { timeout: 5000 });
  await sleep(180);
}

async function inspect(page) {
  return page.evaluate(() => {
    const { robotTestCourse } = window.__ROBOTLAB_QA__;
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission9Scene');
    const walk = (item, acc = []) => {
      acc.push(item);
      if (item?.list) for (const child of item.list) walk(child, acc);
      return acc;
    };
    const all = scene.children.list.flatMap((item) => walk(item));
    const find = (name) => all.find((item) => item?.name === name);
    const has = (name) => Boolean(find(name));
    const bounds = (item) => {
      const declared = item?.getData?.('auditBounds');
      if (declared) return { ...declared, right: declared.x + declared.width, bottom: declared.y + declared.height };
      const value = item?.getBounds?.();
      return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
    };
    const labels = all.filter((item) => typeof item?.text === 'string').map((item) => item.text);
    const actions = all.filter((item) => item?.name?.startsWith('mission9-action-')).map((item) => ({
      name: item.name,
      action: item.getData?.('courseAction'),
      bounds: bounds(item),
      hit: item.input?.hitArea ? { width: item.input.hitArea.width, height: item.input.hitArea.height } : null,
    }));
    const progressDots = all.filter((item) => item?.name?.startsWith('mission9-progress-dot-')).length;
    return {
      scene: scene.scene.key,
      mechanic: robotTestCourse.snapshot,
      session: game.registry.get('sessionSnapshot'),
      labels,
      progressDots,
      status: bounds(find('mission9-status')),
      world: bounds(find('mission9-course-world')),
      feedback: bounds(find('mission9-feedback')),
      robot: bounds(find('mission9-repaired-robot')),
      actions,
      hasGate: has('mission9-gate-left') && has('mission9-gate-right') && labels.includes('★'),
      hasBlockedPath: has('mission9-blocked-path-barrier'),
      hasModule: has('mission9-energy-module'),
      hasStation: has('mission9-power-station') && has('mission9-station-slot'),
      hasCompletion: has('mission9-completion'),
      hasFinalButton: has('mission9-continue'),
      mission10: false,
    };
  });
}

async function advanceTo(page, stateName, touch) {
  if (stateName === 'gate') return;
  await tap(page, 'mission9-action-gate-star', touch, 780);
  await waitStage(page, 'FORK');
  if (stateName === 'fork') return;
  await tap(page, 'mission9-action-path-right', touch, 780);
  await waitStage(page, 'PICKUP');
  if (stateName === 'pickup') return;
  await tap(page, 'mission9-action-pickup-module', touch, 1050);
  await waitStage(page, 'DELIVERY');
  if (stateName === 'station') return;
  await tap(page, 'mission9-action-deliver-module', touch, 1150);
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene');
    return scene.children.getByName('mission9-completion') || window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === 'COMPLETE';
  }, null, { timeout: 15000 });
  await sleep(220);
}

function childClear(state, width, height) {
  const actionBounds = state.actions.map((action) => action.bounds).filter(Boolean);
  const objects = [state.status, state.world, state.feedback, state.robot, ...actionBounds].filter(Boolean);
  return {
    insideViewport: objects.every((b) => inside(b, width, height)),
    controlTargets: state.actions.every((action) => action.hit?.width >= 56 && action.hit?.height >= 56 && action.bounds?.height >= 56),
    feedbackClear: state.actions.every((action) => !intersects(state.feedback, action.bounds)),
    compactProgress: state.progressDots === 4 && !state.labels.some((text) => ['ВОРОТА', 'ПУТЬ', 'МОДУЛЬ', 'СТАНЦИЯ'].includes(text)),
    noTechnicalRouteText: !state.labels.some((text) => /МАРШРУТ|КОМАНДЫ|ДИАГНОСТ|ПРОВЕРЬ СИСТЕМЫ|СТОП/.test(text)),
    minimalControls: state.actions.length > 0 && state.actions.length <= 3,
  };
}

async function captureState(browser, viewport, stateName) {
  const [width, height] = viewport;
  const touch = width < 1100;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: width < 1000 });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  await advanceTo(page, stateName, touch);
  const state = await inspect(page);
  const file = `stage9-1-mission9-${width}x${height}-${stateName}.png`;
  await page.screenshot({ path: path.join(screenshotDir, file) });
  await context.close();
  const clarity = childClear(state, width, height);
  return { viewport: `${width}x${height}`, stateName, screenshot: path.join('docs', 'qa', 'screenshots', file), state, errors, checks: { ...clarity, errors: clean(errors) } };
}

async function runWrongFeedback(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  await tap(page, 'mission9-action-gate-circle', true, 220);
  const wrongGate = await inspect(page);
  await tap(page, 'mission9-action-gate-star', true, 780);
  await waitStage(page, 'FORK');
  await tap(page, 'mission9-action-path-left', true, 220);
  const wrongPath = await inspect(page);
  await context.close();
  return {
    checks: {
      wrongGateRetry: wrongGate.mechanic.courseStage === 'GATE' && wrongGate.labels.includes('ЕЩЁ РАЗ'),
      wrongPathRetry: wrongPath.mechanic.courseStage === 'FORK' && wrongPath.labels.includes('ТУТ НЕ ПРОЕХАТЬ'),
      noProgressLoss: wrongPath.mechanic.pathChosen === false,
      errors: clean(errors),
    },
    errors,
    wrongGate,
    wrongPath,
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  const captures = [];
  for (const stateName of ['gate', 'fork', 'pickup', 'station', 'final']) {
    captures.push(await captureState(browser, [844, 390], stateName));
  }
  for (const stateName of ['gate', 'fork', 'final']) {
    captures.push(await captureState(browser, [1280, 720], stateName));
  }
  const wrongFeedback = await runWrongFeedback(browser);
  await browser.close();

  const required = {
    gate: captures.filter((entry) => entry.stateName === 'gate').every((entry) => entry.state.hasGate && entry.state.labels.includes('НАЙДИ ЗНАК НА ВОРОТАХ') && entry.state.actions.some((action) => action.action === 'gate-star')),
    path: captures.filter((entry) => entry.stateName === 'fork').every((entry) => entry.state.hasBlockedPath && entry.state.labels.includes('КУДА ЕХАТЬ?') && entry.state.actions.length === 2),
    energyModule: captures.filter((entry) => entry.stateName === 'pickup').every((entry) => entry.state.hasModule && entry.state.labels.includes('ВОЗЬМИ МОДУЛЬ') && entry.state.actions.some((action) => action.action === 'pickup-module')),
    station: captures.filter((entry) => entry.stateName === 'station').every((entry) => entry.state.hasStation && entry.state.labels.includes('УСТАНОВИ МОДУЛЬ') && entry.state.actions.some((action) => action.action === 'deliver-module')),
    final: captures.filter((entry) => entry.stateName === 'final').every((entry) => entry.state.hasCompletion && entry.state.labels.includes('ИСПЫТАНИЕ ПРОЙДЕНО!') && entry.state.labels.includes('РОБОТ ГОТОВ К ЗАПУСКУ') && entry.state.hasFinalButton),
    oneEventAtATime: captures.every((entry) => {
      const visible = [entry.state.hasGate, entry.state.hasBlockedPath, entry.state.hasModule, entry.state.hasStation].filter(Boolean).length;
      return entry.stateName === 'final' ? visible <= 1 : visible === 1;
    }),
    childComprehension: captures.every((entry) => Object.values(entry.checks).every(Boolean)),
    wrongFeedback: Object.values(wrongFeedback.checks).every(Boolean),
  };

  const failures = [
    ...Object.entries(required).filter(([, ok]) => !ok).map(([key]) => `required:${key}`),
    ...captures.flatMap((entry) => Object.entries(entry.checks).filter(([, ok]) => !ok).map(([key]) => `${entry.viewport}:${entry.stateName}:${key}`)),
    ...Object.entries(wrongFeedback.checks).filter(([, ok]) => !ok).map(([key]) => `wrong:${key}`),
  ];
  const report = { required, captures, wrongFeedback, failures };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    required,
    captures: captures.map(({ viewport, stateName, screenshot, checks }) => ({ viewport, stateName, screenshot, checks })),
    wrongFeedback: wrongFeedback.checks,
    failures,
  }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
