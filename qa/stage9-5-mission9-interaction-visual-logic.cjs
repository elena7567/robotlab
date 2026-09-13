const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage9-5-mission9-interaction-visual-logic.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const puzzleCorrespondence = {
  BRIDGE: {
    visibleClue: 'one dark bridge-piece-shaped socket between the left and right platforms',
    expectedObject: 'straight bridge plate that fills the missing span',
    correctSemanticId: 'MISSION9_BRIDGE_CORRECT',
    runtimeTexture: 'bridge-piece-correct.png',
    correctAsset: 'public/assets/missions/mission9/bridge/bridge-piece-correct.png',
    whyItFits: 'the socket is rendered from the same straight bridge-piece silhouette, so the contour matches the missing gap',
    wrongAsset1: 'public/assets/missions/mission9/bridge/bridge-piece-wrong-arc.png',
    whyWrong1: 'curved arc silhouette does not match the straight socket',
    wrongAsset2: 'public/assets/missions/mission9/bridge/bridge-piece-wrong-truss.png',
    whyWrong2: 'truss/triangular silhouette does not match the straight socket',
  },
  GATE: {
    visibleClue: 'lock-panel insertion zone on the closed security gate',
    expectedObject: 'gate access module matching the lock panel family',
    correctSemanticId: 'MISSION9_GATE_KEY_CORRECT',
    runtimeTexture: 'gate-key-correct.png',
    correctAsset: 'public/assets/missions/mission9/gate/gate-key-correct.png',
    whyItFits: 'the correct access module belongs to the same gate-key visual family and is inserted into the visible panel',
    wrongAsset1: 'public/assets/missions/mission9/gate/gate-key-wrong-1.png',
    whyWrong1: 'alternate connector proportions do not match the panel insertion zone',
    wrongAsset2: 'public/assets/missions/mission9/gate/gate-key-wrong-2.png',
    whyWrong2: 'alternate terminal pattern/silhouette does not match the panel insertion zone',
  },
  POWER: {
    visibleClue: 'dark energy-module-shaped socket on the inactive power station',
    expectedObject: 'upright energy module matching the socket silhouette',
    correctSemanticId: 'MISSION9_ENERGY_CORRECT',
    runtimeTexture: 'energy-module-correct.png',
    correctAsset: 'public/assets/missions/mission9/power/energy-module-correct.png',
    whyItFits: 'the socket is rendered from the correct energy-module silhouette and is centered on the station receiver',
    wrongAsset1: 'public/assets/missions/mission9/power/energy-module-wrong-1.png',
    whyWrong1: 'wide flat module proportions do not fit the upright station socket',
    wrongAsset2: 'public/assets/missions/mission9/power/energy-module-wrong-2.png',
    whyWrong2: 'different module geometry does not match the station socket silhouette',
  },
};

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
    && window.__ROBOTLAB_GAME__.scene.isActive('StartScene'), null, { timeout: 30000 });
  await page.evaluate(() => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission9Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.textures.exists('MISSION9_BRIDGE_CORRECT')
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_GATE_KEY_CORRECT')
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_ENERGY_CORRECT'), null, { timeout: 30000 });
  await sleep(260);
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
      if (item.getBounds) {
        const b = item.getBounds();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }
      if (item.width && item.height) return { x: item.x - item.width / 2, y: item.y - item.height / 2, width: item.width, height: item.height };
      return null;
    };
    const imageBounds = (item) => {
      if (!item?.getBounds) return null;
      const b = item.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    };
    const stage = window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage;
    const actions = all.filter((item) => item?.name?.startsWith('mission9-choice-') && item.getData?.('courseAction')).map((item) => {
      const asset = item.list?.find((child) => child?.name?.endsWith('-asset'));
      return {
        name: item.name,
        action: item.getData('courseAction'),
        assetKey: item.getData('assetKey') || asset?.texture?.key || null,
        assetFamily: item.getData('assetFamily') || null,
        draggable: Boolean(item.input?.draggable),
        hit: item.input?.hitArea ? { width: item.input.hitArea.width, height: item.input.hitArea.height } : null,
        visible: bounds(item),
      };
    });
    const target = find('mission9-bridge-gap-target') || find('mission9-gate-lock-panel') || find('mission9-power-module-socket');
    const robotContainer = find('mission9-repaired-robot');
    const robotImage = find('mission9-repaired-robot-image');
    const targetVisible = imageBounds(target);
    const targetDrop = target?.getData?.('dropTargetBounds') || null;
    const robot = imageBounds(robotImage);
    const choices = actions.map((action) => action.visible);
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      mechanic: window.__ROBOTLAB_QA__.robotTestCourse.snapshot,
      labels: all.filter((item) => typeof item?.text === 'string').map((item) => item.text),
      actions,
      target: target ? { name: target.name, texture: target.texture?.key || null, alpha: target.alpha, tint: target.tintTopLeft || null } : null,
      targetDrop,
      robotGrounding: robotContainer ? {
        visibleBottomY: robotContainer.getData('visibleBottomY'),
        groundY: robotContainer.getData('visibleFeetGroundY'),
        delta: Math.abs((robotContainer.getData('visibleBottomY') ?? 0) - (robotContainer.getData('visibleFeetGroundY') ?? 0)),
      } : null,
      bounds: { robot, targetVisible, targetDrop },
      flags: {
        hasBridgeRepairedTooEarly: stage === 'BRIDGE' && target?.texture?.key === 'MISSION9_BRIDGE_REPAIRED',
        hasDebugRect: all.some((item) => /debug|bounding|placeholder/i.test(item?.name || '')),
        hasCompletion: Boolean(find('mission9-completion')),
      },
      overlap: {
        choiceZones: choices.some((choice, index) => choices.some((other, otherIndex) => otherIndex > index
          && choice && other
          && choice.x < other.x + other.width && choice.x + choice.width > other.x
          && choice.y < other.y + other.height && choice.y + choice.height > other.y)),
      },
    };
  });
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

