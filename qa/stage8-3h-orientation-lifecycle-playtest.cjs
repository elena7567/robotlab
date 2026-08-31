const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage8-3h-orientation-lifecycle.json');

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function enterMission(page, mission) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await page.evaluate(async (missionNumber) => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    sessionState.reset();
    for (let index = 1; index < missionNumber; index += 1) sessionState.completeCurrentTask();
    if (missionNumber === 1) {
      const { oddOneOutMechanic } = await import('/src/game/mechanics/oddOneOut.ts');
      oddOneOutMechanic.reset();
      oddOneOutMechanic.select('odd-ball');
    } else if (missionNumber === 5) {
      const { memoryMechanic } = await import('/src/game/mechanics/memory.ts');
      memoryMechanic.reset();
      memoryMechanic.select(memoryMechanic.snapshot.cards[0].id);
    } else if (missionNumber === 7) {
      const { connectionsMechanic } = await import('/src/game/mechanics/connections.ts');
      connectionsMechanic.reset();
      connectionsMechanic.connect('red', 'red');
    } else if (missionNumber === 8) {
      const { programmingMechanic } = await import('/src/game/mechanics/programming.ts');
      programmingMechanic.reset();
    }
    window.__ROBOTLAB_GAME__.scene.start(missionNumber <= 5 ? 'GameScene' : `Mission${missionNumber}Scene`);
  }, mission);
  const sceneKey = mission <= 5 ? 'GameScene' : `Mission${mission}Scene`;
  await page.waitForFunction((key) => window.__ROBOTLAB_GAME__.scene.isActive(key), sceneKey);
  if (mission === 8) {
    const point = await page.evaluate(() => {
      const button = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('program-command-RIGHT');
      return button.getWorldTransformMatrix().transformPoint(0, 0);
    });
    await page.touchscreen.tap(point.x, point.y);
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForFunction(() => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
      const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
      return scene.children.list.flatMap(walk).filter((item) => item.name?.startsWith('programming-preview-')).length >= 5;
    });
  }
  return sceneKey;
}

async function waitForCommit(page, width, height, sceneKey) {
  await page.waitForFunction(({ width, height, sceneKey }) => {
    const game = window.__ROBOTLAB_GAME__;
    const commit = game?.registry.get('committedViewport');
    const layout = game?.registry.get('responsiveLayout');
    return game?.scene.isActive(sceneKey)
      && commit?.viewport.visualViewportWidth === width && commit?.viewport.visualViewportHeight === height
      && commit.parentSize.width === width && commit.parentSize.height === height
      && commit.displaySize.width === width && commit.displaySize.height === height
      && commit.gameSize.width === width && commit.gameSize.height === height
      && layout?.viewportWidth === width && layout?.viewportHeight === height;
  }, { width, height, sceneKey }, { timeout: 10000 });
  await page.waitForTimeout(100);
}

async function snapshot(page, mission, sceneKey) {
  return page.evaluate(async ({ mission, sceneKey }) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(sceneKey);
    const commit = game.registry.get('committedViewport');
    const layout = game.registry.get('responsiveLayout');
    const canvasRect = game.canvas.getBoundingClientRect();
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const round = (value) => Math.round((Number(value) || 0) * 1000) / 1000;
    const robots = all.filter((item) => item?.getData?.('characterRole') || item?.name === 'programming-robot').map((item) => ({
      name: item.name, role: item.getData?.('characterRole') || 'BOARD_ACTOR',
      x: round(item.x), y: round(item.y), scaleX: round(item.scaleX), scaleY: round(item.scaleY),
    }));
    const mechanic = mission === 1 ? (await import('/src/game/mechanics/oddOneOut.ts')).oddOneOutMechanic.snapshot
      : mission === 5 ? (await import('/src/game/mechanics/memory.ts')).memoryMechanic.snapshot
      : mission === 7 ? (await import('/src/game/mechanics/connections.ts')).connectionsMechanic.snapshot
      : (await import('/src/game/mechanics/programming.ts')).programmingMechanic.snapshot;
    const card = mission === 7 ? scene.children.getByName('connection-task-card') : null;
    const board = mission === 8 ? scene.children.getByName('programming-board') : null;
    const ports = mission === 7 ? card.list.filter((item) => item.name?.startsWith('connection-source-') || item.name?.startsWith('connection-target-'))
      .map((item) => ({ name: item.name, x: round(item.x), y: round(item.y) })) : [];
    const preview = mission === 8 ? board.list.find((item) => item.name === 'programming-route-preview') : null;
    const slotCommands = mission === 8 ? all.filter((item) => item.name?.startsWith('program-slot-'))
      .sort((a, b) => a.name.localeCompare(b.name)).map((slot) => slot.list.find((item) => typeof item.text === 'string')?.text || '') : [];
    const geometry = {
      visualViewport: { width: round(window.visualViewport?.width ?? innerWidth), height: round(window.visualViewport?.height ?? innerHeight) },
      inner: { width: innerWidth, height: innerHeight }, parentSize: commit.parentSize,
      displaySize: commit.displaySize, gameSize: commit.gameSize,
      canvasCss: { width: round(canvasRect.width), height: round(canvasRect.height) },
      canvasPixels: { width: game.canvas.width, height: game.canvas.height },
      compositionMode: layout.semanticMode, generation: commit.generation,
    };
    return {
      geometry, mechanic, robots, ports,
      wireConnected: card?.getData('connected') || [],
      previewChildren: preview?.list?.length || 0,
      previewStepCount: preview?.getData('stepCount') || 0,
      previewVisualCount: all.filter((item) => item.name?.startsWith('programming-preview-')).length,
      slotCommands,
      previewCommands: scene.children.getByName('program-strip')?.getData('commands') || [],
      resizeListeners: game.scale.listenerCount('resize'),
      checks: {
        sync: ['parentSize', 'displaySize', 'gameSize', 'canvasCss', 'canvasPixels'].every((key) =>
          geometry[key].width === geometry.visualViewport.width && geometry[key].height === geometry.visualViewport.height),
        uniformRobots: robots.every((robot) => robot.scaleX === robot.scaleY),
      },
    };
  }, { mission, sceneKey });
}

function canonical(value) {
  const clone = structuredClone(value);
  delete clone.geometry.generation;
  return JSON.stringify(clone);
}

async function runCase(browser, mission, portrait, cycles, capture) {
  const [portraitWidth, portraitHeight] = portrait;
  const landscape = [portraitHeight, portraitWidth];
  const context = await browser.newContext({ viewport: { width: portraitWidth, height: portraitHeight }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  const sceneKey = await enterMission(page, mission);
  await waitForCommit(page, portraitWidth, portraitHeight, sceneKey);
  const initial = await snapshot(page, mission, sceneKey);
  if (capture) await page.screenshot({ path: path.join(screenshotDir, `stage8-3h-mission${mission}-${portraitWidth}x${portraitHeight}-initial.png`) });
  const states = [initial];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    await page.setViewportSize({ width: landscape[0], height: landscape[1] });
    await waitForCommit(page, landscape[0], landscape[1], sceneKey);
    states.push(await snapshot(page, mission, sceneKey));
    if (capture && cycle === 1) await page.screenshot({ path: path.join(screenshotDir, `stage8-3h-mission${mission}-${landscape[0]}x${landscape[1]}-cycle1.png`) });
    await page.setViewportSize({ width: portraitWidth, height: portraitHeight });
    await waitForCommit(page, portraitWidth, portraitHeight, sceneKey);
    states.push(await snapshot(page, mission, sceneKey));
    if (capture && (cycle === 1 || cycle === cycles)) await page.screenshot({ path: path.join(screenshotDir, `stage8-3h-mission${mission}-${portraitWidth}x${portraitHeight}-cycle${cycle}.png`) });
  }
  const final = states.at(-1);
  const stateKey = mission === 1 ? 'selectedKey' : mission === 5 ? 'firstCardId' : mission === 7 ? 'connected' : 'commands';
  const checks = {
    allGeometrySynced: states.every((state) => state.checks.sync),
    noNonUniformRobotScale: states.every((state) => state.checks.uniformRobots),
    deterministicPortrait: canonical(initial) === canonical(final),
    statePreserved: JSON.stringify(initial.mechanic[stateKey]) === JSON.stringify(final.mechanic[stateKey]),
    listenerStable: states.every((state) => state.resizeListeners === initial.resizeListeners),
    errors: Object.values(errors).every((items) => items.length === 0),
    ...(mission === 7 ? { wirePreserved: final.wireConnected.includes('red'), wireRedrawn: final.ports.length === 6 } : {}),
    ...(mission === 8 ? { commandsPreserved: final.slotCommands[0] === '→' && final.slotCommands[1] === '→', routePreviewRebuilt: final.previewVisualCount >= 5 } : {}),
  };
  await context.close();
  return { mission, portrait: `${portraitWidth}x${portraitHeight}`, landscape: `${landscape[0]}x${landscape[1]}`, cycles, states, errors, checks };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const cases = [];
  for (const mission of [1, 5, 7, 8]) cases.push(await runCase(browser, mission, [390, 844], 5, mission === 7 || mission === 8));
  cases.push(await runCase(browser, 8, [412, 915], 5, false));
  cases.push(await runCase(browser, 8, [393, 852], 5, false));
  await browser.close();
  const failures = cases.flatMap((entry) => Object.entries(entry.checks).filter(([, passed]) => !passed)
    .map(([check]) => `mission${entry.mission}:${entry.portrait}:${check}`));
  const report = { cases, failures };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ failures, cases: cases.map(({ mission, portrait, landscape, cycles, checks }) => ({ mission, portrait, landscape, cycles, checks })) }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
