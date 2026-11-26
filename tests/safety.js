/* Daily copies: erase everything, then roll back from Settings.
 *   python3 -m http.server 8765 &   then   node tests/safety.js */
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/';
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto(URL); await page.waitForSelector('.page-head');
  await page.click('button:has-text("Load sample data")'); await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector('.page-head'); await page.waitForTimeout(500); // app opens → today's copy is made
  await page.goto(URL + '#/settings'); await page.waitForSelector('.page-head'); await page.click('[data-settab=data]');
  await page.waitForSelector('.js-snapshots .list-item');
  check((await page.textContent('.js-snapshots')).includes('8 customers'), 'today’s automatic copy is listed');
  await page.click('button:has-text("Erase everything")'); await page.waitForTimeout(500);
  await page.goto(URL + '#/customers'); await page.waitForSelector('.page-head');
  check((await page.textContent('.page-head')).includes('0 total'), 'everything erased');
  await page.goto(URL + '#/settings'); await page.waitForSelector('.page-head'); await page.click('[data-settab=data]');
  await page.waitForSelector('.js-snapshots .list-item'); await page.click('.js-snapshots button:has-text("Restore")'); await page.waitForTimeout(600);
  await page.goto(URL + '#/customers'); await page.waitForSelector('.page-head');
  check((await page.textContent('.page-head')).includes('8 total'), 'rolled back: customers are back');
  check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  await browser.close();
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nAll safety checks passed');
  process.exit(failures.length ? 1 : 0);
})();
