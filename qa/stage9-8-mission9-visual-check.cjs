const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage9-8-mission9-visual-check.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}
const cleanRuntimeErrors = (errors) => errors.console.length === 0 && errors.page.length === 0 && errors.requests.length === 0 && errors.responses.length === 0;

async function openMission9(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_BRIDGE_CORRECT'), null, { timeout: 90000 });
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
    const walk = (item) => { all.push(item); if (item?.list) for (const child of item.list) walk(child); };
    scene.children.list.forEach(walk);
    const count = (name) => all.filter((item) => item?.name === name).length;
    const bounds = (name) => {
      const item = all.find((entry) => entry?.name === name);
      if (!item) return null;
      const data = item.getData?.('auditBounds');
      if (data) return data;
      const b = item.getBounds?.();
      return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
    };
    const robot = all.find((item) => item?.name === 'mission9-repaired-robot');
    return {
      stage: window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage,
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
      },
      bounds: {
        bridgeLeft: bounds('mission9-bridge-platform-left'),
        bridgeRight: bounds('mission9-bridge-platform-right'),
        bridgeGap: bounds('mission9-bridge-gap-target'),
        visibleGap: bounds('mission9-bridge-visible-gap'),
        gateLock: bounds('mission9-gate-lock-panel'),
        powerSocket: bounds('mission9-power-module-socket'),
      },
      robot: { visibleFeetGroundY: robot?.getData?.('visibleFeetGroundY') ?? null, visibleBottomY: robot?.getData?.('visibleBottomY') ?? null },
    };
  });
}

async function centerFor(page, name) {
  return page.evaluate((name) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (item?.list) for (const child of item.list) walk(child); };
    scene.children.list.forEach(walk);
    const item = all.find((entry) => entry?.name === name);
    const debug = item.getData('inputDebug');
    return debug.visibleCenter;
  }, name);
}
async function targetCenter(page) {
  const state = await inspect(page);
  const target = state.stage === 'BRIDGE' ? state.bounds.bridgeGap : state.stage === 'GATE' ? state.bounds.gateLock : state.bounds.powerSocket;
  return { x: target.x + target.width / 2, y: target.y + target.height / 2 };
}
async function drag(page, name) {
  const from = await centerFor(page, name);
  const to = await targetCenter(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction((previousStage) => {
    const snapshot = window.__ROBOTLAB_QA__.robotTestCourse.snapshot;
    return snapshot.courseStage !== previousStage || snapshot.completed;
  }, (await inspect(page)).stage, { timeout: 12000 });
  await sleep(320);
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  const captures = [];
  for (const stage of ['bridge', 'gate', 'power']) {
    const state = await inspect(page);
    const file = path.join(screenshotDir, `stage9-8-mission9-1280x720-${stage}.png`);
    await page.screenshot({ path: file });
    captures.push({ stage: state.stage, state, screenshot: file });
    if (stage === 'bridge') await drag(page, 'mission9-choice-bridge-correct');
    if (stage === 'gate') await drag(page, 'mission9-choice-gate-correct');
  }
  const report = { result: cleanRuntimeErrors(errors) ? 'READY_FOR_REVIEW' : 'FAIL', clean: cleanRuntimeErrors(errors), errors, captures };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ result: report.result, clean: report.clean, screenshots: captures.map((c) => c.screenshot), stages: captures.map((c) => c.stage) }, null, 2)}\n`);
  await context.close();
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });