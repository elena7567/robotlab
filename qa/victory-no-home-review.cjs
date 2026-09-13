const { chromium } = require('playwright');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const viewports = [
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 844, height: 390 },
  { width: 915, height: 412 },
];

function url(params = {}) {
  const target = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target.toString();
}

function center(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function waitForScene(page, sceneKey) {
  await page.waitForFunction((key) => window.__ROBOTLAB_GAME__?.scene.isActive(key), sceneKey, { timeout: 90000 });
  await page.waitForTimeout(150);
}

async function sceneContract(page, sceneKey) {
  return page.evaluate((sceneKey) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(sceneKey);
    const visibleChain = (item) => {
      let node = item;
      while (node) {
        if (node.visible === false || node.alpha === 0 || node.active === false) return false;
        node = node.parentContainer;
      }
      return true;
    };
    const all = [];
    const walk = (item) => {
      all.push(item);
      if (item.list) item.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    const textOf = (item) => {
      if (typeof item.text === 'string') return item.text;
      if (item.list) return item.list.map((child) => typeof child.text === 'string' ? child.text : '').join(' ');
      return '';
    };
    const boundsOf = (item) => {
      const bounds = item?.getBounds?.();
      return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom } : null;
    };
    const containers = all.filter((item) => item.type === 'Container');
    const visibleHomes = containers.filter((item) => visibleChain(item) && /Домой|ДОМОЙ/i.test(textOf(item)));
    const interactiveHomes = containers.filter((item) => Boolean(item.input?.enabled) && /Домой|ДОМОЙ/i.test(textOf(item)));
    const playAgain = scene.children.getByName('victory-play-again');
    const primaryCtas = containers.filter((item) => visibleChain(item) && item.getData?.('victoryContentCta') === true);
    return {
      sceneKey,
      activeScene: game.registry.get('activeScene'),
      visibleHomeCount: visibleHomes.length,
      interactiveHomeCount: interactiveHomes.length,
      visibleHomeNames: visibleHomes.map((item) => item.name || null),
      interactiveHomeNames: interactiveHomes.map((item) => item.name || null),
      primaryCtaCount: primaryCtas.length,
      primaryCtaLabels: primaryCtas.map((item) => textOf(item).trim()),
      playAgainVisible: Boolean(playAgain && visibleChain(playAgain)),
      playAgainEnabled: Boolean(playAgain?.input?.enabled),
      playAgainBounds: boundsOf(playAgain),
      viewport: { width: scene.scale.width, height: scene.scale.height },
    };
  }, sceneKey);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = { result: 'PASS', checks: [], errors: [] };
  const add = (name, ok, details = {}) => {
    report.checks.push({ name, ok: Boolean(ok), details });
    if (!ok) report.result = 'FAIL';
  };

  async function withPage(label, viewport, action) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 1000, hasTouch: viewport.width < 1000 });
    const page = await context.newPage();
    page.on('console', (message) => { if (message.type() === 'error') report.errors.push(`${label}: console: ${message.text()}`); });
    page.on('pageerror', (error) => report.errors.push(`${label}: page: ${error.stack || error.message}`));
    page.on('requestfailed', (request) => report.errors.push(`${label}: request failed: ${request.url()} ${request.failure()?.errorText || ''}`));
    page.on('response', (response) => { if (response.status() >= 400) report.errors.push(`${label}: http ${response.status()} ${response.url()}`); });
    try {
      await action(page);
    } finally {
      await context.close();
    }
  }

  try {
    for (const viewport of viewports) {
      const label = `victory-${viewport.width}x${viewport.height}`;
      await withPage(label, viewport, async (page) => {
        await page.goto(url({ qaMission: '10', stage: 'final' }), { waitUntil: 'load', timeout: 90000 });
        await waitForScene(page, 'VictoryScene');
        const contract = await sceneContract(page, 'VictoryScene');
        add(`${label}-zero-visible-home`, contract.visibleHomeCount === 0, contract);
        add(`${label}-zero-interactive-home`, contract.interactiveHomeCount === 0, contract);
        add(`${label}-one-primary-cta`, contract.primaryCtaCount === 1 && contract.primaryCtaLabels[0] === 'ИГРАТЬ ЕЩЁ РАЗ', contract);
        add(`${label}-play-again-centered`, contract.playAgainVisible && contract.playAgainEnabled && Math.abs((contract.playAgainBounds.x + contract.playAgainBounds.width / 2) - viewport.width / 2) <= 2, contract);
      });
    }

    await withPage('mission10-gameplay-home', { width: 1280, height: 720 }, async (page) => {
      await page.goto(url({ qaMission: '10', stage: 'path' }), { waitUntil: 'load', timeout: 90000 });
      await waitForScene(page, 'Mission10Scene');
      const contract = await sceneContract(page, 'Mission10Scene');
      add('mission10-gameplay-home-present', contract.visibleHomeCount >= 1 && contract.interactiveHomeCount >= 1, contract);
    });

    await withPage('mission9-home', { width: 1280, height: 720 }, async (page) => {
      await page.goto(url({ qaMission: '9' }), { waitUntil: 'load', timeout: 90000 });
      await waitForScene(page, 'Mission9Scene');
      const contract = await sceneContract(page, 'Mission9Scene');
      add('mission9-home-present', contract.visibleHomeCount >= 1 && contract.interactiveHomeCount >= 1, contract);
    });

    await withPage('start-flow', { width: 1280, height: 720 }, async (page) => {
      await page.goto(url(), { waitUntil: 'load', timeout: 90000 });
      await waitForScene(page, 'StartScene');
      const startActive = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
      add('start-scene-loads', startActive, { startActive });
    });

    await withPage('play-again-reset', { width: 1280, height: 720 }, async (page) => {
      await page.goto(url({ qaMission: '10', stage: 'final' }), { waitUntil: 'load', timeout: 90000 });
      await waitForScene(page, 'VictoryScene');
      const contract = await sceneContract(page, 'VictoryScene');
      await page.mouse.click(center(contract.playAgainBounds).x, center(contract.playAgainBounds).y);
      await waitForScene(page, 'GameScene');
      const state = await page.evaluate(() => ({
        gameScene: window.__ROBOTLAB_GAME__.scene.isActive('GameScene'),
        currentTask: window.__ROBOTLAB_QA__.sessionState.snapshot.currentTask,
        completedTasks: window.__ROBOTLAB_QA__.sessionState.snapshot.completedTasks,
        mission10Stage: window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage,
        musicKeys: window.__ROBOTLAB_GAME__.sound.sounds.map((sound) => sound.key),
      }));
      add('play-again-reset-flow', state.gameScene && state.currentTask === 1 && state.completedTasks === 0 && state.mission10Stage === 'INTRO', state);
    });
  } finally {
    await browser.close();
  }

  if (report.errors.length) report.result = 'FAIL';
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.result !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });