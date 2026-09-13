const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
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

async function tap(page, sceneKey, name, touch = false, settle = 120) {
  const point = await pointFor(page, sceneKey, name);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(settle);
}

async function openMission9(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await page.evaluate(() => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission9Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  await sleep(220);
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
    const bounds = (item) => {
      const declared = item?.getData?.('auditBounds');
      if (declared) return { ...declared, right: declared.x + declared.width, bottom: declared.y + declared.height };
      const value = item?.getBounds?.();
      return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
    };
    const labels = all.filter((item) => item?.text).map((item) => item.text);
    const actions = all.filter((item) => item?.name?.startsWith('mission9-action-')).map((item) => ({
      name: item.name,
      bounds: bounds(item),
      hit: item.input?.hitArea ? { width: item.input.hitArea.width, height: item.input.hitArea.height } : null,
    }));
    return {
      scene: scene.scene.key,
      session: game.registry.get('sessionSnapshot'),
      mechanic: robotTestCourse.snapshot,
      labels,
      status: bounds(find('mission9-status')),
      world: bounds(find('mission9-course-world')),
      robot: bounds(find('mission9-repaired-robot')),
      feedback: bounds(find('mission9-feedback')),
      gateLeft: bounds(find('mission9-gate-left')),
      gateRight: bounds(find('mission9-gate-right')),
      gateLight: bounds(find('mission9-gate-light')),
      module: bounds(find('mission9-energy-module')),
      station: bounds(find('mission9-power-station')),
      completion: Boolean(find('mission9-completion')),
      continueButton: Boolean(find('mission9-continue')),
      soundText: find('mission9-sound')?.list?.find((item) => item.text)?.text,
      actions,
      mission9Complete: game.registry.get('mission9Complete') || false,
    };
  });
}

async function waitStage(page, stage) {
  await page.waitForFunction((expected) => window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').game.registry.get('sessionSnapshot') && true && window.__ROBOTLAB_GAME__, stage, { timeout: 5000 });
  await page.waitForFunction((expected) => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === expected, stage, { timeout: 5000 });
}

async function runMainFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  const start = await inspect(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage9-0-mission9-1280x720-start.png') });
  await tap(page, 'Mission9Scene', 'mission9-action-gate-circle');
  const wrongGate = await inspect(page);
  await tap(page, 'Mission9Scene', 'mission9-action-gate-triangle', false, 760);
  await waitStage(page, 'FORK');
  await page.screenshot({ path: path.join(screenshotDir, 'stage9-0-mission9-1280x720-fork.png') });
  const fork = await inspect(page);
  await tap(page, 'Mission9Scene', 'mission9-action-path-left');
  const wrongPath = await inspect(page);
  await tap(page, 'Mission9Scene', 'mission9-action-path-right', false, 760);
  await waitStage(page, 'PICKUP');
  const pickupStage = await inspect(page);
  await tap(page, 'Mission9Scene', 'mission9-action-pickup-module', false, 1000);
  await waitStage(page, 'DELIVERY');
  const deliveryStage = await inspect(page);
  await tap(page, 'Mission9Scene', 'mission9-sound');
  const muted = await inspect(page);
  await tap(page, 'Mission9Scene', 'mission9-sound');
  await tap(page, 'Mission9Scene', 'mission9-action-deliver-module', false, 1100);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-completion'));
  await page.screenshot({ path: path.join(screenshotDir, 'stage9-0-mission9-1280x720-final-station.png') });
  const final = await inspect(page);
  await tap(page, 'Mission9Scene', 'mission9-continue', false, 180);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission10Scene'));
  const mission10 = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');
    const labels = scene.children.list.flatMap(function walk(item) { return [item, ...(item?.list || []).flatMap(walk)]; }).filter((item) => item.text).map((item) => item.text);
    return { labels, session: window.__ROBOTLAB_GAME__.registry.get('sessionSnapshot') };
  });
  const states = [start, fork, pickupStage, deliveryStage, final];
  const checks = {
    mission8HandoffState: start.session.completedTasks === 8 && start.session.programmingCompleted && start.mechanic.courseStage === 'GATE',
    gateWrongNoProgress: wrongGate.mechanic.courseStage === 'GATE' && wrongGate.mechanic.gateOpened === false && wrongGate.labels.includes('ЕЩЁ РАЗ'),
    gateOpens: fork.mechanic.courseStage === 'FORK' && fork.mechanic.gateOpened,
    pathWrongNoProgress: wrongPath.mechanic.courseStage === 'FORK' && wrongPath.labels.includes('ТАМ ПРОХОДА НЕТ'),
    pathAdvances: pickupStage.mechanic.courseStage === 'PICKUP' && pickupStage.mechanic.pathChosen,
    pickupAdvances: deliveryStage.mechanic.courseStage === 'DELIVERY' && deliveryStage.mechanic.moduleCollected,
    deliveryCompletes: final.completion && final.session.completedTasks === 9 && final.session.robotTested && final.session.robotReadyForFirstLaunch,
    completionCopy: final.labels.includes('ИСПЫТАНИЕ ПРОЙДЕНО!') && final.labels.includes('РОБОТ ГОТОВ К ПЕРВОМУ ЗАПУСКУ'),
    mission10Placeholder: mission10.labels.includes('МИССИЯ 10 СКОРО ОТКРОЕТСЯ') && !mission10.labels.some((text) => /ПОБЕДА|ИГРА ПРОЙДЕНА|ФИНАЛ/.test(text)),
    distinctFromMission8: !states.some((state) => state.labels.some((text) => /ТВОЙ ПУТЬ|ЗАПУСТИТЬ|КОМАНДЫ|МАРШРУТ/.test(text))),
    touchTargets: states.flatMap((state) => state.actions).every((action) => action.hit?.width >= 56 && action.hit?.height >= 56),
    noFeedbackOverlap: states.every((state) => state.actions.every((action) => !intersects(state.feedback, action.bounds))),
    insideViewport: states.every((state) => [state.status, state.world, state.robot, state.station, ...state.actions.map((action) => action.bounds)].every((b) => inside(b, 1280, 720))),
    mute: muted.soundText === '× Звук',
    errors: clean(errors),
  };
  await context.close();
  return { checks, errors, start, wrongGate, fork, wrongPath, pickupStage, deliveryStage, final, mission10 };
}

