const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4208/';
const viewports = [
  ['minimum-320x568', 320, 568, true],
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['desktop-1280x720', 1280, 720, false],
  ['desktop-1438x914', 1438, 914, false],
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  return errors;
}

async function inspectViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const playPoint = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('StartScene');
    const control = scene.children.list.find((item) => item.list?.some((child) => child.text === 'Играть'));
    return control.getWorldTransformMatrix().transformPoint(0, 0);
  });
  if (touch) await page.touchscreen.tap(playPoint.x, playPoint.y);
  else await page.mouse.click(playPoint.x, playPoint.y);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));

  const state = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const layout = game.registry.get('responsiveLayout');
    const card = scene.children.getByName('task-card');
    const home = scene.children.list.find((item) => item.list?.some((child) => child.text === '⌂ Домой'));
    const bounds = (item) => {
      const value = item.getBounds();
      return { x: value.x, y: value.y, width: value.width, height: value.height,
        right: value.right, bottom: value.bottom };
    };
    const interactiveBounds = (item) => ({
      ...bounds(item),
      hitWidth: item.input?.hitArea?.width ?? item.width,
      hitHeight: item.input?.hitArea?.height ?? item.height,
    });
    const choices = card.list.filter((item) => item.name?.startsWith('choice-')).map(interactiveBounds);
    const actions = card.list.filter((item) => ['check-button', 'continue-button'].includes(item.name)
      || item.list?.some((child) => child.text === 'Подсказка'))
      .filter((item) => item.visible && item.active).map(interactiveBounds);
    const visibleActions = actions.filter((item) => item.width > 0 && item.height > 0);
    const ribbonTop = layout.taskCard.y - layout.taskCardSizing.ribbonHeight / 2;
    const choiceBottom = Math.max(...choices.map((item) => item.bottom));
    const actionTop = Math.min(...visibleActions.map((item) => item.y));
    return {
      mode: layout.mode,
      layout: { card: layout.taskCard, ribbonTop, ribbonHeight: layout.taskCardSizing.ribbonHeight },
      cardBounds: bounds(card),
      homeBounds: bounds(home),
      choices,
      actions: visibleActions,
      homeGap: ribbonTop - bounds(home).bottom,
      answerActionGap: actionTop - choiceBottom,
      canvas: { width: game.canvas.width, height: game.canvas.height },
    };
  });

  if (name === 'mobile-390x844' || name === 'desktop-1280x720') {
    const fileName = `stage8-0a-task-panel-${name}.png`;
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', fileName) });
    state.screenshot = fileName;
  }

  const inside = (item) => item.x >= -1 && item.y >= -1 && item.right <= width + 1 && item.bottom <= height + 1;
  const checks = {
    viewport: state.canvas.width === width && state.canvas.height === height,
    homeSpacing: state.homeGap >= 12,
    cardInsideViewport: inside(state.cardBounds),
    choicesInsideViewport: state.choices.every(inside),
    touchTargets: [...state.choices, ...state.actions].every((item) => item.hitWidth >= 44 && item.hitHeight >= 44),
    hierarchySeparated: state.answerActionGap >= 0,
    compactLandscape: state.mode !== 'landscape' || state.layout.card.height <= 480,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { name, width, height, touch, state, checks, errors };
}

async function pointFor(page, name, sceneKey = 'GameScene') {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const find = (item) => {
      if (item?.name === name) return item;
      for (const child of item?.list || []) {
        const match = find(child);
        if (match) return match;
      }
      return null;
    };
    const target = scene.children.list.map(find).find(Boolean)
      || scene.children.list.find((item) => item.list?.some((child) => child.text === name));
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, touch, sceneKey = 'GameScene', settleMs = 220) {
  const point = await pointFor(page, name, sceneKey);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(settleMs);
}

async function waitForTask(page, taskNumber) {
  await page.waitForFunction((number) => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene');
    const card = scene?.children.getByName('task-card') || scene?.children.getByName('memory-task-card');
    return card?.list.some((item) => item.text === `ЗАДАНИЕ ${number} ИЗ 5`);
  }, taskNumber);
}

