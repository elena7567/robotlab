const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage9-9-mission7-8-9-remediation.json');
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

async function openGame(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_BRIDGE_CORRECT')
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_GATE_KEY_CORRECT')
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_ENERGY_CORRECT'), null, { timeout: 90000 });
}

async function startScene(page, sceneName) {
  await page.evaluate((sceneName) => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    if (sceneName === 'Mission7Scene') {
      for (let index = 0; index < 6; index += 1) sessionState.completeCurrentTask();
    } else if (sceneName === 'Mission8Scene') {
      for (let index = 0; index < 7; index += 1) sessionState.completeCurrentTask();
    } else if (sceneName === 'Mission9Scene') {
      for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    }
    window.__ROBOTLAB_GAME__.scene.start(sceneName);
  }, sceneName);
  await page.waitForFunction((sceneName) => window.__ROBOTLAB_GAME__.scene.isActive(sceneName), sceneName, { timeout: 12000 });
  await sleep(350);
}

async function allSceneObjects(page, sceneName = 'Mission9Scene') {
  return page.evaluate((sceneName) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneName);
    const all = [];
    const walk = (item) => {
      all.push(item);
      if (item?.list) for (const child of item.list) walk(child);
    };
    scene.children.list.forEach(walk);
    const bounds = (item) => {
      if (!item) return null;
      const audit = item.getData?.('auditBounds');
      if (audit) return { x: audit.x, y: audit.y, width: audit.width, height: audit.height };
      const b = item.getBounds?.();
      return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
    };
    return all.map((item) => ({
      name: item?.name || '',
      text: typeof item?.text === 'string' ? item.text : null,
      x: item?.x ?? null,
      y: item?.y ?? null,
      depth: item?.depth ?? null,
      alpha: item?.alpha ?? null,
      visible: item?.visible ?? null,
      bounds: bounds(item),
      action: item?.getData?.('courseAction') || null,
      inputMode: item?.getData?.('inputMode') || null,
      hit: item?.input?.hitArea ? { width: item.input.hitArea.width, height: item.input.hitArea.height } : null,
      debug: item?.getData?.('inputDebug') || null,
      selectedAction: window.__ROBOTLAB_GAME__.registry.get('mission9SelectedAction') || null,
      interactionState: window.__ROBOTLAB_GAME__.registry.get('mission9InteractionState') || 'IDLE',
      stage: window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage,
      snapshot: window.__ROBOTLAB_QA__.robotTestCourse.snapshot,
    }));
  }, sceneName);
}

async function inspectMission9(page) {
  const objects = await allSceneObjects(page, 'Mission9Scene');
  const find = (name) => objects.find((item) => item.name === name);
  const choices = objects.filter((item) => item.name.startsWith('mission9-choice-') && item.action);
  const target = find('mission9-drop-target-hitarea');
  const feedback = find('mission9-feedback');
  const robot = find('mission9-repaired-robot');
  const first = objects[0] || {};
  return {
    stage: first.stage,
    snapshot: first.snapshot,
    selectedAction: first.selectedAction || null,
    interactionState: first.interactionState || 'IDLE',
    choices,
    target,
    feedback,
    robot,
    counts: {
      bridgeLeft: objects.filter((item) => item.name === 'mission9-bridge-platform-left').length,
      bridgeRight: objects.filter((item) => item.name === 'mission9-bridge-platform-right').length,
      bridgeGap: objects.filter((item) => item.name === 'mission9-bridge-gap-target').length,
      bridgeVisibleGap: objects.filter((item) => item.name === 'mission9-bridge-visible-gap').length,
      gateClosed: objects.filter((item) => item.name === 'mission9-security-gate-closed').length,
      gateOpen: objects.filter((item) => item.name === 'mission9-security-gate-open').length,
      gateLock: objects.filter((item) => item.name === 'mission9-gate-lock-panel').length,
      powerStation: objects.filter((item) => item.name === 'mission9-power-station-inactive' || item.name === 'mission9-power-station-active').length,
      powerSocket: objects.filter((item) => item.name === 'mission9-power-module-socket').length,
      completion: objects.filter((item) => item.name === 'mission9-completion').length,
      orientationGate: objects.filter((item) => item.name === 'mission9-orientation-gate').length,
    },
    labels: objects.map((item) => item.text).filter(Boolean),
  };
}

function center(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function pointerTap(context, page, point, input) {
  if (input === 'touch') {
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    await sleep(60);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.click(point.x, point.y);
  }
  await sleep(220);
}

async function pointerDrag(context, page, from, to, input) {
  if (input === 'touch') {
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let i = 1; i <= 10; i += 1) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 }] });
      await sleep(18);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
  }
  await sleep(620);
}

