const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const baseUrl = process.env.ROBOTLAB_URL || 'http://127.0.0.1:4198/';
const reportPath = path.join('docs', 'qa', 'mission10-energy-platform-probe.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = { result: 'FAIL', errors: [], artwork: null, composite: null, page: null };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => report.errors.push('page: ' + e.message));
    await page.goto(baseUrl + '?qaMission=10&stage=energy', { waitUntil: 'commit', timeout: 45000 });
    await page.waitForFunction(() => {
      const game = window.__ROBOTLAB_GAME__;
      return Boolean(game?.scene.isActive('Mission10Scene') && game.registry.get('mission10Snapshot')?.stage === 'ENERGY');
    }, null, { timeout: 90000 });
    await sleep(400);

    // 1) Artwork truth: scan background PNG source columns in the lower 60%.
    report.artwork = await page.evaluate(async () => {
      const img = new Image();
      img.src = '/assets/backgrounds/laboratory-background.png';
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const scan = (x, y0, y1) => {
        const { data, width, height } = source;
        const quant = (v) => Math.round(v / 24) * 24;
        const runs = [];
        let run = null;
        for (let y = Math.max(0, y0); y <= Math.min(height - 1, y1); y += 1) {
          const i = (y * width + x) * 4;
          const rgb = [data[i], data[i + 1], data[i + 2]];
          const q = rgb.map(quant).join(',');
          if (!run || run.q !== q) { run = { q, from: y, to: y, rgb }; runs.push(run); } else { run.to = y; run.rgb = rgb; }
        }
        return runs.filter((r) => r.to - r.from >= 4).map((r) => ({ from: r.from, to: r.to, rgb: r.rgb.map(Math.round) }));
      };
      const cx = Math.floor(canvas.width / 2);
      const startX = Math.floor(canvas.height * 0.4);
      return {
        width: canvas.width,
        height: canvas.height,
        centerX: cx,
        runsCenter: scan(cx, startX, canvas.height - 1),
        runsOffset: scan(cx - Math.floor(canvas.width * 0.07), startX, canvas.height - 1),
      };
    });

    // 2) Composite truth: pixel-scan a fresh screenshot (columns clear of relay bodies).
    const shot = await page.screenshot({ type: 'png' });
    report.composite = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const scan = (x) => {
        const { data, width, height } = source;
        const quant = (v) => Math.round(v / 24) * 24;
        const runs = [];
        let run = null;
        for (let y = 300; y < height; y += 1) {
          const i = (y * width + x) * 4;
          const rgb = [data[i], data[i + 1], data[i + 2]];
          const q = rgb.map(quant).join(',');
          if (!run || run.q !== q) { run = { q, from: y, to: y, rgb }; runs.push(run); } else { run.to = y; run.rgb = rgb; }
        }
        return runs.filter((r) => r.to - r.from >= 3).map((r) => ({ from: r.from, to: r.to, rgb: r.rgb.map(Math.round) }));
      };
      return { width: canvas.width, height: canvas.height, x454: scan(454), x578: scan(578), x702: scan(702) };
    }, shot.toString('base64'));

    // 3) In-page geometry: title, group, relays, terminals, robot, resolver, background transform.
    report.page = await page.evaluate(() => {
      const game = window.__ROBOTLAB_GAME__;
      const scene = game.scene.getScene('Mission10Scene');
      const all = [];
      const walk = (item) => { all.push(item); if (Array.isArray(item?.list)) item.list.forEach(walk); };
      scene.children.list.forEach(walk);
      const bounds = (item) => {
        try { const b = item?.getBounds?.(); if (b && b.width > 0 && b.height > 0) return { x: b.x, y: b.y, width: b.width, height: b.height, top: b.y, bottom: b.y + b.height }; } catch { /* containers without size */ }
        return null;
      };
      const byName = (name) => all.find((o) => o?.name === name) || null;
      const width = scene.scale.width;
      const height = scene.scale.height;
      const scale = Math.max(width / 1280, height / 720);
      const offsetY = (height - 720 * scale) / 2;
      const topY = offsetY + 560 * scale;
      const bg = byName('mission10-laboratory-background');
      const bgImage = bg?.list?.find?.((o) => o?.texture?.key === 'bg-main-laboratory');
      const robot = byName('mission10-robot-v2');
      return {
        viewport: { width, height, scale, offsetY },
        energyLayout: game.registry.get('mission10EnergyLayout') || null,
        groupBounds: bounds(byName('MISSION10_ENERGY_PUZZLE_GROUP')),
        titleBounds: bounds(byName('mission10-title')),
        relays: all.filter((o) => /mission10-relay-(r1|r2|r3)$/.test(o?.name || '')).map((o) => ({ name: o.name, bounds: bounds(o), x: o.x, y: o.y })),
        terminals: ['mission10-energy-source', 'mission10-energy-receiver'].map((n) => { const o = byName(n); return { name: n, bounds: bounds(o), x: o?.x, y: o?.y }; }),
        robot: robot ? { x: robot.x, y: robot.y, scaleX: robot.scaleX, scaleY: robot.scaleY, bounds: bounds(robot) } : null,
        resolver: { topY, centerY: topY + 24 * scale, bottomY: topY + 48 * scale },
        background: bgImage ? { x: bgImage.x, y: bgImage.y, scaleX: bgImage.scaleX, scaleY: bgImage.scaleY, displayWidth: bgImage.displayWidth, displayHeight: bgImage.displayHeight, texW: bgImage.width, texH: bgImage.height } : null,
        compositionEnergy: game.registry.get('sceneComposition')?.mission10?.energyStage || null,
      };
    });

    report.result = report.errors.length === 0 ? 'PASS' : 'FAIL';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify({ result: report.result, errors: report.errors.length, reportPath }) + '\n');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
