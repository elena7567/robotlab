const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const shotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'release-final-launch-position.json');
const requiredScreenshots = new Set(['1280x720', '1600x900', '1920x1080']);
const viewports = [
  { width: 1280, height: 720 },
  { width: 1438, height: 914 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
];
const report = { result: 'FAIL', checks: [], errors: [], viewports: [], screenshots: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, ok, data) {
  report.checks.push({ name, ok, data });
}
function stageUrl(stage) {
  const url = new URL(baseUrl);
  url.searchParams.set('qaMission', '10');
  url.searchParams.set('stage', stage);
  return url.toString();
}
function recordErrors(page, label) {
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ label, type: 'console', message: message.text() }); });
  page.on('pageerror', (error) => report.errors.push({ label, type: 'pageerror', message: error.stack || error.message }));
  page.on('requestfailed', (request) => report.errors.push({ label, type: 'requestfailed', message: `${request.url()}: ${request.failure()?.errorText || ''}` }));
  page.on('response', (response) => { if (response.status() >= 400) report.errors.push({ label, type: 'response', message: `${response.status()} ${response.url()}` }); });
}
async function inspectLaunch(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const walk = (item) => [item, ...((item && Array.isArray(item.list)) ? item.list.flatMap(walk) : [])];
    const all = scene.children.list.flatMap(walk);
    const robot = all.find((item) => item?.name === 'mission10-robot-v2' || item?.name === 'assembly-robot');
    const consoleObject = all.find((item) => item?.name === 'mission10-launch-console');
    const beacon = all.find((item) => item?.name === 'mission10-beacon-off' || item?.name === 'mission10-beacon-on');
    const boundsOf = (item) => {
      const bounds = item?.getBounds?.();
      return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom, centerX: bounds.centerX, centerY: bounds.centerY } : null;
    };
    const composition = game.registry.get('sceneComposition');
    const mission10 = composition?.mission10;
    const robotBounds = boundsOf(robot);
    const consoleBounds = boundsOf(consoleObject);
    const beaconBounds = boundsOf(beacon);
    const foot = robot?.getFootAnchorWorld?.() || { x: robot?.x ?? null, y: robot?.y ?? null };
    const canonicalGroundY = mission10 ? mission10.launchGroundY + 16 * (robot?.scaleY ?? 0) : null;
    return {
      viewport: { width: game.scale.width, height: game.scale.height },
      stage: game.registry.get('mission10Snapshot')?.stage,
      semanticMode: composition?.semanticMode,
      layout: mission10 ? {
        robot: mission10.robot,
        launchRobotZone: mission10.launchRobotZone,
        launchConsole: mission10.launchConsole,
        beacon: mission10.beacon,
        launchGroundY: mission10.launchGroundY,
        platformContactY: mission10.platformContactY,
        robotScale: mission10.robotScale,
      } : null,
      robot: robotBounds,
      console: consoleBounds,
      beacon: beaconBounds,
      robotScale: robot?.scaleX ?? null,
      robotFootY: foot.y,
      groundY: canonicalGroundY,
      groundDelta: canonicalGroundY == null || foot.y == null ? null : foot.y - canonicalGroundY,
      enabledTargets: all.filter((item) => item?.input?.enabled).map((item) => item.name),
      targetCount: all.filter((item) => item?.input?.enabled).length,
      text: all.filter((item) => typeof item?.text === 'string').map((item) => item.text),
      errors: window.__ROBOTLAB_QA_ERRORS__ || [],
    };
  });
}
(async () => {
  fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const viewport of viewports) {
      const label = `${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      const page = await context.newPage();
      recordErrors(page, label);
      await page.goto(stageUrl('launch'), { waitUntil: 'commit', timeout: 45000 });
      await page.waitForFunction(() => {
        const game = window.__ROBOTLAB_GAME__;
        return Boolean(game?.scene.isActive('Mission10Scene') && game.registry.get('mission10Snapshot')?.stage === 'LAUNCH');
      }, null, { timeout: 90000 });
      await sleep(300);
      const metrics = await inspectLaunch(page);
      const robotLeft = metrics.robot?.x ?? null;
      const robotRight = metrics.robot?.right ?? null;
      const robotCenterX = metrics.robot?.centerX ?? null;
      const consoleLeft = metrics.layout?.launchConsole?.x ?? null;
      const robotConsoleGap = robotRight == null || consoleLeft == null ? null : consoleLeft - robotRight;
      const leftRatio = robotLeft == null ? null : robotLeft / viewport.width;
      const scaleDelta = metrics.layout?.robotScale == null || metrics.robotScale == null ? null : Math.abs(metrics.robotScale - metrics.layout.robotScale);
      const launchPass = Boolean(
        metrics.stage === 'LAUNCH'
        && metrics.semanticMode === 'DESKTOP'
        && robotLeft != null
        && robotRight != null
        && consoleLeft != null
        && leftRatio >= 0.07
        && leftRatio <= 0.12
        && robotConsoleGap >= 60
        && robotConsoleGap <= 180
        && Math.abs(metrics.groundDelta ?? 999) <= 0.5
        && scaleDelta != null
        && scaleDelta <= 0.0001
      );
      const output = path.join(shotDir, `release-final-launch-${label}.png`);
      if (requiredScreenshots.has(label)) {
        await page.screenshot({ path: output });
        report.screenshots.push(output);
      }
      const row = {
        label,
        robotLeft,
        robotRight,
        robotCenterX,
        consoleLeft,
        robotConsoleGap,
        robotFootY: metrics.robotFootY,
        groundY: metrics.groundY,
        groundDelta: metrics.groundDelta,
        robotScale: metrics.robotScale,
        expectedRobotScale: metrics.layout?.robotScale ?? null,
        robotScaleDelta: scaleDelta,
        leftRatio,
        pass: launchPass,
        metrics,
      };
      report.viewports.push(row);
      check(`${label}-launch-position`, launchPass, row);
      await context.close();
    }
    check('console-network-clean', report.errors.length === 0, report.errors);
    report.result = report.checks.every((item) => item.ok) ? 'PASS' : 'FAIL';
  } catch (error) {
    report.errors.push({ type: 'runner', message: error.stack || error.message });
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    if (report.result !== 'PASS') process.exitCode = 1;
  }
})();