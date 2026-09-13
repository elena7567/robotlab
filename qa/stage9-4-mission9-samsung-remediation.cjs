const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage9-4-mission9-samsung-remediation.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assetFamilies = {
  BRIDGE: ['MISSION9_BRIDGE_CORRECT', 'MISSION9_BRIDGE_WRONG_ARC', 'MISSION9_BRIDGE_WRONG_TRUSS'],
  GATE: ['MISSION9_GATE_KEY_CORRECT', 'MISSION9_GATE_KEY_WRONG_1', 'MISSION9_GATE_KEY_WRONG_2'],
  POWER: ['MISSION9_ENERGY_CORRECT', 'MISSION9_ENERGY_WRONG_1', 'MISSION9_ENERGY_WRONG_2'],
};

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

const clean = (errors) => Object.values(errors).every((entries) => entries.length === 0);
const resetErrors = (errors) => {
  errors.console.length = 0;
  errors.page.length = 0;
  errors.requests.length = 0;
  errors.responses.length = 0;
};
const cleanRuntimeErrors = (errors) => errors.console.length === 0
  && errors.requests.length === 0
  && errors.responses.length === 0
  && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;
const overlaps = (a, b) => Boolean(a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y);

async function openMission9(page) {
  let ready = false;
  let lastError = null;
  for (let attempt = 0; attempt < 3 && !ready; attempt += 1) {
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__
        && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_BRIDGE_CORRECT')
        && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_GATE_KEY_CORRECT')
        && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_ENERGY_CORRECT'), null, { timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      ready = true;
    } catch (error) {
      lastError = error;
      await sleep(600);
    }
  }
  if (!ready) throw lastError || new Error('Mission 9 did not boot');
  await page.evaluate(() => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission9Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene'));
  await sleep(260);
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

async function tap(page, name, touch, settle = 220) {
  const point = await pointFor(page, name);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(settle);
}

async function dragTo(page, name, point, settle = 420) {
  const start = await pointFor(page, name);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 9 });
  await page.mouse.up();
  await sleep(settle);
}

async function dragOutside(page, name) {
  const start = await pointFor(page, name);
  await dragTo(page, name, { x: Math.max(28, start.x - 245), y: start.y - 18 }, 320);
}

async function waitStage(page, stage) {
  await page.waitForFunction((expected) => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === expected, stage, { timeout: 7000 });
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
      if (!item) return null;
      const b = item.getBounds ? item.getBounds() : null;
      return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null;
    };
    const stage = window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage;
    const labels = all.filter((item) => typeof item?.text === 'string').map((item) => item.text);
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
    const targetCandidates = [
      find('mission9-bridge-gap-target'),
      find('mission9-gate-lock-panel'),
      find('mission9-power-station-inactive'),
      find('mission9-power-station-active'),
    ].filter(Boolean);
    const target = targetCandidates[0] || null;
    const status = bounds(find('mission9-status'));
    const title = bounds(find('mission9-feedback'));
    const robot = imageBounds(find('mission9-repaired-robot-image'));
    const targetVisible = imageBounds(target);
    const targetDrop = target?.getData?.('dropTargetBounds') || null;
    const choices = actions.map((action) => action.visible);
    const completionText = all
      .filter((item) => typeof item?.text === 'string' && ['TITLE', 'SUBTITLE'].includes(item.getData?.('completionRegion')))
      .map(bounds)
      .filter(Boolean);
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      layout: game.registry.get('responsiveLayout'),
      mechanic: window.__ROBOTLAB_QA__.robotTestCourse.snapshot,
      session: game.registry.get('sessionSnapshot'),
      labels,
      actions,
      bounds: {
        status,
        title,
        robot,
        targetVisible,
        targetDrop,
        world: bounds(find('mission9-course-world')),
        controls: bounds(find('mission9-choice-bridge-correct')) || bounds(find('mission9-choice-gate-correct')) || bounds(find('mission9-choice-power-correct')),
        orientationGate: bounds(find('mission9-orientation-gate')),
        completion: bounds(find('mission9-completion')),
        completionRobot: imageBounds(find('mission9-completion-robot')),
        completionText,
        homeFinal: bounds(find('mission9-home-final')),
      },
      flags: {
        hasOrientationGate: Boolean(find('mission9-orientation-gate')),
        hasGameplayWorld: Boolean(find('mission9-course-world')),
        hasCompletion: Boolean(find('mission9-completion')),
        hasMission10Button: Boolean(find('mission9-continue')),
        hasHomeFinal: Boolean(find('mission9-home-final')),
        progressDots: all.filter((item) => item?.name?.startsWith('mission9-progress-dot-')).length,
        statusHasPanelGraphic: all.some((item) => item?.name === 'mission9-status-panel-background'),
      },
      overlap: {
        statusRobot: false,
        titleStatus: false,
        robotTarget: false,
        completionRobotText: false,
        choiceZones: choices.some((choice, index) => choices.some((other, otherIndex) => otherIndex > index
          && choice && other
          && choice.x < other.x + other.width && choice.x + choice.width > other.x
          && choice.y < other.y + other.height && choice.y + choice.height > other.y)),
      },
    };
  });
}

