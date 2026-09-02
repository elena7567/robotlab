const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage8-4-character-art.json');

const cases = [
  ['start-desktop', 1280, 720, 'StartScene', 0],
  ['start-phone', 390, 844, 'StartScene', 0],
  ['mission1-desktop', 1280, 720, 'GameScene', 0],
  ['mission1-phone', 390, 844, 'GameScene', 0],
  ['mission1-360x640', 360, 640, 'GameScene', 0],
  ['mission1-landscape-844x390', 844, 390, 'GameScene', 0],
  ['mission1-tablet-768x1024', 768, 1024, 'GameScene', 0],
  ['mission1-wide-1438x914', 1438, 914, 'GameScene', 0],
  ['mission2-phone', 390, 844, 'GameScene', 1],
  ['mission3-tablet', 768, 1024, 'GameScene', 2],
  ['mission4-landscape', 844, 390, 'GameScene', 3],
  ['mission5-assembly-4of5', 1280, 720, 'GameScene', 4],
  ['mission5-completed-5of5', 1280, 720, 'GameScene', 4, 'assembly5'],
  ['mission5-transition-phone', 390, 844, 'TransitionScene', 5],
  ['mission6-phone', 390, 844, 'Mission6Scene', 5],
  ['mission7-desktop', 1280, 720, 'Mission7Scene', 6],
  ['mission7-wide-1438x914', 1438, 914, 'Mission7Scene', 6],
  ['mission7-tablet-768x1024', 768, 1024, 'Mission7Scene', 6],
  ['mission7-phone', 390, 844, 'Mission7Scene', 6],
  ['mission8-desktop', 1280, 720, 'Mission8Scene', 7],
  ['mission8-phone', 390, 844, 'Mission8Scene', 7],
  ['victory-desktop', 1280, 720, 'VictoryScene', 8],
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

const clean = (errors) => Object.values(errors).every((entries) => entries.length === 0);

async function openScene(page, sceneKey, completedTasks, mode) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  if (sceneKey !== 'StartScene') {
    await page.evaluate(async ({ sceneKey, completedTasks }) => {
      const { sessionState } = await import('/src/game/state/sessionState.ts');
      sessionState.reset();
      for (let i = 0; i < completedTasks; i += 1) sessionState.completeCurrentTask();
      window.__ROBOTLAB_GAME__.scene.start(sceneKey);
    }, { sceneKey, completedTasks });
    await page.waitForFunction((key) => window.__ROBOTLAB_GAME__.scene.isActive(key), sceneKey);
  }
  if (mode === 'assembly5') {
    await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('progress-panel').setValue(5));
  }
  await page.waitForTimeout(220);
}

async function inspect(page, sceneKey) {
  return page.evaluate((key) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(key);
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const images = all.filter((item) => item?.type === 'Image').map((item) => ({
      name: item.name || '', texture: item.texture?.key || '', visible: item.visible,
      width: item.getBounds?.().width || 0, height: item.getBounds?.().height || 0,
    }));
    const robots = images.filter((item) => item.texture.startsWith('robot-v2-'));
    const old = images.filter((item) => item.texture === 'robot-complete' || item.texture.startsWith('robot-part-'));
    const canvas = game.canvas.getBoundingClientRect();
    return {
      scene: key,
      canvas: { width: canvas.width, height: canvas.height },
      robots,
      old,
      assemblyState: all.find((item) => item?.name === 'assembly-progress-robot')?.getData('assemblyState') ?? null,
      boardRobot: all.find((item) => item?.name === 'programming-robot') ? {
        width: all.find((item) => item?.name === 'programming-robot').getBounds().width,
        height: all.find((item) => item?.name === 'programming-robot').getBounds().height,
      } : null,
      groundedRobot: all.find((item) => item?.name === 'grounded-robot') ? (() => {
        const bounds = all.find((item) => item?.name === 'grounded-robot').getBounds();
        return { width: bounds.width, height: bounds.height, ratio: bounds.width / bounds.height };
      })() : null,
      mission7Actors: {
        helper: all.find((item) => item?.name === 'grounded-robot')?.visible ? (() => {
          const bounds = all.find((item) => item?.name === 'grounded-robot').getBounds();
          return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
        })() : null,
        repaired: all.find((item) => item?.name === 'mission7-repaired-robot')?.visible ? (() => {
          const bounds = all.find((item) => item?.name === 'mission7-repaired-robot').getBounds();
          return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
        })() : null,
      },
      boundsAudit: game.registry.get('boundsAudit') || null,
    };
  }, sceneKey);
}

