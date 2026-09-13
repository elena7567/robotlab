const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage8-4d-desktop-background-fill.json');

const cases = [
  { name: 'start-1920x900', viewport: { width: 1920, height: 900 }, scene: 'StartScene', completedTasks: 0 },
  { name: 'start-1920x1080', viewport: { width: 1920, height: 1080 }, scene: 'StartScene', completedTasks: 0 },
  { name: 'mission1-1920x900', viewport: { width: 1920, height: 900 }, scene: 'GameScene', completedTasks: 0 },
  { name: 'mission6-1920x900', viewport: { width: 1920, height: 900 }, scene: 'Mission6Scene', completedTasks: 5 },
  { name: 'transition-1920x900', viewport: { width: 1920, height: 900 }, scene: 'TransitionScene', completedTasks: 5 },
  { name: 'mission9-1920x900', viewport: { width: 1920, height: 900 }, scene: 'Mission9Scene', completedTasks: 8 },
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text());
  });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

function isClean(errors) {
  return Object.values(errors).every((entries) => entries.length === 0);
}

async function openScene(page, sceneKey, completedTasks) {
  await page.goto(`${baseUrl}?stage8_4d=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  if (sceneKey === 'StartScene') return;
  await page.evaluate(async ({ sceneKey, completedTasks }) => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    const { oddOneOutMechanic } = await import('/src/game/mechanics/oddOneOut.ts');
    const { sequenceMechanic } = await import('/src/game/mechanics/sequence.ts');
    const { sizeComparisonMechanic } = await import('/src/game/mechanics/sizeComparison.ts');
    const { shadowMatchingMechanic } = await import('/src/game/mechanics/shadowMatching.ts');
    const { memoryMechanic } = await import('/src/game/mechanics/memory.ts');
    const { energyMechanic } = await import('/src/game/mechanics/energy.ts');
    const { connectionsMechanic } = await import('/src/game/mechanics/connections.ts');
    const { programmingMechanic } = await import('/src/game/mechanics/programming.ts');
    const { robotTestCourse } = await import('/src/game/mechanics/robotTestCourse.ts');

    sessionState.reset();
    oddOneOutMechanic.reset();
    sequenceMechanic.reset();
    sizeComparisonMechanic.reset();
    shadowMatchingMechanic.reset();
    memoryMechanic.reset();
    energyMechanic.reset();
    connectionsMechanic.reset();
    programmingMechanic.reset();
    robotTestCourse.reset();
    for (let index = 0; index < completedTasks; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start(sceneKey);
  }, { sceneKey, completedTasks });
  await page.waitForFunction((key) => window.__ROBOTLAB_GAME__.scene.isActive(key), sceneKey);
  await page.waitForTimeout(350);
}

async function inspectScene(page, sceneKey) {
  return page.evaluate((key) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(key);
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const containsRectWithTolerance = (outer, inner, tolerance = 1) =>
      inner.x >= outer.x - tolerance
      && inner.y >= outer.y - tolerance
      && inner.x + inner.width <= outer.x + outer.width + tolerance
      && inner.y + inner.height <= outer.y + outer.height + tolerance;
    const backgrounds = all
      .filter((item) => item?.type === 'Image' && item.visible && ['bg-main-laboratory', 'bg-start-laboratory'].includes(item.texture?.key))
      .map((item) => ({ name: item.name || '', texture: item.texture.key, bounds: item.getBounds() }));
    const background = backgrounds
      .find((item) => containsRectWithTolerance(item.bounds, { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight })) || null;
    const uiNames = [
      'start-play-button', 'start-sound', 'game-home', 'game-sound', 'task-card',
      'mission6-home', 'mission6-sound', 'energy-task-card', 'transition-home',
      'mission9-home', 'mission9-sound', 'mission9-course-world',
    ];
    const uiObjects = all.filter((item) => uiNames.includes(item?.name) && item.visible && item.getBounds)
      .map((item) => ({ name: item.name, bounds: item.getBounds() }));
    const outsideBackground = background
      ? uiObjects.filter((item) => !containsRectWithTolerance(background.bounds, item.bounds))
      : uiObjects;
    return {
      activeScenes: window.__ROBOTLAB_GAME__.scene.getScenes(true).map((active) => active.scene.key),
      backgrounds,
      coveringBackground: background,
      uiObjects,
      outsideBackground,
      canvas: {
        width: window.__ROBOTLAB_GAME__.canvas.getBoundingClientRect().width,
        height: window.__ROBOTLAB_GAME__.canvas.getBoundingClientRect().height,
      },
    };
  }, sceneKey);
}

async function runCase(browser, testCase) {
  const context = await browser.newContext({ viewport: testCase.viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openScene(page, testCase.scene, testCase.completedTasks);
  const audit = await inspectScene(page, testCase.scene);
  const screenshot = path.join(screenshotDir, `stage8-4d-bg-fill-${testCase.name}.png`);
  await page.screenshot({ path: screenshot });
  await context.close();
  return {
    ...testCase,
    screenshot,
    audit,
    checks: {
      browserClean: isClean(errors),
      requiredSceneActive: audit.activeScenes.includes(testCase.scene),
      canvasFillsViewport: Math.round(audit.canvas.width) === testCase.viewport.width && Math.round(audit.canvas.height) === testCase.viewport.height,
      laboratoryCoversViewport: Boolean(audit.coveringBackground),
      uiInsideLaboratory: audit.outsideBackground.length === 0,
    },
    errors,
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const testCase of cases) results.push(await runCase(browser, testCase));
  await browser.close();
  const failures = results.flatMap((entry) => Object.entries(entry.checks)
    .filter(([, pass]) => !pass)
    .map(([check]) => `${entry.name}:${check}`));
  fs.writeFileSync(reportPath, `${JSON.stringify({ baseUrl, results, failures }, null, 2)}\n`);
  console.log(JSON.stringify({ cases: results.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
