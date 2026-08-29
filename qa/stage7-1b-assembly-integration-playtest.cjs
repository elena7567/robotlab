const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const matrixViewports = [
  ['minimum-320x568', 320, 568, true],
  ['mobile-390x844', 390, 844, true],
  ['tablet-768x1024', 768, 1024, true],
  ['desktop-1280x720', 1280, 720, false],
  ['desktop-1438x914', 1438, 914, false],
];
const expectedParts = {
  0: [],
  1: ['body'],
  2: ['body', 'head'],
  3: ['body', 'head', 'legLeft', 'legRight'],
  4: ['body', 'head', 'legLeft', 'legRight', 'armLeft', 'armRight'],
  5: ['body', 'head', 'legLeft', 'legRight', 'armLeft', 'armRight', 'antenna'],
};
const helperMessages = {
  1: 'ОТЛИЧНО! ЕСТЬ КОРПУС!',
  2: 'ТЕПЕРЬ ГОЛОВА!',
  3: 'ОН УЖЕ МОЖЕТ СТОЯТЬ!',
  4: 'ПОЧТИ ГОТОВО!',
  5: 'УРА! ОН РАБОТАЕТ!',
};

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

async function pointFor(page, name, sceneKey = 'GameScene') {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const find = (item) => {
      if (item?.name === name || item?.text === name) return item;
      if (item?.list) {
        for (const child of item.list) {
          const found = find(child);
          if (found) return found;
        }
      }
      return null;
    };
    const target = scene.children.list.map(find).find(Boolean);
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, touch = false, sceneKey = 'GameScene', settleMs = 90) {
  const point = await pointFor(page, name, sceneKey);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await sleep(settleMs);
}

async function installAudioProbe(page) {
  await page.evaluate(() => {
    const sound = window.__ROBOTLAB_GAME__.sound;
    window.__ROBOTLAB_AUDIO_EVENTS__ = [];
    const original = sound.play.bind(sound);
    sound.play = (key, config) => {
      window.__ROBOTLAB_AUDIO_EVENTS__.push({ key, muted: sound.mute });
      return original(key, config);
    };
  });
}

async function waitForTask(page, taskNumber) {
  await page.waitForFunction((task) => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene('GameScene');
    const card = scene?.children.getByName('task-card') || scene?.children.getByName('memory-task-card');
    return card?.list.some((item) => item.text === `ЗАДАНИЕ ${task} ИЗ 5`);
  }, taskNumber);
}

async function selectAndCheck(page, key, touch, settleMs = 120) {
  await activate(page, `choice-${key}`, touch);
  await activate(page, 'check-button', touch, 'GameScene', settleMs);
}

async function snapshotGame(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('GameScene');
    const panel = scene.children.getByName('progress-panel');
    const assembly = panel?.getByName('assembly-progress-layer')?.getByName('assembly-progress-robot');
    const task = scene.children.getByName('task-card') || scene.children.getByName('memory-task-card');
    const helper = scene.children.getByName('logical-actors')?.getByName('grounded-robot');
    const released = scene.children.getByName('logical-actors')?.getByName('released-assembled-robot');
    const dialogue = scene.children.getByName('robot-dialogue');
    const bounds = (item) => {
      if (!item) return null;
      const b = item.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
    };
    return {
      session: game.registry.get('sessionSnapshot'),
      panelProgress: panel?.getData('assemblyProgress'),
      animationActive: panel?.getData('animationActive'),
      installingProgress: panel?.getData('installingProgress'),
      label: panel?.getByName('assembly-progress-layer')?.getByName('assembly-progress-label')?.text,
      assemblyState: assembly?.getData('assemblyState'),
      installedParts: assembly?.getData('installedParts') || [],
      activationActive: assembly?.getData('activationActive') || false,
      blueprintAlphas: assembly?.list.filter((part) => part.name.startsWith('assembly-blueprint-')).map((part) => part.alpha) || [],
      panelBounds: panel ? {
        x: panel.x, y: panel.y,
        width: panel.getData('panelWidth'), height: panel.getData('panelHeight'),
        right: panel.x + panel.getData('panelWidth'), bottom: panel.y + panel.getData('panelHeight'),
      } : null,
      taskBounds: bounds(task),
      helperBounds: bounds(helper),
      releasedBounds: bounds(released),
      released: released?.getData('released') || false,
      releasedFeetY: released?.getData('robotFeetContactY'),
      stationReleased: panel?.getData('released') || false,
      panelVisible: panel?.visible ?? false,
      dialogue: dialogue?.visible ? dialogue.getByName('robot-dialogue-text')?.text : null,
      helperVisible: Boolean(helper?.visible && helper?.active),
      audio: [...(window.__ROBOTLAB_AUDIO_EVENTS__ || [])],
      viewport: { width: game.canvas.width, height: game.canvas.height },
    };
  });
}

