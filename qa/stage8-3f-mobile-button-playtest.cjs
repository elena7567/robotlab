const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const profiles = [
  { name: 'minimum-portrait', width: 320, height: 568 },
  { name: 'phone-portrait-short', width: 360, height: 600 },
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
];
const scenes = [
  { label: 'start', key: 'StartScene', mission: 0 },
  ...Array.from({ length: 5 }, (_, index) => ({ label: `mission${index + 1}`, key: 'GameScene', mission: index + 1 })),
  { label: 'transition', key: 'TransitionScene', mission: 5 },
  { label: 'mission6', key: 'Mission6Scene', mission: 6 },
  { label: 'mission7', key: 'Mission7Scene', mission: 7 },
  { label: 'mission8', key: 'Mission8Scene', mission: 8 },
];

async function bootScene(page, definition) {
  await page.evaluate(async ({ key, mission }) => {
    const game = window.__ROBOTLAB_GAME__;
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    const modules = await Promise.all([
      import('/src/game/mechanics/oddOneOut.ts'),
      import('/src/game/mechanics/sequence.ts'),
      import('/src/game/mechanics/sizeComparison.ts'),
      import('/src/game/mechanics/shadowMatching.ts'),
      import('/src/game/mechanics/memory.ts'),
      import('/src/game/mechanics/energy.ts'),
      import('/src/game/mechanics/connections.ts'),
      import('/src/game/mechanics/programming.ts'),
    ]);
    sessionState.reset();
    for (const module of modules) {
      for (const value of Object.values(module)) {
        if (value && typeof value === 'object' && typeof value.reset === 'function') value.reset();
      }
    }
    for (let index = 1; index < mission; index += 1) sessionState.completeCurrentTask();
    game.scene.start(key);
  }, definition);
  await page.waitForFunction((key) => window.__ROBOTLAB_GAME__.scene.isActive(key), definition.key);
  await page.waitForTimeout(80);
}

async function interactiveNames(page, key) {
  return page.evaluate((sceneKey) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    return [...new Set(scene.children.list.flatMap(walk)
      .filter((item) => item?.visible !== false && item?.active !== false && item?.input?.enabled && item.name)
      .map((item) => item.name)
      .filter((name) => !/modal-blocker/.test(name)))];
  }, key);
}

async function probe(page, definition, name) {
  await bootScene(page, definition);
  const target = await page.evaluate(({ key, name }) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(key);
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    const object = scene.children.list.flatMap(walk).find((item) => item?.name === name && item?.input?.enabled);
    if (!object) return null;
    game.registry.set('stage8-3f-last-down', null);
    object.once('pointerdown', () => game.registry.set('stage8-3f-last-down', object.name || 'UNNAMED'));
    const point = object.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    const visual = window.visualViewport;
    return {
      x: canvas.left + point.x * canvas.width / game.scale.width,
      y: canvas.top + point.y * canvas.height / game.scale.height,
      point, canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
      gameSize: { width: game.scale.width, height: game.scale.height },
      visual: { width: visual?.width, height: visual?.height, offsetLeft: visual?.offsetLeft, offsetTop: visual?.offsetTop },
      hit: { width: object.input.hitArea?.width ?? 0, height: object.input.hitArea?.height ?? 0 },
    };
  }, { key: definition.key, name });
  if (!target) return { name, passed: false, reason: 'missing' };
  await page.touchscreen.tap(target.x, target.y);
  await page.waitForTimeout(50);
  const received = await page.evaluate(() => window.__ROBOTLAB_GAME__.registry.get('stage8-3f-last-down'));
  return { name, passed: received === name, received, target };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const results = [];
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
    for (const definition of scenes) {
      await bootScene(page, definition);
      const names = await interactiveNames(page, definition.key);
      const probes = [];
      for (const name of names) probes.push(await probe(page, definition, name));
      results.push({ profile: profile.name, ...definition, names, probes, errors: [...errors] });
    }
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage8-3f-buttons-${profile.name}.png`) });
    await context.close();
  }
  await browser.close();
  const failures = results.flatMap((entry) => entry.probes.filter((probe) => !probe.passed)
    .map((probe) => `${entry.profile}:${entry.label}:${probe.name}->${probe.received || probe.reason}`));
  for (const entry of results) if (entry.errors.length) failures.push(`${entry.profile}:${entry.label}:browser-errors`);
  const report = { results, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-3f-mobile-buttons.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: results.length, buttonProbes: results.reduce((sum, entry) => sum + entry.probes.length, 0), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
