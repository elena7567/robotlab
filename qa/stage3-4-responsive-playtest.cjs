const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4184/';
const matrix = [
  ['portrait-320x568', 320, 568, true], ['portrait-333x885', 333, 885, true],
  ['portrait-360x800', 360, 800, true], ['portrait-390x844', 390, 844, true],
  ['portrait-400x824', 400, 824, true], ['portrait-412x915', 412, 915, true],
  ['tablet-600x960', 600, 960, true], ['tablet-768x1024', 768, 1024, true],
  ['tablet-820x1180', 820, 1180, true], ['tablet-912x1368', 912, 1368, true],
  ['tablet-1024x1366', 1024, 1366, true], ['landscape-568x320', 568, 320, true],
  ['landscape-844x390', 844, 390, true], ['landscape-915x412', 915, 412, true],
  ['desktop-1280x720', 1280, 720, false], ['desktop-1366x768', 1366, 768, false],
  ['desktop-1920x1080', 1920, 1080, false],
];
const intermediate = [
  ['intermediate-340', 340, 760, true], ['intermediate-375', 375, 800, true],
  ['intermediate-430', 430, 860, true], ['intermediate-540', 540, 900, true],
  ['intermediate-700', 700, 1000, true], ['intermediate-860', 860, 1100, true],
  ['intermediate-1100', 1100, 720, false],
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runViewport(browser, [name, width, height, touch], regression) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));

  async function pointFor(labelOrName, sceneKey = 'GameScene') {
    return page.evaluate(({ labelOrName, sceneKey }) => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
      const root = sceneKey === 'GameScene' ? scene.children.getByName('task-card') : undefined;
      const target = root?.getByName(labelOrName)
        || scene.children.getByName(labelOrName)
        || root?.list.find((item) => item.list?.some((child) => child.text === labelOrName))
        || scene.children.list.find((item) => item.list?.some((child) => child.text === labelOrName));
      if (!target) throw new Error(`Target not found: ${sceneKey}/${labelOrName}`);
      const point = target.getWorldTransformMatrix().transformPoint(0, 0);
      return { x: point.x, y: point.y };
    }, { labelOrName, sceneKey });
  }
  async function activate(labelOrName, sceneKey = 'GameScene') {
    const point = await pointFor(labelOrName, sceneKey);
    if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await sleep(50);
  }
  async function snapshot() {
    return page.evaluate(() => {
      const game = window.__ROBOTLAB_GAME__;
      const scene = game.scene.getScene('GameScene');
      const layout = game.registry.get('responsiveLayout');
      const card = scene.children.getByName('task-card');
      const progress = scene.children.getByName('progress-panel');
      const dialogue = scene.children.getByName('robot-dialogue');
      const robot = scene.children.getByName('logical-actors')?.getByName('grounded-robot');
      const bounds = (item) => { const b = item.getBounds(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
      const hitSize = (item) => ({ width: item.input?.hitArea?.width ?? item.width, height: item.input?.hitArea?.height ?? item.height });
      const namedControl = (text) => scene.children.list.find((item) => item.list?.some((child) => child.text === text));
      const choices = [...card.choices.values()].map((choice) => bounds(choice.container));
      const cardBounds = bounds(card);
      const progressBounds = bounds(progress);
      const robotBounds = bounds(robot);
      const dialogueBounds = dialogue?.visible
        ? { x: dialogue.x, y: dialogue.y, width: dialogue.width, height: dialogue.height,
          right: dialogue.x + dialogue.width, bottom: dialogue.y + dialogue.height }
        : null;
      return {
        mode: layout.mode,
        layout,
        cardBounds,
        progressBounds,
        robotBounds,
        dialogueBounds,
        dialogueVisible: dialogue?.visible ?? false,
        dialogueText: dialogue?.label?.text ?? '',
        homeBounds: bounds(namedControl('⌂ Домой')),
        soundBounds: bounds(scene.children.list.find((item) => item.list?.some((child) => /Звук$/.test(child.text)))),
        choices,
        touchTargets: {
          home: hitSize(namedControl('⌂ Домой')),
          sound: hitSize(scene.children.list.find((item) => item.list?.some((child) => /Звук$/.test(child.text)))),
          choices: [...card.choices.values()].map((choice) => hitSize(choice.container)),
          hint: hitSize(card.list.find((item) => item.list?.some((child) => child.text === 'Подсказка'))),
          check: hitSize(card.checkButton),
        },
        selectedKey: card.selectedKey,
        result: card.result,
        checkEnabled: card.checkButton.getData('control-runtime').enabled,
        continueVisible: card.continueButton.visible,
        feedback: card.feedbackText.text,
        progressText: progress.progressLayer.list.find((item) => /^\d \/ 5$/.test(item.text || ''))?.text,
        grounding: {
          x: robot.x, y: robot.y, baseX: robot.getData('baseX'), baseY: robot.getData('baseY'),
          scale: robot.scaleX, angle: robot.angle, originX: robot.originX, originY: robot.originY,
          logicalScale: robot.getData('logicalScale'), platformX: robot.getData('platformContactX'),
          platformY: robot.getData('platformContactY'), logicalPlatformY: robot.getData('logicalPlatformY'),
        },
        canvas: { width: game.canvas.width, height: game.canvas.height },
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      };
    });
  }

  if (name === 'portrait-320x568' || name === 'desktop-1280x720') {
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage3-4-start-${name}.png`) });
  }
  await activate('Играть', 'StartScene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  const initial = await snapshot();
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage3-4-${name}.png`) });
  let regressionStates;
  if (regression) {
    await activate('Подсказка');
    const hint = await snapshot();
    await activate('choice-odd-banana');
    const selected = await snapshot();
    await activate('check-button');
    await sleep(90);
    const wrong = await snapshot();
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage3-4-${name}-wrong.png`) });
    await activate('choice-odd-ball');
    await activate('check-button');
    await sleep(450);
    const correct = await snapshot();
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage3-4-${name}-correct.png`) });
    let fullProgress;
    if (name === 'desktop-1280x720') {
      await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('progress-panel').setValue(5));
      fullProgress = await snapshot();
    }
    const soundBefore = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.list
      .flatMap((item) => item.list || []).find((item) => /Звук$/.test(item.text || ''))?.text);
    await activate(soundBefore);
    const soundAfter = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.list
      .flatMap((item) => item.list || []).find((item) => /Звук$/.test(item.text || ''))?.text);
    let home = false;
    let next = false;
    if (name === 'desktop-1280x720') {
      await activate('continue-button');
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('TransitionScene'));
      next = true;
    } else {
      await activate('⌂ Домой');
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
      home = true;
    }
    regressionStates = { hint, selected, wrong, correct, fullProgress, soundBefore, soundAfter, home, next };
  }
  const result = { name, width, height, touch, initial, regressionStates, consoleErrors, pageErrors, failedRequests };
  await context.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const results = [];
  const regressionNames = new Set(['portrait-320x568', 'portrait-390x844', 'tablet-768x1024', 'landscape-568x320', 'desktop-1280x720']);
  for (const viewport of [...matrix, ...intermediate]) results.push(await runViewport(browser, viewport, regressionNames.has(viewport[0])));
  await browser.close();
  fs.writeFileSync(path.join('docs', 'qa', 'stage3-4-results.json'), JSON.stringify(results, null, 2));
  const checks = results.map((result) => {
    const { initial } = result;
    const expectedMode = result.width < result.height
      ? (result.width < 360 ? 'ultra-narrow-portrait' : result.width < 600 ? 'portrait' : 'large-portrait-tablet')
      : 'landscape';
    const targetSizes = [initial.touchTargets.home, initial.touchTargets.sound, initial.touchTargets.hint,
      initial.touchTargets.check, ...initial.touchTargets.choices];
    const regressionOk = !result.regressionStates || (
      result.regressionStates.hint.feedback.includes('Три предмета')
      && result.regressionStates.selected.selectedKey === 'odd-banana'
      && result.regressionStates.wrong.result === 'wrong'
      && result.regressionStates.wrong.progressText === '0 / 5'
      && result.regressionStates.wrong.dialogueVisible
      && result.regressionStates.correct.result === 'correct'
      && result.regressionStates.correct.progressText === '1 / 5'
      && result.regressionStates.correct.continueVisible
      && result.regressionStates.correct.grounding.y === result.regressionStates.correct.grounding.baseY
      && result.regressionStates.correct.grounding.angle === 0
      && result.regressionStates.soundBefore !== result.regressionStates.soundAfter
      && (result.regressionStates.home || result.regressionStates.next)
      && (!result.regressionStates.fullProgress || result.regressionStates.fullProgress.progressText === '5 / 5')
    );
    return {
      name: result.name,
      mode: initial.mode,
      modeOk: initial.mode === expectedMode,
      groundingOk: initial.grounding.x === 640 && initial.grounding.baseX === 640
        && initial.grounding.y === initial.grounding.baseY && initial.grounding.angle === 0
        && initial.grounding.originX === 0.5 && initial.grounding.originY === 1
        && initial.grounding.platformX === 640 && initial.grounding.platformY === 560
        && Math.abs(initial.grounding.scale - 0.2520718) < 1e-9,
      viewportOk: initial.canvas.width === result.width && initial.canvas.height === result.height
        && initial.document.width === result.width && initial.document.height === result.height,
      cardRobotOk: initial.mode === 'landscape'
        || initial.layout.taskCard.y + initial.layout.taskCard.height <= initial.robotBounds.y + 7,
      touchTargetsOk: targetSizes.every((target) => target.width >= 44 && target.height >= 44),
      dialogueOk: !result.regressionStates || (
        result.regressionStates.wrong.dialogueBounds.x >= 0
        && result.regressionStates.wrong.dialogueBounds.y >= 0
        && result.regressionStates.wrong.dialogueBounds.right <= result.width
        && result.regressionStates.wrong.dialogueBounds.bottom <= result.height
        && (initial.mode !== 'landscape'
          || result.regressionStates.wrong.dialogueBounds.right <= initial.layout.progress.x)
      ),
      regressionOk,
      errorsOk: result.consoleErrors.length + result.pageErrors.length + result.failedRequests.length === 0,
    };
  });
  const failures = checks.flatMap((check) => Object.entries(check)
    .filter(([key, value]) => key.endsWith('Ok') && !value).map(([key]) => `${check.name}:${key}`));
  process.stdout.write(JSON.stringify({ viewports: checks.length, checks, failures }, null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
