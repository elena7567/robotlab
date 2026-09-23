const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const out = path.join('docs', 'qa', 'assembly-desktop-composition-review.json');
const screenshotsDir = path.join('docs', 'qa', 'screenshots');
const desktopViewports = [[1280, 720], [1600, 900], [1920, 1080]];
const mobileViewports = [[390, 844], [844, 390]];
const screenshotNames = new Map([
  ['1280x720', 'assembly-desktop-composition-1280x720.png'],
  ['1600x900', 'assembly-desktop-composition-1600x900.png'],
  ['1920x1080', 'assembly-desktop-composition-1920x1080.png'],
]);
const report = { result: 'PENDING', checks: [], errors: [], desktop: [], mobile: [], screenshots: [], input: null };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => Math.round(value * 100) / 100;
const check = (name, ok, actual = null) => report.checks.push({ name, ok, actual });

fs.mkdirSync(screenshotsDir, { recursive: true });

async function attachErrors(page) {
  page.on('pageerror', (error) => report.errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('requestfailed', (request) => report.errors.push(request.url()));
}

async function enterAssembly(page, completedTasks = 0) {
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__?.sessionState, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.textures.exists('robot-v2-helper') === true, null, { timeout: 90000 });
  await page.evaluate((completed) => {
    window.__ROBOTLAB_QA__.sessionState.reset();
    const state = window.__ROBOTLAB_QA__.sessionState;
    for (let i = 0; i < completed; i += 1) state.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('GameScene');
  }, completedTasks);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'), null, { timeout: 90000 });
  await page.waitForFunction((expectedMissionId) => window.__ROBOTLAB_GAME__?.registry?.get('sceneComposition')?.missionId === expectedMissionId, completedTasks + 1, { timeout: 90000 });
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene');
    if (!scene) return false;
    const all = [];
    const walk = (object) => { all.push(object); if (object?.list) object.list.forEach(walk); };
    scene.children.list.forEach(walk);
    return all.some((object) => object.name === 'task-card')
      && all.some((object) => object.name === 'progress-panel')
      && all.some((object) => object.name === 'grounded-robot');
  }, null, { timeout: 90000 });
  await sleep(500);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const all = [];
    const walk = (object) => {
      all.push(object);
      if (object?.list) object.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    const find = (name) => all.find((object) => object.name === name);
    const bounds = (object) => {
      if (!object) return null;
      const audit = object.getData?.('auditBounds');
      if (audit) return { left: audit.x, right: audit.x + audit.width, top: audit.y, bottom: audit.y + audit.height, width: audit.width, height: audit.height };
      if (!object.getBounds) return null;
      const box = object.getBounds();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const composition = game.registry.get('sceneComposition');
    const layout = game.registry.get('responsiveLayout');
    const task = composition.taskCard;
    const progress = composition.progress;
    const character = composition.regions.CHARACTER;
    return {
      scene: scene.scene.key,
      semantic: layout.semanticMode,
      viewport: { width: game.scale.width, height: game.scale.height },
      composition: {
        missionId: composition.missionId,
        taskCard: task,
        progress,
        character,
      },
      card: bounds(find('task-card')),
      robot: bounds(find('grounded-robot')),
      panel: bounds(find('progress-panel')),
      panelLabel: find('assembly-progress-label')?.text ?? null,
      labels: all.map((object) => object.text).filter((text) => typeof text === 'string'),
    };
  });
}

function centerX(rect) { return (rect.left + rect.right) / 2; }

function platformCenterX(width, height) {
  const scale = Math.max(width / 1280, height / 720);
  return (width - 1280 * scale) / 2 + 640 * scale;
}

function metricsFrom(info) {
  const platformX = platformCenterX(info.viewport.width, info.viewport.height);
  const taskCardCenterX = centerX(info.card);
  const robotCenterX = centerX(info.robot);
  const panelRect = { left: info.composition.progress.x, right: info.composition.progress.x + info.composition.progress.width, top: info.composition.progress.y, bottom: info.composition.progress.y + info.composition.progress.height, width: info.composition.progress.width, height: info.composition.progress.height };
  const panelRightClearance = info.viewport.width - panelRect.right;
  return {
    viewport: `${info.viewport.width}x${info.viewport.height}`,
    platformCenterX: round(platformX),
    taskCardCenterX: round(taskCardCenterX),
    taskCardDeltaX: round(taskCardCenterX - platformX),
    robotZoneLeft: round(info.composition.character.left ?? info.composition.character.x),
    robotCenterX: round(robotCenterX),
    robotRight: round(info.robot.right),
    taskCardLeft: round(info.card.left),
    taskCardRight: round(info.card.right),
    assemblyPanelLeft: round(panelRect.left),
    assemblyPanelRight: round(panelRect.right),
    assemblyPanelRightClearance: round(panelRightClearance),
    cardToAssemblyGap: round(panelRect.left - info.card.right),
    robotToCardGap: round(info.card.left - info.robot.right),
    robotHeight: round(info.robot.height),
    panelLabel: info.panelLabel,
  };
}

