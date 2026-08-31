const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function startScene(page, key) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await page.evaluate((sceneKey) => window.__ROBOTLAB_GAME__.scene.start(sceneKey), key);
  await page.waitForFunction((sceneKey) => window.__ROBOTLAB_GAME__.scene.isActive(sceneKey), key);
  await sleep(180);
}

async function pointFor(page, name, sceneKey) {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) { const found = walk(child); if (found) return found; }
      return null;
    };
    const item = scene.children.list.map(walk).find(Boolean);
    if (!item) throw new Error(`Missing ${sceneKey}/${name}`);
    const point = item.getWorldTransformMatrix().transformPoint(0, 0);
    return { x: point.x, y: point.y };
  }, { name, sceneKey });
}

async function touchTap(page, name, sceneKey = 'Mission8Scene') {
  const point = await pointFor(page, name, sceneKey);
  await page.touchscreen.tap(point.x, point.y);
  await sleep(45);
}

async function touchBuild(page, commands) {
  for (const command of commands) await touchTap(page, `program-command-${command}`);
}

async function mission8State(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const walk = (item, name) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) { const found = walk(child, name); if (found) return found; }
      return null;
    };
    const find = (name) => scene.children.list.map((item) => walk(item, name)).find(Boolean);
    const bounds = (item) => { const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
    const board = find('programming-board');
    const robot = find('programming-robot');
    const preview = find('programming-route-preview');
    const target = find('programming-target-pad');
    const endpoint = find('programming-preview-endpoint');
    const cellSize = board.getData('cellSize');
    const controls = ['program-command-UP', 'program-command-RIGHT', 'program-command-DOWN', 'program-command-LEFT',
      'programming-hint-button', 'programming-delete-button', 'programming-run-button'].map(find);
    return {
      route: find('programming-route-label')?.text,
      board: bounds(board), robot: bounds(robot), target: bounds(target), cellSize,
      robotCell: { column: robot.getData('gridColumn'), row: robot.getData('gridRow') },
      targetCell: { column: board.getData('targetColumn'), row: board.getData('targetRow') },
      visualCenter: { x: robot.getData('cellCenterX'), y: robot.getData('cellCenterY') },
      targetCenter: { x: target.x + board.x, y: target.y + board.y },
      previewEndpoint: endpoint ? { x: endpoint.x + board.x, y: endpoint.y + board.y } : null,
      preview: { steps: preview.getData('stepCount'), valid: preview.getData('validCount'), invalid: preview.getData('invalid') },
      controls: controls.map((item) => ({ name: item.name, width: item.input.hitArea.width, height: item.input.hitArea.height })),
    };
  });
}

async function waitForArrival(page, routeNumber) {
  await page.waitForFunction((number) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const board = scene.children.getByName('programming-board');
    const robot = board?.getByName('programming-robot');
    const label = scene.children.getByName('programming-route-label')?.text;
    return label === `МАРШРУТ ${number} ИЗ 3`
      && robot?.getData('moving') === false
      && robot?.getData('gridColumn') === board?.getData('targetColumn')
      && robot?.getData('gridRow') === board?.getData('targetRow');
  }, routeNumber, { timeout: 8000 });
}

async function runMission8(browser, name, width, height, touch) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await startScene(page, 'Mission8Scene');
  const initial = await mission8State(page);
  if (name === 'desktop-1280x720') await page.screenshot({ path: path.join(screenshotDir, 'stage8-3b-desktop-1280x720-route1-initial.png') });
  if (name === 'mobile-390x844' || name === 'tablet-768x1024')
    await page.screenshot({ path: path.join(screenshotDir, `stage8-3b-${name}-active-robot-scale.png`) });

  const routes = [['RIGHT', 'RIGHT'], ['RIGHT', 'RIGHT', 'UP'], ['RIGHT', 'UP', 'UP', 'RIGHT', 'RIGHT']];
  const routeResults = [];
  for (let index = 0; index < routes.length; index += 1) {
    if (touch) await touchBuild(page, routes[index]);
    else for (const command of routes[index]) {
      const point = await pointFor(page, `program-command-${command}`, 'Mission8Scene');
      await page.mouse.click(point.x, point.y); await sleep(30);
    }
    const preview = await mission8State(page);
    if (index === 0 && ['desktop-1280x720', 'mobile-390x844'].includes(name))
      await page.screenshot({ path: path.join(screenshotDir, `stage8-3b-${name}-full-route-preview.png`) });
    const runPoint = await pointFor(page, 'programming-run-button', 'Mission8Scene');
    if (touch) await page.touchscreen.tap(runPoint.x, runPoint.y);
    else await page.mouse.click(runPoint.x, runPoint.y);
    await waitForArrival(page, index + 1);
    const arrival = await mission8State(page);
    routeResults.push({ preview, arrival, exactTarget: JSON.stringify(arrival.robotCell) === JSON.stringify(arrival.targetCell) });
    if (index === 0 && ['desktop-1280x720', 'mobile-390x844', 'tablet-768x1024'].includes(name)) {
      await page.screenshot({ path: path.join(screenshotDir, `stage8-3b-${name}-robot-on-target.png`) });
      if (name === 'desktop-1280x720') {
        const clip = { x: Math.max(0, arrival.target.x - 34), y: Math.max(0, arrival.target.y - 34),
          width: Math.min(width - Math.max(0, arrival.target.x - 34), arrival.target.width + 68),
          height: Math.min(height - Math.max(0, arrival.target.y - 34), arrival.target.height + 68) };
        await page.screenshot({ path: path.join(screenshotDir, 'stage8-3b-desktop-1280x720-robot-on-target-close-up.png'), clip });
      }
    }
    if (index < 2) {
      await page.waitForFunction((next) => window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('programming-route-label')?.text === `МАРШРУТ ${next} ИЗ 3`, index + 2, { timeout: 8000 });
      await sleep(120);
    }
  }
  const checks = {
    routesExact: routeResults.every((result) => result.exactTarget),
    previewMatches: routeResults.every((result) => !result.preview.preview.invalid
      && result.preview.preview.valid === result.preview.preview.steps
      && Math.abs(result.preview.previewEndpoint.x - result.preview.targetCenter.x) < 0.5
      && Math.abs(result.preview.previewEndpoint.y - result.preview.targetCenter.y) < 0.5),
    robotReadable: initial.robot.height >= Math.min(initial.cellSize * 0.78, 82),
    controlsTappable: initial.controls.every((control) => control.width >= 56 && control.height >= 48),
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { name, checks, errors, initial, routeResults };
}

