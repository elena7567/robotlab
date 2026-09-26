const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const reportPath = path.join('docs', 'qa', 'mission2-sequence-field-containment.json');
const cases = [
  ['1024x640', 1024, 640, false],
  ['1280x720', 1280, 720, false],
  ['1280x800', 1280, 800, false],
  ['1366x768', 1366, 768, false],
  ['1440x900', 1440, 900, false],
  ['1920x1080', 1920, 1080, false],
  ['2560x1440', 2560, 1440, false],
].filter(([name]) => !process.env.ROBOTLAB_CASE || process.env.ROBOTLAB_CASE === name);
const tolerance = 1;

const startedAt = new Date().toISOString();
const startedAtMs = Date.now();
const stages = [];

function stage(name, details = {}) {
  const entry = { name, at: new Date().toISOString(), elapsedMs: Date.now() - startedAtMs, details };
  stages.push(entry);
  writeReport({ status: 'RUNNING' });
  console.log(`[mission2-qa] ${entry.elapsedMs}ms ${name}${Object.keys(details).length ? ` ${JSON.stringify(details)}` : ''}`);
}

function writeReport(report) {
  fs.writeFileSync(reportPath, JSON.stringify({ startedAt, stages, ...report }, null, 2));
}

writeReport({ status: 'RUNNING' });

function normalize(rect) {
  return { ...rect, right: rect.right ?? rect.x + rect.width, bottom: rect.bottom ?? rect.y + rect.height };
}

function inside(inner, outer) {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance
    && inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
}

async function startMission2(page) {
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('StartScene')
    .children.getByName('start-play-button').emit('pointerdown'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('GameScene'));
  await page.evaluate(() => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    card.getByName('choice-odd-ball').emit('pointerdown');
    card.getByName('check-button').emit('pointerdown');
  });
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    ?.children.getByName('task-card')?.result === 'correct');
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    .children.getByName('task-card').getByName('continue-button').emit('pointerdown'));
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    ?.children.getByName('task-card')?.getData('semanticContentKind') === 'SEQUENCE_AND_CHOICES');
  await page.evaluate(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    .children.getByName('task-card').getByName('choice-sequence-star').emit('pointerdown'));
  await page.waitForFunction(() => [...window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    .children.getByName('task-card').list].some((item) => item.text?.includes('РЯД 2/3')));
}

async function inspect(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('GameScene');
    const card = scene.children.getByName('task-card');
    const field = card.getData('sequenceFieldBounds');
    const row = card.getData('sequenceRowBounds');
    const worldRect = (rect) => {
      const matrix = card.getWorldTransformMatrix();
      const first = matrix.transformPoint(rect.x, rect.y);
      const second = matrix.transformPoint(rect.x + rect.width, rect.y + rect.height);
      return {
        x: Math.min(first.x, second.x), y: Math.min(first.y, second.y),
        width: Math.abs(second.x - first.x), height: Math.abs(second.y - first.y),
        right: Math.max(first.x, second.x), bottom: Math.max(first.y, second.y),
      };
    };
    const bounds = (item) => {
      const value = item.getBounds();
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const sequenceItems = card.list.filter((item) => item.name?.startsWith('sequence-symbol-'));
    const fieldBounds = worldRect(field);
    const rowBounds = worldRect(row);
    const missingSlot = worldRect({
      x: row.x + row.width - row.slotSize,
      y: row.y,
      width: row.slotSize,
      height: row.slotSize,
    });
    return {
      field: fieldBounds,
      row: rowBounds,
      slots: [...sequenceItems.map((item) => ({ name: item.name, ...bounds(item) })), { name: 'sequence-missing-slot', ...missingSlot }],
      question: bounds(card.getByName('missing-slot-question')),
      slotCount: sequenceItems.length + 1,
      leftClearance: rowBounds.x - fieldBounds.x,
      rightClearance: fieldBounds.right - rowBounds.right,
      slotSize: row.slotSize,
      gap: row.gap,
      correctKey: 'sequence-planet',
      card,
    };
  });
}

async function selectCorrect(page, correctKey) {
  await page.evaluate((key) => {
    const card = window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('task-card');
    card.getByName(`choice-${key}`).emit('pointerdown');
  }, correctKey);
  await page.waitForFunction(() => window.__ROBOTLAB_GAME__.scene.getScene('GameScene')
    ?.children.getByName('task-card')?.result === 'correct');
}

