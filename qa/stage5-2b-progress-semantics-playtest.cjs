const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4192/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['desktop-1280x720', 1280, 720, false],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
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

async function answer(page, key, touch, settleMs = 230) {
  await activate(page, `choice-${key}`, touch);
  await activate(page, 'check-button', touch);
  await sleep(settleMs);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const panel = scene.children.getByName('progress-panel');
    const cardTexts = card.list.filter((item) => typeof item.text === 'string').map((item) => item.text);
    const panelTexts = panel.progressLayer.list.filter((item) => typeof item.text === 'string').map((item) => item.text);
    return {
      session: game.registry.get('sessionSnapshot'),
      taskLabel: cardTexts.find((text) => /^ЗАДАНИЕ/.test(text)),
      title: cardTexts.find((text) => ['НАЙДИ ЛИШНИЙ ПРЕДМЕТ', 'ПРОДОЛЖИ РЯД', 'СРАВНИ ПО РАЗМЕРУ'].includes(text)),
      internalCounter: card.feedbackText.text.match(/(?:РЯД|СРАВНЕНИЕ) \d ИЗ 3/)?.[0] ?? null,
      repairTitle: panelTexts.find((text) => text === 'РЕМОНТ'),
      numericProgress: panelTexts.find((text) => /^\d\s*\/\s*5$/.test(text)) ?? null,
      completedIndicators: panel.progressLayer.list.filter((item) => item.name === 'repair-indicator-complete').length,
      pendingIndicators: panel.progressLayer.list.filter((item) => item.name === 'repair-indicator-pending').length,
      continueVisible: card.continueButton.visible && card.continueButton.active,
      result: card.result,
      batteryCount: [...card.choices.values()].filter((choice) =>
        choice.container.list.some((item) => item.texture?.key === 'size-battery' && item.visible && item.alpha > 0)).length,
      canvas: { width: game.canvas.width, height: game.canvas.height },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    };
  });
}

async function runFlow(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await activate(page, 'Играть', touch, 'StartScene');
  const initial = await snapshot(page);

  await answer(page, 'odd-ball', touch);
  const afterTask1 = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage5-2b-${name}-after-task1.png`) });
  await activate(page, 'continue-button', touch);

  await answer(page, 'sequence-star', touch);
  await activate(page, 'continue-button', touch);
  await answer(page, 'sequence-planet', touch);
  await activate(page, 'continue-button', touch);

  await answer(page, 'sequence-gear', touch, 80);
  const sequence3Wrong = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage5-2b-${name}-sequence3-wrong.png`) });
  await sleep(300);
  await answer(page, 'sequence-planet', touch);
  const afterTask2 = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage5-2b-${name}-after-task2.png`) });

  await activate(page, 'continue-button', touch);
  const batteryTask = await snapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, `stage5-2b-${name}-battery-task.png`) });

  const checks = {
    initialSemantics: initial.taskLabel === 'ЗАДАНИЕ 1 ИЗ 5' && initial.repairTitle === 'РЕМОНТ'
      && initial.numericProgress === null && initial.completedIndicators === 0 && initial.pendingIndicators === 5,
    afterTask1: afterTask1.completedIndicators === 1 && afterTask1.pendingIndicators === 4
      && afterTask1.session.completedTasks === 1,
    sequenceWrong: sequence3Wrong.taskLabel === 'ЗАДАНИЕ 2 ИЗ 5'
      && sequence3Wrong.internalCounter === 'РЯД 3 ИЗ 3' && sequence3Wrong.result === 'wrong'
      && sequence3Wrong.completedIndicators === 1 && sequence3Wrong.pendingIndicators === 4
      && sequence3Wrong.session.completedTasks === 1,
    afterTask2: afterTask2.internalCounter === 'РЯД 3 ИЗ 3' && afterTask2.result === 'correct'
      && afterTask2.completedIndicators === 2 && afterTask2.pendingIndicators === 3
      && afterTask2.session.completedTasks === 2 && afterTask2.continueVisible,
    batteryTask: batteryTask.taskLabel === 'ЗАДАНИЕ 3 ИЗ 5' && batteryTask.title === 'СРАВНИ ПО РАЗМЕРУ'
      && batteryTask.internalCounter === 'СРАВНЕНИЕ 1 ИЗ 3' && batteryTask.batteryCount === 3
      && batteryTask.completedIndicators === 2 && batteryTask.pendingIndicators === 3,
    noNumericProgress: [initial, afterTask1, sequence3Wrong, afterTask2, batteryTask]
      .every((state) => state.numericProgress === null && state.repairTitle === 'РЕМОНТ'),
    viewport: batteryTask.canvas.width === width && batteryTask.canvas.height === height
      && batteryTask.document.width === width && batteryTask.document.height === height,
    console: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { name, width, height, checks, errors, states: { initial, afterTask1, sequence3Wrong, afterTask2, batteryTask } };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const flows = [];
  for (const viewport of viewports) flows.push(await runFlow(browser, viewport));
  await browser.close();
  const failures = flows.flatMap((flow) => Object.entries(flow.checks)
    .filter(([, passed]) => !passed).map(([check]) => `${flow.name}:${check}`));
  const report = { flows, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-2b-progress-semantics-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ checks: flows.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
