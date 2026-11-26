/**
 * Business Hub server (Cloudflare Worker).
 *
 * Keeps your secret keys private and lets the Business Hub app:
 *  - Stripe: save customers' cards (Stripe-hosted page), charge them, pay-online links, refunds
 *  - Texting (optional, Twilio): send texts and promo blasts from the app, receive replies
 *  - Inbox: customers' quote approvals and signed agreements arrive in the app automatically
 *
 * Settings (Cloudflare → your Worker → Settings → Variables and Secrets):
 *   STRIPE_SECRET_KEY  (secret)  sk_test_… while testing, sk_live_… when you go live
 *   APP_TOKEN          (secret)  a long random password; the app makes one for you
 *   ALLOWED_ORIGINS    (text)    where your app lives, e.g. https://onelyonan.github.io
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (secrets), TWILIO_FROM (text, e.g. +14165550100)  optional, for texting
 * Storage: a KV namespace bound as INBOX (created for you by the Deploy button).
 *
 * See STRIPE-SETUP.md for step-by-step instructions.
 */

const STRIPE = 'https://api.stripe.com/v1';

/** Stripe wants form encoding with brackets for nested values: metadata[invoice]=INV-1. */
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(env, method, path, params, idempotencyKey) {
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  let url = STRIPE + path, body;
  if (method === 'GET') { const q = params ? form(params).toString() : ''; if (q) url += '?' + q; }
  else { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = form(params || {}).toString(); }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(url, { method, headers, body });
  const data = await res.json();
  if (!res.ok) { const e = new Error(data.error?.message || 'Stripe error'); e.stripe = data.error || {}; e.status = res.status; throw e; }
  return data;
}

/** Constant-time comparison so the token can't be guessed by timing. */
function sameToken(a = '', b = '') {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const cardOut = pm => ({ id: pm.id, brand: pm.card?.brand, last4: pm.card?.last4, exp_month: pm.card?.exp_month, exp_year: pm.card?.exp_year, wallet: pm.card?.wallet?.type || '' });
const cents = amount => { const c = Math.round(Number(amount) * 100); if (!Number.isFinite(c) || c < 50) { const e = new Error('Amount must be at least 0.50'); e.status = 400; throw e; } return c; };

const smsOn = env => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
const DAY = 86400;

/** Keep something for the app to collect (60 days). */
async function toInbox(env, kind, data) {
  if (!env.INBOX) throw Object.assign(new Error('Inbox storage is not set up on this server.'), { status: 501 });
  const key = `in:${Date.now().toString(36)}:${crypto.randomUUID().slice(0, 8)}`;
  await env.INBOX.put(key, JSON.stringify({ kind, at: new Date().toISOString(), ...data }), { expirationTtl: 60 * DAY });
  return key;
}

/** Twilio signs its webhooks: HMAC-SHA1 of the URL plus the sorted form fields, keyed with the auth token. */
async function twilioSigned(req, env, params) {
  const sig = req.headers.get('X-Twilio-Signature') || '';
  const data = new URL(req.url).href + Object.keys(params).sort().map(k => k + params[k]).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TWILIO_AUTH_TOKEN), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  return sameToken(btoa(String.fromCharCode(...mac)), sig);
}

/** Routes anyone may call: customers sending back a signed quote or agreement, and Twilio delivering a reply. */
async function publicRoute(req, env, url) {
  const p = url.pathname.replace(/\/+$/, '');
  if (p === '/public/submit' && req.method === 'POST') {
    const text = await req.text();
    if (text.length > 150000) throw Object.assign(new Error('Too large'), { status: 413 });
    let b; try { b = JSON.parse(text); } catch { throw Object.assign(new Error('Bad request'), { status: 400 }); }
    if (!['quote', 'plan'].includes(b.k) || typeof b.id !== 'string' || b.id.length > 40) throw Object.assign(new Error('Bad request'), { status: 400 });
    await toInbox(env, 'response', { data: b }); // the app checks it against the real quote before using it
    return { ok: true };
  }
  if (p === '/twilio/inbound' && req.method === 'POST') {
    const params = Object.fromEntries(new URLSearchParams(await req.text()));
    if (!smsOn(env) || !(await twilioSigned(req, env, params))) return new Response('Forbidden', { status: 403 });
    await toInbox(env, 'sms', { from: params.From || '', body: String(params.Body || '').slice(0, 2000), sid: params.MessageSid || '', media: +params.NumMedia || 0 });
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
  }
  return null;
}

