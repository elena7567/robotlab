const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = process.cwd();
const urls = [
  'http://127.0.0.1:4198/?qaMission=6',
  'http://127.0.0.1:4198/?qaMission=7',
  'http://127.0.0.1:4198/?qaMission=8',
  'http://127.0.0.1:4198/?qaMission=9',
  'http://127.0.0.1:4198/?qaMission=10&stage=path',
  'http://127.0.0.1:4198/?qaMission=10&stage=signal',
];
const viewports = [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }];
(async()=>{
 const browser=await chromium.launch({headless:true});
 const rows=[]; const errors=[]; const failed=[];
 try {
  for (const viewport of viewports) {
   for (const url of urls) {
    const page=await browser.newPage({ viewport });
    page.on('console', m => { if (m.type()==='error') errors.push({ viewport, url, text:m.text() }); });
    page.on('pageerror', e => errors.push({ viewport, url, text:e.message }));
    page.on('requestfailed', r => failed.push({ viewport, url:r.url(), failure:r.failure()?.errorText }));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('canvas',{timeout:15000});
    await page.waitForFunction(()=>window.__ROBOTLAB_QA__ && window.__ROBOTLAB_GAME__, null, {timeout:15000});
    await page.waitForTimeout(500);
    rows.push({ viewport: `${viewport.width}x${viewport.height}`, url, characters: await page.evaluate(()=>window.__ROBOTLAB_QA__?.characters?.length ?? 0) });
    await page.close();
   }
  }
 } finally { await browser.close(); }
 const report={ generatedAt:new Date().toISOString(), result: errors.length===0 && failed.length===0 ? 'PASS':'FAIL', rows, errors, failed };
 fs.writeFileSync(path.join(root,'docs/qa/desktop-character-sizing-mobile-regression.json'), JSON.stringify(report,null,2));
 console.log(JSON.stringify({result:report.result, checks:rows.length, errors:errors.length, failedRequests:failed.length},null,2));
 if(report.result!=='PASS') process.exit(1);
})();
