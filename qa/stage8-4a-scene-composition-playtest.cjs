const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage8-4a-scene-composition.json');

const cases = [
  ['mission1-desktop', 1280, 720, 'GameScene', 0],
  ['mission1-phone', 390, 844, 'GameScene', 0],
  ['mission2-short-landscape', 844, 390, 'GameScene', 1],
  ['mission5-tablet', 768, 1024, 'GameScene', 4],
  ['mission6-short-landscape', 844, 390, 'Mission6Scene', 5],
  ['mission7-desktop', 1280, 720, 'Mission7Scene', 6],
  ['mission7-phone', 390, 844, 'Mission7Scene', 6],
  ['mission7-short-landscape', 844, 390, 'Mission7Scene', 6],
  ['mission8-desktop', 1280, 720, 'Mission8Scene', 7],
  ['mission8-phone', 390, 844, 'Mission8Scene', 7],
  ['mission8-short-landscape', 844, 390, 'Mission8Scene', 7],
  ['transition-phone', 390, 844, 'TransitionScene', 5],
  ['transition-short-landscape', 844, 390, 'TransitionScene', 5],
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

function clean(errors) {
  return Object.values(errors).every((entries) => entries.length === 0);
}

async function openScene(page, sceneKey, completedTasks) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'), undefined, { timeout: 60000 });
  if (sceneKey === 'StartScene') return;
  await page.evaluate(async ({ sceneKey, completedTasks }) => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    sessionState.reset();
    for (let i = 0; i < completedTasks; i += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start(sceneKey);
  }, { sceneKey, completedTasks });
  await page.waitForFunction((key) => window.__ROBOTLAB_GAME__.scene.isActive(key), sceneKey);
  await page.waitForTimeout(260);
}

async function inspect(page, sceneKey) {
  return page.evaluate((key) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(key);
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const rect = (item) => {
      const bounds = item?.getBounds?.();
      return bounds ? {
        x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
        right: bounds.right, bottom: bounds.bottom,
      } : null;
    };
    const robotItems = all.filter((item) => item?.type === 'Image' && item.texture?.key?.startsWith('robot-v2-'));
    const legacyRobotItems = all.filter((item) => item?.type === 'Image' && (item.texture?.key === 'robot-complete' || item.texture?.key?.startsWith('robot-part-')));
    const visibleCharacters = all.filter((item) => item?.visible && item.getData?.('characterRole')).map((item) => ({
      name: item.name || '',
      role: item.getData('characterRole'),
      region: item.getData('compositionRegion') || null,
      visibleBoundsId: item.getData('visibleBoundsId') || null,
      bounds: rect(item),
    }));
    const interactive = all.filter((item) => item?.visible && item.input?.enabled).map((item) => ({
      name: item.name || '',
      width: item.input.hitArea?.width || item.width || rect(item)?.width || 0,
      height: item.input.hitArea?.height || item.height || rect(item)?.height || 0,
    }));
    const sceneComposition = game.registry.get('sceneComposition') || null;
    const boundsAudit = game.registry.get('boundsAudit') || null;
    const canvas = game.canvas.getBoundingClientRect();
    const strip = all.find((item) => item?.name === 'program-strip');
    const stripSlots = all.filter((item) => item?.name?.startsWith('program-slot-')).length;
    return {
      scene: key,
      canvas: { width: canvas.width, height: canvas.height },
      semanticMode: game.registry.get('responsiveLayout')?.semanticMode || null,
      policyId: sceneComposition?.policyId || null,
      characters: sceneComposition?.characters || [],
      visibleCharacters,
      robotTextureCount: robotItems.length,
      legacyRobotTextureCount: legacyRobotItems.length,
      boundsAudit,
      interactive,
      stripSlots,
      mission7: {
        board: rect(scene.children.getByName('connection-task-card')),
        hint: rect(scene.children.getByName('connection-hint')),
      },
      mission8: {
        board: rect(scene.children.getByName('programming-board')),
        strip: rect(strip),
        stripMaxCommands: strip?.getData?.('maxCommands') || null,
        run: rect(scene.children.getByName('programming-run-button')),
      },
      transition: {
        title: rect(scene.children.getByName('transition-title')),
        button: rect(scene.children.getByName('transition-continue')),
      },
    };
  }, sceneKey);
}

