const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const views = [['portrait', 390, 844], ['landscape', 844, 390]];
const missions = [5, 6, 7, 8];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const results = [];
  for (const [view, width, height] of views) for (const mission of missions) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
    const sceneName = mission === 5 ? 'GameScene' : `Mission${mission}Scene`;
    await page.evaluate(async ({ mission, sceneName }) => {
      const { sessionState } = await import('/src/game/state/sessionState.ts');
      sessionState.reset();
      for (let i = 1; i < mission; i += 1) sessionState.completeCurrentTask();
      window.__ROBOTLAB_GAME__.scene.start(sceneName);
    }, { mission, sceneName });
    await page.waitForFunction((name) => window.__ROBOTLAB_GAME__.scene.isActive(name), sceneName);
    await page.waitForTimeout(180);
    const audit = await page.evaluate((sceneName) => {
      const game = window.__ROBOTLAB_GAME__;
      const scene = game.scene.getScene(sceneName);
      const walk = (item) => !item || !item.visible ? [] : [item, ...(item.list || []).flatMap(walk)];
      const all = scene.children.list.flatMap(walk);
      const canvas = game.canvas.getBoundingClientRect();
      const interactive = all.filter((item) => item.input?.enabled).map((item) => ({
        name: item.name || '', width: item.input.hitArea?.width || item.width || 0, height: item.input.hitArea?.height || item.height || 0,
      }));
      const namedText = all.filter((item) => item.type === 'Text' && item.name).map((item) => ({ name: item.name, text: item.text, font: Number.parseFloat(item.style.fontSize || '0') }));
      return { canvas: { width: canvas.width, height: canvas.height }, interactive, namedText, boundsAudit: game.registry.get('boundsAudit') };
    }, sceneName);
    const file = path.join('docs', 'qa', 'screenshots', `stage8-3m-mission${mission}-${view}.png`);
    await page.screenshot({ path: file });
    const exempt = new Set(['']);
    results.push({ view, mission, file, errors, audit, checks: {
      browserClean: errors.length === 0,
      touchTargets: audit.interactive.filter((item) => !exempt.has(item.name)).every((item) => item.width >= 48 && item.height >= 48),
      keyTextReadable: audit.namedText.every((item) => item.font >= 14),
      canvasMatches: Math.round(audit.canvas.width) === width && Math.round(audit.canvas.height) === height,
    } });
    await context.close();
  }
  await browser.close();
  const failures = results.flatMap((entry) => Object.entries(entry.checks).filter(([, ok]) => !ok).map(([check]) => `${entry.view}:m${entry.mission}:${check}`));
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-3m-missions5-8.json'), JSON.stringify({ results, failures }, null, 2));
  console.log(JSON.stringify({ cases: results.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
