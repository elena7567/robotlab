const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4190/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['mobile', 390, 844, true],
  ['tablet', 768, 1024, true],
  ['desktop', 1280, 720, false],
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

async function activate(page, name, touch, sceneKey = 'GameScene', settleMs = 85) {
  const point = await pointFor(page, name, sceneKey);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  if (settleMs) await sleep(settleMs);
}

async function answer(page, key, touch, settleMs = 230) {
  await activate(page, `choice-${key}`, touch);
  await activate(page, 'check-button', touch, 'GameScene', 0);
  if (settleMs) await sleep(settleMs);
}

async function waitForContinue(page) {
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene');
    const card = scene?.children.getByName('task-card');
    return card?.continueButton?.visible && card.continueButton.active;
  });
}

async function inspectBatteryScreen(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const cards = scene.children.list.filter((item) => item.name === 'task-card');
    const card = cards[0];
    const texts = card.list.filter((item) => typeof item.text === 'string').map((item) => item.text);
    const viewport = { width: game.canvas.width, height: game.canvas.height };
    const batteries = [...card.choices.entries()].map(([key, choice]) => {
      const image = choice.container.getByName(`choice-image-${key}`);
      const bounds = image.getBounds();
      return {
        key,
        texture: image.texture.key,
        visible: image.visible && choice.container.visible && card.visible,
        alpha: image.getWorldTransformMatrix ? image.alpha * choice.container.alpha * card.alpha : image.alpha,
        scaleX: image.scaleX,
        scaleY: image.scaleY,
        depth: image.depth,
        bounds: { x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom },
        insideViewport: bounds.x >= 0 && bounds.y >= 0 && bounds.right <= viewport.width && bounds.bottom <= viewport.height,
      };
    });
    return {
      taskLabel: texts.find((text) => /^ЗАДАНИЕ/.test(text)),
      title: texts.find((text) => text === 'СРАВНИ ПО РАЗМЕРУ'),
      cardCount: cards.length,
      staleSequenceTitle: texts.includes('ПРОДОЛЖИ РЯД'),
      batteries,
      session: game.registry.get('sessionSnapshot'),
      rewardCount: scene.children.list.filter((item) => item.name === 'repair-item-reward').length,
      viewport,
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
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));

  await answer(page, 'odd-ball', touch);
  await activate(page, 'continue-button', touch);
  await answer(page, 'sequence-star', touch);
  await activate(page, 'continue-button', touch);
  await answer(page, 'sequence-planet', touch);
  await activate(page, 'continue-button', touch);
  await answer(page, 'sequence-planet', touch, 0);
  await waitForContinue(page);

  const prefix = name === 'mobile' ? 'stage5-2a' : `stage5-2a-${name}`;
  await page.screenshot({ path: path.join(screenshotDir, `${prefix}-after-sequence-complete.png`) });
  await activate(page, 'continue-button', touch, 'GameScene', 0);
  await page.screenshot({ path: path.join(screenshotDir, `${prefix}-after-next-click.png`) });
  await page.waitForFunction(() => {
    const card = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene')?.children.getByName('task-card');
    return card?.list.some((item) => item.text === 'СРАВНИ ПО РАЗМЕРУ');
  });
  await sleep(80);
  await page.screenshot({ path: path.join(screenshotDir, `${prefix}-battery-task-visible.png`) });

  const screen = await inspectBatteryScreen(page);
  const checks = {
    taskTitle: screen.taskLabel === 'ЗАДАНИЕ 3 ИЗ 5' && screen.title === 'СРАВНИ ПО РАЗМЕРУ',
    batteries: screen.batteries.length === 3 && screen.batteries.every((battery) =>
      battery.texture === 'size-battery' && battery.visible && battery.alpha > 0
      && battery.scaleX > 0 && battery.scaleY > 0 && battery.insideViewport),
    noStaleUi: screen.cardCount === 1 && !screen.staleSequenceTitle,
    progression: screen.session.currentTask === 3 && screen.session.completedTasks === 2,
    rewardCleared: screen.rewardCount === 0,
    console: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { name, width, height, checks, screen, errors };
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
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-2a-manual-visibility-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ checks: flows.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
