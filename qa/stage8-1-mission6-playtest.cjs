const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['minimum-320x568', 320, 568, true],
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['desktop-1280x720', 1280, 720, false],
  ['wide-1438x914', 1438, 914, false],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function pointFor(page, name, sceneKey) {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const find = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) { const found = find(child); if (found) return found; }
      return null;
    };
    const target = scene.children.list.map(find).find(Boolean)
      || scene.children.list.find((item) => item.list?.some((child) => child.text === name));
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, touch, sceneKey, settleMs = 100) {
  const point = await pointFor(page, name, sceneKey);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(settleMs);
}

async function waitForTask(page, task) {
  await page.waitForFunction((taskNumber) => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene');
    const card = scene?.children.getByName('task-card') || scene?.children.getByName('memory-task-card');
    return card?.list.some((item) => item.text === `ЗАДАНИЕ ${taskNumber} ИЗ 10`);
  }, task);
}

async function selectAndCheck(page, key, touch, settleMs = 260) {
  await activate(page, `choice-${key}`, touch, 'GameScene', 50);
  await activate(page, 'check-button', touch, 'GameScene', settleMs);
}

async function completeMissions1To5(page, touch) {
  await activate(page, 'Играть', touch, 'StartScene', 150);
  await waitForTask(page, 1);
  await selectAndCheck(page, 'odd-ball', touch);
  await sleep(2000);
  await activate(page, 'continue-button', touch, 'GameScene', 180);
  for (const [index, key] of ['sequence-star', 'sequence-planet', 'sequence-planet'].entries()) {
    await waitForTask(page, 2);
    await selectAndCheck(page, key, touch);
    if (index === 2) await sleep(2000);
    await activate(page, 'continue-button', touch, 'GameScene', 180);
  }
  for (const [index, key] of ['size-large', 'size-small', 'size-medium'].entries()) {
    await waitForTask(page, 3);
    await selectAndCheck(page, key, touch);
    if (index === 2) await sleep(2000);
    await activate(page, 'continue-button', touch, 'GameScene', 180);
  }
  await waitForTask(page, 4);
  for (let challenge = 0; challenge < 3; challenge += 1) {
    await page.waitForFunction((index) => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
      .children.getByName('task-card')?.feedbackPrefix === `ТЕНЬ ${index + 1} ИЗ 3`, challenge);
    const correct = await page.evaluate(() => [...window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
      .children.getByName('task-card').configuredHintKeys][0]);
    await selectAndCheck(page, correct, touch, 500);
    if (challenge < 2) await activate(page, 'continue-button', touch, 'GameScene', 320);
  }
  await waitForTask(page, 5);
  const cards = await page.evaluate(() => [...window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    .children.getByName('memory-task-card').cardViews.keys()].map((id) => ({ id, pairId: id.replace(/-[01]$/, '') })));
  const groups = [...new Set(cards.map((card) => card.pairId))]
    .map((pairId) => cards.filter((card) => card.pairId === pairId).map((card) => card.id));
  for (const group of groups) {
    await activate(page, `memory-card-${group[0]}`, touch, 'GameScene', 50);
    await activate(page, `memory-card-${group[1]}`, touch, 'GameScene', 520);
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('TransitionScene'), null, { timeout: 12000 });
}

async function installAudioProbe(page) {
  await page.evaluate(() => {
    const sound = window.__ROBOTLAB_GAME__.sound;
    window.__ROBOTLAB_AUDIO_EVENTS__ = [];
    const original = sound.play.bind(sound);
    sound.play = (key, config) => {
      window.__ROBOTLAB_AUDIO_EVENTS__.push(key);
      return original(key, config);
    };
  });
}

