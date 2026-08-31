const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage8-3m-child-ui-flow.json');

async function tapNamed(page, sceneName, name) {
  const point = await page.evaluate(({ sceneName, name }) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(sceneName);
    const item = scene.children.getByName(name) || scene.children.getByName('task-card')?.list.find((child) => child.name === name);
    const world = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + world.x * canvas.width / game.scale.width, y: canvas.y + world.y * canvas.height / game.scale.height };
  }, { sceneName, name });
  await page.touchscreen.tap(point.x, point.y);
}

async function taskNumber(page) {
  return page.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    return card?.list.find((child) => typeof child.text === 'string' && child.text.startsWith('ЗАДАНИЕ'))?.text || '';
  });
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await tapNamed(page, 'StartScene', 'start-play-button');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  await page.setViewportSize({ width: 412, height: 180 });
  await page.waitForTimeout(450);
  const before = await taskNumber(page);
  await tapNamed(page, 'GameScene', 'choice-odd-ball');
  await page.waitForFunction(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene')?.children.getByName('task-card');
    return card?.list.some((child) => typeof child.text === 'string' && child.text.startsWith('ЗАДАНИЕ 2/'));
  }, { timeout: 5000 });
  const after = await taskNumber(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-3m-landscape-auto-advanced-task2.png') });
  const controls = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const data = (name) => {
      const child = card.list.find((item) => item.name === name);
      return child ? { visible: child.visible, active: child.active, width: child.width, height: child.height } : null;
    };
    return { check: data('check-button'), next: data('continue-button'), hint: data('hint-button') };
  });
  await page.evaluate(async () => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    sessionState.completeCurrentTask();
    sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.getScene('GameScene').scene.restart({ viewportReflow: false });
  });
  await page.waitForFunction(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene')?.children.getByName('task-card');
    return card?.list.some((child) => typeof child.text === 'string' && child.text.startsWith('ЗАДАНИЕ 4/'));
  });
  const shadow = await page.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    const bounds = (item) => { const b = item.getBounds(); return { width: b.width, height: b.height, x: b.x, y: b.y }; };
    const hit = (item) => ({ width: item.input?.hitArea?.width || item.width || 0, height: item.input?.hitArea?.height || item.height || 0 });
    const target = card.list.find((item) => item.name === 'shadow-target-object');
    const choices = card.list.filter((item) => item.name?.startsWith('choice-shadow-'));
    const images = choices.map((choice) => choice.list.find((item) => item.name?.startsWith('choice-image-'))).filter(Boolean);
    return { target: bounds(target), choices: choices.map(bounds), choiceHits: choices.map(hit), images: images.map(bounds) };
  });
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-3m-landscape-shadow-equal-scale.png') });
  const smallestShadowChoice = Math.min(...shadow.images.map((item) => Math.max(item.width, item.height)));
  const targetExtent = Math.max(shadow.target.width, shadow.target.height);
  const report = { before, after, controls, shadow, errors, checks: {
    startedAtTask1: before.startsWith('ЗАДАНИЕ 1 '),
    directAdvancedToTask2: after.startsWith('ЗАДАНИЕ 2/'),
    noConfirmCarousel: controls.check && !controls.check.visible && controls.next && !controls.next.visible,
    largeHintTarget: controls.hint?.height >= 56,
    shadowChoiceTargetsLarge: shadow.choiceHits.every((item) => item.width >= 56 && item.height >= 56),
    shadowReferenceComparable: targetExtent >= smallestShadowChoice * 0.75,
    browserClean: errors.length === 0,
  } };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (Object.values(report.checks).some((passed) => !passed)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
