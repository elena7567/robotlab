const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage10-mission10-intro.json');
const viewports = [
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
  { width: 740, height: 360 },
  { width: 844, height: 390 },
  { width: 915, height: 412 },
];
const results = { result: 'FAIL', checks: [], screenshots: [], errors: [], viewports: [] };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, ok, actual) {
  results.checks.push({ name, ok, ...(actual === undefined ? {} : { actual }) });
}

function recordErrors(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') results.errors.push({ label, type: 'console', message: message.text() });
  });
  page.on('pageerror', (error) => results.errors.push({ label, type: 'page', message: error.stack || error.message }));
  page.on('requestfailed', (request) => results.errors.push({
    label, type: 'request', message: request.url() + ': ' + (request.failure()?.errorText || ''),
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) results.errors.push({ label, type: 'response', message: response.status() + ' ' + response.url() });
  });
}

async function openIntro(page) {
  const next = new URL(baseUrl);
  next.searchParams.set('qaMission', '10');
  await page.goto(next.toString(), { waitUntil: 'commit', timeout: 45000 });
  await page.waitForFunction(() => {
    const game = window.__ROBOTLAB_GAME__;
    return Boolean(game?.scene.isActive('Mission10Scene') && game.registry.get('mission10Snapshot')?.stage === 'INTRO');
  }, null, { timeout: 90000 });
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => {
      all.push(item);
      if (Array.isArray(item?.list)) item.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    const byName = (name) => all.find((item) => item?.name === name);
    const rect = (item) => {
      if (item?.input?.hitArea && item.width > 0 && item.height > 0) {
        return {
          x: item.x - item.width / 2,
          y: item.y - item.height / 2,
          width: item.width,
          height: item.height,
          right: item.x + item.width / 2,
          bottom: item.y + item.height / 2,
        };
      }
      const value = item?.getBounds?.();
      return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
    };
    const visibleRect = (item, bounds) => {
      if (!item) return null;
      const matrix = item.getWorldTransformMatrix();
      const left = bounds.x - item.displayOriginX;
      const top = bounds.y - item.displayOriginY;
      const corners = [
        matrix.transformPoint(left, top),
        matrix.transformPoint(left + bounds.width, top),
        matrix.transformPoint(left + bounds.width, top + bounds.height),
        matrix.transformPoint(left, top + bounds.height),
      ];
      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const right = Math.max(...xs);
      const bottom = Math.max(...ys);
      return { x, y, width: right - x, height: bottom - y, right, bottom };
    };
    const robot = byName('mission10-intro-robot');
    const beacon = byName('mission10-intro-beacon');
    const start = byName('mission10-intro-start');
    const headline = byName('mission10-intro-headline');
    const subtitle = byName('mission10-intro-subtitle');
    const message = byName('mission10-intro-message');
    const title = byName('mission10-title');
    const composition = byName('mission10-intro-composition');
    const robotBounds = visibleRect(robot, { x: 17, y: 17, width: 958, height: 1462 });
    const beaconBounds = visibleRect(beacon, { x: 61, y: 64, width: 964, height: 1337 });
    return {
      stage: game.registry.get('mission10Snapshot')?.stage,
      contract: { ...(game.registry.get('mission10SceneContract') || {}) },
      storyPhase: composition?.getData('storyPhase'),
      world: { ...(game.registry.get('sceneComposition')?.mission10?.world || {}) },
      robot: { bounds: robotBounds, alpha: robot?.alpha, angle: robot?.angle, data: robot ? {
        groundY: robot.getData('introGroundY'), visibleBottomY: robot.getData('introVisibleBottomY'),
        groundingDelta: robot.getData('introGroundingDelta'), reactingTo: robot.getData('reactingTo'),
        concernReactionPlayed: robot.getData('concernReactionPlayed'),
      } : null },
      beacon: { bounds: beaconBounds, alpha: beacon?.alpha, texture: beacon?.texture?.key, data: beacon ? {
        groundY: beacon.getData('groundY'), visibleBottomY: beacon.getData('visibleBottomY'),
        groundingDelta: beacon.getData('groundingDelta'), objectiveState: beacon.getData('objectiveState'),
        tint: beacon.tintTopLeft,
      } : null },
      message: { bounds: rect(message), headlineAlpha: headline?.alpha, subtitleAlpha: subtitle?.alpha },
      messageCopy: { headline: headline?.text, subtitle: subtitle?.text },
      title: { text: title?.text, bounds: rect(title) },
      start: { bounds: rect(start), alpha: start?.alpha, enabled: Boolean(start?.input?.enabled), ready: start?.getData('ready') },
      failedPulseAlpha: byName('mission10-intro-failed-pulse')?.alpha,
      progressCount: all.filter((item) => item?.name === 'mission10-progress').length,
      heroGroupCount: all.filter((item) => item?.name === 'mission10-intro-hero-group').length,
      beaconTextureCount: all.filter((item) => item?.texture?.key === 'MISSION10_BEACON_OFF' || item?.texture?.key === 'MISSION10_BEACON_ON').length,
      visibleBeaconTextureCount: all.filter((item) => (item?.texture?.key === 'MISSION10_BEACON_OFF' || item?.texture?.key === 'MISSION10_BEACON_ON')
        && item.active && item.visible && item.alpha > 0).length,
      robotTextureCount: all.filter((item) => item?.texture?.key === 'robot-v2-repaired').length,
      visibleRobotTextureCount: all.filter((item) => item?.texture?.key === 'robot-v2-repaired'
        && item.active && item.visible && item.alpha > 0).length,
      robotShadow: rect(byName('mission10-intro-robot-shadow')),
      beaconShadow: rect(byName('mission10-intro-beacon-shadow')),
      introObjectCount: all.filter((item) => item?.name?.startsWith?.('mission10-intro-')).length,
    };
  });
}

