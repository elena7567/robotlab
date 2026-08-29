const { chromium } = require('playwright');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pointFor(page, name, sceneKey) {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const find = (item) => {
      if (item?.name === name || item?.text === name) return item;
      for (const child of item?.list || []) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    const target = scene.children.list.map(find).find(Boolean);
    if (!target) throw new Error(`Missing ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function click(page, name, sceneKey) {
  const point = await pointFor(page, name, sceneKey);
  await page.mouse.click(point.x, point.y);
  await sleep(100);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await click(page, 'Играть', 'StartScene');
  await click(page, 'choice-odd-ball', 'GameScene');
  await click(page, 'check-button', 'GameScene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    .children.getByName('progress-panel')?.getData('animationActive'));
  const homePoint = await pointFor(page, '⌂ Домой', 'GameScene');
  const hit = await page.evaluate(({ x, y }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    return { x, y, hit: scene.input.hitTestPointer(scene.input.activePointer).map((item) => item.name || item.type) };
  }, homePoint);
  await page.mouse.click(homePoint.x, homePoint.y);
  await sleep(900);
  const scenes = await page.evaluate(() => ({
    start: window.__ROBOTLAB_GAME__.scene.isActive('StartScene'),
    game: window.__ROBOTLAB_GAME__.scene.isActive('GameScene'),
  }));
  await browser.close();
  process.stdout.write(JSON.stringify({ hit, scenes, errors }, null, 2));
  if (!scenes.start || scenes.game || errors.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
