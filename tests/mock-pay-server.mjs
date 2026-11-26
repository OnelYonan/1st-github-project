/* Runs the real payment server (stripe-worker/worker.js) locally, with a fake
 * in-memory Stripe in place of api.stripe.com, so the app's Stripe features
 * can be tested end to end without a Stripe account.
 *
 *   node tests/mock-pay-server.mjs   # listens on http://localhost:8787
 *
 * Test helpers (no token needed):
 *   POST /__mock/save-card?customer=cus_1&last4=4242   simulate a customer saving a card
 *   POST /__mock/pay?id=cs_2                          simulate paying a pay-online link
 *   GET  /__mock/log                                  every request sent to "Stripe"
 *   POST /__mock/sms-in?from=+14165550101&body=Hi     a customer texts back (signed like Twilio does)
 *   GET  /__mock/sms-log                              every text "sent" through Twilio
 */
import http from 'node:http';
import { createHmac } from 'node:crypto';
import worker from '../stripe-worker/worker.js';

/* Workers KV, in memory */
const kv = new Map();
const INBOX = {
  async put(k, v) { kv.set(k, v); }, async get(k) { return kv.get(k) ?? null; }, async delete(k) { kv.delete(k); },
  async list({ prefix = '' } = {}) { return { keys: [...kv.keys()].filter(k => k.startsWith(prefix)).sort().map(name => ({ name })), list_complete: true }; },
};
const env = { STRIPE_SECRET_KEY: 'sk_test_mock', APP_TOKEN: 'test-token-123', ALLOWED_ORIGINS: 'http://localhost:8765',
  TWILIO_ACCOUNT_SID: 'ACmock', TWILIO_AUTH_TOKEN: 'twilio-secret', TWILIO_FROM: '+14165550100', INBOX };
const smsLog = [];
const db = { customers: {}, pms: {}, sessions: {}, pis: {}, n: 0 };
const log = [];
const id = p => `${p}_${++db.n}`;
const realFetch = globalThis.fetch;

