const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const shotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'mission10-path-choice-strip-review.json');
const results = { result: 'FAIL', checks: [], errors: [], viewports: [], steps: [], input: [], mobile: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, ok, actual) {
  results.checks.push({ name, ok, ...(actual === undefined ? {} : { actual }) });
}
function stageUrl(stage = 'path') {
  const next = new URL(baseUrl);
  next.searchParams.set('qaMission', '10');
  next.searchParams.set('stage', stage);
  return next.toString();
}
function recordErrors(page, label) {
  page.on('console', (message) => { if (message.type() === 'error') results.errors.push({ label, type: 'console', message: message.text() }); });
  page.on('pageerror', (error) => results.errors.push({ label, type: 'page', message: error.stack || error.message }));
  page.on('requestfailed', (request) => results.errors.push({ label, type: 'request', message: request.url() + ': ' + (request.failure()?.errorText || '') }));
  page.on('response', (response) => { if (response.status() >= 400) results.errors.push({ label, type: 'response', message: response.status() + ' ' + response.url() }); });
}
async function openPath(page) {
  await page.goto(stageUrl('path'), { waitUntil: 'commit', timeout: 45000 });
  await page.waitForFunction(() => {
    const game = window.__ROBOTLAB_GAME__;
    return Boolean(game?.scene.isActive('Mission10Scene')
      && game.registry.get('mission10Snapshot')?.stage === 'PATH'
      && game.registry.get('mission10PathPresentation'));
  }, null, { timeout: 90000 });
  await sleep(160);
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
      if (value && value.width > 0 && value.height > 0) return { x: value.x, y: value.y, width: value.width, height: value.height };
      if (item?.input?.hitArea && item.width > 0 && item.height > 0) return { x: item.x - item.width / 2, y: item.y - item.height / 2, width: item.width, height: item.height };
      return null;
    };
    return {
      snapshot: { ...game.registry.get('mission10Snapshot') },
      presentation: { ...game.registry.get('mission10PathPresentation') },
      contract: { ...game.registry.get('mission10SceneContract') },
      targets: all.filter((item) => item?.name?.startsWith?.('mission10-path-target')).map((item) => ({
        name: item.name,
        laneId: item.getData?.('laneId'),
        hazardKind: item.getData?.('hazardKind'),
        bounds: bounds(item),
      })),
      groupCount: all.filter((item) => item?.name === 'MISSION10_PATH_CHOICE_GROUP').length,
      debugNamedCount: all.filter((item) => /debug|hit-area|qa/i.test(item?.name || '')).length,
      stageRootCount: all.filter((item) => item?.name === 'mission10-stage-root').length,
    };
  });
}
function center(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}
async function tapTarget(page, target) {
  const p = center(target.bounds);
  await page.mouse.click(p.x, p.y);
  await sleep(220);
}
async function screenshot(page, file) {
  fs.mkdirSync(shotDir, { recursive: true });
  const output = path.join(shotDir, file);
  await page.screenshot({ path: output });
  return output;
}
function summarizeStep(label, state) {
  const p = state.presentation;
  const cards = p.cards || [];
  const heights = cards.map((card) => card.height);
  const widths = cards.map((card) => card.width);
  const assetHeights = cards.map((card) => card.assetVisibleHeight);
  const maxAsset = Math.max(...assetHeights);
  const minAsset = Math.min(...assetHeights);
  const assetDelta = maxAsset > 0 ? (maxAsset - minAsset) / maxAsset * 100 : 0;
  const summary = {
    label,
    pathDecisionIndex: state.snapshot.pathDecisionIndex,
    platformCenterX: p.platformCenterX,
    choiceGroupLeft: p.choiceGroupLeft,
    choiceGroupRight: p.choiceGroupRight,
    choiceGroupCenterX: p.choiceGroupCenterX,
    choiceGroupCenterDelta: p.choiceGroupCenterDelta,
    cards,
    gap12: p.gap12,
    gap23: p.gap23,
    rightClearance: p.rightClearance,
    robotRight: p.robotRight,
    robotToFirstCardGap: p.robotToFirstCardGap,
    maxOptionAssetSizeDeltaPercent: assetDelta,
    targetCount: state.targets.length,
    groupCount: state.groupCount,
    debugNamedCount: state.debugNamedCount,
  };
  results.steps.push(summary);
  check(`${label}-one-choice-group`, state.groupCount === 1, summary);
  check(`${label}-three-targets`, state.targets.length === 3, state.targets);
  check(`${label}-centered-on-platform`, Math.abs(p.choiceGroupCenterDelta) <= 4, summary);
  check(`${label}-equal-widths`, Math.max(...widths) - Math.min(...widths) <= 1, widths);
  check(`${label}-equal-heights`, Math.max(...heights) - Math.min(...heights) <= 1, heights);
  check(`${label}-equal-gaps`, Math.abs(p.gap12 - p.gap23) <= 2, { gap12: p.gap12, gap23: p.gap23 });
  check(`${label}-right-clearance`, p.rightClearance >= 48, p.rightClearance);
  check(`${label}-robot-gap`, p.robotToFirstCardGap >= 40, { robotRight: p.robotRight, robotToFirstCardGap: p.robotToFirstCardGap });
  check(`${label}-asset-size-normalized`, assetDelta <= 8, { assetHeights, assetDelta });
  check(`${label}-debug-overlays-absent`, p.debugOverlaysVisible === false && state.debugNamedCount === 0, { registry: p.debugOverlaysVisible, debugNamedCount: state.debugNamedCount });
  return summary;
}
function assertStepStable(label, baseline, current) {
  for (let index = 0; index < 3; index += 1) {
    const a = baseline.cards[index];
    const b = current.cards[index];
    check(`${label}-card${index + 1}-x-stable`, Math.abs(a.x - b.x) <= 1, { baseline: a.x, current: b.x });
    check(`${label}-card${index + 1}-y-stable`, Math.abs(a.y - b.y) <= 1, { baseline: a.y, current: b.y });
    check(`${label}-card${index + 1}-width-stable`, Math.abs(a.width - b.width) <= 1, { baseline: a.width, current: b.width });
    check(`${label}-card${index + 1}-height-stable`, Math.abs(a.height - b.height) <= 1, { baseline: a.height, current: b.height });
  }
}
async function desktopMatrix(browser, viewport) {
  const label = `${viewport.width}x${viewport.height}`;
  results.viewports.push(label);
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  recordErrors(page, label);
  await openPath(page);
  let state = await inspect(page);
  const step1 = summarizeStep(`${label}-step1`, state);
  if (viewport.width === 1280 && viewport.height === 720) results[`shot-${label}-step1`] = await screenshot(page, 'mission10-path-step1-1280x720.png');
  if (viewport.width === 1600 && viewport.height === 900) results[`shot-${label}-step1`] = await screenshot(page, 'mission10-path-step1-1600x900.png');
  if (viewport.width === 1920 && viewport.height === 1080) results[`shot-${label}-step1`] = await screenshot(page, 'mission10-path-step1-1920x1080.png');
  for (let step = 2; step <= 3; step += 1) {
    const safe = state.targets.find((target) => target.hazardKind === 'SAFE');
    if (!safe) throw new Error(`${label}: missing safe target before step ${step}`);
    const previousIndex = state.snapshot.pathDecisionIndex;
    await tapTarget(page, safe);
    await page.waitForFunction((index) => {
      const snapshot = window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot');
      return snapshot?.stage !== 'PATH' || snapshot?.pathDecisionIndex > index;
    }, previousIndex, { timeout: 15000 });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission10PathPresentation'), null, { timeout: 15000 }).catch(() => {});
    await sleep(140);
    state = await inspect(page);
    if (state.snapshot.stage !== 'PATH') break;
    const summary = summarizeStep(`${label}-step${step}`, state);
    assertStepStable(`${label}-step${step}`, step1, summary);
    if (viewport.width === 1280 && viewport.height === 720) results[`shot-${label}-step${step}`] = await screenshot(page, `mission10-path-step${step}-1280x720.png`);
    if (viewport.width === 1600 && viewport.height === 900) results[`shot-${label}-step${step}`] = await screenshot(page, `mission10-path-step${step}-1600x900.png`);
  }
  await context.close();
}
async function inputIsolation(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  recordErrors(page, 'input-1280x720');
  for (const laneName of ['LEFT', 'CENTER', 'RIGHT']) {
    await openPath(page);
    const before = await inspect(page);
    const target = before.targets.find((item) => item.laneId === laneName);
    if (!target) throw new Error(`missing input target ${laneName}`);
    await tapTarget(page, target);
    const expectedAdvance = target.hazardKind === 'SAFE';
    if (expectedAdvance) {
      await page.waitForFunction((index) => {
        const snapshot = window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot');
        return snapshot?.stage !== 'PATH' || snapshot?.pathDecisionIndex > index;
      }, before.snapshot.pathDecisionIndex, { timeout: 15000 });
    }
    const after = await inspect(page);
    const advanced = after.snapshot.pathDecisionIndex > before.snapshot.pathDecisionIndex || after.snapshot.stage !== before.snapshot.stage;
    results.input.push({ laneName, hazardKind: target.hazardKind, expectedAdvance, advanced, snapshot: after.snapshot });
    check(`input-${laneName}-isolated`, advanced === expectedAdvance, results.input.at(-1));
  }
  await context.close();
}
async function mobileRegression(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  recordErrors(page, 'mobile-844x390');
  await openPath(page);
  const state = await inspect(page);
  results.mobile.push(state);
  check('mobile-regression-path-playable', state.stageRootCount === 1 && state.targets.length === 3, state);
  await screenshot(page, 'mission10-path-mobile-regression-844x390.png');
  await context.close();
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  try {
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1438, height: 914 },
      { width: 1600, height: 900 },
      { width: 1920, height: 1080 },
    ]) await desktopMatrix(browser, viewport);
    await inputIsolation(browser);
    await mobileRegression(browser);
  } finally {
    await browser.close();
  }
  results.result = results.errors.length === 0 && results.checks.every((item) => item.ok) ? 'PASS' : 'FAIL';
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  if (results.result !== 'PASS') {
    console.error(JSON.stringify(results, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ result: results.result, checks: results.checks.length, reportPath }, null, 2));
})();