function inside(bounds, width, height) {
  return bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.right <= width + 1 && bounds.bottom <= height + 1;
}

function noOverlap(a, b) {
  return !a || !b || a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y;
}

async function waitForRewardStart(page, progress) {
  await page.waitForFunction((value) => {
    const panel = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('progress-panel');
    return panel?.getData('animationActive') && panel?.getData('installingProgress') === value;
  }, progress);
}

async function waitForRewardEnd(page, progress) {
  await page.waitForFunction((value) => {
    const panel = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('progress-panel');
    const assembly = panel?.getByName('assembly-progress-layer')?.getByName('assembly-progress-robot');
    return panel?.getData('assemblyProgress') === value && panel?.getData('animationActive') === false
      && assembly?.getData('assemblyState') === value;
  }, progress);
}

async function waitForContinue(page) {
  await page.waitForFunction(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    return card?.getByName('continue-button')?.visible && card?.getByName('continue-button')?.active;
  });
}

async function completeTaskReward(page, key, touch, progress, captureName) {
  await selectAndCheck(page, key, touch);
  await waitForRewardStart(page, progress);
  const during = await snapshotGame(page);
  await waitForRewardEnd(page, progress);
  const settled = await snapshotGame(page);
  if (captureName) await page.screenshot({ path: path.join(screenshotDir, captureName) });
  return { during, settled };
}

async function completeNormalFlow(page, touch, screenshotPrefix, captureAllStates) {
  await activate(page, 'Играть', touch, 'StartScene', 120);
  await waitForTask(page, 1);
  const states = [await snapshotGame(page)];
  if (captureAllStates) await page.screenshot({ path: path.join(screenshotDir, `${screenshotPrefix}-assembly-0-of-5.png`) });

  const rewards = [];
  rewards.push(await completeTaskReward(page, 'odd-ball', touch, 1,
    captureAllStates ? `${screenshotPrefix}-assembly-1-of-5.png` : null));
  states.push(rewards.at(-1).settled);
  await waitForContinue(page);
  await activate(page, 'continue-button', touch);

  for (const [index, key] of ['sequence-star', 'sequence-planet', 'sequence-planet'].entries()) {
    await waitForTask(page, 2);
    await selectAndCheck(page, key, touch);
    if (index < 2) {
      await waitForContinue(page);
      await activate(page, 'continue-button', touch);
    }
  }
  await waitForRewardStart(page, 2);
  const reward2During = await snapshotGame(page);
  await waitForRewardEnd(page, 2);
  const reward2Settled = await snapshotGame(page);
  rewards.push({ during: reward2During, settled: reward2Settled });
  states.push(reward2Settled);
  if (captureAllStates) await page.screenshot({ path: path.join(screenshotDir, `${screenshotPrefix}-assembly-2-of-5.png`) });
  await waitForContinue(page);
  await activate(page, 'continue-button', touch);

  for (const [index, key] of ['size-large', 'size-small', 'size-medium'].entries()) {
    await waitForTask(page, 3);
    await selectAndCheck(page, key, touch);
    if (index < 2) {
      await waitForContinue(page);
      await activate(page, 'continue-button', touch);
    }
  }
  await waitForRewardStart(page, 3);
  const reward3During = await snapshotGame(page);
  await waitForRewardEnd(page, 3);
  const reward3Settled = await snapshotGame(page);
  rewards.push({ during: reward3During, settled: reward3Settled });
  states.push(reward3Settled);
  if (captureAllStates) await page.screenshot({ path: path.join(screenshotDir, `${screenshotPrefix}-assembly-3-of-5.png`) });
  await waitForContinue(page);
  await activate(page, 'continue-button', touch);

  await waitForTask(page, 4);
  for (let challenge = 0; challenge < 3; challenge += 1) {
    const correct = await page.evaluate(() => {
      const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
      return [...card.configuredHintKeys][0];
    });
    await selectAndCheck(page, correct, touch);
    if (challenge < 2) {
      await waitForContinue(page);
      await activate(page, 'continue-button', touch);
    }
  }
  await waitForRewardStart(page, 4);
  const reward4During = await snapshotGame(page);
  await waitForTask(page, 5);
  const reward4Settled = await snapshotGame(page);
  rewards.push({ during: reward4During, settled: reward4Settled });
  states.push(reward4Settled);
  if (captureAllStates) await page.screenshot({ path: path.join(screenshotDir, `${screenshotPrefix}-assembly-4-of-5.png`) });

  const order = await page.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('memory-task-card');
    return [...card.cardViews.keys()];
  });
  const groups = [...new Set(order.map((id) => id.replace(/-[01]$/, '')))]
    .map((pairId) => order.filter((id) => id.replace(/-[01]$/, '') === pairId));
  for (const group of groups) {
    await activate(page, `memory-card-${group[0]}`, touch, 'GameScene', 50);
    await activate(page, `memory-card-${group[1]}`, touch, 'GameScene', 520);
  }
  await waitForRewardStart(page, 5);
  const reward5During = await snapshotGame(page);
  await page.waitForFunction(() => {
    const panel = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('progress-panel');
    const assembly = panel?.getByName('assembly-progress-layer')?.getByName('assembly-progress-robot');
    return assembly?.getData('assemblyState') === 5 && assembly?.getData('activationActive') === true;
  });
  const activation = await snapshotGame(page);
  await page.screenshot({ path: path.join(screenshotDir, `${screenshotPrefix}-activation-5-of-5.png`) });
  states.push(activation);
  rewards.push({ during: reward5During, settled: activation });
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const panel = scene.children.getByName('progress-panel');
    const released = scene.children.getByName('logical-actors')?.getByName('released-assembled-robot');
    return panel?.getData('released') === true && released?.getData('released') === true;
  });
  const released = await snapshotGame(page);
  await page.screenshot({ path: path.join(screenshotDir, `${screenshotPrefix}-final-released.png`) });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('VictoryScene'));
  await sleep(850);
  await page.screenshot({ path: path.join(screenshotDir, `${screenshotPrefix}-victory-two-robots.png`) });
  return { states, rewards, activation, released };
}

