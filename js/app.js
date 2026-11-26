/* Business Hub — scheduling, quotes, invoices, income & expenses.
 * Plain JavaScript, no build step. All data is stored in this browser's
 * localStorage; use Settings → Backup to export/import it. */
(() => {
'use strict';

/* =====================================================================
 * Utilities
 * ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (s, n) => { const d = parseD(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); };
const monthStart = s => s.slice(0, 7) + '-01';
const monthEnd = s => { const d = parseD(monthStart(s)); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const fmtDate = s => s ? parseD(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const fmtDateShort = s => s ? parseD(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
const fmtMonth = ym => parseD(ym + '-01').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${(h % 12) || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`; };
const round2 = n => Math.round((+n || 0) * 100) / 100;
const sum = (arr, f = x => x) => round2(arr.reduce((a, x) => a + (+f(x) || 0), 0));
const inRange = (d, from, to) => d && (!from || d >= from) && (!to || d <= to);
const firstName = n => String(n || '').trim().split(/\s+/)[0] || 'there';

function money(n) {
  const cur = db.settings.currency || 'CAD';
  const loc = { CAD: 'en-CA', USD: 'en-US', GBP: 'en-GB', EUR: 'en-IE', AUD: 'en-AU', NZD: 'en-NZ' }[cur];
  try { return new Intl.NumberFormat(loc, { style: 'currency', currency: cur }).format(+n || 0); }
  catch { return '$' + (+n || 0).toFixed(2); }
}
function curSymbol() {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: db.settings.currency || 'CAD', currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(p => p.type === 'currency').value; }
  catch { return '$'; }
}
function moneyShort(n) {
  const a = Math.abs(n), c = curSymbol();
  if (a >= 1e6) return c + +(n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return c + +(n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  return c + Math.round(n);
}

const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  jobs: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  quote: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h4"/>',
  invoice: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  expense: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
  income: '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  reports: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  tag: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  map: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 2 2V2l-2 2-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  funnel: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  todo: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  route: '<path d="M3 11 22 2l-9 19-2-8z"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  statement: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

/* =====================================================================
 * Data store
 * ===================================================================== */
const KEY = 'bizhub.v1';
const DEFAULT_SETTINGS = {
  businessName: '', ownerName: '', email: '', phone: '', address: '', website: '', taxNumber: '', logo: '',
  currency: 'CAD', taxName: 'HST', taxRate: 13,
  invoicePrefix: 'INV-', nextInvoiceNo: 1001, quotePrefix: 'Q-', nextQuoteNo: 1001,
  dueDays: 14, quoteValidDays: 30,
  paymentInstructions: 'Payment accepted by e-Transfer, cash, cheque or credit card.',
  invoiceNotes: 'Thank you for your business!',
  quoteNotes: 'This quote is valid for 30 days. Prices include labour and materials listed above.',
  mileageRate: 0.72, distanceUnit: 'km', theme: 'auto',
  paymentLink: '', reviewLink: '', monthlyGoal: 0, lastBackup: '',
  tplInvoice: 'Hi {first}, here is invoice {number} from {business} for {total}, due {due}.\n\n{items}\n\n{pay}\n\nThank you!\n{signature}',
  tplReminder: 'Hi {first}, a friendly reminder that invoice {number} for {balance} was due {due}.\n\n{pay}\n\nIf you have already paid, please ignore this message. Thank you!\n{signature}',
  tplQuote: 'Hi {first}, thanks for the opportunity! Here is quote {number} from {business} for {total}, valid until {valid}.\n\n{items}\n\nJust reply to let me know if you would like to go ahead and we will get you booked in.\n{signature}',
  tplQuoteFollow: 'Hi {first}, just following up on quote {number} for {total}. Any questions? Reply any time and we can get you on the schedule.\n{signature}',
  tplAppt: 'Hi {first}, this is {business} confirming your appointment on {date}{time}. See you then!',
  tplOnWay: 'Hi {first}, this is {business}. We are on our way and should arrive in about 20 minutes.',
  tplReview: 'Hi {first}, thanks again for choosing {business}! If you were happy with the work, a quick review would mean a lot to us: {review}',
};
const TEMPLATES = [['tplAppt', 'Appointment confirmation'], ['tplOnWay', 'On my way'], ['tplQuote', 'Sending a quote'], ['tplQuoteFollow', 'Quote follow-up'],
  ['tplInvoice', 'Sending an invoice'], ['tplReminder', 'Payment reminder'], ['tplReview', 'Review request']];
const LEAD_SOURCES = ['', 'Referral', 'Google', 'Facebook / Instagram', 'Website', 'Door knocking', 'Door hanger / flyer', 'Repeat customer', 'Other'];
const DEFAULT_CATEGORIES = ['Materials & Supplies', 'Fuel', 'Vehicle Repairs & Maintenance', 'Tools & Equipment', 'Subcontractors',
  'Wages & Payroll', 'Insurance', 'Advertising & Marketing', 'Software & Subscriptions', 'Phone & Internet',
  'Office Supplies', 'Rent & Utilities', 'Meals', 'Licences, Permits & Fees', 'Bank & Payment Fees', 'Professional Fees', 'Other'];
const PAY_METHODS = ['e-Transfer', 'Cash', 'Cheque', 'Credit card', 'Debit', 'Bank transfer', 'Other'];

function blank() {
  return { settings: { ...DEFAULT_SETTINGS }, categories: [...DEFAULT_CATEGORIES], customers: [], services: [], jobs: [],
    quotes: [], invoices: [], expenses: [], incomes: [], mileage: [], leads: [], tasks: [], team: [], timeEntries: [] };
}
function normalize(d) {
  const b = blank();
  const out = { ...b, ...d, settings: { ...b.settings, ...(d.settings || {}) } };
  for (const k of ['customers', 'services', 'jobs', 'quotes', 'invoices', 'expenses', 'incomes', 'mileage', 'categories', 'leads', 'tasks', 'team', 'timeEntries'])
    if (!Array.isArray(out[k])) out[k] = b[k];
  return out;
}
/* Data lives in IndexedDB (hundreds of MB available, so photos are fine).
 * Falls back to localStorage if IndexedDB is unavailable (e.g. some private windows). */
const idb = (() => {
  let conn;
  const open = () => conn ||= new Promise((res, rej) => {
    const r = indexedDB.open('bizhub', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = (mode, fn) => open().then(d => new Promise((res, rej) => {
    const t = d.transaction('kv', mode); const req = fn(t.objectStore('kv'));
    t.oncomplete = () => res(req.result); t.onerror = t.onabort = () => rej(t.error);
  }));
  return { get: k => tx('readonly', st => st.get(k)), set: (k, v) => tx('readwrite', st => st.put(v, k)) };
})();
let storageMode = 'idb';
let db = blank();
async function load() {
  try {
    const stored = await idb.get(KEY);
    if (stored) return normalize(JSON.parse(stored));
    const legacy = localStorage.getItem(KEY); // migrate data saved by the first version
    if (legacy) { await idb.set(KEY, legacy); localStorage.removeItem(KEY); return normalize(JSON.parse(legacy)); }
    return blank();
  } catch {
    storageMode = 'local';
    try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch { /* ignore */ }
    return blank();
  }
}
let saveChain = Promise.resolve();
function save() {
  const snapshot = JSON.stringify(db);
  if (storageMode === 'local') {
    try { localStorage.setItem(KEY, snapshot); }
    catch { toast('Could not save — storage is full. Download a backup and remove some photos.'); }
    return;
  }
  saveChain = saveChain.then(() => idb.set(KEY, snapshot)).catch(() => toast('Could not save your last change — please download a backup from Settings.'));
}

const byId = (coll, id) => db[coll].find(x => x.id === id);
const cust = id => byId('customers', id);
const custName = id => cust(id)?.name || '—';

function nextNumber(kind) {
  const s = db.settings, isInv = kind === 'invoice';
  const coll = isInv ? db.invoices : db.quotes, key = isInv ? 'nextInvoiceNo' : 'nextQuoteNo', prefix = isInv ? s.invoicePrefix : s.quotePrefix;
  let n;
  do { n = prefix + (s[key]++); } while (coll.some(x => x.number === n)); // never reuse a number
  return n;
}

/* ----- customer message templates ----- */
function fillTemplate(key, vars) {
  const s = db.settings;
  const pay = [s.paymentInstructions, s.paymentLink && `Pay online: ${s.paymentLink}`].filter(Boolean).join('\n');
  const all = { business: s.businessName || 'us', signature: [s.ownerName || s.businessName, s.businessName && s.ownerName ? s.businessName : '', s.phone].filter(Boolean).join('\n'),
    pay, review: s.reviewLink || '', ...vars };
  return String(s[key] || DEFAULT_SETTINGS[key] || '').replace(/\{(\w+)\}/g, (m, k) => all[k] ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
function custVars(c) { return { customer: c?.name || '', first: firstName(c?.name) }; }
const smsHref = (phone, text) => `sms:${encodeURIComponent(phone || '')}${text ? '?&body=' + encodeURIComponent(text) : ''}`;
const mailHref = (email, subject, body) => `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/* ----- money maths ----- */
function totals(doc) {
  let sub = 0, taxable = 0;
  for (const it of doc.items || []) {
    const line = (+it.qty || 0) * (+it.price || 0);
    sub += line; if (it.taxable !== false) taxable += line;
  }
  const disc = Math.min(Math.max(+doc.discount || 0, 0), sub);
  const taxBase = sub ? taxable - disc * (taxable / sub) : 0;
  const rate = doc.taxRate === undefined || doc.taxRate === '' ? +db.settings.taxRate : +doc.taxRate;
  const tax = round2(taxBase * (rate || 0) / 100);
  return { sub: round2(sub), disc: round2(disc), tax, rate: rate || 0, total: round2(sub - disc + tax) };
}
const paidAmt = inv => sum(inv.payments || [], p => p.amount);
const balance = inv => inv.void ? 0 : round2(totals(inv).total - paidAmt(inv));
function invStatus(inv) {
  if (inv.void) return 'void';
  const t = totals(inv).total, p = paidAmt(inv);
  if (t > 0 && p >= t - 0.005) return 'paid';
  if (!inv.sent && p === 0) return 'draft';
  if (inv.dueDate && inv.dueDate < today()) return 'overdue';
  return p > 0 ? 'partial' : 'sent';
}
const isOpenInv = inv => ['sent', 'partial', 'overdue'].includes(invStatus(inv));
const jobValue = j => j.invoiceId && byId('invoices', j.invoiceId) ? totals(byId('invoices', j.invoiceId)).total : totals(j).total;

const BADGE = {
  draft: '', sent: 'info', partial: 'warn', paid: 'good', overdue: 'bad', void: '',
  approved: 'good', declined: 'bad', converted: 'good', expired: 'warn',
  scheduled: 'info', in_progress: 'warn', completed: 'good', cancelled: '',
};
const badge = s => `<span class="badge ${BADGE[s] || ''}">${esc(String(s).replace('_', ' '))}</span>`;
function quoteStatus(q) {
  if (['approved', 'declined', 'converted'].includes(q.status)) return q.status;
  if (q.status === 'sent' && q.validUntil && q.validUntil < today()) return 'expired';
  return q.status || 'draft';
}

function incomeEntries() {
  const out = [];
  for (const inv of db.invoices) {
    if (inv.void) continue;
    for (const p of inv.payments || []) out.push({ id: p.id, date: p.date, amount: +p.amount, method: p.method, note: p.note,
      source: `Invoice ${inv.number}`, customerId: inv.customerId, invoiceId: inv.id, kind: 'payment' });
  }
  for (const i of db.incomes) out.push({ ...i, amount: +i.amount, kind: 'other' });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/* ----- periods ----- */
const PERIODS = { this_month: 'This month', last_month: 'Last month', this_quarter: 'This quarter', last_quarter: 'Last quarter',
  ytd: 'Year to date', last_year: 'Last year', last_12: 'Last 12 months', all: 'All time', custom: 'Custom…' };
function periodRange(key, custom = {}) {
  const t = today(), y = +t.slice(0, 4), m = +t.slice(5, 7);
  const q = Math.floor((m - 1) / 3);
  switch (key) {
    case 'this_month': return [monthStart(t), monthEnd(t)];
    case 'last_month': { const s = addMonths(monthStart(t), -1); return [s, monthEnd(s)]; }
    case 'this_quarter': { const s = `${y}-${pad(q * 3 + 1)}-01`; return [s, monthEnd(addMonths(s, 2))]; }
    case 'last_quarter': { const s = addMonths(`${y}-${pad(q * 3 + 1)}-01`, -3); return [s, monthEnd(addMonths(s, 2))]; }
    case 'ytd': return [`${y}-01-01`, t];
    case 'last_year': return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case 'last_12': return [addMonths(monthStart(t), -11), monthEnd(t)];
    case 'custom': return [custom.from || '', custom.to || ''];
    default: return ['', ''];
  }
}
function monthsInRange(from, to) {
  if (!from) {
    const dates = [...incomeEntries().map(x => x.date), ...db.expenses.map(x => x.date)].sort();
    from = dates[0] || addMonths(today(), -5);
  }
  if (!to) to = today();
  const out = []; let c = monthStart(from);
  while (c <= to && out.length < 36) { out.push(c.slice(0, 7)); c = addMonths(c, 1); }
  return out.slice(-24);
}
const periodSelect = (val, name = 'period') =>
  `<select name="${name}" data-filter="${name}">${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${v}</option>`).join('')}</select>`;

/* =====================================================================
 * UI helpers: toast, modal, forms
 * ===================================================================== */
let toastTimer;
function toast(msg, action) {
  $('.toast')?.remove(); clearTimeout(toastTimer);
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  el.append(msg);
  if (action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label;
    b.onclick = () => { el.remove(); action.fn(); }; el.append(b);
  }
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), action ? 7000 : 2800);
}

function modal({ title, body, wide = false, submitLabel = 'Save', onSubmit, onMount, footExtra = '', noFoot = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<form class="modal ${wide ? 'wide' : ''}" autocomplete="off" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="btn btn-icon" data-close aria-label="Close">✕</button></div>
    <div class="modal-body">${body}</div>
    ${noFoot ? '' : `<div class="modal-foot">${footExtra}<span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary" type="submit">${esc(submitLabel)}</button></div>`}
  </form>`;
  $('#modalRoot').append(wrap);
  const form = $('form', wrap);
  let dirty = false;
  const close = () => wrap.remove();
  const requestClose = () => { if (!dirty || confirm('Discard your changes?')) close(); };
  wrap._requestClose = requestClose;
  form.addEventListener('input', e => { if (!e.target.closest('[data-nodirty]')) dirty = true; });
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) requestClose(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (onSubmit?.(form, Object.fromEntries(new FormData(form))) !== false) close();
  });
  onMount?.(form, close);
  // Focus the first field, unless the person has already clicked into another one.
  const first = $('input:not([type=hidden]):not([type=file]),select,textarea', form);
  first?.focus();
  setTimeout(() => { if (!form.contains(document.activeElement)) first?.focus(); }, 30);
  return { form, close };
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#modalRoot .modal-backdrop:last-child')?._requestClose(); return; }
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing && !$('#modalRoot').children.length)) { e.preventDefault(); openSearch(); }
});

const field = (label, input, cls = '') => `<div class="field ${cls}"><label>${label}</label>${input}</div>`;
const inp = (name, val = '', attrs = '') => `<input name="${name}" value="${esc(val)}" ${attrs}>`;
const opts = (list, sel) => list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`; }).join('');

function customerSelect(selected) {
  const list = [...db.customers].sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="row" style="flex-wrap:nowrap"><select name="customerId" required class="js-cust-select">
    <option value="">Select customer…</option>${list.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
  </select><button type="button" class="btn btn-sm js-new-cust">+ New</button></div>`;
}
function bindCustomerSelect(form, onPick) {
  const sel = $('.js-cust-select', form);
  $('.js-new-cust', form)?.addEventListener('click', () => customerForm(null, c => {
    sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.name)}</option>`);
    sel.value = c.id; onPick?.(c);
  }));
  sel?.addEventListener('change', () => onPick?.(cust(sel.value)));
}

/* ----- line item editor (quotes, invoices, jobs) ----- */
function itemsEditorHTML(doc) {
  return `<div class="table-wrap"><table class="items-table">
    <thead><tr><th>Item / description</th><th class="num">Qty</th><th class="num">Price</th><th title="Taxable">Tax</th><th class="num">Amount</th><th></th></tr></thead>
    <tbody class="js-items"></tbody></table></div>
    <div class="row" style="margin-top:8px"><button type="button" class="btn btn-sm js-add-item">+ Add line</button>
    ${db.services.length ? '<span class="muted small">Tip: start typing to pick from your price book</span>' : ''}</div>
    <datalist id="svcList">${db.services.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist>
    <div class="form-grid" style="margin-top:12px">
      ${field('Discount ($)', inp('discount', doc.discount || '', 'type="number" step="0.01" min="0"'))}
      ${field(`Tax rate (%) — ${esc(db.settings.taxName)}`, inp('taxRate', doc.taxRate ?? db.settings.taxRate, 'type="number" step="0.001" min="0"'))}
    </div>
    <div class="totals js-totals"></div>`;
}
function mountItemsEditor(form, doc) {
  const blankItem = () => ({ desc: '', qty: 1, price: '', taxable: true });
  const items = (doc.items || []).map(x => ({ ...x }));
  if (!items.length) items.push(blankItem());
  const tb = $('.js-items', form), tot = $('.js-totals', form);
  const lineAmt = it => money((+it.qty || 0) * (+it.price || 0));
  function drawTotals() {
    const t = totals({ items, discount: form.discount.value, taxRate: form.taxRate.value });
    tot.innerHTML = `<div><span>Subtotal</span><span>${money(t.sub)}</span></div>
      ${t.disc ? `<div><span>Discount</span><span>−${money(t.disc)}</span></div>` : ''}
      <div><span>${esc(db.settings.taxName)} (${t.rate}%)</span><span>${money(t.tax)}</span></div>
      <div class="grand"><span>Total</span><span>${money(t.total)}</span></div>`;
  }
  function draw() {
    tb.innerHTML = items.map((it, i) => `<tr data-i="${i}">
      <td><input list="svcList" data-k="desc" value="${esc(it.desc)}" placeholder="Service or product" aria-label="Item">
        <input class="details" data-k="details" value="${esc(it.details || '')}" placeholder="Details (optional)" aria-label="Item details"></td>
      <td><input class="qty right" type="number" step="any" data-k="qty" value="${esc(it.qty)}"></td>
      <td><input class="price right" type="number" step="0.01" data-k="price" value="${esc(it.price)}" placeholder="0.00"></td>
      <td class="tx"><input type="checkbox" data-k="taxable" ${it.taxable !== false ? 'checked' : ''}></td>
      <td class="num js-line">${lineAmt(it)}</td>
      <td class="item-ctl">${items.length > 1 ? `<button type="button" class="btn btn-icon" data-up="${i}" aria-label="Move up" ${i ? '' : 'disabled'}>↑</button>` : ''}<button type="button" class="btn btn-icon" data-rm="${i}" aria-label="Remove line">✕</button></td></tr>`).join('');
    drawTotals();
  }
  tb.addEventListener('input', e => {
    const tr = e.target.closest('tr'), k = e.target.dataset.k; if (!tr || !k) return;
    const it = items[+tr.dataset.i];
    it[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k === 'desc') {
      const s = db.services.find(s => s.name === it.desc);
      if (s) {
        it.price = s.price; it.taxable = s.taxable !== false; $('[data-k=price]', tr).value = s.price; $('[data-k=taxable]', tr).checked = it.taxable;
        if (s.description && !it.details) { it.details = s.description; $('[data-k=details]', tr).value = s.description; }
      }
    }
    $('.js-line', tr).textContent = lineAmt(it); drawTotals();
  });
  tb.addEventListener('click', e => {
    const b = e.target.closest('[data-rm]'), u = e.target.closest('[data-up]');
    if (b) { items.splice(+b.dataset.rm, 1); if (!items.length) items.push(blankItem()); draw(); }
    if (u && +u.dataset.up > 0) { const i = +u.dataset.up; [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); }
  });
  $('.js-add-item', form).addEventListener('click', () => { items.push(blankItem()); draw(); $$('[data-k=desc]', tb).pop()?.focus(); });
  form.discount.addEventListener('input', drawTotals);
  form.taxRate.addEventListener('input', drawTotals);
  draw();
  return () => items.filter(it => String(it.desc).trim() || +it.price)
    .map(it => ({ desc: String(it.desc).trim(), details: String(it.details || '').trim(), qty: +it.qty || 0, price: round2(it.price), taxable: it.taxable !== false }));
}

function itemsTable(doc, { compact = false } = {}) {
  const t = totals(doc);
  if (!(doc.items || []).length) return '<p class="muted small">No line items.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead><tbody>
    ${doc.items.map(it => `<tr><td>${esc(it.desc)}${it.taxable === false && t.rate ? ' <span class="muted small">(no tax)</span>' : ''}</td><td class="num">${+it.qty}</td><td class="num">${money(it.price)}</td><td class="num">${money(it.qty * it.price)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="totals"><div><span>Subtotal</span><span>${money(t.sub)}</span></div>
    ${t.disc ? `<div><span>Discount</span><span>−${money(t.disc)}</span></div>` : ''}
    ${t.rate || !compact ? `<div><span>${esc(db.settings.taxName)} (${t.rate}%)</span><span>${money(t.tax)}</span></div>` : ''}
    <div class="grand"><span>Total</span><span>${money(t.total)}</span></div></div>`;
}

/* ----- image resize (logo / receipts) ----- */
function readImage(file, maxDim = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function download(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csv(rows) {
  return rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
}

/* ----- undo ----- */
const snapshot = () => JSON.stringify(db);
function undoToast(snap, msg) {
  toast(msg, { label: 'Undo', fn: () => { db = normalize(JSON.parse(snap)); refresh(); toast('Restored'); } });
}

/* ----- small menus ("More ▾") ----- */
function moreMenu(items, label = 'More') {
  const html = items.filter(Boolean).join('');
  if (!html) return '';
  return `<div class="menu-wrap"><button type="button" class="btn" data-menu aria-haspopup="true" aria-expanded="false">${icon('more')}${label}</button><div class="menu" role="menu">${html}</div></div>`;
}
const menuItem = (label, act, data = '', ic = '', cls = '') => `<button type="button" class="menu-item ${cls}" role="menuitem" data-act="${act}" ${data}>${ic ? icon(ic) : ''}${label}</button>`;
const menuLink = (label, href, ic = '') => `<a class="menu-item" role="menuitem" href="${href}">${ic ? icon(ic) : ''}${label}</a>`;
document.addEventListener('click', e => {
  const t = e.target.closest('[data-menu]');
  $$('.menu-wrap.open').forEach(w => { if (!t || w !== t.parentElement) { w.classList.remove('open'); $('[data-menu]', w).setAttribute('aria-expanded', 'false'); } });
  if (t) { const w = t.parentElement; const open = w.classList.toggle('open'); t.setAttribute('aria-expanded', String(open)); e.stopPropagation(); }
}, true);

/* ----- phone numbers: tidy to 416-555-1234 when leaving the field ----- */
function formatPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  return String(v || '').trim();
}
document.addEventListener('focusout', e => { if (e.target.matches?.('input[type=tel]')) e.target.value = formatPhone(e.target.value); });

/* ----- address autocomplete (OpenStreetMap / Photon, free, no key) ----- */
const PROV = { Ontario: 'ON', Quebec: 'QC', 'British Columbia': 'BC', Alberta: 'AB', Manitoba: 'MB', Saskatchewan: 'SK', 'Nova Scotia': 'NS',
  'New Brunswick': 'NB', 'Newfoundland and Labrador': 'NL', 'Prince Edward Island': 'PE', Yukon: 'YT', 'Northwest Territories': 'NT', Nunavut: 'NU',
  'New York': 'NY', Michigan: 'MI', California: 'CA', Texas: 'TX', Florida: 'FL', Ohio: 'OH', Pennsylvania: 'PA', Illinois: 'IL', Washington: 'WA' };
function formatAddress(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ') || p.name || '';
  const region = [PROV[p.state] || p.state, p.postcode].filter(Boolean).join(' ');
  return [street, p.city || p.town || p.village || p.district, region].filter(Boolean).join(', ');
}
let addrTimer, addrSeq = 0;
const addrCache = new Map();
async function addressSuggestions(q) {
  const key = q.toLowerCase();
  if (addrCache.has(key)) return addrCache.get(key);
  const [lat, lon] = (db.settings.mapCenter || '43.70,-79.42').split(',').map(Number);
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&lat=${lat}&lon=${lon}&layer=house&layer=street`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('lookup failed');
  const data = await res.json();
  const seen = new Set();
  const list = (data.features || []).map(f => f.properties)
    .filter(p => ['CA', 'US'].includes(p.countrycode) && (p.street || p.housenumber || p.type === 'street'))
    .map(p => ({ text: formatAddress(p), sub: p.name && p.housenumber ? p.name : '', lat: 0 }))
    .filter(x => x.text && !seen.has(x.text) && seen.add(x.text)).slice(0, 5);
  addrCache.set(key, list);
  return list;
}
function closeAddr() { $$('.addr-menu').forEach(m => m.remove()); }
function showAddr(input, list) {
  closeAddr();
  if (!list.length || document.activeElement !== input) return;
  const m = document.createElement('div'); m.className = 'addr-menu'; m.setAttribute('role', 'listbox');
  m.innerHTML = list.map((x, i) => `<button type="button" role="option" class="addr-opt ${i === 0 ? 'active' : ''}" data-v="${esc(x.text)}">${icon('map')}<span>${esc(x.text)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span></button>`).join('') +
    '<div class="addr-attr">Addresses © OpenStreetMap</div>';
  input.parentElement.append(m);
  m.addEventListener('mousedown', e => e.preventDefault()); // keep focus in the input
  m.addEventListener('click', e => { const b = e.target.closest('.addr-opt'); if (b) pickAddr(input, b.dataset.v); });
}
function pickAddr(input, v) {
  input.value = v; closeAddr();
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dataset.picked = v;
}
document.addEventListener('input', e => {
  const input = e.target; if (!input.matches?.('[data-address]')) return;
  if (input.dataset.picked === input.value) return;
  clearTimeout(addrTimer);
  const q = input.value.trim();
  if (q.length < 4) { closeAddr(); return; }
  const seq = ++addrSeq;
  addrTimer = setTimeout(async () => {
    try { const list = await addressSuggestions(q); if (seq === addrSeq) showAddr(input, list); } catch { closeAddr(); }
  }, 280);
});
document.addEventListener('keydown', e => {
  const input = e.target; if (!input.matches?.('[data-address]')) return;
  const m = $('.addr-menu', input.parentElement); if (!m) return;
  const opts = $$('.addr-opt', m), i = opts.findIndex(o => o.classList.contains('active'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); opts[i]?.classList.remove('active');
    opts[(i + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length].classList.add('active');
  } else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); pickAddr(input, opts[i].dataset.v); }
  else if (e.key === 'Escape') { e.stopPropagation(); closeAddr(); }
}, true);
document.addEventListener('focusout', e => { if (e.target.matches?.('[data-address]')) setTimeout(closeAddr, 150); });
const addrInput = (name, val = '', extra = '') => inp(name, val, `data-address autocomplete="off" placeholder="Start typing an address…" ${extra}`);

/* ----- repeating schedules ----- */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** rule: { freq: 'day'|'week'|'month', interval, weekdays: [0-6], count, until } */
function recurDates(start, rule, max = 156) {
  const out = [], interval = Math.max(1, +rule.interval || 1);
  const count = rule.until ? max : Math.min(max, Math.max(1, +rule.count || 1));
  const ok = d => !rule.until || d <= rule.until;
  if (rule.freq === 'week') {
    const days = (rule.weekdays?.length ? rule.weekdays : [parseD(start).getDay()]).map(Number).sort();
    let weekStart = addDays(start, -parseD(start).getDay());
    for (let w = 0; out.length < count && w < 600; w += interval) {
      for (const wd of days) {
        const d = addDays(weekStart, wd);
        if (d >= start && ok(d) && out.length < count) out.push(d);
      }
      weekStart = addDays(weekStart, 7 * interval);
      if (rule.until && weekStart > rule.until) break;
    }
  } else {
    for (let k = 0; out.length < count && k < 1000; k++) {
      const d = rule.freq === 'month' ? addMonths(start, k * interval) : addDays(start, k * interval);
      if (!ok(d)) break;
      out.push(d);
    }
  }
  return out;
}
function ruleLabel(r) {
  if (!r) return 'Repeating';
  const n = +r.interval || 1, unit = { day: 'day', week: 'week', month: 'month' }[r.freq];
  let s = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
  if (r.freq === 'week' && r.weekdays?.length) s += ' on ' + r.weekdays.map(d => WEEKDAYS[d]).join(', ');
  if (r.freq === 'month' && n === 3) s = 'Every 3 months';
  return s;
}
/** Approximate visits per month, for recurring revenue. */
const visitsPerMonth = r => !r ? 0 : r.freq === 'day' ? 30.4 / (+r.interval || 1)
  : r.freq === 'week' ? (r.weekdays?.length || 1) * 4.345 / (+r.interval || 1) : 1 / (+r.interval || 1);

/* ----- lead stages (editable, like pipelines) ----- */
const DEFAULT_LEAD_STAGES = [{ id: 'new', label: 'New' }, { id: 'contacted', label: 'Contacted' }, { id: 'quoted', label: 'Quoted' }];
const openStages = () => (db.settings.leadStages?.length ? db.settings.leadStages : DEFAULT_LEAD_STAGES);
const leadStages = () => [...openStages().map(s => [s.id, s.label]), ['won', 'Won'], ['lost', 'Lost']];
const firstStage = () => openStages()[0].id;
const stageLabel = id => leadStages().find(s => s[0] === id)?.[1] || id;

/* ----- team ----- */
const TEAM_COLORS = ['#257de0', '#f47230', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#6a4ce2', '#eb6263'];
const memberByName = name => db.team.find(m => m.name.toLowerCase() === String(name || '').trim().toLowerCase());
const memberColor = name => memberByName(name)?.color || '';
const openEntry = mid => db.timeEntries.find(t => t.memberId === mid && !t.out);
const hoursOf = t => Math.max(0, ((t.out ? new Date(t.out) : new Date()) - new Date(t.in)) / 36e5 - (+t.breakMin || 0) / 60);
const fmtHours = h => `${Math.floor(h)}h ${pad(Math.round((h % 1) * 60) % 60)}m`;
const fmtClock = isoStr => new Date(isoStr).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const localDate = isoStr => iso(new Date(isoStr));

/* =====================================================================
 * Charts
 * ===================================================================== */
function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 6 ? 6 : n <= 8 ? 8 : 10) * p; // divides cleanly into 4 ticks
}
function barPath(x, y, w, h) {
  if (h <= 0.5) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
/** rows: [{label, inc, exp}] — grouped bars, income vs expenses. */
function incExpChart(rows) {
  const W = 640, H = 230, pl = 48, pr = 6, pt = 10, pb = 26;
  const max = niceMax(Math.max(0, ...rows.flatMap(r => [r.inc, r.exp])));
  const ih = H - pt - pb, cw = (W - pl - pr) / rows.length;
  const bw = Math.max(4, Math.min(26, (cw - 14) / 2));
  const y = v => pt + ih - (v / max) * ih;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, yy = y(v);
    g += `<line class="gridline" x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text class="axis-label" x="${pl - 8}" y="${yy + 4}" text-anchor="end">${moneyShort(v)}</text>`;
  }
  rows.forEach((r, i) => {
    const cx = pl + i * cw + cw / 2, x0 = cx - bw - 1;
    g += `<path d="${barPath(x0, y(r.inc), bw, ih + pt - y(r.inc))}" fill="var(--series-1)"/>`;
    g += `<path d="${barPath(x0 + bw + 2, y(r.exp), bw, ih + pt - y(r.exp))}" fill="var(--series-2)"/>`;
    if (rows.length <= 12 || i % 2 === 0) g += `<text class="axis-label" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(r.label)}</text>`;
    const tip = `<b>${esc(r.label)}</b><br>Income ${money(r.inc)}<br>Expenses ${money(r.exp)}<br>Net ${money(r.inc - r.exp)}`;
    g += `<rect x="${pl + i * cw}" y="${pt}" width="${cw}" height="${ih}" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  const table = `<details class="small" style="margin-top:8px"><summary class="muted">Show as table</summary><div class="table-wrap"><table>
    <thead><tr><th>Month</th><th class="num">Income</th><th class="num">Expenses</th><th class="num">Net</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r.label)}</td><td class="num">${money(r.inc)}</td><td class="num">${money(r.exp)}</td><td class="num">${money(r.inc - r.exp)}</td></tr>`).join('')}</tbody></table></div></details>`;
  return `<div class="legend"><span><i style="background:var(--series-1)"></i>Income</span><span><i style="background:var(--series-2)"></i>Expenses</span></div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and expenses by month">${g}</svg></div>${table}`;
}
function monthlyRows(months) {
  const inc = {}, exp = {};
  for (const e of incomeEntries()) inc[e.date.slice(0, 7)] = (inc[e.date.slice(0, 7)] || 0) + e.amount;
  for (const e of db.expenses) exp[e.date.slice(0, 7)] = (exp[e.date.slice(0, 7)] || 0) + (+e.amount || 0);
  return months.map(m => ({ label: fmtMonth(m), inc: round2(inc[m] || 0), exp: round2(exp[m] || 0) }));
}
function hbars(rows, total) {
  if (!rows.length) return '<p class="empty small">Nothing to show for this period.</p>';
  const max = Math.max(...rows.map(r => r.value));
  return rows.map(r => `<div class="hbar"><span class="lbl" title="${esc(r.label)}">${esc(r.label)}</span>
    <div class="track"><div class="fill" style="width:${(r.value / max * 100).toFixed(1)}%"></div></div>
    <span class="num">${money(r.value)}${total ? ` <span class="muted small">${Math.round(r.value / total * 100)}%</span>` : ''}</span></div>`).join('');
}
// chart tooltips
document.addEventListener('mousemove', e => {
  const t = e.target.closest?.('[data-tip]'); const chart = e.target.closest?.('.chart');
  let tip = chart && $('.tip', chart);
  if (!t || !chart) { $$('.chart .tip').forEach(x => x.remove()); return; }
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; chart.append(tip); }
  tip.innerHTML = t.dataset.tip;
  const r = chart.getBoundingClientRect();
  tip.style.left = Math.min(Math.max(e.clientX - r.left, 70), r.width - 70) + 'px';
  tip.style.top = (e.clientY - r.top - 8) + 'px';
});

/* =====================================================================
 * Navigation / routing
 * ===================================================================== */
const NAV = [
  ['dashboard', 'Dashboard', 'home'],
  ['label', 'Work'], ['schedule', 'Schedule', 'calendar'], ['jobs', 'Jobs', 'jobs'], ['plans', 'Recurring', 'repeat'], ['tasks', 'To-dos', 'todo'],
  ['label', 'Sales'], ['leads', 'Leads', 'funnel'], ['customers', 'Customers', 'users'], ['quotes', 'Quotes', 'quote'], ['invoices', 'Invoices', 'invoice'],
  ['label', 'Money'], ['income', 'Income', 'income'], ['expenses', 'Expenses', 'expense'], ['reports', 'Reports', 'reports'],
  ['label', 'Business'], ['team', 'Team & time', 'clock'], ['services', 'Price book', 'tag'], ['settings', 'Settings', 'settings'],
];
const BOTTOM_NAV = [['dashboard', 'Home', 'home'], ['schedule', 'Schedule', 'calendar'], ['jobs', 'Jobs', 'jobs'], ['invoices', 'Invoices', 'invoice']];
const state = { calMonth: today().slice(0, 7), calDay: today(), calView: 'month', calTeam: '', filters: {}, loaded: false };
const filt = (view, key, def) => (state.filters[view] ||= {})[key] ?? def;

function renderChrome() {
  const s = db.settings;
  $$('.js-bizname').forEach(el => el.textContent = s.businessName || 'Business Hub');
  $$('.js-logo').forEach(el => el.innerHTML = s.logo ? `<img src="${s.logo}" alt="">` : esc((s.businessName || 'B')[0].toUpperCase()));
  let cur = (location.hash.split('/')[1] || 'dashboard');
  if (cur === 'statement') cur = 'customers';
  const counts = { leads: db.leads.filter(l => l.stage === firstStage()).length,
    tasks: db.tasks.filter(t => !t.done && t.due && t.due <= today()).length };
  $('#nav').innerHTML = `<button class="search-btn" data-act="openSearch">${icon('search')}<span>Search</span><kbd>Ctrl K</kbd></button>` +
    NAV.map(([k, l, ic]) => k === 'label' ? `<div class="nav-label">${l}</div>` :
    `<a href="#/${k}" class="${cur === k ? 'active' : ''}">${icon(ic)}<span>${l}</span>${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</a>`).join('');
  $('#bottomNav').innerHTML = BOTTOM_NAV.map(([k, l, ic]) => `<a href="#/${k}" class="${cur === k ? 'active' : ''}">${icon(ic)}<span>${l}</span></a>`).join('') +
    `<button data-act="openMenu" class="${BOTTOM_NAV.some(b => b[0] === cur) ? '' : 'active'}">${icon('more')}<span>More</span></button>`;
  const theme = s.theme === 'auto' ? null : s.theme;
  if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
}

function render() {
  if (!state.loaded) return;
  const [, name = 'dashboard', id] = (location.hash || '#/dashboard').split('/');
  const view = VIEWS[name] || VIEWS.dashboard;
  renderChrome();
  $('#sidebar').classList.remove('open'); $('.scrim')?.remove();
  const html = view(id ? decodeURIComponent(id) : undefined);
  if (html !== undefined) $('#main').innerHTML = html + fab(name);
  document.title = (db.settings.businessName || 'Business Hub');
}
const fab = name => {
  const map = { dashboard: 'newJob', schedule: 'newJob', jobs: 'newJob', customers: 'newCustomer', quotes: 'newQuote',
    invoices: 'newInvoice', expenses: 'newExpense', income: 'newIncome', services: 'newService', leads: 'newLead', tasks: 'newTask', plans: 'newJob', team: 'newMember' };
  return map[name] ? `<button class="fab no-print" data-act="${map[name]}" aria-label="Add">${icon('plus')}</button>` : '';
};
const go = h => { if (location.hash === h) render(); else location.hash = h; };
const refresh = () => { save(); render(); };
const head = (title, actions = '', sub = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<div class="muted small">${sub}</div>` : ''}</div><div class="actions">${actions}</div></div>`;
const btn = (label, act, cls = '', data = '', ic = '') => `<button class="btn ${cls}" data-act="${act}" ${data}>${ic ? icon(ic) : ''}${label}</button>`;
const empty = (ic, msg, action = '') => `<div class="empty">${icon(ic)}<div>${msg}</div>${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;
const tabsHTML = (view, key, list, cur) => `<div class="tabs">${list.map(([k, l]) => `<button data-tab="${view}:${key}:${k}" class="${k === cur ? 'active' : ''}">${l}</button>`).join('')}</div>`;

/* =====================================================================
 * Views
 * ===================================================================== */
const VIEWS = {};

/* ---------- Dashboard ---------- */
VIEWS.dashboard = () => {
  const s = db.settings, t = today();
  const [m0, m1] = periodRange('this_month');
  const [l0, l1] = periodRange('last_month');
  const inc = sum(incomeEntries().filter(x => inRange(x.date, m0, m1)), x => x.amount);
  const incLast = sum(incomeEntries().filter(x => inRange(x.date, l0, l1)), x => x.amount);
  const exp = sum(db.expenses.filter(x => inRange(x.date, m0, m1)), x => x.amount);
  const open = db.invoices.filter(isOpenInv);
  const overdue = open.filter(i => invStatus(i) === 'overdue');
  const ar = sum(open, balance);
  const upcoming = db.jobs.filter(j => ['scheduled', 'in_progress'].includes(j.status) && inRange(j.date, t, addDays(t, 7)))
    .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
  const todayCount = upcoming.filter(j => j.date === t).length;
  const staleQuotes = db.quotes.filter(q => q.status === 'sent' && q.sentAt && daysBetween(q.sentAt, t) >= 3 && quoteStatus(q) !== 'expired');
  const uninvoiced = db.jobs.filter(j => j.status === 'completed' && !j.invoiceId && !j.noInvoice);
  const lateJobs = db.jobs.filter(j => j.status === 'scheduled' && j.date && j.date < t);
  const newLeads = db.leads.filter(l => l.stage === firstStage());
  const dueTasks = db.tasks.filter(x => !x.done && (!x.due || x.due <= addDays(t, 1))).sort(taskSort);
  const followUps = db.leads.filter(l => !['won', 'lost'].includes(l.stage) && l.followUp && l.followUp <= t);
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const isEmpty = !db.customers.length && !db.invoices.length && !db.jobs.length && !db.leads.length;
  const hasData = db.customers.length + db.jobs.length + db.invoices.length > 0;
  const needsBackup = hasData && (!s.lastBackup || daysBetween(s.lastBackup, t) >= 14);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const setupSteps = [
    [!!s.businessName, 'Add your business name and logo', '#/settings'],
    [db.services.length > 0, 'Add your services to the price book', '#/services'],
    [db.customers.length > 0, 'Add your first customer', '#/customers'],
    [db.quotes.length + db.invoices.length > 0, 'Send your first quote or invoice', '#/quotes'],
  ];
  const setupLeft = setupSteps.filter(x => !x[0]).length;
  const welcome = isEmpty ? `<div class="card" style="margin-bottom:16px"><h2>Welcome! Let’s get your business set up 👋</h2>
    <p class="muted">Add your business details and logo so they appear on quotes and invoices, then add your first customer.
    Want to look around first? Load sample data. You can erase it any time from Settings.</p>
    <div class="row"><a class="btn btn-primary" href="#/settings">Set up my business</a>${btn('Add a customer', 'newCustomer')}${btn('Load sample data', 'loadSample')}</div></div>`
    : setupLeft && !s.hideSetup ? `<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Getting started · ${4 - setupLeft} of 4 done</h2>${btn('Hide', 'hideSetup', 'btn-sm')}</div>
      <div class="progress" style="margin-bottom:10px"><i style="width:${(4 - setupLeft) * 25}%"></i></div>
      ${setupSteps.map(([done, label, href]) => `<a class="setup-step ${done ? 'done' : ''}" href="${href}">${icon(done ? 'check' : 'plus')}<span>${label}</span></a>`).join('')}</div>` : '';

  const attn = [
    overdue.length && ['bad', 'alert', `${plural(overdue.length, 'overdue invoice')}`, `${money(sum(overdue, balance))} owed. Send a reminder.`, '#/invoices', 'invoices:tab:overdue'],
    newLeads.length && ['info', 'funnel', `${plural(newLeads.length, 'new lead')}`, 'Waiting for you to get in touch', '#/leads'],
    uninvoiced.length && ['warn', 'invoice', `${plural(uninvoiced.length, 'job')} to invoice`, 'Completed but not billed yet', '#/jobs', 'jobs:tab:uninvoiced'],
    staleQuotes.length && ['info', 'quote', `${plural(staleQuotes.length, 'quote')} to follow up`, 'Sent 3+ days ago with no answer', '#/quotes'],
    lateJobs.length && ['warn', 'calendar', `${plural(lateJobs.length, 'past job')} still open`, 'Mark them complete or reschedule', '#/jobs', 'jobs:tab:late'],
    needsBackup && ['warn', 'download', 'Back up your data', s.lastBackup ? `Last backup ${fmtDate(s.lastBackup)}` : 'No backup yet. Tap to save one.', '', '', 'exportBackup'],
  ].filter(Boolean);
  const attnHTML = attn.map(([tone, ic, title, sub, href, tabset, act]) => {
    const inner = `<span class="attn-ic ${tone}">${icon(ic)}</span><span class="grow"><b>${title}</b><span class="muted small">${sub}</span></span><span class="chev">›</span>`;
    return act ? `<button class="attn-row" data-act="${act}">${inner}</button>` : `<a class="attn-row" href="${href}" ${tabset ? `data-tabset="${tabset}"` : ''}>${inner}</a>`;
  }).join('');
  const onClock = db.team.filter(m => openEntry(m.id));

  const delta = incLast ? Math.round((inc - incLast) / incLast * 100) : null;
  const goal = +s.monthlyGoal || 0;
  const goalPct = goal ? Math.min(100, Math.round(inc / goal * 100)) : 0;
  const todoItems = [
    ...followUps.map(l => `<div class="task-row"><span class="task-ic">${icon('funnel')}</span><div class="grow clickable" data-act="editLead" data-id="${l.id}">
      <div class="title">Follow up with ${esc(l.name)}</div><div class="small">${dueLabel(l.followUp)}${l.service ? ' · ' + esc(l.service) : ''}</div></div></div>`),
    ...dueTasks.slice(0, 6).map(taskRow),
  ];
  const todayJobs = upcoming.filter(j => j.date === t), laterJobs = upcoming.filter(j => j.date !== t);
  return head(`${greet}${s.ownerName ? ', ' + esc(firstName(s.ownerName)) : ''}`,
    `<div class="row hide-sm">${btn('Job', 'newJob', '', '', 'plus')}${btn('Quote', 'newQuote', '', '', 'plus')}${btn('Invoice', 'newInvoice', 'btn-primary', '', 'plus')}</div>`,
    `${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${todayCount ? ` · ${plural(todayCount, 'job')} today` : ''}`) + welcome + `
  <div class="quick-actions show-sm">${btn('Job', 'newJob', '', '', 'calendar')}${btn('Quote', 'newQuote', '', '', 'quote')}${btn('Invoice', 'newInvoice', '', '', 'invoice')}${btn('Expense', 'newExpense', '', '', 'expense')}</div>
  <div class="grid grid-4">
    <a class="card stat" href="#/income" style="color:inherit"><div class="label">Income this month</div><div class="value">${money(inc)}</div>
      ${goal ? `<div class="progress" title="${goalPct}% of goal"><i style="width:${goalPct}%"></i></div><div class="sub">${goalPct}% of ${money(goal)} goal</div>`
        : `<div class="sub">${delta === null ? 'Payments received' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs last month`}</div>`}</a>
    <a class="card stat" href="#/expenses" style="color:inherit"><div class="label">Expenses this month</div><div class="value">${money(exp)}</div><div class="sub">${plural(db.expenses.filter(x => inRange(x.date, m0, m1)).length, 'expense')}</div></a>
    <a class="card stat" href="#/reports" style="color:inherit"><div class="label">Profit this month</div><div class="value" style="color:${inc - exp < 0 ? 'var(--bad)' : 'inherit'}">${money(inc - exp)}</div><div class="sub">${inc ? Math.round((inc - exp) / inc * 100) + '% margin' : '—'}</div></a>
    <a class="card stat" href="#/invoices" style="color:inherit"><div class="label">Owed to you</div><div class="value">${money(ar)}</div><div class="sub">${open.length} open · <span style="color:${overdue.length ? 'var(--bad)' : 'inherit'}">${overdue.length} overdue</span></div></a>
  </div>
  ${attn.length ? `<div class="card show-sm" style="margin-top:16px"><div class="card-head"><h2>Needs attention</h2></div><div class="attn">${attnHTML}</div></div>` : ''}
  <div class="dash-grid">
    <div class="stack">
      <div class="card"><div class="card-head"><h2>Schedule</h2><a href="#/schedule" class="small">Open calendar →</a></div>
        <h3 class="group-label" style="margin-top:0">Today</h3>
        ${todayJobs.length ? todayJobs.map(jobListItem).join('') : `<p class="muted small" style="margin:4px 0 8px">Nothing booked today.</p>`}
        ${laterJobs.length ? `<h3 class="group-label">Next 7 days</h3>${laterJobs.slice(0, 5).map(jobListItem).join('')}${laterJobs.length > 5 ? `<a class="small" href="#/schedule">+${laterJobs.length - 5} more</a>` : ''}` : ''}
        ${!upcoming.length ? `<div style="margin-top:4px">${btn('Schedule a job', 'newJob', 'btn-sm', '', 'plus')}</div>` : ''}</div>
      <div class="card"><div class="card-head"><h2>To-dos</h2><a href="#/tasks" class="small">All to-dos →</a></div>
        ${quickTaskForm()}
        ${todoItems.length ? todoItems.join('') : '<p class="muted small" style="margin:8px 0 0">Nothing due. Nice work! 🎉</p>'}</div>
    </div>
    <div class="stack">
      ${attn.length ? `<div class="card hide-sm"><div class="card-head"><h2>Needs attention</h2></div><div class="attn">${attnHTML}</div></div>` : ''}
      ${onClock.length ? `<div class="card"><div class="card-head"><h2>On the clock</h2><a href="#/team" class="small">Team →</a></div>
        ${onClock.map(m => `<div class="list-item"><span class="avatar sm" style="background:${m.color}">${esc(m.name[0])}</span><div class="grow"><b>${esc(m.name)}</b>
        <div class="muted small">since ${fmtClock(openEntry(m.id).in)}</div></div>${btn('Clock out', 'clockOut', 'btn-sm', `data-id="${m.id}"`)}</div>`).join('')}</div>` : ''}
      <div class="card"><div class="card-head"><h2>Unpaid invoices</h2><a href="#/invoices" class="small">All →</a></div>
        ${open.length ? open.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 5).map(i => `
          <a class="list-item" href="#/invoices/${i.id}" style="color:inherit"><div class="grow"><div class="title">${esc(custName(i.customerId))}</div>
          <div class="muted small">${esc(i.number)} · due ${fmtDate(i.dueDate)}</div></div><div class="right"><div class="num">${money(balance(i))}</div>${badge(invStatus(i))}</div></a>`).join('')
          : '<p class="muted small" style="margin:0">All caught up. Nothing owing.</p>'}</div>
      <div class="card"><div class="card-head"><h2>Open quotes</h2><a href="#/quotes" class="small">All →</a></div>
        ${(() => { const qs = db.quotes.filter(q => ['draft', 'sent'].includes(quoteStatus(q))).slice(-5).reverse();
          return qs.length ? qs.map(q => `<a class="list-item" href="#/quotes/${q.id}" style="color:inherit"><div class="grow"><div class="title">${esc(custName(q.customerId))}</div>
          <div class="muted small">${esc(q.number)} · ${fmtDate(q.date)}</div></div><div class="right"><div class="num">${money(totals(q).total)}</div>${badge(quoteStatus(q))}</div></a>`).join('')
          : '<p class="muted small" style="margin:0">No open quotes.</p>'; })()}</div>
    </div>
  </div>
  <div class="card" style="margin-top:16px"><div class="card-head"><h2>Income vs expenses · last 6 months</h2><a href="#/reports" class="small">Reports →</a></div>
    ${incExpChart(monthlyRows(monthsInRange(addMonths(monthStart(t), -5), t)))}</div>`;
};

/* ----- to-do helpers ----- */
function dueLabel(d) {
  if (!d) return '<span class="muted">No date</span>';
  const t = today(), diff = daysBetween(t, d);
  if (diff < 0) return `<span style="color:var(--bad)">Overdue · ${fmtDateShort(d)}</span>`;
  if (diff === 0) return '<span style="color:var(--warn)">Today</span>';
  if (diff === 1) return '<span class="muted">Tomorrow</span>';
  return `<span class="muted">${fmtDateShort(d)}</span>`;
}
const taskSort = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.time || '').localeCompare(b.time || '');
function taskRow(x) {
  return `<div class="task-row ${x.done ? 'done' : ''}"><input type="checkbox" data-act="toggleTask" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Mark done">
    <div class="grow clickable" data-act="editTask" data-id="${x.id}"><div class="title">${esc(x.title)}</div>
    <div class="small">${x.done ? '<span class="muted">Done</span>' : dueLabel(x.due)}${x.time ? ` <span class="muted">· ${fmtTime(x.time)}</span>` : ''}${x.customerId ? ` <span class="muted">· ${esc(custName(x.customerId))}</span>` : ''}</div></div></div>`;
}
const quickTaskForm = (custId = '') => `<form class="quick-task" data-customer="${custId}"><input name="title" placeholder="Add a to-do and press Enter…" required>
  <input name="due" type="date" value="${today()}" aria-label="Due date"><button class="btn btn-sm" type="submit">Add</button></form>`;

function jobListItem(j) {
  const d = j.date ? parseD(j.date) : null;
  return `<a class="list-item" href="#/jobs/${j.id}" style="color:inherit">
    <div class="date-chip">${d ? `<span>${d.toLocaleDateString(undefined, { month: 'short' })}</span><b>${d.getDate()}</b>` : '<span>No</span><b style="font-size:.7rem">date</b>'}</div>
    <div class="grow"><div class="title">${esc(j.title)}</div>
    <div class="muted small">${esc(custName(j.customerId))}${j.start ? ' · ' + fmtTime(j.start) : ''}${j.assignedTo ? ' · ' + esc(j.assignedTo) : ''}</div></div>
    ${badge(j.status)}</a>`;
}

/* ---------- Schedule ---------- */
const teamMembers = () => [...new Set(db.jobs.map(x => (x.assignedTo || '').trim()).filter(Boolean))].sort();
function routeUrl(jobs) {
  const stops = jobs.filter(j => j.status !== 'cancelled').map(j => j.address || cust(j.customerId)?.address).filter(Boolean);
  if (!stops.length) return '';
  const dest = stops.pop();
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(dest)}${stops.length ? '&waypoints=' + encodeURIComponent(stops.slice(0, 9).join('|')) : ''}`;
}
function dayPanel(day, jobs) {
  const route = routeUrl(jobs);
  return `<div class="card"><div class="card-head"><h2>${fmtDateShort(day)}</h2><div class="row">
      ${route ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="${route}">${icon('route')}Route</a>` : ''}
      ${btn('Add job', 'newJob', 'btn-sm', `data-date="${day}"`, 'plus')}</div></div>
    ${jobs.length ? jobs.map(j => `<a class="agenda-item ${j.status}" href="#/jobs/${j.id}">
        <div class="agenda-time" style="${tcolor(j)}">${j.start ? fmtTime(j.start) : 'Any time'}${j.end ? `<span>${fmtTime(j.end)}</span>` : ''}</div>
        <div class="grow"><div class="title">${esc(j.title)} ${badge(j.status)}</div>
        <div class="muted small">${esc(custName(j.customerId))}${j.address ? ' · ' + esc(j.address) : ''}${j.assignedTo ? ' · ' + esc(j.assignedTo) : ''}</div></div>
        <div class="num">${money(jobValue(j))}</div></a>`).join('')
      : empty('calendar', 'Nothing scheduled.')}
    ${jobs.length ? `<div class="muted small" style="margin-top:8px">${jobs.length} job${jobs.length === 1 ? '' : 's'} · ${money(sum(jobs.filter(j => j.status !== 'cancelled'), jobValue))}</div>` : ''}</div>`;
}
const tcolor = j => { const c = j.status === 'scheduled' && memberColor(j.assignedTo); return c ? `border-left-color:${c}` : ''; };
const evLabel = j => `${j.start ? fmtTime(j.start).replace(':00', '').replace(' ', '').toLowerCase() + ' ' : ''}${esc(j.title)}`;

VIEWS.schedule = () => {
  const t = today(), view = state.calView, team = state.calTeam;
  const jobs = db.jobs.filter(j => !team || (team === '__none' ? !j.assignedTo : (j.assignedTo || '').trim() === team));
  const byDate = {};
  for (const j of jobs) if (j.date) (byDate[j.date] ||= []).push(j);
  Object.values(byDate).forEach(a => a.sort((x, y) => (x.start || '99').localeCompare(y.start || '99')));
  const members = teamMembers();
  let title, body;

  if (view === 'month') {
    const ym = state.calMonth, first = parseD(ym + '-01');
    const start = addDays(ym + '-01', -first.getDay());
    title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i), js = byDate[d] || [];
      if (i === 35 && d.slice(0, 7) !== ym) break;
      cells += `<div class="day ${d.slice(0, 7) !== ym ? 'other' : ''} ${d === t ? 'today' : ''} ${d === state.calDay ? 'selected' : ''}" data-day="${d}">
        <div class="dnum">${+d.slice(8)}</div>
        ${js.slice(0, 3).map(j => `<a class="ev ${j.status}" style="${tcolor(j)}" href="#/jobs/${j.id}" draggable="true" data-drag-job="${j.id}" title="${esc(j.title)} · ${esc(custName(j.customerId))}">${evLabel(j)}</a>`).join('')}
        ${js.length > 3 ? `<div class="muted small more">+${js.length - 3} more</div>` : ''}</div>`;
    }
    body = `<div class="cal">${cells}</div>`;
  } else if (view === 'week') {
    const ws = addDays(state.calDay, -parseD(state.calDay).getDay());
    const we = addDays(ws, 6);
    title = `${parseD(ws).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${parseD(we).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    body = `<div class="week">${Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i), js = byDate[d] || [];
      return `<div class="wk-day ${d === t ? 'today' : ''} ${d === state.calDay ? 'selected' : ''}" data-day="${d}">
        <div class="wk-head"><span>${parseD(d).toLocaleDateString(undefined, { weekday: 'short' })}</span><b>${+d.slice(8)}</b>
          <button class="btn btn-icon wk-add" data-act="newJob" data-date="${d}" aria-label="Add job">${icon('plus')}</button></div>
        ${js.map(j => `<a class="wk-job ${j.status}" style="${tcolor(j)}" href="#/jobs/${j.id}" draggable="true" data-drag-job="${j.id}">
          <b>${j.start ? fmtTime(j.start) : 'Any time'}</b><span>${esc(j.title)}</span><span class="muted">${esc(custName(j.customerId))}</span></a>`).join('')}
        ${js.length ? `<div class="wk-total">${money(sum(js.filter(j => j.status !== 'cancelled'), jobValue))}</div>` : ''}</div>`;
    }).join('')}</div>
    <p class="muted small hide-sm" style="margin:8px 0 0">Tip: drag a job to another day to reschedule it.</p>`;
  } else {
    title = parseD(state.calDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    body = '';
  }
  const unscheduled = jobs.filter(j => !j.date && !['completed', 'cancelled'].includes(j.status));
  return head('Schedule', btn('New job', 'newJob', 'btn-primary', `data-date="${state.calDay}"`, 'plus')) + `
  <div class="card">
    <div class="cal-head">
      <div class="seg">${[['month', 'Month'], ['week', 'Week'], ['day', 'Day']].map(([k, l]) => `<button data-act="calView" data-v="${k}" class="${view === k ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div class="row" style="flex-wrap:nowrap"><button class="btn btn-sm" data-act="calMove" data-n="-1" aria-label="Previous">‹</button>
        <h2 class="cal-title">${title}</h2>
        <button class="btn btn-sm" data-act="calMove" data-n="1" aria-label="Next">›</button></div>
      <span class="spacer"></span>
      ${members.length ? `<select data-act-change="calTeam" style="width:auto" aria-label="Team member"><option value="">Everyone</option>${opts(members, team)}<option value="__none" ${team === '__none' ? 'selected' : ''}>Unassigned</option></select>` : ''}
      ${btn('Today', 'calToday', 'btn-sm')}
    </div>
    ${body}
  </div>
  <div style="margin-top:16px">${dayPanel(state.calDay, byDate[state.calDay] || [])}</div>
  ${unscheduled.length ? `<div class="card" style="margin-top:16px"><h2 style="margin-bottom:8px">Not scheduled yet</h2>
    <p class="muted small" style="margin:0 0 6px">Drag onto the calendar or open a job to give it a date.</p>
    ${unscheduled.map(j => `<div draggable="true" data-drag-job="${j.id}">${jobListItem(j)}</div>`).join('')}</div>` : ''}`;
};

/* ---------- Jobs ---------- */
VIEWS.jobs = id => {
  if (id) return jobDetail(id);
  const tab = filt('jobs', 'tab', 'upcoming'), q = filt('jobs', 'q', '').toLowerCase(), t = today();
  const tests = {
    upcoming: j => ['scheduled', 'in_progress'].includes(j.status) && (!j.date || j.date >= t),
    late: j => j.status === 'scheduled' && j.date && j.date < t,
    uninvoiced: j => j.status === 'completed' && !j.invoiceId && !j.noInvoice,
    completed: j => j.status === 'completed',
    all: () => true,
  };
  let list = db.jobs.filter(tests[tab] || tests.all)
    .filter(j => !q || `${j.title} ${custName(j.customerId)} ${j.address} ${j.assignedTo}`.toLowerCase().includes(q));
  list.sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
  if (tab === 'completed' || tab === 'all') list.reverse();
  const count = k => db.jobs.filter(tests[k]).length;
  return head('Jobs', btn('New job', 'newJob', 'btn-primary', '', 'plus')) + `<div class="card">
    ${tabsHTML('jobs', 'tab', [['upcoming', `Upcoming (${count('upcoming')})`], ['late', `Past due (${count('late')})`], ['uninvoiced', `To invoice (${count('uninvoiced')})`], ['completed', 'Completed'], ['all', 'All']], tab)}
    <div class="toolbar"><input type="search" placeholder="Search jobs…" value="${esc(q)}" data-filter="jobs:q"></div>
    ${list.length ? `<div class="show-sm">${list.map(jobListItem).join('')}</div><div class="table-wrap hide-sm"><table><thead><tr><th>Date</th><th>Job</th><th class="hide-sm">Customer</th><th class="hide-sm">Assigned</th><th>Status</th><th class="num">Value</th></tr></thead><tbody>
    ${list.map(j => `<tr class="clickable" data-href="#/jobs/${j.id}"><td>${j.date ? fmtDateShort(j.date) : '<span class="muted">Unscheduled</span>'}<div class="muted small">${fmtTime(j.start)}</div></td>
      <td><b>${esc(j.title)}</b><div class="muted small">${esc(j.address || '')}</div></td><td class="hide-sm">${esc(custName(j.customerId))}</td>
      <td class="hide-sm">${esc(j.assignedTo || '')}</td><td>${badge(j.status)}${j.invoiceId ? ' <span class="badge">invoiced</span>' : ''}</td><td class="num">${money(jobValue(j))}</td></tr>`).join('')}
    </tbody></table></div>` : empty('jobs', 'No jobs here.', btn('New job', 'newJob', 'btn-sm'))}</div>`;
};

function jobDetail(id) {
  const j = byId('jobs', id); if (!j) return empty('jobs', 'Job not found.', '<a class="btn btn-sm" href="#/jobs">Back to jobs</a>');
  const c = cust(j.customerId), inv = j.invoiceId && byId('invoices', j.invoiceId);
  const exps = db.expenses.filter(e => e.jobId === j.id);
  const revenue = jobValue(j), cost = sum(exps, e => e.amount), tax = inv ? totals(inv).tax : totals(j).tax;
  const profit = revenue - tax - cost;
  const addr = j.address || c?.address || '';
  const statusBtns = {
    scheduled: btn('Start job', 'jobStatus', '', `data-id="${j.id}" data-s="in_progress"`, 'clock') + btn('Complete', 'jobStatus', 'btn-primary', `data-id="${j.id}" data-s="completed"`, 'check'),
    in_progress: btn('Complete', 'jobStatus', 'btn-primary', `data-id="${j.id}" data-s="completed"`, 'check'),
    completed: '', cancelled: btn('Restore', 'jobStatus', '', `data-id="${j.id}" data-s="scheduled"`),
  }[j.status] || '';
  const worked = j.startedAt ? hoursOf({ in: j.startedAt, out: j.finishedAt || '' }) : 0;
  const series = j.seriesId ? seriesList().find(x => x.id === j.seriesId) : null;
  const jobMenu = moreMenu([
    menuItem('Edit job', 'editJob', `data-id="${j.id}"`, 'edit'),
    menuItem('Duplicate', 'dupJob', `data-id="${j.id}"`, 'jobs'),
    menuItem('Add to-do', 'newTask', `data-cust="${j.customerId || ''}"`, 'todo'),
    j.status === 'completed' && menuItem('Reopen job', 'jobStatus', `data-id="${j.id}" data-s="scheduled"`, 'calendar'),
    j.status === 'completed' && !j.invoiceId && menuItem(j.noInvoice ? 'Needs an invoice' : 'No invoice needed', 'toggleNoInvoice', `data-id="${j.id}"`, 'invoice'),
    series && menuItem('Add visits to this plan', 'extendPlan', `data-id="${series.id}"`, 'repeat'),
    j.status !== 'cancelled' && j.status !== 'completed' && menuItem('Cancel job', 'jobStatus', `data-id="${j.id}" data-s="cancelled"`, 'alert'),
    menuItem('Delete job', 'deleteJob', `data-id="${j.id}"`, 'trash', 'danger'),
  ]);
  const vars = { ...custVars(c), date: j.date ? fmtDateShort(j.date) : 'the scheduled day', time: j.start ? ' at ' + fmtTime(j.start) : '' };
  const msgBtns = c?.phone ? [
    j.status === 'scheduled' && `<a class="btn btn-sm" href="${smsHref(c.phone, fillTemplate('tplAppt', vars))}">${icon('sms')}Confirm appointment</a>`,
    ['scheduled', 'in_progress'].includes(j.status) && `<a class="btn btn-sm" href="${smsHref(c.phone, fillTemplate('tplOnWay', vars))}">${icon('truck')}On my way</a>`,
    j.status === 'completed' && `<a class="btn btn-sm" href="${smsHref(c.phone, fillTemplate('tplReview', vars))}">${icon('star')}Ask for a review</a>`,
  ].filter(Boolean).join('') : '';
  const photos = j.photos || [];
  const margin = revenue - tax > 0 ? Math.round(profit / (revenue - tax) * 100) : null;
  return head(`${esc(j.title)} ${badge(j.status)}`, statusBtns +
    (inv ? `<a class="btn" href="#/invoices/${inv.id}">${icon('invoice')}View invoice</a>` : btn('Create invoice', 'jobToInvoice', j.status === 'completed' ? 'btn-primary' : '', `data-id="${j.id}"`, 'invoice')) +
    jobMenu, `<a href="#/jobs">← All jobs</a>${series ? ` · <a href="#/plans">${icon('repeat').replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} ${ruleLabel(series.rule)}</a>` : ''}`) + `
  <div class="grid grid-2">
    <div class="card"><h2 style="margin-bottom:10px">Details</h2>
      <div class="stack" style="gap:8px">
        <div><div class="muted small">Customer</div>${c ? `<a href="#/customers/${c.id}"><b>${esc(c.name)}</b></a>${c.phone ? ` <span class="muted small">${esc(c.phone)}</span>` : ''}` : '—'}</div>
        <div><div class="muted small">When</div>${j.date ? fmtDateShort(j.date) : 'Not scheduled yet'}${j.start ? `, ${fmtTime(j.start)}${j.end ? ' – ' + fmtTime(j.end) : ''}` : ''}</div>
        ${j.startedAt ? `<div><div class="muted small">Time on job</div>${fmtHours(worked)}${j.finishedAt ? '' : ' <span class="badge warn">running</span>'} <span class="muted small">(started ${fmtClock(j.startedAt)}${j.finishedAt ? ', finished ' + fmtClock(j.finishedAt) : ''})</span></div>` : ''}
        ${addr ? `<div><div class="muted small">Address</div><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}">${esc(addr)} ↗</a></div>` : ''}
        ${j.assignedTo ? `<div><div class="muted small">Assigned to</div>${memberColor(j.assignedTo) ? `<span class="dot" style="background:${memberColor(j.assignedTo)}"></span>` : ''}${esc(j.assignedTo)}</div>` : ''}
        ${j.quoteId && byId('quotes', j.quoteId) ? `<div><div class="muted small">From quote</div><a href="#/quotes/${j.quoteId}">${esc(byId('quotes', j.quoteId).number)}</a></div>` : ''}
        ${j.notes ? `<div><div class="muted small">Notes</div><div style="white-space:pre-wrap">${esc(j.notes)}</div></div>` : ''}
        ${c?.notes ? `<div><div class="muted small">Customer notes</div><div style="white-space:pre-wrap">${esc(c.notes)}</div></div>` : ''}
      </div>
      ${c ? `<div class="row" style="margin-top:14px">${contactBtns(c)}</div>` : ''}
      ${msgBtns ? `<div class="muted small" style="margin:12px 0 6px">Quick texts</div><div class="row">${msgBtns}</div>` : ''}
    </div>
    <div class="card"><div class="card-head"><h2>Job costing</h2>${btn('Add expense', 'newExpense', 'btn-sm', `data-job="${j.id}"`, 'plus')}</div>
      <div class="grid grid-3" style="gap:8px;margin-bottom:12px">
        <div><div class="muted small">Revenue (pre-tax)</div><b class="num">${money(revenue - tax)}</b></div>
        <div><div class="muted small">Costs</div><b class="num">${money(cost)}</b></div>
        <div><div class="muted small">Profit</div><b class="num" style="color:${profit < 0 ? 'var(--bad)' : 'var(--good)'}">${money(profit)}</b>${margin !== null ? ` <span class="muted small">${margin}%</span>` : ''}</div>
      </div>
      ${exps.length ? exps.map(e => `<div class="list-item clickable" data-act="editExpense" data-id="${e.id}"><div class="grow"><div class="title">${esc(e.vendor || e.category)}</div><div class="muted small">${fmtDate(e.date)} · ${esc(e.category)}</div></div><span class="num">${money(e.amount)}</span></div>`).join('')
        : '<p class="muted small">Link materials, subcontractor and other costs to this job to see your real profit.</p>'}
    </div>
  </div>
  <div class="card"><div class="card-head"><h2>Photos</h2>
    <label class="btn btn-sm">${icon('camera')}Add photos<input type="file" accept="image/*" multiple class="js-job-photos" data-id="${j.id}" hidden></label></div>
    ${photos.length ? `<div class="photo-grid">${photos.map(ph => `<button class="photo" data-act="viewPhoto" data-id="${j.id}" data-pid="${ph.id}" aria-label="View photo"><img src="${ph.src}" alt="" loading="lazy"></button>`).join('')}</div>`
      : '<p class="muted small" style="margin:0">Add before and after photos to protect yourself and show customers your work.</p>'}</div>
  <div class="card"><h2 style="margin-bottom:10px">Line items</h2>${itemsTable(inv || j)}
    ${inv ? `<p class="muted small">Showing the line items from invoice ${esc(inv.number)}.</p>` : ''}</div>
`;
}

function contactBtns(c, smsText = '') {
  return [
    c.phone && `<a class="btn btn-sm" href="tel:${esc(c.phone)}">${icon('phone')}Call</a>`,
    c.phone && `<a class="btn btn-sm" href="${smsHref(c.phone, smsText)}">${icon('sms')}Text</a>`,
    c.email && `<a class="btn btn-sm" href="mailto:${esc(c.email)}">${icon('mail')}Email</a>`,
    c.address && `<a class="btn btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address)}">${icon('map')}Directions</a>`,
  ].filter(Boolean).join('');
}

/* ---------- Leads ---------- */
VIEWS.leads = () => {
  const showClosed = filt('leads', 'closed', '') === '1';
  const q = filt('leads', 'q', '').toLowerCase();
  const stages = showClosed ? leadStages() : leadStages().slice(0, -2);
  const list = db.leads.filter(l => !q || `${l.name} ${l.service} ${l.phone} ${l.email} ${l.address}`.toLowerCase().includes(q));
  const openLeads = db.leads.filter(l => !['won', 'lost'].includes(l.stage));
  const since = addDays(today(), -90);
  const recentWon = db.leads.filter(l => l.stage === 'won' && (l.closedAt || l.createdAt) >= since).length;
  const recentLost = db.leads.filter(l => l.stage === 'lost' && (l.closedAt || l.createdAt) >= since).length;
  return head('Leads', btn('New lead', 'newLead', 'btn-primary', '', 'plus'), 'Track every enquiry from first call to booked job.') + `
  <div class="grid grid-3">
    <div class="card stat"><div class="label">Open leads</div><div class="value">${openLeads.length}</div><div class="sub">${db.leads.filter(l => l.stage === firstStage()).length} in ${esc(openStages()[0].label)}</div></div>
    <div class="card stat"><div class="label">Pipeline value</div><div class="value">${money(sum(openLeads, l => l.value))}</div><div class="sub">Estimated</div></div>
    <div class="card stat"><div class="label">Win rate · 90 days</div><div class="value">${recentWon + recentLost ? Math.round(recentWon / (recentWon + recentLost) * 100) + '%' : '—'}</div><div class="sub">${recentWon} won · ${recentLost} lost</div></div>
  </div>
  <div class="toolbar" style="margin-top:16px"><input type="search" placeholder="Search leads…" value="${esc(q)}" data-filter="leads:q">
    <label class="check"><input type="checkbox" data-act="toggleClosedLeads" ${showClosed ? 'checked' : ''}> Show won &amp; lost</label></div>
  <div class="kanban">${stages.map(([k, l]) => {
    const items = list.filter(x => x.stage === k).sort((a, b) => (a.followUp || '9999').localeCompare(b.followUp || '9999') || b.createdAt.localeCompare(a.createdAt));
    return `<div class="kanban-col" data-stage="${k}"><div class="kanban-head"><b>${l}</b><span class="muted small">${items.length}${items.length ? ' · ' + money(sum(items, x => x.value)) : ''}</span></div>
      ${items.map(x => `<div class="lead-card" draggable="true" data-drag-lead="${x.id}" data-act="editLead" data-id="${x.id}" tabindex="0">
        <div class="title">${esc(x.name)}</div>
        ${x.service ? `<div class="small">${esc(x.service)}</div>` : ''}
        <div class="row small" style="margin-top:6px;gap:6px">${+x.value ? `<b class="num">${money(x.value)}</b>` : ''}
          ${x.followUp && !['won', 'lost'].includes(x.stage) ? `<span>${icon('calendar').replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-1px"')} ${dueLabel(x.followUp)}</span>` : ''}
          ${x.source ? `<span class="badge">${esc(x.source)}</span>` : ''}</div>
      </div>`).join('') || '<div class="muted small kanban-empty">Drop leads here</div>'}
      ${k === firstStage() ? `<button class="btn btn-sm" style="width:100%;margin-top:6px" data-act="newLead">${icon('plus')}Add lead</button>` : ''}</div>`;
  }).join('')}</div>
  <p class="muted small hide-sm">Tip: drag a card to move it to the next stage.</p>`;
};

/* ---------- To-dos ---------- */
VIEWS.tasks = () => {
  const tab = filt('tasks', 'tab', 'open'), t = today();
  const open = db.tasks.filter(x => !x.done).sort(taskSort);
  const groups = [
    ['Overdue', open.filter(x => x.due && x.due < t)], ['Today', open.filter(x => x.due === t)],
    ['Upcoming', open.filter(x => x.due && x.due > t)], ['No date', open.filter(x => !x.due)],
  ].filter(g => g[1].length);
  const done = db.tasks.filter(x => x.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 100);
  return head('To-dos', btn('New to-do', 'newTask', 'btn-primary', '', 'plus'), 'Reminders, call-backs and anything else you need to remember.') + `<div class="card">
    ${tabsHTML('tasks', 'tab', [['open', `To do (${open.length})`], ['done', 'Done']], tab)}
    ${tab === 'open' ? quickTaskForm() + (groups.length ? groups.map(([l, items]) => `<h3 class="group-label">${l}</h3>${items.map(taskRow).join('')}`).join('') : empty('todo', 'You’re all caught up.'))
      : (done.length ? done.map(taskRow).join('') + `<div style="margin-top:12px">${btn('Clear completed', 'clearDoneTasks', 'btn-sm')}</div>` : empty('todo', 'Nothing completed yet.'))}
  </div>`;
};

/* ---------- Recurring service plans ---------- */
function inferRule(jobs) {
  const ds = jobs.map(j => j.date).filter(Boolean);
  if (ds.length < 2) return { freq: 'week', interval: 1 };
  const diff = daysBetween(ds[0], ds[1]);
  if (diff % 7 === 0) return { freq: 'week', interval: diff / 7, weekdays: [parseD(ds[0]).getDay()] };
  if (diff >= 28 && diff <= 31) return { freq: 'month', interval: 1 };
  if (diff >= 89 && diff <= 92) return { freq: 'month', interval: 3 };
  return { freq: 'day', interval: diff };
}
function seriesList() {
  const map = {}, t = today();
  for (const j of db.jobs) if (j.seriesId) (map[j.seriesId] ||= []).push(j);
  return Object.entries(map).map(([id, jobs]) => {
    jobs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const rule = jobs.find(x => x.seriesRule)?.seriesRule || inferRule(jobs);
    const future = jobs.filter(x => x.status === 'scheduled' && (x.date || '') >= t);
    const per = totals(jobs.at(-1)).total;
    return { id, jobs, rule, future, done: jobs.filter(x => x.status === 'completed').length, next: future[0], last: jobs.at(-1),
      customerId: jobs[0].customerId, title: jobs[0].title, assignedTo: jobs.at(-1).assignedTo, per, active: future.length > 0, monthly: per * visitsPerMonth(rule) };
  }).sort((a, b) => (a.next?.date || '9999').localeCompare(b.next?.date || '9999'));
}
VIEWS.plans = () => {
  const tab = filt('plans', 'tab', 'active');
  const all = seriesList(), active = all.filter(p => p.active), ended = all.filter(p => !p.active);
  const list = tab === 'active' ? active : ended;
  const next30 = active.reduce((n, p) => n + p.future.filter(j => j.date <= addDays(today(), 30)).length, 0);
  return head('Recurring', btn('New recurring job', 'newJob', 'btn-primary', 'data-repeat="weekly"', 'plus'), 'Service plans and repeat visits: lawn care, cleaning, maintenance and more.') + `
  <div class="grid grid-3">
    <div class="card stat"><div class="label">Active plans</div><div class="value">${active.length}</div><div class="sub">${new Set(active.map(p => p.customerId)).size} customers</div></div>
    <div class="card stat"><div class="label">Recurring revenue</div><div class="value">${money(sum(active, p => p.monthly))}</div><div class="sub">Estimated per month</div></div>
    <div class="card stat"><div class="label">Visits next 30 days</div><div class="value">${next30}</div><div class="sub">${money(sum(active, p => p.future.filter(j => j.date <= addDays(today(), 30)).length * p.per))} booked</div></div>
  </div>
  <div class="card" style="margin-top:16px">${tabsHTML('plans', 'tab', [['active', `Active (${active.length})`], ['ended', `Ended (${ended.length})`]], tab)}
    ${list.length ? list.map(p => `<div class="plan-row">
      <div class="grow"><div class="title"><a href="#/jobs/${(p.next || p.last).id}">${esc(p.title)}</a></div>
        <div class="muted small"><a href="#/customers/${p.customerId}">${esc(custName(p.customerId))}</a> · ${ruleLabel(p.rule)}${p.assignedTo ? ' · ' + esc(p.assignedTo) : ''}</div>
        <div class="small" style="margin-top:4px">${p.next ? `Next visit <b>${fmtDateShort(p.next.date)}</b> · ${p.future.length} left` : 'No visits left'} · ${p.done} done</div></div>
      <div class="right"><div class="num"><b>${money(p.per)}</b><span class="muted small"> / visit</span></div><div class="muted small num">≈ ${money(p.monthly)}/mo</div></div>
      <div class="row plan-actions">${btn('Add visits', 'extendPlan', 'btn-sm', `data-id="${p.id}"`, 'plus')}${p.active ? btn('Stop', 'stopPlan', 'btn-sm', `data-id="${p.id}"`) : ''}</div>
    </div>`).join('') : empty('repeat', tab === 'active' ? 'No active recurring jobs yet. When you create a job, choose a Repeat option.' : 'No ended plans.',
      tab === 'active' ? btn('New recurring job', 'newJob', 'btn-sm', 'data-repeat="weekly"') : '')}
  </div>`;
};
function extendPlanForm(p) {
  modal({ title: `Add visits · ${p.title}`, submitLabel: 'Add visits', body: `<p class="muted small" style="margin-top:0">${esc(custName(p.customerId))} · ${ruleLabel(p.rule)} · last visit ${fmtDate(p.last.date)}</p>
    <div class="form-grid">${field('How many more visits?', inp('n', 12, 'type="number" min="1" max="104" required'))}</div>`,
    onSubmit: (f, d) => {
      const n = Math.min(104, Math.max(1, +d.n || 1));
      const dates = recurDates(p.last.date, { ...p.rule, count: n + 5, until: undefined }).filter(x => x > p.last.date).slice(0, n);
      const src = p.last;
      dates.forEach(date => db.jobs.push({ ...structuredClone(src), id: uid(), date, status: 'scheduled', invoiceId: '', photos: [], createdAt: today(),
        completedAt: '', startedAt: '', finishedAt: '', noInvoice: false, quoteId: undefined, seriesRule: p.rule }));
      refresh(); toast(`${dates.length} visits added`);
    } });
}

/* ---------- Team & timesheets ---------- */
const localStamp = () => { const d = new Date(); return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
VIEWS.team = () => {
  const tab = filt('team', 'tab', 'team');
  const ws = state.tsWeek || addDays(today(), -parseD(today()).getDay());
  const we = addDays(ws, 6);
  const tabs = tabsHTML('team', 'tab', [['team', `Team (${db.team.length})`], ['time', 'Timesheets']], tab);
  if (tab === 'team') {
    return head('Team & time', btn('Add team member', 'newMember', 'btn-primary', '', 'plus'), 'Your crew, their hours and who is working right now.') + `<div class="card">${tabs}
      ${db.team.length ? `<div class="team-grid">${db.team.map(m => {
        const open = openEntry(m.id);
        const wk = sum(db.timeEntries.filter(t => t.memberId === m.id && inRange(localDate(t.in), ws, we)), hoursOf);
        const jobsToday = db.jobs.filter(j => j.date === today() && (j.assignedTo || '').trim().toLowerCase() === m.name.toLowerCase() && j.status !== 'cancelled').length;
        return `<div class="member-card">
          <div class="row" style="flex-wrap:nowrap"><span class="avatar" style="background:${m.color}">${esc(m.name[0] || '?')}</span>
            <div class="grow"><div class="title">${esc(m.name)}</div><div class="muted small">${esc(m.role || 'Team member')}${m.rate ? ` · ${money(m.rate)}/h` : ''}</div></div>
            <button class="btn btn-icon" data-act="editMember" data-id="${m.id}" aria-label="Edit ${esc(m.name)}">${icon('edit')}</button></div>
          <div class="small" style="margin:10px 0">${open ? `<span class="badge good">On the clock</span> since ${fmtClock(open.in)} · ${fmtHours(hoursOf(open))}` : '<span class="badge">Off the clock</span>'}</div>
          <div class="muted small">${fmtHours(wk)} this week · ${jobsToday} job${jobsToday === 1 ? '' : 's'} today</div>
          <div class="row" style="margin-top:10px">${open ? btn('Clock out', 'clockOut', 'btn-sm btn-primary', `data-id="${m.id}"`, 'clock') : btn('Clock in', 'clockIn', 'btn-sm', `data-id="${m.id}"`, 'clock')}
            ${m.phone ? `<a class="btn btn-sm" href="tel:${esc(m.phone)}">${icon('phone')}Call</a><a class="btn btn-sm" href="${smsHref(m.phone, '')}">${icon('sms')}Text</a>` : ''}</div>
        </div>`;
      }).join('')}</div>` : empty('users', 'Add yourself and your crew to assign jobs, colour-code the calendar and track hours.', btn('Add team member', 'newMember', 'btn-sm'))}</div>`;
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const entries = db.timeEntries.filter(t => inRange(localDate(t.in), ws, we)).sort((a, b) => b.in.localeCompare(a.in));
  const unapproved = entries.filter(t => !t.approved && t.out);
  const rows = db.team.map(m => {
    const mine = entries.filter(t => t.memberId === m.id);
    const per = days.map(d => sum(mine.filter(t => localDate(t.in) === d), hoursOf));
    const total = sum(per);
    return { m, per, total, pay: total * (+m.rate || 0), pending: mine.some(t => !t.approved) };
  });
  return head('Team & time', btn('Add time entry', 'newEntry', 'btn-primary', '', 'plus'), 'Hours worked, ready for payroll.') + `<div class="card">${tabs}
    <div class="cal-head"><div class="row" style="flex-wrap:nowrap"><button class="btn btn-sm" data-act="tsMove" data-n="-1" aria-label="Previous week">‹</button>
      <h2 class="cal-title">${fmtDateShort(ws)} – ${fmtDateShort(we)}</h2><button class="btn btn-sm" data-act="tsMove" data-n="1" aria-label="Next week">›</button></div>
      <span class="spacer"></span>${unapproved.length ? btn(`Approve ${unapproved.length} entr${unapproved.length === 1 ? 'y' : 'ies'}`, 'approveWeek', 'btn-sm', '', 'check') : ''}</div>
    ${db.team.length ? `<div class="table-wrap"><table class="ts-table"><thead><tr><th>Team member</th>${days.map(d => `<th class="num">${parseD(d).toLocaleDateString(undefined, { weekday: 'short' })}<div class="muted">${+d.slice(8)}</div></th>`).join('')}<th class="num">Total</th><th class="num">Pay</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><span class="dot" style="background:${r.m.color}"></span><b>${esc(r.m.name)}</b>${r.pending ? ' <span class="badge warn">to approve</span>' : ''}</td>
        ${r.per.map(h => `<td class="num">${h ? h.toFixed(1) : '<span class="muted">–</span>'}</td>`).join('')}<td class="num"><b>${r.total.toFixed(1)}</b></td><td class="num">${r.pay ? money(r.pay) : '—'}</td></tr>`).join('')}
      <tr><td><b>Total</b></td>${days.map((_, i) => `<td class="num">${sum(rows, r => r.per[i]).toFixed(1) || ''}</td>`).join('')}<td class="num"><b>${sum(rows, r => r.total).toFixed(1)}</b></td><td class="num"><b>${money(sum(rows, r => r.pay))}</b></td></tr>
    </tbody></table></div>` : empty('clock', 'Add team members first.', btn('Add team member', 'newMember', 'btn-sm'))}
  </div>
  <div class="card" style="margin-top:16px"><h2 style="margin-bottom:8px">Time entries</h2>
    ${entries.length ? entries.map(t => { const m = byId('team', t.memberId); const j = t.jobId && byId('jobs', t.jobId); return `<div class="list-item clickable" data-act="editEntry" data-id="${t.id}">
      <span class="dot" style="background:${m?.color || 'var(--text-2)'}"></span><div class="grow"><div class="title">${esc(m?.name || 'Removed member')}</div>
      <div class="muted small">${fmtDateShort(localDate(t.in))} · ${fmtClock(t.in)} – ${t.out ? fmtClock(t.out) : 'now'}${+t.breakMin ? ` · ${t.breakMin}m break` : ''}${j ? ' · ' + esc(j.title) : ''}${t.notes ? ' · ' + esc(t.notes) : ''}</div></div>
      <div class="right"><div class="num">${fmtHours(hoursOf(t))}</div>${!t.out ? '<span class="badge good">On the clock</span>' : t.approved ? '<span class="badge good">Approved</span>' : '<span class="badge warn">Pending</span>'}</div></div>`; }).join('')
      : '<p class="muted small">No time recorded this week. Use Clock in on the Team tab, or add an entry by hand.</p>'}
  </div>`;
};
function memberForm(m) {
  const isNew = !m; m ||= { color: TEAM_COLORS[db.team.length % TEAM_COLORS.length], role: 'Technician' };
  modal({ title: isNew ? 'Add team member' : 'Edit team member', body: `<div class="form-grid">
    ${field('Name *', inp('name', m.name, 'required'), 'full')}
    ${field('Phone', inp('phone', m.phone, 'type="tel"'))}${field('Email', inp('email', m.email, 'type="email"'))}
    ${field('Role', `<select name="role">${opts(['Owner', 'Manager', 'Technician', 'Sales', 'Office', 'Subcontractor'], m.role)}</select>`)}
    ${field('Hourly pay (optional)', inp('rate', m.rate || '', 'type="number" min="0" step="0.25" inputmode="decimal"'))}
    <div class="field full"><label>Calendar colour</label><div class="row">${TEAM_COLORS.map(c => `<label class="swatch"><input type="radio" name="color" value="${c}" ${c === m.color ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>
  </div>`, footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Remove</button>`,
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => {
      if (!confirm(`Remove ${m.name} from your team? Their past time entries and jobs are kept.`)) return;
      const snap = snapshot(); db.team = db.team.filter(x => x.id !== m.id); close(); refresh(); undoToast(snap, `${m.name} removed`);
    }),
    onSubmit: (f, d) => {
      const oldName = m.name;
      Object.assign(m, { name: d.name.trim(), phone: d.phone, email: d.email.trim(), role: d.role, rate: +d.rate || 0, color: d.color || m.color });
      if (isNew) { m.id = uid(); db.team.push(m); }
      else if (oldName && oldName !== m.name) db.jobs.forEach(j => { if (j.assignedTo === oldName) j.assignedTo = m.name; });
      refresh(); toast(isNew ? `${m.name} added` : 'Saved');
    } });
}
function entryForm(t, preset = {}) {
  const isNew = !t; t ||= { memberId: db.team[0]?.id, in: `${today()}T08:00`, out: `${today()}T16:00`, breakMin: 30, ...preset };
  if (!db.team.length) { toast('Add a team member first'); return memberForm(); }
  const [inD, inT] = t.in.slice(0, 16).split('T'), outT = t.out ? new Date(t.out) : null;
  const jobs = db.jobs.filter(j => j.date && Math.abs(daysBetween(j.date, inD)) <= 7).sort((a, b) => a.date.localeCompare(b.date));
  modal({ title: isNew ? 'Add time entry' : 'Edit time entry', body: `<div class="form-grid">
    ${field('Team member', `<select name="memberId">${opts(db.team.map(m => [m.id, m.name]), t.memberId)}</select>`)}
    ${field('Date', inp('date', inD, 'type="date" required'))}
    ${field('Start', inp('start', inT, 'type="time" required'))}${field('End', inp('end', outT ? `${pad(outT.getHours())}:${pad(outT.getMinutes())}` : '', 'type="time"'))}
    ${field('Unpaid break (minutes)', inp('breakMin', t.breakMin || 0, 'type="number" min="0" step="5"'))}
    ${field('Job (optional)', `<select name="jobId"><option value="">— None —</option>${jobs.map(j => `<option value="${j.id}" ${j.id === t.jobId ? 'selected' : ''}>${esc(fmtDateShort(j.date) + ' · ' + j.title)}</option>`).join('')}</select>`)}
    ${field('Notes', inp('notes', t.notes), 'full')}
    <label class="check full"><input type="checkbox" name="approved" ${t.approved ? 'checked' : ''}> Approved for payroll</label></div>`,
    footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => {
      const snap = snapshot(); db.timeEntries = db.timeEntries.filter(x => x.id !== t.id); close(); refresh(); undoToast(snap, 'Time entry deleted');
    }),
    onSubmit: (f, d) => {
      let out = d.end ? `${d.date}T${d.end}` : '';
      if (out && out <= `${d.date}T${d.start}`) out = `${addDays(d.date, 1)}T${d.end}`; // past midnight
      Object.assign(t, { memberId: d.memberId, in: `${d.date}T${d.start}`, out, breakMin: +d.breakMin || 0, jobId: d.jobId, notes: d.notes, approved: !!d.approved });
      if (isNew) { t.id = uid(); db.timeEntries.push(t); }
      refresh(); toast('Time saved');
    } });
}

