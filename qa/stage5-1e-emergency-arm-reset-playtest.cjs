const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4210/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['desktop-1280x720', 1280, 720, false],
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
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

async function enterGame(page, touch) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const point = await pointFor(page, 'Играть');
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
        angle: item.angle,
        scaleX: item.scaleX,
        scaleY: item.scaleY,
        alpha: item.alpha,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      };
    };
    return {
      animationState: actor.getData('animationState'),
      actor: { x: actor.x, y: actor.y, scaleX: actor.scaleX, scaleY: actor.scaleY, angle: actor.angle },
      screenLeftArm: part(actor.armRight),
      screenRightArm: part(actor.armLeft),
      head: part(actor.head),
      body: part(actor.bodyPart),
      antenna: part(actor.antenna),
      runtimePartNames: actor.list.map((item) => item.name),
      hasWaveProperty: 'armWaveLeft' in actor,
      waveTextureLoaded: scene.textures.exists('robot-part-arm-wave-left'),
    };
  });
}

async function invoke(page, method) {
  await page.evaluate((methodName) => {
    const actor = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children
      .getByName('logical-actors').getByName('grounded-robot');
    actor[methodName]();
  }, method);
}

function exactArmMapping(state) {
  return state.screenLeftArm.name === 'robot-armRight'
    && state.screenLeftArm.texture === 'robot-part-arm-right'
    && state.screenLeftArm.x === -236 && state.screenLeftArm.y === -733
    && Math.abs(state.screenLeftArm.angle - 4) < 0.01 && state.screenLeftArm.alpha === 1
    && state.screenRightArm.name === 'robot-armLeft'
    && state.screenRightArm.texture === 'robot-part-arm-left'
    && state.screenRightArm.x === 236 && state.screenRightArm.y === -733
    && Math.abs(state.screenRightArm.angle + 4) < 0.01 && state.screenRightArm.alpha === 1;
}

function sameArmTransforms(a, b) {
  const same = (left, right) => ['x', 'y', 'angle', 'scaleX', 'scaleY', 'alpha']
    .every((key) => Math.abs(left[key] - right[key]) < 1e-9);
  return same(a.screenLeftArm, b.screenLeftArm) && same(a.screenRightArm, b.screenRightArm);
}

function grounded(state) {
  return state.actor.x === 640 && state.actor.y === 560 && state.actor.angle === 0
    && Math.abs(state.actor.scaleX - 0.2520718) < 1e-9
    && Math.abs(state.actor.scaleY - 0.2520718) < 1e-9;
}

function insideViewport(arm, width, height) {
  const b = arm.bounds;
  return b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height;
}

async function runReaction(page, baseline, method, sampleMs, finishMs) {
  await invoke(page, method);
  await sleep(sampleMs);
  const active = await snapshot(page);
  await sleep(finishMs);
  const finished = await snapshot(page);
  return {
    active,
    finished,
    armsStable: sameArmTransforms(baseline, active) && sameArmTransforms(baseline, finished),
    restored: exactArmMapping(finished) && grounded(finished),
  };
}

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, touch);

  const idle = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage5-1e-${name}-idle.png`) });
  await sleep(2400);
  const idleLater = await snapshot(page);

  const correct = await runReaction(page, idle, 'playCorrect', 150, 560);
  const wrong = await runReaction(page, idle, 'playWrong', 130, 400);
  const hint = await runReaction(page, idle, 'playHint', 170, 450);
  const celebrate = await runReaction(page, idle, 'playCelebrate', 180, 700);

  const noRaisedRuntime = !idle.hasWaveProperty && !idle.waveTextureLoaded
    && !idle.runtimePartNames.includes('robot-armWaveLeft') && idle.runtimePartNames.length === 7;
  const checks = {
    exactMapping: exactArmMapping(idle),
    raisedArmInactive: noRaisedRuntime,
    idleArmsStable: sameArmTransforms(idle, idleLater),
    correctArmsStable: correct.armsStable && correct.restored && correct.active.animationState === 'CORRECT'
      && (correct.active.actor.y < 560 || correct.active.actor.scaleX > 0.2520718),
    wrongArmsStable: wrong.armsStable && wrong.restored && wrong.active.animationState === 'WRONG'
      && (Math.abs(wrong.active.head.angle) > 0.5 || Math.abs(wrong.active.body.angle) > 0.5),
    hintArmsStable: hint.armsStable && hint.restored && hint.active.animationState === 'HINT'
      && Math.abs(hint.active.head.angle) > 0.5,
    celebrateArmsStable: celebrate.armsStable && celebrate.restored && celebrate.active.animationState === 'CELEBRATE'
      && (celebrate.active.actor.y < 560 || celebrate.active.actor.scaleX > 0.2520718),
    groundingRestored: [idle, idleLater, correct.finished, wrong.finished, hint.finished, celebrate.finished].every(grounded),
    armsInsideViewport: insideViewport(idle.screenLeftArm, width, height) && insideViewport(idle.screenRightArm, width, height),
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };

  await context.close();
  return { name, width, height, checks, errors, states: { idle, idleLater, correct, wrong, hint, celebrate } };
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
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-1e-emergency-arm-reset-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({
    matrix: matrix.map(({ name, checks }) => ({ name, checks })),
    failures,
  }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