function stripeFake(method, path, params, headers) {
  log.push({ method, path, params, idem: headers['Idempotency-Key'] || '' });
  const err = (status, error) => ({ status, body: { error } });
  if (headers.Authorization !== 'Bearer sk_test_mock') return err(401, { message: 'Invalid API Key' });
  let m;
  if (path === '/account') return { body: { id: 'acct_mock', business_profile: { name: 'Mock Window Co' }, charges_enabled: true, payouts_enabled: true, country: 'CA', default_currency: 'cad' } };
  if (path === '/customers' && method === 'POST') { const c = { id: id('cus'), name: params.name, invoice_settings: {} }; db.customers[c.id] = c; return { body: c }; }
  if ((m = path.match(/^\/customers\/(cus_\d+)$/))) return db.customers[m[1]] ? { body: db.customers[m[1]] } : err(404, { message: 'No such customer' });
  if (path === '/checkout/sessions' && method === 'POST') {
    if (!params.success_url) return err(400, { message: 'Missing required param: success_url.' });
    const s = { id: id('cs'), mode: params.mode, customer: params.customer || 'cus_new', status: 'open', payment_status: 'unpaid', amount_total: +(params['line_items[0][price_data][unit_amount]'] || 0), url: `https://checkout.stripe.com/c/pay/mock_${db.n}` };
    db.sessions[s.id] = s; return { body: s };
  }
  if ((m = path.match(/^\/checkout\/sessions\/(cs_\d+)$/))) { const s = db.sessions[m[1]]; return s ? { body: { ...s, payment_intent: s.pi ? { id: s.pi, latest_charge: { receipt_url: 'https://pay.stripe.com/receipts/mock' } } : null } } : err(404, { message: 'No such session' }); }
  if (path === '/payment_methods' && method === 'GET') return { body: { data: Object.values(db.pms).filter(p => p.customer === params.customer) } };
  if ((m = path.match(/^\/payment_methods\/(pm_\d+)\/detach$/))) { delete db.pms[m[1]]; return { body: { id: m[1] } }; }
  if (path === '/payment_intents' && method === 'POST') {
    const pm = db.pms[params.payment_method];
    if (!pm || pm.customer !== params.customer) return err(400, { message: 'No such PaymentMethod for this customer', code: 'resource_missing' });
    if (params.off_session !== 'true' || params.confirm !== 'true') return err(400, { message: 'Expected an off-session confirmed charge' });
    if (pm.card.last4 === '0002') return err(402, { message: 'Your card was declined.', code: 'card_declined', decline_code: 'generic_decline', payment_intent: { id: id('pi') } });
    const pi = { id: id('pi'), status: 'succeeded', amount_received: +params.amount, currency: params.currency, latest_charge: { receipt_url: 'https://pay.stripe.com/receipts/mock' } };
    db.pis[pi.id] = pi; return { body: pi };
  }
  if (path === '/refunds' && method === 'POST') {
    const pi = db.pis[params.payment_intent]; if (!pi) return err(400, { message: 'No such payment' });
    return { body: { id: id('re'), status: 'succeeded', amount: +(params.amount || pi.amount_received) } };
  }
  return err(404, { message: `Mock has no route for ${method} ${path}` });
}
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(typeof url === 'string' ? url : url.url);
  if (u.hostname === 'api.twilio.com') {
    const b = Object.fromEntries(new URLSearchParams(opts.body || ''));
    if (opts.headers?.Authorization !== 'Basic ' + btoa('ACmock:twilio-secret')) return new Response(JSON.stringify({ message: 'Authenticate', code: 20003 }), { status: 401 });
    if (b.To === '+14165550199') return new Response(JSON.stringify({ message: 'Attempt to send to unsubscribed recipient', code: 21610 }), { status: 400 });
    smsLog.push(b); return new Response(JSON.stringify({ sid: 'SM' + smsLog.length, status: 'queued' }), { status: 201 });
  }
  if (u.hostname !== 'api.stripe.com') return realFetch(url, opts);
  const method = opts.method || 'GET';
  const params = Object.fromEntries(method === 'GET' ? u.searchParams : new URLSearchParams(opts.body || ''));
  const r = stripeFake(method, u.pathname.replace(/^\/v1/, ''), params, opts.headers || {});
  return new Response(JSON.stringify(r.body), { status: r.status || 200, headers: { 'Content-Type': 'application/json' } });
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8787');
  if (url.pathname.startsWith('/__mock/')) {
    const q = Object.fromEntries(url.searchParams);
    let out = { ok: true };
    if (url.pathname === '/__mock/save-card') {
      const pm = { id: id('pm'), customer: q.customer, card: { brand: q.brand || 'visa', last4: q.last4 || '4242', exp_month: 12, exp_year: 2030 } };
      db.pms[pm.id] = pm; out = pm;
    } else if (url.pathname === '/__mock/pay') {
      const s = db.sessions[q.id]; if (s) { s.status = 'complete'; s.payment_status = 'paid'; s.pi = id('pi'); db.pis[s.pi] = { id: s.pi, amount_received: s.amount_total }; }
      out = s || { error: 'no session' };
    } else if (url.pathname === '/__mock/log') out = log;
    else if (url.pathname === '/__mock/sms-log') out = smsLog;
    else if (url.pathname === '/__mock/sms-in') {
      const params = { From: q.from, Body: q.body, MessageSid: 'SMin' + Date.now(), NumMedia: '0' };
      const hookUrl = 'http://localhost:8787/twilio/inbound';
      const sig = createHmac('sha1', 'twilio-secret').update(hookUrl + Object.keys(params).sort().map(k => k + params[k]).join('')).digest('base64');
      const r = await worker.fetch(new Request(hookUrl, { method: 'POST', body: new URLSearchParams(params).toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': q.badsig ? 'nope' : sig } }), env);
      out = { status: r.status };
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(out)); return;
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const response = await worker.fetch(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
}).listen(8787, () => console.log('mock payment server on http://localhost:8787'));