/* ---------- Customer activity timeline ---------- */
function customerActivity(c) {
  const ev = [];
  const add = (date, ic, text, href = '') => date && ev.push({ date, ic, text, href });
  add(c.createdAt, 'users', 'Became a customer');
  db.leads.filter(l => l.customerId === c.id).forEach(l => add(l.createdAt, 'funnel', `Enquiry: ${l.service || 'new lead'}${l.source ? ' (' + l.source + ')' : ''}`));
  db.quotes.filter(q => q.customerId === c.id).forEach(q => {
    const h = `#/quotes/${q.id}`, v = money(totals(q).total);
    add(q.date, 'quote', `Quote ${q.number} created · ${v}`, h);
    if (q.sentAt) add(q.sentAt, 'mail', `Quote ${q.number} sent`, h);
    if (q.approvedAt) add(q.approvedAt, 'check', `Quote ${q.number} approved`, h);
  });
  db.jobs.filter(j => j.customerId === c.id).forEach(j => {
    if (j.status === 'completed') add(j.completedAt || j.date, 'check', `Job completed: ${j.title}`, `#/jobs/${j.id}`);
    else if (j.status !== 'cancelled' && j.date >= today() && (!j.seriesId || db.jobs.find(x => x.seriesId === j.seriesId && x.status === 'scheduled' && x.date >= today()) === j))
      add(j.createdAt || today(), 'calendar', `Job booked for ${fmtDateShort(j.date)}: ${j.title}`, `#/jobs/${j.id}`);
  });
  db.invoices.filter(i => i.customerId === c.id && !i.void).forEach(i => {
    const h = `#/invoices/${i.id}`;
    add(i.date, 'invoice', `Invoice ${i.number} created · ${money(totals(i).total)}`, h);
    if (i.remindedAt) add(i.remindedAt, 'sms', `Payment reminder sent for ${i.number}`, h);
    (i.payments || []).forEach(p => add(p.date, 'income', `Payment received · ${money(p.amount)}${p.method ? ' by ' + p.method : ''}`, h));
  });
  (c.log || []).forEach(n => ev.push({ date: n.date, ic: 'edit', text: n.text, note: n.id }));
  return ev.sort((a, b) => b.date.localeCompare(a.date) || (a.note ? -1 : 1));
}
function activityHTML(c) {
  const ev = customerActivity(c);
  return `<form class="note-form" data-customer="${c.id}"><input name="text" placeholder="Add a note (call summary, preferences, gate code…)" required><button class="btn btn-sm" type="submit">Add note</button></form>
    <div class="timeline">${ev.length ? ev.slice(0, 80).map(e => `<div class="tl-item ${e.note ? 'note' : ''}"><span class="tl-ic">${icon(e.ic)}</span>
      <div class="grow">${e.href ? `<a href="${e.href}" style="color:inherit">${esc(e.text)}</a>` : `<span style="white-space:pre-wrap">${esc(e.text)}</span>`}<div class="muted small">${fmtDate(e.date)}</div></div>
      ${e.note ? `<button class="btn btn-icon" data-act="deleteNote" data-id="${c.id}" data-nid="${e.note}" aria-label="Delete note">✕</button>` : ''}</div>`).join('') : '<p class="muted small">Nothing yet.</p>'}</div>`;
}