function choiceFor(state, kind) {
  if (kind === 'correct') return state.choices.find((choice) => /correct/.test(choice.action));
  return state.choices.find((choice) => !/correct/.test(choice.action));
}

function gapPoint(state) {
  const [a, b] = state.choices;
  return { x: (a.bounds.x + a.bounds.width + b.bounds.x) / 2, y: a.bounds.y + a.bounds.height / 2 };
}

async function tapWrongThenCorrect(context, page, input) {
  const before = await inspectMission9(page);
  const wrong = choiceFor(before, 'wrong');
  const correct = choiceFor(before, 'correct');
  const target = center(before.target.bounds);
  const checks = [];

  await pointerTap(context, page, gapPoint(before), input);
  let state = await inspectMission9(page);
  checks.push({ name: `${before.stage}-gap-selects-nothing`, ok: state.selectedAction === null && state.stage === before.stage, selectedAction: state.selectedAction, stage: state.stage });

  await pointerTap(context, page, center(wrong.bounds), input);
  state = await inspectMission9(page);
  checks.push({ name: `${before.stage}-wrong-selected`, ok: state.selectedAction === wrong.action, selectedAction: state.selectedAction, interactionState: state.interactionState });

  await pointerTap(context, page, target, input);
  await sleep(900);
  state = await inspectMission9(page);
  checks.push({ name: `${before.stage}-wrong-target-no-advance`, ok: state.stage === before.stage && !state.snapshot.completed, stage: state.stage, completed: state.snapshot.completed });

  await pointerTap(context, page, center(correct.bounds), input);
  state = await inspectMission9(page);
  checks.push({ name: `${before.stage}-correct-selected`, ok: state.selectedAction === correct.action, selectedAction: state.selectedAction, interactionState: state.interactionState });

  await pointerTap(context, page, target, input);
  await page.waitForFunction((previous) => {
    const snapshot = window.__ROBOTLAB_QA__.robotTestCourse.snapshot;
    return snapshot.courseStage !== previous || snapshot.completed;
  }, before.stage, { timeout: 9000 }).catch(() => undefined);
  await sleep(360);
  state = await inspectMission9(page);
  checks.push({ name: `${before.stage}-correct-target-advances`, ok: state.stage !== before.stage || state.snapshot.completed, stage: state.stage, completed: state.snapshot.completed });
  return checks;
}

async function runMission9Input(browser, width, height, input) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: input === 'touch', isMobile: input === 'touch' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openGame(page);
  await startScene(page, 'Mission9Scene');
  const checks = [];
  checks.push(...await tapWrongThenCorrect(context, page, input));
  checks.push(...await tapWrongThenCorrect(context, page, input));
  checks.push(...await tapWrongThenCorrect(context, page, input));
  const final = await inspectMission9(page);
  await context.close();
  return { viewport: `${width}x${height}`, input, checks, final, clean: cleanRuntimeErrors(errors), errors, ok: checks.every((check) => check.ok) && final.snapshot.completed && cleanRuntimeErrors(errors) };
}

async function runMission9DragRegression(browser, width, height, input) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: input === 'touch', isMobile: input === 'touch' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openGame(page);
  await startScene(page, 'Mission9Scene');
  const checks = [];
  for (let i = 0; i < 3; i += 1) {
    const state = await inspectMission9(page);
    const wrong = choiceFor(state, 'wrong');
    const correct = choiceFor(state, 'correct');
    const target = center(state.target.bounds);
    await pointerDrag(context, page, center(wrong.bounds), target, input);
    let after = await inspectMission9(page);
    checks.push({ name: `${state.stage}-drag-wrong-no-advance`, ok: after.stage === state.stage && !after.snapshot.completed, stage: after.stage });
    await sleep(900);
    await pointerDrag(context, page, center(correct.bounds), target, input);
    await page.waitForFunction((previous) => {
      const snapshot = window.__ROBOTLAB_QA__.robotTestCourse.snapshot;
      return snapshot.courseStage !== previous || snapshot.completed;
    }, state.stage, { timeout: 9000 }).catch(() => undefined);
    after = await inspectMission9(page);
    checks.push({ name: `${state.stage}-drag-correct-advances`, ok: after.stage !== state.stage || after.snapshot.completed, stage: after.stage, completed: after.snapshot.completed });
  }
  const final = await inspectMission9(page);
  await context.close();
  return { viewport: `${width}x${height}`, input, checks, final, clean: cleanRuntimeErrors(errors), errors, ok: checks.every((check) => check.ok) && final.snapshot.completed && cleanRuntimeErrors(errors) };
}

