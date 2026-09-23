const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const directUrl = `${baseUrl}?qaMission=7`;
const reportPath = path.join('docs', 'qa', 'mission7-device-routing-review.json');
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.mkdirSync(screenshotDir, { recursive: true });

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
  return consoleErrors.length === 0
    && errors.requests.length === 0
    && errors.responses.length === 0
    && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;
}

function assert(checks, condition, message, details = undefined) {
  checks.push({ ok: Boolean(condition), message, details });
}

async function waitRobotLab(page) {
  await page.waitForFunction(() => Boolean(window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__), null, { timeout: 45000 });
}

async function waitMission7Settled(page) {
  await waitRobotLab(page);
  await page.waitForFunction(() => {
    const game = window.__ROBOTLAB_GAME__;
    const m7 = game.scene.getScene('Mission7Scene');
    const guard = game.scene.getScene('Mission7OrientationGuardScene');
    return (game.scene.isActive('Mission7Scene') && (m7.children.getByName('connection-task-card') || m7.children.getByName('mission7-orientation-gate')))
      || (game.scene.isActive('Mission7OrientationGuardScene') && guard.children.getByName('mission7-preentry-orientation-gate'));
  }, null, { timeout: 20000 });
  await sleep(300);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const collect = (sceneKey) => {
      const scene = game.scene.getScene(sceneKey);
      if (!scene?.children) return [];
      const all = [];
      const walk = (item) => {
        all.push({ name: item.name || '', text: typeof item.text === 'string' ? item.text : '', type: item.type || '', visible: item.visible !== false });
        if (item?.list) for (const child of item.list) walk(child);
      };
      scene.children.list.forEach(walk);
      return all;
    };
    const items = [...collect('Mission7Scene'), ...collect('Mission7OrientationGuardScene')];
    const labels = items.map((item) => item.text).filter(Boolean);
    const layout = game.registry.get('responsiveLayout');
    return {
      activeScenes: game.scene.getScenes(true).map((scene) => scene.scene.key),
      scale: { width: game.scale.width, height: game.scale.height },
      semanticMode: layout?.semanticMode ?? null,
      deviceLayoutClass: layout?.deviceLayoutClass ?? null,
      mission7Active: game.scene.isActive('Mission7Scene'),
      guardActive: game.scene.isActive('Mission7OrientationGuardScene'),
      orientationGateRegistry: game.registry.get('mission7OrientationGate') === true,
      inputActive: game.registry.get('mission7InputActive') === true,
      gateCount: items.filter((item) => item.name.includes('orientation-gate')).length,
      phoneCopyCount: labels.filter((text) => text === 'ПОВЕРНИ ТЕЛЕФОН').length,
      verticalCopyCount: labels.filter((text) => text === 'ИГРАЕМ ВЕРТИКАЛЬНО').length,
      taskPanelCount: items.filter((item) => item.name === 'connection-task-card').length,
      terminalCount: items.filter((item) => item.name.startsWith('connection-source-') || item.name.startsWith('connection-target-')).length,
      hintCount: items.filter((item) => item.name === 'connection-hint-button').length,
      labels,
    };
  });
}

function assertGameplay(checks, info, label, expectedClass) {
  assert(checks, info.mission7Active, `${label}: Mission7Scene active`, info.activeScenes);
  assert(checks, !info.guardActive, `${label}: guard scene inactive`, info.activeScenes);
  assert(checks, info.orientationGateRegistry === false, `${label}: orientation gate registry false`, info);
  assert(checks, info.gateCount === 0, `${label}: orientation gate count 0`, info);
  assert(checks, info.phoneCopyCount === 0, `${label}: ПОВЕРНИ ТЕЛЕФОН not visible`, info.labels);
  assert(checks, info.verticalCopyCount === 0, `${label}: ИГРАЕМ ВЕРТИКАЛЬНО not visible`, info.labels);
  assert(checks, info.taskPanelCount === 1, `${label}: Mission 7 task panel visible`, info);
  assert(checks, info.terminalCount >= 6, `${label}: wire terminals visible`, info);
  assert(checks, info.hintCount === 1, `${label}: Hint visible`, info);
  assert(checks, info.inputActive === true, `${label}: Mission 7 input active`, info);
  if (expectedClass) assert(checks, info.deviceLayoutClass === expectedClass, `${label}: device class ${expectedClass}`, info);
}

function assertGate(checks, info, label) {
  assert(checks, info.orientationGateRegistry === true, `${label}: orientation gate registry true`, info);
  assert(checks, info.gateCount >= 1, `${label}: orientation gate present`, info);
  assert(checks, info.phoneCopyCount === 1, `${label}: ПОВЕРНИ ТЕЛЕФОН visible`, info.labels);
  assert(checks, info.verticalCopyCount === 1, `${label}: ИГРАЕМ ВЕРТИКАЛЬНО visible`, info.labels);
  assert(checks, info.taskPanelCount === 0, `${label}: task panel hidden`, info);
  assert(checks, info.terminalCount === 0, `${label}: wire terminals hidden`, info);
  assert(checks, info.hintCount === 0, `${label}: Hint hidden`, info);
  assert(checks, info.inputActive === false, `${label}: Mission 7 input inactive`, info);
  assert(checks, info.deviceLayoutClass === 'MOBILE_OR_TABLET' || info.guardActive, `${label}: mobile/tablet routing`, info);
}