/* ---------- Customers ---------- */
VIEWS.customers = id => {
  if (id) return customerDetail(id);
  const q = filt('customers', 'q', '').toLowerCase(), sort = filt('customers', 'sort', 'name');
  const stats = Object.fromEntries(db.customers.map(c => [c.id, custStats(c.id)]));
  const list = db.customers.filter(c => !q || `${c.name} ${c.email} ${c.phone} ${c.address} ${c.tags}`.toLowerCase().includes(q))
    .sort(sort === 'revenue' ? (a, b) => stats[b.id].paid - stats[a.id].paid : sort === 'owing' ? (a, b) => stats[b.id].owing - stats[a.id].owing
      : sort === 'recent' ? (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') : (a, b) => a.name.localeCompare(b.name));
  return head('Customers', btn('Import CSV', 'importCustomers', '', '', 'download') + btn('New customer', 'newCustomer', 'btn-primary', '', 'plus'), `${db.customers.length} total`) + `<div class="card">
    <div class="toolbar"><input type="search" placeholder="Search name, phone, email, address…" value="${esc(q)}" data-filter="customers:q">
      <select data-filter="customers:sort" style="width:auto" aria-label="Sort">${opts([['name', 'Sort: Name'], ['recent', 'Sort: Newest'], ['revenue', 'Sort: Top revenue'], ['owing', 'Sort: Owing']], sort)}</select></div>
    ${list.length ? `<div class="show-sm">${list.map(c => { const s = stats[c.id]; return `<a class="list-item" style="color:inherit" href="#/customers/${c.id}"><div class="grow">
      <div class="title">${esc(c.name)}</div><div class="muted small">${esc(c.phone || c.email || c.address || '')}</div></div>
      <div class="right">${s.owing > 0 ? `<div class="num" style="color:var(--bad)">${money(s.owing)}</div><div class="muted small">owing</div>` : `<div class="num muted">${money(s.paid)}</div>`}</div></a>`; }).join('')}</div>
    <div class="table-wrap hide-sm"><table><thead><tr><th>Name</th><th class="hide-sm">Phone</th><th class="hide-sm">Email</th><th class="num">Lifetime</th><th class="num">Owing</th></tr></thead><tbody>
    ${list.map(c => { const s = stats[c.id]; return `<tr class="clickable" data-href="#/customers/${c.id}"><td><b>${esc(c.name)}</b><div class="muted small">${esc(c.address || '')}</div></td>
      <td class="hide-sm">${esc(c.phone || '')}</td><td class="hide-sm">${esc(c.email || '')}</td><td class="num">${money(s.paid)}</td>
      <td class="num" style="color:${s.owing > 0 ? 'var(--bad)' : 'inherit'}">${s.owing > 0 ? money(s.owing) : '—'}</td></tr>`; }).join('')}
    </tbody></table></div>` : empty('users', q ? 'No matches.' : 'No customers yet.', q ? '' : btn('Add your first customer', 'newCustomer', 'btn-sm'))}</div>`;
};
function custStats(cid) {
  const invs = db.invoices.filter(i => i.customerId === cid && !i.void);
  return { paid: sum(invs, paidAmt) + sum(db.incomes.filter(i => i.customerId === cid), i => i.amount), owing: sum(invs.filter(isOpenInv), balance) };
}
function customerDetail(id) {
  const c = cust(id); if (!c) return empty('users', 'Customer not found.', '<a class="btn btn-sm" href="#/customers">Back to customers</a>');
  const s = custStats(id);
  const jobs = db.jobs.filter(j => j.customerId === id).sort((a, b) => (b.date || '9999').localeCompare(a.date || '9999'));
  const quotes = db.quotes.filter(q => q.customerId === id).reverse();
  const invs = db.invoices.filter(i => i.customerId === id).reverse();
  const tasks = db.tasks.filter(x => x.customerId === id).sort((a, b) => (a.done - b.done) || taskSort(a, b));
  const nextJob = jobs.filter(j => j.date >= today() && j.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date))[0];
  const tab = filt('customer', 'tab', 'activity');
  const lists = {
    activity: activityHTML(c),
    jobs: jobs.length ? jobs.map(jobListItem).join('') : empty('jobs', 'No jobs yet.'),
    quotes: quotes.length ? quotes.map(q => `<a class="list-item" style="color:inherit" href="#/quotes/${q.id}"><div class="grow"><div class="title">${esc(q.number)}</div><div class="muted small">${fmtDate(q.date)}</div></div><span class="num">${money(totals(q).total)}</span>${badge(quoteStatus(q))}</a>`).join('') : empty('quote', 'No quotes yet.'),
    invoices: invs.length ? invs.map(i => `<a class="list-item" style="color:inherit" href="#/invoices/${i.id}"><div class="grow"><div class="title">${esc(i.number)}</div><div class="muted small">${fmtDate(i.date)}</div></div><span class="num">${money(totals(i).total)}</span>${badge(invStatus(i))}</a>`).join('') : empty('invoice', 'No invoices yet.'),
    tasks: quickTaskForm(id) + (tasks.length ? tasks.map(taskRow).join('') : '<p class="muted small">No to-dos for this customer.</p>'),
  };
  return head(esc(c.name), btn('Job', 'newJob', '', `data-cust="${id}"`, 'plus') + btn('Quote', 'newQuote', 'btn-primary', `data-cust="${id}"`, 'plus') +
    moreMenu([menuItem('Edit customer', 'editCustomer', `data-id="${id}"`, 'edit'), menuItem('New invoice', 'newInvoice', `data-cust="${id}"`, 'invoice'),
      menuItem('Add to-do', 'newTask', `data-cust="${id}"`, 'todo'), s.owing && menuLink('Print statement', `#/statement/${id}`, 'statement'),
      menuItem('Delete customer', 'deleteCustomer', `data-id="${id}"`, 'trash', 'danger')]), '<a href="#/customers">← All customers</a>') + `
  <div class="grid grid-3">
    <div class="card"><h2 style="margin-bottom:8px">Contact</h2>
      <div class="stack" style="gap:6px">${c.phone ? `<div>${esc(c.phone)}</div>` : ''}${c.email ? `<div>${esc(c.email)}</div>` : ''}${c.address ? `<div>${esc(c.address)}</div>` : ''}
      ${c.tags || c.source ? `<div>${[c.source, ...(c.tags || '').split(',')].map(x => (x || '').trim()).filter(Boolean).map(x => `<span class="badge">${esc(x)}</span>`).join(' ')}</div>` : ''}
      ${c.notes ? `<div class="muted small" style="white-space:pre-wrap">${esc(c.notes)}</div>` : ''}
      ${!c.phone && !c.email && !c.address ? '<p class="muted small">No contact details yet.</p>' : ''}</div>
      <div class="row" style="margin-top:12px">${contactBtns(c)}</div></div>
    <div class="card stat"><div class="label">Lifetime revenue</div><div class="value">${money(s.paid)}</div>
      <div class="sub">${jobs.filter(j => j.status === 'completed').length} completed jobs${nextJob ? ` · next visit ${fmtDateShort(nextJob.date)}` : ''}</div></div>
    <div class="card stat"><div class="label">Currently owing</div><div class="value" style="color:${s.owing ? 'var(--bad)' : 'inherit'}">${money(s.owing)}</div>
      <div class="sub">Customer since ${fmtDate(c.createdAt)}</div>
      ${s.owing ? `<a class="btn btn-sm" style="margin-top:10px" href="#/statement/${id}">${icon('statement')}Statement</a>` : ''}</div>
  </div>
  <div class="card">${tabsHTML('customer', 'tab', [['activity', 'Activity'], ['jobs', `Jobs (${jobs.length})`], ['quotes', `Quotes (${quotes.length})`], ['invoices', `Invoices (${invs.length})`], ['tasks', `To-dos (${tasks.filter(x => !x.done).length})`]], tab)}${lists[tab]}</div>
`;
}

/* ---------- Customer statement ---------- */
VIEWS.statement = id => {
  const c = cust(id); if (!c) return empty('users', 'Customer not found.');
  const s = db.settings, open = db.invoices.filter(i => i.customerId === id && isOpenInv(i)).sort((a, b) => a.date.localeCompare(b.date));
  return head('Statement', `<button class="btn btn-primary" data-act="printPage">${icon('print')}Print / PDF</button>`, `<a href="#/customers/${id}">← ${esc(c.name)}</a>`) + `
  <div class="doc">
    <div class="doc-top"><div>${bizBlock()}</div>
      <div><h1>STATEMENT</h1><div class="meta"><div><span>Date</span><b>${fmtDate(today())}</b></div></div></div></div>
    <div class="bill-to"><div class="lbl">Account</div><b>${esc(c.name)}</b><div style="white-space:pre-line;color:#444">${esc([c.address, c.email].filter(Boolean).join('\n'))}</div></div>
    <table><thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead><tbody>
      ${open.map(i => `<tr><td>${esc(i.number)}</td><td>${fmtDate(i.date)}</td><td>${fmtDate(i.dueDate)}${invStatus(i) === 'overdue' ? ' <b style="color:#b91c1c">overdue</b>' : ''}</td>
        <td class="num">${money(totals(i).total)}</td><td class="num">${money(paidAmt(i))}</td><td class="num">${money(balance(i))}</td></tr>`).join('') || '<tr><td colspan="6">No open invoices.</td></tr>'}
    </tbody></table>
    <div class="totals"><div class="grand"><span>Total due</span><span>${money(sum(open, balance))}</span></div></div>
    ${payBlock()}
  </div>`;
};
function bizBlock() {
  const s = db.settings;
  return `${s.logo ? `<img class="doc-logo" src="${s.logo}" alt="">` : ''}
    <div style="font-weight:700;font-size:16px">${esc(s.businessName || 'Your Business Name')}</div>
    <div style="white-space:pre-line;color:#444">${esc([s.address, s.phone, s.email, s.website].filter(Boolean).join('\n'))}</div>
    ${s.taxNumber ? `<div style="color:#444">${esc(s.taxName)} # ${esc(s.taxNumber)}</div>` : ''}`;
}
function payBlock() {
  const s = db.settings;
  if (!s.paymentInstructions && !s.paymentLink) return '';
  return `<div class="notes"><div class="lbl">How to pay</div>${esc(s.paymentInstructions)}
    ${s.paymentLink ? `<div style="margin-top:6px">Pay online: <a href="${esc(s.paymentLink)}" target="_blank" rel="noopener">${esc(s.paymentLink)}</a></div>` : ''}</div>`;
}

/* ---------- Quotes ---------- */
VIEWS.quotes = id => {
  if (id) return docView('quote', id);
  const tab = filt('quotes', 'tab', 'open'), q = filt('quotes', 'q', '').toLowerCase();
  const tests = { open: x => ['draft', 'sent'].includes(quoteStatus(x)), approved: x => ['approved', 'converted'].includes(quoteStatus(x)),
    closed: x => ['declined', 'expired'].includes(quoteStatus(x)), all: () => true };
  const list = db.quotes.filter(tests[tab]).filter(x => !q || `${x.number} ${custName(x.customerId)}`.toLowerCase().includes(q)).reverse();
  const sent = db.quotes.filter(x => x.status !== 'draft').length, won = db.quotes.filter(x => ['approved', 'converted'].includes(x.status)).length;
  const openVal = sum(db.quotes.filter(tests.open), x => totals(x).total);
  return head('Quotes', btn('New quote', 'newQuote', 'btn-primary', '', 'plus'), [sent ? `Win rate ${Math.round(won / sent * 100)}% (${won} of ${sent} sent)` : '', openVal ? `${money(openVal)} in open quotes` : ''].filter(Boolean).join(' · ')) + `<div class="card">
    ${tabsHTML('quotes', 'tab', [['open', 'Open'], ['approved', 'Won'], ['closed', 'Declined / expired'], ['all', 'All']], tab)}
    <div class="toolbar"><input type="search" placeholder="Search quotes…" value="${esc(q)}" data-filter="quotes:q"></div>
    ${list.length ? docTable(list, 'quotes', x => quoteStatus(x), x => x.validUntil ? 'Valid to ' + fmtDate(x.validUntil) : '') : empty('quote', 'No quotes here.', btn('New quote', 'newQuote', 'btn-sm'))}</div>`;
};
function docTable(list, route, statusFn, extraFn) {
  const isInv = route === 'invoices';
  return `<div class="show-sm">${list.map(x => `<a class="list-item" style="color:inherit" href="#/${route}/${x.id}"><div class="grow">
      <div class="title">${esc(custName(x.customerId))}</div><div class="muted small">${esc(x.number)} · ${extraFn(x) || fmtDate(x.date)}</div></div>
      <div class="right"><div class="num">${money(isInv && balance(x) > 0 ? balance(x) : totals(x).total)}</div>${badge(statusFn(x))}</div></a>`).join('')}</div>
    <div class="table-wrap hide-sm"><table><thead><tr><th>Number</th><th>Customer</th><th class="hide-sm">Date</th><th>Status</th><th class="num">Total</th>${route === 'invoices' ? '<th class="num">Balance</th>' : ''}</tr></thead><tbody>
    ${list.map(x => `<tr class="clickable" data-href="#/${route}/${x.id}"><td><b>${esc(x.number)}</b></td><td>${esc(custName(x.customerId))}</td>
    <td class="hide-sm">${fmtDate(x.date)}<div class="muted small">${extraFn(x)}</div></td><td>${badge(statusFn(x))}</td><td class="num">${money(totals(x).total)}</td>
    ${route === 'invoices' ? `<td class="num">${balance(x) > 0 ? money(balance(x)) : '—'}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}

/* ---------- Invoices ---------- */
VIEWS.invoices = id => {
  if (id) return docView('invoice', id);
  const tab = filt('invoices', 'tab', 'unpaid'), q = filt('invoices', 'q', '').toLowerCase();
  const tests = { unpaid: isOpenInv, overdue: x => invStatus(x) === 'overdue', draft: x => invStatus(x) === 'draft', paid: x => invStatus(x) === 'paid', all: () => true };
  const list = db.invoices.filter(tests[tab]).filter(x => !q || `${x.number} ${custName(x.customerId)}`.toLowerCase().includes(q)).reverse();
  const open = db.invoices.filter(isOpenInv);
  const overdue = open.filter(tests.overdue);
  return head('Invoices', btn('New invoice', 'newInvoice', 'btn-primary', '', 'plus'),
    `${money(sum(open, balance))} outstanding across ${open.length} invoice${open.length === 1 ? '' : 's'}${overdue.length ? ` · <span style="color:var(--bad)">${money(sum(overdue, balance))} overdue</span>` : ''}`) + `<div class="card">
    ${tabsHTML('invoices', 'tab', [['unpaid', `Unpaid (${open.length})`], ['overdue', `Overdue (${overdue.length})`], ['draft', 'Drafts'], ['paid', 'Paid'], ['all', 'All']], tab)}
    <div class="toolbar"><input type="search" placeholder="Search invoices…" value="${esc(q)}" data-filter="invoices:q"></div>
    ${list.length ? docTable(list, 'invoices', invStatus, x => {
      if (invStatus(x) === 'overdue') return `<span style="color:var(--bad)">${daysBetween(x.dueDate, today())} days overdue</span>`;
      return x.dueDate && isOpenInv(x) ? 'Due ' + fmtDate(x.dueDate) : '';
    }) : empty('invoice', 'No invoices here.', btn('New invoice', 'newInvoice', 'btn-sm'))}</div>`;
};

/* ---------- Invoice / quote document ---------- */
const depositAmt = q => +q.depositPct ? round2(totals(q).total * q.depositPct / 100) : 0;
function docHTML(type, d) {
  const s = db.settings, c = cust(d.customerId) || {}, t = totals(d), isInv = type === 'invoice';
  const paid = isInv ? paidAmt(d) : 0, status = isInv ? invStatus(d) : quoteStatus(d);
  return `<div class="doc">
    <div class="doc-top">
      <div>${bizBlock()}</div>
      <div><h1>${isInv ? 'INVOICE' : 'QUOTE'}</h1>
        <div class="meta"><div><span>${isInv ? 'Invoice' : 'Quote'} #</span><b>${esc(d.number)}</b></div>
        <div><span>Date</span><b>${fmtDate(d.date)}</b></div>
        ${isInv && d.dueDate ? `<div><span>Due</span><b>${fmtDate(d.dueDate)}</b></div>` : ''}
        ${!isInv && d.validUntil ? `<div><span>Valid until</span><b>${fmtDate(d.validUntil)}</b></div>` : ''}
        ${isInv && status !== 'paid' && status !== 'void' ? `<div><span>Amount due</span><b>${money(balance(d))}</b></div>` : ''}</div></div>
    </div>
    <div class="bill-to"><div class="lbl">${isInv ? 'Bill to' : 'Prepared for'}</div><b>${esc(c.name || '')}</b>
      <div style="white-space:pre-line;color:#444">${esc([c.address, c.phone, c.email].filter(Boolean).join('\n'))}</div>
      ${d.serviceAddress && d.serviceAddress !== c.address ? `<div style="margin-top:6px"><span class="lbl">Service address:</span> ${esc(d.serviceAddress)}</div>` : ''}</div>
    <table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>
      ${(d.items || []).map(it => `<tr><td>${esc(it.desc)}${it.details ? `<div style="color:#666;font-size:12px;white-space:pre-line">${esc(it.details)}</div>` : ''}</td><td class="num">${+it.qty}</td><td class="num">${money(it.price)}</td><td class="num">${money(it.qty * it.price)}</td></tr>`).join('')}
    </tbody></table>
    <div class="totals">
      <div><span>Subtotal</span><span>${money(t.sub)}</span></div>
      ${t.disc ? `<div><span>Discount</span><span>−${money(t.disc)}</span></div>` : ''}
      <div><span>${esc(s.taxName)} (${t.rate}%)</span><span>${money(t.tax)}</span></div>
      <div class="grand"><span>Total</span><span>${money(t.total)}</span></div>
      ${isInv && paid ? `<div><span>Paid</span><span>−${money(paid)}</span></div><div class="grand"><span>Balance due</span><span>${money(balance(d))}</span></div>` : ''}
      ${!isInv && depositAmt(d) ? `<div><span>Deposit required (${+d.depositPct}%)</span><span>${money(depositAmt(d))}</span></div>` : ''}
    </div>
    ${status === 'paid' ? '<div class="paid-stamp">PAID</div>' : ''}
    ${d.notes ? `<div class="notes">${esc(d.notes)}</div>` : ''}
    ${isInv && status !== 'paid' ? payBlock() : ''}
    ${!isInv ? `<div class="notes" style="margin-top:40px;display:flex;gap:40px;flex-wrap:wrap"><div>Accepted by: ________________________</div><div>Date: ______________</div></div>` : ''}
  </div>`;
}
function docMessage(type, d, kind = 'send') {
  const c = cust(d.customerId), t = totals(d);
  const items = (d.items || []).map(it => `• ${it.desc}: ${money(it.qty * it.price)}`).join('\n');
  const vars = { ...custVars(c), number: d.number, total: money(t.total), balance: money(balance(d)), due: d.dueDate ? fmtDate(d.dueDate) : 'on receipt',
    valid: d.validUntil ? fmtDate(d.validUntil) : '30 days', items };
  if (type === 'invoice') return fillTemplate(kind === 'reminder' ? 'tplReminder' : 'tplInvoice', vars);
  return fillTemplate(kind === 'followup' ? 'tplQuoteFollow' : 'tplQuote', vars);
}
function docView(type, id) {
  const coll = type === 'invoice' ? 'invoices' : 'quotes';
  const d = byId(coll, id); if (!d) return empty(type, 'Not found.', `<a class="btn btn-sm" href="#/${coll}">Back</a>`);
  const c = cust(d.customerId) || {};
  const isInv = type === 'invoice';
  const status = isInv ? invStatus(d) : quoteStatus(d);
  const a = (l, act, cls = '', ic = '', extra = '') => btn(l, act, cls, `data-id="${id}" data-type="${type}" ${extra}`, ic);
  const send = a('Email', 'docEmail', '', 'mail') + a('Text', 'docText', '', 'sms');
  const remind = a('Send reminder', 'docRemind', '', 'sms');
  const depInv = !isInv && d.depositInvoiceId && byId('invoices', d.depositInvoiceId);
  const actions = isInv
    ? (status === 'void' ? '' : (status !== 'paid' ? a('Record payment', 'recordPayment', 'btn-primary', 'check') : '') +
      (status === 'overdue' || status === 'partial' ? remind : status === 'paid' ? '' : send) + a('Print / PDF', 'docPrint', '', 'print'))
    : (['draft', 'sent', 'expired'].includes(status) ? a('Approve', 'quoteApprove', 'btn-primary', 'check') : '') +
      (status === 'approved' ? a('Schedule job', 'quoteToJob', 'btn-primary', 'calendar') + a('Convert to invoice', 'quoteToInvoice', '', 'invoice') : '') +
      (['approved', 'sent', 'draft'].includes(status) && depositAmt(d) && !depInv ? a(`Request ${money(depositAmt(d))} deposit`, 'quoteDeposit', '', 'invoice') : '') +
      (status === 'sent' || status === 'expired' ? a('Follow up', 'docFollow', '', 'sms') : send) + a('Print / PDF', 'docPrint', '', 'print');
  const pays = isInv ? (d.payments || []) : [];
  const canMarkSent = isInv ? !d.sent && status === 'draft' : d.status === 'draft';
  return head(`${isInv ? 'Invoice' : 'Quote'} ${esc(d.number)} ${badge(status)}`, '', `<a href="#/${coll}">← All ${coll}</a> · <a href="#/customers/${c.id}">${esc(c.name || '')}</a>`) + `
    <div class="doc-actions">${actions}${moreMenu([
      canMarkSent && menuItem('Mark as sent', 'markSent', `data-id="${id}" data-type="${type}"`, 'check'),
      isInv && ['overdue', 'partial'].includes(status) && menuItem('Email invoice', 'docEmail', `data-id="${id}" data-type="${type}"`, 'mail'),
      isInv && ['overdue', 'partial'].includes(status) && menuItem('Text invoice', 'docText', `data-id="${id}" data-type="${type}"`, 'sms'),
      menuItem('Edit', 'editDoc', `data-id="${id}" data-type="${type}"`, 'edit'),
      menuItem('Duplicate', 'dupDoc', `data-id="${id}" data-type="${type}"`, 'quote'),
      !isInv && ['draft', 'sent', 'expired'].includes(status) && menuItem('Mark declined', 'quoteDecline', `data-id="${id}" data-type="${type}"`, 'alert'),
      d.jobId && byId('jobs', d.jobId) && menuLink('View job', `#/jobs/${d.jobId}`, 'jobs'),
      !isInv && d.invoiceId && byId('invoices', d.invoiceId) && menuLink('View invoice', `#/invoices/${d.invoiceId}`, 'invoice'),
      isInv && d.quoteId && byId('quotes', d.quoteId) && menuLink('View quote', `#/quotes/${d.quoteId}`, 'quote'),
      isInv && status !== 'void' && !pays.length && menuItem('Void invoice', 'voidInvoice', `data-id="${id}" data-type="${type}"`, 'alert'),
      menuItem('Delete', 'deleteDoc', `data-id="${id}" data-type="${type}"`, 'trash', 'danger'),
    ])}</div>
    ${!c.email && !c.phone ? `<div class="alert warn no-print" style="margin:0 auto 12px;max-width:820px">${icon('alert')}<span>This customer has no email or phone saved. <a href="#/customers/${c.id}">Add one</a> to send from here.</span></div>` : ''}
    ${depInv ? `<div class="alert info no-print" style="margin:0 auto 12px;max-width:820px">${icon('invoice')}<span>Deposit invoice <a href="#/invoices/${depInv.id}">${esc(depInv.number)}</a> · ${badge(invStatus(depInv))}</span></div>` : ''}
    ${docHTML(type, d)}
    ${isInv ? `<div class="card no-print" style="margin-top:16px;max-width:820px;margin-left:auto;margin-right:auto">
      <div class="card-head"><h2>Payments</h2>${status !== 'paid' && status !== 'void' ? a('Record payment', 'recordPayment', 'btn-sm', 'plus') : ''}</div>
      ${pays.length ? pays.map(p => `<div class="list-item"><div class="grow"><div class="title">${money(p.amount)}</div><div class="muted small">${fmtDate(p.date)} · ${esc(p.method || '')}${p.note ? ' · ' + esc(p.note) : ''}</div></div>
        <button class="btn btn-sm btn-danger" data-act="deletePayment" data-id="${id}" data-pid="${p.id}">Remove</button></div>`).join('') : '<p class="muted small">No payments recorded yet.</p>'}
      ${d.sentAt ? `<p class="muted small">Sent ${fmtDate(d.sentAt)}${d.remindedAt ? ` · last reminder ${fmtDate(d.remindedAt)}` : ''}.</p>` : ''}
    </div>` : `${d.sentAt ? `<p class="muted small no-print" style="text-align:center">Sent ${fmtDate(d.sentAt)}.</p>` : ''}`}
`;
}

/* ---------- Income ---------- */
VIEWS.income = () => {
  const p = filt('income', 'period', 'this_month');
  const [from, to] = periodRange(p, state.filters.income);
  const list = incomeEntries().filter(x => inRange(x.date, from, to));
  const byMethod = {};
  list.forEach(x => byMethod[x.method || 'Other'] = (byMethod[x.method || 'Other'] || 0) + x.amount);
  return head('Income', btn('Add other income', 'newIncome', 'btn-primary', '', 'plus'), 'Invoice payments are added automatically. Use “other income” for cash jobs without an invoice.') + `
  <div class="toolbar">${periodSelect(p, 'income:period')}${customRange('income', p)}${btn('Export CSV', 'exportIncome', 'btn-sm', '', 'download')}</div>
  <div class="grid grid-3"><div class="card stat"><div class="label">Total received</div><div class="value">${money(sum(list, x => x.amount))}</div><div class="sub">${list.length} payments</div></div>
    <div class="card" style="grid-column:span 2"><h3 style="margin-bottom:6px">By payment method</h3>${hbars(Object.entries(byMethod).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), sum(list, x => x.amount))}</div></div>
  <div class="card">${list.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Source</th><th class="hide-sm">Customer</th><th class="hide-sm">Method</th><th class="num">Amount</th></tr></thead><tbody>
    ${list.map(x => `<tr class="clickable" ${x.kind === 'payment' ? `data-href="#/invoices/${x.invoiceId}"` : `data-act="editIncome" data-id="${x.id}"`}>
      <td>${fmtDate(x.date)}</td><td>${esc(x.source || x.description || 'Income')}${x.kind === 'other' && x.description && x.source ? `<div class="muted small">${esc(x.description)}</div>` : ''}</td>
      <td class="hide-sm">${esc(x.customerId ? custName(x.customerId) : '')}</td><td class="hide-sm">${esc(x.method || '')}</td><td class="num">${money(x.amount)}</td></tr>`).join('')}
  </tbody></table></div>` : empty('income', 'No income recorded for this period.')}</div>`;
};
function customRange(view, p) {
  if (p !== 'custom') return '';
  const f = state.filters[view] || {};
  return `<input type="date" style="width:auto" value="${f.from || ''}" data-filter="${view}:from"><span class="muted">to</span><input type="date" style="width:auto" value="${f.to || ''}" data-filter="${view}:to">`;
}

/* ---------- Expenses & mileage ---------- */
VIEWS.expenses = () => {
  const tab = filt('expenses', 'tab', 'expenses');
  const p = filt('expenses', 'period', 'this_month'), cat = filt('expenses', 'cat', ''), q = filt('expenses', 'q', '').toLowerCase();
  const [from, to] = periodRange(p, state.filters.expenses);
  const tabs = tabsHTML('expenses', 'tab', [['expenses', 'Expenses'], ['mileage', 'Mileage log']], tab);
  const tools = `<div class="toolbar">${periodSelect(p, 'expenses:period')}${customRange('expenses', p)}`;
  if (tab === 'mileage') {
    const s = db.settings;
    const list = db.mileage.filter(m => inRange(m.date, from, to)).sort((a, b) => b.date.localeCompare(a.date));
    const dist = sum(list, m => m.distance);
    return head('Expenses', btn('Log a trip', 'newTrip', 'btn-primary', '', 'plus')) + tabs + tools + btn('Export CSV', 'exportMileage', 'btn-sm', '', 'download') + `</div>
    <div class="grid grid-2"><div class="card stat"><div class="label">Business distance</div><div class="value">${dist.toLocaleString()} ${esc(s.distanceUnit)}</div><div class="sub">${list.length} trips</div></div>
    <div class="card stat"><div class="label">Estimated deduction</div><div class="value">${money(dist * s.mileageRate)}</div><div class="sub">at ${money(s.mileageRate)}/${esc(s.distanceUnit)} — change the rate in Settings</div></div></div>
    <div class="card">${list.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Purpose</th><th class="hide-sm">Route</th><th class="num">Distance</th></tr></thead><tbody>
      ${list.map(m => `<tr class="clickable" data-act="editTrip" data-id="${m.id}"><td>${fmtDate(m.date)}</td><td>${esc(m.purpose)}</td><td class="hide-sm">${esc(m.route || '')}</td><td class="num">${m.distance} ${esc(s.distanceUnit)}</td></tr>`).join('')}
    </tbody></table></div>` : empty('map', 'No trips logged for this period. Driving to jobs is usually tax-deductible — log your trips!')}</div>`;
  }
  const list = db.expenses.filter(e => inRange(e.date, from, to) && (!cat || e.category === cat) &&
    (!q || `${e.vendor} ${e.notes} ${e.category}`.toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date));
  const total = sum(list, e => e.amount);
  const byCat = {};
  list.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + +e.amount);
  const catRows = Object.entries(byCat).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return head('Expenses', btn('Add expense', 'newExpense', 'btn-primary', '', 'plus')) + tabs + tools +
    `<select data-filter="expenses:cat" style="width:auto"><option value="">All categories</option>${opts(db.categories, cat)}</select>
    <input type="search" placeholder="Search vendor, notes…" value="${esc(q)}" data-filter="expenses:q">${btn('Export CSV', 'exportExpenses', 'btn-sm', '', 'download')}</div>
  <div class="grid grid-3"><div class="card stat"><div class="label">Total expenses</div><div class="value">${money(total)}</div>
    <div class="sub">${list.length} items · ${esc(db.settings.taxName)} paid ${money(sum(list, e => e.tax))}</div></div>
    <div class="card" style="grid-column:span 2"><h3 style="margin-bottom:6px">By category</h3>${hbars(catRows.slice(0, 6), total)}</div></div>
  <div class="card">${list.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th class="hide-sm">Job</th><th class="num">Amount</th></tr></thead><tbody>
    ${list.map(e => { const j = e.jobId && byId('jobs', e.jobId); return `<tr class="clickable" data-act="editExpense" data-id="${e.id}"><td>${fmtDate(e.date)}</td>
      <td>${esc(e.vendor || '—')} ${e.receipt ? `<span title="Receipt attached">${icon('receipt', 'muted').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')}</span>` : ''}<div class="muted small">${esc(e.notes || '')}</div></td>
      <td><span class="badge">${esc(e.category)}</span></td><td class="hide-sm">${j ? esc(j.title) : ''}</td><td class="num">${money(e.amount)}</td></tr>`; }).join('')}
  </tbody></table></div>` : empty('expense', 'No expenses for this period.', btn('Add expense', 'newExpense', 'btn-sm'))}</div>`;
};

/* ---------- Reports ---------- */
VIEWS.reports = () => {
  const p = filt('reports', 'period', 'ytd');
  const [from, to] = periodRange(p, state.filters.reports);
  const incList = incomeEntries().filter(x => inRange(x.date, from, to));
  const expList = db.expenses.filter(e => inRange(e.date, from, to));
  const inc = sum(incList, x => x.amount), exp = sum(expList, e => e.amount);
  const invs = db.invoices.filter(i => !i.void && invStatus(i) !== 'draft' && inRange(i.date, from, to));
  const taxCharged = sum(invs, i => totals(i).tax), taxPaid = sum(expList, e => e.tax);
  const billed = sum(invs, i => totals(i).total);
  const s = db.settings;
  // categories
  const byCat = {}; expList.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + +e.amount);
  const catRows = Object.entries(byCat).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  // top customers
  const byCust = {}; incList.forEach(x => { if (x.customerId) byCust[x.customerId] = (byCust[x.customerId] || 0) + x.amount; });
  const custRows = Object.entries(byCust).map(([id, value]) => ({ label: custName(id), value })).sort((a, b) => b.value - a.value).slice(0, 8);
  // income by lead source, revenue by team member
  const bySource = {}; incList.forEach(x => { const src = (x.customerId && cust(x.customerId)?.source) || 'Unknown'; bySource[src] = (bySource[src] || 0) + x.amount; });
  const sourceRows = Object.entries(bySource).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const byTeam = {}; db.jobs.filter(j => j.status === 'completed' && inRange(j.date, from, to)).forEach(j => { const k = j.assignedTo || 'Unassigned'; byTeam[k] = (byTeam[k] || 0) + jobValue(j); });
  const teamRows = Object.entries(byTeam).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  // aging
  const buckets = [['Not yet due', 0], ['1–30 days', 0], ['31–60 days', 0], ['61–90 days', 0], ['90+ days', 0]];
  db.invoices.filter(isOpenInv).forEach(i => {
    const late = i.dueDate ? daysBetween(i.dueDate, today()) : 0;
    const k = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4; buckets[k][1] += balance(i);
  });
  // quotes & jobs
  const qs = db.quotes.filter(q => inRange(q.date, from, to) && q.status !== 'draft');
  const won = qs.filter(q => ['approved', 'converted'].includes(q.status));
  const jobsDone = db.jobs.filter(j => j.status === 'completed' && inRange(j.date, from, to));
  const dist = sum(db.mileage.filter(m => inRange(m.date, from, to)), m => m.distance);
  const rangeLabel = from || to ? `${from ? fmtDate(from) : 'Beginning'} – ${to ? fmtDate(to) : 'today'}` : 'All time';

  return head('Reports', btn('Print', 'printPage', '', '', 'print'), rangeLabel) + `
  <div class="toolbar no-print">${periodSelect(p, 'reports:period')}${customRange('reports', p)}</div>
  <div class="grid grid-4">
    <div class="card stat"><div class="label">Income received</div><div class="value">${money(inc)}</div><div class="sub">${money(billed)} invoiced</div></div>
    <div class="card stat"><div class="label">Expenses</div><div class="value">${money(exp)}</div><div class="sub">${expList.length} items</div></div>
    <div class="card stat"><div class="label">Net profit</div><div class="value" style="color:${inc - exp < 0 ? 'var(--bad)' : 'inherit'}">${money(inc - exp)}</div><div class="sub">${inc ? Math.round((inc - exp) / inc * 100) + '% margin' : '—'}</div></div>
    <div class="card stat"><div class="label">Jobs completed</div><div class="value">${jobsDone.length}</div><div class="sub">${jobsDone.length ? 'avg ' + money(sum(jobsDone, jobValue) / jobsDone.length) + ' / job' : '—'}</div></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="card-head"><h2>Income vs expenses by month</h2></div>${incExpChart(monthlyRows(monthsInRange(from, to)))}</div>
  <div class="grid grid-2" style="margin-top:16px">
    <div class="card"><h2 style="margin-bottom:10px">Profit &amp; loss</h2>
      <table><tbody>
        <tr><td><b>Income</b></td><td class="num"><b>${money(inc)}</b></td></tr>
        <tr><td class="muted">Less ${esc(s.taxName)} collected (est.)</td><td class="num muted">−${money(inc && billed ? taxCharged * Math.min(1, inc / billed) : 0)}</td></tr>
        ${catRows.map(r => `<tr><td style="padding-left:18px">${esc(r.label)}</td><td class="num">−${money(r.value)}</td></tr>`).join('')}
        <tr><td><b>Total expenses</b></td><td class="num"><b>${money(exp)}</b></td></tr>
        <tr><td><b>Net profit (before tax)</b></td><td class="num"><b>${money(inc - exp - (inc && billed ? taxCharged * Math.min(1, inc / billed) : 0))}</b></td></tr>
        ${dist ? `<tr><td class="muted">Mileage deduction (${dist.toLocaleString()} ${esc(s.distanceUnit)})</td><td class="num muted">${money(dist * s.mileageRate)}</td></tr>` : ''}
      </tbody></table></div>
    <div class="card"><h2 style="margin-bottom:10px">Sales tax summary (${esc(s.taxName)})</h2>
      <table><tbody>
        <tr><td>Charged on invoices issued</td><td class="num">${money(taxCharged)}</td></tr>
        <tr><td>Paid on expenses (input tax credits)</td><td class="num">−${money(taxPaid)}</td></tr>
        <tr><td><b>Estimated net tax owing</b></td><td class="num"><b>${money(taxCharged - taxPaid)}</b></td></tr>
      </tbody></table>
      <p class="muted small">Estimate only — record the tax portion on each expense for accurate credits, and confirm with your accountant before filing.</p></div>
  </div>
  <div class="grid grid-2" style="margin-top:16px">
    <div class="card"><h2 style="margin-bottom:10px">Expenses by category</h2>${hbars(catRows, exp)}</div>
    <div class="card"><h2 style="margin-bottom:10px">Top customers</h2>${hbars(custRows, inc)}</div>
  </div>
  <div class="grid grid-2" style="margin-top:16px">
    <div class="card"><h2 style="margin-bottom:10px">Money owed to you (aging)</h2>
      <table><tbody>${buckets.map(([l, v], i) => `<tr><td>${l}</td><td class="num" style="color:${i >= 2 && v ? 'var(--bad)' : 'inherit'}">${money(v)}</td></tr>`).join('')}
      <tr><td><b>Total outstanding</b></td><td class="num"><b>${money(sum(buckets, b => b[1]))}</b></td></tr></tbody></table></div>
    <div class="card"><h2 style="margin-bottom:10px">Sales pipeline</h2>
      <table><tbody><tr><td>Quotes sent</td><td class="num">${qs.length} · ${money(sum(qs, q => totals(q).total))}</td></tr>
      <tr><td>Quotes won</td><td class="num">${won.length} · ${money(sum(won, q => totals(q).total))}</td></tr>
      <tr><td><b>Win rate</b></td><td class="num"><b>${qs.length ? Math.round(won.length / qs.length * 100) + '%' : '—'}</b></td></tr></tbody></table></div>
  </div>
  <div class="grid grid-2" style="margin-top:16px">
    <div class="card"><h2 style="margin-bottom:4px">Income by lead source</h2><p class="muted small" style="margin:0 0 8px">Where your paying customers come from. Set the source on each customer.</p>${hbars(sourceRows, inc)}</div>
    <div class="card"><h2 style="margin-bottom:4px">Completed work by team member</h2><p class="muted small" style="margin:0 0 8px">Value of jobs completed in this period.</p>${hbars(teamRows)}</div>
  </div>
  <div class="card no-print" style="margin-top:16px"><h2 style="margin-bottom:10px">Export for your accountant</h2>
    <div class="row">${btn('Invoices CSV', 'exportInvoices', 'btn-sm', '', 'download')}${btn('Payments CSV', 'exportIncome', 'btn-sm', '', 'download')}
    ${btn('Expenses CSV', 'exportExpenses', 'btn-sm', '', 'download')}${btn('Mileage CSV', 'exportMileage', 'btn-sm', '', 'download')}</div>
    <p class="muted small">Exports use the period selected above.</p></div>`;
};

/* ---------- Price book ---------- */
VIEWS.services = () => head('Price Book', btn('Add item', 'newService', 'btn-primary', '', 'plus'), 'Save your common services and materials so quotes and invoices take seconds.') + `<div class="card">
  ${db.services.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th class="hide-sm">Description</th><th>Unit</th><th>Taxable</th><th class="num">Price</th></tr></thead><tbody>
  ${[...db.services].sort((a, b) => a.name.localeCompare(b.name)).map(s => `<tr class="clickable" data-act="editService" data-id="${s.id}"><td><b>${esc(s.name)}</b></td><td class="hide-sm muted">${esc(s.description || '')}</td>
    <td>${esc(s.unit || '')}</td><td>${s.taxable !== false ? 'Yes' : 'No'}</td><td class="num">${money(s.price)}</td></tr>`).join('')}
  </tbody></table></div>` : empty('tag', 'Your price book is empty.', btn('Add your first service', 'newService', 'btn-sm'))}</div>`;

/* ---------- Settings ---------- */
VIEWS.settings = () => {
  const s = db.settings;
  const used = (() => { try { return (JSON.stringify(db).length / 1024 / 1024).toFixed(2); } catch { return '?'; } })();
  const sec = filt('settings', 'tab', 'business');
  const show = k => `${k === sec ? '' : 'hidden'}" data-sec="${k}`; // all sections stay in the form; tabs only hide them
  const SECS = [['business', 'Business'], ['money', 'Tax & money'], ['docs', 'Quotes & invoices'], ['messages', 'Messages'], ['lists', 'Pipeline & lists'], ['data', 'Data & backup']];
  return head('Settings') + `<div class="settings-layout">
  <nav class="settings-nav" aria-label="Settings sections">${SECS.map(([k, l]) => `<button type="button" data-settab="${k}" class="${k === sec ? 'active' : ''}">${l}</button>`).join('')}</nav>
  <div>
  <form id="settingsForm" class="stack">
  <div class="card ${show('business')}"><h2>Business details</h2><p class="muted small">Shown on your quotes, invoices and messages.</p>
    <div class="form-grid">
      ${field('Business name', inp('businessName', s.businessName, 'placeholder="e.g. Yonan Home Services"'))}
      ${field('Your name', inp('ownerName', s.ownerName))}
      ${field('Email', inp('email', s.email, 'type="email"'))}${field('Phone', inp('phone', s.phone, 'type="tel"'))}
      ${field('Business address', addrInput('address', s.address), 'full')}
      ${field('Website', inp('website', s.website))}${field('Tax / business number (e.g. HST #)', inp('taxNumber', s.taxNumber))}
      <div class="field full"><label>Logo</label><div class="row">${s.logo ? `<img src="${s.logo}" alt="Logo" style="height:48px;border-radius:6px;border:1px solid var(--border)">` : ''}
        <input type="file" accept="image/*" id="logoFile" style="width:auto">${s.logo ? '<button type="button" class="btn btn-sm" id="rmLogo">Remove</button>' : ''}</div></div>
      ${field('Theme', `<select name="theme">${opts([['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}</select>`)}
    </div></div>
  <div class="card ${show('money')}"><h2>Tax &amp; money</h2><div class="form-grid" style="margin-top:12px">
    ${field('Currency', `<select name="currency">${opts(['CAD', 'USD', 'GBP', 'EUR', 'AUD', 'NZD'], s.currency)}</select>`)}
    ${field('Tax name', inp('taxName', s.taxName))}
    ${field('Default tax rate (%)', inp('taxRate', s.taxRate, 'type="number" step="0.001" min="0"'))}
    ${field('Payment terms (days until due)', inp('dueDays', s.dueDays, 'type="number" min="0"'))}
    ${field('Monthly income goal (optional)', inp('monthlyGoal', s.monthlyGoal || '', 'type="number" min="0" step="100" placeholder="e.g. 10000"'))}<div></div>
    ${field('Mileage rate (per unit)', inp('mileageRate', s.mileageRate, 'type="number" step="0.01" min="0"'))}
    ${field('Distance unit', `<select name="distanceUnit">${opts(['km', 'mi'], s.distanceUnit)}</select>`)}
  </div></div>
  <div class="card ${show('docs')}"><h2>Quotes &amp; invoices</h2><div class="form-grid" style="margin-top:12px">
    ${field('Invoice number prefix', inp('invoicePrefix', s.invoicePrefix))}${field('Next invoice number', inp('nextInvoiceNo', s.nextInvoiceNo, 'type="number"'))}
    ${field('Quote number prefix', inp('quotePrefix', s.quotePrefix))}${field('Next quote number', inp('nextQuoteNo', s.nextQuoteNo, 'type="number"'))}
    ${field('Quotes valid for (days)', inp('quoteValidDays', s.quoteValidDays, 'type="number" min="0"'))}<div></div>
    ${field('How customers can pay you (printed on invoices)', `<textarea name="paymentInstructions" placeholder="e.g. e-Transfer to you@email.com">${esc(s.paymentInstructions)}</textarea>`, 'full')}
    ${field('Online payment link (optional)', inp('paymentLink', s.paymentLink, 'type="url" placeholder="Stripe, Square or PayPal payment link"'), 'full')}
    ${field('Review link (optional)', inp('reviewLink', s.reviewLink, 'type="url" placeholder="Your Google review link"'), 'full')}
    ${field('Default invoice note', `<textarea name="invoiceNotes">${esc(s.invoiceNotes)}</textarea>`, 'full')}
    ${field('Default quote note / terms', `<textarea name="quoteNotes">${esc(s.quoteNotes)}</textarea>`, 'full')}
  </div></div>
  <div class="card ${show('messages')}"><h2>Message templates</h2>
    <p class="muted small">Used when you text or email customers. Placeholders: <code>{first}</code> <code>{customer}</code> <code>{business}</code> <code>{number}</code> <code>{total}</code>
    <code>{balance}</code> <code>{due}</code> <code>{valid}</code> <code>{items}</code> <code>{date}</code> <code>{time}</code> <code>{pay}</code> <code>{review}</code> <code>{signature}</code></p>
    <div class="stack" style="gap:12px">${TEMPLATES.map(([k, l]) => field(l, `<textarea name="${k}" rows="3">${esc(s[k])}</textarea>`)).join('')}</div>
    <div style="margin-top:10px">${btn('Reset templates to default', 'resetTemplates', 'btn-sm')}</div></div>
  <div class="card ${show('lists')}"><h2>Lead pipeline stages</h2>
    <p class="muted small">Rename, add or remove the stages on your Leads board. <b>Won</b> and <b>Lost</b> are always there at the end.</p>
    <div class="stage-list js-stages">${openStages().map(st => stageRow(st)).join('')}</div>
    <button type="button" class="btn btn-sm js-add-stage" style="margin-top:8px">${icon('plus')}Add stage</button></div>
  <div class="card ${show('lists')}"><h2>Expense categories</h2>
    ${field('One per line', `<textarea name="categories" rows="8">${esc(db.categories.join('\n'))}</textarea>`)}</div>
  <div class="row ${sec === 'data' ? 'hidden' : ''}" data-sec-save><button class="btn btn-primary" type="submit">Save settings</button></div>
  </form>
  <div class="card ${show('data')}"><h2>Your data</h2>
    <p class="muted small">Everything is saved privately in this browser on this device (${used} MB used). <b>Download a backup regularly</b>, and use Restore to move your data to another phone or computer.
    ${s.lastBackup ? `Last backup: ${fmtDate(s.lastBackup)}.` : '<b style="color:var(--warn)">You haven’t made a backup yet.</b>'}</p>
    <div class="row">${btn('Download backup', 'exportBackup', 'btn-primary', '', 'download')}${btn('Restore from backup', 'importBackup')}</div>
    <h3 style="margin:20px 0 6px">Try it out</h3><p class="muted small" style="margin-top:0">Fill the app with example customers, jobs and invoices.</p>
    <div class="row">${btn('Load sample data', 'loadSample')}${btn('Erase everything', 'eraseAll', 'btn-danger')}</div></div>
  </div></div>`;
};
const stageRow = st => `<div class="stage-row" data-stage-id="${esc(st.id)}"><span class="muted">⋮⋮</span><input name="stage:${esc(st.id)}" value="${esc(st.label)}" aria-label="Stage name" required>
  <span class="muted small">${db.leads.filter(l => l.stage === st.id).length} leads</span><button type="button" class="btn btn-icon js-rm-stage" aria-label="Remove stage">✕</button></div>`;
document.addEventListener('click', e => {
  if (e.target.closest('.js-add-stage')) {
    $('.js-stages').insertAdjacentHTML('beforeend', stageRow({ id: 'st_' + uid(), label: '' }));
    $$('.js-stages input').pop().focus();
  }
  const rm = e.target.closest('.js-rm-stage');
  if (rm) {
    if ($$('.js-stages .stage-row').length <= 1) return toast('Keep at least one stage');
    const row = rm.closest('.stage-row'), n = db.leads.filter(l => l.stage === row.dataset.stageId).length;
    if (n && !confirm(`${n} lead(s) are in this stage. They will move to the first stage when you save. Remove it?`)) return;
    row.remove();
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-settab]'); if (!b) return;
  const k = b.dataset.settab; (state.filters.settings ||= {}).tab = k;
  $$('[data-settab]').forEach(x => x.classList.toggle('active', x === b));
  $$('[data-sec]').forEach(x => x.classList.toggle('hidden', x.dataset.sec !== k));
  $('[data-sec-save]')?.classList.toggle('hidden', k === 'data');
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'settingsForm') return;
  e.preventDefault();
  const fd = new FormData(e.target), d = {};
  const stages = [];
  for (const [k, v] of fd.entries()) {
    if (k.startsWith('stage:')) { if (String(v).trim()) stages.push({ id: k.slice(6), label: String(v).trim() }); } else d[k] = v;
  }
  const cats = (d.categories || '').split('\n').map(x => x.trim()).filter(Boolean);
  delete d.categories;
  for (const k of ['taxRate', 'dueDays', 'mileageRate', 'nextInvoiceNo', 'nextQuoteNo', 'quoteValidDays', 'monthlyGoal']) if (k in d) d[k] = +d[k] || 0;
  const oldAddress = db.settings.address;
  Object.assign(db.settings, d);
  if (cats.length) db.categories = cats;
  if (stages.length) {
    db.settings.leadStages = stages;
    const ids = new Set([...stages.map(x => x.id), 'won', 'lost']);
    db.leads.forEach(l => { if (!ids.has(l.stage)) l.stage = stages[0].id; });
  }
  refresh(); toast('Settings saved');
  // Centre address suggestions on the business location
  if (d.address && d.address !== oldAddress) {
    fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(d.address)}&limit=1`).then(r => r.json()).then(j => {
      const c = j.features?.[0]?.geometry?.coordinates; if (c) { db.settings.mapCenter = `${c[1].toFixed(3)},${c[0].toFixed(3)}`; save(); }
    }).catch(() => {});
  }
});

/* =====================================================================
 * Forms (create / edit)
 * ===================================================================== */
function customerForm(c, onSaved) {
  const isNew = !c; c ||= {};
  modal({ title: isNew ? 'New customer' : 'Edit customer', body: `<div class="form-grid">
    ${field('Name *', inp('name', c.name, 'required placeholder="Full name or company"'), 'full')}
    ${field('Mobile phone', inp('phone', c.phone, 'type="tel"'))}${field('Email', inp('email', c.email, 'type="email"'))}
    ${field('Address', addrInput('address', c.address), 'full')}
    ${field('Tags', inp('tags', c.tags, 'placeholder="e.g. residential, referral"'))}
    ${field('How they found you', `<select name="source">${opts(LEAD_SOURCES.map(x => [x, x || '—']), c.source || '')}</select>`)}
    ${field('Notes', `<textarea name="notes" placeholder="Gate code, pets, preferences…">${esc(c.notes)}</textarea>`, 'full')}</div>`,
    onSubmit: (f, d) => {
      if (isNew) {
        const digits = x => String(x || '').replace(/\D/g, '').slice(-10);
        const dup = db.customers.find(x => (d.phone && digits(x.phone) && digits(x.phone) === digits(d.phone)) || (d.email && x.email && x.email.toLowerCase() === d.email.trim().toLowerCase()));
        if (dup && !confirm(`${dup.name} already has this phone number or email. Add a new customer anyway?`)) return false;
      }
      Object.assign(c, d, { name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim() });
      if (isNew) { c.id = uid(); c.createdAt = today(); db.customers.push(c); }
      save(); toast(isNew ? 'Customer added' : 'Customer saved');
      if (onSaved) onSaved(c); else render();
    } });
}

const laterInSeries = j => db.jobs.filter(x => x.seriesId && x.seriesId === j.seriesId && x.id !== j.id && x.status === 'scheduled' && (x.date || '') > (j.date || ''));

/* Repeat controls, shared by the job form and "extend plan". */
function repeatFieldsHTML(withNone = true) {
  return `${field('Repeat', `<select name="repeat">${opts([...(withNone ? [['', 'Does not repeat']] : []), ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'],
      ['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year'], ['custom', 'Custom…']], withNone ? '' : 'weekly')}</select>`)}
    <div class="repeat-box js-repeat full ${withNone ? 'hidden' : ''}">
      <div class="js-custom hidden">
        <div class="row"><span>Every</span><input name="rInterval" type="number" min="1" max="52" value="1" style="width:72px" aria-label="Interval">
          <select name="rFreq" style="width:auto" aria-label="Unit">${opts([['day', 'day(s)'], ['week', 'week(s)'], ['month', 'month(s)']], 'week')}</select></div>
        <div class="js-weekdays day-chips">${WEEKDAYS.map((d, i) => `<label class="chip"><input type="checkbox" name="rDay" value="${i}"><span>${d}</span></label>`).join('')}</div>
      </div>
      <div class="row"><span>Ends</span>
        <select name="rEnd" style="width:auto" aria-label="Ends">${opts([['count', 'After'], ['until', 'On date']], 'count')}</select>
        <span class="js-end-count row" style="gap:6px"><input name="rCount" type="number" min="1" max="156" value="12" style="width:78px" aria-label="Number of visits"> visits</span>
        <input name="rUntil" type="date" class="js-end-until hidden" style="width:auto" aria-label="End date" value="${addMonths(today(), 6)}">
      </div>
      <div class="muted small js-repeat-preview"></div>
    </div>`;
}
function readRule(f, startDate) {
  const v = f.repeat.value; if (!v) return null;
  const dow = parseD(startDate || today()).getDay();
  const base = { weekly: { freq: 'week', interval: 1, weekdays: [dow] }, biweekly: { freq: 'week', interval: 2, weekdays: [dow] },
    monthly: { freq: 'month', interval: 1 }, quarterly: { freq: 'month', interval: 3 }, yearly: { freq: 'month', interval: 12 } }[v]
    || { freq: f.rFreq.value, interval: +f.rInterval.value || 1, weekdays: new FormData(f).getAll('rDay').map(Number) };
  if (base.freq === 'week' && !base.weekdays?.length) base.weekdays = [dow];
  if (base.freq !== 'week') delete base.weekdays;
  return f.rEnd.value === 'until' ? { ...base, until: f.rUntil.value } : { ...base, count: Math.min(156, Math.max(1, +f.rCount.value || 1)) };
}
function bindRepeat(f, getStart) {
  const box = $('.js-repeat', f), custom = $('.js-custom', f), wd = $('.js-weekdays', f), prev = $('.js-repeat-preview', f);
  const sync = () => {
    const v = f.repeat.value, start = getStart() || today();
    box.classList.toggle('hidden', !v);
    custom.classList.toggle('hidden', v !== 'custom');
    wd.classList.toggle('hidden', f.rFreq.value !== 'week');
    $('.js-end-count', f).classList.toggle('hidden', f.rEnd.value !== 'count');
    $('.js-end-until', f).classList.toggle('hidden', f.rEnd.value !== 'until');
    if (v === 'custom' && f.rFreq.value === 'week' && !$$('[name=rDay]:checked', f).length) $(`[name=rDay][value="${parseD(start).getDay()}"]`, f).checked = true;
    const rule = readRule(f, start);
    if (!rule) { prev.textContent = ''; return; }
    const dates = recurDates(start, rule);
    prev.innerHTML = dates.length ? `<b>${dates.length} visit${dates.length > 1 ? 's' : ''}</b> · ${ruleLabel(rule)} · ${dates.slice(0, 3).map(fmtDateShort).join(', ')}${dates.length > 3 ? ` … ${fmtDateShort(dates.at(-1))}` : ''}` : 'No dates match. Check the end date.';
  };
  f.addEventListener('input', e => { if (e.target.closest('.js-repeat') || ['repeat', 'date'].includes(e.target.name)) sync(); });
  f.addEventListener('change', e => { if (e.target.closest('.js-repeat') || ['repeat', 'date'].includes(e.target.name)) sync(); });
  sync();
}
function assigneeField(value) {
  const names = db.team.map(m => m.name);
  if (!names.length) {
    return field('Assigned to', inp('assignedTo', value, 'placeholder="Team member" list="teamList"') +
      `<datalist id="teamList">${teamMembers().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`);
  }
  const extra = value && !names.includes(value) ? [value] : [];
  return field('Assigned to', `<select name="assignedTo">${opts([['', 'Unassigned'], ...[...names, ...extra].map(n => [n, n])], value || '')}</select>`);
}

function jobForm(j, preset = {}) {
  const isNew = !j; j ||= { status: 'scheduled', date: preset.date || today(), ...preset };
  const c = cust(j.customerId);
  const later = !isNew && j.seriesId ? laterInSeries(j) : [];
  modal({ title: isNew ? 'New job' : 'Edit job', wide: true, body: `
  <div class="form-section"><div class="form-grid">
    ${field('Customer *', customerSelect(j.customerId), 'full')}
    ${field('Job title *', inp('title', j.title, 'required placeholder="e.g. Furnace tune-up" list="svcTitles"') + `<datalist id="svcTitles">${db.services.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>`, 'full')}
    ${field('Service address', addrInput('address', j.address ?? c?.address ?? ''), 'full')}
  </div></div>
  <div class="form-section"><h3>When &amp; who</h3><div class="form-grid">
    ${field('Date', inp('date', j.date, 'type="date"'))}
    <div class="form-grid" style="gap:8px">${field('Start', inp('start', j.start, 'type="time"'))}${field('End', inp('end', j.end, 'type="time"'))}</div>
    ${assigneeField(j.assignedTo)}
    ${isNew ? '' : field('Status', `<select name="status">${opts([['scheduled', 'Scheduled'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']], j.status)}</select>`)}
    ${isNew ? repeatFieldsHTML() : ''}
    ${later.length ? `<label class="check full"><input type="checkbox" name="applySeries"> Also apply changes to the ${later.length} later visit(s) in this series (dates stay the same)</label>` : ''}
  </div></div>
  <div class="form-section">${field('Notes / instructions', `<textarea name="notes" placeholder="Gate code, scope of work, materials to bring…">${esc(j.notes)}</textarea>`)}</div>
  <details class="form-section" ${(j.items || []).length ? 'open' : ''}><summary><h3>Line items <span class="muted small">(optional, used when you invoice)</span></h3></summary>${itemsEditorHTML(j)}</details>`,
    onMount: f => {
      j._getItems = mountItemsEditor(f, j);
      bindCustomerSelect(f, nc => { if (nc && !f.address.value) f.address.value = nc.address || ''; });
      if (isNew && j.repeat) f.repeat.value = j.repeat;
      if (isNew) bindRepeat(f, () => f.date.value);
    },
    onSubmit: (f, d) => {
      const items = j._getItems();
      const rule = isNew ? readRule(f, d.date || today()) : null;
      if (rule && !d.date) { toast('Pick a start date for a repeating job'); return false; }
      delete j._getItems;
      const base = { customerId: d.customerId, title: d.title.trim(), date: d.date, start: d.start, end: d.end, address: d.address,
        assignedTo: d.assignedTo, status: d.status || j.status || 'scheduled', notes: d.notes, items, discount: +d.discount || 0, taxRate: d.taxRate === '' ? db.settings.taxRate : +d.taxRate };
      if (!isNew) {
        const apply = d.applySeries ? later : [];
        Object.assign(j, base);
        const { date: _d, status: _s, ...shared } = base;
        apply.forEach(x => Object.assign(x, { ...shared, items: structuredClone(items) }));
        save(); toast(apply.length ? `Job and ${apply.length} later visit(s) updated` : 'Job saved'); render(); return;
      }
      const dates = rule ? recurDates(d.date, rule) : [d.date];
      if (!dates.length) { toast('No visit dates match that repeat setting'); return false; }
      const series = dates.length > 1 ? uid() : undefined;
      let firstId;
      dates.forEach((date, i) => {
        const nj = { ...base, items: structuredClone(items), id: uid(), createdAt: today(), date, seriesId: series, seriesRule: series ? rule : undefined, quoteId: i === 0 ? j.quoteId : undefined };
        if (i > 0) nj.status = 'scheduled';
        db.jobs.push(nj); firstId ||= nj.id;
      });
      if (j.quoteId) { const q = byId('quotes', j.quoteId); if (q) { q.status = 'converted'; q.jobId = firstId; } }
      if (j.leadId) { const l = byId('leads', j.leadId); if (l) { l.stage = 'won'; l.closedAt = today(); } }
      save(); toast(dates.length > 1 ? `${dates.length} visits scheduled` : d.date ? 'Job scheduled' : 'Job saved (no date yet)');
      go('#/jobs/' + firstId);
    } });
}

function docForm(type, d, preset = {}) {
  const isInv = type === 'invoice', isNew = !d, s = db.settings;
  d ||= { customerId: preset.customerId, date: today(), items: preset.items || [], notes: isInv ? s.invoiceNotes : s.quoteNotes,
    taxRate: s.taxRate, discount: preset.discount || 0, jobId: preset.jobId, quoteId: preset.quoteId, leadId: preset.leadId, serviceAddress: preset.serviceAddress };
  if (isNew) { if (isInv) d.dueDate = addDays(d.date, +s.dueDays || 0); else d.validUntil = addDays(d.date, +s.quoteValidDays || 30); }
  const dateField = isInv ? field('Due date', inp('dueDate', d.dueDate, 'type="date"')) : field('Valid until', inp('validUntil', d.validUntil, 'type="date"'));
  modal({ title: `${isNew ? 'New' : 'Edit'} ${type}`, wide: true, submitLabel: isNew ? `Create ${type}` : 'Save', body: `<div class="form-grid">
    ${field('Customer *', customerSelect(d.customerId), 'full')}
    ${field(isInv ? 'Invoice date' : 'Quote date', inp('date', d.date, 'type="date" required'))}${dateField}
    ${field('Service address (if different from the customer)', addrInput('serviceAddress', d.serviceAddress), 'full')}
  </div><h3 style="margin:16px 0 8px">Line items</h3>${itemsEditorHTML(d)}
  ${!isInv ? field('Deposit required (% of total, optional)', inp('depositPct', d.depositPct || '', 'type="number" min="0" max="100" step="1" placeholder="e.g. 25"')) : ''}
  ${field('Notes shown to customer', `<textarea name="notes">${esc(d.notes)}</textarea>`, 'full')}`,
    onMount: f => { d._getItems = mountItemsEditor(f, d); bindCustomerSelect(f); },
    onSubmit: (f, v) => {
      const items = d._getItems();
      if (!items.length) { toast('Add at least one line item'); return false; }
      delete d._getItems;
      Object.assign(d, { customerId: v.customerId, date: v.date, notes: v.notes, serviceAddress: v.serviceAddress, items,
        discount: +v.discount || 0, taxRate: v.taxRate === '' ? s.taxRate : +v.taxRate });
      if (isInv) d.dueDate = v.dueDate; else { d.validUntil = v.validUntil; d.depositPct = Math.min(100, Math.max(0, +v.depositPct || 0)); }
      if (isNew) {
        Object.assign(d, { id: uid(), number: nextNumber(type), createdAt: today() });
        if (isInv) { d.payments = []; db.invoices.push(d); } else { d.status = 'draft'; db.quotes.push(d); }
        if (d.jobId) { const j = byId('jobs', d.jobId); if (j) j.invoiceId = d.id; }
        if (d.quoteId) { const q = byId('quotes', d.quoteId); if (q) { q.status = 'converted'; q.invoiceId = d.id; } }
        if (d.leadId) { const l = byId('leads', d.leadId); if (l) { if (openStages().some(x => x.id === 'quoted')) l.stage = 'quoted'; l.quoteId = d.id; } }
      }
      save(); toast(isNew ? `${isInv ? 'Invoice' : 'Quote'} ${d.number} created` : 'Saved');
      go(`#/${isInv ? 'invoices' : 'quotes'}/${d.id}`);
    } });
}

function expenseForm(e, preset = {}) {
  const isNew = !e; e ||= { date: today(), category: db.categories[0], method: 'Debit', ...preset };
  let receipt = e.receipt || '';
  const jobs = db.jobs.filter(j => j.status !== 'cancelled').sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 200);
  modal({ title: isNew ? 'Add expense' : 'Edit expense', body: `<div class="form-grid">
    ${field('Amount (total paid) *', inp('amount', e.amount, 'type="number" step="0.01" min="0" required inputmode="decimal"'))}
    ${field('Date *', inp('date', e.date, 'type="date" required'))}
    ${field('Vendor / store', inp('vendor', e.vendor, `list="vendorList" placeholder="e.g. Home Depot"`) + `<datalist id="vendorList">${[...new Set(db.expenses.map(x => x.vendor).filter(Boolean))].map(v => `<option value="${esc(v)}">`).join('')}</datalist>`)}
    ${field('Category', `<select name="category">${opts(db.categories, e.category)}</select>`)}
    ${field(`${esc(db.settings.taxName)} included (optional)`, inp('tax', e.tax, 'type="number" step="0.01" min="0" placeholder="Tax portion of the total"') + `<button type="button" class="btn btn-sm js-calc-tax" style="margin-top:4px;align-self:flex-start">Calculate at ${db.settings.taxRate}%</button>`)}
    ${field('Paid with', `<select name="method">${opts(['Debit', 'Credit card', 'Cash', 'e-Transfer', 'Cheque', 'Bank transfer', 'Other'], e.method)}</select>`)}
    ${field('Link to job (for job costing)', `<select name="jobId"><option value="">— None —</option>${jobs.map(j => `<option value="${j.id}" ${j.id === e.jobId ? 'selected' : ''}>${esc(fmtDate(j.date) + ' · ' + j.title + ' · ' + custName(j.customerId))}</option>`).join('')}</select>`, 'full')}
    ${field('Notes', `<textarea name="notes" rows="2">${esc(e.notes)}</textarea>`, 'full')}
    ${e.recurFrom ? '' : `<label class="check full"><input type="checkbox" name="recurring" ${e.recurring ? 'checked' : ''}> Repeats every month (adds it automatically, e.g. insurance, phone, software)</label>`}
    <div class="field full"><label>Receipt photo</label><input type="file" accept="image/*" capture="environment" class="js-receipt">
      <div class="js-receipt-prev" style="margin-top:6px">${receipt ? `<img src="${receipt}" style="max-height:160px;border-radius:8px"><br><button type="button" class="btn btn-sm js-rm-receipt">Remove photo</button>` : ''}</div></div>
  </div>`, footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => {
      $('.js-calc-tax', f).addEventListener('click', () => { const r = +db.settings.taxRate; f.tax.value = round2((+f.amount.value || 0) * r / (100 + r)).toFixed(2); });
      const prev = $('.js-receipt-prev', f);
      $('.js-receipt', f).addEventListener('change', async ev => {
        const file = ev.target.files[0]; if (!file) return;
        try { receipt = await readImage(file, 1100, 0.6); prev.innerHTML = `<img src="${receipt}" style="max-height:160px;border-radius:8px">`; }
        catch { toast('Could not read that image'); }
      });
      prev.addEventListener('click', ev => { if (ev.target.closest('.js-rm-receipt')) { receipt = ''; prev.innerHTML = ''; } });
      $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.expenses = db.expenses.filter(x => x.id !== e.id); close(); refresh(); undoToast(snap, 'Expense deleted'); });
    },
    onSubmit: (f, d) => {
      const wasRecurring = e.recurring;
      Object.assign(e, { amount: round2(d.amount), date: d.date, vendor: d.vendor.trim(), category: d.category, tax: d.tax === '' ? 0 : round2(d.tax),
        method: d.method, jobId: d.jobId, notes: d.notes, receipt, recurring: !!d.recurring });
      if (e.recurring && !wasRecurring) e.recurNext = addMonths(e.date, 1);
      if (!e.recurring) e.recurNext = '';
      if (isNew) { e.id = uid(); db.expenses.push(e); }
      refresh(); toast(isNew ? 'Expense added' : 'Expense saved');
    } });
}

function incomeForm(x) {
  const isNew = !x; x ||= { date: today(), method: 'Cash' };
  modal({ title: isNew ? 'Add other income' : 'Edit income', body: `<div class="form-grid">
    ${field('Amount *', inp('amount', x.amount, 'type="number" step="0.01" min="0" required inputmode="decimal"'))}${field('Date *', inp('date', x.date, 'type="date" required'))}
    ${field('Description *', inp('source', x.source, 'required placeholder="e.g. Cash job – gutter clean"'), 'full')}
    ${field('Customer (optional)', `<select name="customerId"><option value="">— None —</option>${opts(db.customers.map(c => [c.id, c.name]), x.customerId)}</select>`)}
    ${field('Method', `<select name="method">${opts(PAY_METHODS, x.method)}</select>`)}
  </div>`, footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.incomes = db.incomes.filter(i => i.id !== x.id); close(); refresh(); undoToast(snap, 'Income deleted'); }),
    onSubmit: (f, d) => {
      Object.assign(x, { amount: round2(d.amount), date: d.date, source: d.source, customerId: d.customerId, method: d.method });
      if (isNew) { x.id = uid(); db.incomes.push(x); }
      refresh(); toast('Income saved');
    } });
}

function tripForm(m) {
  const isNew = !m; m ||= { date: today() }; const u = db.settings.distanceUnit;
  modal({ title: isNew ? 'Log a trip' : 'Edit trip', body: `<div class="form-grid">
    ${field('Date *', inp('date', m.date, 'type="date" required'))}${field(`Distance (${u}) *`, inp('distance', m.distance, 'type="number" step="0.1" min="0" required inputmode="decimal"'))}
    ${field('Purpose *', inp('purpose', m.purpose, 'required placeholder="e.g. Job at 12 Main St, supply run"'), 'full')}
    ${field('Route (optional)', inp('route', m.route, 'placeholder="From → to"'), 'full')}</div>`,
    footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.mileage = db.mileage.filter(x => x.id !== m.id); close(); refresh(); undoToast(snap, 'Trip deleted'); }),
    onSubmit: (f, d) => {
      Object.assign(m, { date: d.date, distance: +d.distance || 0, purpose: d.purpose, route: d.route });
      if (isNew) { m.id = uid(); db.mileage.push(m); }
      refresh(); toast('Trip saved');
    } });
}

function serviceForm(s) {
  const isNew = !s; s ||= { taxable: true, unit: 'each' };
  modal({ title: isNew ? 'Add price book item' : 'Edit item', body: `<div class="form-grid">
    ${field('Name *', inp('name', s.name, 'required placeholder="e.g. Service call"'), 'full')}
    ${field('Price *', inp('price', s.price, 'type="number" step="0.01" min="0" required'))}
    ${field('Unit', `<select name="unit">${opts(['each', 'hour', 'sq ft', 'ft', 'visit', 'day', 'job'], s.unit)}</select>`)}
    ${field('Description', inp('description', s.description), 'full')}
    <label class="check full"><input type="checkbox" name="taxable" ${s.taxable !== false ? 'checked' : ''}> Charge ${esc(db.settings.taxName)} on this item</label></div>`,
    footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.services = db.services.filter(x => x.id !== s.id); close(); refresh(); undoToast(snap, 'Item deleted'); }),
    onSubmit: (f, d) => {
      Object.assign(s, { name: d.name.trim(), price: round2(d.price), unit: d.unit, description: d.description, taxable: !!d.taxable });
      if (isNew) { s.id = uid(); db.services.push(s); }
      refresh(); toast('Saved');
    } });
}

function leadForm(l) {
  const isNew = !l; l ||= { stage: firstStage(), followUp: addDays(today(), 1) };
  const linked = l.customerId && cust(l.customerId);
  const q = l.quoteId && byId('quotes', l.quoteId);
  modal({ title: isNew ? 'New lead' : 'Lead', body: `
    ${!isNew ? `<div class="row" style="margin-bottom:14px">
      <button type="button" class="btn btn-sm btn-primary js-lead-quote">${icon('quote')}${q ? 'View quote' : 'Create quote'}</button>
      <button type="button" class="btn btn-sm js-lead-job">${icon('calendar')}Book job</button>
      ${l.phone ? `<a class="btn btn-sm" href="tel:${esc(l.phone)}">${icon('phone')}Call</a><a class="btn btn-sm" href="${smsHref(l.phone, '')}">${icon('sms')}Text</a>` : ''}
      ${l.email ? `<a class="btn btn-sm" href="mailto:${esc(l.email)}">${icon('mail')}Email</a>` : ''}
      ${linked ? `<a class="btn btn-sm" href="#/customers/${linked.id}">${icon('users')}Customer</a>` : ''}</div>` : ''}
    <div class="form-grid">
    ${field('Name *', inp('name', l.name, 'required placeholder="Who is asking?"'), 'full')}
    ${field('Phone', inp('phone', l.phone, 'type="tel"'))}${field('Email', inp('email', l.email, 'type="email"'))}
    ${field('Address', addrInput('address', l.address), 'full')}
    ${field('What do they need?', inp('service', l.service, 'list="svcList2" placeholder="e.g. Gutter cleaning"') + `<datalist id="svcList2">${db.services.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>`)}
    ${field('Estimated value', inp('value', l.value || '', 'type="number" min="0" step="1" inputmode="decimal"'))}
    ${field('Stage', `<select name="stage">${opts(leadStages(), l.stage)}</select>`)}
    ${field('Follow up on', inp('followUp', l.followUp, 'type="date"'))}
    ${field('How they found you', `<select name="source">${opts(LEAD_SOURCES.map(x => [x, x || '—']), l.source || '')}</select>`)}
    ${field('Notes', `<textarea name="notes" rows="2">${esc(l.notes)}</textarea>`, 'full')}</div>`,
    footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => {
      const apply = () => { if (!f.reportValidity()) return false; saveLead(Object.fromEntries(new FormData(f))); return true; };
      $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.leads = db.leads.filter(x => x.id !== l.id); close(); refresh(); undoToast(snap, 'Lead deleted'); });
      $('.js-lead-quote', f)?.addEventListener('click', () => {
        if (!apply()) return; close();
        if (q) return go('#/quotes/' + q.id);
        const c = leadToCustomer(l); save();
        docForm('quote', null, { customerId: c.id, leadId: l.id, serviceAddress: l.address,
          items: l.service ? [{ desc: l.service, qty: 1, price: +l.value || '', taxable: true }] : [] });
      });
      $('.js-lead-job', f)?.addEventListener('click', () => {
        if (!apply()) return; close();
        const c = leadToCustomer(l); save();
        jobForm(null, { customerId: c.id, title: l.service || '', address: l.address, leadId: l.id, quoteId: q?.id,
          items: q ? structuredClone(q.items) : [] });
      });
    },
    onSubmit: (f, d) => { saveLead(d); refresh(); toast(isNew ? 'Lead added' : 'Lead saved'); } });
  function saveLead(d) {
    const was = l.stage;
    Object.assign(l, { name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim(), address: d.address, service: d.service, value: +d.value || 0,
      stage: d.stage, followUp: d.followUp, source: d.source, notes: d.notes });
    if (l.stage !== was && ['won', 'lost'].includes(l.stage)) l.closedAt = today();
    if (isNew && !l.id) { l.id = uid(); l.createdAt = today(); db.leads.push(l); }
  }
}
function leadToCustomer(l) {
  let c = l.customerId && cust(l.customerId);
  const digits = x => String(x || '').replace(/\D/g, '').slice(-10);
  c ||= db.customers.find(x => (l.phone && digits(x.phone) === digits(l.phone)) || (l.email && (x.email || '').toLowerCase() === l.email.toLowerCase()));
  if (!c) {
    c = { id: uid(), createdAt: today(), name: l.name, phone: l.phone || '', email: l.email || '', address: l.address || '', source: l.source || '', notes: l.notes || '' };
    db.customers.push(c); toast(`${c.name} added to customers`);
  }
  l.customerId = c.id;
  if (l.stage === firstStage() && openStages()[1]) l.stage = openStages()[1].id;
  return c;
}

function taskForm(x, preset = {}) {
  const isNew = !x; x ||= { due: today(), ...preset };
  modal({ title: isNew ? 'New to-do' : 'Edit to-do', body: `<div class="form-grid">
    ${field('What needs doing? *', inp('title', x.title, 'required placeholder="e.g. Call back about the fence quote"'), 'full')}
    ${field('Due date', inp('due', x.due, 'type="date"'))}${field('Time (optional)', inp('time', x.time, 'type="time"'))}
    ${field('Customer (optional)', `<select name="customerId"><option value="">— None —</option>${opts([...db.customers].sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.id, c.name]), x.customerId)}</select>`, 'full')}
    ${field('Notes', `<textarea name="notes" rows="2">${esc(x.notes)}</textarea>`, 'full')}</div>`,
    footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.tasks = db.tasks.filter(t => t.id !== x.id); close(); refresh(); undoToast(snap, 'To-do deleted'); }),
    onSubmit: (f, d) => {
      Object.assign(x, { title: d.title.trim(), due: d.due, time: d.time, customerId: d.customerId, notes: d.notes });
      if (isNew) { x.id = uid(); x.createdAt = today(); x.done = false; db.tasks.push(x); }
      refresh(); toast('To-do saved');
    } });
}

