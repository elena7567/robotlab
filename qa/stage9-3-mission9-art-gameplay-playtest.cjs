const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage9-3-mission9-art-gameplay-playtest.json');
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

async function openMission9(page) {
  await page.goto(baseUrl, { waitUntil: 'commit', timeout: 90000 });
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
  await sleep(260);
}

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

async function tap(page, name, touch, settle = 180) {
  const point = await pointFor(page, 'Mission9Scene', name);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(settle);
}

async function dragOutside(page, name) {
  const point = await pointFor(page, 'Mission9Scene', name);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 95, point.y - 130, { steps: 6 });
  await page.mouse.up();
  await sleep(260);
}

async function waitStage(page, stage) {
  await page.waitForFunction((expected) => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === expected, stage, { timeout: 7000 });
  await sleep(220);
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
    const has = (name) => Boolean(find(name));
    const labels = all.filter((item) => typeof item?.text === 'string').map((item) => item.text);
    const actions = all.filter((item) => item?.name?.startsWith('mission9-choice-') && item.getData?.('courseAction')).map((item) => ({
      name: item.name,
      action: item.getData?.('courseAction'),
      hit: item.input?.hitArea ? { width: item.input.hitArea.width, height: item.input.hitArea.height } : null,
      bounds: item.getData?.('auditBounds'),
    }));
    return {
      mechanic: window.__ROBOTLAB_QA__.robotTestCourse.snapshot,
      session: game.registry.get('sessionSnapshot'),
      labels,
      actions,
      hasRawPrototypeGate: has('mission9-gate-left') || has('mission9-gate-right') || has('mission9-gate-frame'),
      hasRawPrototypePath: has('mission9-fork-paths') || has('mission9-blocked-path-barrier'),
      hasRawPrototypeStation: has('mission9-power-station') || has('mission9-station-slot'),
      hasBridge: has('mission9-bridge-platform-left') && has('mission9-bridge-platform-right') && has('mission9-bridge-gap-target'),
      hasBridgeSolved: has('mission9-bridge-gap-target') && find('mission9-bridge-gap-target')?.texture?.key === 'MISSION9_BRIDGE_REPAIRED',
      hasGate: has('mission9-security-gate-closed'),
      hasGateOpen: find('mission9-security-gate-closed')?.texture?.key === 'MISSION9_GATE_OPEN' || has('mission9-security-gate-open'),
      hasPower: has('mission9-power-station-inactive'),
      hasPowerActive: find('mission9-power-station-inactive')?.texture?.key === 'MISSION9_POWER_STATION_ON' || has('mission9-power-station-active'),
      hasCompletion: has('mission9-completion'),
      hasRobot: has('mission9-repaired-robot-image'),
      progressDots: all.filter((item) => item?.name?.startsWith('mission9-progress-dot-')).length,
    };
  });
}

async function screenshot(page, name) {
  const file = path.join(screenshotDir, name);
  await page.screenshot({ path: file });
  return file;
}

async function captureFlowState(browser, viewport, name) {
  const [width, height] = viewport;
  const touch = width < 1100;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: width < 1000 });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);

  if (name === 'bridge-solved') {
    await tap(page, 'mission9-choice-bridge-correct', touch, 430);
  } else if (name === 'gate-unsolved' || name === 'gate-open' || name === 'power-unsolved' || name === 'power-active' || name === 'final') {
    await tap(page, 'mission9-choice-bridge-correct', touch, 1120);
    await waitStage(page, 'GATE');
    if (name === 'gate-open') await tap(page, 'mission9-choice-gate-correct', touch, 430);
    if (name === 'power-unsolved' || name === 'power-active' || name === 'final') {
      await tap(page, 'mission9-choice-gate-correct', touch, 1120);
      await waitStage(page, 'POWER');
      if (name === 'power-active') await tap(page, 'mission9-choice-power-correct', touch, 430);
      if (name === 'final') {
        await tap(page, 'mission9-choice-power-correct', touch, 1450);
        await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-completion'), null, { timeout: 7000 });
      }
    }
  }

  const state = await inspect(page);
  const shot = await screenshot(page, `stage9-3-mission9-${width}x${height}-${name}.png`);
  await context.close();
  return { viewport: `${width}x${height}`, name, screenshot: shot, state, errors, clean: clean(errors) };
}

