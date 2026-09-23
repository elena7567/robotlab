const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const outDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'mission6-to-mission7-orientation-handoff.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

function cleanErrors(errors) {
  const consoleErrors = errors.console.filter((message) => !message.includes('[RobotLab layout] unintended overlaps'));
  return consoleErrors.length === 0 && errors.requests.length === 0 && errors.responses.length === 0
    && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;
}

async function tapByName(page, sceneName, name) {
  const point = await page.evaluate(({ sceneName, name }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneName);
    const walk = (item) => {
      if (item?.name === name || item?.text === name) return item;
      if (item?.list) for (const child of item.list) { const found = walk(child); if (found) return found; }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Target not found: ${sceneName}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { sceneName, name });
  await page.mouse.click(point.x, point.y);
  await sleep(220);
}

async function startMission6(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__, null, { timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.textures.exists('bg-main-laboratory'), null, { timeout: 45000 });
  await sleep(250);
  await page.evaluate(() => {
    const { sessionState } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    for (let index = 0; index < 5; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission6Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission6Scene')
    && window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('energy-task-card'), null, { timeout: 12000 });
  await sleep(250);
}

async function completeMission6Normally(page, beforeFinalCheck) {
  await tapByName(page, 'Mission6Scene', 'energy-battery-full');
  await tapByName(page, 'Mission6Scene', 'energy-check-button');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('energy-task-card')?.getData('challengeIndex') === 1, null, { timeout: 5000 });
  await tapByName(page, 'Mission6Scene', 'energy-battery-low');
  await tapByName(page, 'Mission6Scene', 'energy-check-button');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('energy-task-card')?.getData('challengeIndex') === 2, null, { timeout: 5000 });
  await tapByName(page, 'Mission6Scene', 'energy-battery-low');
  await tapByName(page, 'Mission6Scene', 'energy-battery-medium');
  await tapByName(page, 'Mission6Scene', 'energy-battery-full');
  if (beforeFinalCheck) await beforeFinalCheck();
  await tapByName(page, 'Mission6Scene', 'energy-check-button');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission6Complete') === true
    && window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('mission6-continue'), null, { timeout: 9000 });
  await sleep(250);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const activeScenes = game.scene.getScenes(true).map((scene) => scene.scene.key);
    const collect = (sceneKey) => {
      const scene = game.scene.getScene(sceneKey);
      if (!scene?.children) return [];
      const all = [];
      const walk = (item) => {
        all.push({ name: item.name || '', text: typeof item.text === 'string' ? item.text : '', type: item.type || '' });
        if (item?.list) for (const child of item.list) walk(child);
      };
      scene.children.list.forEach(walk);
      return all;
    };
    const guardItems = collect('Mission7OrientationGuardScene');
    const mission7Items = collect('Mission7Scene');
    return {
      activeScenes,
      guardActive: game.scene.isActive('Mission7OrientationGuardScene'),
      mission7Active: game.scene.isActive('Mission7Scene'),
      gateVisible: [...guardItems, ...mission7Items].some((item) => item.name.includes('orientation-gate')),
      preentryGateVisible: guardItems.some((item) => item.name === 'mission7-preentry-orientation-gate'),
      gateCopyVisible: [...guardItems, ...mission7Items].some((item) => item.text === 'ПОВЕРНИ ТЕЛЕФОН'),
      mission7PanelVisible: mission7Items.some((item) => item.name === 'connection-task-card'),
      mission7TerminalsVisible: mission7Items.some((item) => item.name.startsWith('connection-source-') || item.name.startsWith('connection-target-')),
      mission7HintVisible: mission7Items.some((item) => item.name === 'connection-hint-button'),
      mission7InputActive: game.registry.get('mission7InputActive') === true,
      mission7OrientationGate: game.registry.get('mission7OrientationGate') === true,
      session: game.registry.get('sessionSnapshot'),
      scale: { width: game.scale.width, height: game.scale.height },
    };
  });
}

async function waitForGuardPortrait(page) {
  await page.waitForFunction(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game?.scene.getScene('Mission7OrientationGuardScene');
    return game?.scene.isActive('Mission7OrientationGuardScene')
      && !game?.scene.isActive('Mission7Scene')
      && scene?.children.getByName('mission7-preentry-orientation-gate');
  }, null, { timeout: 12000 });
  await sleep(180);
}

async function waitForMission7Landscape(page) {
  await page.waitForFunction(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game?.scene.getScene('Mission7Scene');
    return game?.scene.isActive('Mission7Scene')
      && !game?.scene.isActive('Mission7OrientationGuardScene')
      && scene?.children.getByName('connection-task-card')
      && game?.registry.get('mission7InputActive') === true;
  }, null, { timeout: 14000 });
  await sleep(220);
}

