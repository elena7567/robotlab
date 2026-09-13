const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const directUrl = `${baseUrl}?qaMission=7`;
const directDebugUrl = `${baseUrl}?qaMission=7&orientationDebug=1`;
const outDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'mission7-orientation-review.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

function cleanErrors(errors) {
  return errors.console.length === 0 && errors.requests.length === 0 && errors.responses.length === 0
    && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;
}

async function waitMission7(page) {
  let last = null;
  const started = Date.now();
  while (Date.now() - started < 30000) {
    last = await page.evaluate(() => {
      const game = window.__ROBOTLAB_GAME__;
      if (!game) return { ready: false, active: [] };
      return {
        ready: game.scene.isActive('Mission7Scene') || game.scene.isActive('Mission7OrientationGuardScene'),
        active: game.scene.getScenes(true).map((scene) => scene.scene.key),
        childCount: (game.scene.getScene('Mission7Scene')?.children?.length ?? 0) + (game.scene.getScene('Mission7OrientationGuardScene')?.children?.length ?? 0),
      };
    }).catch((error) => ({ ready: false, active: [`evaluate-error:${error.message}`] }));
    if (last.ready) break;
    await sleep(100);
  }
  if (!last?.ready) throw new Error(`Mission7Scene did not become active: ${JSON.stringify(last)}`);
  await sleep(360);
}


async function waitMission7Mode(page, mode) {
  await waitMission7(page);
  if (mode === 'portrait') {
    await page.waitForFunction(() => {
      const game = window.__ROBOTLAB_GAME__;
      const scene = game?.scene.getScene('Mission7Scene');
      return scene?.children.getByName('connection-task-card')
        && !scene?.children.getByName('mission7-orientation-gate');
    }, null, { timeout: 12000 });
  } else {
    await page.waitForFunction(() => {
      const game = window.__ROBOTLAB_GAME__;
      const scenes = game?.scene.getScenes(true) ?? [];
      return scenes.some((scene) => (scene.children.getByName('mission7-orientation-gate') || scene.children.getByName('mission7-preentry-orientation-gate'))
        && !scene.children.getByName('connection-task-card'));
    }, null, { timeout: 12000 });
  }
  await sleep(120);
}
async function openDirect(context, viewport) {
  const page = await context.newPage();
  const errors = captureErrors(page);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(directUrl, { waitUntil: 'load', timeout: 45000 });
    try {
      await waitMission7(page);
      return { page, errors };
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw lastError;
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.isActive('Mission7Scene')
      ? game.scene.getScene('Mission7Scene')
      : game.scene.getScene('Mission7OrientationGuardScene');
    const all = [];
    const walk = (item) => {
      all.push(item);
      if (item?.list) for (const child of item.list) walk(child);
    };
    scene.children.list.forEach(walk);
    const bounds = (item) => {
      if (!item?.getBounds) return null;
      const b = item.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
    };
    const find = (name) => all.find((item) => item.name === name);
    const texts = all.map((item) => item.text).filter((text) => typeof text === 'string');
    const colors = ['red', 'blue', 'green', 'yellow'];
    const ports = colors.flatMap((color) => ['source', 'target'].map((side) => {
      const item = find(`connection-${side}-${color}`);
      if (!item) return null;
      const b = bounds(item);
      return {
        color, side, bounds: b,
        hitWidth: item.input?.hitArea?.diameter ?? item.input?.hitArea?.width ?? item.getData?.('hitWidth') ?? null,
        hitHeight: item.input?.hitArea?.diameter ?? item.input?.hitArea?.height ?? item.getData?.('hitHeight') ?? null,
        locked: item.getData?.('locked') ?? false,
      };
    })).filter(Boolean);
    const card = find('connection-task-card');
    const gate = find('mission7-orientation-gate') || find('mission7-preentry-orientation-gate');
    const temporaryWire = find('connection-temporary-wire');
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      activeScene: scene.scene.key,
      session: game.registry.get('sessionSnapshot'),
      snapshot: card ? {
        challengeIndex: card.getData('challengeIndex'),
        destinationOrder: card.getData('destinationOrder'),
        connected: card.getData('connected') || [],
      } : null,
      gateCount: all.filter((item) => item.name === 'mission7-orientation-gate' || item.name === 'mission7-preentry-orientation-gate').length,
      gatePhoneCount: all.filter((item) => item.name === 'mission7-orientation-gate-phone-icon' || item.name === 'mission7-preentry-orientation-gate-phone-icon').length,
      gateBlockerCount: all.filter((item) => item.name === 'mission7-orientation-gate-input-blocker' || item.name === 'mission7-preentry-orientation-gate-input-blocker').length,
      mission7OrientationGate: game.registry.get('mission7OrientationGate') === true,
      mission7InputActive: game.registry.get('mission7InputActive') === true,
      cardCount: all.filter((item) => item.name === 'connection-task-card').length,
      sourcePortCount: ports.filter((port) => port.side === 'source').length,
      targetPortCount: ports.filter((port) => port.side === 'target').length,
      hintCount: all.filter((item) => item.name === 'connection-hint-button').length,
      headerCount: all.filter((item) => item.name === 'mission7-header').length,
      systemsCount: all.filter((item) => item.name === 'systems-progress').length,
      completionCount: all.filter((item) => item.name === 'mission7-completion').length,
      labels: texts,
      ports,
      cardBounds: bounds(card),
      hintBounds: bounds(find('connection-hint-button')),
      repairedBounds: bounds(find('mission7-repaired-robot')),
      gateBounds: bounds(gate),
      lineGraphicsCount: all.filter((item) => item.type === 'Graphics' && item.name.includes('connection')).length,
      temporaryWireCount: all.filter((item) => item.name === 'connection-temporary-wire').length,
      temporaryWireCommandCount: temporaryWire?.commandBuffer?.length ?? 0,
    };
  });
}

