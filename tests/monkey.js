/* "Tap everything" robustness test: on every main screen, on a phone and a desktop,
 * tap each action button (fresh page each time) and report any JavaScript errors.
 *
 *   python3 -m http.server 8765 &   then   node tests/monkey.js
 */
const { chromium, devices } = require('playwright');
const URL = 'http://localhost:8765/';
const SKIP = /^(delete|erase|restore|import|export|exportBackup|loadSample|docPrint|printPage|mapLocate|pinHere|rmLogo|deletePayment|refundPay|chargeCard|testStripe|stripeTestSave)/i;
const ROUTES = ['dashboard', 'schedule', 'jobs', 'messages', 'tasks', 'leads', 'customers', 'quotes', 'plans', 'invoices', 'income', 'expenses', 'reports', 'team', 'services', 'settings'];

(async () => {
  const browser = await chromium.launch();
  let total = 0; const problems = [];
  for (const [label, opts] of [['phone', { ...devices['iPhone 14'] }], ['desktop', { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    let errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('dialog', d => (d.type() === 'prompt' ? d.accept(d.defaultValue() || 'x') : d.accept()));
    await page.goto(URL); await page.waitForSelector('.page-head');
    await page.click('button:has-text("Load sample data")'); await page.waitForTimeout(400);
    const firstDetail = async coll => page.evaluate(c => { const a = document.querySelector(`#main a[href^="#/${c}/"], #main [data-href^="#/${c}/"]`); return a && (a.getAttribute('href') || a.dataset.href); }, coll);
    const routes = [...ROUTES];
    for (const coll of ['jobs', 'customers', 'quotes', 'invoices', 'plans']) { await page.goto(URL + '#/' + coll); await page.waitForTimeout(150); const h = await firstDetail(coll); if (h) routes.push(h.replace('#/', '')); }
    for (const r of routes) {
      await page.goto(URL + '#/' + r); await page.waitForSelector('.page-head', { timeout: 8000 }).catch(() => {});
      const acts = await page.evaluate(skip => [...new Set([...document.querySelectorAll('#main [data-act]')].filter(b => b.offsetParent && !new RegExp(skip, 'i').test(b.dataset.act))
        .map(b => b.dataset.act + '|' + (b.dataset.id || '') + '|' + (b.textContent || '').trim().slice(0, 30)))], SKIP.source);
      for (const key of acts) {
        const [act, id] = key.split('|');
        errs = [];
        await page.goto(URL + '#/' + r); await page.waitForTimeout(80);
        const loc = page.locator(`#main [data-act="${act}"]${id ? `[data-id="${id}"]` : ''}:visible`).first();
        if (!(await loc.count())) continue;
        total++;
        try { await loc.click({ timeout: 2500 }); await page.waitForTimeout(220); } catch (e) { errs.push('click failed: ' + e.message.split('\n')[0]); }
        // inside any sheet that opened, tap its first harmless button too
        const inner = page.locator('#modalRoot .modal button.btn:not(.btn-danger):not([type=submit]):visible, .sheet-backdrop .menu-item:not(.danger):not(.menu-cancel)').first();
        if (await inner.count()) { try { await inner.click({ timeout: 1500 }); await page.waitForTimeout(150); } catch { /* covered/closed: fine */ } }
        await page.evaluate(() => { document.querySelectorAll('#modalRoot > *, .sheet-backdrop').forEach(m => m.remove()); });
        if (errs.length) problems.push(`${label} #/${r} → ${act}: ${errs.join(' | ')}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`Tapped ${total} buttons.`);
  if (problems.length) { console.log(problems.join('\n')); console.log(`\n${problems.length} PROBLEMS`); process.exit(1); }
  console.log('No errors: all checks passed');
})();
