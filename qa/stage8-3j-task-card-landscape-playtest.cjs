const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const profiles = [
  ['narrow-android-chrome', 412, 180],
  ['android-browser-chrome', 568, 220],
  ['minimum-landscape', 568, 320],
  ['short-landscape', 740, 360],
  ['samsung-landscape', 844, 390],
  ['wide-phone-landscape', 932, 430],
];
const tasks = [
  { number: 2, progressLabel: 'РЯД' },
  { number: 3, progressLabel: 'СРАВНЕНИЕ' },
  { number: 4, progressLabel: 'ТЕНЬ' },
];
const testCases = [
  ...profiles.map(([name, width, height]) => ({ name, width, height, ...tasks[0] })),
  ...profiles.filter(([name]) => name === 'minimum-landscape' || name === 'samsung-landscape')
    .flatMap(([name, width, height]) => tasks.slice(1).map((task) => ({ name, width, height, ...task }))),
];

const overlaps = (a, b, gap = 0) => a.x < b.right + gap && a.right > b.x - gap
  && a.y < b.bottom + gap && a.bottom > b.y - gap;

async function enterTask(page, taskNumber) {
  await page.evaluate(async (targetTask) => {
    const game = window.__ROBOTLAB_GAME__;
    const [{ sessionState }, { sequenceMechanic }, { sizeComparisonMechanic }, { shadowMatchingMechanic }] = await Promise.all([
      import('/src/game/state/sessionState.ts'),
      import('/src/game/mechanics/sequence.ts'),
      import('/src/game/mechanics/sizeComparison.ts'),
      import('/src/game/mechanics/shadowMatching.ts'),
    ]);
    sessionState.reset();
    sequenceMechanic.reset();
    sizeComparisonMechanic.reset();
    shadowMatchingMechanic.reset();
    for (let task = 1; task < targetTask; task += 1) sessionState.completeCurrentTask();
    game.scene.start('GameScene');
  }, taskNumber);
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene');
    return scene?.sys.isActive() && scene.children.getByName('task-card');
  });
  await page.waitForTimeout(120);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const rect = (item) => {
      const bounds = item.getBounds();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
    };
    const control = (name) => card.getByName(name);
    const choices = [...card.choices.values()].map((choice) => {
      const point = choice.container.getWorldTransformMatrix().transformPoint(0, 0);
      const width = choice.width * Math.abs(choice.container.scaleX);
      const height = choice.height * Math.abs(choice.container.scaleY);
      return {
        visual: { x: point.x - width / 2, y: point.y - height / 2, width, height, right: point.x + width / 2, bottom: point.y + height / 2 },
        frame: { width: choice.width, height: choice.height },
        hit: { width: choice.container.input.hitArea.width, height: choice.container.input.hitArea.height },
      };
    });
    const hint = control('hint-button');
    const check = control('check-button');
    const feedback = card.getByName('task-feedback');
    const ribbon = card.list.find((item) => typeof item.text === 'string' && item.text.startsWith('ЗАДАНИЕ'));
    return {
      layout: game.registry.get('responsiveLayout'),
      canvas: (() => {
        const bounds = game.canvas.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
      })(),
      inputTransform: {
        x: game.scale.displayScale.x,
        y: game.scale.displayScale.y,
      },
      card: rect(card),
      choices,
      hint: { visual: rect(hint), hit: { width: hint.input.hitArea.width, height: hint.input.hitArea.height } },
      check: { visual: rect(check), hit: { width: check.input.hitArea.width, height: check.input.hitArea.height } },
      feedback: { text: feedback.text, ...rect(feedback) },
      ribbon: { text: ribbon?.text ?? '', ...rect(ribbon) },
      interaction: {
        selectedKey: card.selectedKey ?? null,
        result: card.result,
      },
    };
  });
}

async function simulateStaleMobileBrowserBounds(page) {
  await page.evaluate(() => {
    const scale = window.__ROBOTLAB_GAME__.scale;
    scale.canvasBounds.setTo(0, 0, scale.baseSize.width, scale.baseSize.height);
    scale.displayScale.set(1, 1);
  });
}

async function tapTaskControl(page, target) {
  const point = await page.evaluate((requestedTarget) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const item = requestedTarget === 'choice'
      ? [...card.choices.values()][0].container
      : card.getByName(`${requestedTarget}-button`);
    const world = item.getWorldTransformMatrix().transformPoint(0, 0);
    const canvas = game.canvas.getBoundingClientRect();
    return {
      x: canvas.x + world.x * canvas.width / game.scale.width,
      y: canvas.y + world.y * canvas.height / game.scale.height,
    };
  }, target);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(100);
}

