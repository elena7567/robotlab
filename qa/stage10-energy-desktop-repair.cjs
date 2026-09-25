const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const shotDir = path.join('docs', 'qa', 'screenshots', 'mission10-energy-desktop-repair');
const reportPath = path.join('docs', 'qa', 'mission10-energy-desktop-repair.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = { result: 'FAIL', checks: [], measurements: [], screenshots: [], errors: [] };

function check(name, ok, actual) {
  results.checks.push({ name, ok, actual });
  if (!ok) results.result = 'FAIL';
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
  }, (stage || 'intro').toUpperCase(), { timeout: 90000 });
  await sleep(250);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const bounds = (item) => {
      try {
        const value = item?.getBounds?.();
        if (value && value.width > 0 && value.height > 0) return { x: value.x, y: value.y, width: value.width, height: value.height };
      } catch { /* containers without size */ }
      return null;
    };
    const byName = (name) => all.find((item) => item?.name === name) || null;
    const relayNodes = all.filter((item) => /mission10-relay-(r1|r2|r3)$/.test(item?.name || '')).map((item) => {
      const b = bounds(item) || { x: item.x - 60, y: item.y - 60, width: 120, height: 120 };
      return { name: item.name, x: b.x, y: b.y, width: b.width, height: b.height, relayId: item.getData?.('relayId') };
    });
    return {
      snapshot: { ...window.__ROBOTLAB_QA__.mission10Controller.snapshot },
      energyLayout: game.registry.get('mission10EnergyLayout') || null,
      groupByName: byName('MISSION10_ENERGY_PUZZLE_GROUP') ? 'present' : 'absent',
      relayNodes,
      robotActive: Boolean(byName('mission10-robot-v2')),
      characters: (window.__ROBOTLAB_QA__.characters || []).filter((entry) => entry.scene === 'Mission10Scene')
        .map((entry) => ({ characterId: entry.characterId, role: entry.role, visibleHeight: entry.visibleHeight, result: entry.result })),
      stageRootCount: all.filter((item) => item?.name === 'mission10-stage-root').length,
      orientationGate: all.some((item) => item?.name === 'mission10-orientation-gate'),
      glowCount: all.filter((item) => item?.name === 'mission10-energy-glow').length,
      coreCount: all.filter((item) => item?.name === 'mission10-energy-core').length,
      breakSpark: Boolean(byName('mission10-energy-break-spark')),
      sceneActive: game.scene.isActive('Mission10Scene'),
    };
  });
}

const center = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
async function tapAt(page, box) {
  const p = center(box);
  await page.mouse.click(p.x, p.y);
  await sleep(260);
}

async function shot(page, name) {
  fs.mkdirSync(shotDir, { recursive: true });
  const output = path.join(shotDir, name + '.png');
  await page.screenshot({ path: output });
  results.screenshots.push(output);
}

function checkLayoutContract(label, state) {
  const layout = state.energyLayout;
  if (!layout) { check(label + '-energy-layout-published', false, 'missing'); return; }
  check(label + '-energy-layout-published', true, true);
  check(label + '-group-centered', layout.centerDelta <= 8, layout.centerDelta);
  check(label + '-group-width-bounded', layout.groupVisibleWidth >= 620 && layout.groupVisibleWidth <= 850, layout.groupVisibleWidth);
  check(label + '-clearances', layout.leftClearance >= 80 && layout.rightClearance >= 80, { left: layout.leftClearance, right: layout.rightClearance });
  check(label + '-robot-gap', layout.robotToGroupGap >= 50 && layout.robotToGroupGap <= 120, layout.robotToGroupGap);
  check(label + '-relay-extent', layout.relayVisibleExtent >= 90 && layout.relayVisibleExtent <= 130, layout.relayVisibleExtent);
  check(label + '-robot-world-support', (state.characters || []).some((entry) => entry.characterId === 'mission10-energy-robot' && entry.role === 'WORLD_SUPPORT' && entry.result === 'PASS'), state.characters);
  check(label + '-single-stage-root', state.stageRootCount === 1, state.stageRootCount);
}

