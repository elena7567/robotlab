const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'mission8-desktop-composition-review.json');
const commandNames = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
const routeSolutions = [
  ['RIGHT', 'RIGHT'],
  ['UP', 'RIGHT', 'RIGHT'],
  ['RIGHT', 'UP', 'UP', 'RIGHT', 'RIGHT'],
];
const routeFullPrograms = [
  ['RIGHT', 'UP', 'RIGHT', 'RIGHT', 'DOWN', 'LEFT'],
  ['UP', 'UP', 'RIGHT', 'RIGHT', 'RIGHT', 'DOWN', 'DOWN', 'LEFT', 'UP'],
  ['RIGHT', 'UP', 'LEFT', 'UP', 'RIGHT', 'RIGHT', 'RIGHT'],
];

function ensureDir() { fs.mkdirSync(screenshotDir, { recursive: true }); fs.mkdirSync(path.dirname(reportPath), { recursive: true }); }
function errorFree(errors) { return Object.values(errors).every((list) => list.length === 0); }
function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function startMission8(page) {
  const url = new URL(baseUrl);
  url.searchParams.set('qaMission', '8');
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('Mission8Scene');
    return scene?.sys.isActive()
      && scene.children.getByName('programming-board')
      && scene.children.getByName('programming-run-button')
      && scene.children.getByName('MISSION8_CONTROL_PANEL');
  }, undefined, { timeout: 30000 });
}

async function pointFor(page, objectName) {
  return page.evaluate((name) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission8Scene');
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const item = scene.children.list.flatMap(walk).find((candidate) => candidate?.name === name && candidate.visible !== false);
    if (!item) throw new Error(`Missing visible Mission8 object ${name}`);
    const matrix = item.getWorldTransformMatrix();
    const point = matrix.transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + point.x * canvas.width / game.scale.width, y: canvas.y + point.y * canvas.height / game.scale.height };
  }, objectName);
}

async function press(page, commandOrName, touch) {
  const name = commandNames.includes(commandOrName) ? `program-command-${commandOrName}` : commandOrName;
  const point = await pointFor(page, name);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission8Scene');
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const commands = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
    const find = (name) => all.find((item) => item?.name === name);
    const rectFromBounds = (item) => {
      if (!item) return null;
      const audit = item.getData?.('auditBounds');
      if (audit) return { ...audit, right: audit.x + audit.width, bottom: audit.y + audit.height };
      const bounds = item.getBounds?.();
      return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom } : null;
    };
    const board = find('programming-board');
    const panel = find('MISSION8_CONTROL_PANEL');
    const strip = find('program-strip');
    const arrows = commands.map((command) => find(`program-command-${command}`));
    const hint = find('programming-hint-button');
    const del = find('programming-delete-button');
    const run = find('programming-run-button');
    const robot = find('programming-robot');
    const charger = find('programming-target-icon');
    const slots = all.filter((item) => item?.name?.startsWith('program-slot-'));
    const stripData = strip?.data?.values || {};
    const routeSlotLabels = slots.map((slot) => slot.list?.find((child) => child.name === 'slot-label')?.text);
    const arrowRects = arrows.map(rectFromBounds);
    const routeRect = rectFromBounds(strip);
    const boardRect = rectFromBounds(board);
    const panelRect = rectFromBounds(panel);
    const runRuntime = run?.data?.values?.['control-runtime'];
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      semanticMode: game.registry.get('responsiveLayout')?.semanticMode,
      commandCount: stripData.commands?.length || 0,
      maxCommands: stripData.maxCommands,
      routeSlotLabels,
      feedback: find('programming-feedback')?.text || '',
      board: boardRect,
      panel: panelRect,
      strip: routeRect,
      arrows: arrowRects,
      actions: [hint, del, run].map(rectFromBounds),
      run: { rect: rectFromBounds(run), enabled: runRuntime?.enabled, alpha: run?.alpha },
      delete: { rect: rectFromBounds(del), enabled: del?.data?.values?.['control-runtime']?.enabled },
      robot: {
        gridColumn: robot?.getData('gridColumn'), gridRow: robot?.getData('gridRow'),
        visibleCellWidthRatio: robot?.getData('visibleCellWidthRatio'), visibleCellHeightRatio: robot?.getData('visibleCellHeightRatio'),
        cellSize: robot?.getData('cellSize'), scale: robot?.getData('visualScale'),
      },
      charger: rectFromBounds(charger),
    };
  });
}

