const { chromium } = require('playwright');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://192.168.0.107:4198/';

async function tapNamed(page, sceneName, name) {
  const point = await page.evaluate(({ sceneName, name }) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(sceneName);
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const item = scene.children.list.flatMap(walk).find((candidate) => candidate?.name === name && candidate.visible);
    if (!item) throw new Error(`Missing ${sceneName}:${name}`);
    const world = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + world.x * canvas.width / game.scale.width, y: canvas.y + world.y * canvas.height / game.scale.height };
  }, { sceneName, name });
  await page.touchscreen.tap(point.x, point.y);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'), undefined, { timeout: 60000 });
  await tapNamed(page, 'StartScene', 'start-play-button');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('GameScene'));
  await tapNamed(page, 'GameScene', 'choice-odd-ball');
  await page.waitForFunction(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene')?.children.getByName('task-card');
    return card?.list.some((item) => typeof item.text === 'string' && item.text.startsWith('ЗАДАНИЕ 2/'));
  }, undefined, { timeout: 8000 });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(600);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', 'stage8-4c-production-lan-smoke.png') });
  const result = await page.evaluate(() => ({
    activeScene: window.__ROBOTLAB_GAME__.scene.getScenes(true).at(-1)?.scene.key,
    viewport: { width: window.__ROBOTLAB_GAME__.scale.width, height: window.__ROBOTLAB_GAME__.scale.height },
    hasViteClient: [...document.scripts].some((script) => script.src.includes('/@vite/client')),
  }));
  const report = { status: response?.status(), result, errors, failedRequests, checks: {
    httpOk: response?.status() === 200,
    gameActive: result.activeScene === 'GameScene',
    portraitRestored: result.viewport.width === 390 && result.viewport.height === 844,
    productionWithoutHmr: !result.hasViteClient,
    browserClean: errors.length === 0 && failedRequests.length === 0,
  } };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (Object.values(report.checks).some((value) => !value)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
