# Business Hub

Your own booking and business-management app for a home-services business: schedule jobs, send quotes and invoices, take payments, and track income, expenses and mileage.

## Features

**Work**
- **Dashboard**: a "Needs attention" list, today's schedule and the next 7 days, to-dos, who's on the clock, unpaid invoices, open quotes, and this month's numbers with an optional goal.
- **Schedule**: month, week and day views, with jobs colour-coded by team member and a team filter. Drag a job to another day to reschedule it. One-tap **Route** opens the day's stops in Google Maps.
- **Time clock**: clock in/out from the button at the top of every screen, the dashboard, or a job page.
- **Jobs**: a price box on every new job, a job timer (start → complete), before/after photos, job costing, and one-tap texts (confirm, on my way, review request).
- **Recurring**: repeat every week, every 2 weeks, monthly, every 3 months, yearly, or **custom**. Custom means every N days, weeks or months on chosen weekdays, ending after a number of visits or on a date. Each plan shows estimated monthly recurring revenue, and you can add visits or stop a plan.
- **To-dos** with due dates, plus quick-add.

**Sales**
- **Door knocking** (like SalesRabbit):
  - Pin every house on a **satellite** or street map: ✓ yes / sale, ✗ no, green sheet for quoted, clock for "come back later", house for not home.
  - Add notes, name, phone and a come-back date to each pin; every pin keeps its full knock history.
  - Stats for any **day, week, month or year**: doors knocked, sales, quotes, come-backs and close rate, by rep.
  - Turn any pin into a lead, customer, quote, job or service plan.
- **Service plans**: recurring agreements built from templates, with a main service plus **add-ons** (every visit or once a term), **terms & conditions** (including property-damage and liability limits), an early-cancellation fee (e.g. $50 if cancelled in the first year before 2 cleans) and auto-renewal.
  - Sign **in person** on your phone, or **text or email a signing link**. The customer signs with their finger and sends it back, and the plan activates and schedules the visits.
  - Cancelling checks the term and the visits completed, applies the fee, and offers a one-tap **charge to the card on file**.
- **Stripe payments** (optional, see [STRIPE-SETUP.md](STRIPE-SETUP.md)):
  - Customers save their card on Stripe's secure page.
  - Charge saved cards in one tap, and optionally auto-charge plan visits when they're completed.
  - Pay-online links in invoice messages, with the invoice marked paid automatically.
  - Refunds.
  - Runs through a small private payment server (`stripe-worker/worker.js`, free on Cloudflare) that keeps your Stripe secret key out of the app.
- **Cards on file**: card type, last 4 digits and expiry; Stripe cards sync automatically. Full card numbers are never stored in the app.
- **Leads**: a pipeline board with **stages you can rename and add**, follow-ups and sources. A lead turns into a customer and quote, or a job, in one tap.
- **Customers**: an **activity timeline** (quotes, jobs, invoices, payments and your own notes), contact buttons, statements, and CSV import.
- **Quotes & invoices**: deposits, payment reminders, an online payment link, PDF, and editable message templates.

**Money**
- Income, expenses (receipt photos, recurring expenses), mileage, and reports (profit and loss, sales tax, aging, lead sources, team).

**Business**
- **Commissions**: a cleaner % per job and a sales-rep % per sale (defaults 20% and 25%, changeable per person or job). Each job shows everyone's cut and what you keep, a Commissions tab shows what's owed each week or month, and "Mark paid" records the payout as an expense.
- **Team & time**: team members with roles, pay rates and calendar colours, **clock in/out**, and weekly **timesheets** with approval and pay totals.
- **Price book** and **Settings**, organised into tabs.

**Everyday conveniences**
- **Address auto-complete**: type part of an address and pick from suggestions (free OpenStreetMap lookup, needs internet).
- **Undo** after deleting, phone numbers formatted automatically, and a warning before closing a form with unsaved changes.
- **Search** across everything (Ctrl/Cmd + K), and the app remembers your last views.
- Phone layout with a bottom tab bar and quick-action buttons. Works offline as a home-screen app.

## Running it

There is no build step. Open `index.html` in a browser, or host the folder anywhere that serves static files.

**Easiest way to use it on your phone:** turn on GitHub Pages (repo → Settings → Pages → Deploy from branch → pick the branch → `/root`). Then open the URL and choose "Add to Home Screen".

## Your data

All data is stored privately in the browser on the device you use (IndexedDB, with plenty of room for photos). Nothing is sent to a server. Data saved by the first version is moved over automatically.
- Use **Settings → Download backup** regularly.
- Use **Restore from backup** to move your data to another device.
- Data does not sync between devices automatically. That would need a backend/database, which could be added later.

## Testing

```bash
python3 -m http.server 8765      # in this folder
node tests/smoke.js              # end-to-end check (needs Playwright)
node tests/mock-pay-server.mjs & # fake Stripe + the real payment server
node tests/stripe.js             # Stripe flows
node tests/commission.js         # commission maths
node tests/iphone-audit.js       # nothing off-screen on an iPhone
```
