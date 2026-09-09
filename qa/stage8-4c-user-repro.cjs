const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const cases = [
  ['portrait', 390, 844],
  ['portrait-short', 360, 600],
  ['short-landscape', 844, 390],
  ['android-chrome', 915, 350],
  ['android-chrome-min', 915, 320],
].filter(([name]) => !process.env.ROBOTLAB_CASE || name === process.env.ROBOTLAB_CASE);

function intersects(a, b, tolerance = 1) {
  return a && b
    && a.x < b.right - tolerance
    && a.right > b.x + tolerance
    && a.y < b.bottom - tolerance
    && a.bottom > b.y + tolerance;
}

function inside(inner, outer, tolerance = 1) {
  return inner && outer
    && inner.x >= outer.x - tolerance
    && inner.y >= outer.y - tolerance
    && inner.right <= outer.right + tolerance
    && inner.bottom <= outer.bottom + tolerance;
}

async function boot(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__ROBOTLAB_GAME__), undefined, { timeout: 60000 });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScenes(true).length > 0, undefined, { timeout: 60000 });
}

async function startScene(page, sceneKey, completedTasks) {
  await page.evaluate(async ({ sceneKey, completedTasks }) => {
    const { sessionState } = await import('/src/game/state/sessionState.ts');
    const { energyMechanic } = await import('/src/game/mechanics/energy.ts');
    const { sequenceMechanic } = await import('/src/game/mechanics/sequence.ts');
    const { programmingMechanic } = await import('/src/game/mechanics/programming.ts');
    sessionState.reset();
    for (let index = 0; index < completedTasks; index += 1) sessionState.completeCurrentTask();
    energyMechanic.reset();
    sequenceMechanic.reset();
    programmingMechanic.reset();
    const game = window.__ROBOTLAB_GAME__;
    for (const active of game.scene.getScenes(true)) game.scene.stop(active.scene.key);
    game.scene.start(sceneKey);
  }, { sceneKey, completedTasks });
  await page.waitForFunction((key) => window.__ROBOTLAB_GAME__.scene.isActive(key), sceneKey, { timeout: 10000 });
  await page.waitForTimeout(220);
}

async function inspectEnergy(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission6Scene');
    const card = scene.children.getByName('energy-task-card');
    const rect = (item) => {
      const value = item?.getBounds?.();
      return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
    };
    const named = (name) => card?.getByName(name);
    const hitRect = (item) => {
      const hit = item?.input?.hitArea;
      if (!hit) return rect(item);
      const matrix = item.getWorldTransformMatrix();
      const p1 = matrix.transformPoint(-hit.width / 2, -hit.height / 2);
      const p2 = matrix.transformPoint(hit.width / 2, hit.height / 2);
      return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y), right: Math.max(p1.x, p2.x), bottom: Math.max(p1.y, p2.y) };
    };
    const visualRect = (item) => {
      const local = item?.getData?.('visualLocalBounds');
      if (!local) return rect(item);
      const matrix = item.getWorldTransformMatrix();
      const p1 = matrix.transformPoint(local.x, local.y);
      const p2 = matrix.transformPoint(local.x + local.width, local.y + local.height);
      return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y), right: Math.max(p1.x, p2.x), bottom: Math.max(p1.y, p2.y) };
    };
    const normalize = (value) => value ? { ...value, right: value.right ?? value.x + value.width, bottom: value.bottom ?? value.y + value.height } : null;
    return {
      card: normalize(card?.getData('auditBounds') || rect(card)),
      actionRegion: normalize(window.__ROBOTLAB_GAME__.registry.get('sceneComposition')?.regions?.PRIMARY_ACTIONS),
      surface: normalize(window.__ROBOTLAB_GAME__.registry.get('sceneComposition')?.surface?.outer),
      progress: rect(named('energy-progress')),
      hint: visualRect(named('energy-hint-button')),
      check: visualRect(named('energy-check-button')),
      hintHit: hitRect(named('energy-hint-button')),
      checkHit: hitRect(named('energy-check-button')),
      batteries: ['low', 'medium', 'full'].map((level) => hitRect(named(`energy-battery-${level}`))),
      instruction: rect(named('energy-instruction')),
      title: rect(named('energy-title')),
    };
  });
}