(async () => {
  fs.mkdirSync(path.join('docs', 'qa', 'screenshots'), { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const cases = [];
  for (const { name, width, height, number, progressLabel } of testCases) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
    await enterTask(page, number);
    const initial = await snapshot(page);
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage8-3j-task${number}-${name}-initial.png`) });

    const stressInputTransform = name === 'narrow-android-chrome' || name === 'android-browser-chrome';
    if (stressInputTransform) await simulateStaleMobileBrowserBounds(page);
    await tapTaskControl(page, 'choice');
    const selected = await snapshot(page);
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage8-3j-task${number}-${name}-selected.png`) });
    if (stressInputTransform) await simulateStaleMobileBrowserBounds(page);
    await tapTaskControl(page, 'hint');
    const hinted = await snapshot(page);
    if (stressInputTransform) await simulateStaleMobileBrowserBounds(page);
    await tapTaskControl(page, 'check');
    const checked = await snapshot(page);

    const checks = {
      shortLandscapeMode: initial.layout.semanticMode === 'PHONE_LANDSCAPE_SHORT',
      cardInsideCanvas: initial.card.x >= 0 && initial.card.y >= 0
        && initial.card.right <= initial.layout.viewportWidth
        && initial.card.bottom <= initial.layout.viewportHeight,
      childSizedChoices: initial.choices.every((choice) => choice.frame.width >= 56
        && choice.hit.width >= 56 && choice.hit.height >= 56),
      substantialActions: [initial.hint, initial.check].every((action) => action.hit.width >= 108 && action.hit.height >= 60),
      progressInRibbon: initial.ribbon.text.startsWith(`ЗАДАНИЕ ${number}/`)
        && initial.ribbon.text.includes(`${progressLabel} 1/3`),
      progressAbsentFromFeedback: !selected.feedback.text.includes(progressLabel),
      feedbackClearOfChoices: selected.choices.every((choice) => !overlaps(selected.feedback, choice.visual, 4)),
      feedbackClearOfActions: !overlaps(selected.feedback, selected.hint.visual, 4)
        && !overlaps(selected.feedback, selected.check.visual, 4),
      choiceTapDelivered: selected.interaction.selectedKey !== null && selected.feedback.text.includes('Выбрано'),
      hintTapDelivered: hinted.feedback.text.includes('Подсказка'),
      checkTapDelivered: checked.interaction.result === 'correct' || checked.interaction.result === 'wrong',
      liveInputTransformRecovered: [selected, hinted, checked].every((state) => (
        Math.abs(state.inputTransform.x - state.layout.viewportWidth / state.canvas.width) < 0.01
        && Math.abs(state.inputTransform.y - state.layout.viewportHeight / state.canvas.height) < 0.01
      )),
      browserClean: errors.length === 0,
    };
    cases.push({ name: `${name}-task${number}`, width, height, taskNumber: number, initial, selected, hinted, checked, checks, errors });
    await context.close();
  }

  for (const { number } of tasks) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
    await enterTask(page, number);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => {
      const game = window.__ROBOTLAB_GAME__;
      const committed = game?.registry.get('committedViewport');
      const scene = game?.scene.getScene('GameScene');
      return committed?.viewport.visualViewportWidth === 844
        && committed?.viewport.visualViewportHeight === 390
        && scene?.sys.isActive() && scene.children.getByName('task-card');
    });
    await page.waitForTimeout(220);
    const initial = await snapshot(page);
    await tapTaskControl(page, 'choice');
    const selected = await snapshot(page);
    await tapTaskControl(page, 'hint');
    const hinted = await snapshot(page);
    await tapTaskControl(page, 'check');
    const checked = await snapshot(page);
    const checks = {
      rotatedToShortLandscape: initial.layout.semanticMode === 'PHONE_LANDSCAPE_SHORT',
      scaleSynchronized: initial.canvas.width === 844 && initial.canvas.height === 390,
      choiceTapDelivered: selected.interaction.selectedKey !== null && selected.feedback.text.includes('Выбрано'),
      hintTapDelivered: hinted.feedback.text.includes('Подсказка'),
      checkTapDelivered: checked.interaction.result === 'correct' || checked.interaction.result === 'wrong',
      browserClean: errors.length === 0,
    };
    cases.push({
      name: `portrait-to-samsung-landscape-task${number}`,
      width: 844,
      height: 390,
      taskNumber: number,
      initial,
      selected,
      hinted,
      checked,
      checks,
      errors,
    });
    await context.close();
  }
  await browser.close();
  const failures = cases.flatMap((entry) => Object.entries(entry.checks)
    .filter(([, passed]) => !passed).map(([check]) => `${entry.name}:${check}`));
  const report = { cases, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-3j-task-card-landscape.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: cases.length, checks: cases.map(({ name, checks }) => ({ name, checks })), failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
