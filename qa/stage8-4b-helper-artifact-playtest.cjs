const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage8-4b-helper-artifact.json');

const cases = [
  { name: 'mission1-desktop-1280x720', viewport: { width: 1280, height: 720 }, scene: 'GameScene', completedTasks: 0 },
  { name: 'mission1-phone-390x844', viewport: { width: 390, height: 844 }, scene: 'GameScene', completedTasks: 0, mobile: true },
  { name: 'mission1-landscape-844x390', viewport: { width: 844, height: 390 }, scene: 'GameScene', completedTasks: 0, mobile: true },
  { name: 'assembly-preview-complete-1280x720', viewport: { width: 1280, height: 720 }, scene: 'RobotAssemblyPreviewScene', completedTasks: 5, previewState: 5 },
  { name: 'assembly-preview-complete-phone-390x844', viewport: { width: 390, height: 844 }, scene: 'RobotAssemblyPreviewScene', completedTasks: 5, previewState: 5, mobile: true },
  { name: 'mission5-transition-desktop-1280x720', viewport: { width: 1280, height: 720 }, scene: 'TransitionScene', completedTasks: 5 },
  { name: 'mission5-transition-phone-390x844', viewport: { width: 390, height: 844 }, scene: 'TransitionScene', completedTasks: 5, mobile: true },
  { name: 'mission6-desktop-1280x720', viewport: { width: 1280, height: 720 }, scene: 'Mission6Scene', completedTasks: 5 },
  { name: 'mission6-complete-desktop-1280x720', viewport: { width: 1280, height: 720 }, scene: 'Mission6Scene', completedTasks: 6 },
  { name: 'mission6-phone-390x844', viewport: { width: 390, height: 844 }, scene: 'Mission6Scene', completedTasks: 5, mobile: true },
  { name: 'mission7-desktop-1280x720', viewport: { width: 1280, height: 720 }, scene: 'Mission7Scene', completedTasks: 6 },
  { name: 'mission7-phone-390x844', viewport: { width: 390, height: 844 }, scene: 'Mission7Scene', completedTasks: 6, mobile: true },
  { name: 'mission8-desktop-1280x720', viewport: { width: 1280, height: 720 }, scene: 'Mission8Scene', completedTasks: 7 },
  { name: 'mission8-phone-390x844', viewport: { width: 390, height: 844 }, scene: 'Mission8Scene', completedTasks: 7, mobile: true },
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
  await page.goto(`${baseUrl}?stage8_4b=${Date.now()}`, { waitUntil: 'domcontentloaded' });
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

    sessionState.reset();
    oddOneOutMechanic.reset();
    sequenceMechanic.reset();
    sizeComparisonMechanic.reset();
    shadowMatchingMechanic.reset();
    memoryMechanic.reset();
    energyMechanic.reset();
    connectionsMechanic.reset();
    programmingMechanic.reset();
    for (let index = 0; index < completedTasks; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start(sceneKey);
  }, { sceneKey, completedTasks });
  await page.waitForFunction((key) => window.__ROBOTLAB_GAME__.scene.isActive(key), sceneKey);
  await page.waitForTimeout(350);
}

