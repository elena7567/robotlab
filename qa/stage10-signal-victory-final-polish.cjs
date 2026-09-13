const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const outDir = path.join(process.cwd(), 'docs', 'qa', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const mobileSignalViewports = [
  { width: 740, height: 360 },
  { width: 844, height: 390 },
  { width: 915, height: 412 },
];
const desktopSignalViewports = [
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
];
const victoryViewports = [
  { width: 844, height: 390 },
  { width: 915, height: 412 },
  { width: 1280, height: 720 },
];
const wantedConfigs = ['SIGNAL_A', 'SIGNAL_B', 'SIGNAL_C'];

function qaUrl(stage) {
  const url = new URL(baseUrl);
  url.searchParams.set('qaMission', '10');
  url.searchParams.set('stage', stage);
  return url.toString();
}

function center(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function waitForScene(page, scene) {
  await page.waitForFunction((sceneKey) => window.__ROBOTLAB_GAME__?.scene.isActive(sceneKey), scene, { timeout: 90000 });
  await page.waitForTimeout(120);
}

async function setSignalConfig(page, configId) {
  await page.evaluate((configId) => {
    const qa = window.__ROBOTLAB_QA__;
    for (let seed = 0; seed < 5000; seed += 1) {
      qa.mission10Controller.initializeStageShortcut('signal', seed);
      if (qa.mission10Controller.snapshot.signalConfigId === configId) {
        const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');
        scene.scene.restart();
        return seed;
      }
    }
    throw new Error(`No seed found for ${configId}`);
  }, configId);
  await waitForScene(page, 'Mission10Scene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission10SignalPresentation')?.groupName === 'SIGNAL_PUZZLE_GROUP', null, { timeout: 10000 });
}

async function signalMetrics(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');
    const walk = (items, name, found = []) => {
      for (const item of items) {
        if (item.name === name) found.push(item);
        if (item.list) walk(item.list, name, found);
      }
      return found;
    };
    const one = (name) => walk(scene.children.list, name)[0] || null;
    const manyPrefix = (prefix) => {
      const found = [];
      const visit = (items) => {
        for (const item of items) {
          if (item.name?.startsWith(prefix)) found.push(item);
          if (item.list) visit(item.list);
        }
      };
      visit(scene.children.list);
      return found;
    };
    const bounds = (item) => item?.getBounds ? ((b) => ({ x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }))(item.getBounds()) : null;
    const presentation = scene.game.registry.get('mission10SignalPresentation');
    const snapshot = window.__ROBOTLAB_QA__.mission10Controller.snapshot;
    const group = one('SIGNAL_PUZZLE_GROUP');
    const emitter = one('mission10-signal-emitter');
    const receiver = one('mission10-signal-receiver');
    const robot = one('mission10-robot-v2');
    const title = one('mission10-title');
    const progress = one('mission10-progress');
    const targets = manyPrefix('mission10-reflector-target-');
    const reflectors = manyPrefix('mission10-reflector-').filter((item) => item.getData?.('reflectorId') && !item.name.includes('target')); 
    const beam = one('mission10-signal-beam');
    return {
      viewport: { width: scene.scale.width, height: scene.scale.height },
      configId: snapshot.signalConfigId,
      reflectorCount: reflectors.length,
      propSize: presentation?.propSize,
      coreWidth: presentation?.coreWidth,
      field: presentation?.field,
      groupName: presentation?.groupName,
      groupExists: Boolean(group),
      emitter: bounds(emitter),
      receiver: bounds(receiver),
      robot: bounds(robot),
      title: bounds(title),
      progress: bounds(progress),
      beamExists: Boolean(beam),
      targets: targets.map(bounds),
      reflectors: reflectors.map(bounds),
      targetInputs: targets.map((target) => Boolean(target.input?.enabled)),
    };
  });
}

