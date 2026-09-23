const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = 'http://127.0.0.1:4198/?qaMission=8';
const reportPath = path.join('docs', 'qa', 'mission8-input-production-qa.json');
const routeSolutions = [
  ['RIGHT', 'RIGHT'],
  ['RIGHT', 'RIGHT', 'UP'],
  ['RIGHT', 'UP', 'UP', 'RIGHT', 'RIGHT'],
];
const expectedMax = [6, 9, 7];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}
const errorFree = (errors) => Object.values(errors).every((list) => list.length === 0);

async function waitMission8(page, maxCommands) {
  await page.waitForFunction((expected) => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('Mission8Scene');
    const strip = scene?.children.getByName('program-strip');
    const commands = strip?.getData('commands');
    return scene?.sys.isActive()
      && scene.children.getByName('programming-board')
      && scene.children.getByName('programming-run-button')
      && Array.isArray(commands)
      && commands.length === 0
      && (expected === null || strip.getData('maxCommands') === expected);
  }, maxCommands ?? null, { timeout: 30000 });
}

async function start(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitMission8(page, 6);
}

async function pointFor(page, objectName) {
  return page.evaluate((name) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission8Scene');
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const item = scene.children.list.flatMap(walk).find((candidate) => candidate?.name === name && candidate.visible !== false);
    if (!item) throw new Error(`Missing ${name}`);
    const point = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + point.x * canvas.width / game.scale.width, y: canvas.y + point.y * canvas.height / game.scale.height };
  }, objectName);
}
async function press(page, name) {
  const objectName = ['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(name) ? `program-command-${name}` : name;
  const point = await pointFor(page, objectName);
  await page.mouse.click(point.x, point.y);
}
async function snapshot(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const strip = scene.children.getByName('program-strip');
    const run = scene.children.getByName('programming-run-button');
    const del = scene.children.getByName('programming-delete-button');
    return {
      mechanic: window.__ROBOTLAB_QA__.programmingMechanic.snapshot,
      stripCommands: strip.getData('commands'),
      maxCommands: strip.getData('maxCommands'),
      runEnabled: run.getData('control-runtime')?.enabled,
      deleteEnabled: del.getData('control-runtime')?.enabled,
      feedback: scene.children.getByName('programming-feedback')?.text,
    };
  });
}
async function resetToMission8(page) {
  await page.evaluate(() => {
    window.__ROBOTLAB_QA__.programmingMechanic.reset();
    window.__ROBOTLAB_QA__.sessionState.enterMission8Qa();
    window.__ROBOTLAB_GAME__.scene.start('Mission8Scene');
  });
  await waitMission8(page, 6);
}

(async () => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const errors = captureErrors(page);
  await start(page);
  const initial = await snapshot(page);
  await press(page, 'programming-run-button');
  await page.waitForTimeout(120);
  const afterDisabledLaunchClick = await snapshot(page);
  await press(page, 'RIGHT');
  await page.waitForTimeout(120);
  const afterRight = await snapshot(page);
  await press(page, 'programming-delete-button');
  await page.waitForTimeout(120);
  const afterDelete = await snapshot(page);
  await press(page, 'programming-hint-button');
  await page.waitForTimeout(300);
  const afterHint = await snapshot(page);
  await resetToMission8(page);
  for (let index = 0; index < 12; index += 1) await press(page, 'RIGHT');
  await page.waitForTimeout(150);
  const afterRapid = await snapshot(page);
  await resetToMission8(page);
  const solvedRoutes = [];
  for (let routeIndex = 0; routeIndex < routeSolutions.length; routeIndex += 1) {
    await waitMission8(page, expectedMax[routeIndex]);
    for (const command of routeSolutions[routeIndex]) await press(page, command);
    const beforeRun = await snapshot(page);
    await press(page, 'programming-run-button');
    await page.waitForTimeout(3200);
    const afterRun = await snapshot(page).catch(async () => ({ mechanic: await page.evaluate(() => window.__ROBOTLAB_QA__.programmingMechanic.snapshot) }));
    solvedRoutes.push({ routeIndex: routeIndex + 1, beforeRun, afterRun });
  }
  const report = {
    initial,
    afterDisabledLaunchClick,
    afterRight,
    afterDelete,
    afterHint,
    afterRapid,
    solvedRoutes,
    errors,
    checks: {
      launchDisabledWhenEmpty: initial.runEnabled === false && afterDisabledLaunchClick.stripCommands.length === 0,
      directionClickAddsCommand: afterRight.stripCommands.length === 1 && afterRight.stripCommands[0] === 'RIGHT' && afterRight.runEnabled === true,
      routeSlotUpdates: afterRight.stripCommands.length === afterRight.mechanic.commands.length,
      deleteRemovesExpectedCommand: afterDelete.stripCommands.length === 0 && afterDelete.deleteEnabled === false,
      hintWorks: afterHint.feedback.includes('ПОПРОБУЙ'),
      rapidTapsDoNotExceedCapacity: afterRapid.stripCommands.length === afterRapid.maxCommands,
      allThreeMapsSolvable: solvedRoutes.length === 3 && solvedRoutes[0].afterRun.mechanic.challengeIndex === 1 && solvedRoutes[1].afterRun.mechanic.challengeIndex === 2 && solvedRoutes[2].afterRun.mechanic.completed === true,
      browserClean: errorFree(errors),
    },
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ checks: report.checks, failures: Object.entries(report.checks).filter(([, pass]) => !pass).map(([name]) => name), reportPath }, null, 2));
  await browser.close();
  if (Object.values(report.checks).some((pass) => !pass)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });