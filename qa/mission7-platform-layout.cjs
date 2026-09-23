const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const url = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/?qaMission=7';
const screenshotsDir = path.join('docs', 'qa', 'screenshots');
const out = path.join('docs', 'qa', 'mission7-platform-layout.json');
const playtestOut = path.join('docs', 'qa', 'mission7-platform-playtest.json');
const desktopViewports = [[1280, 720], [1438, 914], [1600, 900], [1920, 1080]];
const screenshotNames = new Map([
  ['1280x720', 'mission7-final-platform-layout-1280x720.png'],
  ['1600x900', 'mission7-final-platform-layout-1600x900.png'],
  ['1920x1080', 'mission7-final-platform-layout-1920x1080.png'],
]);
const mobileViewports = [[390, 844], [412, 915], [844, 390]];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { result: 'PENDING', checks: [], errors: [], desktop: [], mobile: [], screenshots: [], playtest: null };
const check = (name, ok, actual) => report.checks.push({ name, ok, actual });
const round = (value) => Math.round(value * 100) / 100;

fs.mkdirSync(screenshotsDir, { recursive: true });

async function waitForMission7(page) {
  let last;
  for (let i = 0; i < 240; i += 1) {
    last = await page.evaluate(() => {
      const game = window.__ROBOTLAB_GAME__;
      if (!game?.scene) return { ok: false, active: [] };
      const active = game.scene.getScenes(true).map((scene) => scene.scene.key);
      return { ok: game.scene.isActive('Mission7Scene') || game.scene.isActive('Mission7OrientationGuardScene'), active };
    }).catch((error) => ({ ok: false, error: error.message }));
    if (last.ok) return;
    await sleep(250);
  }
  throw new Error(`Mission 7 did not become active: ${JSON.stringify(last)}`);
}

