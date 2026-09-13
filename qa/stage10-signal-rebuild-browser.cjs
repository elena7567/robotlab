const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = path.join('qa', 'stage10-signal-rebuild');
fs.mkdirSync(out, {recursive:true});
const report = {result:'FAIL',physicalSamsung:'NOT VERIFIED',keyboard:'Existing canvas controls have no keyboard activation; unchanged TAP ONLY scope',visual:'NOT VERIFIED',checks:[],runs:[],shots:[],errors:[]};
const save = () => fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const check = (name,ok,actual) => {report.checks.push({name,ok:!!ok,actual});save();};
function inspect() {
  const g=window.__ROBOTLAB_GAME__,s=g.scene.getScene('Mission10Scene'),all=[];
  const walk=o=>{all.push(o);if(Array.isArray(o.list))o.list.forEach(walk);};s.children.list.forEach(walk);
  const info=o=>{const b=o.getBounds?.();return {name:o.name,type:o.type,data:o.data?.getAll(),x:o.x,y:o.y,width:o.width,height:o.height,bounds:b?{x:b.x,y:b.y,width:b.width,height:b.height}:null,angle:o.angle,texture:o.texture?.key};};
  const robot=all.find(o=>o.name==='mission10-robot-v2'), rb=robot?{x:robot.x+(17-robot.displayOriginX)*robot.scaleX,y:robot.y+(17-robot.displayOriginY)*robot.scaleY,width:958*robot.scaleX,height:1462*robot.scaleY}:null;
  const progress=all.find(o=>o.name==='mission10-progress');
  return {robotVisible:rb,signalRegions:g.registry.get('sceneComposition').mission10.signalRegions,progress:progress?{x:progress.x,y:progress.y,dots:progress.list.map(o=>({lit:o.commandBuffer.includes(0x69f6c0)}))}:null,snapshot:window.__ROBOTLAB_QA__.mission10Controller.snapshot,evaluation:g.registry.get('mission10SignalEvaluation'),presentation:g.registry.get('mission10SignalPresentation'),targets:all.filter(o=>o.input?.enabled).map(info),objects:all.filter(o=>o.name?.includes('signal')||o.name?.includes('reflector')||o.name==='mission10-title'||o.name?.includes('progress')).map(info),texts:all.filter(o=>typeof o.text==='string').map(o=>o.text),counts:{graphics:all.filter(o=>o.type==='Graphics').length,objects:all.length,tweens:s.tweens.getTweens().length,resize:s.scale.listenerCount('resize'),pointerup:s.input.listenerCount('pointerup'),pointerdown:s.input.listenerCount('pointerdown'),stageRoots:all.filter(o=>o.name==='mission10-stage-root').length},gate:!!all.find(o=>o.name==='mission10-orientation-gate'),active:s.sys.isActive(),bundle:[...document.scripts].map(o=>o.src).filter(Boolean)};
}
async function reset(p,seed){await p.evaluate(seed=>{window.__ROBOTLAB_QA__.mission10Controller.initializeStageShortcut('signal',seed);window.__ROBOTLAB_GAME__.scene.start('Mission10Scene');},seed);await p.waitForTimeout(220);}
async function tap(p,id,touch){const q=await p.evaluate(id=>{const s=window.__ROBOTLAB_GAME__.scene.getScenes(true)[0],a=[];const walk=o=>{a.push(o);if(Array.isArray(o.list))o.list.forEach(walk);};s.children.list.forEach(walk);const t=a.find(o=>o.name===id);if(!t)throw Error('Missing '+id);const b=t.getBounds();return{x:b.centerX,y:b.centerY};},id);if(touch)await p.touchscreen.tap(q.x,q.y);else await p.mouse.click(q.x,q.y);}
async function shot(p,label){if(p.__capture===false)return;const file=path.join(out,label+'.png');await p.screenshot({path:file,timeout:60000});report.shots.push(file);}
(async()=>{
const logic=await import('../src/game/mechanics/mission10/signalPuzzle.ts');
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const[width,height,reduced=false]of[[844,390],[915,412],[1280,720],[1920,1080],[1024,768],[568,320],[844,390,true]]){
 const touch=width<1000,c=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:reduced?'reduce':'no-preference'}),p=await c.newPage(),label=width+'x'+height+(reduced?'-reduced':'');
 p.on('pageerror',e=>report.errors.push(label+': '+String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(label+': '+m.text());});p.on('requestfailed',r=>report.errors.push(label+': '+r.url()+' '+r.failure()?.errorText));p.on('response',r=>{if(r.status()>=400)report.errors.push(label+': '+r.status()+' '+r.url());});
 await p.goto('http://127.0.0.1:4198/?qaMission=10&stage=signal',{waitUntil:'load',timeout:90000});await p.waitForFunction(()=>window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene'),null,{timeout:90000});
 const seeds=await p.evaluate(()=>{const r={};for(let n=0;n<100;n++){const q=window.__ROBOTLAB_QA__.mission10Controller;q.initializeStageShortcut('signal',n);r[q.snapshot.signalConfigId]??=n;if(Object.keys(r).length===3)break;}return r;});
 check(label+'-all-config-seeds',Object.keys(seeds).length===3,seeds);
 for(const config of logic.MISSION10_SIGNAL_CONFIGS){if(reduced&&config.id!=='SIGNAL_C')continue;p.__capture=width===844||config.id==='SIGNAL_C';
  await reset(p,seeds[config.id]);let state=await p.evaluate(inspect);const initial=state,tag=label+'-'+config.id,goal=logic.findMission10SignalSolution(config);
  check(tag+'-initial-beam',state.evaluation.segments.length>0&&!state.evaluation.receiverHit,state.evaluation);
  check(tag+'-reflector-count',state.targets.filter(o=>o.data?.reflectorId).length===config.reflectors.length);
  check(tag+'-title',state.texts.includes('НАСТРОЙ СИГНАЛ')&&!state.texts.includes('ЛУЧ ИЗМЕНИЛ ПУТЬ'),state.texts);
  const regions=state.signalRegions,progress=state.progress,rb=state.robotVisible,source=state.presentation.source,targets=state.targets.filter(o=>o.data?.reflectorId);
  check(tag+'-progress-four-three-lit',progress?.dots.length===4&&progress.dots.filter(o=>o.lit).length===3,progress);
  check(tag+'-progress-centered-below-title',Math.abs(progress.x-(regions.TITLE.x+regions.TITLE.width/2))<0.1&&progress.y>=regions.TITLE.y+regions.TITLE.height,progress);
  check(tag+'-beam-core-visible',state.presentation.coreWidth>=3,state.presentation.coreWidth);
  check(tag+'-beam-viewport',state.presentation.points.every(s=>[s.from,s.to].every(p=>p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)),state.presentation.points);
  check(tag+'-targets-child-size',targets.every(t=>t.width>=60&&t.height>=60),targets);
  const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  check(tag+'-targets-nonoverlap',targets.every((a,i)=>targets.slice(i+1).every(b=>!intersects(a.bounds,b.bounds))));
  check(tag+'-robot-viewport-grounded',rb&&rb.x>0&&rb.y>=0&&rb.x+rb.width<width&&rb.y+rb.height<=height&&Math.abs(rb.y+rb.height-regions.ROBOT_GROUND_Y)<0.1,rb);
  check(tag+'-robot-clear-source',!(source.x>=rb.x&&source.x<=rb.x+rb.width&&source.y>=rb.y&&source.y<=rb.y+rb.height));
  check(tag+'-receiver-inactive',state.objects.find(o=>o.name==='mission10-signal-receiver')?.data.active===false);
  await shot(p,tag+'-initial');
  const crossTargets=targets.slice(0,2).map(t=>({x:t.bounds.x+t.bounds.width/2,y:t.bounds.y+t.bounds.height/2}));
  if(touch){const cdp=await c.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[crossTargets[0]]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[crossTargets[1]]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else{await p.mouse.move(crossTargets[0].x,crossTargets[0].y);await p.mouse.down();await p.mouse.move(crossTargets[1].x,crossTargets[1].y,{steps:5});await p.mouse.up();}
  check(tag+'-cross-target-drag-neutral',JSON.stringify((await p.evaluate(inspect)).snapshot)===JSON.stringify(initial.snapshot));
  for(const id of config.reflectors.map(o=>o.id)){
   await reset(p,seeds[config.id]);const before=await p.evaluate(inspect);
   await tap(p,'mission10-reflector-target-'+id.toLowerCase(),touch);await p.waitForTimeout(40);const after=await p.evaluate(inspect);
   check(tag+'-'+id+'-isolated-one-step',Object.keys(before.snapshot.reflectorOrientations).every(k=>after.snapshot.reflectorOrientations[k]===(before.snapshot.reflectorOrientations[k]+(k===id?1:0))%2),{before:before.snapshot.reflectorOrientations,after:after.snapshot.reflectorOrientations});
   if(id!=='M1')check(tag+'-'+id+'-off-path-preserves-upstream-beam',JSON.stringify(before.evaluation.segments)===JSON.stringify(after.evaluation.segments));
   check(tag+'-'+id+'-deterministic',JSON.stringify(after.evaluation)===JSON.stringify(logic.solveMission10Signal(config,after.snapshot.reflectorOrientations)));
  }
  await reset(p,seeds[config.id]);const rapidBefore=await p.evaluate(inspect);for(let n=0;n<12;n++)await tap(p,'mission10-reflector-target-m1',touch);await p.waitForTimeout(240);const rapidAfter=await p.evaluate(inspect);
  check(tag+'-rapid-12-exact',JSON.stringify(rapidBefore.snapshot.reflectorOrientations)===JSON.stringify(rapidAfter.snapshot.reflectorOrientations),rapidAfter.snapshot.reflectorOrientations);
  check(tag+'-no-stale-growth',rapidAfter.counts.graphics===rapidBefore.counts.graphics&&rapidAfter.counts.objects===rapidBefore.counts.objects&&rapidAfter.counts.resize===rapidBefore.counts.resize&&rapidAfter.counts.pointerup===rapidBefore.counts.pointerup&&rapidAfter.counts.tweens<=rapidBefore.counts.tweens+1,{before:rapidBefore.counts,after:rapidAfter.counts});
  await reset(p,seeds[config.id]);let taps=0;
  await p.evaluate(()=>{const g=window.__ROBOTLAB_GAME__,s=g.scene.getScene('Mission10Scene');window.__signalCaptureHit=false;const cb=()=>{if(g.registry.get('mission10SignalEvaluation')?.receiverHit){g.events.off('poststep',cb);s.time.timeScale=0;s.tweens.timeScale=0;window.__signalCaptureHit=true;}};g.events.on('poststep',cb);});
  for(const reflector of config.reflectors){
   state=await p.evaluate(inspect);if(state.snapshot.reflectorOrientations[reflector.id]%2===goal[reflector.id])continue;
   await tap(p,'mission10-reflector-target-'+reflector.id.toLowerCase(),touch);taps++;await p.waitForTimeout(45);state=await p.evaluate(inspect);
   if(taps===1)await shot(p,tag+'-first-rotate');
   if(!state.evaluation.receiverHit){await shot(p,tag+'-partial');if(reflector===config.reflectors.at(-2))await shot(p,tag+'-wrong-final');check(tag+'-partial-no-false-completion-'+taps,state.snapshot.stage==='SIGNAL');}
  }
  await p.waitForFunction(()=>window.__signalCaptureHit,null,{timeout:5000});await p.evaluate(threshold=>new Promise(resolve=>{const g=window.__ROBOTLAB_GAME__,s=g.scene.getScene('Mission10Scene');const cb=()=>{const t=s.tweens.getTweens().find(t=>t.targets.some(o=>o.name==='mission10-signal-success-pulse'));if(!t||t.elapsed>=threshold){g.events.off('poststep',cb);s.time.timeScale=0;s.tweens.timeScale=0;resolve();}};g.events.on('poststep',cb);s.time.timeScale=1;s.tweens.timeScale=1;cb();}),180);const final=await p.evaluate(inspect);await shot(p,tag+'-complete');
  await p.evaluate(threshold=>new Promise(resolve=>{const g=window.__ROBOTLAB_GAME__,s=g.scene.getScene('Mission10Scene');const cb=()=>{const t=s.tweens.getTweens().find(t=>t.targets.some(o=>o.name==='mission10-signal-success-pulse'));if(!t||t.elapsed>=threshold){g.events.off('poststep',cb);s.time.timeScale=0;s.tweens.timeScale=0;resolve();}};g.events.on('poststep',cb);s.time.timeScale=1;s.tweens.timeScale=1;cb();}),400);await shot(p,tag+'-receiver-activated');await p.evaluate(()=>{const s=window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');s.time.timeScale=1;s.tweens.timeScale=1;}); 
  check(tag+'-actual-receiver-hit',final.evaluation.receiverHit&&JSON.stringify(final.evaluation.segments.at(-1).to)===JSON.stringify(config.receiver),final.evaluation);
  check(tag+'-receiver-visually-active',final.objects.find(o=>o.name==='mission10-signal-receiver')?.data.active===true);if(reduced)check(tag+'-reduced-motion-no-tweens',final.counts.tweens===0,final.counts);
  check(tag+'-2-to-6-taps',taps>=2&&taps<=6,taps);check(tag+'-success-hold',final.objects.some(o=>o.name==='mission10-signal-receiver'),final.snapshot.stage);
  await p.waitForFunction(() => !!window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene').children.getByName('mission10-stage-root')?.list.find(o => o.name === 'mission10-launch-target'), null, { timeout: 7000 });check(tag+'-launch-after-hold',await p.evaluate(()=>!!window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene').children.getByName('mission10-stage-root')?.list.find(o=>o.name==='mission10-launch-target')));
  const launchHeader=await p.evaluate(()=>{const g=window.__ROBOTLAB_GAME__,s=g.scene.getScene('Mission10Scene'),t=s.children.getByName('mission10-title'),b=g.registry.get('sceneComposition').mission10.title;return{actual:{x:t.x,y:t.y},expected:{x:b.x+b.width/2,y:b.y+b.height/2}};});check(tag+'-natural-launch-header-canonical',Math.abs(launchHeader.actual.x-launchHeader.expected.x)<0.01&&Math.abs(launchHeader.actual.y-launchHeader.expected.y)<0.01,launchHeader);
  report.runs.push({tag,touch,initial,final,taps});save();
 }
 if(width===844&&!reduced){
  await reset(p,seeds.SIGNAL_C);await tap(p,'mission10-reflector-target-m1',true);await p.waitForTimeout(240);const before=await p.evaluate(inspect);
  for(const viewport of[{width:915,height:412},{width:320,height:568},{width:390,height:844},{width:844,height:390}]){await p.setViewportSize(viewport);await p.waitForFunction(v=>{const s=window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene');return s.scale.width===v.width&&s.scale.height===v.height&&!!s.children.getByName('mission10-orientation-gate')===(v.width<v.height);},viewport,{timeout:10000});await p.waitForTimeout(120);let a=await p.evaluate(inspect);check('resize-'+viewport.width+'-preserves-state',JSON.stringify(a.snapshot)===JSON.stringify(before.snapshot));if(viewport.width<500){check('portrait-'+viewport.width+'-gate',a.gate);await p.touchscreen.tap(viewport.width/2,viewport.height/2);check('portrait-'+viewport.width+'-tap-neutral',JSON.stringify((await p.evaluate(inspect)).snapshot)===JSON.stringify(before.snapshot));}await shot(p,'roundtrip-'+viewport.width+'x'+viewport.height);}
  await tap(p,'mission10-home',true);await p.waitForFunction(()=>window.__ROBOTLAB_GAME__.scene.isActive('StartScene'));check('home-keeps-state-until-play',await p.evaluate(s=>JSON.stringify(window.__ROBOTLAB_QA__.mission10Controller.snapshot)===JSON.stringify(s),before.snapshot));
  await tap(p,'start-play-button',true);await p.waitForFunction(()=>window.__ROBOTLAB_GAME__.scene.isActive('GameScene'));check('home-play-canonical-new-game',await p.evaluate(()=>window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage==='INTRO'));
 }
 await c.close();
}
}finally{await browser.close();}
report.result=report.checks.every(c=>c.ok)&&report.errors.length===0?'PASS':'FAIL';save();console.log(JSON.stringify({result:report.result,checks:report.checks.length,failed:report.checks.filter(c=>!c.ok),errors:report.errors,shots:report.shots.length}));if(report.result==='FAIL')process.exitCode=1;
})().catch(e=>{report.errors.push(String(e.stack));save();console.error(e);process.exitCode=1;});
