const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4210/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
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

async function enterGame(page, touch) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const point = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('StartScene');
    const target = scene.children.list.find((item) => item.list?.some((child) => child.text === 'Играть'));
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  });
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  await sleep(120);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors').getByName('grounded-robot');
    const part = (item) => {
      const bounds = item.getBounds();
      return {
        name: item.name,
        texture: item.texture.key,
        x: item.x,
        y: item.y,
        rotation: item.angle,
        origin: [item.originX, item.originY],
        scale: [item.scaleX, item.scaleY],
        alpha: item.alpha,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      };
    };
    return {
      animationState: actor.getData('animationState'),
      actor: { x: actor.x, y: actor.y, scale: actor.scaleX, angle: actor.angle },
      screenLeftArm: part(actor.armRight),
      screenRightArm: part(actor.armLeft),
      runtimePartNames: actor.list.map((item) => item.name),
      hasWaveProperty: 'armWaveLeft' in actor,
      waveTextureLoaded: scene.textures.exists('robot-part-arm-wave-left'),
    };
  });
}

async function perturbArms(page) {
  await page.evaluate(() => {
    const actor = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children
      .getByName('logical-actors').getByName('grounded-robot');
    actor.armRight.setPosition(-310, -610).setOrigin(0.5).setScale(0.55).setAngle(45).setAlpha(0.4);
    actor.armLeft.setPosition(310, -610).setOrigin(0.5).setScale(0.55).setAngle(-45).setAlpha(0.4);
  });
}

async function invoke(page, method) {
  await page.evaluate((methodName) => {
    const actor = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children
      .getByName('logical-actors').getByName('grounded-robot');
    actor[methodName]();
  }, method);
}

function canonical(state) {
  const left = state.screenLeftArm;
  const right = state.screenRightArm;
  return left.name === 'robot-armRight' && left.texture === 'robot-part-arm-right'
    && left.x === -220 && left.y === -765 && Math.abs(left.rotation - 4) < 0.01
    && left.origin[0] === 0.76 && left.origin[1] === 0.08
    && left.scale[0] === 0.4 && left.scale[1] === 0.4 && left.alpha === 1
    && right.name === 'robot-armLeft' && right.texture === 'robot-part-arm-left'
    && right.x === 220 && right.y === -765 && Math.abs(right.rotation + 4) < 0.01
    && right.origin[0] === 0.239 && right.origin[1] === 0.08
    && right.scale[0] === 0.4 && right.scale[1] === 0.4 && right.alpha === 1;
}

function grounded(state) {
  return state.actor.x === 640 && state.actor.y === 560 && state.actor.angle === 0
    && Math.abs(state.actor.scale - 0.2520718) < 1e-9;
}

function inViewport(arm, width, height) {
  const bounds = arm.bounds;
  return bounds.x >= 0 && bounds.y >= 0
    && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height;
}

async function verifyReset(page, method, activeWait, finishWait) {
  await perturbArms(page);
  await invoke(page, method);
  await sleep(activeWait);
  const active = await snapshot(page);
  await sleep(finishWait);
  const finished = await snapshot(page);
  return { active, finished, pass: canonical(active) && canonical(finished) && grounded(finished) };
}

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, touch);

  const initial = await snapshot(page);
  await perturbArms(page);
  await invoke(page, 'playIdle');
  await sleep(80);
  const idleReset = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage5-1f-${name}-resting.png`) });

  const wrong = await verifyReset(page, 'playWrong', 120, 420);
  const correct = await verifyReset(page, 'playCorrect', 150, 560);
  const hint = await verifyReset(page, 'playHint', 160, 450);
  const celebrate = await verifyReset(page, 'playCelebrate', 180, 700);

  const checks = {
    canonicalInitial: canonical(initial),
    idleReset: canonical(idleReset) && grounded(idleReset),
    wrongReset: wrong.pass && wrong.active.animationState === 'WRONG',
    correctReset: correct.pass && correct.active.animationState === 'CORRECT',
    hintReset: hint.pass && hint.active.animationState === 'HINT',
    celebrateReset: celebrate.pass && celebrate.active.animationState === 'CELEBRATE',
    noRaisedRuntime: !initial.hasWaveProperty && !initial.waveTextureLoaded
      && !initial.runtimePartNames.includes('robot-armWaveLeft'),
    viewportContainment: inViewport(idleReset.screenLeftArm, width, height)
      && inViewport(idleReset.screenRightArm, width, height),
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };

  await context.close();
  return { name, width, height, checks, errors, states: { initial, idleReset, wrong, correct, hint, celebrate } };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const matrix = [];
  for (const viewport of viewports) matrix.push(await runViewport(browser, viewport));
  await browser.close();

  const failures = matrix.flatMap((entry) => Object.entries(entry.checks)
    .filter(([, passed]) => !passed).map(([check]) => `${entry.name}:${check}`));
  const report = { matrix, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-1f-lowered-arm-placement-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ matrix: matrix.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
