const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4207/';
const viewports = [
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['desktop-1280x720', 1280, 720, false],
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
    const target = scene.children.getByName(name)
      || scene.children.list.find((item) => item.list?.some((child) => child.text === name));
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function enterGame(page, touch) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const point = await pointFor(page, 'Играть');
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
}

async function actorSnapshot(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors').getByName('grounded-robot');
    const arm = actor.armRight;
    const base = arm.getData('baseTransform');
    return {
      state: actor.getData('animationState'),
      actor: { x: actor.x, y: actor.y, scale: actor.scaleX, angle: actor.angle },
      arm: {
        name: arm.name,
        texture: arm.texture.key,
        x: arm.x,
        y: arm.y,
        angle: arm.angle,
        scaleX: arm.scaleX,
        scaleY: arm.scaleY,
        base,
      },
    };
  });
}

async function restoreAndCheck(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors').getByName('grounded-robot');
    actor.restoreBaseTransforms();
    const partsRestored = actor.list.every((part) => {
      const base = part.getData('baseTransform');
      return Math.abs(part.x - base.x) < 0.001
        && Math.abs(part.y - base.y) < 0.001
        && Math.abs(part.rotation - base.rotation) < 0.001
        && Math.abs(part.scaleX - base.scaleX) < 0.001
        && Math.abs(part.scaleY - base.scaleY) < 0.001;
    });
    return partsRestored
      && actor.x === 640
      && actor.y === 560
      && actor.angle === 0
      && Math.abs(actor.scaleX - 0.2520718) < 1e-9;
  });
}

async function captureReaction(page, viewportName, method, state, waitMs) {
  await page.evaluate(({ method }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors').getByName('grounded-robot');
    actor[method]();
  }, { method });
  await page.waitForFunction((expected) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    return scene.children.getByName('logical-actors').getByName('grounded-robot').getData('animationState') === expected;
  }, state);
  await sleep(waitMs);
  const snapshot = await actorSnapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage5-1b-${viewportName}-${state.toLowerCase()}.png`) });
  return snapshot;
}

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, touch);
  await sleep(180);

  const idle = await actorSnapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage5-1b-${name}-idle.png`) });

  const correct = await captureReaction(page, name, 'playCorrect', 'CORRECT', 90);
  await sleep(650);
  const correctRestored = await restoreAndCheck(page);
  const hint = await captureReaction(page, name, 'playHint', 'HINT', 100);
  await sleep(580);
  const hintRestored = await restoreAndCheck(page);
  const wrong = await captureReaction(page, name, 'playWrong', 'WRONG', 100);
  await sleep(420);
  const wrongRestored = await restoreAndCheck(page);

  const checks = {
    targetArm: idle.arm.name === 'robot-armRight' && idle.arm.texture === 'robot-part-arm-right',
    friendlyBaseAngle: Math.abs(idle.arm.base.rotation * 180 / Math.PI - 122) < 0.001,
    idle: idle.state === 'IDLE' && idle.arm.angle >= 121.9 && idle.arm.angle <= 124.3,
    correct: correct.state === 'CORRECT' && correct.arm.angle > idle.arm.base.rotation * 180 / Math.PI,
    hint: hint.state === 'HINT' && hint.arm.angle < idle.arm.base.rotation * 180 / Math.PI,
    wrong: wrong.state === 'WRONG',
    baseRestoration: correctRestored && hintRestored && wrongRestored,
    grounding: idle.actor.x === 640 && idle.actor.y === 560
      && idle.actor.angle === 0 && Math.abs(idle.actor.scale - 0.2520718) < 1e-9,
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };

  await context.close();
  return { name, width, height, checks, errors, states: { idle, correct, hint, wrong } };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const viewportsResults = [];
  for (const viewport of viewports) viewportsResults.push(await runViewport(browser, viewport));
  await browser.close();
  const failures = viewportsResults.flatMap((entry) => Object.entries(entry.checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `${entry.name}:${check}`));
  const report = { viewports: viewportsResults, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-1b-friendly-arm-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ viewports: viewportsResults.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
