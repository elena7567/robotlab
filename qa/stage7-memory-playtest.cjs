const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4197/';
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
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function pointFor(page, name, sceneKey = 'GameScene') {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const find = (item) => {
      if (item?.name === name) return item;
      if (item?.list) {
        for (const child of item.list) {
          const found = find(child);
          if (found) return found;
        }
      }
      return null;
    };
    const target = scene.children.list.map(find).find(Boolean)
      || scene.children.list.find((item) => item.list?.some((child) => child.text === name));
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, touch = false, sceneKey = 'GameScene', settleMs = 100) {
  const point = await pointFor(page, name, sceneKey);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(settleMs);
}

async function waitForTask(page, taskNumber) {
  await page.waitForFunction((task) => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene');
    const card = scene?.children.getByName('task-card') || scene?.children.getByName('memory-task-card');
    return card?.list.some((item) => item.text === `ЗАДАНИЕ ${task} ИЗ 5`);
  }, taskNumber);
}

async function selectAndCheck(page, key, touch, settleMs = 260) {
  await activate(page, `choice-${key}`, touch);
  await activate(page, 'check-button', touch, 'GameScene', settleMs);
}

async function enterMemory(page, touch) {
  await activate(page, 'Играть', touch, 'StartScene', 130);
  await waitForTask(page, 1);
  await selectAndCheck(page, 'odd-ball', touch);
  await activate(page, 'continue-button', touch, 'GameScene', 150);
  for (const key of ['sequence-star', 'sequence-planet', 'sequence-planet']) {
    await waitForTask(page, 2);
    await selectAndCheck(page, key, touch);
    await activate(page, 'continue-button', touch, 'GameScene', 160);
  }
  for (const key of ['size-large', 'size-small', 'size-medium']) {
    await waitForTask(page, 3);
    await selectAndCheck(page, key, touch);
    await activate(page, 'continue-button', touch, 'GameScene', 180);
  }
  await waitForTask(page, 4);
  for (let challenge = 0; challenge < 3; challenge += 1) {
    const correct = await page.evaluate(() => {
      const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
      return [...card.configuredHintKeys][0];
    });
    await selectAndCheck(page, correct, touch, 300);
    if (challenge < 2) await activate(page, 'continue-button', touch, 'GameScene', 180);
  }
  await waitForTask(page, 5);
}

async function installAudioProbe(page) {
  await page.evaluate(() => {
    const sound = window.__ROBOTLAB_GAME__.sound;
    window.__ROBOTLAB_AUDIO_EVENTS__ = [];
    const original = sound.play.bind(sound);
    sound.play = (key, config) => {
      window.__ROBOTLAB_AUDIO_EVENTS__.push({ key, muted: sound.mute });
      return original(key, config);
    };
  });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('memory-task-card');
    const progress = scene.children.getByName('progress-panel');
    const robot = scene.children.getByName('logical-actors')?.getByName('grounded-robot');
    const dialogue = scene.children.getByName('robot-dialogue');
    const bounds = (item) => {
      if (!item) return null;
      const b = item.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
    };
    const cards = card ? [...card.cardViews.entries()].map(([id, view]) => ({
      id,
      pairId: id.replace(/-[01]$/, ''),
      state: view.state,
      faceVisible: view.face.visible,
      coverVisible: view.cover.visible,
      interactive: view.container.input?.enabled ?? false,
      hitWidth: view.container.input?.hitArea?.width ?? view.container.width,
      hitHeight: view.container.input?.hitArea?.height ?? view.container.height,
      bounds: bounds(view.container),
      x: view.container.x,
      y: view.container.y,
    })) : [];
    return {
      task: card?.list.find((item) => item.name === 'memory-task-label')?.text,
      title: card?.list.find((item) => item.name === 'memory-title')?.text,
      instruction: card?.list.find((item) => item.name === 'memory-instruction')?.text,
      internalProgress: card?.progressText?.text,
      matchedPairs: card?.getData('matchedPairs'),
      locked: card?.getData('locked'),
      completed: card?.getData('completed'),
      cards,
      columns: new Set(cards.map((item) => Math.round(item.x))).size,
      repairComplete: progress?.progressLayer?.list.filter((item) => item.name === 'repair-indicator-complete').length ?? 0,
      repairPending: progress?.progressLayer?.list.filter((item) => item.name === 'repair-indicator-pending').length ?? 0,
      cardBounds: bounds(card),
      robotBounds: bounds(robot),
      robot: robot ? { y: robot.y, baseY: robot.getData('baseY'), angle: robot.angle, scale: robot.scaleX } : null,
      dialogue: dialogue ? { visible: dialogue.visible, text: dialogue.label?.text } : null,
      session: game.registry.get('sessionSnapshot'),
      audio: [...(window.__ROBOTLAB_AUDIO_EVENTS__ || [])],
      muted: game.sound.mute,
      viewport: { width: game.canvas.width, height: game.canvas.height },
    };
  });
}

