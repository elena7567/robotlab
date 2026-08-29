const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4196/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const viewports = [
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['desktop-1280x720', 1280, 720, false],
  ['minimum-320x568', 320, 568, true],
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`);
  });
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

async function activate(page, name, touch = false, sceneKey = 'GameScene', settleMs = 90) {
  const point = await pointFor(page, name, sceneKey);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(settleMs);
}

async function selectAndCheck(page, key, touch, settleMs = 260) {
  await activate(page, `choice-${key}`, touch);
  await activate(page, 'check-button', touch, 'GameScene', settleMs);
}

async function waitForTask(page, taskNumber) {
  await page.waitForFunction((task) => {
    const card = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene')?.children.getByName('task-card');
    return card?.list.some((item) => item.text === `ЗАДАНИЕ ${task} ИЗ 5`);
  }, taskNumber);
}

async function enterShadowTask(page, touch) {
  await activate(page, 'Играть', touch, 'StartScene', 120);
  await waitForTask(page, 1);
  await selectAndCheck(page, 'odd-ball', touch);
  await activate(page, 'continue-button', touch, 'GameScene', 130);

  for (const key of ['sequence-star', 'sequence-planet', 'sequence-planet']) {
    await waitForTask(page, 2);
    await selectAndCheck(page, key, touch);
    await activate(page, 'continue-button', touch, 'GameScene', 140);
  }

  for (const key of ['size-large', 'size-small', 'size-medium']) {
    await waitForTask(page, 3);
    await selectAndCheck(page, key, touch);
    await activate(page, 'continue-button', touch, 'GameScene', 160);
  }
  await waitForTask(page, 4);
}

async function installAudioProbe(page) {
  await page.evaluate(() => {
    const sound = window.__ROBOTLAB_GAME__.sound;
    window.__ROBOTLAB_AUDIO_EVENTS__ = [];
    const originalPlay = sound.play.bind(sound);
    sound.play = (key, config) => {
      window.__ROBOTLAB_AUDIO_EVENTS__.push({ key, muted: sound.mute, at: performance.now() });
      return originalPlay(key, config);
    };
  });
}

async function clearAudioProbe(page) {
  await page.evaluate(() => { window.__ROBOTLAB_AUDIO_EVENTS__ = []; });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const progress = scene.children.getByName('progress-panel');
    const robot = scene.children.getByName('logical-actors')?.getByName('grounded-robot');
    const dialogue = scene.children.getByName('robot-dialogue');
    const target = card?.getByName('shadow-target-object');
    const bounds = (item) => {
      if (!item) return null;
      const value = item.getBounds();
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const choices = card ? [...card.choices.entries()].map(([key, choice]) => {
      const image = choice.container.getByName(`choice-image-${key}`);
      return {
        key,
        bounds: bounds(choice.container),
        image: image ? { bounds: bounds(image), texture: image.texture.key } : null,
        hitWidth: choice.container.input?.hitArea?.width ?? choice.container.width,
        hitHeight: choice.container.input?.hitArea?.height ?? choice.container.height,
        scale: choice.container.scaleX,
      };
    }) : [];
    return {
      taskLabel: card?.list.find((item) => /^ЗАДАНИЕ/.test(item.text || ''))?.text,
      title: card?.list.find((item) => item.text === 'НАЙДИ ТЕНЬ')?.text,
      instruction: card?.list.find((item) => item.text === 'Какая тень подходит?')?.text,
      internalProgress: card?.feedbackText?.text.match(/ТЕНЬ \d ИЗ 3/)?.[0],
      selectedKey: card?.selectedKey ?? null,
      result: card?.result ?? null,
      feedback: card?.feedbackText?.text ?? '',
      checkEnabled: card?.checkButton?.getData('control-runtime')?.enabled ?? false,
      continueVisible: card?.continueButton?.visible ?? false,
      hintStage: card?.getData('shadowHintStage') ?? 'idle',
      target: target ? { bounds: bounds(target), texture: target.texture.key, scale: target.scaleX } : null,
      choices,
      choiceOrder: choices.map((choice) => choice.key),
      repairComplete: progress?.progressLayer?.list.filter((item) => item.name === 'repair-indicator-complete').length ?? 0,
      repairPending: progress?.progressLayer?.list.filter((item) => item.name === 'repair-indicator-pending').length ?? 0,
      dialogue: { visible: dialogue?.visible ?? false, text: dialogue?.label?.text ?? '' },
      robot: robot ? { bounds: bounds(robot), x: robot.x, y: robot.y, baseY: robot.getData('baseY'), scale: robot.scaleX, angle: robot.angle } : null,
      cardBounds: bounds(card),
      layout: game.registry.get('responsiveLayout'),
      session: game.registry.get('sessionSnapshot'),
      audio: [...(window.__ROBOTLAB_AUDIO_EVENTS__ || [])],
      muted: game.sound.mute,
      canvas: { width: game.canvas.width, height: game.canvas.height },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    };
  });
}

function baseChecks(state, width, height) {
  const viewportContains = (b) => b && b.x >= -1 && b.y >= -1 && b.right <= width + 1 && b.bottom <= height + 1;
  return {
    labels: state.taskLabel === 'ЗАДАНИЕ 4 ИЗ 5' && state.title === 'НАЙДИ ТЕНЬ'
      && state.instruction === 'Какая тень подходит?' && state.internalProgress === 'ТЕНЬ 1 ИЗ 3',
    target: state.target?.texture === 'odd-apple' && viewportContains(state.target.bounds),
    shadows: state.choices.length === 3 && state.choices.every((choice) => choice.key.startsWith('shadow-')
      && choice.image?.texture === choice.key && viewportContains(choice.image.bounds)),
    touchTargets: state.choices.every((choice) => choice.hitWidth >= 56 && choice.hitHeight >= 56),
    initialState: state.selectedKey === null && state.result === 'idle' && !state.checkEnabled,
    repairBefore: state.repairComplete === 3 && state.repairPending === 2,
    viewport: state.canvas.width === width && state.canvas.height === height
      && state.document.width === width && state.document.height === height,
    robotGrounded: state.robot && state.robot.y === state.robot.baseY && state.robot.angle === 0
      && Math.abs(state.robot.scale - 0.2520718) < 1e-9 && viewportContains(state.robot.bounds),
  };
}

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await enterShadowTask(page, touch);
  const state = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage6-shadow-${name}.png`) });
  const checks = { ...baseChecks(state, width, height), errors: Object.values(errors).every((items) => items.length === 0) };
  await context.close();
  return { name, width, height, state, checks, errors };
}