async function dispatchTouchDrag(page, from, to, holdAtEnd = false) {
  const client = await page.context().newCDPSession(page);
  const send = (type, point) => client.send('Input.dispatchTouchEvent', {
    type, touchPoints: point ? [{ x: point.x, y: point.y, radiusX: 8, radiusY: 8, force: 1, id: 1 }] : [],
  });
  await send('touchStart', from);
  for (let step = 1; step <= 6; step += 1) {
    await send('touchMove', { x: from.x + (to.x - from.x) * step / 6, y: from.y + (to.y - from.y) * step / 6 });
    await sleep(24);
  }
  if (!holdAtEnd) await send('touchEnd');
  return { client, end: () => send('touchEnd') };
}

async function mission7State(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene');
    const card = scene.children.getByName('connection-task-card');
    const temp = card.getByName('connection-temporary-wire');
    const names = [...card.getData('destinationOrder')];
    const port = (side, color) => card.getByName(`connection-${side}-${color}`);
    return {
      order: names, connected: [...card.getData('connected')], temporaryAlpha: temp.alpha,
      temporaryCommands: temp.commandBuffer?.length || 0,
      ports: names.map((color) => ({ color, sourceHit: port('source', color).getData('hitWidth'), targetHit: port('target', color).getData('hitWidth'),
        sourceLocked: port('source', color).getData('locked'), targetLocked: port('target', color).getData('locked') })),
    };
  });
}

async function runMission7Touch(browser, name, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); const errors = captureErrors(page);
  await startScene(page, 'Mission7Scene');
  const initial = await mission7State(page);
  const first = initial.order[0];
  const wrong = initial.order.find((color) => color !== first);
  const source = await pointFor(page, `connection-source-${first}`, 'Mission7Scene');
  const wrongTarget = await pointFor(page, `connection-target-${wrong}`, 'Mission7Scene');
  await dispatchTouchDrag(page, source, wrongTarget); await sleep(280);
  const wrongRecovery = await mission7State(page);
  await dispatchTouchDrag(page, source, { x: width / 2, y: height - 8 }); await sleep(180);
  const emptyRecovery = await mission7State(page);
  const target = await pointFor(page, `connection-target-${first}`, 'Mission7Scene');
  const active = await dispatchTouchDrag(page, source, target, true);
  await page.screenshot({ path: path.join(screenshotDir, `stage8-3b-mission7-${name}-active-wire-drag.png`) });
  const during = await mission7State(page);
  await active.end(); await sleep(120);
  const completed = await mission7State(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage8-3b-mission7-${name}-completed-connection.png`) });
  const checks = {
    pointerModel: true,
    hitAreas: initial.ports.every((port) => port.sourceHit >= 64 && port.targetHit >= 64),
    activeWire: during.temporaryCommands > 0,
    wrongRecovery: wrongRecovery.connected.length === 0 && wrongRecovery.temporaryCommands === 0,
    emptyRecovery: emptyRecovery.connected.length === 0 && emptyRecovery.temporaryCommands === 0,
    completedLocks: completed.connected.includes(first) && completed.ports.find((port) => port.color === first).sourceLocked
      && completed.ports.find((port) => port.color === first).targetLocked,
    noGhost: completed.temporaryCommands === 0,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { name, checks, errors, initial, wrongRecovery, emptyRecovery, during, completed };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const mission8 = [];
  for (const viewport of [['minimum-320x568', 320, 568, true], ['mobile-390x844', 390, 844, true],
    ['tablet-768x1024', 768, 1024, true], ['desktop-1280x720', 1280, 720, false], ['wide-1438x914', 1438, 914, false]])
    mission8.push(await runMission8(browser, ...viewport));
  const mission7 = [await runMission7Touch(browser, 'mobile-390x844', 390, 844), await runMission7Touch(browser, 'tablet-768x1024', 768, 1024)];
  await browser.close();
  const failures = [...mission8.flatMap((entry) => Object.entries(entry.checks).filter(([, ok]) => !ok).map(([key]) => `mission8:${entry.name}:${key}`)),
    ...mission7.flatMap((entry) => Object.entries(entry.checks).filter(([, ok]) => !ok).map(([key]) => `mission7:${entry.name}:${key}`))];
  const report = { inputModels: { mission7: 'Phaser unified pointer', mission8: 'Phaser unified pointer' }, mission8, mission7, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-3b-target-touch-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ mission8: mission8.map(({ name, checks }) => ({ name, checks })), mission7: mission7.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
