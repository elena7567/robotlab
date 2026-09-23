const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'mission7-8-final-desktop-ui-review.json');
const mission8Viewports = [
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
];
const commandNames = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
const routeSolutions = [
  ['RIGHT', 'RIGHT'],
  ['RIGHT', 'RIGHT', 'UP'],
  ['RIGHT', 'UP', 'UP', 'RIGHT', 'RIGHT'],
];
const expectedMax = [6, 9, 7];

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
const cleanErrors = (errors) => errors.console.length === 0 && errors.requests.length === 0 && errors.responses.length === 0
  && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;
const right = (rect) => rect.x + rect.width;
const bottom = (rect) => rect.y + rect.height;
const inflate = (rect) => ({ ...rect, right: right(rect), bottom: bottom(rect) });
const overlaps = (a, b) => a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
const gap = (a, b) => Math.max(0, Math.max(a.x - b.right, b.x - a.right, a.y - b.bottom, b.y - a.bottom));
function union(rects) {
  const present = rects.filter(Boolean);
  const x = Math.min(...present.map((r) => r.x));
  const y = Math.min(...present.map((r) => r.y));
  const r = Math.max(...present.map((item) => item.right));
  const b = Math.max(...present.map((item) => item.bottom));
  return { x, y, width: r - x, height: b - y, right: r, bottom: b };
}
async function openMission(browser, mission, viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  if (!mobile) {
    await page.addInitScript(() => {
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (query.includes('hover: hover') || query.includes('pointer: fine')) {
          return { matches: true, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false };
        }
        return nativeMatchMedia(query);
      };
    });
  }
  const errors = captureErrors(page);
  const url = new URL(baseUrl);
  url.searchParams.set('qaMission', String(mission));
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { context, page, errors };
}
async function waitForScene(page, sceneKey, names) {
  await page.waitForFunction(({ sceneKey, names }) => {
    const scene = window.__ROBOTLAB_GAME__?.scene?.getScene(sceneKey);
    if (!scene?.sys?.isActive()) return false;
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    return names.every((name) => all.some((item) => item?.name === name));
  }, { sceneKey, names }, { timeout: 30000 });
  await page.waitForTimeout(350);
}
function sceneEvalMission7() {
  const game = window.__ROBOTLAB_GAME__;
  const scene = game.scene.isActive('Mission7Scene') ? game.scene.getScene('Mission7Scene') : game.scene.getScene('Mission7OrientationGuardScene');
  if (!scene) return { viewport: { width: game.scale.width, height: game.scale.height }, sceneMissing: true, activeScenes: game.scene.getScenes(true).map((candidate) => candidate.scene.key) };
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
  const card = rectFromBounds(find('connection-task-card'));
  const hint = rectFromBounds(find('connection-hint-button'));
  const robot = rectFromBounds(find('mission7-repaired-robot'));
  const group = (() => {
    const present = [card, hint, robot].filter(Boolean);
    const x = Math.min(...present.map((r) => r.x));
    const y = Math.min(...present.map((r) => r.y));
    const r = Math.max(...present.map((item) => item.right));
    const b = Math.max(...present.map((item) => item.bottom));
    return { x, y, width: r - x, height: b - y, right: r, bottom: b };
  })();
  return {
    viewport: { width: game.scale.width, height: game.scale.height },
    semanticMode: game.registry.get('responsiveLayout')?.semanticMode,
    orientationGate: game.registry.get('mission7OrientationGate') === true,
    inputActive: game.registry.get('mission7InputActive') === true,
    card, hint, robot, group,
  };
}
function sceneEvalMission8() {
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
  const button = (name) => {
    const item = find(name);
    const text = item?.list?.find((child) => child.type === 'Text');
    const textBounds = rectFromBounds(text);
    return { name, label: text?.text || '', rect: rectFromBounds(item), text: textBounds, enabled: item?.getData('control-runtime')?.enabled, alpha: item?.alpha };
  };
  const slots = all.filter((item) => item?.name?.startsWith('program-slot-')).map((slot) => {
    const bg = slot.list?.find((child) => child.name === 'slot-background');
    return rectFromBounds(bg) || rectFromBounds(slot);
  }).filter(Boolean);
  const labels = ['programming-strip-label', 'programming-strip-count', 'programming-feedback']
    .map((name) => ({ name, text: find(name)?.text || '', rect: rectFromBounds(find(name)) })).filter((item) => item.rect);
  return {
    viewport: { width: game.scale.width, height: game.scale.height },
    semanticMode: game.registry.get('responsiveLayout')?.semanticMode,
    board: rectFromBounds(find('programming-board')),
    panel: rectFromBounds(find('MISSION8_CONTROL_PANEL')),
    strip: rectFromBounds(find('program-strip')),
    labels,
    slots,
    buttons: [button('program-command-UP'), button('program-command-RIGHT'), button('program-command-DOWN'), button('program-command-LEFT'), button('programming-hint-button'), button('programming-delete-button'), button('programming-run-button')],
    commandCount: find('program-strip')?.getData('commands')?.length || 0,
    maxCommands: find('program-strip')?.getData('maxCommands'),
    feedback: find('programming-feedback')?.text || '',
  };
}
async function pointFor(page, objectName) {
  return page.evaluate((name) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission8Scene');
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const item = scene.children.list.flatMap(walk).find((candidate) => candidate?.name === name && candidate.visible !== false);
    if (!item) throw new Error(`Missing visible Mission8 object ${name}`);
    const point = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + point.x * canvas.width / game.scale.width, y: canvas.y + point.y * canvas.height / game.scale.height };
  }, objectName);
}
async function press(page, commandOrName) {
  const name = commandNames.includes(commandOrName) ? `program-command-${commandOrName}` : commandOrName;
  const point = await pointFor(page, name);
  await page.mouse.click(point.x, point.y);
}
function analyzeMission8(state) {
  const byName = Object.fromEntries(state.buttons.map((button) => [button.name, button]));
  const [up, rightButton, down, left, hint, del, launch] = state.buttons;
  const textFit = Object.fromEntries(state.buttons.map((button) => [button.name, Boolean(button.rect && button.text
    && button.text.x >= button.rect.x + 8
    && button.text.right <= button.rect.right - 8
    && button.text.y >= button.rect.y + 6
    && button.text.bottom <= button.rect.bottom - 6)]));
  const buttonOverlaps = [];
  for (let i = 0; i < state.buttons.length; i += 1) {
    for (let j = i + 1; j < state.buttons.length; j += 1) {
      if (overlaps(state.buttons[i].rect, state.buttons[j].rect)) buttonOverlaps.push(`${state.buttons[i].name}:${state.buttons[j].name}`);
    }
  }
  const textOverlaps = [];
  const texts = [...state.buttons.map((button) => ({ name: button.name, rect: button.text })), ...state.labels];
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      if (overlaps(texts[i].rect, texts[j].rect)) textOverlaps.push(`${texts[i].name}:${texts[j].name}`);
    }
  }
  const slotOverlaps = [];
  for (let i = 0; i < state.slots.length; i += 1) for (let j = i + 1; j < state.slots.length; j += 1) if (overlaps(state.slots[i], state.slots[j])) slotOverlaps.push(`${i}:${j}`);
  const arrowSameRow = [up, rightButton, down, left].every((button) => Math.abs(button.rect.y - up.rect.y) <= 1 && Math.abs(button.rect.height - up.rect.height) <= 1 && Math.abs(button.rect.width - up.rect.width) <= 1);
  const launchOwnRow = launch.rect.y > hint.rect.bottom && launch.rect.y > del.rect.bottom && Math.abs(launch.rect.x - hint.rect.x) <= 1 && launch.rect.width >= hint.rect.width + del.rect.width;
  const boardControlGap = Number((state.panel.x - state.board.right).toFixed(2));
  const boardCenterY = state.board.y + state.board.height / 2;
  const panelCenterY = state.panel.y + state.panel.height / 2;
  const verticalDelta = Math.abs(boardCenterY - panelCenterY);
  return {
    textFit,
    buttonOverlaps,
    textOverlaps,
    slotOverlaps,
    routeHeaderPass: state.labels.some((item) => item.name === 'programming-strip-label' && item.text === 'ТВОЙ ПУТЬ') && state.labels.some((item) => item.name === 'programming-strip-count'),
    routeSlotsPass: state.slots.length >= Math.min(6, state.maxCommands) && state.slots.slice(0, 6).every((slot) => slot.x >= state.panel.x + 18 && slot.right <= state.panel.right - 18),
    instructionPass: state.labels.some((item) => item.name === 'programming-feedback' && item.text === 'ВЫБЕРИ НАПРАВЛЕНИЕ'),
    directionRowPass: arrowSameRow && up.rect.x < rightButton.rect.x && rightButton.rect.x < down.rect.x && down.rect.x < left.rect.x,
    secondaryRowPass: Math.abs(hint.rect.y - del.rect.y) <= 1 && Math.abs(hint.rect.height - del.rect.height) <= 1 && gap(hint.rect, del.rect) >= 10,
    launchOwnRow,
    boardControlGap,
    verticalDelta: Number(verticalDelta.toFixed(2)),
    verticalAlignmentPass: verticalDelta <= state.viewport.height * 0.035,
    panelWidth: Number(state.panel.width.toFixed(2)),
    panelHeight: Number(state.panel.height.toFixed(2)),
    launchEnabledStateReadable: launch.alpha >= 0.8,
    allPass: false,
  };
}
async function captureMission7(browser) {
  const viewport = { width: 1600, height: 900 };
  const { context, page, errors } = await openMission(browser, 7, viewport);
  await page.waitForFunction(() => {
    const game = window.__ROBOTLAB_GAME__;
    return Boolean(game?.scene?.isActive('Mission7Scene') || game?.scene?.isActive('Mission7OrientationGuardScene'));
  }, undefined, { timeout: 30000 });
  await page.waitForTimeout(700);
  const state = await page.evaluate(sceneEvalMission7);
  const screenshot = 'mission7-final-desktop-ui-1600x900.png';
  await page.screenshot({ path: path.join(screenshotDir, screenshot) });
  await context.close();
  const centerY = state.group.y + state.group.height / 2;
  const hintBottomClearance = viewport.height - state.hint.bottom;
  const robotCenterY = state.robot.y + state.robot.height / 2;
  const cardLowerMiddle = state.card.y + state.card.height * 0.62;
  return {
    viewport, state, screenshot, errors,
    checks: {
      semanticDesktop: state.semanticMode === 'DESKTOP',
      blockMovedUp: centerY / viewport.height >= 0.47 && centerY / viewport.height <= 0.49,
      hintBottomClearance: hintBottomClearance >= 40 && hintBottomClearance <= 260,
      robotAlignment: Math.abs(robotCenterY - cardLowerMiddle) <= 90,
      browserClean: cleanErrors(errors),
    },
    metrics: { centerYPercent: Number((centerY / viewport.height * 100).toFixed(2)), hintBottomClearance: Number(hintBottomClearance.toFixed(2)), robotCenterDelta: Number(Math.abs(robotCenterY - cardLowerMiddle).toFixed(2)) },
  };
}
async function captureMission8(browser, viewport) {
  const { context, page, errors } = await openMission(browser, 8, viewport);
  await waitForScene(page, 'Mission8Scene', ['programming-board', 'MISSION8_CONTROL_PANEL', 'programming-run-button']);
  const state = await page.evaluate(sceneEvalMission8);
  const analysis = analyzeMission8(state);
  analysis.allPass = state.semanticMode === 'DESKTOP'
    && analysis.panelWidth >= 360 && analysis.panelWidth <= 430
    && analysis.panelHeight >= 330
    && analysis.routeHeaderPass && analysis.routeSlotsPass && analysis.instructionPass
    && analysis.directionRowPass && analysis.secondaryRowPass && analysis.launchOwnRow
    && analysis.buttonOverlaps.length === 0 && analysis.textOverlaps.length === 0 && analysis.slotOverlaps.length === 0
    && Object.values(analysis.textFit).every(Boolean)
    && analysis.boardControlGap >= 24 && analysis.boardControlGap <= 40
    && analysis.verticalAlignmentPass && cleanErrors(errors);
  const screenshot = `mission8-final-desktop-ui-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path: path.join(screenshotDir, screenshot) });
  await context.close();
  return { viewport, state, analysis, screenshot, errors };
}
async function runInputRegression(browser) {
  const { context, page, errors } = await openMission(browser, 8, { width: 1280, height: 720 });
  await waitForScene(page, 'Mission8Scene', ['programming-board', 'programming-run-button']);
  let initial = await page.evaluate(sceneEvalMission8);
  await press(page, 'programming-run-button');
  await page.waitForTimeout(120);
  const afterDisabledLaunchClick = await page.evaluate(sceneEvalMission8);
  await press(page, 'RIGHT');
  await page.waitForTimeout(120);
  const afterRight = await page.evaluate(sceneEvalMission8);
  await press(page, 'programming-delete-button');
  await page.waitForTimeout(120);
  const afterDelete = await page.evaluate(sceneEvalMission8);
  await press(page, 'programming-hint-button');
  await page.waitForTimeout(300);
  const afterHint = await page.evaluate(sceneEvalMission8);
  await page.evaluate(() => {
    window.__ROBOTLAB_QA__.programmingMechanic.reset();
    window.__ROBOTLAB_QA__.sessionState.enterMission8Qa();
    window.__ROBOTLAB_GAME__.scene.start('Mission8Scene');
  });
  const solvedRoutes = [];
  for (let routeIndex = 0; routeIndex < routeSolutions.length; routeIndex += 1) {
    await page.waitForFunction((expected) => {
      const scene = window.__ROBOTLAB_GAME__?.scene.getScene('Mission8Scene');
      const strip = scene?.children.getByName('program-strip');
      return scene?.sys.isActive() && strip?.getData('commands')?.length === 0 && strip?.getData('maxCommands') === expected;
    }, expectedMax[routeIndex], { timeout: 12000 });
    for (const command of routeSolutions[routeIndex]) await press(page, command);
    const beforeRun = await page.evaluate(sceneEvalMission8);
    await press(page, 'programming-run-button');
    await page.waitForFunction((index) => {
      const state = window.__ROBOTLAB_QA__.programmingMechanic.snapshot;
      return state.completed || state.challengeIndex > index;
    }, routeIndex, { timeout: 12000 });
    const afterRun = await page.evaluate(() => window.__ROBOTLAB_QA__.programmingMechanic.snapshot);
    solvedRoutes.push({ routeIndex: routeIndex + 1, beforeRun, afterRun });
  }
  await context.close();
  return {
    initial, afterDisabledLaunchClick, afterRight, afterDelete, afterHint, solvedRoutes, errors,
    checks: {
      launchDisabledWithEmptyRoute: initial.buttons.find((button) => button.name === 'programming-run-button').enabled === false && afterDisabledLaunchClick.commandCount === 0,
      directionButtonsWork: afterRight.commandCount === 1,
      deleteWorks: afterDelete.commandCount === 0,
      hintWorks: afterHint.feedback.includes('ПОПРОБУЙ') || afterHint.feedback.includes('ИСПРАВЬ'),
      launchEnablesCorrectly: afterRight.buttons.find((button) => button.name === 'programming-run-button').enabled === true,
      launchWorksAllRoutes: solvedRoutes.length === 3 && solvedRoutes[2]?.afterRun?.completed === true,
      browserClean: cleanErrors(errors),
    },
  };
}
async function runMobileRegression(browser) {
  const mission7 = await openMission(browser, 7, { width: 390, height: 844 }, true);
  await waitForScene(mission7.page, 'Mission7Scene', ['connection-task-card', 'connection-hint-button']);
  const m7 = await mission7.page.evaluate(sceneEvalMission7);
  await mission7.page.screenshot({ path: path.join(screenshotDir, 'mission7-final-mobile-regression-390x844.png') });
  await mission7.context.close();
  const mission8 = await openMission(browser, 8, { width: 844, height: 390 }, true);
  await waitForScene(mission8.page, 'Mission8Scene', ['programming-board', 'MISSION8_CONTROL_PANEL', 'programming-run-button']);
  const m8 = await mission8.page.evaluate(sceneEvalMission8);
  await mission8.page.screenshot({ path: path.join(screenshotDir, 'mission8-final-mobile-regression-844x390.png') });
  await mission8.context.close();
  return {
    mission7: { state: m7, errors: mission7.errors, pass: m7.semanticMode.startsWith('PHONE_PORTRAIT') && !m7.orientationGate && m7.inputActive && cleanErrors(mission7.errors) },
    mission8: { state: m8, errors: mission8.errors, pass: m8.semanticMode === 'PHONE_LANDSCAPE_SHORT' && m8.buttons.every((button) => button.rect && button.rect.height >= 48) && cleanErrors(mission8.errors) },
  };
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { startedAt: new Date().toISOString(), mission7: null, mission8: {}, inputRegression: null, mobileRegression: null };
  try {
    report.mission7 = await captureMission7(browser);
    for (const viewport of mission8Viewports) report.mission8[`${viewport.width}x${viewport.height}`] = await captureMission8(browser, viewport);
    report.inputRegression = await runInputRegression(browser);
    report.mobileRegression = await runMobileRegression(browser);
  } finally {
    await browser.close();
  }
  const mission7Pass = Object.values(report.mission7.checks).every(Boolean);
  const mission8Pass = Object.values(report.mission8).every((item) => item.analysis.allPass);
  const inputPass = Object.values(report.inputRegression.checks).every(Boolean);
  const mobilePass = report.mobileRegression.mission7.pass && report.mobileRegression.mission8.pass;
  report.summary = { mission7Pass, mission8Pass, inputPass, mobilePass, status: mission7Pass && mission8Pass && inputPass && mobilePass ? 'PASS' : 'FAIL' };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, summary: report.summary }, null, 2));
  if (report.summary.status !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });