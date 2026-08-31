const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const outputDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['320x568', 320, 568], ['333x885', 333, 885], ['360x800', 360, 800],
  ['360x600', 360, 600], ['360x640', 360, 640], ['390x650', 390, 650], ['390x700', 390, 700],
  ['390x844', 390, 844], ['393x852', 393, 852], ['400x824', 400, 824], ['412x915', 412, 915], ['430x932', 430, 932],
  ['568x320', 568, 320], ['740x360', 740, 360], ['800x360', 800, 360], ['844x390', 844, 390],
  ['824x400', 824, 400], ['915x412', 915, 412], ['932x430', 932, 430],
  ['390x844-ios-safe', 390, 844, { top: 47, right: 0, bottom: 34, left: 0 }],
  ['844x390-ios-safe', 844, 390, { top: 0, right: 47, bottom: 21, left: 47 }],
  ['768x1024', 768, 1024], ['820x1180', 820, 1180], ['1024x768', 1024, 768], ['1180x820', 1180, 820],
  ['1280x720', 1280, 720], ['1438x914', 1438, 914],
];
const screenshotViewports = new Set(['360x600', '390x844', '390x844-ios-safe', '844x390', '844x390-ios-safe', '768x1024', '1024x768', '1280x720', '1438x914']);
const screenshotMissions = new Set([...Array(8)].map((_, index) => index + 1));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function enterMission(page, mission, safeInsets) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await page.evaluate(async ({ missionNumber, safeInsets }) => {
    if (safeInsets) {
      const root = document.documentElement;
      root.style.setProperty('--safe-area-top', `${safeInsets.top}px`);
      root.style.setProperty('--safe-area-right', `${safeInsets.right}px`);
      root.style.setProperty('--safe-area-bottom', `${safeInsets.bottom}px`);
      root.style.setProperty('--safe-area-left', `${safeInsets.left}px`);
    }
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    sessionState.reset();
    for (let index = 1; index < missionNumber; index += 1) sessionState.completeCurrentTask();
    const scene = missionNumber <= 5 ? 'GameScene' : `Mission${missionNumber}Scene`;
    window.__ROBOTLAB_GAME__.scene.start(scene);
  }, { missionNumber: mission, safeInsets });
  const scene = mission <= 5 ? 'GameScene' : `Mission${mission}Scene`;
  await page.waitForFunction((key) => window.__ROBOTLAB_GAME__.scene.isActive(key), scene);
  await page.waitForTimeout(100);
  return scene;
}

