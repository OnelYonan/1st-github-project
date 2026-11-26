# Business Hub

A booking and business app for a home-services business (window cleaning, gutters, pressure washing, lawn care and similar). It runs in any browser and installs on an iPhone like a normal app.

**Live app:** https://onelyonan.github.io/1st-github-project/

## What it does

**Work**
- **Dashboard**: income, expenses, profit after commissions, paid to team, and money owed, plus a "Needs attention" list, today's schedule, to-dos and the time clock.
- **Schedule**: month, week and day views with team colours. Drag a job to another day to reschedule it. One-tap route for the day in Google Maps.
- **Jobs**: price, cleaner and sales-rep commission, photos, job timer, quick texts (confirm, on my way, review request) and job profit.
- **Repeat visits**: weekly, monthly or custom schedules (every N days, weeks or months on chosen weekdays, ending after a number of visits or on a date).
- **To-dos** and a **time clock** with weekly timesheets.

**Sales**
- **Door knocking**: a full-screen satellite map like Apple Maps that you can rotate and tilt.
  - Tap a house to pin it: ✓ yes, ✗ no, quoted, come back later or not home, with notes and a full knock history.
  - Show pins from today, this week, month, year or all time (today by default; come-backs that are due always show).
  - Stats by day, week, month and year, with a per-rep breakdown.
- **Leads**: a pipeline board with stages you can rename.
- **Customers**: activity timeline, notes, cards on file, statements and CSV import.
- **Quotes and invoices**: deposits, reminders, pay-online links and PDF.
- **Online quote approval**: customers get a link to their quote, tick any optional extras, sign and approve, or ask for changes. With the server connected, approvals land in the app automatically and a deposit invoice is created.
- **Messages**: a conversation for each customer, quick templates, and **promo blasts** to all customers, plan customers, lapsed customers or a tag, with STOP opt-outs handled for you. With Twilio connected, texts go from your business number and replies show up in the app.
- **Service plans**: signed agreements.
  - Templates with a main service plus add-ons (every visit or once a term).
  - Terms and conditions covering damage, liability and early cancellation.
  - Sign in person or send a signing link.
  - The cancellation fee is applied automatically.
- **Stripe (optional)**: save cards securely, charge them in one tap, pay-online links, refunds, and auto-charging plan visits. Set up in the app with a step-by-step guide and a one-tap Deploy to Cloudflare button. See [STRIPE-SETUP.md](STRIPE-SETUP.md).

**Money and team**
- **Income, expenses** (receipt photos, recurring expenses) and a **mileage log**.
- **Reports**: profit and loss, sales tax, aging, lead sources and team, plus CSV exports.
- **Team and time**: roles, pay rates, commission rates, timesheets, and a commission payout tab with "Mark paid".

**Everywhere**
- Address auto-complete.
- Search (Ctrl/Cmd + K).
- Undo after deleting.
- Dark mode.
- Works offline (except maps and address look-up).

## Using it on your iPhone

1. Open the live link in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open it from the new icon. It runs full-screen like an app.

## Your data

- Everything is stored **privately on your device** (in the browser's storage). Nothing is sent to a server, except card charges if you connect Stripe.
- Photos and receipts are stored separately, so saving stays fast even with hundreds of photos.
- The app keeps **automatic daily copies of the last 7 days**. Roll back from **Settings → Data & backup**.
- **Download a backup** regularly (photos included). Use **Restore from backup** to move to a new phone. Backups never include your Stripe app token.
- Data doesn't sync between devices on its own. That would need an online database.

## For developers

No build step: plain HTML, CSS and JavaScript.

| Path | What it is |
|---|---|
| `index.html`, `js/app.js`, `css/styles.css` | The app |
| `js/shared.js` | Helpers shared with the signing page (link packing, signature pad, default terms) |
| `sign.html`, `js/sign.js` | The page customers use to sign service agreements |
| `paid.html` | Thank-you page after a customer saves a card or pays |
| `stripe-worker/` | Optional server for Cloudflare Workers: Stripe, texting (Twilio) and the inbox for approvals and replies. Has a Deploy to Cloudflare setup |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and home-screen app |

Run all tests (needs Node, Playwright and Python 3):

```bash
bash tests/run-all.sh
```

This runs the main end-to-end test, Stripe (against a fake Stripe), commissions, photos, daily copies, quote approval / texting / blasts / map filters (against a fake Twilio), and an iPhone layout audit that checks every main screen for anything off-screen.
