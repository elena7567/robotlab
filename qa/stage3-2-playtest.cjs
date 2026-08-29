const { chromium } = require('playwright');
const assert = require('assert/strict');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_PREVIEW_URL || 'http://127.0.0.1:4175/';
const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'minimum', width: 320, height: 568 },
];

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const results = [];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText || ''}`));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene?.getScene('StartScene')?.scene?.isActive());
    await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.start('GameScene'));
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene?.getScene('GameScene')?.scene?.isActive());
    await page.waitForTimeout(250);

    const inspect = async (state) => {
      const shot = path.resolve('docs', 'qa', 'screenshots', `stage3-2-${viewport.name}-${state}.png`);
      await page.screenshot({ path: shot });
      const data = await page.evaluate(() => {
        const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
        const robot = scene.children.getByName('grounded-robot');
        const texts = [];
        const visibleTexts = [];
        const visit = (item) => {
          if (item?.type === 'Text') {
            texts.push(item.text);
            let current = item;
            let visible = true;
            while (current) {
              if (!current.visible) visible = false;
              current = current.parentContainer;
            }
            if (visible) visibleTexts.push(item.text);
          }
          if (Array.isArray(item?.list)) item.list.forEach(visit);
        };
        scene.children.list.forEach(visit);
        return {
          robot: {
            x: robot.x,
            y: robot.y,
            scale: robot.scaleX,
            originX: robot.originX,
            originY: robot.originY,
            visibleFeetY: robot.y - 25 * robot.scaleY,
            baseX: robot.getData('baseX'),
            baseY: robot.getData('baseY'),
            platformContactX: robot.getData('platformContactX'),
            platformContactY: robot.getData('platformContactY'),
            logicalPlatformX: robot.getData('logicalPlatformX'),
            logicalPlatformY: robot.getData('logicalPlatformY'),
            logicalScale: robot.getData('logicalScale'),
          },
          progress: texts.filter((text) => /^\d+ \/ 5$/.test(text)),
          feedback: texts.filter((text) => ['Выбрано', 'Попробуй ещё раз', 'Три предмета можно съесть', 'Правильно! Отличная работа!'].includes(text)),
          nextVisible: visibleTexts.includes('Дальше'),
        };
      });
      results.push({ viewport, state, shot, ...data });
    };

    const activateChoice = async (index) => page.evaluate((choiceIndex) => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
      const taskCard = scene.children.getByName('task-card');
      const choices = taskCard.list.filter((item) => item.type === 'Container' && item.input).slice(0, 4);
      choices[choiceIndex].emit('pointerdown');
      choices[choiceIndex].emit('pointerup');
    }, index);
    const activateLabel = async (label) => page.evaluate((targetLabel) => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
      let target;
      const visit = (item) => {
        if (target) return;
        if (item?.type === 'Text' && item.text === targetLabel) target = item.parentContainer;
        if (Array.isArray(item?.list)) item.list.forEach(visit);
      };
      scene.children.list.forEach(visit);
      if (!target) throw new Error(`Control not found: ${targetLabel}`);
      target.emit('pointerdown');
      target.emit('pointerup');
    }, label);

    await inspect('initial');
    await activateChoice(0);
    await page.waitForTimeout(160);
    await inspect('selected');
    await activateLabel('Проверить');
    await page.waitForTimeout(400);
    await inspect('wrong');
    await activateLabel('Подсказка');
    await page.waitForTimeout(160);
    await inspect('hint');
    await activateChoice(3);
    await page.waitForTimeout(160);
    await activateLabel('Проверить');
    await page.waitForTimeout(500);
    await inspect('correct');
    await inspect('next-visible');

    const viewportStates = results.filter((result) => result.viewport.name === viewport.name && result.state);
    const initialRobot = viewportStates[0].robot;
    const expected = {
      initial: { progress: '0 / 5', nextVisible: false },
      selected: { progress: '0 / 5', nextVisible: false, feedback: 'Выбрано' },
      wrong: { progress: '0 / 5', nextVisible: false, feedback: 'Попробуй ещё раз' },
      hint: { progress: '0 / 5', nextVisible: false, feedback: 'Три предмета можно съесть' },
      correct: { progress: '1 / 5', nextVisible: true, feedback: 'Правильно! Отличная работа!' },
      'next-visible': { progress: '1 / 5', nextVisible: true, feedback: 'Правильно! Отличная работа!' },
    };
    viewportStates.forEach((result) => {
      assert.equal(result.robot.originX, 0.5, `${viewport.name}/${result.state} robot originX`);
      assert.equal(result.robot.originY, 1, `${viewport.name}/${result.state} robot originY`);
      assert.equal(result.robot.logicalPlatformX, 640, `${viewport.name}/${result.state} logical platform X`);
      assert.equal(result.robot.logicalPlatformY, 560, `${viewport.name}/${result.state} logical platform Y`);
      assert.equal(result.robot.logicalScale, 0.2520718, `${viewport.name}/${result.state} logical robot scale`);
      assert.ok(Math.abs(result.robot.visibleFeetY - result.robot.platformContactY) < 0.001, `${viewport.name}/${result.state} feet contact`);
      assert.ok(Math.abs(result.robot.baseX - initialRobot.baseX) < 0.001, `${viewport.name}/${result.state} base X stability`);
      assert.ok(Math.abs(result.robot.baseY - initialRobot.baseY) < 0.001, `${viewport.name}/${result.state} base Y stability`);
      assert.deepEqual(result.progress, [expected[result.state].progress], `${viewport.name}/${result.state} progress`);
      assert.equal(result.nextVisible, expected[result.state].nextVisible, `${viewport.name}/${result.state} next visibility`);
      if (expected[result.state].feedback) {
        assert.deepEqual(result.feedback, [expected[result.state].feedback], `${viewport.name}/${result.state} feedback`);
      }
    });
    assert.deepEqual(consoleErrors, [], `${viewport.name} console errors`);
    assert.deepEqual(pageErrors, [], `${viewport.name} page errors`);
    assert.deepEqual(failedRequests, [], `${viewport.name} failed requests`);

    results.push({ viewport, diagnostics: { consoleErrors, pageErrors, failedRequests } });
    await page.close();
  }

  await browser.close();
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