async function snapshotVictory(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('VictoryScene');
    const helper = scene.children.getByName('victory-robot');
    const repaired = scene.children.getByName('victory-assembled-robot');
    const background = scene.children.getByName('victory-background');
    const bounds = (item) => {
      const b = item?.getBounds();
      return b ? { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom } : null;
    };
    return {
      helperBounds: bounds(helper), repairedBounds: bounds(repaired),
      helperRole: helper?.getData('role'), repairedRole: repaired?.getData('role'),
      helperFeetY: helper?.getData('robotFeetContactY'), repairedFeetY: repaired?.getData('robotFeetContactY'),
      platformY: background?.getData('platformContactY'),
      titleBounds: bounds(scene.children.getByName('victory-title')),
      subtitleBounds: bounds(scene.children.getByName('victory-subtitle')),
      playBounds: bounds(scene.children.getByName('victory-play-again')),
      homeBounds: bounds(scene.children.getByName('victory-home')),
      repairedParts: repaired?.getData('installedParts') || [],
    };
  });
}

async function runMatrix(browser, viewport) {
  const [name, width, height, touch] = viewport;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await activate(page, 'Играть', touch, 'StartScene', 140);
  await waitForTask(page, 1);
  const state = await snapshotGame(page);
  const checks = {
    canonicalSync: state.session.completedTasks === 0 && state.session.assemblyProgress === 0 && state.panelProgress === 0,
    compactPreview: state.label === 'СБОРКА 0/5' && state.installedParts.length === 0 && state.blueprintAlphas.every((alpha) => alpha <= 0.06),
    inViewport: inside(state.panelBounds, width, height) && inside(state.taskBounds, width, height) && inside(state.helperBounds, width, height),
    noTaskOverlap: noOverlap(state.panelBounds, state.taskBounds) && noOverlap(state.helperBounds, state.taskBounds),
    helperVisible: state.helperVisible,
    viewport: state.viewport.width === width && state.viewport.height === height,
    errors: Object.values(errors).every((items) => items.length === 0),
  };
  await context.close();
  return { name, width, height, state, checks, errors };
}

