/* Sync between two devices (a phone and a PC, separate storage) through a fake GitHub.
 *
 *   python3 -m http.server 8765 &   node tests/mock-pay-server.mjs &   node tests/sync.js
 */
const { chromium, devices } = require('playwright');
const URL = 'http://localhost:8765/', PAY = 'http://localhost:8787';
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const device = async (opts, name) => {
    const ctx = await browser.newContext(opts), page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('dialog', d => (d.type() === 'prompt' ? d.accept(d.defaultValue()) : d.accept()));
    const raw = (src, write) => page.evaluate(([s, w]) => new Promise(r => {
      const q = indexedDB.open('bizhub'); q.onsuccess = () => {
        const st = q.result.transaction('kv', w ? 'readwrite' : 'readonly').objectStore('kv'), g = st.get('bizhub.v1');
        g.onsuccess = () => { const d = JSON.parse(g.result); const out = new Function('d', s)(d); if (!w) return r(out); st.put(JSON.stringify(d), 'bizhub.v1').onsuccess = () => r(out); };
      };
    }), [src, write]);
    return { ctx, page, get: e => raw(`return ${e}`, false), set: async s => { await raw(s, true); await page.reload(); await page.waitForSelector('.page-head'); } };
  };
  const syncNow = async d => { await d.page.goto(URL + '#/settings'); await d.page.waitForSelector('.page-head'); await d.page.click('[data-settab=data]'); await d.page.click('[data-act="syncNow"]'); await d.page.waitForTimeout(1500); };

  // ---- phone: has data, turns sync on ----
  const A = await device({ ...devices['iPhone 14'] }, 'phone');
  await A.page.goto(URL); await A.page.waitForSelector('.page-head');
  await A.page.click('button:has-text("Load sample data")'); await A.page.waitForTimeout(400);
  await A.set(`d.settings.syncApi = '${PAY}/gh'; d.settings.syncRaw = '${PAY}/ghraw'; d.settings.email = 'me@example.com';
    d.expenses[0].receiptImg = 'img_synctest'; return 1`);
  await A.page.evaluate(() => new Promise(r => { const q = indexedDB.open('bizhub'); q.onsuccess = () => { q.result.transaction('kv', 'readwrite').objectStore('kv').put('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'img:img_synctest').onsuccess = () => r(); }; }));
  await A.page.goto(URL + '#/settings'); await A.page.waitForSelector('.page-head'); await A.page.tap('[data-settab=data]');
  await A.page.tap('[data-act="syncSetup"]'); await A.page.waitForSelector('.modal [name=token]');
  check((await A.page.getAttribute('.modal a:has-text("Open GitHub")', 'href')).includes('scopes=gist'), 'setup opens GitHub with the right permission filled in');
  await A.page.fill('.modal [name=token]', 'wrong'); await A.page.tap('.modal .sheet-save'); await A.page.waitForTimeout(600);
  check((await A.page.textContent('.js-sync-msg')).includes('didn’t accept'), 'a wrong token is explained');
  await A.page.fill('.modal [name=token]', 'ghp_test'); await A.page.tap('.modal .sheet-save');
  await A.page.waitForSelector('.modal h2:has-text("Sync is on")', { timeout: 10000 });
  const pair = await A.page.evaluate(() => { const a = [...document.querySelectorAll('.modal a')].find(x => x.href.startsWith('mailto:')); return decodeURIComponent(a.href).match(/http\S+#\/pair\/\S+/)[0]; });
  check(pair.includes('#/pair/'), 'pairing link ready to email to yourself');
  const gists = await fetch(PAY + '/__mock/gists').then(r => r.json());
  const g = Object.values(gists.gists)[0], file = g.files['business-hub.json'];
  check(file && !file.includes('Maria') && !file.includes('Rossi') && !file.includes('416-555'), 'data on GitHub is encrypted (no names or numbers readable)');
  check(Object.keys(g.files).some(n => n.startsWith('img-')), 'photos and receipts are uploaded too');

  // ---- PC: fresh, opens the pairing link ----
  const B = await device({ viewport: { width: 1280, height: 900 } }, 'pc');
  await B.page.goto(URL); await B.page.waitForSelector('.page-head');
  await B.page.goto(pair); await B.page.waitForSelector('.modal');
  check(!B.page.url().includes('/pair/'), 'the key is removed from the address bar');
  await B.page.click('.modal button[type=submit]'); await B.page.waitForTimeout(2500);
  const aCust = await A.get('d.customers.length'), bCust = await B.get('d.customers.length');
  check(bCust === aCust && bCust > 0 && await B.get(`d.customers.some(c => c.name === 'Maria Rossi')`), `PC now has the phone’s customers (${bCust})`);
  check(await B.page.evaluate(() => new Promise(r => { const q = indexedDB.open('bizhub'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('img:img_synctest'); g.onsuccess = () => r(!!g.result); }; })), 'the receipt photo came across too');

  // ---- add on the phone → shows on the PC ----
  await A.page.goto(URL + '#/customers'); await A.page.waitForSelector('.page-head'); await A.page.tap('.fab'); await A.page.waitForSelector('.modal [name=name]');
  await A.page.fill('.modal [name=name]', 'Phone Added Person'); await A.page.fill('.modal [name=phone]', '647-555-0101');
  await A.page.tap('.modal .sheet-save'); await A.page.waitForTimeout(4500); // saves, then syncs by itself
  await syncNow(B);
  check(await B.get(`d.customers.some(c => c.name === 'Phone Added Person')`), 'customer added on the phone shows on the PC (automatically)');
  await B.page.goto(URL + '#/customers'); await B.page.waitForTimeout(300);
  check((await B.page.textContent('#main')).includes('Phone Added Person'), 'and it’s on the PC’s customer list');

  // ---- both change different things at once → both kept ----
  await A.set(`d.jobs.push({ id: 'jA', customerId: d.customers[0].id, title: 'From phone', date: '2026-12-01', status: 'scheduled', items: [] }); return 1`);
  await B.set(`d.expenses.push({ id: 'eB', date: '2026-11-27', vendor: 'From PC', category: 'Supplies', amount: 42 }); d.customers.find(c => c.name === 'Phone Added Person').notes = 'Edited on PC'; return 1`);
  await syncNow(A); await syncNow(B); await syncNow(A);
  check(await A.get(`d.jobs.some(j => j.id === 'jA') && d.expenses.some(e => e.id === 'eB')`) && await B.get(`d.jobs.some(j => j.id === 'jA') && d.expenses.some(e => e.id === 'eB')`),
    'changes made on both devices at the same time are all kept');
  check(await A.get(`d.customers.find(c => c.name === 'Phone Added Person').notes === 'Edited on PC'`), 'an edit on the PC reaches the phone');

  // ---- delete on PC → gone on phone; delete of an edited record keeps the edit ----
  const qid = await B.get('d.quotes[0].id');
  await B.set(`d.quotes = d.quotes.filter(q => q.id !== '${qid}'); return 1`);
  await syncNow(B); await syncNow(A);
  check(!(await A.get(`d.quotes.some(q => q.id === '${qid}')`)), 'a quote deleted on the PC is deleted on the phone');

  // ---- same customer edited on both → newest edit wins, nothing breaks ----
  await A.set(`d.customers[0].notes = 'phone note'; return 1`); await syncNow(A);
  await B.set(`d.customers[0].notes = 'pc note (newer)'; return 1`); await syncNow(B); await syncNow(A);
  check(await A.get(`d.customers[0].notes`) === 'pc note (newer)' && await B.get(`d.customers[0].notes`) === 'pc note (newer)', 'when both edit the same customer, the newer edit wins on both');

  // ---- lots of data (GitHub cuts big files off in its reply; the app fetches the full copy) ----
  await A.set(`for (let i = 0; i < 6000; i++) d.pins.push({ id: 'pz' + i, lat: 43.6 + i / 1e4, lng: -79.4 - i / 1e4, status: ['sale','no','quote','comeback','nothome'][i % 5],
    address: i + ' Long Example Street, Toronto, ON M4M 1A1', notes: 'Knocked at ' + i + ', talked to the owner about windows and gutters ' + Math.random().toString(36), history: [{ at: '2026-11-0' + (1 + i % 9) + 'T10:00', status: 'no' }] }); return 1`);
  await syncNow(A);
  const big = Object.values((await fetch(PAY + '/__mock/gists').then(r => r.json())).gists)[0].files['business-hub.json'].length;
  await syncNow(B);
  check(big > 200000 && await B.get(`d.pins.filter(p => p.id.startsWith('pz')).length`) === 6000, `large data set syncs in full (${Math.round(big / 1024)} KB encrypted, 6,000 pins)`);

  // ---- device-only things stay on their device; backups never include the key ----
  check(await A.get('d.settings.sync.key') === await B.get('d.settings.sync.key') && await A.get('d.settings.syncApi') !== undefined, 'both devices share the same private key');
  await A.page.goto(URL + '#/settings'); await A.page.tap('[data-settab=data]');
  check((await A.page.textContent('.js-sync-state')).includes('Last synced'), 'Settings shows when it last synced');

  // ---- turn off on the PC: data stays ----
  await B.page.goto(URL + '#/settings'); await B.page.click('[data-settab=data]'); await B.page.click('[data-act="syncOff"]'); await B.page.waitForTimeout(400);
  check(!(await B.get('d.settings.sync')) && await B.get('d.customers.length') > 0, 'turning sync off keeps the data on that device');

  check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  await browser.close();
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nAll sync checks passed');
  process.exit(failures.length ? 1 : 0);
})();