async function runViewport(browser, viewport) {
  const label = viewport.width + 'x' + viewport.height;
  const animated = viewport.width === 1280 && viewport.height === 720;
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.width <= 915,
    isMobile: viewport.width <= 915,
    reducedMotion: animated ? 'no-preference' : 'reduce',
  });
  const page = await context.newPage();
  await page.bringToFront();
  recordErrors(page, label);
  results.viewports.push(label);
  await openIntro(page);
  if (animated) {
  await wait(100);
  const opening = await inspect(page);
  check(label + '-opening-animation', opening.contract.interactionLocked === true && !opening.start.enabled
    && opening.start.alpha >= 0.3 && opening.start.alpha < 0.5 && opening.contract.targetCount === 0
    && opening.message.headlineAlpha === 0 && opening.message.subtitleAlpha === 0, opening);
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    return all.find((item) => item?.name === 'mission10-intro-composition')?.getData('storyPhase') === 'WEAK_PULSE';
  }, null, { timeout: 3000 });
  const weakPulse = await inspect(page);
  check(label + '-weak-pulse-before-failure', weakPulse.storyPhase === 'WEAK_PULSE'
    && weakPulse.beacon.data.objectiveState === 'WEAK_PULSE' && weakPulse.failedPulseAlpha > 0
    && weakPulse.beaconTextureCount === 1, weakPulse);
  if (viewport.width === 1280 && viewport.height === 720) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    const preFlicker = path.join(screenshotDir, 'stage10-1280x720-intro-before-flicker.png');
    await page.screenshot({ path: preFlicker });
    results.screenshots.push(preFlicker);
  }
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    return all.find((item) => item?.name === 'mission10-intro-headline')?.alpha >= 0.99;
  }, null, { timeout: 3000 });
  const failedEvent = await inspect(page);
  check(label + '-failure-event', failedEvent.beacon.data.objectiveState === 'OFF'
    && failedEvent.robot.data.concernReactionPlayed === true && failedEvent.start.enabled === false, failedEvent);
  if (viewport.width === 1280 && viewport.height === 720) {
    const offMessage = path.join(screenshotDir, 'stage10-1280x720-intro-off-message.png');
    await page.screenshot({ path: offMessage });
    results.screenshots.push(offMessage);
  }
  await page.waitForFunction(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => {
      all.push(item);
      if (Array.isArray(item?.list)) item.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    const byName = (name) => all.find((item) => item?.name === name);
    return byName('mission10-intro-start')?.alpha >= 0.99
      && byName('mission10-intro-robot')?.alpha >= 0.99
      && byName('mission10-intro-subtitle')?.alpha >= 0.99;
  }, null, { timeout: 6000 });
  } else {
    const immediate = await inspect(page);
    check(label + '-responsive-final-immediate', immediate.storyPhase === 'READY'
      && immediate.beacon.data.objectiveState === 'OFF' && immediate.start.enabled
      && immediate.message.headlineAlpha === 1 && immediate.message.subtitleAlpha === 1, immediate);
  }
  const state = await inspect(page);
  const centerX = viewport.width / 2;
  const robotCenter = state.robot.bounds.x + state.robot.bounds.width / 2;
  const beaconCenter = state.beacon.bounds.x + state.beacon.bounds.width / 2;
  const actorTop = Math.min(state.robot.bounds.y, state.beacon.bounds.y);
  const actorBottom = Math.max(state.robot.bounds.bottom, state.beacon.bounds.bottom);
  const actorLeft = Math.min(state.robot.bounds.x, state.beacon.bounds.x);
  const actorRight = Math.max(state.robot.bounds.right, state.beacon.bounds.right);
  check(label + '-intro-stage-only', state.stage === 'INTRO' && state.introObjectCount >= 6, state);
  check(label + '-semantic-composition', state.heroGroupCount === 1 && state.progressCount === 0
    && state.beaconTextureCount === 1 && state.visibleBeaconTextureCount === 1
    && state.robotTextureCount === 1 && state.visibleRobotTextureCount === 1, state);
  check(label + '-message-copy', state.messageCopy.headline === 'МАЯК ПОГАС!'
    && state.messageCopy.subtitle === 'ПОМОГИ РОБОТУ ЗАПУСТИТЬ МАЯК', state.messageCopy);
  check(label + '-robot-left-center', robotCenter < centerX && state.robot.bounds.x > viewport.width * 0.12, state.robot.bounds);
  check(label + '-beacon-right-center', beaconCenter > centerX && state.beacon.bounds.right < viewport.width * 0.88, state.beacon.bounds);
  check(label + '-actors-bounded-together', actorRight - actorLeft <= Math.min(900, state.world.width) * 0.78, { actorLeft, actorRight, world: state.world });
  check(label + '-beacon-large', state.beacon.bounds.height >= state.robot.bounds.height * 0.98 && state.beacon.bounds.height >= (viewport.height < 500 ? 96 : 250), {
    robot: state.robot.bounds, beacon: state.beacon.bounds,
  });
  check(label + '-robot-grounded', Math.abs(state.robot.bounds.bottom - state.robot.data.groundY) <= 1 && state.robot.data.groundingDelta === 0, state.robot);
  check(label + '-beacon-grounded', Math.abs(state.beacon.bounds.bottom - state.beacon.data.groundY) <= 1 && state.beacon.data.groundingDelta === 0, state.beacon);
  check(label + '-soft-contact-shadows', Math.abs((state.robotShadow.y + state.robotShadow.height / 2) - state.robot.data.groundY) <= 8
    && Math.abs((state.beaconShadow.y + state.beaconShadow.height / 2) - state.beacon.data.groundY) <= 8, {
    robotShadow: state.robotShadow, beaconShadow: state.beaconShadow,
  });
  check(label + '-message-clear', state.message.headlineAlpha === 1 && state.message.subtitleAlpha === 1
    && actorTop - state.message.bounds.bottom >= (state.world.height < 330 ? 14 : 20), state.message);
  check(label + '-title-correct', state.title.text === 'ПЕРВЫЙ ЗАПУСК', state.title);
  check(label + '-button-connected', state.start.enabled && state.start.ready === true && state.start.alpha >= 0.99
    && state.start.bounds.y > actorBottom && Math.abs((state.start.bounds.x + state.start.bounds.width / 2) - centerX) <= 2, state.start);
  check(label + '-beacon-off', state.beacon.texture === 'MISSION10_BEACON_OFF' && state.beacon.data.objectiveState === 'OFF'
    && state.beacon.alpha === 1 && state.beacon.data.tint === 0x708087, state.beacon);
  check(label + '-robot-reaction', state.robot.angle >= 6 && state.robot.data.reactingTo === 'BEACON'
    && state.robot.data.concernReactionPlayed === true, state.robot);
  check(label + '-no-overlap', state.robot.bounds.right < state.beacon.bounds.x
    && state.message.bounds.bottom < actorTop && actorBottom < state.start.bounds.y, {
    robot: state.robot.bounds, beacon: state.beacon.bounds, message: state.message.bounds, start: state.start.bounds,
  });

  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshot = path.join(screenshotDir, 'stage10-' + label + '-intro.png');
  await page.screenshot({ path: screenshot });
  results.screenshots.push(screenshot);

  await page.mouse.click(state.start.bounds.x + state.start.bounds.width / 2, state.start.bounds.y + state.start.bounds.height / 2);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot')?.stage === 'PATH', null, { timeout: 10000 });
  const after = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const robot = all.find((item) => item?.name === 'mission10-robot-v2');
    const layout = game.registry.get('sceneComposition').mission10;
    return {
      stage: game.registry.get('mission10Snapshot')?.stage,
      introBeaconCount: all.filter((item) => item?.name === 'mission10-intro-beacon').length,
      introMessageCount: all.filter((item) => item?.name === 'mission10-intro-message').length,
      robotX: robot?.x,
      robotY: robot?.y,
      robotScale: robot?.scaleX,
      expectedX: layout.robot.x + layout.robot.width / 2,
      expectedY: layout.platformContactY,
      expectedScale: layout.robotScale,
      pathDecisionIndex: game.registry.get('mission10Snapshot')?.pathDecisionIndex,
      pathWrongAttempts: game.registry.get('mission10Snapshot')?.pathWrongAttempts,
      progressCount: all.filter((item) => item?.name === 'mission10-progress').length,
      soundMuted: game.sound.mute,
      introSoundCount: game.sound.sounds.filter((sound) => sound.key === 'audio-answer-wrong').length,
      introSoundPlayingCount: game.sound.sounds.filter((sound) => sound.key === 'audio-answer-wrong' && sound.isPlaying).length,
      introSoundVolume: game.sound.sounds.find((sound) => sound.key === 'audio-answer-wrong')?.volume,
    };
  });
  check(label + '-path-restored-unchanged', after.stage === 'PATH' && after.introBeaconCount === 0 && after.introMessageCount === 0
    && Math.abs(after.robotX - after.expectedX) <= 0.01 && Math.abs(after.robotY - after.expectedY) <= 0.01
    && Math.abs(after.robotScale - after.expectedScale) <= 0.0001 && after.pathDecisionIndex === 0
    && after.pathWrongAttempts === 0 && after.progressCount === 1, after);
  check(label + '-intro-audio-started', after.soundMuted === false && after.introSoundCount === 1
    && after.introSoundPlayingCount === 1 && after.introSoundVolume > 0, after);
  await context.close();
}

