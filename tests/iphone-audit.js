/* iPhone layout audit: opens every page, form and menu on an emulated iPhone
 * and reports anything that sticks out past the screen edges.
 *
 *   python3 -m http.server 8765 &   then   node tests/iphone-audit.js [screenshotDir]
 */
const { chromium, devices } = require('playwright');
const URL = 'http://localhost:8765/';
const shots = process.argv[2];

const findOverflow = () => {
  const W = innerWidth, out = new Set();
  const inScroller = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
      if (cs.position === 'fixed') break;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden') continue;
    if ((r.right > W + 1 || r.left < -1) && !inScroller(el) && !el.closest('.leaflet-container')) {
      out.add(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} [${Math.round(r.left)}→${Math.round(r.right)}] "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`);
    }
  }
  if (document.documentElement.scrollWidth > W + 1) out.add(`PAGE scrolls sideways: ${document.documentElement.scrollWidth}px wide`);
  return [...out].slice(0, 12);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  let problems = 0, n = 0;
  const audit = async label => {
    await page.waitForTimeout(250);
    const o = await page.evaluate(findOverflow);
    n++;
    if (o.length) { problems++; console.log(`✗ ${label}\n   ${o.join('\n   ')}`); } else console.log(`✓ ${label}`);
    if (shots) await page.screenshot({ path: `${shots}/${String(n).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png` });
  };
  const go = async hash => { await page.goto(URL + hash); await page.waitForSelector('.page-head, .map-screen', { timeout: 15000 }); };
  const closeModal = async () => { await page.evaluate(() => document.querySelectorAll('#modalRoot > *').forEach(m => m.remove())); };
  const menu = async label => { const m = page.locator('[data-menu]').first(); if (await m.count()) { await m.click(); await audit(label + ' · More menu'); await page.mouse.click(5, 300); } };
  const openFirst = async (sel, label) => { const el = page.locator(sel).first(); if (await el.count()) { await el.click(); await page.waitForTimeout(250); await audit(label); return true; } return false; };

  await page.goto(URL); await page.waitForSelector('.page-head');
  await audit('welcome');
  await page.click('button:has-text("Load sample data")'); await page.waitForTimeout(400);

  for (const r of ['dashboard', 'schedule', 'jobs', 'tasks', 'canvass', 'leads', 'customers', 'quotes', 'plans', 'invoices', 'income', 'expenses', 'reports', 'team', 'services', 'settings']) {
    await go('#/' + r); await audit(r);
  }
  for (const v of ['Week', 'Day']) { await go('#/schedule'); await page.click(`.seg button:has-text("${v}")`); await audit('schedule ' + v); }
  await go('#/schedule'); await page.click('.seg button:has-text("Month")');
  await go('#/canvass'); for (const t of ['stats', 'list']) { await page.click(`[data-tab="canvass:tab:${t}"]`); await audit('canvass ' + t); }
  await go('#/canvass'); await page.click('[data-tab="canvass:tab:map"]');
  await go('#/team'); await page.click('[data-tab="team:tab:time"]'); await audit('timesheets'); await page.click('[data-tab="team:tab:team"]');
  await go('#/settings'); for (const t of ['money', 'docs', 'plans', 'messages', 'lists', 'data']) { await page.click(`[data-settab=${t}]`); await audit('settings ' + t); }
  await page.click('[data-settab=business]');

  await go('#/jobs'); if (await openFirst('.show-sm .list-item', 'job detail')) await menu('job detail');
  await go('#/customers'); if (await openFirst('.show-sm .list-item', 'customer detail')) { await menu('customer detail'); await page.click('[data-tab="customer:tab:jobs"]'); }
  await go('#/quotes'); await page.click('[data-tab="quotes:tab:all"]'); if (await openFirst('.show-sm .list-item', 'quote detail')) await menu('quote detail');
  await go('#/invoices'); if (await openFirst('.show-sm .list-item', 'invoice detail')) await menu('invoice detail');
  await go('#/plans'); await page.click('[data-tab="plans:tab:agreements"]'); if (await openFirst('.plan-row', 'plan detail')) await menu('plan detail');

  const forms = [['#/jobs', '.page-head button:has-text("New job")', 'new job form'], ['#/quotes', '.page-head button:has-text("New quote")', 'new quote form'],
    ['#/invoices', '.page-head button:has-text("New invoice")', 'new invoice form'], ['#/plans', '.page-head button:has-text("New service plan")', 'new plan form'],
    ['#/expenses', '.page-head button:has-text("Add expense")', 'expense form'], ['#/customers', '.page-head button:has-text("New customer")', 'customer form'],
    ['#/leads', '.page-head button:has-text("New lead")', 'lead form'], ['#/team', '.page-head button:has-text("Add team member")', 'team member form']];
  for (const [h, sel, label] of forms) {
    await go(h);
    // on phones the header's "New …" button is folded into the floating + button
    const target = (await page.locator(sel).isVisible().catch(() => false)) ? sel : '.fab';
    if (await page.locator(target).count()) { await page.click(target); await audit(label); await closeModal(); }
    else console.log(`- skipped ${label} (no button in page header)`);
  }
  await go('#/dashboard'); await page.click('.bottom-nav button'); await audit('bottom nav More'); await closeModal();
  await go('#/dashboard'); await page.click('#searchBtn'); await page.fill('.search-modal input', 'ma'); await audit('search');

  console.log(`\n${problems} of ${n} screens have something off-screen.${errors.length ? ' Page errors: ' + JSON.stringify(errors) : ''}`);
  await browser.close();
})();
