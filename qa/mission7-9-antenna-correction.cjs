const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const reportPath = path.join('docs', 'qa', 'mission7-9-antenna-correction.json');
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const base = 'http://127.0.0.1:4198/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { checks: [], errors: [], mission7: [], mission9: [], antenna: {} };
function add(name, ok, actual = null) { report.checks.push({ name, ok: Boolean(ok), actual }); }
function captureErrors(page, label) {
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ label, type: 'console', message: message.text() }); });
  page.on('pageerror', (error) => report.errors.push({ label, type: 'pageerror', message: error.message }));
  page.on('requestfailed', (request) => report.errors.push({ label, type: 'requestfailed', message: request.url() }));
  page.on('response', (response) => { if (response.status() >= 400) report.errors.push({ label, type: 'response', message: `${response.status()} ${response.url()}` }); });
}
async function point(page, sceneName, objectName) {
  return page.evaluate(({ sceneName, objectName }) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(sceneName);
    const all = [];
    const walk = (item) => { all.push(item); if (item?.list) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const item = all.find((candidate) => candidate?.name === objectName && candidate.visible !== false);
    if (!item) throw new Error(`Missing ${objectName}`);
    const p = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + p.x * canvas.width / game.scale.width, y: canvas.y + p.y * canvas.height / game.scale.height };
  }, { sceneName, objectName });
}
async function clickObject(page, sceneName, objectName) {
  const p = await point(page, sceneName, objectName);
  await page.mouse.click(p.x, p.y);
  await sleep(250);
}
async function dragObject(page, sceneName, sourceName, targetName) {
  const a = await point(page, sceneName, sourceName);
  const b = await point(page, sceneName, targetName);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  await sleep(500);
}
async function waitScene(page, sceneName, stage = null) {
  await page.waitForFunction(({ sceneName, stage }) => {
    const game = window.__ROBOTLAB_GAME__;
    if (!game?.scene.isActive(sceneName)) return false;
    if (!stage) return true;
    return game.registry.get('mission9PuzzleContract')?.stage === stage;
  }, { sceneName, stage }, { timeout: 60000 });
}
async function inspectMission7(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission7Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (item?.list) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const find = (name) => all.find((item) => item?.name === name);
    const bounds = (item) => { if (!item?.getBounds) return null; const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
    const center = (item) => item.getWorldTransformMatrix().transformPoint(0, 0);
    const ports = ['red', 'blue', 'green', 'yellow'].flatMap((color) => ['source', 'target'].map((side) => {
      const item = find(`connection-${side}-${color}`);
      const p = item ? center(item) : null;
      return item ? { color, side, x: p.x, y: p.y, bounds: bounds(item), hitWidth: item.getData('hitWidth'), hitHeight: item.getData('hitHeight') } : null;
    })).filter(Boolean);
    const sourceRows = ports.filter((p) => p.side === 'source').sort((a, b) => a.y - b.y);
    const targetRows = ports.filter((p) => p.side === 'target').sort((a, b) => a.y - b.y);
    const rowDeltas = sourceRows.map((row, index) => Math.abs(row.y - targetRows[index].y));
    const viewport = { width: game.scale.width, height: game.scale.height };
    const backgroundScale = Math.max(viewport.width / 1280, viewport.height / 720);
    const platformContactY = (viewport.height - 720 * backgroundScale) / 2 + 560 * backgroundScale;
    const card = find('connection-task-card');
    const cardFrame = card ? { x: card.x, y: card.y, width: card.width, height: card.height } : null;
    return { viewport, semantic: game.registry.get('responsiveLayout')?.semanticMode, gate: game.registry.get('mission7OrientationGate') === true, input: game.registry.get('mission7InputActive') === true, card: bounds(card), cardFrame, hint: bounds(find('connection-hint-button')), robot: bounds(find('mission7-repaired-robot')), ports, rowDeltas, connected: card?.getData('connected') || [], challengeIndex: card?.getData('challengeIndex'), platformContactY };
  });
}
async function inspectMission9(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission9Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (item?.list) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const find = (name) => all.find((item) => item?.name === name);
    const bounds = (item) => { if (!item?.getBounds) return null; const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
    const layout = game.registry.get('sceneComposition')?.mission9;
    const contract = game.registry.get('mission9PuzzleContract');
    return { viewport: { width: game.scale.width, height: game.scale.height }, stage: contract?.stage, correctCandidateId: contract?.correctCandidateId, title: layout?.title || bounds(find('mission9-title')), puzzleStage: layout?.puzzleStage, robotLayout: layout?.robot, choices: layout?.choices, platformContactY: layout?.platformContactY, robot: bounds(find('mission9-repaired-robot')), robotImage: bounds(find('mission9-repaired-robot-image')), bridgeLeft: bounds(find('mission9-bridge-platform-left')), bridgeRight: bounds(find('mission9-bridge-platform-right')), bridgeGap: bounds(find('mission9-bridge-gap-target')), choicesRendered: all.filter((item) => item?.name?.startsWith('mission9-choice-') && item?.getData?.('courseAction') && item.visible !== false).map((item) => ({ name: item.name, bounds: bounds(item) })), selectedAction: game.registry.get('mission9SelectedAction') || null };
  });
}
async function inspectAntennaScene(page, label, sceneName, directUrl, startFn = null) {
  await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (startFn) await page.evaluate(startFn);
  await waitScene(page, sceneName);
  await sleep(400);
  const state = await page.evaluate((sceneName) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(sceneName);
    const all = [];
    const walk = (item) => { all.push(item); if (item?.list) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const repairedImages = all.filter((item) => item?.texture?.key === 'robot-v2-repaired');
    const antennaParts = all.filter((item) => item?.texture?.key === 'robot-v2-antenna');
    const assembled = all.filter((item) => item?.getData?.('visibleBoundsId') === 'ROBOT_V2_ASSEMBLED');
    const helperAntenna = all.filter((item) => item?.texture?.key === 'robot-v2-antenna' && item?.parentContainer?.getData?.('visibleBoundsId') === 'ROBOT_V2_HELPER');
    return { sceneName, repairedImageCount: repairedImages.length, antennaPartCount: antennaParts.length, assembledCount: assembled.length, helperAntennaCount: helperAntenna.length, textures: repairedImages.map((item) => item.name), antennaNames: antennaParts.map((item) => item.name) };
  }, sceneName);
  report.antenna[label] = state;
  add(`${label}-antenna-present`, state.repairedImageCount > 0 || state.antennaPartCount > 0 || state.assembledCount > 0, state);
  add(`${label}-no-helper-antenna-contamination`, state.helperAntennaCount === 0, state);
}
async function runMission7(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  captureErrors(page, `m7-${width}x${height}`);
  await page.goto(`${base}?qaMission=7`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitScene(page, 'Mission7Scene');
  const initial = await inspectMission7(page);
  await page.screenshot({ path: path.join(screenshotDir, `mission7-correction-${width}x${height}-initial.png`) });
  const initialCard = initial.cardFrame;
  add(`m7-${width}x${height}-desktop-active`, initial.semantic === 'DESKTOP' && !initial.gate && initial.input, initial);
  add(`m7-${width}x${height}-block-moved-up`, initial.card.y < initial.platformContactY - initial.card.height * 0.7, { card: initial.card, platformContactY: initial.platformContactY });
  add(`m7-${width}x${height}-hint-safe-attached`, initial.hint.y >= initial.card.bottom && initial.hint.bottom <= height - 24, { hint: initial.hint, card: initial.card });
  add(`m7-${width}x${height}-helper-position`, initial.robot.x > initial.card.right && initial.robot.right < width - 24 && initial.robot.y < initial.card.bottom, { robot: initial.robot, card: initial.card });
  initial.rowDeltas.forEach((delta, index) => add(`m7-${width}x${height}-row-${index + 1}-aligned`, delta <= 2, initial.rowDeltas));
  if (width === 1280) {
    await dragObject(page, 'Mission7Scene', 'connection-source-red', 'connection-target-red');
    const one = await inspectMission7(page);
    await page.screenshot({ path: path.join(screenshotDir, 'mission7-correction-1280x720-1of3.png') });
    add('m7-input-first-wire', one.connected.includes('red'), one.connected);
    add('m7-card-stable-1of3', JSON.stringify(one.cardFrame) === JSON.stringify(initialCard), { initial: initialCard, after: one.cardFrame });
    await dragObject(page, 'Mission7Scene', 'connection-source-blue', 'connection-target-blue');
    const two = await inspectMission7(page);
    add('m7-card-stable-2of3', JSON.stringify(two.cardFrame) === JSON.stringify(initialCard), { initial: initialCard, after: two.cardFrame });
    await dragObject(page, 'Mission7Scene', 'connection-source-green', 'connection-target-green');
    const three = await inspectMission7(page);
    await page.screenshot({ path: path.join(screenshotDir, 'mission7-correction-1280x720-3of3.png') });
    add('m7-card-stable-3of3', JSON.stringify(three.cardFrame) === JSON.stringify(initialCard), { initial: initialCard, after: three.cardFrame });
  }
  report.mission7.push(initial);
  await context.close();
}
async function runMission9(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width <= 900 });
  const page = await context.newPage();
  captureErrors(page, `m9-${width}x${height}`);
  await page.goto(`${base}?qaMission=9`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitScene(page, 'Mission9Scene', 'BRIDGE');
  const state = await inspectMission9(page);
  await page.screenshot({ path: path.join(screenshotDir, `mission9-correction-${width}x${height}-bridge.png`) });
  const titleGap = state.puzzleStage.y - (state.title.y + state.title.height);
  const robotGap = state.puzzleStage.x - (state.robotLayout.x + state.robotLayout.width);
  add(`m9-${width}x${height}-bridge-group-up`, state.puzzleStage.y < state.platformContactY - state.puzzleStage.height * 0.35, { puzzleStage: state.puzzleStage, platformContactY: state.platformContactY });
  add(`m9-${width}x${height}-title-gap-small`, titleGap <= 42, { titleGap, title: state.title, puzzleStage: state.puzzleStage });
  add(`m9-${width}x${height}-robot-close`, robotGap <= 16, { robotGap, robot: state.robotLayout, puzzleStage: state.puzzleStage });
  add(`m9-${width}x${height}-choice-row-safe`, state.choices.y + state.choices.height <= height - 12 && state.choicesRendered.length === 3, { choices: state.choices, rendered: state.choicesRendered.length, bottom: state.choices.y + state.choices.height });
  if (width === 1280) {
    await clickObject(page, 'Mission9Scene', `mission9-choice-${state.correctCandidateId}`);
    await page.evaluate(() => { const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene'); const all = []; const walk = (item) => { all.push(item); if (item?.list) item.list.forEach(walk); }; scene.children.list.forEach(walk); all.find((item) => item?.name === 'mission9-drop-target-hitarea').emit('pointerup'); });
    await sleep(900);
    const solved = await inspectMission9(page);
    add('m9-bridge-input', solved.stage === 'GATE', solved);
  }
  report.mission9.push(state);
  await context.close();
}
(async () => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [w, h] of [[1280, 720], [1438, 914], [1600, 900], [1920, 1080]]) await runMission7(browser, w, h);
    for (const [w, h] of [[1280, 720], [1600, 900], [1920, 1080], [844, 390]]) await runMission9(browser, w, h);
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    captureErrors(page, 'antenna');
    await inspectAntennaScene(page, 'mission6', 'Mission6Scene', `${base}?qaMission=7`, () => window.__ROBOTLAB_GAME__.scene.start('Mission6Scene'));
    await inspectAntennaScene(page, 'mission7', 'Mission7Scene', `${base}?qaMission=7`);
    await inspectAntennaScene(page, 'mission8', 'Mission8Scene', `${base}?qaMission=8`);
    await inspectAntennaScene(page, 'mission9', 'Mission9Scene', `${base}?qaMission=9`);
    await inspectAntennaScene(page, 'mission10', 'Mission10Scene', `${base}?qaMission=10`);
    await inspectAntennaScene(page, 'victory', 'VictoryScene', `${base}?qaMission=10&stage=final`);
    await page.close();
  } finally {
    await browser.close();
  }
  report.result = report.checks.every((check) => check.ok) && report.errors.length === 0 ? 'PASS' : 'FAIL';
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ result: report.result, checks: report.checks.length, failed: report.checks.filter((check) => !check.ok), errors: report.errors, reportPath }, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });