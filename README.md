# Business Hub

Your own booking and business-management app for a home-services business: schedule jobs, send quotes and invoices, take payments, and track income, expenses and mileage.

## Features

- **Dashboard**: this month's income (with an optional monthly goal), expenses, profit and money owed. It also has a getting-started checklist, alerts (overdue invoices, new leads, jobs to invoice, quotes to follow up, backup reminder), the next 7 days, today's to-dos and a 6-month chart.
- **Schedule**: month, week and day views, plus a team-member filter. Drag a job to another day to reschedule it. One-tap **Route** opens the day's stops in Google Maps. Jobs can repeat weekly, every 2 weeks, monthly, every 3 months or yearly, and changes can be applied to the rest of a repeating series.
- **Jobs**: status (scheduled → in progress → completed), before/after **photos**, job costing (link expenses to see real profit), and one-tap texts: *confirm appointment*, *on my way*, *ask for a review*.
- **Leads**: a board with New → Contacted → Quoted → Won / Lost stages and drag-and-drop. Includes follow-up dates, lead sources, pipeline value and win rate. A lead turns into a customer and quote, or a booked job, in one tap. The lead updates itself when the quote is approved or declined.
- **To-dos**: reminders with due dates, linked to customers, with quick-add on the dashboard.
- **Customers**: call, text, email or get directions in one tap. Shows lifetime revenue, balance owing and full history, and prints a **statement** of open invoices. Import from CSV, with a duplicate warning.
- **Quotes**: printable quotes with an optional **deposit**. Approve, decline or follow up, then convert to a job or invoice. The final invoice automatically subtracts the deposit.
- **Invoices**: discounts, HST/GST, partial payments, **payment reminders**, an online payment link (Stripe, Square or PayPal), a paid stamp, void, and PDF through Print → Save as PDF.
- **Income & expenses**: payments are recorded automatically, plus cash income. Expenses have receipt photos, tax paid and **monthly recurring expenses**. There is also a mileage log.
- **Reports**: profit and loss, a sales-tax summary, expenses by category, top customers, income by lead source, work by team member, accounts-receivable aging, the sales pipeline, and CSV exports.
- **Price book**, editable **message templates**, **search** across everything (Ctrl/Cmd + K), dark mode, a phone bottom bar, and offline use as a home-screen app.

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
```
