const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4188/';
const viewports = [
  ['mobile-320x568', 320, 568, true], ['mobile-333x885', 333, 885, true],
  ['mobile-360x800', 360, 800, true], ['mobile-390x844', 390, 844, true],
  ['mobile-412x915', 412, 915, true], ['tablet-768x1024', 768, 1024, true],
  ['tablet-820x1180', 820, 1180, true], ['tablet-1024x1366', 1024, 1366, true],
  ['landscape-568x320', 568, 320, true], ['landscape-844x390', 844, 390, true],
  ['landscape-915x412', 915, 412, true], ['desktop-1280x720', 1280, 720, false],
  ['desktop-1366x768', 1366, 768, false], ['desktop-1920x1080', 1920, 1080, false],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function attachErrorCapture(page) {
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
  await sleep(80);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const progress = scene.children.getByName('progress-panel');
    const dialogue = scene.children.getByName('robot-dialogue');
    const robot = scene.children.getByName('logical-actors')?.getByName('grounded-robot');
    const bounds = (item) => { const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
    const choices = [...card.choices.entries()].map(([key, choice]) => {
      const image = choice.container.getByName(`choice-image-${key}`);
      return {
        key,
        ...bounds(choice.container),
        hitWidth: choice.container.input?.hitArea?.width ?? choice.container.width,
        hitHeight: choice.container.input?.hitArea?.height ?? choice.container.height,
        image: image ? { ...bounds(image), texture: image.texture.key, scale: image.scaleX } : null,
      };
    });
    return {
      taskLabel: card.list.find((item) => /^ЗАДАНИЕ/.test(item.text || ''))?.text,
      title: card.list.find((item) => item.text === 'СРАВНИ ПО РАЗМЕРУ')?.text,
      instruction: card.list.find((item) => /батарейк/.test(item.text || ''))?.text,
      internalProgress: card.feedbackText.text.match(/СРАВНЕНИЕ \d\/3/)?.[0],
      selectedKey: card.selectedKey,
      result: card.result,
      feedback: card.feedbackText.text,
      checkEnabled: card.checkButton.getData('control-runtime').enabled,
      continueVisible: card.continueButton.visible,
      progressText: progress.progressLayer.list.find((item) => /^\d \/ 5$/.test(item.text || ''))?.text,
      dialogueVisible: dialogue?.visible ?? false,
      dialogueText: dialogue?.label?.text ?? '',
      choices,
      choiceOrder: choices.map((choice) => choice.key),
      layout: game.registry.get('responsiveLayout'),
      robot: {
        ...bounds(robot), xValue: robot.x, yValue: robot.y, scale: robot.scaleX, angle: robot.angle,
        originX: robot.originX, originY: robot.originY, baseX: robot.getData('baseX'), baseY: robot.getData('baseY'),
        platformX: robot.getData('platformContactX'), platformY: robot.getData('platformContactY'),
      },
      canvas: { width: game.canvas.width, height: game.canvas.height },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    };
  });
}

async function enterSizeComparison(page, touch) {
  await activate(page, 'Играть', touch, 'StartScene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  await activate(page, 'choice-odd-ball', touch);
  await activate(page, 'check-button', touch);
  await sleep(250);
  await activate(page, 'continue-button', touch);
  for (const correct of ['sequence-star', 'sequence-planet', 'sequence-planet']) {
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.getScene('GameScene')
      ?.children.getByName('task-card')?.feedbackText?.text?.startsWith('РЯД'));
    await activate(page, `choice-${correct}`, touch);
    await activate(page, 'check-button', touch);
    await sleep(250);
    await activate(page, 'continue-button', touch);
    await sleep(120);
  }
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.getScene('GameScene')
    ?.children.getByName('task-card')?.feedbackText?.text?.startsWith('СРАВНЕНИЕ 1/3'));
}

function visualChecks(state) {
  const images = Object.fromEntries(state.choices.map((choice) => [choice.key, choice.image]));
  const bottoms = state.choices.map((choice) => choice.image.bottom);
  const card = state.layout.taskCard;
  return {
    labels: state.taskLabel === 'ЗАДАНИЕ 3/5' && state.title === 'СРАВНИ ПО РАЗМЕРУ' && Boolean(state.instruction),
    progress: state.progressText === '2 / 5' && state.internalProgress === 'СРАВНЕНИЕ 1/3',
    sameSource: state.choices.length === 3 && state.choices.every((choice) => choice.image?.texture === 'size-battery'),
    sizeDifference: images['size-small'].height < images['size-medium'].height
      && images['size-medium'].height < images['size-large'].height
      && Math.abs(images['size-small'].height / images['size-medium'].height - 0.7) < 0.03
      && Math.abs(images['size-large'].height / images['size-medium'].height - 1.3) < 0.03,
    baseline: Math.max(...bottoms) - Math.min(...bottoms) < 1,
    targets: state.choices.every((choice) => choice.hitWidth >= 64 && choice.hitHeight >= 44),
    insideCard: state.choices.every((choice) => choice.image.x >= card.x - 1 && choice.image.right <= card.x + card.width + 1
      && choice.image.y >= card.y - 1 && choice.image.bottom <= card.y + card.height + 1),
    noCardRobotOverlap: state.layout.mode === 'landscape' || card.y + card.height <= state.robot.y + 7,
    grounding: state.robot.xValue === 640 && state.robot.baseX === 640
      && state.robot.yValue === state.robot.baseY && state.robot.originX === 0.5 && state.robot.originY === 1
      && Math.abs(state.robot.scale - 0.2520718) < 1e-9 && state.robot.platformX === 640 && state.robot.platformY === 560,
  };
}

