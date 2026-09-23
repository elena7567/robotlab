const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const stamp = '20260914';
const screenshotDir = path.join('docs', 'qa', 'screenshots', `mission7-8-visual-truth-${stamp}`);
const reportPath = path.join('docs', 'qa', `mission7-8-visual-truth-${stamp}.json`);
fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const viewports = [
  { mission: 7, width: 1600, height: 900 },
  { mission: 8, width: 1280, height: 720 },
  { mission: 8, width: 1600, height: 900 },
  { mission: 8, width: 1920, height: 1080 },
  { mission: 7, width: 390, height: 844, mobile: true },
  { mission: 8, width: 844, height: 390, mobile: true },
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}
function cleanErrors(errors) {
  return errors.console.length === 0 && errors.requests.length === 0 && errors.responses.length === 0
    && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;
}
function right(rect) { return rect.x + rect.width; }
function bottom(rect) { return rect.y + rect.height; }
function overlaps(a, b) { return a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y; }
function gap(a, b) { return Math.max(0, Math.max(a.x - b.right, b.x - a.right, a.y - b.bottom, b.y - a.bottom)); }

async function openMission(browser, item) {
  const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, isMobile: Boolean(item.mobile), hasTouch: Boolean(item.mobile), reducedMotion: 'reduce' });
  const page = await context.newPage();
  if (!item.mobile) {
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
  url.searchParams.set('qaMission', String(item.mission));
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { context, page, errors, url: url.toString() };
}
async function waitForMission(page, mission) {
  await page.waitForFunction((mission) => {
    const game = window.__ROBOTLAB_GAME__;
    if (!game?.scene) return false;
    return game.scene.getScenes(true).some((scene) => scene.scene.key.includes(`Mission${mission}`));
  }, mission, { timeout: 30000 });
  await page.waitForTimeout(700);
}
function rectFrom(item) {
  if (!item) return null;
  const audit = item.getData?.('auditBounds');
  if (audit) return { ...audit, right: audit.x + audit.width, bottom: audit.y + audit.height };
  const b = item.getBounds?.();
  return b ? { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom } : null;
}
function sceneItems(scene) {
  const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
  return scene.children.list.flatMap(walk);
}
function mission7State() {
  const rectFromPage = (item) => {
    if (!item) return null;
    const audit = item.getData?.('auditBounds');
    if (audit) return { ...audit, right: audit.x + audit.width, bottom: audit.y + audit.height };
    const b = item.getBounds?.();
    return b ? { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom } : null;
  };
  const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
  const game = window.__ROBOTLAB_GAME__;
  const scene = game.scene.getScene('Mission7Scene') || game.scene.getScene('Mission7OrientationGuardScene');
  const all = scene.children.list.flatMap(walk);
  const find = (name) => all.find((item) => item?.name === name);
  const card = rectFromPage(find('connection-task-card'));
  const hint = rectFromPage(find('connection-hint-button'));
  const robot = rectFromPage(find('mission7-repaired-robot'));
  const text = Object.fromEntries(['mission7-header', 'systems-progress'].map((name) => [name, rectFromPage(find(name))]));
  return { semanticMode: game.registry.get('responsiveLayout')?.semanticMode, card, hint, robot, text };
}
function mission8State() {
  const rectFromPage = (item) => {
    if (!item) return null;
    const audit = item.getData?.('auditBounds');
    if (audit) return { ...audit, right: audit.x + audit.width, bottom: audit.y + audit.height };
    const b = item.getBounds?.();
    return b ? { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom } : null;
  };
  const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
  const game = window.__ROBOTLAB_GAME__;
  const scene = game.scene.getScene('Mission8Scene');
  const all = scene.children.list.flatMap(walk);
  const find = (name) => all.find((item) => item?.name === name);
  const button = (name) => {
    const item = find(name);
    const label = item?.list?.find((child) => child.type === 'Text');
    return { name, label: label?.text || '', rect: rectFromPage(item), text: rectFromPage(label), enabled: item?.getData('control-runtime')?.enabled, alpha: item?.alpha };
  };
  const labels = ['programming-strip-label', 'programming-strip-count', 'programming-feedback']
    .map((name) => ({ name, label: find(name)?.text || '', rect: rectFromPage(find(name)) })).filter((item) => item.rect);
  const slots = all.filter((item) => item?.name?.startsWith('program-slot-')).map(rectFromPage).filter(Boolean);
  return {
    semanticMode: game.registry.get('responsiveLayout')?.semanticMode,
    board: rectFromPage(find('programming-board')),
    panel: rectFromPage(find('MISSION8_CONTROL_PANEL')), 
    labels,
    slots,
    buttons: ['program-command-UP','program-command-RIGHT','program-command-DOWN','program-command-LEFT','programming-hint-button','programming-delete-button','programming-run-button'].map(button),
  };
}
function analyzeMission7(state) {
  const robotGap = Math.max(0, state.robot.x - state.card.right);
  const hintCenterDelta = Math.abs((state.hint.x + state.hint.width / 2) - (state.card.x + state.card.width / 2));
  const robotCenterY = state.robot.y + state.robot.height / 2;
  const lowerMiddle = state.card.y + state.card.height * 0.62;
  return { robotGap, hintCenterDelta, robotLowerMiddleDelta: Math.abs(robotCenterY - lowerMiddle), pass: robotGap >= 40 && robotGap <= 80 && hintCenterDelta <= 8 && Math.abs(robotCenterY - lowerMiddle) <= 95 };
}
function analyzeMission8(state) {
  const [up, rightButton, down, left, hint, del, launch] = state.buttons;
  const textFit = Object.fromEntries(state.buttons.map((button) => [button.name, Boolean(button.rect && button.text
    && button.text.x >= button.rect.x + 8 && button.text.right <= button.rect.right - 8
    && button.text.y >= button.rect.y + 5 && button.text.bottom <= button.rect.bottom - 5)]));
  const buttonOverlaps = [];
  for (let i = 0; i < state.buttons.length; i += 1) for (let j = i + 1; j < state.buttons.length; j += 1) if (overlaps(state.buttons[i].rect, state.buttons[j].rect)) buttonOverlaps.push(`${state.buttons[i].name}:${state.buttons[j].name}`);
  const textOverlaps = [];
  const texts = [...state.buttons.map((button) => ({ name: button.name, rect: button.text })), ...state.labels];
  for (let i = 0; i < texts.length; i += 1) for (let j = i + 1; j < texts.length; j += 1) if (overlaps(texts[i].rect, texts[j].rect)) textOverlaps.push(`${texts[i].name}:${texts[j].name}`);
  return {
    panelWidth: state.panel.width,
    boardPanelGap: state.panel.x - state.board.right,
    textFit,
    buttonOverlaps,
    textOverlaps,
    secondaryGap: gap(hint.rect, del.rect),
    launchOwnRow: launch.rect.y > hint.rect.bottom && launch.rect.y > del.rect.bottom && launch.rect.width >= hint.rect.width + del.rect.width,
    routeHeader: state.labels.some((item) => item.name === 'programming-strip-label' && item.label === 'ТВОЙ ПУТЬ') && state.labels.some((item) => item.name === 'programming-strip-count' && item.label.includes('/')),
    directionPrompt: state.labels.some((item) => item.name === 'programming-feedback' && item.label === 'ВЫБЕРИ НАПРАВЛЕНИЕ'),
    routeSlots: state.slots.length >= 6,
    pass: false,
  };
}
async function pointFor(page, objectName) {
  return page.evaluate((name) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission8Scene');
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const item = scene.children.list.flatMap(walk).find((candidate) => candidate?.name === name && candidate.visible !== false);
    const point = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + point.x * canvas.width / game.scale.width, y: canvas.y + point.y * canvas.height / game.scale.height };
  }, objectName);
}
async function clickObj(page, name) {
  const point = await pointFor(page, name);
  await page.mouse.click(point.x, point.y);
}
async function runInput(browser) {
  const opened = await openMission(browser, { mission: 8, width: 1280, height: 720 });
  await waitForMission(opened.page, 8);
  const before = await opened.page.evaluate(mission8State);
  await clickObj(opened.page, 'program-command-RIGHT');
  await opened.page.waitForTimeout(150);
  const afterRight = await opened.page.evaluate(() => window.__ROBOTLAB_QA__.programmingMechanic.snapshot.commands.length);
  await clickObj(opened.page, 'programming-delete-button');
  await opened.page.waitForTimeout(150);
  const afterDelete = await opened.page.evaluate(() => window.__ROBOTLAB_QA__.programmingMechanic.snapshot.commands.length);
  await opened.context.close();
  return { pass: before.buttons.find((button) => button.name === 'programming-run-button').enabled === false && afterRight === 1 && afterDelete === 0 && cleanErrors(opened.errors), beforeRunEnabled: before.buttons.find((button) => button.name === 'programming-run-button').enabled, afterRight, afterDelete, errors: opened.errors };
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { startedAt: new Date().toISOString(), captures: [], input: null };
  try {
    for (const item of viewports) {
      const opened = await openMission(browser, item);
      await waitForMission(opened.page, item.mission);
      const state = item.mission === 7 ? await opened.page.evaluate(mission7State) : await opened.page.evaluate(mission8State);
      const analysis = item.mission === 7 ? analyzeMission7(state) : analyzeMission8(state);
      if (item.mission === 8) analysis.pass = state.semanticMode === (item.mobile ? 'PHONE_LANDSCAPE_SHORT' : 'DESKTOP')
        && analysis.panelWidth >= (item.mobile ? 250 : 470)
        && analysis.boardPanelGap >= (item.mobile ? 0 : 10) && analysis.boardPanelGap <= (item.mobile ? 9999 : 48)
        && analysis.secondaryGap >= (item.mobile ? 7 : 12)
        && analysis.launchOwnRow && analysis.routeHeader && analysis.directionPrompt && analysis.routeSlots
        && analysis.buttonOverlaps.length === 0 && analysis.textOverlaps.length === 0
        && Object.values(analysis.textFit).every(Boolean);
      const fileName = `mission${item.mission}-${item.mobile ? 'mobile' : 'desktop'}-${stamp}-${item.width}x${item.height}.png`;
      const screenshot = path.join(screenshotDir, fileName);
      await opened.page.screenshot({ path: screenshot });
      report.captures.push({ item, url: opened.url, screenshot, state, analysis, errors: opened.errors, browserClean: cleanErrors(opened.errors) });
      await opened.context.close();
    }
    report.input = await runInput(browser);
  } finally {
    await browser.close();
  }
  const desktopCaptures = report.captures.filter((c) => !c.item.mobile);
  const mobileCaptures = report.captures.filter((c) => c.item.mobile);
  report.summary = {
    mission7DesktopGeometry: desktopCaptures.filter((c) => c.item.mission === 7).every((c) => c.analysis.pass && c.browserClean),
    mission8DesktopGeometry: desktopCaptures.filter((c) => c.item.mission === 8).every((c) => c.analysis.pass && c.browserClean),
    mobileSmoke: mobileCaptures.every((c) => c.browserClean && c.state.semanticMode),
    input: report.input.pass,
  };
  report.summary.status = Object.values(report.summary).every(Boolean) ? 'PASS' : 'FAIL';
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ reportPath, summary: report.summary, screenshots: report.captures.map((c) => c.screenshot) }, null, 2));
  if (report.summary.status !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
