// Run --launch-only at Stage5; full suite only after Stage6 authorization.
const {chromium}=require('playwright');
const fs=require('node:fs');
const launchOnly=process.argv.includes('--launch-only');
const smokeOnly=process.argv.includes('--smoke');
const report={result:'FAIL',mode:smokeOnly?'final-bundle-smoke':launchOnly?'launch':'launch-and-victory',evidence:'Continuous AudioWorklet PCM after Phaser master mute/volume; physical speakers and subjective listening not observed',checks:[],errors:[]};
const check=(name,ok,data)=>report.checks.push({name,ok,data});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function probe(page){
 await page.evaluate(async()=>{
  const game=window.__ROBOTLAB_GAME__, sound=game.sound;
  window.finaleAudio={peak:0,sumSquares:0,samples:0,clipped:0,events:[],lastPcmAt:0};
  window.resetFinalePcm=()=>Object.assign(window.finaleAudio,{peak:0,sumSquares:0,samples:0,clipped:0});
  const source=`class MasterProbe extends AudioWorkletProcessor { constructor(){super();this.p=0;this.s=0;this.n=0;this.c=0;} process(inputs){for(const channel of inputs[0]||[])for(const value of channel){this.p=Math.max(this.p,Math.abs(value));this.s+=value*value;this.n++;if(Math.abs(value)>=0.999)this.c++;}if(this.n>=4096){this.port.postMessage({peak:this.p,sumSquares:this.s,samples:this.n,clipped:this.c});this.p=0;this.s=0;this.n=0;this.c=0;}return true;} } registerProcessor('master-probe',MasterProbe);`;
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));await sound.context.audioWorklet.addModule(url);URL.revokeObjectURL(url);
  const node=new AudioWorkletNode(sound.context,'master-probe');window.finaleProbeNode=node;sound.masterVolumeNode.connect(node);node.connect(sound.context.destination);
  node.port.onmessage=({data})=>{const p=window.finaleAudio;p.peak=Math.max(p.peak,data.peak);p.sumSquares+=data.sumSquares;p.samples+=data.samples;p.clipped+=data.clipped;p.lastPcmAt=performance.now();};
  const add=sound.add.bind(sound);sound.add=(...args)=>{const cue=add(...args);for(const event of ['play','stop','complete'])cue.on(event,()=>window.finaleAudio.events.push({key:cue.key,event,at:performance.now(),audioTime:sound.context.currentTime,stage:window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage,finaleStep:window.__ROBOTLAB_QA__.mission10Controller.snapshot.finaleStep}));return cue;};
  const describe=key=>{const b=game.cache.audio.get(key);let peak=0;for(let ch=0;ch<b.numberOfChannels;ch++)for(const value of b.getChannelData(ch))peak=Math.max(peak,Math.abs(value));return {key,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate,decodedPeak:peak}};
  window.finaleAssets={launch:describe('audio-mission10-beacon-launch'),victory:describe('audio-mission10-victory-theme')};
 });
}
async function snapshot(page){return page.evaluate(()=>{const game=window.__ROBOTLAB_GAME__;return {...window.finaleAudio,assets:window.finaleAssets,context:game.sound.context.state,muted:game.sound.mute,activeScenes:game.scene.getScenes(true).map(s=>s.sys.settings.key),sounds:game.sound.sounds.filter(s=>s.key.startsWith('audio-mission10-')).map(s=>({key:s.key,playing:s.isPlaying,paused:s.isPaused,volume:s.volume,loop:s.loop})),session:window.__ROBOTLAB_QA__.sessionState.snapshot};});}
async function point(page,name){return page.evaluate(name=>{const game=window.__ROBOTLAB_GAME__;const walk=x=>[x,...(x.list||[]).flatMap(walk)];const item=game.scene.getScenes(true).flatMap(s=>s.children.list.flatMap(walk)).find(x=>x.name===name&&x.input?.enabled);if(!item)throw Error('Missing '+name);const b=item.getBounds(),c=game.canvas.getBoundingClientRect();return{x:c.x+b.centerX*c.width/game.scale.width,y:c.y+b.centerY*c.height/game.scale.height};},name);}
async function tap(page,name){const p=await point(page,name);await page.touchscreen.tap(p.x,p.y);}
async function open(browser,muted=false,stage='launch'){const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true});await context.addInitScript(muted=>localStorage.setItem('robotlab.audioMuted',String(muted)),muted);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});await page.goto('http://127.0.0.1:4198/?qaMission=10&stage='+stage,{waitUntil:'commit'});await page.waitForFunction(()=>window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene'),null,{timeout:90000});await probe(page);return{page,context};}
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const run=await open(browser);const p=await point(run.page,'mission10-launch-target');await run.page.evaluate(()=>window.launchTapAt=performance.now());await run.page.touchscreen.tap(p.x,p.y);await run.page.touchscreen.tap(p.x,p.y);await sleep(850);if(!smokeOnly)await run.page.waitForFunction(()=>window.finaleAudio.samples>0,null,{timeout:4000});
 let s=await snapshot(run.page);const launches=s.events.filter(x=>x.key==='audio-mission10-beacon-launch'&&x.event==='play');
 if(!smokeOnly)check('launch-output',s.peak>.001&&s.context==='running',s);
 check('launch-once-despite-double-tap',launches.length===1,launches);
 check('launch-synchronized-with-finale-start',launches.length===1&&launches[0].stage==='FINALE'&&launches[0].finaleStep===0,launches);
 if(!smokeOnly)check('launch-no-output-clipping',s.samples>0&&s.clipped===0&&s.peak<1,{peak:s.peak,clipped:s.clipped,samples:s.samples});
 if(!launchOnly){
  await run.page.waitForFunction(()=>window.__ROBOTLAB_GAME__.scene.isActive('VictoryScene'),null,{timeout:15000});await run.page.evaluate(()=>window.resetFinalePcm());await sleep(800);if(smokeOnly)await run.page.waitForFunction(()=>window.finaleAudio.samples>0,null,{timeout:5000});s=await snapshot(run.page);
  check('victory-continues-into-victory-scene',s.sounds.some(x=>x.key==='audio-mission10-victory-theme'&&x.playing)&&s.peak>.001,s);
  check('victory-one-instance-one-start',s.sounds.filter(x=>x.key==='audio-mission10-victory-theme').length===1&&s.events.filter(x=>x.key==='audio-mission10-victory-theme'&&x.event==='play').length===1,s.events);
  if(smokeOnly){await tap(run.page,'victory-play-again');await sleep(350);s=await snapshot(run.page);check('final-bundle-play-again-stops-theme',s.activeScenes.includes('GameScene')&&!s.sounds.some(x=>x.key==='audio-mission10-victory-theme'&&x.playing),s);report.result=report.errors.length===0&&report.checks.every(x=>x.ok)?'PASS':'FAIL';fs.writeFileSync('docs/qa/stage10-remediation-finale-audio-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.result!=='PASS')process.exitCode=1;return;}
  await run.page.setViewportSize({width:1600,height:900}); await sleep(450); s=await snapshot(run.page);
  check('victory-resize-keeps-same-track',s.activeScenes.includes('VictoryScene')&&s.sounds.some(x=>x.key==='audio-mission10-victory-theme'&&x.playing)&&s.events.filter(x=>x.key==='audio-mission10-victory-theme'&&x.event==='play').length===1&&!s.events.some(x=>x.key==='audio-mission10-victory-theme'&&x.event==='stop'),s);
  const duration=s.assets.victory.duration;const started=s.events.find(x=>x.key==='audio-mission10-victory-theme'&&x.event==='play')?.at;
  await run.page.waitForFunction(({started,duration})=>performance.now()>=started+(duration+1)*1000,{started,duration},{timeout:Math.max(15000,(duration+2)*1000)});s=await snapshot(run.page);
  const ending=s.events.find(x=>x.key==='audio-mission10-victory-theme'&&x.event==='complete');
  check('victory-natural-ending',Boolean(ending)&&!s.sounds.some(x=>x.key==='audio-mission10-victory-theme'&&x.playing),{duration,started,ending,events:s.events});
  check('victory-no-output-clipping',s.samples>0&&s.clipped===0&&s.peak<1,{peak:s.peak,clipped:s.clipped,samples:s.samples});
  await tap(run.page,'victory-play-again');await run.page.waitForFunction(()=>window.__ROBOTLAB_GAME__.scene.isActive('GameScene'));s=await snapshot(run.page);check('replay-resets-and-stops-theme',s.session.completedTasks===0&&!s.sounds.some(x=>x.playing),s);
 }
 await run.context.close();
 const muted=await open(browser,true);await tap(muted.page,'mission10-launch-target');await sleep(850);s=await snapshot(muted.page);check('muted-launch-silent',s.muted&&s.samples>0&&s.peak===0&&!s.events.some(x=>x.key==='audio-mission10-beacon-launch'&&x.event==='play'),s);await muted.context.close();
 if(!launchOnly){
  for(const exit of ['victory-home','victory-play-again','generic-shutdown']){
   const active=await open(browser);await tap(active.page,'mission10-launch-target');
   await active.page.waitForFunction(()=>window.finaleAudio.events.some(x=>x.key==='audio-mission10-victory-theme'&&x.event==='play'),null,{timeout:15000});
   await active.page.setViewportSize({width:1600,height:900}); await sleep(150);
   const resized=await snapshot(active.page);check('finale-resize-keeps-track-'+exit,resized.sounds.some(x=>x.key==='audio-mission10-victory-theme'&&x.playing)&&resized.events.filter(x=>x.key==='audio-mission10-victory-theme'&&x.event==='play').length===1&&!resized.events.some(x=>x.key==='audio-mission10-victory-theme'&&x.event==='stop'),resized);
   await active.page.waitForFunction(()=>window.__ROBOTLAB_GAME__.scene.isActive('VictoryScene'),null,{timeout:15000});
   const before=await snapshot(active.page);if(exit==='generic-shutdown')await active.page.evaluate(()=>window.__ROBOTLAB_GAME__.scene.stop('VictoryScene'));else await tap(active.page,exit);await sleep(350);s=await snapshot(active.page);
   check(exit+'-stops-active-theme',before.sounds.some(x=>x.key==='audio-mission10-victory-theme'&&x.playing)&&!s.sounds.some(x=>x.key==='audio-mission10-victory-theme'&&x.playing),{before,after:s});await active.context.close();
  }
  const deferred=await open(browser,false,'final');
  await deferred.page.waitForFunction(()=>window.__ROBOTLAB_GAME__.scene.isActive('VictoryScene'),null,{timeout:15000});
  await deferred.page.evaluate(async()=>{const sound=window.__ROBOTLAB_GAME__.sound;await sound.context.suspend();const resume=sound.context.resume.bind(sound.context);sound.context.resume=()=>resume().then(()=>new Promise(resolve=>setTimeout(resolve,350)));sound.locked=true;sound.unlocked=false;sound.unlock();});
  await tap(deferred.page,'victory-home');await sleep(900);s=await snapshot(deferred.page);
  check('home-cancels-locked-pending-victory',s.activeScenes.includes('StartScene')&&!s.events.some(x=>x.key==='audio-mission10-victory-theme'&&x.event==='play'),s);
  await deferred.context.close();
  const muteTheme=await open(browser);await tap(muteTheme.page,'mission10-launch-target');
  await muteTheme.page.waitForFunction(()=>window.finaleAudio.events.some(x=>x.key==='audio-mission10-victory-theme'&&x.event==='play'),null,{timeout:15000});
  // Existing semantic sound control remains present during finale. Muting precedes the Victory scene transition.
  await tap(muteTheme.page,'mission10-sound');await sleep(120);await muteTheme.page.evaluate(()=>window.resetFinalePcm());await sleep(250);s=await snapshot(muteTheme.page);check('victory-theme-mute-zero',s.muted&&s.peak===0,s);
  // Unmute through the same real control if finale is still showing; otherwise keep the result explicit.
  const hasSound=await muteTheme.page.evaluate(()=>window.__ROBOTLAB_GAME__.scene.isActive('Mission10Scene'));
  if(hasSound){await tap(muteTheme.page,'mission10-sound');await muteTheme.page.evaluate(()=>window.resetFinalePcm());await sleep(220);s=await snapshot(muteTheme.page);check('victory-theme-unmute-output',!s.muted&&s.peak>.001,s);}else check('victory-theme-unmute-output',false,'Finale completed before sound-control action; rerun with dedicated early mute timing');
  await muteTheme.context.close();
 }
}finally{await browser.close();}report.result=report.errors.length===0&&report.checks.every(x=>x.ok)?'PASS':'FAIL';fs.writeFileSync('docs/qa/stage10-remediation-finale-audio'+(smokeOnly?'-smoke':launchOnly?'-launch':'')+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.result!=='PASS')process.exitCode=1;})().catch(e=>{report.errors.push(e.stack||e.message);fs.writeFileSync('docs/qa/stage10-remediation-finale-audio'+(smokeOnly?'-smoke':launchOnly?'-launch':'')+'.json',JSON.stringify(report,null,2)+'\n');console.error(e);process.exit(1)});







