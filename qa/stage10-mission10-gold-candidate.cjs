const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const shotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage10-mission10-gold-candidate.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = { result: 'FAIL', checks: [], screenshots: [], errors: [], viewports: [] };

function check(name, ok, actual) {
  results.checks.push({ name, ok, ...(actual === undefined ? {} : { actual }) });
}
function url(stage) {
  const next = new URL(baseUrl);
  next.searchParams.set('qaMission', '10');
  if (stage) next.searchParams.set('stage', stage);
  return next.toString();
}
function recordErrors(page, label) {
  page.on('console', (message) => { if (message.type() === 'error') results.errors.push({ label, type: 'console', message: message.text() }); });
  page.on('pageerror', (error) => results.errors.push({ label, type: 'page', message: error.stack || error.message }));
  page.on('requestfailed', (request) => results.errors.push({ label, type: 'request', message: request.url() + ': ' + (request.failure()?.errorText || '') }));
  page.on('response', (response) => { if (response.status() >= 400) results.errors.push({ label, type: 'response', message: response.status() + ' ' + response.url() }); });
}
async function open(page, stage) {
  await page.goto(url(stage), { waitUntil: 'commit', timeout: 45000 });
  await page.waitForFunction((expected) => {
    const game = window.__ROBOTLAB_GAME__;
    return Boolean(game?.scene.isActive('Mission10Scene') && game.registry.get('mission10Snapshot')?.stage === expected);
  }, stage === 'final' ? 'FINALE' : (stage || 'intro').toUpperCase(), { timeout: 90000 });
  await sleep(120);
}
async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const bounds = (item) => {
      const value = item?.getBounds?.();
      if (value && value.width > 0 && value.height > 0) {
        return { x: value.x, y: value.y, width: value.width, height: value.height };
      }
      if (item?.input?.hitArea && item.width > 0 && item.height > 0) {
        return { x: item.x - item.width / 2, y: item.y - item.height / 2, width: item.width, height: item.height };
      }
      return null;
    };
    return {
      snapshot: { ...window.__ROBOTLAB_QA__.mission10Controller.snapshot },
      session: { ...window.__ROBOTLAB_QA__.sessionState.snapshot },
      contract: { ...(game.registry.get('mission10SceneContract') || {}) },
      orientationCount: all.filter((item) => item?.name === 'mission10-orientation-gate').length,
      stageRootCount: all.filter((item) => item?.name === 'mission10-stage-root').length,
      robotCount: all.filter((item) => item?.texture?.key === 'robot-v2-repaired').length,
      texts: all.filter((item) => typeof item?.text === 'string').map((item) => item.text),
      targets: all.filter((item) => item?.input?.enabled).map((item) => ({
        name: item.name, bounds: bounds(item), laneId: item.getData?.('laneId') || null,
        hazardKind: item.getData?.('hazardKind') || null, relayId: item.getData?.('relayId') || null,
        reflectorId: item.getData?.('reflectorId') || null, action: item.getData?.('action') || null,
      })),
      textures: all.map((item) => item?.texture?.key).filter((key) => typeof key === 'string' && key.startsWith('MISSION10_')),
      requiredSignalAssets: {
        emitter: game.textures.exists('MISSION10_SIGNAL_EMITTER'),
        reflector: game.textures.exists('MISSION10_SIGNAL_REFLECTOR'),
        receiver: game.textures.exists('MISSION10_SIGNAL_RECEIVER'),
      },
      mission10Audio: {
        victoryCached: game.cache.audio.exists('audio-mission10-victory-theme'),
        victoryDuration: game.cache.audio.get('audio-mission10-victory-theme')?.duration ?? null,
        launchCached: game.cache.audio.exists('audio-mission10-beacon-launch'),
        launchDuration: game.cache.audio.get('audio-mission10-beacon-launch')?.duration ?? null,
      },
      energy: game.registry.get('mission10EnergyEvaluation') || null,
      signal: game.registry.get('mission10SignalEvaluation') || null,
      sceneActive: game.scene.isActive('Mission10Scene'),
      victoryActive: game.scene.isActive('VictoryScene'),
    };
  });
}
const center = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
async function tap(page, target) {
  if (!target?.bounds) throw new Error('Tap target has no usable bounds: ' + JSON.stringify(target));
  const p = center(target.bounds);
  if (page.__robotlabTouch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await sleep(170);
}
async function shot(page, name) {
  fs.mkdirSync(shotDir, { recursive: true });
  const output = path.join(shotDir, 'stage10-' + name + '.png');
  await page.screenshot({ path: output });
  results.screenshots.push(output);
}
async function solvePath(page, capture) {
  let state = await inspect(page);
  const wrong = state.targets.find((target) => target.hazardKind && target.hazardKind !== 'SAFE');
  if (wrong) {
    await tap(page, wrong);
    if (capture) await shot(page, capture + '-path-wrong');
    state = await inspect(page);
    check(capture + '-wrong-does-not-advance', state.snapshot.stage === 'PATH' && state.snapshot.pathDecisionIndex === 0);
  }
  while ((state = await inspect(page)).snapshot.stage === 'PATH') {
    const safe = state.targets.find((target) => target.hazardKind === 'SAFE');
    if (!safe) throw new Error('Safe path target missing: ' + JSON.stringify(state));
    const previousIndex = state.snapshot.pathDecisionIndex;
    await tap(page, safe);
    try {
      await page.waitForFunction((index) => {
        const game = window.__ROBOTLAB_GAME__;
        const rendered = game.registry.get('mission10Snapshot');
        return rendered?.stage !== 'PATH' || rendered?.pathDecisionIndex > index;
      }, previousIndex, { timeout: 10000 });
      await sleep(120);
    } catch (error) {
      const diagnostic = await inspect(page);
      throw new Error('Path transition timeout: ' + JSON.stringify({ previousIndex, diagnostic, cause: error.message }));
    }
  }
  check(capture + '-path-solved', state.snapshot.stage === 'ENERGY', state.snapshot);
}
async function solveEnergy(page) {
  let state = await inspect(page);
  for (const relayId of ['R1', 'R2', 'R3']) {
    for (let guard = 0; guard < 4; guard += 1) {
      state = await inspect(page);
      if (state.snapshot.stage !== 'ENERGY') return;
      const orientation = state.snapshot.relayOrientations[relayId];
      if (orientation === 0) break;
      const target = state.targets.find((item) => item.relayId === relayId);
      if (!target) throw new Error('Relay target missing: ' + relayId);
      await tap(page, target);
    }
  }
  await sleep(750);
  state = await inspect(page);
  check('energy-solved', state.snapshot.stage === 'SIGNAL', state.snapshot);
}
async function solveSignal(page) {
  let state = await inspect(page);
  const goals = {
    SIGNAL_A: { M1: 1, M2: 0 },
    SIGNAL_B: { M1: 0, M2: 0 },
    SIGNAL_C: { M1: 1, M2: 1, M3: 0 },
  };
  const goal = goals[state.snapshot.signalConfigId];
  for (const [id, wanted] of Object.entries(goal)) {
    for (let guard = 0; guard < 2; guard += 1) {
      state = await inspect(page);
      if (state.snapshot.stage !== 'SIGNAL') return;
      if ((state.snapshot.reflectorOrientations[id] % 2) === wanted) break;
      const target = state.targets.find((item) => item.reflectorId === id);
      if (!target) throw new Error('Reflector target missing: ' + id);
      await tap(page, target);
    }
  }
  await sleep(750);
  state = await inspect(page);
  check('signal-solved', state.snapshot.stage === 'LAUNCH', state.snapshot);
}
async function visualPack(browser, viewport) {
  const touch = viewport.width === 844 && viewport.height === 390;
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference', hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  await page.bringToFront();
  page.__robotlabTouch = touch;
  const label = viewport.width + 'x' + viewport.height;
  recordErrors(page, label);
  results.viewports.push(label);
  for (const stage of ['intro', 'path', 'energy', 'signal', 'launch']) {
    await open(page, stage);
    const state = await inspect(page);
    check(label + '-' + stage + '-scene', state.sceneActive && state.stageRootCount === 1 && state.robotCount === 1, state);
    check(label + '-' + stage + '-obsolete-assets-absent', state.textures.every((key) => !key.includes('ENERGY_MODULE')));
    if (stage === 'intro') {
      check(label + '-mission10-audio-decoded', state.mission10Audio.victoryCached && state.mission10Audio.launchCached
        && state.mission10Audio.victoryDuration >= 19.5 && state.mission10Audio.victoryDuration <= 20.5
        && state.mission10Audio.launchDuration >= 3.1 && state.mission10Audio.launchDuration <= 3.3, state.mission10Audio);
    }
    if (stage === 'signal') {
      check(label + '-signal-production-assets', Object.values(state.requiredSignalAssets).every(Boolean), state.requiredSignalAssets);
    }
    await shot(page, label + '-' + stage);
  }
  await open(page, 'path');
  await solvePath(page, label);
  await shot(page, label + '-path-solved');
  await open(page, 'energy');
  await tap(page, (await inspect(page)).targets.find((item) => item.relayId));
  await shot(page, label + '-energy-partial');
  await open(page, 'energy');
  await solveEnergy(page);
  await shot(page, label + '-energy-solved');
  await open(page, 'signal');
  await tap(page, (await inspect(page)).targets.find((item) => item.reflectorId));
  await shot(page, label + '-signal-partial');
  await open(page, 'signal');
  await solveSignal(page);
  await shot(page, label + '-signal-solved');
  await open(page, 'launch');
  let state = await inspect(page);
  await tap(page, state.targets.find((item) => item.action === 'launch'));
  await shot(page, label + '-launch-pressed');
  await sleep(1200);
  await shot(page, label + '-beacon-starting');
  await sleep(1500);
  await shot(page, label + '-beacon-on');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('VictoryScene'), null, { timeout: 10000 });
  await shot(page, label + '-victory');
  state = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('VictoryScene');
    return {
      title: scene.children.getByName('victory-title')?.text,
      play: Boolean(scene.children.getByName('victory-play-again')?.input?.enabled),
      home: Boolean(scene.children.list.some((item) => item?.type === 'Container'
        && item?.input?.enabled
        && item?.list?.some((child) => typeof child?.text === 'string' && /ДОМОЙ|Домой/.test(child.text)))),
      duplicateRobotCount: ['victory-robot', 'victory-assembled-robot']
        .filter((name) => Boolean(scene.children.getByName(name))).length,
      repairedRobotCount: scene.children.list.filter((item) => item?.name === 'victory-robot-v2'
        && item?.texture?.key === 'robot-v2-repaired').length,
      session: { ...window.__ROBOTLAB_QA__.sessionState.snapshot },
    };
  });
  check(label + '-true-victory', state.title === 'МИССИЯ ВЫПОЛНЕНА!' && state.play && !state.home && state.session.completedTasks === 10, state);
  check(label + '-victory-no-duplicate-robot', state.duplicateRobotCount === 0, state);
  check(label + '-victory-single-repaired-robot', state.repairedRobotCount === 1, state);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });
  try {
    for (const viewport of [{ width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 1600, height: 900 }]) {
      await visualPack(browser, viewport);
    }
    for (const viewport of [{ width: 568, height: 320 }, { width: 740, height: 360 }, { width: 915, height: 412 }, { width: 1024, height: 768 }, { width: 1920, height: 1080 }]) {
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      await page.bringToFront();
      recordErrors(page, viewport.width + 'x' + viewport.height);
      await open(page, 'path');
      const state = await inspect(page);
      check(viewport.width + 'x' + viewport.height + '-playable', state.stageRootCount === 1 && state.targets.length >= 3, state);
      await shot(page, viewport.width + 'x' + viewport.height + '-path');
      await context.close();
    }
    for (const viewport of [{ width: 390, height: 844 }, { width: 412, height: 915 }]) {
      const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      await page.bringToFront();
      recordErrors(page, viewport.width + 'x' + viewport.height);
      await open(page, 'energy');
      const state = await inspect(page);
      check(viewport.width + 'x' + viewport.height + '-orientation-gate', state.orientationCount === 1 && state.stageRootCount === 0 && state.targets.length === 2, state);
      await shot(page, viewport.width + 'x' + viewport.height + '-orientation');
      await context.close();
    }
  } finally {
    await browser.close();
  }
  check('runtime-errors-empty', results.errors.length === 0, results.errors);
  const failed = results.checks.filter((item) => !item.ok);
  results.result = failed.length === 0 && results.errors.length === 0 ? 'PASS' : 'FAIL';
  results.failedChecks = failed;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  process.stdout.write(JSON.stringify({ result: results.result, checks: results.checks.length, failures: failed.length, errors: results.errors.length, screenshots: results.screenshots.length }) + '\n');
  if (results.result !== 'PASS') process.exitCode = 1;
})().catch((error) => {
  results.errors.push({ type: 'runner', message: error.stack || error.message });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.error(error);
  process.exitCode = 1;
});
