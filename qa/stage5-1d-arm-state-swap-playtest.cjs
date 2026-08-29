const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4210/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['landscape-844x390', 844, 390, true],
  ['desktop-1280x720', 1280, 720, false],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function attachErrorCapture(page) {
  const errors = { console: [], page: [], requests: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  return errors;
}

async function pointFor(page, name, sceneKey = 'StartScene') {
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

async function enterGame(page, touch) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const point = await pointFor(page, 'Играть');
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  await sleep(120);
}

async function activate(page, name, touch) {
  const point = await pointFor(page, name, 'GameScene');
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(90);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const actor = scene.children.getByName('logical-actors').getByName('grounded-robot');
    const part = (item) => {
      const bounds = item.getBounds();
      return {
        texture: item.texture.key,
        x: item.x,
        y: item.y,
        originX: item.originX,
        originY: item.originY,
        scaleX: item.scaleX,
        scaleY: item.scaleY,
        angle: item.angle,
        alpha: item.alpha,
        bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      };
    };
    return {
      animationState: actor.getData('animationState'),
      armState: actor.getData('armState'),
      actor: { x: actor.x, y: actor.y, scale: actor.scaleX, angle: actor.angle },
      lowered: part(actor.armLeft),
      raised: part(actor.armWaveLeft),
      head: part(actor.head),
      body: part(actor.bodyPart),
      oppositeArm: part(actor.armRight),
    };
  });
}

function grounded(state) {
  return state.actor.x === 640 && state.actor.y === 560 && state.actor.angle === 0
    && Math.abs(state.actor.scale - 0.2520718) < 1e-9;
}

function canonicalRaised(state, allowWave = false) {
  return state.raised.x === 236 && state.raised.y === -733
    && state.raised.originX === 0.89 && state.raised.originY === 0.89
    && state.raised.scaleX === -0.4 && state.raised.scaleY === 0.4
    && (allowWave ? Math.abs(state.raised.angle) <= 6.01 : Math.abs(state.raised.angle) < 0.25);
}

function loweredState(state) {
  return state.armState === 'LOWERED' && state.lowered.alpha > 0.999 && state.raised.alpha < 0.001
    && state.lowered.x === 236 && state.lowered.y === -733 && Math.abs(state.lowered.angle + 4) < 0.01;
}

function raisedState(state) {
  return state.armState === 'RAISED' && state.raised.alpha > 0.99 && state.lowered.alpha < 0.01;
}

function insideViewport(state, width, height) {
  const bounds = state.raised.bounds;
  return bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height;
}