function center(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function pointFor(page, name) {
  return page.evaluate((name) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene');
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) { const found = walk(child); if (found) return found; }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Target not found: ${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, name);
}

async function drag(context, page, fromName, toName) {
  const from = await pointFor(page, fromName);
  const to = await pointFor(page, toName);
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, radiusX: 12, radiusY: 12 }] });
  for (let step = 1; step <= 8; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8, radiusX: 12, radiusY: 12 }],
    });
    await sleep(16);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
  await sleep(360);
}

async function tapByName(page, sceneName, name) {
  const point = await page.evaluate(({ sceneName, name }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneName);
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.text === name) return item;
      if (item?.list) for (const child of item.list) { const found = walk(child); if (found) return found; }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Target not found: ${sceneName}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { sceneName, name });
  await page.mouse.click(point.x, point.y);
  await sleep(260);
}

async function runDebugOverlay(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(directDebugUrl, { waitUntil: 'load', timeout: 45000 });
  await waitMission7Mode(page, 'portrait');
  const debugText = await page.locator('#robotlab-viewport-debug').textContent({ timeout: 6000 }).catch(() => '');
  const ok = debugText.includes('visual 390×844')
    && debugText.includes('gameSize 390×844')
    && debugText.includes('resolved portrait')
    && debugText.includes('gate inactive')
    && debugText.includes('mission7 input active')
    && cleanErrors(errors);
  await context.close();
  return { ok, debugText, errors };
}

async function runViewport(browser, width, height, expected) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 1000 });
  const { page, errors } = await openDirect(context, { width, height });
  const state = await inspect(page);
  fs.mkdirSync(outDir, { recursive: true });
  const screenshot = path.join(outDir, `mission7-orientation-${width}x${height}.png`);
  await page.screenshot({ path: screenshot });
  const portraitOk = state.gateCount === 0
    && state.mission7OrientationGate === false
    && state.mission7InputActive === true
    && state.cardCount === 1
    && state.sourcePortCount >= 3
    && state.targetPortCount >= 3
    && state.cardBounds && state.cardBounds.x >= -1 && state.cardBounds.right <= width + 1
    && state.cardBounds.y >= -1 && state.cardBounds.bottom <= height + 1;
  const landscapeOk = state.gateCount === 1
    && state.cardCount === 0
    && state.gateBlockerCount === 1
    && state.mission7OrientationGate === true
    && state.mission7InputActive === false
    && state.sourcePortCount === 0
    && state.targetPortCount === 0
    && state.hintCount === 0
    && state.headerCount === 0
    && state.labels.includes('ПОВЕРНИ ТЕЛЕФОН')
    && state.labels.includes('ИГРАЕМ ВЕРТИКАЛЬНО');
  const ok = (expected === 'portrait' ? portraitOk : landscapeOk) && cleanErrors(errors);
  await context.close();
  return { viewport: `${width}x${height}`, expected, ok, state, screenshot, errors };
}

