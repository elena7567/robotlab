// Natural production flow only: no source imports in browser, scene jumps, or game-state mutations.
const { chromium } = require('playwright');
const fs = require('node:fs');
const report = { result:'FAIL', completed:[], checks:[], errors:[], screenshots:[] };
const check=(name,ok,data)=>{report.checks.push({name,ok,data});if(!ok)throw Error(name+' failed: '+JSON.stringify(data));};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function scene(page,key){await page.waitForFunction(key=>window.__ROBOTLAB_GAME__?.scene.isActive(key),key,{timeout:90000});}
async function state(page){return page.evaluate(()=>window.__ROBOTLAB_QA__.sessionState.snapshot);}
async function point(page,key,name){
 await page.waitForFunction(({key,name})=>{const s=window.__ROBOTLAB_GAME__?.scene.getScene(key);const walk=x=>[x,...(x.list||[]).flatMap(walk)];return (key!=='Mission10Scene'||!s?.interactionLocked)&&s?.children.list.flatMap(walk).some(x=>x.name===name&&x.active&&x.visible&&x.input?.enabled);},{key,name},{timeout:15000});
 return page.evaluate(({key,name})=>{const game=window.__ROBOTLAB_GAME__;const walk=x=>[x,...(x.list||[]).flatMap(walk)];const item=game.scene.getScene(key).children.list.flatMap(walk).find(x=>x.name===name&&x.active&&x.visible&&x.input?.enabled);const b=item.getBounds();const origin=key==='Mission10Scene'?item.getWorldTransformMatrix().transformPoint(0,0):{x:b.centerX,y:b.centerY};const c=game.canvas.getBoundingClientRect();return {x:c.x+origin.x*c.width/game.scale.width,y:c.y+origin.y*c.height/game.scale.height};},{key,name});
}
async function tap(page,key,name){const p=await point(page,key,name);await page.touchscreen.tap(p.x,p.y);if(key==='Mission10Scene')await page.waitForTimeout(100);}
async function drag(page,key,from,to){const a=await point(page,key,from),b=await point(page,key,to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();}
async function rememberCard(page,key,name){await page.evaluate(({key,name})=>{window.fullFlowPreviousCard=window.__ROBOTLAB_GAME__.scene.getScene(key).children.getByName(name);},{key,name});}
async function newCard(page,key,name){await page.waitForFunction(({key,name})=>{const s=window.__ROBOTLAB_GAME__.scene.getScene(key);return !s.sys.isActive()||s.children.getByName(name)!==window.fullFlowPreviousCard;},{key,name},{timeout:15000});}
async function cardState(page,key,name){return page.evaluate(({key,name})=>window.__ROBOTLAB_GAME__.scene.getScene(key).children.getByName(name).snapshot,{key,name});}
async function shot(page,label){const file='docs/qa/screenshots/stage10-remediation-natural-final-'+label+'.png';await page.screenshot({path:file});report.screenshots.push(file);}
async function completed(page,n){await page.waitForFunction(n=>window.__ROBOTLAB_QA__.sessionState.snapshot.completedTasks>=n,n,{timeout:15000});const s=await state(page);check('mission-'+n+'-natural-progression',s.completedTasks===n,s);report.completed.push(n);console.log('Completed Mission '+n);}
(async()=>{
 const sequence=await import('../src/game/mechanics/sequence.ts');
 const sizes=await import('../src/game/mechanics/sizeComparison.ts');
 const shadows=await import('../src/game/mechanics/shadowMatching.ts');
 const program=await import('../src/game/mechanics/programming.ts');
 const energy10=await import('../src/game/mechanics/mission10/energyRelayPuzzle.ts');
 const signal10=await import('../src/game/mechanics/mission10/signalPuzzle.ts');
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('requestfailed',r=>report.errors.push(r.url()));
 try{
  await page.goto('http://127.0.0.1:4198/',{waitUntil:'commit'});await scene(page,'StartScene');
  check('exact-final-bundle',(await page.locator('script[src]').evaluateAll(xs=>xs.map(x=>x.src))).some(x=>x.endsWith('/index-2HhaQEWP.js')));
  check('fresh-session-cannot-enter-m10',!(await page.evaluate(()=>window.__ROBOTLAB_GAME__.scene.isActive('Mission10Scene'))),await state(page));
  await tap(page,'StartScene','start-play-button');await scene(page,'GameScene');
  await tap(page,'GameScene','choice-odd-ball');await completed(page,1);
  for(const [mission,answers] of [[2,sequence.SEQUENCE_CHALLENGES.map(x=>'sequence-'+x.correctAnswer)],[3,sizes.SIZE_COMPARISON_CHALLENGES.map(x=>'size-'+x.correctSize)],[4,shadows.SHADOW_MATCHING_CHALLENGES.map(x=>x.correctKey)]]){
   for(const answer of answers){await point(page,'GameScene','choice-'+answer);await rememberCard(page,'GameScene','task-card');await tap(page,'GameScene','choice-'+answer);await newCard(page,'GameScene','task-card');}
   await completed(page,mission);
  }
  await page.waitForFunction(()=>Boolean(window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('memory-task-card')),null,{timeout:15000});
  const pairs=await page.evaluate(()=>{const card=window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('memory-task-card');if(!card)throw Error('Memory card missing');const groups={};for(const [id,view]of card.cardViews){(groups[view.face.texture.key]??=[]).push(id)}return Object.values(groups)});
  for(const ids of pairs){await tap(page,'GameScene','memory-card-'+ids[0]);await tap(page,'GameScene','memory-card-'+ids[1]);await page.waitForFunction(()=>{const card=window.__ROBOTLAB_GAME__.scene.getScene('GameScene').children.getByName('memory-task-card');return !card||!card.getData('locked');},null,{timeout:15000});}
  await completed(page,5);await scene(page,'TransitionScene');await tap(page,'TransitionScene','transition-continue');await scene(page,'Mission6Scene');
  for(let i=0;i<3;i++){
   const s=await cardState(page,'Mission6Scene','energy-task-card');await rememberCard(page,'Mission6Scene','energy-task-card');
   for(const level of s.challenge.kind==='order'?s.challenge.correctOrder:[s.challenge.correctSelection])await tap(page,'Mission6Scene','energy-battery-'+level);
   await tap(page,'Mission6Scene','energy-check-button');if(i<2)await newCard(page,'Mission6Scene','energy-task-card');
  }
  await completed(page,6);await tap(page,'Mission6Scene','mission6-continue');await scene(page,'Mission7Scene');
  for(let i=0;i<3;i++){
   const s=await cardState(page,'Mission7Scene','connection-task-card');await rememberCard(page,'Mission7Scene','connection-task-card');
   for(const color of s.challenge.colors)await drag(page,'Mission7Scene','connection-source-'+color,'connection-target-'+color);
   if(i<2)await newCard(page,'Mission7Scene','connection-task-card');
  }
  await completed(page,7);await tap(page,'Mission7Scene','mission7-continue');await scene(page,'Mission8Scene');
  for(let i=0;i<3;i++){
   const challenge=program.PROGRAMMING_CHALLENGES[i];await rememberCard(page,'Mission8Scene','programming-board');
   for(const command of program.findShortestGridPath(challenge,challenge.start,challenge.targetCell))await tap(page,'Mission8Scene','program-command-'+command);
   await tap(page,'Mission8Scene','programming-run-button');if(i<2)await newCard(page,'Mission8Scene','programming-board');
  }
  await completed(page,8);await tap(page,'Mission8Scene','mission8-continue');await scene(page,'Mission9Scene');
  for(const stage of ['BRIDGE','GATE','POWER']){
   await page.waitForFunction(stage=>window.__ROBOTLAB_GAME__.registry.get('mission9PuzzleContract')?.stage===stage,stage,{timeout:15000});
   const c=await page.evaluate(()=>window.__ROBOTLAB_GAME__.registry.get('mission9PuzzleContract'));
   await tap(page,'Mission9Scene','mission9-choice-'+c.correctCandidateId);await tap(page,'Mission9Scene','mission9-drop-target-hitarea');
  }
  await completed(page,9);await shot(page,'mission9-complete');await tap(page,'Mission9Scene','mission9-continue-mission10');await scene(page,'Mission10Scene');
  check('m9-handoff-intro',await page.evaluate(()=>window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage==='INTRO'),await state(page));
  await shot(page,'mission10-intro');await tap(page,'Mission10Scene','mission10-intro-start');
  const m10=()=>page.evaluate(()=>window.__ROBOTLAB_QA__.mission10Controller.snapshot);
  while((await m10()).stage==='PATH'){
   await page.waitForFunction(()=>!window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene').interactionLocked,null,{timeout:15000});const s=await m10();if(s.stage!=='PATH')break;const safe=await page.evaluate(()=>{const walk=x=>[x,...(x.list||[]).flatMap(walk)];return window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene').children.list.flatMap(walk).find(x=>x.input?.enabled&&x.getData?.('hazardKind')==='SAFE').name});
   await tap(page,'Mission10Scene',safe);await page.waitForFunction(index=>{const s=window.__ROBOTLAB_QA__.mission10Controller.snapshot;return s.stage!=='PATH'||s.pathDecisionIndex>index},s.pathDecisionIndex,{timeout:15000});await pause(100);
  }
  let s=await m10();check('path-to-energy',s.stage==='ENERGY',s);
  const energyGoal=energy10.findMission10EnergySolution(energy10.getMission10EnergyConfig(s.energyConfigId)).orientations;
  for(const [id,wanted]of Object.entries(energyGoal))for(let guard=0;guard<4;guard++){s=await m10();if(s.stage!=='ENERGY'||s.relayOrientations[id]===wanted)break;await tap(page,'Mission10Scene','mission10-relay-'+id.toLowerCase());}
  await page.waitForFunction(()=>window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage==='SIGNAL',null,{timeout:15000});s=await m10();
  const signalGoal=signal10.findMission10SignalSolution(signal10.getMission10SignalConfig(s.signalConfigId));
  for(const [id,wanted]of Object.entries(signalGoal))for(let guard=0;guard<2;guard++){s=await m10();if(s.stage!=='SIGNAL'||s.reflectorOrientations[id]%2===wanted)break;await tap(page,'Mission10Scene','mission10-reflector-target-'+id.toLowerCase());}
  await page.waitForFunction(()=>window.__ROBOTLAB_QA__.mission10Controller.snapshot.stage==='LAUNCH',null,{timeout:15000});await shot(page,'mission10-launch');
  await tap(page,'Mission10Scene','mission10-launch-target');await scene(page,'VictoryScene');await completed(page,10);await shot(page,'victory');
  check('victory-once',await page.evaluate(()=>window.__ROBOTLAB_GAME__.scene.getScenes(true).filter(x=>x.sys.settings.key==='VictoryScene').length===1),await state(page));
  await tap(page,'VictoryScene','victory-play-again');await scene(page,'GameScene');
  let reset=await state(page);check('play-again-resets',reset.completedTasks===0,reset);
  check('play-again-stops-victory-audio',await page.evaluate(()=>!window.__ROBOTLAB_GAME__.sound.sounds.some(x=>x.key==='audio-mission10-victory-theme'&&x.isPlaying)),null);
  await tap(page,'GameScene','game-home');await scene(page,'StartScene');check('home-after-replay',true,await state(page));
  check('console-network-clean',report.errors.length===0,report.errors);report.result='PASS';
 }catch(e){report.errors.push(e.stack||e.message);report.failureState=await page.evaluate(()=>({session:window.__ROBOTLAB_QA__?.sessionState.snapshot,m10:window.__ROBOTLAB_QA__?.mission10Controller.snapshot})).catch(()=>null);console.error(e);await shot(page,'failure').catch(()=>{});process.exitCode=1;}
 finally{fs.writeFileSync('docs/qa/stage10-remediation-full-game.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});




