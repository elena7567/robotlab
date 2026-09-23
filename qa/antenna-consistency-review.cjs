const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const base = 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots', 'antenna-consistency');
const reportPath = path.join('docs', 'qa', 'antenna-consistency-review.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { checks: [], errors: [], scenes: [], screenshots: [] };

function add(name, ok, actual = null) {
  report.checks.push({ name, ok: Boolean(ok), actual });
}

function captureErrors(page, label) {
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ label, type: 'console', message: message.text() }); });
  page.on('pageerror', (error) => report.errors.push({ label, type: 'pageerror', message: error.message }));
  page.on('requestfailed', (request) => report.errors.push({ label, type: 'requestfailed', message: request.url() }));
  page.on('response', (response) => { if (response.status() >= 400) report.errors.push({ label, type: 'response', message: `${response.status()} ${response.url()}` }); });
}

async function waitActive(page, sceneName) {
  await page.waitForFunction((name) => window.__ROBOTLAB_GAME__?.scene?.isActive(name), sceneName, { timeout: 60000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.registry?.get('sceneReady') !== false, null, { timeout: 60000 }).catch(() => {});
  await sleep(350);
}

async function waitMission10Stage(page, stage) {
  await waitActive(page, 'Mission10Scene');
  await page.waitForFunction((expected) => window.__ROBOTLAB_GAME__?.registry?.get('mission10Snapshot')?.stage === expected, stage, { timeout: 60000 });
  await sleep(350);
}

async function inspect(page, sceneName, preferredName) {
  return page.evaluate(({ sceneName, preferredName }) => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene(sceneName);
    const all = [];
    const walk = (item) => {
      all.push(item);
      if (item?.list) item.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    const isVisible = (item) => item && item.visible !== false && item.alpha !== 0 && item.active !== false;
    const assembled = all.filter((item) => isVisible(item) && item?.getData?.('visibleBoundsId') === 'ROBOT_V2_ASSEMBLED');
    const chosen = assembled.find((item) => item.name === preferredName) || assembled[0];
    const children = [];
    if (chosen?.list) chosen.list.forEach(walkChild);
    function walkChild(item) {
      children.push(item);
      if (item?.list) item.list.forEach(walkChild);
    }
    const antennas = children.filter((item) => isVisible(item) && item?.texture?.key === 'robot-v2-antenna');
    const bodies = children.filter((item) => isVisible(item) && item?.texture?.key === 'robot-v2-body');
    const repairedDirect = all.filter((item) => isVisible(item) && item?.texture?.key === 'robot-v2-repaired');
    const helperContainers = all.filter((item) => isVisible(item) && item?.getData?.('visibleBoundsId') === 'ROBOT_V2_HELPER');
    const helperAntennaChildren = helperContainers.flatMap((helper) => {
      const descendants = [];
      const collect = (item) => { descendants.push(item); if (item?.list) item.list.forEach(collect); };
      if (helper?.list) helper.list.forEach(collect);
      return descendants.filter((item) => item?.texture?.key === 'robot-v2-antenna');
    });
    const point = (item, x = 0, y = 0) => item?.getWorldTransformMatrix?.().transformPoint(x, y) || null;
    const bounds = (item) => {
      if (!item?.getBounds) return null;
      const b = item.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom };
    };
    const antenna = antennas[0];
    const head = children.find((item) => isVisible(item) && item?.texture?.key === 'robot-v2-head');
    const antennaBottom = point(antenna, 0, 0);
    const antennaTop = point(antenna, 0, -330);
    const headTop = point(head, 0, -456);
    const headCenter = point(head, 0, -228);
    const containerBounds = bounds(chosen);
    return {
      sceneName,
      preferredName,
      activeScene: game.scene.getScenes(true).map((s) => s.scene.key),
      assembledCount: assembled.length,
      chosenName: chosen?.name || null,
      canonicalKey: chosen?.getData?.('canonicalCharacterKey') || null,
      canonicalFile: chosen?.getData?.('canonicalCharacterFile') || null,
      antennaNames: antennas.map((item) => item.name),
      antennaCount: antennas.length,
      bodyPartCount: bodies.length,
      directRepairedCount: repairedDirect.length,
      helperCount: helperContainers.length,
      helperAntennaCount: helperAntennaChildren.length,
      antennaBottom,
      antennaTop,
      headTop,
      headCenter,
      bounds: containerBounds,
      scaleX: chosen?.scaleX ?? null,
      scaleY: chosen?.scaleY ?? null,
      displayWidth: chosen?.displayWidth ?? null,
      displayHeight: chosen?.displayHeight ?? null,
    };
  }, { sceneName, preferredName });
}

async function cropRobot(page, info, name) {
  const viewport = page.viewportSize();
  let clip;
  if (info.bounds && Number.isFinite(info.bounds.x) && info.bounds.width > 0 && info.bounds.height > 0) {
    const pad = Math.max(24, Math.min(80, info.bounds.height * 0.18));
    clip = {
      x: Math.max(0, info.bounds.x - pad),
      y: Math.max(0, info.bounds.y - pad),
      width: Math.min(viewport.width, info.bounds.right + pad) - Math.max(0, info.bounds.x - pad),
      height: Math.min(viewport.height, info.bounds.bottom + pad) - Math.max(0, info.bounds.y - pad),
    };
  }
  const out = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: out, clip: clip && clip.width > 4 && clip.height > 4 ? clip : undefined });
  report.screenshots.push(out);
}