async function invoke(page, method) {
  await page.evaluate((methodName) => {
    const actor = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children
      .getByName('logical-actors').getByName('grounded-robot');
    actor[methodName]();
  }, method);
}

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, touch);

  const captureAllStates = name === 'desktop-1280x720';
  const idle = await snapshot(page);
  if (captureAllStates) await page.screenshot({ path: path.join(screenshotDir, 'stage5-1d-a-idle-lowered.png') });

  await invoke(page, 'playCorrect');
  await sleep(130);
  const preparation = await snapshot(page);
  if (captureAllStates) await page.screenshot({ path: path.join(screenshotDir, 'stage5-1d-b-transition-preparation.png') });
  await sleep(900);

  await invoke(page, 'playCorrect');
  await sleep(260);
  const raisedFinal = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage5-1d-${name}-c-raised-final.png`) });
  await sleep(900);

  await invoke(page, 'playCorrect');
  await sleep(400);
  const wave = await snapshot(page);
  if (captureAllStates) await page.screenshot({ path: path.join(screenshotDir, 'stage5-1d-d-wave.png') });
  await sleep(700);
  const returned = await snapshot(page);
  if (captureAllStates) await page.screenshot({ path: path.join(screenshotDir, 'stage5-1d-e-returned-lowered.png') });

  await invoke(page, 'playWrong');
  await sleep(160);
  const wrong = await snapshot(page);
  await sleep(360);

  await invoke(page, 'playHint');
  await sleep(260);
  const hintRaised = await snapshot(page);
  await sleep(520);
  const hintReturned = await snapshot(page);

  await invoke(page, 'playCelebrate');
  await sleep(260);
  const celebrateRaised = await snapshot(page);
  await sleep(920);
  const celebrateReturned = await snapshot(page);

  const preparationDelta = {
    x: preparation.lowered.x - idle.lowered.x,
    y: preparation.lowered.y - idle.lowered.y,
    angle: preparation.lowered.angle - idle.lowered.angle,
  };
  const checks = {
    assets: idle.lowered.texture === 'robot-part-arm-left' && idle.raised.texture === 'robot-part-arm-wave-left',
    idleLowered: loweredState(idle),
    preparationLoweredOnly: preparation.armState === 'LOWERED' && preparation.lowered.alpha > 0.999
      && preparation.raised.alpha < 0.001 && Math.abs(preparationDelta.x) <= 4 && Math.abs(preparationDelta.y) <= 6
      && Math.abs(preparationDelta.angle) >= 5 && Math.abs(preparationDelta.angle) <= 12,
    raisedCanonical: raisedState(raisedFinal) && canonicalRaised(raisedFinal),
    waveSmallAndFixed: raisedState(wave) && canonicalRaised(wave, true)
      && Math.abs(wave.raised.angle) >= 1 && wave.raised.x === raisedFinal.raised.x && wave.raised.y === raisedFinal.raised.y,
    correctReturned: loweredState(returned),
    wrongNeverRaises: wrong.animationState === 'WRONG' && loweredState(wrong),
    hintRaised: hintRaised.animationState === 'HINT' && raisedState(hintRaised) && canonicalRaised(hintRaised),
    hintReturned: loweredState(hintReturned),
    celebrateRaised: celebrateRaised.animationState === 'CELEBRATE' && raisedState(celebrateRaised) && canonicalRaised(celebrateRaised),
    celebrateReturned: loweredState(celebrateReturned),
    responsiveViewport: insideViewport(raisedFinal, width, height),
    grounding: [idle, preparation, raisedFinal, wave, returned, wrong, hintRaised, hintReturned,
      celebrateRaised, celebrateReturned].every(grounded),
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };

  await context.close();
  return {
    name, width, height, checks, errors, preparationDelta,
    states: { idle, preparation, raisedFinal, wave, returned, wrong, hintRaised, hintReturned, celebrateRaised, celebrateReturned },
  };
}

async function runGameplayIntegration(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await enterGame(page, true);

  await activate(page, 'Подсказка', true);
  await sleep(170);
  const hint = await snapshot(page);
  await sleep(520);

  await activate(page, 'choice-odd-apple', true);
  await activate(page, 'check-button', true);
  const wrong = await snapshot(page);
  await sleep(520);

  await activate(page, 'choice-odd-ball', true);
  await activate(page, 'check-button', true);
  await sleep(180);
  const correct = await snapshot(page);
  await sleep(3500);
  const finished = await snapshot(page);

  const checks = {
    hintUsesRaisedState: hint.animationState === 'HINT' && raisedState(hint) && canonicalRaised(hint, true),
    wrongStaysLowered: wrong.animationState === 'WRONG' && loweredState(wrong),
    correctUsesRaisedState: ['CORRECT', 'CELEBRATE'].includes(correct.animationState)
      && raisedState(correct) && canonicalRaised(correct, true),
    completionReturnsLowered: loweredState(finished) && grounded(finished),
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { checks, errors, states: { hint, wrong, correct, finished } };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const matrix = [];
  for (const viewport of viewports) matrix.push(await runViewport(browser, viewport));
  const gameplay = await runGameplayIntegration(browser);
  await browser.close();

  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks)
      .filter(([, passed]) => !passed).map(([check]) => `${entry.name}:${check}`)),
    ...Object.entries(gameplay.checks).filter(([, passed]) => !passed).map(([check]) => `gameplay:${check}`),
  ];
  const report = { matrix, gameplay, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-1d-arm-state-swap-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({
    matrix: matrix.map(({ name, checks, preparationDelta }) => ({ name, checks, preparationDelta })),
    gameplay: gameplay.checks,
    failures,
  }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
