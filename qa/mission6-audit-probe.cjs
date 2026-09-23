const { chromium } = require('playwright');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', async (message) => {
    const values = [];
    for (const arg of message.args()) values.push(await arg.jsonValue().catch(() => String(arg)));
    console.log(JSON.stringify({ type: message.type(), text: message.text(), values }, null, 2));
  });
  await page.goto('http://127.0.0.1:4198/?qaMission=6', { waitUntil: 'load' });
  await sleep(1200);
  const audit = await page.evaluate(() => window.__ROBOTLAB_GAME__.registry.get('boundsAudit'));
  console.log('AUDIT', JSON.stringify(audit, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });