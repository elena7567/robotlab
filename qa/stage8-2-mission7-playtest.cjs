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

async function activate(page, name, sceneKey, settleMs = 100) {
  const point = await pointFor(page, name, sceneKey);
  await page.mouse.click(point.x, point.y);
  await sleep(settleMs);
}

async function drag(page, from, to, touch = false) {
  const a = typeof from === 'string' ? await pointFor(page, from, 'Mission7Scene') : from;
  const b = typeof to === 'string' ? await pointFor(page, to, 'Mission7Scene') : to;
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, radiusX: 12, radiusY: 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, radiusX: 12, radiusY: 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x, y: b.y, radiusX: 12, radiusY: 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
    await page.mouse.move(b.x, b.y, { steps: 3 });
    await page.mouse.up();
  }
  await sleep(100);
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

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission7Scene');
    const find = (name) => {
      const walk = (item) => {
        if (item?.name === name) return item;
        if (item?.list) for (const child of item.list) { const found = walk(child); if (found) return found; }
        return null;
      };
      return scene.children.list.map(walk).find(Boolean);
    };
    const bounds = (item) => {
      if (!item) return null;
      const b = item.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
    };
    const card = find('connection-task-card');
    const colors = ['red', 'blue', 'green', 'yellow'];
    return {
      viewport: { width: game.canvas.width, height: game.canvas.height },
      session: game.registry.get('sessionSnapshot'),
      mission7Complete: game.registry.get('mission7Complete') || false,
      cardBounds: bounds(card),
      challengeIndex: card?.getData('challengeIndex'),
      destinationOrder: card?.getData('destinationOrder'),
      connected: card?.getData('connected') || [],
      ports: colors.flatMap((color) => ['source', 'target'].map((side) => {
        const port = find(`connection-${side}-${color}`);
        return port ? { color, side, bounds: bounds(port), hitWidth: port.input?.hitArea?.diameter ?? port.getData('hitWidth'), locked: port.getData('locked') } : null;
      })).filter(Boolean),
      feedback: find('connection-feedback')?.text,
      temporaryCommands: find('connection-temporary-wire')?.commandBuffer?.length || 0,
      completionVisible: Boolean(find('mission7-completion')),
      robotConnected: find('mission7-repaired-robot')?.getData('systemsConnected') || false,
      lifecycle: find('mission7-repaired-robot')?.getData('lifecycleState'),
      labActive: find('connection-lab-conduit')?.getData('active') || false,
      audio: [...(window.__ROBOTLAB_AUDIO_EVENTS__ || [])],
    };
  });
}

