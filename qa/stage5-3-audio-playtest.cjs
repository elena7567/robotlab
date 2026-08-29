const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4193/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const expectedAudio = [
  ['audio-start-theme', 'public/assets/audio/music/start-theme.wav'],
  ['audio-ui-click', 'public/assets/audio/sfx/ui-click.wav'],
  ['audio-answer-correct', 'public/assets/audio/sfx/answer-correct.wav'],
  ['audio-answer-wrong', 'public/assets/audio/sfx/answer-wrong.wav'],
  ['audio-hint', 'public/assets/audio/sfx/hint.wav'],
  ['audio-repair-reward', 'public/assets/audio/sfx/repair-reward.wav'],
];

function wavInfo(file) {
  const buffer = fs.readFileSync(file);
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataSize = buffer.readUInt32LE(40);
  return { file, size: buffer.length, duration: dataSize / (sampleRate * channels * bitsPerSample / 8), channels, sampleRate, bitsPerSample };
}

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (response.url().includes('/assets/audio/') && !response.ok()) errors.responses.push(`${response.status()} ${response.url()}`);
  });
  return errors;
}

async function pointFor(page, name, sceneKey = 'GameScene') {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const card = sceneKey === 'GameScene' ? scene.children.getByName('task-card') : undefined;
    const target = card?.getByName(name)
      || card?.list.find((item) => item.list?.some((child) => child.text === name))
      || scene.children.getByName(name)
      || scene.children.list.find((item) => item.list?.some((child) => child.text === name));
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, sceneKey = 'GameScene', settleMs = 90) {
  const point = await pointFor(page, name, sceneKey);
  await page.mouse.click(point.x, point.y);
  await sleep(settleMs);
}

async function installAudioProbe(page) {
  await page.evaluate(() => {
    const sound = window.__ROBOTLAB_GAME__.sound;
    window.__ROBOTLAB_AUDIO_EVENTS__ = [];
    const events = window.__ROBOTLAB_AUDIO_EVENTS__;
    const originalPlay = sound.play.bind(sound);
    sound.play = (key, config) => {
      events.push({ key, at: performance.now(), muted: sound.mute });
      return originalPlay(key, config);
    };
    const originalAdd = sound.add.bind(sound);
    sound.add = (key, config) => {
      const instance = originalAdd(key, config);
      if (key === 'audio-start-theme') {
        const play = instance.play.bind(instance);
        instance.play = (markerName, playConfig) => {
          events.push({ key, at: performance.now(), muted: sound.mute });
          return play(markerName, playConfig);
        };
      }
      return instance;
    };
  });
}

async function audioSnapshot(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const music = game.sound.sounds.filter((sound) => sound.key === 'audio-start-theme');
    return {
      events: [...(window.__ROBOTLAB_AUDIO_EVENTS__ || [])],
      muted: game.sound.mute,
      locked: game.sound.locked,
      musicInstances: music.length,
      musicPlaying: music.filter((sound) => sound.isPlaying).length,
      storedMuted: localStorage.getItem('robotlab.audioMuted'),
      decoded: ['audio-start-theme', 'audio-ui-click', 'audio-answer-correct', 'audio-answer-wrong', 'audio-hint', 'audio-repair-reward']
        .every((key) => game.cache.audio.exists(key)),
      canvas: { width: game.canvas.width, height: game.canvas.height },
      scene: game.scene.getScenes(true).map((scene) => scene.scene.key),
    };
  });
}

const count = (snapshot, key) => snapshot.events.filter((event) => event.key === key).length;

