const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage9-6-mission9-mobile-polish.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

const cleanRuntimeErrors = (errors) => errors.console.length === 0
  && errors.requests.length === 0
  && errors.responses.length === 0
  && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;

async function openMission9(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_BRIDGE_CORRECT')
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_GATE_KEY_CORRECT')
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_ENERGY_CORRECT'), null, { timeout: 30000 });
  await page.evaluate(() => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission9Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  await sleep(280);
}

async function pointFor(page, name) {
  return page.evaluate((name) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene');
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Missing Mission9Scene/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, name);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission9Scene');
    const all = [];
    const walk = (item) => {
      all.push(item);
      if (item?.list) for (const child of item.list) walk(child);
    };
    scene.children.list.forEach(walk);
    const find = (name) => all.find((item) => item?.name === name);
    const bounds = (item) => {
      if (!item) return null;
      const audit = item.getData?.('auditBounds');
      if (audit) return { x: audit.x, y: audit.y, width: audit.width, height: audit.height };
      const b = item.getBounds?.();
      return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
    };
    const stage = window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage;
    const target = find('mission9-bridge-gap-target') || find('mission9-gate-lock-panel') || find('mission9-power-module-socket');
    const title = find('mission9-feedback');
    const labels = all.filter((item) => typeof item?.text === 'string').map((item) => item.text);
    const actions = all.filter((item) => item?.name?.startsWith('mission9-choice-') && item.getData?.('courseAction')).map((item) => ({
      name: item.name,
      action: item.getData('courseAction'),
      alpha: item.alpha,
      scaleX: item.scaleX,
      depth: item.depth,
      hit: item.input?.hitArea ? { width: item.input.hitArea.width, height: item.input.hitArea.height } : null,
      bounds: bounds(item),
      x: item.x,
      y: item.y,
    }));
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      stage,
      labels,
      dragThreshold: game.registry.get('mission9DragThreshold'),
      interactionState: game.registry.get('mission9InteractionState') || 'IDLE',
      touchAction: getComputedStyle(document.querySelector('canvas')).touchAction,
      actions,
      target: {
        visible: bounds(target),
        acceptance: target?.getData?.('dropTargetBounds') || null,
      },
      title: {
        text: title?.text || null,
        bounds: bounds(title),
        color: title?.style?.color || null,
        stroke: title?.style?.stroke || null,
        strokeThickness: title?.style?.strokeThickness || null,
      },
      orientation: {
        gate: Boolean(find('mission9-orientation-gate')),
        icon: Boolean(find('mission9-orientation-phone-icon')),
        helper: Boolean(find('mission9-orientation-helper')),
        animated: find('mission9-orientation-phone-icon')?.getData?.('animated') ?? null,
        reducedMotion: find('mission9-orientation-phone-icon')?.getData?.('reducedMotion') ?? null,
        oldCopy: labels.some((text) => /ПОВЕРНИ ЭКРАН|МИССИЯ 9 ИГРАЕТСЯ/.test(text)),
      },
    };
  });
}

