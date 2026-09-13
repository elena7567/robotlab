const { chromium } = require('playwright');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pointFor(page, name) {
  return page.evaluate((name) => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene');
    const walk = (item) => {
      if (item?.name === name) return item;
      if (item?.list) for (const child of item.list) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    const target = scene.children.list.map(walk).find(Boolean);
    if (!target) throw new Error(`Missing ${name}`);
    return target.getWorldTransformMatrix().transformPoint(0, 0);
  }, name);
}

(async () => {
  console.log('launch');
  const browser = await chromium.launch({ headless: true });
  console.log('page');
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (message) => console.log('console', message.type(), message.text()));
  page.on('pageerror', (error) => console.log('pageerror', error.message));
  page.on('requestfailed', (request) => console.log('requestfailed', request.url(), request.failure()?.errorText));
  page.on('response', (response) => { if (!response.ok()) console.log('badresponse', response.status(), response.url()); });
  console.log('goto');
  await page.goto('http://127.0.0.1:4198/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await sleep(2000);
  console.log(await page.evaluate(() => ({
    title: document.title,
    body: document.body?.innerText?.slice(0, 300),
    scripts: [...document.scripts].map((script) => script.src || script.textContent?.slice(0, 50)),
    hasGame: Boolean(window.__ROBOTLAB_GAME__),
    hasQa: Boolean(window.__ROBOTLAB_QA__),
    keys: Object.keys(window).filter((key) => key.includes('ROBOTLAB')),
  })));
  console.log('wait');
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__ && window.__ROBOTLAB_QA__ && window.__ROBOTLAB_GAME__.textures.exists('MISSION9_BRIDGE_CORRECT'), null, { timeout: 10000 });
  console.log('start scene');
  await page.evaluate(() => {
    const { sessionState, robotTestCourse } = window.__ROBOTLAB_QA__;
    sessionState.reset();
    robotTestCourse.reset();
    for (let index = 0; index < 8; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start('Mission9Scene');
  });
  await sleep(300);
  console.log('inspect');
  const state = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (item?.list) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const target = all.find((item) => item?.name === 'mission9-bridge-gap-target');
    const drop = target.getData('dropTargetBounds');
    return { drop, stage: window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage };
  });
  const start = await pointFor(page, 'mission9-choice-bridge-correct');
  console.log('drag', start, state.drop);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(state.drop.x + state.drop.width / 2, state.drop.y + state.drop.height / 2, { steps: 8 });
  await page.mouse.up();
  await sleep(1200);
  console.log('after');
  const after = await page.evaluate(() => window.__ROBOTLAB_QA__.robotTestCourse.snapshot);
  await browser.close();
  console.log(JSON.stringify({ before: state, after }, null, 2));
})();
