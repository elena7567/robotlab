const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const reportPath = path.join('docs', 'qa', 'runs', 'mission10-energy-input-race.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = { result: 'FAIL', deterministic: null, randomized: [], errors: [] };
const randomCount = Number.parseInt(process.env.RACE_RANDOM_COUNT || '30', 10);

function center(box) { return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }

async function openEnergy(page) {
  const next = new URL(baseUrl);
  next.searchParams.set('qaMission', '10');
  next.searchParams.set('stage', 'energy');
  await page.goto(next.toString(), { waitUntil: 'commit', timeout: 45000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.registry.get('mission10Snapshot')?.stage === 'ENERGY', null, { timeout: 90000 });
  await sleep(180);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission10Scene');
    const all = [];
    const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
    scene.children.list.forEach(walk);
    const relayNodes = all.filter((item) => /^mission10-relay-r[123]$/.test(item?.name || '')).map((item) => {
      const matrix = item.getWorldTransformMatrix();
      return { relayId: item.getData('relayId'), x: matrix.tx - 60, y: matrix.ty - 60, width: 120, height: 120 };
    });
    const snapshot = game.registry.get('mission10Snapshot');
    const evaluation = game.registry.get('mission10EnergyEvaluation') || null;
    const contract = game.registry.get('mission10SceneContract') || null;
    const pointerTarget = scene.pointerTarget;
    return {
      snapshot,
      relayNodes,
      energyEvaluation: evaluation,
      inputEnabled: relayNodes.filter((node) => all.some((item) => item.getData?.('relayId') === node.relayId && item.input?.enabled)).length,
      interactionLock: scene.interactionLocked,
      transitionLock: snapshot.stage !== 'ENERGY',
      pointerOwner: scene.pointerOwner,
      pointerTarget: pointerTarget ? { active: pointerTarget.active, name: pointerTarget.name } : null,
      activeTweens: scene.tweens.getTweens().map((tween) => ({ state: tween.state, totalProgress: tween.totalProgress })),
      activeTimers: scene.timers.filter((timer) => !timer.hasDispatched).map((timer) => ({ delay: timer.delay, elapsed: timer.getElapsed?.() ?? null })),
      pointerHandlers: relayNodes.length * 3,
      currentValidPath: evaluation?.receiverPowered ?? null,
      lastValidNode: evaluation?.connectedRelayCount ?? null,
      blinkingRelay: all.find((item) => item?.name === 'mission10-energy-break-spark')?.parentContainer?.getData?.('relayId') ?? null,
      sceneActive: game.scene.isActive('Mission10Scene'),
      solved: snapshot.stage !== 'ENERGY',
      contract,
    };
  });
}

async function runHeldRefresh(page, delayMs) {
  await openEnergy(page);
  const initial = await inspect(page);
  const first = initial.relayNodes[0];
  const held = initial.relayNodes[1];
  await page.mouse.click(center(first).x, center(first).y);
  await sleep(delayMs);
  await page.mouse.move(center(held).x, center(held).y);
  await page.mouse.down();
  await sleep(120);
  const stuck = await inspect(page);
  await page.mouse.up();
  await page.waitForFunction(() => !window.__ROBOTLAB_GAME__?.scene.getScene('Mission10Scene')?.interactionLocked, null, { timeout: 3000 });
  const beforeRecovery = await inspect(page);
  const retry = beforeRecovery.relayNodes[2];
  const orientationBefore = beforeRecovery.snapshot.relayOrientations[retry.relayId];
  await page.mouse.click(center(retry).x, center(retry).y);
  await sleep(240);
  const afterRecovery = await inspect(page);
  const orientationAfter = afterRecovery.snapshot.relayOrientations[retry.relayId];
  return {
    delayMs,
    initial,
    stuck,
    beforeRecovery,
    afterRecovery,
    permanentlyLocked: stuck.snapshot.stage === 'ENERGY'
      && stuck.interactionLock === false
      && stuck.pointerOwner !== null
      && orientationBefore === orientationAfter,
  };
}

async function runRandomSequence(page, sequenceIndex) {
  await openEnergy(page);
  for (let step = 0; step < 8; step += 1) {
    const state = await inspect(page);
    if (state.snapshot.stage !== 'ENERGY') break;
    const relay = state.relayNodes[(sequenceIndex + step * 2) % state.relayNodes.length];
    const point = center(relay);
    if ((sequenceIndex + step) % 3 === 0) {
      await page.mouse.click(point.x, point.y);
      await sleep(145 + ((sequenceIndex * 7 + step * 11) % 25));
      const latest = await inspect(page);
      const held = latest.relayNodes[(sequenceIndex + step + 1) % latest.relayNodes.length];
      await page.mouse.move(center(held).x, center(held).y);
      await page.mouse.down();
      await sleep(80);
      await page.mouse.up();
    } else {
      await page.mouse.click(point.x, point.y);
    }
    await sleep(220);
    const after = await inspect(page);
    if (after.snapshot.stage === 'ENERGY' && after.interactionLock === false && after.pointerOwner !== null) {
      return { sequenceIndex, pass: false, state: after };
    }
  }
  return { sequenceIndex, pass: true, state: await inspect(page) };
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ type: 'console', message: message.text() }); });
    page.on('pageerror', (error) => report.errors.push({ type: 'page', message: error.stack || error.message }));
    report.deterministic = await runHeldRefresh(page, 145);
    for (let index = 0; index < randomCount; index += 1) report.randomized.push(await runRandomSequence(page, index));
    await context.close();
    const randomFailures = report.randomized.filter((item) => !item.pass);
    report.result = report.deterministic.permanentlyLocked && (randomCount === 0 || randomFailures.length > 0) && report.errors.length === 0 ? 'REPRODUCED' : 'NOT_REPRODUCED';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify({ result: report.result, random: report.randomized.length, randomFailures: randomFailures.length, errors: report.errors.length }) + '\n');
  } finally {
    await browser.close();
  }
})().catch((error) => { process.stderr.write((error.stack || error.message) + '\n'); process.exitCode = 1; });