async function runReducedMotion(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  recordErrors(page, 'reduced-motion');
  await openIntro(page);
  const state = await inspect(page);
  check('reduced-motion-immediate-final', state.storyPhase === 'READY' && state.beacon.data.objectiveState === 'OFF'
    && state.message.headlineAlpha === 1 && state.message.subtitleAlpha === 1 && state.start.enabled
    && state.start.ready === true && state.contract.timerCount === 0 && state.beaconTextureCount === 1
    && state.robot.angle >= 6, state);
  await context.close();
}

async function runPortraitGate(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  recordErrors(page, '390x844-portrait');
  const next = new URL(baseUrl);
  next.searchParams.set('qaMission', '10');
  await page.goto(next.toString(), { waitUntil: 'commit', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene'), null, { timeout: 90000 });
  const state = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    return {
      gateCount: all.filter((item) => item?.name === 'mission10-orientation-gate').length,
      introCompositionCount: all.filter((item) => item?.name === 'mission10-intro-composition').length,
      introStartCount: all.filter((item) => item?.name === 'mission10-intro-start').length,
    };
  });
  check('390x844-orientation-gate', state.gateCount === 1 && state.introCompositionCount === 0 && state.introStartCount === 0, state);
  const screenshot = path.join(screenshotDir, 'stage10-390x844-orientation.png');
  await page.screenshot({ path: screenshot });
  results.screenshots.push(screenshot);
  await context.close();
}