async function inspect(page, mission, sceneKey, width, height) {
  return page.evaluate(({ mission, sceneKey, width, height }) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(sceneKey);
    const walk = (item, result = []) => {
      if (!item || item.visible === false || item.active === false) return result;
      result.push(item);
      for (const child of item.list || []) walk(child, result);
      return result;
    };
    const all = scene.children.list.flatMap((item) => walk(item));
    const find = (name) => all.find((item) => item.name === name);
    const bounds = (item) => {
      if (!item?.getBounds) return null;
      const declared = item.getData?.('auditBounds');
      if (declared) return { ...declared, right: declared.x + declared.width, bottom: declared.y + declared.height };
      const value = item.getBounds();
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const inside = (value, tolerance = 2) => value && value.x >= -tolerance && value.y >= -tolerance
      && value.right <= width + tolerance && value.bottom <= height + tolerance;
    const mechanicNames = { 1: 'task-card', 2: 'task-card', 3: 'task-card', 4: 'task-card', 5: 'memory-task-card',
      6: 'energy-task-card', 7: 'connection-task-card', 8: 'programming-board' };
    const robotNames = mission === 8 ? ['programming-robot'] : ['grounded-robot', 'mission6-repaired-robot', 'mission7-repaired-robot'];
    const mechanic = find(mechanicNames[mission]);
    const robots = robotNames.map(find).filter(Boolean).map(bounds).filter(Boolean);
    const interactive = all.filter((item) => item.input?.enabled).map((item) => ({ name: item.name || '', bounds: bounds(item),
      hitWidth: item.input.hitArea?.width ?? item.width ?? 0, hitHeight: item.input.hitArea?.height ?? item.height ?? 0 }));
    const layout = game.registry.get('responsiveLayout');
    const boundsAudit = game.registry.get('boundsAudit');
    const mechanicBounds = bounds(mechanic);
    const boardCellSize = mission === 8 ? mechanic?.getData('cellSize') : undefined;
    const shortLandscape = layout?.semanticMode === 'PHONE_LANDSCAPE_SHORT';
    const shortPortrait = layout?.semanticMode === 'PHONE_PORTRAIT_SHORT';
    const minimumMechanicWidth = shortLandscape ? 180 : Math.min(240, width * 0.72);
    const minimumMechanicHeight = mission >= 7 ? 210 : shortLandscape ? 225 : shortPortrait ? 265 : 285;
    return {
      mission, sceneKey, viewport: { width: game.scale.width, height: game.scale.height },
      mode: layout?.semanticMode ?? layout?.compositionName ?? layout?.mode, mechanic: mechanicBounds, boardCellSize, boundsAudit,
      robots, interactive,
      checks: {
        viewport: game.scale.width === width && game.scale.height === height,
        mechanicInside: inside(mechanicBounds),
        controlsInside: interactive.every((item) => inside(item.bounds)),
        touchTargets: interactive.every((item) => item.hitWidth >= 48 && item.hitHeight >= 48),
        mechanicReadable: mechanicBounds && mechanicBounds.width >= minimumMechanicWidth && mechanicBounds.height >= minimumMechanicHeight,
        robotReadable: mission === 7 || robots.some((item) => item.height >= (mission === 8 ? 58 : 90)),
        noMajorOverlaps: (boundsAudit?.overlapCount ?? 0) === 0,
        safeRect: (boundsAudit?.outsideSafeRect ?? []).length === 0,
        auditedTouchTargets: (boundsAudit?.undersizedTouchTargets ?? []).length === 0,
      },
    };
  }, { mission, sceneKey, width, height });
}

async function touchProbe(page, mission, sceneKey) {
  if (mission === 7) {
    const points = await page.evaluate(() => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene');
      const card = scene.children.getByName('connection-task-card');
      const source = card.list.find((item) => item.name === 'connection-source-red');
      const target = card.list.find((item) => item.name === 'connection-target-red');
      const worldPoint = (item) => item.getWorldTransformMatrix().transformPoint(0, 0);
      return { source: worldPoint(source), target: worldPoint(target) };
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points.source.x, y: points.source.y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: points.target.x, y: points.target.y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100);
    return page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene')
      .children.getByName('connection-task-card')?.getData('connected')?.includes('red'));
  }
  return page.evaluate(async ({ mission, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const prefix = mission <= 4 ? 'choice-' : mission === 5 ? 'memory-card-' : mission === 6 ? 'energy-battery-'
      : mission === 7 ? 'connection-source-' : 'program-command-';
    const target = all.find((item) => item?.name?.startsWith(prefix) && item.input?.enabled);
    if (!target) return { found: false };
    const point = target.getWorldTransformMatrix().transformPoint(0, 0);
    return { found: true, x: point.x, y: point.y, name: target.name };
  }, { mission, sceneKey }).then(async (target) => {
    if (!target.found) return false;
    await page.touchscreen.tap(target.x, target.y);
    await page.waitForTimeout(80);
    return page.evaluate(async ({ mission, sceneKey }) => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
      if (mission <= 4) return scene.children.getByName('task-card')?.list
        .some((item) => item.name === 'task-feedback' && item.text.includes('Выбрано'));
      if (mission === 5) return Boolean((await import('/src/game/mechanics/memory.ts')).memoryMechanic.snapshot.firstCardId);
      if (mission === 6) {
        const snapshot = (await import('/src/game/mechanics/energy.ts')).energyMechanic.snapshot;
        return Boolean(snapshot.selection || snapshot.order.length);
      }
      if (mission === 8) return scene.children.getByName('program-strip')?.getData('commands')?.length === 1;
      return false;
    }, { mission, sceneKey });
  });
}

