const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const reportPath = path.join('docs', 'qa', 'mission10-signal-lifecycle-audit.json');
const report = { result: 'FAIL', errors: [], samples: [] };
const expectedReflectors = { SIGNAL_A: 2, SIGNAL_B: 2, SIGNAL_C: 3 };

function inspect() {
  const game = window.__ROBOTLAB_GAME__;
  const scene = game.scene.getScene('Mission10Scene');
  const all = [];
  const walk = (object, parent = 'scene') => {
    all.push({ object, parent });
    if (Array.isArray(object?.list)) object.list.forEach((child) => walk(child, object.name || object.type || 'unnamed'));
  };
  scene.children.list.forEach((object) => walk(object));
  const matching = all.filter(({ object }) => /signal|reflector|mirror|receiver|presentation|beam/i.test(object?.name || ''));
  const named = (name) => matching.filter(({ object }) => object.name === name);
  const reflectors = matching.filter(({ object }) => /^mission10-reflector-m\d+$/.test(object.name || ''));
  return {
    stage: window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage,
    configId: window.__ROBOTLAB_QA__.mission10Controller.snapshot.signalConfigId,
    roots: named('MISSION10_SIGNAL_PUZZLE_GROUP').length,
    reflectors: reflectors.map(({ object, parent }) => ({ name: object.name, type: object.type, x: object.x, y: object.y, visible: object.visible, active: object.active, parent })),
    receiver: named('mission10-signal-receiver').length,
    source: named('mission10-signal-emitter').length,
    beam: named('mission10-signal-beam').length,
    targets: matching.filter(({ object }) => /^mission10-reflector-target-/.test(object.name || '')).map(({ object }) => ({ id: object.getData('reflectorId'), x: object.x, y: object.y })),
  };
}

function validate(sample) {
  const expected = expectedReflectors[sample.configId];
  return (sample.stage === 'SIGNAL' || sample.stage === 'LAUNCH')
    && sample.roots === 1
    && sample.reflectors.length === expected
    && new Set(sample.reflectors.map((item) => item.name)).size === expected
    && sample.receiver === 1
    && sample.source === 1
    && sample.beam === 1;
}

async function chooseConfig(page, configId) {
  await page.evaluate((requested) => {
    const controller = window.__ROBOTLAB_QA__.mission10Controller;
    for (let seed = 0; seed < 100; seed += 1) {
      controller.initializeStageShortcut('signal', seed);
      if (controller.snapshot.signalConfigId === requested) break;
    }
    window.__ROBOTLAB_GAME__.scene.start('Mission10Scene');
  }, configId);
  await page.waitForFunction(() => window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage === 'SIGNAL', null, { timeout: 10000 });
  await page.waitForTimeout(80);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
    await page.goto('http://127.0.0.1:4198/?qaMission=10&stage=signal', { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene'), null, { timeout: 90000 });
    for (const configId of Object.keys(expectedReflectors)) {
      await chooseConfig(page, configId);
      for (let tap = 0; tap <= 2; tap += 1) {
        const sample = await page.evaluate(inspect);
        report.samples.push({ configId, tap, ...sample, valid: validate(sample) });
        if (tap === 2) break;
        const target = sample.targets[tap % sample.targets.length];
        await page.mouse.click(target.x, target.y);
        await page.waitForTimeout(60);
      }
    }
  } catch (error) {
    report.errors.push(error.stack || error.message);
  } finally {
    await browser.close();
  }
  report.result = report.errors.length === 0 && report.samples.length === 9 && report.samples.every((sample) => sample.valid) ? 'PASS' : 'FAIL';
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify({ result: report.result, samples: report.samples.length, errors: report.errors }) + '\n');
  if (report.result === 'FAIL') process.exitCode = 1;
})();