async function runMuteAndRevisit(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  recordErrors(page, 'mute-revisit');
  await page.addInitScript(() => localStorage.setItem('robotlab.audioMuted', 'true'));
  await openIntro(page);
  const soundControl = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');
    const sound = scene.children.list.find((item) => item?.name === 'mission10-sound');
    const bounds = sound.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await page.mouse.click(soundControl.x, soundControl.y);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.sound.mute === false);
  const unmuted = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const cue = game.sound.sounds.find((sound) => sound.key === 'audio-answer-wrong');
    const scene = game.scene.getScene('Mission10Scene');
    const sound = scene.children.list.find((item) => item?.name === 'mission10-sound');
    return {
      muted: game.sound.mute,
      cueCount: game.sound.sounds.filter((item) => item.key === 'audio-answer-wrong').length,
      cuePlaying: cue?.isPlaying,
      cueVolume: cue?.volume,
      label: sound?.getAt(1)?.text,
    };
  });
  check('mute-unmute-plays-pending-intro-once', unmuted.muted === false && unmuted.cueCount === 1
    && unmuted.cuePlaying === true && unmuted.cueVolume > 0 && unmuted.label === '♪ Звук', unmuted);
  await page.mouse.click(soundControl.x, soundControl.y);
  const muted = await page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const sound = scene.children.list.find((item) => item?.name === 'mission10-sound');
    return { muted: game.sound.mute, label: sound?.getAt(1)?.text };
  });
  check('mute-button-disables-sound', muted.muted === true && muted.label === '× Звук', muted);
  await wait(180);
  await page.mouse.click(soundControl.x, soundControl.y, { delay: 80 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.sound.mute === false);
  check('mute-button-reenables-sound', await page.evaluate(() => window.__ROBOTLAB_GAME__.sound.mute === false));

  const home = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');
    const control = scene.children.list.find((item) => item?.name === 'mission10-home');
    const bounds = control.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await page.mouse.click(home.x, home.y);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.start('Mission10Scene'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission10Scene')
    && window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot')?.stage === 'INTRO');
  let revisited = await inspect(page);
  check('home-return-single-instance', revisited.beaconTextureCount === 1 && revisited.visibleBeaconTextureCount === 1
    && revisited.robotTextureCount === 1 && revisited.visibleRobotTextureCount === 1 && revisited.progressCount === 0, revisited);
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene').scene.restart());
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission10Scene'));
  await wait(100);
  revisited = await inspect(page);
  check('scene-restart-single-instance', revisited.beaconTextureCount === 1 && revisited.visibleBeaconTextureCount === 1
    && revisited.robotTextureCount === 1 && revisited.visibleRobotTextureCount === 1 && revisited.progressCount === 0, revisited);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ] });
  try {
    for (const viewport of viewports) await runViewport(browser, viewport);
    await runReducedMotion(browser);
    await runPortraitGate(browser);
    await runMuteAndRevisit(browser);
  } finally {
    await browser.close();
  }
  check('runtime-errors-empty', results.errors.length === 0, results.errors);
  const failed = results.checks.filter((item) => !item.ok);
  results.result = failed.length === 0 && results.errors.length === 0 ? 'READY_FOR_MISSION10_INTRO_REVIEW' : 'FAIL';
  results.failedChecks = failed;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  process.stdout.write(JSON.stringify({
    result: results.result,
    checks: results.checks.length,
    failures: failed.length,
    errors: results.errors.length,
    screenshots: results.screenshots.length,
  }) + '\n');
  if (results.result === 'FAIL') process.exitCode = 1;
})().catch((error) => {
  results.errors.push({ type: 'runner', message: error.stack || error.message });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.error(error);
  process.exitCode = 1;
});