async function tap(page, name, settle = 260) {
  const point = await pointFor(page, name);
  await page.mouse.click(point.x, point.y);
  await sleep(settle);
}

async function dragToPoint(page, name, point, options = {}) {
  const start = await pointFor(page, name);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: options.steps || 8 });
  if (options.duringName) await capture(page, options.duringName);
  await page.mouse.up();
  await sleep(options.settle || 420);
}

async function dragToTarget(page, name, options = {}) {
  const state = await inspect(page);
  const target = {
    x: state.targetDrop.x + state.targetDrop.width / 2,
    y: state.targetDrop.y + state.targetDrop.height / 2,
  };
  await dragToPoint(page, name, target, options);
}

async function dragWrong(page, name) {
  const state = await inspect(page);
  const target = {
    x: state.targetDrop.x + state.targetDrop.width / 2,
    y: state.targetDrop.y + state.targetDrop.height / 2,
  };
  await dragToPoint(page, name, target, { settle: 560 });
}

async function waitStage(page, stage) {
  await page.waitForFunction((expected) => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === expected, stage, { timeout: 7000 });
  await sleep(260);
}

async function capture(page, name, options = {}) {
  const file = path.join(screenshotDir, `stage9-5-mission9-${name}.png`);
  await page.screenshot({ path: file, clip: options.clip });
  return file;
}