function photoViewer(j, pid) {
  const ph = (j.photos || []).find(p => p.id === pid); if (!ph) return;
  modal({ title: `Photo · ${fmtDate(ph.date)}`, wide: true, noFoot: true, body: `<img src="${ph.src}" alt="" style="width:100%;border-radius:8px">
    <div class="row" style="margin-top:12px"><a class="btn btn-sm" href="${ph.src}" download="job-photo-${ph.date}.jpg">${icon('download')}Save</a>
    <button type="button" class="btn btn-sm btn-danger js-del">${icon('trash')}Delete photo</button></div>`,
    onMount: (f, close) => $('.js-del', f).addEventListener('click', () => { const snap = snapshot(); j.photos = j.photos.filter(p => p.id !== pid); close(); refresh(); undoToast(snap, 'Photo deleted'); }) });
}

function openSearch() {
  if ($('#modalRoot .search-modal')) return;
  const { form } = modal({ title: 'Search', noFoot: true, body: `<input type="search" class="js-q" placeholder="Customers, jobs, invoices, quotes, leads…" data-nodirty autofocus>
    <div class="js-results search-results"></div>` });
  form.closest('.modal-backdrop').classList.add('search-modal');
  const input = $('.js-q', form), out = $('.js-results', form);
  const run = () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { out.innerHTML = '<p class="muted small">Type at least 2 letters.</p>'; return; }
    const has = (...xs) => xs.join(' ').toLowerCase().includes(q);
    const groups = [
      ['Customers', db.customers.filter(c => has(c.name, c.phone, c.email, c.address)).map(c => [`#/customers/${c.id}`, c.name, [c.phone, c.address].filter(Boolean).join(' · ')])],
      ['Leads', db.leads.filter(l => has(l.name, l.phone, l.service)).map(l => [`lead:${l.id}`, l.name, `${l.service || ''} · ${l.stage}`])],
      ['Jobs', db.jobs.filter(j => has(j.title, custName(j.customerId), j.address)).sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(j => [`#/jobs/${j.id}`, j.title, `${custName(j.customerId)} · ${j.date ? fmtDate(j.date) : 'no date'}`])],
      ['Quotes', db.quotes.filter(x => has(x.number, custName(x.customerId))).map(x => [`#/quotes/${x.id}`, `${x.number} · ${custName(x.customerId)}`, `${money(totals(x).total)} · ${quoteStatus(x)}`])],
      ['Invoices', db.invoices.filter(x => has(x.number, custName(x.customerId))).map(x => [`#/invoices/${x.id}`, `${x.number} · ${custName(x.customerId)}`, `${money(totals(x).total)} · ${invStatus(x)}`])],
    ].filter(g => g[1].length);
    out.innerHTML = groups.length ? groups.map(([l, items]) => `<h3 class="group-label">${l}</h3>${items.slice(0, 6).map(([href, t, sub]) =>
      href.startsWith('lead:') ? `<button type="button" class="list-item search-hit" data-lead="${href.slice(5)}"><div class="grow"><div class="title">${esc(t)}</div><div class="muted small">${esc(sub)}</div></div></button>`
        : `<a class="list-item search-hit" href="${href}"><div class="grow"><div class="title">${esc(t)}</div><div class="muted small">${esc(sub)}</div></div></a>`).join('')}`).join('')
      : '<p class="muted small">No matches.</p>';
  };
  input.addEventListener('input', run);
  out.addEventListener('click', e => { const b = e.target.closest('[data-lead]'); if (b) { form.closest('.modal-backdrop').remove(); leadForm(byId('leads', b.dataset.lead)); } });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('.search-hit', out)?.click(); } });
  run();
}

