/* End-to-end test of: map time filter, online quote approval (Jobber-style),
 * texting and promo blasts, and the inbox, against the mock server.
 *
 *   python3 -m http.server 8765 &        # the app
 *   node tests/mock-pay-server.mjs &     # server with fake Stripe, Twilio and storage
 *   node tests/connect.js [screenshotDir]
 */
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/', PAY = 'http://localhost:8787';
const shots = process.argv[2];
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); };
const mock = path => fetch(PAY + path, { method: path.includes('log') ? 'GET' : 'POST' }).then(r => r.json());

(async () => {
  const browser = await browser0();
  async function browser0() { return chromium.launch(); }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => (d.type() === 'prompt' ? d.accept(d.defaultValue()) : d.accept()));
  const go = async hash => { await page.goto(URL + hash); await page.waitForSelector('.page-head, .map-screen'); };
  const shot = async (p, name) => shots && p.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
  const raw = (fn, write) => page.evaluate(([src, w]) => new Promise(r => {
    const q = indexedDB.open('bizhub');
    q.onsuccess = () => {
      const st = q.result.transaction('kv', w ? 'readwrite' : 'readonly').objectStore('kv'), g = st.get('bizhub.v1');
      g.onsuccess = () => { const d = JSON.parse(g.result); const out = new Function('d', src)(d); if (!w) return r(out); st.put(JSON.stringify(d), 'bizhub.v1').onsuccess = () => r(out); };
    };
  }), [fn, write]);
  /** Change the saved data, then reload so the app picks it up. */
  const idb = async fn => { const out = await raw(fn, true); await page.reload(); await page.waitForSelector('.page-head, .map-screen, .empty'); return out; };
  const dbGet = expr => raw(`return ${expr}`, false);

  await page.goto(URL); await page.waitForSelector('.page-head');
  await page.click('button:has-text("Load sample data")'); await page.waitForTimeout(500); await idb(`d.settings.relayUrl = '${PAY}/relay';`);

  /* ---------- map time filter ---------- */
  await go('#/canvass');
  const pinsFor = async w => { await page.click(`.map-when button[data-v="${w}"]`); await page.waitForTimeout(80); return +(await page.textContent('.js-map-stats')).match(/(\d+)\s*pins/)[1]; };
  check(await page.getAttribute('.map-when button.active', 'data-v') === 'today', 'map shows today’s pins by default');
  const counts = {};
  for (const w of ['today', 'week', 'month', 'year', 'all']) counts[w] = await pinsFor(w);
  const total = await dbGet('d.pins.length');
  check(counts.all === total && counts.today <= counts.week && counts.week <= counts.month && counts.month <= counts.year && counts.year <= counts.all && counts.today < counts.all,
    `map time filter narrows pins (today ${counts.today} · week ${counts.week} · month ${counts.month} · year ${counts.year} · all ${counts.all})`);
  await page.click('.map-when button[data-v="today"]');

  /* ---------- connect with the wizard ---------- */
  await go('#/settings'); await page.click('[data-settab=plans]');
  await page.click('button:has-text("Connect Stripe step by step")'); await page.waitForSelector('.wizard');
  const deploy = await page.getAttribute('.wizard a:has-text("Deploy to Cloudflare")', 'href');
  check(deploy.startsWith('https://deploy.workers.cloudflare.com/?url=') && decodeURIComponent(deploy).includes('/stripe-worker'), 'wizard has a one-tap Deploy to Cloudflare button');
  const token = await page.inputValue('.wizard input[aria-label="App token"]');
  check(token.length >= 30, 'wizard made an app token to copy');
  await page.fill('.modal [name=url]', PAY); await page.click('.modal button[type=submit]'); await page.waitForTimeout(800);
  check((await page.textContent('.js-wz-status')).includes('Wrong app token'), 'wizard explains a token mismatch');
  await page.evaluate(() => document.querySelectorAll('#modalRoot > *').forEach(m => m.remove()));
  check(await page.inputValue('#settingsForm [name=stripeUrl]') === PAY, 'settings show the address entered in the wizard');
  await page.fill('#settingsForm [name=stripeToken]', 'test-token-123'); await page.click('button:has-text("Save & test connection")');
  await page.waitForSelector('.js-stripe-status .badge.good');
  const feats = await dbGet('d.settings.stripeStatus.features');
  check(feats.stripe && feats.sms && feats.inbox, 'server reports Stripe, texting and inbox');

  /* ---------- quote with an optional extra, approved online ---------- */
  await go('#/quotes'); await page.click('.page-head button:has-text("New quote")');
  check(await page.locator('.modal .opt-line').count() > 0, 'quote form can mark a line as an optional extra');
  await page.evaluate(() => document.querySelectorAll('#modalRoot > *').forEach(m => m.remove()));
  const qid = await idb(`const c = d.customers.find(x => x.name === 'Maria Rossi');
    const q = { id: 'qtest1', number: 'Q-9001', customerId: c.id, date: '2026-11-20', validUntil: '2026-12-20', status: 'draft', depositPct: 25, discount: 0, taxRate: 13, notes: 'Thanks!',
      items: [{ desc: 'Exterior windows', details: 'All floors', qty: 1, price: 200, taxable: true }, { desc: 'Gutter cleaning', details: '', qty: 1, price: 150, taxable: true, optional: true, on: false }] };
    d.quotes.push(q); return q.id;`);
  await go('#/quotes/' + qid);
  check((await page.textContent('.doc')).includes('Optional extra · not included'), 'quote shows the optional extra as not included yet');
  check((await page.textContent('.doc .totals')).includes('226.00'), 'quote total leaves out the optional extra');
  await page.click('.doc-actions [data-menu]');
  const [cust] = await Promise.all([ctx.waitForEvent('page'), page.click('.menu-item:has-text("Preview what the customer sees")')]);
  await cust.waitForSelector('.qline');
  cust.on('pageerror', e => errors.push('quote page: ' + e.message));
  check((await cust.textContent('.sign-title')) === 'QUOTE', 'customer sees the quote page');
  check((await cust.textContent('.js-qtot')).includes('226.00'), 'customer total starts without extras');
  await cust.click('.qopt .grow'); await cust.waitForTimeout(100);
  check((await cust.textContent('.js-qtot')).includes('395.50') && (await cust.textContent('.js-qtot')).includes('98.88'), 'ticking the extra updates the total and deposit');
  await shot(cust, 'quote-customer');
  const box = await cust.locator('#sig').boundingBox();
  await cust.locator('#sig').scrollIntoViewIfNeeded();
  const b2 = await cust.locator('#sig').boundingBox();
  await cust.mouse.move(b2.x + 20, b2.y + 40); await cust.mouse.down(); await cust.mouse.move(b2.x + 120, b2.y + 70, { steps: 8 }); await cust.mouse.move(b2.x + 200, b2.y + 30, { steps: 8 }); await cust.mouse.up();
  void box;
  await cust.check('#agree'); await cust.click('#signBtn');
  await cust.waitForSelector('.sign-done h2');
  check((await cust.textContent('.sign-done')).includes('has your approval'), 'approval goes straight to the business (no link to send back)');
  await cust.close();
  await go('#/messages'); await page.click('button:has-text("Check for updates")'); await page.waitForTimeout(800);
  const q = await dbGet(`d.quotes.find(x => x.id === 'qtest1')`);
  check(q.status === 'approved' && q.signature?.name === 'Maria Rossi' && q.signature.strokes.length > 0, 'quote marked approved with the signature');
  check(q.items[1].on === true, 'the extra the customer ticked is now included');
  const dep = await dbGet(`d.invoices.find(i => i.id === '${q.depositInvoiceId}')`);
  check(dep && Math.abs(dep.items[0].price - 98.88) < 0.01, 'deposit invoice created for 25% of the approved total');
  await go('#/quotes/' + qid);
  check((await page.textContent('#main')).includes('Approved online') && await page.locator('.doc .sig-block svg').count() === 1, 'quote shows “Approved online” and the signature');
  await go('#/dashboard');
  check((await page.textContent('.attn')).includes('approved quote'), 'dashboard says the approved quote needs scheduling');

  /* ---------- request changes, without a server (link back) ---------- */
  await idb(`d.quotes.push({ id: 'qtest2', number: 'Q-9002', customerId: d.customers[1].id, date: '2026-11-20', status: 'sent', taxRate: 13, items: [{ desc: 'Screens', qty: 4, price: 10, taxable: true }] });
    d.settings.stripeStatusBak = d.settings.stripeStatus; d.settings.stripeStatus = null; d.settings.relay = false;`);
  await go('#/quotes/qtest2'); await page.click('.doc-actions [data-menu]');
  const [c2] = await Promise.all([ctx.waitForEvent('page'), page.click('.menu-item:has-text("Preview what the customer sees")')]);
  await c2.waitForSelector('#askChanges'); await c2.click('#askChanges');
  await c2.fill('#chMsg', 'Please add the garage windows'); await c2.click('#chForm button[type=submit]');
  await c2.waitForSelector('#backLink');
  const backLink = await c2.inputValue('#backLink'); await c2.close();
  await page.goto(backLink); await page.waitForTimeout(900);
  const q2 = await dbGet(`d.quotes.find(x => x.id === 'qtest2')`);
  check(q2.changeRequest?.msg === 'Please add the garage windows' && page.url().includes('#/quotes/qtest2'), 'change request recorded from the link');
  check(await dbGet(`d.tasks.some(t => t.title.includes('Q-9002'))`), 'a to-do reminds you to update the quote');
  await idb(`d.settings.stripeStatus = d.settings.stripeStatusBak; d.settings.relay = true;`);

  /* ---------- texting ---------- */
  const before = (await mock('/__mock/sms-log')).length;
  await go('#/messages'); await page.click('.page-head button:has-text("New message")');
  const mariaId = await dbGet(`d.customers.find(x => x.name === 'Maria Rossi').id`);
  await page.selectOption('.modal [name=customerId]', mariaId);
  await page.fill('.modal [name=body]', 'Hi Maria, see you Friday!'); await page.click('.modal button[type=submit]'); await page.waitForTimeout(800);
  const log = await mock('/__mock/sms-log');
  check(log.length === before + 1 && log.at(-1).To === '+14165550138' && log.at(-1).Body === 'Hi Maria, see you Friday!', 'text sent from the business number');
  check(page.url().includes('#/messages/' + mariaId) && await page.locator('.bubble.out').count() >= 1, 'conversation opens with the sent text');
  check((await mock('/__mock/sms-in?from=%2B14165550138&body=Sounds%20good&badsig=1')).status === 403, 'server rejects texts not signed by Twilio');
  check((await mock('/__mock/sms-in?from=%2B14165550138&body=Sounds%20good')).status === 200, 'server accepts a signed reply');
  await go('#/messages'); await page.click('button:has-text("Check for updates")'); await page.waitForTimeout(700);
  check(await page.locator('.thread-row.unread').count() === 1 && (await page.textContent('.thread-row.unread')).includes('Sounds good'), 'reply shows as unread in Messages');
  await page.click('.thread-row.unread'); await page.waitForTimeout(400);
  check(await page.locator('.bubble.in').count() === 1 && await dbGet(`d.messages.every(m => m.read || m.dir === 'out')`), 'opening the conversation marks it read');
  await shot(page, 'thread');
  // reply in the thread composer
  await page.fill('.js-compose textarea', 'Great, thanks!'); await page.click('.composer-send'); await page.waitForTimeout(600);
  check((await mock('/__mock/sms-log')).at(-1).Body === 'Great, thanks!', 'reply sent from the conversation');

  /* ---------- STOP and promo blast ---------- */
  await mock('/__mock/sms-in?from=%2B14165550152&body=STOP'); // Aisha Khan opts out
  await go('#/messages'); await page.click('button:has-text("Check for updates")'); await page.waitForTimeout(600);
  check(await dbGet(`d.customers.find(x => x.name === 'Aisha Khan').noPromo === true`), 'STOP reply opts the customer out of promotions');
  await idb(`d.customers.find(x => x.name === 'David Chen').phone = '416-555-0199';`); // carrier says this number unsubscribed
  const withPhone = await dbGet(`d.customers.filter(c => c.phone && !c.noPromo).length`);
  const sentBefore = (await mock('/__mock/sms-log')).length;
  await go('#/messages'); await page.click('.page-head button:has-text("Promo blast")');
  await page.waitForSelector('.js-bsum');
  check((await page.textContent('.js-bsum')).includes(`${withPhone} people`) && (await page.textContent('.js-bsum')).includes('asked not to get promotions'), 'blast shows who gets it and who is skipped');
  check((await page.textContent('.js-bsum .bubble')).includes('Reply STOP to opt out.'), 'blast preview adds the opt-out line');
  await page.click('.modal button[type=submit]');
  await page.waitForFunction(() => location.hash === '#/messages' && document.querySelector('[data-tab="messages:tab:blasts"].active'), null, { timeout: 15000 });
  const sentNow = (await mock('/__mock/sms-log')).slice(sentBefore);
  const blast = await dbGet('d.blasts.at(-1)');
  check(sentNow.length === withPhone - 1 && blast.sent === withPhone - 1 && blast.failed === 1, `blast sent ${sentNow.length} personalised texts, 1 failed`);
  check(sentNow.every(m => /^Hi \S+!/.test(m.Body) && !m.Body.includes('{first}')) && !sentNow.some(m => m.To === '+14165550152'), 'texts use each first name and skip the opted-out customer');
  check(await dbGet(`d.customers.find(x => x.name === 'David Chen').noPromo === true`), 'unsubscribed number is marked “no promotions”');
  await shot(page, 'blasts');

  /* ---------- reminders for tomorrow ---------- */
  await idb(`const t = new Date(); t.setDate(t.getDate() + 1); const ds = t.toISOString().slice(0, 10);
    const local = new Date(t.getTime() - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    d.jobs.forEach(j => { if (j.date === local) j.date = '2027-06-01'; });
    const m = d.customers.find(x => x.name === 'Maria Rossi'), k = d.customers.find(x => x.name === 'Kevin O’Brien') || d.customers[3];
    d.jobs.push({ id: 'rem1', customerId: m.id, title: 'Window cleaning', date: local, start: '09:30', status: 'scheduled', items: [] }, { id: 'rem2', customerId: k.id, title: 'Gutters', date: local, start: '13:00', status: 'scheduled', items: [] }); void ds;`);
  await go('#/dashboard');
  const remRow = page.locator('.attn [data-act="sendReminders"]:visible').first();
  check(await remRow.count() === 1 && (await remRow.textContent()).includes('Remind 2 customers'), 'dashboard offers to remind tomorrow’s customers');
  const smsBefore = (await mock('/__mock/sms-log')).length;
  await remRow.click(); await page.waitForSelector('.modal .js-all'); await page.click('.modal .js-all'); await page.waitForTimeout(1500);
  const rems = (await mock('/__mock/sms-log')).slice(smsBefore);
  check(rems.length === 2 && rems.some(m => m.Body.includes('9:30')) && await dbGet(`d.jobs.filter(j => j.id.startsWith('rem') && j.remindedAt).length === 2`), 'reminders sent and marked, with the time');

  /* ---------- batch follow-ups: overdue invoices (with pay links) and waiting quotes ---------- */
  await go('#/dashboard');
  const overdueN = await dbGet(`d.invoices.filter(i => !i.void && i.dueDate < '${new Date().toISOString().slice(0, 10)}' && (i.payments || []).reduce((s, p) => s + p.amount, 0) < 1 && d.customers.find(c => c.id === i.customerId)?.phone).length`);
  const s1 = (await mock('/__mock/sms-log')).length;
  await page.locator('.attn [data-act="remindOverdue"]:visible').first().click(); await page.waitForSelector('.modal .js-all');
  const listed = await page.locator('.modal .js-rem').count();
  await page.click('.modal .js-all'); await page.waitForTimeout(2500);
  const od = (await mock('/__mock/sms-log')).slice(s1);
  check(listed >= 1 && od.length === listed && od.every(m => m.Body.includes('https://checkout.stripe.com/')), `overdue reminders sent to ${od.length} customers, each with a pay-online link`);
  void overdueN;
  await go('#/dashboard');
  const fq = page.locator('.attn [data-act="followQuotes"]:visible').first();
  if (await fq.count()) {
    const s2 = (await mock('/__mock/sms-log')).length;
    await fq.click(); await page.waitForSelector('.modal .js-all'); const nq = await page.locator('.modal .js-rem').count();
    await page.click('.modal .js-all'); await page.waitForTimeout(1500);
    const fu = (await mock('/__mock/sms-log')).slice(s2);
    check(fu.length === nq && fu.every(m => m.Body.includes('sign.html#')), `quote follow-ups sent (${fu.length}), each with the approve-online link`);
  } else check(false, 'quote follow-up row on dashboard');

  /* ---------- no server: approvals still arrive by themselves (encrypted relay) ---------- */
  await idb(`d.settings.stripeUrl = ''; d.settings.stripeToken = ''; d.settings.stripeStatus = null; d.settings.relayUrl = '${PAY}/relay';
    d.quotes.push({ id: 'qtest3', number: 'Q-9003', customerId: d.customers[2].id, date: '2026-11-21', status: 'sent', sentAt: '2026-11-21', taxRate: 13,
      items: [{ desc: 'Window cleaning', qty: 1, price: 300, taxable: true }, { desc: 'Screens', qty: 1, price: 40, taxable: true, optional: true }] });`);
  await go('#/quotes/qtest3'); await page.click('.doc-actions [data-menu]');
  const [c3] = await Promise.all([ctx.waitForEvent('page'), page.click('.menu-item:has-text("Preview what the customer sees")')]);
  await c3.waitForSelector('.qline'); c3.on('pageerror', e => errors.push('quote page 3: ' + e.message));
  await c3.click('.qopt .grow');
  await c3.locator('#sig').scrollIntoViewIfNeeded();
  const b3 = await c3.locator('#sig').boundingBox();
  await c3.mouse.move(b3.x + 20, b3.y + 40); await c3.mouse.down(); await c3.mouse.move(b3.x + 160, b3.y + 60, { steps: 10 }); await c3.mouse.up();
  await c3.check('#agree'); await c3.click('#signBtn'); await c3.waitForSelector('.sign-done h2');
  check((await c3.textContent('.sign-done')).includes('has your approval') && await c3.locator('#backLink').count() === 0, 'without a server, approval still goes straight to the business');
  await c3.close();
  const relayed = await fetch(`${PAY}/relay/${await dbGet('d.settings.relayTopic')}/json?poll=1`).then(r => r.text());
  check(!relayed.includes('Window cleaning') && !relayed.includes(await dbGet('d.customers[2].name')), 'relay only sees scrambled text');
  await page.waitForSelector('.js-waiting'); await page.click('.js-waiting [data-act="checkInbox"]'); await page.waitForTimeout(900);
  const q3 = await dbGet(`d.quotes.find(x => x.id === 'qtest3')`);
  check(q3.status === 'approved' && q3.items[1].on === true && q3.signature?.strokes?.length > 0, 'approval arrived automatically, with the extra and signature');
  check((await page.textContent('#main')).includes('Approved online'), 'quote screen updated by itself');

  /* ---------- online booking form → lead ---------- */
  await go('#/leads'); await page.click('.page-head button:has-text("Booking form")');
  await page.waitForSelector('.modal a:has-text("Preview the form")');
  const bookUrl = await page.getAttribute('.modal a:has-text("Preview the form")', 'href');
  check(bookUrl.includes('request.html#'), 'booking form link made');
  await page.evaluate(() => document.querySelectorAll('#modalRoot > *').forEach(m => m.remove()));
  const bk = await ctx.newPage(); bk.on('pageerror', e => errors.push('booking page: ' + e.message));
  await bk.goto(bookUrl); await bk.waitForSelector('#reqForm');
  check(await bk.locator('[name=services]').count() >= 2, 'customer can pick services from the price book');
  await bk.locator('label.chip:has([name=services])').first().click();
  await bk.fill('#nm', 'Jordan Lee'); await bk.fill('#ph', '647-555-0177'); await bk.fill('#ad', '9 Birch Ave, Toronto');
  await bk.locator('label.chip:has([value=Sat])').click(); await bk.locator('label.chip:has([value=Morning])').click();
  await bk.fill('#nt', 'Two storey, side gate code 1234');
  await bk.click('.req-send'); await bk.waitForSelector('.req-done');
  await shot(bk, 'booking-done'); await bk.close();
  const relayRaw = await fetch(`${PAY}/relay/${await dbGet('d.settings.relayTopic')}/json?poll=1`).then(r => r.text());
  check(!relayRaw.includes('Jordan') && !relayRaw.includes('Birch') && !relayRaw.includes('1234'), 'booking request is encrypted on the relay');
  await go('#/leads'); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[data-act="checkInbox"]')?.click());
  await page.goto(URL + '#/messages'); await page.waitForSelector('.page-head'); await page.click('button:has-text("Check for updates")'); await page.waitForTimeout(1200);
  const lead = await dbGet(`d.leads.find(l => l.name === 'Jordan Lee')`);
  check(lead && lead.phone === '647-555-0177' && lead.address.includes('Birch') && lead.notes.includes('Sat') && lead.notes.includes('gate code') && lead.service, 'booking request became a lead with all the details');

  /* ---------- quotes: edit and delete ---------- */
  await go('#/quotes/qtest2');
  check(await page.locator('.doc-actions > [data-act="editDoc"]').count() === 1, 'Edit button is right on the quote');
  await page.click('.doc-actions [data-menu]'); await page.click('.menu-item:has-text("Delete")'); await page.waitForTimeout(400);
  check(!(await dbGet(`d.quotes.some(x => x.id === 'qtest2')`)) && page.url().endsWith('#/quotes'), 'quote deleted');

  /* ---------- phone layout ---------- */
  {
    const ph = await browser.newContext({ ...require('playwright').devices['iPhone 14'] });
    const pp = await ph.newPage(); pp.on('pageerror', e => errors.push('phone2: ' + e.message)); pp.on('dialog', d => d.accept());
    await pp.goto(URL); await pp.waitForSelector('.page-head');
    await pp.click('button:has-text("Load sample data")'); await pp.waitForTimeout(300);
    await pp.goto(URL + '#/quotes'); await pp.waitForTimeout(300);
    await pp.locator('.show-sm .list-item').first().tap(); await pp.waitForTimeout(500);
    check(await pp.isVisible('#pageMore'), 'iPhone: ••• More button in the top bar');
    await pp.tap('#pageMore'); await pp.waitForTimeout(400);
    check(await pp.locator('.sheet-backdrop').count() === 1, 'iPhone: one tap opens exactly one sheet');
    check(await pp.locator('body > .sheet-backdrop .action-sheet .menu-item:has-text("Delete")').isVisible(), 'iPhone: More opens an action sheet at the top of the page');
    await pp.tap('.action-sheet .menu-item:has-text("Delete")'); await pp.waitForTimeout(500);
    check(await pp.locator('.sheet-backdrop').count() === 0 && pp.url().endsWith('#/quotes'), 'iPhone: Delete in the sheet works and the sheet closes');
    check(await pp.isVisible('#menuBtn'), 'iPhone: ☰ button top left');
    await pp.tap('#menuBtn'); await pp.waitForTimeout(450);
    const sb = await pp.evaluate(() => { const r = document.querySelector('#sidebar').getBoundingClientRect(); return [r.left, r.width, getComputedStyle(document.querySelector('#sidebar')).visibility]; });
    check(sb[0] >= -1 && sb[1] > 250 && sb[2] === 'visible', 'iPhone: ☰ slides out the menu');
    if (shots) await pp.screenshot({ path: `${shots}/drawer.png` });
    await pp.tap('#sidebar a[href="#/customers"]'); await pp.waitForTimeout(500);
    check(pp.url().endsWith('#/customers') && !(await pp.evaluate(() => document.querySelector('#sidebar').classList.contains('open'))), 'iPhone: picking a section closes the menu');
    await ph.close();
  }
  /* ---------- phone layout ---------- */
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p2 = await phone.newPage(); p2.on('pageerror', e => errors.push('phone: ' + e.message));
  await p2.goto(URL + '#/messages'); await p2.waitForSelector('.page-head');
  check(await p2.isVisible('#msgBtn'), 'Messages button in the top bar on phones');
  check(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'messages screen fits the phone');

  check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  await browser.close();
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nAll connect checks passed');
  process.exit(failures.length ? 1 : 0);
})();
