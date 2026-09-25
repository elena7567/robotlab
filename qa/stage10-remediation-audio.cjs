const { chromium } = require('playwright');
const fs = require('node:fs');
const baseline = process.argv.includes('--baseline');
const lifecycleOnly = process.argv.includes('--lifecycle');
const report = { result: 'FAIL', baseline, outputEvidence: 'PCM sampled after Phaser master mute and volume gain; physical speakers not observed', checks: [], errors: [] };
const check = (name, ok, data) => report.checks.push({ name, ok, data });
const delay = ms => new Promise(r => setTimeout(r, ms));
async function instrument(page) {
  await page.evaluate(() => {
    const sound = window.__ROBOTLAB_GAME__.sound;
    const analyser = sound.context.createAnalyser(); analyser.fftSize = 2048;
    sound.masterVolumeNode.connect(analyser);
    const pcm = new Float32Array(analyser.fftSize);
    window.audioProbe = { peak: 0, samples: 0, plays: [], states: [] };
    window.audioProbeReset = () => { window.audioProbe.peak = 0; window.audioProbe.samples = 0; };
    setInterval(() => {
      analyser.getFloatTimeDomainData(pcm);
      window.audioProbe.peak = Math.max(window.audioProbe.peak, ...pcm.map(Math.abs));
      window.audioProbe.samples++;
    }, 8);
    const originalAdd = sound.add.bind(sound);
    sound.add = (...args) => {
      const cue = originalAdd(...args);
      cue.on('play', () => window.audioProbe.plays.push({key: cue.key, at: performance.now(), muted: sound.mute, locked: sound.locked, context: sound.context.state, volume: cue.volume}));
      return cue;
    };
  });
}
async function sample(page) {
  return page.evaluate(() => ({ ...window.audioProbe, locked: window.__ROBOTLAB_GAME__.sound.locked, context: window.__ROBOTLAB_GAME__.sound.context.state, muted: window.__ROBOTLAB_GAME__.sound.mute, stage: window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage }));
}
async function target(page, name) {
  return page.evaluate(name => {
    const all = []; const walk = x => { all.push(x); if (Array.isArray(x.list)) x.list.forEach(walk); };
    window.__ROBOTLAB_GAME__.scene.getScenes(true).forEach(s => s.children.list.forEach(walk));
    const item = all.find(x => x.name === name); if (!item) throw Error('Missing target ' + name);
    const b = item.getBounds(); return { x: b.centerX, y: b.centerY };
  }, name);
}
async function click(page, name, touch = false) { const p = await target(page, name); await (touch ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y)); }
async function open(browser, { delayed = false, muted = false, touch = false, mission9 = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: touch });
  await context.addInitScript(({delayed, muted}) => {
    localStorage.setItem('robotlab.audioMuted', String(muted));
    if (delayed) {
      const resume = AudioContext.prototype.resume;
      AudioContext.prototype.resume = function(...args) { return resume.apply(this, args).then(() => new Promise(resolve => setTimeout(resolve, 350))); };
    }
  }, {delayed, muted});
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('requestfailed', r => report.errors.push(r.url() + ' ' + r.failure()?.errorText));
  await page.goto('http://127.0.0.1:4198/?qaMission=' + (mission9 ? '9&stage=power' : '10'), {waitUntil: 'commit'});
  await page.waitForFunction(m9 => window.__ROBOTLAB_GAME__?.scene.isActive(m9 ? 'Mission9Scene' : 'Mission10Scene'), mission9, {timeout: 90000});
  await instrument(page);
  if (!mission9) await page.waitForFunction(() => { const all=[]; const walk=x=>{all.push(x);if(Array.isArray(x.list))x.list.forEach(walk)}; window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene').children.list.forEach(walk); return all.find(x=>x.name==='mission10-intro-start')?.getData('ready') === true; }, null, {timeout:15000});
  if (delayed) await page.evaluate(async () => { const sound=window.__ROBOTLAB_GAME__.sound; await sound.context.suspend(); sound.locked=true; sound.unlocked=false; sound.unlock(); });
  return {context, page};
}
(async () => {
  const browser = await chromium.launch({headless: true, args: ['--autoplay-policy=user-gesture-required']});
  try {
    for (const touch of (lifecycleOnly ? [] : [false, true])) {
      const {page, context} = await open(browser, {delayed: true, touch});
      const before = await sample(page);
      await click(page, 'mission10-intro-start', touch); await delay(850);
      const after = await sample(page);
      const plays = after.plays.filter(x => x.key === 'audio-answer-wrong');
      check('direct-delayed-unlock-' + (touch ? 'touch' : 'mouse'), baseline ? plays.length === 0 && after.peak === 0 : plays.length === 1 && after.peak > .001 && after.context === 'running', {before, after});
      await context.close();
    }
    if (!baseline && !lifecycleOnly) {
      const {page, context} = await open(browser, {muted: true});
      await click(page, 'mission10-sound'); await delay(650);
      const unmuted = await sample(page);
      check('muted-entry-unmute-first-gesture', unmuted.peak > .001 && !unmuted.muted, unmuted);
      // Use an actual running approved cue through the existing manager to measure mute output.
      await click(page, 'mission10-sound'); await delay(100);
      await page.evaluate(() => { window.__ROBOTLAB_GAME__.sound.play('audio-answer-wrong', {volume: .46}); window.audioProbeReset(); });
      await delay(550); const muted = await sample(page);
      check('master-mute-zero-output', muted.muted && muted.peak < .000001, muted);
      await click(page, 'mission10-sound');
      await page.evaluate(() => { window.audioProbeReset(); window.__ROBOTLAB_GAME__.sound.play('audio-answer-wrong', {volume: .46}); });
      await delay(450); const restored = await sample(page);
      check('master-unmute-restores-output', !restored.muted && restored.peak > .001, restored);
      await context.close();
      const m9 = await open(browser, {mission9: true});
      const points = await m9.page.evaluate(() => {
        const scene = window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene'); const contract = window.__ROBOTLAB_GAME__.registry.get('mission9PuzzleContract');
        const all=[]; const walk=x=>{all.push(x);if(Array.isArray(x.list))x.list.forEach(walk)};scene.children.list.forEach(walk);
        const at = item => {const b=item.getBounds();return {x:b.centerX,y:b.centerY}};
        return {candidate:at(all.find(x=>x.getData?.('candidateId')===contract.correctCandidateId)),target:at(all.find(x=>x.getData?.('targetId')===contract.targetId))};
      });
      await m9.page.mouse.click(points.candidate.x, points.candidate.y); await m9.page.mouse.click(points.target.x, points.target.y);
      await m9.page.waitForFunction(()=>window.__ROBOTLAB_GAME__.scene.getScene('Mission9Scene').children.getByName('mission9-continue-mission10'),null,{timeout:10000});
      await delay(900);
      await m9.page.evaluate(()=>{window.audioProbeReset();window.audioProbe.plays=[]});
      await click(m9.page,'mission9-continue-mission10');
      await delay(550); await m9.page.evaluate(()=>window.audioProbeReset());
      await delay(1050); const natural=await sample(m9.page);
      check('natural-m9-to-m10-handoff-cue', natural.context==='running' && natural.plays.filter(x=>x.key==='audio-ui-click').length===1, natural);
      await m9.context.close();
    }
    if (!baseline) {
      const home = await open(browser, { delayed: true });
      await click(home.page, 'mission10-home'); await delay(950);
      const gone = await sample(home.page);
      const homeActive = await home.page.evaluate(() => window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));
      check('home-before-delayed-unlock-no-stale-intro', homeActive && !gone.plays.some(x => x.key === 'audio-answer-wrong'), gone);
      await home.context.close();
      const loop = await open(browser);
      await click(loop.page, 'mission10-sound'); await click(loop.page, 'mission10-sound'); await delay(650);
      const measurements=[];
      for (let iteration=0; iteration<4; iteration++) {
        await loop.page.evaluate(() => { const scene=window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene'); window.audioPreviousGeneration=scene.generation; scene.scene.restart(); });
        await loop.page.waitForFunction(() => {
          const all=[];const walk=x=>{all.push(x);if(Array.isArray(x.list))x.list.forEach(walk)};
          window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene').children.list.forEach(walk);
          return window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene').generation > window.audioPreviousGeneration && all.find(x=>x.name==='mission10-intro-start')?.getData('ready')===true;
        }, null, {timeout:15000});
        await delay(100);
        measurements.push(await loop.page.evaluate(() => {
          const game=window.__ROBOTLAB_GAME__, scene=game.scene.getScene('Mission10Scene');
          return { cueInstances:game.sound.sounds.filter(x=>x.key==='audio-answer-wrong').length,
            cuePlays:window.audioProbe.plays.filter(x=>x.key==='audio-answer-wrong').length,
            unlockListeners:game.sound.listenerCount('unlocked'),
            shutdownListeners:scene.events.listenerCount('shutdown'),
            pendingTimers:scene.timers.filter(x=>!x.hasDispatched).length,
            tweens:scene.tweens.getTweens().length, children:scene.children.length };
        }));
      }
      check('repeated-intro-cue-once-per-entry', measurements.every((x,i)=>x.cueInstances===1 && x.cuePlays===i+2), measurements);
      const first=measurements[0];
      check('intro-lifecycle-counts-bounded', measurements.every(x=>x.unlockListeners===0 && x.pendingTimers===0 && x.shutdownListeners===first.shutdownListeners && x.tweens===first.tweens && x.children===first.children), measurements);
      await loop.context.close();
    }
  } finally { await browser.close(); }
  report.result = report.errors.length===0 && report.checks.every(x=>x.ok) ? 'PASS':'FAIL';
  fs.writeFileSync('docs/qa/stage10-remediation-audio' + (baseline ? '-baseline':lifecycleOnly ? '-lifecycle':'') + '.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report)); if(report.result!=='PASS')process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});