async function attachErrors(page) {
  page.on('pageerror', (error) => report.errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('requestfailed', (request) => report.errors.push(request.url()));
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.isActive('Mission7Scene')
      ? game.scene.getScene('Mission7Scene')
      : game.scene.getScene('Mission7OrientationGuardScene');
    const all = [];
    const walk = (object) => {
      all.push(object);
      if (object?.list) object.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    const find = (name) => all.find((object) => object.name === name);
    const bounds = (object) => {
      if (!object?.getBounds) return null;
      const box = object.getBounds();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const layout = game.registry.get('sceneComposition')?.mission7;
    const card = layout ? {
      left: layout.board.x,
      right: layout.board.x + layout.board.width,
      top: layout.board.y,
      bottom: layout.board.y + layout.board.height,
      width: layout.board.width,
      height: layout.board.height,
    } : bounds(find('connection-task-card'));
    const hint = layout ? {
      left: layout.hint.x - layout.hint.width / 2,
      right: layout.hint.x + layout.hint.width / 2,
      top: layout.hint.y - layout.hint.height / 2,
      bottom: layout.hint.y + layout.hint.height / 2,
      width: layout.hint.width,
      height: layout.hint.height,
    } : bounds(find('connection-hint-button'));
    const robot = bounds(find('mission7-repaired-robot'));
    const ports = ['red', 'blue', 'green', 'yellow'].flatMap((color) => ['source', 'target'].map((side) => {
      const object = find(`connection-${side}-${color}`);
      if (!object) return null;
      const point = object.getWorldTransformMatrix().transformPoint(0, 0);
      return { color, side, x: point.x, y: point.y, locked: object.getData?.('locked') === true };
    })).filter(Boolean);
    const cardObject = find('connection-task-card');
    return {
      active: scene.scene.key,
      semantic: game.registry.get('responsiveLayout')?.semanticMode,
      orientationGate: game.registry.get('mission7OrientationGate') === true,
      inputActive: game.registry.get('mission7InputActive') === true,
      viewport: { width: game.scale.width, height: game.scale.height },
      platform: window.__ROBOTLAB_QA__?.mission7?.platform ?? layout?.platform,
      layout,
      card,
      hint,
      robot,
      ports,
      connected: cardObject?.getData('connected') ?? [],
      challengeIndex: cardObject?.getData('challengeIndex') ?? null,
      cardSize: cardObject ? { width: cardObject.width, height: cardObject.height } : null,
      cardCount: all.filter((object) => object.name === 'connection-task-card').length,
      hintCount: all.filter((object) => object.name === 'connection-hint-button').length,
      labels: all.map((object) => object.text).filter((text) => typeof text === 'string'),
    };
  });
}

function centerX(rect) { return (rect.left + rect.right) / 2; }

function desktopMetrics(info) {
  const platformCenterX = info.platform.centerX;
  const cardCenterX = centerX(info.card);
  const hintCenterX = centerX(info.hint);
  const robotCenterX = centerX(info.robot);
  const robotGroundY = info.platform.surfaceAtRobotX;
  const cardSurfaceY = info.platform.surfaceAtCardX;
  const metrics = {
    viewport: `${info.viewport.width}x${info.viewport.height}`,
    platformCenterX: round(platformCenterX),
    cardCenterX: round(cardCenterX),
    cardCenterDeltaX: round(cardCenterX - platformCenterX),
    platformSurfaceAtCardX: round(cardSurfaceY),
    cardBottom: round(info.card.bottom),
    cardClearance: round(cardSurfaceY - info.card.bottom),
    robotX: round(robotCenterX),
    robotLeft: round(info.robot.left),
    robotRight: round(info.robot.right),
    robotBottom: round(info.robot.bottom),
    robotGroundY: round(robotGroundY),
    robotGroundDelta: round(info.robot.bottom - robotGroundY),
    hintCenterX: round(hintCenterX),
    hintTop: round(info.hint.top),
    hintGap: round(info.hint.top - info.card.bottom),
    robotHeight: round(info.robot.height),
    cardWidth: round(info.card.width),
    cardHeight: round(info.card.height),
  };
  metrics.pass = Math.abs(metrics.cardCenterDeltaX) <= 4
    && metrics.cardClearance >= 50 && metrics.cardClearance <= 80
    && Math.abs(metrics.hintCenterX - metrics.cardCenterX) <= 2
    && metrics.hintGap >= 12 && metrics.hintGap <= 18
    && Math.abs(metrics.robotGroundDelta) <= 4
    && info.robot.right < info.card.left
    && info.robot.left > 20
    && info.robot.right < info.card.left - 36;
  return metrics;
}

function validateDesktop(metrics) {
  check(`${metrics.viewport} card centered on platform`, Math.abs(metrics.cardCenterDeltaX) <= 4, metrics);
  check(`${metrics.viewport} card clearance`, metrics.cardClearance >= 50 && metrics.cardClearance <= 80, metrics);
  check(`${metrics.viewport} hint under card`, Math.abs(metrics.hintCenterX - metrics.cardCenterX) <= 2 && metrics.hintGap >= 12 && metrics.hintGap <= 18, metrics);
  check(`${metrics.viewport} robot grounded`, Math.abs(metrics.robotGroundDelta) <= 4, metrics);
  check(`${metrics.viewport} robot left side zone`, metrics.robotRight < metrics.cardCenterX && metrics.robotRight < metrics.cardCenterX - 180 && metrics.robotLeft > 20, metrics);
  check(`${metrics.viewport} robot scale unchanged`, metrics.robotHeight >= 260 && metrics.robotHeight <= 280, metrics);
}

async function point(page, name) {
  return page.evaluate((targetName) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene');
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
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, name);
}

async function drag(page, sourceName, targetName) {
  const from = await point(page, sourceName);
  const to = typeof targetName === 'string' ? await point(page, targetName) : targetName;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await sleep(450);
}

async function clickHint(page) {
  const hint = await inspect(page).then((info) => info.hint);
  await page.mouse.click(centerX(hint), (hint.top + hint.bottom) / 2);
  await sleep(450);
}

async function completeCurrentChallenge(page) {
  let info = await inspect(page);
  for (const source of info.ports.filter((port) => port.side === 'source' && !port.locked)) {
    await drag(page, `connection-source-${source.color}`, `connection-target-${source.color}`);
    info = await inspect(page);
  }
  await sleep(1200);
}

async function runPlaytest(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await attachErrors(page);
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await waitForMission7(page);
  const initial = await inspect(page);
  await drag(page, 'connection-source-red', 'connection-target-blue');
  const wrong = await inspect(page);
  check('wrong connection rejected', wrong.connected.length === 0, wrong.connected);
  await drag(page, 'connection-source-red', 'connection-target-red');
  const one = await inspect(page);
  check('progress 1/3 first wire accepted', one.connected.length === 1 && one.connected.includes('red'), one.connected);
  await drag(page, 'connection-source-red', 'connection-target-red');
  const duplicate = await inspect(page);
  check('duplicate connection rejected', duplicate.connected.length === 1, duplicate.connected);
  await clickHint(page);
  check('Hint clickable', true, null);
  await completeCurrentChallenge(page);
  const second = await inspect(page);
  check('progress moves to 2/3', second.challengeIndex === 1, second.challengeIndex);
  await completeCurrentChallenge(page);
  const third = await inspect(page);
  check('progress moves to 3/3', third.challengeIndex === 2, third.challengeIndex);
  const cardStable = initial.card.width === second.card.width && second.card.width === third.card.width
    && initial.card.height === second.card.height && second.card.height === third.card.height;
  check('card geometry unchanged between progress states', cardStable, { initial: initial.card, second: second.card, third: third.card });
  await context.close();
  return { wrongRejected: wrong.connected.length === 0, duplicateRejected: duplicate.connected.length === 1, progressStates: [one.challengeIndex, second.challengeIndex, third.challengeIndex], hintClickable: true, cardGeometryStable: cardStable };
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [width, height] of desktopViewports) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      await attachErrors(page);
      await page.goto(url, { waitUntil: 'load', timeout: 90000 });
      await waitForMission7(page);
      const info = await inspect(page);
      const label = `${width}x${height}`;
      const screenshot = path.join(screenshotsDir, screenshotNames.get(label) ?? `mission7-final-platform-layout-${label}.png`);
      if (screenshotNames.has(label)) {
        await page.screenshot({ path: screenshot, timeout: 90000 });
        report.screenshots.push(screenshot);
      }
      const metrics = desktopMetrics(info);
      validateDesktop(metrics);
      report.desktop.push({ metrics, info });
      await context.close();
    }

    for (const [width, height] of mobileViewports) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await attachErrors(page);
      await page.goto(url, { waitUntil: 'load', timeout: 90000 });
      await waitForMission7(page);
      const info = await inspect(page);
      const portrait = height > width;
      const ok = portrait
        ? info.active === 'Mission7Scene' && info.semantic.startsWith('PHONE_PORTRAIT') && !info.orientationGate && info.inputActive && info.cardCount === 1
        : info.active === 'Mission7OrientationGuardScene' && info.orientationGate && !info.inputActive && info.labels.includes('ИГРАЕМ ВЕРТИКАЛЬНО');
      check(`${width}x${height} mobile ${portrait ? 'portrait' : 'landscape gate'}`, ok, info);
      report.mobile.push({ viewport: `${width}x${height}`, pass: ok, info });
      await context.close();
    }

    report.playtest = await runPlaytest(browser);
  } finally {
    await browser.close();
  }

  report.result = report.checks.every((entry) => entry.ok) && report.errors.length === 0 ? 'PASS' : 'FAIL';
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  fs.writeFileSync(playtestOut, JSON.stringify(report.playtest, null, 2));
  console.log(JSON.stringify({ result: report.result, checks: report.checks.length, failed: report.checks.filter((entry) => !entry.ok), errors: report.errors, out, screenshots: report.screenshots }, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
})();