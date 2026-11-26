/* Photos and receipts: stored separately from your data, survive reloads, and go into backups.
 *   python3 -m http.server 8765 &   then   node tests/photos.js */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const URL = 'http://localhost:8765/';
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };
// a small real JPEG to "take a photo" with
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGElEQVR4nGP8z8DwnwEJMDKMChCnAQBFvAf/4ZDWdgAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bh-photo-')), img = path.join(tmp, 'house.png');
  fs.writeFileSync(img, PNG);
  const browser = await browser_();
  async function browser_() { return chromium.launch(); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const go = async h => { await page.goto(URL + h); await page.waitForSelector('.page-head, .map-screen'); };
  const raw = () => page.evaluate(() => new Promise(r => { const q = indexedDB.open('bizhub'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('bizhub.v1'); g.onsuccess = () => r(g.result); }; }));

  await page.goto(URL); await page.waitForSelector('.page-head');
  await page.click('button:has-text("Load sample data")'); await page.waitForTimeout(300);
  await go('#/jobs'); await page.click('tbody tr.clickable >> nth=0'); await page.waitForSelector('text=Job costing');
  const jobUrl = page.url();
  await page.setInputFiles('.js-job-photos', [img, img]); await page.waitForTimeout(800);
  check(await page.locator('.photo-grid img').count() === 2, 'two photos added to the job');
  const data = await raw();
  check(!data.includes('data:image'), 'photos are not stored inside the main data (saves stay fast)');
  await page.goto(jobUrl); await page.reload(); await page.waitForSelector('.photo-grid img'); await page.waitForTimeout(400);
  check(await page.$$eval('.photo-grid img', els => els.every(e => e.src.startsWith('data:image/') && e.naturalWidth > 1)), 'photos show after reloading the app');

  // receipt on an expense
  await go('#/expenses'); await page.click('.page-head button:has-text("Add expense")');
  await page.fill('.modal input[name=amount]', '45'); await page.setInputFiles('.modal .js-receipt', img); await page.waitForTimeout(500);
  await page.click('.modal button[type=submit]'); await page.waitForTimeout(300);
  check(await page.locator('tbody tr >> [title="Receipt attached"]').count() >= 1, 'receipt saved on the expense');

  // backup includes the images; restoring brings them back
  const dl = page.waitForEvent('download');
  await go('#/settings'); await page.click('[data-settab=data]'); await page.click('button:has-text("Download backup")');
  const file = await (await dl).path(), backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  check(Object.keys(backup.images || {}).length === 3, `backup contains the 3 images (${Object.keys(backup.images || {}).length})`);
  const fresh = await browser.newPage(); fresh.on('dialog', d => d.accept()); fresh.on('pageerror', e => errors.push('restore: ' + e.message));
  await fresh.goto(URL); await fresh.waitForSelector('.page-head');
  await fresh.evaluate(() => new Promise(r => { const q = indexedDB.open('bizhub'); q.onsuccess = () => { const t = q.result.transaction('kv', 'readwrite'); t.objectStore('kv').clear(); t.oncomplete = r; }; }));
  await fresh.goto(URL + '#/settings'); await fresh.reload(); await fresh.waitForSelector('.page-head'); await fresh.click('[data-settab=data]');
  await fresh.click('button:has-text("Restore from backup")'); await fresh.setInputFiles('.modal input[type=file]', file);
  await fresh.click('.modal button[type=submit]'); await fresh.waitForTimeout(800);
  await fresh.goto(jobUrl); await fresh.waitForSelector('.photo-grid img'); await fresh.waitForTimeout(400);
  check(await fresh.$$eval('.photo-grid img', els => els.length === 2 && els.every(e => e.src.startsWith('data:image/'))), 'restored backup brings the photos back');

  check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  await browser.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nAll photo checks passed');
  process.exit(failures.length ? 1 : 0);
})();