async function captureCase(browser, entry) {
  const [name, width, height, sceneKey, completedTasks, mode] = entry;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openScene(page, sceneKey, completedTasks, mode);
  const audit = await inspect(page, sceneKey);
  const file = path.join(screenshotDir, `stage8-4-${name}.png`);
  await page.screenshot({ path: file });
  await context.close();
  return { name, width, height, sceneKey, file, errors, audit, checks: {
    browserClean: clean(errors),
    canvasMatches: Math.round(audit.canvas.width) === width && Math.round(audit.canvas.height) === height,
    oldRobotTexturesAbsent: audit.old.length === 0,
    robotV2Present: audit.robots.length > 0,
    expectedAssemblyState: mode === 'assembly5' ? audit.assemblyState === 5 : (name === 'mission5-assembly-4of5' ? audit.assemblyState === 4 : true),
    boardActorReadable: !audit.boardRobot || (audit.boardRobot.width >= 26 && audit.boardRobot.height >= 36),
  } };
}

async function chargerCase(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await page.evaluate(async () => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    const { programmingMechanic, findShortestGridPath } = await import('/src/game/mechanics/programming.ts');
    sessionState.reset();
    for (let i = 0; i < 7; i += 1) sessionState.completeCurrentTask();
    programmingMechanic.reset();
    const snapshot = programmingMechanic.snapshot;
    const route = findShortestGridPath(snapshot.challenge, snapshot.challenge.start, snapshot.challenge.targetCell);
    route.forEach((command) => programmingMechanic.add(command));
    window.__ROBOTLAB_GAME__.scene.start('Mission8Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission8Scene'));
  const point = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene')
    .children.getByName('programming-run-button').getWorldTransformMatrix().transformPoint(0, 0));
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const board = scene.children.getByName('programming-board');
    const robot = board?.getByName('programming-robot');
    return robot?.getData('gridColumn') === board?.getData('targetColumn')
      && robot?.getData('gridRow') === board?.getData('targetRow');
  }, undefined, { timeout: 7000 });
  const audit = await inspect(page, 'Mission8Scene');
  const file = path.join(screenshotDir, 'stage8-4-mission8-robot-on-charger.png');
  await page.screenshot({ path: file });
  await context.close();
  return { name: 'mission8-robot-on-charger', file, errors, audit, checks: {
    browserClean: clean(errors), oldRobotTexturesAbsent: audit.old.length === 0,
    robotV2Present: audit.robots.length > 0, boardActorReadable: audit.boardRobot?.height >= 36,
  } };
}

async function orientationCase(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openScene(page, 'GameScene', 0);
  const samples = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(({ width, height }) => {
      const layout = window.__ROBOTLAB_GAME__.registry.get('responsiveLayout');
      return layout?.viewportWidth === width && layout?.viewportHeight === height;
    }, viewport);
    await page.waitForTimeout(180);
    samples.push((await inspect(page, 'GameScene')).groundedRobot);
  }
  await context.close();
  const ratios = samples.filter(Boolean).map((sample) => sample.ratio);
  return { name: 'portrait-landscape-portrait', errors, samples, checks: {
    browserClean: clean(errors), robotPresent: samples.every(Boolean),
    ratioStable: Math.max(...ratios) - Math.min(...ratios) < 0.02,
    portraitRestored: Math.abs(samples[0].height - samples[2].height) < 1,
  } };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const results = [];
  for (const entry of cases) results.push(await captureCase(browser, entry));
  results.push(await chargerCase(browser));
  const orientation = await orientationCase(browser);
  await browser.close();
  const failures = [
    ...results.flatMap((entry) => Object.entries(entry.checks).filter(([, pass]) => !pass).map(([check]) => `${entry.name}:${check}`)),
    ...Object.entries(orientation.checks).filter(([, pass]) => !pass).map(([check]) => `orientation:${check}`),
  ];
  fs.writeFileSync(reportPath, `${JSON.stringify({ results, orientation, failures }, null, 2)}\n`);
  console.log(JSON.stringify({ cases: results.length, orientation: orientation.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
