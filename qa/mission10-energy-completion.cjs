const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const completionCount = Number.parseInt(process.env.COMPLETION_COUNT || '10', 10);
const reportPath = path.join('docs', 'qa', 'runs', 'mission10-energy-completion-stable.json');

async function openEnergy(page) {
  const url = new URL(baseUrl);
  url.searchParams.set('qaMission', '10');
  url.searchParams.set('stage', 'energy');
  await page.goto(url.toString(), { waitUntil: 'commit', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.registry.get('mission10Snapshot')?.stage === 'ENERGY', null, { timeout: 90000 });
  await sleep(80);
}

async function state(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const relays = [];
    const visit = (item) => {
      if (/^mission10-relay-r[123]$/.test(item?.name || '')) {
        const matrix = item.getWorldTransformMatrix();
        relays.push({ relayId: item.getData('relayId'), x: matrix.tx, y: matrix.ty });
      }
      if (Array.isArray(item?.list)) item.list.forEach(visit);
    };
    scene.children.list.forEach(visit);
    return { snapshot: game.registry.get('mission10Snapshot'), relays, sceneActive: game.scene.isActive('Mission10Scene') };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling'] });
  const results = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const prior = process.env.COMPLETION_RESET === '1' || !fs.existsSync(reportPath)
      ? [] : JSON.parse(fs.readFileSync(reportPath, 'utf8')).completions;
    for (let run = 0; run < completionCount; run += 1) {
      await openEnergy(page);
      let current = await state(page);
      let taps = 0;
      while (current.snapshot.stage === 'ENERGY' && taps < 40) {
        const relay = current.relays.find(({ relayId }) => current.snapshot.relayOrientations[relayId] !== 0);
        if (!relay) break;
        await page.mouse.click(relay.x, relay.y);
        await sleep(300);
        current = await state(page);
        taps += 1;
      }
      await sleep(20);
      current = await state(page);
      results.push({ run: prior.length + run + 1, taps, stage: current.snapshot.stage, sceneActive: current.sceneActive, pass: current.snapshot.stage === 'SIGNAL' && current.sceneActive });
    }
    await context.close();
    const completions = [...prior, ...results];
    const failed = completions.filter((result) => !result.pass);
    const report = { result: failed.length === 0 ? 'PASS' : 'FAIL', completions, failures: failed.length };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify(report) + '\n');
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => { process.stderr.write((error.stack || error.message) + '\n'); process.exitCode = 1; });