async function sceneSnapshot(page, sceneKey) {
  return page.evaluate((key) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(key);
    const bounds = (item) => {
      if (!item) return null;
      const b = item.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
    };
    const card = scene.children.getByName('energy-task-card');
    const actors = scene.children.getByName('mission6-actors');
    const helper = actors?.getByName('grounded-robot');
    const repaired = scene.children.getByName('mission6-actors')?.getByName('mission6-repaired-robot');
    const conduits = scene.children.getByName('mission6-actors')?.getByName('energy-conduits');
    const dialogue = scene.children.getByName('robot-dialogue');
    const systems = scene.children.getByName('systems-progress');
    return {
      scene: key,
      viewport: { width: game.canvas.width, height: game.canvas.height },
      session: game.registry.get('sessionSnapshot'),
      mission6Complete: game.registry.get('mission6Complete') || false,
      title: scene.children.getByName('transition-title')?.text,
      subtitle: scene.children.getByName('transition-subtitle')?.text,
      cardBounds: bounds(card),
      helperBounds: bounds(helper),
      repairedBounds: bounds(repaired),
      dialogueBounds: bounds(dialogue),
      dialogueVisible: dialogue?.visible || false,
      systemsBounds: bounds(systems),
      systemsVisible: systems?.visible || false,
      instruction: card?.list.find((item) => item.name === 'energy-instruction')?.text,
      progress: card?.list.find((item) => item.name === 'energy-progress')?.text,
      challengeIndex: card?.getData('challengeIndex'),
      challengeKind: card?.getData('challengeKind'),
      batteryTargets: card ? ['low', 'medium', 'full'].map((level) => {
        const battery = card.getByName(`energy-battery-${level}`);
        return { level, bounds: bounds(battery), hitWidth: battery?.input?.hitArea?.width, hitHeight: battery?.input?.hitArea?.height };
      }) : [],
      powered: repaired?.getData('powered') || false,
      lifecycle: repaired?.getData('lifecycleState'),
      conduitsActive: conduits?.getData('active') || false,
      conduitsAlpha: conduits?.alpha,
      rewardPlayed: repaired?.getData('powerActivationPlayed') || false,
      audio: [...(window.__ROBOTLAB_AUDIO_EVENTS__ || [])],
    };
  }, sceneKey);
}