function noOverlap(a, b) {
  return a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y;
}

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await enterMemory(page, touch);
  const state = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage7-memory-${name}.png`) });
  const pairGroups = [...new Set(state.cards.map((card) => card.pairId))]
    .map((pairId) => state.cards.filter((card) => card.pairId === pairId).map((card) => card.id));
  for (const group of pairGroups) {
    await activate(page, `memory-card-${group[0]}`, touch, 'GameScene', 50);
    await activate(page, `memory-card-${group[1]}`, touch, 'GameScene', 520);
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('VictoryScene'));
  const completion = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('VictoryScene');
    const bounds = (name) => {
      const b = scene.children.getByName(name)?.getBounds();
      return b ? { x: b.x, y: b.y, right: b.right, bottom: b.bottom } : null;
    };
    return {
      title: scene.children.getByName('victory-title')?.text,
      subtitle: scene.children.getByName('victory-subtitle')?.text,
      titleBounds: bounds('victory-title'),
      subtitleBounds: bounds('victory-subtitle'),
      playBounds: bounds('victory-play-again'),
      homeBounds: bounds('victory-home'),
    };
  });
  let finalHome = true;
  if (name === 'mobile-390x844') {
    await activate(page, 'victory-home', touch, 'VictoryScene', 180);
    finalHome = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
  }
  const inside = (b) => b && b.x >= -1 && b.y >= -1 && b.right <= width + 1 && b.bottom <= height + 1;
  const checks = {
    labels: state.task === 'ЗАДАНИЕ 5 ИЗ 5' && state.title === 'НАЙДИ ПАРЫ'
      && state.instruction === 'ОТКРОЙ ОДИНАКОВЫЕ КАРТОЧКИ' && state.internalProgress === 'ПАРЫ 0 ИЗ 4',
    cards: state.cards.length === 8 && state.cards.every((card) => card.state === 'FACE_DOWN'
      && card.coverVisible && !card.faceVisible && inside(card.bounds)),
    touchTargets: state.cards.every((card) => card.hitWidth >= 56 && card.hitHeight >= 44),
    layout: state.columns === (name === 'tablet-768x1024' ? 2 : 4),
    randomization: state.cards.every((card, index) => index % 4 === 3 || state.cards[index + 1]?.pairId !== card.pairId),
    repairBefore: state.repairComplete === 4 && state.repairPending === 1,
    noOverlap: inside(state.cardBounds) && inside(state.robotBounds) && noOverlap(state.cardBounds, state.robotBounds),
    robotGrounded: state.robot?.y === state.robot?.baseY && state.robot?.angle === 0,
    viewport: state.viewport.width === width && state.viewport.height === height,
    completionResponsive: completion.title === 'РОБОТ ПОЧИНЕН!'
      && completion.subtitle === 'ТЫ ВЫПОЛНИЛ ВСЕ ЗАДАНИЯ'
      && inside(completion.titleBounds) && inside(completion.subtitleBounds)
      && inside(completion.playBounds) && inside(completion.homeBounds),
    finalHome,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { name, state, completion, checks, errors };
}

async function cardOrder(page) {
  const state = await snapshot(page);
  return state.cards.map((card) => card.id);
}

async function tapCard(page, id, settleMs = 120) {
  await activate(page, `memory-card-${id}`, false, 'GameScene', settleMs);
}

async function runFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await installAudioProbe(page);
  await enterMemory(page, false);
  await page.evaluate(() => { window.__ROBOTLAB_AUDIO_EVENTS__ = []; });
  const initial = await snapshot(page);

  await activate(page, 'memory-hint-button', false, 'GameScene', 140);
  const hintNoSelection = await snapshot(page);
  await sleep(1100);
  const afterHintNoSelection = await snapshot(page);
  await activate(page, '♪ Звук', false, 'GameScene', 100);
  const mutedBeforeHint = await snapshot(page);
  await activate(page, 'memory-hint-button', false, 'GameScene', 140);
  const mutedHint = await snapshot(page);
  await sleep(1100);
  await activate(page, '× Звук', false, 'GameScene', 100);

  const order = await cardOrder(page);
  const firstId = order[0];
  await tapCard(page, firstId, 130);
  await tapCard(page, firstId, 80);
  const sameCardTwice = await snapshot(page);
  await activate(page, 'memory-hint-button', false, 'GameScene', 140);
  const hintWithSelection = await snapshot(page);
  await sleep(1100);
  const afterHintWithSelection = await snapshot(page);

  const firstPair = firstId.replace(/-[01]$/, '');
  const wrongId = order.find((id) => id.replace(/-[01]$/, '') !== firstPair);
  await tapCard(page, wrongId, 80);
  const thirdId = order.find((id) => id !== firstId && id !== wrongId);
  await tapCard(page, thirdId, 70);
  const thirdTapLocked = await snapshot(page);
  await sleep(1050);
  const mismatch = await snapshot(page);

  const currentOrder = await cardOrder(page);
  const groups = [...new Set(currentOrder.map((id) => id.replace(/-[01]$/, '')))]
    .map((pairId) => currentOrder.filter((id) => id.replace(/-[01]$/, '') === pairId));
  await tapCard(page, groups[0][0], 50);
  await tapCard(page, groups[0][1], 520);
  const firstMatch = await snapshot(page);
  const audioBeforeMatchedTap = firstMatch.audio.length;
  await tapCard(page, groups[0][0], 100);
  const matchedTap = await snapshot(page);

  await tapCard(page, groups[1][0], 220);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(350);
  const resized = await snapshot(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await sleep(350);
  await tapCard(page, groups[1][1], 520);
  for (const group of groups.slice(2, 3)) {
    await tapCard(page, group[0], 50);
    await tapCard(page, group[1], 520);
  }
  await tapCard(page, groups[3][0], 50);
  await tapCard(page, groups[3][1], 520);
  const finalPair = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage7-memory-final-pair-4-of-4.png') });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('VictoryScene'));
  const victory = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('VictoryScene');
    const findText = (name) => scene.children.getByName(name)?.text;
    return {
      title: findText('victory-title'), subtitle: findText('victory-subtitle'),
      playAgain: Boolean(scene.children.getByName('victory-play-again')),
      home: Boolean(scene.children.getByName('victory-home')),
      session: game.registry.get('sessionSnapshot'),
    };
  });
  await page.screenshot({ path: path.join(screenshotDir, 'stage7-final-completion-1280x720.png') });

  await activate(page, 'victory-play-again', false, 'VictoryScene', 180);
  const playAgain = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    return { active: scene.sys.isActive(), task: card?.list.find((item) => /^ЗАДАНИЕ/.test(item.text || ''))?.text,
      session: game.registry.get('sessionSnapshot') };
  });
  await activate(page, '⌂ Домой', false, 'GameScene', 180);
  const homeFromGame = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
  await activate(page, 'Играть', false, 'StartScene', 160);
  const restartedTask = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    .children.getByName('task-card')?.list.find((item) => /^ЗАДАНИЕ/.test(item.text || ''))?.text);

  const countAudio = (state, key) => state.audio.filter((event) => event.key === key).length;
  const checks = {
    fullFlowToMemory: initial.task === 'ЗАДАНИЕ 5 ИЗ 5' && initial.repairComplete === 4,
    hintNoSelection: hintNoSelection.cards.filter((card) => card.faceVisible).length === 2
      && afterHintNoSelection.cards.every((card) => card.state === 'FACE_DOWN' && card.coverVisible),
    sameCardTwice: sameCardTwice.cards.filter((card) => card.state === 'FACE_UP').length === 1 && !sameCardTwice.locked,
    hintWithSelection: hintWithSelection.cards.filter((card) => card.faceVisible).length === 2
      && afterHintWithSelection.cards.filter((card) => card.state === 'FACE_UP').length === 1,
    thirdTapLock: thirdTapLocked.locked && thirdTapLocked.cards.filter((card) => card.state === 'FACE_UP').length === 2,
    mismatch: !mismatch.locked && mismatch.matchedPairs === 0 && mismatch.cards.every((card) => card.state === 'FACE_DOWN'),
    match: firstMatch.matchedPairs === 1 && firstMatch.cards.filter((card) => card.state === 'MATCHED').length === 2,
    matchedTap: matchedTap.audio.length === audioBeforeMatchedTap && matchedTap.matchedPairs === 1,
    resizePreservesSelection: resized.cards.filter((card) => card.state === 'FACE_UP').length === 1 && resized.matchedPairs === 1,
    finalRepair: finalPair.internalProgress === 'ПАРЫ 4 ИЗ 4' && finalPair.repairComplete === 5
      && finalPair.repairPending === 0 && finalPair.completed && finalPair.session.completedTasks === 5,
    audio: countAudio(finalPair, 'audio-answer-wrong') === 1
      && countAudio(finalPair, 'audio-answer-correct') === 4
      && countAudio(finalPair, 'audio-hint') === 2
      && countAudio(finalPair, 'audio-repair-reward') === 1,
    mute: mutedBeforeHint.muted && countAudio(mutedHint, 'audio-hint') === countAudio(mutedBeforeHint, 'audio-hint'),
    finalRobot: finalPair.dialogue?.text === 'Я СНОВА РАБОТАЮ!',
    victory: victory.title === 'РОБОТ ПОЧИНЕН!' && victory.subtitle === 'ТЫ ВЫПОЛНИЛ ВСЕ ЗАДАНИЯ'
      && victory.playAgain && victory.home && victory.session.completedTasks === 5,
    playAgain: playAgain.active && playAgain.task === 'ЗАДАНИЕ 1 ИЗ 5' && playAgain.session.completedTasks === 0,
    home: homeFromGame && restartedTask === 'ЗАДАНИЕ 1 ИЗ 5',
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { checks, errors, states: { initial, hintNoSelection, sameCardTwice, hintWithSelection, thirdTapLocked,
    mismatch, firstMatch, resized, mutedBeforeHint, mutedHint, finalPair, victory, playAgain } };
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
  const distinctOrders = new Set(matrix.map((entry) => entry.state.cards.map((card) => card.id).join(','))).size;
  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, value]) => !value).map(([key]) => `${entry.name}:${key}`)),
    ...(distinctOrders > 1 ? [] : ['matrix:varied-layouts']),
    ...Object.entries(flow.checks).filter(([, value]) => !value).map(([key]) => `flow:${key}`),
  ];
  const report = { matrix, distinctOrders, flow, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage7-memory-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ matrix: matrix.map(({ name, checks }) => ({ name, checks })), distinctOrders, flow: flow.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