/** Creates any due copies of recurring expenses (e.g. monthly insurance). */
function processRecurring() {
  let n = 0; const t = today();
  for (const e of [...db.expenses]) {
    if (!e.recurring || !e.recurNext) continue;
    let guard = 0;
    while (e.recurNext <= t && guard++ < 60) {
      db.expenses.push({ ...e, id: uid(), date: e.recurNext, receipt: '', recurring: false, recurNext: '', recurFrom: e.id });
      e.recurNext = addMonths(e.recurNext, 1); n++;
    }
  }
  if (n) { save(); setTimeout(() => toast(`Added ${n} recurring expense${n > 1 ? 's' : ''}`), 600); }
}

function depositCredit(quoteId) {
  const q = quoteId && byId('quotes', quoteId), dep = q?.depositInvoiceId && byId('invoices', q.depositInvoiceId);
  if (!dep || dep.void) return null;
  return { desc: `Less deposit (invoice ${dep.number})`, details: '', qty: 1, price: -totals(dep).total, taxable: false };
}

function paymentForm(inv) {
  const bal = balance(inv);
  modal({ title: `Record payment — ${inv.number}`, submitLabel: 'Record payment', body: `<div class="form-grid">
    ${field('Amount *', inp('amount', bal.toFixed(2), 'type="number" step="0.01" min="0.01" required inputmode="decimal"'))}
    ${field('Date *', inp('date', today(), 'type="date" required'))}
    ${field('Method', `<select name="method">${opts(PAY_METHODS, 'e-Transfer')}</select>`)}
    ${field('Reference / note', inp('note', '', 'placeholder="e.g. cheque #, confirmation code"'))}</div>
    <p class="muted small">Balance due: ${money(bal)}</p>`,
    onSubmit: (f, d) => {
      (inv.payments ||= []).push({ id: uid(), amount: round2(d.amount), date: d.date, method: d.method, note: d.note });
      inv.sent = true; inv.sentAt ||= d.date;
      refresh(); toast(balance(inv) <= 0 ? 'Paid in full 🎉' : 'Payment recorded');
    } });
}