function intersects(a, b) {
  return a && b && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

async function victoryMetrics(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('VictoryScene');
    const one = (name) => scene.children.getByName(name) || null;
    const bounds = (item) => item?.getBounds ? ((b) => ({ x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }))(item.getBounds()) : null;
    return {
      playAgain: bounds(one('victory-play-again')),
      playAgainEnabled: Boolean(one('victory-play-again')?.input?.enabled),
      contentHomeExists: Boolean(one('victory-home')),
      globalHome: bounds(one('victory-global-home')),
      globalHomeEnabled: Boolean(one('victory-global-home')?.input?.enabled),
      robot: bounds(one('victory-robot-v2')),
      title: bounds(one('victory-title')),
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const checks = [];
  const screenshots = [];
  const errors = [];
  const add = (name, ok, details = undefined) => checks.push({ name, ok: Boolean(ok), details });

  async function withPage(viewport, label, action) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 1000, hasTouch: viewport.width < 1000 });
    const page = await context.newPage();
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`${label}: console: ${message.text()}`); });
    page.on('pageerror', (error) => errors.push(`${label}: page: ${error.stack || error.message}`));
    page.on('requestfailed', (request) => errors.push(`${label}: request: ${request.url()} ${request.failure()?.errorText || ''}`));
    page.on('response', (response) => { if (response.status() >= 400) errors.push(`${label}: response: ${response.status()} ${response.url()}`); });
    try { await action(page); } finally { await context.close(); }
  }

  try {
    for (const viewport of mobileSignalViewports) {
      for (const configId of wantedConfigs) {
        const label = `signal-${configId}-${viewport.width}x${viewport.height}`;
        await withPage(viewport, label, async (page) => {
          await page.goto(qaUrl('signal'), { waitUntil: 'commit', timeout: 45000 });
          await waitForScene(page, 'Mission10Scene');
          await setSignalConfig(page, configId);
          const metrics = await signalMetrics(page);
          const shot = path.join(outDir, `stage10-final-polish-${label}.png`);
          await page.screenshot({ path: shot });
          screenshots.push(shot);
          const expectedReflectors = configId === 'SIGNAL_C' ? 3 : 2;
          const noTargetOverlap = metrics.targets.every((target, index) => metrics.targets.every((other, otherIndex) => index === otherIndex || !intersects(target, other)));
          add(`${label}-group`, metrics.groupExists && metrics.groupName === 'SIGNAL_PUZZLE_GROUP', metrics);
          add(`${label}-reflector-count`, metrics.reflectorCount === expectedReflectors, { count: metrics.reflectorCount, expectedReflectors });
          add(`${label}-prop-size`, metrics.propSize >= 88 && metrics.propSize <= 120, { propSize: metrics.propSize });
          add(`${label}-beam`, metrics.beamExists && metrics.coreWidth >= 6, { coreWidth: metrics.coreWidth });
          add(`${label}-field-dominates`, metrics.field.width >= viewport.width * 0.58 && metrics.field.height >= viewport.height * 0.52, metrics.field);
          add(`${label}-robot-safe`, metrics.robot.x > 6 && metrics.robot.right < viewport.width - 6 && metrics.robot.height <= metrics.field.height * 0.72, metrics.robot);
          add(`${label}-targets`, metrics.targets.length === expectedReflectors && metrics.targetInputs.every(Boolean)
            && metrics.targets.every((target, index) => target.width >= Math.min(metrics.propSize, metrics.reflectors[index]?.width || metrics.propSize)
              && target.height >= Math.min(metrics.propSize, metrics.reflectors[index]?.height || metrics.propSize)) && noTargetOverlap,
            { targets: metrics.targets, reflectors: metrics.reflectors });
          add(`${label}-hud`, metrics.title.y < metrics.field.y && metrics.progress.y < metrics.field.y && !intersects(metrics.progress, { ...metrics.field, right: metrics.field.x + metrics.field.width, bottom: metrics.field.y + metrics.field.height }), { title: metrics.title, progress: metrics.progress, field: metrics.field });
        });
      }
    }

    for (const viewport of desktopSignalViewports) {
      const label = `signal-desktop-${viewport.width}x${viewport.height}`;
      await withPage(viewport, label, async (page) => {
        await page.goto(qaUrl('signal'), { waitUntil: 'commit', timeout: 45000 });
        await waitForScene(page, 'Mission10Scene');
        const metrics = await signalMetrics(page);
        const shot = path.join(outDir, `stage10-final-polish-${label}.png`);
        await page.screenshot({ path: shot });
        screenshots.push(shot);
        add(`${label}-desktop-not-oversized`, metrics.propSize <= 128 && metrics.coreWidth <= 5, { propSize: metrics.propSize, coreWidth: metrics.coreWidth });
        add(`${label}-desktop-readable`, metrics.groupExists && metrics.beamExists && metrics.emitter && metrics.receiver, metrics);
      });
    }

    for (const viewport of victoryViewports) {
      const label = `victory-${viewport.width}x${viewport.height}`;
      await withPage(viewport, label, async (page) => {
        await page.goto(qaUrl('complete'), { waitUntil: 'commit', timeout: 45000 });
        await waitForScene(page, 'VictoryScene');
        const metrics = await victoryMetrics(page);
        const shot = path.join(outDir, `stage10-final-polish-${label}.png`);
        await page.screenshot({ path: shot });
        screenshots.push(shot);
        add(`${label}-one-primary-cta`, metrics.playAgainEnabled && !metrics.contentHomeExists, metrics);
        add(`${label}-global-home`, metrics.globalHomeEnabled, metrics.globalHome);
        add(`${label}-layout`, metrics.robot && metrics.title && metrics.playAgain && !intersects(metrics.playAgain, metrics.robot), metrics);
      });
    }

    await withPage({ width: 844, height: 390 }, 'victory-play-again-reset', async (page) => {
      await page.goto(qaUrl('complete'), { waitUntil: 'commit', timeout: 45000 });
      await waitForScene(page, 'VictoryScene');
      const metrics = await victoryMetrics(page);
      await page.mouse.click(center(metrics.playAgain).x, center(metrics.playAgain).y);
      await waitForScene(page, 'GameScene');
      const state = await page.evaluate(() => ({
        currentTask: window.__ROBOTLAB_QA__.sessionState.snapshot.currentTask,
        completedTasks: window.__ROBOTLAB_QA__.sessionState.snapshot.completedTasks,
        mission10Stage: window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage,
        soundCount: window.__ROBOTLAB_GAME__.sound.sounds.length,
      }));
      add('play-again-reset', state.currentTask === 1 && state.completedTasks === 0 && state.mission10Stage === 'INTRO', state);
    });

    await withPage({ width: 844, height: 390 }, 'victory-global-home-reset', async (page) => {
      await page.goto(qaUrl('complete'), { waitUntil: 'commit', timeout: 45000 });
      await waitForScene(page, 'VictoryScene');
      const metrics = await victoryMetrics(page);
      await page.mouse.click(center(metrics.globalHome).x, center(metrics.globalHome).y);
      await waitForScene(page, 'StartScene');
      const state = await page.evaluate(() => ({
        currentTask: window.__ROBOTLAB_QA__.sessionState.snapshot.currentTask,
        completedTasks: window.__ROBOTLAB_QA__.sessionState.snapshot.completedTasks,
        mission10Stage: window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage,
      }));
      add('global-home-reset', state.currentTask === 1 && state.completedTasks === 0 && state.mission10Stage === 'INTRO', state);
    });
  } finally {
    await browser.close();
  }

  const ok = checks.every((check) => check.ok) && errors.length === 0;
  const report = { result: ok ? 'PASS' : 'FAIL', checks, errors, screenshots };
  const reportPath = path.join(process.cwd(), 'docs', 'qa', 'stage10-signal-victory-final-polish.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!ok) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });