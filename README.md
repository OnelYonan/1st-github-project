# Business Hub

Your own booking and business-management app for a home-services business: schedule jobs, send quotes and invoices, take payments, and track income, expenses and mileage.

## Features

- **Dashboard**: this month's income, expenses, profit and money owed, plus alerts for overdue invoices, completed jobs not invoiced yet, and quotes to follow up.
- **Schedule**: a month calendar with day view. Jobs can repeat weekly, every two weeks, monthly, every three months or yearly.
- **Jobs**: status tracking (scheduled → in progress → completed), line items, and job costing that links expenses to a job to show real profit. One click turns a job into an invoice.
- **Customers**: contact buttons (call, text, email, directions), lifetime revenue, balance owing, and full history. Import from CSV.
- **Quotes**: professional printable quotes. Send by email or text, approve or decline, and convert to a job or an invoice. Shows your win rate.
- **Invoices**: due dates, discounts, sales tax, partial payments, paid stamp, void, and PDF through Print → Save as PDF.
- **Income**: invoice payments are recorded automatically. You can also add cash jobs and other income.
- **Expenses**: categories, receipt photos from your phone camera, tax paid (input tax credits), and a **mileage log**.
- **Reports**: profit and loss, a sales-tax (HST/GST) summary, expenses by category, top customers, accounts-receivable aging, the sales pipeline, and CSV exports for your accountant.
- **Price book**: saved services and prices that fill in automatically on quotes and invoices.
- **Settings**: business details, logo, tax rate, numbering, payment terms, payment instructions, and dark mode.
- Works on phone and desktop. You can install it to your home screen and it works offline.

## Running it

There is no build step. Open `index.html` in a browser, or host the folder anywhere that serves static files.

**Easiest way to use it on your phone:** turn on GitHub Pages (repo → Settings → Pages → Deploy from branch → pick the branch → `/root`). Then open the URL and choose "Add to Home Screen".

## Your data

All data is stored privately in the browser on the device you use (localStorage). Nothing is sent to a server.
- Use **Settings → Download backup** regularly.
- Use **Restore from backup** to move your data to another device.
- Data does not sync between devices automatically. That would need a backend/database, which could be added later.
