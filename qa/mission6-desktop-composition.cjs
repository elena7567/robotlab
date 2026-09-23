const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/?qaMission=6';
const screenshotsDir = path.join('docs', 'qa', 'screenshots');
const out = path.join('docs', 'qa', 'mission6-desktop-composition.json');
const desktopViewports = [[1280, 720], [1438, 914], [1600, 900], [1920, 1080]];
const requiredScreenshots = new Map([
  ['1280x720', 'mission6-final-desktop-1280x720.png'],
  ['1600x900', 'mission6-final-desktop-1600x900.png'],
  ['1920x1080', 'mission6-final-desktop-1920x1080.png'],
]);
const mobileViewports = [[390, 844], [844, 390]];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => Math.round(value * 100) / 100;
const report = { result: 'PENDING', checks: [], errors: [], desktop: [], mobile: [], screenshots: [], playtest: {} };
const check = (name, ok, actual = null) => report.checks.push({ name, ok, actual });

fs.mkdirSync(screenshotsDir, { recursive: true });

async function attachErrors(page) {
  page.on('pageerror', (error) => report.errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('requestfailed', (request) => report.errors.push(request.url()));
}

async function waitForMission6(page) {
  let last;
  for (let i = 0; i < 240; i += 1) {
    last = await page.evaluate(() => {
      const game = window.__ROBOTLAB_GAME__;
      if (!game?.scene) return { ok: false, active: [] };
      const active = game.scene.getScenes(true).map((scene) => scene.scene.key);
      return { ok: game.scene.isActive('Mission6Scene'), active };
    }).catch((error) => ({ ok: false, error: error.message }));
    if (last.ok) return;
    await sleep(250);
  }
  throw new Error(`Mission 6 did not become active: ${JSON.stringify(last)}`);
}

async function waitForChallenge(page, index) {
  let last;
  for (let i = 0; i < 80; i += 1) {
    last = await page.evaluate(() => window.__ROBOTLAB_QA__?.energyMechanic?.snapshot).catch(() => null);
    if (last?.challengeIndex === index && last.result === 'idle') return last;
    await sleep(100);
  }
  throw new Error(`Challenge ${index} did not become idle: ${JSON.stringify(last)}`);
}

function center(rect) {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission6Scene');
    const all = [];
    const walk = (object) => {
      all.push(object);
      if (object?.list) object.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    const find = (name) => all.find((object) => object.name === name);
    const allNamed = (name) => all.filter((object) => object.name === name);
    const bounds = (object) => {
      if (!object) return null;
      const audit = object.getData?.('auditBounds');
      if (audit) return { left: audit.x, right: audit.x + audit.width, top: audit.y, bottom: audit.y + audit.height, width: audit.width, height: audit.height };
      if (!object.getBounds) return null;
      const box = object.getBounds();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const minInstalledAlpha = (robot) => {
      const parts = [];
      const visit = (object) => {
        if (object?.name?.startsWith?.('assembly-installed-') && object.visible) parts.push(object.alpha);
        if (object?.list) object.list.forEach(visit);
      };
      visit(robot);
      return parts.length ? Math.min(...parts) : null;
    };
    const cardObject = find('energy-task-card');
    const helper = find('grounded-robot');
    const assembled = find('mission6-repaired-robot');
    const systems = find('systems-progress');
    const composition = game.registry.get('sceneComposition')?.mission6;
    const telemetry = game.registry.get('mission6CompositionTelemetry');
    const card = composition ? {
      left: composition.card.x,
      right: composition.card.x + composition.card.width,
      top: composition.card.y,
      bottom: composition.card.y + composition.card.height,
      width: composition.card.width,
      height: composition.card.height,
    } : bounds(cardObject);
    return {
      active: scene.scene.key,
      semantic: game.registry.get('responsiveLayout')?.semanticMode,
      viewport: { width: game.scale.width, height: game.scale.height },
      composition,
      telemetry,
      snapshot: window.__ROBOTLAB_QA__?.energyMechanic?.snapshot,
      session: window.__ROBOTLAB_QA__?.sessionState?.snapshot,
      card,
      helper: bounds(helper),
      assembled: bounds(assembled),
      systems: bounds(systems),
      assembledAlpha: assembled?.alpha ?? null,
      assembledInstalledAlpha: minInstalledAlpha(assembled),
      assembledCount: allNamed('mission6-repaired-robot').length,
      antennaCount: all.filter((object) => object.name === 'assembly-installed-antenna' && object.visible).length,
      labels: all.map((object) => object.text).filter((text) => typeof text === 'string'),
      objects: all.map((object) => object.name).filter(Boolean),
    };
  });
}

async function objectCenter(page, name) {
  return page.evaluate((targetName) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene');
    const walk = (object) => {
      if (object?.name === targetName) return object;
      if (object?.list) {
        for (const child of object.list) {
          const found = walk(child);
          if (found) return found;
        }
      }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Missing object ${targetName}`);
    const box = target.getBounds?.();
    if (box) return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
    const point = target.getWorldTransformMatrix().transformPoint(0, 0);
    return { x: point.x, y: point.y };
  }, name);
}

async function clickObject(page, name) {
  const point = await objectCenter(page, name);
  await page.mouse.click(point.x, point.y);
  await sleep(260);
}

async function inspectDesktop(page, viewportName) {
  const info = await inspect(page);
  const cardCenterX = (info.card.left + info.card.right) / 2;
  const helperCenterX = (info.helper.left + info.helper.right) / 2;
  const assembledCenterX = (info.assembled.left + info.assembled.right) / 2;
  const platformCenterX = info.telemetry.platformCenterX;
  const cardBottom = info.card.bottom;
  const platformSurfaceAtCardX = info.telemetry.platformSurfaceAtCardX;
  const metrics = {
    viewport: viewportName,
    semantic: info.semantic,
    platformCenterX: round(platformCenterX),
    cardCenterX: round(cardCenterX),
    cardCenterDeltaX: round(cardCenterX - platformCenterX),
    cardBottom: round(cardBottom),
    platformSurfaceAtCardX: round(platformSurfaceAtCardX),
    cardClearance: round(platformSurfaceAtCardX - cardBottom),
    helperX: round(helperCenterX),
    helperBottom: round(info.helper.bottom),
    helperGroundY: round(info.telemetry.helperGroundY),
    helperGroundDelta: round(info.helper.bottom - info.telemetry.helperGroundY),
    assembledX: round(assembledCenterX),
    assembledBottom: round(info.assembled.bottom),
    assembledGroundY: round(info.telemetry.assembledGroundY),
    assembledGroundDelta: round(info.assembled.bottom - info.telemetry.assembledGroundY),
    assembledAlpha: info.assembledAlpha,
    assembledInstalledAlpha: info.assembledInstalledAlpha,
    helperCardGap: round(info.card.left - info.helper.right),
    cardAssembledGap: round(info.assembled.left - info.card.right),
    helperScale: info.telemetry.helperScale,
    assembledScale: info.telemetry.assembledScale,
    assembledCount: info.assembledCount,
    antennaCount: info.antennaCount,
    systemsCenterX: info.systems ? round((info.systems.left + info.systems.right) / 2) : null,
    platformVisible: info.card.bottom < info.telemetry.platformSurfaceAtCardX,
  };
  metrics.pass = Math.abs(metrics.cardCenterDeltaX) <= 4
    && metrics.cardClearance >= 50 && metrics.cardClearance <= 90
    && metrics.helperCardGap > 0
    && metrics.cardAssembledGap > 0
    && Math.abs(metrics.helperGroundDelta) <= 4
    && Math.abs(metrics.assembledGroundDelta) <= 4
    && metrics.assembledAlpha === 1
    && metrics.assembledInstalledAlpha === 1
    && metrics.assembledCount === 1
    && metrics.antennaCount === 1
    && Math.abs(metrics.systemsCenterX - platformCenterX) <= 4
    && metrics.platformVisible === true
    && metrics.helperScale === 0.19
    && metrics.assembledScale === 0.19;
  return { info, metrics };
}

function validateDesktop(metrics) {
  check(`${metrics.viewport} card centered on platform`, Math.abs(metrics.cardCenterDeltaX) <= 4, metrics.cardCenterDeltaX);
  check(`${metrics.viewport} card clearance`, metrics.cardClearance >= 50 && metrics.cardClearance <= 90, metrics.cardClearance);
  check(`${metrics.viewport} helper left of card`, metrics.helperCardGap > 0, metrics.helperCardGap);
  check(`${metrics.viewport} assembled right of card`, metrics.cardAssembledGap > 0, metrics.cardAssembledGap);
  check(`${metrics.viewport} helper grounded`, Math.abs(metrics.helperGroundDelta) <= 4, metrics.helperGroundDelta);
  check(`${metrics.viewport} assembled grounded`, Math.abs(metrics.assembledGroundDelta) <= 4, metrics.assembledGroundDelta);
  check(`${metrics.viewport} assembled fully opaque`, metrics.assembledAlpha === 1 && metrics.assembledInstalledAlpha === 1, { assembledAlpha: metrics.assembledAlpha, installed: metrics.assembledInstalledAlpha });
  check(`${metrics.viewport} one assembled robot`, metrics.assembledCount === 1, metrics.assembledCount);
  check(`${metrics.viewport} antenna visible`, metrics.antennaCount === 1, metrics.antennaCount);
  check(`${metrics.viewport} system status top-center`, Math.abs(metrics.systemsCenterX - metrics.platformCenterX) <= 4, metrics.systemsCenterX);
  check(`${metrics.viewport} platform visible under card`, metrics.platformVisible === true, metrics.platformVisible);
  check(`${metrics.viewport} robot scales unchanged`, metrics.helperScale === 0.19 && metrics.assembledScale === 0.19, { helper: metrics.helperScale, assembled: metrics.assembledScale });
}

async function runDesktopMatrix(browser) {
  for (const [width, height] of desktopViewports) {
    const viewportName = `${width}x${height}`;
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await attachErrors(page);
    await page.goto(baseUrl, { waitUntil: 'load', timeout: 90000 });
    await waitForMission6(page);
    await sleep(900);
    const { metrics } = await inspectDesktop(page, viewportName);
    validateDesktop(metrics);
    report.desktop.push(metrics);
    const screenshotName = requiredScreenshots.get(viewportName);
    if (screenshotName) {
      const screenshotPath = path.join(screenshotsDir, screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      report.screenshots.push(screenshotPath);
    }
    await context.close();
  }
}

async function runMobileRegression(browser) {
  for (const [width, height] of mobileViewports) {
    const viewportName = `${width}x${height}`;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 600 });
    const page = await context.newPage();
    await attachErrors(page);
    await page.goto(baseUrl, { waitUntil: 'load', timeout: 90000 });
    await waitForMission6(page);
    await sleep(700);
    const info = await inspect(page);
    const mobile = {
      viewport: viewportName,
      semantic: info.semantic,
      cardPresent: Boolean(info.card),
      hasHelper: info.objects.includes('grounded-robot'),
      hasAssembled: info.objects.includes('mission6-repaired-robot'),
    };
    mobile.pass = mobile.cardPresent && mobile.hasAssembled && (info.semantic !== 'DESKTOP');
    report.mobile.push(mobile);
    check(`${viewportName} mobile regression`, mobile.pass, mobile);
    await context.close();
  }
}

async function runMission6Flow(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await attachErrors(page);
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 90000 });
  await waitForMission6(page);
  await sleep(700);

  await clickObject(page, 'energy-battery-low');
  check('battery low clickable', (await inspect(page)).snapshot.selection === 'low');
  await clickObject(page, 'energy-battery-medium');
  check('battery medium clickable', (await inspect(page)).snapshot.selection === 'medium');
  await clickObject(page, 'energy-battery-full');
  check('battery full clickable', (await inspect(page)).snapshot.selection === 'full');

  await clickObject(page, 'energy-battery-low');
  await clickObject(page, 'energy-check-button');
  let info = await inspect(page);
  check('wrong answer remains wrong without progress', info.snapshot.result === 'wrong' && info.snapshot.challengeIndex === 0 && info.session.completedTasks === 5, { snapshot: info.snapshot, session: info.session });
  await clickObject(page, 'energy-hint-button');
  info = await inspect(page);
  check('Hint works', info.snapshot.hintShown === true, info.snapshot);

  await clickObject(page, 'energy-battery-full');
  await clickObject(page, 'energy-check-button');
  await waitForChallenge(page, 1);
  info = await inspect(page);
  check('correct answer progresses to round 2', info.snapshot.challengeIndex === 1 && info.snapshot.result === 'idle', info.snapshot);

  await clickObject(page, 'energy-battery-low');
  await clickObject(page, 'energy-check-button');
  await waitForChallenge(page, 2);
  info = await inspect(page);
  check('round 2 correct answer progresses to round 3', info.snapshot.challengeIndex === 2 && info.snapshot.result === 'idle', info.snapshot);

  for (const level of ['low', 'medium', 'full']) await clickObject(page, `energy-battery-${level}`);
  await clickObject(page, 'energy-check-button');
  await sleep(2200);
  info = await inspect(page);
  check('3 energy rounds complete', info.snapshot.completed === true && info.session.powerActivated === true, { snapshot: info.snapshot, session: info.session });
  check('assembled remains opaque after activation', info.assembledAlpha === 1 && info.assembledInstalledAlpha === 1, { alpha: info.assembledAlpha, installed: info.assembledInstalledAlpha });
  await clickObject(page, 'mission6-continue');
  await sleep(700);
  const handoff = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    return game.scene.getScenes(true).map((scene) => scene.scene.key);
  });
  check('Mission 6 to Mission 7 handoff works', handoff.includes('Mission7OrientationGuardScene') || handoff.includes('Mission7Scene'), handoff);
  report.playtest.handoff = handoff;
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2'] });
  try {
    await runDesktopMatrix(browser);
    await runMobileRegression(browser);
    await runMission6Flow(browser);
  } finally {
    await browser.close();
  }
  check('no console/page/request errors', report.errors.length === 0, report.errors);
  report.result = report.checks.every((item) => item.ok) && report.errors.length === 0 ? 'PASS' : 'FAIL';
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  if (report.result !== 'PASS') {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => {
  report.result = 'FAIL';
  report.errors.push(error.stack || error.message || String(error));
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.error(error);
  process.exit(1);
});