async function captureCase(browser, entry) {
  const [name, width, height, sceneKey, completedTasks] = entry;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openScene(page, sceneKey, completedTasks);
  const audit = await inspect(page, sceneKey);
  const file = path.join(screenshotDir, `stage8-4a-${name}.png`);
  await page.screenshot({ path: file });
  await context.close();
  const interactiveExceptions = new Set(['']);
  return {
    name, width, height, sceneKey, file, errors, audit,
    checks: {
      browserClean: clean(errors),
      canvasMatchesViewport: Math.round(audit.canvas.width) === width && Math.round(audit.canvas.height) === height,
      policyRegistered: Boolean(audit.policyId),
      boundsAuditClean: !audit.boundsAudit || (audit.boundsAudit.overlapCount === 0 && audit.boundsAudit.outsideSafeRect.length === 0),
      touchTargetsUsable: audit.interactive.filter((item) => !interactiveExceptions.has(item.name)).every((item) => item.width >= 44 && item.height >= 44),
      robotV2Only: audit.robotTextureCount > 0 && audit.legacyRobotTextureCount === 0,
      characterRolesCanonical: audit.characters.every((character) => ['PRIMARY_CHARACTER', 'SUPPORTING_CHARACTER', 'BOARD_ACTOR', 'HIDDEN_FOR_MECHANIC_FOCUS'].includes(character.role)),
      mission7PortraitBoardFocus: name !== 'mission7-phone' || audit.visibleCharacters.length === 0,
      mission7NonPortraitCharacter: !name.startsWith('mission7-') || name === 'mission7-phone' || audit.visibleCharacters.some((character) => character.role === 'PRIMARY_CHARACTER'),
      mission8BoardActorPrimary: !name.startsWith('mission8-') || audit.visibleCharacters.some((character) => character.role === 'BOARD_ACTOR'),
      mission8StableStripSlots: !name.startsWith('mission8-') || audit.stripSlots >= audit.mission8.stripMaxCommands,
      transitionGrouped: !name.startsWith('transition-') || (audit.transition.title && audit.transition.button && audit.transition.title.bottom < audit.transition.button.y),
    },
  };
}

async function mission8PoolCase(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openScene(page, 'Mission8Scene', 7);
  const result = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const all = () => scene.children.list.flatMap(walk);
    const countSlots = () => all().filter((item) => item?.name?.startsWith('program-slot-')).length;
    const before = countSlots();
    const add = all().find((item) => item?.name === 'program-command-DOWN');
    const clear = all().find((item) => item?.name === 'programming-delete-button');
    if (!add || !clear) return { before, afterAdds: -1, afterDeletes: -1 };
    for (let i = 0; i < 6; i += 1) add.emit('pointerup');
    const afterAdds = countSlots();
    for (let i = 0; i < 6; i += 1) clear.emit('pointerup');
    const afterDeletes = countSlots();
    return { before, afterAdds, afterDeletes };
  });
  await context.close();
  return {
    name: 'mission8-strip-pool',
    errors,
    result,
    checks: {
      browserClean: clean(errors),
      stableSlotCount: result.before === result.afterAdds && result.afterAdds === result.afterDeletes,
    },
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const pool = await mission8PoolCase(browser);
  for (const entry of cases) results.push(await captureCase(browser, entry));
  await browser.close();
  const failures = [
    ...results.flatMap((entry) => Object.entries(entry.checks).filter(([, pass]) => !pass).map(([check]) => `${entry.name}:${check}`)),
    ...Object.entries(pool.checks).filter(([, pass]) => !pass).map(([check]) => `${pool.name}:${check}`),
  ];
  fs.writeFileSync(reportPath, `${JSON.stringify({ results, pool, failures }, null, 2)}\n`);
  console.log(JSON.stringify({ cases: results.length, pool: pool.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