async function inspectTransition(page) {
  return page.evaluate(async () => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('TransitionScene');
    const composition = window.__ROBOTLAB_GAME__.registry.get('sceneComposition');
    const { CHARACTER_VISIBLE_BOUNDS } = await import('/src/game/assets/characterBounds.ts');
    const rect = (item) => {
      const value = item?.getBounds?.();
      return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
    };
    const visibleRect = (item, key) => {
      const bounds = CHARACTER_VISIBLE_BOUNDS[key];
      const matrix = item.getWorldTransformMatrix();
      const p1 = matrix.transformPoint(bounds.left, bounds.top);
      const p2 = matrix.transformPoint(bounds.left + bounds.width, bounds.top + bounds.height);
      return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y), right: Math.max(p1.x, p2.x), bottom: Math.max(p1.y, p2.y) };
    };
    const walk = (item) => !item ? [] : [item, ...(item.list || []).flatMap(walk)];
    const all = scene.children.list.flatMap(walk);
    const helper = all.find((item) => item?.name === 'grounded-robot');
    const repaired = all.find((item) => item?.name === 'transition-assembled-robot');
    return {
      characterRegion: composition.regions.CHARACTER,
      statusRegion: composition.regions.STATUS,
      actionRegion: composition.regions.PRIMARY_ACTIONS,
      helper: helper ? visibleRect(helper, 'ROBOT_V2_HELPER') : null,
      repaired: repaired ? visibleRect(repaired, 'ROBOT_V2_ASSEMBLED') : null,
      title: rect(scene.children.getByName('transition-title')),
      subtitle: rect(scene.children.getByName('transition-subtitle')),
      button: rect(scene.children.getByName('transition-continue')),
    };
  });
}

async function inspectMission2(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const audit = window.__ROBOTLAB_GAME__.registry.get('boundsAudit');
    const cardBounds = card.getData('auditBounds');
    const normalized = { ...cardBounds, right: cardBounds.x + cardBounds.width, bottom: cardBounds.y + cardBounds.height };
    return {
      card: normalized,
      answers: (audit?.visibleObjectBounds || []).filter((item) => item.role === 'ANSWER_CARD').map((item) => ({ ...item, right: item.x + item.width, bottom: item.y + item.height })),
      sequence: (audit?.visibleObjectBounds || []).filter((item) => item.role === 'SEQUENCE_SYMBOL').map((item) => ({ ...item, right: item.x + item.width, bottom: item.y + item.height })),
    };
  });
}

async function inspectMission8(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission8Scene');
    const rect = (item) => {
      const value = item?.getBounds?.();
      return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
    };
    const hitRect = (item) => {
      const hit = item?.input?.hitArea;
      if (!hit) return rect(item);
      const matrix = item.getWorldTransformMatrix();
      const p1 = matrix.transformPoint(-hit.width / 2, -hit.height / 2);
      const p2 = matrix.transformPoint(hit.width / 2, hit.height / 2);
      return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y), right: Math.max(p1.x, p2.x), bottom: Math.max(p1.y, p2.y) };
    };
    const composition = window.__ROBOTLAB_GAME__.registry.get('sceneComposition');
    return {
      systems: { ...composition.regions.STATUS, right: composition.regions.STATUS.x + composition.regions.STATUS.width, bottom: composition.regions.STATUS.y + composition.regions.STATUS.height },
      instruction: rect(scene.children.getByName('programming-instruction')),
      feedback: rect(scene.children.getByName('programming-feedback')),
      arrows: ['UP', 'RIGHT', 'DOWN', 'LEFT'].map((command) => hitRect(scene.children.getByName(`program-command-${command}`))),
      right: hitRect(scene.children.getByName('program-command-RIGHT')),
      floatingTutorialPresent: Boolean(scene.children.getByName('programming-tutorial-message')),
    };
  });
}

