const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const reportPath = path.join('docs', 'qa', 'stage9-3-mission8-to-mission9-handoff.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pointFor(page, sceneKey, name) {
  return page.evaluate(({ sceneKey, name }) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene(sceneKey);
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Missing ${sceneKey}/${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, { sceneKey, name });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (!response.ok()) errors.responses.push(`${response.status()} ${response.url()}`); });

  await page.goto(baseUrl, { waitUntil: 'commit', timeout: 90000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__
    && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_BRIDGE_CORRECT'), null, { timeout: 90000 });
  await page.evaluate(() => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission8Scene');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission8Scene')
    && window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene').children.getByName('mission8-continue'), null, { timeout: 7000 });
  const point = await pointFor(page, 'Mission8Scene', 'mission8-continue');
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.isActive('Mission9Scene')
    && window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage === 'BRIDGE', null, { timeout: 7000 });
  await sleep(220);
  const report = {
    viewport: '844x390',
    from: 'Mission8Scene',
    to: 'Mission9Scene',
    stage: await page.evaluate(() => window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage),
    errors,
    failures: Object.values(errors).some((entries) => entries.length) ? ['runtime-errors'] : [],
  };
  await context.close();
  await browser.close();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
