const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const shortHead = head.slice(0, 7);
const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const bundle = html.match(/\/assets\/(index-[^"?]+\.js)/)?.[1];
if (!bundle) throw new Error('Production bundle was not found in dist/index.html.');

const screenshotDir = path.join(root, 'docs', 'qa', 'screenshots');
const reportPath = path.join(root, 'docs', 'qa', `mission10-build-verification-${shortHead}.json`);
fs.mkdirSync(screenshotDir, { recursive: true });

const report = {
  head,
  shortHead,
  bundle,
  baseUrl,
  browser: null,
  errors: [],
};

function assert(condition, message, details) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(details)}`);
}

async function inspectStage(browser, stage) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const runtimeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => runtimeErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (response.status() >= 400) runtimeErrors.push(`http-${response.status()}: ${response.url()}`);
  });

  const url = new URL(baseUrl);
  url.searchParams.set('qaMission', '10');
  url.searchParams.set('stage', stage);
  url.searchParams.set('buildDebug', '1');
  url.searchParams.set('review', shortHead);
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(
    (wanted) => window.__ROBOTLAB_QA__?.mission10Controller.snapshot.stage === wanted &&
      window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene'),
    stage.toUpperCase(),
    { timeout: 30000 },
  );
  await page.waitForTimeout(500);

  const runtime = await page.evaluate((wantedStage) => {
    const game = window.__ROBOTLAB_GAME__;
    const qa = window.__ROBOTLAB_QA__;
    const scripts = [...document.scripts].map((script) => script.src).filter(Boolean);
    const responsive = game.registry.get('responsiveLayout');
    const composition = game.registry.get('sceneComposition');
    const presentation = game.registry.get(
      wantedStage === 'path' ? 'mission10PathPresentation' : 'mission10SignalPresentation',
    );
    const characterId = wantedStage === 'path' ? 'mission10-path-robot' : 'mission10-signal-robot';
    const character = [...(qa.characters || [])].reverse().find((item) =>
      item.scene === 'Mission10Scene' && item.characterId === characterId);
    return {
      build: qa.build,
      debugText: document.querySelector('#robotlab-build-debug')?.textContent || null,
      scripts,
      stage: qa.mission10Controller.snapshot.stage,
      semanticMode: responsive?.semanticMode,
      policyId: composition?.policyId,
      presentation,
      character,
    };
  }, stage);

  const domBundle = runtime.scripts.map((src) => new URL(src).pathname.split('/').pop()).find((name) => name?.endsWith('.js'));
  assert(runtime.build?.gitHead === head, 'Runtime git HEAD mismatch', runtime.build);
  assert(runtime.build?.mainJsBundle === bundle, 'Runtime bundle mismatch', runtime.build);
  assert(domBundle === bundle, 'DOM bundle mismatch', { domBundle, bundle });
  assert(runtime.debugText?.includes(head) && runtime.debugText.includes(bundle), 'Debug stamp mismatch', runtime.debugText);
  assert(runtime.semanticMode === 'DESKTOP', 'Unexpected responsive mode', runtime.semanticMode);
  assert(runtime.policyId === 'MISSION_10_DESKTOP', 'Unexpected composition policy', runtime.policyId);
  assert(runtime.character?.role === 'WORLD_SUPPORT', 'Unexpected character role', runtime.character);
  assert(runtimeErrors.length === 0, 'Browser runtime errors', runtimeErrors);

  const screenshot = path.join(screenshotDir, `mission10-${stage}-${shortHead}-1600x900.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.close();
  return { url: url.href, runtime, domBundle, runtimeErrors, screenshot };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    report.browser = {
      path: await inspectStage(browser, 'path'),
      signal: await inspectStage(browser, 'signal'),
    };
    const bounds = report.browser.path.runtime.presentation;
    assert(Number.isFinite(bounds?.groupVisibleLeft), 'PATH left bound missing', bounds);
    assert(Number.isFinite(bounds?.groupVisibleRight), 'PATH right bound missing', bounds);
    assert(Math.abs(bounds.groupVisibleLeft - 452) <= 16, 'PATH left bound is not new geometry', bounds);
    assert(Math.abs(bounds.groupVisibleRight - 1160) <= 16, 'PATH right bound is not new geometry', bounds);
  } catch (error) {
    report.errors.push(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ reportPath, ...report }, null, 2));
  }
})();