async function runDesktopCapture(browser, name, width, height, actions) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startMission8(page);
  for (const action of actions) await press(page, action, false);
  await page.waitForTimeout(200);
  const state = await inspect(page);
  await page.screenshot({ path: path.join(screenshotDir, `mission8-desktop-${name}.png`) });
  await context.close();
  return { name, width, height, actions, state, errors };
}

async function runMobileRegression(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startMission8(page);
  await press(page, 'RIGHT', true);
  await press(page, 'programming-delete-button', true);
  await press(page, 'programming-hint-button', true);
  await page.waitForTimeout(250);
  const state = await inspect(page);
  await page.screenshot({ path: path.join(screenshotDir, `mission8-mobile-regression-${name}.png`) });
  await context.close();
  return { name, width, height, state, errors };
}

async function runInputQa(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startMission8(page);
  const initial = await inspect(page);
  await press(page, 'programming-run-button', false);
  await page.waitForTimeout(100);
  const afterDisabledLaunchClick = await inspect(page);
  await press(page, 'RIGHT', false);
  await page.waitForTimeout(100);
  const afterRight = await inspect(page);
  await press(page, 'programming-delete-button', false);
  await page.waitForTimeout(100);
  const afterDelete = await inspect(page);
  await press(page, 'programming-hint-button', false);
  await page.waitForTimeout(250);
  const afterHint = await inspect(page);
  for (let i = 0; i < 12; i += 1) await press(page, 'RIGHT', false);
  await page.waitForTimeout(100);
  const afterRapid = await inspect(page);
  await page.evaluate(() => {
    window.__ROBOTLAB_QA__.programmingMechanic.reset();
    window.__ROBOTLAB_QA__.sessionState.enterMission8Qa();
    window.__ROBOTLAB_GAME__.scene.start('Mission8Scene');
  });
  const solvedRoutes = [];
  for (let routeIndex = 0; routeIndex < routeSolutions.length; routeIndex += 1) {
    await page.waitForFunction(({ expectedMax }) => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
      const strip = scene?.children.getByName('program-strip');
      const commands = strip?.getData('commands');
      return scene?.sys.isActive()
        && Array.isArray(commands)
        && commands.length === 0
        && strip.getData('maxCommands') === expectedMax
        && scene.children.getByName('programming-run-button');
    }, { expectedMax: routeFullPrograms[routeIndex].length }, { timeout: 12000 });
    for (const command of routeSolutions[routeIndex]) await press(page, command, false);
    const beforeRun = await inspect(page);
    await press(page, 'programming-run-button', false);
    await page.waitForFunction((index) => {
      const state = window.__ROBOTLAB_QA__.programmingMechanic.snapshot;
      return state.completed || state.challengeIndex > index;
    }, routeIndex, { timeout: 12000 });
    const postRun = await page.evaluate(() => window.__ROBOTLAB_QA__.programmingMechanic.snapshot);
    solvedRoutes.push({ routeIndex: routeIndex + 1, commands: routeSolutions[routeIndex], beforeRun, postRun });
  }
  await context.close();
  return {
    initial,
    afterDisabledLaunchClick,
    afterRight,
    afterDelete,
    afterHint,
    afterRapid,
    solvedRoutes,
    errors,
    checks: {
      launchDisabledWhenEmpty: initial.run.enabled === false && afterDisabledLaunchClick.commandCount === 0,
      directionAddsCommand: afterRight.commandCount === 1 && afterRight.routeSlotLabels.includes('→') && afterRight.run.enabled === true,
      deleteRemovesCommand: afterDelete.commandCount === 0 && afterDelete.run.enabled === false,
      hintWorks: afterHint.feedback.includes('ПОПРОБУЙ') || afterHint.feedback.includes('ИСПРАВЬ'),
      rapidTapsCapped: afterRapid.commandCount === afterRapid.maxCommands,
      allThreeMapsSolved: solvedRoutes.length === 3 && solvedRoutes[2]?.postRun?.completed === true,
      browserClean: errorFree(errors),
    },
  };
}

