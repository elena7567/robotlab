const { chromium } = require('playwright');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const center = (bounds) => ({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
  page.on('pageerror', (error) => errors.push('page: ' + (error.stack || error.message)));
  page.on('requestfailed', (request) => errors.push('request: ' + request.url()));
  page.on('response', (response) => { if (response.status() >= 400) errors.push('response: ' + response.status() + ' ' + response.url()); });
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('qaMission', '9');
    url.searchParams.set('stage', 'power');
    await page.goto(url.toString(), { waitUntil: 'commit', timeout: 45000 });
    await page.waitForFunction(() => Boolean(window.__ROBOTLAB_GAME__), null, { timeout: 90000 });
    try {
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.registry.get('mission9PuzzleContract')?.stage === 'POWER', null, { timeout: 15000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        href: location.href,
        contract: window.__ROBOTLAB_GAME__?.registry.get('mission9PuzzleContract') || null,
        scenes: window.__ROBOTLAB_GAME__?.scene.getScenes(false).map((scene) => ({ key: scene.sys.settings.key, active: scene.sys.isActive() })) || [],
      }));
      throw new Error('Mission 9 POWER did not initialize: ' + JSON.stringify({ diagnostic, errors, cause: error.message }));
    }
    const targets = await page.evaluate(() => {
      const game = window.__ROBOTLAB_GAME__;
      const scene = game.scene.getScene('Mission9Scene');
      const contract = game.registry.get('mission9PuzzleContract');
      const all = [];
      const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
      scene.children.list.forEach(walk);
      const serial = (item) => {
        const bounds = item?.getBounds?.();
        return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null;
      };
      return {
        candidate: serial(all.find((item) => item?.getData?.('candidateId') === contract.correctCandidateId)),
        target: serial(all.find((item) => item?.getData?.('targetId') === contract.targetId)),
      };
    });
    if (!targets.candidate || !targets.target) throw new Error('Mission 9 POWER semantic targets missing');
    await page.mouse.click(center(targets.candidate).x, center(targets.candidate).y);
    await page.mouse.click(center(targets.target).x, center(targets.target).y);
    await page.waitForFunction(() => Boolean(window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-continue-mission10')), null, { timeout: 10000 });
    const button = await page.evaluate(() => {
      const control = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-continue-mission10');
      const bounds = control?.getBounds?.();
      return { text: control?.list?.find((item) => typeof item?.text === 'string')?.text || null,
        enabled: Boolean(control?.input?.enabled), bounds: bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null, center: control ? { x: control.x, y: control.y } : null };
    });
    if (!button.enabled || !button.bounds || !button.center || button.text !== 'К МАЯКУ') throw new Error('Mission 9 handoff control invalid: ' + JSON.stringify(button));
    await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-continue-mission10').emit('pointerdown'));
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission10Scene')
      && window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage === 'INTRO', null, { timeout: 10000 });
    const final = await page.evaluate(() => ({
      mission9Active: window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'),
      mission10Active: window.__ROBOTLAB_GAME__.scene.isActive('Mission10Scene'),
      stage: window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage,
      currentTask: window.__ROBOTLAB_QA__.sessionState.snapshot.currentTask,
    }));
    const ok = errors.length === 0 && !final.mission9Active && final.mission10Active && final.stage === 'INTRO' && final.currentTask === 10;
    process.stdout.write(JSON.stringify({ result: ok ? 'PASS' : 'FAIL', button, final, errors }) + '\n');
    if (!ok) process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