async function capture(page, name) {
  const file = path.join(screenshotDir, `stage9-6-mission9-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

async function dragSequence(page, viewportName, stageName, wrongName, correctName) {
  const shots = [];
  const idle = await inspect(page);
  shots.push({ state: 'idle', screenshot: await capture(page, `${viewportName}-${stageName}-idle`), inspect: idle });

  if (wrongName) {
    const wrongStart = await pointFor(page, wrongName);
    const wrongTarget = idle.target.acceptance;
    await page.mouse.move(wrongStart.x, wrongStart.y);
    await page.mouse.down();
    await page.mouse.move(wrongTarget.x + wrongTarget.width / 2, wrongTarget.y + wrongTarget.height / 2, { steps: 8 });
    await page.mouse.up();
    await sleep(110);
    shots.push({ state: 'wrong-return', screenshot: await capture(page, `${viewportName}-${stageName}-wrong-return`), inspect: await inspect(page) });
    await sleep(1050);
  }

  const start = await pointFor(page, correctName);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await sleep(80);
  shots.push({ state: 'grabbed', screenshot: await capture(page, `${viewportName}-${stageName}-grabbed`), inspect: await inspect(page) });
  await page.mouse.move(start.x - 42, start.y - 38, { steps: 6 });
  await sleep(80);
  shots.push({ state: 'dragging', screenshot: await capture(page, `${viewportName}-${stageName}-dragging`), inspect: await inspect(page) });
  const current = await inspect(page);
  const target = current.target.acceptance;
  const targetPoint = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 8 });
  await sleep(90);
  shots.push({ state: 'over-target', screenshot: await capture(page, `${viewportName}-${stageName}-over-target`), inspect: await inspect(page) });
  await page.mouse.up();
  await sleep(390);
  shots.push({ state: 'correct-snap', screenshot: await capture(page, `${viewportName}-${stageName}-correct-snap`), inspect: await inspect(page) });
  await sleep(900);
  return shots;
}

async function advanceTo(page, stage) {
  while ((await inspect(page)).stage !== stage) {
    const state = await inspect(page);
    const correct = state.stage === 'BRIDGE' ? 'mission9-choice-bridge-correct'
      : state.stage === 'GATE' ? 'mission9-choice-gate-correct'
        : 'mission9-choice-power-correct';
    const start = await pointFor(page, correct);
    const target = state.target.acceptance;
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await page.mouse.up();
    await sleep(1200);
  }
}

async function runViewport(browser, width, height) {
  const viewportName = `${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  const bridgeWrong = 'mission9-choice-bridge-wrong-arc';
  const gateWrong = 'mission9-choice-gate-wrong-1';
  const powerWrong = 'mission9-choice-power-wrong-1';
  const bridge = await dragSequence(page, viewportName, 'bridge', bridgeWrong, 'mission9-choice-bridge-correct');
  await advanceTo(page, 'GATE');
  const gate = await dragSequence(page, viewportName, 'gate', gateWrong, 'mission9-choice-gate-correct');
  await advanceTo(page, 'POWER');
  const power = await dragSequence(page, viewportName, 'power', powerWrong, 'mission9-choice-power-correct');
  const final = await inspect(page);
  await context.close();
  return { viewport: viewportName, shots: [...bridge, ...gate, ...power], final, errors, clean: cleanRuntimeErrors(errors) };
}

async function runOrientation(browser, width, height, reducedMotion) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  const state = await inspect(page);
  const screenshot = await capture(page, `${width}x${height}-orientation${reducedMotion ? '-reduced-motion' : ''}`);
  await context.close();
  return { viewport: `${width}x${height}`, reducedMotion, state, screenshot, errors, clean: cleanRuntimeErrors(errors) };
}

function evaluate(results, orientation, orientationReduced) {
  const allShots = results.flatMap((result) => result.shots);
  const idleShots = allShots.filter((shot) => shot.state === 'idle');
  const grabbedShots = allShots.filter((shot) => shot.state === 'grabbed');
  const draggingShots = allShots.filter((shot) => shot.state === 'dragging');
  const overShots = allShots.filter((shot) => shot.state === 'over-target');
  const wrongShots = allShots.filter((shot) => shot.state === 'wrong-return');
  const snapShots = allShots.filter((shot) => shot.state === 'correct-snap');
  const allRuntimeClean = results.every((result) => result.clean) && orientation.every((entry) => entry.clean) && orientationReduced.clean;
  return {
    titleStyle: idleShots.every((shot) => shot.inspect.title.color === '#f7fdff' && Number(shot.inspect.title.strokeThickness) >= 5),
    titleContrast: idleShots.every((shot) => !/#fff4b8/i.test(shot.inspect.title.color || '') && shot.inspect.title.stroke === '#06243b'),
    dragThreshold: results.every((result) => result.final.dragThreshold === 6),
    pointerDownFeedback: grabbedShots.every((shot) => shot.inspect.interactionState === 'GRABBED' && shot.inspect.actions.some((action) => action.scaleX >= 1.08 && action.depth >= 42)),
    pointerOffset: draggingShots.every((shot) => ['DRAGGING', 'OVER_TARGET'].includes(shot.inspect.interactionState) && shot.inspect.actions.some((action) => action.scaleX >= 1.08 && action.depth >= 42)),
    targetHighlight: overShots.every((shot) => shot.inspect.interactionState === 'OVER_TARGET'),
    wrongDropFeedback: wrongShots.every((shot) => shot.inspect.labels.some((text) => /НЕ ПОДХОДИТ|НЕ ТОТ КЛЮЧ/.test(text)) || shot.inspect.interactionState === 'RETURNING'),
    correctSnapFeedback: snapShots.every((shot) => shot.inspect.interactionState === 'SNAPPING' || shot.inspect.interactionState === 'LOCKED'),
    candidateHitAreas: idleShots.every((shot) => shot.inspect.actions.every((action) => action.hit && action.bounds && action.hit.width >= action.bounds.width && action.hit.height >= action.bounds.height && action.hit.width >= 56 && action.hit.height >= 56)),
    hitAreaOverlap: idleShots.every((shot) => {
      const bounds = shot.inspect.actions.map((action) => action.bounds);
      return !bounds.some((a, index) => bounds.some((b, other) => other > index && a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y));
    }),
    browserGestureConflict: results.every((result) => result.final.touchAction === 'none'),
    orientationStyle: orientation.every((entry) => entry.state.orientation.gate && entry.state.orientation.icon && entry.state.orientation.helper && !entry.state.orientation.oldCopy),
    orientationAnimation: orientation.every((entry) => entry.state.orientation.animated === true),
    reducedMotion: orientationReduced.state.orientation.reducedMotion === true && orientationReduced.state.orientation.animated === false,
    runtimeClean: allRuntimeClean,
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  const results = [];
  results.push(await runViewport(browser, 844, 390));
  results.push(await runViewport(browser, 915, 412));
  const orientation = [await runOrientation(browser, 390, 844, false), await runOrientation(browser, 412, 915, false)];
  const orientationReduced = await runOrientation(browser, 390, 844, true);
  await browser.close();
  const evaluation = evaluate(results, orientation, orientationReduced);
  const failures = Object.entries(evaluation).filter(([, ok]) => !ok).map(([key]) => key);
  const report = {
    result: failures.length ? 'FAIL' : 'READY_FOR_PHYSICAL_SAMSUNG_REVIEW',
    evaluation,
    bounds: Object.fromEntries(results.map((result) => [result.viewport, {
      bridge: result.shots.find((shot) => shot.state === 'idle' && shot.inspect.stage === 'BRIDGE')?.inspect.target,
      gate: result.shots.find((shot) => shot.state === 'idle' && shot.inspect.stage === 'GATE')?.inspect.target,
      power: result.shots.find((shot) => shot.state === 'idle' && shot.inspect.stage === 'POWER')?.inspect.target,
    }])),
    screenshots: results.flatMap((result) => result.shots.map((shot) => shot.screenshot)).concat(orientation.map((entry) => entry.screenshot), orientationReduced.screenshot),
    results,
    orientation,
    orientationReduced,
    failures,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ result: report.result, evaluation, bounds: report.bounds, screenshotCount: report.screenshots.length, failures }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});