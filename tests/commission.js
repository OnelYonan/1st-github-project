/* Commission flow: cleaner % and sales rep % on a job, payouts.
 *   python3 -m http.server 8765 &   then   node tests/commission.js */
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/';
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const go = async h => { await page.goto(URL + h); await page.waitForSelector('.page-head'); };
  const submit = () => page.click('.modal button[type=submit]');
  await page.goto(URL); await page.waitForSelector('.page-head');
  await page.click('button:has-text("Load sample data")'); await page.waitForTimeout(300);

  // a customer sold door-to-door by Jordan
  await go('#/customers'); await page.click('.page-head button:has-text("New customer")');
  await page.fill('.modal input[name=name]', 'Pat Door'); await page.selectOption('.modal select[name=salesRep]', 'Jordan'); await submit(); await page.waitForTimeout(150);

  // new $250 job, cleaned by Mike (20%), sold by Jordan (25%)
  await go('#/jobs'); await page.click('.page-head button:has-text("New job")');
  await page.selectOption('.modal select[name=customerId]', { label: 'Pat Door' });
  await page.fill('.modal input[name=title]', 'Window cleaning'); await page.fill('.modal input[name=jobPrice]', '250');
  await page.selectOption('.modal select[name=assignedTo]', 'Mike');
  check(await page.inputValue('.modal select[name=salesRep]') === 'Jordan', 'sales rep filled in from the customer');
  check(await page.inputValue('.modal input[name=cleanerPct]') === '20' && await page.inputValue('.modal input[name=salesPct]') === '25', 'default rates 20% cleaner, 25% sales');
  let sum = await page.textContent('.modal .js-pay-sum');
  check(sum.includes('−$50.00') && sum.includes('−$62.50') && sum.includes('$137.50'), `live breakdown: Mike $50, Jordan $62.50, you keep $137.50`);
  await page.fill('.modal input[name=cleanerPct]', '25');
  sum = await page.textContent('.modal .js-pay-sum');
  check(sum.includes('−$62.50') && sum.includes('$125.00'), 'custom 25% cleaner rate recalculates (you keep $125)');
  await submit(); await page.waitForSelector('text=Job costing');
  await page.click('.page-head button:has-text("Complete")'); await page.waitForTimeout(200);
  check(await page.isVisible('.pay-row.keep >> text=$125.00'), 'job page shows what you keep after commissions');

  // commissions tab and payout
  await go('#/team'); await page.click('[data-tab="team:tab:pay"]');
  const jordanRow = await page.textContent('tr:has-text("Jordan")');
  check(jordanRow.includes('$62.50'), 'Jordan owed $62.50 this week');
  await page.click('tr:has-text("Jordan") button:has-text("Mark paid")'); await page.waitForTimeout(200);
  check(await page.isVisible('tr:has-text("Jordan") >> text=Paid'), 'payout marked paid');
  await go('#/expenses');
  check(await page.isVisible('tbody tr:has-text("Jordan")'), 'payout recorded as an expense');

  check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  await browser.close();
  console.log(failures.length ? `\n${failures.length} FAILED` : '\nAll commission checks passed');
  process.exit(failures.length ? 1 : 0);
})();
