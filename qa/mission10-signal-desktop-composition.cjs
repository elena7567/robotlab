const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const outputDir = path.join('docs', 'qa', 'screenshots', 'mission10-signal-desktop-repair');
const reportPath = path.join('docs', 'qa', 'mission10-signal-desktop-composition.json');
const results = { result: 'FAIL', checks: [], screenshots: [], measurements: {}, errors: [] };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, ok, actual) {
  results.checks.push({ name, ok, actual });
}
function signalUrl() {
  const next = new URL(baseUrl);
  next.searchParams.set('qaMission', '10');
  next.searchParams.set('stage', 'signal');
  return next.toString();
}
function recordErrors(page, label) {
  page.on('console', (message) => { if (message.type() === 'error') results.errors.push({ label, type: 'console', message: message.text() }); });
  page.on('pageerror', (error) => results.errors.push({ label, type: 'page', message: error.message }));
  page.on('requestfailed', (request) => results.errors.push({ label, type: 'request', message: request.url() }));
  page.on('response', (response) => { if (response.status() >= 400) results.errors.push({ label, type: 'response', message: `${response.status()} ${response.url()}` }); });
}
async function open(page, stage = 'signal') {
  const next = new URL(baseUrl);
  next.searchParams.set('qaMission', '10');
  next.searchParams.set('stage', stage);
  await page.goto(next.toString(), { waitUntil: 'commit', timeout: 45000 });
  await page.waitForFunction((expected) => window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene')
    && window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot')?.stage === expected, stage.toUpperCase(), { timeout: 90000 });
  await wait(180);
}
async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const presentation = game.registry.get('mission10SignalPresentation') || null;
    const layout = game.registry.get('sceneComposition')?.mission10;
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const bounds = (item) => {
      const value = item?.getBounds?.();
      return value && value.width > 0 && value.height > 0
        ? { x: value.x, y: value.y, width: value.width, height: value.height }
        : null;
    };
    return {
      snapshot: { ...window.__ROBOTLAB_QA__.mission10Controller.snapshot },
      presentation,
      evaluation: game.registry.get('mission10SignalEvaluation') || null,
      platformCenterX: layout?.platformCenterX,
      platformFrontRimY: layout?.signalRegions?.ROBOT_GROUND_Y,
      robot: all.filter((item) => item?.name === 'mission10-robot-v2' || item?.getData?.('visibleBoundsId') === 'ROBOT_V2_ASSEMBLED')
        .map((item) => ({ name: item.name, grounded: item.getData?.('grounded'), bounds: bounds(item) })),
      targets: all.filter((item) => item?.input?.enabled).map((item) => ({ reflectorId: item.getData?.('reflectorId') || null, bounds: bounds(item) })),
      sceneActive: game.scene.isActive('Mission10Scene'),
    };
  });
}
async function screenshot(page, name) {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: file });
  results.screenshots.push(file);
}
function signalMetrics(state) {
  const group = state.presentation?.groupVisibleBounds;
  const apparatus = state.presentation?.apparatus || [];
  const reflectors = apparatus.filter((item) => /^M\d+$/.test(item.id));
  const [firstReflector, secondReflector] = reflectors;
  const horizontalGap = firstReflector && secondReflector
    ? Math.max(0, firstReflector.visibleLeft - secondReflector.visibleRight, secondReflector.visibleLeft - firstReflector.visibleRight)
    : null;
  const verticalGap = firstReflector && secondReflector
    ? Math.max(0, firstReflector.visibleTop - secondReflector.visibleBottom, secondReflector.visibleTop - firstReflector.visibleBottom)
    : null;
  const edgeToEdgeSeparation = horizontalGap === null || verticalGap === null
    ? null
    : Math.hypot(horizontalGap, verticalGap);
  return {
    groupTop: group?.visibleTop,
    groupCenterX: group ? (group.visibleLeft + group.visibleRight) / 2 : null,
    groupCenterY: group ? (group.visibleTop + group.visibleBottom) / 2 : null,
    groupBottom: group?.visibleBottom,
    groupWidth: group?.visibleWidth,
    verticalSpread: group?.visibleHeight,
    platformCenterX: state.platformCenterX,
    platformFrontRimY: state.platformFrontRimY,
    receiver: apparatus.find((item) => item.id === 'receiver') || null,
    reflectors,
    reflectorSeparation: { horizontalGap, verticalGap, edgeToEdgeSeparation },
    nodes: state.presentation?.nodes || [],
    beamSegments: state.presentation?.points || [],
    stoppedPort: state.presentation?.stoppedPort || null,
    groupName: state.presentation?.groupName,
  };
}
function node(metrics, role) { return metrics.nodes.find((candidate) => candidate.role === role) || null; }
function near(a, b, tolerance = 14) {
  return Boolean(a && b && Math.hypot(a.x - b.x, a.y - b.y) <= tolerance);
}
function routeMetrics(metrics) {
  const source = node(metrics, 'SOURCE');
  const a = node(metrics, 'REFLECTOR_A');
  const b = node(metrics, 'REFLECTOR_B');
  const receiver = node(metrics, 'RECEIVER');
  const expected = [[source?.outputPort, a?.inputPort], [a?.outputPort, b?.inputPort], [b?.outputPort, receiver?.inputPort]];
  return { source, a, b, receiver, expected };
}
function attachedSegments(metrics, expected) {
  return expected.every(([from, to]) => metrics.beamSegments.some((segment) => near(segment.from, from) && near(segment.to, to)));
}
async function tap(page, target, touch) {
  if (!target?.bounds) throw new Error(`Missing reflector target: ${JSON.stringify(target)}`);
  const x = target.bounds.x + target.bounds.width / 2;
  const y = target.bounds.y + target.bounds.height / 2;
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  await wait(210);
}
async function solve(page) {
  const goals = { SIGNAL_A: { M1: 1, M2: 0 }, SIGNAL_B: { M1: 0, M2: 0 }, SIGNAL_C: { M1: 1, M2: 1, M3: 0 } };
  for (const [id, expected] of Object.entries(goals[(await inspect(page)).snapshot.signalConfigId])) {
    let state = await inspect(page);
    if ((state.snapshot.reflectorOrientations[id] % 2) !== expected) await tap(page, state.targets.find((item) => item.reflectorId === id), false);
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot')?.stage === 'LAUNCH', null, { timeout: 8000 });
}
async function desktopCase(browser, viewport) {
  const label = `${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  recordErrors(page, label);
  await open(page);
  const state = await inspect(page);
  const metrics = signalMetrics(state);
  results.measurements[label] = metrics;
  check(`${label}-scene`, state.sceneActive, state.snapshot);
  check(`${label}-semantic-group`, metrics.groupName === 'MISSION10_SIGNAL_PUZZLE_GROUP', metrics.groupName);
  check(`${label}-platform-centered`, Math.abs(metrics.groupCenterX - metrics.platformCenterX) <= 8, metrics);
  const route = routeMetrics(metrics);
  check(`${label}-semantic-nodes`, Boolean(route.source && route.a && route.b && route.receiver), route);
  check(`${label}-forward-zig-zag`, Boolean(route.source && route.a && route.b && route.receiver
    && route.source.center.x < route.a.center.x && route.a.center.x < route.b.center.x
    && route.b.center.x < route.receiver.center.x && route.a.center.y < route.b.center.y), route);
  check(`${label}-no-free-beam-endpoints`, metrics.beamSegments.every((segment) => metrics.nodes.some((item) => near(segment.from, item.outputPort))
    && metrics.nodes.some((item) => near(segment.to, item.inputPort))), metrics.beamSegments);
  check(`${label}-unclipped`, metrics.groupTop >= 0 && metrics.groupBottom <= viewport.height, metrics);
  check(`${label}-robot-grounded`, state.robot.some((robot) => robot.grounded), state.robot);
  check(`${label}-lower-reflector-clears-rim`, Math.max(...metrics.reflectors.map((item) => item.visibleBottom)) < metrics.platformFrontRimY, metrics);
  if (label === '1600x900') {
    check('1600x900-visible-spread', metrics.verticalSpread >= 190 && metrics.verticalSpread <= 240, metrics);
    await screenshot(page, '1600x900-initial');
    check('1600x900-initial-source-to-a', metrics.beamSegments.length === 1
      && near(metrics.beamSegments[0]?.from, route.source?.outputPort) && near(metrics.beamSegments[0]?.to, route.a?.inputPort)
      && near(metrics.stoppedPort, route.a?.outputPort), metrics);
    await tap(page, state.targets.find((item) => item.reflectorId === 'M1'), false);
    const partial = signalMetrics(await inspect(page));
    const partialRoute = routeMetrics(partial);
    check('1600x900-partial-source-to-a-to-b', partial.beamSegments.length === 2
      && near(partial.beamSegments[0]?.from, partialRoute.source?.outputPort) && near(partial.beamSegments[0]?.to, partialRoute.a?.inputPort)
      && near(partial.beamSegments[1]?.from, partialRoute.a?.outputPort) && near(partial.beamSegments[1]?.to, partialRoute.b?.inputPort)
      && near(partial.stoppedPort, partialRoute.b?.outputPort), partial);
    await screenshot(page, '1600x900-partial');
    await open(page);
    await solve(page);
    const solved = signalMetrics(await inspect(page));
    check('1600x900-solved-port-route', solved.beamSegments.length === 3 && attachedSegments(solved, routeMetrics(solved).expected)
      && solved.stoppedPort === null, solved);
    await screenshot(page, '1600x900-solved');
  } else await screenshot(page, `${label}-initial`);
  await context.close();
}
async function mobileCase(browser, viewport) {
  const label = `${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  recordErrors(page, label);
  await open(page);
  const state = await inspect(page);
  check(`${label}-frozen-signal-presentation`, viewport.width === 390
    ? state.presentation === null
    : state.presentation?.groupName === 'MISSION10_SIGNAL_PUZZLE_GROUP', state.presentation);
  check(`${label}-signal-stage`, state.sceneActive && state.snapshot.stage === 'SIGNAL', state.snapshot);
  await screenshot(page, `${label}-signal`);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1438, height: 914 }, { width: 1600, height: 900 }, { width: 1920, height: 1080 }]) await desktopCase(browser, viewport);
    for (const viewport of [{ width: 844, height: 390 }, { width: 915, height: 412 }, { width: 390, height: 844 }]) await mobileCase(browser, viewport);
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();
    recordErrors(page, 'energy-regression');
    await open(page, 'energy');
    await screenshot(page, '1600x900-energy-regression');
    check('energy-regression-stage', (await inspect(page)).snapshot.stage === 'ENERGY', await inspect(page));
    await context.close();
  } finally {
    await browser.close();
  }
  check('runtime-errors-empty', results.errors.length === 0, results.errors);
  const failed = results.checks.filter((item) => !item.ok);
  results.failedChecks = failed;
  results.result = failed.length === 0 && results.errors.length === 0 ? 'PASS' : 'FAIL';
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  process.stdout.write(JSON.stringify({ result: results.result, failures: failed.length, errors: results.errors.length, screenshots: results.screenshots.length }) + '\\n');
  if (results.result !== 'PASS') process.exitCode = 1;
})().catch((error) => {
  results.errors.push({ type: 'runner', message: error.stack || error.message });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.error(error);
  process.exitCode = 1;
});