async function challengeState(page) {
  return page.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    const keys = [...card.choices.keys()];
    const correct = [...card.configuredHintKeys][0];
    return { keys, correct, wrong: keys.find((key) => key !== correct) };
  });
}

async function testHint(page, touch) {
  await activate(page, 'Подсказка', touch, 'GameScene', 80);
  const targetPhase = await snapshot(page);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    .children.getByName('task-card')?.getData('shadowHintStage') === 'choice');
  const choicePhase = await snapshot(page);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    .children.getByName('task-card')?.getData('shadowHintStage') === 'idle');
  return { targetPhase, choicePhase };
}

async function runFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await installAudioProbe(page);
  await enterShadowTask(page, false);
  await clearAudioProbe(page);

  const initial = await snapshot(page);
  await activate(page, 'check-button', false, 'GameScene', 80);
  const emptyCheck = await snapshot(page);

  const first = await challengeState(page);
  await activate(page, `choice-${first.wrong}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(320);
  const resized = await snapshot(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await sleep(320);
  await activate(page, `choice-${first.correct}`);
  const changedSelection = await snapshot(page);
  await selectAndCheck(page, first.wrong, false, 70);
  const challenge1Wrong = await snapshot(page);
  await sleep(360);
  const hint1 = await testHint(page, false);
  await selectAndCheck(page, first.correct, false, 260);
  const challenge1Correct = await snapshot(page);
  await activate(page, 'continue-button', false, 'GameScene', 160);

  const second = await challengeState(page);
  await selectAndCheck(page, second.wrong, false, 70);
  const challenge2Wrong = await snapshot(page);
  await sleep(360);
  await activate(page, '♪ Звук', false, 'GameScene', 80);
  const muted = await snapshot(page);
  const mutedHint = await testHint(page, false);
  await activate(page, '× Звук', false, 'GameScene', 80);
  const hint2 = await testHint(page, false);
  await selectAndCheck(page, second.correct, false, 260);
  const challenge2Correct = await snapshot(page);
  await activate(page, 'continue-button', false, 'GameScene', 160);

  const third = await challengeState(page);
  await selectAndCheck(page, third.wrong, false, 70);
  const challenge3Wrong = await snapshot(page);
  await sleep(360);
  const hint3 = await testHint(page, false);
  const correctPoint = await pointFor(page, `choice-${third.correct}`);
  await page.mouse.click(correctPoint.x, correctPoint.y, { clickCount: 3, delay: 20 });
  await sleep(80);
  const checkPoint = await pointFor(page, 'check-button');
  await page.mouse.click(checkPoint.x, checkPoint.y, { clickCount: 3, delay: 20 });
  await sleep(900);
  const challenge3Correct = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage6-shadow-complete-1280x720.png') });

  const audioCount = (key) => challenge3Correct.audio.filter((event) => event.key === key).length;
  const correctSlots = [
    initial.choiceOrder.indexOf(first.correct),
    challenge2Wrong.choiceOrder.indexOf(second.correct),
    challenge3Wrong.choiceOrder.indexOf(third.correct),
  ];

  await activate(page, '⌂ Домой', false, 'GameScene', 180);
  const homeScene = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
  await activate(page, 'Играть', false, 'StartScene', 160);
  const restarted = await snapshot(page);

  const hintPass = (hint, expectedText) => hint.targetPhase.hintStage === 'target'
    && hint.choicePhase.hintStage === 'choice' && hint.targetPhase.dialogue.visible
    && hint.targetPhase.dialogue.text === expectedText;
  const wrongPass = (state) => state.result === 'wrong' && state.selectedKey === null
    && state.repairComplete === 3 && !state.checkEnabled;
  const correctPass = (state, internal, continueVisible) => state.result === 'correct'
    && state.internalProgress === internal && state.continueVisible === continueVisible;
  const checks = {
    fullFlowToTask4: initial.taskLabel === 'ЗАДАНИЕ 4 ИЗ 5' && initial.repairComplete === 3,
    emptyCheck: emptyCheck.result === 'idle' && emptyCheck.selectedKey === null
      && emptyCheck.audio.filter((event) => event.key === 'audio-answer-wrong').length === 0,
    resizePreservesSelection: resized.selectedKey === first.wrong && resized.taskLabel === 'ЗАДАНИЕ 4 ИЗ 5',
    changeSelection: changedSelection.selectedKey === first.correct && changedSelection.checkEnabled,
    challenge1Wrong: wrongPass(challenge1Wrong),
    challenge1Hint: hintPass(hint1, 'Сравни контур яблока'),
    challenge1Correct: correctPass(challenge1Correct, 'ТЕНЬ 1 ИЗ 3', true) && challenge1Correct.repairComplete === 3,
    challenge2Wrong: wrongPass(challenge2Wrong),
    challenge2Hint: hintPass(hint2, 'Сравни изгиб банана'),
    challenge2Correct: correctPass(challenge2Correct, 'ТЕНЬ 2 ИЗ 3', true) && challenge2Correct.repairComplete === 3,
    challenge3Wrong: wrongPass(challenge3Wrong),
    challenge3Hint: hintPass(hint3, 'Найди круглый контур'),
    challenge3Correct: correctPass(challenge3Correct, 'ТЕНЬ 3 ИЗ 3', false)
      && challenge3Correct.repairComplete === 4 && challenge3Correct.repairPending === 1,
    randomization: new Set(correctSlots).size > 1,
    rapidTapSafety: challenge3Correct.session.completedTasks === 4
      && audioCount('audio-answer-correct') === 3 && audioCount('audio-repair-reward') === 1,
    audio: audioCount('audio-answer-wrong') === 3 && audioCount('audio-hint') === 3
      && audioCount('audio-answer-correct') === 3 && audioCount('audio-repair-reward') === 1,
    mute: muted.muted && mutedHint.choicePhase.audio.filter((event) => event.key === 'audio-hint').length
      === muted.audio.filter((event) => event.key === 'audio-hint').length,
    robotRegression: challenge3Correct.robot.y === challenge3Correct.robot.baseY
      && challenge3Correct.robot.angle === 0 && Math.abs(challenge3Correct.robot.scale - 0.2520718) < 1e-9,
    homeRestart: homeScene && restarted.taskLabel === 'ЗАДАНИЕ 1 ИЗ 5' && restarted.repairComplete === 0,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return {
    checks, errors, correctSlots,
    states: { initial, emptyCheck, resized, changedSelection, challenge1Wrong, challenge1Correct,
      challenge2Wrong, challenge2Correct, muted, challenge3Wrong, challenge3Correct, restarted },
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--autoplay-policy=user-gesture-required'],
  });
  const matrix = [];
  for (const viewport of viewports) matrix.push(await runViewport(browser, viewport));
  const flow = await runFlow(browser);
  await browser.close();
  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, value]) => !value)
      .map(([key]) => `${entry.name}:${key}`)),
    ...Object.entries(flow.checks).filter(([, value]) => !value).map(([key]) => `flow:${key}`),
  ];
  const report = { matrix, flow, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage6-shadow-matching-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ matrix: matrix.map(({ name, checks }) => ({ name, checks })), flow: flow.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