function hitAreasOk(state) {
  const ports = state.ports;
  const touch = ports.every((port) => port.hitWidth >= port.bounds.width && port.hitHeight >= port.bounds.height && port.hitWidth >= 48 && port.hitHeight >= 48);
  const overlaps = [];
  for (let i = 0; i < ports.length; i += 1) {
    for (let j = i + 1; j < ports.length; j += 1) {
      if (ports[i].side !== ports[j].side) continue;
      const a = ports[i].bounds;
      const b = ports[j].bounds;
      if (a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y) overlaps.push(`${ports[i].side}:${ports[i].color}-${ports[j].color}`);
    }
  }
  return { touch, overlaps };
}

async function runWireInput(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const { page, errors } = await openDirect(context, { width: 390, height: 844 });
  const checks = [];
  let state = await inspect(page);
  const hit = hitAreasOk(state);
  checks.push({ name: 'initial-portrait-playable', ok: state.gateCount === 0 && state.cardCount === 1 });
  checks.push({ name: 'touch-targets', ok: hit.touch, details: hit });
  await drag(context, page, 'connection-source-red', 'connection-target-blue');
  state = await inspect(page);
  checks.push({ name: 'wrong-does-not-progress', ok: state.snapshot.connected.length === 0, connected: state.snapshot.connected });
  await drag(context, page, 'connection-source-red', 'connection-target-red');
  state = await inspect(page);
  checks.push({ name: 'correct-progresses-once', ok: state.snapshot.connected.length === 1 && state.snapshot.connected.includes('red'), connected: state.snapshot.connected });
  await drag(context, page, 'connection-source-red', 'connection-target-red');
  state = await inspect(page);
  checks.push({ name: 'duplicate-ignored', ok: state.snapshot.connected.length === 1, connected: state.snapshot.connected });
  for (const color of ['blue', 'green']) await drag(context, page, `connection-source-${color}`, `connection-target-${color}`);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('connection-task-card')?.getData('challengeIndex') === 1, null, { timeout: 6000 });
  state = await inspect(page);
  checks.push({ name: 'challenge-advance-after-all-correct', ok: state.snapshot.challengeIndex === 1 && state.snapshot.connected.length === 0, snapshot: state.snapshot });
  await context.close();
  return { ok: checks.every((check) => check.ok) && cleanErrors(errors), checks, errors, hitAreaOverlap: hit.overlaps };
}

async function connectN(context, page, count) {
  const colors = ['red', 'blue', 'green'];
  for (const color of colors.slice(0, count)) await drag(context, page, `connection-source-${color}`, `connection-target-${color}`);
}

async function runStateRotation(browser, completedCount, cycles) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const { page, errors } = await openDirect(context, { width: 390, height: 844 });
  await connectN(context, page, completedCount);
  let before = await inspect(page);
  const expected = JSON.stringify(before.snapshot.connected);
  const cycleStates = [];
  for (let index = 0; index < cycles; index += 1) {
    if (index === 0) {
      const from = await pointFor(page, 'connection-source-green');
      const client = await context.newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, radiusX: 12, radiusY: 12 }] });
      await page.setViewportSize({ width: 844, height: 390 });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => undefined);
      await client.detach().catch(() => undefined);
    } else {
      await page.setViewportSize({ width: 844, height: 390 });
    }
    await waitMission7Mode(page, 'landscape');
    const landscape = await inspect(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await waitMission7Mode(page, 'portrait');
    const portrait = await inspect(page);
    cycleStates.push({ portrait, landscape });
  }
  const after = await inspect(page);
  const ok = JSON.stringify(after.snapshot.connected) === expected
    && cycleStates.every((entry) => entry.landscape.gateCount === 1 && entry.landscape.cardCount === 0
      && entry.portrait.gateCount === 0 && entry.portrait.cardCount === 1
      && JSON.stringify(entry.portrait.snapshot.connected) === expected)
    && cleanErrors(errors);
  await context.close();
  return { completedCount, cycles, ok, before, after, cycleStates: cycleStates.map((entry) => ({ landscape: { gateCount: entry.landscape.gateCount, cardCount: entry.landscape.cardCount }, portrait: { gateCount: entry.portrait.gateCount, cardCount: entry.portrait.cardCount, connected: entry.portrait.snapshot?.connected ?? null } })), errors };
}

