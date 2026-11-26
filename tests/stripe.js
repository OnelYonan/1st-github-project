/* End-to-end test of the Stripe features against the mock payment server.
 *
 *   python3 -m http.server 8765 &        # the app
 *   node tests/mock-pay-server.mjs &     # payment server with a fake Stripe
 *   node tests/stripe.js [screenshotDir]
 */
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/', PAY = 'http://localhost:8787';
const shots = process.argv[2];
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); };
const mock = (path) => fetch(PAY + path, { method: path.includes('log') ? 'GET' : 'POST' }).then(r => r.json());

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => (d.type() === 'prompt' ? d.accept(d.defaultValue()) : d.accept()));
  const go = async hash => { await page.goto(URL + hash); await page.waitForSelector('.page-head'); };
  const shot = async name => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
  const dbGet = fn => page.evaluate(src => new Promise(r => { const q = indexedDB.open('bizhub'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('bizhub.v1'); g.onsuccess = () => r(new Function('d', 'return ' + src)(JSON.parse(g.result))); }; }), fn);
  const submit = () => page.click('.modal button[type=submit]');

  await page.goto(URL); await page.waitForSelector('.page-head');
  await page.click('button:has-text("Load sample data")'); await page.waitForTimeout(300);

  // Connect
  await go('#/settings'); await page.click('[data-settab=plans]');
  await page.fill('#settingsForm [name=stripeUrl]', PAY);
  await page.fill('#settingsForm [name=stripeToken]', 'wrong');
  await page.click('button:has-text("Save & test connection")'); await page.waitForTimeout(600);
  check((await page.textContent('.js-stripe-status')).includes('Wrong app token'), 'wrong token is rejected');
  await page.fill('#settingsForm [name=stripeToken]', 'test-token-123');
  await page.click('button:has-text("Save & test connection")'); await page.waitForSelector('.js-stripe-status .badge.good');
  check((await page.textContent('.js-stripe-status')).includes('Mock Window Co') && (await page.textContent('.js-stripe-status')).includes('Test mode'), 'connected to Stripe (test mode)');
  await shot('stripe-settings');

  // Save a card through Stripe
  await go('#/customers'); await page.click('tbody tr.clickable:has-text("David Chen")');
  await page.click('button:has-text("Save card with Stripe")'); await page.waitForSelector('.modal .js-refresh');
  check((await page.getAttribute('.modal a:has-text("Customer is here")', 'href')).startsWith('https://checkout.stripe.com/'), 'secure Stripe card page link created');
  const davidStripe = await dbGet('d.customers.find(c => c.name === "David Chen").stripeId');
  check(/^cus_/.test(davidStripe || ''), 'customer created in Stripe');
  await mock(`/__mock/save-card?customer=${davidStripe}&last4=4242`);
  await page.click('.modal .js-refresh'); await page.waitForTimeout(400);
  check(await page.isVisible('.card-row:has-text("•••• 4242") >> text=ready to charge'), 'card synced from Stripe and ready to charge');
  await shot('stripe-customer');

  // Invoice → charge saved card → refund
  await page.click('.page-head [data-menu]'); await page.click('.menu-item:has-text("New invoice")');
  await page.fill('.modal [data-k=desc]', 'Window cleaning (exterior)'); await page.waitForTimeout(100);
  await submit(); await page.waitForSelector('.doc h1:has-text("INVOICE")');
  await page.click('.doc-actions button:has-text("•••• 4242")'); await page.waitForSelector('.modal:has-text("Charge David Chen")');
  await submit(); await page.waitForTimeout(800);
  check((await page.textContent('.page-head .badge')).trim() === 'paid', 'invoice charged through Stripe and marked paid');
  check(await page.isVisible('a:has-text("Receipt")'), 'Stripe receipt linked');
  const log1 = await mock('/__mock/log');
  const pi = log1.find(x => x.path === '/payment_intents');
  check(pi && pi.params.amount === '27120' && pi.params.currency === 'cad' && pi.idem, `charge sent as 27120 cents CAD with an idempotency key (${pi && pi.params.amount})`);
  await page.click('button:has-text("Refund")'); await page.waitForTimeout(700);
  check(await page.isVisible('.list-item >> text=Refund (Stripe)'), 'refund recorded');
  await shot('stripe-invoice');

  // Declined card → pay link → customer pays online → app picks it up
  await go('#/customers'); await page.click('tbody tr.clickable:has-text("Priya Patel")');
  await page.click('button:has-text("Save card with Stripe")'); await page.waitForSelector('.modal .js-refresh');
  const priya = await dbGet('d.customers.find(c => c.name === "Priya Patel").stripeId');
  await mock(`/__mock/save-card?customer=${priya}&last4=0002`);
  await page.click('.modal .js-refresh'); await page.waitForTimeout(400);
  await page.click('.page-head [data-menu]'); await page.click('.menu-item:has-text("New invoice")');
  await page.fill('.modal [data-k=desc]', 'Gutter cleaning'); await page.waitForTimeout(100);
  await submit(); await page.waitForSelector('.doc h1:has-text("INVOICE")');
  await page.click('.doc-actions button:has-text("•••• 0002")'); await submit(); await page.waitForSelector('.modal .alert.bad');
  check((await page.textContent('.modal .alert.bad')).includes('declined'), 'declined card shows a clear message');
  await page.click('.modal .js-paylink'); await page.waitForSelector('.modal:has-text("Pay-online link")');
  const invId = await dbGet('d.invoices.at(-1).id'), cs = await dbGet('d.invoices.at(-1).checkout.id');
  check(/^cs_/.test(cs || ''), 'pay-online link created');
  await page.keyboard.press('Escape');
  await mock(`/__mock/pay?id=${cs}`);
  await go('#/dashboard'); await go('#/invoices/' + invId); await page.waitForTimeout(800);
  check((await page.textContent('.page-head .badge')).trim() === 'paid', 'online payment detected and invoice marked paid');

  // Auto-charge when a plan visit is completed
  await go('#/settings'); await page.click('[data-settab=plans]');
  await page.check('#settingsForm [name=autoChargePlans]'); await page.click('#settingsForm button[type=submit]'); await page.waitForTimeout(200);
  await go('#/customers'); await page.click('tbody tr.clickable:has-text("Maria Rossi")');
  await page.click('button:has-text("Save card with Stripe")'); await page.waitForSelector('.modal .js-refresh');
  const maria = await dbGet('d.customers.find(c => c.name === "Maria Rossi").stripeId');
  await mock(`/__mock/save-card?customer=${maria}&last4=5555&brand=mastercard`);
  await page.click('.modal .js-refresh'); await page.waitForTimeout(400);
  const visit = await dbGet('d.jobs.filter(j => j.planId && j.status === "scheduled" && j.customerId === d.customers.find(c => c.name === "Maria Rossi").id).sort((a, b) => a.date.localeCompare(b.date))[0].id');
  await go('#/jobs/' + visit); await page.click('.page-head button:has-text("Complete")'); await page.waitForTimeout(1200);
  const auto = await dbGet(`(() => { const j = d.jobs.find(x => x.id === "${visit}"); const i = d.invoices.find(x => x.id === j.invoiceId); return i && i.payments.length && i.payments[0].method; })()`);
  check(String(auto).includes('Stripe'), `completed plan visit invoiced and charged automatically (${auto})`);

  // Backups never include the app token
  const dl = page.waitForEvent('download');
  await go('#/settings'); await page.click('[data-settab=data]'); await page.click('button:has-text("Download backup")');
  const file = await (await dl).path();
  const backup = JSON.parse(require('fs').readFileSync(file, 'utf8'));
  check(backup.settings.stripeToken === '' && backup.settings.stripeUrl === PAY, 'backup leaves out the app token');

  check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  await browser.close();
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nAll Stripe checks passed');
  process.exit(failures.length ? 1 : 0);
})();