async function playToState(page, stateName, touch) {
  if (stateName === 'start' || stateName === 'gate-closed') return;
  await tap(page, 'Mission9Scene', 'mission9-action-gate-triangle', touch, 760);
  await waitStage(page, 'FORK');
  if (stateName === 'gate-open' || stateName === 'fork') return;
  await tap(page, 'Mission9Scene', 'mission9-action-path-right', touch, 760);
  await waitStage(page, 'PICKUP');
  if (stateName === 'pickup') return;
  await tap(page, 'Mission9Scene', 'mission9-action-pickup-module', touch, 1000);
  await waitStage(page, 'DELIVERY');
  if (stateName === 'delivery') return;
  await tap(page, 'Mission9Scene', 'mission9-action-deliver-module', touch, 1100);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-completion'));
}

async function runViewport(browser, name, width, height, stateName) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1100, isMobile: width < 1000 });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  await playToState(page, stateName, width < 1100);
  const state = await inspect(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage9-0-mission9-${name}.png`) });
  const checks = {
    sceneActive: state.scene === 'Mission9Scene',
    insideViewport: [state.status, state.world, state.robot, state.station, ...state.actions.map((action) => action.bounds)].filter(Boolean).every((b) => inside(b, width, height)),
    robotReadable: state.robot?.height >= (height > width ? 90 : 108),
    obstacleReadable: Boolean(state.gateLeft && state.gateRight && state.station),
    controlsReadable: state.actions.every((action) => action.bounds.width >= 70 && action.bounds.height >= 56),
    touchTargets: state.actions.every((action) => action.hit?.width >= 56 && action.hit?.height >= 56),
    feedbackClear: state.actions.every((action) => !intersects(state.feedback, action.bounds)),
    noDiagnosticsText: !state.labels.some((text) => /ПРОВЕРЬ СИСТЕМЫ|ПРОВЕРКА|ЗРЕНИЕ|ДИАГНОСТ/.test(text)),
    errors: clean(errors),
  };
  await context.close();
  return { name, width, height, stateName, checks, errors, state };
}

async function runRotation(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  await tap(page, 'Mission9Scene', 'mission9-action-gate-triangle', true, 760);
  await waitStage(page, 'FORK');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  await sleep(240);
  const landscape = await inspect(page);
  await page.evaluate(() => {
    const { robotTestCourse } = window.__ROBOTLAB_QA__;
    robotTestCourse.act('path-right');
    robotTestCourse.continue();
    window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').scene.restart();
  });
  await waitStage(page, 'PICKUP');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  await sleep(240);
  const portrait = await inspect(page);
  await context.close();
  return {
    checks: {
      statePreservedLandscape: landscape.mechanic.courseStage === 'FORK' && landscape.mechanic.gateOpened,
      statePreservedPortrait: portrait.mechanic.courseStage === 'PICKUP' && portrait.mechanic.pathChosen,
      errors: clean(errors),
    },
    errors,
    landscape,
    portrait,
  };
}

async function runTransition(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await page.evaluate(async () => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    const { programmingMechanic } = await import('/src/game/mechanics/programming.ts');
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    programmingMechanic.reset();
    window.__ROBOTLAB_GAME__.scene.start('Mission8Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission8Scene'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('mission8-continue'), null, { timeout: 5000 }).catch(async () => {
    throw new Error(JSON.stringify(await page.evaluate(() => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
      return {
        active: scene.scene.isActive(),
        session: window.__ROBOTLAB_GAME__.registry.get('sessionSnapshot'),
        names: scene.children.list.map((item) => item.name).filter(Boolean),
      };
    })));
  });
  await tap(page, 'Mission8Scene', 'mission8-continue');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  const active = await inspect(page);
  await context.close();
  return { checks: { transition: active.scene === 'Mission9Scene' && active.mechanic.courseStage === 'GATE', errors: clean(errors) }, errors, active };
}

async function runReducedMotion(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  await tap(page, 'Mission9Scene', 'mission9-action-gate-triangle', true, 300);
  await waitStage(page, 'FORK');
  const state = await inspect(page);
  await context.close();
  return { checks: { reducedMotionProgresses: state.mechanic.courseStage === 'FORK', errors: clean(errors) }, errors, state };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  const main = await runMainFlow(browser);
  console.log('main-flow complete');
  const viewports = [
    ['844x390-start', 844, 390, 'start'],
    ['844x390-gate-closed', 844, 390, 'gate-closed'],
    ['844x390-gate-open', 844, 390, 'gate-open'],
    ['844x390-fork', 844, 390, 'fork'],
    ['844x390-module-pickup', 844, 390, 'delivery'],
    ['844x390-final-station-activated', 844, 390, 'final'],
    ['1280x720-start', 1280, 720, 'start'],
    ['1280x720-fork', 1280, 720, 'fork'],
    ['1280x720-final-state', 1280, 720, 'final'],
    ['390x844-orientation-gate', 390, 844, 'start'],
    ['568x320-start', 568, 320, 'start'],
    ['740x360-start', 740, 360, 'start'],
    ['915x412-start', 915, 412, 'start'],
    ['1024x768-start', 1024, 768, 'start'],
    ['1438x914-start', 1438, 914, 'start'],
  ];
  const responsive = [];
  for (const [name, width, height, stateName] of viewports) {
    console.log(`viewport ${name} start`);
    responsive.push(await runViewport(browser, name, width, height, stateName));
    console.log(`viewport ${name} complete`);
  }
  console.log('rotation start');
  const rotation = await runRotation(browser);
  console.log('transition start');
  const transition = await runTransition(browser);
  console.log('reduced-motion start');
  const reducedMotion = await runReducedMotion(browser);
  await browser.close();
  const failures = [
    ...Object.entries(main.checks).filter(([, ok]) => !ok).map(([key]) => `main:${key}`),
    ...responsive.flatMap((entry) => Object.entries(entry.checks).filter(([, ok]) => !ok).map(([key]) => `${entry.name}:${key}`)),
    ...Object.entries(rotation.checks).filter(([, ok]) => !ok).map(([key]) => `rotation:${key}`),
    ...Object.entries(transition.checks).filter(([, ok]) => !ok).map(([key]) => `transition:${key}`),
    ...Object.entries(reducedMotion.checks).filter(([, ok]) => !ok).map(([key]) => `reducedMotion:${key}`),
  ];
  const report = { main, responsive, rotation, transition, reducedMotion, failures };
  fs.mkdirSync(path.join('docs', 'qa'), { recursive: true });
  fs.writeFileSync(path.join('docs', 'qa', 'stage9-0-mission9-playtest.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    main: main.checks,
    responsive: responsive.map(({ name, checks }) => ({ name, checks })),
    rotation: rotation.checks,
    transition: transition.checks,
    reducedMotion: reducedMotion.checks,
    failures,
  }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
