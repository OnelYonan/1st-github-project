# Connect Stripe to Business Hub

This lets you **save customers' cards, charge them in one tap, send pay-online links and give refunds**, all from the app. Money goes to your Stripe account, and Stripe pays it out to your bank automatically (usually within 2 business days in Canada).

The same small server also:
- brings customers' **quote approvals and signed agreements** straight into the app, with no link for them to send back;
- optionally sends **texts and promo blasts** from a business number and collects replies (see [Texting](#texting-optional)).

**Easiest way:** in the app, open **Settings → Plans & payments → Connect Stripe step by step**. It walks you through everything below, including a one-tap **Deploy to Cloudflare** button.

It takes about **10 minutes**, works entirely in your browser, and costs nothing to set up. Stripe charges a fee on each payment; see [stripe.com/en-ca/pricing](https://stripe.com/en-ca/pricing).

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/OnelYonan/1st-github-project/tree/claude/zealous-lovelace-h3cu2y/stripe-worker)

## Why there's a "payment server"

Charging a card needs your Stripe **secret key**. Anyone can read a website's code, so the key can't go inside the app. Instead it lives in a tiny private server (a Cloudflare Worker, free) that only your app can use. Card numbers are typed on Stripe's own secure page, so they never touch your app or the server.

```
Your app  ──(app token)──▶  Your payment server  ──(secret key)──▶  Stripe  ──▶  Your bank
```

## Step 1: Stripe account

1. Sign up at [dashboard.stripe.com/register](https://dashboard.stripe.com/register).
2. Leave **Test mode** switched on for now (top right). Test mode uses fake cards, so no real money moves.
3. Go to **Developers → API keys** and copy the **Secret key**. In test mode it starts with `sk_test_`.

## Step 2: Payment server (Cloudflare Worker)

**One tap:** use the **Deploy to Cloudflare** button above (or in the app's setup). Sign in to Cloudflare and GitHub, paste your Stripe secret key as `STRIPE_SECRET_KEY` and the app token from the app as `APP_TOKEN`, and tap **Create and deploy**. It creates the server and its storage for you. Then go to Step 3.

**By hand** (if the button doesn't work for you):

1. Sign up at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). The free plan is enough.
2. Go to **Workers & Pages → Create → Create Worker**, name it `business-hub-server`, and tap **Deploy**.
3. Tap **Edit code**. Delete everything, paste the entire contents of [`stripe-worker/worker.js`](stripe-worker/worker.js), then tap **Deploy**.
4. Go back to the Worker, open **Settings → Variables and Secrets**, and add:

   | Name | Type | Value |
   |---|---|---|
   | `STRIPE_SECRET_KEY` | Secret | your Stripe secret key from Step 1 |
   | `APP_TOKEN` | Secret | a long random password. In the app, open **Settings → Plans & payments**, tap **Generate**, and it's copied for you |
   | `ALLOWED_ORIGINS` | Text | `https://onelyonan.github.io` |

5. Optional but recommended: **Storage & Databases → KV → Create** a namespace called `business-hub-inbox`, then in your Worker go to **Settings → Bindings → Add → KV namespace**, name the variable `INBOX` and pick that namespace. This lets quote approvals and text replies come straight into the app.
6. Copy your Worker's address, which looks like `https://business-hub-server.<your-name>.workers.dev`.

## Step 3: Connect the app

1. In the app, open **Settings → Plans & payments**.
2. Paste the Worker address into **Payment server address**. Make sure **App token** is the same one you saved as `APP_TOKEN`.
3. Tap **Save & test connection**. You should see **Connected · Test mode**.

## Step 4: Try it with a test card

1. Open a customer, then tap **Save card with Stripe → Customer is here**.
2. Enter Stripe's test card `4242 4242 4242 4242`, any future expiry date, and any CVC and postal code.
3. Back in the app, tap **They're done: refresh cards**. The card shows **Stripe ✓ ready to charge**.
4. Create an invoice for them and tap **Charge •••• 4242**. It's marked paid, and the payment shows in your Stripe dashboard.

Other test cards: `4000 0000 0000 0002` is declined, and `4000 0025 0000 3155` asks the customer to approve the payment.

## Step 5: Go live

1. In Stripe, finish **Activate account** (business details and bank account).
2. Turn off Test mode, then copy your **live** secret key (`sk_live_…`).
3. In Cloudflare, replace `STRIPE_SECRET_KEY` with the live key.
4. In the app, tap **Save & test connection**. It should say **Live mode**.

Customers who saved cards in test mode need to save them again in live mode.

## What you can do once connected

- **Save a card:** text or email the customer a secure Stripe link, or let them type it on your phone.
- **Charge a saved card:** from any invoice. Plan cancellation fees can be charged right away.
- **Auto-charge plan visits** (optional, in Settings): when you mark a service-plan visit complete, it's invoiced and charged.
- **Pay-online links:** invoice texts and emails include a secure Stripe payment link (card, Apple Pay, Google Pay). The invoice is marked paid when you open it.
- **Refunds:** from the payment on the invoice.
- Stripe emails receipts to customers in live mode.

## Texting (optional)

Send texts and promo blasts from a business number inside the app, and see customers' replies in **Messages**. Without this, texts open your phone's Messages app ready to send (that still works fine).

1. Create a [Twilio account](https://www.twilio.com/try-twilio) and buy a phone number with SMS (about $1.15 USD a month, plus about 1¢ per text).
2. In Twilio, copy your **Account SID** and **Auth Token** from the Console home page.
3. In Cloudflare, open your Worker → **Settings → Variables and Secrets** and add:

   | Name | Type | Value |
   |---|---|---|
   | `TWILIO_ACCOUNT_SID` | Secret | your Account SID |
   | `TWILIO_AUTH_TOKEN` | Secret | your Auth Token |
   | `TWILIO_FROM` | Text | your Twilio number, like `+14165550100` |

4. In Twilio → **Phone Numbers → your number → Messaging → A message comes in**, choose **Webhook**, **HTTP POST**, and paste `https://<your worker address>/twilio/inbound`. The app shows this address with a Copy button in **Settings → Messages**.
5. In the app, **Settings → Messages → Check connection**. It should say **Texting on**.

**Promotions and the law:** in Canada, CASL says you need consent before sending promotional texts, and an easy way to opt out. Blasts add “Reply STOP to opt out.” by default. Anyone who replies STOP, or that you mark **Don't send promotions** on their customer page, is skipped automatically.

## Keeping it safe

- Never share your secret key or app token, or paste them into messages.
- Backups from the app leave out the app token.
- If a phone with the app is lost, generate a new token in the app and update `APP_TOKEN` in Cloudflare. The old one stops working right away.
- Only your website (`ALLOWED_ORIGINS`) and someone with your app token can use the payment server.