async function startMission6(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__, null, { timeout: 45000 });
  await page.evaluate(() => {
    window.__ROBOTLAB_QA__.sessionState.reset();
    for (let index = 0; index < 5; index += 1) window.__ROBOTLAB_QA__.sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission6Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission6Scene'), null, { timeout: 12000 });
  await sleep(350);
}

async function completeMission6To7(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000, isMobile: width < 1000 });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startMission6(page);
  await page.evaluate(() => {
    const { sessionState } = window.__ROBOTLAB_QA__;
    if (!sessionState.snapshot.powerActivated) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').scene.restart();
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission6Complete') === true
    && window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('mission6-continue'), null, { timeout: 10000 });
  await tapByName(page, 'Mission6Scene', 'mission6-continue');
  await waitMission7(page);
  if (width > height) await waitMission7Mode(page, 'landscape');
  else await waitMission7Mode(page, 'portrait');
  const state = await inspect(page);
  await context.close();
  return { viewport: `${width}x${height}`, ok: (width > height ? state.gateCount === 1 && state.cardCount === 0 : state.gateCount === 0 && state.cardCount === 1), state, errors };
}
async function solveMission7Completion(browser) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  const { page, errors } = await openDirect(context, { width: 412, height: 915 });
  for (let challenge = 0; challenge < 3; challenge += 1) {
    const state = await inspect(page);
    for (const color of state.ports.filter((port) => port.side === 'source').map((port) => port.color)) {
      await drag(context, page, `connection-source-${color}`, `connection-target-${color}`);
    }
    if (challenge < 2) await page.waitForFunction((next) => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('connection-task-card')?.getData('challengeIndex') === next, challenge + 1, { timeout: 7000 });
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission7Complete') === true, null, { timeout: 9000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('mission7-completion'), null, { timeout: 9000 }).catch(() => undefined);
  await sleep(500);
  const state = await inspect(page);
  const screenshot = path.join(outDir, 'mission7-orientation-completion-412x915.png');
  await page.screenshot({ path: screenshot });
  await context.close();
  return { ok: state.completionCount === 1 && state.session.connectionsCompleted === true && cleanErrors(errors), state, screenshot, errors };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  try {
    const viewports = [
      await runViewport(browser, 390, 844, 'portrait'),
      await runViewport(browser, 412, 915, 'portrait'),
      await runViewport(browser, 360, 800, 'portrait'),
      await runViewport(browser, 740, 360, 'landscape'),
      await runViewport(browser, 844, 390, 'landscape'),
      await runViewport(browser, 915, 412, 'landscape'),
      await runViewport(browser, 768, 1024, 'portrait'),
      await runViewport(browser, 1024, 768, 'landscape'),
    ];
    const debugOverlay = await runDebugOverlay(browser);
    const wireInput = await runWireInput(browser);
    const state0 = await runStateRotation(browser, 0, 1);
    const state1 = await runStateRotation(browser, 1, 1);
    const state2 = await runStateRotation(browser, 2, 5);
    const handoffLandscape = await completeMission6To7(browser, 844, 390);
    const handoffPortrait = await completeMission6To7(browser, 390, 844);
    const completion = await solveMission7Completion(browser);
    const report = { viewports, debugOverlay, wireInput, statePreservation: [state0, state1, state2], handoffLandscape, handoffPortrait, completion };
    report.result = [
      ...viewports.map((item) => item.ok), debugOverlay.ok, wireInput.ok, state0.ok, state1.ok, state2.ok,
      handoffLandscape.ok, handoffPortrait.ok, completion.ok,
    ].every(Boolean) ? 'PASS' : 'FAIL';
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({
      result: report.result,
      viewports: viewports.map((item) => ({ viewport: item.viewport, expected: item.expected, ok: item.ok, screenshot: item.screenshot })),
      debugOverlay: { ok: debugOverlay.ok, debugText: debugOverlay.debugText },
      wireInput: { ok: wireInput.ok, checks: wireInput.checks, hitAreaOverlap: wireInput.hitAreaOverlap },
      statePreservation: report.statePreservation.map((item) => ({ completedCount: item.completedCount, cycles: item.cycles, ok: item.ok, before: item.before.snapshot, after: item.after.snapshot })),
      handoffLandscape: { ok: handoffLandscape.ok, gateCount: handoffLandscape.state.gateCount, cardCount: handoffLandscape.state.cardCount },
      handoffPortrait: { ok: handoffPortrait.ok, gateCount: handoffPortrait.state.gateCount, cardCount: handoffPortrait.state.cardCount },
      completion: { ok: completion.ok, screenshot: completion.screenshot },
    }, null, 2)}\n`);
    if (report.result !== 'PASS') process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
