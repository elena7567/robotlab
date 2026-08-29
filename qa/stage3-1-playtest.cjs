const { chromium } = require('playwright');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const URL = 'http://127.0.0.1:4177/';
const viewports = [
  { name: 'desktop', width: 1280, height: 720, touch: false },
  { name: 'tablet', width: 768, height: 1024, touch: true },
  { name: 'mobile', width: 390, height: 844, touch: true },
  { name: 'minimum', width: 320, height: 568, touch: true },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sceneKey(page) {
  return page.evaluate(() => window.__ROBOTLAB_GAME__?.registry.get('activeScene'));
}

async function waitForScene(page, expected) {
  await page.waitForFunction((key) => window.__ROBOTLAB_GAME__?.registry.get('activeScene') === key, expected);
}

async function interactive(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.scenes.find((candidate) => candidate.scene.isActive());
    if (!scene) return [];
    const descendants = (object) => {
      const children = object.list ?? [];
      return children.flatMap((child) => [child, ...descendants(child)]);
    };
    return scene.input._list.map((object) => {
      const children = descendants(object);
      const point = object.getWorldTransformMatrix().transformPoint(0, 0);
      const text = children.filter((child) => child.type === 'Text').map((child) => child.text).join(' ');
      const texture = children.find((child) => child.type === 'Image')?.texture?.key ?? '';
      const runtime = object.getData?.('control-runtime');
      return {
        text,
        texture,
        x: point.x,
        y: point.y,
        width: object.width,
        height: object.height,
        scale: object.scaleX,
        alpha: object.alpha,
        visible: object.visible,
        enabled: runtime?.enabled ?? object.input?.enabled ?? false,
      };
    });
  });
}

async function allTexts(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.scenes.find((candidate) => candidate.scene.isActive());
    const walk = (object) => [object, ...(object.list ?? []).flatMap(walk)];
    return scene.children.list.flatMap(walk).filter((object) => object.type === 'Text').map((object) => object.text);
  });
}

async function findControl(page, predicate, description) {
  const match = (await interactive(page)).find(predicate);
  assert(match, `Missing control: ${description}`);
  return match;
}

async function mousePressFeedback(page, control, lookup, label) {
  await page.mouse.move(control.x, control.y);
  await page.mouse.down();
  await page.waitForTimeout(20);
  const pressed = await findControl(page, lookup, `${label} while pressed`);
  assert(pressed.scale <= 0.98, `${label} did not depress immediately: ${pressed.scale}`);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const released = await findControl(page, lookup, `${label} after release`);
  assert(Math.abs(released.scale - 1) < 0.01, `${label} remained pressed: ${released.scale}`);
}

async function activate(page, config, control) {
  if (config.touch) await page.touchscreen.tap(control.x, control.y);
  else await page.mouse.click(control.x, control.y);
  await page.waitForTimeout(80);
}

