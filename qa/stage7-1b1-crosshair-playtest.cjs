const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const targets = [
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['desktop-1280x720', 1280, 720, false],
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function pointFor(page, name, sceneKey) {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const find = (item) => {
      if (item?.name === name || item?.text === name) return item;
      for (const child of item?.list || []) {
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    const target = scene.children.list.map(find).find(Boolean);
    if (!target) throw new Error(`Missing ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, sceneKey, touch) {
  const point = await pointFor(page, name, sceneKey);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(120);
}

async function inspectCompact(page, state) {
  return page.evaluate((progress) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const panel = scene.children.getByName('progress-panel');
    panel.setValue(progress);
    const layer = panel.getByName('assembly-progress-layer');
    const robot = layer.getByName('assembly-progress-robot');
    return {
      station: Boolean(layer.getByName('assembly-progress-station')),
      label: layer.getByName('assembly-progress-label')?.text,
      state: robot.getData('assemblyState'),
      installedParts: robot.getData('installedParts'),
    };
  }, state);
}

async function inspectFull(page, state) {
  await page.evaluate((progress) => window.__ROBOTLAB_GAME__.scene.start('RobotAssemblyPreviewScene', { state: progress }), state);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('RobotAssemblyPreviewScene'));
  await page.waitForTimeout(100);
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('RobotAssemblyPreviewScene');
    const robot = scene.children.getByName('assembly-robot');
    return {
      station: Boolean(scene.children.getByName('assembly-repair-stand')),
      state: robot.getData('assemblyState'),
      installedParts: robot.getData('installedParts'),
    };
  });
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const compactSource = fs.readFileSync(path.join('src', 'game', 'ui', 'ProgressPanel.ts'), 'utf8');
  const fullSource = fs.readFileSync(path.join('src', 'game', 'scenes', 'RobotAssemblyPreviewScene.ts'), 'utf8');
  const sourceChecks = {
    compactDiagonalCommandsRemoved: !compactSource.includes('lineBetween(stationLeft + 8, stationTop + 8')
      && !compactSource.includes('lineBetween(width - 12, stationTop + 8'),
    fullInteriorOpaque: fullSource.includes('fillStyle(0x0b2238, 1)') && !fullSource.includes('fillStyle(0x0b2238, 0.68)'),
  };
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const matrix = [];
  for (const [name, width, height, touch] of targets) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = captureErrors(page);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
    await activate(page, 'Играть', 'StartScene', touch);
    const compactStates = [];
    for (let state = 0; state <= 5; state += 1) compactStates.push(await inspectCompact(page, state));
    await inspectCompact(page, 0);
    await page.screenshot({ path: path.join(screenshotDir, `stage7-1b1-${name}-compact-0-of-5.png`) });
    await inspectCompact(page, 5);
    await page.screenshot({ path: path.join(screenshotDir, `stage7-1b1-${name}-compact-5-of-5.png`) });

    const fullStates = [];
    for (let state = 0; state <= 5; state += 1) fullStates.push(await inspectFull(page, state));
    await inspectFull(page, 0);
    await page.screenshot({ path: path.join(screenshotDir, `stage7-1b1-${name}-full-0-of-5.png`) });
    await inspectFull(page, 5);
    await page.screenshot({ path: path.join(screenshotDir, `stage7-1b1-${name}-full-5-of-5.png`) });
    const checks = {
      compactAllStates: compactStates.every((entry, state) => entry.station && entry.state === state && entry.label === `СБОРКА ${state}/5`),
      fullAllStates: fullStates.every((entry, state) => entry.station && entry.state === state),
      errors: Object.values(errors).every((items) => items.length === 0),
    };
    matrix.push({ name, width, height, compactStates, fullStates, checks, errors });
    await context.close();
  }
  await browser.close();
  const failures = [
    ...Object.entries(sourceChecks).filter(([, pass]) => !pass).map(([check]) => `source:${check}`),
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, pass]) => !pass).map(([check]) => `${entry.name}:${check}`)),
  ];
  const report = { sourceChecks, matrix, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage7-1b1-crosshair-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ sourceChecks, matrix: matrix.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
