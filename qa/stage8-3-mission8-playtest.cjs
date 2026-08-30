const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['minimum-320x568', 320, 568, true], ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true], ['desktop-1280x720', 1280, 720, false],
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

async function installAudioProbe(page) {
  await page.evaluate(() => {
    const sound = window.__ROBOTLAB_GAME__.sound;
    window.__ROBOTLAB_AUDIO_EVENTS__ = [];
    const original = sound.play.bind(sound);
    sound.play = (key, config) => { window.__ROBOTLAB_AUDIO_EVENTS__.push(key); return original(key, config); };
  });
}

async function pointFor(page, name, sceneKey) {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) { const found = walk(child); if (found) return found; }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, sceneKey = 'Mission8Scene', settleMs = 80) {
  const point = await pointFor(page, name, sceneKey);
  await page.mouse.click(point.x, point.y);
  await sleep(settleMs);
}

async function command(page, direction, settleMs = 30) { await activate(page, `program-command-${direction}`, 'Mission8Scene', settleMs); }

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission8Scene');
    const walk = (item, name) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) { const found = walk(child, name); if (found) return found; }
      return null;
    };
    const find = (name) => scene.children.list.map((item) => walk(item, name)).find(Boolean);
    const bounds = (item) => { if (!item) return null; const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
    const board = find('programming-board');
    const strip = find('program-strip');
    const robot = find('programming-robot');
    const controls = ['program-command-UP', 'program-command-RIGHT', 'program-command-DOWN', 'program-command-LEFT',
      'programming-hint-button', 'programming-delete-button', 'programming-run-button'].map((name) => {
        const control = find(name);
        return { name, bounds: bounds(control), targetWidth: control?.input?.hitArea?.width, targetHeight: control?.input?.hitArea?.height };
      });
    return {
      viewport: { width: game.canvas.width, height: game.canvas.height },
      session: game.registry.get('sessionSnapshot'), mission8Complete: game.registry.get('mission8Complete') || false,
      board: bounds(board), strip: bounds(strip), helper: bounds(find('grounded-robot')), systems: bounds(find('systems-progress')),
      routeLabel: find('programming-route-label')?.text, commands: strip?.getData('commands') || [], maxCommands: strip?.getData('maxCommands'),
      challengeId: board?.getData('challengeId'), columns: board?.getData('columns'), rows: board?.getData('rows'), cellSize: board?.getData('cellSize'),
      robot: { bounds: bounds(robot), column: robot?.getData('gridColumn'), row: robot?.getData('gridRow'), moving: robot?.getData('moving') || false },
      controls, feedback: find('programming-feedback')?.text, completion: Boolean(find('mission8-completion')),
      autonomous: { visible: Boolean(find('mission8-autonomous-robot')), played: find('mission8-autonomous-robot')?.getData('autonomousRewardPlayed') || false,
        programmed: find('mission8-autonomous-robot')?.getData('programmed') || false },
      labActive: find('programming-lab-lights')?.getData('active') || false,
      soundText: find('mission8-sound')?.list?.find((item) => item.text)?.text,
      audio: [...(window.__ROBOTLAB_AUDIO_EVENTS__ || [])], activeScene: game.registry.get('activeScene'),
    };
  });
}

async function startDirect(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await installAudioProbe(page);
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.start('Mission8Scene'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission8Scene'));
  await sleep(180);
}

async function build(page, commands) { for (const direction of commands) await command(page, direction); }

async function touchActivate(page, name, sceneKey = 'Mission8Scene', settleMs = 60) {
  const point = await pointFor(page, name, sceneKey); await page.touchscreen.tap(point.x, point.y); await sleep(settleMs);
}

async function touchBuild(page, commands) { for (const direction of commands) await touchActivate(page, `program-command-${direction}`); }

async function runAndWaitForRoute(page, routeIndex, timeout = 7000) {
  await activate(page, 'programming-run-button', 'Mission8Scene', 20);
  await page.waitForFunction((index) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    return scene.children.getByName('programming-route-label')?.text === `МАРШРУТ ${index + 1} ИЗ 3`;
  }, routeIndex, { timeout });
  await sleep(100);
}

