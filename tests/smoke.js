/* End-to-end smoke test for Business Hub.
 *
 *   python3 -m http.server 8765          # in the project folder
 *   node tests/smoke.js [screenshotDir]  # needs Playwright installed
 *
 * Exits non-zero if any check fails or the page logs an error. */
const { chromium } = require('playwright');

const URL = process.env.APP_URL || 'http://localhost:8765/';
const shots = process.argv[2];
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  let acceptDialogs = true;
  page.on('dialog', d => (acceptDialogs ? d.accept() : d.dismiss()));
  const go = async hash => { await page.goto(URL + hash); await page.waitForSelector('.page-head'); };
  const shot = async name => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
  const modalSubmit = () => page.click('.modal button[type=submit]');

  // First run
  await page.goto(URL); await page.waitForSelector('.page-head');
  check(await page.isVisible('text=Welcome!'), 'welcome card shown on first run');
  await page.click('button:has-text("Load sample data")');
  await page.waitForTimeout(300);
  check(await page.isVisible('text=Income this month'), 'dashboard renders after sample data');
  await shot('dashboard');

  // Data survives a reload (IndexedDB)
  await page.reload(); await page.waitForSelector('.page-head');
  const nCust = await page.evaluate(() => new Promise(r => { const q = indexedDB.open('bizhub'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('bizhub.v1'); g.onsuccess = () => r(JSON.parse(g.result).customers.length); }; }));
  check(nCust >= 8, `data persisted in IndexedDB (${nCust} customers)`);

  // Every page renders
  for (const r of ['schedule', 'jobs', 'leads', 'tasks', 'customers', 'quotes', 'invoices', 'income', 'expenses', 'reports', 'services', 'settings']) {
    await go('#/' + r);
    check(await page.locator('.page-head h1').count() === 1, `page renders: ${r}`);
    await shot(r);
  }

  // Schedule views
  await go('#/schedule');
  await page.click('.seg button:has-text("Week")'); check(await page.locator('.week .wk-day').count() === 7, 'week view shows 7 days');
  await shot('schedule-week');
  await page.click('.seg button:has-text("Day")'); check(await page.isVisible('.cal-title'), 'day view renders');
  await page.click('[data-act=calMove][data-n="1"]');
  await page.click('.seg button:has-text("Month")'); check(await page.locator('.cal .day').count() >= 28, 'month view renders');

  // Quote → approve → deposit → invoice with deposit credit
  await go('#/quotes'); await page.click('.page-head button:has-text("New quote")');
  await page.selectOption('.modal select[name=customerId]', { index: 1 });
  await page.fill('.modal [data-k=desc]', 'Gutter cleaning');
  check(await page.inputValue('.modal [data-k=price]') === '180', 'price book fills the price');
  await page.fill('.modal input[name=depositPct]', '25');
  await modalSubmit(); await page.waitForSelector('.doc');
  check(await page.isVisible('.doc >> text=Deposit required (25%)'), 'quote shows deposit');
  await page.click('button:has-text("Approve")');
  await page.click('button:has-text("Request")'); await page.waitForSelector('.doc h1:has-text("INVOICE")');
  check(await page.isVisible('.doc >> text=Deposit (25%)'), 'deposit invoice created');
  await page.goBack(); await page.waitForSelector('.doc');
  await page.click('button:has-text("Convert to invoice")'); await page.waitForSelector('.doc h1:has-text("INVOICE")');
  check(await page.isVisible('.doc >> text=Less deposit'), 'final invoice credits the deposit');
  await shot('invoice');

  // Record payment → paid
  await page.click('.doc-actions button:has-text("Record payment")'); await modalSubmit(); await page.waitForTimeout(200);
  check((await page.textContent('.page-head .badge')).trim() === 'paid', 'invoice marked paid after full payment');

  // Lead → customer + quote
  await go('#/leads'); await page.click('.page-head button:has-text("New lead")');
  await page.fill('.modal input[name=name]', 'Test Lead'); await page.fill('.modal input[name=phone]', '555-000-1234');
  await page.fill('.modal input[name=service]', 'Window cleaning (exterior)'); await page.fill('.modal input[name=value]', '240');
  await modalSubmit(); await page.waitForTimeout(150);
  await page.click('.lead-card:has-text("Test Lead")'); await page.click('.modal .js-lead-quote');
  await page.waitForSelector('.modal select[name=customerId]');
  check(await page.$eval('.modal select[name=customerId]', s => s.options[s.selectedIndex].text) === 'Test Lead', 'lead converted to customer for the quote');
  await modalSubmit(); await page.waitForSelector('.doc');
  await go('#/leads');
  check(await page.isVisible('.kanban-col[data-stage=quoted] >> text=Test Lead'), 'lead moved to Quoted');

  // To-dos
  await go('#/tasks'); await page.fill('.quick-task input[name=title]', 'Buy ladder'); await page.press('.quick-task input[name=title]', 'Enter');
  await page.waitForTimeout(150);
  check(await page.isVisible('text=Buy ladder'), 'quick to-do added');
  await page.click('.task-row:has-text("Buy ladder") input[type=checkbox]');
  await page.click('[data-tab="tasks:tab:done"]');
  check(await page.isVisible('text=Buy ladder'), 'to-do completed');

  // Repeating job → complete → invoice
  await go('#/schedule'); await page.click('.page-head button:has-text("New job")');
  await page.selectOption('.modal select[name=customerId]', { index: 2 });
  await page.fill('.modal input[name=title]', 'Weekly lawn'); await page.selectOption('.modal select[name=repeat]', '7');
  await page.fill('.modal input[name=occurrences]', '4'); await page.fill('.modal [data-k=desc]', 'Lawn maintenance visit');
  await modalSubmit(); await page.waitForSelector('text=Job costing');
  check(await page.evaluate(() => document.querySelectorAll('.page-head').length) === 1, 'job page opened');
  await page.click('.page-head button:has-text("Mark complete")');
  await page.click('.page-head button:has-text("Create invoice")'); await page.waitForSelector('.doc');
  check(page.url().includes('#/invoices/'), 'job converted to invoice');

  // Expense with tax calc + recurring
  await go('#/expenses'); await page.click('.page-head button:has-text("Add expense")');
  await page.fill('.modal input[name=amount]', '113'); await page.click('.modal .js-calc-tax');
  check(await page.inputValue('.modal input[name=tax]') === '13.00', 'HST calculated from total');
  await page.check('.modal input[name=recurring]'); await modalSubmit();

  // Unsaved-changes guard
  await go('#/customers'); await page.click('.page-head button:has-text("New customer")');
  await page.fill('.modal input[name=name]', 'Half typed');
  acceptDialogs = false; // answer "no, keep editing"
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  check(await page.isVisible('.modal'), 'escape asks before discarding changes');
  acceptDialogs = true;
  await page.click('.modal [data-close]');

  // Search
  await page.keyboard.press('Control+k'); await page.fill('.search-modal input', 'sarah');
  check(await page.locator('.search-hit').count() > 0, 'search finds customers');
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  check(page.url().includes('#/customers/'), 'search result opens record');

  // Statement
  await go('#/customers'); await page.selectOption('select[data-filter="customers:sort"]', 'owing');
  await page.click('tbody tr.clickable >> nth=0'); await page.waitForTimeout(100);
  if (await page.isVisible('a:has-text("Statement")')) {
    await page.click('a:has-text("Statement")'); await page.waitForSelector('.doc');
    check(await page.isVisible('.doc h1:has-text("STATEMENT")'), 'customer statement renders');
  }

  // Phone layout
  const m = page; // same browser profile, so the sample data is there
  await m.setViewportSize({ width: 390, height: 844 });
  for (const r of ['dashboard', 'schedule', 'leads', 'jobs', 'invoices', 'customers']) {
    await m.goto(URL + '#/' + r); await m.waitForTimeout(300);
    const w = await m.evaluate(() => document.documentElement.scrollWidth);
    check(w <= 390, `no sideways scroll on phone: ${r} (${w}px)`);
    if (shots) await m.screenshot({ path: `${shots}/m-${r}.png`, fullPage: true });
  }
  check(await m.isVisible('.bottom-nav'), 'bottom navigation on phone');

  check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  await browser.close();
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nAll checks passed');
  process.exit(failures.length ? 1 : 0);
})();
