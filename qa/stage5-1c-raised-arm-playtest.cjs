const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4210/';
const viewports = [
  ['minimum-320x568', 320, 568, true],
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['landscape-844x390', 844, 390, true],
  ['desktop-1280x720', 1280, 720, false],
  ['desktop-1920x1080', 1920, 1080, false],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function attachErrorCapture(page) {
  const errors = { console: [], page: [], requests: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  return errors;
}

async function pointFor(page, name, sceneKey = 'StartScene') {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const card = sceneKey === 'GameScene' ? scene.children.getByName('task-card') : undefined;
    const target = card?.getByName(name)
      || card?.list.find((item) => item.list?.some((child) => child.text === name))
      || scene.children.getByName(name)
      || scene.children.list.find((item) => item.list?.some((child) => child.text === name));
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, touch, sceneKey = 'GameScene') {
  const point = await pointFor(page, name, sceneKey);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(90);
}

async function enterGame(page, touch) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await activate(page, 'Играть', touch, 'StartScene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  await sleep(120);
}

async function actorSnapshot(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors').getByName('grounded-robot');
    const lowered = actor.armLeft;
    const raised = actor.armWaveLeft;
    const raisedBounds = raised.getBounds();
    return {
      animationState: actor.getData('animationState'),
      armState: actor.getData('armState'),
      actor: { x: actor.x, y: actor.y, scale: actor.scaleX, angle: actor.angle },
      lowered: { texture: lowered.texture.key, x: lowered.x, y: lowered.y, angle: lowered.angle, alpha: lowered.alpha },
      raised: {
        texture: raised.texture.key, x: raised.x, y: raised.y, angle: raised.angle, alpha: raised.alpha,
        bounds: { x: raisedBounds.x, y: raisedBounds.y, width: raisedBounds.width, height: raisedBounds.height },
      },
    };
  });
}

function grounded(snapshot) {
  return snapshot.actor.x === 640 && snapshot.actor.y === 560
    && snapshot.actor.angle === 0 && Math.abs(snapshot.actor.scale - 0.2520718) < 1e-9;
}

function lowered(snapshot) {
  return snapshot.armState === 'LOWERED' && snapshot.lowered.alpha > 0.999 && snapshot.raised.alpha < 0.001
    && snapshot.lowered.x === 236 && snapshot.lowered.y === -733
    && snapshot.raised.x === 236 && snapshot.raised.y === -733;
}

function raised(snapshot) {
  return snapshot.armState === 'RAISED' && snapshot.raised.alpha > 0.95 && snapshot.lowered.alpha < 0.05;
}

async function play(page, method, sampleMs, finishMs, screenshotPath) {
  await page.evaluate((methodName) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors').getByName('grounded-robot');
    actor[methodName]();
  }, method);
  await sleep(sampleMs);
  const active = await actorSnapshot(page);
  if (screenshotPath) await page.screenshot({ path: screenshotPath });
  await sleep(finishMs);
  const finished = await actorSnapshot(page);
  return { active, finished };
}

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, touch);
  const idle = await actorSnapshot(page);
  const correct = await play(page, 'playCorrect', 360, 720,
    path.join('docs', 'qa', 'screenshots', `stage5-1c-${name}-raised.png`));
  const wrong = await play(page, 'playWrong', 120, 420);
  const hint = await play(page, 'playHint', 290, 560);
  const celebrate = await play(page, 'playCelebrate', 380, 850);

  const checks = {
    assets: idle.lowered.texture === 'robot-part-arm-left' && idle.raised.texture === 'robot-part-arm-wave-left',
    idleLowered: lowered(idle),
    correctRaised: correct.active.animationState === 'CORRECT' && raised(correct.active),
    correctRestored: lowered(correct.finished),
    wrongLowered: wrong.active.animationState === 'WRONG' && lowered(wrong.active) && lowered(wrong.finished),
    hintRaised: hint.active.animationState === 'HINT' && raised(hint.active),
    hintRestored: lowered(hint.finished),
    celebrateRaised: celebrate.active.animationState === 'CELEBRATE' && raised(celebrate.active),
    celebrateRestored: lowered(celebrate.finished),
    grounding: [idle, correct.active, correct.finished, wrong.active, wrong.finished, hint.active, hint.finished,
      celebrate.active, celebrate.finished].every(grounded),
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { name, width, height, checks, errors, states: { idle, correct, wrong, hint, celebrate } };
}

async function runSafety(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, false);

  await page.evaluate(() => {
    const actor = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children
      .getByName('logical-actors').getByName('grounded-robot');
    actor.playCorrect();
  });
  await sleep(230);
  await page.evaluate(() => {
    const actor = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children
      .getByName('logical-actors').getByName('grounded-robot');
    actor.playCorrect();
  });
  await sleep(1100);
  const duplicateFinished = await actorSnapshot(page);

  await page.evaluate(() => {
    const actor = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children
      .getByName('logical-actors').getByName('grounded-robot');
    actor.playCelebrate();
  });
  await sleep(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('GameScene'));
  await sleep(400);
  const resized = await actorSnapshot(page);

  await sleep(9600);
  const idleTenSeconds = await actorSnapshot(page);
  const checks = {
    duplicateRestores: lowered(duplicateFinished) && grounded(duplicateFinished),
    resizeRestores: lowered(resized) && grounded(resized),
    idleTenSeconds: lowered(idleTenSeconds) && grounded(idleTenSeconds),
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { checks, errors, states: { duplicateFinished, resized, idleTenSeconds } };
}

async function runGameplay(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, true);

  await activate(page, 'Подсказка', true);
  await sleep(230);
  const hint = await actorSnapshot(page);
  await sleep(600);
  await activate(page, 'choice-odd-apple', true);
  await activate(page, 'check-button', true);
  const wrong = await actorSnapshot(page);
  await sleep(520);
  await activate(page, 'choice-odd-ball', true);
  await activate(page, 'check-button', true);
  await sleep(280);
  const correct = await actorSnapshot(page);
  await sleep(3600);
  const finished = await actorSnapshot(page);

  const checks = {
    hintIntegrated: hint.animationState === 'HINT' && raised(hint),
    wrongIntegrated: wrong.animationState === 'WRONG' && lowered(wrong),
    correctIntegrated: ['CORRECT', 'CELEBRATE'].includes(correct.animationState) && raised(correct),
    completionRestores: lowered(finished) && grounded(finished),
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { checks, errors, states: { hint, wrong, correct, finished } };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const matrix = [];
  for (const viewport of viewports) matrix.push(await runViewport(browser, viewport));
  const safety = await runSafety(browser);
  const gameplay = await runGameplay(browser);
  await browser.close();
  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, value]) => !value).map(([key]) => `${entry.name}:${key}`)),
    ...Object.entries(safety.checks).filter(([, value]) => !value).map(([key]) => `safety:${key}`),
    ...Object.entries(gameplay.checks).filter(([, value]) => !value).map(([key]) => `gameplay:${key}`),
  ];
  const report = { matrix, safety, gameplay, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-1c-raised-arm-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ matrix: matrix.map(({ name, checks }) => ({ name, checks })), safety: safety.checks,
    gameplay: gameplay.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
