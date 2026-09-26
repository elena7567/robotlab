const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const outputDir = path.join('docs', 'qa', 'screenshots', 'mission10-signal-mobile-landscape');
const reportPath = path.join('docs', 'qa', 'mission10-signal-mobile-landscape.json');
const results = { result: 'FAIL', checks: [], screenshots: [], errors: [] };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (name, ok, actual) => results.checks.push({ name, ok, actual });
const near = (a, b, tolerance = 4) => Boolean(a && b && Math.hypot(a.x - b.x, a.y - b.y) <= tolerance);

async function open(page) {
  const next = new URL(baseUrl);
  next.searchParams.set('qaMission', '10');
  next.searchParams.set('stage', 'signal');
  next.searchParams.set('signalVariant', 'B');
  await page.goto(next.toString(), { waitUntil: 'commit', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene')
    && window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot')?.stage === 'SIGNAL', null, { timeout: 90000 });
  await wait(180);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const items = [];
    const walk = (item) => { items.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const bounds = (item) => {
      const value = item?.getBounds?.();
      return value && value.width > 0 && value.height > 0 ? { x: value.x, y: value.y, width: value.width, height: value.height } : null;
    };
    return {
      snapshot: { ...window.__ROBOTLAB_QA__.mission10Controller.snapshot },
      presentation: game.registry.get('mission10SignalPresentation'),
      targets: items.filter((item) => item?.input?.enabled).map((item) => ({ id: item.getData?.('reflectorId'), bounds: bounds(item) })),
    };
  });
}

function node(presentation, role) { return presentation.nodes.find((candidate) => candidate.role === role); }
function edgeGap(a, b) {
  const dx = Math.max(a.visibleLeft - b.visibleRight, b.visibleLeft - a.visibleRight, 0);
  const dy = Math.max(a.visibleTop - b.visibleBottom, b.visibleTop - a.visibleBottom, 0);
  return Math.hypot(dx, dy);
}

async function tap(page, target) {
  await page.touchscreen.tap(target.bounds.x + target.bounds.width / 2, target.bounds.y + target.bounds.height / 2);
  await wait(220);
}

async function runCase(browser, viewport) {
  const label = `${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') results.errors.push({ label, type: 'console', message: message.text() }); });
  page.on('pageerror', (error) => results.errors.push({ label, type: 'page', message: error.message }));
  page.on('requestfailed', (request) => results.errors.push({ label, type: 'request', message: request.url() }));
  await open(page);
  const state = await inspect(page);
  const presentation = state.presentation;
  const source = node(presentation, 'SOURCE');
  const m1 = node(presentation, 'REFLECTOR_A');
  const m2 = node(presentation, 'REFLECTOR_B');
  const receiver = node(presentation, 'RECEIVER');
  const mirrors = presentation.apparatus.filter((item) => /^M\d+$/.test(item.id));
  const receiverArt = presentation.apparatus.find((item) => item.id === 'receiver');
  check(`${label}-signal-b`, state.snapshot.signalConfigId === 'SIGNAL_B', state.snapshot);
  check(`${label}-route-order`, source.center.x < m1.center.x && m1.center.x < m2.center.x && m2.center.x < receiver.center.x, { source, m1, m2, receiver });
  check(`${label}-no-vertical-stack`, Math.abs(m1.center.x - m2.center.x) >= 100, { m1, m2 });
  check(`${label}-mirror-gap`, edgeGap(mirrors[0], mirrors[1]) >= 32, mirrors);
  check(`${label}-receiver-gap`, edgeGap(mirrors[1], receiverArt) >= 32, { mirror: mirrors[1], receiver: receiverArt });
  check(`${label}-semantic-initial-beam`, presentation.points.length === 1
    && near(presentation.points[0].from, source.outputPort) && near(presentation.points[0].to, m1.inputPort), presentation.points);
  check(`${label}-touch-targets`, state.targets.filter((target) => /^M[12]$/.test(target.id)).every((target) => target.bounds?.width >= 72 && target.bounds?.height >= 72), state.targets);
  fs.mkdirSync(outputDir, { recursive: true });
  const screenshot = path.join(outputDir, `${label}-signal-b.png`);
  await page.screenshot({ path: screenshot });
  results.screenshots.push(screenshot);
  await tap(page, state.targets.find((target) => target.id === 'M1'));
  let next = await inspect(page);
  await tap(page, next.targets.find((target) => target.id === 'M2'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot')?.stage === 'LAUNCH', null, { timeout: 8000 });
  check(`${label}-touch-solve`, (await inspect(page)).snapshot.stage === 'LAUNCH', await inspect(page));
  const solvedScreenshot = path.join(outputDir, `${label}-signal-b-solved.png`);
  await page.screenshot({ path: solvedScreenshot });
  results.screenshots.push(solvedScreenshot);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const viewport of [{ width: 844, height: 390 }, { width: 915, height: 412 }]) await runCase(browser, viewport);
  } finally {
    await browser.close();
  }
  check('runtime-errors-empty', results.errors.length === 0, results.errors);
  results.failedChecks = results.checks.filter((item) => !item.ok);
  results.result = results.failedChecks.length === 0 ? 'PASS' : 'FAIL';
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  process.stdout.write(JSON.stringify({ result: results.result, failures: results.failedChecks.length, errors: results.errors.length }) + '\n');
  if (results.result !== 'PASS') process.exitCode = 1;
})().catch((error) => {
  results.errors.push({ type: 'runner', message: error.stack || error.message });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.error(error);
  process.exitCode = 1;
});