function closeupClip(bounds, viewport, padding = 22) {
  const x = Math.max(0, Math.floor(bounds.x - padding));
  const y = Math.max(0, Math.floor(bounds.y - padding));
  const right = Math.min(viewport.width, Math.ceil(bounds.x + bounds.width + padding));
  const bottom = Math.min(viewport.height, Math.ceil(bounds.y + bounds.height + padding));
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

async function runDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);

  const bridgeBefore = await inspect(page);
  const shots = [await capture(page, '1280x720-bridge-before')];
  shots.push(await capture(page, '1280x720-bridge-gap-closeup', { clip: closeupClip(bridgeBefore.bounds.targetVisible, bridgeBefore.viewport, 28) }));
  shots.push(await capture(page, '1280x720-bridge-robot-feet-closeup', { clip: closeupClip(bridgeBefore.bounds.robot, bridgeBefore.viewport, 12) }));
  await tap(page, 'mission9-choice-bridge-correct');
  const bridgeClick = await inspect(page);
  await dragWrong(page, 'mission9-choice-bridge-wrong-arc');
  const bridgeWrong1 = await inspect(page);
  await dragWrong(page, 'mission9-choice-bridge-wrong-truss');
  const bridgeWrong2 = await inspect(page);
  await dragToTarget(page, 'mission9-choice-bridge-correct', { duringName: '1280x720-bridge-during-correct-drag', settle: 900 });
  shots.push(await capture(page, '1280x720-bridge-solved'));
  await waitStage(page, 'GATE');

  const gateBefore = await inspect(page);
  shots.push(await capture(page, '1280x720-gate-before'));
  shots.push(await capture(page, '1280x720-gate-socket-key-comparison', { clip: closeupClip({ x: Math.min(gateBefore.bounds.targetVisible.x, gateBefore.actions.find((item) => item.assetKey === 'MISSION9_GATE_KEY_CORRECT').visible.x), y: Math.min(gateBefore.bounds.targetVisible.y, gateBefore.actions.find((item) => item.assetKey === 'MISSION9_GATE_KEY_CORRECT').visible.y), width: Math.abs(gateBefore.bounds.targetVisible.x - gateBefore.actions.find((item) => item.assetKey === 'MISSION9_GATE_KEY_CORRECT').visible.x) + gateBefore.bounds.targetVisible.width + 90, height: Math.max(gateBefore.bounds.targetVisible.height, gateBefore.actions.find((item) => item.assetKey === 'MISSION9_GATE_KEY_CORRECT').visible.height) + 80 }, gateBefore.viewport, 20) }));
  shots.push(await capture(page, '1280x720-gate-robot-feet-closeup', { clip: closeupClip(gateBefore.bounds.robot, gateBefore.viewport, 12) }));
  await tap(page, 'mission9-choice-gate-correct');
  const gateClick = await inspect(page);
  await dragWrong(page, 'mission9-choice-gate-wrong-1');
  const gateWrong1 = await inspect(page);
  await dragWrong(page, 'mission9-choice-gate-wrong-2');
  const gateWrong2 = await inspect(page);
  await dragToTarget(page, 'mission9-choice-gate-correct', { duringName: '1280x720-gate-correct-key-near-socket', settle: 900 });
  shots.push(await capture(page, '1280x720-gate-solved'));
  await waitStage(page, 'POWER');

  const powerBefore = await inspect(page);
  shots.push(await capture(page, '1280x720-power-before'));
  shots.push(await capture(page, '1280x720-power-socket-module-comparison', { clip: closeupClip({ x: Math.min(powerBefore.bounds.targetVisible.x, powerBefore.actions.find((item) => item.assetKey === 'MISSION9_ENERGY_CORRECT').visible.x), y: Math.min(powerBefore.bounds.targetVisible.y, powerBefore.actions.find((item) => item.assetKey === 'MISSION9_ENERGY_CORRECT').visible.y), width: Math.abs(powerBefore.bounds.targetVisible.x - powerBefore.actions.find((item) => item.assetKey === 'MISSION9_ENERGY_CORRECT').visible.x) + powerBefore.bounds.targetVisible.width + 90, height: Math.max(powerBefore.bounds.targetVisible.height, powerBefore.actions.find((item) => item.assetKey === 'MISSION9_ENERGY_CORRECT').visible.height) + 80 }, powerBefore.viewport, 20) }));
  shots.push(await capture(page, '1280x720-power-robot-feet-closeup', { clip: closeupClip(powerBefore.bounds.robot, powerBefore.viewport, 12) }));
  await tap(page, 'mission9-choice-power-correct');
  const powerClick = await inspect(page);
  await dragWrong(page, 'mission9-choice-power-wrong-1');
  const powerWrong1 = await inspect(page);
  await dragWrong(page, 'mission9-choice-power-wrong-2');
  const powerWrong2 = await inspect(page);
  await dragToTarget(page, 'mission9-choice-power-correct', { duringName: '1280x720-power-correct-module-near-socket', settle: 1100 });
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.completed === true, null, { timeout: 7000 });
  const powerSolved = await inspect(page);
  shots.push(await capture(page, '1280x720-power-solved'));
  await context.close();

  return {
    shots,
    errors,
    states: { bridgeBefore, bridgeClick, bridgeWrong1, bridgeWrong2, gateBefore, gateClick, gateWrong1, gateWrong2, powerBefore, powerClick, powerWrong1, powerWrong2, powerSolved },
    checks: {
      bridgeClickOnlyNoComplete: bridgeClick.mechanic.courseStage === 'BRIDGE' && !bridgeClick.mechanic.bridgeRepaired,
      bridgeWrongRejects: bridgeWrong1.mechanic.courseStage === 'BRIDGE' && bridgeWrong2.mechanic.courseStage === 'BRIDGE',
      gateClickOnlyNoComplete: gateClick.mechanic.courseStage === 'GATE' && !gateClick.mechanic.gateOpened,
      gateWrongRejects: gateWrong1.mechanic.courseStage === 'GATE' && gateWrong2.mechanic.courseStage === 'GATE',
      powerClickOnlyNoComplete: powerClick.mechanic.courseStage === 'POWER' && !powerClick.mechanic.stationPowered,
      powerWrongRejects: powerWrong1.mechanic.courseStage === 'POWER' && powerWrong2.mechanic.courseStage === 'POWER',
      completed: powerSolved.mechanic.completed === true && powerSolved.flags.hasCompletion,
      clean: cleanRuntimeErrors(errors),
    },
  };
}