async function runDesktopFlow(browser, viewport, label, opts = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  recordErrors(page, label);
  await open(page, 'energy');
  let state = await inspect(page);
  checkLayoutContract(label + '-initial', state);
  if (opts.initialShot) await shot(page, label + '-initial');
  const relays = state.relayNodes;
  check(label + '-three-relays', relays.length === 3, relays.map((r) => r.name));
  check(label + '-partial-visual', state.glowCount >= 1 && state.coreCount >= 4, { glow: state.glowCount, core: state.coreCount });
  await tapAt(page, relays[0]);
  state = await inspect(page);
  if (opts.afterTapShot) await shot(page, label + '-after-tap');
  await shot(page, label + '-partial');
  let guard = 0;
  while ((state = await inspect(page)).snapshot.stage === 'ENERGY' && guard < 12) {
    const rel = state.relayNodes.find((node) => state.snapshot.relayOrientations[node.relayId] !== 0);
    if (!rel) break;
    await tapAt(page, rel);
    guard += 1;
    await sleep(150);
  }
  await sleep(1100);
  state = await inspect(page);
  check(label + '-solved-advances', state.snapshot.stage === 'SIGNAL', state.snapshot.stage);
  if (opts.solvedShot) await shot(page, label + '-solved');
  await context.close();
}

async function runReducedMotion(browser, viewport, label) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  recordErrors(page, label);
  await open(page, 'energy');
  const state = await inspect(page);
  checkLayoutContract(label, state);
  await tapAt(page, state.relayNodes[0]);
  const after = await inspect(page);
  check(label + '-tap-safe', after.snapshot.stage === 'ENERGY' || after.snapshot.stage === 'SIGNAL', after.snapshot.stage);
  await shot(page, label + '-reduced-motion');
  await context.close();
}

async function runRapidTaps(browser, viewport, label) {
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  recordErrors(page, label);
  await open(page, 'energy');
  const state = await inspect(page);
  const first = state.relayNodes[0];
  const before = (await inspect(page)).snapshot.relayOrientations[first.relayId];
  await page.mouse.click(center(first).x, center(first).y);
  await page.mouse.click(center(first).x, center(first).y);
  await sleep(600);
  const after = (await inspect(page)).snapshot.relayOrientations[first.relayId];
  check(label + '-exactly-two-rotations', (after - before + 8) % 4 === 2, { before, after });
  check(label + '-still-energy-or-solved', ['ENERGY', 'SIGNAL'].includes((await inspect(page)).snapshot.stage), null);
  await context.close();
}

async function runMobileRegression(browser, viewport, label) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  recordErrors(page, label);
  await open(page, 'energy');
  const state = await inspect(page);
  const portrait = viewport.height > viewport.width;
  if (portrait) {
    // Portrait phones are intentionally gated by the orientation guard, not redesigned.
    check(label + '-orientation-gate', state.orientationGate === true && state.stageRootCount === 0, { gate: state.orientationGate, roots: state.stageRootCount });
  } else {
    check(label + '-no-desktop-group', state.groupByName === 'absent', state.groupByName);
    check(label + '-stage-root-single', state.stageRootCount === 1, state.stageRootCount);
    check(label + '-three-relays-mobile', state.relayNodes.length === 3, state.relayNodes.length);
  }
  await shot(page, label);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling'],
  });
  try {
    await runDesktopFlow(browser, { width: 1280, height: 720 }, '1280x720', { initialShot: true, solvedShot: true });
    await runDesktopFlow(browser, { width: 1438, height: 914 }, '1438x914', { initialShot: true, solvedShot: true });
    await runDesktopFlow(browser, { width: 1600, height: 900 }, '1600x900', { initialShot: true, afterTapShot: true, solvedShot: true });
    await runDesktopFlow(browser, { width: 1920, height: 1080 }, '1920x1080', { initialShot: true, solvedShot: true });
    await runReducedMotion(browser, { width: 1600, height: 900 }, '1600x900-reduced');
    await runRapidTaps(browser, { width: 1600, height: 900 }, '1600x900-rapid');
    await runMobileRegression(browser, { width: 844, height: 390 }, '844x390-mobile');
    await runMobileRegression(browser, { width: 915, height: 412 }, '915x412-mobile');
    await runMobileRegression(browser, { width: 390, height: 844 }, '390x844-mobile');
    const failed = results.checks.filter((item) => !item.ok);
    results.result = results.errors.length === 0 && failed.length === 0 ? 'PASS' : 'FAIL';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    process.stdout.write(JSON.stringify({ result: results.result, checks: results.checks.length, failures: failed.length, errors: results.errors.length, screenshots: results.screenshots.length }) + '\n');
  } finally {
    await browser.close();
  }
})();
