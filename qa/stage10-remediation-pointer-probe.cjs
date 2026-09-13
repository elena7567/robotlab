const { chromium }=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const stage=(process.argv[2]||'path').toLowerCase(),tag=process.argv[3]||'baseline';
if(stage!=='path'||!/^[a-z0-9-]+$/.test(tag))throw Error('Currently implemented stage CLI: path <evidence-tag>');
const dir=path.join('qa',`stage10-remediation-${stage}-${tag}`);fs.mkdirSync(dir,{recursive:true});
const report={stage,tag,result:'FAIL',visual:'NOT VERIFIED',checks:[],errors:[],screenshots:[],runs:[],physicalDevice:'NOT TESTED'};
function check(name,ok,actual){report.checks.push({name,ok:!!ok,actual});fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify(report,null,2));}
function inspect(){
 const g=window.__ROBOTLAB_GAME__,s=g.scene.getScene('Mission10Scene'),all=[];
 const walk=o=>{all.push(o);if(Array.isArray(o.list))o.list.forEach(walk);};s.children.list.forEach(walk);
 const rect=o=>{if(o?.input?.hitArea&&o.width>0&&o.height>0)return{x:o.x-o.width/2,y:o.y-o.height/2,width:o.width,height:o.height,right:o.x+o.width/2,bottom:o.y+o.height/2};const b=o?.getBounds?.();return b?{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}:null;};
 const robot=all.find(o=>o.name==='mission10-robot-v2');
 return {snapshot:window.__ROBOTLAB_QA__.mission10Controller.snapshot,rendered:g.registry.get('mission10Snapshot'),contract:g.registry.get('mission10SceneContract'),
 robot:robot?{x:robot.x,y:robot.y,angle:robot.angle,bounds:rect(robot)}:null,
 title:rect(all.find(o=>o.name==='mission10-title')),feedback:all.find(o=>o.name==='mission10-feedback')?.text,
 lanes:all.filter(o=>o.name?.startsWith('mission10-path-target-')).map(o=>({name:o.name,laneId:o.getData('laneId'),kind:o.getData('hazardKind'),bounds:rect(o),enabled:!!o.input?.enabled})),
 art:all.filter(o=>o.name?.startsWith('mission10-path-')&&!o.name.includes('target')).map(o=>({name:o.name,texture:o.texture?.key,bounds:rect(o),alpha:o.alpha})),
 texts:all.filter(o=>typeof o.text==='string').map(o=>({text:o.text,bounds:rect(o)})),
 pointerOwner:s.pointerOwner,locked:s.interactionLocked};
}
const center=b=>({x:b.x+b.width/2,y:b.y+b.height/2});
async function tap(page,target,touch,edge=false){const p=edge?{x:target.bounds.x+3,y:target.bounds.y+target.bounds.height/2}:center(target.bounds);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}
async function shot(page,label){const p=path.join(dir,label+'.png');await page.screenshot({path:p});report.screenshots.push(p);}
async function reset(page,seed){await page.evaluate(seed=>{window.__ROBOTLAB_QA__.mission10Controller.initializeStageShortcut('path',seed);window.__ROBOTLAB_GAME__.scene.getScene('Mission10Scene').scene.restart();},seed);await page.waitForFunction(()=>window.__ROBOTLAB_GAME__.scene.isActive('Mission10Scene')&&window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot')?.stage==='PATH');await page.waitForTimeout(100);}
async function cancellation(page,seed){
 await reset(page,seed);let s=await page.evaluate(inspect);const a=s.lanes.find(l=>l.kind!=='SAFE'),b=s.lanes.find(l=>l.kind==='SAFE');
 await page.mouse.move(center(a.bounds).x,center(a.bounds).y);await page.mouse.down();await page.mouse.move(center(b.bounds).x,center(b.bounds).y,{steps:5});await page.mouse.up();
 await page.waitForTimeout(40);let after=await page.evaluate(inspect);check('down-other-up-safe-does-not-activate',after.snapshot.pathDecisionIndex===0&&after.snapshot.pathWrongAttempts===0,after);
 await reset(page,seed);s=await page.evaluate(inspect);const wrong=s.lanes.find(l=>l.kind!=='SAFE');
 await page.mouse.move(center(wrong.bounds).x,center(wrong.bounds).y);await page.mouse.down();await page.mouse.move(4,4,{steps:5});await page.mouse.up();
 await page.waitForTimeout(40);after=await page.evaluate(inspect);check('release-outside-clears-owner',after.pointerOwner===null,after);
 await tap(page,wrong,false);await page.waitForTimeout(60);after=await page.evaluate(inspect);check('tap-after-cancel-works',after.snapshot.pathWrongAttempts===1&&after.snapshot.pathDecisionIndex===0,after);
}
async function playPath(page,seed,touch,label){
 await reset(page,seed);let s=await page.evaluate(inspect);const run={label,seed,config:s.snapshot.pathConfigId,rounds:[]};report.runs.push(run);
 for(let round=0;round<3;round++){
  s=await page.evaluate(inspect);if(s.snapshot.stage!=='PATH'){check(label+'-unexpected-stage',false,s);return;}
  const initial=s;await shot(page,label+'-round'+round+'-idle');
  check(label+'-round'+round+'-three-semantic-lanes',s.lanes.length===3&&new Set(s.lanes.map(l=>l.kind)).size===3,s.lanes);
  check(label+'-round'+round+'-art-matches-target',s.lanes.every(l=>s.art.find(a=>a.name==='mission10-path-'+l.laneId.toLowerCase())?.texture==='MISSION10_PATH_'+l.kind),s.art);
  check(label+'-round'+round+'-touch-targets',s.lanes.every(l=>l.bounds.width>=48&&l.bounds.height>=48),s.lanes);
  const ordered=[...s.lanes].sort((a,b)=>a.bounds.x-b.bounds.x);
  check(label+'-round'+round+'-no-neighbor-hit-overlap',ordered.slice(1).every((l,i)=>l.bounds.x>ordered[i].bounds.right),s.lanes);
  const gap={x:(ordered[0].bounds.right+ordered[1].bounds.x)/2,y:center(ordered[0].bounds).y};
  if(touch)await page.touchscreen.tap(gap.x,gap.y);else await page.mouse.click(gap.x,gap.y);
  let after=await page.evaluate(inspect);check(label+'-round'+round+'-gap-no-action',after.snapshot.pathWrongAttempts===s.snapshot.pathWrongAttempts&&after.snapshot.pathDecisionIndex===round,after.snapshot);
  const wrongs=s.lanes.filter(l=>l.kind!=='SAFE');
  for(const wrong of wrongs){
   const before=await page.evaluate(inspect);await tap(page,wrong,touch,true);await page.waitForTimeout(65);after=await page.evaluate(inspect);
   check(label+'-round'+round+'-'+wrong.kind+'-no-advance',after.snapshot.pathDecisionIndex===round&&after.snapshot.stage==='PATH'&&after.snapshot.pathWrongAttempts===before.snapshot.pathWrongAttempts+1,after.snapshot);
   check(label+'-round'+round+'-'+wrong.kind+'-visible-reaction',Math.abs(after.robot.x-before.robot.x)>0.5||Math.abs(after.robot.angle-before.robot.angle)>0.25,{before:before.robot,after:after.robot});
   if(round===0)await shot(page,label+'-'+wrong.kind.toLowerCase()+'-reaction');await page.waitForTimeout(600);
  }
  const before=await page.evaluate(inspect),safe=before.lanes.find(l=>l.kind==='SAFE');await tap(page,safe,touch);
  await page.waitForTimeout(65);after=await page.evaluate(inspect);
  check(label+'-round'+round+'-safe-moves-toward-lane',Math.abs(after.robot.x-before.robot.x)>2&&Math.sign(after.robot.x-before.robot.x)===Math.sign(center(safe.bounds).x-before.robot.x),{before:before.robot,after:after.robot,safe:safe.bounds});
  await tap(page,safe,touch);const rapid=await page.evaluate(inspect);
  check(label+'-round'+round+'-rapid-no-skip',rapid.snapshot.pathDecisionIndex===round+1,{before:before.snapshot,after:rapid.snapshot});
  await shot(page,label+'-round'+round+'-safe-motion');await page.waitForTimeout(700);after=await page.evaluate(inspect);
  check(label+'-round'+round+'-safe-advances-once',after.snapshot.pathDecisionIndex===round+1&&after.snapshot.stage===(round===2?'ENERGY':'PATH'),after.snapshot);
  run.rounds.push({index:round,initial,after});
 }
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const matrix=[[1280,720,false]];
  for(const [width,height,allConfigs] of matrix){
   const touch=width<1000,context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'no-preference'}),page=await context.newPage(),label=width+'x'+height;
   page.on('pageerror',e=>report.errors.push({label,error:String(e)}));page.on('console',m=>{if(m.type()==='error')report.errors.push({label,error:m.text()});});page.on('response',r=>{if(r.status()>=400)report.errors.push({label,error:r.status()+' '+r.url()});});page.on('requestfailed',r=>report.errors.push({label,error:r.url()+' '+r.failure()?.errorText}));
   await page.goto('http://127.0.0.1:4198/?qaMission=10&stage=path',{waitUntil:'load',timeout:90000});await page.waitForFunction(()=>window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene'),null,{timeout:90000});
   const seeds=await page.evaluate(()=>{const result={};for(let n=0;n<100;n++){window.__ROBOTLAB_QA__.mission10Controller.initializeStageShortcut('path',n);const id=window.__ROBOTLAB_QA__.mission10Controller.snapshot.pathConfigId;if(!(id in result))result[id]=n;if(Object.keys(result).length===3)break;}return result;});
   if(width===1280)await cancellation(page,Object.values(seeds)[0]);
   if(allConfigs||width===740||width===1024){for(const [config,seed] of Object.entries(seeds).slice(0,allConfigs?3:1))await playPath(page,seed,touch,label+'-'+config);}
   else{await reset(page,Object.values(seeds)[0]);await shot(page,label+'-layout');report.runs.push({label,layoutOnly:true,state:await page.evaluate(inspect)});}
   await context.close();
  }
 }finally{await browser.close();}
 report.result=report.errors.length===0&&report.checks.every(c=>c.ok)?'PASS':'FAIL';fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,checks:report.checks.length,failed:report.checks.filter(c=>!c.ok).map(c=>c.name),errors:report.errors,screenshots:report.screenshots.length,dir}));if(report.result==='FAIL')process.exitCode=1;
})().catch(e=>{report.errors.push(String(e.stack));fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;});


