const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage9-7-mission9-full-remediation.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

const cleanRuntimeErrors = (errors) => errors.console.length === 0
  && errors.requests.length === 0
  && errors.responses.length === 0
  && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;

async function openMission9(page) {
  let loaded = false;
  let lastError;
  for (let attempt = 0; attempt < 3 && !loaded; attempt += 1) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    try {
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__
        && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_BRIDGE_CORRECT')
        && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_GATE_KEY_CORRECT')
        && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_ENERGY_CORRECT'), null, { timeout: 90000 });
      loaded = true;
    } catch (error) {
      lastError = error;
      await sleep(700);
    }
  }
  if (!loaded) throw lastError;
  await page.evaluate(() => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission9Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  await sleep(280);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission9Scene');
    const all = [];
    const walk = (item) => {
      all.push(item);
      if (item?.list) for (const child of item.list) walk(child);
    };
    scene.children.list.forEach(walk);
    const find = (name) => all.find((item) => item?.name === name);
    const count = (name) => all.filter((item) => item?.name === name).length;
    const bounds = (item) => {
      if (!item) return null;
      const audit = item.getData?.('auditBounds');
      if (audit) return { x: audit.x, y: audit.y, width: audit.width, height: audit.height };
      const b = item.getBounds?.();
      return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
    };
    const labels = all.filter((item) => typeof item?.text === 'string').map((item) => item.text);
    const target = find('mission9-bridge-gap-target') || find('mission9-gate-lock-panel') || find('mission9-power-module-socket');
    const robot = find('mission9-repaired-robot');
    const title = find('mission9-feedback');
    const actions = all.filter((item) => item?.name?.startsWith('mission9-choice-') && item.getData?.('courseAction')).map((item) => ({
      name: item.name,
      action: item.getData('courseAction'),
      alpha: item.alpha,
      scaleX: item.scaleX,
      depth: item.depth,
      x: item.x,
      y: item.y,
      hit: item.input?.hitArea ? { width: item.input.hitArea.width, height: item.input.hitArea.height } : null,
      bounds: bounds(item),
    }));
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      stage: window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage,
      snapshot: window.__ROBOTLAB_QA__.robotTestCourse.snapshot,
      labels,
      interactionState: game.registry.get('mission9InteractionState') || 'IDLE',
      dragThreshold: game.registry.get('mission9DragThreshold'),
      touchAction: getComputedStyle(document.querySelector('canvas')).touchAction,
      title: { text: title?.text || null, bounds: bounds(title), color: title?.style?.color || null, stroke: title?.style?.stroke || null, strokeThickness: title?.style?.strokeThickness || null },
      actions,
      target: { visible: bounds(target), acceptance: target?.getData?.('dropTargetBounds') || null },
      robot: { bounds: bounds(robot), visibleFeetGroundY: robot?.getData?.('visibleFeetGroundY') ?? null, visibleBottomY: robot?.getData?.('visibleBottomY') ?? null },
      counts: {
        bridgeLeft: count('mission9-bridge-platform-left'),
        bridgeRight: count('mission9-bridge-platform-right'),
        bridgeGap: count('mission9-bridge-gap-target'),
        bridgeVisibleGap: count('mission9-bridge-visible-gap'),
        gateClosed: count('mission9-security-gate-closed'),
        gateOpen: count('mission9-security-gate-open'),
        gateLock: count('mission9-gate-lock-panel'),
        powerStation: count('mission9-power-station-inactive') + count('mission9-power-station-active'),
        powerSocket: count('mission9-power-module-socket'),
        completion: count('mission9-completion'),
        progressDots: all.filter((item) => item?.name?.startsWith('mission9-progress-dot-')).length,
        orientationGate: count('mission9-orientation-gate'),
        orientationIcon: count('mission9-orientation-phone-icon'),
      },
    };
  });
}

async function pointFor(page, name) {
  return page.evaluate((name) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene');
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Missing Mission9Scene/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, name);
}

async function mouseDrag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await sleep(520);
}

async function touchDrag(context, page, from, to) {
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= 10; i += 1) {
    const x = from.x + ((to.x - from.x) * i) / 10;
    const y = from.y + ((to.y - from.y) * i) / 10;
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await sleep(18);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(560);
}