async function route(req, env, url) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const q = Object.fromEntries(url.searchParams);
  const cur = String(body.currency || q.currency || 'cad').toLowerCase();

  if (p === '/health') {
    const features = { stripe: !!env.STRIPE_SECRET_KEY, sms: smsOn(env), inbox: !!env.INBOX, smsFrom: env.TWILIO_FROM || '' };
    if (!env.STRIPE_SECRET_KEY) return { ok: true, features };
    const acct = await stripe(env, 'GET', '/account');
    return { ok: true, features, mode: env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'live' : 'test', account: acct.business_profile?.name || acct.settings?.dashboard?.display_name || acct.email || acct.id,
      chargesEnabled: !!acct.charges_enabled, payoutsEnabled: !!acct.payouts_enabled, country: acct.country, currency: acct.default_currency };
  }
  if (p === '/sms' && req.method === 'POST') {
    if (!smsOn(env)) throw Object.assign(new Error('Texting is not set up on the server (Twilio settings missing).'), { status: 501 });
    const to = String(body.to || '').replace(/[^\d+]/g, ''), text = String(body.body || '').slice(0, 1600);
    if (!to || !text) throw Object.assign(new Error('A phone number and message are required.'), { status: 400 });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST', body: new URLSearchParams({ To: to.startsWith('+') ? to : (to.length === 10 ? '+1' + to : '+' + to), From: env.TWILIO_FROM, Body: text }),
      headers: { Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const d = await res.json();
    if (!res.ok) return { error: d.message || 'Twilio error', code: d.code || '' }; // e.g. 21610: they replied STOP
    return { id: d.sid, status: d.status };
  }
  if (p === '/inbox' && req.method === 'GET') {
    if (!env.INBOX) return { items: [], inbox: false };
    const list = await env.INBOX.list({ prefix: 'in:', limit: 100 });
    const items = [];
    for (const k of list.keys) { const v = await env.INBOX.get(k.name); if (v) items.push({ key: k.name, ...JSON.parse(v) }); }
    return { items, more: !list.list_complete };
  }
  if (p === '/inbox/ack' && req.method === 'POST') {
    for (const k of (body.keys || []).slice(0, 100)) if (String(k).startsWith('in:')) await env.INBOX?.delete(k);
    return { ok: true };
  }
  if (!env.STRIPE_SECRET_KEY) throw Object.assign(new Error('Stripe is not set up on this server (STRIPE_SECRET_KEY missing).'), { status: 501 });
  if (p === '/customers' && req.method === 'POST') {
    const c = await stripe(env, 'POST', '/customers', { name: body.name, email: body.email, phone: body.phone, metadata: { app_customer: body.appCustomerId } },
      body.appCustomerId ? `cust-${body.appCustomerId}` : undefined);
    return { id: c.id };
  }
  if (p === '/card-link' && req.method === 'POST') {
    const s = await stripe(env, 'POST', '/checkout/sessions', { mode: 'setup', customer: body.customer, currency: cur, payment_method_types: ['card'],
      success_url: body.successUrl, cancel_url: body.cancelUrl || body.successUrl, metadata: { purpose: 'save_card' } });
    return { id: s.id, url: s.url };
  }
  if (p === '/cards' && req.method === 'GET') {
    if (!q.customer) throw Object.assign(new Error('customer is required'), { status: 400 });
    const [list, cust] = await Promise.all([
      stripe(env, 'GET', '/payment_methods', { customer: q.customer, type: 'card', limit: 20 }),
      stripe(env, 'GET', `/customers/${encodeURIComponent(q.customer)}`),
    ]);
    return { cards: list.data.map(cardOut), defaultCard: cust.invoice_settings?.default_payment_method || '' };
  }
  if (p === '/cards/remove' && req.method === 'POST') {
    await stripe(env, 'POST', `/payment_methods/${encodeURIComponent(body.paymentMethod)}/detach`, {});
    return { ok: true };
  }
  if (p === '/charge' && req.method === 'POST') {
    try {
      const pi = await stripe(env, 'POST', '/payment_intents', {
        amount: cents(body.amount), currency: cur, customer: body.customer, payment_method: body.paymentMethod,
        off_session: 'true', confirm: 'true', description: body.description, receipt_email: body.receiptEmail,
        metadata: { invoice: body.invoice, app_invoice: body.appInvoiceId }, expand: ['latest_charge'],
      }, body.idempotencyKey);
      return { id: pi.id, status: pi.status, amount: pi.amount_received / 100, receiptUrl: pi.latest_charge?.receipt_url || '' };
    } catch (e) {
      // Declines and "needs the customer to approve" come back here; the app offers a pay link instead.
      return { error: e.message, code: e.stripe?.decline_code || e.stripe?.code || 'error', paymentIntent: e.stripe?.payment_intent?.id || '' };
    }
  }
  if (p === '/pay-link' && req.method === 'POST') {
    const s = await stripe(env, 'POST', '/checkout/sessions', {
      mode: 'payment', customer: body.customer, customer_email: body.customer ? undefined : body.email, success_url: body.successUrl, cancel_url: body.cancelUrl || body.successUrl,
      line_items: [{ quantity: 1, price_data: { currency: cur, unit_amount: cents(body.amount), product_data: { name: body.description || 'Invoice' } } }],
      payment_intent_data: { description: body.description, metadata: { invoice: body.invoice, app_invoice: body.appInvoiceId }, setup_future_usage: body.saveCard ? 'off_session' : undefined },
      customer_creation: body.customer ? undefined : 'always', metadata: { invoice: body.invoice, app_invoice: body.appInvoiceId },
    });
    return { id: s.id, url: s.url };
  }
  if (p === '/session' && req.method === 'GET') {
    const s = await stripe(env, 'GET', `/checkout/sessions/${encodeURIComponent(q.id)}`, { expand: ['payment_intent.latest_charge'] });
    return { status: s.status, paymentStatus: s.payment_status, amount: (s.amount_total || 0) / 100, customer: s.customer || '',
      paymentIntent: s.payment_intent?.id || '', receiptUrl: s.payment_intent?.latest_charge?.receipt_url || '' };
  }
  if (p === '/refund' && req.method === 'POST') {
    const r = await stripe(env, 'POST', '/refunds', { payment_intent: body.paymentIntent, amount: body.amount ? cents(body.amount) : undefined, reason: 'requested_by_customer' },
      body.idempotencyKey);
    return { id: r.id, status: r.status, amount: r.amount / 100 };
  }
  throw Object.assign(new Error('Not found'), { status: 404 });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || 'null',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400', Vary: 'Origin',
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (origin && !allowed.includes(origin)) return json({ error: 'This website is not allowed to use this server.' }, 403);
    if (url.pathname.startsWith('/public/') || url.pathname.startsWith('/twilio/')) {
      try { const r = await publicRoute(req, env, url); if (r instanceof Response) return r; if (r) return json(r); }
      catch (e) { return json({ error: e.message || 'Something went wrong' }, e.status || 500); }
      return json({ error: 'Not found' }, 404);
    }
    if (!env.APP_TOKEN) return json({ error: 'The server is missing APP_TOKEN.' }, 500);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!sameToken(token, env.APP_TOKEN)) return json({ error: 'Wrong app token.' }, 401);
    try { return json(await route(req, env, url)); }
    catch (e) { return json({ error: e.message || 'Something went wrong', code: e.stripe?.code || '' }, e.status && e.status < 500 ? e.status : 502); }
  },
};