async function openPreviewScene(page, previewState) {
  await page.goto(`${baseUrl}?stage8_4b=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await page.evaluate((state) => {
    window.__ROBOTLAB_GAME__.scene.start('RobotAssemblyPreviewScene', { state });
  }, previewState);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('RobotAssemblyPreviewScene'));
  await page.waitForTimeout(350);
}

async function inspectScene(page, sceneKey) {
  return page.evaluate((key) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(key);
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const helper = all.find((item) => item?.name === 'grounded-robot' && item.visible);
    const helperSprite = all.find((item) => item?.name === 'robot-v2-helper-sprite' && item.visible);
    const directHelper = all.find((item) => ['start-hero-robot', 'victory-robot'].includes(item?.name) && item.visible);
    const helperTarget = helper || directHelper;
    const helperBounds = helperTarget?.getBounds ? helperTarget.getBounds() : null;
    const visibleImages = all.filter((item) => item?.type === 'Image' && item.visible).map((item) => ({
      name: item.name || '',
      texture: item.texture?.key || '',
      bounds: item.getBounds ? item.getBounds() : null,
    }));
    const helperImages = visibleImages.filter((item) => item.texture === 'robot-v2-helper');
    const previews = all.filter((item) => item?.name === 'assembly-robot' && item.visible).map((robot) => {
      const installed = new Set(robot.getData('installedParts') || []);
      const blueprintParts = (robot.list || []).filter((part) => part?.name?.startsWith('assembly-blueprint-')).map((part) => ({
        name: part.name,
        part: part.name.replace('assembly-blueprint-', ''),
        visible: part.visible,
        alpha: part.alpha,
      }));
      const forbiddenOverlayNames = new Set(['robot-chest-glow', 'robot-chest-display']);
      const visibleForbiddenOverlays = (robot.list || [])
        .filter((part) => forbiddenOverlayNames.has(part?.name) && part.visible && part.alpha > 0)
        .map((part) => ({ name: part.name, type: part.type, alpha: part.alpha, bounds: part.getBounds ? part.getBounds() : null }));
      return {
        name: robot.name,
        state: robot.getData('assemblyState'),
        installedParts: [...installed],
        blueprintParts,
        installedBlueprintsVisible: blueprintParts.filter((part) => installed.has(part.part) && part.visible && part.alpha > 0),
        visibleForbiddenOverlays,
        bounds: robot.getBounds ? robot.getBounds() : null,
      };
    });
    const assembledPreview = previews.find((robot) => robot.state === 5);
    const shapesNearHelper = helperBounds
      ? all.filter((item) => item?.visible && ['Arc', 'Ellipse', 'Graphics', 'Circle'].includes(item.type))
        .map((item) => ({ name: item.name || '', type: item.type, bounds: item.getBounds ? item.getBounds() : null }))
        .filter((item) => item.bounds && Phaser.Geom.Rectangle.Overlaps(helperBounds, item.bounds))
      : [];
    const layout = game.registry.get('responsiveLayout');
    const composition = game.registry.get('sceneComposition');
    return {
      scene: key,
      semanticMode: layout?.semanticMode || null,
      policyId: composition?.policyId || null,
      helperVisible: Boolean(helperTarget),
      helperSpriteVisible: Boolean(helperSprite),
      helperBounds,
      helperImages,
      previews,
      assembledPreview,
      shapesNearHelper,
      currentScene: game.scene.getScenes(true).map((active) => active.scene.key),
    };
  }, sceneKey);
}

function neckClip(bounds, viewport) {
  if (!bounds) return null;
  const clip = {
    x: bounds.x + bounds.width * 0.28,
    y: bounds.y + bounds.height * 0.36,
    width: bounds.width * 0.44,
    height: bounds.height * 0.22,
  };
  const x = Math.max(0, Math.floor(clip.x));
  const y = Math.max(0, Math.floor(clip.y));
  const right = Math.min(viewport.width, Math.ceil(clip.x + clip.width));
  const bottom = Math.min(viewport.height, Math.ceil(clip.y + clip.height));
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

async function runCase(browser, testCase) {
  const context = await browser.newContext({
    viewport: testCase.viewport,
    isMobile: Boolean(testCase.mobile),
    hasTouch: Boolean(testCase.mobile),
    reducedMotion: 'reduce',
    deviceScaleFactor: testCase.mobile ? 2 : 1,
  });
  const page = await context.newPage();
  const errors = captureErrors(page);
  if (testCase.scene === 'RobotAssemblyPreviewScene') await openPreviewScene(page, testCase.previewState);
  else await openScene(page, testCase.scene, testCase.completedTasks);
  const audit = await inspectScene(page, testCase.scene);
  const screenshot = path.join(screenshotDir, `stage8-4b-artifact-${testCase.name}.png`);
  await page.screenshot({ path: screenshot });
  let crop = null;
  const targetBounds = audit.helperBounds || audit.assembledPreview?.bounds || null;
  const clip = neckClip(targetBounds, testCase.viewport);
  if (clip) {
    crop = path.join(screenshotDir, `stage8-4b-artifact-${testCase.name}-neck-crop.png`);
    await page.screenshot({ path: crop, clip });
  }
  await context.close();
  return {
    ...testCase,
    screenshot,
    crop,
    audit,
    checks: {
      browserClean: isClean(errors),
      requiredSceneActive: audit.currentScene.includes(testCase.scene),
      helperTextureWhenVisible: !audit.helperVisible || audit.helperImages.length > 0,
      installedBlueprintsHidden: audit.previews.every((preview) => preview.installedBlueprintsVisible.length === 0),
      noCircleOrRectangleOverlay: audit.previews.every((preview) => preview.visibleForbiddenOverlays.length === 0),
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
  console.log(JSON.stringify({ cases: results.length, crops: results.filter((entry) => entry.crop).length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
