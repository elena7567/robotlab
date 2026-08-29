const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4212/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['desktop-1280x720', 1280, 720, false],
];

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
  await page.waitForTimeout(150);
}

async function snapshot(page, withDebugMarkers = false) {
  return page.evaluate((drawDebug) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors').getByName('grounded-robot');
    scene.tweens.pauseAll();
    actor.restoreBaseTransforms();

    const toWorld = (point) => actor.getWorldTransformMatrix().transformPoint(point.x, point.y);
    const leftSocketLocal = actor.getData('bodyShoulderLeftAnchor');
    const rightSocketLocal = actor.getData('bodyShoulderRightAnchor');
    const leftRootLocal = { x: actor.armRight.x, y: actor.armRight.y };
    const rightRootLocal = { x: actor.armLeft.x, y: actor.armLeft.y };
    const leftSocket = toWorld(leftSocketLocal);
    const rightSocket = toWorld(rightSocketLocal);
    const leftRoot = toWorld(leftRootLocal);
    const rightRoot = toWorld(rightRootLocal);

    if (drawDebug) {
      const graphics = scene.add.graphics().setDepth(10000).setName('stage5-1h-debug-markers');
      const marker = (socket, root) => {
        graphics.lineStyle(2, 0xff2957, 1).strokeCircle(socket.x, socket.y, 7);
        graphics.lineStyle(2, 0x21e6ff, 1).strokeCircle(root.x, root.y, 3);
      };
      marker(leftSocket, leftRoot);
      marker(rightSocket, rightRoot);
    }

    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    return {
      local: {
        leftSocket: leftSocketLocal,
        rightSocket: rightSocketLocal,
        leftRoot: leftRootLocal,
        rightRoot: rightRootLocal,
      },
      world: { leftSocket, rightSocket, leftRoot, rightRoot },
      distances: {
        left: distance(leftSocket, leftRoot),
        right: distance(rightSocket, rightRoot),
      },
      textures: {
        screenLeft: actor.armRight.texture.key,
        screenRight: actor.armLeft.texture.key,
        waveLoaded: scene.textures.exists('robot-part-arm-wave-left'),
      },
      origins: {
        screenLeft: [actor.armRight.originX, actor.armRight.originY],
        screenRight: [actor.armLeft.originX, actor.armLeft.originY],
      },
    };
  }, withDebugMarkers);
}

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, touch);

  const state = await snapshot(page, true);
  await page.screenshot({ path: path.join(screenshotDir, `stage5-1h-${name}-debug.png`) });
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children
    .getByName('stage5-1h-debug-markers')?.destroy());
  await page.screenshot({ path: path.join(screenshotDir, `stage5-1h-${name}.png`) });

  if (name === 'desktop-1280x720') {
    await page.screenshot({
      path: path.join(screenshotDir, 'stage5-1h-desktop-1280x720-torso-shoulders-close-up.png'),
      clip: { x: 490, y: 330, width: 300, height: 190 },
    });
  }

  const checks = {
    leftSocketAlignment: state.distances.left < 0.001,
    rightSocketAlignment: state.distances.right < 0.001,
    matchingAttachmentHeight: Math.abs(state.world.leftRoot.y - state.world.rightRoot.y) < 0.001,
    approvedArmTextures: state.textures.screenLeft === 'robot-part-arm-right'
      && state.textures.screenRight === 'robot-part-arm-left' && !state.textures.waveLoaded,
    shoulderRootOrigins: Math.abs(state.origins.screenLeft[0] - 1006 / 1254) < 1e-9
      && Math.abs(state.origins.screenLeft[1] - 183 / 1254) < 1e-9
      && Math.abs(state.origins.screenRight[0] - 277 / 1254) < 1e-9
      && Math.abs(state.origins.screenRight[1] - 183 / 1254) < 1e-9,
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };

  await context.close();
  return { name, width, height, checks, errors, state };
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
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-1h-shoulder-socket-alignment-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ matrix: matrix.map(({ name, checks, state }) => ({ name, checks, state })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
