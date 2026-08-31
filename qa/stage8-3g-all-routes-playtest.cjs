const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const outputDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['mobile-360x600', 360, 600, true],
  ['desktop-1280x720', 1280, 720, false],
];
const longestRoutes = [
  ['RIGHT', 'UP', 'RIGHT', 'RIGHT', 'DOWN', 'LEFT'],
  ['UP', 'UP', 'RIGHT', 'RIGHT', 'RIGHT', 'DOWN', 'DOWN', 'LEFT', 'UP'],
  ['RIGHT', 'UP', 'LEFT', 'UP', 'RIGHT', 'RIGHT', 'RIGHT'],
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function controlCenter(page, name) {
  return page.evaluate((controlName) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const button = scene.children.getByName(controlName);
    if (!button) throw new Error(`Missing control ${controlName}`);
    return button.getWorldTransformMatrix().transformPoint(0, 0);
  }, name);
}

async function press(page, name, touch) {
  const point = await controlCenter(page, name);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function inspectRoute(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const find = (name) => all.find((item) => item?.name === name);
    const bounds = (item) => {
      const value = item?.getBounds?.();
      return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
    };
    const strip = find('program-strip');
    const stripData = strip?.data?.values || {};
    const slots = all.filter((item) => item?.name?.startsWith('program-slot-')).map(bounds);
    return {
      commandCount: stripData.commands?.length || 0,
      maxCommands: stripData.maxCommands,
      stripData,
      strip: bounds(strip),
      slots,
      commandControls: ['UP', 'RIGHT', 'DOWN', 'LEFT'].map((command) => bounds(find(`program-command-${command}`))),
      commandHitAreas: ['UP', 'RIGHT', 'DOWN', 'LEFT'].map((command) => {
        const hitArea = find(`program-command-${command}`)?.input?.hitArea;
        return hitArea ? { width: hitArea.width, height: hitArea.height } : null;
      }),
      robotCell: { column: find('programming-robot')?.getData('gridColumn'), row: find('programming-robot')?.getData('gridRow') },
      targetCell: { column: find('programming-board')?.getData('targetColumn'), row: find('programming-board')?.getData('targetRow') },
      feedback: find('programming-feedback')?.text,
    };
  });
}

const errorFree = (errors) => Object.values(errors).every((entries) => entries.length === 0);

async function runViewport(browser, [name, width, height, touch]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await page.evaluate(async () => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    const { programmingMechanic } = await import('/src/game/mechanics/programming.ts');
    sessionState.reset();
    for (let index = 0; index < 7; index += 1) sessionState.completeCurrentTask();
    programmingMechanic.reset();
    window.__ROBOTLAB_GAME__.scene.start('Mission8Scene');
  });

  const routes = [];
  for (let routeIndex = 0; routeIndex < longestRoutes.length; routeIndex += 1) {
    const expectedCapacity = longestRoutes[routeIndex].length;
    await page.waitForFunction((capacity) => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
      return scene?.sys.isActive()
        && scene.children.getByName('program-strip')?.getData('maxCommands') === capacity
        && scene.children.getByName('programming-run-button')
        && scene.children.getByName('program-command-UP');
    }, expectedCapacity, { timeout: 8000 });

    for (const command of longestRoutes[routeIndex]) await press(page, `program-command-${command}`, touch);
    const built = await inspectRoute(page);
    await page.screenshot({ path: path.join(outputDir, `stage8-3g-${name}-route${routeIndex + 1}-longest-program.png`) });
    await press(page, 'programming-run-button', touch);
    await page.waitForFunction(() => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
      const board = scene.children.getByName('programming-board');
      const robot = board?.getByName('programming-robot');
      return robot?.getData('gridColumn') === board?.getData('targetColumn')
        && robot?.getData('gridRow') === board?.getData('targetRow')
        && scene.children.getByName('programming-feedback')?.text === 'ПРОГРАММА РАБОТАЕТ!';
    }, { timeout: 12000 });
    const arrived = await inspectRoute(page);
    routes.push({ route: routeIndex + 1, commands: longestRoutes[routeIndex], built, arrived, checks: {
      fullProgramAccepted: built.commandCount === longestRoutes[routeIndex].length && built.commandCount === built.maxCommands,
      capacityMatchesLongestRoute: built.maxCommands === longestRoutes[routeIndex].length,
      allSlotsRendered: built.slots.length === built.maxCommands,
      slotsInsideViewport: built.slots.every((slot) => slot && slot.x >= -1 && slot.right <= width + 1 && slot.y >= -1 && slot.bottom <= height + 1),
      touchControlsAtLeast48: built.commandHitAreas.every((hitArea) => hitArea && hitArea.width >= 48 && hitArea.height >= 48),
      exactTargetCell: JSON.stringify(arrived.robotCell) === JSON.stringify(arrived.targetCell),
      successFeedback: arrived.feedback === 'ПРОГРАММА РАБОТАЕТ!',
    } });
  }

  // The success choreography includes a two-repeat charger pulse before the
  // completion modal is created; allow that visible animation to finish.
  await page.waitForTimeout(3200);
  const completion = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    return {
      modalVisible: Boolean(scene?.children.getByName('mission8-completion')),
    };
  });
  await context.close();
  return { name, width, height, touch, routes, completion, errors, checks: {
    missionCompleted: completion.modalVisible,
    errors: errorFree(errors),
  } };
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const results = [];
  for (const viewport of viewports) results.push(await runViewport(browser, viewport));
  await browser.close();
  const failures = results.flatMap((result) => [
    ...Object.entries(result.checks).filter(([, passed]) => !passed).map(([check]) => `${result.name}:${check}`),
    ...result.routes.flatMap((route) => Object.entries(route.checks).filter(([, passed]) => !passed)
      .map(([check]) => `${result.name}:route${route.route}:${check}`)),
  ]);
  const report = { routeDefinition: 'all simple non-repeating routes', results, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-3g-all-routes.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ failures }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
