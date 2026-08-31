const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage8-3n-feedback-fixes.json');

async function tap(page, sceneKey, name) {
  const point = await page.evaluate(({ sceneKey, name }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Missing ${sceneKey}/${name}`);
    const world = target.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = window.__ROBOTLAB_GAME__.canvas.getBoundingClientRect();
    return { x: canvas.x + world.x * canvas.width / window.__ROBOTLAB_GAME__.scale.width,
      y: canvas.y + world.y * canvas.height / window.__ROBOTLAB_GAME__.scale.height };
  }, { sceneKey, name });
  await page.touchscreen.tap(point.x, point.y);
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const errors = [];

  const sequenceContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const sequencePage = await sequenceContext.newPage();
  sequencePage.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  sequencePage.on('pageerror', (error) => errors.push(error.message));
  await sequencePage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await sequencePage.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await tap(sequencePage, 'StartScene', 'start-play-button');
  await sequencePage.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  await tap(sequencePage, 'GameScene', 'choice-odd-ball');
  await sequencePage.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card')
    ?.list.some((item) => item.text?.startsWith('ЗАДАНИЕ 2/')));
  const sequenceInitial = await sequencePage.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    const bounds = (item) => { const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, bottom: b.bottom }; };
    const images = card.list.filter((item) => item.name?.startsWith('choice-'))
      .map((choice) => choice.list.find((item) => item.name?.startsWith('choice-image-'))).filter(Boolean);
    const rowImages = card.list.filter((item) => item.type === 'Image' && item.name !== 'missing-slot-answer' && !item.name?.startsWith('choice-image-'));
    const feedback = card.list.find((item) => item.name === 'task-feedback');
    return { choices: images.map(bounds), row: rowImages.map(bounds), feedback: bounds(feedback), label: card.list.find((item) => item.text?.startsWith('ЗАДАНИЕ'))?.text };
  });
  await tap(sequencePage, 'GameScene', 'choice-sequence-gear');
  await sequencePage.waitForTimeout(220);
  const sequenceWrong = await sequencePage.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    const feedback = card.list.find((item) => item.name === 'task-feedback');
    const choices = card.list.filter((item) => item.name?.startsWith('choice-'));
    const fb = feedback.getBounds();
    return { text: feedback.text, overlapsChoice: choices.some((choice) => Phaser.Geom.Intersects.RectangleToRectangle(fb, choice.getBounds())) };
  });
  await sequencePage.screenshot({ path: path.join(screenshotDir, 'stage8-3n-mission2-mobile-wrong.png') });
  await sequencePage.setViewportSize({ width: 844, height: 390 });
  await sequencePage.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('responsiveLayout')?.viewportWidth === 844);
  await sequencePage.waitForTimeout(250);
  await tap(sequencePage, 'GameScene', 'choice-sequence-gear');
  await sequencePage.waitForTimeout(220);
  const sequenceLandscape = await sequencePage.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const bounds = (item) => { const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
    const feedback = card.getByName('task-feedback');
    const choices = [...card.choices.values()];
    return {
      configuredWidth: window.__ROBOTLAB_GAME__.registry.get('responsiveLayout').taskCard.width,
      choiceWidths: choices.map((choice) => choice.width),
      feedback: { text: feedback.text, ...bounds(feedback) },
      overlapsChoice: choices.some((choice) => Phaser.Geom.Intersects.RectangleToRectangle(feedback.getBounds(), choice.container.getBounds())),
      robotDialoguePresent: Boolean(scene.children.getByName('robot-dialogue')),
      progressVisible: scene.children.getByName('progress-panel')?.visible ?? false,
    };
  });
  await sequencePage.screenshot({ path: path.join(screenshotDir, 'stage8-3n-mission2-landscape-large-wrong.png') });
  await sequenceContext.close();

  const missionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const missionPage = await missionContext.newPage();
  missionPage.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  missionPage.on('pageerror', (error) => errors.push(error.message));
  await missionPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await missionPage.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await missionPage.evaluate(async () => {
    const { energyMechanic } = await import('/src/game/mechanics/energy.ts');
    energyMechanic.reset();
    window.__ROBOTLAB_GAME__.scene.start('Mission6Scene');
  });
  await missionPage.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission6Scene'));
  await tap(missionPage, 'Mission6Scene', 'energy-battery-medium');
  await tap(missionPage, 'Mission6Scene', 'energy-check-button');
  await missionPage.waitForTimeout(120);
  const afterWrong = await missionPage.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('energy-task-card');
    const state = (level) => {
      const battery = card.getByName(`energy-battery-${level}`);
      const frame = battery.getByName(`energy-selection-${level}`);
      return { level, scale: battery.scaleX, selectionCommands: frame.commandBuffer.length };
    };
    return ['low', 'medium', 'full'].map(state);
  });
  await tap(missionPage, 'Mission6Scene', 'energy-battery-full');
  const afterCorrectSelected = await missionPage.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('energy-task-card');
    return ['low', 'medium', 'full'].map((level) => {
      const battery = card.getByName(`energy-battery-${level}`);
      return { level, scale: battery.scaleX, selectionCommands: battery.getByName(`energy-selection-${level}`).commandBuffer.length };
    });
  });
  await missionPage.screenshot({ path: path.join(screenshotDir, 'stage8-3n-mission6-mobile-reselected.png') });

  await missionPage.evaluate(async () => {
    const { programmingMechanic } = await import('/src/game/mechanics/programming.ts');
    programmingMechanic.reset();
    window.__ROBOTLAB_GAME__.scene.start('Mission8Scene');
  });
  await missionPage.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission8Scene'));
  const routeActors = await missionPage.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const walk = (item, output) => { output.push(item.name || ''); if (item.list) item.list.forEach((child) => walk(child, output)); };
    const names = []; scene.children.list.forEach((item) => walk(item, names));
    return { programmingRobots: names.filter((name) => name === 'programming-robot').length,
      groundedRobots: names.filter((name) => name === 'grounded-robot').length,
      helperLayers: names.filter((name) => name === 'mission8-helper-layer').length };
  });
  await missionPage.screenshot({ path: path.join(screenshotDir, 'stage8-3n-mission8-mobile-single-robot.png') });
  await missionContext.close();
  await browser.close();

  const minChoiceExtent = Math.min(...sequenceInitial.choices.map((item) => Math.max(item.width, item.height)));
  const minRowExtent = Math.min(...sequenceInitial.row.map((item) => Math.max(item.width, item.height)));
  const report = { sequenceInitial, sequenceWrong, sequenceLandscape, afterWrong, afterCorrectSelected, routeActors, errors, checks: {
    sequenceArtworkReadable: minChoiceExtent >= 58 && minRowExtent >= 56,
    sequenceProgressInRibbon: sequenceInitial.label.includes('РЯД'),
    wrongFeedbackClearOfChoices: !sequenceWrong.overlapsChoice,
    landscapeTaskCardClearlyLarger: sequenceLandscape.configuredWidth >= 500 && sequenceLandscape.choiceWidths.every((width) => width >= 88),
    landscapeFeedbackUnobstructed: !sequenceLandscape.overlapsChoice && !sequenceLandscape.robotDialoguePresent && !sequenceLandscape.progressVisible,
    wrongBatteryCleared: afterWrong.every((item) => item.scale === 1 && item.selectionCommands === 0),
    onlyCorrectBatterySelected: afterCorrectSelected.find((item) => item.level === 'full').scale > 1
      && afterCorrectSelected.filter((item) => item.level !== 'full').every((item) => item.scale === 1 && item.selectionCommands === 0),
    singleRouteRobot: routeActors.programmingRobots === 1 && routeActors.groundedRobots === 0 && routeActors.helperLayers === 0,
    browserClean: errors.length === 0,
  } };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(report.checks).some((value) => !value)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