function centered(value, min, max) {
  return value >= min && value <= max;
}

async function captureScene(browser, sceneName, width, height, label, advanceStage = null) {
  const input = width < 1000 ? 'touch' : 'mouse';
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: input === 'touch', isMobile: input === 'touch' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openGame(page);
  await startScene(page, sceneName);
  if (sceneName === 'Mission9Scene' && advanceStage) {
    while ((await inspectMission9(page)).stage !== advanceStage) {
      const state = await inspectMission9(page);
      const correct = choiceFor(state, 'correct');
      await pointerTap(context, page, center(correct.bounds), input);
      await pointerTap(context, page, center(state.target.bounds), input);
      await page.waitForFunction((previous) => {
        const snapshot = window.__ROBOTLAB_QA__.robotTestCourse.snapshot;
        return snapshot.courseStage !== previous || snapshot.completed;
      }, state.stage, { timeout: 9000 }).catch(() => undefined);
      await sleep(380);
    }
  }
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshot = path.join(screenshotDir, `stage9-9-${label}.png`);
  await page.screenshot({ path: screenshot });
  let summary;
  if (sceneName === 'Mission9Scene') {
    const state = await inspectMission9(page);
    const world = await page.evaluate(() => window.__ROBOTLAB_GAME__.registry.get('sceneComposition').mission9.world);
    const targetX = state.target?.bounds ? center(state.target.bounds).x : null;
    summary = { state, world, centered: targetX === null ? true : centered(targetX, world.x + world.width * 0.35, world.x + world.width * 0.72) };
  } else {
    const objects = await allSceneObjects(page, sceneName);
    summary = { labels: objects.map((item) => item.text).filter(Boolean), objects: objects.filter((item) => item.name) };
  }
  await context.close();
  return { sceneName, viewport: `${width}x${height}`, label, screenshot, clean: cleanRuntimeErrors(errors), errors, summary, ok: cleanRuntimeErrors(errors) };
}

async function capturePortraitGate(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openGame(page);
  await startScene(page, 'Mission9Scene');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshot = path.join(screenshotDir, `stage9-9-mission9-${width}x${height}-orientation-gate.png`);
  await page.screenshot({ path: screenshot });
  const state = await inspectMission9(page);
  await context.close();
  return { viewport: `${width}x${height}`, screenshot, state, clean: cleanRuntimeErrors(errors), errors, ok: state.counts.orientationGate === 1 && state.labels.includes('ПОВЕРНИ ТЕЛЕФОН') && cleanRuntimeErrors(errors) };
}

(async () => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  try {
    const captures = [
      await captureScene(browser, 'Mission7Scene', 1280, 720, 'mission7-desktop'),
      await captureScene(browser, 'Mission8Scene', 1280, 720, 'mission8-desktop'),
      await captureScene(browser, 'Mission9Scene', 1280, 720, 'mission9-bridge-desktop'),
      await captureScene(browser, 'Mission9Scene', 1280, 720, 'mission9-gate-desktop', 'GATE'),
      await captureScene(browser, 'Mission9Scene', 1280, 720, 'mission9-power-desktop', 'POWER'),
      await captureScene(browser, 'Mission9Scene', 844, 390, 'mission9-bridge-samsung'),
      await captureScene(browser, 'Mission9Scene', 844, 390, 'mission9-gate-samsung', 'GATE'),
      await captureScene(browser, 'Mission9Scene', 844, 390, 'mission9-power-samsung', 'POWER'),
    ];
    const inputRuns = [
      await runMission9Input(browser, 1280, 720, 'mouse'),
      await runMission9Input(browser, 844, 390, 'touch'),
      await runMission9Input(browser, 915, 412, 'touch'),
    ];
    const dragRuns = [
      await runMission9DragRegression(browser, 844, 390, 'touch'),
    ];
    const portrait = [
      await capturePortraitGate(browser, 390, 844),
      await capturePortraitGate(browser, 412, 915),
    ];
    const report = { result: [...captures, ...inputRuns, ...dragRuns, ...portrait].every((item) => item.ok) ? 'PASS' : 'FAIL', captures, inputRuns, dragRuns, portrait };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ result: report.result, captures: captures.map((item) => ({ label: item.label, ok: item.ok, screenshot: item.screenshot })), inputRuns: inputRuns.map((item) => ({ viewport: item.viewport, ok: item.ok })), dragRuns: dragRuns.map((item) => ({ viewport: item.viewport, ok: item.ok })), portrait: portrait.map((item) => ({ viewport: item.viewport, ok: item.ok, screenshot: item.screenshot })) }, null, 2)}\n`);
    if (report.result !== 'PASS') process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});