const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const reportPath = path.join('docs', 'qa', 'start-lab-theme-results.json');
const musicKey = 'audio-start-lab-theme';
const oldMusicKey = 'audio-start-theme';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (response.url().includes('/assets/audio/') && !response.ok()) {
      errors.responses.push(`${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

async function pointFor(page, name, sceneKey) {
  return page.evaluate(({ name, sceneKey }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const target = scene.children.getByName(name)
      || scene.children.list.find((item) => item.list?.some((child) => child.text === name));
    if (!target) throw new Error(`Target not found: ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { name, sceneKey });
}

async function activate(page, name, sceneKey, settleMs = 140) {
  const point = await pointFor(page, name, sceneKey);
  await page.mouse.click(point.x, point.y);
  await sleep(settleMs);
}

async function installAudioProbe(page) {
  await page.evaluate((key) => {
    const sound = window.__ROBOTLAB_GAME__.sound;
    window.__ROBOTLAB_AUDIO_EVENTS__ = [];
    const originalAdd = sound.add.bind(sound);
    sound.add = (addedKey, config) => {
      const instance = originalAdd(addedKey, config);
      if (addedKey === key) {
        const originalPlay = instance.play.bind(instance);
        instance.play = (...args) => {
          window.__ROBOTLAB_AUDIO_EVENTS__.push({ key: addedKey, type: 'play', at: performance.now() });
          return originalPlay(...args);
        };
        const originalStop = instance.stop.bind(instance);
        instance.stop = (...args) => {
          window.__ROBOTLAB_AUDIO_EVENTS__.push({ key: addedKey, type: 'stop', at: performance.now() });
          return originalStop(...args);
        };
      }
      return instance;
    };
  }, musicKey);
}

async function snapshot(page) {
  return page.evaluate(({ musicKey, oldMusicKey }) => {
    const game = window.__ROBOTLAB_GAME__;
    const music = game.sound.sounds.filter((sound) => sound.key === musicKey);
    return {
      activeScenes: game.scene.getScenes(true).map((scene) => scene.scene.key),
      audioContextState: game.sound.context?.state ?? 'not-web-audio',
      locked: game.sound.locked,
      muted: game.sound.mute,
      storedMuted: localStorage.getItem('robotlab.audioMuted'),
      newKeyDecoded: game.cache.audio.exists(musicKey),
      oldKeyDecoded: game.cache.audio.exists(oldMusicKey),
      musicInstances: music.length,
      musicPlaying: music.filter((sound) => sound.isPlaying).length,
      musicPaused: music.filter((sound) => sound.isPaused).length,
      musicLooping: music.filter((sound) => sound.loop).length,
      musicVolumes: music.map((sound) => sound.volume),
      musicSeek: music[0]?.seek ?? null,
      duration: music[0]?.duration ?? null,
      events: [...(window.__ROBOTLAB_AUDIO_EVENTS__ || [])],
    };
  }, { musicKey, oldMusicKey });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=user-gesture-required'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => localStorage.setItem('robotlab.audioMuted', 'false'));
  const page = await context.newPage();
  const errors = captureErrors(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  await page.waitForLoadState('networkidle');
  await installAudioProbe(page);
  const beforeGesture = await snapshot(page);

  await activate(page, 'start-sound', 'StartScene');
  const afterMuteGesture = await snapshot(page);
  await activate(page, 'start-sound', 'StartScene', 220);
  const afterUnmute = await snapshot(page);

  await page.evaluate((key) => {
    const sound = window.__ROBOTLAB_GAME__.sound.sounds.find((item) => item.key === key);
    sound.setSeek(sound.duration - 0.08);
  }, musicKey);
  await sleep(180);
  const afterLoopBoundary = await snapshot(page);

  await activate(page, 'start-play-button', 'StartScene', 260);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('GameScene'));
  const afterExit = await snapshot(page);

  await activate(page, 'game-home', 'GameScene', 220);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
  const afterReturn = await snapshot(page);

  await page.waitForLoadState('networkidle');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
  const afterRefresh = await snapshot(page);

  const checks = {
    correctAssetDecoded: beforeGesture.newKeyDecoded && !beforeGesture.oldKeyDecoded,
    noAutoplayBeforeGesture: beforeGesture.musicInstances === 0 && beforeGesture.musicPlaying === 0,
    gestureUnlocksAudio: !afterMuteGesture.locked && afterMuteGesture.audioContextState === 'running',
    musicStartsAfterAllowedGesture: afterMuteGesture.musicInstances === 1
      && afterMuteGesture.events.filter((event) => event.type === 'play').length === 1,
    mute: afterMuteGesture.muted && afterMuteGesture.storedMuted === 'true',
    unmute: !afterUnmute.muted && afterUnmute.storedMuted === 'false' && afterUnmute.musicPlaying === 1,
    configuredVolume: afterUnmute.musicVolumes.length === 1 && Math.abs(afterUnmute.musicVolumes[0] - 0.26) < 0.001,
    duration: afterUnmute.duration >= 19.9 && afterUnmute.duration <= 20.2,
    loopBoundary: afterLoopBoundary.musicLooping === 1 && afterLoopBoundary.musicPlaying === 1
      && afterLoopBoundary.musicInstances === 1 && afterLoopBoundary.musicSeek < 0.5,
    startSceneExit: afterExit.activeScenes.includes('GameScene') && afterExit.musicPlaying === 0,
    returnToStartScene: afterReturn.activeScenes.includes('StartScene') && afterReturn.musicPlaying === 1,
    noDuplicatePlayback: afterReturn.musicInstances === 1 && afterReturn.musicPlaying === 1,
    refresh: afterRefresh.activeScenes.includes('StartScene') && afterRefresh.newKeyDecoded,
    noRuntimeErrors: Object.values(errors).every((items) => items.length === 0),
  };
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const report = {
    checks,
    failures,
    errors,
    snapshots: { beforeGesture, afterMuteGesture, afterUnmute, afterLoopBoundary, afterExit, afterReturn, afterRefresh },
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ checks, failures, errors }, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
