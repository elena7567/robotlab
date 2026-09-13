const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const tag = process.argv[2] || 'candidate';
if (!/^[a-z0-9-]+$/.test(tag)) throw new Error('Use a simple evidence tag');
const output = path.join('qa', 'stage10-remediation-layout-' + tag);
fs.mkdirSync(output, { recursive: true });
const report = { tag, functional: 'FAIL', visual: 'NOT VERIFIED', physicalDevice: 'NOT TESTED', rows: [], errors: [] };
const boxes = () => {
  const game = window.__ROBOTLAB_GAME__;
  const scene = game.scene.getScene('Mission10Scene');
  const all = []; const walk = item => { all.push(item); if (Array.isArray(item.list)) item.list.forEach(walk); }; scene.children.list.forEach(walk);
  const rect = item => {
    if(item?.input?.hitArea && item.width>0 && item.height>0) return {x:item.x-item.width/2,y:item.y-item.height/2,width:item.width,height:item.height,right:item.x+item.width/2,bottom:item.y+item.height/2}; const b = item?.getBounds?.(); return b ? { x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom } : null;
  };
  const item = name => all.find(o => o.name === name);
  const actor = (name, b) => {
    const o = item(name); if(!o) return null;
    const m=o.getWorldTransformMatrix(), x=b.x-o.displayOriginX,y=b.y-o.displayOriginY;
    const points=[m.transformPoint(x,y),m.transformPoint(x+b.width,y),m.transformPoint(x,y+b.height),m.transformPoint(x+b.width,y+b.height)];
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    return {x:Math.min(...xs),y:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)};
  };
  return {
    stage: game.registry.get('mission10Snapshot')?.stage,
    contract:game.registry.get('mission10SceneContract'),
    layout:game.registry.get('sceneComposition')?.mission10,
    gate:!!item('mission10-orientation-gate'),
    title:rect(item('mission10-title')),message:rect(item('mission10-intro-message')),
    headline:rect(item('mission10-intro-headline')),subtitle:rect(item('mission10-intro-subtitle')),
    home:rect(item('mission10-home')),sound:rect(item('mission10-sound')),cta:rect(item('mission10-intro-start')),
    ready:!!item('mission10-intro-start')?.input?.enabled,
    robot:actor('mission10-intro-robot',{x:17,y:17,width:958,height:1462}),
    beacon:actor('mission10-intro-beacon',{x:61,y:64,width:964,height:1337}),
    beaconCount:all.filter(o=>o.visible&&o.alpha>0&&['MISSION10_BEACON_OFF','MISSION10_BEACON_ON'].includes(o.texture?.key)).length,
    progressCount:all.filter(o=>o.name==='mission10-progress').length,
    texts:all.filter(o=>typeof o.text==='string').map(o=>({text:o.text,bounds:rect(o)})),
    targets:all.filter(o=>o.input?.enabled).map(o=>({name:o.name,bounds:rect(o)})),
    canvas:{width:game.canvas.width,height:game.canvas.height,css:game.canvas.getBoundingClientRect().toJSON(),dpr:devicePixelRatio},
  };
};
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const dimensions=[[1280,720],[1600,900],[1920,1080],[740,360],[844,390],[915,412],[1024,768],[390,844],[412,915],[320,568],[568,320]];
    for(const [width,height] of dimensions){
      const touch=width<1000, portrait=height>width;
      const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:'reduce',deviceScaleFactor:touch?2:1});
      const page=await context.newPage();
      const label=width+'x'+height;
      page.on('pageerror',e=>report.errors.push({label,error:String(e)}));
      page.on('console',m=>{if(m.type()==='error')report.errors.push({label,error:m.text()});});
      page.on('response',r=>{if(r.status()>=400)report.errors.push({label,error:r.status()+' '+r.url()});});
      page.on('requestfailed',r=>report.errors.push({label,error:r.url()+' '+r.failure()?.errorText}));
      await page.goto('http://127.0.0.1:4198/?qaMission=10',{waitUntil:'load',timeout:90000});
      await page.waitForFunction(()=>window.__ROBOTLAB_GAME__?.scene.isActive('Mission10Scene'),null,{timeout:90000});
      await page.waitForTimeout(180);
      const state=await page.evaluate(boxes), checks={};
      if(portrait){checks.gate=state.gate;checks.noCta=!state.cta;}
      else {
        checks.intro=state.stage==='INTRO'&&state.ready;
        checks.controlsExist=!!state.home&&!!state.sound;
        checks.titleInTopControlBand=state.title&&state.home&&state.sound&&state.title.y>=Math.min(state.home.y,state.sound.y)-2&&state.title.bottom<=Math.max(state.home.bottom,state.sound.bottom)+2;
        checks.titleBetweenControls=state.title&&state.home&&state.sound&&state.title.x>state.home.right&&state.title.right<state.sound.x;
        checks.messageAboveHeads=state.message&&state.robot&&state.beacon&&state.message.bottom+12<=Math.min(state.robot.y,state.beacon.y);
        checks.titleBeforeMessage=state.title&&state.message&&state.title.bottom<=state.message.y;
        checks.beaconHierarchy=state.robot&&state.beacon&&(state.beacon.bottom-state.beacon.y)>=(state.robot.bottom-state.robot.y)*0.98; checks.heroesSeparated=state.robot&&state.beacon&&state.robot.right<state.beacon.x;
        checks.singleBeacon=state.beaconCount===1;
        checks.noIntroProgress=state.progressCount===0;
        checks.ctaBelowHeroes=state.cta&&state.robot&&state.beacon&&state.cta.y>Math.max(state.robot.bottom,state.beacon.bottom);
        checks.ctaTouchSize=state.cta&&state.cta.height>=48;
        checks.criticalInside=state.title&&state.message&&state.cta&&[state.title,state.message,state.cta,state.robot,state.beacon].every(b=>b.x>=0&&b.y>=0&&b.right<=width&&b.bottom<=height);
      }
      const screenshot=path.join(output,label+'.png');await page.screenshot({path:screenshot});
      if(!portrait&&state.cta&&state.ready){
        const x=state.cta.x+state.cta.width/2,y=state.cta.y+state.cta.height/2;
        if(touch){await page.touchscreen.tap(x,y);await page.touchscreen.tap(x,y);} else await page.mouse.dblclick(x,y,{delay:20});
        await page.waitForFunction(()=>window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot')?.stage==='PATH',null,{timeout:10000});
        const after=await page.evaluate(()=>window.__ROBOTLAB_GAME__.registry.get('mission10Snapshot'));
        state.afterRapidCta=after; checks.rapidCtaAdvancesOnce=after.stage==='PATH'&&after.pathDecisionIndex===0&&after.pathWrongAttempts===0;
      }
      report.rows.push({label,touch,checks,state,screenshot});
      await context.close();
    }
  } finally {await browser.close();}
  report.functional=report.errors.length===0&&report.rows.every(r=>Object.values(r.checks).every(Boolean))?'PASS':'FAIL';
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({functional:report.functional,visual:report.visual,failures:report.rows.map(r=>({label:r.label,failed:Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k)})),errors:report.errors,output}));
  if(report.functional==='FAIL')process.exitCode=1;
})().catch(e=>{report.errors.push(String(e.stack));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;});