function infoHeight(viewport) { return Number(viewport.split('x')[1]); }

function validateDesktop(metrics) {
  check(`${metrics.viewport} CARD CENTERED ON PLATFORM`, Math.abs(metrics.taskCardDeltaX) <= 8, metrics);
  check(`${metrics.viewport} ROBOT MOVED TO LEFT ZONE`, metrics.robotCenterX < metrics.platformCenterX && metrics.robotRight < metrics.taskCardLeft, metrics);
  check(`${metrics.viewport} ROBOT SCALE PRESERVED`, metrics.robotHeight >= infoHeight(metrics.viewport) * 0.38 && metrics.robotHeight <= infoHeight(metrics.viewport) * 0.43, metrics);
  check(`${metrics.viewport} ASSEMBLY PANEL MOVED CLOSER`, metrics.assemblyPanelLeft > metrics.taskCardRight && metrics.cardToAssemblyGap >= 48 && metrics.cardToAssemblyGap <= 128, metrics);
  check(`${metrics.viewport} RIGHT EDGE CLINGING REMOVED`, metrics.assemblyPanelRightClearance >= 48, metrics);
  check(`${metrics.viewport} ROBOT TO CARD GAP`, metrics.robotToCardGap >= 48, metrics);
  check(`${metrics.viewport} ASSEMBLY PANEL LABEL`, metrics.panelLabel === 'СБОРКА 1/5', metrics.panelLabel);
}

async function runDesktop(browser) {
  for (const [width, height] of desktopViewports) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await attachErrors(page);
    await enterAssembly(page, 1);
    const info = await inspect(page);
    const metrics = metricsFrom(info);
    validateDesktop(metrics);
    report.desktop.push({ metrics, info });
    const screenshotPath = path.join(screenshotsDir, screenshotNames.get(metrics.viewport));
    await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 90000 });
    report.screenshots.push(screenshotPath);
    await context.close();
  }
}

async function runMobile(browser) {
  for (const [width, height] of mobileViewports) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: true });
    const page = await context.newPage();
    await attachErrors(page);
    await enterAssembly(page, 1);
    const info = await inspect(page);
    const ok = info.semantic !== 'DESKTOP' && Boolean(info.card) && Boolean(info.robot) && Boolean(info.panel);
    report.mobile.push({ viewport: `${width}x${height}`, semantic: info.semantic, ok });
    check(`${width}x${height} MOBILE REGRESSION`, ok, { semantic: info.semantic, card: Boolean(info.card), robot: Boolean(info.robot), panel: Boolean(info.panel) });
    await context.close();
  }
}

async function runInput(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await attachErrors(page);
  await enterAssembly(page, 0);
  const before = await inspect(page);
  const target = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const all = [];
    const walk = (object) => { all.push(object); if (object?.list) object.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const hint = all.find((object) => object.name === 'game-home');
    const box = hint?.getBounds();
    return box ? { x: box.centerX, y: box.centerY, name: hint.name } : null;
  });
  if (target) await page.mouse.click(target.x, target.y);
  await sleep(250);
  const activeScenes = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScenes(true).map((scene) => scene.scene.key)).catch(() => []);
  const pass = Boolean(target) && activeScenes.includes('StartScene');
  report.input = { pass, target, activeScenes, before: before.panelLabel };
  check('mouse input PASS', pass, report.input);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    await runDesktop(browser);
    await runMobile(browser);
    await runInput(browser);
  } finally {
    await browser.close();
  }
  check('console PASS', report.errors.length === 0, report.errors);
  report.result = report.checks.every((entry) => entry.ok) && report.errors.length === 0 ? 'PASS' : 'FAIL';
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ result: report.result, failed: report.checks.filter((entry) => !entry.ok), errors: report.errors, out, screenshots: report.screenshots }, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
})().catch((error) => {
  report.result = 'FAIL';
  report.errors.push(error.stack || error.message || String(error));
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.error(error);
  process.exit(1);
});
