const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const url = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/?qaMission=7';
const viewports = [[1280, 720], [1366, 768], [1440, 900], [1600, 900], [1920, 1080]];
const screenshotsDir = path.join('docs', 'qa', 'screenshots', 'mission7-desktop-text-composition');
const out = path.join('docs', 'qa', 'mission7-desktop-text-composition.json');
const report = { result: 'PENDING', checks: [], errors: [], runs: [], screenshots: [] };
const check = (name, ok, actual) => report.checks.push({ name, ok, actual });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => Math.round(value * 100) / 100;

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function waitForMission(page) {
  for (let i = 0; i < 240; i += 1) {
    const ready = await page.evaluate(() => window.__ROBOTLAB_GAME__?.scene?.isActive('Mission7Scene') === true).catch(() => false);
    if (ready) return;
    await sleep(250);
  }
  throw new Error('Mission7Scene did not become active');
}

async function inspect(page) {
  return page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene');
    const all = [];
    const walk = (object) => { all.push(object); object?.list?.forEach(walk); };
    scene.children.list.forEach(walk);
    const find = (name) => all.find((object) => object.name === name);
    const bounds = (object) => {
      const audited = object?.getData?.('auditBounds');
      if (audited) return 'left' in audited ? audited : {
        left: audited.x,
        right: audited.x + audited.width,
        top: audited.y,
        bottom: audited.y + audited.height,
        width: audited.width,
        height: audited.height,
      };
      const box = object?.getBounds?.();
      return box && { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const point = (name) => {
      const object = find(name);
      return object?.getWorldTransformMatrix?.().transformPoint(0, 0);
    };
    const ports = ['red', 'blue', 'green', 'yellow'].flatMap((color) => ['source', 'target'].map((side) => {
      const name = `connection-${side}-${color}`;
      const object = find(name);
      const position = point(name);
      return object && position ? { name, x: position.x, y: position.y, bounds: bounds(object), locked: object.getData('locked') === true } : null;
    })).filter(Boolean);
    const card = find('connection-task-card');
    const instructionPanel = find('connection-drag-instruction-panel');
    const instructionText = find('connection-drag-instruction');
    const taskBadge = find('connection-task-number');
    return {
      systems: bounds(find('systems-progress')),
      card: bounds(card),
      taskBadge: bounds(taskBadge),
      instructionPanel: bounds(instructionPanel),
      title: bounds(find('connection-title')),
      progress: bounds(find('connection-progress')),
      instruction: bounds(instructionText),
      instructionParent: instructionText?.parentContainer?.name,
      ports,
      connected: card?.getData('connected') ?? [],
      text: {
        title: find('connection-title')?.text,
        progress: find('connection-progress')?.text,
        instruction: find('connection-drag-instruction')?.text,
      },
    };
  });
}

async function dragRed(page) {
  const points = await page.evaluate(() => {
    const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission7Scene');
    const find = (name) => {
      const stack = [...scene.children.list];
      while (stack.length) {
        const object = stack.pop();
        if (object?.name === name) return object;
        if (object?.list) stack.push(...object.list);
      }
      return null;
    };
    return ['connection-source-red', 'connection-target-red'].map((name) => find(name).getWorldTransformMatrix().transformPoint(0, 0));
  });
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 10 });
  await page.mouse.up();
  await sleep(350);
}

(async () => {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [width, height] of viewports) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      page.on('pageerror', (error) => report.errors.push(`${width}x${height}: ${error}`));
      page.on('console', (message) => { if (message.type() === 'error') report.errors.push(`${width}x${height}: ${message.text()}`); });
      page.on('requestfailed', (request) => report.errors.push(`${width}x${height}: ${request.url()}`));
      await page.goto(url, { waitUntil: 'load', timeout: 90000 });
      await waitForMission(page);
      const before = await inspect(page);
      const base = `${width}x${height}`;
      const initialShot = path.join(screenshotsDir, `${base}-initial.png`);
      await page.screenshot({ path: initialShot, timeout: 90000 });
      report.screenshots.push(initialShot);
      const titleGap = before.progress.top - before.title.bottom;
      const instructionGap = before.instructionPanel.top - before.systems.bottom;
      const instructionCardGap = before.taskBadge.top - before.instructionPanel.bottom;
      const instructionOverPort = before.ports.some((port) => intersects(before.instructionPanel, port.bounds));
      check(`${base} title/progress separated`, titleGap >= 4, { gap: round(titleGap), title: before.title, progress: before.progress });
      check(`${base} has a centered instruction pill`, before.instructionPanel?.width >= 500 && before.instructionPanel?.width <= 620 && before.instructionPanel?.height >= 56 && before.instructionPanel?.height <= 72 && Math.abs((before.instructionPanel.left + before.instructionPanel.right) / 2 - (before.card.left + before.card.right) / 2) <= 1, before.instructionPanel);
      check(`${base} instruction is a child of its pill`, before.instructionParent === 'connection-drag-instruction-panel', { parent: before.instructionParent });
      check(`${base} instruction sits below systems status`, instructionGap >= 36 && instructionGap <= 60, { gap: round(instructionGap), systems: before.systems, instructionPanel: before.instructionPanel });
      check(`${base} instruction clear of task-card badge`, instructionCardGap >= 36 && instructionCardGap <= 60, { gap: round(instructionCardGap), instructionPanel: before.instructionPanel, taskBadge: before.taskBadge });
      check(`${base} instruction clear of terminals`, !instructionOverPort, { instruction: before.instruction, ports: before.ports });
      check(`${base} instruction is a single readable line`, before.text.instruction === 'ЗАЖМИ ПРОВОД И ПРОТЯНИ К ТАКОМУ ЖЕ ЦВЕТУ', before.text);
      await dragRed(page);
      const after = await inspect(page);
      const connectedShot = path.join(screenshotsDir, `${base}-red-connected.png`);
      await page.screenshot({ path: connectedShot, timeout: 90000 });
      report.screenshots.push(connectedShot);
      const cardStable = ['left', 'right', 'top', 'bottom', 'width', 'height'].every((key) => before.card[key] === after.card[key]);
      const portsStable = before.ports.every((port) => {
        const next = after.ports.find((candidate) => candidate.name === port.name);
        return next && next.x === port.x && next.y === port.y;
      });
      check(`${base} correct red wire connects`, after.connected.length === 1 && after.connected.includes('red'), after.connected);
      check(`${base} card envelope unchanged by connection`, cardStable, { before: before.card, after: after.card });
      check(`${base} terminals unchanged by connection`, portsStable, { before: before.ports, after: after.ports });
      report.runs.push({ viewport: base, titleGap: round(titleGap), instructionGap: round(instructionGap), instructionCardGap: round(instructionCardGap), instructionOverPort, before, after });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  report.result = report.checks.every((entry) => entry.ok) && report.errors.length === 0 ? 'PASS' : 'FAIL';
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ result: report.result, checks: report.checks.length, failed: report.checks.filter((entry) => !entry.ok), errors: report.errors, screenshots: report.screenshots, out }, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
})();