(async () => {
  fs.mkdirSync(path.join('docs', 'qa', 'screenshots'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const [name, width, height] of cases) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await boot(page);
    await startScene(page, 'GameScene', 1);
    const mission2 = await inspectMission2(page);
    await page.evaluate(async () => {
      const { sequenceMechanic } = await import('/src/game/mechanics/sequence.ts');
      const wrong = sequenceMechanic.snapshot.optionKeys.find((key) => key !== sequenceMechanic.snapshot.correctKey);
      window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card').getByName(`choice-${wrong}`).emit('pointerdown');
    });
    await page.waitForTimeout(160);
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage8-4c-mission2-${name}-wrong.png`) });
    await startScene(page, 'Mission6Scene', 5);
    const energy = await inspectEnergy(page);
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage8-4c-mission6-${name}.png`) });
    await startScene(page, 'TransitionScene', 5);
    const transition = await inspectTransition(page);
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage8-4c-transition-${name}.png`) });
    await startScene(page, 'Mission8Scene', 7);
    const mission8 = await inspectMission8(page);
    await page.screenshot({ path: path.join('docs', 'qa', 'screenshots', `stage8-4c-mission8-${name}-initial.png`) });
    await page.touchscreen.tap(mission8.right.x + mission8.right.width / 2, mission8.right.y + mission8.right.height / 2);
    await page.waitForTimeout(120);
    const mission8Commands = await page.evaluate(async () => (await import('/src/game/mechanics/programming.ts')).programmingMechanic.snapshot.commands);
    const checks = {
      energyProgressClearOfHint: !intersects(energy.progress, energy.hint),
      energyProgressClearOfCheck: !intersects(energy.progress, energy.check),
      energyControlsContained: name.startsWith('portrait')
        ? inside(energy.hint, energy.card) && inside(energy.check, energy.card)
        : inside(energy.hint, energy.actionRegion) && inside(energy.check, energy.actionRegion)
          && inside(energy.hint, energy.surface) && inside(energy.check, energy.surface),
      energyBatteriesInsideCard: energy.batteries.every((battery) => inside(battery, energy.card)),
      energyTouchTargets: energy.hintHit.width >= 56 && energy.hintHit.height >= 56 && energy.checkHit.width >= 56 && energy.checkHit.height >= 56,
      mission2AnswersInsideCard: mission2.answers.every((item) => inside(item, mission2.card)),
      mission2SequenceInsideCard: mission2.sequence.every((item) => inside(item, mission2.card)),
      transitionHelperInsideCharacterRegion: inside(transition.helper, { ...transition.characterRegion, right: transition.characterRegion.x + transition.characterRegion.width, bottom: transition.characterRegion.y + transition.characterRegion.height }),
      transitionRepairedInsideCharacterRegion: inside(transition.repaired, { ...transition.characterRegion, right: transition.characterRegion.x + transition.characterRegion.width, bottom: transition.characterRegion.y + transition.characterRegion.height }),
      transitionActorsClearOfStatus: !intersects(transition.helper, transition.title) && !intersects(transition.repaired, transition.title) && !intersects(transition.helper, transition.subtitle) && !intersects(transition.repaired, transition.subtitle),
      transitionActorsClearOfAction: !intersects(transition.helper, transition.button) && !intersects(transition.repaired, transition.button),
      mission8StatusClearOfInstruction: !intersects(mission8.systems, mission8.instruction),
      mission8FeedbackClearOfArrows: mission8.arrows.every((arrow) => !intersects(mission8.feedback, arrow)),
      mission8ArrowsInsideViewport: mission8.arrows.every((arrow) => inside(arrow, { x: 0, y: 0, width, height, right: width, bottom: height })),
      mission8TouchTargets: mission8.arrows.every((arrow) => arrow.width >= 56 && arrow.height >= 56),
      mission8DirectionTapWorks: mission8Commands.length === 1 && mission8Commands[0] === 'RIGHT',
      mission8NoFloatingTutorial: !mission8.floatingTutorialPresent,
    };
    results.push({ name, width, height, mission2, energy, transition, mission8, mission8Commands, checks });
    await context.close();
  }
  await browser.close();
  const failures = results.flatMap((entry) => Object.entries(entry.checks).filter(([, pass]) => !pass).map(([check]) => `${entry.name}:${check}`));
  console.log(JSON.stringify({ results, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