/* =====================================================================
 * Actions (event delegation)
 * ===================================================================== */
const docOf = ds => byId(ds.type === 'invoice' ? 'invoices' : 'quotes', ds.id);
function markSent(type, d) {
  if (type === 'invoice') { d.sent = true; d.sentAt ||= today(); }
  else if (d.status === 'draft') { d.status = 'sent'; d.sentAt = today(); }
}
function invoiceFromItems(src, extra) {
  const inv = { id: uid(), number: nextNumber('invoice'), createdAt: today(), date: today(), dueDate: addDays(today(), +db.settings.dueDays || 0),
    customerId: src.customerId, items: (src.items || []).map(x => ({ ...x })), discount: src.discount || 0, taxRate: src.taxRate ?? db.settings.taxRate,
    notes: db.settings.invoiceNotes, payments: [], serviceAddress: src.address || src.serviceAddress, ...extra };
  db.invoices.push(inv); return inv;
}

const ACTIONS = {
  newCustomer: () => customerForm(),
  editCustomer: ds => customerForm(cust(ds.id)),
  deleteCustomer: ds => {
    const n = db.jobs.filter(j => j.customerId === ds.id).length + db.invoices.filter(i => i.customerId === ds.id).length + db.quotes.filter(q => q.customerId === ds.id).length;
    if (n) return alert('This customer has jobs, quotes or invoices. Delete those first, so your records stay complete.');
    if (!confirm('Delete this customer?')) return;
    const snap = snapshot();
    db.customers = db.customers.filter(c => c.id !== ds.id);
    db.leads.forEach(l => { if (l.customerId === ds.id) l.customerId = ''; });
    db.tasks.forEach(t => { if (t.customerId === ds.id) t.customerId = ''; });
    db.incomes.forEach(t => { if (t.customerId === ds.id) t.customerId = ''; });
    save(); go('#/customers'); undoToast(snap, 'Customer deleted');
  },
  importCustomers: () => modal({ title: 'Import customers from CSV', submitLabel: 'Import', body: `<p class="muted small">Upload a CSV with a header row. Columns named <b>name</b>, <b>email</b>, <b>phone</b>, <b>address</b> and <b>notes</b> are recognised (e.g. an export from Homebase, Jobber, or your phone contacts).</p><input type="file" accept=".csv,text/csv" name="file" required>`,
    onSubmit: f => {
      const file = f.file.files[0]; if (!file) return false;
      file.text().then(txt => {
        const rows = parseCSV(txt); const hdr = (rows.shift() || []).map(h => h.toLowerCase().trim());
        const col = (...names) => hdr.findIndex(h => names.some(n => h === n || h.includes(n)));
        const ci = { name: col('name', 'customer'), first: col('first'), last: col('last'), email: col('email'), phone: col('phone', 'mobile'), address: col('address', 'street'), notes: col('note') };
        let n = 0;
        for (const r of rows) {
          const name = (ci.first >= 0 && ci.last >= 0 ? `${r[ci.first] || ''} ${r[ci.last] || ''}` : r[ci.name] || '').trim();
          if (!name) continue;
          db.customers.push({ id: uid(), createdAt: today(), name, email: r[ci.email] || '', phone: r[ci.phone] || '', address: r[ci.address] || '', notes: r[ci.notes] || '' }); n++;
        }
        refresh(); toast(`Imported ${n} customers`);
      });
    } }),
  newJob: ds => jobForm(null, { date: ds.date || today(), customerId: ds.cust, repeat: ds.repeat }),
  extendPlan: ds => { const p = seriesList().find(x => x.id === ds.id); if (p) extendPlanForm(p); },
  stopPlan: ds => {
    const p = seriesList().find(x => x.id === ds.id); if (!p) return;
    if (!confirm(`Stop this plan? The ${p.future.length} upcoming visit(s) will be removed. Past visits stay in your records.`)) return;
    const snap = snapshot(), ids = new Set(p.future.map(j => j.id));
    db.jobs = db.jobs.filter(j => !ids.has(j.id)); refresh(); undoToast(snap, 'Plan stopped');
  },
  newMember: () => memberForm(), editMember: ds => memberForm(byId('team', ds.id)),
  clockIn: ds => {
    const m = byId('team', ds.id); if (openEntry(m.id)) return;
    const job = db.jobs.find(j => j.date === today() && (j.assignedTo || '').toLowerCase() === m.name.toLowerCase() && j.status !== 'completed');
    db.timeEntries.push({ id: uid(), memberId: m.id, in: localStamp(), out: '', breakMin: 0, jobId: job?.id || '', approved: false });
    refresh(); toast(`${m.name} clocked in at ${fmtClock(localStamp())}`);
  },
  clockOut: ds => {
    const m = byId('team', ds.id), t = openEntry(ds.id); if (!t) return;
    t.out = localStamp(); refresh(); toast(`${m.name} clocked out · ${fmtHours(hoursOf(t))}`);
  },
  tsMove: ds => { const ws = state.tsWeek || addDays(today(), -parseD(today()).getDay()); state.tsWeek = addDays(ws, 7 * ds.n); render(); },
  approveWeek: () => {
    const ws = state.tsWeek || addDays(today(), -parseD(today()).getDay());
    const list = db.timeEntries.filter(t => t.out && !t.approved && inRange(localDate(t.in), ws, addDays(ws, 6)));
    list.forEach(t => { t.approved = true; }); refresh(); toast(`${list.length} entries approved`);
  },
  newEntry: () => entryForm(), editEntry: ds => entryForm(byId('timeEntries', ds.id)),
  deleteNote: ds => { const c = cust(ds.id); const snap = snapshot(); c.log = (c.log || []).filter(n => n.id !== ds.nid); refresh(); undoToast(snap, 'Note deleted'); },
  editJob: ds => jobForm(byId('jobs', ds.id)),
  dupJob: ds => {
    const { customerId, title, start, end, address, assignedTo, notes, items, discount, taxRate } = structuredClone(byId('jobs', ds.id));
    jobForm(null, { customerId, title, start, end, address, assignedTo, notes, items, discount, taxRate, date: today() });
  },
  jobStatus: ds => {
    const j = byId('jobs', ds.id); j.status = ds.s;
    if (ds.s === 'in_progress') { j.startedAt = localStamp(); j.finishedAt = ''; }
    if (ds.s === 'completed') { j.completedAt = today(); if (j.startedAt && !j.finishedAt) j.finishedAt = localStamp(); }
    if (ds.s === 'scheduled') { j.completedAt = ''; }
    refresh();
    if (ds.s === 'completed' && !j.invoiceId) toast('Job complete — create the invoice while it’s fresh!'); else toast('Status updated');
  },
  toggleNoInvoice: ds => { const j = byId('jobs', ds.id); j.noInvoice = !j.noInvoice; refresh(); },
  deleteJob: ds => {
    const j = byId('jobs', ds.id);
    const series = j.seriesId ? db.jobs.filter(x => x.seriesId === j.seriesId && x.date >= j.date && x.status === 'scheduled' && x.id !== j.id) : [];
    if (!confirm('Delete this job?')) return;
    const snap = snapshot();
    let ids = [j.id];
    if (series.length && confirm(`Also delete the ${series.length} later visit(s) in this repeating series?`)) ids = ids.concat(series.map(x => x.id));
    db.jobs = db.jobs.filter(x => !ids.includes(x.id));
    db.expenses.forEach(e => { if (ids.includes(e.jobId)) e.jobId = ''; });
    save(); go('#/jobs'); undoToast(snap, ids.length > 1 ? `${ids.length} jobs deleted` : 'Job deleted');
  },
  jobToInvoice: ds => {
    const j = byId('jobs', ds.id);
    if (!(j.items || []).length) return docForm('invoice', null, { customerId: j.customerId, jobId: j.id });
    const credit = depositCredit(j.quoteId);
    const inv = invoiceFromItems(j, { jobId: j.id, quoteId: j.quoteId }); j.invoiceId = inv.id;
    if (credit) inv.items.push(credit);
    save(); toast(`Invoice ${inv.number} created`); go('#/invoices/' + inv.id);
  },
  calMove: ds => {
    const n = +ds.n;
    if (state.calView === 'month') {
      state.calMonth = addMonths(state.calMonth + '-01', n).slice(0, 7);
      state.calDay = today().startsWith(state.calMonth) ? today() : state.calMonth + '-01';
    } else {
      state.calDay = addDays(state.calDay, state.calView === 'week' ? n * 7 : n);
      state.calMonth = state.calDay.slice(0, 7);
    }
    render();
  },
  calToday: () => { state.calMonth = today().slice(0, 7); state.calDay = today(); render(); },
  calView: ds => { state.calView = ds.v; state.calMonth = state.calDay.slice(0, 7); render(); },
  openMenu: () => {
    $('#sidebar').classList.add('open');
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    scrim.onclick = () => { $('#sidebar').classList.remove('open'); scrim.remove(); };
    document.body.append(scrim);
  },
  openSearch: () => openSearch(),
  hideSetup: () => { db.settings.hideSetup = true; refresh(); },
  newLead: () => leadForm(), editLead: ds => leadForm(byId('leads', ds.id)),
  toggleClosedLeads: () => { state.filters.leads ||= {}; state.filters.leads.closed = state.filters.leads.closed === '1' ? '' : '1'; render(); },
  newTask: ds => taskForm(null, ds.cust ? { customerId: ds.cust } : {}), editTask: ds => taskForm(byId('tasks', ds.id)),
  toggleTask: ds => {
    const x = byId('tasks', ds.id); x.done = !x.done; x.doneAt = x.done ? today() : '';
    refresh(); if (x.done) toast('Done ✓');
  },
  clearDoneTasks: () => { const snap = snapshot(); db.tasks = db.tasks.filter(x => !x.done); refresh(); undoToast(snap, 'Completed to-dos cleared'); },
  viewPhoto: ds => photoViewer(byId('jobs', ds.id), ds.pid),
  resetTemplates: () => { if (confirm('Reset all message templates to the defaults?')) { TEMPLATES.forEach(([k]) => db.settings[k] = DEFAULT_SETTINGS[k]); refresh(); toast('Templates reset'); } },
  newQuote: ds => docForm('quote', null, { customerId: ds.cust }),
  newInvoice: ds => docForm('invoice', null, { customerId: ds.cust }),
  editDoc: ds => {
    const d = docOf(ds);
    if (ds.type === 'quote' && d.status === 'converted' && !confirm('This quote was already converted. Edit anyway?')) return;
    docForm(ds.type, d);
  },
  dupDoc: ds => { const d = docOf(ds); docForm(ds.type, null, { customerId: d.customerId, items: structuredClone(d.items).filter(it => !String(it.desc).startsWith('Less deposit')), discount: d.discount, serviceAddress: d.serviceAddress }); },
  deleteDoc: ds => {
    const d = docOf(ds);
    if (ds.type === 'invoice' && (d.payments || []).length && !confirm('This invoice has payments recorded. Deleting it also removes those payments from your income. Continue?')) return;
    if (!confirm(`Delete ${ds.type} ${d.number}?`)) return;
    const snap = snapshot();
    if (ds.type === 'invoice') {
      db.invoices = db.invoices.filter(x => x.id !== d.id);
      db.jobs.forEach(j => { if (j.invoiceId === d.id) j.invoiceId = ''; });
      db.quotes.forEach(q => { if (q.invoiceId === d.id) q.invoiceId = ''; if (q.depositInvoiceId === d.id) q.depositInvoiceId = ''; });
    } else {
      db.quotes = db.quotes.filter(x => x.id !== d.id);
      db.leads.forEach(l => { if (l.quoteId === d.id) l.quoteId = ''; });
    }
    save(); go(`#/${ds.type === 'invoice' ? 'invoices' : 'quotes'}`); undoToast(snap, `${d.number} deleted`);
  },
  markSent: ds => { markSent(ds.type, docOf(ds)); refresh(); toast('Marked as sent'); },
  docEmail: ds => {
    const d = docOf(ds), c = cust(d.customerId) || {};
    const subj = `${ds.type === 'invoice' ? 'Invoice' : 'Quote'} ${d.number} from ${db.settings.businessName || ''}`.trim();
    location.href = mailHref(c.email, subj, docMessage(ds.type, d));
    markSent(ds.type, d); save(); setTimeout(render, 400);
    toast('Tip: attach the PDF. Use Print / PDF → Save as PDF.');
  },
  docText: ds => {
    const d = docOf(ds), c = cust(d.customerId) || {};
    location.href = smsHref(c.phone, docMessage(ds.type, d));
    markSent(ds.type, d); save(); setTimeout(render, 400);
  },
  docRemind: ds => {
    const d = docOf(ds), c = cust(d.customerId) || {}, msg = docMessage('invoice', d, 'reminder');
    location.href = c.phone ? smsHref(c.phone, msg) : mailHref(c.email, `Reminder: invoice ${d.number}`, msg);
    d.remindedAt = today(); save(); setTimeout(render, 400);
  },
  docFollow: ds => {
    const d = docOf(ds), c = cust(d.customerId) || {}, msg = docMessage('quote', d, 'followup');
    location.href = c.phone ? smsHref(c.phone, msg) : mailHref(c.email, `Following up on quote ${d.number}`, msg);
    d.followedUpAt = today(); save();
  },
  quoteDeposit: ds => {
    const q = docOf(ds), amt = depositAmt(q);
    const inv = invoiceFromItems({ customerId: q.customerId, serviceAddress: q.serviceAddress, items: [{ desc: `Deposit (${+q.depositPct}%) for quote ${q.number}`, details: '', qty: 1, price: amt, taxable: false }] },
      { quoteId: q.id, dueDate: today(), isDeposit: true });
    q.depositInvoiceId = inv.id; if (q.status === 'draft') { q.status = 'sent'; q.sentAt = today(); }
    save(); toast(`Deposit invoice ${inv.number} created`); go('#/invoices/' + inv.id);
  },
  docPrint: ds => {
    const d = docOf(ds); const old = document.title;
    document.title = `${ds.type === 'invoice' ? 'Invoice' : 'Quote'} ${d.number} - ${custName(d.customerId)}`;
    window.print(); setTimeout(() => document.title = old, 1000);
  },
  printPage: () => window.print(),
  recordPayment: ds => paymentForm(docOf(ds)),
  deletePayment: ds => { const inv = byId('invoices', ds.id), snap = snapshot(); inv.payments = inv.payments.filter(p => p.id !== ds.pid); refresh(); undoToast(snap, 'Payment removed'); },
  voidInvoice: ds => { if (confirm('Void this invoice? It will stay in your records but no longer count as owed.')) { docOf(ds).void = true; refresh(); } },
  quoteApprove: ds => {
    const q = docOf(ds); q.status = 'approved'; q.approvedAt = today(); q.sentAt ||= today();
    db.leads.forEach(l => { if (l.quoteId === q.id) { l.stage = 'won'; l.closedAt = today(); } });
    refresh(); toast('Quote approved. Schedule the job next.');
  },
  quoteDecline: ds => {
    const q = docOf(ds); q.status = 'declined';
    db.leads.forEach(l => { if (l.quoteId === q.id) { l.stage = 'lost'; l.closedAt = today(); } });
    refresh();
  },
  quoteToJob: ds => { const q = docOf(ds); jobForm(null, { customerId: q.customerId, title: (q.items[0]?.desc || 'Job') + (q.items.length > 1 ? ' + more' : ''), items: structuredClone(q.items), discount: q.discount, taxRate: q.taxRate, quoteId: q.id, address: q.serviceAddress }); },
  quoteToInvoice: ds => {
    const q = docOf(ds), credit = depositCredit(q.id);
    const inv = invoiceFromItems(q, { quoteId: q.id, jobId: q.jobId });
    if (credit) inv.items.push(credit);
    q.status = 'converted'; q.invoiceId = inv.id; save(); go('#/invoices/' + inv.id);
  },
  newExpense: ds => expenseForm(null, ds.job ? { jobId: ds.job } : {}),
  editExpense: ds => expenseForm(byId('expenses', ds.id)),
  newIncome: () => incomeForm(), editIncome: ds => incomeForm(byId('incomes', ds.id)),
  newTrip: () => tripForm(), editTrip: ds => tripForm(byId('mileage', ds.id)),
  newService: () => serviceForm(), editService: ds => serviceForm(byId('services', ds.id)),
  exportInvoices: () => { const [f, t] = periodRange(filt('reports', 'period', 'ytd'), state.filters.reports);
    download('invoices.csv', csv([['Number', 'Date', 'Due', 'Customer', 'Status', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Balance'],
      ...db.invoices.filter(i => inRange(i.date, f, t)).map(i => { const x = totals(i); return [i.number, i.date, i.dueDate, custName(i.customerId), invStatus(i), x.sub, x.disc, x.tax, x.total, paidAmt(i), balance(i)]; })])); },
  exportIncome: () => { const v = location.hash.includes('reports') ? 'reports' : 'income'; const [f, t] = periodRange(filt(v, 'period', v === 'reports' ? 'ytd' : 'this_month'), state.filters[v]);
    download('income.csv', csv([['Date', 'Source', 'Customer', 'Method', 'Amount'], ...incomeEntries().filter(x => inRange(x.date, f, t)).map(x => [x.date, x.source, x.customerId ? custName(x.customerId) : '', x.method, x.amount])])); },
  exportExpenses: () => { const v = location.hash.includes('reports') ? 'reports' : 'expenses'; const [f, t] = periodRange(filt(v, 'period', v === 'reports' ? 'ytd' : 'this_month'), state.filters[v]);
    download('expenses.csv', csv([['Date', 'Vendor', 'Category', 'Amount', 'Tax', 'Method', 'Job', 'Notes'], ...db.expenses.filter(e => inRange(e.date, f, t)).map(e => [e.date, e.vendor, e.category, e.amount, e.tax || 0, e.method, byId('jobs', e.jobId)?.title || '', e.notes])])); },
  exportMileage: () => { const v = location.hash.includes('reports') ? 'reports' : 'expenses'; const [f, t] = periodRange(filt(v, 'period', v === 'reports' ? 'ytd' : 'this_month'), state.filters[v]);
    download('mileage.csv', csv([['Date', 'Distance (' + db.settings.distanceUnit + ')', 'Purpose', 'Route'], ...db.mileage.filter(m => inRange(m.date, f, t)).map(m => [m.date, m.distance, m.purpose, m.route])])); },
  exportBackup: async () => {
    const name = `business-hub-backup-${today()}.json`, data = JSON.stringify(db);
    db.settings.lastBackup = today(); save();
    const file = typeof File === 'function' ? new File([data], name, { type: 'application/json' }) : null;
    // On phones, the share sheet lets you save straight to Files, Google Drive or email.
    if (file && matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Business Hub backup' }); render(); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    download(name, data, 'application/json'); toast('Backup downloaded'); render();
  },
  importBackup: () => modal({ title: 'Restore from backup', submitLabel: 'Restore', body: '<p class="muted">This replaces all data in this browser with the backup file.</p><input type="file" accept=".json,application/json" name="file" required>',
    onSubmit: f => { const file = f.file.files[0]; if (!file) return false;
      file.text().then(t => { try { const d = JSON.parse(t); if (!d.settings || !Array.isArray(d.invoices)) throw 0; db = normalize(d); refresh(); go('#/dashboard'); toast('Backup restored'); } catch { alert('That file is not a valid backup.'); } }); } }),
  eraseAll: () => { if (confirm('Erase ALL data in this browser? Download a backup first if you might need it.') && confirm('Are you absolutely sure?')) { const s = db.settings; db = blank(); if (confirm('Keep your business settings (name, logo, tax)?')) db.settings = s; refresh(); go('#/dashboard'); } },
  loadSample: () => { if ((db.customers.length || db.invoices.length) && !confirm('Add sample data alongside your existing data?')) return; loadSample(); refresh(); toast('Sample data loaded'); },
};

function parseCSV(txt) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && ACTIONS[a.dataset.act] && !(a.closest('.modal') && a.type === 'submit')) { e.preventDefault(); ACTIONS[a.dataset.act](a.dataset, a, e); return; }
  const tabEl = e.target.closest('[data-tab]');
  if (tabEl) { const [v, k, val] = tabEl.dataset.tab.split(':'); (state.filters[v] ||= {})[k] = val; render(); return; }
  const ts = e.target.closest('[data-tabset]');
  if (ts) { const [v, k, val] = ts.dataset.tabset.split(':'); (state.filters[v] ||= {})[k] = val; }
  const row = e.target.closest('[data-href]');
  if (row && !e.target.closest('a,button')) { go(row.dataset.href); return; }
  const day = e.target.closest('[data-day]');
  if (day && !e.target.closest('a,button,input,select')) { state.calDay = day.dataset.day; if (day.dataset.day.slice(0, 7) !== state.calMonth) state.calMonth = day.dataset.day.slice(0, 7); render(); }
});
document.addEventListener('input', e => {
  const f = e.target.dataset?.filter; if (!f || e.target.tagName === 'SELECT' || e.target.type === 'date') return;
  const [v, k] = f.split(':'); (state.filters[v] ||= {})[k] = e.target.value;
  const pos = e.target.selectionStart; render();
  const el = $(`[data-filter="${f}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* not a text input */ } }
});
document.addEventListener('change', e => {
  const f = e.target.dataset?.filter; if (!f || !(e.target.tagName === 'SELECT' || e.target.type === 'date')) return;
  const [v, k] = f.split(':'); (state.filters[v] ||= {})[k] = e.target.value; render();
});

// Settings form

document.addEventListener('change', async e => {
  if (e.target.id !== 'logoFile') return;
  const file = e.target.files[0]; if (!file) return;
  try { db.settings.logo = await readImage(file, 400, 0.85); refresh(); toast('Logo updated'); } catch { toast('Could not read that image'); }
});
document.addEventListener('click', e => { if (e.target.id === 'rmLogo') { db.settings.logo = ''; refresh(); } });

// Mobile menu & search
$('#menuBtn').addEventListener('click', () => ACTIONS.openMenu());
$('#searchBtn').addEventListener('click', () => openSearch());

// Team filter on the schedule
document.addEventListener('change', e => {
  if (e.target.dataset?.actChange === 'calTeam') { state.calTeam = e.target.value; render(); }
});

// Quick-add to-do (dashboard, to-dos page, customer page)
document.addEventListener('submit', e => {
  const f = e.target.closest('.quick-task'); if (!f) return;
  e.preventDefault();
  const title = f.title.value.trim(); if (!title) return;
  db.tasks.push({ id: uid(), title, due: f.due.value, customerId: f.dataset.customer || '', done: false, createdAt: today() });
  refresh(); toast('To-do added');
  $('.quick-task input[name=title]')?.focus();
});

// Customer notes (activity timeline)
document.addEventListener('submit', e => {
  const f = e.target.closest('.note-form'); if (!f) return;
  e.preventDefault();
  const c = cust(f.dataset.customer), text = f.text.value.trim(); if (!c || !text) return;
  (c.log ||= []).push({ id: uid(), date: today(), text });
  refresh(); toast('Note added');
});

// Job photos
document.addEventListener('change', async e => {
  if (!e.target.classList?.contains('js-job-photos')) return;
  const j = byId('jobs', e.target.dataset.id); if (!j) return;
  const files = [...e.target.files]; if (!files.length) return;
  toast(`Adding ${files.length} photo${files.length > 1 ? 's' : ''}…`);
  for (const file of files) {
    try { (j.photos ||= []).push({ id: uid(), date: today(), src: await readImage(file, 1400, 0.7) }); }
    catch { toast('Could not read one of the photos'); }
  }
  refresh(); toast('Photos saved');
});

// Drag & drop: jobs onto calendar days, leads onto pipeline stages (desktop)
let dragging = null;
const endDrag = () => { dragging = null; document.body.classList.remove('is-dragging'); $$('.drop-hover').forEach(x => x.classList.remove('drop-hover')); };
document.addEventListener('dragstart', e => {
  const j = e.target.closest?.('[data-drag-job]'), l = e.target.closest?.('[data-drag-lead]');
  if (!j && !l) return;
  dragging = j ? { type: 'job', id: j.dataset.dragJob } : { type: 'lead', id: l.dataset.dragLead };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragging.id);
  document.body.classList.add('is-dragging');
});
document.addEventListener('dragend', endDrag);
const dropTarget = e => dragging && e.target.closest?.(dragging.type === 'job' ? '[data-day]' : '[data-stage]');
document.addEventListener('dragover', e => {
  const t = dropTarget(e); if (!t) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  $$('.drop-hover').forEach(x => x !== t && x.classList.remove('drop-hover'));
  t.classList.add('drop-hover');
});
document.addEventListener('drop', e => {
  const t = dropTarget(e); if (!t) return;
  e.preventDefault();
  if (dragging.type === 'job') {
    const j = byId('jobs', dragging.id);
    if (j && j.date !== t.dataset.day) { j.date = t.dataset.day; state.calDay = j.date; toast(`Moved to ${fmtDateShort(j.date)}`); }
  } else {
    const l = byId('leads', dragging.id);
    if (l && l.stage !== t.dataset.stage) { l.stage = t.dataset.stage; if (['won', 'lost'].includes(l.stage)) l.closedAt = today(); }
  }
  endDrag(); refresh();
});
// Keyboard: open lead cards with Enter
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('.lead-card')) e.target.click(); });

/* =====================================================================
 * Sample data
 * ===================================================================== */
function loadSample() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const t = today();
  const svc = [['Service call', 95, 'visit'], ['Labour', 85, 'hour'], ['Gutter cleaning', 180, 'job'], ['Window cleaning (exterior)', 240, 'job'],
    ['Pressure washing – driveway', 220, 'job'], ['Lawn maintenance visit', 65, 'visit'], ['Materials', 1, 'each']];
  const services = svc.map(([name, price, unit]) => ({ id: uid(), name, price, unit, taxable: true }));
  db.services.push(...services.filter(s => !db.services.some(x => x.name === s.name)));
  const people = [['Sarah Mitchell', '14 Maple Cres'], ['David Chen', '88 Lakeview Dr'], ['Priya Patel', '301 Oak Ave'], ['Tom Becker', '5 Birch Lane'],
    ['Maria Rossi', '42 Elm St'], ['James Wilson', '19 Cedar Ct'], ['Aisha Khan', '7 Willow Way'], ['Kevin O’Brien', '260 Pine Rd']];
  const custs = people.map(([name, street], i) => ({ id: uid(), name, address: `${street}, Toronto, ON`, phone: `416-555-01${pad(10 + i * 7)}`,
    email: name.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.') + '@example.com', createdAt: addMonths(t, -6), source: pick(['Referral', 'Google', 'Facebook / Instagram', 'Repeat customer']) }));
  db.customers.push(...custs);
  const team = ['Alex', 'Mike', 'Alex'];
  for (let k = -150; k <= 14; k += 1 + Math.floor(rnd() * 3)) {
    const date = addDays(t, k), c = pick(custs), s = pick(services.slice(0, 6));
    const items = [{ desc: s.name, qty: s.unit === 'hour' ? 2 + Math.floor(rnd() * 3) : 1, price: s.price, taxable: true }];
    if (rnd() < .35) items.push({ desc: 'Materials', qty: Math.round(40 + rnd() * 160), price: 1, taxable: true });
    const past = k < 0;
    const job = { id: uid(), customerId: c.id, title: s.name, date, start: pad(8 + Math.floor(rnd() * 8)) + ':' + pick(['00', '30']), end: '', address: c.address,
      assignedTo: pick(team), status: past ? (rnd() < .06 ? 'cancelled' : 'completed') : 'scheduled', items, discount: 0, taxRate: db.settings.taxRate, createdAt: date, notes: '' };
    job.end = pad(+job.start.slice(0, 2) + 2) + ':' + job.start.slice(3);
    db.jobs.push(job);
    if (job.status === 'completed' && k < -2 && rnd() < .93) {
      const inv = { id: uid(), number: nextNumber('invoice'), date: addDays(date, 1), dueDate: addDays(date, 15), customerId: c.id, items: structuredClone(items),
        discount: 0, taxRate: db.settings.taxRate, notes: db.settings.invoiceNotes, payments: [], jobId: job.id, sent: true, sentAt: addDays(date, 1), createdAt: date };
      const tot = totals(inv).total;
      if (k < -20 ? rnd() < .93 : rnd() < .55) inv.payments.push({ id: uid(), amount: tot, date: addDays(date, 2 + Math.floor(rnd() * 12)), method: pick(PAY_METHODS.slice(0, 4)) });
      db.invoices.push(inv); job.invoiceId = inv.id;
    }
    if (k < 3 && k > -45 && rnd() < .45) {
      const q = { id: uid(), number: nextNumber('quote'), date, validUntil: addDays(date, 30), customerId: pick(custs).id,
        items: [{ desc: pick(services).name, qty: 1, price: 300 + Math.round(rnd() * 1500), taxable: true }], discount: 0, taxRate: db.settings.taxRate,
        notes: db.settings.quoteNotes, status: pick(['sent', 'sent', 'approved', 'declined', 'draft']), sentAt: date, createdAt: date };
      db.quotes.push(q);
    }
  }
  const vendors = { 'Materials & Supplies': ['Home Depot', 'Rona', 'Canadian Tire'], 'Fuel': ['Petro-Canada', 'Esso', 'Shell'],
    'Advertising & Marketing': ['Google Ads', 'Facebook Ads'], 'Software & Subscriptions': ['Business software'], 'Phone & Internet': ['Mobile carrier'],
    'Tools & Equipment': ['Home Depot', 'Princess Auto'], 'Insurance': ['Liability insurance'] };
  for (let k = -150; k <= 0; k += 2 + Math.floor(rnd() * 4)) {
    const cat = pick(Object.keys(vendors)); const amt = round2(cat === 'Insurance' ? 145 : cat === 'Tools & Equipment' ? 60 + rnd() * 300 : 20 + rnd() * 120);
    const r = +db.settings.taxRate;
    db.expenses.push({ id: uid(), date: addDays(t, k), amount: amt, vendor: pick(vendors[cat]), category: cat, method: pick(['Debit', 'Credit card']), tax: round2(amt * r / (100 + r)), notes: '' });
  }
  for (let k = -60; k <= 0; k += 3) db.mileage.push({ id: uid(), date: addDays(t, k), distance: Math.round(15 + rnd() * 60), purpose: 'Driving to jobs' });
  const leadPeople = [['Linda Park', 'Gutter cleaning', 180, 'new', 'Google'], ['Marcus Green', 'Pressure washing – driveway', 220, 'new', 'Facebook / Instagram'],
    ['Olivia Brooks', 'Window cleaning (exterior)', 240, 'contacted', 'Referral'], ['Raj Singh', 'Deck staining', 900, 'contacted', 'Door knocking'],
    ['Emma Laurent', 'Lawn maintenance (season)', 1200, 'quoted', 'Website'], ['Noah Fischer', 'Gutter guards install', 1400, 'won', 'Referral'],
    ['Chloe Martin', 'Window cleaning (exterior)', 240, 'lost', 'Google']];
  leadPeople.forEach(([name, service, value, stage, source], i) => {
    const closed = ['won', 'lost'].includes(stage);
    db.leads.push({ id: uid(), name, service, value, stage, source, phone: `647-555-01${pad(20 + i * 3)}`, email: '',
      address: `${10 + i * 11} Spruce St, Toronto, ON`, followUp: closed ? '' : addDays(t, i - 2), createdAt: addDays(t, -i * 3),
      closedAt: closed ? addDays(t, -i) : '', notes: '' });
  });
  [['Order gutter guard materials', 0], ['Call back about deck quote', -1], ['Renew liability insurance', 6], ['Post before/after photos online', 2]]
    .forEach(([title, d]) => db.tasks.push({ id: uid(), title, due: addDays(t, d), done: false, createdAt: t }));
  custs.forEach((c, i) => { c.source = ['Referral', 'Google', 'Facebook / Instagram', 'Repeat customer', 'Door knocking'][i % 5]; });
  if (!db.team.length) {
    db.team.push({ id: uid(), name: 'Alex', role: 'Owner', color: TEAM_COLORS[0], phone: '', email: '', rate: 0 },
      { id: uid(), name: 'Mike', role: 'Technician', color: TEAM_COLORS[1], phone: '', email: '', rate: 24 });
    const mike = db.team[1];
    for (let k = -6; k < 0; k++) { const d = addDays(t, k); if (parseD(d).getDay() % 6) db.timeEntries.push({ id: uid(), memberId: mike.id, in: `${d}T08:0${k + 7}`, out: `${d}T16:3${k + 7}`, breakMin: 30, approved: k < -3 }); }
  }
  const ins = [...db.expenses].reverse().find(e => e.category === 'Insurance');
  if (ins) { ins.recurring = true; ins.recurNext = addMonths(ins.date, 1); }
}

/* =====================================================================
 * Boot
 * ===================================================================== */
window.addEventListener('hashchange', () => { $('#modalRoot').innerHTML = ''; render(); window.scrollTo(0, 0); });
try { Object.assign(state, JSON.parse(localStorage.getItem('bizhub.ui') || '{}')); } catch { /* ignore */ }
state.calDay = today(); state.calMonth = today().slice(0, 7); state.tsWeek = '';
window.addEventListener('pagehide', () => { try { localStorage.setItem('bizhub.ui', JSON.stringify({ calView: state.calView, calTeam: state.calTeam, filters: state.filters })); } catch { /* ignore */ } });
load().then(d => {
  db = d; state.loaded = true;
  processRecurring();
  render();
  if (storageMode === 'local') toast('Private browsing detected: data may not be kept. Download backups often.');
});
navigator.storage?.persist?.().catch(() => {}); // ask the browser not to clear our data
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
