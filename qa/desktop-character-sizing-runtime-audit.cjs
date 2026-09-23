const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = process.cwd();
const baseUrl = 'http://127.0.0.1:4198/';
const viewports = [
  { width: 1280, height: 720 },
  { width: 1438, height: 914 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
];
const screenshotViewports = new Set(['1280x720', '1600x900', '1920x1080']);
const screenshotRoot = path.join(root, 'docs/qa/screenshots/character-sizing');
fs.mkdirSync(screenshotRoot, { recursive: true });

const scenes = [
  { id: 'M1', label: 'Mission 1', enter: async (page) => enterGameScene(page, 0) },
  { id: 'M2', label: 'Mission 2', enter: async (page) => enterGameScene(page, 1) },
  { id: 'M3', label: 'Mission 3', enter: async (page) => enterGameScene(page, 2) },
  { id: 'M4', label: 'Mission 4', enter: async (page) => enterGameScene(page, 3) },
  { id: 'M5', label: 'Mission 5', enter: async (page) => enterGameScene(page, 4) },
  { id: 'M6', label: 'Mission 6', url: `${baseUrl}?qaMission=6` },
  { id: 'M7', label: 'Mission 7', url: `${baseUrl}?qaMission=7` },
  { id: 'M8', label: 'Mission 8', url: `${baseUrl}?qaMission=8` },
  { id: 'M9', label: 'Mission 9', url: `${baseUrl}?qaMission=9` },
  { id: 'M10', label: 'Mission 10', url: `${baseUrl}?qaMission=10&stage=path` },
  { id: 'M10_SIGNAL', label: 'Mission 10 Signal', url: `${baseUrl}?qaMission=10&stage=signal` },
  { id: 'TRANSITION', label: 'Transition', enter: async (page) => enterTransition(page) },
  { id: 'VICTORY', label: 'Victory', enter: async (page) => enterVictory(page) },
];

async function waitReady(page) {
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => window.__ROBOTLAB_QA__ && window.__ROBOTLAB_GAME__, null, { timeout: 15000 });
  await page.waitForTimeout(300);
}

async function enterGameScene(page, completedTasks) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.evaluate((completed) => {
    const qa = window.__ROBOTLAB_QA__;
    qa.characters = [];
    qa.sessionState.reset();
    for (let index = 0; index < completed; index += 1) qa.sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('GameScene');
  }, completedTasks);
  await page.waitForTimeout(450);
}

async function enterTransition(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.evaluate(() => {
    const qa = window.__ROBOTLAB_QA__;
    qa.characters = [];
    qa.sessionState.reset();
    for (let index = 0; index < 5; index += 1) qa.sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('TransitionScene');
  });
  await page.waitForTimeout(450);
}

async function enterVictory(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.evaluate(() => {
    const qa = window.__ROBOTLAB_QA__;
    qa.characters = [];
    qa.sessionState.reset();
    for (let index = 0; index < 10; index += 1) qa.sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('VictoryScene');
  });
  await page.waitForTimeout(450);
}