async function responsiveRun(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startDirect(page);
  const initial = await snapshot(page);
  if (name === 'desktop-1280x720') await page.screenshot({ path: path.join(screenshotDir, 'stage8-3-desktop-1280x720-route1-empty.png') });
  if (name === 'mobile-390x844') await page.screenshot({ path: path.join(screenshotDir, 'stage8-3-mobile-390x844-route-board.png') });
  await command(page, 'RIGHT');
  const queueBeforeResize = (await snapshot(page)).commands;
  await page.setViewportSize({ width: width === 320 ? 321 : width - 1, height });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission8Scene'));
  await sleep(160);
  const resized = await snapshot(page);
  await activate(page, 'programming-hint-button');
  const hinted = await snapshot(page);
  await command(page, 'UP'); await activate(page, 'programming-delete-button');
  const edited = await snapshot(page);
  await command(page, 'RIGHT');
  const built = await snapshot(page);
  if (name === 'desktop-1280x720') await page.screenshot({ path: path.join(screenshotDir, 'stage8-3-desktop-1280x720-program-built.png') });
  if (name === 'mobile-390x844') await page.screenshot({ path: path.join(screenshotDir, 'stage8-3-mobile-390x844-command-strip.png') });
  const inside = (b, viewport = resized.viewport) => b && b.x >= -1 && b.y >= -1 && b.right <= viewport.width + 1 && b.bottom <= viewport.height + 1;
  const checks = {
    route1: initial.challengeId === 'straight' && initial.columns === 4 && initial.rows === 2 && initial.maxCommands === 3,
    responsive: [resized.board, resized.strip, resized.systems, ...resized.controls.map((item) => item.bounds)].every((b) => inside(b)),
    touchTargets: resized.controls.every((control) => control.targetWidth >= 56 && control.targetHeight >= 48),
    boardReadable: resized.cellSize >= (width <= 390 ? 45 : 64),
    liveResize: JSON.stringify(resized.commands) === JSON.stringify(queueBeforeResize),
    hint: hinted.audio.filter((key) => key === 'audio-hint').length === 1 && hinted.feedback.includes('→'),
    deleteEdit: JSON.stringify(edited.commands) === JSON.stringify(['RIGHT']),
    programStrip: JSON.stringify(built.commands) === JSON.stringify(['RIGHT', 'RIGHT']),
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { name, checks, errors, initial, resized, hinted, edited, built };
}

async function interactionRun(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startDirect(page);
  await command(page, 'RIGHT');
  await activate(page, 'programming-run-button', 'Mission8Scene', 1200);
  const tooFew = await snapshot(page);
  await command(page, 'RIGHT'); await command(page, 'RIGHT');
  await activate(page, 'programming-run-button', 'Mission8Scene', 2050);
  const extra = await snapshot(page);
  await activate(page, 'programming-delete-button');
  const runPoint = await pointFor(page, 'programming-run-button', 'Mission8Scene');
  await page.mouse.click(runPoint.x, runPoint.y); await page.mouse.click(runPoint.x, runPoint.y);
  await sleep(180);
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-3-desktop-1280x720-robot-executing.png') });
  await sleep(650);
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-3-desktop-1280x720-route-success.png') });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('programming-route-label')?.text === 'МАРШРУТ 2 ИЗ 3', null, { timeout: 6000 });
  const route2 = await snapshot(page);
  await build(page, ['RIGHT', 'UP']);
  await activate(page, 'programming-run-button', 'Mission8Scene', 1550);
  const obstacle = await snapshot(page);
  await activate(page, 'programming-delete-button'); await activate(page, 'programming-delete-button');
  await command(page, 'LEFT'); await activate(page, 'programming-run-button', 'Mission8Scene', 1200);
  const boundary = await snapshot(page);
  await activate(page, 'programming-delete-button');
  await build(page, ['RIGHT', 'RIGHT', 'UP']);
  await runAndWaitForRoute(page, 2);
  const route3 = await snapshot(page);
  await build(page, ['RIGHT', 'UP', 'UP', 'RIGHT', 'RIGHT']);
  await activate(page, 'programming-run-button', 'Mission8Scene', 20);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission8Complete') === true, null, { timeout: 9000 });
  await sleep(250);
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-3-desktop-1280x720-mission-completion.png') });
  await sleep(700);
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-3-desktop-1280x720-autonomous-reward.png') });
  await sleep(1000);
  const complete = await snapshot(page);
  const checks = {
    tooFewRecovery: tooFew.feedback.includes('ИЗМЕНИТЬ') && JSON.stringify(tooFew.commands) === JSON.stringify(['RIGHT']),
    extraCommandRecovery: extra.feedback.includes('ИЗМЕНИТЬ') && extra.commands.length === 3,
    rapidRunGuard: route2.routeLabel === 'МАРШРУТ 2 ИЗ 3' && route2.audio.filter((key) => key === 'audio-answer-correct').length === 1,
    obstacleCollision: obstacle.feedback === 'ТУДА НЕЛЬЗЯ' && obstacle.commands.length === 2,
    boundaryCollision: boundary.feedback === 'ТУДА НЕЛЬЗЯ' && boundary.commands.length === 1,
    route2: route2.challengeId === 'turn' && route2.maxCommands === 4,
    route3: route3.challengeId === 'navigation' && route3.maxCommands === 5,
    completion: complete.mission8Complete && complete.completion,
    autonomousReward: complete.autonomous.visible && complete.autonomous.played && complete.autonomous.programmed,
    labReactivity: complete.labActive,
    audio: complete.audio.filter((key) => key === 'audio-answer-correct').length === 3
      && complete.audio.filter((key) => key === 'audio-repair-reward').length === 1
      && complete.audio.filter((key) => key === 'audio-answer-wrong').length === 4,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { checks, errors, tooFew, extra, obstacle, boundary, route2, route3, complete };
}

async function safetyRun(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(); const errors = captureErrors(page); await startDirect(page);
  await activate(page, 'mission8-sound'); const muted = await snapshot(page); await activate(page, 'mission8-sound');
  await build(page, ['RIGHT', 'RIGHT']); await activate(page, 'programming-run-button', 'Mission8Scene', 30);
  await activate(page, 'mission8-home', 'Mission8Scene', 100);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.start('Mission8Scene'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission8Scene')); await sleep(150);
  const recovered = await snapshot(page); await activate(page, 'programming-delete-button'); const editable = await snapshot(page);
  await context.close();

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const reducedPage = await reducedContext.newPage(); const reducedErrors = captureErrors(reducedPage); await startDirect(reducedPage);
  await touchBuild(reducedPage, ['RIGHT', 'RIGHT']); await touchActivate(reducedPage, 'programming-run-button', 'Mission8Scene', 20);
  await reducedPage.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('programming-route-label')?.text === 'МАРШРУТ 2 ИЗ 3', null, { timeout: 2500 });
  const reduced = await snapshot(reducedPage); await reducedContext.close();
  return {
    checks: {
      mute: muted.soundText === '× Звук',
      homeInterrupt: JSON.stringify(recovered.commands) === JSON.stringify(['RIGHT', 'RIGHT']) && !recovered.robot.moving,
      interruptedQueueEditable: JSON.stringify(editable.commands) === JSON.stringify(['RIGHT']),
      reducedMotion: reduced.routeLabel === 'МАРШРУТ 2 ИЗ 3',
      errors: Object.values(errors).every((items) => items.length === 0) && Object.values(reducedErrors).every((items) => items.length === 0),
    }, errors, reducedErrors, muted, recovered, editable, reduced,
  };
}

async function touchFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); const errors = captureErrors(page); await startDirect(page);
  const routes = [['RIGHT', 'RIGHT'], ['RIGHT', 'RIGHT', 'UP'], ['RIGHT', 'UP', 'UP', 'RIGHT', 'RIGHT']];
  for (let index = 0; index < routes.length; index += 1) {
    await touchBuild(page, routes[index]); await touchActivate(page, 'programming-run-button', 'Mission8Scene', 20);
    if (index < 2) await page.waitForFunction((route) => window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('programming-route-label')?.text === `МАРШРУТ ${route} ИЗ 3`, index + 2, { timeout: 7000 });
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission8Complete') === true, null, { timeout: 10000 }); await sleep(300);
  await page.screenshot({ path: path.join(screenshotDir, 'stage8-3-mobile-390x844-completion.png') }); await sleep(1650);
  const complete = await snapshot(page);
  const checks = { touchRoutes: complete.mission8Complete && complete.autonomous.played, errors: Object.values(errors).every((items) => items.length === 0) };
  await context.close(); return { checks, errors, complete };
}

async function waitForTask(page, task) {
  await page.waitForFunction((taskNumber) => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene');
    const card = scene?.children.getByName('task-card') || scene?.children.getByName('memory-task-card');
    return card?.list.some((item) => item.text === `ЗАДАНИЕ ${taskNumber} ИЗ 10`);
  }, task);
}

