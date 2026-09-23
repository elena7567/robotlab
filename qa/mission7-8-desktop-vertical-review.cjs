const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'mission7-8-desktop-vertical-review.json');
const desktopViewports = [
  { width: 1280, height: 720 },
  { width: 1438, height: 914 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
];

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

function cleanErrors(errors) {
  return errors.console.length === 0
    && errors.requests.length === 0
    && errors.responses.length === 0
    && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;
}

function union(rects) {
  const present = rects.filter(Boolean);
  const left = Math.min(...present.map((r) => r.x));
  const top = Math.min(...present.map((r) => r.y));
  const right = Math.max(...present.map((r) => r.right));
  const bottom = Math.max(...present.map((r) => r.bottom));
  return { x: left, y: top, width: right - left, height: bottom - top, right, bottom };
}

function metrics(group, viewport) {
  const centerY = group.y + group.height / 2;
  const bottomClearance = viewport.height - group.bottom;
  return {
    topY: Number(group.y.toFixed(2)),
    centerY: Number(centerY.toFixed(2)),
    centerYPercent: Number((centerY / viewport.height * 100).toFixed(2)),
    bottomY: Number(group.bottom.toFixed(2)),
    bottomClearance: Number(bottomClearance.toFixed(2)),
    bottomClearancePercent: Number((bottomClearance / viewport.height * 100).toFixed(2)),
    pass: centerY / viewport.height >= 0.48
      && centerY / viewport.height <= 0.53
      && bottomClearance / viewport.height >= 0.08,
  };
}

async function waitForScene(page, sceneKey, requiredNames) {
  await page.waitForFunction(({ sceneKey, requiredNames }) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game?.scene?.getScene(sceneKey);
    if (!scene?.sys?.isActive()) return false;
    return requiredNames.every((name) => scene.children.getByName(name));
  }, { sceneKey, requiredNames }, { timeout: 30000 });
  await page.waitForTimeout(350);
}

async function openMission(browser, mission, viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  const url = new URL(baseUrl);
  url.searchParams.set('qaMission', String(mission));
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { context, page, errors };
}

async function inspectMission7(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.isActive('Mission7Scene')
      ? game.scene.getScene('Mission7Scene')
      : game.scene.getScene('Mission7OrientationGuardScene');
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const find = (name) => all.find((item) => item?.name === name);
    const bounds = (item) => {
      if (!item?.getBounds) return null;
      const b = item.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
    };
    const ports = ['red', 'blue', 'green', 'yellow'].flatMap((color) => ['source', 'target'].map((side) => {
      const item = find(`connection-${side}-${color}`);
      if (!item) return null;
      const p = item.getWorldTransformMatrix().transformPoint(0, 0);
      return { color, side, x: p.x, y: p.y };
    })).filter(Boolean);
    const rowDeltas = ['source', 'target'].every((side) => ports.some((port) => port.side === side))
      ? ports.filter((port) => port.side === 'source').sort((a, b) => a.y - b.y)
        .map((source, index) => Math.abs(source.y - ports.filter((port) => port.side === 'target').sort((a, b) => a.y - b.y)[index].y))
      : [];
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      semanticMode: game.registry.get('responsiveLayout')?.semanticMode,
      orientationGate: game.registry.get('mission7OrientationGate') === true,
      inputActive: game.registry.get('mission7InputActive') === true,
      card: bounds(find('connection-task-card')),
      hint: bounds(find('connection-hint-button')),
      robot: bounds(find('mission7-repaired-robot')),
      gate: bounds(find('mission7-orientation-gate') || find('mission7-preentry-orientation-gate')),
      rowDeltas,
    };
  });
}

async function inspectMission8(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission8Scene');
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const find = (name) => all.find((item) => item?.name === name);
    const rectFromBounds = (item) => {
      if (!item) return null;
      const audit = item.getData?.('auditBounds');
      if (audit) return { ...audit, right: audit.x + audit.width, bottom: audit.y + audit.height };
      const b = item.getBounds?.();
      return b ? { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom } : null;
    };
    const commandNames = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
    const board = rectFromBounds(find('programming-board'));
    const panel = rectFromBounds(find('MISSION8_CONTROL_PANEL'));
    const strip = rectFromBounds(find('program-strip'));
    const arrows = commandNames.map((command) => rectFromBounds(find(`program-command-${command}`)));
    const actions = ['programming-hint-button', 'programming-delete-button', 'programming-run-button'].map((name) => rectFromBounds(find(name)));
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      semanticMode: game.registry.get('responsiveLayout')?.semanticMode,
      board,
      panel,
      strip,
      arrows,
      actions,
    };
  });
}