async function runCase(browser, viewport, mission) {
  const [name, width, height, safeInsets] = viewport;
  const mobile = Math.min(width, height) < 500 && Math.max(width, height) < 1000;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  const errors = captureErrors(page);
  const sceneKey = await enterMission(page, mission, safeInsets);
  const state = await inspect(page, mission, sceneKey, width, height);
  let touch = true;
  if (mobile) touch = await touchProbe(page, mission, sceneKey);
  if ((screenshotMissions.has(mission) && screenshotViewports.has(name)) || (mission === 8 && ['768x1024', '1280x720'].includes(name))
    || process.env.ROBOTLAB_QA_CAPTURE === '1') {
    await page.screenshot({ path: path.join(outputDir, `stage8-3e-mission${mission}-${name}.png`) });
  }
  await context.close();
  return { name, width, height, safeInsets: safeInsets ?? null, mission, state, touch, errors,
    checks: { ...state.checks, touch, errors: Object.values(errors).every((items) => items.length === 0) } };
}

async function level01Geometry(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const included = new Set(['game-home', 'game-sound', 'game-header', 'task-card', 'progress-panel', 'logical-actors',
      'hint-button', 'check-button', 'continue-button']);
    const round = (value) => Math.round((Number(value) || 0) * 1000) / 1000;
    const geometry = all.filter((item) => included.has(item.name) || item.name?.startsWith('choice-')).map((item) => ({
      name: item.name, x: round(item.x), y: round(item.y), scaleX: round(item.scaleX), scaleY: round(item.scaleY),
      width: round(item.width), height: round(item.height), visible: item.visible, input: Boolean(item.input?.enabled),
    })).sort((a, b) => a.name.localeCompare(b.name));
    const layout = game.registry.get('responsiveLayout');
    const metrics = game.registry.get('scaleManagerMetrics');
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      mode: layout.semanticMode,
      layout: {
        safe: layout.safe, headerY: layout.headerY, statusY: layout.statusY,
        taskCard: layout.taskCard, progress: layout.progress,
      },
      metrics,
      resizeListeners: game.scale.listenerCount('resize'),
      geometry,
    };
  });
}

async function waitForLevel01Size(page, width, height) {
  await page.waitForFunction(({ width, height }) => {
    const game = window.__ROBOTLAB_GAME__;
    return game?.scale.width === width && game.scale.height === height && game.scene.isActive('GameScene')
      && game.scene.getScene('GameScene').children.getByName('task-card');
  }, { width, height });
  await page.waitForTimeout(120);
}