async function directCase(browser, viewport, mobile, expectation, label) {
  console.log('RUN ' + label);
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  const errors = captureErrors(page);
  const checks = [];
  await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitMission7Settled(page);
  const info = await inspect(page);
  if (expectation === 'gameplay') assertGameplay(checks, info, label, mobile ? 'MOBILE_OR_TABLET' : 'DESKTOP');
  else assertGate(checks, info, label);
  await page.screenshot({ path: path.join(screenshotDir, `mission7-device-${label}.png`) });
  assert(checks, cleanErrors(errors), `${label}: console/network clean`, errors);
  await context.close();
  return { label, viewport, mobile, expectation, info, checks, errors, ok: checks.every((check) => check.ok) };
}

async function desktopResizeCase(browser) {
  console.log('RUN desktop-resize');
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, hasTouch: false, isMobile: false });
  const page = await context.newPage();
  const errors = captureErrors(page);
  const checks = [];
  const states = [];
  await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  for (const viewport of [{ width: 1200, height: 900 }, { width: 1000, height: 800 }, { width: 900, height: 700 }]) {
    await page.setViewportSize(viewport);
    await waitMission7Settled(page);
    const info = await inspect(page);
    const label = `desktop-resize-${viewport.width}x${viewport.height}`;
    assertGameplay(checks, info, label, 'DESKTOP');
    states.push({ viewport, info });
  }
  assert(checks, cleanErrors(errors), 'desktop resize: console/network clean', errors);
  await context.close();
  return { label: 'desktop-resize', states, checks, errors, ok: checks.every((check) => check.ok) };
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
  await waitRobotLab(page);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.textures.exists('bg-main-laboratory'), null, { timeout: 45000 });
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

async function completeMission6Normally(page) {
  await page.evaluate(() => {
    const { sessionState } = window.__ROBOTLAB_QA__;
    if (!sessionState.snapshot.powerActivated) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.registry.set('mission6Complete', true);
    window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').scene.restart();
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission6Complete') === true
    && window.__ROBOTLAB_GAME__.scene.isActive('Mission6Scene')
    && window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('mission6-continue'), null, { timeout: 9000 });
  await sleep(250);
}

async function naturalFlowCase(browser, viewport, mobile, expectation, label) {
  console.log('RUN ' + label);
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  const errors = captureErrors(page);
  const checks = [];
  await startMission6(page);
  await completeMission6Normally(page);
  await tapByName(page, 'Mission6Scene', 'mission6-continue');
  await waitMission7Settled(page);
  const info = await inspect(page);
  if (expectation === 'gameplay') assertGameplay(checks, info, label, mobile ? 'MOBILE_OR_TABLET' : 'DESKTOP');
  else assertGate(checks, info, label);
  assert(checks, cleanErrors(errors), `${label}: console/network clean`, errors);
  await context.close();
  return { label, viewport, mobile, expectation, info, checks, errors, ok: checks.every((check) => check.ok) };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1438, height: 914 },
      { width: 1600, height: 900 },
      { width: 1920, height: 1080 },
    ]) results.push(await directCase(browser, viewport, false, 'gameplay', `desktop-${viewport.width}x${viewport.height}`));
    results.push(await desktopResizeCase(browser));
    for (const viewport of [{ width: 390, height: 844 }, { width: 412, height: 915 }, { width: 360, height: 800 }]) {
      results.push(await directCase(browser, viewport, true, 'gameplay', `phone-portrait-${viewport.width}x${viewport.height}`));
    }
    for (const viewport of [{ width: 740, height: 360 }, { width: 844, height: 390 }, { width: 915, height: 412 }]) {
      results.push(await directCase(browser, viewport, true, 'gate', `phone-landscape-${viewport.width}x${viewport.height}`));
    }
    results.push(await directCase(browser, { width: 768, height: 1024 }, true, 'gameplay', 'tablet-portrait-768x1024'));
    results.push(await directCase(browser, { width: 1024, height: 768 }, true, 'gate', 'tablet-landscape-1024x768'));
    results.push(await naturalFlowCase(browser, { width: 1280, height: 720 }, false, 'gameplay', 'mission6-to-7-desktop'));
    results.push(await naturalFlowCase(browser, { width: 390, height: 844 }, true, 'gameplay', 'mission6-to-7-mobile-portrait'));
    results.push(await naturalFlowCase(browser, { width: 844, height: 390 }, true, 'gate', 'mission6-to-7-mobile-landscape'));
    const allChecks = results.flatMap((result) => result.checks);
    const report = {
      result: results.every((item) => item.ok) ? 'PASS' : 'FAIL',
      totalChecks: allChecks.length,
      failedChecks: allChecks.filter((check) => !check.ok),
      results,
      finishedAt: new Date().toISOString(),
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ result: report.result, totalChecks: report.totalChecks, failedChecks: report.failedChecks }, null, 2));
    if (report.result !== 'PASS') process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
