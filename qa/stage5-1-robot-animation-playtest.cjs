const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4190/';
const viewports = [
  ['mobile-320x568', 320, 568, true], ['mobile-333x885', 333, 885, true],
  ['mobile-390x844', 390, 844, true], ['mobile-412x915', 412, 915, true],
  ['tablet-768x1024', 768, 1024, true], ['tablet-1024x1366', 1024, 1366, true],
  ['landscape-568x320', 568, 320, true], ['landscape-844x390', 844, 390, true],
  ['desktop-1280x720', 1280, 720, false], ['desktop-1920x1080', 1920, 1080, false],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function attachErrorCapture(page) {
  const errors = { console: [], page: [], requests: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  return errors;
}

async function pointFor(page, name, sceneKey = 'GameScene') {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const card = sceneKey === 'GameScene' ? scene.children.getByName('task-card') : undefined;
    const target = card?.getByName(name)
      || card?.list.find((item) => item.list?.some((child) => child.text === name))
      || scene.children.getByName(name)
      || scene.children.list.find((item) => item.list?.some((child) => child.text === name));
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, touch, sceneKey = 'GameScene') {
  const point = await pointFor(page, name, sceneKey);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(85);
}

async function enterGame(page, touch) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await activate(page, 'Играть', touch, 'StartScene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
}

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors')?.getByName('grounded-robot');
    const card = scene.children.getByName('task-card');
    const progress = scene.children.getByName('progress-panel');
    const dialogue = scene.children.getByName('robot-dialogue');
    const bounds = (item) => { const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
    return {
      actor: {
        x: actor.x, y: actor.y, scale: actor.scaleX, angle: actor.angle,
        state: actor.getData('animationState'), completedTasks: actor.getData('completedTasks'),
        platformX: actor.getData('platformContactX'), platformY: actor.getData('platformContactY'),
        bounds: bounds(actor),
        parts: actor.list.map((part) => ({
          name: part.name, texture: part.texture?.key, x: part.x, y: part.y,
          rotation: part.rotation, scaleX: part.scaleX, scaleY: part.scaleY,
          base: part.getData('baseTransform'),
        })),
      },
      card: bounds(card),
      layout: game.registry.get('responsiveLayout'),
      progressText: progress.progressLayer.list.find((item) => /^\d \/ 5$/.test(item.text || ''))?.text,
      dialogue: { visible: dialogue?.visible ?? false, text: dialogue?.label?.text ?? '' },
      rewardVisible: Boolean(scene.children.getByName('repair-item-reward')),
      continueVisible: card.continueButton.visible,
      canvas: { width: game.canvas.width, height: game.canvas.height },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    };
  });
}

function baseRestored(actor) {
  const fixedParts = actor.parts.filter((part) => part.name.includes('leg'));
  return actor.x === 640 && actor.y === 560 && actor.angle === 0
    && Math.abs(actor.scale - 0.2520718) < 1e-9
    && fixedParts.every((part) => Math.abs(part.x - part.base.x) < 0.001
      && Math.abs(part.y - part.base.y) < 0.001
      && Math.abs(part.rotation - part.base.rotation) < 0.001
      && Math.abs(part.scaleX - part.base.scaleX) < 0.001);
}

