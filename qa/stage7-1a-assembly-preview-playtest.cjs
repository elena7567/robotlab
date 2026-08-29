const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const targets = [
  { name: 'state-0-of-5-desktop-1280x720', width: 1280, height: 720, state: 0 },
  { name: 'state-1-of-5-desktop-1280x720', width: 1280, height: 720, state: 1 },
  { name: 'state-2-of-5-desktop-1280x720', width: 1280, height: 720, state: 2 },
  { name: 'state-3-of-5-desktop-1280x720', width: 1280, height: 720, state: 3 },
  { name: 'state-4-of-5-desktop-1280x720', width: 1280, height: 720, state: 4 },
  { name: 'state-5-of-5-desktop-1280x720', width: 1280, height: 720, state: 5 },
  { name: 'state-5-of-5-mobile-390x844', width: 390, height: 844, state: 5 },
  { name: 'state-5-of-5-tablet-768x1024', width: 768, height: 1024, state: 5 },
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function openPreview(page, state) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene?.isActive('StartScene'));
  await page.evaluate((assemblyState) => {
    window.__ROBOTLAB_GAME__.scene.start('RobotAssemblyPreviewScene', { state: assemblyState });
  }, state);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene?.isActive('RobotAssemblyPreviewScene'));
  await page.waitForTimeout(120);
}

async function inspect(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('RobotAssemblyPreviewScene');
    const robot = scene.children.getByName('assembly-robot');
    const stand = scene.children.getByName('assembly-repair-stand');
    const label = scene.children.getByName('assembly-state-label');
    const title = scene.children.getByName('assembly-preview-title');
    const installedParts = robot.getData('installedParts');
    const visibleInstalled = robot.list.filter((part) => part.name.startsWith('assembly-installed-') && part.visible).map((part) => part.getData('assemblyPart'));
    const blueprintAlphas = robot.list.filter((part) => part.name.startsWith('assembly-blueprint-')).map((part) => part.alpha);
    const robotBounds = robot.getBounds();
    const labelBounds = label.getBounds();
    const titleBounds = title.getBounds();
    const stationTop = robot.getData('stationTop');
    const stationBottom = robot.getData('stationBottom');
    const feetContactY = robot.getData('feetContactY');
    return {
      state: robot.getData('assemblyState'),
      installedParts,
      visibleInstalled,
      blueprintAlphas,
      previewScale: robot.getData('previewScale'),
      helperScale: robot.getData('helperScale'),
      scaleRatio: robot.getData('scaleRatio'),
      centerAlignment: {
        headBody: Math.abs(robot.getData('headCenterX') - robot.getData('bodyCenterX')),
        antennaBody: Math.abs(robot.getData('antennaCenterX') - robot.getData('bodyCenterX')),
      },
      feetContact: { robot: feetContactY, stand: stand.getData('feetContactY'), delta: Math.abs(feetContactY - stand.getData('feetContactY')) },
      shoulderSymmetry: Math.abs(Math.abs(robot.getData('shoulderLeftX')) - Math.abs(robot.getData('shoulderRightX'))),
      robotBounds: { left: robotBounds.left, right: robotBounds.right, top: robotBounds.top, bottom: robotBounds.bottom },
      stationBounds: { top: stationTop, bottom: stationBottom },
      inViewport: robotBounds.left >= 0 && robotBounds.right <= scene.scale.width && titleBounds.top >= 0 && labelBounds.bottom <= scene.scale.height,
      inStation: robotBounds.top >= stationTop - 2 && robotBounds.bottom <= stationBottom + 8,
    };
  });
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const matrix = [];
  for (const target of targets) {
    const context = await browser.newContext({ viewport: { width: target.width, height: target.height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = captureErrors(page);
    await openPreview(page, target.state);
    const state = await inspect(page);
    const screenshot = path.join(screenshotDir, `stage7-1a-${target.name}.png`);
    await page.screenshot({ path: screenshot });
    matrix.push({ ...target, screenshot, ...state, errors });
    await context.close();
  }
  await browser.close();

  const expected = {
    0: [],
    1: ['body'],
    2: ['body', 'head'],
    3: ['legLeft', 'legRight', 'body', 'head'],
    4: ['legLeft', 'legRight', 'armRight', 'armLeft', 'body', 'head'],
    5: ['legLeft', 'legRight', 'armRight', 'armLeft', 'body', 'head', 'antenna'],
  };
  const failures = matrix.flatMap((entry) => {
    const checks = {
      correctParts: JSON.stringify(entry.visibleInstalled) === JSON.stringify(expected[entry.state]),
      scaleWithinBrief: entry.state === 5
        ? entry.scaleRatio >= 0.69 && entry.scaleRatio <= 0.73
        : entry.scaleRatio >= 0.55 && entry.scaleRatio <= 0.70,
      feetContactCoincides: entry.feetContact.delta < 0.01,
      headBodyCentered: entry.centerAlignment.headBody < 0.01,
      antennaCentered: entry.centerAlignment.antennaBody < 0.01,
      shouldersSymmetric: entry.shoulderSymmetry < 0.01,
      blueprintIsFaint: entry.blueprintAlphas.every((alpha) => alpha <= 0.05),
      robotInViewport: entry.inViewport,
      robotInStation: entry.inStation,
      consoleClean: Object.values(entry.errors).every((items) => items.length === 0),
    };
    entry.checks = checks;
    return Object.entries(checks).filter(([, pass]) => !pass).map(([check]) => `${entry.name}:${check}`);
  });
  const report = { matrix, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage7-1a-assembly-preview-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