function layoutChecks(captures, mobile) {
  const desktopChecks = {};
  for (const capture of captures) {
    const s = capture.state;
    const gap = s.panel.x - s.board.right;
    const compositionLeft = s.board.x;
    const compositionRight = s.panel.right;
    const compositionWidth = compositionRight - compositionLeft;
    desktopChecks[capture.name] = {
      boardCenteredBetter: s.board.x + s.board.width / 2 > s.viewport.width * 0.34 && s.board.x + s.board.width / 2 < s.viewport.width * 0.56,
      boundedWidth: compositionWidth <= 1165,
      compactGap: gap >= 12 && gap <= 70,
      routeArrowsGrouped: Math.abs((s.strip.bottom + 42) - s.arrows[0].y) <= 40,
      robotLarger: s.robot.visibleCellHeightRatio >= 0.5,
      launchReachable: s.run.rect.x - s.board.right <= 470,
      panelNamed: Boolean(s.panel),
      noErrors: errorFree(capture.errors),
    };
  }
  const mobileChecks = mobile.map((capture) => ({
    name: capture.name,
    boardVisible: capture.state.board.width >= 300 && capture.state.board.height >= 180,
    routeVisible: capture.state.strip.width > 0 && capture.state.commandCount === 0,
    arrowsTouchSized: capture.state.arrows.every((rect) => rect.width >= 48 && rect.height >= 48),
    buttonsVisible: capture.state.actions.every((rect) => rect.width > 0 && rect.height >= 48),
    noErrors: errorFree(capture.errors),
  }));
  return { desktopChecks, mobileChecks };
}

(async () => {
  ensureDir();
  const browser = await chromium.launch({ headless: true });
  const captures = [];
  captures.push(await runDesktopCapture(browser, '1280x720-initial', 1280, 720, []));
  captures.push(await runDesktopCapture(browser, '1280x720-3commands', 1280, 720, ['RIGHT', 'UP', 'RIGHT']));
  captures.push(await runDesktopCapture(browser, '1280x720-route-full-launch-enabled', 1280, 720, routeFullPrograms[0]));
  captures.push(await runDesktopCapture(browser, '1438x914-initial', 1438, 914, []));
  captures.push(await runDesktopCapture(browser, '1600x900-initial', 1600, 900, []));
  captures.push(await runDesktopCapture(browser, '1600x900-route-partial', 1600, 900, ['RIGHT', 'UP']));
  captures.push(await runDesktopCapture(browser, '1920x1080-initial', 1920, 1080, []));
  const mobile = [];
  mobile.push(await runMobileRegression(browser, '844x390', 844, 390));
  mobile.push(await runMobileRegression(browser, '915x412', 915, 412));
  await browser.close();
  const checks = layoutChecks(captures, mobile);
  const failures = [
    ...Object.entries(checks.desktopChecks).flatMap(([name, values]) => Object.entries(values).filter(([, pass]) => !pass).map(([check]) => `${name}:${check}`)),
    ...checks.mobileChecks.flatMap((item) => Object.entries(item).filter(([key, pass]) => key !== 'name' && !pass).map(([check]) => `${item.name}:${check}`)),  ];
  const report = { captures, mobile, checks, failures };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ failures, reportPath }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });