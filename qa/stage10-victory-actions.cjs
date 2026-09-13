const { chromium } = require('playwright');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const center = (bounds) => ({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });

function qaUrl(stage) {
  const url = new URL(baseUrl);
  url.searchParams.set('qaMission', '10');
  url.searchParams.set('stage', stage);
  return url.toString();
}

async function control(page, sceneKey, name) {
  return page.evaluate(({ sceneKey, name }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const item = scene.children.getByName(name);
    const bounds = item?.getBounds?.();
    return { enabled: Boolean(item?.input?.enabled), text: item?.list?.find((child) => typeof child?.text === 'string')?.text || null,
      bounds: bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null, center: item ? { x: item.x, y: item.y } : null };
  }, { sceneKey, name });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const checks = [];
  const errors = [];
  const run = async (name, action, viewport = { width: 844, height: 390 }) => {
    const context = await browser.newContext({ viewport, reducedMotion: name === 'reduced-motion' ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('console', (message) => { if (message.type() === 'error') errors.push(name + ': console: ' + message.text()); });
    page.on('pageerror', (error) => errors.push(name + ': page: ' + (error.stack || error.message)));
    page.on('requestfailed', (request) => errors.push(name + ': request: ' + request.url()));
    page.on('response', (response) => { if (response.status() >= 400) errors.push(name + ': response: ' + response.status() + ' ' + response.url()); });
    try { await action(page); } finally { await context.close(); }
  };
  try {
    await run('mute', async (page) => {
      await page.goto(qaUrl('intro'), { waitUntil: 'commit', timeout: 45000 });
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene'), null, { timeout: 90000 });
      const sound = await control(page, 'Mission10Scene', 'mission10-sound');
      if (!sound.bounds) throw new Error('Mission 10 sound control missing');
      checks.push({ name: 'mission10-sound-control-present', ok: Boolean(sound.enabled && sound.bounds && sound.center), state: sound });
    });
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1600, height: 900 },
      { width: 844, height: 390 },
      { width: 915, height: 412 },
    ]) {
      await run(`cta-contract-${viewport.width}x${viewport.height}`, async (page) => {
        await page.goto(qaUrl('final'), { waitUntil: 'commit', timeout: 45000 });
        await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('VictoryScene'), null, { timeout: 90000 });
        const contract = await page.evaluate(() => {
          const scene = window.__ROBOTLAB_GAME__.scene.getScene('VictoryScene');
          const controls = scene.children.list.filter((item) => item?.type === 'Container' && item?.input?.enabled);
          const textOf = (item) => item?.list?.find((child) => typeof child?.text === 'string')?.text || '';
          const contentCtas = controls.filter((item) => item.getData?.('victoryContentCta') === true);
          const localHomes = controls.filter((item) => item.name !== 'victory-global-home' && /ДОМОЙ|Домой/.test(textOf(item)));
          const globalHome = scene.children.getByName('victory-global-home');
          const playAgain = scene.children.getByName('victory-play-again');
          const playAgainBounds = playAgain?.getBounds?.();
          return {
            contentCtaCount: contentCtas.length,
            contentLabels: contentCtas.map(textOf),
            localHomeCount: localHomes.length,
            homePresent: localHomes.length > 0,
            playAgainCentered: Boolean(playAgainBounds) && Math.abs((playAgainBounds.x + playAgainBounds.width / 2) - scene.scale.width / 2) <= 2,
          };
        });
        checks.push({
          name: `victory-cta-contract-${viewport.width}x${viewport.height}`,
          ok: contract.contentCtaCount === 1 && contract.contentLabels[0] === 'ИГРАТЬ ЕЩЁ РАЗ' &&
            contract.localHomeCount === 0 && !contract.homePresent && contract.playAgainCentered,
          contract,
        });
      }, viewport);
    }
    await run('play-again', async (page) => {
      await page.goto(qaUrl('final'), { waitUntil: 'commit', timeout: 45000 });
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('VictoryScene'), null, { timeout: 90000 });
      const button = await control(page, 'VictoryScene', 'victory-play-again');
      if (!button.enabled || !button.bounds || button.text !== 'ИГРАТЬ ЕЩЁ РАЗ') throw new Error('victory-play-again missing');
      await page.mouse.click(center(button.bounds).x, center(button.bounds).y);
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('GameScene'), null, { timeout: 10000 });
      const state = await page.evaluate(() => ({ active: window.__ROBOTLAB_GAME__.scene.isActive('GameScene'),
        currentTask: window.__ROBOTLAB_QA__.sessionState.snapshot.currentTask,
        completedTasks: window.__ROBOTLAB_QA__.sessionState.snapshot.completedTasks }));
      checks.push({ name: 'victory-play-again', ok: state.active && state.currentTask === 1 && state.completedTasks === 0, state });
    });
    await run('reduced-motion', async (page) => {
      const started = Date.now();
      await page.goto(qaUrl('final'), { waitUntil: 'commit', timeout: 45000 });
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('VictoryScene'), null, { timeout: 90000 });
      checks.push({ name: 'reduced-motion-finale-completes', ok: Date.now() - started < 10000, elapsedMs: Date.now() - started });
    });
  } finally { await browser.close(); }
  const ok = checks.every((check) => check.ok) && errors.length === 0;
  process.stdout.write(JSON.stringify({ result: ok ? 'PASS' : 'FAIL', checks, errors }) + '\n');
  if (!ok) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
