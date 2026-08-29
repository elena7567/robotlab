const { chromium } = require('playwright');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4176/';
const viewports = [
  { name: 'desktop', width: 1280, height: 720, touch: false },
  { name: 'tablet', width: 768, height: 1024, touch: true },
  { name: 'mobile', width: 390, height: 844, touch: true },
  { name: 'minimum', width: 320, height: 568, touch: true },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.touch,
    isMobile: viewport.touch,
  });
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
      let target;
      if (sceneKey === 'StartScene') {
        target = scene.children.list.find((item) => item.list?.some((child) => child.text === labelOrName));
      } else {
        const card = scene.children.getByName('task-card');
        target = card?.getByName(labelOrName)
          || scene.children.getByName(labelOrName)
          || card?.list.find((item) => item.list?.some((child) => child.text === labelOrName))
          || scene.children.list.find((item) => item.list?.some((child) => child.text === labelOrName));
      }
      if (!target) throw new Error(`Target not found: ${sceneKey}/${labelOrName}`);
      const point = target.getWorldTransformMatrix().transformPoint(0, 0);
      return { x: point.x, y: point.y };
    }, { labelOrName, sceneKey });
  }

  async function activate(labelOrName, sceneKey = 'GameScene') {
    const point = await pointFor(labelOrName, sceneKey);
    if (viewport.touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await sleep(40);
  }

  async function snapshot() {
    return page.evaluate(() => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
      const card = scene.children.getByName('task-card');
      const dialogue = scene.children.getByName('robot-dialogue');
      const robot = scene.children.getByName('grounded-robot');
      const checkRuntime = card.checkButton.getData('control-runtime');
      const texts = [];
      const collect = (item) => {
        if (typeof item.text === 'string') texts.push(item.text);
        if (item.list) item.list.forEach(collect);
      };
      scene.children.list.forEach(collect);
      const bounds = (item) => {
        const value = item.getBounds();
        return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
      };
      const overlaps = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
      const dialogueBounds = dialogue ? bounds(dialogue) : null;
      const cardBounds = bounds(card);
      const robotBounds = robot ? bounds(robot) : null;
      return {
        selectedKey: card.selectedKey,
        result: card.result,
        feedback: card.feedbackText.text,
        checkEnabled: checkRuntime.enabled,
        continueVisible: card.continueButton.visible,
        dialogueVisible: dialogue?.visible ?? false,
        dialogueText: dialogue?.label?.text ?? '',
        dialogueBounds,
        cardBounds,
        robotBounds,
        dialogueOverlapsCard: dialogueBounds ? overlaps(dialogueBounds, cardBounds) : false,
        robotPose: robot ? {
          x: robot.x, y: robot.y, scaleX: robot.scaleX, scaleY: robot.scaleY, angle: robot.angle,
          baseX: robot.getData('baseX'), baseY: robot.getData('baseY'),
        } : null,
        progress: texts.find((text) => /^\d \/ 5$/.test(text)),
      };
    });
  }

  await activate('Играть', 'StartScene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  await activate('choice-odd-banana');
  await activate('check-button');
  await sleep(80);
  const wrongImmediate = await snapshot();
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage3-3-wrong-${viewport.name}.png`) });
  await activate('choice-odd-apple');
  const immediateReselection = await snapshot();
  await activate('check-button');
  await sleep(400);
  const secondWrongSettled = await snapshot();
  await activate('choice-odd-carrot');
  await activate('check-button');
  await sleep(400);
  const thirdWrongSettled = await snapshot();
  await activate('Подсказка');
  const hintAfterWrong = await snapshot();
  await activate('choice-odd-ball');
  await activate('check-button');
  await sleep(450);
  const correctAfterRetries = await snapshot();
  await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage3-3-correct-${viewport.name}.png`) });

  let autoDismissed;
  let resetAfterHome;
  if (viewport.name === 'desktop') {
    await activate('⌂ Домой');
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
    await activate('Играть', 'StartScene');
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
    await activate('choice-odd-banana');
    await activate('check-button');
    await sleep(2100);
    autoDismissed = await snapshot();
    await activate('⌂ Домой');
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
    await activate('Играть', 'StartScene');
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
    resetAfterHome = await snapshot();
  }

  const result = {
    viewport,
    wrongImmediate,
    immediateReselection,
    secondWrongSettled,
    thirdWrongSettled,
    hintAfterWrong,
    correctAfterRetries,
    autoDismissed,
    resetAfterHome,
    consoleErrors,
    pageErrors,
    failedRequests,
  };
  await context.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const results = [];
  for (const viewport of viewports) results.push(await runViewport(browser, viewport));
  await browser.close();
  process.stdout.write(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