(async () => {
  let browser;
  let context;
  let page;
  const results = [];
  const runtimeErrors = [];
  let failure;
  try {
    for (const [name, width, height, touch] of cases) {
      stage('viewport iteration start', { name, width, height, touch });
      stage('browser launch start', { name });
      browser = await chromium.launch({
        headless: true,
        timeout: 15000,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      });
      stage('browser launch complete', { name });
      stage('context creation start', { name });
      context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
      stage('context creation complete', { name });
      stage('page creation start', { name });
      page = await context.newPage();
      stage('page creation complete', { name });
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          const error = message.text();
          errors.push(error);
          runtimeErrors.push({ name, type: 'console', error });
          stage('console error', { name, error });
        }
      });
      page.on('pageerror', (error) => {
        errors.push(error.message);
        runtimeErrors.push({ name, type: 'pageerror', error: error.message });
        stage('page error', { name, error: error.message });
      });
      page.on('requestfailed', (request) => {
        const error = `${request.url()}: ${request.failure()?.errorText}`;
        errors.push(error);
        runtimeErrors.push({ name, type: 'requestfailed', error });
        stage('request failed', { name, error });
      });
      page.once('domcontentloaded', () => stage('DOMContentLoaded', { name }));
      stage('page.goto start', { name, url: baseUrl });
      const response = await page.goto(baseUrl, { waitUntil: 'commit' });
      stage('response received', { name, status: response?.status() ?? null });
      const serviceWorkers = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.() ?? [])
        .map((registration) => ({ scope: registration.scope, active: Boolean(registration.active), waiting: Boolean(registration.waiting) })))
        .catch((error) => ({ inspectionError: String(error) }));
      stage('service worker inspection', { name, serviceWorkers });
      stage('game/start scene readiness start', { name });
      await page.waitForFunction(() => window.__ROBOTLAB_GAME__?.scene.isActive('StartScene'));
      stage('game/start scene readiness complete', { name });
      stage('navigation to Mission 2 start', { name });
      await startMission2(page);
      stage('Mission 2 readiness complete', { name });
      stage('geometry assertions start', { name });
      const before = await inspect(page);
      const checks = {
        cyanFieldBounds: before.slotCount === 6 && before.slots.every((slot) => inside(normalize(slot), before.field)) && inside(before.question, before.field),
        sequenceRowBounds: inside(before.row, before.field),
        balancedClearance: Math.abs(before.leftClearance - before.rightClearance) <= tolerance,
        readableSlots: before.slotSize >= 32 && before.gap >= 2,
      };
      stage('geometry assertions complete', { name });
      stage('interaction assertions start', { name });
      await selectCorrect(page, before.correctKey);
      const after = await inspect(page);
      checks.answerInteraction = after.card.result === 'correct';
      stage('interaction assertions complete', { name });
      stage('console assertions start', { name });
      checks.console = errors.length === 0;
      stage('console assertions complete', { name, errorCount: errors.length });
      results.push({ name, width, height, before: { ...before, card: undefined }, checks, errors });
      stage('viewport iteration complete', { name });
      stage('page close start', { name });
      await page.close();
      stage('page close complete', { name });
      page = undefined;
      stage('context close start', { name });
      await context.close();
      stage('context close complete', { name });
      context = undefined;
      stage('browser close start', { name });
      await browser.close();
      stage('browser close complete', { name });
      browser = undefined;
    }
  } catch (error) {
    failure = error instanceof Error ? error.stack : String(error);
    stage('failure', { error: failure });
  } finally {
    const failures = results.flatMap((result) => Object.entries(result.checks)
      .filter(([, pass]) => !pass).map(([check]) => `${result.name}:${check}`));
    stage('JSON report write', { status: failure ? 'FAILED' : failures.length ? 'FAILED' : 'CLEANUP_PENDING' });
    writeReport({ status: failure || failures.length ? 'FAILED' : 'CLEANUP_PENDING', results, failures, runtimeErrors, ...(failure ? { error: failure } : {}) });
    if (page) {
      stage('page close start', { name: 'cleanup' });
      await page.close().catch((error) => stage('page close failed', { error: String(error) }));
      stage('page close complete', { name: 'cleanup' });
    }
    if (context) {
      stage('context close start', { name: 'cleanup' });
      await context.close().catch((error) => stage('context close failed', { error: String(error) }));
      stage('context close complete', { name: 'cleanup' });
    }
    if (browser) {
      stage('browser close start');
      await browser.close().catch((error) => stage('browser close failed', { error: String(error) }));
      stage('browser close complete');
    }
    const finalStatus = failure || failures.length ? 'FAILED' : 'COMPLETE';
    stage('process exit scheduled', { exitCode: finalStatus === 'COMPLETE' ? 0 : 1 });
    writeReport({ status: finalStatus, results, failures, runtimeErrors, ...(failure ? { error: failure } : {}) });
    console.log(JSON.stringify({ status: finalStatus, failures, durationMs: Date.now() - startedAtMs }, null, 2));
    if (finalStatus !== 'COMPLETE') process.exitCode = 1;
  }
})().catch((error) => {
  const failure = { status: 'FAILED', error: error instanceof Error ? error.stack : String(error), stages };
  fs.writeFileSync(reportPath, JSON.stringify(failure, null, 2));
  console.error(error);
  process.exitCode = 1;
});