async function dragChoice(context, page, choiceName, target, input) {
  const from = await pointFor(page, choiceName);
  const to = target || await page.evaluate(() => ({ x: 24, y: window.innerHeight - 24 }));
  await mouseDrag(page, from, to);
}

async function targetCenter(page) {
  const state = await inspect(page);
  const target = state.target.acceptance;
  return { x: target.x + target.width / 2, y: target.y + target.height / 2 };
}

async function waitIdle(page) {
  await sleep(1200);
}

async function screenshot(page, label) {
  const file = path.join(screenshotDir, `stage9-7-mission9-${label}.png`);
  await page.screenshot({ path: file });
  return file;
}

function noActionOverlap(actions) {
  const bounds = actions.map((action) => action.bounds);
  return !bounds.some((a, index) => bounds.some((b, other) => other > index && a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y));
}

function stageCompositionOk(state) {
  const titleOk = state.title.color === '#f7fdff' && state.title.stroke === '#06243b' && Number(state.title.strokeThickness) >= 5;
  const controlsOk = state.actions.length === 3 && state.actions.every((action) => action.hit?.width >= 56 && action.hit?.height >= 56) && noActionOverlap(state.actions);
  const targetOk = Boolean(state.target.visible && state.target.acceptance && state.target.acceptance.width >= state.target.visible.width && state.target.acceptance.height >= state.target.visible.height);
  if (state.stage === 'BRIDGE') return titleOk && controlsOk && targetOk && state.counts.bridgeLeft === 1 && state.counts.bridgeRight === 1 && state.counts.bridgeGap === 1 && state.counts.bridgeVisibleGap === 1 && Math.abs(state.robot.visibleFeetGroundY - state.robot.visibleBottomY) < 1.5;
  if (state.stage === 'GATE') return titleOk && controlsOk && targetOk && state.counts.gateLock === 1 && state.counts.gateClosed + state.counts.gateOpen === 1;
  if (state.stage === 'POWER') return titleOk && controlsOk && targetOk && state.counts.powerStation === 1 && state.counts.powerSocket === 1;
  return state.counts.completion === 1 && state.labels.includes('НА ГЛАВНУЮ');
}

async function runLogicMatrix(browser, width, height, input) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: input === 'touch', isMobile: input === 'touch' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  const checks = [];
  const record = async (name, expectedStage) => {
    const state = await inspect(page);
    checks.push({ name, expectedStage, actualStage: state.stage, completed: state.snapshot.completed, ok: state.stage === expectedStage && !state.snapshot.completed });
  };
  for (const wrong of ['mission9-choice-bridge-wrong-arc', 'mission9-choice-bridge-wrong-truss']) {
    await dragChoice(context, page, wrong, await targetCenter(page), input);
    await record(wrong, 'BRIDGE');
    await waitIdle(page);
  }
  await dragChoice(context, page, 'mission9-choice-bridge-correct', { x: 24, y: height - 24 }, input);
  await record('mission9-choice-bridge-correct-outside', 'BRIDGE');
  await waitIdle(page);
  await dragChoice(context, page, 'mission9-choice-bridge-correct', await targetCenter(page), input);
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === 'GATE');
  for (const wrong of ['mission9-choice-gate-wrong-1', 'mission9-choice-gate-wrong-2']) {
    await dragChoice(context, page, wrong, await targetCenter(page), input);
    await record(wrong, 'GATE');
    await waitIdle(page);
  }
  await dragChoice(context, page, 'mission9-choice-gate-correct', await targetCenter(page), input);
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === 'POWER');
  for (const wrong of ['mission9-choice-power-wrong-1', 'mission9-choice-power-wrong-2']) {
    await dragChoice(context, page, wrong, await targetCenter(page), input);
    await record(wrong, 'POWER');
    await waitIdle(page);
  }
  await dragChoice(context, page, 'mission9-choice-power-correct', await targetCenter(page), input);
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === 'COMPLETE');
  const final = await inspect(page);
  await context.close();
  return { viewport: `${width}x${height}`, input, checks, final, clean: cleanRuntimeErrors(errors), errors, ok: checks.every((check) => check.ok) && final.snapshot.completed && final.counts.completion === 1 && cleanRuntimeErrors(errors) };
}

