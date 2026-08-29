const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['minimum-320x568', 320, 568],
  ['mobile-390x844', 390, 844],
  ['tablet-768x1024', 768, 1024],
  ['desktop-1280x720', 1280, 720],
  ['desktop-wide-1438x914', 1438, 914],
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function openVictory(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene?.isActive('StartScene'));
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.start('VictoryScene'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene?.isActive('VictoryScene'));
  await page.waitForTimeout(150);
}

async function inspectVictory(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('VictoryScene');
    const robot = scene.children.getByName('victory-robot');
    const background = scene.children.getByName('victory-background');
    const playAgain = scene.children.getByName('victory-play-again');
    const home = scene.children.getByName('victory-home');
    const title = scene.children.getByName('victory-title');
    const robotBounds = robot.getBounds();
    const playBounds = playAgain.getBounds();
    const homeBounds = home.getBounds();
    const titleBounds = title.getBounds();
    const platformContact = {
      x: background.getData('platformContactX'),
      y: background.getData('platformContactY'),
    };
    const feetContact = {
      x: robot.getData('robotFeetContactX'),
      y: robot.getData('robotFeetContactY'),
    };
    const overlaps = (a, b) => Phaser.Geom.Intersects.RectangleToRectangle(a, b);

    return {
      platformContact,
      feetContact,
      delta: {
        x: Math.abs(platformContact.x - feetContact.x),
        y: Math.abs(platformContact.y - feetContact.y),
      },
      robot: { x: robot.x, y: robot.y, width: robotBounds.width, height: robotBounds.height },
      titleReadable: title.visible && title.alpha === 1 && titleBounds.top >= 0 && titleBounds.bottom <= scene.scale.height,
      robotCentered: Math.abs(robot.x - scene.scale.width / 2) < 0.01,
      buttonOverlap: overlaps(robotBounds, playBounds) || overlaps(robotBounds, homeBounds),
      controlsInBounds: playBounds.bottom <= scene.scale.height && homeBounds.bottom <= scene.scale.height,
    };
  });
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const matrix = [];

  for (const [name, width, height] of viewports) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = captureErrors(page);
    await openVictory(page);
    const state = await inspectVictory(page);
    await page.screenshot({ path: path.join(screenshotDir, `stage7-0a-victory-${name}.png`) });

    if (name === 'desktop-1280x720') {
      await page.evaluate(() => {
        const scene = window.__ROBOTLAB_GAME__.scene.getScene('VictoryScene');
        const robot = scene.children.getByName('victory-robot');
        const x = robot.getData('platformContactX');
        const y = robot.getData('platformContactY');
        scene.add.circle(x, y, 8, 0xff3355, 1).setStrokeStyle(3, 0xffffff).setName('qa-platform-contact-marker');
        scene.add.circle(x, y, 3, 0x35ff77, 1).setName('qa-robot-feet-marker');
      });
      await page.screenshot({ path: path.join(screenshotDir, 'stage7-0a-victory-desktop-contact-debug.png') });
      await page.evaluate(() => {
        const scene = window.__ROBOTLAB_GAME__.scene.getScene('VictoryScene');
        scene.children.getByName('qa-platform-contact-marker')?.destroy();
        scene.children.getByName('qa-robot-feet-marker')?.destroy();
      });
      await page.screenshot({
        path: path.join(screenshotDir, 'stage7-0a-victory-desktop-feet-close-up.png'),
        clip: { x: 360, y: 390, width: 560, height: 230 },
      });
    }

    matrix.push({ name, viewport: { width, height }, ...state, errors });
    await context.close();
  }

  await browser.close();
  const failures = matrix.flatMap((entry) => {
    const checks = {
      contactCoincides: entry.delta.x < 0.01 && entry.delta.y < 0.01,
      robotCentered: entry.robotCentered,
      noButtonOverlap: !entry.buttonOverlap,
      titleReadable: entry.titleReadable,
      controlsInBounds: entry.controlsInBounds,
      consoleClean: Object.values(entry.errors).every((items) => items.length === 0),
    };
    entry.checks = checks;
    return Object.entries(checks).filter(([, pass]) => !pass).map(([check]) => `${entry.name}:${check}`);
  });
  const report = { matrix, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage7-0a-victory-grounding-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