async function runInteractions(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  await tap(page, 'mission9-choice-bridge-wrong-arc', true, 220);
  const wrongBridge = await inspect(page);
  await sleep(430);
  await dragOutside(page, 'mission9-choice-bridge-correct');
  const outsideDrop = await inspect(page);
  await tap(page, 'mission9-choice-bridge-correct', true, 1120);
  await waitStage(page, 'GATE');
  await tap(page, 'mission9-choice-gate-wrong-2', true, 220);
  const wrongGate = await inspect(page);
  await sleep(430);
  await tap(page, 'mission9-choice-gate-correct', true, 1120);
  await waitStage(page, 'POWER');
  await tap(page, 'mission9-choice-power-wrong-1', true, 220);
  const wrongPower = await inspect(page);
  await sleep(430);
  await tap(page, 'mission9-choice-power-correct', true, 900);
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.completed === true, null, { timeout: 7000 });
  await tap(page, 'mission9-choice-power-correct', true, 20).catch(() => {});
  const complete = await inspect(page);
  await context.close();
  return {
    checks: {
      wrongBridgeRetry: wrongBridge.mechanic.courseStage === 'BRIDGE' && wrongBridge.labels.includes('НЕ ПОДХОДИТ'),
      dropOutsideDoesNotAdvance: outsideDrop.mechanic.courseStage === 'BRIDGE',
      wrongGateRetry: wrongGate.mechanic.courseStage === 'GATE' && wrongGate.labels.includes('НЕ ТОТ КЛЮЧ'),
      wrongPowerRetry: wrongPower.mechanic.courseStage === 'POWER' && wrongPower.labels.includes('НЕ ПОДХОДИТ'),
      duplicatePowerSafe: complete.mechanic.completed === true,
      clean: clean(errors),
    },
    errors,
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  const captures = [];
  for (const name of ['bridge-unsolved', 'bridge-solved', 'gate-unsolved', 'gate-open', 'power-unsolved', 'power-active', 'final']) {
    captures.push(await captureFlowState(browser, [844, 390], name));
  }
  for (const name of ['bridge-unsolved', 'gate-unsolved', 'final']) {
    captures.push(await captureFlowState(browser, [1280, 720], name));
  }
  for (const viewport of [[740, 360], [915, 412], [1024, 768], [1438, 914]]) {
    captures.push(await captureFlowState(browser, viewport, 'bridge-unsolved'));
  }
  const interactions = await runInteractions(browser);
  await browser.close();

  const required = {
    referencesLoadedAsRuntimeAssets: captures.every((entry) => entry.state.hasRobot && entry.state.progressDots === 3),
    rawPrototypeArtRemoved: captures.every((entry) => !entry.state.hasRawPrototypeGate && !entry.state.hasRawPrototypePath && !entry.state.hasRawPrototypeStation),
    bridgePuzzle: captures.some((entry) => entry.name === 'bridge-unsolved' && entry.state.hasBridge)
      && captures.some((entry) => entry.name === 'bridge-solved' && entry.state.hasBridgeSolved),
    gatePuzzle: captures.some((entry) => entry.name === 'gate-unsolved' && entry.state.hasGate)
      && captures.some((entry) => entry.name === 'gate-open' && entry.state.hasGateOpen),
    powerPuzzle: captures.some((entry) => entry.name === 'power-unsolved' && entry.state.hasPower)
      && captures.some((entry) => entry.name === 'power-active' && entry.state.hasPowerActive),
    completion: captures.some((entry) => entry.name === 'final' && entry.state.hasCompletion && entry.state.labels.includes('РОБОТ ГОТОВ К ПЕРВОМУ ЗАПУСКУ')),
    compactCopy: captures.every((entry) => !entry.state.labels.some((text) => /ВОРОТА|ПУТЬ|МОДУЛЬ|СТАНЦИЯ/.test(text) && text.length < 12)),
    touchTargets: captures.every((entry) => entry.state.actions.every((action) => action.hit?.width >= 56 && action.hit?.height >= 56)),
    cleanRuntime: captures.every((entry) => entry.clean) && interactions.checks.clean,
    interactions: Object.entries(interactions.checks).every(([, ok]) => ok),
  };
  const failures = [
    ...Object.entries(required).filter(([, ok]) => !ok).map(([key]) => `required:${key}`),
    ...captures.filter((entry) => !entry.clean).map((entry) => `runtime:${entry.viewport}:${entry.name}`),
    ...Object.entries(interactions.checks).filter(([, ok]) => !ok).map(([key]) => `interaction:${key}`),
  ];
  const report = { required, captures, interactions, failures };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    required,
    captures: captures.map(({ viewport, name, screenshot }) => ({ viewport, name, screenshot })),
    interactions: interactions.checks,
    failures,
  }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
