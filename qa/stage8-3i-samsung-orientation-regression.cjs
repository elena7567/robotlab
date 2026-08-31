const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage8-3i-samsung-orientation-regression.json');

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function waitForGeometry(page, width, height) {
  await page.waitForFunction(({ width, height }) => {
    const game = window.__ROBOTLAB_GAME__;
    const commit = game?.registry.get('committedViewport');
    const layout = game?.registry.get('responsiveLayout');
    return game?.scene.isActive('GameScene')
      && commit?.viewport.visualViewportWidth === width && commit?.viewport.visualViewportHeight === height
      && commit.parentSize.width === width && commit.parentSize.height === height
      && commit.displaySize.width === width && commit.displaySize.height === height
      && commit.gameSize.width === width && commit.gameSize.height === height
      && layout?.viewportWidth === width && layout?.viewportHeight === height;
  }, { width, height }, { timeout: 10000 });
  await page.waitForTimeout(80);
}

async function burstResize(page, sizes) {
  const before = await page.evaluate(() => window.__ROBOTLAB_GAME__.registry.get('committedViewport').generation);
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(45);
  }
  const [width, height] = sizes.at(-1);
  await waitForGeometry(page, width, height);
  const after = await page.evaluate(() => window.__ROBOTLAB_GAME__.registry.get('committedViewport').generation);
  return after - before;
}

async function completeMissionOne(page) {
  const points = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const point = (item) => item.getWorldTransformMatrix().transformPoint(0, 0);
    return {
      choice: point(card.list.find((item) => item.name === 'choice-odd-ball')),
      check: point(card.list.find((item) => item.name === 'check-button')),
    };
  });
  await page.touchscreen.tap(points.choice.x, points.choice.y);
  await page.touchscreen.tap(points.check.x, points.check.y);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    .children.getByName('task-card')?.list.find((item) => item.name === 'continue-button')?.visible);
}

async function inspect(page) {
  return page.evaluate(async () => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const commit = game.registry.get('committedViewport');
    const layout = game.registry.get('responsiveLayout');
    const canvas = game.canvas.getBoundingClientRect();
    const get = (name) => card.list.find((item) => item.name === name);
    const bounds = (item) => {
      const value = item.getBounds();
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const choices = card.list.filter((item) => item.name?.startsWith('choice-')).map(bounds);
    const feedback = bounds(get('task-feedback'));
    const hint = bounds(get('hint-button'));
    const next = bounds(get('continue-button'));
    const overlaps = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
    return {
      generation: commit.generation,
      geometry: {
        visual: `${commit.viewport.visualViewportWidth}x${commit.viewport.visualViewportHeight}`,
        inner: `${commit.viewport.innerWidth}x${commit.viewport.innerHeight}`,
        parent: `${commit.parentSize.width}x${commit.parentSize.height}`,
        display: `${commit.displaySize.width}x${commit.displaySize.height}`,
        game: `${commit.gameSize.width}x${commit.gameSize.height}`,
        canvas: `${Math.round(canvas.width)}x${Math.round(canvas.height)}`,
        mode: layout.semanticMode,
      },
      completed: get('continue-button')?.visible === true && get('task-feedback')?.text.length > 0,
      choiceRows: new Set(choices.map((value) => Math.round(value.y + value.height / 2))).size,
      checks: {
        feedbackClearOfChoices: choices.every((choice) => !overlaps(choice, feedback)),
        actionsClearOfChoices: choices.every((choice) => !overlaps(choice, hint) && !overlaps(choice, next)),
        feedbackClearOfActions: !overlaps(feedback, hint) && !overlaps(feedback, next),
        uniformCanvas: canvas.width === commit.gameSize.width && canvas.height === commit.gameSize.height,
      },
    };
  });
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const playPoint = await page.evaluate(() => {
    const button = window.__ROBOTLAB_GAME__.scene.getScene('StartScene').children.getByName('start-play-button');
    return button.getWorldTransformMatrix().transformPoint(0, 0);
  });
  await page.touchscreen.tap(playPoint.x, playPoint.y);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  await waitForGeometry(page, 390, 844);
  const landscapeCommits = await burstResize(page, [[560, 620], [690, 500], [780, 430], [844, 390]]);
  await completeMissionOne(page);
  const landscape = await inspect(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-3i-mission1-completed-landscape-844x390.png') });
  const portraitCommits = await burstResize(page, [[760, 450], [610, 580], [470, 730], [390, 844]]);
  const portrait = await inspect(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-3i-mission1-completed-returned-portrait-390x844.png') });
  await browser.close();

  const checks = {
    oneLandscapeCommit: landscapeCommits === 1,
    onePortraitCommit: portraitCommits === 1,
    landscapeComplete: landscape.completed,
    portraitComplete: portrait.completed,
    compactLandscapeSingleRow: landscape.choiceRows === 1,
    landscapeNoOverlap: Object.values(landscape.checks).every(Boolean),
    portraitNoOverlap: Object.values(portrait.checks).every(Boolean),
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  fs.writeFileSync(reportPath, JSON.stringify({ landscapeCommits, portraitCommits, landscape, portrait, errors, checks, failures }, null, 2));
  process.stdout.write(JSON.stringify({ landscapeCommits, portraitCommits, landscape, portrait, checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