async function level01OrientationCase(browser, portraitWidth, portraitHeight) {
  const landscapeWidth = portraitHeight;
  const landscapeHeight = portraitWidth;
  const context = await browser.newContext({
    viewport: { width: portraitWidth, height: portraitHeight }, hasTouch: true, isMobile: true, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await enterMission(page, 1);
  await waitForLevel01Size(page, portraitWidth, portraitHeight);
  const selectionPoint = await page.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    const choice = card.list.find((item) => item.name === 'choice-odd-ball');
    return choice.getWorldTransformMatrix().transformPoint(0, 0);
  });
  await page.touchscreen.tap(selectionPoint.x, selectionPoint.y);
  await page.waitForTimeout(180);
  const portrait1 = await level01Geometry(page);
  await page.setViewportSize({ width: landscapeWidth, height: landscapeHeight });
  await waitForLevel01Size(page, landscapeWidth, landscapeHeight);
  const landscape1 = await level01Geometry(page);
  await page.setViewportSize({ width: portraitWidth, height: portraitHeight });
  await waitForLevel01Size(page, portraitWidth, portraitHeight);
  const portrait2 = await level01Geometry(page);
  await page.setViewportSize({ width: landscapeWidth, height: landscapeHeight });
  await waitForLevel01Size(page, landscapeWidth, landscapeHeight);
  const landscape2 = await level01Geometry(page);
  const oddSelection = await page.evaluate(async () => (await import('/src/game/mechanics/oddOneOut.ts')).oddOneOutMechanic.snapshot.selectedKey);
  const geometryEqual = (a, b) => JSON.stringify({ ...a, metrics: undefined }) === JSON.stringify({ ...b, metrics: undefined });
  const metricsMatch = (snapshot, width, height) => snapshot.metrics
    && snapshot.metrics.parentSize.width === width && snapshot.metrics.parentSize.height === height
    && snapshot.metrics.displaySize.width === width && snapshot.metrics.displaySize.height === height
    && snapshot.metrics.gameSize.width === width && snapshot.metrics.gameSize.height === height;
  await context.close();
  return {
    portrait: `${portraitWidth}x${portraitHeight}`, landscape: `${landscapeWidth}x${landscapeHeight}`,
    portrait1, landscape1, portrait2, landscape2, oddSelection, errors,
    checks: {
      portraitDeterministic: geometryEqual(portrait1, portrait2),
      landscapeDeterministic: geometryEqual(landscape1, landscape2),
      portraitMetrics: metricsMatch(portrait2, portraitWidth, portraitHeight),
      landscapeMetrics: metricsMatch(landscape2, landscapeWidth, landscapeHeight),
      listenerStable: portrait1.resizeListeners === portrait2.resizeListeners && landscape1.resizeListeners === landscape2.resizeListeners,
      selectionPreserved: oddSelection === 'odd-ball',
      errors: Object.values(errors).every((items) => items.length === 0),
    },
  };
}

async function orientationProbe(browser) {
  const cases = [await level01OrientationCase(browser, 390, 844), await level01OrientationCase(browser, 412, 915)];
  return {
    cases,
    checks: Object.fromEntries(cases.flatMap((entry) => Object.entries(entry.checks)
      .map(([check, passed]) => [`${entry.portrait}:${check}`, passed]))),
  };
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const matrix = [];
  const requestedViewport = process.env.ROBOTLAB_QA_VIEWPORT;
  const requestedMission = Number(process.env.ROBOTLAB_QA_MISSION || 0);
  const orientationOnly = process.env.ROBOTLAB_QA_ORIENTATION_ONLY === '1';
  const selectedViewports = orientationOnly ? [] : requestedViewport ? viewports.filter(([name]) => name === requestedViewport) : viewports;
  const selectedMissions = orientationOnly ? [] : requestedMission ? [requestedMission] : [...Array(8)].map((_, index) => index + 1);
  for (const viewport of selectedViewports) for (const mission of selectedMissions) matrix.push(await runCase(browser, viewport, mission));
  const orientation = !orientationOnly && (requestedViewport || requestedMission)
    ? { preserved: [], errors: {}, checks: { statePreserved: true, errors: true } } : await orientationProbe(browser);
  await browser.close();
  const failures = matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, passed]) => !passed)
    .map(([check]) => `${entry.name}:mission${entry.mission}:${check}`));
  for (const [check, passed] of Object.entries(orientation.checks)) if (!passed) failures.push(`orientation:${check}`);
  const report = { matrix, orientation, failures };
  const resultName = process.env.ROBOTLAB_QA_RESULT_NAME || 'stage8-3e-responsive-results.json';
  fs.writeFileSync(path.join('docs', 'qa', resultName), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ failures, orientation: orientation.checks,
    summary: viewports.map(([name]) => ({ name, missions: matrix.filter((item) => item.name === name)
      .map((item) => ({ mission: item.mission, mode: item.state.mode, checks: item.checks })) })) }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