async function captureMechanicLayout(page, taskNumber, width, height) {
  return page.evaluate(({ taskNumber, width, height }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card') || scene.children.getByName('memory-task-card');
    const bounds = (item) => {
      const value = item.getBounds();
      return { x: value.x, y: value.y, right: value.right, bottom: value.bottom };
    };
    const inside = (item) => item.x >= -1 && item.y >= -1 && item.right <= width + 1 && item.bottom <= height + 1;
    const visibleChildren = card.list.filter((item) => item.visible && typeof item.getBounds === 'function');
    const interactive = visibleChildren.filter((item) => item.active && item.input?.enabled);
    return {
      taskNumber,
      cardInside: inside(bounds(card)),
      childrenInside: visibleChildren.every((item) => inside(bounds(item))),
      touchTargets: interactive.every((item) => (item.input?.hitArea?.width ?? item.width) >= 44
        && (item.input?.hitArea?.height ?? item.height) >= 44),
    };
  }, { taskNumber, width, height });
}

async function runMechanicRegression(browser, name, width, height, touch) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await activate(page, 'Играть', touch, 'StartScene', 160);
  const tasks = [];
  await waitForTask(page, 1);
  tasks.push(await captureMechanicLayout(page, 1, width, height));
  await activate(page, 'choice-odd-ball', touch, 'GameScene', 80);
  await activate(page, 'check-button', touch, 'GameScene', 1800);
  await activate(page, 'continue-button', touch, 'GameScene', 180);

  await waitForTask(page, 2);
  tasks.push(await captureMechanicLayout(page, 2, width, height));
  for (const [index, key] of ['sequence-star', 'sequence-planet', 'sequence-planet'].entries()) {
    await activate(page, `choice-${key}`, touch, 'GameScene', 70);
    await activate(page, 'check-button', touch, 'GameScene', index === 2 ? 1800 : 280);
    await activate(page, 'continue-button', touch, 'GameScene', 180);
  }

  await waitForTask(page, 3);
  tasks.push(await captureMechanicLayout(page, 3, width, height));
  for (const [index, key] of ['size-large', 'size-small', 'size-medium'].entries()) {
    await activate(page, `choice-${key}`, touch, 'GameScene', 70);
    await activate(page, 'check-button', touch, 'GameScene', index === 2 ? 1800 : 280);
    await activate(page, 'continue-button', touch, 'GameScene', 180);
  }

  await waitForTask(page, 4);
  tasks.push(await captureMechanicLayout(page, 4, width, height));
  for (let challenge = 0; challenge < 3; challenge += 1) {
    const correct = await page.evaluate(() => [...window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
      .children.getByName('task-card').configuredHintKeys][0]);
    await activate(page, `choice-${correct}`, touch, 'GameScene', 70);
    await activate(page, 'check-button', touch, 'GameScene', 320);
    if (challenge < 2) await activate(page, 'continue-button', touch, 'GameScene', 180);
  }

  await waitForTask(page, 5);
  tasks.push(await captureMechanicLayout(page, 5, width, height));
  const checks = {
    allMechanicsReached: tasks.map((task) => task.taskNumber).join(',') === '1,2,3,4,5',
    allCardsInside: tasks.every((task) => task.cardInside && task.childrenInside),
    allTouchTargets: tasks.every((task) => task.touchTargets),
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { name, tasks, checks, errors };
}

(async () => {
  fs.mkdirSync(path.join('docs', 'qa', 'screenshots'), { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const results = [];
  for (const viewport of viewports) results.push(await inspectViewport(browser, viewport));
  const mechanicRegression = [
    await runMechanicRegression(browser, 'mobile-390x844', 390, 844, true),
    await runMechanicRegression(browser, 'desktop-1280x720', 1280, 720, false),
  ];
  await browser.close();
  const failures = [
    ...results.flatMap((result) => Object.entries(result.checks)
      .filter(([, passed]) => !passed).map(([check]) => `${result.name}:${check}`)),
    ...mechanicRegression.flatMap((result) => Object.entries(result.checks)
      .filter(([, passed]) => !passed).map(([check]) => `${result.name}:mechanics:${check}`)),
  ];
  const report = { results, mechanicRegression, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-0a-task-panel-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ results: results.map(({ name, state, checks }) => ({
    name,
    metrics: { homeGap: state.homeGap, cardHeight: state.layout.card.height,
      answerActionGap: state.answerActionGap },
    checks,
  })), mechanicRegression: mechanicRegression.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