async function startDirect(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await installAudioProbe(page);
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.start('Mission7Scene'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission7Scene'));
  await sleep(180);
}

async function completeCurrentChallenge(page, touch = false, partialShot) {
  const state = await snapshot(page);
  const colors = state.ports.filter((port) => port.side === 'source').map((port) => port.color);
  for (const [index, color] of colors.entries()) {
    await drag(page, `connection-source-${color}`, `connection-target-${color}`, touch);
    if (index === 0 && partialShot) await page.screenshot({ path: partialShot });
  }
}

async function responsiveRun(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startDirect(page);
  const initial = await snapshot(page);
  if (name === 'mobile-390x844' || name === 'desktop-1280x720') {
    await page.screenshot({ path: path.join(screenshotDir, `stage8-2-${name}-connection-1-of-3.png`) });
  }
  await activate(page, 'connection-hint-button', 'Mission7Scene');
  const hintAudio = (await snapshot(page)).audio.filter((key) => key === 'audio-hint').length;
  const redTarget = initial.destinationOrder.includes('blue') ? 'blue' : 'green';
  await drag(page, 'connection-source-red', `connection-target-${redTarget}`, touch);
  const wrong = await snapshot(page);
  const sourceBlue = await pointFor(page, 'connection-source-blue', 'Mission7Scene');
  await drag(page, sourceBlue, { x: width / 2, y: initial.cardBounds.bottom - 24 }, touch);
  const empty = await snapshot(page);
  await drag(page, 'connection-source-red', 'connection-target-red', touch);
  const partial = await snapshot(page);
  if (name === 'mobile-390x844' || name === 'desktop-1280x720') {
    await page.screenshot({ path: path.join(screenshotDir, `stage8-2-${name}-partially-connected.png`) });
  }
  const correctCount = partial.audio.filter((key) => key === 'audio-answer-correct').length;
  await drag(page, 'connection-source-red', 'connection-target-red', touch);
  const duplicate = await snapshot(page);
  const liveBefore = JSON.stringify(duplicate.connected);
  await page.setViewportSize({ width: width === 390 ? 391 : width - 1, height });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission7Scene'));
  await sleep(150);
  const resized = await snapshot(page);
  const inside = (b) => b && b.x >= -1 && b.y >= -1 && b.right <= resized.viewport.width + 1 && b.bottom <= resized.viewport.height + 1;
  const checks = {
    missionCopy: initial.session?.connectionsCompleted === false && initial.challengeIndex === 0,
    responsive: inside(resized.cardBounds) && resized.ports.every((port) => inside(port.bounds)),
    touchTargets: initial.ports.every((port) => port.hitWidth >= (height <= 568 ? 48 : 64)),
    hint: hintAudio === 1,
    wrongConnection: wrong.connected.length === 0 && wrong.audio.filter((key) => key === 'audio-answer-wrong').length === 1,
    emptyRelease: empty.connected.length === 0 && empty.audio.filter((key) => key === 'audio-answer-wrong').length === 1,
    correctConnection: partial.connected.length === 1 && correctCount === 1,
    duplicateGuard: duplicate.connected.length === 1 && duplicate.audio.filter((key) => key === 'audio-answer-correct').length === correctCount,
    liveResize: JSON.stringify(resized.connected) === liveBefore,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  if (name === 'mobile-390x844') {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission7Scene'));
    await sleep(150);
    for (const color of ['blue', 'green']) await drag(page, `connection-source-${color}`, `connection-target-${color}`, true);
    await page.screenshot({ path: path.join(screenshotDir, 'stage8-2-mobile-390x844-completed-board.png') });
  }
  await context.close();
  return { name, checks, errors, initial, wrong, empty, partial, duplicate, resized };
}

async function waitForTask(page, task) {
  await page.waitForFunction((taskNumber) => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene');
    const card = scene?.children.getByName('task-card') || scene?.children.getByName('memory-task-card');
    return card?.list.some((item) => item.text === `ЗАДАНИЕ ${taskNumber} ИЗ 10`);
  }, task);
}

async function selectAndCheck(page, key, settleMs = 260) {
  await activate(page, `choice-${key}`, 'GameScene', 50);
  await activate(page, 'check-button', 'GameScene', settleMs);
}

async function completeMissions1To5(page) {
  await activate(page, 'Играть', 'StartScene', 150);
  await waitForTask(page, 1);
  await selectAndCheck(page, 'odd-ball'); await sleep(2000); await activate(page, 'continue-button', 'GameScene', 180);
  for (const [index, key] of ['sequence-star', 'sequence-planet', 'sequence-planet'].entries()) {
    await waitForTask(page, 2); await selectAndCheck(page, key); if (index === 2) await sleep(2000); await activate(page, 'continue-button', 'GameScene', 180);
  }
  for (const [index, key] of ['size-large', 'size-small', 'size-medium'].entries()) {
    await waitForTask(page, 3); await selectAndCheck(page, key); if (index === 2) await sleep(2000); await activate(page, 'continue-button', 'GameScene', 180);
  }
  await waitForTask(page, 4);
  for (let challenge = 0; challenge < 3; challenge += 1) {
    await page.waitForFunction((index) => window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card')?.feedbackPrefix === `ТЕНЬ ${index + 1} ИЗ 3`, challenge);
    const correct = await page.evaluate(() => [...window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card').configuredHintKeys][0]);
    await selectAndCheck(page, correct, 500); if (challenge < 2) await activate(page, 'continue-button', 'GameScene', 320);
  }
  await waitForTask(page, 5);
  const cards = await page.evaluate(() => [...window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('memory-task-card').cardViews.keys()].map((id) => ({ id, pairId: id.replace(/-[01]$/, '') })));
  const groups = [...new Set(cards.map((card) => card.pairId))].map((pairId) => cards.filter((card) => card.pairId === pairId).map((card) => card.id));
  for (const group of groups) { await activate(page, `memory-card-${group[0]}`, 'GameScene', 50); await activate(page, `memory-card-${group[1]}`, 'GameScene', 520); }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('TransitionScene'), null, { timeout: 12000 });
}

async function completeMission6(page) {
  await activate(page, 'transition-continue', 'TransitionScene', 180);
  for (const level of ['full', 'low']) {
    await activate(page, `energy-battery-${level}`, 'Mission6Scene', 40); await activate(page, 'energy-check-button', 'Mission6Scene', 760);
  }
  for (const level of ['low', 'medium', 'full']) await activate(page, `energy-battery-${level}`, 'Mission6Scene', 40);
  await activate(page, 'energy-check-button', 'Mission6Scene', 900);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission6Complete') === true, null, { timeout: 6000 });
  await sleep(350);
  await activate(page, 'mission6-continue', 'Mission6Scene', 180);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission7Scene'));
}

async function fullFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await installAudioProbe(page);
  await completeMissions1To5(page);
  await completeMission6(page);
  await page.evaluate(() => { window.__ROBOTLAB_AUDIO_EVENTS__ = []; });
  const layouts = [];
  for (let challenge = 0; challenge < 3; challenge += 1) {
    const before = await snapshot(page);
    layouts.push(before.destinationOrder);
    const shot = challenge === 0 ? path.join(screenshotDir, 'stage8-2-desktop-1280x720-partially-connected.png') : undefined;
    await completeCurrentChallenge(page, false, shot);
    if (challenge === 0) await page.screenshot({ path: path.join(screenshotDir, 'stage8-2-desktop-1280x720-completed-board.png') });
    if (challenge < 2) {
      await page.waitForFunction((index) => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('connection-task-card')?.getData('challengeIndex') === index, challenge + 1, { timeout: 4000 });
    }
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission7Complete') === true, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene')
    .children.getByName('mission7-actors')?.getByName('mission7-repaired-robot')?.getData('systemsPulseActive') === true, null, { timeout: 4000 });
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-2-desktop-1280x720-mission-completion-robot-pulse.png') });
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene');
    const robot = scene.children.getByName('mission7-actors')?.getByName('mission7-repaired-robot');
    return Boolean(scene.children.getByName('mission7-completion')) && robot?.getData('systemsConnected') === true;
  }, null, { timeout: 5000 });
  const complete = await snapshot(page);
  const checks = {
    mission6Transition: complete.session.completedTasks === 7,
    challenge1: layouts[0].length === 3,
    challenge2: layouts[1].length === 4,
    challenge3: layouts[2].length === 4,
    randomization: layouts.every((order) => order.some((color, index) => color !== ['red', 'blue', 'green', 'yellow'][index])),
    completion: complete.mission7Complete && complete.session.connectionsCompleted && complete.completionVisible,
    robotSystems: complete.robotConnected && complete.lifecycle === 'systems-connected',
    labReactivity: complete.labActive,
    audio: complete.audio.filter((key) => key === 'audio-answer-correct').length === 11
      && complete.audio.filter((key) => key === 'audio-repair-reward').length === 1,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { checks, errors, layouts, complete };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--autoplay-policy=user-gesture-required'] });
  const matrix = [];
  for (const viewport of viewports) matrix.push(await responsiveRun(browser, viewport));
  const flow = await fullFlow(browser);
  await browser.close();
  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, passed]) => !passed).map(([check]) => `${entry.name}:${check}`)),
    ...Object.entries(flow.checks).filter(([, passed]) => !passed).map(([check]) => `full-flow:${check}`),
  ];
  const report = { matrix, flow, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-2-mission7-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ matrix: matrix.map(({ name, checks }) => ({ name, checks })), flow: flow.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