function addOverlapChecks(state) {
  state.overlap.statusRobot = overlaps(state.bounds.status, state.bounds.robot);
  state.overlap.titleStatus = overlaps(state.bounds.title, state.bounds.status);
  state.overlap.robotTarget = overlaps(state.bounds.robot, state.bounds.targetVisible);
  state.overlap.completionRobotText = (state.bounds.completionText || []).some((textBounds) => overlaps(textBounds, state.bounds.completionRobot));
  return state;
}

async function capture(page, name) {
  const file = path.join(screenshotDir, `stage9-4-mission9-${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

async function captureFlowState(browser, width, height, stageName) {
  const touch = width < 1100;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: width < 1000, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  resetErrors(errors);
  if (stageName === 'gate') {
    const bridge = addOverlapChecks(await inspect(page));
    await dragTo(page, 'mission9-choice-bridge-correct', {
      x: bridge.bounds.targetDrop.x + bridge.bounds.targetDrop.width / 2,
      y: bridge.bounds.targetDrop.y + bridge.bounds.targetDrop.height / 2,
    }, 900);
    await waitStage(page, 'GATE');
  } else if (stageName === 'power' || stageName === 'completion') {
    const bridge = addOverlapChecks(await inspect(page));
    await dragTo(page, 'mission9-choice-bridge-correct', {
      x: bridge.bounds.targetDrop.x + bridge.bounds.targetDrop.width / 2,
      y: bridge.bounds.targetDrop.y + bridge.bounds.targetDrop.height / 2,
    }, 900);
    await waitStage(page, 'GATE');
    const gate = addOverlapChecks(await inspect(page));
    await dragTo(page, 'mission9-choice-gate-correct', {
      x: gate.bounds.targetDrop.x + gate.bounds.targetDrop.width / 2,
      y: gate.bounds.targetDrop.y + gate.bounds.targetDrop.height / 2,
    }, 900);
    await waitStage(page, 'POWER');
    if (stageName === 'completion') {
      const power = addOverlapChecks(await inspect(page));
      await dragTo(page, 'mission9-choice-power-correct', {
        x: power.bounds.targetDrop.x + power.bounds.targetDrop.width / 2,
        y: power.bounds.targetDrop.y + power.bounds.targetDrop.height / 2,
      }, 1100);
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-completion'), null, { timeout: 7000 });
    }
  }
  const state = addOverlapChecks(await inspect(page));
  const screenshot = await capture(page, `${width}x${height}-${stageName}`);
  await context.close();
  return { viewport: `${width}x${height}`, stageName, screenshot, state, errors, clean: cleanRuntimeErrors(errors) };
}

async function runFullInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  resetErrors(errors);

  await tap(page, 'mission9-choice-bridge-wrong-arc', true, 260);
  const bridgeWrong1 = addOverlapChecks(await inspect(page));
  await tap(page, 'mission9-choice-bridge-wrong-truss', true, 260);
  const bridgeWrong2 = addOverlapChecks(await inspect(page));
  await dragOutside(page, 'mission9-choice-bridge-correct');
  const bridgeOutside = addOverlapChecks(await inspect(page));
  await dragTo(page, 'mission9-choice-bridge-correct', {
    x: bridgeOutside.bounds.targetDrop.x + bridgeOutside.bounds.targetDrop.width / 2,
    y: bridgeOutside.bounds.targetDrop.y + bridgeOutside.bounds.targetDrop.height / 2,
  }, 900);
  await waitStage(page, 'GATE');

  await tap(page, 'mission9-choice-gate-wrong-1', true, 260);
  const gateWrong1 = addOverlapChecks(await inspect(page));
  await tap(page, 'mission9-choice-gate-wrong-2', true, 260);
  const gateWrong2 = addOverlapChecks(await inspect(page));
  const gate = addOverlapChecks(await inspect(page));
  await dragTo(page, 'mission9-choice-gate-correct', {
    x: gate.bounds.targetDrop.x + gate.bounds.targetDrop.width / 2,
    y: gate.bounds.targetDrop.y + gate.bounds.targetDrop.height / 2,
  }, 900);
  await waitStage(page, 'POWER');

  await tap(page, 'mission9-choice-power-wrong-1', true, 260);
  const powerWrong1 = addOverlapChecks(await inspect(page));
  await tap(page, 'mission9-choice-power-wrong-2', true, 260);
  const powerWrong2 = addOverlapChecks(await inspect(page));
  const power = addOverlapChecks(await inspect(page));
  await dragTo(page, 'mission9-choice-power-correct', {
    x: power.bounds.targetDrop.x + power.bounds.targetDrop.width / 2,
    y: power.bounds.targetDrop.y + power.bounds.targetDrop.height / 2,
  }, 1100);
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.completed === true, null, { timeout: 7000 });
  const complete = addOverlapChecks(await inspect(page));
  await context.close();

  return {
    checks: {
      wrongBridge1: bridgeWrong1.mechanic.courseStage === 'BRIDGE',
      wrongBridge2: bridgeWrong2.mechanic.courseStage === 'BRIDGE',
      bridgeOutside: bridgeOutside.mechanic.courseStage === 'BRIDGE',
      wrongGate1: gateWrong1.mechanic.courseStage === 'GATE',
      wrongGate2: gateWrong2.mechanic.courseStage === 'GATE',
      wrongPower1: powerWrong1.mechanic.courseStage === 'POWER',
      wrongPower2: powerWrong2.mechanic.courseStage === 'POWER',
      completion: complete.flags.hasCompletion && complete.flags.hasHomeFinal && !complete.flags.hasMission10Button,
      clean: cleanRuntimeErrors(errors),
    },
    states: { bridgeWrong1, bridgeWrong2, bridgeOutside, gateWrong1, gateWrong2, powerWrong1, powerWrong2, complete },
    errors,
  };
}

async function runPortraitGate(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await openMission9(page);
  resetErrors(errors);
  const state = addOverlapChecks(await inspect(page));
  const screenshot = await capture(page, '390x844-orientation-gate');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scale.width === 844 && window.__ROBOTLAB_GAME__.scale.height === 390, null, { timeout: 7000 });
  await sleep(360);
  const landscape = addOverlapChecks(await inspect(page));
  await context.close();
  return {
    screenshot,
    state,
    landscape,
    errors,
    checks: {
      gateVisible: state.flags.hasOrientationGate && !state.flags.hasGameplayWorld,
      stateRestoredLandscape: landscape.flags.hasGameplayWorld && landscape.mechanic.courseStage === 'BRIDGE',
      clean: cleanRuntimeErrors(errors),
    },
  };
}

function checkAssets() {
  const manifest = fs.readFileSync(path.join('src', 'game', 'assets', 'manifest.ts'), 'utf8');
  const scene = fs.readFileSync(path.join('src', 'game', 'scenes', 'Mission9Scene.ts'), 'utf8');
  const manifestChecks = {
    bridgeCorrect: /MISSION9_BRIDGE_CORRECT[\s\S]*mission9\/bridge\/bridge-piece-correct\.png/.test(manifest),
    gateCorrect: /MISSION9_GATE_KEY_CORRECT[\s\S]*mission9\/gate\/gate-key-correct\.png/.test(manifest),
    powerCorrect: /MISSION9_ENERGY_CORRECT[\s\S]*mission9\/power\/energy-module-correct\.png/.test(manifest),
  };
  const sceneChecks = {
    gateUsesOnlyGateChoiceKeys: /GATE:\s*\[\s*\{ action: 'gate-wrong-1', key: 'MISSION9_GATE_KEY_WRONG_1'[\s\S]*\{ action: 'gate-correct', key: 'MISSION9_GATE_KEY_CORRECT'[\s\S]*\],/.test(scene),
    powerUsesOnlyEnergyChoiceKeys: /POWER:\s*\[\s*\{ action: 'power-wrong-1', key: 'MISSION9_ENERGY_WRONG_1'[\s\S]*\{ action: 'power-wrong-2', key: 'MISSION9_ENERGY_WRONG_2'[\s\S]*\],/.test(scene),
    bridgeUsesOnlyBridgeChoiceKeys: /BRIDGE:\s*\[\s*\{ action: 'bridge-correct', key: 'MISSION9_BRIDGE_CORRECT'[\s\S]*\{ action: 'bridge-wrong-truss', key: 'MISSION9_BRIDGE_WRONG_TRUSS'[\s\S]*\],/.test(scene),
  };
  return { manifestChecks, sceneChecks, pass: Object.values(manifestChecks).every(Boolean) && Object.values(sceneChecks).every(Boolean) };
}

function evaluateStates(captures, interactions, portrait, staticAssets) {
  const allRuntimeStates = [...captures.map((entry) => entry.state), ...Object.values(interactions.states), portrait.state, portrait.landscape];
  const landscapeStates = allRuntimeStates.filter((state) => !state.flags.hasOrientationGate);
  const correctAssets = {
    bridge: 'MISSION9_BRIDGE_CORRECT / public/assets/missions/mission9/bridge/bridge-piece-correct.png',
    gate: 'MISSION9_GATE_KEY_CORRECT / public/assets/missions/mission9/gate/gate-key-correct.png',
    power: 'MISSION9_ENERGY_CORRECT / public/assets/missions/mission9/power/energy-module-correct.png',
  };
  const crossPuzzleAssetMixing = landscapeStates.every((state) => state.actions.every((action) => {
    const activeStage = state.mechanic.courseStage === 'COMPLETE'
      ? action.action.startsWith('power-') ? 'POWER' : state.mechanic.courseStage
      : state.mechanic.courseStage;
    const allowed = assetFamilies[activeStage] || [];
    return allowed.includes(action.assetKey);
  }));
  const hitAreas = landscapeStates.every((state) => state.actions.every((action) =>
    action.draggable && action.hit && action.visible
    && action.hit.width >= action.visible.width
    && action.hit.height >= action.visible.height
    && action.hit.width >= 56 && action.hit.height >= 56));
  const noChoiceOverlap = landscapeStates.every((state) => !state.overlap.choiceZones);
  const noRobotClueOverlap = landscapeStates.every((state) => !state.overlap.robotTarget);
  const noHudOverlap = landscapeStates.every((state) => !state.overlap.statusRobot && !state.overlap.titleStatus);
  const completion = captures.find((entry) => entry.stageName === 'completion');
  return {
    correctAssets,
    bounds: {
      bridge: captures.find((entry) => entry.stageName === 'bridge')?.state.bounds,
      gate: captures.find((entry) => entry.stageName === 'gate')?.state.bounds,
      power: captures.find((entry) => entry.stageName === 'power')?.state.bounds,
    },
    checks: {
      portraitGate: portrait.checks.gateVisible && portrait.checks.stateRestoredLandscape,
      progressHud: landscapeStates.every((state) => state.flags.progressDots === 3 && !state.flags.statusHasPanelGraphic),
      titleOverlap: noHudOverlap,
      crossPuzzleAssetMixing,
      hitAreas,
      noChoiceOverlap,
      noRobotClueOverlap,
      bottomSafeArea: landscapeStates.every((state) => state.actions.every((action) => action.visible && action.visible.y + action.visible.height <= state.viewport.height - 10)),
      completion: Boolean(completion?.state.flags.hasCompletion && completion.state.flags.hasHomeFinal && completion.state.bounds.completionRobot && !completion.state.flags.hasMission10Button && !completion.state.overlap.completionRobotText),
      phoneLandscape: captures.filter((entry) => ['844x390', '915x412'].includes(entry.viewport)).every((entry) => !entry.state.overlap.statusRobot && !entry.state.overlap.robotTarget),
      tablet: captures.some((entry) => entry.viewport === '1024x768' && !entry.state.overlap.statusRobot),
      desktop: captures.some((entry) => entry.viewport === '1280x720' && !entry.state.overlap.statusRobot),
      staticAssets: staticAssets.pass,
      interactions: Object.values(interactions.checks).every(Boolean),
    },
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  const captures = [];
  for (const viewport of [[844, 390], [915, 412]]) {
    for (const stage of ['bridge', 'gate', 'power', 'completion']) captures.push(await captureFlowState(browser, viewport[0], viewport[1], stage));
  }
  captures.push(await captureFlowState(browser, 1024, 768, 'bridge'));
  captures.push(await captureFlowState(browser, 1280, 720, 'bridge'));
  const interactions = await runFullInteraction(browser);
  const portrait = await runPortraitGate(browser);
  await browser.close();

  const staticAssets = checkAssets();
  const evaluation = evaluateStates(captures, interactions, portrait, staticAssets);
  const failures = [
    ...Object.entries(evaluation.checks).filter(([, ok]) => !ok).map(([key]) => `check:${key}`),
    ...captures.filter((entry) => !entry.clean).map((entry) => `runtime:${entry.viewport}:${entry.stageName}`),
    ...Object.entries(interactions.checks).filter(([, ok]) => !ok).map(([key]) => `interaction:${key}`),
    ...Object.entries(portrait.checks).filter(([, ok]) => !ok).map(([key]) => `portrait:${key}`),
  ];
  const report = {
    result: failures.length ? 'FAIL' : 'READY_FOR_PHYSICAL_SAMSUNG_REVIEW',
    captures,
    interactions,
    portrait,
    staticAssets,
    evaluation,
    randomization: 'NONE',
    failures,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    result: report.result,
    screenshots: captures.map(({ viewport, stageName, screenshot }) => ({ viewport, stageName, screenshot })).concat([{ viewport: '390x844', stageName: 'orientation-gate', screenshot: portrait.screenshot }]),
    checks: evaluation.checks,
    interactions: interactions.checks,
    failures,
  }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
