const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://192.168.0.107:4198/';
const viewportWidth = Number(process.env.QA_WIDTH || 915);
const viewportHeight = Number(process.env.QA_HEIGHT || 350);
const profile = `${viewportWidth}x${viewportHeight}`;
const screenshotPath = path.join('docs', 'qa', 'screenshots', `stage8-4b-samsung-lan-overlap-${profile}.png`);
const reportPath = path.join('docs', 'qa', `stage8-4b-samsung-overlap-${profile}.json`);

const intersects = (a, b) => Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x)
  && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
const contains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y
  && inner.x + inner.width <= outer.x + outer.width
  && inner.y + inner.height <= outer.y + outer.height;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('requestfailed', (request) => browserErrors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(`${baseUrl}?samsung-overlap-qa=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'), undefined, { timeout: 60000 });
  await page.evaluate(async () => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    sessionState.reset();
    sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('GameScene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.getScene('GameScene')
    ?.children.getByName('task-card'), undefined, { timeout: 60000 });
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const task = scene.children.getByName('task-card');
    const audit = game.registry.get('boundsAudit');
    const badge = task.getData('semanticRegions').BADGE;
    const layout = game.registry.get('responsiveLayout');
    const sound = scene.children.getByName('game-sound').getBounds();
    const homeControl = scene.children.getByName('game-home');
    const soundControl = scene.children.getByName('game-sound');
    const composition = game.registry.get('sceneComposition');
    const controlRect = (control) => ({
      x: control.x - control.width / 2,
      y: control.y - control.height / 2,
      width: control.width,
      height: control.height,
    });
    return {
      header: {
        x: 0,
        y: layout.headerY - layout.headerHeight / 2,
        width: game.scale.gameSize.width,
        height: layout.headerHeight,
      },
      ribbon: { x: task.x + badge.x, y: task.y + badge.y, width: badge.width, height: badge.height },
      answers: audit.visibleObjectBounds.filter((item) => item.role === 'ANSWER_CARD'),
      hint: audit.visibleObjectBounds.find((item) => item.role === 'SECONDARY_ACTION'),
      sound: { x: sound.x, y: sound.y, width: sound.width, height: sound.height },
      homeControl: controlRect(homeControl),
      soundControl: controlRect(soundControl),
      surface: composition.surface,
      safeRect: layout.safeRect,
      childVisualReadability: audit.childVisualReadability,
    };
  });

  await page.evaluate(async () => {
    const { sequenceMechanic } = await import('/src/game/mechanics/sequence.ts');
    const snapshot = sequenceMechanic.snapshot;
    const wrong = snapshot.optionKeys.find((key) => key !== snapshot.correctKey);
    window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card')
      .getByName(`choice-${wrong}`).emit('pointerdown');
  });
  await page.waitForFunction(async () => {
    const { sequenceMechanic } = await import('/src/game/mechanics/sequence.ts');
    return sequenceMechanic.snapshot.result === 'wrong';
  });
  const feedback = await page.evaluate(() => {
    const bounds = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card')
      .getByName('task-feedback').getBounds();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
  await page.screenshot({ path: screenshotPath });

  const checks = {
    headerAndRibbonSeparated: initial.ribbon.y - (initial.header.y + initial.header.height) >= 3,
    hintDoesNotOverlapAnswers: initial.answers.every((answer) => !intersects(answer, initial.hint)),
    feedbackDoesNotOverlapAnswers: initial.answers.every((answer) => !intersects(answer, feedback)),
    childVisualReadabilityPass: initial.childVisualReadability === 'PASS',
    soundInsideSafeRect: initial.sound.x >= initial.safeRect.x
      && initial.sound.y >= initial.safeRect.y
      && initial.sound.x + initial.sound.width <= initial.safeRect.x + initial.safeRect.width
      && initial.sound.y + initial.sound.height <= initial.safeRect.y + initial.safeRect.height,
    unifiedSurfacePresent: Boolean(initial.surface?.outer),
    homeInsideUnifiedSurface: contains(initial.surface.outer, initial.homeControl),
    soundInsideUnifiedSurface: contains(initial.surface.outer, initial.soundControl),
    ribbonInsideUnifiedSurface: contains(initial.surface.outer, initial.ribbon),
    hintInsideUnifiedSurface: contains(initial.surface.outer, initial.hint),
    browserClean: browserErrors.length === 0,
  };
  const report = { baseUrl, viewport: { width: viewportWidth, height: viewportHeight }, initial, feedback, checks, browserErrors };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
