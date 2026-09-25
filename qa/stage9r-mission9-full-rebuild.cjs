const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-pid${process.pid}`;
const screenshotDir = path.join('docs', 'qa', 'runs', 'mission9', runId, 'screenshots');
const reportPath = path.join('docs', 'qa', 'stage9r-mission9-full-rebuild.json');
const stages = ['BRIDGE', 'GATE', 'POWER'];
const nextStage = { BRIDGE: 'GATE', GATE: 'POWER', POWER: 'COMPLETE' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const COPY = {
  completionTitle: '\u0418\u0421\u041f\u042b\u0422\u0410\u041d\u0418\u0415 \u041f\u0420\u041e\u0419\u0414\u0415\u041d\u041e',
  completionSubtitle: '\u0420\u041e\u0411\u041e\u0422 \u0413\u041e\u0422\u041e\u0412 \u041a \u041f\u0415\u0420\u0412\u041e\u041c\u0423 \u0417\u0410\u041f\u0423\u0421\u041a\u0423',
  continueToBeacon: '\u041a \u041c\u0410\u042f\u041a\u0423',
  rotate: '\u041f\u041e\u0412\u0415\u0420\u041d\u0418 \u0422\u0415\u041b\u0415\u0424\u041e\u041d',
  landscape: '\u0418\u0413\u0420\u0410\u0415\u041c \u0413\u041e\u0420\u0418\u0417\u041e\u041d\u0422\u0410\u041b\u042c\u041d\u041e',
};

const SOLVED_COPY = {
  BRIDGE: '\u041c\u041e\u0421\u0422 \u0413\u041e\u0422\u041e\u0412',
  GATE: '\u0412\u041e\u0420\u041e\u0422\u0410 \u041e\u0422\u041a\u0420\u042b\u0422\u042b',
  POWER: '\u0421\u0422\u0410\u041d\u0426\u0418\u042f \u0417\u0410\u041f\u0423\u0429\u0415\u041d\u0410',
};
function recordErrors(page) {
  const errors = { console: [], page: [], requests: [], responses: [] };
  page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
  page.on('pageerror', (error) => errors.page.push(error.stack || error.message));
  page.on('requestfailed', (request) => errors.requests.push(request.url() + ': ' + (request.failure()?.errorText || 'unknown failure')));
  page.on('response', (response) => { if (response.status() >= 400) errors.responses.push(response.status() + ' ' + response.url()); });
  return errors;
}

function clean(errors) {
  return errors.console.length === 0 && errors.requests.length === 0 && errors.responses.length === 0
    && errors.page.filter((message) => message !== 'Framebuffer status: Framebuffer Unsupported').length === 0;
}

function missionUrl(stage) {
  const url = new URL(baseUrl);
  url.searchParams.set('qaMission', '9');
  if (stage) url.searchParams.set('stage', stage.toLowerCase());
  return url.toString();
}

async function openMission(page, stage = 'BRIDGE') {
  await page.goto(missionUrl(stage), { waitUntil: 'commit', timeout: 45000 });
  await page.waitForFunction((expected) => {
    const game = window.__ROBOTLAB_GAME__;
    return Boolean(game && window.__ROBOTLAB_QA__ && game.scene.isActive('Mission9Scene')
      && game.registry.get('mission9PuzzleContract')?.stage === expected);
  }, stage, { timeout: 90000 });
  await sleep(250);
}

async function inspect(page) {
  return page.evaluate(() => {
    const game = window.__ROBOTLAB_GAME__;
    const scene = game.scene.getScene('Mission9Scene');
    const all = [];
    const walk = (item) => {
      all.push(item);
      if (Array.isArray(item?.list)) item.list.forEach(walk);
    };
    scene.children.list.forEach(walk);
    const boundsOf = (item) => {
      const bounds = item?.getBounds?.();
      return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null;
    };
    const cards = all.filter((item) => item?.getData?.('candidateId')).map((item) => {
      const image = item.list?.find((child) => child?.texture?.key);
      return {
        candidateId: item.getData('candidateId'), assetKey: item.getData('assetKey'),
        assetFamily: item.getData('assetFamily'), runtimeTexture: image?.texture?.key || null,
        bounds: boundsOf(item), auditBounds: { ...(item.getData('auditBounds') || {}) },
        baseX: item.getData('baseX'), baseY: item.getData('baseY'),
        x: item.x, y: item.y, alpha: item.alpha, depth: item.depth, interactive: Boolean(item.input?.enabled),
      };
    });
    const targets = all.filter((item) => item?.getData?.('targetId')).map((item) => ({
      targetId: item.getData('targetId'), clueId: item.getData('clueId'),
      bounds: boundsOf(item), interactive: Boolean(item.input?.enabled),
    }));
    const contract = game.registry.get('mission9PuzzleContract') || null;
    const layout = game.registry.get('sceneComposition')?.mission9 || null;
    const texts = all.filter((item) => typeof item?.text === 'string').map((item) => item.text);
    const missionTextures = all.map((item) => item?.texture?.key)
      .filter((key) => typeof key === 'string' && key.startsWith('MISSION9_'));
    return {
      stage: window.__ROBOTLAB_QA__.robotTestCourse.snapshot.courseStage,
      snapshot: { ...window.__ROBOTLAB_QA__.robotTestCourse.snapshot },
      contract: contract ? { ...contract, candidateIds: [...contract.candidateIds], candidateTextures: [...contract.candidateTextures] } : null,
      interaction: { ...(game.registry.get('mission9InteractionSnapshot') || {}) },
      selectedCandidateId: game.registry.get('mission9SelectedAction') || null,
      dragEnabled: game.registry.get('mission9DragEnabled'),
      grounding: { ...(game.registry.get('mission9Grounding') || {}) },
      layout: layout ? { platformCenterX: layout.platformCenterX, platformContactY: layout.platformContactY } : null,
      cards, targets, missionTextures, labels: texts,
      rootCount: all.filter((item) => item?.name === 'mission9-stage-root').length,
      completionCount: all.filter((item) => item?.name === 'mission9-completion').length,
      completionRegions: all.map((item) => item?.getData?.('completionRegion')).filter(Boolean),
      orientationCount: all.filter((item) => item?.name === 'mission9-orientation-gate').length,
    };
  });
}

const center = (bounds) => ({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });

function familyMatches(stage, key) {
  if (stage === 'BRIDGE') return key.startsWith('MISSION9_BRIDGE_');
  if (stage === 'GATE') return key.startsWith('MISSION9_GATE_');
  return key.startsWith('MISSION9_POWER_') || key.startsWith('MISSION9_ENERGY_');
}

function stageChecks(state, label) {
  const contract = state.contract;
  const target = state.targets[0];
  const correct = contract && state.cards.find((card) => card.candidateId === contract.correctCandidateId);
  const sorted = [...state.cards].sort((a, b) => a.bounds.x - b.bounds.x);
  const rowCenter = sorted.length
    ? (sorted[0].baseX + sorted[sorted.length - 1].baseX) / 2
    : null;
  const targetCenter = target?.bounds ? center(target.bounds) : null;
  return [
    { name: label + '-contract-stage', ok: contract?.stage === state.stage && stages.includes(state.stage) },
    { name: label + '-one-stage-root', ok: state.rootCount === 1, actual: state.rootCount },
    { name: label + '-three-candidates', ok: state.cards.length === 3, actual: state.cards.length },
    { name: label + '-one-target', ok: state.targets.length === 1, actual: state.targets.length },
    { name: label + '-semantic-clue', ok: Boolean(contract && target && contract.clueId === contract.correctCandidateId
      && target.clueId === contract.clueId && target.targetId === contract.targetId), contract, target },
    { name: label + '-unique-semantic-ids', ok: contract?.candidateIds?.length === 3 && new Set(contract.candidateIds).size === 3 },
    { name: label + '-correct-runtime-texture', ok: Boolean(correct && correct.assetKey === correct.runtimeTexture
      && contract.candidateTextures[contract.candidateIds.indexOf(contract.correctCandidateId)] === correct.runtimeTexture), correct },
    { name: label + '-asset-family', ok: state.cards.every((card) => card.assetFamily === contract?.assetFamily)
      && state.missionTextures.every((key) => familyMatches(state.stage, key)), textures: state.missionTextures },
    { name: label + '-drag-disabled', ok: state.dragEnabled === false, actual: state.dragEnabled },
    { name: label + '-grounding-delta', ok: Number.isFinite(state.grounding.delta) && Math.abs(state.grounding.delta) <= 1, grounding: state.grounding },
    { name: label + '-platform-centered-target', ok: Boolean(targetCenter && Math.abs(targetCenter.x - state.layout.platformCenterX) <= 2), targetCenter, platformCenterX: state.layout?.platformCenterX },
    { name: label + '-platform-centered-row', ok: rowCenter !== null && Math.abs(rowCenter - state.layout.platformCenterX) <= 2, rowCenter, platformCenterX: state.layout?.platformCenterX },
    { name: label + '-cards-interactive', ok: state.cards.every((card) => card.interactive) },
  ];
}

async function inputFor(context, page, kind) {
  return { kind, client: kind === 'touch' ? await context.newCDPSession(page) : null };
}

async function tap(page, input, point, pause = 180) {
  if (input.kind === 'touch') {
    await input.client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
    await input.client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.click(point.x, point.y);
  }
  if (pause) await sleep(pause);
}

async function shot(page, name) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const output = path.join(screenshotDir, 'stage9r-mission9-' + name + '.png');
  await page.screenshot({ path: output });
  return output;
}

const cardById = (state, id) => state.cards.find((card) => card.candidateId === id);

function cardGap(state) {
  const cards = [...state.cards].sort((a, b) => a.bounds.x - b.bounds.x);
  const left = cards[0].auditBounds;
  const right = cards[1].auditBounds;
  return { x: (left.x + left.width + right.x) / 2, y: left.y + left.height / 2 };
}

async function waitStage(page, expected) {
  try {
    if (expected === 'COMPLETE') {
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__.registry.get('mission9Complete') === true
        && window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-completion'), null, { timeout: 10000 });
    } else {
      await page.waitForFunction((stage) => window.__ROBOTLAB_GAME__.registry.get('mission9PuzzleContract')?.stage === stage, expected, { timeout: 10000 });
    }
    await sleep(180);
    return true;
  } catch {
    return false;
  }
}

async function waitSelected(page, candidateId) {
  try {
    await page.waitForFunction((id) => {
      const interaction = window.__ROBOTLAB_GAME__?.registry.get('mission9InteractionSnapshot');
      return interaction?.state === 'SELECTED' && interaction.selectedCandidateId === id;
    }, candidateId, { timeout: 5000 });
  } catch {}
}

async function playStage(page, input, viewport, stage, screenshots, desktop) {
  const checks = [];
  let state = await inspect(page);
  checks.push(...stageChecks(state, viewport + '-' + stage));
  screenshots.idle.push(await shot(page, viewport + '-' + stage.toLowerCase() + '-idle'));
  const contract = state.contract;
  const wrongIds = contract.candidateIds.filter((id) => id !== contract.correctCandidateId);
  const initialAttempts = state.snapshot.wrongAttempts;
  await tap(page, input, center(state.targets[0].bounds));
  state = await inspect(page);
  checks.push({ name: viewport + '-' + stage + '-target-before-selection', ok: state.stage === stage && state.snapshot.wrongAttempts === initialAttempts && state.selectedCandidateId === null });
  await tap(page, input, cardGap(state));
  state = await inspect(page);
  checks.push({ name: viewport + '-' + stage + '-between-cards-empty', ok: state.stage === stage && state.selectedCandidateId === null });

  for (const wrongId of wrongIds) {
    const before = await inspect(page);
    await tap(page, input, center(cardById(before, wrongId).bounds));
    await waitSelected(page, wrongId);
    let selected = await inspect(page);
    checks.push({ name: viewport + '-' + stage + '-' + wrongId + '-selected', ok: selected.selectedCandidateId === wrongId && selected.interaction.state === 'SELECTED', actual: selected.interaction });
    await tap(page, input, center(selected.targets[0].bounds), 0);
    let rejectionSettled = true;
    try {
      await page.waitForFunction(({ attempts, expectedStage }) => {
        const game = window.__ROBOTLAB_GAME__;
        const interaction = game?.registry.get('mission9InteractionSnapshot');
        const snapshot = window.__ROBOTLAB_QA__?.robotTestCourse.snapshot;
        return snapshot?.courseStage === expectedStage && snapshot.wrongAttempts === attempts + 1
          && interaction?.state === 'IDLE' && interaction.selectedCandidateId === null;
      }, { attempts: before.snapshot.wrongAttempts, expectedStage: stage }, { timeout: 5000 });
    } catch {
      rejectionSettled = false;
    }
    state = await inspect(page);
    checks.push({ name: viewport + '-' + stage + '-' + wrongId + '-rejected', ok: rejectionSettled && state.stage === stage
      && state.snapshot.wrongAttempts === before.snapshot.wrongAttempts + 1 && state.interaction.state === 'IDLE'
      && state.selectedCandidateId === null, actual: { stage: state.stage, attempts: state.snapshot.wrongAttempts, interaction: state.interaction } });
  }

  state = await inspect(page);
  await tap(page, input, center(cardById(state, wrongIds[0]).bounds));
  await waitSelected(page, wrongIds[0]);
  state = await inspect(page);
  await tap(page, input, center(cardById(state, wrongIds[1]).bounds));
  await waitSelected(page, wrongIds[1]);
  state = await inspect(page);
  await tap(page, input, center(cardById(state, contract.correctCandidateId).bounds));
  await waitSelected(page, contract.correctCandidateId);
  state = await inspect(page);
  const selected = cardById(state, contract.correctCandidateId);
  checks.push({ name: viewport + '-' + stage + '-selection-switch', ok: state.selectedCandidateId === contract.correctCandidateId
    && state.interaction.state === 'SELECTED' && selected?.y < selected?.baseY
    && state.cards.filter((card) => card.candidateId !== contract.correctCandidateId).every((card) => card.alpha < 1), actual: state.interaction });
  if (desktop) screenshots.selected.push(await shot(page, viewport + '-' + stage.toLowerCase() + '-selected'));

  for (let index = 0; index < 3; index += 1) await tap(page, input, center(selected.bounds), 0);
  await waitSelected(page, contract.correctCandidateId);
  state = await inspect(page);
  checks.push({ name: viewport + '-' + stage + '-rapid-taps', ok: state.stage === stage
    && state.selectedCandidateId === contract.correctCandidateId && state.interaction.state === 'SELECTED', actual: state.interaction });
  const target = center(state.targets[0].bounds);
  const timing = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene');
    const prior = { clockPaused: scene.time.paused, tweenTimeScale: scene.tweens.timeScale };
    scene.time.paused = true;
    scene.tweens.timeScale = 4;
    return prior;
  });
  try {
    await tap(page, input, target, 0);
    await tap(page, input, target, 0);
    await page.waitForFunction((expectedStage) => {
      const game = window.__ROBOTLAB_GAME__;
      return game.registry.get('mission9PuzzleContract')?.stage === expectedStage
        && game.registry.get('mission9InteractionSnapshot')?.state === 'TRANSITIONING';
    }, stage, { timeout: 10000 });
    state = await inspect(page);
    checks.push({ name: viewport + '-' + stage + '-double-target-lock', ok: state.stage === stage
      && state.snapshot.wrongAttempts === initialAttempts + 2 && state.interaction.state === 'TRANSITIONING',
    actual: { stage: state.stage, interaction: state.interaction, snapshot: state.snapshot } });
    checks.push({ name: viewport + '-' + stage + '-solved-world-reaction',
      ok: state.stage === stage && state.labels.includes(SOLVED_COPY[stage]), labels: state.labels });
    if (desktop) screenshots.solved.push(await shot(page, viewport + '-' + stage.toLowerCase() + '-solved'));
  } finally {
    await page.evaluate(({ clockPaused, tweenTimeScale }) => {
      const scene = window.__ROBOTLAB_GAME__?.scene.getScene('Mission9Scene');
      if (scene?.time) scene.time.paused = clockPaused;
      if (scene?.tweens) scene.tweens.timeScale = tweenTimeScale;
    }, timing);
  }

  const expected = nextStage[stage];
  const reached = await waitStage(page, expected);
  const after = await inspect(page);
  if (!reached) {
    checks.push({ name: viewport + '-' + stage + '-transition-timeout', ok: false, expected, actual: after });
    return { checks, reached: false };
  }
  if (expected === 'COMPLETE') {
    checks.push({ name: viewport + '-completion-once-clean', ok: after.stage === 'COMPLETE' && after.completionCount === 1
      && after.rootCount === 0 && after.cards.length === 0 && after.targets.length === 0, actual: after });
  } else {
    checks.push({ name: viewport + '-' + stage + '-advance-one', ok: after.stage === expected && after.contract.stage === expected, actual: after.stage });
    checks.push({ name: viewport + '-' + stage + '-cleanup', ok: after.rootCount === 1 && after.cards.length === 3
      && after.targets.length === 1 && !after.missionTextures.some((key) => familyMatches(stage, key)), textures: after.missionTextures });
  }
  return { checks, reached: true };
}

async function fullFlow(browser, width, height, kind, viewport, desktop) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: kind === 'touch', isMobile: kind === 'touch' });
  const page = await context.newPage();
  const errors = recordErrors(page);
  const screenshots = { idle: [], selected: [], solved: [], completion: null };
  const checks = [];
  try {
    await openMission(page);
    const input = await inputFor(context, page, kind);
    let reachedCompletion = true;
    for (const stage of stages) {
      const stageRun = await playStage(page, input, viewport, stage, screenshots, desktop);
      checks.push(...stageRun.checks);
      if (!stageRun.reached) {
        reachedCompletion = false;
        break;
      }
    }
    if (reachedCompletion) screenshots.completion = await shot(page, viewport + '-completion');
    const final = await inspect(page);
    const regions = new Set(final.completionRegions);
    checks.push({ name: viewport + '-completion-contract', ok: final.labels.includes('ˆ‘›’€ˆ… Ž‰„…Ž')
      && final.labels.includes('ŽŽ’ ƒŽ’Ž‚ Š …‚ŽŒ“ ‡€“‘Š“') && final.labels.includes('€ ƒ‹€‚“ž')
      && ['TITLE', 'SUBTITLE', 'CHARACTER', 'ACTION'].every((region) => regions.has(region)), labels: final.labels, regions: [...regions] });
    checks[checks.length - 1].ok = reachedCompletion && final.labels.includes(COPY.completionTitle) && final.labels.includes(COPY.completionSubtitle) && final.labels.includes(COPY.continueToBeacon) && ['TITLE', 'SUBTITLE', 'CHARACTER', 'ACTION'].every((region) => regions.has(region));
    checks.push({ name: viewport + '-runtime-clean', ok: clean(errors), errors });
    return { viewport: width + 'x' + height, input: kind === 'touch' ? 'CDP_TOUCH' : 'MOUSE', checks, final, screenshots, errors, ok: checks.every((check) => check.ok) };
  } finally { await context.close(); }
}

async function responsiveCase(browser, width, height) {
  const touch = width < 1000;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = recordErrors(page);
  try {
    await openMission(page);
    const state = await inspect(page);
    const checks = stageChecks(state, 'responsive-' + width + 'x' + height);
    checks.push({ name: 'responsive-' + width + 'x' + height + '-canvas', ok: await page.evaluate((size) => {
      const rect = document.querySelector('canvas')?.getBoundingClientRect();
      return Boolean(rect && Math.abs(rect.width - size.width) <= 1 && Math.abs(rect.height - size.height) <= 1);
    }, { width, height }) });
    checks.push({ name: 'responsive-' + width + 'x' + height + '-runtime-clean', ok: clean(errors), errors });
    const screenshot = await shot(page, 'responsive-' + width + 'x' + height + '-bridge');
    return { viewport: width + 'x' + height, checks, screenshot, state, errors, ok: checks.every((check) => check.ok) };
  } finally { await context.close(); }
}

async function portraitCase(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = recordErrors(page);
  try {
    await page.goto(missionUrl('BRIDGE'), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.getScene('Mission9Scene').children.getByName('mission9-orientation-gate'), null, { timeout: 90000 });
    const state = await inspect(page);
    const screenshot = await shot(page, '390x844-orientation-gate');
    const checks = [
      { name: 'portrait-one-gate', ok: state.orientationCount === 1 },
      { name: 'portrait-no-gameplay', ok: state.rootCount === 0 && state.cards.length === 0 && state.targets.length === 0 },
      { name: 'portrait-copy', ok: state.labels.includes('Ž‚…ˆ ’…‹…”Ž') && state.labels.includes('ˆƒ€…Œ ƒŽˆ‡Ž’€‹œŽ') },
      { name: 'portrait-runtime-clean', ok: clean(errors), errors },
    ];
    checks.find((check) => check.name === 'portrait-copy').ok = state.labels.includes(COPY.rotate) && state.labels.includes(COPY.landscape);
    return { viewport: '390x844', checks, screenshot, state, errors, ok: checks.every((check) => check.ok) };
  } finally { await context.close(); }
}

async function lifecycleCase(browser) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = recordErrors(page);
  const checks = [];
  try {
    await openMission(page, 'GATE');
    const before = await inspect(page);
    await page.setViewportSize({ width: 390, height: 844 });
    let portraitGateObserved = true;
    try { await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-orientation-gate'), null, { timeout: 10000 }); } catch { portraitGateObserved = false; }
    const portraitViewport = await page.evaluate(() => {
      const game = window.__ROBOTLAB_GAME__;
      const scene = game.scene.getScene('Mission9Scene');
      return { innerWidth, innerHeight, visualWidth: visualViewport?.width, visualHeight: visualViewport?.height,
        committed: game.registry.get('committedViewport'), scale: game.registry.get('scaleManagerMetrics'),
        missionScene: { exists: Boolean(scene), active: game.scene.isActive('Mission9Scene'), status: scene?.sys?.settings?.status } };
    });
    let state = await inspect(page);
    checks.push({ name: 'resize-portrait-gates-gameplay', ok: portraitGateObserved && state.orientationCount === 1 && state.cards.length === 0 && state.targets.length === 0 && state.stage === before.stage, evidence: portraitViewport, state });
    await page.setViewportSize({ width: 915, height: 412 });
    await page.waitForFunction(({ stage, generation }) => {
      const game = window.__ROBOTLAB_GAME__;
      const scene = game?.scene.getScene('Mission9Scene');
      const all = [];
      const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
      scene?.children.list.forEach(walk);
      const committed = game?.registry.get('committedViewport');
      return committed?.generation > generation && committed.viewport?.orientation === 'landscape'
        && committed.gameSize?.width === 915 && committed.gameSize?.height === 412 && game.scene.isActive('Mission9Scene')
        && all.filter((item) => item?.name === 'mission9-stage-root').length === 1
        && all.filter((item) => item?.getData?.('candidateId')).length === 3 && all.filter((item) => item?.getData?.('targetId')).length === 1
        && game.registry.get('mission9PuzzleContract')?.stage === stage;
    }, { stage: before.stage, generation: portraitViewport.committed.generation }, { timeout: 10000 });
    state = await inspect(page);
    checks.push({ name: 'resize-landscape-restores-stage', ok: state.stage === before.stage && state.cards.length === 3 && state.targets.length === 1 });
    checks.push(...stageChecks(state, 'resize-915x412'));
    checks.push({ name: 'resize-runtime-clean', ok: clean(errors), errors });
    return { checks, before, after: state, errors, ok: checks.every((check) => check.ok) };
  } finally { await context.close(); }
}

async function homeInterruptionCase(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const errors = recordErrors(page);
  const checks = [];
  try {
    await openMission(page, 'GATE');
    const before = await inspect(page);
    const home = await page.evaluate(() => {
      const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene');
      const control = scene.children.getByName('mission9-home');
      const bounds = control?.getBounds?.();
      return {
        name: control?.name || null,
        interactive: Boolean(control?.input?.enabled),
        bounds: bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null,
      };
    });
    checks.push({ name: 'home-live-gate-ready', ok: before.stage === 'GATE' && before.rootCount === 1
      && before.cards.length === 3 && before.targets.length === 1, actual: before });
    checks.push({ name: 'home-semantic-control-ready', ok: home.name === 'mission9-home' && home.interactive && Boolean(home.bounds), actual: home });
    if (!home.bounds) throw new Error('mission9-home has no bounds');
    await page.mouse.click(center(home.bounds).x, center(home.bounds).y);
    await page.waitForFunction(() => {
      const game = window.__ROBOTLAB_GAME__;
      return game?.scene.isActive('StartScene') && !game.scene.isActive('Mission9Scene');
    }, null, { timeout: 10000 });
    const departed = await page.evaluate(() => {
      const game = window.__ROBOTLAB_GAME__;
      const scene = game.scene.getScene('Mission9Scene');
      const all = [];
      const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
      scene?.children.list.forEach(walk);
      return {
        startActive: game.scene.isActive('StartScene'),
        missionActive: game.scene.isActive('Mission9Scene'),
        missionStatus: scene?.sys?.settings?.status,
        rootCount: all.filter((item) => item?.name === 'mission9-stage-root').length,
        cardCount: all.filter((item) => item?.getData?.('candidateId')).length,
        targetCount: all.filter((item) => item?.getData?.('targetId')).length,
      };
    });
    checks.push({ name: 'home-real-input-departs-cleanly', ok: departed.startActive && !departed.missionActive
      && departed.rootCount === 0 && departed.cardCount === 0 && departed.targetCount === 0, actual: departed });
    await openMission(page, 'GATE');
    const returned = await inspect(page);
    checks.push({ name: 'home-direct-return-same-stage-clean', ok: returned.stage === 'GATE'
      && returned.rootCount === 1 && returned.cards.length === 3 && returned.targets.length === 1, actual: returned });
    checks.push({ name: 'home-interruption-runtime-clean', ok: clean(errors), errors });
    return { viewport: '1600x900', input: 'MOUSE', checks, before, home, departed, returned, errors,
      ok: checks.every((check) => check.ok) };
  } finally { await context.close(); }
}

async function safeSection(name, run) {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    return {
      name,
      ok: false,
      checks: [{ name: name + '-exception', ok: false, error: message }],
      exception: message,
      screenshots: [],
    };
  }
}

async function openDiagnostic(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const errors = recordErrors(page);
  let navigationError = null;
  let readyError = null;
  try {
    try { await page.goto(missionUrl('BRIDGE'), { waitUntil: 'commit', timeout: 30000 }); }
    catch (error) { navigationError = error.stack || error.message; }
    try {
      await page.waitForFunction(() => {
        const game = window.__ROBOTLAB_GAME__;
        return Boolean(game && window.__ROBOTLAB_QA__ && game.scene.isActive('Mission9Scene')
          && game.registry.get('mission9PuzzleContract')?.stage === 'BRIDGE');
      }, null, { timeout: 30000 });
    } catch (error) { readyError = error.stack || error.message; }
    const evidence = await page.evaluate(() => {
      const game = window.__ROBOTLAB_GAME__;
      const canvas = document.querySelector('canvas');
      return {
        url: location.href, documentReadyState: document.readyState, title: document.title,
        bodyChildCount: document.body?.children.length ?? null,
        canvas: canvas ? { rect: { ...canvas.getBoundingClientRect().toJSON() }, width: canvas.width, height: canvas.height, connected: canvas.isConnected } : null,
        qaPresent: Boolean(window.__ROBOTLAB_QA__), gamePresent: Boolean(game),
        contract: game?.registry.get('mission9PuzzleContract') || null,
        scenes: game ? game.scene.getScenes(false).map((scene) => ({ key: scene.sys.settings.key, status: scene.sys.settings.status, active: scene.sys.isActive(), visible: scene.sys.isVisible() })) : [],
      };
    });
    return { navigationError, readyError, errors, evidence };
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=user-gesture-required'] });
  try {
    if (process.env.ROBOTLAB_OPEN_DIAGNOSTIC === '1') {
      const diagnostic = await openDiagnostic(browser);
      process.stdout.write(JSON.stringify(diagnostic, null, 2) + '\n');
      if (diagnostic.navigationError || diagnostic.readyError || !clean(diagnostic.errors)) process.exitCode = 1;
      return;
    }
    const mouseFlow = await safeSection('mouse-flow-1600x900', () => fullFlow(browser, 1600, 900, 'mouse', '1600x900', true));
    const touchFlow = await safeSection('touch-flow-844x390', () => fullFlow(browser, 844, 390, 'touch', '844x390', false));
    const responsive = [];
    for (const size of [[1280, 720], [1600, 900], [1920, 1080], [740, 360], [844, 390], [915, 412]]) {
      responsive.push(await safeSection('responsive-' + size[0] + 'x' + size[1], () => responsiveCase(browser, size[0], size[1])));
    }
    const portrait = await safeSection('portrait-390x844', () => portraitCase(browser));
    const lifecycle = await safeSection('resize-orientation-lifecycle', () => lifecycleCase(browser));
    const homeInterruption = await safeSection('home-interruption-return', () => homeInterruptionCase(browser));
    const sections = [mouseFlow, touchFlow, ...responsive, portrait, lifecycle, homeInterruption];
    const report = {
      result: sections.every((section) => section.ok) ? 'PASS' : 'FAIL',
      testedAt: new Date().toISOString(),
      baseUrl,
      primaryInteraction: 'TAP_SELECT_THEN_TAP_TARGET',
      drag: 'DISABLED',
      mouseFlow,
      touchFlow,
      responsive,
      portrait,
      lifecycle,
      manualVisualReview: 'REQUIRED',
      homeInterruption,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    const failedChecks = sections.flatMap((section) => section.checks || [])
      .filter((check) => !check.ok).map((check) => check.name);
    process.stdout.write(JSON.stringify({
      result: report.result, reportPath, mouseFlow: mouseFlow.ok, touchFlow: touchFlow.ok,
      responsive: responsive.map((item) => ({ viewport: item.viewport, ok: item.ok })),
      portrait: portrait.ok, lifecycle: lifecycle.ok, homeInterruption: homeInterruption.ok, failedChecks,
    }, null, 2) + '\n');
    if (report.result !== 'PASS') process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