function assertAntenna(label, info, options = {}) {
  if (options.allowAbsent && info.assembledCount === 0) {
    add(`${label}-assembled-hidden-by-existing-layout`, true, info);
    add(`${label}-helper-unchanged`, info.helperAntennaCount === 0, info);
    return;
  }
  add(`${label}-assembled-present`, info.assembledCount >= 1, info);
  add(`${label}-canonical-key`, info.canonicalKey === 'ASSEMBLED_ROBOT' || info.chosenName === 'programming-robot' || info.chosenName?.includes('assembled') || info.chosenName?.includes('repaired'), info);
  add(`${label}-antenna-visible`, info.antennaCount === 1, info);
  add(`${label}-antenna-centered`, info.antennaBottom && info.headCenter && Math.abs(info.antennaBottom.x - info.headCenter.x) <= Math.max(3, Math.abs(info.scaleX || 1) * 20), info);
  add(`${label}-antenna-connected`, info.antennaBottom && info.headTop && info.antennaBottom.y >= info.headTop.y - Math.max(3, Math.abs(info.scaleY || 1) * 80), info);
  add(`${label}-duplicate-antenna-none`, info.antennaCount === 1, info);
  add(`${label}-floating-gap-none`, info.antennaBottom && info.headTop && (info.antennaBottom.y - info.headTop.y) <= Math.max(80, Math.abs(info.scaleY || 1) * 460), info);
  add(`${label}-head-clipping-none`, info.antennaTop && info.antennaTop.y >= -2, info);
  add(`${label}-helper-unchanged`, info.helperAntennaCount === 0, info);
}

async function runCase(browser, cfg) {
  const context = await browser.newContext({ viewport: cfg.viewport, reducedMotion: 'reduce', hasTouch: cfg.hasTouch || false });
  const page = await context.newPage();
  captureErrors(page, cfg.label);
  await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (cfg.startScene) {
    await waitActive(page, cfg.initialScene || 'Mission7Scene');
    await page.evaluate((sceneName) => window.__ROBOTLAB_GAME__.scene.start(sceneName), cfg.startScene);
  }
  if (cfg.mission10Stage) await waitMission10Stage(page, cfg.mission10Stage);
  else await waitActive(page, cfg.sceneName);
  if (cfg.sceneName === 'VictoryScene') await waitActive(page, 'VictoryScene');
  const info = await inspect(page, cfg.sceneName, cfg.preferredName);
  report.scenes.push({ label: cfg.label, url: cfg.url, viewport: cfg.viewport, info });
  assertAntenna(cfg.label, info, { allowAbsent: cfg.allowAbsent });
  await cropRobot(page, info, cfg.label);
  await context.close();
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const desktop = { width: 1280, height: 720 };
    await runCase(browser, { label: 'transition-1280x720', url: base, initialScene: 'StartScene', startScene: 'TransitionScene', sceneName: 'TransitionScene', preferredName: 'transition-assembled-robot', viewport: desktop });
    await runCase(browser, { label: 'mission6-1280x720', url: `${base}?qaMission=7`, initialScene: 'Mission7Scene', startScene: 'Mission6Scene', sceneName: 'Mission6Scene', preferredName: 'mission6-repaired-robot', viewport: desktop });
    await runCase(browser, { label: 'mission7-1280x720', url: `${base}?qaMission=7`, sceneName: 'Mission7Scene', preferredName: 'mission7-repaired-robot', viewport: desktop });
    await runCase(browser, { label: 'mission7-390x844', url: `${base}?qaMission=7`, sceneName: 'Mission7Scene', preferredName: 'mission7-repaired-robot', viewport: { width: 390, height: 844 }, hasTouch: true, allowAbsent: true });
    await runCase(browser, { label: 'mission8-1280x720', url: `${base}?qaMission=8`, sceneName: 'Mission8Scene', preferredName: 'programming-robot', viewport: desktop });
    await runCase(browser, { label: 'mission9-1280x720', url: `${base}?qaMission=9`, sceneName: 'Mission9Scene', preferredName: 'mission9-repaired-robot', viewport: desktop });
    await runCase(browser, { label: 'mission9-844x390', url: `${base}?qaMission=9`, sceneName: 'Mission9Scene', preferredName: 'mission9-repaired-robot', viewport: { width: 844, height: 390 }, hasTouch: true });
    await runCase(browser, { label: 'mission10-intro-1280x720', url: `${base}?qaMission=10`, sceneName: 'Mission10Scene', preferredName: 'mission10-intro-robot', viewport: desktop, mission10Stage: 'INTRO' });
    await runCase(browser, { label: 'mission10-signal-844x390', url: `${base}?qaMission=10&stage=signal`, sceneName: 'Mission10Scene', preferredName: 'mission10-robot-v2', viewport: { width: 844, height: 390 }, hasTouch: true, mission10Stage: 'SIGNAL' });
    await runCase(browser, { label: 'mission10-launch-1280x720', url: `${base}?qaMission=10&stage=launch`, sceneName: 'Mission10Scene', preferredName: 'mission10-robot-v2', viewport: desktop, mission10Stage: 'LAUNCH' });
    await runCase(browser, { label: 'victory-1280x720', url: `${base}?qaMission=10&stage=final`, sceneName: 'VictoryScene', preferredName: 'victory-robot-v2', viewport: desktop });
  } finally {
    await browser.close();
  }
  report.result = report.errors.length === 0 && report.checks.every((check) => check.ok) ? 'PASS' : 'FAIL';
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ result: report.result, checks: report.checks.length, failed: report.checks.filter((check) => !check.ok), errors: report.errors, reportPath, screenshots: report.screenshots }, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
