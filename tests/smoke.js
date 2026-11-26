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
  const leadSel = await page.$eval('.modal select[name=customerId]', s => s.options[s.selectedIndex].text);
  check(leadSel === 'Test Lead', `lead converted to customer for the quote (${leadSel})`);
  if (leadSel !== 'Test Lead') console.log('DEBUG', await page.evaluate(() => [...document.querySelectorAll('.modal')].map(m => m.querySelector('h2').textContent + ' | ' + [...m.querySelectorAll('select[name=customerId] option:checked')].map(o => o.outerHTML).join(';'))));
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
  await page.fill('.modal input[name=title]', 'Weekly lawn'); await page.selectOption('.modal select[name=repeat]', 'weekly');
  await page.fill('.modal input[name=rCount]', '4'); await page.click('.modal details.form-section summary'); await page.fill('.modal [data-k=desc]', 'Lawn maintenance visit');
  await modalSubmit(); await page.waitForSelector('text=Job costing');
  check(await page.evaluate(() => document.querySelectorAll('.page-head').length) === 1, 'job page opened');
  await page.click('.page-head button:has-text("Complete")');
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
  await page.click('.page-head [data-menu]');
  if (await page.isVisible('a:has-text("Print statement")')) {
    await page.click('a:has-text("Print statement")'); await page.waitForSelector('.doc');
    check(await page.isVisible('.doc h1:has-text("STATEMENT")'), 'customer statement renders');
  }

  // Custom repeat: every week on Mon + Thu, 6 visits
  await page.setViewportSize({ width: 1280, height: 900 });
  await go('#/plans'); await page.click('[data-tab="plans:tab:visits"]'); await page.click('button:has-text("New recurring job")');
  await page.selectOption('.modal select[name=customerId]', { index: 3 });
  await page.fill('.modal input[name=title]', 'Pool cleaning');
  await page.selectOption('.modal select[name=repeat]', 'custom');
  for (const d of await page.$$('.modal [name=rDay]:checked')) await d.evaluate(el => { el.checked = false; });
  await page.check('.modal [name=rDay][value="1"]', { force: true }); await page.check('.modal [name=rDay][value="4"]', { force: true });
  await page.fill('.modal input[name=rCount]', '6');
  check((await page.textContent('.modal .js-repeat-preview')).includes('6 visits'), 'custom repeat preview shows 6 visits');
  await modalSubmit(); await page.waitForSelector('text=Job costing');
  const days = await page.evaluate(() => new Promise(r => { const q = indexedDB.open('bizhub'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('bizhub.v1'); g.onsuccess = () => r(JSON.parse(g.result).jobs.filter(j => j.title === 'Pool cleaning').map(j => new Date(j.date + 'T12:00').getDay())); }; }));
  check(days.length === 6 && days.every(d => d === 1 || d === 4), `custom repeat created Mon/Thu visits (${days.join(',')})`);
  await go('#/plans');
  check(await page.isVisible('.plan-row:has-text("Pool cleaning")'), 'repeat visits tab lists the recurring job');
  await shot('plans');

  // Team, clock in/out, timesheets
  await go('#/team'); await page.click('.page-head button:has-text("Add team member")');
  await page.fill('.modal input[name=name]', 'Sam'); await page.fill('.modal input[name=phone]', '4165551234'); await page.click('.modal input[name=rate]');
  check(await page.inputValue('.modal input[name=phone]') === '416-555-1234', 'phone number auto-formats');
  await page.fill('.modal input[name=rate]', '25'); await modalSubmit(); await page.waitForTimeout(150);
  await page.click('.member-card:has-text("Sam") button:has-text("Clock in")');
  check(await page.isVisible('.member-card:has-text("Sam") >> text=On the clock'), 'clock in works');
  await page.click('.member-card:has-text("Sam") button:has-text("Clock out")');
  await page.click('[data-tab="team:tab:time"]');
  check(await page.isVisible('.ts-table >> text=Sam'), 'timesheet shows team member');
  await shot('timesheets');

  // Settings tabs + rename a lead stage
  await go('#/settings'); await page.click('[data-settab=lists]');
  await page.fill('.js-stages input >> nth=0', 'New enquiry'); await page.click('#settingsForm button[type=submit]'); await page.waitForTimeout(150);
  await go('#/leads');
  check(await page.isVisible('.kanban-head:has-text("New enquiry")'), 'renamed lead stage shows on the board');

  // Undo a delete
  await go('#/expenses');
  const before = await page.locator('tbody tr.clickable').count();
  await page.click('tbody tr.clickable >> nth=0'); await page.click('.modal .js-del'); await page.waitForTimeout(100);
  await page.click('.toast button:has-text("Undo")'); await page.waitForTimeout(150);
  check(await page.locator('tbody tr.clickable').count() === before, 'undo restores a deleted expense');

  // Customer note on the activity timeline
  await go('#/customers'); await page.click('tbody tr.clickable >> nth=0');
  await page.fill('.note-form input', 'Prefers morning visits'); await page.press('.note-form input', 'Enter'); await page.waitForTimeout(150);
  check(await page.isVisible('.timeline >> text=Prefers morning visits'), 'note added to activity timeline');
  await shot('customer');

  // Address suggestions (needs internet)
  await page.click('.page-head [data-menu]'); await page.click('.menu-item:has-text("Edit customer")');
  await page.fill('.modal input[name=address]', ''); await page.type('.modal input[name=address]', '100 queen st w toronto', { delay: 20 });
  const gotAddr = await page.waitForSelector('.addr-menu .addr-opt', { timeout: 8000 }).then(() => true).catch(() => false);
  console.log(gotAddr ? 'PASS  address suggestions appear' : 'SKIP  address suggestions (address service not reachable from this browser)');
  if (gotAddr) { await shot('address'); await page.click('.addr-opt >> nth=0'); check(/Toronto/.test(await page.inputValue('.modal input[name=address]')), 'picking a suggestion fills the address'); }
  acceptDialogs = true; await page.keyboard.press('Escape');

  // ---- Job price on a new job ----
  await page.setViewportSize({ width: 1280, height: 900 });
  await go('#/jobs'); await page.click('.page-head button:has-text("New job")');
  await page.selectOption('.modal select[name=customerId]', { index: 1 });
  await page.fill('.modal input[name=title]', 'Fence repair'); await page.fill('.modal input[name=jobPrice]', '150');
  check((await page.textContent('.modal .js-price-hint')).includes('169.50'), 'price box shows total with tax');
  await modalSubmit(); await page.waitForSelector('text=Job costing');
  check(await page.isVisible('.card:has-text("Line items") >> text=Fence repair') && await page.isVisible('.card:has-text("Line items") >> text=$150.00'), 'job price saved as a line item');

  // ---- Time clock ----
  await page.click('#nav .clock-btn');
  if (await page.isVisible('.modal:has-text("Who are you?")')) await modalSubmit();
  await page.waitForTimeout(150);
  check(await page.isVisible('#nav .clock-btn.on'), 'clock in from the menu button');
  await go('#/dashboard');
  check(await page.isVisible('.clock-card.on'), 'dashboard shows on the clock');
  await page.click('.clock-card button:has-text("Clock out")'); await page.waitForTimeout(100);
  check(!(await page.isVisible('#nav .clock-btn.on')), 'clock out');

  // ---- Service plan: create from template, sign in person ----
  await go('#/plans'); await page.click('[data-tab="plans:tab:agreements"]'); await page.click('.page-head button:has-text("New service plan")');
  await page.selectOption('.modal select[name=customerId]', { index: 2 });
  await page.selectOption('.modal select[name=templateId]', { index: 1 });
  check(await page.inputValue('.modal input[name=name]') === 'Window cleaning: 2 cleans a year', 'template fills the plan');
  check((await page.textContent('.modal .js-cancel-preview')).includes('$50.00'), 'cancellation preview shows $50 fee');
  await page.click('.modal button[type=submit]'); await page.waitForSelector('.doc h1:has-text("SERVICE AGREEMENT")');
  check(await page.isVisible('.doc >> text=Early cancellation fee: $50.00'), 'agreement shows the cancellation clause');
  await page.click('.page-head button:has-text("Sign in person")'); await page.waitForTimeout(150);
  await page.locator('.modal .js-sig').scrollIntoViewIfNeeded(); const box = await page.locator('.modal .js-sig').boundingBox();
  await page.mouse.move(box.x + 30, box.y + 100); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 25, box.y + 100 + (i % 2 ? -40 : 30));
  await page.mouse.up();
  await page.check('.modal input[name=agree]'); await modalSubmit(); await page.waitForTimeout(400);
  check((await page.textContent('.page-head .badge')).trim() === 'active', 'signing activates the plan');
  check(await page.isVisible('.sig-block svg'), 'signature shows on the agreement');
  check(await page.isVisible('aside >> text=0 of 2 done'), 'plan visits scheduled');
  await shot('plan-signed');

  // ---- Service plan: send link, customer signs remotely, signature comes back ----
  await go('#/plans'); await page.click('.plan-row:has-text("Waiting for signature"), .plan-row:has-text("Sent")');
  await page.waitForSelector('.doc');
  await page.click('.page-head button:has-text("for signature")');
  const signUrl = await page.getAttribute('.modal a:has-text("Preview")', 'href');
  check(signUrl.includes('sign.html#'), 'signing link created');
  await page.keyboard.press('Escape');
  const cust = await browser.newPage({ viewport: { width: 390, height: 844 } });
  cust.on('pageerror', e => errors.push('sign page: ' + e.message));
  await cust.goto(signUrl); await cust.waitForSelector('#sig');
  check(await cust.isVisible('text=Early cancellation'), 'customer sees the cancellation terms');
  if (shots) await cust.screenshot({ path: `${shots}/sign-page.png`, fullPage: true });
  await cust.locator('#sig').scrollIntoViewIfNeeded(); const b2 = await cust.locator('#sig').boundingBox();
  await cust.mouse.move(b2.x + 20, b2.y + 80); await cust.mouse.down();
  for (let i = 1; i <= 10; i++) await cust.mouse.move(b2.x + 20 + i * 30, b2.y + 80 + (i % 2 ? -30 : 25));
  await cust.mouse.up(); await cust.check('#agree'); await cust.click('#signBtn');
  await cust.waitForSelector('.sign-done');
  const back = await cust.inputValue('#backLink');
  check(back.includes('#/signed/'), 'customer gets a signed link to send back');
  await cust.close();
  await page.goto(back); await page.waitForSelector('.doc h1:has-text("SERVICE AGREEMENT")');
  check((await page.textContent('.page-head .badge')).trim() === 'active', 'remote signature recorded and plan activated');
  check(await page.isVisible('.sig-line >> text=signed online'), 'agreement marked as signed online');

  // ---- Cancel within first year before 2 cleans: $50 fee, charge card on file ----
  await go('#/plans'); await page.selectOption('select[data-filter="plans:status"]', 'active');
  await page.click('.plan-row:has-text("1 done")'); await page.waitForSelector('.doc');
  await page.click('.page-head button:has-text("Cancel plan")');
  check(await page.isChecked('.modal input[name=charge]'), 'cancellation fee applies (1 of 2 cleans, first year)');
  await modalSubmit(); await page.waitForSelector('.doc h1:has-text("INVOICE")');
  check(await page.isVisible('.doc >> text=Early cancellation fee'), 'fee invoice created');
  check(await page.isVisible('.doc-actions button:has-text("•••• 4242")'), 'charge card on file button shown');
  await page.click('.doc-actions button:has-text("•••• 4242")'); await modalSubmit(); await page.waitForTimeout(150);
  check((await page.textContent('.page-head .badge')).trim() === 'paid', 'fee charged and recorded');
  await shot('fee-invoice');

  // ---- Cards on file ----
  await go('#/customers'); await page.click('tbody tr.clickable >> nth=2');
  await page.click('.card button:has-text("Add card")');
  await page.fill('.modal input[name=last4]', '4111111111111111');
  check(await page.inputValue('.modal input[name=last4]') === '1111', 'card field keeps only the last 4 digits');
  await page.fill('.modal input[name=exp]', '0929'); await modalSubmit(); await page.waitForTimeout(150);
  check(await page.isVisible('.card-row >> text=•••• 1111'), 'card on file added');
  await shot('customer-cards');

  // ---- Door knocking ----
  await page.context().grantPermissions(['geolocation'], { origin: URL.replace(/\/$/, '') });
  await page.context().setGeolocation({ latitude: 43.6702, longitude: -79.4655 });
  await go('#/canvass'); await page.click('[data-tab="canvass:tab:map"]');
  await page.click('button:has-text("Pin where I’m standing")'); await page.waitForSelector('.modal .knock-picker');
  await page.fill('.modal input[name=address]', '12 Maple Cres, Toronto, ON');
  await page.check('.modal input[name=status][value=comeback]', { force: true });
  check(await page.isVisible('.modal input[name=comebackDate]'), 'come-back date appears for come back later');
  await page.fill('.modal input[name=name]', 'Dana'); await page.fill('.modal textarea[name=notes]', 'Come back Saturday, talk to husband');
  await modalSubmit(); await page.waitForTimeout(200);
  await page.click('[data-tab="canvass:tab:list"]');
  check(await page.isVisible('.list-item:has-text("12 Maple Cres") >> text=Come back later'), 'pinned house shows in the list with its outcome');
  await page.click('.list-item:has-text("12 Maple Cres")');
  check(await page.inputValue('.modal textarea[name=notes]') === 'Come back Saturday, talk to husband', 'notes saved on the pin');
  await page.check('.modal input[name=status][value=sale]', { force: true }); await modalSubmit(); await page.waitForTimeout(150);
  await page.click('.list-item:has-text("12 Maple Cres")');
  check(await page.locator('.modal .hist-row').count() === 2, 'knock history keeps both visits');
  await page.keyboard.press('Escape');
  await page.click('[data-tab="canvass:tab:stats"]');
  for (const per of ['Day', 'Week', 'Month', 'Year']) {
    await page.click(`.seg button:has-text("${per}")`);
    const doors = +(await page.textContent('.knock-tile >> nth=0 >> .value'));
    check(doors >= 2, `${per} stats count doors knocked (${doors})`);
  }
  const sales = +(await page.textContent('.knock-tile >> nth=1 >> .value'));
  check(sales >= 1, `stats count sales (${sales})`);
  await shot('knock-stats');

  // Phone layout
  const m = page; // same browser profile, so the sample data is there
  await m.setViewportSize({ width: 390, height: 844 });
  for (const r of ['dashboard', 'schedule', 'canvass', 'leads', 'jobs', 'invoices', 'customers', 'plans', 'team', 'settings']) {
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
