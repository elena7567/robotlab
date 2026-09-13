const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const reportPath = path.join('docs', 'qa', 'stage9-8-mission9-drag-geometry.json');
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

const cleanRuntimeErrors = (errors) => errors.console.length === 0
  && errors.requests.length === 0
  && errors.responses.length === 0
  && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;

async function openMission9(page) {
  await page.goto(`${baseUrl}?inputDebug=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_BRIDGE_CORRECT')
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_GATE_KEY_CORRECT')
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_ENERGY_CORRECT'), null, { timeout: 90000 });
  await page.evaluate(() => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission9Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  await sleep(320);
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
    const actions = all.filter((item) => item?.name?.startsWith('mission9-choice-') && item.getData?.('courseAction')).map((item) => {
      const debug = item.getData('inputDebug');
      return {
        name: item.name,
        action: item.getData('courseAction'),
        selected: item.depth === 42,
        x: item.x,
        y: item.y,
        scaleX: item.scaleX,
        scaleY: item.scaleY,
        alpha: item.alpha,
        debug,
      };
    });
    const target = find('mission9-bridge-gap-target') || find('mission9-gate-lock-panel') || find('mission9-power-module-socket');
    const robot = find('mission9-repaired-robot');
    const targetBounds = target?.getData?.('dropTargetBounds') || null;
    return {
      stage: window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage,
      completed: window.__ROBOTLAB_QA__.robotTestCourse.snapshot.completed,
      interactionState: game.registry.get('mission9InteractionState') || 'IDLE',
      viewport: { width: game.scale.width, height: game.scale.height },
      canvas: (() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { cssWidth: r.width, cssHeight: r.height, width: c.width, height: c.height, dpr: window.devicePixelRatio, touchAction: getComputedStyle(c).touchAction }; })(),
      actions,
      selected: actions.find((action) => action.selected)?.name || null,
      target: targetBounds ? { x: targetBounds.x, y: targetBounds.y, width: targetBounds.width, height: targetBounds.height } : null,
      counts: {
        debugOverlays: all.filter((item) => item?.name?.endsWith('-input-debug')).length,
        bridgeLeft: count('mission9-bridge-platform-left'),
        bridgeRight: count('mission9-bridge-platform-right'),
        bridgeGap: count('mission9-bridge-gap-target'),
        bridgeVisibleGap: count('mission9-bridge-visible-gap'),
        gateLock: count('mission9-gate-lock-panel'),
        gateClosed: count('mission9-security-gate-closed'),
        gateOpen: count('mission9-security-gate-open'),
        powerStation: count('mission9-power-station-inactive') + count('mission9-power-station-active'),
        powerSocket: count('mission9-power-module-socket'),
      },
      robot: {
        visibleFeetGroundY: robot?.getData?.('visibleFeetGroundY') ?? null,
        visibleBottomY: robot?.getData?.('visibleBottomY') ?? null,
      },
    };
  });
}

function pointSet(action) {
  const r = action.debug.visible;
  return [
    ['center', { x: r.x + r.width / 2, y: r.y + r.height / 2 }],
    ['leftInterior', { x: r.x + Math.min(12, r.width * 0.16), y: r.y + r.height / 2 }],
    ['rightInterior', { x: r.x + r.width - Math.min(12, r.width * 0.16), y: r.y + r.height / 2 }],
    ['topInterior', { x: r.x + r.width / 2, y: r.y + Math.min(12, r.height * 0.22) }],
    ['bottomInterior', { x: r.x + r.width / 2, y: r.y + r.height - Math.min(12, r.height * 0.22) }],
  ];
}

async function pressPoint(page, point, input) {
  if (input === 'touch') {
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    await sleep(80);
    const state = await inspect(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(120);
    return state;
  }
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await sleep(80);
  const state = await inspect(page);
  await page.mouse.up();
  await sleep(120);
  return state;
}

async function drag(page, from, to, input) {
  if (input === 'touch') {
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let i = 1; i <= 12; i += 1) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 }] });
      await sleep(18);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  }
  await sleep(400);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function testStage(page, input) {
  const initial = await inspect(page);
  const stage = initial.stage;
  const pickTests = [];
  for (const action of initial.actions) {
    for (const [label, point] of pointSet(action)) {
      const state = await pressPoint(page, point, input);
      pickTests.push({ stage, action: action.name, point: label, expected: action.name, actual: state.selected, ok: state.selected === action.name, screenPoint: point });
    }
  }
  const gapTests = [];
  for (let i = 0; i < initial.actions.length - 1; i += 1) {
    const a = initial.actions[i].debug.visible;
    const b = initial.actions[i + 1].debug.visible;
    const point = { x: (a.x + a.width + b.x) / 2, y: a.y + a.height / 2 };
    const state = await pressPoint(page, point, input);
    gapTests.push({ stage, between: `${initial.actions[i].name}/${initial.actions[i + 1].name}`, expected: null, actual: state.selected, ok: state.selected === null, screenPoint: point });
  }
  const overlap = [];
  for (let i = 0; i < initial.actions.length; i += 1) {
    for (let j = i + 1; j < initial.actions.length; j += 1) {
      overlap.push({ a: initial.actions[i].name, b: initial.actions[j].name, overlap: rectsOverlap(initial.actions[i].debug.input, initial.actions[j].debug.input) });
    }
  }
  const correct = initial.actions.find((action) => /correct/.test(action.name));
  await drag(page, correct.debug.visibleCenter, { x: initial.target.x + initial.target.width / 2, y: initial.target.y + initial.target.height / 2 }, input);
  await page.waitForFunction((previousStage) => {
    const snapshot = window.__ROBOTLAB_QA__.robotTestCourse.snapshot;
    return snapshot.courseStage !== previousStage || snapshot.completed;
  }, stage, { timeout: 12000 }).catch(() => undefined);
  return {
    stage,
    hierarchy: initial.actions.map((action) => ({ name: action.name, hierarchy: action.debug.hierarchy, container: action.debug.container, hitArea: action.debug.hitArea })),
    rects: Object.fromEntries(initial.actions.map((action, index) => [String.fromCharCode(65 + index), { name: action.name, action: action.action, rect: action.debug.input }])),
    centerErrors: Object.fromEntries(initial.actions.map((action, index) => [String.fromCharCode(65 + index), action.debug.centerError])),
    pickTests,
    gapTests,
    overlap,
    composition: { counts: initial.counts, robot: initial.robot, canvas: initial.canvas },
  };
}

async function runViewport(browser, width, height, input) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: input === 'touch', isMobile: input === 'touch' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  const stages = [];
  stages.push(await testStage(page, input));
  const afterBridge = await inspect(page);
  if (afterBridge.stage === 'GATE') {
    stages.push(await testStage(page, input));
  }
  const afterGate = await inspect(page);
  if (afterGate.stage === 'POWER') {
    stages.push(await testStage(page, input));
  }
  const afterPower = await inspect(page);
  const final = await inspect(page);
  fs.mkdirSync(screenshotDir, { recursive: true });
  const shot = path.join(screenshotDir, `stage9-8-mission9-${width}x${height}-complete.png`);
  await page.screenshot({ path: shot });
  await context.close();
  const geometryOk = stages.every((stage) => stage.pickTests.every((test) => test.ok)
    && stage.gapTests.every((test) => test.ok)
    && stage.overlap.every((item) => !item.overlap)
    && Object.values(stage.centerErrors).every((error) => Math.abs(error.dx) <= 1 && Math.abs(error.dy) <= 1));
  return { viewport: `${width}x${height}`, input, stages, final, screenshot: shot, clean: cleanRuntimeErrors(errors), errors, ok: geometryOk && final.completed && cleanRuntimeErrors(errors) };
}

(async () => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  try {
    const runs = [
      await runViewport(browser, 1280, 720, 'mouse'),
      await runViewport(browser, 1600, 900, 'mouse'),
      await runViewport(browser, 1920, 1080, 'mouse'),
      await runViewport(browser, 844, 390, 'touch'),
      await runViewport(browser, 915, 412, 'touch'),
    ];
    const report = { result: runs.every((run) => run.ok) ? 'READY_FOR_REVIEW' : 'FAIL', runs };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ result: report.result, runs: runs.map((run) => ({ viewport: run.viewport, input: run.input, ok: run.ok, clean: run.clean })) }, null, 2)}\n`);
    if (report.result !== 'READY_FOR_REVIEW') process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});