async function captureMission7(browser, viewport) {
  const { context, page, errors } = await openMission(browser, 7, viewport);
  await waitForScene(page, 'Mission7Scene', []);
  await page.waitForTimeout(600);
  const state = await inspectMission7(page);
  const group = union([state.card, state.hint, state.robot]);
  const m = metrics(group, state.viewport);
  const screenshot = `mission7-after-vertical-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path: path.join(screenshotDir, screenshot) });
  await context.close();
  return { viewport, state, group, metrics: m, screenshot, errors, pass: m.pass && state.semanticMode === 'DESKTOP' && !state.orientationGate && state.inputActive && state.rowDeltas.every((delta) => delta <= 2) && cleanErrors(errors) };
}

async function captureMission8(browser, viewport) {
  const { context, page, errors } = await openMission(browser, 8, viewport);
  await waitForScene(page, 'Mission8Scene', ['programming-board', 'MISSION8_CONTROL_PANEL']);
  const state = await inspectMission8(page);
  const group = union([state.board, state.panel, state.strip, ...state.arrows, ...state.actions]);
  const m = metrics(group, state.viewport);
  const boardCenterY = state.board.y + state.board.height / 2;
  const panelCenterY = state.panel.y + state.panel.height / 2;
  const verticalDelta = Math.abs(panelCenterY - boardCenterY);
  const screenshot = `mission8-after-vertical-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path: path.join(screenshotDir, screenshot) });
  await context.close();
  return { viewport, state, group, metrics: m, boardControlCenterDelta: Number(verticalDelta.toFixed(2)), screenshot, errors, pass: m.pass && verticalDelta <= state.viewport.height * 0.05 && state.semanticMode === 'DESKTOP' && cleanErrors(errors) };
}

async function mobileMission7(browser) {
  const results = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 412, height: 915 }, { width: 360, height: 800 }]) {
    const { context, page, errors } = await openMission(browser, 7, viewport, true);
    await waitForScene(page, 'Mission7Scene', []);
  await page.waitForTimeout(600);
    const state = await inspectMission7(page);
    await page.screenshot({ path: path.join(screenshotDir, `mission7-mobile-regression-vertical-${viewport.width}x${viewport.height}.png`) });
    await context.close();
    results.push({ viewport, state, errors, pass: state.semanticMode.startsWith('PHONE_PORTRAIT') && !state.orientationGate && state.inputActive && cleanErrors(errors) });
  }
  for (const viewport of [{ width: 844, height: 390 }]) {
    const { context, page, errors } = await openMission(browser, 7, viewport, true);
    await page.waitForTimeout(600);
    const state = await inspectMission7(page);
    await page.screenshot({ path: path.join(screenshotDir, `mission7-mobile-regression-vertical-${viewport.width}x${viewport.height}.png`) });
    await context.close();
    results.push({ viewport, state, errors, pass: !state.inputActive && !state.card && !state.hint && cleanErrors(errors) });
  }
  return results;
}

async function mobileMission8(browser) {
  const results = [];
  for (const viewport of [{ width: 844, height: 390 }, { width: 915, height: 412 }]) {
    const { context, page, errors } = await openMission(browser, 8, viewport, true);
    await waitForScene(page, 'Mission8Scene', ['programming-board', 'MISSION8_CONTROL_PANEL']);
    const state = await inspectMission8(page);
    await page.screenshot({ path: path.join(screenshotDir, `mission8-mobile-regression-vertical-${viewport.width}x${viewport.height}.png`) });
    await context.close();
    results.push({ viewport, state, errors, pass: state.semanticMode === 'PHONE_LANDSCAPE_SHORT' && state.board.width >= 300 && state.actions.every((rect) => rect.height >= 48) && cleanErrors(errors) });
  }
  return results;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { startedAt: new Date().toISOString(), mission7: {}, mission8: {}, mobile: {} };
  try {
    for (const viewport of desktopViewports) {
      report.mission7[`${viewport.width}x${viewport.height}`] = await captureMission7(browser, viewport);
      report.mission8[`${viewport.width}x${viewport.height}`] = await captureMission8(browser, viewport);
    }
    report.mobile.mission7 = await mobileMission7(browser);
    report.mobile.mission8 = await mobileMission8(browser);
  } finally {
    await browser.close();
  }
  const mission7Pass = Object.values(report.mission7).every((item) => item.pass);
  const mission8Pass = Object.values(report.mission8).every((item) => item.pass);
  const mobile7Pass = report.mobile.mission7.every((item) => item.pass);
  const mobile8Pass = report.mobile.mission8.every((item) => item.pass);
  report.summary = { mission7Pass, mission8Pass, mobile7Pass, mobile8Pass, status: mission7Pass && mission8Pass && mobile7Pass && mobile8Pass ? 'PASS' : 'FAIL' };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, summary: report.summary }, null, 2));
  if (report.summary.status !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });