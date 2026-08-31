const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const reportPath = path.join('docs', 'qa', 'stage8-3k-next-after-rotation.json');
const screenshotDir = path.join('docs', 'qa', 'screenshots');

async function waitForTask(page, number) {
  await page.waitForFunction((expected) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game?.scene.getScene('GameScene');
    const card = scene?.children.getByName('task-card');
    return scene?.sys.isActive() && card?.list.some((item) => typeof item.text === 'string'
      && (item.text.startsWith(`ЗАДАНИЕ ${expected} ИЗ`) || item.text.startsWith(`ЗАДАНИЕ ${expected}/`)));
  }, number, { timeout: 10000 });
}

async function tapNamed(page, name) {
  const point = await page.evaluate((targetName) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const item = card.list.find((child) => child.name === targetName);
    const world = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return {
      x: canvas.x + world.x * canvas.width / game.scale.width,
      y: canvas.y + world.y * canvas.height / game.scale.height,
    };
  }, name);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(120);
}

async function completeTaskOne(page) {
  await tapNamed(page, 'choice-odd-ball');
  await tapNamed(page, 'check-button');
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    return scene.children.getByName('task-card')?.list.find((item) => item.name === 'continue-button')?.visible;
  });
}

async function rotate(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForFunction(({ width, height }) => {
    const game = window.__ROBOTLAB_GAME__;
    const commit = game?.registry.get('committedViewport');
    const canvas = game?.canvas.getBoundingClientRect();
    return commit?.viewport.innerWidth === width && commit?.viewport.innerHeight === height
      && Math.round(canvas?.width) === width && Math.round(canvas?.height) === height
      && game.scene.isActive('GameScene');
  }, { width, height }, { timeout: 10000 });
  await page.waitForTimeout(220);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const next = card?.list.find((item) => item.name === 'continue-button');
    const ribbon = card?.list.find((item) => typeof item.text === 'string' && item.text.startsWith('ЗАДАНИЕ'));
    const canvas = game.canvas.getBoundingClientRect();
    return {
      ribbon: ribbon?.text ?? '',
      nextVisible: next?.visible ?? false,
      nextActive: next?.active ?? false,
      nextEnabled: next?.getData('control-runtime')?.enabled ?? false,
      canvas: { width: canvas.width, height: canvas.height },
      game: { width: game.scale.width, height: game.scale.height },
      inputScale: { x: game.scale.displayScale.x, y: game.scale.displayScale.y },
    };
  });
}

async function runCase(browser, name, completeBeforeRotation) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const play = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const item = game.scene.getScene('StartScene').children.getByName('start-play-button');
    const world = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + world.x * canvas.width / game.scale.width, y: canvas.y + world.y * canvas.height / game.scale.height };
  });
  await page.touchscreen.tap(play.x, play.y);
  await waitForTask(page, 1);
  if (completeBeforeRotation) await completeTaskOne(page);
  await rotate(page, 412, 180);
  if (!completeBeforeRotation) await completeTaskOne(page);
  const before = await inspect(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage8-3k-${name}-before-next.png`) });
  await tapNamed(page, 'continue-button');
  let transitioned = true;
  try { await waitForTask(page, 2); } catch { transitioned = false; }
  const after = await inspect(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage8-3k-${name}-after-next.png`) });
  await context.close();
  return {
    name,
    before,
    after,
    errors,
    checks: {
      nextWasActionable: before.nextVisible && before.nextActive && before.nextEnabled,
      transitionedToTaskTwo: transitioned && after.ribbon.startsWith('ЗАДАНИЕ 2/'),
      browserClean: errors.length === 0,
    },
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const cases = [
    await runCase(browser, 'complete-then-rotate', true),
    await runCase(browser, 'rotate-then-complete', false),
  ];
  await browser.close();
  const failures = cases.flatMap((entry) => Object.entries(entry.checks)
    .filter(([, passed]) => !passed).map(([check]) => `${entry.name}:${check}`));
  fs.writeFileSync(reportPath, JSON.stringify({ cases, failures }, null, 2));
  process.stdout.write(JSON.stringify({ cases: cases.map(({ name, before, after, checks }) => ({ name, before, after, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