async function runFullFlow(browser, name, width, height, touch, captureAllStates) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await installAudioProbe(page);
  const flow = await completeNormalFlow(page, touch, `stage7-1b2-${name}`, captureAllStates);
  const victory = await snapshotVictory(page);
  const audio = flow.activation.audio;
  const repairAudioCount = audio.filter((event) => event.key === 'audio-repair-reward').length;
  const stateChecks = flow.states.map((state, progress) => ({
    progress,
    canonicalSync: state.session.completedTasks === progress && state.session.assemblyProgress === progress,
    panelSync: state.panelProgress === progress || (progress === 5 && state.assemblyState === 5),
    parts: JSON.stringify([...state.installedParts].sort()) === JSON.stringify([...expectedParts[progress]].sort()),
  }));
  const rewardChecks = flow.rewards.map((reward, index) => ({
    progress: index + 1,
    animationObserved: reward.during.animationActive && reward.during.installingProgress === index + 1,
    helperDialogue: reward.during.dialogue === helperMessages[index + 1],
  }));
  const checks = {
    stateProgression: stateChecks.every((entry) => entry.canonicalSync && entry.panelSync && entry.parts),
    installAnimations: rewardChecks.every((entry) => entry.animationObserved),
    helperReactions: rewardChecks.every((entry) => entry.helperDialogue),
    activation: flow.activation.activationActive && flow.activation.assemblyState === 5,
    finalRelease: flow.released.released && flow.released.stationReleased && !flow.released.panelVisible
      && inside(flow.released.releasedBounds, width, height)
      && noOverlap(flow.released.helperBounds, flow.released.releasedBounds),
    finalGrounding: flow.released.releasedFeetY === 560,
    audioExactlyOncePerTask: repairAudioCount === 5,
    victoryTwoRobots: victory.helperRole === 'helper' && victory.repairedRole === 'repaired'
      && JSON.stringify([...victory.repairedParts].sort()) === JSON.stringify([...expectedParts[5]].sort())
      && victory.helperBounds.right - victory.helperBounds.width / 2 < victory.repairedBounds.right - victory.repairedBounds.width / 2,
    victoryGrounding: victory.helperFeetY === victory.platformY && victory.repairedFeetY === victory.platformY,
    victoryResponsive: [victory.helperBounds, victory.repairedBounds, victory.titleBounds, victory.subtitleBounds,
      victory.playBounds, victory.homeBounds].every((b) => inside(b, width, height)),
    errors: Object.values(errors).every((items) => items.length === 0),
  };

  if (name === 'desktop-1280x720') {
    await activate(page, 'victory-play-again', false, 'VictoryScene', 160);
    await waitForTask(page, 1);
    const reset = await snapshotGame(page);
    checks.playAgainReset = reset.session.completedTasks === 0 && reset.session.assemblyProgress === 0
      && reset.panelProgress === 0 && reset.installedParts.length === 0 && !reset.animationActive;
    await activate(page, '⌂ Домой', false, 'GameScene', 160);
    checks.home = await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
    await activate(page, 'Играть', false, 'StartScene', 120);
    await waitForTask(page, 1);
    await selectAndCheck(page, 'odd-ball', false);
    await waitForRewardStart(page, 1);
    await activate(page, '⌂ Домой', false, 'GameScene', 160);
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
    await sleep(850);
    await activate(page, 'Играть', false, 'StartScene', 120);
    await waitForTask(page, 1);
    const interruptedReset = await snapshotGame(page);
    checks.homeDuringReward = interruptedReset.session.completedTasks === 0
      && interruptedReset.session.assemblyProgress === 0 && interruptedReset.installedParts.length === 0
      && !interruptedReset.animationActive;
  }
  await context.close();
  return { name, width, height, stateChecks, rewardChecks, repairAudioCount, victory, checks, errors };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const matrix = [];
  for (const viewport of matrixViewports) matrix.push(await runMatrix(browser, viewport));
  const flows = [
    await runFullFlow(browser, 'desktop-1280x720', 1280, 720, false, true),
    await runFullFlow(browser, 'mobile-390x844', 390, 844, true, true),
  ];
  await browser.close();
  const failures = [
    ...matrix.flatMap((entry) => Object.entries(entry.checks).filter(([, pass]) => !pass).map(([check]) => `${entry.name}:${check}`)),
    ...flows.flatMap((entry) => Object.entries(entry.checks).filter(([, pass]) => !pass).map(([check]) => `${entry.name}:${check}`)),
  ];
  const report = { matrix, flows, failures };
  fs.writeFileSync(path.join('docs', 'qa', 'stage7-1b2-assembly-release-results.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join('docs', 'qa', 'stage7-1b-assembly-integration-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({
    matrix: matrix.map(({ name, checks }) => ({ name, checks })),
    flows: flows.map(({ name, checks, repairAudioCount }) => ({ name, checks, repairAudioCount })),
    failures,
  }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
