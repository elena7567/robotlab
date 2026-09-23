const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const runId = 'mission10-regression-20260919';
const shotDir = path.join('docs', 'qa', 'screenshots', runId);
const reportPath = path.join('docs', 'qa', `${runId}.json`);
const report = { result: 'FAIL', checks: [], errors: [], path: [], signal: [], screenshots: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (name, ok, actual) => report.checks.push({ name, ok, actual });

function url(mission, stage) {
  const value = new URL(baseUrl);
  value.searchParams.set('qaMission', String(mission));
  if (stage) value.searchParams.set('stage', stage);
  return value.toString();
}
function watch(page, label) {
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ label, type: 'console', message: message.text() }); });
  page.on('pageerror', (error) => report.errors.push({ label, type: 'page', message: error.message }));
  page.on('requestfailed', (request) => report.errors.push({ label, type: 'request', message: `${request.url()} ${request.failure()?.errorText || ''}` }));
  page.on('response', (response) => { if (response.status() >= 400) report.errors.push({ label, type: 'response', message: `${response.status()} ${response.url()}` }); });
}
async function shot(page, name) {
  fs.mkdirSync(shotDir, { recursive: true });
  const output = path.join(shotDir, name);
  await page.screenshot({ path: output });
  report.screenshots.push(output);
}
async function waitMission(page, sceneName, stage) {
  await page.waitForFunction(({ sceneName, stage }) => {
    const game = window.__ROBOTLAB_GAME__;
    return Boolean(game?.scene.isActive(sceneName) && (!stage || game.registry.get('mission10Snapshot')?.stage === stage));
  }, { sceneName, stage }, { timeout: 90000 });
  await sleep(180);
}
async function pathState(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    return {
      snapshot: { ...game.registry.get('mission10Snapshot') },
      presentation: JSON.parse(JSON.stringify(game.registry.get('mission10PathPresentation'))),
      targets: all.filter((item) => item?.name?.startsWith?.('mission10-path-target')).map((item) => {
        const bounds = item.getBounds();
        return { laneId: item.getData('laneId'), hazardKind: item.getData('hazardKind'), x: bounds.centerX, y: bounds.centerY };
      }),
    };
  });
}
function verifyPath(label, state, viewport) {
  const p = state.presentation;
  report.path.push({ label, ...p });
  check(`${label}-three-options`, p.cards?.length === 3, p.cards?.length);
  for (const [index, card] of (p.cards || []).entries()) {
    const finite = ['visibleLeft', 'visibleRight', 'visibleTop', 'visibleBottom', 'visibleWidth', 'visibleHeight', 'parentScaleX', 'localScaleX', 'effectiveWorldScaleX']
      .every((key) => Number.isFinite(card[key]));
    check(`${label}-option${index + 1}-actual-telemetry`, finite, card);
    check(`${label}-option${index + 1}-inside-viewport`, finite && card.visibleLeft >= 0 && card.visibleRight <= viewport.width && card.visibleTop >= 0 && card.visibleBottom <= viewport.height, card);
  }
  check(`${label}-group-union`, Number.isFinite(p.groupVisibleLeft) && Number.isFinite(p.groupVisibleRight), p);
  check(`${label}-visually-centered`, Math.abs(p.groupVisibleCenterX - p.platformCenterX) <= 12,
    { groupVisibleCenterX: p.groupVisibleCenterX, platformCenterX: p.platformCenterX });
  check(`${label}-visible-clearance`, p.leftVisibleClearance >= 32 && p.rightVisibleClearance >= 32, { left: p.leftVisibleClearance, right: p.rightVisibleClearance });
  check(`${label}-robot-gap`, p.robotToFirstCardGap >= 40 && p.robotToFirstCardGap <= 150, p.robotToFirstCardGap);
}
async function runPath(browser, viewport) {
  const label = `${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  watch(page, `path-${label}`);
  await page.goto(url(10, 'path'), { waitUntil: 'commit' });
  await waitMission(page, 'Mission10Scene', 'PATH');
  for (let step = 1; step <= 3; step += 1) {
    const state = await pathState(page);
    verifyPath(`${label}-step${step}`, state, viewport);
    if ([1280, 1600, 1920].includes(viewport.width)) await shot(page, `path-${label}-step${step}.png`);
    if (step === 3) break;
    const safe = state.targets.find((target) => target.hazardKind === 'SAFE');
    await page.mouse.click(safe.x, safe.y);
    await page.waitForFunction((index) => window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot')?.pathDecisionIndex > index,
      state.snapshot.pathDecisionIndex, { timeout: 15000 });
    await sleep(160);
  }
  await context.close();
}
async function signalState(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    return {
      snapshot: { ...game.registry.get('mission10Snapshot') },
      evaluation: { ...game.registry.get('mission10SignalEvaluation') },
      presentation: JSON.parse(JSON.stringify(game.registry.get('mission10SignalPresentation'))),
      targets: all.filter((item) => item?.name?.startsWith?.('mission10-reflector-target')).map((item) => {
        const bounds = item.getBounds(); return { name: item.name, x: bounds.centerX, y: bounds.centerY };
      }),
    };
  });
}
function verifySignal(label, state, viewport) {
  const p = state.presentation;
  report.signal.push({ label, evaluation: state.evaluation, presentation: p });
  check(`${label}-semantic-group`, p.groupName === 'SIGNAL_PUZZLE_GROUP', p.groupName);
  check(`${label}-apparatus-telemetry`, p.apparatus?.length >= 4 && p.apparatus.every((item) => Number.isFinite(item.visibleLeft) && Number.isFinite(item.effectiveWorldScaleX)), p.apparatus);
  check(`${label}-group-inside-viewport`, p.groupVisibleBounds?.visibleLeft >= 0 && p.groupVisibleBounds?.visibleRight <= viewport.width, p.groupVisibleBounds);
  check(`${label}-child-readable-props`, p.apparatus?.every((item) => item.visibleHeight >= 90), p.apparatus);
  check(`${label}-beam-readable`, p.coreWidth >= 4, p.coreWidth);
}
async function runSignal(browser, viewport, states) {
  const label = `${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  watch(page, `signal-${label}`);
  await page.goto(url(10, 'signal'), { waitUntil: 'commit' });
  await waitMission(page, 'Mission10Scene', 'SIGNAL');
  let state = await signalState(page);
  verifySignal(`${label}-initial`, state, viewport);
  await shot(page, `signal-${label}-initial.png`);
  if (states === 'initial') { await context.close(); return; }
  if (state.targets[0]) await page.mouse.click(state.targets[0].x, state.targets[0].y);
  await sleep(180);
  state = await signalState(page);
  verifySignal(`${label}-partial`, state, viewport);
  await shot(page, `signal-${label}-partial.png`);
  for (let attempt = 0; attempt < 16 && !state.evaluation.receiverHit; attempt += 1) {
    const target = state.targets[attempt % state.targets.length];
    await page.mouse.click(target.x, target.y);
    await sleep(120);
    state = await signalState(page);
  }
  check(`${label}-solver-reached`, state.evaluation.receiverHit === true, state.evaluation);
  if (state.evaluation.receiverHit) {
    verifySignal(`${label}-solved`, state, viewport);
    await shot(page, `signal-${label}-solved.png`);
  }
  await context.close();
}
async function captureRegression(browser, mission, viewport, name, stage) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 1000 });
  const page = await context.newPage();
  watch(page, name);
  await page.goto(url(mission, stage), { waitUntil: 'commit' });
  const mission10Stage = stage === 'final' ? 'FINALE' : stage?.toUpperCase();
  await waitMission(page, mission === 10 ? 'Mission10Scene' : `Mission${mission}Scene`, mission === 10 ? mission10Stage : undefined);
  await shot(page, `${name}-${viewport.width}x${viewport.height}.png`);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1438, height: 914 }, { width: 1600, height: 900 }, { width: 1920, height: 1080 }]) await runPath(browser, viewport);
    await runSignal(browser, { width: 1280, height: 720 }, 'initial');
    await runSignal(browser, { width: 1600, height: 900 }, 'all');
    await runSignal(browser, { width: 1920, height: 1080 }, 'initial');
    await captureRegression(browser, 6, { width: 1600, height: 900 }, 'mission6-reference');
    await captureRegression(browser, 7, { width: 1600, height: 900 }, 'mission7-reference');
    for (const stage of ['intro', 'energy', 'launch', 'final']) {
      await captureRegression(browser, 10, { width: 1600, height: 900 }, `mission10-${stage}`, stage);
    }
    for (const viewport of [{ width: 844, height: 390 }, { width: 915, height: 412 }, { width: 390, height: 844 }]) {
      await captureRegression(browser, 10, viewport, 'mission10-mobile-path', 'path');
    }
  } finally { await browser.close(); }
  check('console-network-clean', report.errors.length === 0, report.errors);
  report.result = report.checks.every((item) => item.ok) ? 'PASS' : 'FAIL';
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ result: report.result, checks: report.checks.length, errors: report.errors.length, reportPath, screenshots: report.screenshots.length }, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
})().catch((error) => {
  report.errors.push({ type: 'fatal', message: error.stack || error.message });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.error(error);
  process.exitCode = 1;
});
