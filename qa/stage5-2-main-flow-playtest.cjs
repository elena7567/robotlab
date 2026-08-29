const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4190/';
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

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const progress = scene.children.getByName('progress-panel');
    const texts = card.list.filter((item) => typeof item.text === 'string').map((item) => item.text);
    const choices = [...card.choices.entries()].map(([key, choice]) => ({
      key,
      texture: choice.container.getByName(`choice-image-${key}`)?.texture?.key,
    }));
    return {
      session: game.registry.get('sessionSnapshot'),
      taskLabel: texts.find((text) => /^ЗАДАНИЕ/.test(text)),
      title: texts.find((text) => ['НАЙДИ ЛИШНИЙ ПРЕДМЕТ', 'ПРОДОЛЖИ РЯД', 'СРАВНИ ПО РАЗМЕРУ'].includes(text)),
      internalProgress: card.feedbackText.text.match(/(?:РЯД|СРАВНЕНИЕ) \d ИЗ 3/)?.[0] ?? null,
      repairTitle: progress.progressLayer.list.find((item) => item.text === 'РЕМОНТ')?.text,
      numericProgressVisible: progress.progressLayer.list.some((item) => /^\d\s*\/\s*5$/.test(item.text || '')),
      repairCompleted: progress.progressLayer.list.filter((item) => item.name === 'repair-indicator-complete').length,
      repairPending: progress.progressLayer.list.filter((item) => item.name === 'repair-indicator-pending').length,
      result: card.result,
      continueVisible: card.continueButton.visible && card.continueButton.active,
      choices,
      canvas: { width: game.canvas.width, height: game.canvas.height },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    };
  });
}

async function completeAnswer(page, key, touch) {
  await activate(page, `choice-${key}`, touch);
  await activate(page, 'check-button', touch);
  await sleep(230);
  return snapshot(page);
}

async function runFlow(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await activate(page, 'Играть', touch, 'StartScene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  const initial = await snapshot(page);

  const oddComplete = await completeAnswer(page, 'odd-ball', touch);
  await activate(page, 'continue-button', touch);
  await sleep(160);

  const sequence1 = await completeAnswer(page, 'sequence-star', touch);
  await activate(page, 'continue-button', touch);
  await sleep(160);
  const sequence2 = await completeAnswer(page, 'sequence-planet', touch);
  await activate(page, 'continue-button', touch);
  await sleep(160);
  const sequence3 = await completeAnswer(page, 'sequence-planet', touch);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage5-2-${name}-sequence-complete.png`) });

  await activate(page, 'continue-button', touch);
  await sleep(180);
  const sizeLoaded = await snapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage5-2-${name}-size-loaded.png`) });

  const size1 = await completeAnswer(page, 'size-large', touch);
  await activate(page, 'continue-button', touch);
  await sleep(160);
  const size2 = await completeAnswer(page, 'size-small', touch);
  await activate(page, 'continue-button', touch);
  await sleep(160);
  const size3 = await completeAnswer(page, 'size-medium', touch);

  await activate(page, '⌂ Домой', touch);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await activate(page, 'Играть', touch, 'StartScene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  const restarted = await snapshot(page);

  const checks = {
    initial: initial.taskLabel === 'ЗАДАНИЕ 1 ИЗ 5' && initial.repairTitle === 'РЕМОНТ'
      && !initial.numericProgressVisible && initial.repairCompleted === 0 && initial.repairPending === 5
      && initial.session.currentTask === 1 && initial.session.completedTasks === 0,
    oddComplete: oddComplete.repairCompleted === 1 && oddComplete.repairPending === 4 && oddComplete.continueVisible
      && oddComplete.session.currentTask === 2 && oddComplete.session.completedTasks === 1,
    sequenceInternal: sequence1.internalProgress === 'РЯД 1 ИЗ 3' && sequence1.repairCompleted === 1
      && sequence2.internalProgress === 'РЯД 2 ИЗ 3' && sequence2.repairCompleted === 1
      && sequence3.internalProgress === 'РЯД 3 ИЗ 3',
    sequenceFinal: sequence3.result === 'correct' && sequence3.repairCompleted === 2
      && sequence3.continueVisible && sequence3.session.completedTasks === 2
      && sequence3.session.currentTask === 3 && sequence3.session.score === 2,
    sizeLoaded: sizeLoaded.taskLabel === 'ЗАДАНИЕ 3 ИЗ 5' && sizeLoaded.title === 'СРАВНИ ПО РАЗМЕРУ'
      && sizeLoaded.repairCompleted === 2 && sizeLoaded.session.currentTask === 3
      && sizeLoaded.choices.length === 3 && sizeLoaded.choices.every((choice) => choice.texture === 'size-battery'),
    sizeInternal: size1.internalProgress === 'СРАВНЕНИЕ 1 ИЗ 3' && size1.repairCompleted === 2
      && size2.internalProgress === 'СРАВНЕНИЕ 2 ИЗ 3' && size2.repairCompleted === 2,
    sizeComplete: size3.internalProgress === 'СРАВНЕНИЕ 3 ИЗ 3' && size3.result === 'correct'
      && size3.repairCompleted === 3 && size3.session.completedTasks === 3
      && size3.session.currentTask === 4 && size3.session.score === 3,
    restart: restarted.taskLabel === 'ЗАДАНИЕ 1 ИЗ 5' && restarted.repairCompleted === 0 && restarted.repairPending === 5
      && restarted.session.currentTask === 1 && restarted.session.completedTasks === 0 && restarted.session.score === 0,
    viewport: restarted.canvas.width === width && restarted.canvas.height === height
      && restarted.document.width === width && restarted.document.height === height,
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { name, width, height, checks, errors, states: { initial, oddComplete, sequence1, sequence2, sequence3,
    sizeLoaded, size1, size2, size3, restarted } };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const flows = [];
  for (const viewport of viewports) flows.push(await runFlow(browser, viewport));
  await browser.close();
  const failures = flows.flatMap((entry) => Object.entries(entry.checks)
    .filter(([, ok]) => !ok).map(([key]) => `${entry.name}:${key}`));
  const report = { flows, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-2-main-flow-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ viewports: flows.length, checks: flows.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