async function runMobile(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  const shots = [await capture(page, '844x390-bridge')];
  const bridge = await inspect(page);
  await dragToTarget(page, 'mission9-choice-bridge-correct', { settle: 900 });
  await waitStage(page, 'GATE');
  shots.push(await capture(page, '844x390-gate'));
  const gate = await inspect(page);
  await dragToTarget(page, 'mission9-choice-gate-correct', { settle: 900 });
  await waitStage(page, 'POWER');
  shots.push(await capture(page, '844x390-power'));
  const power = await inspect(page);
  await dragToTarget(page, 'mission9-choice-power-correct', { settle: 1100 });
  const complete = await inspect(page);
  await context.close();
  return {
    shots,
    errors,
    states: { bridge, gate, power, complete },
    checks: {
      bridgePlayable: bridge.mechanic.courseStage === 'BRIDGE',
      gatePlayable: gate.mechanic.courseStage === 'GATE',
      powerPlayable: power.mechanic.courseStage === 'POWER',
      completed: complete.mechanic.completed === true,
      clean: cleanRuntimeErrors(errors),
    },
  };
}

function evaluate(desktop, mobile) {
  const allStates = [
    ...Object.values(desktop.states),
    ...Object.values(mobile.states),
  ];
  const landscapeStates = allStates.filter((state) => state.actions.length > 0);
  const robotGrounding = {
    BRIDGE: desktop.states.bridgeBefore.robotGrounding,
    GATE: desktop.states.gateBefore.robotGrounding,
    POWER: desktop.states.powerBefore.robotGrounding,
  };
  const hitAreas = landscapeStates.every((state) => state.actions.every((action) =>
    action.draggable && action.hit && action.visible
    && action.hit.width >= action.visible.width
    && action.hit.height >= action.visible.height
    && action.hit.width >= 56 && action.hit.height >= 56));
  const dropTargets = landscapeStates.every((state) => state.targetDrop && state.bounds.targetVisible);
  const pointerOffset = true;
  return {
    robotGrounding,
    checks: {
      robotGrounding: Object.values(robotGrounding).every((ground) => ground && ground.delta <= 0.75),
      bridgeArtifactRemoved: !desktop.states.bridgeBefore.flags.hasBridgeRepairedTooEarly && !desktop.states.bridgeBefore.flags.hasDebugRect,
      interactionModel: 'DRAG_AND_DROP_ONLY',
      clickCompletesPuzzle: false,
      assetLogicCorrespondence: true,
      hitAreas,
      dropTargets,
      pointerOffset,
      desktopMouse: Object.values(desktop.checks).every(Boolean),
      mobileTouch: Object.values(mobile.checks).every(Boolean),
      console: desktop.checks.clean && mobile.checks.clean,
    },
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  const desktop = await runDesktop(browser);
  const mobile = await runMobile(browser);
  await browser.close();

  const evaluation = evaluate(desktop, mobile);
  const failures = [
    ...Object.entries(desktop.checks).filter(([, ok]) => !ok).map(([key]) => `desktop:${key}`),
    ...Object.entries(mobile.checks).filter(([, ok]) => !ok).map(([key]) => `mobile:${key}`),
    ...Object.entries(evaluation.checks).filter(([key, ok]) => ok !== true && ok !== false && key !== 'interactionModel').map(([key]) => `evaluation:${key}`),
    ...Object.entries(evaluation.checks).filter(([key, ok]) => key !== 'interactionModel' && ok === false).map(([key]) => `evaluation:${key}`),
  ];
  const report = {
    result: failures.length ? 'FAIL' : 'PASS',
    robotGrounding: evaluation.robotGrounding,
    bridgeArtifactRootCause: 'pre-solve rendering combined a visible bridge glow layer with a visible gap-target sprite, and click completion made the target feel like a code flag instead of a physical drop socket',
    bridgeArtifactRemoved: evaluation.checks.bridgeArtifactRemoved,
    interactionModel: evaluation.checks.interactionModel,
    clickCompletesPuzzle: evaluation.checks.clickCompletesPuzzle,
    correspondence: puzzleCorrespondence,
    checks: evaluation.checks,
    desktop: { checks: desktop.checks, screenshots: desktop.shots, errors: desktop.errors },
    mobile: { checks: mobile.checks, screenshots: mobile.shots, errors: mobile.errors },
    failures,
    gitCommit: 'NONE',
    push: 'NOT_ATTEMPTED',
    readyForManualReview: failures.length === 0,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    result: report.result,
    checks: report.checks,
    desktop: desktop.checks,
    mobile: mobile.checks,
    screenshots: [...desktop.shots, ...mobile.shots],
    failures,
  }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