async function captureStage(browser, width, height, stage) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000, isMobile: width < 1000 });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  while ((await inspect(page)).stage !== stage && stage !== 'COMPLETE') {
    const current = await inspect(page);
    const correct = current.stage === 'BRIDGE' ? 'mission9-choice-bridge-correct' : current.stage === 'GATE' ? 'mission9-choice-gate-correct' : 'mission9-choice-power-correct';
    await dragChoice(context, page, correct, await targetCenter(page), width < 1000 ? 'touch' : 'mouse');
    await sleep(850);
  }
  if (stage === 'COMPLETE') {
    while ((await inspect(page)).stage !== 'COMPLETE') {
      const current = await inspect(page);
      const correct = current.stage === 'BRIDGE' ? 'mission9-choice-bridge-correct' : current.stage === 'GATE' ? 'mission9-choice-gate-correct' : 'mission9-choice-power-correct';
      await dragChoice(context, page, correct, await targetCenter(page), width < 1000 ? 'touch' : 'mouse');
      await page.waitForFunction((previous) => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage !== previous || window.__ROBOTLAB_QA__.robotTestCourse.snapshot.completed, current.stage, { timeout: 7000 });
      await sleep(450);
    }
  }
  const state = await inspect(page);
  const shot = await screenshot(page, `${width}x${height}-${stage.toLowerCase()}`);
  await context.close();
  return { viewport: `${width}x${height}`, stage, state, screenshot: shot, clean: cleanRuntimeErrors(errors), errors, ok: stageCompositionOk(state) && cleanRuntimeErrors(errors) };
}

async function capturePortraitGate(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  const state = await inspect(page);
  const shot = await screenshot(page, `${width}x${height}-orientation-gate`);
  await context.close();
  return { viewport: `${width}x${height}`, state, screenshot: shot, clean: cleanRuntimeErrors(errors), errors, ok: state.counts.orientationGate === 1 && state.counts.orientationIcon === 1 && state.actions.length === 0 && cleanRuntimeErrors(errors) };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  async function withBrowser(task) {
    const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
    try {
      return await task(browser);
    } finally {
      await browser.close();
    }
  }
  const logic = [
    await withBrowser((browser) => runLogicMatrix(browser, 1280, 720, 'mouse')),
    await withBrowser((browser) => runLogicMatrix(browser, 844, 390, 'touch')),
  ];
  const captures = [];
  for (const viewport of [[1280, 720], [1600, 900], [1920, 1080]]) {
    captures.push(await withBrowser((browser) => captureStage(browser, viewport[0], viewport[1], 'BRIDGE')));
  }
  for (const viewport of [[844, 390], [915, 412]]) {
    for (const stage of ['BRIDGE', 'GATE', 'POWER', 'COMPLETE']) {
      captures.push(await withBrowser((browser) => captureStage(browser, viewport[0], viewport[1], stage)));
    }
  }
  const portrait = [
    await withBrowser((browser) => capturePortraitGate(browser, 390, 844)),
    await withBrowser((browser) => capturePortraitGate(browser, 412, 915)),
  ];

  const evaluation = {
    bridgeCorrectOnly: logic.every((entry) => entry.ok),
    wrongAndOutsideDoNotAdvance: logic.every((entry) => entry.checks.every((check) => check.ok)),
    desktopComposition: captures.filter((entry) => ['1280x720', '1600x900', '1920x1080'].includes(entry.viewport)).every((entry) => entry.ok),
    samsungLandscape: captures.filter((entry) => ['844x390', '915x412'].includes(entry.viewport)).every((entry) => entry.ok),
    portraitGate: portrait.every((entry) => entry.ok),
    runtimeClean: logic.every((entry) => entry.clean) && captures.every((entry) => entry.clean) && portrait.every((entry) => entry.clean),
  };
  const failures = [
    ...Object.entries(evaluation).filter(([, ok]) => !ok).map(([key]) => key),
    ...logic.flatMap((entry) => entry.checks.filter((check) => !check.ok).map((check) => `${entry.viewport}:${entry.input}:${check.name}`)),
    ...captures.filter((entry) => !entry.ok).map((entry) => `${entry.viewport}:${entry.stage}`),
    ...portrait.filter((entry) => !entry.ok).map((entry) => `${entry.viewport}:portraitGate`),
  ];
  const report = { result: failures.length ? 'FAIL' : 'READY_FOR_REVIEW', evaluation, logic, captures, portrait, failures };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ result: report.result, evaluation, screenshotCount: captures.length + portrait.length, failures }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});