async function runPortraitHandoff(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startMission6(page);
  await completeMission6Normally(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(260);
  await tapByName(page, 'Mission6Scene', 'mission6-continue');
  await waitForGuardPortrait(page);
  const portrait = await inspect(page);
  await page.screenshot({ path: path.join(outDir, 'mission6-to-mission7-portrait-guard.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await waitForMission7Landscape(page);
  const landscape = await inspect(page);
  await page.screenshot({ path: path.join(outDir, 'mission6-to-mission7-landscape-after-rotation.png') });
  await context.close();
  return {
    ok: portrait.gateVisible && portrait.preentryGateVisible && portrait.gateCopyVisible
      && portrait.guardActive && !portrait.mission7Active
      && !portrait.mission7PanelVisible && !portrait.mission7TerminalsVisible && !portrait.mission7HintVisible && !portrait.mission7InputActive
      && !landscape.guardActive && landscape.mission7Active && !landscape.gateVisible
      && landscape.mission7PanelVisible && landscape.mission7TerminalsVisible && landscape.mission7HintVisible && landscape.mission7InputActive
      && cleanErrors(errors),
    portrait,
    landscape,
    errors,
  };
}

async function runAlreadyLandscape(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startMission6(page);
  await completeMission6Normally(page);
  await tapByName(page, 'Mission6Scene', 'mission6-continue');
  await waitForMission7Landscape(page);
  const state = await inspect(page);
  await context.close();
  return {
    ok: state.mission7Active && !state.guardActive && !state.gateVisible && state.mission7PanelVisible && state.mission7InputActive && cleanErrors(errors),
    state,
    errors,
  };
}

async function runPortraitBeforeCompletion(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startMission6(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(320);
  await page.evaluate(() => {
    const { sessionState } = window.__ROBOTLAB_QA__;
    if (!sessionState.snapshot.powerActivated) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').scene.restart();
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission6Scene')
    && window.__ROBOTLAB_GAME__.registry.get('mission6Complete') === true
    && window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('mission6-continue'), null, { timeout: 9000 });
  await tapByName(page, 'Mission6Scene', 'mission6-continue');
  await waitForGuardPortrait(page);
  const state = await inspect(page);
  await context.close();
  return {
    ok: state.guardActive && !state.mission7Active && state.gateVisible && !state.mission7PanelVisible && !state.mission7InputActive && cleanErrors(errors),
    state,
    errors,
  };
}

async function runStatePreservationAfterStart(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(`${baseUrl}?qaMission=7`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForMission7Landscape(page);
  await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene');
    const pointFor = (name) => {
      const walk = (item) => {
        if (item?.name === name) return item;
        if (item?.list) for (const child of item.list) { const found = walk(child); if (found) return found; }
        return null;
      };
      return scene.children.list.map(walk).find(Boolean).getWorldTransformMatrix().transformPoint(0, 0);
    };
    window.__MISSION7_POINTS__ = { redSource: pointFor('connection-source-red'), redTarget: pointFor('connection-target-red') };
  });
  const points = await page.evaluate(() => window.__MISSION7_POINTS__);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points.redSource.x, y: points.redSource.y, radiusX: 12, radiusY: 12 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: points.redTarget.x, y: points.redTarget.y, radiusX: 12, radiusY: 12 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await sleep(300);
  const before = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('connection-task-card').getData('connected'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission7Scene')
    && window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('mission7-orientation-gate'), null, { timeout: 12000 });
  const portrait = await inspect(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await waitForMission7Landscape(page);
  const after = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('connection-task-card').getData('connected'));
  const landscape = await inspect(page);
  await context.close();
  return {
    ok: before.includes('red') && after.includes('red') && portrait.mission7Active && portrait.gateVisible && !portrait.mission7PanelVisible
      && landscape.mission7Active && landscape.mission7PanelVisible && landscape.mission7InputActive && cleanErrors(errors),
    before,
    after,
    portrait,
    landscape,
    errors,
  };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  try {
    const portraitHandoff = await runPortraitHandoff(browser);
    const alreadyLandscape = await runAlreadyLandscape(browser);
    const portraitBeforeCompletion = await runPortraitBeforeCompletion(browser);
    const statePreservationAfterStart = await runStatePreservationAfterStart(browser);
    const report = { portraitHandoff, alreadyLandscape, portraitBeforeCompletion, statePreservationAfterStart };
    report.result = Object.values(report).every((entry) => entry && entry.ok) ? 'PASS' : 'FAIL';
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({
      result: report.result,
      portraitHandoff: { ok: portraitHandoff.ok, portrait: portraitHandoff.portrait, landscape: portraitHandoff.landscape },
      alreadyLandscape: { ok: alreadyLandscape.ok, state: alreadyLandscape.state },
      portraitBeforeCompletion: { ok: portraitBeforeCompletion.ok, state: portraitBeforeCompletion.state },
      statePreservationAfterStart: { ok: statePreservationAfterStart.ok, before: statePreservationAfterStart.before, after: statePreservationAfterStart.after },
    }, null, 2)}\n`);
    if (report.result !== 'PASS') process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });














