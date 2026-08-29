const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4190/';
const viewports = [
  ['mobile-320x568', 320, 568, true], ['mobile-333x885', 333, 885, true],
  ['mobile-390x844', 390, 844, true], ['mobile-412x915', 412, 915, true],
  ['tablet-768x1024', 768, 1024, true], ['tablet-1024x1366', 1024, 1366, true],
  ['landscape-568x320', 568, 320, true], ['landscape-844x390', 844, 390, true],
  ['desktop-1280x720', 1280, 720, false], ['desktop-1920x1080', 1920, 1080, false],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  return errors;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('StartScene');
    const title = scene.children.getByName('start-title');
    const subtitle = scene.children.getByName('start-subtitle');
    const robot = scene.children.getByName('start-hero-robot');
    const play = scene.children.getByName('start-play-button');
    const sound = scene.children.list.find((item) => item.list?.some((child) => child.text === '♪ Звук' || child.text === '× Звук'));
    const bounds = (item) => { const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom, centerX: b.centerX, centerY: b.centerY }; };
    return {
      title: { text: title.text, ...bounds(title) },
      subtitle: { text: subtitle.text, lines: subtitle.text.split('\n').length, ...bounds(subtitle) },
      robot: { texture: robot.texture.key, xValue: robot.x, yValue: robot.y, scaleX: robot.scaleX, scaleY: robot.scaleY, ...bounds(robot) },
      play: { platformY: play.getData('platformY'), ...bounds(play) },
      sound: bounds(sound),
      modularActorOnStart: Boolean(scene.children.getByName('grounded-robot')),
      canvas: { width: game.canvas.width, height: game.canvas.height },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    };
  });
}

async function clickPlay(page, touch) {
  const point = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('StartScene')
    .children.getByName('start-play-button').getWorldTransformMatrix().transformPoint(0, 0));
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

function inside(bounds, width, height) {
  return bounds.x >= -1 && bounds.y >= -1 && bounds.right <= width + 1 && bounds.bottom <= height + 1;
}

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await sleep(120);
  const state = await snapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage5-1a-${name}.png`) });
  const checks = {
    completeRobot: state.robot.texture === 'robot-complete' && !state.modularActorOnStart,
    title: state.title.text === 'Почини робота' && inside(state.title, width, height),
    subtitle: state.subtitle.text === 'Выполни 5 заданий и помоги\nроботу снова заработать'
      && state.subtitle.lines === 2 && inside(state.subtitle, width, height),
    robotVisible: inside(state.robot, width, height),
    playCentered: Math.abs(state.play.centerX - width / 2) < 1 && inside(state.play, width, height),
    composition: state.title.bottom < state.subtitle.y + 2
      && state.subtitle.bottom < state.robot.y + 3
      && state.robot.bottom < state.play.y + 3
      && state.play.y > state.play.platformY,
    soundSecondary: state.sound.centerX > width / 2 && state.sound.y >= 0 && state.sound.right <= width + 1,
    viewport: state.canvas.width === width && state.canvas.height === height
      && state.document.width === width && state.document.height === height,
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { name, width, height, checks, errors, state };
}

async function runBehavior(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const idleA = await snapshot(page);
  await sleep(850);
  const idleB = await snapshot(page);
  await clickPlay(page, false);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  const gameplay = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors').getByName('grounded-robot');
    return { parts: actor.list.map((part) => part.texture?.key), state: actor.getData('animationState') };
  });
  const checks = {
    idle: Math.abs(idleA.robot.yValue - idleB.robot.yValue) > 0.1
      || Math.abs(idleA.robot.scaleX - idleB.robot.scaleX) > 0.0001,
    gameplayModular: gameplay.parts.length === 7 && gameplay.parts.every((key) => key?.startsWith('robot-part-')),
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { checks, errors, idleA, idleB, gameplay };
}

async function runReducedMotion(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const before = await snapshot(page);
  await sleep(1900);
  const after = await snapshot(page);
  const checks = {
    static: before.robot.yValue === after.robot.yValue && before.robot.scaleX === after.robot.scaleX,
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { checks, errors, before, after };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const matrix = [];
  for (const viewport of viewports) matrix.push(await runViewport(browser, viewport));
  const behavior = await runBehavior(browser);
  const reducedMotion = await runReducedMotion(browser);
  await browser.close();
  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, ok]) => !ok).map(([key]) => `${entry.name}:${key}`)),
    ...Object.entries(behavior.checks).filter(([, ok]) => !ok).map(([key]) => `behavior:${key}`),
    ...Object.entries(reducedMotion.checks).filter(([, ok]) => !ok).map(([key]) => `reduced-motion:${key}`),
  ];
  const report = { matrix, behavior, reducedMotion, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-1a-start-recovery-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ viewports: matrix.length, behavior: behavior.checks, reducedMotion: reducedMotion.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
