const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const outputDir = path.join('docs', 'qa', 'screenshots');
const viewports = [
  ['360x600', 360, 600], ['390x844', 390, 844], ['844x390', 844, 390],
  ['768x1024', 768, 1024], ['1280x720', 1280, 720],
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function openGame(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
}

async function inspect(page, sceneKey) {
  return page.evaluate((key) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(key);
    const walk = (item) => [item, ...(item?.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const find = (name) => all.find((item) => item?.name === name);
    const bounds = (item) => {
      if (!item?.getBounds) return null;
      const value = item.getBounds();
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom, centerX: value.centerX, centerY: value.centerY };
    };
    return {
      scene: key,
      audit: game.registry.get('boundsAudit'),
      layout: game.registry.get('responsiveLayout'),
      transition: {
        title: bounds(find('transition-title')), subtitle: bounds(find('transition-subtitle')),
        helper: bounds(find('grounded-robot')), repaired: bounds(find('transition-assembled-robot')),
        button: bounds(find('transition-continue')),
      },
      mission7: {
        modal: bounds(find('mission7-completion')), button: bounds(find('mission7-continue')),
        blocker: Boolean(find('mission7-modal-blocker')?.input?.enabled),
        enabledPorts: all.filter((item) => item?.name?.startsWith('connection-source-') || item?.name?.startsWith('connection-target-'))
          .filter((item) => item.input?.enabled).map((item) => item.name),
      },
      mission8: {
        robot: bounds(find('programming-robot')), target: bounds(find('programming-target-pad')),
        robotCell: find('programming-robot') ? { column: find('programming-robot').getData('gridColumn'), row: find('programming-robot').getData('gridRow') } : null,
        targetCell: find('programming-board') ? { column: find('programming-board').getData('targetColumn'), row: find('programming-board').getData('targetRow') } : null,
        feedback: find('programming-feedback')?.text || '',
      },
    };
  }, sceneKey);
}

const intersects = (a, b) => Boolean(a && b && a.right > b.x && a.x < b.right && a.bottom > b.y && a.y < b.bottom);
const inside = (value, width, height) => Boolean(value && value.x >= -1 && value.y >= -1 && value.right <= width + 1 && value.bottom <= height + 1);
const errorFree = (errors) => Object.values(errors).every((entries) => entries.length === 0);

async function transitionCase(browser, viewport) {
  const [name, width, height] = viewport;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: Math.min(width, height) < 500, isMobile: Math.min(width, height) < 500 });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openGame(page);
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.start('TransitionScene'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('TransitionScene'));
  await page.waitForTimeout(120);
  const state = await inspect(page, 'TransitionScene');
  await page.screenshot({ path: path.join(outputDir, `stage8-3e-transition-${name}.png`) });
  await context.close();
  return { name, width, height, state, errors, checks: {
    contentInside: [state.transition.title, state.transition.subtitle, state.transition.helper, state.transition.repaired, state.transition.button].every((item) => inside(item, width, height)),
    robotsReadable: [state.transition.helper, state.transition.repaired].every((item) => item?.height >= (width < height ? 150 : 110)),
    robotsClearButton: !intersects(state.transition.helper, state.transition.button) && !intersects(state.transition.repaired, state.transition.button),
    noMajorOverlaps: (state.audit?.overlapCount ?? 0) === 0,
    errors: errorFree(errors),
  } };
}

async function mission7CompletionCase(browser, viewport) {
  const [name, width, height] = viewport;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: Math.min(width, height) < 500, isMobile: Math.min(width, height) < 500 });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openGame(page);
  await page.evaluate(async () => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    const { connectionsMechanic } = await import('/src/game/mechanics/connections.ts');
    sessionState.reset();
    for (let index = 0; index < 7; index += 1) sessionState.completeCurrentTask();
    connectionsMechanic.reset();
    while (!connectionsMechanic.snapshot.completed) {
      for (const color of connectionsMechanic.snapshot.challenge.colors) connectionsMechanic.connect(color, color);
      connectionsMechanic.continue();
    }
    window.__ROBOTLAB_GAME__.scene.start('Mission7Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene')?.children.getByName('mission7-completion'));
  await page.waitForTimeout(80);
  const state = await inspect(page, 'Mission7Scene');
  await page.screenshot({ path: path.join(outputDir, `stage8-3e-mission7-completion-${name}.png`) });
  await context.close();
  return { name, width, height, state, errors, checks: {
    modalInside: inside(state.mission7.modal, width, height) && inside(state.mission7.button, width, height),
    inputBlocked: state.mission7.blocker && state.mission7.enabledPorts.length === 0,
    noMajorOverlaps: (state.audit?.overlapCount ?? 0) === 0,
    errors: errorFree(errors),
  } };
}

async function mission8ArrivalCase(browser, viewport) {
  const [name, width, height] = viewport;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: Math.min(width, height) < 500, isMobile: Math.min(width, height) < 500 });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openGame(page);
  await page.evaluate(async () => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    const { programmingMechanic } = await import('/src/game/mechanics/programming.ts');
    sessionState.reset();
    for (let index = 0; index < 7; index += 1) sessionState.completeCurrentTask();
    programmingMechanic.reset();
    for (const command of ['UP', 'RIGHT', 'RIGHT', 'DOWN']) programmingMechanic.add(command);
    window.__ROBOTLAB_GAME__.scene.start('Mission8Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission8Scene'));
  const runPoint = await page.evaluate(() => {
    const button = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('programming-run-button');
    return button.getWorldTransformMatrix().transformPoint(0, 0);
  });
  await page.mouse.click(runPoint.x, runPoint.y);
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const robot = scene.children.getByName('programming-board')?.getByName('programming-robot');
    const board = scene.children.getByName('programming-board');
    const feedback = scene.children.getByName('programming-feedback');
    return robot?.getData('gridColumn') === board?.getData('targetColumn')
      && robot?.getData('gridRow') === board?.getData('targetRow') && feedback?.text === 'ПРОГРАММА РАБОТАЕТ!';
  }, { timeout: 7000 });
  const state = await inspect(page, 'Mission8Scene');
  await page.screenshot({ path: path.join(outputDir, `stage8-3e-mission8-alternative-arrival-${name}.png`) });
  await context.close();
  return { name, width, height, state, errors, checks: {
    exactTargetCell: JSON.stringify(state.mission8.robotCell) === JSON.stringify(state.mission8.targetCell),
    robotOverCharger: intersects(state.mission8.robot, state.mission8.target),
    robotReadable: state.mission8.robot?.height >= 52,
    successFeedback: state.mission8.feedback === 'ПРОГРАММА РАБОТАЕТ!',
    errors: errorFree(errors),
  } };
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const transitions = [], mission7Completion = [], mission8Arrival = [];
  for (const viewport of viewports) transitions.push(await transitionCase(browser, viewport));
  for (const viewport of viewports) mission7Completion.push(await mission7CompletionCase(browser, viewport));
  for (const viewport of viewports) mission8Arrival.push(await mission8ArrivalCase(browser, viewport));
  await browser.close();
  const groups = { transitions, mission7Completion, mission8Arrival };
  const failures = Object.entries(groups).flatMap(([group, entries]) => entries.flatMap((entry) => Object.entries(entry.checks)
    .filter(([, passed]) => !passed).map(([check]) => `${group}:${entry.name}:${check}`)));
  const report = { ...groups, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage8-3e-special-states.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ failures }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