async function selectAndCheck(page, key, settleMs = 260) {
  await activate(page, `choice-${key}`, 'GameScene', 50); await activate(page, 'check-button', 'GameScene', settleMs);
}

async function completeMissions1To5(page) {
  await activate(page, 'start-play-button', 'StartScene', 150);
  await waitForTask(page, 1); await selectAndCheck(page, 'odd-ball'); await sleep(2000); await activate(page, 'continue-button', 'GameScene', 180);
  for (const [index, key] of ['sequence-star', 'sequence-planet', 'sequence-planet'].entries()) { await waitForTask(page, 2); await selectAndCheck(page, key); if (index === 2) await sleep(2000); await activate(page, 'continue-button', 'GameScene', 180); }
  for (const [index, key] of ['size-large', 'size-small', 'size-medium'].entries()) { await waitForTask(page, 3); await selectAndCheck(page, key); if (index === 2) await sleep(2000); await activate(page, 'continue-button', 'GameScene', 180); }
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

async function drag(page, from, to) {
  const a = await pointFor(page, from, 'Mission7Scene'); const b = await pointFor(page, to, 'Mission7Scene');
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up(); await sleep(80);
}

async function fullFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(); const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await installAudioProbe(page); await completeMissions1To5(page);
  await activate(page, 'transition-continue', 'TransitionScene', 180);
  for (const level of ['full', 'low']) { await activate(page, `energy-battery-${level}`, 'Mission6Scene', 40); await activate(page, 'energy-check-button', 'Mission6Scene', 760); }
  for (const level of ['low', 'medium', 'full']) await activate(page, `energy-battery-${level}`, 'Mission6Scene', 40);
  await activate(page, 'energy-check-button', 'Mission6Scene', 950); await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission6Complete') === true);
  await activate(page, 'mission6-continue', 'Mission6Scene', 180);
  for (let challenge = 0; challenge < 3; challenge += 1) {
    const colors = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('connection-task-card').getData('destinationOrder'));
    for (const color of colors) await drag(page, `connection-source-${color}`, `connection-target-${color}`);
    if (challenge < 2) await page.waitForFunction((index) => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('connection-task-card')?.getData('challengeIndex') === index, challenge + 1, { timeout: 5000 });
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission7Complete') === true, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('mission7-completion'));
  const transitionCopy = await page.evaluate(() => {
    const overlay = window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene').children.getByName('mission7-completion');
    return overlay.list.filter((item) => item.text).map((item) => item.text);
  });
  await activate(page, 'mission7-continue', 'Mission7Scene', 180);
  for (const route of [['RIGHT', 'RIGHT'], ['RIGHT', 'RIGHT', 'UP'], ['RIGHT', 'UP', 'UP', 'RIGHT', 'RIGHT']]) {
    await build(page, route); await activate(page, 'programming-run-button', 'Mission8Scene', 20);
    if (route.length < 5) await page.waitForFunction((expected) => window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('programming-route-label')?.text === expected, `МАРШРУТ ${route.length === 2 ? 2 : 3} ИЗ 3`, { timeout: 7000 });
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission8Complete') === true, null, { timeout: 10000 }); await sleep(1900);
  const complete = await snapshot(page);
  const checks = {
    mission7Transition: transitionCopy.includes('СИСТЕМЫ СОЕДИНЕНЫ!') && transitionCopy.includes('ДАЛЬШЕ НАУЧИМ РОБОТА ДВИГАТЬСЯ'),
    missions1To7: complete.session.completedTasks === 8 && complete.session.powerActivated && complete.session.connectionsCompleted,
    mission8: complete.session.programmingCompleted && complete.mission8Complete && complete.autonomous.played,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close(); return { checks, errors, transitionCopy, complete };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--autoplay-policy=user-gesture-required'] });
  const matrix = []; for (const viewport of viewports) matrix.push(await responsiveRun(browser, viewport));
  const interactions = await interactionRun(browser); const safety = await safetyRun(browser); const touch = await touchFlow(browser); const flow = await fullFlow(browser); await browser.close();
  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, ok]) => !ok).map(([key]) => `${entry.name}:${key}`)),
    ...Object.entries(interactions.checks).filter(([, ok]) => !ok).map(([key]) => `interactions:${key}`),
    ...Object.entries(safety.checks).filter(([, ok]) => !ok).map(([key]) => `safety:${key}`),
    ...Object.entries(touch.checks).filter(([, ok]) => !ok).map(([key]) => `touch:${key}`),
    ...Object.entries(flow.checks).filter(([, ok]) => !ok).map(([key]) => `full-flow:${key}`),
  ];
  const report = { matrix, interactions, safety, touch, flow, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-3-mission8-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ matrix: matrix.map(({ name, checks }) => ({ name, checks })), interactions: interactions.checks, safety: safety.checks, touch: touch.checks, flow: flow.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