async function runViewport(browser, config) {
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    hasTouch: config.touch,
    isMobile: config.touch,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await waitForScene(page, 'StartScene');

  const startControls = await interactive(page);
  const play = startControls.find((item) => item.text.includes('Играть'));
  const startSound = startControls.find((item) => item.text.includes('Звук'));
  assert(play && startSound, `${config.name}: start controls missing`);
  assert(play.height >= 56 && startSound.width >= 44 && startSound.height >= 44, `${config.name}: start hit target too small`);

  if (!config.touch) {
    await mousePressFeedback(page, startSound, (item) => item.text.includes('Звук'), 'Звук');
  } else {
    await activate(page, config, startSound);
  }
  await activate(page, config, play);
  await waitForScene(page, 'GameScene');

  const initial = await interactive(page);
  const home = initial.find((item) => item.text.includes('Домой'));
  const gameSound = initial.find((item) => item.text.includes('Звук'));
  const hint = initial.find((item) => item.text.includes('Подсказка'));
  const check = initial.find((item) => item.text.includes('Проверить'));
  const choices = initial.filter((item) => item.texture.startsWith('odd-'));
  assert(home && gameSound && hint && check && choices.length === 4, `${config.name}: game controls missing`);
  assert([home, gameSound, hint, check].every((item) => item.width >= 44 && item.height >= 44), `${config.name}: control hit target below 44px`);
  assert(choices.every((item) => item.width >= 64 && item.height >= 64), `${config.name}: object hit target below 64px`);
  assert(!check.enabled && check.alpha < 0.5, `${config.name}: disabled check is not clearly inactive`);

  if (!config.touch) {
    await mousePressFeedback(page, hint, (item) => item.text.includes('Подсказка'), 'Подсказка');
  } else {
    await activate(page, config, hint);
  }
  assert((await allTexts(page)).includes('Три предмета можно съесть'), `${config.name}: hint feedback missing`);
  assert((await allTexts(page)).includes('0 / 5'), `${config.name}: hint changed progress`);

  const apple = await findControl(page, (item) => item.texture === 'odd-apple', 'apple');
  if (!config.touch) {
    await page.mouse.move(apple.x, apple.y);
    await page.mouse.down();
    await page.waitForTimeout(20);
    const pressedApple = await findControl(page, (item) => item.texture === 'odd-apple', 'pressed apple');
    assert(pressedApple.scale <= 0.98, `${config.name}: object did not depress immediately`);
    assert((await allTexts(page)).includes('Выбрано'), `${config.name}: selection feedback was delayed`);
    await page.mouse.up();
    await page.waitForTimeout(150);
  } else {
    await activate(page, config, apple);
  }
  const selectedApple = await findControl(page, (item) => item.texture === 'odd-apple', 'selected apple');
  assert(selectedApple.scale > 1.03, `${config.name}: selected object has no persistent scale emphasis`);
  const enabledCheck = await findControl(page, (item) => item.text.includes('Проверить'), 'enabled check');
  assert(enabledCheck.enabled && enabledCheck.alpha === 1, `${config.name}: check did not activate immediately`);

  await activate(page, config, enabledCheck);
  assert((await allTexts(page)).includes('Попробуй ещё раз'), `${config.name}: wrong feedback missing`);
  assert((await allTexts(page)).includes('0 / 5'), `${config.name}: wrong answer advanced progress`);

  const banana = await findControl(page, (item) => item.texture === 'odd-banana', 'banana');
  await activate(page, config, banana);
  const selectedBanana = await findControl(page, (item) => item.texture === 'odd-banana', 'selected banana');
  assert(selectedBanana.scale > 1.03, `${config.name}: changed selection is not persistent`);
  const ball = await findControl(page, (item) => item.texture === 'odd-ball', 'ball');
  await activate(page, config, ball);
  const correctCheck = await findControl(page, (item) => item.text.includes('Проверить'), 'correct check');
  await activate(page, config, correctCheck);
  await activate(page, config, correctCheck);
  await page.waitForTimeout(240);
  assert(await sceneKey(page) === 'GameScene', `${config.name}: rapid check caused an accidental transition`);
  assert((await allTexts(page)).includes('1 / 5'), `${config.name}: correct answer did not set progress to 1/5`);
  assert((await allTexts(page)).includes('Правильно! Отличная работа!'), `${config.name}: correct feedback missing`);

  const gameControls = await interactive(page);
  const robotMetrics = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.scenes.find((candidate) => candidate.scene.key === 'GameScene');
    const robot = scene.children.list.find((object) => object.type === 'Image' && object.texture?.key === 'robot-complete');
    const card = scene.children.list.find((object) => object.name === 'task-card');
    const bounds = robot.getBounds();
    const cardBounds = card.getBounds();
    return {
      bottom: bounds.bottom,
      top: bounds.top,
      height: bounds.height,
      contactY: robot.getData('platformContactY'),
      cardBottom: cardBounds.bottom,
      viewportHeight: scene.scale.height,
    };
  });
  const expectedContact = config.height < 650 ? config.height - 34 : (config.width / config.height < 0.82 ? config.height * 0.78 : Math.min(config.height * (560 / 720), config.height - 34));
  assert(
    Math.abs(robotMetrics.contactY - expectedContact) < 1,
    `${config.name}: robot contact ${robotMetrics.contactY.toFixed(1)} does not match platform anchor ${expectedContact.toFixed(1)}`,
  );
  if (config.width / config.height < 0.82) {
    assert(robotMetrics.top >= robotMetrics.cardBottom + 6, `${config.name}: robot overlaps task card`);
  }

  await page.screenshot({ path: path.join(ROOT, 'docs', 'qa', 'screenshots', `stage3-1-game-${config.name}.png`) });

  const homeAfter = gameControls.find((item) => item.text.includes('Домой'));
  await activate(page, config, homeAfter);
  await waitForScene(page, 'StartScene');
  assert(errors.length === 0, `${config.name}: console errors: ${errors.join(' | ')}`);
  await context.close();
  return {
    viewport: `${config.width}x${config.height}`,
    input: config.touch ? 'touch' : 'mouse',
    minChoice: `${Math.min(...choices.map((item) => item.width)).toFixed(1)}x${Math.min(...choices.map((item) => item.height)).toFixed(1)}`,
    robotBottom: robotMetrics.bottom.toFixed(1),
    platformAnchor: expectedContact.toFixed(1),
    consoleErrors: errors.length,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const results = [];
    for (const viewport of viewports) results.push(await runViewport(browser, viewport));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack ?? error);
  process.exit(1);
});