async function selectAndCheck(page, choice) {
  await activate(page, `choice-${choice}`);
  await activate(page, 'check-button', 'GameScene', 360);
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const files = Object.fromEntries(expectedAudio.map(([key, file]) => [key, wavInfo(file)]));
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--autoplay-policy=user-gesture-required'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await installAudioProbe(page);
  const beforeGesture = await audioSnapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage5-3-desktop-start-before-gesture.png') });

  await activate(page, 'Играть', 'StartScene');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('GameScene'));
  await sleep(220);
  const afterPlay = await audioSnapshot(page);

  const beforeSingleClick = await audioSnapshot(page);
  await activate(page, 'Подсказка');
  const afterHintOdd = await audioSnapshot(page);
  await selectAndCheck(page, 'odd-apple');
  const afterWrongOdd = await audioSnapshot(page);
  await selectAndCheck(page, 'odd-ball');
  const afterCorrectOdd = await audioSnapshot(page);
  await activate(page, 'continue-button');

  await activate(page, 'Подсказка');
  await selectAndCheck(page, 'sequence-gear');
  await selectAndCheck(page, 'sequence-star');
  await activate(page, 'continue-button');
  await selectAndCheck(page, 'sequence-planet');
  await activate(page, 'continue-button');
  await selectAndCheck(page, 'sequence-planet');
  await activate(page, 'continue-button');

  await activate(page, 'Подсказка');
  await selectAndCheck(page, 'size-small');
  await selectAndCheck(page, 'size-large');
  await activate(page, 'continue-button');
  await selectAndCheck(page, 'size-small');
  await activate(page, 'continue-button');
  await selectAndCheck(page, 'size-medium');
  const afterMechanics = await audioSnapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage5-3-desktop-game-audio-complete.png') });

  await activate(page, '⌂ Домой');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
  await sleep(180);
  const firstHome = await audioSnapshot(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(350);
  const afterResize = await audioSnapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage5-3-mobile-start-after-resize.png') });

  await activate(page, '♪ Звук', 'StartScene');
  const afterMute = await audioSnapshot(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const afterMutedReload = await audioSnapshot(page);
  await activate(page, '× Звук', 'StartScene');
  await sleep(180);
  const afterUnmute = await audioSnapshot(page);
  await page.screenshot({ path: path.join(screenshotDir, 'stage5-3-mobile-start-unmuted.png') });

  const checks = {
    filesExactAndValid: Object.values(files).every((file) => file.channels === 1 && file.sampleRate === 44100 && file.bitsPerSample === 16),
    durations: files['audio-start-theme'].duration >= 12 && files['audio-start-theme'].duration <= 20
      && files['audio-ui-click'].duration >= 0.06 && files['audio-ui-click'].duration <= 0.18
      && files['audio-answer-correct'].duration >= 0.4 && files['audio-answer-correct'].duration <= 1
      && files['audio-answer-wrong'].duration >= 0.3 && files['audio-answer-wrong'].duration <= 0.8
      && files['audio-hint'].duration >= 0.4 && files['audio-hint'].duration <= 0.9
      && files['audio-repair-reward'].duration >= 0.8 && files['audio-repair-reward'].duration <= 1.5,
    decoded: beforeGesture.decoded,
    noAutoplayBeforeGesture: beforeGesture.events.length === 0 && beforeGesture.musicPlaying === 0,
    playGestureUnlocked: !afterPlay.locked,
    singleUiClick: count(afterHintOdd, 'audio-ui-click') - count(beforeSingleClick, 'audio-ui-click') === 1,
    hintAllMechanics: count(afterMechanics, 'audio-hint') === 3,
    wrongAllMechanics: count(afterMechanics, 'audio-answer-wrong') === 3,
    correctAllMechanics: count(afterMechanics, 'audio-answer-correct') === 7,
    repairMajorOnly: count(afterMechanics, 'audio-repair-reward') === 3,
    immediateRetry: count(afterWrongOdd, 'audio-answer-wrong') === 1 && count(afterCorrectOdd, 'audio-answer-correct') === 1,
    startMusicAfterHome: count(firstHome, 'audio-start-theme') - count(afterPlay, 'audio-start-theme') === 1
      && firstHome.musicInstances === 1 && firstHome.musicPlaying === 1,
    noDuplicateMusicOnResize: count(afterResize, 'audio-start-theme') === count(firstHome, 'audio-start-theme')
      && afterResize.musicInstances === 1 && afterResize.musicPlaying === 1,
    resizePreservesState: afterResize.scene.includes('StartScene') && afterResize.canvas.width === 390 && afterResize.canvas.height === 844,
    mute: afterMute.muted && afterMute.storedMuted === 'true',
    mutePersistence: afterMutedReload.muted && afterMutedReload.storedMuted === 'true' && afterMutedReload.musicPlaying === 0,
    unmuteResumes: !afterUnmute.muted && afterUnmute.storedMuted === 'false' && afterUnmute.musicPlaying === 1,
    noRuntimeErrors: errors.console.length + errors.page.length + errors.requests.length + errors.responses.length === 0,
  };
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const report = { checks, failures, files, errors, snapshots: { beforeGesture, afterPlay, afterHintOdd, afterWrongOdd,
    afterCorrectOdd, afterMechanics, firstHome, afterResize, afterMute, afterMutedReload, afterUnmute } };
  fs.writeFileSync(path.join('docs', 'qa', 'stage5-3-audio-results.json'), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ checks, failures, files, errors }, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