const inside = (b, width, height) => b && b.x >= -1 && b.y >= -1 && b.right <= width + 1 && b.bottom <= height + 1;

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const startCopy = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('StartScene')
    .children.getByName('start-subtitle')?.text);
  await installAudioProbe(page);
  await completeMissions1To5(page, touch);
  const transition = await sceneSnapshot(page, 'TransitionScene');
  if (name === 'mobile-390x844' || name === 'desktop-1280x720') {
    await page.screenshot({ path: path.join(screenshotDir, `stage8-1-${name}-mission5-transition.png`) });
  }
  await activate(page, 'transition-continue', touch, 'TransitionScene', 180);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission6Scene'));
  await page.evaluate(() => { window.__ROBOTLAB_AUDIO_EVENTS__ = []; });
  const initial = await sceneSnapshot(page, 'Mission6Scene');
  if (name === 'mobile-390x844' || name === 'desktop-1280x720') {
    await page.screenshot({ path: path.join(screenshotDir, `stage8-1-${name}-energy-1-of-3.png`) });
  }

  await activate(page, 'energy-check-button', touch, 'Mission6Scene', 80);
  const noSelection = await sceneSnapshot(page, 'Mission6Scene');
  await activate(page, 'energy-battery-low', touch, 'Mission6Scene', 50);
  await activate(page, 'energy-check-button', touch, 'Mission6Scene', 120);
  const wrong = await sceneSnapshot(page, 'Mission6Scene');
  if (name === 'mobile-390x844' || name === 'desktop-1280x720' || name === 'wide-1438x914') {
    await page.screenshot({ path: path.join(screenshotDir, `stage8-1b-${name}-dialogue-safe.png`) });
  }
  await activate(page, 'energy-hint-button', touch, 'Mission6Scene', 120);
  await activate(page, 'energy-battery-full', touch, 'Mission6Scene', 50);
  await activate(page, 'energy-check-button', touch, 'Mission6Scene', 760);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene')
    .children.getByName('energy-task-card')?.getData('challengeIndex') === 1);
  const energy2 = await sceneSnapshot(page, 'Mission6Scene');
  await activate(page, 'energy-hint-button', touch, 'Mission6Scene', 100);
  await activate(page, 'energy-battery-medium', touch, 'Mission6Scene', 40);
  await activate(page, 'energy-battery-low', touch, 'Mission6Scene', 50);
  await activate(page, 'energy-check-button', touch, 'Mission6Scene', 760);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene')
    .children.getByName('energy-task-card')?.getData('challengeIndex') === 2);
  const ordering = await sceneSnapshot(page, 'Mission6Scene');
  if (name === 'mobile-390x844' || name === 'desktop-1280x720') {
    await page.screenshot({ path: path.join(screenshotDir, `stage8-1-${name}-energy-ordering.png`) });
  }
  await activate(page, 'energy-battery-full', touch, 'Mission6Scene', 40);
  await activate(page, 'energy-battery-medium', touch, 'Mission6Scene', 40);
  await activate(page, 'energy-battery-low', touch, 'Mission6Scene', 40);
  await activate(page, 'energy-check-button', touch, 'Mission6Scene', 120);
  const wrongOrder = await sceneSnapshot(page, 'Mission6Scene');
  await activate(page, 'energy-hint-button', touch, 'Mission6Scene', 100);
  for (const level of ['low', 'medium', 'full']) await activate(page, `energy-battery-${level}`, touch, 'Mission6Scene', 40);
  await activate(page, 'energy-check-button', touch, 'Mission6Scene', 80);
  await activate(page, 'energy-check-button', touch, 'Mission6Scene', 900).catch(() => {});
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission6Complete') === true, null, { timeout: 6000 });
  const complete = await sceneSnapshot(page, 'Mission6Scene');
  if (name === 'mobile-390x844' || name === 'desktop-1280x720') {
    await page.screenshot({ path: path.join(screenshotDir, `stage8-1-${name}-mission6-powered.png`) });
  }
  const counts = (key) => complete.audio.filter((item) => item === key).length;
  const noOverlap = (a, b) => a && b && (a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);
  const checks = {
    startCopy: startCopy === 'СОБЕРИ, ОЖИВИ И ЗАПУСТИ РОБОТА!' && !/5|10/.test(startCopy),
    mission5Transition: transition.title === 'РОБОТ СОБРАН!' && transition.subtitle === 'ТЕПЕРЬ ПОРА ЕГО ОЖИВИТЬ!'
      && transition.session.completedTasks === 5 && transition.session.powerActivated === false,
    energy1: initial.instruction === 'КАКАЯ БАТАРЕЯ ПОЛНАЯ?' && initial.progress === 'ЭНЕРГИЯ 1 ИЗ 3',
    noSelectionSafe: noSelection.session.completedTasks === 5 && counts('audio-answer-wrong') === 2,
    wrongReset: wrong.session.completedTasks === 5,
    dialogueSafe: wrong.dialogueVisible && inside(wrong.dialogueBounds, width, height)
      && noOverlap(wrong.dialogueBounds, wrong.cardBounds)
      && noOverlap(wrong.dialogueBounds, wrong.helperBounds)
      && noOverlap(wrong.dialogueBounds, wrong.repairedBounds)
      && (!wrong.systemsVisible || noOverlap(wrong.dialogueBounds, wrong.systemsBounds)),
    hint: counts('audio-hint') === 3,
    energy2: energy2.instruction === 'КАКАЯ БАТАРЕЯ ПОЧТИ ПУСТАЯ?' && energy2.progress === 'ЭНЕРГИЯ 2 ИЗ 3',
    ordering: ordering.challengeKind === 'order' && ordering.progress === 'ЭНЕРГИЯ 3 ИЗ 3',
    wrongOrderReset: wrongOrder.session.completedTasks === 5,
    powerActivation: complete.session.completedTasks === 6 && complete.session.powerActivated && complete.powered && complete.rewardPlayed,
    secondRobotPowered: complete.lifecycle === 'powered',
    labReactivity: complete.conduitsActive && complete.conduitsAlpha > 0.5,
    audio: counts('audio-answer-correct') === 3 && counts('audio-answer-wrong') === 2
      && counts('audio-hint') === 3 && counts('audio-repair-reward') === 1,
    responsive: inside(initial.cardBounds, width, height) && initial.batteryTargets.every((item) => inside(item.bounds, width, height)),
    touchTargets: initial.batteryTargets.every((item) => item.hitWidth >= 56 && item.hitHeight >= 56),
    viewport: complete.viewport.width === width && complete.viewport.height === height,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { name, checks, errors, states: { transition, initial, noSelection, wrong, energy2, ordering, wrongOrder, complete } };
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
  await browser.close();
  const failures = matrix.flatMap((entry) => Object.entries(entry.checks)
    .filter(([, passed]) => !passed).map(([check]) => `${entry.name}:${check}`));
  const report = { matrix, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-1-mission6-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ matrix: matrix.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
