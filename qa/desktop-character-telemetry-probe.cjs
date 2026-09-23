const { chromium } = require('playwright');
const scenes = [
  ['M1', 'http://127.0.0.1:4198/'],
  ['M6', 'http://127.0.0.1:4198/?qaMission=6'],
  ['M7', 'http://127.0.0.1:4198/?qaMission=7'],
  ['M8', 'http://127.0.0.1:4198/?qaMission=8'],
  ['M10', 'http://127.0.0.1:4198/?qaMission=10&stage=path'],
  ['SIG', 'http://127.0.0.1:4198/?qaMission=10&stage=signal'],
  ['VIC', 'http://127.0.0.1:4198/'],
];
(async()=>{
 const browser=await chromium.launch({headless:true});
 for (const [id,url] of scenes){
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const logs=[]; page.on('console',m=>logs.push([m.type(),m.text()])); page.on('pageerror',e=>logs.push(['pageerror',e.message]));
  await page.goto(url,{waitUntil:'domcontentloaded'}); await page.waitForSelector('canvas'); await page.waitForTimeout(800);
  if(id==='M1') await page.evaluate(()=>{window.__ROBOTLAB_QA__.characters=[]; window.__ROBOTLAB_QA__.sessionState.reset(); window.__ROBOTLAB_GAME__.scene.start('GameScene')});
  if(id==='VIC') await page.evaluate(()=>{window.__ROBOTLAB_QA__.characters=[]; window.__ROBOTLAB_GAME__.scene.start('VictoryScene')});
  await page.waitForTimeout(800);
  const chars=await page.evaluate(()=>window.__ROBOTLAB_QA__?.characters??[]);
  console.log(id, chars.map(c=>({scene:c.scene, id:c.characterId, role:c.role, ratio:c.visibleHeightRatio, result:c.result})), logs.filter(l=>l[0]==='error'||l[0]==='pageerror'));
  await page.close();
 }
 await browser.close();
})();
