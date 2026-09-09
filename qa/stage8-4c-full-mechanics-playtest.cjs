const { chromium } = require('playwright');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';

async function findPoint(page, sceneName, objectName) {
  await page.waitForFunction(({ sceneName, objectName }) => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene(sceneName);
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    return Boolean(scene?.children.list.flatMap(walk).find((candidate) => candidate?.name === objectName && candidate.visible));
  }, { sceneName, objectName }, { timeout: 10000 });
  return page.evaluate(({ sceneName, objectName }) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(sceneName);
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const item = scene.children.list.flatMap(walk).find((candidate) => candidate?.name === objectName && candidate.visible);
    if (!item) throw new Error(`Missing visible object ${sceneName}:${objectName}`);
    const point = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + point.x * canvas.width / game.scale.width, y: canvas.y + point.y * canvas.height / game.scale.height };
  }, { sceneName, objectName });
}

async function tap(page, sceneName, objectName) {
  const point = await findPoint(page, sceneName, objectName);
  await page.touchscreen.tap(point.x, point.y);
}

async function drag(page, sceneName, fromName, toName) {
  const from = await findPoint(page, sceneName, fromName);
  const to = await findPoint(page, sceneName, toName);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

async function snapshot(page, modulePath, exportName) {
  return page.evaluate(async ({ modulePath, exportName }) => (await import(modulePath))[exportName].snapshot, { modulePath, exportName });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const completed = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'), undefined, { timeout: 60000 });
  await page.evaluate(async () => {
    const modules = await Promise.all([
      import('/src/game/state/sessionState.ts'), import('/src/game/mechanics/oddOneOut.ts'),
      import('/src/game/mechanics/sequence.ts'), import('/src/game/mechanics/sizeComparison.ts'),
      import('/src/game/mechanics/shadowMatching.ts'), import('/src/game/mechanics/memory.ts'),
      import('/src/game/mechanics/energy.ts'), import('/src/game/mechanics/connections.ts'),
      import('/src/game/mechanics/programming.ts'),
    ]);
    modules[0].sessionState.reset();
    for (const [index, name] of ['oddOneOutMechanic', 'sequenceMechanic', 'sizeComparisonMechanic', 'shadowMatchingMechanic', 'memoryMechanic', 'energyMechanic', 'connectionsMechanic', 'programmingMechanic'].entries()) modules[index + 1][name].reset();
    window.__ROBOTLAB_QA__ = {
      sessionState: modules[0].sessionState,
      sequenceMechanic: modules[2].sequenceMechanic,
      sizeComparisonMechanic: modules[3].sizeComparisonMechanic,
      shadowMatchingMechanic: modules[4].shadowMatchingMechanic,
      memoryMechanic: modules[5].memoryMechanic,
      energyMechanic: modules[6].energyMechanic,
      connectionsMechanic: modules[7].connectionsMechanic,
      programmingMechanic: modules[8].programmingMechanic,
    };
  });

  await tap(page, 'StartScene', 'start-play-button');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('GameScene'));
  await tap(page, 'GameScene', 'choice-odd-ball');
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.sessionState.snapshot.completedTasks >= 1);
  completed.push('mission1');

  for (let index = 0; index < 3; index += 1) {
    const state = await snapshot(page, '/src/game/mechanics/sequence.ts', 'sequenceMechanic');
    await tap(page, 'GameScene', `choice-${state.correctKey}`);
    await page.waitForFunction(({ index }) => {
      const state = window.__ROBOTLAB_QA__.sequenceMechanic.snapshot;
      return state.completed || state.challengeIndex > index;
    }, { index }, { timeout: 7000 });
  }
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.sessionState.snapshot.completedTasks >= 2, undefined, { timeout: 7000 });
  completed.push('mission2');

  for (let index = 0; index < 3; index += 1) {
    const state = await snapshot(page, '/src/game/mechanics/sizeComparison.ts', 'sizeComparisonMechanic');
    await tap(page, 'GameScene', `choice-${state.correctKey}`);
    await page.waitForFunction(({ index }) => {
      const state = window.__ROBOTLAB_QA__.sizeComparisonMechanic.snapshot;
      return state.completed || state.challengeIndex > index;
    }, { index }, { timeout: 7000 });
  }
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.sessionState.snapshot.completedTasks >= 3, undefined, { timeout: 7000 });
  completed.push('mission3');

  for (let index = 0; index < 3; index += 1) {
    const state = await snapshot(page, '/src/game/mechanics/shadowMatching.ts', 'shadowMatchingMechanic');
    await tap(page, 'GameScene', `choice-${state.correctKey}`);
    await page.waitForFunction(({ index }) => {
      const state = window.__ROBOTLAB_QA__.shadowMatchingMechanic.snapshot;
      return state.completed || state.challengeIndex > index;
    }, { index }, { timeout: 7000 });
  }
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.sessionState.snapshot.completedTasks >= 4, undefined, { timeout: 7000 });
  completed.push('mission4');

  for (let pair = 0; pair < 4; pair += 1) {
    const state = await snapshot(page, '/src/game/mechanics/memory.ts', 'memoryMechanic');
    const unmatched = state.cards.filter((card) => card.state === 'FACE_DOWN');
    const first = unmatched[0];
    const second = unmatched.find((card) => card.pairId === first.pairId && card.id !== first.id);
    await tap(page, 'GameScene', `memory-card-${first.id}`);
    await tap(page, 'GameScene', `memory-card-${second.id}`);
    await page.waitForFunction(({ pair }) => window.__ROBOTLAB_QA__.memoryMechanic.snapshot.matchedPairs > pair, { pair }, { timeout: 5000 });
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('TransitionScene'), undefined, { timeout: 10000 });
  completed.push('mission5');
  await tap(page, 'TransitionScene', 'transition-continue');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission6Scene'));

  for (let index = 0; index < 3; index += 1) {
    const state = await snapshot(page, '/src/game/mechanics/energy.ts', 'energyMechanic');
    const levels = state.challenge.kind === 'order' ? state.challenge.correctOrder : [state.challenge.correctSelection];
    for (const level of levels) await tap(page, 'Mission6Scene', `energy-battery-${level}`);
    await tap(page, 'Mission6Scene', 'energy-check-button');
    await page.waitForFunction(({ index }) => {
      const state = window.__ROBOTLAB_QA__.energyMechanic.snapshot;
      return state.completed || state.challengeIndex > index;
    }, { index }, { timeout: 7000 });
  }
  await page.waitForFunction(() => Boolean(window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene').children.getByName('mission6-continue')), undefined, { timeout: 8000 });
  completed.push('mission6');
  await tap(page, 'Mission6Scene', 'mission6-continue');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission7Scene'));

  for (let index = 0; index < 3; index += 1) {
    const state = await snapshot(page, '/src/game/mechanics/connections.ts', 'connectionsMechanic');
    for (const color of state.challenge.colors) await drag(page, 'Mission7Scene', `connection-source-${color}`, `connection-target-${color}`);
    await page.waitForFunction(({ index }) => {
      const state = window.__ROBOTLAB_QA__.connectionsMechanic.snapshot;
      return state.completed || state.challengeIndex > index;
    }, { index }, { timeout: 8000 });
  }
  await page.waitForFunction(() => Boolean(window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('mission7-continue')), undefined, { timeout: 8000 });
  completed.push('mission7');
  await tap(page, 'Mission7Scene', 'mission7-continue');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission8Scene'));

  for (let index = 0; index < 3; index += 1) {
    const commands = await page.evaluate(async () => {
      const { programmingMechanic, findShortestGridPath } = await import('/src/game/mechanics/programming.ts');
      const challenge = programmingMechanic.snapshot.challenge;
      return findShortestGridPath(challenge, challenge.start, challenge.targetCell) || [];
    });
    for (const command of commands) await tap(page, 'Mission8Scene', `program-command-${command}`);
    await tap(page, 'Mission8Scene', 'programming-run-button');
    await page.waitForFunction(({ index }) => {
      const state = window.__ROBOTLAB_QA__.programmingMechanic.snapshot;
      return state.completed || state.challengeIndex > index;
    }, { index }, { timeout: 12000 });
  }
  await page.waitForFunction(() => Boolean(window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('mission8-continue')), undefined, { timeout: 8000 });
  completed.push('mission8');
  const finalSession = await page.evaluate(async () => (await import('/src/game/state/sessionState.ts')).sessionState.snapshot);
  const report = { completed, finalSession, errors, checks: { allEightCompleted: completed.length === 8, sessionReachedEight: finalSession.completedTasks >= 8, browserClean: errors.length === 0 } };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (Object.values(report.checks).some((value) => !value)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
