const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const screenshotDir = path.join('docs', 'qa', 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage8-4b-child-readability.json');
const viewports = [
  ['short-740x360', 740, 360], ['short-844x390', 844, 390], ['short-915x412', 915, 412],
  ['browser-chrome-915x350', 915, 350], ['browser-chrome-915x330', 915, 330], ['minimum-short-915x320', 915, 320],
  ['portrait-390x844', 390, 844], ['portrait-412x915', 412, 915],
  ['tablet-768x1024', 768, 1024], ['tablet-1024x768', 1024, 768],
  ['desktop-1280x720', 1280, 720], ['desktop-1438x914', 1438, 914],
];

function captureErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('requestfailed', (request) => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`); });
  return errors;
}

const clean = (errors) => Object.values(errors).every((items) => items.length === 0);
const byRole = (audit, role) => (audit?.visibleObjectBounds || []).filter((item) => item.role === role);
const hitsByRole = (audit, role) => (audit?.interactiveHitBounds || []).filter((item) => item.role === role);

async function openMission(page, mission) {
  const sceneKey = mission <= 5 ? 'GameScene' : `Mission${mission}Scene`;
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'), undefined, { timeout: 60000 });
  await page.evaluate(async ({ sceneKey, completedTasks }) => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    sessionState.reset();
    for (let index = 0; index < completedTasks; index += 1) sessionState.completeCurrentTask();
    window.__ROBOTLAB_GAME__.scene.start(sceneKey);
  }, { sceneKey, completedTasks: mission - 1 });
  await page.waitForFunction(({ sceneKey, mission }) => {
    const scene = window.__ROBOTLAB_GAME__?.scene.getScene(sceneKey);
    if (!scene?.sys.isActive()) return false;
    if (mission === 5) return Boolean(scene.children.getByName('memory-task-card'));
    if (mission <= 4) return Boolean(scene.children.getByName('task-card'));
    return true;
  }, { sceneKey, mission }, { timeout: 60000 });
  await page.waitForTimeout(180);
  return sceneKey;
}

async function readAudit(page, sceneKey) {
  return page.evaluate((key) => {
    const game = window.__ROBOTLAB_GAME__;
    const layout = game.registry.get('responsiveLayout');
    const canvas = game.canvas.getBoundingClientRect();
    return {
      scene: key,
      semanticMode: layout?.semanticMode,
      canvas: { width: canvas.width, height: canvas.height },
      audit: game.registry.get('boundsAudit'),
    };
  }, sceneKey);
}

async function activatePoint(page, point, inputType) {
  if (inputType === 'touch') await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function exerciseMission2Input(page, inputType) {
  const point = await page.evaluate(async () => {
    const { sequenceMechanic } = await import('/src/game/mechanics/sequence.ts');
    const snapshot = sequenceMechanic.snapshot;
    const wrong = snapshot.optionKeys.find((key) => key !== snapshot.correctKey);
    const choice = window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
      .children.getByName('task-card').getByName(`choice-${wrong}`);
    const bounds = choice.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  });
  await activatePoint(page, point, inputType);
  await page.waitForFunction(async () => {
    const { sequenceMechanic } = await import('/src/game/mechanics/sequence.ts');
    return sequenceMechanic.snapshot.result === 'wrong';
  }, undefined, { timeout: 5000 });
  await page.waitForTimeout(360);
  return true;
}

async function exerciseMission5Input(page, inputType) {
  const point = await page.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
      .children.getByName('memory-task-card').list.find((item) => item.name?.startsWith('memory-card-'));
    const bounds = card.getBounds();
    return { x: bounds.centerX, y: bounds.centerY, name: card.name };
  });
  await activatePoint(page, point, inputType);
  await page.waitForFunction((name) => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
      .children.getByName('memory-task-card').getByName(name);
    return card?.getData('memoryState') !== 'FACE_DOWN';
  }, point.name, { timeout: 5000 });
  return true;
}

function mission2Checks(snapshot) {
  const { audit } = snapshot;
  const sequence = byRole(audit, 'SEQUENCE_SYMBOL');
  const cards = byRole(audit, 'ANSWER_CARD');
  const symbols = byRole(audit, 'ANSWER_SYMBOL');
  const hits = hitsByRole(audit, 'ANSWER_CARD');
  const short = snapshot.semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const occupancy = symbols.map((symbol, index) => symbol.height / Math.max(1, cards[index]?.height || 1));
  return {
    visibleMetricsPresent: sequence.length === 4 && cards.length === 4 && symbols.length === 4,
    hitMetricsPresent: hits.length === 4,
    sequenceReadable: !short || sequence.every((item) => Math.max(item.width, item.height) >= 47.5),
    answerCardsReadable: !short || cards.every((item) => item.width >= 80 && item.height >= 56),
    answerSymbolsOccupyCards: !short || occupancy.every((ratio) => ratio >= 0.55 && ratio <= 0.78),
    touchTargetsPass: hits.every((item) => item.width >= 56 && item.height >= 56),
    auditChildVisualPass: audit?.childVisualReadability === 'PASS',
    layoutClean: (audit?.overlapCount || 0) === 0 && (audit?.outsideSafeRect || []).length === 0,
  };
}

function mission5Checks(snapshot) {
  const { audit } = snapshot;
  const cards = byRole(audit, 'MEMORY_CARD');
  const artwork = byRole(audit, 'MEMORY_ARTWORK');
  const cardHits = hitsByRole(audit, 'MEMORY_CARD');
  const hint = byRole(audit, 'SECONDARY_ACTION')[0];
  const hintHit = hitsByRole(audit, 'SECONDARY_ACTION')[0];
  const short = snapshot.semanticMode === 'PHONE_LANDSCAPE_SHORT';
  const columns = new Set(cards.map((item) => Math.round(item.x))).size;
  const rows = new Set(cards.map((item) => Math.round(item.y))).size;
  const occupancy = artwork.map((item, index) => ({
    width: item.width / Math.max(1, cards[index]?.width || 1),
    height: item.height / Math.max(1, cards[index]?.height || 1),
  }));
  return {
    visibleMetricsPresent: cards.length === 8 && artwork.length === 8 && Boolean(hint),
    hitMetricsPresent: cardHits.length === 8 && Boolean(hintHit),
    fourByTwoGrid: !short || (columns === 4 && rows === 2),
    memoryCardsReadable: !short || cards.every((item) => item.width >= 90 && item.width <= 125 && item.height >= 58 && item.height <= 82),
    artworkOccupiesCard: !short || occupancy.every((ratio) => ratio.width >= 0.45 && ratio.height >= 0.65),
    hintSecondary: !short || (hint.width <= 124 && hint.width <= cards[0].width * 1.4),
    touchTargetsPass: cardHits.every((item) => item.width >= 56 && item.height >= 56) && hintHit?.height >= 56,
    auditChildVisualPass: audit?.childVisualReadability === 'PASS',
    layoutClean: (audit?.overlapCount || 0) === 0 && (audit?.outsideSafeRect || []).length === 0,
  };
}

async function captureMission2Wrong(page, file) {
  await page.evaluate(async () => {
    const { sequenceMechanic } = await import('/src/game/mechanics/sequence.ts');
    const snapshot = sequenceMechanic.snapshot;
    const wrong = snapshot.optionKeys.find((key) => key !== snapshot.correctKey);
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    card.getByName(`choice-${wrong}`)?.emit('pointerdown');
  });
  await page.waitForFunction(async () => {
    const { sequenceMechanic } = await import('/src/game/mechanics/sequence.ts');
    return sequenceMechanic.snapshot.result === 'wrong';
  });
  await page.screenshot({ path: file });
}

async function captureMission5Revealed(page, file) {
  await page.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('memory-task-card');
    const choices = card.list.filter((item) => item.name?.startsWith('memory-card-'));
    choices[0].emit('pointerdown');
    choices[1].emit('pointerdown');
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: file });
}

async function runMissionCase(browser, mission, viewport) {
  const [name, width, height] = viewport;
  const context = await browser.newContext({
    viewport: { width, height }, isMobile: width < 1000, hasTouch: width < 1100,
    deviceScaleFactor: name === 'short-844x390' ? 2 : 1, reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = captureErrors(page);
  const sceneKey = await openMission(page, mission);
  const snapshot = await readAudit(page, sceneKey);
  const checks = mission === 2 ? mission2Checks(snapshot) : mission5Checks(snapshot);
  checks.canvasMatchesViewport = Math.round(snapshot.canvas.width) === width && Math.round(snapshot.canvas.height) === height;
  checks.browserClean = clean(errors);
  const caseName = `mission${mission}-${name}`;
  const requiredInitial = new Set([
    'mission2-short-844x390', 'mission2-browser-chrome-915x350', 'mission2-portrait-390x844', 'mission2-desktop-1280x720',
    'mission5-short-844x390', 'mission5-portrait-390x844', 'mission5-desktop-1280x720',
  ]);
  let initialScreenshot = null;
  if (requiredInitial.has(caseName)) {
    initialScreenshot = path.join(screenshotDir, `stage8-4b-${caseName}-initial.png`);
    await page.screenshot({ path: initialScreenshot });
  }
  if (caseName === 'mission2-short-844x390') checks.realTouchFlow = await exerciseMission2Input(page, 'touch');
  if (caseName === 'mission2-desktop-1280x720') checks.realMouseFlow = await exerciseMission2Input(page, 'mouse');
  if (caseName === 'mission5-short-844x390') checks.realTouchFlow = await exerciseMission5Input(page, 'touch');
  if (caseName === 'mission5-desktop-1280x720') checks.realMouseFlow = await exerciseMission5Input(page, 'mouse');
  let stateScreenshot = null;
  if (caseName === 'mission2-short-844x390' || caseName === 'mission2-browser-chrome-915x350') {
    stateScreenshot = path.join(screenshotDir, `stage8-4b-${caseName}-wrong.png`);
    await captureMission2Wrong(page, stateScreenshot);
  } else if (caseName === 'mission5-short-844x390') {
    stateScreenshot = path.join(screenshotDir, 'stage8-4b-mission5-short-844x390-two-revealed.png');
    await captureMission5Revealed(page, stateScreenshot);
  }
  await context.close();
  return { name: caseName, mission, width, height, snapshot, checks, errors, initialScreenshot, stateScreenshot };
}

async function auditMission(browser, mission) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = captureErrors(page);
  const sceneKey = await openMission(page, mission);
  const snapshot = await readAudit(page, sceneKey);
  let screenshot = null;
  if (mission === 3) {
    screenshot = path.join(screenshotDir, 'stage8-4b-mission3-short-844x390-audit.png');
    await page.screenshot({ path: screenshot });
  }
  await context.close();
  return {
    mission, sceneKey,
    childVisualReadability: snapshot.audit?.childVisualReadability || 'NOT_MEASURED',
    undersizedVisibleObjects: snapshot.audit?.undersizedVisibleObjects || [],
    undersizedTouchTargets: snapshot.audit?.undersizedTouchTargets || [],
    visibleObjectBounds: snapshot.audit?.visibleObjectBounds || [],
    browserClean: clean(errors), errors, screenshot,
  };
}

(async () => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const cases = [];
  for (const mission of [2, 5]) for (const viewport of viewports) cases.push(await runMissionCase(browser, mission, viewport));
  const missionAudits = [];
  for (let mission = 1; mission <= 8; mission += 1) missionAudits.push(await auditMission(browser, mission));
  await browser.close();
  const failures = cases.flatMap((entry) => Object.entries(entry.checks).filter(([, pass]) => !pass).map(([check]) => `${entry.name}:${check}`));
  const confirmedUndersizedMissions = missionAudits.filter((entry) => entry.undersizedVisibleObjects.length).map((entry) => entry.mission);
  const auditFailures = missionAudits.flatMap((entry) => [
    ...entry.undersizedTouchTargets.map((name) => `mission${entry.mission}:touch:${name}`),
    ...(entry.childVisualReadability === 'FAIL' ? [`mission${entry.mission}:childVisualReadability`] : []),
    ...(entry.browserClean ? [] : [`mission${entry.mission}:browserClean`]),
  ]);
  const report = {
    generatedAt: new Date().toISOString(),
    distinctions: {
      TOUCH_TARGET_PASS: 'Interactive hit bounds are independently measured in CSS pixels.',
      CHILD_VISUAL_READABILITY_PASS: 'Visible-alpha artwork and explicit visual-card bounds meet child-facing thresholds and screenshots pass manual review.',
    },
    cases, missionAudits, confirmedUndersizedMissions,
    failures: [...failures, ...auditFailures],
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    cases: cases.length,
    missionAudits: missionAudits.map(({ mission, childVisualReadability, undersizedVisibleObjects, undersizedTouchTargets, browserClean }) => ({ mission, childVisualReadability, undersizedVisibleObjects, undersizedTouchTargets, browserClean })),
    confirmedUndersizedMissions, failures: report.failures,
  }, null, 2));
  if (report.failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