function key(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

function summarize(entry) {
  const ratio = entry.role === 'BOARD_ACTOR' && entry.minRatio === 0.65
    ? entry.visibleHeight / (entry.targetVisibleHeight / entry.targetRatio)
    : entry.visibleHeightRatio;
  return {
    scene: entry.scene,
    character: entry.characterId,
    role: entry.role,
    viewport: `${entry.viewportWidth}x${entry.viewportHeight}`,
    visiblePx: Number(entry.visibleHeight.toFixed(2)),
    visibleRatio: Number(ratio.toFixed(4)),
    targetRatio: entry.targetRatio,
    minRatio: entry.minRatio,
    maxRatio: entry.maxRatio,
    footDelta: Number(entry.footDelta.toFixed(2)),
    result: entry.result,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const allRows = [];
  const consoleMessages = [];
  const failedRequests = [];
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      page.on('console', (message) => {
        if (message.type() === 'error') consoleMessages.push({ viewport: key(viewport), text: message.text() });
      });
      page.on('requestfailed', (request) => failedRequests.push({ viewport: key(viewport), url: request.url(), failure: request.failure()?.errorText }));
      for (const scene of scenes) {
        if (scene.url) {
          await page.goto(scene.url, { waitUntil: 'domcontentloaded' });
          await waitReady(page);
        } else {
          await scene.enter(page);
        }
        const entries = await page.evaluate(() => window.__ROBOTLAB_QA__?.characters ?? []);
        const sceneRows = entries.map(summarize);
        for (const row of sceneRows) allRows.push({ requestedScene: scene.id, label: scene.label, ...row });
        fs.writeFileSync(path.join(root, 'docs/qa/desktop-character-sizing-audit.partial.json'), JSON.stringify({ viewport: key(viewport), scene: scene.id, rows: allRows }, null, 2));
        if (screenshotViewports.has(key(viewport))) {
          try {
            await page.screenshot({ path: path.join(screenshotRoot, `${scene.id.toLowerCase()}-${key(viewport)}.png`), fullPage: false, timeout: 12000 });
          } catch (error) {
            consoleMessages.push({ viewport: key(viewport), text: `screenshot skipped for ${scene.id}: ${error.message}` });
          }
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const failures = allRows.filter((row) => row.result !== 'PASS');
  const runtimeConsoleErrors = consoleMessages.filter((item) => !item.text.startsWith('screenshot skipped'));
  const screenshotWarnings = consoleMessages.filter((item) => item.text.startsWith('screenshot skipped'));
  const report = {
    generatedAt: new Date().toISOString(),
    viewports,
    rows: allRows,
    failures,
    consoleErrors: runtimeConsoleErrors,
    screenshotWarnings,
    failedRequests,
    result: failures.length === 0 && runtimeConsoleErrors.length === 0 && failedRequests.length === 0 ? 'PASS' : 'FAIL',
  };
  fs.writeFileSync(path.join(root, 'docs/qa/desktop-character-sizing-audit.json'), JSON.stringify(report, null, 2));

  const header = '| SCENE | CHARACTER | ROLE | VIEWPORT | VISIBLE PX | VISIBLE % | TARGET % | MIN % | MAX % | FOOT DELTA | RESULT |';
  const sep = '|---|---|---|---|---:|---:|---:|---:|---:|---:|---|';
  const lines = [header, sep, ...allRows.map((row) => `| ${row.requestedScene} | ${row.character} | ${row.role} | ${row.viewport} | ${row.visiblePx} | ${(row.visibleRatio * 100).toFixed(1)} | ${(row.targetRatio * 100).toFixed(1)} | ${(row.minRatio * 100).toFixed(1)} | ${(row.maxRatio * 100).toFixed(1)} | ${row.footDelta} | ${row.result} |`)];
  fs.writeFileSync(path.join(root, 'docs/qa/desktop-character-sizing-audit.md'), `# Desktop Character Sizing Audit\n\n${lines.join('\n')}\n`);
  fs.writeFileSync(path.join(root, 'docs/qa/character-sizing-golden-candidates.json'), JSON.stringify({ generatedAt: report.generatedAt, screenshotRoot: 'docs/qa/screenshots/character-sizing/', rows: allRows }, null, 2));
  fs.writeFileSync(path.join(root, 'docs/qa/desktop-character-sizing-playtest.json'), JSON.stringify({ agent: 'PLAYTEST ENGINEER', result: report.result, checkedScenes: scenes.map((scene) => scene.id), screenshots: 'docs/qa/screenshots/character-sizing/', consoleErrors: runtimeConsoleErrors.length, failedRequests: failedRequests.length }, null, 2));
  if (report.result !== 'PASS') {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ result: report.result, rows: allRows.length, screenshotRoot: 'docs/qa/screenshots/character-sizing/' }, null, 2));
})();