async function runMatrixViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, touch);
  await sleep(220);
  const state = await snapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage5-1-${name}.png`) });
  const checks = {
    modularParts: state.actor.parts.length === 7
      && new Set(state.actor.parts.map((part) => part.texture)).size === 7
      && state.actor.parts.every((part) => part.texture?.startsWith('robot-part-')),
    noCompleteTexture: state.actor.parts.every((part) => part.texture !== 'robot-complete'),
    grounding: state.actor.x === 640 && state.actor.y === 560
      && state.actor.platformX === 640 && state.actor.platformY === 560
      && Math.abs(state.actor.scale - 0.2520718) < 1e-9,
    viewport: state.canvas.width === width && state.canvas.height === height
      && state.document.width === width && state.document.height === height,
    cardClearance: state.layout.mode === 'landscape' || state.card.bottom <= state.actor.bounds.top + 12,
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { name, width, height, checks, errors, state };
}

async function runFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, false);

  const idleSamples = [];
  for (let elapsed = 0; elapsed <= 10200; elapsed += 100) {
    idleSamples.push(await snapshot(page));
    await sleep(100);
  }
  const idleStates = new Set(idleSamples.map((sample) => sample.actor.state));
  const bodyYs = idleSamples.map((sample) => sample.actor.parts.find((part) => part.name === 'robot-body').y);

  const wrongStates = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await activate(page, 'choice-odd-apple', false);
    await activate(page, 'check-button', false);
    wrongStates.push(await snapshot(page));
    await sleep(520);
  }
  const afterWrong = await snapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', 'stage5-1-wrong.png') });

  await activate(page, 'Подсказка', false);
  const hintState = await snapshot(page);
  await sleep(650);
  const afterHint = await snapshot(page);

  await activate(page, 'choice-odd-ball', false);
  await activate(page, 'check-button', false);
  const correctState = await snapshot(page);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('repair-item-reward'));
  const rewardState = await snapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', 'stage5-1-reward.png') });
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const panel = scene.children.getByName('progress-panel');
    return panel.progressLayer.list.some((item) => item.text === '1 / 5')
      && scene.children.getByName('logical-actors').getByName('grounded-robot').getData('animationState') === 'IDLE';
  }, { timeout: 5000 });
  const completedState = await snapshot(page);

  await activate(page, 'continue-button', false);
  await sleep(180);
  await activate(page, 'choice-sequence-gear', false);
  await activate(page, 'check-button', false);
  const sequenceWrong = await snapshot(page);
  await sleep(520);
  await activate(page, 'Подсказка', false);
  const sequenceHint = await snapshot(page);
  await sleep(650);
  await activate(page, 'choice-sequence-star', false);
  await activate(page, 'check-button', false);
  await sleep(760);
  const sequenceCorrect = await snapshot(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(420);
  const resized = await snapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', 'stage5-1-live-resize-mobile.png') });

  const checks = {
    idleVisible: Math.max(...bodyYs) - Math.min(...bodyYs) > 0.25,
    microReaction: idleStates.has('THINKING'),
    idleGrounding: idleSamples.every((sample) => sample.actor.x === 640 && sample.actor.y === 560),
    repeatedWrong: wrongStates.every((state) => state.actor.state === 'WRONG') && baseRestored(afterWrong.actor),
    hint: hintState.actor.state === 'HINT' && hintState.dialogue.visible && baseRestored(afterHint.actor),
    correct: correctState.actor.state === 'CORRECT' && correctState.progressText === '0 / 5',
    reward: rewardState.rewardVisible && rewardState.progressText === '0 / 5',
    completion: completedState.progressText === '1 / 5' && completedState.actor.completedTasks === 1
      && completedState.continueVisible && baseRestored(completedState.actor),
    lockingSequence: sequenceWrong.actor.state === 'WRONG' && sequenceHint.actor.state === 'HINT'
      && ['CORRECT', 'IDLE'].includes(sequenceCorrect.actor.state) && baseRestored(sequenceCorrect.actor),
    liveResize: resized.actor.x === 640 && resized.actor.y === 560
      && resized.actor.platformX === 640 && resized.actor.platformY === 560
      && Math.abs(resized.actor.scale - 0.2520718) < 1e-9,
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { checks, errors, states: { afterWrong, hintState, afterHint, correctState, rewardState, completedState,
    sequenceWrong, sequenceHint, sequenceCorrect, resized }, idleStates: [...idleStates] };
}

async function runReducedMotion(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, true);
  const states = [];
  for (let elapsed = 0; elapsed < 9200; elapsed += 400) {
    states.push((await snapshot(page)).actor.state);
    await sleep(400);
  }
  const checks = {
    noMicroReactions: states.every((state) => state === 'IDLE'),
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { checks, errors, states };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const matrix = [];
  for (const viewport of viewports) matrix.push(await runMatrixViewport(browser, viewport));
  const flow = await runFlow(browser);
  const reducedMotion = await runReducedMotion(browser);
  await browser.close();
  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, value]) => !value).map(([key]) => `${entry.name}:${key}`)),
    ...Object.entries(flow.checks).filter(([, value]) => !value).map(([key]) => `flow:${key}`),
    ...Object.entries(reducedMotion.checks).filter(([, value]) => !value).map(([key]) => `reduced-motion:${key}`),
  ];
  const report = { matrix, flow, reducedMotion, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-1-robot-animation-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ viewports: matrix.length, flow: flow.checks, reducedMotion: reducedMotion.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