async function runMatrixViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await enterSizeComparison(page, touch);
  const state = await snapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage5-${name}.png`) });
  const checks = {
    ...visualChecks(state),
    viewport: state.canvas.width === width && state.canvas.height === height
      && state.document.width === width && state.document.height === height,
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { name, width, height, state, errors, checks };
}

async function runFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = attachErrorCapture(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await enterSizeComparison(page, false);

  await activate(page, 'choice-size-medium', false);
  const beforeResize = await snapshot(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(350);
  const afterResize = await snapshot(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await sleep(350);

  await activate(page, 'choice-size-small', false);
  await activate(page, 'check-button', false);
  const challenge1Wrong = await snapshot(page);
  await sleep(350);
  await activate(page, 'Подсказка', false);
  const challenge1Hint = await snapshot(page);
  await activate(page, 'choice-size-large', false);
  await activate(page, 'check-button', false);
  await sleep(500);
  const challenge1Correct = await snapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', 'stage5-flow-challenge1-correct.png') });
  await activate(page, 'continue-button', false);
  await sleep(180);

  await activate(page, 'choice-size-small', false);
  await activate(page, 'check-button', false);
  await sleep(500);
  const challenge2Correct = await snapshot(page);
  await activate(page, 'continue-button', false);
  await sleep(180);

  await activate(page, 'choice-size-medium', false);
  await activate(page, 'check-button', false);
  await sleep(500);
  const challenge3Correct = await snapshot(page);
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', 'stage5-flow-complete.png') });

  const correctSlots = [
    challenge1Correct.choiceOrder.indexOf('size-large'),
    challenge2Correct.choiceOrder.indexOf('size-small'),
    challenge3Correct.choiceOrder.indexOf('size-medium'),
  ];
  const checks = {
    liveResize: beforeResize.selectedKey === 'size-medium' && afterResize.selectedKey === 'size-medium'
      && JSON.stringify(beforeResize.choiceOrder) === JSON.stringify(afterResize.choiceOrder)
      && afterResize.internalProgress === 'СРАВНЕНИЕ 1/3' && afterResize.progressText === '2 / 5',
    challenge1Wrong: challenge1Wrong.result === 'wrong' && challenge1Wrong.selectedKey === null
      && !challenge1Wrong.checkEnabled && challenge1Wrong.progressText === '2 / 5',
    hint: challenge1Hint.dialogueVisible
      && challenge1Hint.dialogueText === 'Сравни, какая батарейка занимает больше места'
      && challenge1Hint.progressText === '2 / 5',
    challenge1Correct: challenge1Correct.result === 'correct' && challenge1Correct.continueVisible
      && challenge1Correct.progressText === '2 / 5',
    challenge2Correct: challenge2Correct.result === 'correct' && challenge2Correct.continueVisible
      && challenge2Correct.internalProgress === 'СРАВНЕНИЕ 2/3' && challenge2Correct.progressText === '2 / 5',
    challenge3Correct: challenge3Correct.result === 'correct' && !challenge3Correct.continueVisible
      && challenge3Correct.internalProgress === 'СРАВНЕНИЕ 3/3' && challenge3Correct.progressText === '3 / 5',
    shuffledPositions: new Set(correctSlots).size > 1,
    dialogue: challenge1Correct.dialogueVisible && challenge2Correct.dialogueVisible && challenge3Correct.dialogueVisible,
    grounding: challenge3Correct.robot.yValue === challenge3Correct.robot.baseY
      && challenge3Correct.robot.angle === 0 && Math.abs(challenge3Correct.robot.scale - 0.2520718) < 1e-9,
    errors: errors.console.length + errors.page.length + errors.requests.length === 0,
  };
  await context.close();
  return { checks, errors, states: { beforeResize, afterResize, challenge1Wrong, challenge1Hint, challenge1Correct,
    challenge2Correct, challenge3Correct }, correctSlots };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const matrix = [];
  for (const viewport of viewports) matrix.push(await runMatrixViewport(browser, viewport));
  const flow = await runFlow(browser);
  await browser.close();
  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, value]) => !value).map(([key]) => `${entry.name}:${key}`)),
    ...Object.entries(flow.checks).filter(([, value]) => !value).map(([key]) => `flow:${key}`),
  ];
  const report = { matrix, flow, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-size-comparison-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ viewports: matrix.length, flow: flow.checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
