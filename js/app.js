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
  send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
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
  quoteTerms: 'By approving this quote you agree to the work and prices listed above. Any extra work will be quoted separately before we do it. We take care around your home, but we are not responsible for pre-existing damage, or for damage caused by conditions we could not reasonably see, such as worn seals, loose shingles, rot or faulty fixtures. Payment is due when the work is done, unless a deposit is listed above.',
  mileageRate: 0.72, distanceUnit: 'km', theme: 'auto',
  paymentLink: '', reviewLink: '', monthlyGoal: 0, lastBackup: '',
  planPrefix: 'SP-', nextPlanNo: 1001, planTermMonths: 12, planMinVisits: 2, cancelFee: 50, planTerms: '',
  processor: '', processorUrl: '', cardSetupLink: '', meId: '',
  stripeUrl: '', stripeToken: '', stripeStatus: null, autoChargePlans: false, saveCardOnPay: true,
  cleanerPct: 20, salesPct: 25, salesScope: 'first',
  tplInvoice: 'Hi {first}, here is invoice {number} from {business} for {total}, due {due}.\n\n{items}\n\n{pay}\n\nThank you!\n{signature}',
  tplReminder: 'Hi {first}, a friendly reminder that invoice {number} for {balance} was due {due}.\n\n{pay}\n\nIf you have already paid, please ignore this message. Thank you!\n{signature}',
  tplQuote: 'Hi {first}, thanks for the opportunity! Here is quote {number} from {business} for {total}, valid until {valid}.\n\nView it and approve online: {link}\n\n{signature}',
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
    quotes: [], invoices: [], expenses: [], incomes: [], mileage: [], leads: [], tasks: [], team: [], timeEntries: [], subscriptions: [], planTemplates: [], pins: [], messages: [], blasts: [] };
}
function normalize(d) {
  const b = blank();
  const out = { ...b, ...d, settings: { ...b.settings, ...(d.settings || {}) } };
  for (const k of ['customers', 'services', 'jobs', 'quotes', 'invoices', 'expenses', 'incomes', 'mileage', 'categories', 'leads', 'tasks', 'team', 'timeEntries', 'subscriptions', 'planTemplates', 'pins', 'messages', 'blasts'])
    if (!Array.isArray(out[k])) out[k] = b[k];
  out.subscriptions.forEach(p => { if (!p.terms && (p.signature || p.status === 'sent')) p.terms = out.settings.planTerms || BH.DEFAULT_TERMS_V1; });
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
  return { get: k => tx('readonly', st => st.get(k)), set: (k, v) => tx('readwrite', st => st.put(v, k)),
    del: k => tx('readwrite', st => st.delete(k)), keys: () => tx('readonly', st => st.getAllKeys()) };
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
/* Photos and receipts are stored separately ("img:<id>"), so saving your data never
 * rewrites every photo. Records keep a small reference: { img: id } (or { src } in fallback mode). */
const imgCache = new Map();
const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
async function putImage(dataUrl) {
  if (storageMode !== 'idb') return { src: dataUrl };
  const id = 'img_' + uid();
  await idb.set('img:' + id, dataUrl); imgCache.set(id, dataUrl);
  return { img: id };
}
async function getImage(id) {
  if (imgCache.has(id)) return imgCache.get(id);
  const v = await idb.get('img:' + id).catch(() => null);
  if (v) imgCache.set(id, v);
  return v || '';
}
const imgAttr = ref => (ref?.src ? `src="${ref.src}"` : ref?.img ? `src="${BLANK_IMG}" data-img="${ref.img}"` : `src="${BLANK_IMG}"`);
function hydrateImages(root = document) {
  $$('[data-img]', root).forEach(async el => { const v = await getImage(el.dataset.img); if (!v) return; el.src = v; el.removeAttribute('data-img'); });
  $$('[data-img-href]', root).forEach(async el => { const v = await getImage(el.dataset.imgHref); if (v) { el.href = v; el.removeAttribute('data-img-href'); } });
}
const imageIds = d => [...(d.jobs || []).flatMap(j => (j.photos || []).map(ph => ph.img)), ...(d.expenses || []).map(e => e.receiptImg)].filter(Boolean);
/** Move photos saved inside records (older versions) into the image store, and tidy unused images. */
async function migrateImages() {
  if (storageMode !== 'idb') return;
  let moved = 0;
  for (const j of db.jobs) for (const ph of j.photos || []) if (ph.src) { Object.assign(ph, await putImage(ph.src)); delete ph.src; moved++; }
  for (const e of db.expenses) if (e.receipt) { e.receiptImg = (await putImage(e.receipt)).img; e.receipt = ''; moved++; }
  if (moved) save();
  try {
    const used = new Set(imageIds(db)), keys = await idb.keys();
    for (const k of keys) if (String(k).startsWith('img:') && !used.has(String(k).slice(4))) await idb.del(k);
  } catch { /* tidy-up is optional */ }
}
/* Automatic daily snapshots (last 7 days) so a bad change or an erase can be rolled back. */
async function takeSnapshot(force = false) {
  if (storageMode !== 'idb') return;
  if (!force && !db.customers.length && !db.jobs.length && !db.invoices.length) return; // nothing worth keeping yet
  try {
    const key = 'snap:' + today(), keys = (await idb.keys()).map(String);
    if (!force && keys.includes(key)) return;
    await idb.set(key, JSON.stringify({ ...db, settings: { ...db.settings, stripeToken: '' } }));
    const snaps = keys.filter(k => k.startsWith('snap:')).concat(keys.includes(key) ? [] : [key]).sort();
    for (const k of snaps.slice(0, -7)) await idb.del(k);
  } catch { /* snapshots are a bonus; never block the app */ }
}
async function listSnapshots() {
  if (storageMode !== 'idb') return [];
  const keys = (await idb.keys()).map(String).filter(k => k.startsWith('snap:')).sort().reverse();
  const out = [];
  for (const k of keys) {
    try { const d = JSON.parse(await idb.get(k)); out.push({ key: k, date: k.slice(5), customers: d.customers?.length || 0, jobs: d.jobs?.length || 0, invoices: d.invoices?.length || 0 }); } catch { /* skip broken */ }
  }
  return out;
}
async function restoreSnapshot(key) {
  const d = JSON.parse(await idb.get(key));
  const keepToken = db.settings.stripeToken;
  await idb.set('undo:before-restore', JSON.stringify(db));
  db = normalize(d); if (keepToken) db.settings.stripeToken = keepToken;
  refresh(); go('#/dashboard'); toast(`Restored your data from ${fmtDate(key.slice(5))}`);
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
const safeUrl = u => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');
const smsHref = (phone, text) => `sms:${encodeURIComponent(phone || '')}${text ? '?&body=' + encodeURIComponent(text) : ''}`;
const digits10 = x => String(x || '').replace(/\D/g, '').slice(-10);
const custByPhone = ph => { const d = digits10(ph); return d.length >= 7 ? db.customers.find(c => digits10(c.phone) === d) : null; };
const unreadCount = () => db.messages.filter(m => m.dir === 'in' && !m.read).length;
const threadKey = m => m.customerId || 'p' + digits10(m.phone);
function logMsg(m) { const x = { id: uid(), at: new Date().toISOString(), ...m }; db.messages.push(x); return x; }
/** A customer texted your business number (arrives through your server's inbox). */
function addInboundSms(from, body, at) {
  const c = custByPhone(from), txt = String(body || '').trim();
  if (c && /^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(txt)) c.noPromo = true;
  if (c && /^(start|unstop)$/i.test(txt)) c.noPromo = false;
  logMsg({ customerId: c?.id || '', phone: from, dir: 'in', body: txt, via: 'sms', read: false, at: at || new Date().toISOString() });
  if (c) c.lastContact = today();
  save();
  return { name: c?.name || formatPhone(from) };
}
/** Send a text. With texting connected it goes from your business number right here;
 *  otherwise it opens your phone's Messages app with the text ready, and is logged. */
async function sendText(to, body, extra = {}) {
  const phone = to.phone, base = { customerId: to.id || '', phone, dir: 'out', body, ...extra };
  if (!phone) return { ok: false, error: 'No phone number' };
  if (serverHas('sms')) {
    let r;
    try { r = await payApi('/sms', { to: phone, body }); } catch (e) { r = { error: e.message }; }
    if (r.error) {
      logMsg({ ...base, via: 'sms', status: 'failed', error: r.error });
      if (String(r.code) === '21610' && to.id) { to.noPromo = true; } // they replied STOP earlier
      save(); return { ok: false, error: r.error };
    }
    logMsg({ ...base, via: 'sms', status: 'sent' }); save(); return { ok: true };
  }
  logMsg({ ...base, via: 'phone', status: 'opened' }); save();
  location.href = smsHref(phone, body);
  return { ok: true, viaPhone: true };
}
/** Text from anywhere in the app: a quick review sheet when texting is connected, else straight to Messages. */
function openSms(phone, text) {
  const c = custByPhone(phone) || { phone };
  if (!serverHas('sms')) { if (text) logMsg({ customerId: c.id || '', phone, dir: 'out', body: text, via: 'phone', status: 'opened' }); save(); location.href = smsHref(phone, text); return; }
  composeSheet(c, text);
}
function composeSheet(c, text = '') {
  modal({ title: `Text ${c.name ? firstName(c.name) : formatPhone(c.phone)}`, submitLabel: 'Send', body: `
    <div class="muted small" style="margin-bottom:8px">To ${esc(c.name || '')} ${esc(formatPhone(c.phone))} · from your business number</div>
    <textarea name="body" rows="7" required class="js-sms-body">${esc(text)}</textarea><div class="muted small js-sms-count"></div>`,
    onMount: f => bindSmsCount(f),
    onSubmit: (f, d) => { sendText(c, d.body.trim()).then(r => { toast(r.ok ? 'Text sent' : 'Not sent: ' + r.error); render(); }); } });
}
/** Characters and how many texts (segments) a message takes. */
function smsSegments(t) {
  const uni = /[^\x00-\x7F’‘“”–—…]/.test(t), n = [...t].length, one = uni ? 70 : 160, many = uni ? 67 : 153;
  return n <= one ? 1 : Math.ceil(n / many);
}
function bindSmsCount(f) {
  const ta = $('.js-sms-body', f), out = $('.js-sms-count', f);
  const upd = () => { const n = [...ta.value].length, seg = smsSegments(ta.value); out.textContent = `${n} characters${seg > 1 ? ` · sends as ${seg} texts` : ''}`; };
  ta.addEventListener('input', upd); upd();
}
// Text links anywhere in the app: log them, or send from the business number when texting is connected.
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[href^="sms:"]');
  if (!a || !state.loaded || a.closest('.js-raw-sms')) return;
  const [num, q = ''] = a.getAttribute('href').slice(4).split('?');
  const phone = decodeURIComponent(num), body = new URLSearchParams(q.replace(/^&/, '')).get('body') || '';
  if (!phone) return;
  if (serverHas('sms')) { e.preventDefault(); composeSheet(custByPhone(phone) || { phone }, body); return; }
  if (body) { const c = custByPhone(phone); logMsg({ customerId: c?.id || '', phone, dir: 'out', body, via: 'phone', status: 'opened' }); save(); }
}, true);
const mailHref = (email, subject, body) => `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/* ----- money maths ----- */
function totals(doc) {
  let sub = 0, taxable = 0;
  for (const it of doc.items || []) {
    if (it.optional && !it.on) continue; // optional extra the customer hasn't picked
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
/** Quote lines the customer actually chose (optional extras only if picked), as plain line items. */
const chosenItems = items => (items || []).filter(i => !i.optional || i.on).map(({ optional, on, ...i }) => i);
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

function modal({ title, body, wide = false, submitLabel = 'Save', onSubmit, onMount, footExtra = '', noFoot = false, focus = true, cls = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop ' + cls;
  const topSave = !noFoot && submitLabel.length <= 12; // long labels ("Charge $250.00") keep a big button at the bottom
  wrap.innerHTML = `<form class="modal ${wide ? 'wide' : ''} ${noFoot ? 'no-foot' : ''} ${topSave ? 'top-save' : ''}" autocomplete="off" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head">${noFoot ? '' : '<button type="button" class="sheet-btn js-sheet-cancel">Cancel</button>'}<h2>${esc(title)}</h2>${topSave ? `<button type="button" class="sheet-btn sheet-save js-sheet-save">${esc(submitLabel)}</button>` : ''}<button type="button" class="btn btn-icon modal-x" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg></button></div>
    <div class="modal-body">${body}</div>
    ${noFoot ? '' : `<div class="modal-foot">${footExtra}<span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary" type="submit">${esc(submitLabel)}</button></div>`}
  </form>`;
  $('#modalRoot').append(wrap);
  const form = $('form', wrap);
  let dirty = false;
  const close = () => {
    if (!isPhone() || matchMedia('(prefers-reduced-motion: reduce)').matches) { wrap.remove(); return; }
    wrap.classList.add('closing'); setTimeout(() => wrap.remove(), 220); // slide the sheet down first
  };
  const requestClose = () => { if (!dirty || confirm('Discard your changes?')) close(); };
  wrap._requestClose = requestClose;
  $('.js-sheet-cancel', wrap)?.addEventListener('click', requestClose);
  $('.js-sheet-save', wrap)?.addEventListener('click', () => form.requestSubmit());
  dragToClose($('.modal-head', wrap), form, requestClose);
  form.addEventListener('input', e => { if (!e.target.closest('[data-nodirty]')) dirty = true; });
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) requestClose(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (onSubmit?.(form, Object.fromEntries(new FormData(form))) !== false) close();
  });
  onMount?.(form, close);
  // Focus the first field, unless the person has already clicked into another one.
  const first = focus && $('input:not([type=hidden]):not([type=file]),select,textarea', form);
  if (first) {
    first.focus();
    setTimeout(() => { if (!form.contains(document.activeElement)) first.focus(); }, 30);
  }
  return { form, close };
}
/** Pull a sheet down by its header to close it, like iOS. */
function dragToClose(handle, sheet, onClose) {
  let y0 = null, dy = 0;
  handle.addEventListener('touchstart', e => { if (!isPhone() || e.target.closest('button')) return; y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; }, { passive: true });
  handle.addEventListener('touchmove', e => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  handle.addEventListener('touchend', () => {
    if (y0 === null) return;
    y0 = null; sheet.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'; sheet.style.transform = '';
    if (dy > 110) onClose();
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const openMenu = $('.menu-wrap.open');
    if (openMenu) { openMenu.classList.remove('open'); $('[data-menu]', openMenu)?.setAttribute('aria-expanded', 'false'); return; }
    $('#modalRoot .modal-backdrop:last-child')?._requestClose(); return;
  }
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
function mountItemsEditor(form, doc, opt = {}) {
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
        <input class="details" data-k="details" value="${esc(it.details || '')}" placeholder="Details (optional)" aria-label="Item details">
        ${opt.optional ? `<label class="opt-line"><input type="checkbox" data-k="optional" ${it.optional ? 'checked' : ''}> Optional extra · the customer can choose to add it</label>` : ''}</td>
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
    .map(it => ({ desc: String(it.desc).trim(), details: String(it.details || '').trim(), qty: +it.qty || 0, price: round2(it.price), taxable: it.taxable !== false,
      ...(it.optional ? { optional: true, on: !!it.on } : {}) }));
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
  // A cell starting with = + - @ could run as a formula in Excel; prefix text like that with '
  const cell = v => { let s = String(v ?? ''); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return rows.map(r => r.map(cell).join(',')).join('\n');
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
  return `<div class="menu-wrap"><button type="button" class="btn" data-menu aria-haspopup="true" aria-expanded="false">${icon('more')}${label}</button><div class="menu" role="menu">${html}<button type="button" class="menu-item menu-cancel">Cancel</button></div></div>`;
}
const menuItem = (label, act, data = '', ic = '', cls = '') => `<button type="button" class="menu-item ${cls}" role="menuitem" data-act="${act}" ${data}>${ic ? icon(ic) : ''}${label}</button>`;
const menuLink = (label, href, ic = '') => `<a class="menu-item" role="menuitem" href="${href}">${ic ? icon(ic) : ''}${label}</a>`;
function actionSheet(menu) {
  if (!menu) return;
  $$('.sheet-backdrop').forEach(x => x.remove()); // never two at once
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="action-sheet" role="menu">${menu.innerHTML}</div>`;
  document.body.append(wrap);
  const close = () => { wrap.classList.add('closing'); setTimeout(() => wrap.remove(), 180); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('.menu-item')) close(); });
}
/* Every action button reacts when the finger lifts: iPhone Safari sometimes skips the click
 * after a scroll or swipe, which made buttons feel dead. Moves over 10px are scrolls and are
 * ignored; the follow-up click (if any) is cancelled, so nothing runs twice. */
(() => {
  let el = null, x = 0, y = 0;
  const SEL = '[data-act]:not(input):not(select):not(textarea), [data-tab], [data-tabset]';
  document.addEventListener('touchstart', e => {
    el = e.touches.length === 1 ? e.target.closest?.(SEL) : null;
    if (el && (el.closest('[data-swipe]') && !el.matches('[data-act]') || el.disabled)) el = null;
    if (el) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
  }, { passive: true });
  document.addEventListener('touchmove', e => { if (el && Math.abs(e.touches[0].clientX - x) + Math.abs(e.touches[0].clientY - y) > 10) el = null; }, { passive: true });
  document.addEventListener('touchend', e => {
    const t = el; el = null;
    if (!t || !isPhone() || e.target.closest?.(SEL) !== t || t.closest('[data-menu], #pageMore, .swipe-act')) return;
    e.preventDefault(); t.click();
  }, { passive: false });
})();
/** The page's "More" menu (in the page header or document toolbar). */
const pageMenu = () => { const b = $$('#main .page-head [data-menu], #main .doc-actions [data-menu]').pop(); return b?.nextElementSibling || null; };
/* iPhone Safari sometimes drops the "click" after a tap. Open menus when the finger lifts,
 * as long as it didn't move (that was a scroll), and cancel the click that may follow. */
(() => {
  let x = 0, y = 0, moved = false;
  document.addEventListener('touchstart', e => { const t = e.touches[0]; x = t.clientX; y = t.clientY; moved = false; }, { passive: true });
  document.addEventListener('touchmove', e => { const t = e.touches[0]; if (Math.abs(t.clientX - x) + Math.abs(t.clientY - y) > 10) moved = true; }, { passive: true });
  document.addEventListener('touchend', e => {
    const t = e.target.closest?.('[data-menu], #pageMore');
    if (!t || moved || !isPhone()) return;
    e.preventDefault();
    actionSheet(t.id === 'pageMore' ? pageMenu() : t.nextElementSibling);
  }, { passive: false });
})();
document.addEventListener('click', e => {
  if (e.target.closest('#pageMore')) { actionSheet(pageMenu()); return; }
  const t = e.target.closest('[data-menu]');
  if (t && isPhone()) { e.preventDefault(); e.stopPropagation(); actionSheet(t.nextElementSibling); return; }
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
  ['label', 'Work'], ['schedule', 'Schedule', 'calendar'], ['jobs', 'Jobs', 'jobs'], ['messages', 'Messages', 'sms'], ['tasks', 'To-dos', 'todo'],
  ['label', 'Sales'], ['canvass', 'Door knocking', 'map'], ['leads', 'Leads', 'funnel'], ['customers', 'Customers', 'users'], ['quotes', 'Quotes', 'quote'], ['plans', 'Service plans', 'repeat'], ['invoices', 'Invoices', 'invoice'],
  ['label', 'Money'], ['income', 'Income', 'income'], ['expenses', 'Expenses', 'expense'], ['reports', 'Reports', 'reports'],
  ['label', 'Business'], ['team', 'Team & time', 'clock'], ['services', 'Price book', 'tag'], ['settings', 'Settings', 'settings'],
];
/* Each section has its own colour, used for its icon tile in the sidebar and the More screen. */
const TINT = { dashboard: '#007AFF', schedule: '#FF3B30', jobs: '#FF9500', messages: '#34C759', tasks: '#64D2FF', canvass: '#30B0C7', leads: '#AF52DE',
  customers: '#5856D6', quotes: '#FF9F0A', plans: '#32ADE6', invoices: '#34C759', income: '#30D158', expenses: '#FF453A',
  reports: '#5E5CE6', team: '#FF2D55', services: '#A2845E', settings: '#8E8E93' };
const SHORT = { canvass: 'Knocking', plans: 'Plans', team: 'Team', services: 'Price book', tasks: 'To-dos' };
const BOTTOM_NAV = [['dashboard', 'Home', 'home'], ['schedule', 'Schedule', 'calendar'], ['canvass', 'Knock', 'map'], ['jobs', 'Jobs', 'jobs']];
const state = { calMonth: today().slice(0, 7), calDay: today(), calView: 'month', calTeam: '', filters: {}, loaded: false };
const filt = (view, key, def) => (state.filters[view] ||= {})[key] ?? def;

function renderChrome() {
  const s = db.settings;
  $$('.js-bizname').forEach(el => el.textContent = s.businessName || 'Business Hub');
  $$('.js-logo').forEach(el => el.innerHTML = s.logo ? `<img src="${s.logo}" alt="">` : esc((s.businessName || 'B')[0].toUpperCase()));
  let cur = (location.hash.split('/')[1] || 'dashboard');
  if (cur === 'signed') cur = 'plans';
  if (cur === 'statement') cur = 'customers';
  const counts = { leads: db.leads.filter(l => l.stage === firstStage()).length,
    tasks: db.tasks.filter(t => !t.done && t.due && t.due <= today()).length, messages: unreadCount(), plans: db.subscriptions.filter(x => x.status === 'sent').length, canvass: comebacksDue().length };
  $('#mobileClock').innerHTML = clockWidget();
  const ur = unreadCount(), mb = $('#msgBadge');
  if (mb) { mb.textContent = ur > 9 ? '9+' : ur; mb.hidden = !ur; }
  const [, , detailId] = location.hash.split('/');
  $('#backBtn').hidden = !detailId;
  const parent = NAV.find(n => n[0] === cur);
  $('#backLabel').textContent = (location.hash.split('/')[1] === 'statement' ? 'Customer' : SHORT[cur] || parent?.[1]) || 'Back';
  document.body.classList.toggle('has-back', !!detailId);
  $('#nav').innerHTML = `<button class="search-btn" data-act="openSearch">${icon('search')}<span>Search</span><kbd>Ctrl K</kbd></button>${clockWidget()}` +
    NAV.map(([k, l, ic]) => k === 'label' ? `<div class="nav-label">${l}</div>` :
    `<a href="#/${k}" class="${cur === k ? 'active' : ''}"><span class="nav-ic" style="--tint:${TINT[k]}">${icon(ic)}</span><span>${l}</span>${counts[k] ? `<span class="count">${counts[k]}</span>` : ''}</a>`).join('');
  $('#bottomNav').innerHTML = BOTTOM_NAV.map(([k, l, ic]) => `<a href="#/${k}" class="${cur === k ? 'active' : ''}">${icon(ic)}<span>${l}</span></a>`).join('') +
    `<button data-act="openMenu" class="${BOTTOM_NAV.some(b => b[0] === cur) ? '' : 'active'}">${icon('more')}<span>More</span></button>`;
  const theme = s.theme === 'auto' ? null : s.theme;
  if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
}

let unmountView = null;
function render() {
  if (!state.loaded) return;
  const [, name = 'dashboard', id] = (location.hash || '#/dashboard').split('/');
  if (name === 'signed' && id) { renderChrome(); receiveSignature(id); return; }
  const view = VIEWS[name] || VIEWS.dashboard;
  renderChrome();
  $('#sidebar').classList.remove('open'); $('.scrim')?.remove();
  if (unmountView) { const u = unmountView; unmountView = null; u(); }
  const html = view(id ? decodeURIComponent(id) : undefined);
  if (html !== undefined) $('#main').innerHTML = html + (id ? '' : fab(name));
  unmountView = view.mount?.(id) || null;
  hydrateImages($('#main'));
  const h1 = $('#main .page-head h1');
  $('#navTitle').textContent = h1 ? ([...h1.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() || h1.textContent.trim()) : '';
  const pm = $('#pageMore'); if (pm) { pm.hidden = !pageMenu(); document.body.classList.toggle('has-page-more', !pm.hidden); }
  const fa = !id && FAB_ACT[name];
  if (fa) $$(`#main .page-head .actions > [data-act="${fa}"]`).forEach(b => b.classList.add('fab-dup'));
  updateNavBar();
  const pageLabel = NAV.find(n => n[0] === name)?.[1];
  document.title = [id ? '' : pageLabel, db.settings.businessName || 'Business Hub'].filter(Boolean).join(' · ');
}
const isPhone = () => matchMedia('(max-width: 760px)').matches;
/** Swipe-left actions on a list row (phones), like iOS Mail. acts: [[action, label, colour, extra data]] */
const swipeAttr = (id, acts) => `data-swipe="${esc(JSON.stringify(acts))}" data-sid="${id}"`;
(() => {
  const W = 78;
  let row = null, open = null, x0 = 0, y0 = 0, base = 0, tx = 0, dragging = false, decided = false;
  const tray = r => r.querySelector(':scope > .swipe-tray') || (() => {
    const acts = JSON.parse(r.dataset.swipe), t = document.createElement('span');
    t.className = 'swipe-tray'; t.style.width = acts.length * W + 'px'; t.style.right = -acts.length * W + 'px';
    t.innerHTML = acts.map(([a, l, c, x], i) => `<button type="button" class="swipe-act" data-i="${i}" style="background:${c}">${esc(l)}</button>`).join('');
    r.append(t); return t;
  })();
  const width = r => JSON.parse(r.dataset.swipe).length * W;
  const settle = (r, to) => { r.style.transition = 'transform .25s cubic-bezier(.2,.9,.25,1)'; r.style.transform = to ? `translateX(${to}px)` : ''; if (!to) { if (open === r) open = null; } else open = r; };
  document.addEventListener('touchstart', e => {
    const r = e.target.closest?.('[data-swipe]');
    if (open && open !== r && !e.target.closest('.swipe-tray')) settle(open, 0);
    if (!r || !isPhone() || e.target.closest('.swipe-tray')) { row = null; return; }
    row = r; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; base = open === r ? -width(r) : 0; dragging = false; decided = false;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!row) return;
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (!decided && Math.abs(dx) + Math.abs(dy) > 10) { decided = true; dragging = Math.abs(dx) > Math.abs(dy) * 1.2; if (dragging) tray(row); }
    if (!dragging) return;
    tx = Math.min(0, Math.max(-width(row) - 40, base + dx));
    row.style.transition = 'none'; row.style.transform = `translateX(${tx}px)`;
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!row || !dragging) { row = null; return; }
    row.dataset.swiped = '1'; setTimeout(() => { if (row) delete row.dataset.swiped; }, 400);
    settle(row, tx < -width(row) / 2 ? -width(row) : 0);
  });
  const fire = (b, r, e) => {
    e.preventDefault(); e.stopPropagation();
    const [a, , , x] = JSON.parse(r.dataset.swipe)[+b.dataset.i];
    settle(r, 0); ACTIONS[a]?.({ id: r.dataset.sid, ...(x || {}) }, b, e);
  };
  // Buttons in the tray act when the finger lifts (a click doesn't always follow a swipe on iPhone).
  let bx = 0, by = 0;
  document.addEventListener('touchstart', e => { if (e.target.closest?.('.swipe-act')) { bx = e.touches[0].clientX; by = e.touches[0].clientY; } }, { passive: true });
  document.addEventListener('touchend', e => {
    const b = e.target.closest?.('.swipe-act'), r = b?.closest('[data-swipe]'), t = e.changedTouches[0];
    if (b && r && Math.abs(t.clientX - bx) + Math.abs(t.clientY - by) < 12) fire(b, r, e);
  }, { passive: false });
  document.addEventListener('click', e => {
    const b = e.target.closest('.swipe-act');
    const r = e.target.closest('[data-swipe]');
    if (b && r) { fire(b, r, e); return; }
    if (r && (r.dataset.swiped || open === r)) { e.preventDefault(); e.stopPropagation(); if (!r.dataset.swiped) settle(r, 0); }
  }, true);
})();
const FAB_ACT = { messages: 'newMessage', dashboard: 'newJob', schedule: 'newJob', jobs: 'newJob', customers: 'newCustomer', quotes: 'newQuote',
  invoices: 'newInvoice', expenses: 'newExpense', income: 'newIncome', services: 'newService', leads: 'newLead', tasks: 'newTask', plans: 'newPlan', team: 'newMember' };
const fab = name => FAB_ACT[name] ? `<button class="fab no-print" data-act="${FAB_ACT[name]}" aria-label="Add">${icon('plus')}</button>` : '';
/** iOS large titles: once the big page title scrolls under the bar, show it small in the bar. */
function updateNavBar() {
  const bar = $('.mobile-bar'), h = $('#main .page-head h1');
  if (!bar || !bar.offsetHeight) return;
  const edge = bar.getBoundingClientRect().bottom;
  document.body.classList.toggle('nb-scrolled', scrollY > 4);
  document.body.classList.toggle('nb-show-title', h ? h.getBoundingClientRect().bottom < edge + 2 : scrollY > 30);
}
window.addEventListener('scroll', updateNavBar, { passive: true });
const go = h => { if (location.hash === h) render(); else location.hash = h; };
const refresh = () => { save(); render(); };
const head = (title, actions = '', sub = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<div class="muted small">${sub}</div>` : ''}</div><div class="actions">${actions}</div></div>`;
const btn = (label, act, cls = '', data = '', ic = '') => `<button class="btn ${cls}" data-act="${act}" ${data}>${ic ? icon(ic) : ''}${label}</button>`;
const empty = (ic, msg, action = '') => `<div class="empty">${icon(ic)}<div>${msg}</div>${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;
/** Long lists show 100 rows at a time so phones stay quick. */
function paged(list, key) {
  const lim = state.limits?.[key] || 100;
  return { rows: list.slice(0, lim), more: list.length > lim
    ? `<div class="show-more">${btn(`Show more (${list.length - lim} more)`, 'showMore', 'btn-sm', `data-k="${key}"`)}</div>` : '' };
}
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
  const exp = round2(sum(db.expenses.filter(x => inRange(x.date, m0, m1)), x => x.amount) + commissionsOwed(m0, m1));
  const open = db.invoices.filter(isOpenInv);
  const overdue = open.filter(i => invStatus(i) === 'overdue');
  const ar = sum(open, balance);
  const upcoming = db.jobs.filter(j => ['scheduled', 'in_progress'].includes(j.status) && inRange(j.date, t, addDays(t, 7)))
    .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
  const todayCount = upcoming.filter(j => j.date === t).length;
  const remindTomorrow = reminderJobs();
  const toSchedule = db.quotes.filter(q => q.status === 'approved' && q.signature && !q.jobId && !db.jobs.some(j => j.quoteId === q.id));
  const changeReqs = db.quotes.filter(q => q.changeRequest && ['sent', 'draft'].includes(q.status));
  const unreadMsgs = db.messages.filter(m => m.dir === 'in' && !m.read).length;
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
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installTip = isIOS && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches && !s.hideInstall
    ? `<div class="card install-tip"><img src="icons/icon-180.png" alt="" width="44" height="44"><div class="grow"><b>Install Business Hub</b>
      <div class="small muted">Tap <span class="share-ic" aria-label="Share">${icon('share')}</span> then <b>Add to Home Screen</b>. It opens full-screen like an app.</div></div>${btn('✕', 'hideInstall', 'btn-icon', 'aria-label="Dismiss"')}</div>` : '';
  const welcome = installTip + (isEmpty ? `<div class="card" style="margin-bottom:16px"><h2>Welcome! Let’s get your business set up 👋</h2>
    <p class="muted">Add your business details and logo so they appear on quotes and invoices, then add your first customer.
    Want to look around first? Load sample data. You can erase it any time from Settings.</p>
    <div class="row">${btn('Set up my business', 'quickSetup', 'btn-primary')}${btn('Add a customer', 'newCustomer')}${btn('Load sample data', 'loadSample')}</div></div>`
    : setupLeft && !s.hideSetup ? `<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Getting started · ${4 - setupLeft} of 4 done</h2>${btn('Hide', 'hideSetup', 'btn-sm')}</div>
      <div class="progress" style="margin-bottom:10px"><i style="width:${(4 - setupLeft) * 25}%"></i></div>
      ${setupSteps.map(([done, label, href]) => `<a class="setup-step ${done ? 'done' : ''}" href="${href}" ${href === '#/settings' && !done ? 'data-act="quickSetup"' : ''}>${icon(done ? 'check' : 'plus')}<span>${label}</span></a>`).join('')}</div>` : '');

  // money paid to employees this month: wage/commission payouts recorded as expenses
  const wages = db.expenses.filter(x => inRange(x.date, m0, m1) && (x.isCommission || x.category === 'Wages & Payroll'));
  const teamPaid = sum(wages, x => x.amount), teamOwed = commissionsOwed(m0, m1);
  const paidBy = Object.entries(wages.reduce((o, x) => { const k = x.vendor || 'Other'; o[k] = (o[k] || 0) + +x.amount; return o; }, {})).sort((a, b) => b[1] - a[1]);
  const knockDue = comebacksDue();
  const readyToCharge = stripeOn() ? open.filter(i => stripeCard(i.customerId)) : [];
  const kt = knockStats(t, t, ''), kw = knockStats(addDays(t, -parseD(t).getDay()), t, '');
  const knockCard = db.pins.length ? `<a class="card knock-card" href="#/canvass" data-tabset="canvass:tab:stats" style="color:inherit"><div class="card-head"><h2>Door knocking</h2><span class="small" style="color:var(--primary)">Stats →</span></div>
    <div class="knock-mini">${[['Doors', kt.doors, kw.doors], ['Sales', kt.sale, kw.sale], ['Quotes', kt.quote, kw.quote], ['Come-backs', kt.comeback, kw.comeback]]
      .map(([l, a, b]) => `<div><b>${a}</b><span>${l} today</span><span class="muted">${b} this week</span></div>`).join('')}</div></a>` : '';
  const awaitingSig = db.subscriptions.filter(x => x.status === 'sent' && x.sentAt && daysBetween(x.sentAt, t) >= 3);
  const planCust = new Set(db.subscriptions.filter(x => x.status === 'active').map(x => x.customerId));
  const expiringCards = [...planCust].filter(cid => (cust(cid)?.cards || []).length && !defaultCard(cid) || (cust(cid)?.cards || []).some(k => k.isDefault && cardState(k)));
  const endingPlans = db.subscriptions.filter(x => x.status === 'active' && !x.autoRenew && inRange(planEnd(x), t, addDays(t, 30)));
  const attn = [
    overdue.length && ['bad', 'alert', `${plural(overdue.length, 'overdue invoice')}`, `${money(sum(overdue, balance))} owed. Tap to remind them all.`, '', '', 'remindOverdue'],
    newLeads.length && ['info', 'funnel', `${plural(newLeads.length, 'new lead')}`, 'Waiting for you to get in touch', '#/leads'],
    uninvoiced.length && ['warn', 'invoice', `${plural(uninvoiced.length, 'job')} to invoice`, 'Completed but not billed yet', '#/jobs', 'jobs:tab:uninvoiced'],
    toSchedule.length && ['good', 'check', `${plural(toSchedule.length, 'approved quote')} to schedule`, `${esc(custName(toSchedule[0].customerId))}${toSchedule.length > 1 ? ' and others' : ''} said yes. Book the job.`, `#/quotes/${toSchedule[0].id}`],
    changeReqs.length && ['warn', 'quote', `${plural(changeReqs.length, 'quote')} with changes requested`, 'The customer asked you to update the quote', `#/quotes/${changeReqs[0].id}`],
    unreadMsgs && ['info', 'sms', `${plural(unreadMsgs, 'unread text')}`, 'Customers replied to you', '#/messages'],
    staleQuotes.length && ['info', 'quote', `${plural(staleQuotes.length, 'quote')} to follow up`, 'Sent 3+ days ago with no answer. Tap to follow up all.', '', '', 'followQuotes'],
    remindTomorrow.length && ['info', 'sms', `Remind ${plural(remindTomorrow.length, 'customer')} about tomorrow`, 'Send appointment reminders in one go', '', '', 'sendReminders'],
    lateJobs.length && ['warn', 'calendar', `${plural(lateJobs.length, 'past job')} still open`, 'Mark them complete or reschedule', '#/jobs', 'jobs:tab:late'],
    awaitingSig.length && ['info', 'repeat', `${plural(awaitingSig.length, 'plan')} waiting for signature`, 'Sent 3+ days ago. Send a reminder.', '#/plans'],
    expiringCards.length && ['warn', 'expense', `${plural(expiringCards.length, 'card')} expiring`, 'Customers on a plan need a new card', `#/customers/${expiringCards[0]}`],
    endingPlans.length && ['warn', 'repeat', `${plural(endingPlans.length, 'plan')} ending soon`, 'Renew before the last visit', `#/plans/${endingPlans[0].id}`],
    readyToCharge.length && ['info', 'expense', `${plural(readyToCharge.length, 'invoice')} ready to charge`, 'Unpaid, with a Stripe card on file', '#/invoices', 'invoices:tab:unpaid'],
    knockDue.length && ['warn', 'clock', `${plural(knockDue.length, 'come-back')} due`, 'Houses that asked you to come back', '#/canvass'],
    needsBackup && ['warn', 'download', 'Back up your data', s.lastBackup ? `Last backup ${fmtDate(s.lastBackup)}` : 'No backup yet. Tap to save one.', '', '', 'exportBackup'],
  ].filter(Boolean);
  const attnHTML = attn.map(([tone, ic, title, sub, href, tabset, act]) => {
    const inner = `<span class="attn-ic ${tone}">${icon(ic)}</span><span class="grow"><b>${title}</b><span class="muted small">${sub}</span></span><span class="chev">›</span>`;
    return act ? `<button class="attn-row" data-act="${act}">${inner}</button>` : `<a class="attn-row" href="${href}" ${tabset ? `data-tabset="${tabset}"` : ''}>${inner}</a>`;
  }).join('');
  const onClock = [];

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
  ${attn.length ? `<div class="card show-sm" style="margin-bottom:14px"><div class="card-head"><h2>Needs attention</h2></div><div class="attn">${attnHTML}</div></div>` : ''}
  <div class="grid grid-5 dash-stats">
    <a class="card stat" href="#/income" style="color:inherit"><div class="label"><span class="stat-ic" style="--tint:#34C759">${icon('income')}</span>Income this month</div><div class="value">${money(inc)}</div>
      ${goal ? `<div class="progress" title="${goalPct}% of goal"><i style="width:${goalPct}%"></i></div><div class="sub">${goalPct}% of ${money(goal)} goal</div>`
        : `<div class="sub">${delta === null ? 'Payments received' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs last month`}</div>`}</a>
    <a class="card stat" href="#/expenses" style="color:inherit"><div class="label"><span class="stat-ic" style="--tint:#FF3B30">${icon('expense')}</span>Expenses this month</div><div class="value">${money(exp)}</div><div class="sub">${commissionsOwed(m0, m1) ? `incl. ${money(commissionsOwed(m0, m1))} commissions owed` : plural(db.expenses.filter(x => inRange(x.date, m0, m1)).length, 'expense')}</div></a>
    <a class="card stat" href="#/reports" style="color:inherit"><div class="label"><span class="stat-ic" style="--tint:#007AFF">${icon('reports')}</span>Profit this month</div><div class="value" style="color:${inc - exp < 0 ? 'var(--bad)' : 'inherit'}">${money(inc - exp)}</div><div class="sub">${inc ? Math.round((inc - exp) / inc * 100) + '% margin' : '—'}</div></a>
    <a class="card stat" href="#/team" data-tabset="team:tab:pay" style="color:inherit"><div class="label"><span class="stat-ic" style="--tint:#FF2D55">${icon('users')}</span>Paid to team this month</div><div class="value">${money(teamPaid)}</div>
      <div class="sub">${teamOwed ? `<span style="color:var(--warn)">${money(teamOwed)} still owed</span>` : paidBy.length ? paidBy.slice(0, 2).map(([n, v]) => `${esc(n)} ${money(v)}`).join(' · ') : 'No payouts yet'}</div></a>
    <a class="card stat" href="#/invoices" style="color:inherit"><div class="label"><span class="stat-ic" style="--tint:#FF9500">${icon('invoice')}</span>Owed to you</div><div class="value">${money(ar)}</div><div class="sub">${open.length} open · <span style="color:${overdue.length ? 'var(--bad)' : 'inherit'}">${overdue.length} overdue</span></div></a>
  </div>
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
      ${clockCard()}
      ${knockCard}
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
  return `<a class="list-item" href="#/jobs/${j.id}" style="color:inherit" ${['scheduled', 'in_progress'].includes(j.status) ? swipeAttr(j.id, [['editJob', 'Edit', '#8e8e93'], ['jobStatus', 'Done', '#34c759', { s: 'completed' }]]) : ''}>
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
  const pg = paged(list, 'jobs');
  const count = k => db.jobs.filter(tests[k]).length;
  return head('Jobs', btn('New job', 'newJob', 'btn-primary', '', 'plus')) + `<div class="card">
    ${tabsHTML('jobs', 'tab', [['upcoming', `Upcoming (${count('upcoming')})`], ['late', `Past due (${count('late')})`], ['uninvoiced', `To invoice (${count('uninvoiced')})`], ['completed', 'Completed'], ['all', 'All']], tab)}
    <div class="toolbar"><input type="search" placeholder="Search jobs…" value="${esc(q)}" data-filter="jobs:q"></div>
    ${list.length ? `<div class="show-sm">${pg.rows.map(jobListItem).join('')}</div><div class="table-wrap hide-sm"><table><thead><tr><th>Date</th><th>Job</th><th class="hide-sm">Customer</th><th class="hide-sm">Assigned</th><th>Status</th><th class="num">Value</th></tr></thead><tbody>
    ${pg.rows.map(j => `<tr class="clickable" data-href="#/jobs/${j.id}"><td>${j.date ? fmtDateShort(j.date) : '<span class="muted">Unscheduled</span>'}<div class="muted small">${fmtTime(j.start)}</div></td>
      <td><b>${esc(j.title)}</b><div class="muted small">${esc(j.address || '')}</div></td><td class="hide-sm">${esc(custName(j.customerId))}</td>
      <td class="hide-sm">${esc(j.assignedTo || '')}</td><td>${badge(j.status)}${j.invoiceId ? ' <span class="badge">invoiced</span>' : ''}</td><td class="num">${money(jobValue(j))}</td></tr>`).join('')}
    </tbody></table></div>${pg.more}` : empty('jobs', 'No jobs here.', btn('New job', 'newJob', 'btn-sm'))}</div>`;
};

function jobDetail(id) {
  const j = byId('jobs', id); if (!j) return empty('jobs', 'Job not found.', '<a class="btn btn-sm" href="#/jobs">Back to jobs</a>');
  const c = cust(j.customerId), inv = j.invoiceId && byId('invoices', j.invoiceId);
  const exps = db.expenses.filter(e => e.jobId === j.id);
  const revenue = jobValue(j), cost = sum(exps, e => e.amount), tax = inv ? totals(inv).tax : totals(j).tax;
  const pay = jobPay(j);
  const profit = revenue - tax - cost - pay.cleaner - pay.sales;
  const addr = j.address || c?.address || '';
  const statusBtns = {
    scheduled: (j.date === today() && cust(j.customerId)?.phone ? btn(j.onWayAt ? 'On my way ✓' : 'On my way', 'onMyWay', '', `data-id="${j.id}"`, 'truck') : '') + btn('Start job', 'jobStatus', '', `data-id="${j.id}" data-s="in_progress"`, 'clock') + btn('Complete', 'jobStatus', 'btn-primary', `data-id="${j.id}" data-s="completed"`, 'check'),
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
    jobMenu, `<a class="crumb" href="#/jobs">← All jobs</a>${series ? `<span class="crumb"> · </span><a href="#/plans">${icon('repeat').replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} ${ruleLabel(series.rule)}</a>` : ''}`) + `
  <div class="grid grid-2">
    <div class="card"><h2 style="margin-bottom:10px">Details</h2>
      <div class="stack info-list" style="gap:8px">
        <div><div class="muted small">Customer</div>${c ? `<a href="#/customers/${c.id}"><b>${esc(c.name)}</b></a>${c.phone ? ` <span class="muted small">${esc(c.phone)}</span>` : ''}` : '—'}</div>
        <div><div class="muted small">When</div>${j.date ? fmtDateShort(j.date) : 'Not scheduled yet'}${j.start ? `, ${fmtTime(j.start)}${j.end ? ' – ' + fmtTime(j.end) : ''}` : ''}</div>
        ${j.startedAt ? `<div><div class="muted small">Time on job</div>${fmtHours(worked)}${j.finishedAt ? '' : ' <span class="badge warn">running</span>'} <span class="muted small">(started ${fmtClock(j.startedAt)}${j.finishedAt ? ', finished ' + fmtClock(j.finishedAt) : ''})</span></div>` : ''}
        ${addr ? `<div><div class="muted small">Address</div><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}">${esc(addr)} ↗</a></div>` : ''}
        ${j.assignedTo ? `<div><div class="muted small">Assigned to</div>${memberColor(j.assignedTo) ? `<span class="dot" style="background:${memberColor(j.assignedTo)}"></span>` : ''}${esc(j.assignedTo)}</div>` : ''}
        ${j.salesRep ? `<div><div class="muted small">Sold by</div>${esc(j.salesRep)}</div>` : ''}
        ${j.planId && byId('subscriptions', j.planId) ? `<div><div class="muted small">Service plan</div><a href="#/plans/${j.planId}">${esc(byId('subscriptions', j.planId).number)} · ${esc(byId('subscriptions', j.planId).name)}</a></div>` : ''}
        ${j.quoteId && byId('quotes', j.quoteId) ? `<div><div class="muted small">From quote</div><a href="#/quotes/${j.quoteId}">${esc(byId('quotes', j.quoteId).number)}</a></div>` : ''}
        ${j.notes ? `<div><div class="muted small">Notes</div><div style="white-space:pre-wrap">${esc(j.notes)}</div></div>` : ''}
        ${c?.notes ? `<div><div class="muted small">Customer notes</div><div style="white-space:pre-wrap">${esc(c.notes)}</div></div>` : ''}
      </div>
      ${c ? `<div class="row" style="margin-top:14px">${contactBtns(c)}</div>` : ''}
      ${msgBtns ? `<div class="muted small" style="margin:12px 0 6px">Quick texts</div><div class="row">${msgBtns}</div>` : ''}
      ${['scheduled', 'in_progress'].includes(j.status) && !(me() && openEntry(me().id)) ? `<div class="row" style="margin-top:10px">${btn('Clock in to this job', 'myClock', 'btn-sm', `data-job="${j.id}"`, 'clock')}</div>` : ''}
    </div>
    <div class="card"><div class="card-head"><h2>Job costing</h2>${btn('Add expense', 'newExpense', 'btn-sm', `data-job="${j.id}"`, 'plus')}</div>
      <div class="grid grid-3" style="gap:8px;margin-bottom:12px">
        <div><div class="muted small">Revenue (pre-tax)</div><b class="num">${money(revenue - tax)}</b></div>
        <div><div class="muted small">Commissions + costs</div><b class="num">${money(cost + pay.cleaner + pay.sales)}</b></div>
        <div><div class="muted small">Profit</div><b class="num" style="color:${profit < 0 ? 'var(--bad)' : 'var(--good)'}">${money(profit)}</b>${margin !== null ? ` <span class="muted small">${margin}%</span>` : ''}</div>
      </div>
      ${j.assignedTo || j.salesRep ? `<div class="pay-sum" style="margin:0 0 10px">
        ${j.assignedTo ? `<div class="pay-row"><span>${esc(j.assignedTo)} (cleaner, ${pay.cPct}%)${j.cleanerPaid ? ' <span class="badge good">paid</span>' : ''}</span><b>−${money(pay.cleaner)}</b></div>` : ''}
        ${j.salesRep ? `<div class="pay-row"><span>${esc(j.salesRep)} (sales, ${pay.sPct}%)${j.salesPaid ? ' <span class="badge good">paid</span>' : ''}</span><b>−${money(pay.sales)}</b></div>` : ''}
        <div class="pay-row keep"><span>You keep after commissions${cost ? ' and costs' : ''}</span><b>${money(profit)}</b></div></div>` : ''}
      ${exps.length ? exps.map(e => `<div class="list-item clickable" data-act="editExpense" data-id="${e.id}"><div class="grow"><div class="title">${esc(e.vendor || e.category)}</div><div class="muted small">${fmtDate(e.date)} · ${esc(e.category)}</div></div><span class="num">${money(e.amount)}</span></div>`).join('')
        : '<p class="muted small">Link materials, subcontractor and other costs to this job to see your real profit.</p>'}
    </div>
  </div>
  <div class="card"><div class="card-head"><h2>Photos</h2>
    <label class="btn btn-sm">${icon('camera')}Add photos<input type="file" accept="image/*" multiple class="js-job-photos" data-id="${j.id}" hidden></label></div>
    ${photos.length ? `<div class="photo-grid">${photos.map(ph => `<button class="photo" data-act="viewPhoto" data-id="${j.id}" data-pid="${ph.id}" aria-label="View photo"><img ${imgAttr(ph)} alt=""></button>`).join('')}</div>`
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
  return head('Leads', btn('New lead', 'newLead', 'btn-primary', '', 'plus') + btn('Booking form', 'bookingShare', '', '', 'share'), 'Track every enquiry from first call to booked job. Share your booking form and online requests land here.') + `
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
function repeatVisitsHTML() {
  const tab = filt('visits', 'tab', 'active');
  const all = seriesList(), active = all.filter(p => p.active), ended = all.filter(p => !p.active);
  const list = tab === 'active' ? active : ended;
  const next30 = active.reduce((n, p) => n + p.future.filter(j => j.date <= addDays(today(), 30)).length, 0);
  return `
  <div class="grid grid-3" style="margin-top:16px">
    <div class="card stat"><div class="label">Repeating jobs</div><div class="value">${active.length}</div><div class="sub">${new Set(active.map(p => p.customerId)).size} customers</div></div>
    <div class="card stat"><div class="label">Recurring revenue</div><div class="value">${money(sum(active, p => p.monthly))}</div><div class="sub">Estimated per month</div></div>
    <div class="card stat"><div class="label">Visits next 30 days</div><div class="value">${next30}</div><div class="sub">${money(sum(active, p => p.future.filter(j => j.date <= addDays(today(), 30)).length * p.per))} booked</div></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="row" style="justify-content:space-between">${tabsHTML('visits', 'tab', [['active', `Active (${active.length})`], ['ended', `Ended (${ended.length})`]], tab)}${btn('New recurring job', 'newJob', 'btn-sm', 'data-repeat="weekly"', 'plus')}</div>
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
  const tabs = tabsHTML('team', 'tab', [['team', `Team (${db.team.length})`], ['time', 'Timesheets'], ['pay', 'Commissions']], tab);
  if (tab === 'pay') return commissionsHTML(tabs);
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
    ${field('Cleaner commission %', `<div class="pct-input">${inp('cleanerPct', m.cleanerPct ?? '', `type="number" min="0" max="100" step="0.5" placeholder="Default ${db.settings.cleanerPct}"`)}<span>%</span></div>`)}
    ${field('Sales commission %', `<div class="pct-input">${inp('salesPct', m.salesPct ?? '', `type="number" min="0" max="100" step="0.5" placeholder="Default ${db.settings.salesPct}"`)}<span>%</span></div>`)}
    <div class="field full"><label>Calendar colour</label><div class="row">${TEAM_COLORS.map(c => `<label class="swatch"><input type="radio" name="color" value="${c}" ${c === m.color ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>
  </div>`, footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Remove</button>`,
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => {
      if (!confirm(`Remove ${m.name} from your team? Their past time entries and jobs are kept.`)) return;
      const snap = snapshot(); db.team = db.team.filter(x => x.id !== m.id); close(); refresh(); undoToast(snap, `${m.name} removed`);
    }),
    onSubmit: (f, d) => {
      const oldName = m.name;
      Object.assign(m, { name: d.name.trim(), phone: d.phone, email: d.email.trim(), role: d.role, rate: +d.rate || 0, color: d.color || m.color,
        cleanerPct: d.cleanerPct === '' ? null : +d.cleanerPct, salesPct: d.salesPct === '' ? null : +d.salesPct });
      if (isNew) { m.id = uid(); db.team.push(m); }
      else if (oldName && oldName !== m.name) {
        db.jobs.forEach(j => { if (j.assignedTo === oldName) j.assignedTo = m.name; if (j.salesRep === oldName) j.salesRep = m.name; });
        [...db.customers, ...db.subscriptions].forEach(x => { if (x.salesRep === oldName) x.salesRep = m.name; });
        db.subscriptions.forEach(x => { if (x.assignedTo === oldName) x.assignedTo = m.name; });
        db.pins.forEach(pin => (pin.history || []).forEach(h => { if (h.rep === oldName) h.rep = m.name; }));
      }
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

/* =====================================================================
 * Service plans (subscription agreements), templates and cards on file
 * ===================================================================== */
const BILLING = [['per_visit', 'Per visit'], ['monthly', 'Monthly'], ['yearly', 'Yearly'], ['upfront', 'Upfront for the term']];
const planEnd = p => p.end || addDays(addMonths(p.start, +p.termMonths || 12), -1);
/* ----- plan add-ons: extra services on top of the main one (gutters, interior windows…) ----- */
const ADDON_WHEN = [['every', 'Every visit'], ['once', 'Once a term']];
const addonItem = a => ({ desc: a.desc, details: a.details || '', qty: +a.qty || 1, price: +a.price || 0, taxable: a.taxable !== false, addon: a.when || 'every' });
/** Line items for one visit. The first visit of a term also includes "once" add-ons. */
const planVisitItems = (p, first = false) => [...(p.items || []), ...(p.addons || []).filter(a => a.when !== 'once' || first).map(addonItem)];
const planEvery = p => ({ ...p, items: planVisitItems(p) });
const planOnceItems = p => (p.addons || []).filter(a => a.when === 'once').map(addonItem);
const planOnceTotal = p => { const once = planOnceItems(p); return once.length ? totals({ items: once, taxRate: p.taxRate }).total : 0; };
function addonsEditorHTML() {
  const flagged = db.services.filter(x => x.addon), list = flagged.length ? flagged : db.services;
  return `<div class="form-section"><h3>Add-ons <span class="muted small">(extra services for this customer)</span></h3>
    <div class="addon-chips js-addon-chips">${list.map(x => `<button type="button" class="chip-btn" data-svc="${x.id}">${icon('plus')}${esc(x.name)} <span class="muted">${money(x.price)}</span></button>`).join('')}
      <button type="button" class="chip-btn" data-svc="">${icon('plus')}Custom add-on</button></div>
    <div class="addon-list js-addons"></div>
    <div class="addon-sum js-addon-sum"></div></div>`;
}
function mountAddons(f, p, getItems) {
  const addons = (p.addons || []).map(a => ({ ...a }));
  const box = $('.js-addons', f), sumEl = $('.js-addon-sum', f);
  const summary = () => {
    const main = getItems(), every = addons.filter(a => a.when !== 'once' && String(a.desc).trim()).map(addonItem), once = addons.filter(a => a.when === 'once' && String(a.desc).trim()).map(addonItem);
    const per = totals({ items: [...main, ...every], discount: f.discount?.value, taxRate: f.taxRate?.value });
    const one = once.length ? totals({ items: once, taxRate: f.taxRate?.value }).total : 0;
    sumEl.innerHTML = every.length || once.length ? `<b>${money(per.total)}</b> per visit with add-ons${one ? ` · <b>${money(one)}</b> one-time add-ons on the first visit` : ''} <span class="muted">(incl. ${esc(db.settings.taxName)})</span>` : '';
  };
  const draw = () => {
    box.innerHTML = addons.map((a, i) => `<div class="addon-row" data-i="${i}">
      <input data-k="desc" value="${esc(a.desc)}" placeholder="e.g. Interior windows + track cleaning" aria-label="Add-on">
      <div class="money-input"><span>${curSymbol()}</span><input data-k="price" type="number" step="0.01" min="0" value="${esc(a.price)}" placeholder="0.00" aria-label="Add-on price"></div>
      <select data-k="when" aria-label="How often">${opts(ADDON_WHEN, a.when || 'every')}</select>
      <button type="button" class="btn btn-icon" data-rm-addon="${i}" aria-label="Remove add-on">✕</button></div>`).join('')
      || '<p class="muted small" style="margin:6px 0 0">No add-ons. Tap one above to add it to this plan.</p>';
    summary();
  };
  const onEdit = e => { const row = e.target.closest('.addon-row'), k = e.target.dataset.k; if (row && k) { addons[+row.dataset.i][k] = e.target.value; summary(); } };
  box.addEventListener('input', onEdit); box.addEventListener('change', onEdit);
  box.addEventListener('click', e => { const b = e.target.closest('[data-rm-addon]'); if (b) { addons.splice(+b.dataset.rmAddon, 1); draw(); } });
  $('.js-addon-chips', f).addEventListener('click', e => {
    const b = e.target.closest('[data-svc]'); if (!b) return;
    const x = byId('services', b.dataset.svc);
    addons.push(x ? { id: uid(), desc: x.name, details: x.description || '', price: x.price, qty: 1, taxable: x.taxable !== false, when: 'every' }
      : { id: uid(), desc: '', details: '', price: '', qty: 1, taxable: true, when: 'every' });
    draw(); if (!x) $$('[data-k=desc]', box).pop()?.focus();
  });
  f.addEventListener('input', e => { if (!e.target.closest('.js-addons')) summary(); });
  draw();
  const get = () => addons.filter(a => String(a.desc).trim()).map(a => ({ id: a.id || uid(), desc: String(a.desc).trim(), details: a.details || '', qty: 1, price: round2(a.price), taxable: a.taxable !== false, when: a.when || 'every' }));
  get.set = list => { addons.splice(0, addons.length, ...(list || []).map(a => ({ ...a }))); draw(); };
  return get;
}
const addonTag = a => `<span class="addon-tag">Add-on · ${a.addon === 'once' ? 'once a term' : 'every visit'}</span>`;

const planTotal = p => totals(planEvery(p)).total;
function planPriceLabel(p) {
  const t = money(planTotal(p)), once = planOnceTotal(p);
  const base = { per_visit: `${t} per visit`, monthly: `${t} per month`, yearly: `${t} per year`, upfront: `${t} for the ${+p.termMonths || 12}-month term` }[p.billing] || t;
  return once ? `${base} + ${money(once)} one-time add-ons` : base;
}
const planVisitDates = (p, from = p.start, to = planEnd(p)) => p.rule ? recurDates(from, { ...p.rule, count: undefined, until: to }) : [];
function planMonthly(p) {
  const t = totals(planEvery(p)).sub + (planOnceItems(p).length ? totals({ items: planOnceItems(p) }).sub / (+p.termMonths || 12) : 0);
  return { per_visit: t * visitsPerMonth(p.rule), monthly: t, yearly: t / 12, upfront: t / (+p.termMonths || 12) }[p.billing] || 0;
}
const planJobs = p => db.jobs.filter(j => j.planId === p.id);
const planDone = p => planJobs(p).filter(j => j.status === 'completed').length;
const planNext = p => planJobs(p).filter(j => j.status === 'scheduled' && j.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
const planStatus = p => (p.status === 'active' && planEnd(p) < today() && !p.autoRenew ? 'ended' : p.status || 'draft');
Object.assign(BADGE, { active: 'good', ended: '', expired: 'warn' });
const planTermsRaw = p => p.terms || db.settings.planTerms || BH.DEFAULT_TERMS;
function planTermsText(p) {
  const s = db.settings;
  return planTermsRaw(p).replace(/\{(\w+)\}/g, (m, k) => ({
    business: s.businessName || 'The Service Provider', start: fmtDate(p.start), term: String(+p.termMonths || 12), price: planPriceLabel(p),
    minVisits: String(+p.minVisits || 0), fee: money(+p.cancelFee || 0), customer: custName(p.customerId),
    renew: p.autoRenew ? ` It renews automatically for another ${+p.termMonths || 12} months unless you cancel before it ends.` : '',
  }[k] ?? m));
}
/** Exactly what the customer agrees to; its fingerprint ties a signature to this wording. */
function planCanonical(p) {
  return [p.number, custName(p.customerId), p.name, planPriceLabel(p), p.rule ? ruleLabel(p.rule) : '', p.start, +p.termMonths || 12,
    +p.minVisits || 0, +p.cancelFee || 0, p.autoRenew ? 'renew' : '', ...(p.items || []).map(i => `${i.desc}|${i.qty}|${i.price}`),
    ...(p.addons || []).map(a => `+${a.desc}|${a.price}|${a.when}`), planTermsText(p)].join('\n');
}
function planSchedule(p) {
  const n = planVisitDates(p).length;
  return `${p.rule ? ruleLabel(p.rule) : 'As scheduled'} · ${n} visit${n === 1 ? '' : 's'} in the first ${+p.termMonths || 12} months`;
}

/* ----- cards on file (reference only — full numbers live with the payment processor) ----- */
const CARD_BRANDS = ['Visa', 'Mastercard', 'American Express', 'Discover', 'Interac Debit', 'Other'];
const PROCESSORS = ['Stripe', 'Square', 'Helcim', 'Moneris', 'Clover', 'PayPal', 'Other'];
const cardExp = c => { const [m, y] = String(c.exp || '').split('/').map(Number); return m && y ? `20${pad(y)}-${pad(m)}` : ''; };
function cardState(c) {
  const e = cardExp(c), now = today().slice(0, 7);
  if (!e) return '';
  if (e < now) return 'expired';
  return e <= addMonths(today(), 1).slice(0, 7) ? 'expiring' : '';
}
const cardLabel = c => `${c.brand || 'Card'} •••• ${c.last4}`;
const defaultCard = cid => { const cs = cust(cid)?.cards || []; return cs.find(c => c.isDefault && cardState(c) !== 'expired') || cs.find(c => cardState(c) !== 'expired'); };
function cardsHTML(c) {
  const cards = c.cards || [];
  const auths = db.subscriptions.filter(p => p.customerId === c.id && p.signature);
  return `${cards.length ? cards.map(k => {
    const st = cardState(k);
    return `<div class="card-row clickable" data-act="editCard" data-id="${c.id}" data-cid="${k.id}">
      <span class="card-chip">${esc((k.brand || 'Card').split(' ')[0])}</span>
      <div class="grow"><div class="title">${esc(cardLabel(k))}${k.isDefault ? ' <span class="badge info">default</span>' : ''}${st ? ` <span class="badge ${st === 'expired' ? 'bad' : 'warn'}">${st}</span>` : ''}</div>
      <div class="muted small">Exp ${esc(k.exp || '—')}${k.pmId ? ' · <b style="color:var(--good)">Stripe ✓ ready to charge</b>' : k.processor ? ` · saved in ${esc(k.processor)}` : ''}${k.name && !k.pmId ? ` · ${esc(k.name)}` : ''}</div></div></div>`;
  }).join('') : '<p class="muted small" style="margin:0 0 8px">No cards on file.</p>'}
  ${auths.length ? `<p class="muted small" style="margin:8px 0 0">${icon('check').replace('<svg', '<svg style="width:13px;height:13px;vertical-align:-2px"')} Charge authorization signed on ${auths.map(p => `<a href="#/plans/${p.id}">${esc(p.number)}</a> (${fmtDate(p.signature.at.slice(0, 10))})`).join(', ')}</p>` : ''}
  <div class="row" style="margin-top:10px">${stripeOn() ? btn('Save card with Stripe', 'stripeCardLink', 'btn-sm btn-primary', `data-id="${c.id}"`, 'expense') + (c.stripeId ? btn('Refresh', 'syncCards', 'btn-sm', `data-id="${c.id}"`, 'repeat') : '')
      : btn('Add card', 'newCard', 'btn-sm', `data-id="${c.id}"`, 'plus')}
    ${!stripeOn() && db.settings.cardSetupLink && c.phone ? `<a class="btn btn-sm" href="${smsHref(c.phone, `Hi ${firstName(c.name)}, you can securely add your card for ${db.settings.businessName || 'us'} here: ${db.settings.cardSetupLink}`)}">${icon('sms')}Text secure card link</a>` : ''}</div>
  ${stripeOn() ? `<button class="link-btn small" style="margin-top:8px" data-act="newCard" data-id="${c.id}">Record a card without Stripe</button>`
    : `<p class="muted small" style="margin:8px 0 0"><button type="button" class="link-btn" data-act="connectStripe">Connect Stripe</button> to save and charge cards from here.</p>`}`;
}
function cardForm(c, k) {
  const isNew = !k; k ||= { name: c.name, brand: 'Visa', processor: db.settings.processor || '', isDefault: !(c.cards || []).length };
  modal({ title: isNew ? 'Add card on file' : 'Card on file', body: `
    <div class="alert info" style="margin-bottom:14px">${icon('alert')}<span>For your customers' security, <b>never type the full card number here</b>. Save the card in your payment processor (${esc(db.settings.processor || 'Stripe, Square, Helcim…')}) and keep a reference here.</span></div>
    <div class="form-grid">
      ${field('Name on card', inp('name', k.name))}
      ${field('Card type', `<select name="brand">${opts(CARD_BRANDS, k.brand)}</select>`)}
      ${field('Last 4 digits *', inp('last4', k.last4, 'required inputmode="numeric" pattern="[0-9]{4}" placeholder="4242" autocomplete="off"'))}
      ${field('Expiry (MM/YY) *', inp('exp', k.exp, 'required pattern="(0[1-9]|1[0-2])/[0-9]{2}" placeholder="08/28" inputmode="numeric" maxlength="5" autocomplete="off"'))}
      ${field('Saved securely in', `<select name="processor">${opts(['', ...PROCESSORS].map(x => [x, x || '—']), k.processor)}</select>`)}
      ${field('Link to this customer in your processor (optional)', inp('link', k.link, 'type="url" placeholder="https://…"'))}
      <label class="check full"><input type="checkbox" name="isDefault" ${k.isDefault ? 'checked' : ''}> Default card for this customer</label>
    </div>`, footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Remove card</button>`,
    onMount: (f, close) => {
      f.exp.addEventListener('input', () => { const d = f.exp.value.replace(/\D/g, '').slice(0, 4); f.exp.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; });
      f.last4.addEventListener('input', () => { if (f.last4.value.replace(/\D/g, '').length > 4) toast('Only the last 4 digits, please'); f.last4.value = f.last4.value.replace(/\D/g, '').slice(-4); });
      $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); c.cards = c.cards.filter(x => x.id !== k.id); close(); refresh(); undoToast(snap, 'Card removed'); });
    },
    onSubmit: (f, d) => {
      Object.assign(k, { name: d.name.trim(), brand: d.brand, last4: d.last4, exp: d.exp, processor: d.processor, link: d.link.trim(), isDefault: !!d.isDefault });
      c.cards ||= [];
      if (isNew) { k.id = uid(); k.addedAt = today(); c.cards.push(k); }
      if (k.isDefault) c.cards.forEach(x => { if (x !== k) x.isDefault = false; });
      refresh(); toast(isNew ? 'Card added' : 'Card saved');
    } });
}

/* ----- templates ----- */
function templateForm(t) {
  const isNew = !t, s = db.settings;
  t ||= { billing: 'per_visit', termMonths: s.planTermMonths || 12, minVisits: s.planMinVisits || 2, cancelFee: s.cancelFee ?? 50, autoRenew: true, items: [], taxRate: s.taxRate, rule: { freq: 'month', interval: 6 } };
  modal({ title: isNew ? 'New plan template' : 'Edit plan template', wide: true, body: `
  <p class="muted small" style="margin-top:0">A template is a plan you sell often, like “Window cleaning: 2 cleans a year”. Pick it when creating a customer’s plan and everything fills in.</p>
  <div class="form-section"><div class="form-grid">
    ${field('Template name *', inp('name', t.name, 'required placeholder="e.g. Window cleaning: 2 cleans a year"'), 'full')}
    ${field('Description (shown on the agreement)', inp('description', t.description), 'full')}
  </div></div>
  ${planTermsFields(t)}
  <div class="form-section"><h3>Main service &amp; price</h3>${itemsEditorHTML(t)}</div>
  ${addonsEditorHTML()}`,
    footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => {
      t._get = mountItemsEditor(f, t); bindPlanTerms(f, t); t._addons = mountAddons(f, t, () => t._get());
      $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.planTemplates = db.planTemplates.filter(x => x.id !== t.id); close(); refresh(); undoToast(snap, 'Template deleted'); });
    },
    onSubmit: (f, d) => {
      const items = t._get(), addons = t._addons();
      if (!items.length) { toast('Add at least one service and price'); return false; }
      delete t._get; delete t._addons;
      Object.assign(t, readPlanTerms(f, d), { name: d.name.trim(), description: d.description, items, addons, discount: +d.discount || 0, taxRate: d.taxRate === '' ? s.taxRate : +d.taxRate });
      if (isNew) { t.id = uid(); db.planTemplates.push(t); }
      refresh(); toast('Template saved');
    } });
}
/* Fields shared by templates and agreements: billing, schedule, term, cancellation. */
function planTermsFields(p) {
  const presets = { 'week:1': 'weekly', 'week:2': 'biweekly', 'month:1': 'monthly', 'month:3': 'quarterly', 'month:12': 'yearly' };
  const preset = p.rule ? presets[`${p.rule.freq}:${p.rule.interval}`] || 'custom' : 'monthly';
  return `<div class="form-section"><h3>Schedule &amp; billing</h3><div class="form-grid">
    ${field('Visits', `<select name="repeat">${opts([['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Once a year'], ['custom', 'Custom… (e.g. every 6 months)']], preset)}</select>`)}
    ${field('Billing', `<select name="billing">${opts(BILLING, p.billing)}</select>`)}
    <div class="repeat-box js-repeat full">
      <div class="js-custom ${preset === 'custom' ? '' : 'hidden'}">
        <div class="row"><span>Every</span><input name="rInterval" type="number" min="1" max="52" value="${p.rule?.interval || 1}" style="width:72px" aria-label="Interval">
          <select name="rFreq" style="width:auto" aria-label="Unit">${opts([['day', 'day(s)'], ['week', 'week(s)'], ['month', 'month(s)']], p.rule?.freq || 'month')}</select></div>
        <div class="js-weekdays day-chips">${WEEKDAYS.map((d, i) => `<label class="chip"><input type="checkbox" name="rDay" value="${i}" ${(p.rule?.weekdays || []).includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
      </div>
      <div class="muted small js-repeat-preview"></div>
    </div>
  </div></div>
  <div class="form-section"><h3>Term &amp; cancellation</h3><div class="form-grid">
    ${field('Term length (months)', inp('termMonths', p.termMonths, 'type="number" min="1" max="60" required'))}
    <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="autoRenew" ${p.autoRenew ? 'checked' : ''}> Renews automatically</label>
    ${field('Minimum visits before free cancellation', inp('minVisits', p.minVisits, 'type="number" min="0" max="100"'))}
    ${field('Early cancellation fee', inp('cancelFee', p.cancelFee, 'type="number" min="0" step="1"'))}
    <p class="muted small full js-cancel-preview" style="margin:0"></p>
  </div></div>`;
}
function bindPlanTerms(f, p) {
  const sync = () => {
    $('.js-custom', f).classList.toggle('hidden', f.repeat.value !== 'custom');
    $('.js-weekdays', f).classList.toggle('hidden', f.rFreq.value !== 'week');
    const r = readPlanTerms(f, Object.fromEntries(new FormData(f)));
    const start = f.start?.value || today(), end = addDays(addMonths(start, r.termMonths), -1);
    const dates = recurDates(start, { ...r.rule, until: end });
    $('.js-repeat-preview', f).innerHTML = `<b>${dates.length} visit${dates.length === 1 ? '' : 's'}</b> in ${r.termMonths} months · ${ruleLabel(r.rule)}${f.start ? ` · ${dates.slice(0, 3).map(fmtDateShort).join(', ')}${dates.length > 3 ? '…' : ''}` : ''}`;
    $('.js-cancel-preview', f).textContent = r.cancelFee
      ? `If the customer cancels in the first ${r.termMonths} months before ${r.minVisits} visit${r.minVisits === 1 ? '' : 's'} are done, they are charged ${money(r.cancelFee)}.`
      : 'No cancellation fee.';
  };
  f.addEventListener('input', sync); f.addEventListener('change', sync); sync();
}
function readPlanTerms(f, d) {
  const preset = { weekly: { freq: 'week', interval: 1 }, biweekly: { freq: 'week', interval: 2 }, monthly: { freq: 'month', interval: 1 },
    quarterly: { freq: 'month', interval: 3 }, yearly: { freq: 'month', interval: 12 } }[d.repeat];
  const rule = preset ? { ...preset } : { freq: d.rFreq, interval: Math.max(1, +d.rInterval || 1) };
  if (rule.freq === 'week') {
    const days = new FormData(f).getAll('rDay').map(Number);
    rule.weekdays = d.repeat === 'custom' && days.length ? days : [parseD(f.start?.value || today()).getDay()];
  }
  return { rule, billing: d.billing, termMonths: Math.max(1, +d.termMonths || 12), autoRenew: !!d.autoRenew, minVisits: Math.max(0, +d.minVisits || 0), cancelFee: Math.max(0, +d.cancelFee || 0) };
}

/* ----- agreement form ----- */
function planForm(p, preset = {}) {
  const isNew = !p, s = db.settings;
  p ||= { customerId: preset.customerId, start: addDays(today(), 1), billing: 'per_visit', termMonths: s.planTermMonths || 12, minVisits: s.planMinVisits || 2,
    cancelFee: s.cancelFee ?? 50, autoRenew: true, items: [], taxRate: s.taxRate, rule: { freq: 'month', interval: 6 } };
  if (!isNew && p.signature && !confirm('This agreement is already signed. Changing it means the customer needs to sign again. Continue?')) return;
  modal({ title: isNew ? 'New service plan' : `Edit ${p.number}`, wide: true, submitLabel: isNew ? 'Create plan' : 'Save', body: `
  <div class="form-section"><div class="form-grid">
    ${field('Customer *', customerSelect(p.customerId), 'full')}
    ${db.planTemplates.length ? field('Start from a template', `<select name="templateId" data-nodirty><option value="">— Custom plan —</option>${opts(db.planTemplates.map(t => [t.id, t.name]), p.templateId)}</select>`, 'full') : ''}
    ${field('Plan name *', inp('name', p.name, 'required placeholder="e.g. Window cleaning: 2 cleans a year"'), 'full')}
    ${field('Service address', addrInput('address', p.address ?? cust(p.customerId)?.address ?? ''), 'full')}
    ${field('First visit / start date *', inp('start', p.start, 'type="date" required'))}
    ${assigneeField(p.assignedTo)}
    ${field('Sold by (sales rep)', memberSelect('salesRep', p.salesRep ?? cust(p.customerId)?.salesRep, 'No sales rep'))}
  </div></div>
  <div class="js-terms">${planTermsFields(p)}</div>
  <div class="form-section"><h3>Main service &amp; price</h3><div class="js-items-wrap">${itemsEditorHTML(p)}</div></div>
  ${addonsEditorHTML()}
  <details class="form-section"><summary><h3>Terms &amp; conditions <span class="muted small">(tap to review or edit)</span></h3></summary>
    <p class="muted small">Placeholders like {fee} and {term} fill in automatically. Change the default wording in Settings → Plans &amp; payments.</p>
    <textarea name="terms" rows="12">${esc(planTermsRaw(p))}</textarea></details>`,
    onMount: f => {
      p._get = mountItemsEditor(f, p); bindPlanTerms(f, p); p._addons = mountAddons(f, p, () => p._get());
      bindCustomerSelect(f, nc => { if (nc && !f.address.value) f.address.value = nc.address || ''; });
      f.templateId?.addEventListener('change', () => {
        const t = byId('planTemplates', f.templateId.value); if (!t) return;
        f.name.value = t.name;
        $('.js-terms', f).innerHTML = planTermsFields(t);
        $('.js-items-wrap', f).innerHTML = itemsEditorHTML(t);
        p._get = mountItemsEditor(f, t);
        p._addons.set(t.addons);
        if (t.terms) f.terms.value = t.terms;
        f.dispatchEvent(new Event('change'));
      });
    },
    onSubmit: (f, d) => {
      const items = p._get(), addons = p._addons();
      if (!items.length) { toast('Add at least one service and price'); return false; }
      delete p._get; delete p._addons;
      const before = isNew ? '' : planCanonical(p);
      Object.assign(p, readPlanTerms(f, d), { customerId: d.customerId, templateId: d.templateId || p.templateId || '', name: d.name.trim(), address: d.address,
        start: d.start, assignedTo: d.assignedTo, salesRep: d.salesRep || '', items, addons, discount: +d.discount || 0, taxRate: d.taxRate === '' ? s.taxRate : +d.taxRate,
        terms: d.terms.trim() === (s.planTerms || BH.DEFAULT_TERMS).trim() ? '' : d.terms });
      p.end = '';
      if (isNew) { Object.assign(p, { id: uid(), number: nextPlanNumber(), status: 'draft', createdAt: today() }); db.subscriptions.push(p); }
      else if (p.signature && before !== planCanonical(p)) { p.signature = null; p.status = 'draft'; toast('Changes saved. Ask the customer to sign the updated agreement.'); }
      save(); go('#/plans/' + p.id);
    } });
}
function nextPlanNumber() {
  const s = db.settings; let n;
  do { n = (s.planPrefix || 'SP-') + (s.nextPlanNo++); } while (db.subscriptions.some(x => x.number === n));
  return n;
}

/* ----- agreement document ----- */
function planDocHTML(p) {
  const c = cust(p.customerId) || {}, t = totals(planEvery(p)), s = db.settings, once = planOnceTotal(p);
  return `<div class="doc">
    <div class="doc-top"><div>${bizBlock()}</div>
      <div><h1 style="font-size:22px">SERVICE AGREEMENT</h1>
        <div class="meta"><div><span>Agreement #</span><b>${esc(p.number)}</b></div><div><span>Starts</span><b>${fmtDate(p.start)}</b></div>
        <div><span>Term</span><b>${+p.termMonths || 12} months${p.autoRenew ? ', auto-renews' : ''}</b></div></div></div></div>
    <div class="bill-to"><div class="lbl">Customer</div><b>${esc(c.name || '')}</b>
      <div style="white-space:pre-line;color:#444">${esc([p.address || c.address, c.phone, c.email].filter(Boolean).join('\n'))}</div></div>
    <h2 style="font-size:17px;margin:0 0 4px">${esc(p.name)}</h2>
    <p style="margin:0 0 10px;color:#444">${esc(planSchedule(p))}</p>
    <table><thead><tr><th>Included service</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>
      ${[...(p.items || []), ...(p.addons || []).map(addonItem)].map(it => `<tr><td>${esc(it.desc)}${it.addon ? ' ' + addonTag(it) : ''}${it.details ? `<div style="color:#666;font-size:12px">${esc(it.details)}</div>` : ''}</td><td class="num">${+it.qty}</td><td class="num">${money(it.price)}</td><td class="num">${money(it.qty * it.price)}</td></tr>`).join('')}
    </tbody></table>
    <div class="totals"><div><span>Subtotal${once ? ' per visit' : ''}</span><span>${money(t.sub)}</span></div>${t.disc ? `<div><span>Discount</span><span>−${money(t.disc)}</span></div>` : ''}
      <div><span>${esc(s.taxName)} (${t.rate}%)</span><span>${money(t.tax)}</span></div>
      <div class="grand"><span>Price</span><span>${esc(money(planTotal(p)))} ${{ per_visit: 'per visit', monthly: 'per month', yearly: 'per year', upfront: 'per term' }[p.billing] || ''}</span></div>
      ${once ? `<div><span>One-time add-ons (first visit, incl. tax)</span><span>${money(once)}</span></div>` : ''}</div>
    ${+p.cancelFee ? `<div class="doc-callout"><b>Early cancellation fee: ${money(p.cancelFee)}.</b> Charged to the card on file if the plan is cancelled within the first ${+p.termMonths || 12} months before ${+p.minVisits || 0} visit${+p.minVisits === 1 ? '' : 's'} ${+p.minVisits === 1 ? 'is' : 'are'} completed.</div>` : ''}
    <div class="notes"><div class="lbl">Terms and conditions</div><div style="white-space:pre-wrap">${esc(planTermsText(p))}</div></div>
    <div class="sig-block">
      ${p.signature ? `<div>${BH.sigSVG(p.signature.strokes)}</div>
        <div class="sig-line"><b>${esc(p.signature.name)}</b> · signed ${new Date(p.signature.at).toLocaleString()} · ${p.signature.method === 'remote' ? 'signed online' : 'signed in person'}</div>`
      : '<div class="sig-empty"></div><div class="sig-line">Customer signature · Date</div>'}
    </div>
  </div>`;
}
VIEWS.plans = id => {
  if (id) return planDetail(id);
  const tab = filt('plans', 'tab', 'agreements');
  const tabs = tabsHTML('plans', 'tab', [['agreements', `Agreements (${db.subscriptions.length})`], ['templates', `Templates (${db.planTemplates.length})`], ['visits', 'Repeat visits']], tab);
  const headActions = btn('New service plan', 'newPlan', 'btn-primary', '', 'plus') + moreMenu([menuItem('New plan template', 'newTemplate', '', 'plus'), menuItem('Plan settings', 'planSettings', '', 'settings')]);
  if (tab === 'visits') return head('Service plans', headActions, 'Repeat visits from every recurring job, with or without an agreement.') + `<div class="card">${tabs}</div>` + repeatVisitsHTML();
  if (tab === 'templates') {
    return head('Service plans', headActions, 'Templates for the plans you sell most.') + `<div class="card">${tabs}
      ${db.planTemplates.length ? db.planTemplates.map(t => `<div class="plan-row clickable" data-act="editTemplate" data-id="${t.id}">
        <div class="grow"><div class="title">${esc(t.name)}</div>${(t.addons || []).length ? `<div class="small">+ ${t.addons.map(a => esc(a.desc)).join(', ')}</div>` : ''}<div class="muted small">${esc(ruleLabel(t.rule))} · ${+t.termMonths} months${t.autoRenew ? ', auto-renews' : ''} · ${+t.cancelFee ? `${money(t.cancelFee)} early cancellation fee` : 'no cancellation fee'}</div></div>
        <div class="right"><b class="num">${esc(planPriceLabel(t))}</b></div></div>`).join('')
        : empty('repeat', 'No templates yet. Create one for each plan you sell, like “2 cleans a year”.', btn('New plan template', 'newTemplate', 'btn-sm'))}</div>`;
  }
  const status = filt('plans', 'status', 'all'), q = filt('plans', 'q', '').toLowerCase();
  const subs = db.subscriptions.map(p => ({ p, st: planStatus(p) }));
  const active = subs.filter(x => x.st === 'active');
  const awaiting = subs.filter(x => ['draft', 'sent'].includes(x.st));
  const list = subs.filter(x => status === 'all' || (status === 'awaiting' ? ['draft', 'sent'].includes(x.st) : x.st === status))
    .filter(x => !q || `${x.p.number} ${x.p.name} ${custName(x.p.customerId)}`.toLowerCase().includes(q)).reverse();
  return head('Service plans', headActions, 'Recurring service agreements your customers sign, with terms and a card on file.') + `
  <div class="grid grid-3">
    <div class="card stat"><div class="label">Active plans</div><div class="value">${active.length}</div><div class="sub">${new Set(active.map(x => x.p.customerId)).size} customers</div></div>
    <div class="card stat"><div class="label">Recurring revenue</div><div class="value">${money(sum(active, x => planMonthly(x.p)))}</div><div class="sub">Estimated per month, before tax</div></div>
    <div class="card stat"><div class="label">Waiting for signature</div><div class="value">${awaiting.length}</div><div class="sub">${awaiting.filter(x => x.st === 'sent').length} sent</div></div>
  </div>
  <div class="card" style="margin-top:16px">${tabs}
    <div class="toolbar"><input type="search" placeholder="Search plans…" value="${esc(q)}" data-filter="plans:q">
      <select data-filter="plans:status" style="width:auto" aria-label="Status">${opts([['all', 'All statuses'], ['active', 'Active'], ['awaiting', 'Waiting for signature'], ['cancelled', 'Cancelled'], ['ended', 'Ended']], status)}</select></div>
    ${list.length ? list.map(({ p, st }) => { const nx = planNext(p); return `<a class="plan-row" href="#/plans/${p.id}" style="color:inherit">
      <div class="grow"><div class="title">${esc(custName(p.customerId))} <span class="muted small">· ${esc(p.number)}</span></div>
        <div class="muted small">${esc(p.name)} · ${esc(planPriceLabel(p))}</div>
        <div class="small" style="margin-top:3px">${st === 'active' ? `${planDone(p)} done${nx ? ` · next visit <b>${fmtDateShort(nx.date)}</b>` : ''} · renews ${p.autoRenew ? 'automatically' : 'manually'} ${fmtDate(planEnd(p))}` : st === 'sent' ? `Sent ${fmtDate(p.sentAt)} · waiting for signature` : st === 'cancelled' ? `Cancelled ${fmtDate(p.cancelledAt)}` : st === 'ended' ? `Ended ${fmtDate(planEnd(p))}` : 'Not sent yet'}</div></div>
      ${badge(st === 'sent' ? 'sent' : st)}</a>`; }).join('')
      : empty('repeat', db.subscriptions.length ? 'No plans match.' : 'No service plans yet. Create one and send it to your customer to sign.', btn('New service plan', 'newPlan', 'btn-sm'))}
  </div>`;
};
function planDetail(id) {
  const p = byId('subscriptions', id); if (!p) return empty('repeat', 'Plan not found.', '<a class="btn btn-sm" href="#/plans">Back to plans</a>');
  const c = cust(p.customerId) || {}, st = planStatus(p), card = defaultCard(p.customerId);
  const a = (l, act, cls = '', ic = '') => btn(l, act, cls, `data-id="${p.id}"`, ic);
  const jobs = planJobs(p).sort((x, y) => x.date.localeCompare(y.date)), done = planDone(p), nx = planNext(p);
  const invs = db.invoices.filter(i => i.planId === p.id).reverse();
  const actions = ['draft', 'sent'].includes(st)
    ? a('Sign in person', 'signPlan', 'btn-primary', 'edit') + a(st === 'sent' ? 'Resend for signature' : 'Send for signature', 'sendPlan', '', 'share')
    : st === 'active' ? a('Cancel plan', 'cancelPlan', '', 'alert') : st === 'ended' ? a('Renew plan', 'renewPlan', 'btn-primary', 'repeat') : '';
  return head(`${esc(p.number)} ${badge(st)}`, actions + a('Print / PDF', 'printPlan', '', 'print') + moreMenu([
    st !== 'cancelled' && menuItem('Edit plan', 'editPlan', `data-id="${p.id}"`, 'edit'),
    st === 'active' && !p.autoRenew && menuItem('Renew for another term', 'renewPlan', `data-id="${p.id}"`, 'repeat'),
    menuItem('Duplicate for another customer', 'dupPlan', `data-id="${p.id}"`, 'quote'),
    menuLink('View customer', `#/customers/${p.customerId}`, 'users'),
    menuItem('Delete', 'deletePlan', `data-id="${p.id}"`, 'trash', 'danger'),
  ]), `<a class="crumb" href="#/plans">← All plans</a><span class="crumb"> · </span><a href="#/customers/${c.id}">${esc(c.name || '')}</a>`) + `
  ${st === 'sent' ? `<div class="alert info no-print" style="margin:0 auto 12px;max-width:820px">${icon('share')}<span>Sent for signature ${fmtDate(p.sentAt)}. ${relayOn() || serverHas('inbox') ? `This page updates by itself when ${esc(firstName(c.name))} signs, and the plan starts. <button class="link-btn" data-act="checkInbox">Check now</button>` : `When ${esc(firstName(c.name))} signs, they send you a link. Open it on this device to record the signature.`}</span></div>` : ''}
  ${st === 'active' && !card ? `<div class="alert warn no-print" style="margin:0 auto 12px;max-width:820px">${icon('expense')}<span>No card on file for ${esc(c.name)}. <button class="link-btn" data-act="newCard" data-id="${c.id}">Add a card</button> so you can charge plan payments and fees.</span></div>` : ''}
  <div class="plan-layout">
    <div>${planDocHTML(p)}</div>
    <aside class="stack no-print">
      ${st === 'active' || st === 'ended' || st === 'cancelled' ? `<div class="card"><h2 style="margin-bottom:8px">Visits</h2>
        <div class="progress"><i style="width:${jobs.length ? Math.round(done / jobs.length * 100) : 0}%"></i></div>
        <p class="small" style="margin:8px 0">${done} of ${jobs.length} done${nx ? ` · next <a href="#/jobs/${nx.id}">${fmtDateShort(nx.date)}</a>` : ''}</p>
        ${+p.minVisits ? `<p class="muted small" style="margin:0">Free cancellation after ${p.minVisits} visit${+p.minVisits === 1 ? '' : 's'}${done >= +p.minVisits ? ' ✓ reached' : ` (${+p.minVisits - done} to go)`}.</p>` : ''}
        <div style="margin-top:8px">${jobs.slice(0, 8).map(j => `<a class="mini-row" href="#/jobs/${j.id}"><span>${fmtDateShort(j.date)}</span>${badge(j.status)}</a>`).join('')}${jobs.length > 8 ? `<p class="muted small">+${jobs.length - 8} more</p>` : ''}</div></div>` : ''}
      <div class="card"><h2 style="margin-bottom:8px">Card on file</h2>
        ${card ? `<div class="card-row"><span class="card-chip">${esc(card.brand.split(' ')[0])}</span><div class="grow"><b>${esc(cardLabel(card))}</b><div class="muted small">Exp ${esc(card.exp)}${card.processor ? ' · ' + esc(card.processor) : ''}</div></div></div>`
          : '<p class="muted small" style="margin:0 0 8px">None yet.</p>'}
        <div class="row" style="margin-top:8px">${btn(card ? 'Manage cards' : 'Add card', card ? 'goCustomerCards' : 'newCard', 'btn-sm', `data-id="${c.id}"`, card ? 'expense' : 'plus')}</div>
        ${p.signature ? `<p class="muted small" style="margin:8px 0 0">Charge authorization signed ${fmtDate(p.signature.at.slice(0, 10))}.</p>` : ''}</div>
      ${invs.length ? `<div class="card"><h2 style="margin-bottom:8px">Billing</h2>${invs.slice(0, 8).map(i => `<a class="mini-row" href="#/invoices/${i.id}"><span>${esc(i.number)} · ${money(totals(i).total)}</span>${badge(invStatus(i))}</a>`).join('')}</div>` : ''}
      ${p.cancelledAt ? `<div class="card"><h2 style="margin-bottom:6px">Cancelled</h2><p class="small" style="margin:0">${fmtDate(p.cancelledAt)}${p.cancelReason ? ' · ' + esc(p.cancelReason) : ''}</p>
        ${p.feeInvoiceId && byId('invoices', p.feeInvoiceId) ? `<p class="small">Cancellation fee: <a href="#/invoices/${p.feeInvoiceId}">${esc(byId('invoices', p.feeInvoiceId).number)}</a> ${badge(invStatus(byId('invoices', p.feeInvoiceId)))}</p>` : '<p class="muted small">No cancellation fee charged.</p>'}</div>` : ''}
    </aside>
  </div>`;
}

/* ----- signing ----- */
function signPlanInPerson(p) {
  const c = cust(p.customerId) || {}, cards = (c.cards || []).filter(k => cardState(k) !== 'expired');
  let pad;
  modal({ title: `Sign ${p.number}`, wide: true, submitLabel: 'Sign & activate plan', body: `
    <div class="sign-review"><b>${esc(p.name)}</b> · ${esc(planPriceLabel(p))}<br><span class="muted small">${esc(planSchedule(p))} · starts ${fmtDate(p.start)}</span>
      ${+p.cancelFee ? `<div class="doc-callout" style="margin:10px 0 0">Early cancellation fee <b>${money(p.cancelFee)}</b> if cancelled within ${+p.termMonths} months before ${+p.minVisits} visits are done.</div>` : ''}
      <details style="margin-top:10px"><summary class="small"><b>Read the full terms</b></summary><div class="sign-terms" style="margin-top:8px">${esc(planTermsText(p))}</div></details></div>
    <div class="form-grid" style="margin-top:14px">
      ${field('Customer’s full name *', inp('name', c.name, 'required autocomplete="off"'), 'full')}
      ${field('Card to charge', cards.length ? `<select name="cardId">${opts(cards.map(k => [k.id, `${cardLabel(k)} · exp ${k.exp}`]), defaultCard(c.id)?.id)}</select>`
        : `<p class="muted small" style="margin:6px 0 0">No card on file yet. You can add one after signing.</p>`, 'full')}
      <div class="field full"><label>Customer signature *</label><div class="sig-box"><canvas class="js-sig" aria-label="Signature pad"></canvas><span class="sig-hint">Sign here</span></div>
        <button type="button" class="btn btn-sm js-clear-sig" style="align-self:flex-start;margin-top:6px">Clear</button></div>
      <label class="check full"><input type="checkbox" name="agree" required> I have read and agree to this agreement and its terms, and I authorize ${esc(db.settings.businessName || 'the business')} to charge my card on file as described.</label>
    </div>`,
    onMount: f => {
      const hint = $('.sig-hint', f);
      setTimeout(() => { pad = new BH.SignaturePad($('.js-sig', f), e => { hint.style.display = e ? '' : 'none'; }); }, 50);
      $('.js-clear-sig', f).addEventListener('click', () => pad?.clear());
    },
    onSubmit: (f, d) => {
      if (!pad || pad.isEmpty()) { toast('Please sign in the box'); return false; }
      if (!p.terms) p.terms = planTermsRaw(p);
      BH.fingerprint(planCanonical(p)).then(h => {
        p.signature = { name: d.name.trim(), at: new Date().toISOString(), strokes: pad.strokes.filter(s => s.length > 1), method: 'in_person', hash: h };
        p.cardId = d.cardId || '';
        pad.destroy(); activatePlan(p);
      });
    } });
}
async function planSignLink(p) {
  const c = cust(p.customerId) || {}, s = db.settings;
  const base = location.href.split('#')[0].replace(/index\.html$/, '');
  const payload = {
    k: 'plan', id: p.id, n: p.number, h: await BH.fingerprint(planCanonical(p)), r: base, s: serverHas('inbox') ? serverBase() : '',
    b: { name: s.businessName || 'Your service provider', phone: s.phone, email: s.email },
    c: { name: c.name, first: firstName(c.name), address: p.address || c.address || '' },
    p: { name: p.name, price: planPriceLabel(p), schedule: planSchedule(p), start: fmtDate(p.start), term: `${+p.termMonths || 12} months${p.autoRenew ? ', renews automatically' : ''}`,
      termMonths: +p.termMonths || 12, minVisits: +p.minVisits || 0, fee: +p.cancelFee ? money(p.cancelFee) : '',
      items: [...(p.items || []).map(i => [i.desc, String(+i.qty), money(i.price)]),
        ...(p.addons || []).map(a => [`Add-on: ${a.desc} (${a.when === 'once' ? 'once a term' : 'every visit'})`, '1', money(a.price)])] },
    t: planTermsText(p), cs: safeUrl(s.cardSetupLink), x: relayFor(p),
  };
  return `${base}sign.html#${await BH.pack(payload)}`;
}
async function sendPlan(p) {
  const c = cust(p.customerId) || {};
  let link;
  if (!p.terms) { p.terms = planTermsRaw(p); save(); } // lock the wording the customer will see
  try { link = await planSignLink(p); } catch { return toast('Could not create the signing link in this browser'); }
  const msg = `Hi ${firstName(c.name)}, here is your ${p.name} agreement from ${db.settings.businessName || 'us'}. Please review and sign here: ${link}`;
  const mark = () => { p.status = 'sent'; p.sentAt = today(); save(); setTimeout(render, 300); };
  modal({ title: `Send ${p.number} for signature`, noFoot: true, body: `
    <p class="muted small" style="margin-top:0">${esc(c.name)} opens the link, reads the agreement, signs with their finger and taps <b>Send</b>. ${serverHas('inbox') || relayOn() ? 'It comes straight back into this app and the plan starts automatically.' : 'You’ll get a link back. Open it here to record the signature and start the plan.'}</p>
    <div class="stack info-list" style="gap:8px">
      ${c.phone ? `<a class="btn btn-primary js-send" href="${smsHref(c.phone, msg)}">${icon('sms')}Text to ${esc(c.phone)}</a>` : ''}
      ${c.email ? `<a class="btn ${c.phone ? '' : 'btn-primary'} js-send" href="${mailHref(c.email, `Your service agreement ${p.number}`, msg)}">${icon('mail')}Email to ${esc(c.email)}</a>` : ''}
      <button type="button" class="btn js-copy">${icon('share')}Copy signing link</button>
      <a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Preview what ${esc(firstName(c.name))} sees ↗</a>
    </div>`,
    onMount: (f, close) => {
      $$('.js-send', f).forEach(x => x.addEventListener('click', () => { mark(); setTimeout(close, 200); }));
      $('.js-copy', f).addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(msg); toast('Link copied. Paste it into a message.'); } catch { prompt('Copy this link:', link); }
        mark(); close();
      });
    } });
}
async function receiveSignature(data) {
  $('#main').innerHTML = '<div class="empty">Checking the signature…</div>';
  let r;
  try { r = await BH.unpack(data); } catch { $('#main').innerHTML = empty('alert', 'This signed link could not be read. It may have been cut off. Ask the customer to tap Copy link and send it again.'); return; }
  if (r.k === 'quote') {
    const res = await receiveQuote(r);
    if (res.ok || res.already) { history.replaceState(null, '', '#/quotes/' + r.id); render(); if (res.ok) toast(res.msg); }
    else $('#main').innerHTML = empty('alert', esc(res.msg), res.id ? `<a class="btn btn-sm" href="#/quotes/${res.id}">Open the quote</a>` : '');
    return;
  }
  const p = byId('subscriptions', r.id);
  if (!p) { $('#main').innerHTML = empty('alert', `Agreement ${esc(r.n)} isn’t on this device. Open the link on the phone or computer where you created the plan.`); return; }
  if (p.signature?.at === r.at) { go('#/plans/' + p.id); return; }
  const h = await BH.fingerprint(planCanonical(p));
  if (h !== r.h) {
    $('#main').innerHTML = empty('alert', `${esc(p.number)} was changed after it was sent, so this signature doesn’t match the current wording. Send the updated agreement again.`, `<a class="btn btn-sm" href="#/plans/${p.id}">Open ${esc(p.number)}</a>`);
    return;
  }
  p.signature = { name: r.name, at: r.at, strokes: r.sig, method: 'remote', hash: h };
  history.replaceState(null, '', '#/plans/' + p.id);
  activatePlan(p);
}
/** A signed plan arriving through the inbox: same checks as the link, without leaving the current screen. */
async function receivePlanQuiet(r) {
  const p = byId('subscriptions', r.id);
  if (!p) return { msg: `Agreement ${r.n} isn’t on this device` };
  if (p.signature?.at === r.at) return { already: true };
  const h = await BH.fingerprint(planCanonical(p));
  if (h !== r.h) return { msg: `${p.number} was changed after it was sent, so the signature wasn’t used. Send it again.` };
  p.signature = { name: r.name, at: r.at, strokes: r.sig, method: 'remote', hash: h };
  activatePlan(p, true);
  return { ok: true, msg: `${r.name} signed ${p.number} · plan started` };
}
const quoteCanonical = q => JSON.stringify({ n: q.number, c: q.customerId, d: +q.discount || 0, r: String(q.taxRate ?? ''), dep: +q.depositPct || 0, t: q.terms ?? '',
  i: (q.items || []).map(i => [i.desc, i.details || '', +i.qty, +i.price, i.taxable !== false, !!i.optional]) });
async function quoteLink(q) {
  const c = cust(q.customerId) || {}, s = db.settings, t = totals({ ...q, items: chosenItems(q.items) });
  if (q.terms === undefined) { q.terms = s.quoteTerms || ''; save(); } // lock the wording the customer approves
  const payload = { k: 'quote', id: q.id, n: q.number, h: await BH.fingerprint(quoteCanonical(q)), r: appBase(), s: serverHas('inbox') ? serverBase() : '',
    b: { name: s.businessName || 'Your service provider', phone: s.phone, email: s.email, logo: '' },
    c: { name: c.name, first: firstName(c.name), address: q.serviceAddress || c.address || '' },
    q: { items: (q.items || []).map(i => [i.desc, i.details || '', +i.qty, +i.price, i.taxable !== false ? 1 : 0, i.optional ? 1 : 0, i.on ? 1 : 0]),
      disc: +q.discount || 0, rate: t.rate, taxName: s.taxName, cur: s.currency || 'CAD', loc: { CAD: 'en-CA', USD: 'en-US', GBP: 'en-GB', EUR: 'en-IE', AUD: 'en-AU', NZD: 'en-NZ' }[s.currency || 'CAD'], date: fmtDate(q.date), valid: q.validUntil ? fmtDate(q.validUntil) : '', dep: +q.depositPct || 0, notes: q.notes || '' },
    t: q.terms || '', x: relayFor(q) };
  return `${appBase()}sign.html#${await BH.pack(payload)}`;
}
/** The customer approved (or asked for changes to) a quote online. */
async function receiveQuote(r) {
  const q = byId('quotes', r.id);
  if (!q) return { msg: `Quote ${r.n} isn’t on this device. Open it on the phone or computer where you made the quote.` };
  if (r.act !== 'changes' && q.signature?.at === r.at) return { already: true, id: q.id };
  if (r.act === 'changes' && q.changeRequest?.at === r.at) return { already: true, id: q.id };
  const h = await BH.fingerprint(quoteCanonical(q));
  if (h !== r.h) return { id: q.id, msg: `${q.number} was changed after it was sent, so this response doesn’t match it any more. Send the updated quote again.` };
  const c = cust(q.customerId);
  if (r.act === 'changes') {
    q.changeRequest = { name: r.name, msg: String(r.msg || '').slice(0, 1000), at: r.at };
    db.tasks.push({ id: uid(), title: `Update quote ${q.number}: ${r.name || c?.name || 'customer'} asked for changes`, due: today(), customerId: q.customerId, done: false, createdAt: today() });
    if (c) (c.log ||= []).push({ id: uid(), date: today(), text: `Asked for changes to quote ${q.number}: “${q.changeRequest.msg}”` });
    save(); return { ok: true, id: q.id, msg: `${r.name || 'Customer'} asked for changes to ${q.number}` };
  }
  const picked = new Set(r.pick || []);
  q.items.forEach((it, i) => { if (it.optional) it.on = picked.has(i); });
  q.signature = { name: r.name, at: r.at, strokes: r.sig || [], method: 'online', hash: h };
  q.status = 'approved'; q.approvedAt = today(); q.sentAt ||= today(); delete q.changeRequest;
  db.leads.forEach(l => { if (l.quoteId === q.id) { l.stage = 'won'; l.closedAt = today(); } });
  if (c) (c.log ||= []).push({ id: uid(), date: today(), text: `Approved quote ${q.number} online (${money(totals(q).total)})` });
  let extra = '';
  if (depositAmt(q) && !q.depositInvoiceId) {
    const inv = invoiceFromItems({ customerId: q.customerId, serviceAddress: q.serviceAddress, items: [{ desc: `Deposit (${+q.depositPct}%) for quote ${q.number}`, details: '', qty: 1, price: depositAmt(q), taxable: false }] },
      { quoteId: q.id, dueDate: today(), isDeposit: true });
    q.depositInvoiceId = inv.id; extra = ` · deposit invoice ${inv.number} ready to send`;
  }
  save();
  return { ok: true, id: q.id, msg: `${r.name} approved ${q.number} (${money(totals(q).total)})${extra}` };
}
function activatePlan(p, quiet = false) {
  const c = cust(p.customerId);
  p.status = 'active'; p.activatedAt = today(); p.end = planEnd(p);
  if (!p.seriesId) p.seriesId = uid();
  addPlanVisits(p, p.start, p.end);
  if (p.billing === 'upfront') billPlan(p, p.start, `${p.name} · ${fmtDate(p.start)} to ${fmtDate(p.end)}`, true);
  if (['monthly', 'yearly'].includes(p.billing)) { p.nextBill = p.start; processPlans(true); }
  (c.log ||= []).push({ id: uid(), date: today(), text: `Signed service agreement ${p.number} (${p.name})` });
  save(); if (quiet) return;
  go('#/plans/' + p.id);
  toast(`${p.number} signed and active · visits scheduled`);
}
/** After finishing a job: the next steps, one tap each (like Jobber). */
function jobDoneSheet(j) {
  const c = cust(j.customerId) || {}, s = db.settings;
  const canInvoice = !j.invoiceId && !j.noInvoice && !(j.planId && s.autoChargePlans && stripeOn());
  const review = c.phone && !j.reviewAskedAt;
  const next = db.jobs.filter(x => x.status === 'scheduled' && x.date === today() && x.id !== j.id).sort((a, b) => (a.start || '').localeCompare(b.start || ''))[0];
  if (!canInvoice && !review && !next) { toast('Job complete ✓'); return; }
  modal({ title: 'Job complete ✓', noFoot: true, focus: false, cls: 'done-sheet', body: `
    <div class="done-hero"><div class="req-check">✓</div><b>${esc(j.title)}</b><div class="muted small">${esc(c.name || '')}${j.price || (j.items || []).length ? ' · ' + money(totals(j).total) : ''}</div></div>
    <div class="stack" style="gap:10px">
      ${canInvoice ? `<button type="button" class="btn btn-primary btn-lg js-inv">${icon('invoice')}Create invoice</button>` : ''}
      ${review ? `<button type="button" class="btn btn-lg js-review">${icon('star')}Ask ${esc(firstName(c.name))} for a review</button>` : ''}
      ${next ? `<a class="btn btn-lg" href="#/jobs/${next.id}">${icon('truck')}Next job: ${esc(next.title)}${next.start ? ' · ' + fmtTime(next.start) : ''}</a>` : ''}
      <button type="button" class="btn btn-lg" data-close>Done</button>
    </div>`,
    onMount: (f, close) => {
      $('.js-inv', f)?.addEventListener('click', () => { close(); ACTIONS.jobToInvoice({ id: j.id }); });
      $('.js-review', f)?.addEventListener('click', () => {
        j.reviewAskedAt = today(); save(); close();
        openSms(c.phone, fillTemplate('tplReview', { ...custVars(c) }));
        if (!s.reviewLink) setTimeout(() => toast('Tip: add your Google review link in Settings → Tax & money so it goes in the text.'), 1200);
      });
    } });
}
/* ----- visit reminders for tomorrow (like Homebase’s automatic reminders) ----- */
const reminderJobs = () => db.jobs.filter(j => j.status === 'scheduled' && j.date === addDays(today(), 1) && !j.remindedAt && cust(j.customerId)?.phone);
const reminderText = j => { const c = cust(j.customerId); return fillTemplate('tplAppt', { ...custVars(c), date: fmtDateShort(j.date), time: j.start ? ' at ' + fmtTime(j.start) : '' }); };
/** Text a list of customers in one go: all at once with texting on, one tap each otherwise.
 *  items: [{ c, text, sub, done() }] */
function batchTextSheet(title, note, items) {
  const sms = serverHas('sms');
  modal({ title, noFoot: true, focus: false, body: `
    <p class="muted small" style="margin-top:0">${sms ? 'Texts go from your business number.' : 'Tap each one: Messages opens with the text ready, tap send, then come back for the next.'} ${note}</p>
    ${sms ? `<button type="button" class="btn btn-primary js-all" style="width:100%;margin-bottom:10px">${icon('send')}Send all ${items.length}</button>` : ''}
    ${items.map((it, i) => `<a class="list-item js-rem ${sms ? '' : 'js-raw-sms'}" data-i="${i}" href="${sms ? '#' : smsHref(it.c.phone, it.text)}" style="color:inherit">
      <span class="avatar sm" style="background:#34c759">${esc((it.c.name || '?')[0])}</span>
      <div class="grow"><div class="title">${esc(it.c.name)}</div><div class="muted small">${esc(it.sub)}</div></div><span class="badge js-st">${sms ? 'Ready' : 'Text'}</span></a>`).join('')}`,
    onMount: (f, close) => {
      const mark = (a, ok = true) => { const st = $('.js-st', a); st.textContent = ok ? 'Sent ✓' : 'Failed'; st.className = `badge ${ok ? 'good' : 'bad'} js-st`; a.classList.add('done'); };
      if (!sms) $$('.js-rem', f).forEach(a => a.addEventListener('click', () => {
        const it = items[+a.dataset.i];
        if (!a.classList.contains('done')) { it.done(); logMsg({ customerId: it.c.id, phone: it.c.phone, dir: 'out', body: it.text, via: 'phone', status: 'opened' }); save(); }
        mark(a);
      }));
      $('.js-all', f)?.addEventListener('click', async e => {
        e.preventDefault(); e.target.disabled = true; let ok = 0;
        for (const a of $$('.js-rem', f)) { const it = items[+a.dataset.i], r = await sendText(it.c, it.text); if (r.ok) { it.done(); ok++; } mark(a, r.ok); }
        save(); toast(`${ok} text${ok === 1 ? '' : 's'} sent`); setTimeout(() => { close(); render(); }, 700);
      });
      $$('.js-rem', f).forEach(a => { if (sms) a.addEventListener('click', e => e.preventDefault()); });
    } });
}
function remindersSheet() {
  const list = reminderJobs();
  if (!list.length) { toast('Everyone booked for tomorrow already has a reminder'); return; }
  return batchTextSheet(`Remind tomorrow’s ${list.length === 1 ? 'customer' : list.length + ' customers'}`, 'Wording: Settings → Messages → Appointment confirmation.',
    list.map(j => ({ c: cust(j.customerId), text: reminderText(j), sub: `${j.title}${j.start ? ' · ' + fmtTime(j.start) : ''}`, done: () => { j.remindedAt = today(); } })));
}
async function overdueSheet() {
  const list = db.invoices.filter(i => invStatus(i) === 'overdue' && cust(i.customerId)?.phone && i.remindedAt !== today());
  if (!list.length) { toast('No overdue invoices to remind today'); return; }
  const items = [];
  for (const i of list) items.push({ c: cust(i.customerId), text: docMessage('invoice', i, 'reminder', await payUrlFor('invoice', i)), sub: `${i.number} · ${money(balance(i))} · due ${fmtDateShort(i.dueDate)}`, done: () => { i.remindedAt = today(); } });
  batchTextSheet(`Remind ${plural2(items.length, 'customer')} to pay`, stripeOn() ? 'Each text includes a secure pay-online link.' : 'Wording: Settings → Messages → Payment reminder.', items);
}
async function quoteFollowSheet() {
  const t = today(), list = db.quotes.filter(q => q.status === 'sent' && q.sentAt && daysBetween(q.sentAt, t) >= 3 && quoteStatus(q) !== 'expired' && cust(q.customerId)?.phone && q.followedUpAt !== t);
  if (!list.length) { toast('No quotes waiting for a follow-up'); return; }
  const items = [];
  for (const q of list) items.push({ c: cust(q.customerId), text: docMessage('quote', q, 'followup', await payUrlFor('quote', q)), sub: `${q.number} · ${money(totals(q).total)} · sent ${fmtDateShort(q.sentAt)}`, done: () => { q.followedUpAt = t; } });
  batchTextSheet(`Follow up ${plural2(items.length, 'quote')}`, 'Each text includes the link to approve online.', items);
}
const plural2 = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function addPlanVisits(p, from, to) {
  const dates = planVisitDates(p, from, to), perVisit = p.billing === 'per_visit';
  dates.forEach((date, i) => {
    if (db.jobs.some(j => j.planId === p.id && j.date === date)) return;
    const visitItems = planVisitItems(p, i === 0);
    const work = visitItems.map(it => `• ${it.desc}${it.addon ? ' (add-on)' : ''}`).join('\n');
    db.jobs.push({ id: uid(), createdAt: today(), customerId: p.customerId, title: p.name, date, start: '', end: '', address: p.address || cust(p.customerId)?.address || '',
      assignedTo: p.assignedTo || '', salesRep: p.salesRep && (db.settings.salesScope === 'every' || (i === 0 && !db.jobs.some(x => x.planId === p.id))) ? p.salesRep : '', status: 'scheduled', notes: `Service plan ${p.number}\nThis visit:\n${work}`, items: perVisit ? structuredClone(visitItems) : [], discount: perVisit ? p.discount : 0,
      taxRate: p.taxRate, seriesId: p.seriesId, seriesRule: p.rule, planId: p.id, noInvoice: !perVisit });
  });
  return dates.length;
}
function billPlan(p, date, label, first = false) {
  const inv = invoiceFromItems({ customerId: p.customerId, serviceAddress: p.address, items: planVisitItems(p, first).map(i => ({ ...i, details: i.details || label })), discount: p.discount, taxRate: p.taxRate },
    { planId: p.id, date, dueDate: date, sent: true, sentAt: date, notes: `Service plan ${p.number} · ${label}` });
  return inv;
}
/** Billing runs, renewals and plan endings. Runs when the app opens. */
function processPlans(quiet = false) {
  const t = today(); let billed = 0, renewed = 0;
  for (const p of db.subscriptions) {
    if (p.status !== 'active') continue;
    let guard = 0;
    while (['monthly', 'yearly'].includes(p.billing) && p.nextBill && p.nextBill <= t && p.nextBill <= planEnd(p) && guard++ < 36) {
      const step = p.billing === 'monthly' ? 1 : 12;
      billPlan(p, p.nextBill, `${p.billing === 'monthly' ? 'Monthly' : 'Yearly'} plan payment · ${fmtDate(p.nextBill)}`, p.nextBill === (p.termStart || p.start));
      p.nextBill = addMonths(p.nextBill, step); billed++;
    }
    if (p.autoRenew && planEnd(p) < addDays(t, 30)) { renewPlanTerm(p); renewed++; }
  }
  if (billed + renewed) { save(); if (!quiet) setTimeout(() => toast([billed && `${billed} plan invoice${billed > 1 ? 's' : ''} created`, renewed && `${renewed} plan${renewed > 1 ? 's' : ''} renewed`].filter(Boolean).join(' · ')), 700); }
}
function renewPlanTerm(p) {
  const from = addDays(planEnd(p), 1);
  p.end = addDays(addMonths(from, +p.termMonths || 12), -1);
  p.renewals = (p.renewals || 0) + 1;
  if (p.status !== 'active') p.status = 'active';
  addPlanVisits(p, from, p.end);
  p.termStart = from;
  if (p.billing === 'upfront') billPlan(p, from, `${p.name} · ${fmtDate(from)} to ${fmtDate(p.end)}`, true);
  if (['monthly', 'yearly'].includes(p.billing) && (!p.nextBill || p.nextBill < from)) p.nextBill = from;
}
function cancelPlanForm(p) {
  const c = cust(p.customerId) || {}, done = planDone(p);
  const inFirstTerm = today() <= addDays(addMonths(p.start, +p.termMonths || 12), -1);
  const applies = +p.cancelFee > 0 && inFirstTerm && done < (+p.minVisits || 0);
  const card = defaultCard(p.customerId), future = planJobs(p).filter(j => j.status === 'scheduled' && j.date >= today());
  modal({ title: `Cancel ${p.number}`, submitLabel: 'Cancel plan', body: `
    <div class="cancel-summary">
      <div><span>Started</span><b>${fmtDate(p.start)}</b></div>
      <div><span>Visits done</span><b>${done} of ${+p.minVisits || 0} required</b></div>
      <div><span>First ${+p.termMonths || 12} months</span><b>${inFirstTerm ? 'Still within' : 'Completed'}</b></div>
      <div><span>Upcoming visits removed</span><b>${future.length}</b></div>
    </div>
    ${+p.cancelFee ? `<div class="alert ${applies ? 'warn' : 'info'}" style="margin:12px 0">${icon('alert')}<span>${applies
      ? `The early cancellation fee of <b>${money(p.cancelFee)}</b> applies under the signed agreement.`
      : `No cancellation fee: ${inFirstTerm ? `${done} visit${done === 1 ? '' : 's'} already done` : `the first ${+p.termMonths} months are over`}.`}</span></div>` : ''}
    <div class="form-grid">
      ${+p.cancelFee ? `<label class="check full"><input type="checkbox" name="charge" ${applies ? 'checked' : ''}> Charge the ${money(p.cancelFee)} cancellation fee${card ? ` to ${esc(cardLabel(card))}` : ''}</label>` : ''}
      ${+p.cancelFee && stripeOn() && stripeCard(p.customerId) ? `<label class="check full"><input type="checkbox" name="chargeNow" checked> Charge it now through Stripe (otherwise you can charge it from the invoice)</label>` : ''}
      ${field('Reason', `<select name="reason">${opts(['', 'Moving', 'Price', 'Not happy with service', 'Doing it themselves', 'Switched provider', 'Other'].map(x => [x, x || '—']), '')}</select>`, 'full')}
    </div>`,
    onSubmit: (f, d) => {
      const snap = snapshot(), ids = new Set(future.map(j => j.id));
      db.jobs = db.jobs.filter(j => !ids.has(j.id));
      Object.assign(p, { status: 'cancelled', cancelledAt: today(), cancelReason: d.reason });
      (c.log ||= []).push({ id: uid(), date: today(), text: `Cancelled service plan ${p.number}${d.reason ? ' (' + d.reason + ')' : ''}` });
      if (d.charge) {
        const inv = invoiceFromItems({ customerId: p.customerId, items: [{ desc: `Early cancellation fee · service agreement ${p.number}`, details: `Cancelled ${fmtDate(today())}, ${done} of ${p.minVisits} visits completed`, qty: 1, price: +p.cancelFee, taxable: false }] },
          { planId: p.id, dueDate: today(), sent: true, sentAt: today(), isFee: true, notes: `Early cancellation fee per signed service agreement ${p.number}.` });
        p.feeInvoiceId = inv.id; save(); go('#/invoices/' + inv.id);
        if (d.chargeNow) chargeWithStripe(inv, stripeCard(p.customerId), +p.cancelFee).then(r => { render(); toast(r.ok ? `Cancellation fee of ${money(r.amount)} charged ✓` : `Fee not charged: ${r.error}`); });
        undoToast(snap, card ? `Plan cancelled. Charge ${money(p.cancelFee)} to ${cardLabel(card)}.` : 'Plan cancelled. Fee invoice created.');
      } else { refresh(); undoToast(snap, 'Plan cancelled'); }
    } });
}

/* ----- charging a card on file ----- */
function chargeCard(inv) {
  const c = cust(inv.customerId), card = defaultCard(inv.customerId), bal = balance(inv);
  const url = safeUrl(card?.link) || safeUrl(db.settings.processorUrl);
  modal({ title: `Charge ${money(bal)}`, submitLabel: 'Record payment', body: `
    ${card ? `<div class="card-row" style="margin-bottom:12px"><span class="card-chip">${esc(card.brand.split(' ')[0])}</span><div class="grow"><b>${esc(cardLabel(card))}</b>
      <div class="muted small">${esc(c?.name || '')} · exp ${esc(card.exp)}${card.processor ? ' · saved in ' + esc(card.processor) : ''}</div></div></div>` : ''}
    <ol class="steps">
      <li>${url ? `<a class="btn btn-sm btn-primary" href="${esc(url)}" target="_blank" rel="noopener">Open ${esc(card?.processor || db.settings.processor || 'your payment processor')} ↗</a> and charge` : `In ${esc(card?.processor || db.settings.processor || 'your card terminal or payment app')}, charge`} <b>${money(bal)}</b> to ${card ? esc(cardLabel(card)) : 'the card on file'}.</li>
      <li>Then record the payment here so your books stay up to date.</li>
    </ol>
    <div class="form-grid">${field('Amount charged', inp('amount', bal.toFixed(2), 'type="number" step="0.01" min="0.01" required'))}${field('Date', inp('date', today(), 'type="date" required'))}
      ${field('Reference (optional)', inp('note', '', 'placeholder="Processor receipt / transaction ID"'), 'full')}</div>
    ${!url ? '<p class="muted small">Tip: add your processor’s dashboard link in Settings → Plans &amp; payments to open it in one tap.</p>' : ''}`,
    onSubmit: (f, d) => {
      (inv.payments ||= []).push({ id: uid(), amount: round2(d.amount), date: d.date, method: card ? `Card on file (${cardLabel(card)})` : 'Credit card', note: d.note });
      inv.sent = true; refresh(); toast(balance(inv) <= 0 ? 'Paid in full 🎉' : 'Payment recorded');
    } });
}

/* ----- time clock: always-visible button + dashboard card ----- */
const me = () => byId('team', db.settings.meId);
function clockWidget() {
  const m = me(), e = m && openEntry(m.id);
  return `<button class="clock-btn ${e ? 'on' : ''}" data-act="myClock" aria-label="${e ? 'Clock out' : 'Clock in'}">${icon('clock')}<span class="clock-label">${e
    ? `<span class="hide-xs">On the clock · </span><b data-since="${e.in}">${fmtHours(hoursOf(e))}</b>` : 'Clock in'}</span></button>`;
}
function myHours(from, to) { const m = me(); return m ? sum(db.timeEntries.filter(t => t.memberId === m.id && inRange(localDate(t.in), from, to)), hoursOf) : 0; }
function clockCard() {
  const m = me(), e = m && openEntry(m.id), j = e?.jobId && byId('jobs', e.jobId);
  const ws = addDays(today(), -parseD(today()).getDay());
  const others = db.team.filter(x => x.id !== m?.id && openEntry(x.id));
  return `<div class="card clock-card ${e ? 'on' : ''}"><div class="card-head"><h2>Time clock</h2><a href="#/team" data-tabset="team:tab:time" class="small">Timesheets →</a></div>
    <div class="row" style="flex-wrap:nowrap;gap:14px">
      <div class="grow">${e ? `<div class="clock-big" data-since="${e.in}">${fmtHours(hoursOf(e))}</div><div class="muted small">On the clock since ${fmtClock(e.in)}${j ? ` · <a href="#/jobs/${j.id}">${esc(j.title)}</a>` : ''}</div>`
        : `<div class="clock-big muted">Off the clock</div><div class="muted small">${m ? `${esc(m.name)} · ` : ''}today ${fmtHours(myHours(today(), today()))} · this week ${fmtHours(myHours(ws, today()))}</div>`}</div>
      ${btn(e ? 'Clock out' : 'Clock in', 'myClock', e ? '' : 'btn-primary', '', 'clock')}</div>
    ${others.length ? `<div class="muted small" style="margin-top:10px">Also on the clock: ${others.map(x => `<span class="dot" style="background:${x.color}"></span>${esc(x.name)} since ${fmtClock(openEntry(x.id).in)}`).join(' · ')}</div>` : ''}
  </div>`;
}
/** One short screen with what customers see on quotes, invoices and agreements. */
function quickSetupForm() {
  const s = db.settings;
  modal({ title: 'Set up your business', submitLabel: 'Save', body: `<p class="muted small" style="margin-top:0">This appears on your quotes, invoices and service agreements. Customers send signed agreements back to your phone or email.</p>
    <div class="form-grid">
      ${field('Business name *', inp('businessName', s.businessName, 'required placeholder="e.g. Yonan Window Cleaning"'), 'full')}
      ${field('Your name', inp('ownerName', s.ownerName))}${field('Phone', inp('phone', s.phone, 'type="tel"'))}
      ${field('Email', inp('email', s.email, 'type="email"'), 'full')}
      ${field('Business address', addrInput('address', s.address), 'full')}
      ${field(`Sales tax`, `<div class="row" style="flex-wrap:nowrap">${inp('taxName', s.taxName, 'style="max-width:90px" aria-label="Tax name"')}<div class="pct-input" style="flex:1">${inp('taxRate', s.taxRate, 'type="number" step="0.001" min="0" aria-label="Tax rate"')}<span>%</span></div></div>`)}
      ${field('HST / business number (optional)', inp('taxNumber', s.taxNumber))}
    </div><p class="muted small">Logo, payment details and everything else: Settings.</p>`,
    onSubmit: (f, d) => {
      Object.assign(s, { businessName: d.businessName.trim(), ownerName: d.ownerName.trim(), phone: d.phone, email: d.email.trim(), address: d.address, taxName: d.taxName || 'HST', taxRate: +d.taxRate || 0, taxNumber: d.taxNumber });
      if (s.ownerName && !db.team.length) { const m = { id: uid(), name: s.ownerName, role: 'Owner', color: TEAM_COLORS[0], phone: s.phone, email: s.email, rate: 0 }; db.team.push(m); s.meId = m.id; }
      refresh(); toast('Business details saved');
    } });
}
function chooseMe(then) {
  if (!db.team.length) {
    const m = { id: uid(), name: db.settings.ownerName || 'Me', role: 'Owner', color: TEAM_COLORS[0], phone: db.settings.phone || '', email: db.settings.email || '', rate: 0 };
    db.team.push(m); db.settings.meId = m.id; save(); return then();
  }
  modal({ title: 'Who are you?', submitLabel: 'Continue', body: `<p class="muted small" style="margin-top:0">Pick your name so the clock button tracks your own hours. You can change this in Team &amp; time.</p>
    ${field('Team member', `<select name="m">${opts(db.team.map(x => [x.id, x.name]))}</select>`)}`,
    onSubmit: (f, d) => { db.settings.meId = d.m; save(); setTimeout(then, 0); } });
}
setInterval(() => $$('[data-since]').forEach(el => { el.textContent = fmtHours(hoursOf({ in: el.dataset.since, out: '' })); }), 30000);

/* =====================================================================
 * Door knocking: pin every house on a map, track outcomes and stats
 * ===================================================================== */
const KNOCK = {
  sale: { label: 'Sale', short: 'Yes', color: '#15803d', svg: '<path d="M6 12.5l4 4 8-9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
  quote: { label: 'Quoted', short: 'Quote', color: '#10b981', svg: '<path d="M8 4.5h6l3.5 3.5V19a.8.8 0 0 1-.8.8H8a.8.8 0 0 1-.8-.8V5.3A.8.8 0 0 1 8 4.5z" fill="#fff"/><path d="M9.5 10.5h5M9.5 13h5M9.5 15.5h3.5" stroke="#10b981" stroke-width="1.4" stroke-linecap="round"/>' },
  comeback: { label: 'Come back later', short: 'Come back', color: '#d97706', svg: '<circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M12 8.5V12l2.5 1.8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>' },
  no: { label: 'Not interested', short: 'No', color: '#dc2626', svg: '<path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' },
  nothome: { label: 'Not home', short: 'Not home', color: '#64748b', svg: '<path d="M6.5 12 12 7.5l5.5 4.5v6h-11z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M10.5 18v-3.5h3V18" stroke="#fff" stroke-width="1.8" fill="none"/>' },
};
const KNOCK_ORDER = ['sale', 'quote', 'comeback', 'no', 'nothome'];
const knockIcon = (st, size = 28) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="11.5" fill="${KNOCK[st]?.color || '#64748b'}" stroke="#fff" stroke-width="1"/>${KNOCK[st]?.svg || ''}</svg>`;
const knockEvents = (from, to, rep = '') => db.pins.flatMap(p => (p.history || []).map(h => ({ ...h, pin: p })))
  .filter(e => inRange(e.at.slice(0, 10), from, to) && (!rep || e.rep === rep));
function knockStats(from, to, rep) {
  const ev = knockEvents(from, to, rep), n = k => ev.filter(e => e.status === k).length;
  const answered = ev.filter(e => e.status !== 'nothome').length;
  return { doors: ev.length, sale: n('sale'), quote: n('quote'), comeback: n('comeback'), no: n('no'), nothome: n('nothome'), answered, ev };
}
const comebacksDue = (until = today()) => db.pins.filter(p => p.status === 'comeback' && (!p.comebackDate || p.comebackDate <= until)).sort((a, b) => (a.comebackDate || '').localeCompare(b.comebackDate || ''));

/* Full-screen satellite map (MapLibre GL: rotate, tilt, smooth zoom). */
let mapLibP, map, geoCtl, lastPos, dropMarker, pinMarkers = [];
const MAPLIBRE = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl';
function loadMapLib() {
  return mapLibP ||= new Promise((res, rej) => {
    if (window.maplibregl) return res(window.maplibregl);
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = MAPLIBRE + '.css'; document.head.append(css);
    const s = document.createElement('script'); s.src = MAPLIBRE + '.js';
    s.onload = () => res(window.maplibregl); s.onerror = () => { mapLibP = null; rej(new Error('offline')); };
    document.head.append(s);
  });
}
function destroyMap() {
  pinMarkers = []; dropMarker = null; geoCtl = null;
  if (map) { try { map.remove(); } catch { /* already gone */ } map = null; }
  document.body.classList.remove('map-mode');
}
const COMPASS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 15.5 12h-7z" fill="#e5484d"/><path d="M12 21.5 8.5 12h7z" fill="currentColor" opacity=".45"/></svg>';
const todayLine = () => { const t = today(), td = knockStats(t, t, ''); return `<span class="muted">Today</span> <b>${td.doors}</b> doors · <b>${td.sale}</b> sales · <b>${td.quote}</b> quotes · <b>${td.comeback}</b> come-backs`; };
const MAP_WHEN = [['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['all', 'All']];
const mapWhen = () => filt('canvass', 'when', 'today');
/** First day of the map's time window ('' = all time). */
function mapFrom(when = mapWhen()) {
  const t = today();
  return { today: t, week: addDays(t, -parseD(t).getDay()), month: monthStart(t), year: t.slice(0, 4) + '-01-01' }[when] || '';
}
/** Pins shown on the map: knocked in the chosen window, plus any come-back that is due (so none get missed). */
function mapPins() {
  const show = filt('canvass', 'show', 'all'), from = mapFrom(), t = today();
  return db.pins.filter(p => (show === 'all' || p.status === show) &&
    (!from || ((p.history || []).at(-1)?.at || p.createdAt || '').slice(0, 10) >= from || (p.status === 'comeback' && p.comebackDate && p.comebackDate <= t)));
}
function mapLine() {
  const when = mapWhen(), t = today(), from = mapFrom(when) || '0000-01-01', st = knockStats(from, t, '');
  const label = { today: 'Today', week: 'This week', month: 'This month', year: 'This year', all: 'All time' }[when];
  return `<span class="muted">${label}</span> <b>${st.doors}</b> doors · <b>${st.sale}</b> sales · <b>${st.quote}</b> quotes · <b>${mapPins().length}</b> pins`;
}
const dueBtn = () => { const n = comebacksDue().length; return n ? `<button type="button" class="glass map-due" data-act="showDue">${icon('clock')}${n} come-back${n > 1 ? 's' : ''} due</button>` : ''; };

VIEWS.canvass = () => {
  const tab = filt('canvass', 'tab', 'map');
  const t = today(), td = knockStats(t, t, '');
  const tabs = tabsHTML('canvass', 'tab', [['map', 'Map'], ['stats', 'Stats'], ['list', `Houses (${db.pins.length})`]], tab);
  const headSub = `Today: <b>${td.doors}</b> doors · <b>${td.sale}</b> sales · <b>${td.quote}</b> quotes · <b>${td.comeback}</b> come-backs`;
  if (tab === 'stats') return head('Door knocking', '', headSub) + `<div class="card">${tabs}${canvassStatsHTML()}</div>`;
  if (tab === 'list') return head('Door knocking', '', headSub) + `<div class="card">${tabs}${canvassListHTML()}</div>`;
  const show = filt('canvass', 'show', 'all'), sat = state.mapStyle !== 'street';
  return `<div class="map-screen">
    <div id="canvassMap" class="map-full"><div class="map-loading">Loading map…</div></div>
    <div class="map-top">
      <div class="map-row"><div class="map-seg glass">${[['map', 'Map'], ['stats', 'Stats'], ['list', 'Houses']].map(([k, l]) => `<button type="button" data-tab="canvass:tab:${k}" class="${k === 'map' ? 'active' : ''}">${l}</button>`).join('')}</div>
        <select class="glass map-show js-map-show" aria-label="Which pins">${opts([['all', 'All pins'], ...KNOCK_ORDER.map(k => [k, KNOCK[k].short])], show)}</select></div>
      <div class="map-seg map-when glass" role="group" aria-label="Show pins from">${MAP_WHEN.map(([k, l]) =>
        `<button type="button" data-act="mapWhen" data-v="${k}" class="${mapWhen() === k ? 'active' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div class="map-ctrls glass">
      <button type="button" data-act="mapStyle" class="js-style" aria-label="${sat ? 'Show street map' : 'Show satellite'}" title="${sat ? 'Street map' : 'Satellite'}">${icon(sat ? 'map' : 'camera')}</button>
      <button type="button" data-act="mapLocate" aria-label="Show my location" title="My location">${icon('route')}</button>
      <button type="button" data-act="mapNorth" class="js-compass hidden" aria-label="Point north" title="Point north">${COMPASS}</button>
    </div>
    <div class="map-hint js-map-hint">Tap a house to pin it · Two fingers to rotate</div>
    <div class="map-bottom">
      <div class="map-stats glass js-map-stats">${mapLine()}</div>
      <div class="map-actions"><span class="js-due">${dueBtn()}</span><button type="button" class="btn btn-primary map-pin-btn" data-act="pinHere">${icon('map')}Pin my spot</button></div>
    </div>
  </div>`;
};
VIEWS.canvass.mount = () => {
  if (filt('canvass', 'tab', 'map') !== 'map') return null;
  document.body.classList.add('map-mode');
  mountMap();
  return destroyMap;
};

async function mountMap() {
  const el = $('#canvassMap'); if (!el) return;
  let ml;
  try { ml = await loadMapLib(); } catch {
    el.innerHTML = '<div class="map-loading">The map needs an internet connection.<br>You can still use “Pin my spot”. Your pins show up when you’re back online.</div>'; return;
  }
  if (!document.body.contains(el) || map) return;
  const esri = l => `https://server.arcgisonline.com/ArcGIS/rest/services/${l}/MapServer/tile/{z}/{y}/{x}`;
  const sat = state.mapStyle !== 'street', vis = on => ({ visibility: on ? 'visible' : 'none' });
  const v = state.mapView || {}, lastPin = db.pins.at(-1);
  const center = v.c ? [v.c[1], v.c[0]] : lastPin ? [lastPin.lng, lastPin.lat] : (db.settings.mapCenter || '43.70,-79.42').split(',').map(Number).reverse();
  el.innerHTML = '';
  let m;
  try {
    m = map = new ml.Map({
      container: el, center, zoom: v.z ?? (lastPin ? 17.5 : 15), bearing: v.b || 0, pitch: v.p || 0, maxZoom: 21, maxPitch: 70,
      attributionControl: { compact: true }, dragRotate: true, touchPitch: true,
      style: { version: 8,
        sources: {
          sat: { type: 'raster', tiles: [esri('World_Imagery')], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
          roads: { type: 'raster', tiles: [esri('Reference/World_Transportation')], tileSize: 256, maxzoom: 19 },
          places: { type: 'raster', tiles: [esri('Reference/World_Boundaries_and_Places')], tileSize: 256, maxzoom: 19 },
          osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors' },
        },
        layers: [
          { id: 'osm', type: 'raster', source: 'osm', layout: vis(!sat) },
          { id: 'sat', type: 'raster', source: 'sat', layout: vis(sat) },
          { id: 'roads', type: 'raster', source: 'roads', layout: vis(sat) },
          { id: 'places', type: 'raster', source: 'places', layout: vis(sat) },
        ] },
    });
  } catch {
    el.innerHTML = '<div class="map-loading">This browser can’t show the 3D map. Try Safari or Chrome.</div>'; return;
  }
  geoCtl = new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserHeading: true, fitBoundsOptions: { maxZoom: 18 } });
  m.addControl(geoCtl, 'top-left'); // its button is hidden; we trigger it from our own
  geoCtl.on('geolocate', e => { lastPos = [e.coords.latitude, e.coords.longitude]; });
  m.on('moveend', () => {
    const c = m.getCenter(); state.mapView = { c: [c.lat, c.lng], z: m.getZoom(), b: m.getBearing(), p: m.getPitch() };
    if (db.pins.length > 400 && m.isStyleLoaded()) drawPins(); // big pin sets: redraw what's around you
  });
  const syncCompass = () => {
    const comp = $('.js-compass'); if (!comp) return;
    comp.classList.toggle('hidden', Math.abs(m.getBearing()) < 0.5 && m.getPitch() < 0.5);
    comp.firstElementChild.style.transform = `rotate(${-m.getBearing()}deg)`;
  };
  m.on('rotate', syncCompass); m.on('pitch', syncCompass); syncCompass();
  m.on('click', e => { if (e.originalEvent?.target?.closest?.('.knock-pin')) return; dropPin(e.lngLat.lat, e.lngLat.lng); });
  m.on('load', () => {
    drawPins(); if (!v.c && !lastPin) geoCtl.trigger();
    el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'); // credits behind the (i) button
  });
  setTimeout(() => $('.js-map-hint')?.classList.add('fade'), 4500);
}
function dropPin(lat, lng) {
  if (map && window.maplibregl) {
    dropMarker?.remove();
    const el = document.createElement('div'); el.className = 'drop-pin'; el.innerHTML = '<span></span>';
    dropMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
    const obs = new MutationObserver(() => { if (!$('#modalRoot').children.length) { dropMarker?.remove(); dropMarker = null; obs.disconnect(); } });
    setTimeout(() => obs.observe($('#modalRoot'), { childList: true }));
  }
  pinForm(null, { lat, lng });
}
function drawPins() {
  const line = $('.js-map-stats'); if (line) line.innerHTML = mapLine();
  if (!map || !window.maplibregl) return;
  pinMarkers.forEach(mk => mk.remove()); pinMarkers = [];
  let list = mapPins();
  if (list.length > 400) {
    const bb = map.getBounds(), dy = (bb.getNorth() - bb.getSouth()) * .35, dx = (bb.getEast() - bb.getWest()) * .35;
    list = list.filter(p => p.lat <= bb.getNorth() + dy && p.lat >= bb.getSouth() - dy && p.lng <= bb.getEast() + dx && p.lng >= bb.getWest() - dx).slice(-700);
  }
  for (const p of list) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'knock-pin'; el.innerHTML = knockIcon(p.status, 30);
    el.setAttribute('aria-label', `${KNOCK[p.status]?.label || 'Pin'}: ${p.address || 'house'}`);
    el.addEventListener('click', e => { e.stopPropagation(); pinForm(p); });
    pinMarkers.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
  }
}
document.addEventListener('change', e => {
  if (!e.target.classList?.contains('js-map-show')) return;
  (state.filters.canvass ||= {}).show = e.target.value; drawPins();
});
function showDueList() {
  const due = comebacksDue();
  modal({ title: `Come-backs due (${due.length})`, noFoot: true, focus: false, body: due.length ? due.map(p => pinRow(p)).join('')
    + '<p class="muted small" style="margin-top:10px">Tap one to open it. Use Directions to get there.</p>' : '<p class="muted">Nothing due. 🎉</p>' });
}

function pinRow(p) {
  const last = (p.history || []).at(-1);
  return `<div class="list-item clickable" data-act="editPin" data-id="${p.id}">${knockIcon(p.status, 26)}
    <div class="grow"><div class="title">${esc(p.address || 'Pinned house')}</div>
    <div class="muted small">${esc(KNOCK[p.status]?.label || '')}${p.name ? ' · ' + esc(p.name) : ''}${p.status === 'comeback' && p.comebackDate ? ` · back ${fmtDateShort(p.comebackDate)}${p.comebackTime ? ' ' + fmtTime(p.comebackTime) : ''}` : ''}${last ? ' · ' + fmtDateShort(last.at.slice(0, 10)) : ''}${p.notes ? ' · ' + esc(p.notes.slice(0, 60)) : ''}</div></div></div>`;
}
function canvassListHTML() {
  const show = filt('canvassList', 'st', ''), q = filt('canvassList', 'q', '').toLowerCase();
  const list = db.pins.filter(p => (!show || p.status === show) && (!q || `${p.address} ${p.name} ${p.notes} ${p.phone}`.toLowerCase().includes(q)))
    .sort((a, b) => ((b.history || []).at(-1)?.at || '').localeCompare((a.history || []).at(-1)?.at || ''));
  return `<div class="toolbar"><input type="search" placeholder="Search address, name, notes…" value="${esc(q)}" data-filter="canvassList:q">
    <select data-filter="canvassList:st" style="width:auto" aria-label="Outcome">${opts([['', 'All outcomes'], ...KNOCK_ORDER.map(k => [k, KNOCK[k].label])], show)}</select></div>
    ${list.length ? list.slice(0, 300).map(pinRow).join('') : empty('map', 'No houses pinned yet. Open the map and tap a house to pin it.')}`;
}
function statRange(period, offset) {
  const t = today();
  if (period === 'day') { const d = addDays(t, offset); return [d, d, fmtDateShort(d)]; }
  if (period === 'week') { const s = addDays(addDays(t, -parseD(t).getDay()), offset * 7), e = addDays(s, 6); return [s, e, `${fmtDateShort(s)} – ${fmtDateShort(e)}`]; }
  if (period === 'month') { const s = addMonths(monthStart(t), offset); return [s, monthEnd(s), parseD(s).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })]; }
  const y = +t.slice(0, 4) + offset; return [`${y}-01-01`, `${y}-12-31`, String(y)];
}
function canvassStatsHTML() {
  const period = filt('canvassStats', 'period', 'day'), offset = +filt('canvassStats', 'offset', 0), rep = filt('canvassStats', 'rep', '');
  const [from, to, label] = statRange(period, offset), st = knockStats(from, to, rep);
  const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '—');
  const reps = [...new Set(db.pins.flatMap(p => (p.history || []).map(h => h.rep)).filter(Boolean))];
  // bars: hours for a day, days for week/month, months for a year
  let buckets = [];
  if (period === 'day') buckets = Array.from({ length: 14 }, (_, i) => i + 8).map(h => ({ label: `${(h % 12) || 12}${h < 12 ? 'a' : 'p'}`, test: e => +e.at.slice(11, 13) === h }));
  else if (period === 'year') buckets = Array.from({ length: 12 }, (_, i) => ({ label: parseD(`${from.slice(0, 4)}-${pad(i + 1)}-01`).toLocaleDateString(undefined, { month: 'short' }), test: e => +e.at.slice(5, 7) === i + 1 }));
  else { for (let d = from; d <= to; d = addDays(d, 1)) { const dd = d; buckets.push({ label: period === 'week' ? parseD(dd).toLocaleDateString(undefined, { weekday: 'short' }) : String(+dd.slice(8)), test: e => e.at.slice(0, 10) === dd }); } }
  const rows = buckets.map(b => { const ev = st.ev.filter(b.test); return { label: b.label, doors: ev.length, sales: ev.filter(e => e.status === 'sale').length }; });
  const tiles = [['Doors knocked', st.doors, `${st.answered} answered · ${st.nothome} not home`], ['Sales', st.sale, `${pct(st.sale, st.doors)} of doors · ${pct(st.sale, st.answered)} of answered`],
    ['Quotes', st.quote, pct(st.quote, st.doors) + ' of doors'], ['Come-backs', st.comeback, `${comebacksDue().length} due now`], ['Not interested', st.no, pct(st.no, st.answered) + ' of answered']];
  return `<div class="cal-head">
      <div class="seg">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(([k, l]) => `<button data-act="statPeriod" data-v="${k}" class="${period === k ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div class="row" style="flex-wrap:nowrap"><button class="btn btn-sm" data-act="statMove" data-n="-1" aria-label="Previous">‹</button><h2 class="cal-title">${esc(label)}</h2>
        <button class="btn btn-sm" data-act="statMove" data-n="1" aria-label="Next" ${offset >= 0 ? 'disabled' : ''}>›</button></div>
      <span class="spacer"></span>
      ${reps.length > 1 ? `<select data-filter="canvassStats:rep" style="width:auto" aria-label="Rep">${opts([['', 'Everyone'], ...reps.map(r => [r, r])], rep)}</select>` : ''}
    </div>
    <div class="knock-tiles">${tiles.map(([l, v, sub], i) => `<div class="knock-tile">${knockIcon([null, 'sale', 'quote', 'comeback', 'no'][i] || 'nothome', 22).replace('#64748b', 'var(--primary)')}
      <div><div class="muted small">${l}</div><div class="value">${v}</div><div class="muted small">${sub}</div></div></div>`).join('')}</div>
    <h3 class="group-label">Doors knocked ${period === 'day' ? 'by hour' : period === 'year' ? 'by month' : 'by day'}</h3>
    ${knockBars(rows)}
    ${reps.length > 1 ? `<h3 class="group-label">By rep</h3><div class="table-wrap"><table><thead><tr><th>Rep</th><th class="num">Doors</th><th class="num">Sales</th><th class="num">Quotes</th><th class="num">Come-backs</th><th class="num">Close rate</th></tr></thead><tbody>
      ${reps.map(r => { const x = knockStats(from, to, r); return `<tr><td>${esc(r)}</td><td class="num">${x.doors}</td><td class="num">${x.sale}</td><td class="num">${x.quote}</td><td class="num">${x.comeback}</td><td class="num">${pct(x.sale, x.answered)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}`;
}
function knockBars(rows) {
  const W = 640, H = 170, pl = 30, pb = 22, pt = 8, max = Math.max(4, ...rows.map(r => r.doors));
  const step = max <= 10 ? 2 : max <= 40 ? 10 : Math.ceil(max / 4 / 10) * 10, top = Math.ceil(max / step) * step;
  const cw = (W - pl) / rows.length, bw = Math.max(3, Math.min(26, cw - 6)), y = v => pt + (H - pt - pb) * (1 - v / top);
  let g = '';
  for (let v = 0; v <= top; v += step) g += `<line class="gridline" x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-label" x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  rows.forEach((r, i) => {
    const x = pl + i * cw + (cw - bw) / 2;
    g += `<path d="${barPath(x, y(r.doors), bw, y(0) - y(r.doors))}" fill="var(--series-1)"/>`;
    if (rows.length <= 16 || i % 2 === 0) g += `<text class="axis-label" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(r.label)}</text>`;
    g += `<rect x="${pl + i * cw}" y="${pt}" width="${cw}" height="${H - pt - pb}" fill="transparent" data-tip="${esc(`<b>${r.label}</b><br>${r.doors} doors · ${r.sales} sales`)}"/>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Doors knocked">${g}</svg></div>`;
}

function currentPosition() {
  return new Promise((res, rej) => {
    if (lastPos) return res(lastPos);
    if (!navigator.geolocation) return rej(new Error('no gps'));
    navigator.geolocation.getCurrentPosition(p => res([p.coords.latitude, p.coords.longitude]), rej, { enableHighAccuracy: true, timeout: 12000 });
  });
}
async function reverseAddress(lat, lng) {
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&layer=house&lang=en`).then(x => x.json());
    const p = r.features?.[0]?.properties; return p ? formatAddress(p) : '';
  } catch { return ''; }
}
function canvassRefresh() {
  if (location.hash.startsWith('#/canvass') && map && filt('canvass', 'tab', 'map') === 'map') {
    drawPins();
    const st = $('.js-map-stats'); if (st) st.innerHTML = mapLine();
    const d = $('.js-due'); if (d) d.innerHTML = dueBtn();
    renderChrome();
  } else render();
}
function pinForm(p, at) {
  const isNew = !p; p ||= { lat: at.lat, lng: at.lng, status: '', address: '' };
  const hist = (p.history || []).slice().reverse();
  // On the full-screen map: half-height card, and slide the map so this house sits above it
  const onMap = !!map && document.body.classList.contains('map-mode');
  if (onMap) map.easeTo({ center: [p.lng ?? at.lng, p.lat ?? at.lat], offset: [0, -Math.round(innerHeight * (isPhone() ? 0.24 : 0))], zoom: Math.max(map.getZoom(), 18), duration: 450 });
  modal({ title: isNew ? 'Pin this house' : 'House', submitLabel: 'Save', focus: false, cls: onMap ? 'half-sheet' : '', body: `
    ${field('Address', addrInput('address', p.address, isNew ? 'placeholder="Finding address…"' : ''))}
    <div class="field" style="margin-top:12px"><label>What happened?</label>
      <div class="knock-picker">${KNOCK_ORDER.map(k => `<label class="knock-opt"><input type="radio" name="status" value="${k}" ${p.status === k ? 'checked' : ''} required>
        <span>${knockIcon(k, 34)}<b>${KNOCK[k].short}</b></span></label>`).join('')}</div></div>
    <div class="form-grid js-comeback ${p.status === 'comeback' ? '' : 'hidden'}" style="margin-top:12px">
      ${field('Come back on', inp('comebackDate', p.comebackDate || addDays(today(), 1), 'type="date"'))}${field('Time (optional)', inp('comebackTime', p.comebackTime, 'type="time"'))}</div>
    <div class="form-grid" style="margin-top:12px">
      ${field('Name', inp('name', p.name, 'placeholder="Homeowner name"'))}${field('Phone', inp('phone', p.phone, 'type="tel"'))}
      ${field('Notes', `<textarea name="notes" rows="3" placeholder="What did they say? Dog, gate, best time to come back…">${esc(p.notes)}</textarea>`, 'full')}
    </div>
    ${!isNew ? `<div class="row" style="margin-top:12px">
      ${p.customerId && cust(p.customerId) ? `<a class="btn btn-sm" href="#/customers/${p.customerId}">${icon('users')}Customer</a>` : ''}
      <button type="button" class="btn btn-sm js-pin-act" data-do="quote">${icon('quote')}Create quote</button>
      <button type="button" class="btn btn-sm js-pin-act" data-do="job">${icon('calendar')}Book job</button>
      <button type="button" class="btn btn-sm js-pin-act" data-do="plan">${icon('repeat')}Service plan</button>
      ${!p.leadId ? `<button type="button" class="btn btn-sm js-pin-act" data-do="lead">${icon('funnel')}Add to leads</button>` : ''}
      <a class="btn btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}">${icon('route')}Directions</a></div>` : ''}
    ${hist.length ? `<h3 class="group-label">Knock history</h3>${hist.map(h => `<div class="hist-row">${knockIcon(h.status, 18)}<span>${esc(KNOCK[h.status]?.label || h.status)}</span><span class="muted small">${fmtDateShort(h.at.slice(0, 10))} ${fmtClock(h.at)}${h.rep ? ' · ' + esc(h.rep) : ''}</span></div>`).join('')}` : ''}`,
    footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete pin</button>`,
    onMount: (f, close) => {
      const sync = () => $('.js-comeback', f).classList.toggle('hidden', f.status.value !== 'comeback');
      f.addEventListener('change', e => { if (e.target.name === 'status') sync(); });
      if (isNew && !p.address) reverseAddress(p.lat, p.lng).then(a => { if (a && !f.address.value) f.address.value = a; f.address.placeholder = 'Address'; });
      $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.pins = db.pins.filter(x => x.id !== p.id); close(); save(); canvassRefresh(); undoToast(snap, 'Pin deleted'); });
      $$('.js-pin-act', f).forEach(b => b.addEventListener('click', () => {
        if (!f.reportValidity()) return;
        apply(Object.fromEntries(new FormData(f))); close();
        const c = pinToCustomer(p), what = b.dataset.do;
        if (what === 'lead') { pinToLead(p); save(); canvassRefresh(); toast('Added to leads'); return; }
        save();
        if (what === 'quote') docForm('quote', null, { customerId: c.id, serviceAddress: p.address });
        if (what === 'job') jobForm(null, { customerId: c.id, address: p.address, date: today() });
        if (what === 'plan') planForm(null, { customerId: c.id });
      }));
    },
    onSubmit: (f, d) => {
      apply(d); save(); canvassRefresh();
      toast(`${KNOCK[p.status].label}${p.address ? ' · ' + p.address.split(',')[0] : ''}`);
    } });
  function apply(d) {
    const changed = d.status !== p.status;
    Object.assign(p, { address: d.address.trim(), status: d.status, name: d.name.trim(), phone: d.phone, notes: d.notes,
      comebackDate: d.status === 'comeback' ? d.comebackDate : '', comebackTime: d.status === 'comeback' ? d.comebackTime : '' });
    if (isNew && !p.id) { p.id = uid(); p.createdAt = today(); p.history = []; db.pins.push(p); }
    if (changed || isNew && !p.history.length) p.history.push({ at: localStamp(), status: d.status, rep: me()?.name || '' });
    if (p.leadId) { const l = byId('leads', p.leadId); if (l) Object.assign(l, { name: p.name || l.name, phone: p.phone || l.phone, notes: p.notes, followUp: p.comebackDate || l.followUp }); }
    if (['quote', 'comeback'].includes(p.status) && !p.leadId && !p.customerId && (p.name || p.phone)) pinToLead(p);
  }
}
function pinToLead(p) {
  const l = { id: uid(), createdAt: today(), name: p.name || p.address || 'Door knock', phone: p.phone || '', email: '', address: p.address, service: '', value: 0,
    stage: firstStage(), source: 'Door knocking', followUp: p.comebackDate || addDays(today(), 1), notes: p.notes || '', customerId: p.customerId || '' };
  db.leads.push(l); p.leadId = l.id; return l;
}
function pinToCustomer(p) {
  let c = p.customerId && cust(p.customerId);
  if (!c && p.leadId && byId('leads', p.leadId)?.customerId) c = cust(byId('leads', p.leadId).customerId);
  if (!c) {
    const rep = (p.history || []).find(h => h.status === 'sale' || h.status === 'quote')?.rep || p.history?.at(-1)?.rep || me()?.name || '';
    c = { id: uid(), createdAt: today(), name: p.name || p.address || 'New customer', phone: p.phone || '', email: '', address: p.address || '', source: 'Door knocking', notes: p.notes || '', salesRep: rep };
    db.customers.push(c); toast(`${c.name} added to customers`);
  }
  p.customerId = c.id;
  if (p.leadId) { const l = byId('leads', p.leadId); if (l) l.customerId = c.id; }
  return c;
}

/* =====================================================================
 * Stripe — through the business's own payment server (stripe-worker/)
 * ===================================================================== */
const stripeOn = () => !!(db.settings.stripeUrl && db.settings.stripeToken);
/** What your server can do (from the last connection test): stripe, sms, inbox. */
const serverHas = f => !!(stripeOn() && db.settings.stripeStatus?.features?.[f]);
const serverBase = () => db.settings.stripeUrl.trim().replace(/\/+$/, '');
/* Instant updates without any setup: customers' answers come back through ntfy.sh, encrypted
 * with a key only their link and this device know. */
const RELAY = 'https://ntfy.sh';
const relayOn = () => db.settings.relay !== false;
function relayFor(doc) {
  if (!relayOn()) return undefined;
  const s = db.settings;
  if (!s.relayTopic) s.relayTopic = 'bh' + [...crypto.getRandomValues(new Uint8Array(14))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (!doc.relayKey) doc.relayKey = BH.newKey();
  save();
  return { u: s.relayUrl || RELAY, t: s.relayTopic, k: doc.relayKey };
}
/** Is anyone likely to answer? (Only then ask the relay, to keep requests low.) */
const awaitingAnswers = () => db.quotes.some(q => q.relayKey && ['sent', 'draft', 'expired'].includes(q.status)) || db.subscriptions.some(p => p.relayKey && ['sent', 'draft'].includes(p.status));
async function checkRelay(notes) {
  const s = db.settings;
  if (!relayOn() || !s.relayTopic || !(awaitingAnswers() || s.bookingKeys)) return;
  const res = await fetch(`${(s.relayUrl || RELAY).replace(/\/+$/, '')}/${s.relayTopic}/json?poll=1&since=${encodeURIComponent(s.relaySince || '12h')}`);
  if (!res.ok) return;
  const msgs = (await res.text()).split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(m => m?.event === 'message');
  const pend = s.relayPending ||= {};
  for (const m of msgs) {
    s.relaySince = m.id;
    let part; try { part = JSON.parse(m.message); } catch { continue; }
    if (!part?.m || !part.id) continue;
    const g = pend[part.m] ||= { id: part.id, n: part.n, c: {}, at: Date.now() };
    g.c[part.i] = part.c;
  }
  for (const [mid, g] of Object.entries(pend)) {
    if (Object.keys(g.c).length < g.n) { if (Date.now() - g.at > 864e5) delete pend[mid]; continue; }
    delete pend[mid];
    if (g.id === 'request') { // booking form
      try { const lead = addBookingRequest(await BH.openFor(Array.from({ length: g.n }, (_, i) => g.c[i]).join(''), s.bookingKeys.priv)); if (lead) notes.push(`New booking request from ${lead.name}`); } catch { /* not for us */ }
      continue;
    }
    const doc = byId('quotes', g.id) || byId('subscriptions', g.id);
    if (!doc?.relayKey) continue;
    try {
      const r = await BH.openSealed(Array.from({ length: g.n }, (_, i) => g.c[i]).join(''), doc.relayKey);
      if (r.id !== doc.id) continue; // sealed for another document
      const out = r.k === 'quote' ? await receiveQuote(r) : await receivePlanQuiet(r);
      if (out.ok || !out.already) notes.push(out.msg);
    } catch { /* not readable with this key: ignore */ }
  }
  save();
}
/** A new customer filled in the online booking form: it becomes a lead. */
function addBookingRequest(r) {
  if (!r?.name || (!r.phone && !r.email)) return null;
  const d10 = digits10(r.phone);
  if (db.leads.some(l => l.reqAt === r.at)) return null; // already have it
  const when = [r.days?.length ? 'Days: ' + r.days.join(', ') : '', r.time ? 'Time: ' + r.time : '', r.date ? 'Preferred date: ' + fmtDate(r.date) : ''].filter(Boolean).join(' · ');
  const lead = { id: uid(), createdAt: today(), stage: firstStage(), followUp: today(), name: String(r.name).slice(0, 120), phone: String(r.phone || '').slice(0, 40),
    email: String(r.email || '').slice(0, 120), address: String(r.address || '').slice(0, 200), service: (r.services || []).join(', ').slice(0, 200),
    source: LEAD_SOURCES.includes(r.source) && r.source ? r.source : 'Website', notes: ['Booked online.', when, r.notes ? String(r.notes).slice(0, 2000) : ''].filter(Boolean).join('\n'),
    reqAt: r.at, fromForm: true };
  const existing = d10 && db.customers.find(c => digits10(c.phone) === d10);
  if (existing) { lead.customerId = existing.id; (existing.log ||= []).push({ id: uid(), date: today(), text: `Booking request online: ${lead.service || 'new work'}` }); }
  db.leads.push(lead); save();
  return lead;
}
async function bookingLink() {
  const s = db.settings;
  if (!s.relayTopic) relayFor({}); // makes the topic
  if (!s.bookingKeys) { s.bookingKeys = await BH.newKeyPair(); save(); }
  const payload = { b: { name: s.businessName || 'Our team', phone: s.phone, email: s.email, area: s.address ? s.address.split(',').slice(-2).join(',').trim() : '' },
    svc: db.services.filter(x => !x.addon).map(x => x.name).slice(0, 16), t: s.relayTopic, pk: s.bookingKeys.pub };
  if (s.relayUrl) payload.u = s.relayUrl; // shorter link (and QR code) for the usual relay
  return `${appBase()}request.html#${await BH.pack(payload)}`;
}
async function bookingShare() {
  const link = await bookingLink(), s = db.settings;
  const msg = `Book with ${s.businessName || 'us'} online: ${link}`;
  modal({ title: 'Online booking form', noFoot: true, focus: false, body: `
    <p class="muted small" style="margin-top:0">Share this link on Instagram, Facebook, Google, your website or door hangers. New customers pick what they need and send their details. Requests show up in <b>Leads</b> by themselves, readable only on this device.</p>
    <div class="stack" style="gap:8px">
      <button type="button" class="btn btn-primary js-share">${icon('share')}Share link</button>
      <button type="button" class="btn js-copy">Copy link</button>
      <a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Preview the form ↗</a>
    </div>
    <div class="qr-box js-qr"><span class="muted small">Making a QR code for flyers…</span></div>`,
    onMount: f => {
      $('.js-copy', f).addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); toast('Booking link copied'); } catch { prompt('Copy this link:', link); } });
      $('.js-share', f).addEventListener('click', async () => {
        if (navigator.share) { try { await navigator.share({ title: `Book with ${s.businessName || 'us'}`, text: msg, url: link }); } catch { /* cancelled */ } }
        else { try { await navigator.clipboard.writeText(msg); toast('Copied. Paste it anywhere.'); } catch { prompt('Copy this:', msg); } }
      });
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js').then(() => {
        const qr = window.qrcode(0, 'L'); qr.addData(link); qr.make();
        $('.js-qr', f).innerHTML = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }) + '<div class="muted small">Screenshot or print this for door hangers and flyers.</div>';
      }).catch(() => { $('.js-qr', f).innerHTML = ''; });
    } });
}
const loadScript = src => new Promise((res, rej) => {
  if ([...document.scripts].some(x => x.src === src)) return res();
  const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = rej; document.head.append(el);
});
let inboxBusy = false;
async function checkInbox(manual = false) {
  if (inboxBusy) return 0;
  if (!serverHas('inbox') && !(relayOn() && db.settings.relayTopic)) { if (manual) toast('Nothing to check yet. Send a quote or agreement first.'); return 0; }
  inboxBusy = true;
  const notes = [];
  try {
    try { await checkRelay(notes); } catch { /* relay unreachable: try again next time */ }
    const r = serverHas('inbox') ? await payApi('/inbox') : { items: [] };
    const done = [];
    for (const it of r.items || []) {
      try {
        if (it.kind === 'sms') { const m = addInboundSms(it.from, it.body, it.at); if (m) notes.push(`New text from ${m.name}`); }
        else if (it.kind === 'response' && it.data) {
          const res = it.data.k === 'quote' ? await receiveQuote(it.data) : await receivePlanQuiet(it.data);
          if (res.ok) notes.push(res.msg); else if (!res.already) notes.push(res.msg);
        }
      } catch { /* one bad item shouldn't block the rest */ }
      done.push(it.key);
    }
    if (done.length && serverHas('inbox')) await payApi('/inbox/ack', { keys: done });
    db.settings.lastInboxCheck = Date.now(); save();
    if (notes.length) { render(); toast(notes.length === 1 ? notes[0] : `${notes[0]} · and ${notes.length - 1} more`); }
    else if (manual) toast('Nothing new');
  } catch (e) { if (manual) toast(e.message); }
  finally { inboxBusy = false; }
  return notes.length;
}
setInterval(() => { if (document.visibilityState === 'visible' && state.loaded) checkInbox(); }, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.loaded && !stripeOn()) checkInbox(); });
const BRAND_NAMES = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', interac: 'Interac Debit', jcb: 'JCB', diners: 'Diners Club', unionpay: 'UnionPay' };
const appBase = () => location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
const doneUrl = kind => `${appBase()}paid.html?t=${kind}&b=${encodeURIComponent(db.settings.businessName || '')}`;
const toCents = n => Math.round((+n || 0) * 100);
async function payApi(path, body) {
  const url = db.settings.stripeUrl.trim().replace(/\/+$/, '') + path;
  let res;
  try {
    res = await fetch(url, { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
      headers: { Authorization: `Bearer ${db.settings.stripeToken.trim()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) } });
  } catch { throw new Error('Could not reach your payment server. Check your internet connection and the server address in Settings → Plans & payments.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Payment server error (${res.status})`);
  return data;
}
async function ensureStripeCustomer(c) {
  if (c.stripeId) return c.stripeId;
  const r = await payApi('/customers', { name: c.name, email: c.email || undefined, phone: c.phone || undefined, appCustomerId: c.id });
  c.stripeId = r.id; save(); return r.id;
}
/** Pull the customer's saved cards from Stripe. Manual card references are kept. */
async function syncStripeCards(c) {
  if (!stripeOn() || !c?.stripeId) return 0;
  const r = await payApi(`/cards?customer=${encodeURIComponent(c.stripeId)}`);
  const old = c.cards || [], prevDefault = old.find(k => k.isDefault)?.pmId;
  const fromStripe = r.cards.map(x => ({ id: 'stripe_' + x.id, pmId: x.id, name: c.name, brand: BRAND_NAMES[x.brand] || (x.brand || 'Card'), last4: x.last4,
    exp: `${pad(x.exp_month)}/${String(x.exp_year).slice(-2)}`, processor: 'Stripe', wallet: x.wallet, addedAt: old.find(k => k.pmId === x.id)?.addedAt || today() }));
  c.cards = [...fromStripe, ...old.filter(k => !k.pmId)];
  c.cards.forEach(k => { k.isDefault = false; });
  const def = fromStripe.find(k => k.pmId === prevDefault) || fromStripe.find(k => k.pmId === r.defaultCard) || fromStripe[0] || c.cards[0];
  if (def) def.isDefault = true;
  c.cardsSyncedAt = Date.now(); save();
  return fromStripe.length;
}
const stripeCard = cid => { const cs = (cust(cid)?.cards || []).filter(k => k.pmId && cardState(k) !== 'expired'); return cs.find(k => k.isDefault) || cs[0]; };

/** Secure Stripe page where the customer types their card. */
async function stripeCardLink(c) {
  let link;
  try { await ensureStripeCustomer(c); link = (await payApi('/card-link', { customer: c.stripeId, currency: db.settings.currency, successUrl: doneUrl('card'), cancelUrl: doneUrl('cancel') })).url; }
  catch (e) { return alert(e.message); }
  c.cardLinkAt = Date.now(); save();
  const msg = `Hi ${firstName(c.name)}, please add your card for ${db.settings.businessName || 'us'} on this secure Stripe page: ${link}`;
  modal({ title: 'Save a card with Stripe', noFoot: true, body: `
    <p class="muted small" style="margin-top:0">${esc(c.name)} types their card on Stripe’s secure page. The full number goes straight to Stripe and never touches this app. Once they’re done, the card appears here automatically.</p>
    <div class="stack info-list" style="gap:8px">
      <a class="btn btn-primary" href="${esc(link)}" target="_blank" rel="noopener">${icon('expense')}Customer is here: enter the card on this device</a>
      ${c.phone ? `<a class="btn" href="${smsHref(c.phone, msg)}">${icon('sms')}Text the link to ${esc(c.phone)}</a>` : ''}
      ${c.email ? `<a class="btn" href="${mailHref(c.email, 'Add your card', msg)}">${icon('mail')}Email the link</a>` : ''}
      <button type="button" class="btn js-copy">${icon('share')}Copy link</button>
      <button type="button" class="btn js-refresh">${icon('repeat')}They’re done: refresh cards</button>
    </div>`,
    onMount: (f, close) => {
      $('.js-copy', f).addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch { prompt('Copy this link:', link); } });
      $('.js-refresh', f).addEventListener('click', async () => {
        try { const n = await syncStripeCards(c); close(); render(); toast(n ? 'Card saved ✓' : 'No card yet. Ask them to finish on the Stripe page.'); } catch (e) { alert(e.message); }
      });
    } });
}

/** Charge an invoice to a card saved in Stripe. */
function stripeChargeForm(inv) {
  const c = cust(inv.customerId), cards = (c.cards || []).filter(k => k.pmId && cardState(k) !== 'expired'), bal = balance(inv);
  modal({ title: `Charge ${esc(c.name)}`, submitLabel: `Charge ${money(bal)} now`, body: `
    <div class="form-grid">
      ${field('Card', `<select name="pm">${opts(cards.map(k => [k.pmId, `${cardLabel(k)} · exp ${k.exp}`]), stripeCard(c.id)?.pmId)}</select>`, 'full')}
      ${field('Amount', inp('amount', bal.toFixed(2), `type="number" step="0.01" min="0.50" max="${bal.toFixed(2)}" required`))}
      ${field('For', `<input value="Invoice ${esc(inv.number)}" disabled>`)}
    </div>
    <p class="muted small">The money goes to your Stripe account (${esc(db.settings.stripeStatus?.mode === 'live' ? 'live' : 'test mode')}) and Stripe pays it out to your bank. ${c.email ? `Stripe emails ${esc(c.email)} a receipt.` : ''}</p>
    <div class="js-err"></div>`,
    onMount: (f, close) => { f._close = close; f.amount.addEventListener('input', () => { $('button[type=submit]', f).textContent = `Charge ${money(+f.amount.value || 0)} now`; }); },
    onSubmit: (f, d) => {
      const btnEl = $('button[type=submit]', f), card = cards.find(k => k.pmId === d.pm);
      btnEl.disabled = true; btnEl.textContent = 'Charging…';
      chargeWithStripe(inv, card, +d.amount).then(r => {
        if (r.ok) { f._close(); refresh(); toast(balance(inv) <= 0 ? `Charged ${money(r.amount)} · paid in full 🎉` : `Charged ${money(r.amount)}`); return; }
        btnEl.disabled = false; btnEl.textContent = `Try again`;
        $('.js-err', f).innerHTML = `<div class="alert bad" style="margin-top:10px">${icon('alert')}<span><b>Not charged.</b> ${esc(r.error)}
          ${r.code === 'authentication_required' ? ' Their bank wants them to approve this payment.' : ''} You can send them a pay-online link instead.
          <button type="button" class="link-btn js-paylink">Send pay link</button></span></div>`;
        $('.js-paylink', f).addEventListener('click', () => { f._close(); sendPayLink(inv); });
      });
      return false;
    } });
}
async function chargeWithStripe(inv, card, amount) {
  const c = cust(inv.customerId);
  try {
    const r = await payApi('/charge', { customer: c.stripeId, paymentMethod: card.pmId, amount: round2(amount), currency: db.settings.currency,
      description: `Invoice ${inv.number} · ${db.settings.businessName || ''}`.trim(), invoice: inv.number, appInvoiceId: inv.id, receiptEmail: c.email || undefined,
      idempotencyKey: `${inv.id}-${(inv.payments || []).length}-${toCents(amount)}` });
    if (r.error) return { ok: false, error: r.error, code: r.code };
    (inv.payments ||= []).push({ id: uid(), amount: round2(r.amount), date: today(), method: `Card (Stripe) ${cardLabel(card)}`, note: r.id, stripePi: r.id, receiptUrl: r.receiptUrl });
    inv.sent = true; inv.sentAt ||= today(); save();
    return { ok: true, amount: r.amount };
  } catch (e) { return { ok: false, error: e.message }; }
}

/** Stripe-hosted "pay this invoice" link. */
async function ensurePayLink(inv) {
  const bal = balance(inv);
  if (inv.checkout?.url && Math.abs(inv.checkout.amount - bal) < 0.005 && Date.now() - inv.checkout.at < 20 * 3600e3) return inv.checkout.url;
  const c = cust(inv.customerId);
  if (c) await ensureStripeCustomer(c);
  const r = await payApi('/pay-link', { amount: bal, currency: db.settings.currency, description: `Invoice ${inv.number} · ${db.settings.businessName || ''}`.trim(),
    customer: c?.stripeId, email: c?.email, invoice: inv.number, appInvoiceId: inv.id, saveCard: !!db.settings.saveCardOnPay, successUrl: doneUrl('pay'), cancelUrl: doneUrl('cancel') });
  inv.checkout = { id: r.id, url: r.url, amount: bal, at: Date.now() }; save();
  return r.url;
}
async function sendPayLink(inv) {
  const c = cust(inv.customerId) || {};
  let url;
  try { url = await ensurePayLink(inv); } catch (e) { return alert(e.message); }
  const msg = docMessage('invoice', inv, 'send', url);
  modal({ title: `Pay-online link · ${inv.number}`, noFoot: true, body: `
    <p class="muted small" style="margin-top:0">${esc(c.name || 'Your customer')} pays ${money(balance(inv))} on Stripe’s secure page by card, Apple Pay or Google Pay. The invoice is marked paid when you open it again.</p>
    <div class="stack info-list" style="gap:8px">
      ${c.phone ? `<a class="btn btn-primary js-sent" href="${smsHref(c.phone, msg)}">${icon('sms')}Text to ${esc(c.phone)}</a>` : ''}
      ${c.email ? `<a class="btn ${c.phone ? '' : 'btn-primary'} js-sent" href="${mailHref(c.email, `Invoice ${inv.number} from ${db.settings.businessName || ''}`, msg)}">${icon('mail')}Email to ${esc(c.email)}</a>` : ''}
      <button type="button" class="btn js-copy">${icon('share')}Copy link</button>
      <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open payment page ↗</a>
    </div>`,
    onMount: (f, close) => {
      $$('.js-sent', f).forEach(a => a.addEventListener('click', () => { inv.sent = true; inv.sentAt ||= today(); save(); setTimeout(() => { close(); render(); }, 200); }));
      $('.js-copy', f).addEventListener('click', async () => { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link:', url); } });
    } });
}
/** Has the customer paid through the link? Records the payment if so. */
async function checkPayLink(inv, quiet) {
  if (!stripeOn() || !inv.checkout?.id || inv.checkout.paid) return false;
  try {
    const r = await payApi(`/session?id=${encodeURIComponent(inv.checkout.id)}`);
    if (r.paymentStatus !== 'paid') { if (!quiet) toast('Not paid yet'); return false; }
    if (!(inv.payments || []).some(p => p.stripePi && p.stripePi === r.paymentIntent)) {
      (inv.payments ||= []).push({ id: uid(), amount: round2(r.amount), date: today(), method: 'Online (Stripe)', note: r.paymentIntent, stripePi: r.paymentIntent, receiptUrl: r.receiptUrl });
    }
    inv.checkout.paid = true;
    const c = cust(inv.customerId);
    if (c && r.customer && !c.stripeId) c.stripeId = r.customer;
    save();
    if (c && db.settings.saveCardOnPay) syncStripeCards(c).catch(() => {});
    return true;
  } catch (e) { if (!quiet) alert(e.message); return false; }
}
const refundLeft = (inv, p) => round2(p.amount + sum((inv.payments || []).filter(x => x.refundOf === p.id), x => x.amount));
async function refundPayment(inv, p) {
  const left = refundLeft(inv, p);
  const amt = prompt(`Refund how much? Up to ${money(left)} can be refunded.`, left.toFixed(2));
  if (amt === null) return;
  const n = round2(amt);
  if (!(n > 0 && n <= left)) return alert(`Enter an amount up to ${money(left)}.`);
  if (!confirm(`Refund ${money(n)} to the customer’s card through Stripe?`)) return;
  try {
    const r = await payApi('/refund', { paymentIntent: p.stripePi, amount: n, idempotencyKey: `refund-${p.id}-${toCents(n)}` });
    inv.payments.push({ id: uid(), amount: -n, date: today(), method: 'Refund (Stripe)', note: r.id, refundOf: p.id });
    refresh(); toast(`Refunded ${money(n)}`);
  } catch (e) { alert(e.message); }
}
/** When a plan visit is completed: invoice it and charge the card on file (if turned on in Settings). */
async function autoChargeVisit(j) {
  const p = byId('subscriptions', j.planId);
  if (!db.settings.autoChargePlans || !stripeOn() || !p || p.billing !== 'per_visit' || j.invoiceId) return;
  const card = stripeCard(j.customerId); if (!card) { toast('Visit done. No Stripe card on file to charge.'); return; }
  const inv = invoiceFromItems(j, { jobId: j.id, planId: p.id, sent: true, sentAt: today(), notes: `Service plan ${p.number} · visit ${fmtDate(j.date)}` });
  j.invoiceId = inv.id; save();
  const r = await chargeWithStripe(inv, card, balance(inv));
  render();
  toast(r.ok ? `Visit invoiced and ${money(r.amount)} charged to ${cardLabel(card)}` : `Invoice ${inv.number} created, but the charge failed: ${r.error}`);
}
/* Repository the "Deploy to Cloudflare" button copies the server from (stripe-worker folder). */
const SERVER_REPO = 'https://github.com/OnelYonan/1st-github-project/tree/claude/zealous-lovelace-h3cu2y/stripe-worker';
const SETUP_DOC = 'https://github.com/OnelYonan/1st-github-project/blob/claude/zealous-lovelace-h3cu2y/STRIPE-SETUP.md';
const newToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** Guided Stripe setup: key → one-click server → paste address → connected. */
function connectStripeWizard() {
  const s = db.settings;
  if (!s.stripeToken) { s.stripeToken = newToken(); save(); }
  const copyBtn = (val, label) => `<button type="button" class="btn btn-sm js-wcopy" data-v="${esc(val)}">${icon('share')}${label}</button>`;
  modal({ title: 'Connect Stripe', wide: true, submitLabel: 'Connect', focus: false, body: `
    <p class="muted small" style="margin-top:0">Stripe holds the money and pays it to your bank. A small free server (on Cloudflare) keeps your Stripe key private. It also lets customers approve quotes straight into this app, and can send texts. You set it up once.</p>
    <ol class="wizard">
      <li><div class="wz-h">Get your Stripe secret key</div>
        <div class="muted small">Sign up or log in, stay in <b>Test mode</b> for now, and copy the <b>Secret key</b> (starts with <code>sk_test_</code>). Don’t paste it here: it goes into Cloudflare in step 3.</div>
        <div class="row"><a class="btn btn-sm" href="https://dashboard.stripe.com/register" target="_blank" rel="noopener">Create Stripe account ↗</a><a class="btn btn-sm" href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener">Open my API keys ↗</a></div></li>
      <li><div class="wz-h">Copy your app token</div>
        <div class="muted small">A private password that lets only this app use your server.</div>
        <div class="row" style="flex-wrap:nowrap"><input readonly class="mono" value="${esc(s.stripeToken)}" onfocus="this.select()" aria-label="App token">${copyBtn(s.stripeToken, 'Copy')}</div></li>
      <li><div class="wz-h">Create your server in one tap</div>
        <div class="muted small">Tap the button and sign in to Cloudflare and GitHub (both free). When it asks:
          <b>STRIPE_SECRET_KEY</b> → paste your Stripe key · <b>APP_TOKEN</b> → paste the app token · leave everything else. Tap <b>Create and deploy</b>.</div>
        <div class="row"><a class="btn btn-primary btn-sm" href="https://deploy.workers.cloudflare.com/?url=${encodeURIComponent(SERVER_REPO)}" target="_blank" rel="noopener">${icon('share')}Deploy to Cloudflare ↗</a>
          <a class="btn btn-sm" href="${SETUP_DOC}#step-2-payment-server-cloudflare-worker" target="_blank" rel="noopener">Set it up by hand instead ↗</a></div></li>
      <li><div class="wz-h">Paste your server’s address</div>
        <div class="muted small">When it finishes, Cloudflare shows an address like <code>https://business-hub-server.yourname.workers.dev</code>. Copy it here.</div>
        <input name="url" type="url" placeholder="https://business-hub-server.yourname.workers.dev" value="${esc(s.stripeUrl)}" required></li>
    </ol>
    <div class="js-wz-status"></div>`,
    onMount: f => $$('.js-wcopy', f).forEach(b => b.addEventListener('click', () => navigator.clipboard?.writeText(b.dataset.v).then(() => toast('Copied'), () => prompt('Copy this:', b.dataset.v)))),
    onSubmit: (f, d) => {
      const url = d.url.trim().replace(/\/+$/, '');
      if (!/^https:\/\//i.test(url) && !/^http:\/\/localhost/.test(url)) { toast('Paste the full address, starting with https://'); return false; }
      s.stripeUrl = url; s.stripeStatus = null; save(); render(); // keep the Settings page behind in step
      const st = $('.js-wz-status', f); st.innerHTML = '<div class="alert info">Checking your server…</div>';
      payApi('/health').then(r => {
        s.stripeStatus = { ...r, at: Date.now() }; if (r.features?.stripe !== false) s.processor = 'Stripe'; save();
        f.closest('.modal-backdrop')?.remove(); render();
        toast(r.mode ? `Connected to Stripe${r.mode === 'test' ? ' (test mode)' : ''} ✓` : 'Server connected ✓');
      }).catch(e => {
        st.innerHTML = `<div class="alert bad">${icon('alert')}<span>${esc(e.message)}${/token/i.test(e.message) ? ' Make sure APP_TOKEN in Cloudflare is exactly the token in step 2.' : ''}</span></div>`;
      });
      return false;
    } });
}
async function testStripe() {
  const st = $('.js-stripe-status');
  if (st) st.innerHTML = '<span class="muted">Checking…</span>';
  try {
    const r = await payApi('/health');
    db.settings.stripeStatus = { ...r, at: Date.now() }; db.settings.processor = 'Stripe'; save();
    toast(`Connected to Stripe${r.mode === 'test' ? ' (test mode)' : ''}`); render();
  } catch (e) { db.settings.stripeStatus = null; save(); if (st) st.innerHTML = `<span style="color:var(--bad)">${esc(e.message)}</span>`; }
}
// When you come back to the app (e.g. after the customer finished on Stripe), refresh what's on screen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !stripeOn() || !state.loaded) return;
  checkInbox();
  const [, name, id] = location.hash.split('/');
  if (name === 'customers' && id) { const c = cust(id); if (c?.stripeId) syncStripeCards(c).then(n => n && render()).catch(() => {}); }
  if (name === 'invoices' && id) { const inv = byId('invoices', id); if (inv) checkPayLink(inv, true).then(paid => paid && (render(), toast('Paid online ✓'))); }
});

/* =====================================================================
 * Commissions: cleaner % per job, sales rep % per sale
 * ===================================================================== */
/** Default % for a person: their own setting, else the business default (owners get 0). */
function pctFor(name, kind) {
  if (!name) return 0;
  const m = memberByName(name), own = kind === 'cleaner' ? m?.cleanerPct : m?.salesPct;
  if (own !== undefined && own !== null && own !== '') return +own;
  if (m?.role === 'Owner') return 0;
  return +(kind === 'cleaner' ? db.settings.cleanerPct : db.settings.salesPct) || 0;
}
/** Commission base is the job's price before tax (after any discount). */
const jobBase = j => { const inv = j.invoiceId && byId('invoices', j.invoiceId); const t = totals(inv || j); return round2(t.sub - t.disc); };
function jobPay(j, base = jobBase(j)) {
  const cPct = j.assignedTo ? (j.cleanerPct ?? pctFor(j.assignedTo, 'cleaner')) : 0;
  const sPct = j.salesRep ? (j.salesPct ?? pctFor(j.salesRep, 'sales')) : 0;
  const cleaner = round2(base * cPct / 100), sales = round2(base * sPct / 100);
  return { base, cPct: +cPct, sPct: +sPct, cleaner, sales, keep: round2(base - cleaner - sales) };
}
/** Commissions earned on completed jobs in a date range, not yet paid out. */
function commissionsOwed(from, to) {
  let n = 0;
  for (const j of db.jobs) {
    if (j.status !== 'completed' || !inRange(j.completedAt || j.date, from, to)) continue;
    const p = jobPay(j);
    if (!j.cleanerPaid) n += p.cleaner;
    if (!j.salesPaid) n += p.sales;
  }
  return round2(n);
}
function memberSelect(name, value, emptyLabel) {
  const names = db.team.map(m => m.name);
  if (!names.length) return inp(name, value, `placeholder="Name" list="teamList2"`) + `<datalist id="teamList2">${teamMembers().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
  const extra = value && !names.includes(value) ? [value] : [];
  return `<select name="${name}">${opts([['', emptyLabel], ...[...names, ...extra].map(n => [n, n])], value || '')}</select>`;
}
/** "Pay & commission" block for the job form, with a live breakdown. */
function payFieldsHTML(j) {
  return `<div class="form-section"><h3>Pay &amp; commission</h3><div class="form-grid">
    ${field('Cleaner commission %', `<div class="pct-input">${inp('cleanerPct', j.cleanerPct ?? pctFor(j.assignedTo, 'cleaner'), 'type="number" min="0" max="100" step="0.5" inputmode="decimal"')}<span>%</span></div>`)}
    <div></div>
    ${field('Sold by (sales rep)', memberSelect('salesRep', j.salesRep, 'No sales rep'))}
    ${field('Sales commission %', `<div class="pct-input">${inp('salesPct', j.salesPct ?? pctFor(j.salesRep, 'sales'), 'type="number" min="0" max="100" step="0.5" inputmode="decimal"')}<span>%</span></div>`)}
  </div><div class="pay-sum js-pay-sum"></div></div>`;
}
function bindPayFields(f, getItems) {
  const touched = { cleanerPct: false, salesPct: false };
  const sum = $('.js-pay-sum', f);
  const draw = () => {
    const t = totals({ items: getItems(), discount: f.discount?.value, taxRate: f.taxRate?.value }), base = round2(t.sub - t.disc);
    const p = jobPay({ assignedTo: f.assignedTo.value, salesRep: f.salesRep.value, cleanerPct: +f.cleanerPct.value || 0, salesPct: +f.salesPct.value || 0 }, base);
    sum.innerHTML = base ? `<div class="pay-row"><span>Job price (before tax)</span><b>${money(base)}</b></div>
      ${f.assignedTo.value ? `<div class="pay-row"><span>${esc(f.assignedTo.value)} (cleaner, ${p.cPct}%)</span><b>−${money(p.cleaner)}</b></div>` : '<div class="pay-row muted"><span>No cleaner assigned</span><span></span></div>'}
      ${f.salesRep.value ? `<div class="pay-row"><span>${esc(f.salesRep.value)} (sales, ${p.sPct}%)</span><b>−${money(p.sales)}</b></div>` : ''}
      <div class="pay-row keep"><span>You keep</span><b>${money(p.keep)}</b></div>` : '<p class="muted small" style="margin:0">Enter a price to see everyone’s cut.</p>';
  };
  f.cleanerPct.addEventListener('input', () => { touched.cleanerPct = true; });
  f.salesPct.addEventListener('input', () => { touched.salesPct = true; });
  f.assignedTo.addEventListener('change', () => { if (!touched.cleanerPct) f.cleanerPct.value = pctFor(f.assignedTo.value, 'cleaner'); draw(); });
  f.salesRep.addEventListener('change', () => { if (!touched.salesPct) f.salesPct.value = pctFor(f.salesRep.value, 'sales'); draw(); });
  f.addEventListener('input', draw); f.addEventListener('click', () => setTimeout(draw));
  draw();
}
/** Sales rep for a new job: the customer's rep, on their first job (or every job if set). */
function defaultSalesRep(customerId) {
  const c = cust(customerId); if (!c?.salesRep) return '';
  if (db.settings.salesScope === 'every') return c.salesRep;
  return db.jobs.some(j => j.customerId === customerId && j.salesRep) ? '' : c.salesRep;
}

/* ---------- Commissions tab (Team & time) ---------- */
const PAY_PERIODS = { this_week: 'This week', last_week: 'Last week', this_month: 'This month', last_month: 'Last month' };
function payRange(key) {
  const ws = addDays(today(), -parseD(today()).getDay());
  if (key === 'this_week') return [ws, addDays(ws, 6)];
  if (key === 'last_week') return [addDays(ws, -7), addDays(ws, -1)];
  return periodRange(key);
}
function commissionsHTML(tabs) {
  const per = filt('team', 'payPeriod', 'this_week'), [from, to] = payRange(per);
  const jobs = db.jobs.filter(j => j.status === 'completed' && inRange(j.completedAt || j.date, from, to)).sort((a, b) => (a.completedAt || a.date).localeCompare(b.completedAt || b.date));
  const people = new Map();
  const row = n => { if (!people.has(n)) people.set(n, { name: n, jobs: 0, clean: 0, sold: 0, sales: 0, owed: 0, paid: 0 }); return people.get(n); };
  for (const j of jobs) {
    const p = jobPay(j);
    if (j.assignedTo && p.cleaner) { const r = row(j.assignedTo); r.jobs++; r.clean += p.cleaner; r[j.cleanerPaid ? 'paid' : 'owed'] += p.cleaner; }
    if (j.salesRep && p.sales) { const r = row(j.salesRep); r.sold++; r.sales += p.sales; r[j.salesPaid ? 'paid' : 'owed'] += p.sales; }
  }
  const hourly = m => round2(sum(db.timeEntries.filter(t => t.memberId === m.id && t.out && inRange(localDate(t.in), from, to)), hoursOf) * (+m.rate || 0));
  db.team.forEach(m => { const h = hourly(m); if (h) row(m.name).hourly = h; });
  const rows = [...people.values()].sort((a, b) => b.owed + b.paid - a.owed - a.paid);
  const totalKeep = sum(jobs, j => jobPay(j).keep), totalBase = sum(jobs, j => jobPay(j).base);
  return head('Team & time', btn('Commission rates', 'payDefaults', '', '', 'settings'), 'What everyone earned, and what you keep.') + `<div class="card">${tabs}
    <div class="toolbar"><select data-filter="team:payPeriod" style="width:auto" aria-label="Period">${opts(Object.entries(PAY_PERIODS), per)}</select>
      <span class="muted small">${fmtDateShort(from)} – ${fmtDateShort(to)} · ${jobs.length} completed job${jobs.length === 1 ? '' : 's'}</span></div>
    <div class="grid grid-3 pay-tiles" style="gap:10px;margin-bottom:14px">
      <div class="knock-tile"><div><div class="muted small">Jobs (before tax)</div><div class="value">${money(totalBase)}</div></div></div>
      <div class="knock-tile"><div><div class="muted small">Commissions</div><div class="value">${money(sum(rows, r => r.clean + r.sales))}</div><div class="muted small">${money(sum(rows, r => r.owed))} still to pay</div></div></div>
      <div class="knock-tile"><div><div class="muted small">You keep</div><div class="value" style="color:var(--good)">${money(totalKeep)}</div><div class="muted small">before expenses</div></div></div>
    </div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Person</th><th class="num">Cleaning</th><th class="num">Sales</th><th class="num">Hourly</th><th class="num">Owed</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${esc(r.name)}</b><div class="muted small">${r.jobs ? `${r.jobs} job${r.jobs > 1 ? 's' : ''} cleaned` : ''}${r.jobs && r.sold ? ' · ' : ''}${r.sold ? `${r.sold} sold` : ''}</div></td>
        <td class="num">${r.clean ? money(r.clean) : '—'}</td><td class="num">${r.sales ? money(r.sales) : '—'}</td><td class="num">${r.hourly ? money(r.hourly) : '—'}</td>
        <td class="num"><b>${money(r.owed)}</b>${r.paid ? `<div class="muted small">${money(r.paid)} paid</div>` : ''}</td>
        <td>${r.owed ? btn('Mark paid', 'payCommission', 'btn-sm', `data-name="${esc(r.name)}"`) : '<span class="badge good">Paid</span>'}</td></tr>`).join('')}
    </tbody></table></div>` : empty('expense', 'No commissions for this period. Assign a cleaner and sales rep on your jobs to see pay here.')}
    ${jobs.length ? `<h3 class="group-label" style="margin-top:16px">Jobs</h3>${jobs.map(j => { const p = jobPay(j); return `<a class="list-item" href="#/jobs/${j.id}" style="color:inherit">
      <div class="grow"><div class="title">${esc(j.title)} <span class="muted small">· ${esc(custName(j.customerId))}</span></div>
      <div class="muted small">${fmtDateShort(j.completedAt || j.date)} · ${money(p.base)}${j.assignedTo ? ` · ${esc(j.assignedTo)} ${money(p.cleaner)}${j.cleanerPaid ? ' ✓' : ''}` : ''}${j.salesRep ? ` · ${esc(j.salesRep)} ${money(p.sales)}${j.salesPaid ? ' ✓' : ''}` : ''}</div></div>
      <div class="right"><b class="num">${money(p.keep)}</b><div class="muted small">you keep</div></div></a>`; }).join('')}` : ''}
  </div>`;
}
function payDefaultsForm() {
  const s = db.settings;
  modal({ title: 'Commission rates', body: `<div class="form-grid">
    ${field('Default cleaner commission %', `<div class="pct-input">${inp('cleanerPct', s.cleanerPct, 'type="number" min="0" max="100" step="0.5"')}<span>%</span></div>`)}
    ${field('Default sales commission %', `<div class="pct-input">${inp('salesPct', s.salesPct, 'type="number" min="0" max="100" step="0.5"')}<span>%</span></div>`)}
    ${field('Sales reps earn commission on', `<select name="salesScope">${opts([['first', 'The first job for a customer they sold'], ['every', 'Every job for customers they sold']], s.salesScope)}</select>`, 'full')}
  </div><p class="muted small">You can set a different rate for any person in Team &amp; time (tap their card), and change it on any single job.</p>`,
    onSubmit: (f, d) => { Object.assign(s, { cleanerPct: +d.cleanerPct || 0, salesPct: +d.salesPct || 0, salesScope: d.salesScope }); refresh(); toast('Commission rates saved'); } });
}
function payCommission(name) {
  const per = filt('team', 'payPeriod', 'this_week'), [from, to] = payRange(per);
  const jobs = db.jobs.filter(j => j.status === 'completed' && inRange(j.completedAt || j.date, from, to));
  let amount = 0; const cl = [], sl = [];
  for (const j of jobs) {
    const p = jobPay(j);
    if (j.assignedTo === name && !j.cleanerPaid && p.cleaner) { amount += p.cleaner; cl.push(j); }
    if (j.salesRep === name && !j.salesPaid && p.sales) { amount += p.sales; sl.push(j); }
  }
  amount = round2(amount);
  if (!amount || !confirm(`Mark ${money(amount)} as paid to ${name}? It’s added to your expenses under Wages & Payroll.`)) return;
  cl.forEach(j => { j.cleanerPaid = today(); }); sl.forEach(j => { j.salesPaid = today(); });
  db.expenses.push({ id: uid(), date: today(), amount, vendor: name, category: db.categories.includes('Wages & Payroll') ? 'Wages & Payroll' : db.categories[0], method: 'e-Transfer', tax: 0,
    notes: `Commission ${PAY_PERIODS[per].toLowerCase()} (${cl.length} cleaned, ${sl.length} sold)`, isCommission: true });
  refresh(); toast(`${money(amount)} paid to ${name}`);
}

/* ---------- Customers ---------- */
VIEWS.customers = id => {
  if (id) return customerDetail(id);
  const q = filt('customers', 'q', '').toLowerCase(), sort = filt('customers', 'sort', 'name');
  const stats = Object.fromEntries(db.customers.map(c => [c.id, custStats(c.id)]));
  const list = db.customers.filter(c => !q || `${c.name} ${c.email} ${c.phone} ${c.address} ${c.tags}`.toLowerCase().includes(q))
    .sort(sort === 'revenue' ? (a, b) => stats[b.id].paid - stats[a.id].paid : sort === 'owing' ? (a, b) => stats[b.id].owing - stats[a.id].owing
      : sort === 'recent' ? (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') : (a, b) => a.name.localeCompare(b.name));
  const pg = paged(list, 'customers');
  return head('Customers', btn('Import CSV', 'importCustomers', '', '', 'download') + btn('New customer', 'newCustomer', 'btn-primary', '', 'plus'), `${db.customers.length} total`) + `<div class="card">
    <div class="toolbar"><input type="search" placeholder="Search name, phone, email, address…" value="${esc(q)}" data-filter="customers:q">
      <select data-filter="customers:sort" style="width:auto" aria-label="Sort">${opts([['name', 'Sort: Name'], ['recent', 'Sort: Newest'], ['revenue', 'Sort: Top revenue'], ['owing', 'Sort: Owing']], sort)}</select></div>
    ${list.length ? `<div class="show-sm">${pg.rows.map(c => { const s = stats[c.id]; return `<a class="list-item" style="color:inherit" href="#/customers/${c.id}"><div class="grow">
      <div class="title">${esc(c.name)}</div><div class="muted small">${esc(c.phone || c.email || c.address || '')}</div></div>
      <div class="right">${s.owing > 0 ? `<div class="num" style="color:var(--bad)">${money(s.owing)}</div><div class="muted small">owing</div>` : `<div class="num muted">${money(s.paid)}</div>`}</div></a>`; }).join('')}</div>
    <div class="table-wrap hide-sm"><table><thead><tr><th>Name</th><th class="hide-sm">Phone</th><th class="hide-sm">Email</th><th class="num">Lifetime</th><th class="num">Owing</th></tr></thead><tbody>
    ${pg.rows.map(c => { const s = stats[c.id]; return `<tr class="clickable" data-href="#/customers/${c.id}"><td><b>${esc(c.name)}</b><div class="muted small">${esc(c.address || '')}</div></td>
      <td class="hide-sm">${esc(c.phone || '')}</td><td class="hide-sm">${esc(c.email || '')}</td><td class="num">${money(s.paid)}</td>
      <td class="num" style="color:${s.owing > 0 ? 'var(--bad)' : 'inherit'}">${s.owing > 0 ? money(s.owing) : '—'}</td></tr>`; }).join('')}
    </tbody></table></div>${pg.more}` : empty('users', q ? 'No matches.' : 'No customers yet.', q ? '' : btn('Add your first customer', 'newCustomer', 'btn-sm'))}</div>`;
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
  const plans = db.subscriptions.filter(p => p.customerId === id).reverse();
  const lists = {
    activity: activityHTML(c),
    jobs: jobs.length ? jobs.map(jobListItem).join('') : empty('jobs', 'No jobs yet.'),
    quotes: quotes.length ? quotes.map(q => `<a class="list-item" style="color:inherit" href="#/quotes/${q.id}"><div class="grow"><div class="title">${esc(q.number)}</div><div class="muted small">${fmtDate(q.date)}</div></div><span class="num">${money(totals(q).total)}</span>${badge(quoteStatus(q))}</a>`).join('') : empty('quote', 'No quotes yet.'),
    invoices: invs.length ? invs.map(i => `<a class="list-item" style="color:inherit" href="#/invoices/${i.id}"><div class="grow"><div class="title">${esc(i.number)}</div><div class="muted small">${fmtDate(i.date)}</div></div><span class="num">${money(totals(i).total)}</span>${badge(invStatus(i))}</a>`).join('') : empty('invoice', 'No invoices yet.'),
    tasks: quickTaskForm(id) + (tasks.length ? tasks.map(taskRow).join('') : '<p class="muted small">No to-dos for this customer.</p>'),
    plans: plans.length ? plans.map(p => `<a class="list-item" style="color:inherit" href="#/plans/${p.id}"><div class="grow"><div class="title">${esc(p.name)}</div><div class="muted small">${esc(p.number)} · ${esc(planPriceLabel(p))}</div></div>${badge(planStatus(p))}</a>`).join('')
      : empty('repeat', 'No service plans yet.', btn('New service plan', 'newPlan', 'btn-sm', `data-cust="${id}"`)),
  };
  return head(esc(c.name), btn('Job', 'newJob', '', `data-cust="${id}"`, 'plus') + btn('Quote', 'newQuote', 'btn-primary', `data-cust="${id}"`, 'plus') +
    moreMenu([menuItem('Edit customer', 'editCustomer', `data-id="${id}"`, 'edit'), menuItem('New invoice', 'newInvoice', `data-cust="${id}"`, 'invoice'),
      menuItem('Add to-do', 'newTask', `data-cust="${id}"`, 'todo'), menuItem('New service plan', 'newPlan', `data-cust="${id}"`, 'repeat'),
      menuItem('Add card on file', 'newCard', `data-id="${id}"`, 'expense'), s.owing && menuLink('Print statement', `#/statement/${id}`, 'statement'),
      menuLink('Messages', `#/messages/${id}`, 'sms'),
      menuItem('Delete customer', 'deleteCustomer', `data-id="${id}"`, 'trash', 'danger')]), '<a class="crumb" href="#/customers">← All customers</a>') + `
  <div class="grid grid-3">
    <div class="card"><h2 style="margin-bottom:8px">Contact</h2>
      <div class="stack" style="gap:6px">${c.phone ? `<div>${esc(c.phone)}</div>` : ''}${c.email ? `<div>${esc(c.email)}</div>` : ''}${c.address ? `<div>${esc(c.address)}</div>` : ''}
      ${c.tags || c.source ? `<div>${[c.source, ...(c.tags || '').split(',')].map(x => (x || '').trim()).filter(Boolean).map(x => `<span class="badge">${esc(x)}</span>`).join(' ')}</div>` : ''}
      ${c.notes ? `<div class="muted small" style="white-space:pre-wrap">${esc(c.notes)}</div>` : ''}
      ${!c.phone && !c.email && !c.address ? '<p class="muted small">No contact details yet.</p>' : ''}</div>
      <div class="row" style="margin-top:12px">${contactBtns(c)}</div>
      <h3 class="group-label" id="cards" style="margin-top:16px">Cards on file</h3>${cardsHTML(c)}</div>
    <div class="card stat"><div class="label">Lifetime revenue</div><div class="value">${money(s.paid)}</div>
      <div class="sub">${jobs.filter(j => j.status === 'completed').length} completed jobs${nextJob ? ` · next visit ${fmtDateShort(nextJob.date)}` : ''}</div></div>
    <div class="card stat"><div class="label">Currently owing</div><div class="value" style="color:${s.owing ? 'var(--bad)' : 'inherit'}">${money(s.owing)}</div>
      <div class="sub">Customer since ${fmtDate(c.createdAt)}</div>
      ${s.owing ? `<a class="btn btn-sm" style="margin-top:10px" href="#/statement/${id}">${icon('statement')}Statement</a>` : ''}</div>
  </div>
  <div class="card">${tabsHTML('customer', 'tab', [['activity', 'Activity'], ['jobs', `Jobs (${jobs.length})`], ['quotes', `Quotes (${quotes.length})`], ['plans', `Plans (${plans.length})`], ['invoices', `Invoices (${invs.length})`], ['tasks', `To-dos (${tasks.filter(x => !x.done).length})`]], tab)}${lists[tab]}</div>
`;
}

VIEWS.customers.mount = id => {
  const c = id && cust(id);
  if (c?.stripeId && stripeOn() && (!c.cardsSyncedAt || Date.now() - c.cardsSyncedAt > 60000))
    syncStripeCards(c).then(() => { if (location.hash === '#/customers/' + id) render(); }).catch(() => {});
};
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
    ${safeUrl(s.paymentLink) ? `<div style="margin-top:6px">Pay online: <a href="${esc(safeUrl(s.paymentLink))}" target="_blank" rel="noopener">${esc(s.paymentLink)}</a></div>` : ''}</div>`;
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
function docTable(all, route, statusFn, extraFn) {
  const isInv = route === 'invoices', pg = paged(all, route), list = pg.rows;
  const type = isInv ? 'invoice' : 'quote';
  return `<div class="show-sm">${list.map(x => `<a class="list-item" style="color:inherit" href="#/${route}/${x.id}" ${swipeAttr(x.id, [['editDoc', 'Edit', '#8e8e93', { type }], ['deleteDoc', 'Delete', '#ff3b30', { type }]])}><div class="grow">
      <div class="title">${esc(custName(x.customerId))}</div><div class="muted small">${esc(x.number)} · ${extraFn(x) || fmtDate(x.date)}</div></div>
      <div class="right"><div class="num">${money(isInv && balance(x) > 0 ? balance(x) : totals(x).total)}</div>${badge(statusFn(x))}</div></a>`).join('')}</div>
    <div class="table-wrap hide-sm"><table><thead><tr><th>Number</th><th>Customer</th><th class="hide-sm">Date</th><th>Status</th><th class="num">Total</th>${route === 'invoices' ? '<th class="num">Balance</th>' : ''}</tr></thead><tbody>
    ${list.map(x => `<tr class="clickable" data-href="#/${route}/${x.id}"><td><b>${esc(x.number)}</b></td><td>${esc(custName(x.customerId))}</td>
    <td class="hide-sm">${fmtDate(x.date)}<div class="muted small">${extraFn(x)}</div></td><td>${badge(statusFn(x))}</td><td class="num">${money(totals(x).total)}</td>
    ${route === 'invoices' ? `<td class="num">${balance(x) > 0 ? money(balance(x)) : '—'}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>${pg.more}`;
}

/* ---------- Invoices ---------- */
const invoicesView = id => {
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

VIEWS.invoices = invoicesView;
VIEWS.invoices.mount = id => {
  const inv = id && byId('invoices', id);
  if (inv?.checkout && !inv.checkout.paid && stripeOn()) checkPayLink(inv, true).then(paid => { if (paid && location.hash === '#/invoices/' + id) { render(); toast('Paid online ✓'); } });
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
      ${(d.items || []).map(it => `<tr class="${it.optional && !it.on ? 'opt-off' : ''}"><td>${esc(it.desc)}${it.details ? `<div style="color:#666;font-size:12px;white-space:pre-line">${esc(it.details)}</div>` : ''}${it.optional ? `<div class="opt-tag">${it.on ? '✓ Optional extra · added' : 'Optional extra · not included'}</div>` : ''}</td><td class="num">${+it.qty}</td><td class="num">${money(it.price)}</td><td class="num">${money(it.qty * it.price)}</td></tr>`).join('')}
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
    ${!isInv && (d.terms ?? s.quoteTerms) ? `<div class="notes"><b>Terms</b>\n${esc(d.terms ?? s.quoteTerms)}</div>` : ''}
    ${!isInv ? (d.signature ? `<div class="sig-block">${BH.sigSVG(d.signature.strokes || [])}<div class="sig-line">Approved online by ${esc(d.signature.name)} · ${esc(new Date(d.signature.at).toLocaleString())}</div></div>`
      : `<div class="notes" style="margin-top:40px;display:flex;gap:40px;flex-wrap:wrap"><div>Accepted by: ________________________</div><div>Date: ______________</div></div>`) : ''}
  </div>`;
}
function docMessage(type, d, kind = 'send', payUrl = '') {
  const c = cust(d.customerId), t = totals(d);
  const items = (d.items || []).map(it => `• ${it.desc}: ${money(it.qty * it.price)}`).join('\n');
  const vars = { ...custVars(c), number: d.number, total: money(t.total), balance: money(balance(d)), due: d.dueDate ? fmtDate(d.dueDate) : 'on receipt',
    valid: d.validUntil ? fmtDate(d.validUntil) : '30 days', items };
  if (type === 'invoice') {
    if (payUrl) vars.pay = [`Pay securely online: ${payUrl}`, db.settings.paymentInstructions].filter(Boolean).join('\n');
    return fillTemplate(kind === 'reminder' ? 'tplReminder' : 'tplInvoice', vars);
  }
  const key = kind === 'followup' ? 'tplQuoteFollow' : 'tplQuote';
  vars.link = payUrl;
  const msg = fillTemplate(key, vars);
  // older saved wording has no {link}: add it so the customer can always approve online
  return payUrl && !msg.includes(payUrl) ? `${msg}\n\nView it and approve online: ${payUrl}` : msg;
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
    ? (status === 'void' ? '' : (status !== 'paid' && defaultCard(d.customerId) ? a(`Charge ${esc(cardLabel(defaultCard(d.customerId)).replace(/^.* (••••)/, '$1'))}`, 'chargeCard', 'btn-primary', 'expense') : '') +
      (status !== 'paid' ? a('Record payment', 'recordPayment', defaultCard(d.customerId) ? '' : 'btn-primary', 'check') : '') +
      (status === 'overdue' || status === 'partial' ? remind : status === 'paid' ? '' : send) + a('Print / PDF', 'docPrint', '', 'print'))
    : (['draft', 'sent', 'expired'].includes(status) ? a('Approve', 'quoteApprove', 'btn-primary', 'check') : '') +
      (status === 'approved' ? a('Schedule job', 'quoteToJob', 'btn-primary', 'calendar') + a('Convert to invoice', 'quoteToInvoice', '', 'invoice') : '') +
      (['approved', 'sent', 'draft'].includes(status) && depositAmt(d) && !depInv ? a(`Request ${money(depositAmt(d))} deposit`, 'quoteDeposit', '', 'invoice') : '') +
      (status === 'sent' || status === 'expired' ? a('Follow up', 'docFollow', '', 'sms') : send) + a('Edit', 'editDoc', '', 'edit') + a('Print / PDF', 'docPrint', '', 'print');
  const pays = isInv ? (d.payments || []) : [];
  const canMarkSent = isInv ? !d.sent && status === 'draft' : d.status === 'draft';
  return head(`${isInv ? 'Invoice' : 'Quote'} ${esc(d.number)} ${badge(status)}`, '', `<a class="crumb" href="#/${coll}">← All ${coll}</a><span class="crumb"> · </span><a href="#/customers/${c.id}">${esc(c.name || '')}</a>`) + `
    <div class="doc-actions">${actions}${moreMenu([
      canMarkSent && menuItem('Mark as sent', 'markSent', `data-id="${id}" data-type="${type}"`, 'check'),
      isInv && ['overdue', 'partial'].includes(status) && menuItem('Email invoice', 'docEmail', `data-id="${id}" data-type="${type}"`, 'mail'),
      isInv && ['overdue', 'partial'].includes(status) && menuItem('Text invoice', 'docText', `data-id="${id}" data-type="${type}"`, 'sms'),
      menuItem('Edit', 'editDoc', `data-id="${id}" data-type="${type}"`, 'edit'),
      menuItem('Duplicate', 'dupDoc', `data-id="${id}" data-type="${type}"`, 'quote'),
      !isInv && ['draft', 'sent', 'expired'].includes(status) && menuItem('Copy approval link', 'quoteCopyLink', `data-id="${id}"`, 'share'),
      !isInv && menuItem('Preview what the customer sees', 'quotePreview', `data-id="${id}"`, 'quote'),
      !isInv && ['draft', 'sent', 'expired'].includes(status) && menuItem('Mark declined', 'quoteDecline', `data-id="${id}" data-type="${type}"`, 'alert'),
      d.jobId && byId('jobs', d.jobId) && menuLink('View job', `#/jobs/${d.jobId}`, 'jobs'),
      !isInv && d.invoiceId && byId('invoices', d.invoiceId) && menuLink('View invoice', `#/invoices/${d.invoiceId}`, 'invoice'),
      isInv && d.quoteId && byId('quotes', d.quoteId) && menuLink('View quote', `#/quotes/${d.quoteId}`, 'quote'),
      isInv && d.planId && byId('subscriptions', d.planId) && menuLink('View service plan', `#/plans/${d.planId}`, 'repeat'),
      isInv && stripeOn() && !['paid', 'void'].includes(status) && menuItem('Send pay-online link', 'payLink', `data-id="${id}"`, 'share'),
      isInv && status !== 'void' && !pays.length && menuItem('Void invoice', 'voidInvoice', `data-id="${id}" data-type="${type}"`, 'alert'),
      menuItem('Delete', 'deleteDoc', `data-id="${id}" data-type="${type}"`, 'trash', 'danger'),
    ])}</div>
    ${!c.email && !c.phone ? `<div class="alert warn no-print" style="margin:0 auto 12px;max-width:820px">${icon('alert')}<span>This customer has no email or phone saved. <a href="#/customers/${c.id}">Add one</a> to send from here.</span></div>` : ''}
    ${isInv && d.checkout && !d.checkout.paid && !['paid', 'void'].includes(status) ? `<div class="alert info no-print" style="margin:0 auto 12px;max-width:820px">${icon('share')}<span>Pay-online link created ${fmtDate(iso(new Date(d.checkout.at)))}. <button class="link-btn" data-act="checkPaid" data-id="${id}">Check if paid</button></span></div>` : ''}
    ${!isInv && ['sent', 'draft', 'expired'].includes(status) && d.sentAt && !d.changeRequest && (relayOn() || serverHas('inbox')) ? `<div class="alert info no-print js-waiting" style="margin:0 auto 12px;max-width:820px">${icon('clock')}<span>Waiting for ${esc(firstName(c.name))} to approve. This page updates by itself when they do. <button class="link-btn" data-act="checkInbox">Check now</button></span></div>` : ''}
    ${!isInv && d.changeRequest && ['sent', 'draft', 'expired'].includes(status) ? `<div class="alert warn no-print" style="margin:0 auto 12px;max-width:820px">${icon('sms')}<span><b>${esc(d.changeRequest.name || 'The customer')} asked for changes</b> (${fmtDate(d.changeRequest.at.slice(0, 10))}): “${esc(d.changeRequest.msg)}”. Edit the quote, then send it again.</span></div>` : ''}
    ${!isInv && d.signature && status === 'approved' ? `<div class="alert good no-print" style="margin:0 auto 12px;max-width:820px">${icon('check')}<span><b>Approved online</b> by ${esc(d.signature.name)} on ${esc(new Date(d.signature.at).toLocaleString())}${d.items.some(i => i.optional && i.on) ? ` · added ${d.items.filter(i => i.optional && i.on).map(i => esc(i.desc)).join(', ')}` : ''}. Next: schedule the job.</span></div>` : ''}
    ${depInv ? `<div class="alert info no-print" style="margin:0 auto 12px;max-width:820px">${icon('invoice')}<span>Deposit invoice <a href="#/invoices/${depInv.id}">${esc(depInv.number)}</a> · ${badge(invStatus(depInv))}</span></div>` : ''}
    ${docHTML(type, d)}
    ${isInv ? `<div class="card no-print" style="margin-top:16px;max-width:820px;margin-left:auto;margin-right:auto">
      <div class="card-head"><h2>Payments</h2>${status !== 'paid' && status !== 'void' ? a('Record payment', 'recordPayment', 'btn-sm', 'plus') : ''}</div>
      ${pays.length ? pays.map(p => `<div class="list-item"><div class="grow"><div class="title">${money(p.amount)}</div><div class="muted small">${fmtDate(p.date)} · ${esc(p.method || '')}${p.note ? ' · ' + esc(p.note) : ''}</div></div>
        ${p.receiptUrl ? `<a class="btn btn-sm" href="${esc(p.receiptUrl)}" target="_blank" rel="noopener">Receipt</a>` : ''}
        ${p.stripePi && p.amount > 0 && stripeOn() && refundLeft(d, p) > 0 ? `<button class="btn btn-sm" data-act="refundPay" data-id="${id}" data-pid="${p.id}">Refund</button>` : ''}
        <button class="btn btn-sm btn-danger" data-act="deletePayment" data-id="${id}" data-pid="${p.id}" title="Removes the record only. Use Refund to return money.">Remove</button></div>`).join('') : '<p class="muted small">No payments recorded yet.</p>'}
      ${d.sentAt ? `<p class="muted small">Sent ${fmtDate(d.sentAt)}${d.remindedAt ? ` · last reminder ${fmtDate(d.remindedAt)}` : ''}.</p>` : ''}
    </div>` : `${d.sentAt ? `<p class="muted small no-print" style="text-align:center">Sent ${fmtDate(d.sentAt)}.</p>` : ''}`}
`;
}

/* ---------- Income ---------- */
VIEWS.income = () => {
  const p = filt('income', 'period', 'this_month');
  const [from, to] = periodRange(p, state.filters.income);
  const list = incomeEntries().filter(x => inRange(x.date, from, to)), pg = paged(list, 'income');
  const byMethod = {};
  list.forEach(x => byMethod[x.method || 'Other'] = (byMethod[x.method || 'Other'] || 0) + x.amount);
  return head('Income', btn('Add other income', 'newIncome', 'btn-primary', '', 'plus'), 'Invoice payments are added automatically. Use “other income” for cash jobs without an invoice.') + `
  <div class="toolbar">${periodSelect(p, 'income:period')}${customRange('income', p)}${btn('Export CSV', 'exportIncome', 'btn-sm', '', 'download')}</div>
  <div class="grid grid-3"><div class="card stat"><div class="label">Total received</div><div class="value">${money(sum(list, x => x.amount))}</div><div class="sub">${list.length} payments</div></div>
    <div class="card" style="grid-column:span 2"><h3 style="margin-bottom:6px">By payment method</h3>${hbars(Object.entries(byMethod).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), sum(list, x => x.amount))}</div></div>
  <div class="card">${list.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Source</th><th class="hide-sm">Customer</th><th class="hide-sm">Method</th><th class="num">Amount</th></tr></thead><tbody>
    ${pg.rows.map(x => `<tr class="clickable" ${x.kind === 'payment' ? `data-href="#/invoices/${x.invoiceId}"` : `data-act="editIncome" data-id="${x.id}"`}>
      <td>${fmtDate(x.date)}</td><td>${esc(x.source || x.description || 'Income')}${x.kind === 'other' && x.description && x.source ? `<div class="muted small">${esc(x.description)}</div>` : ''}</td>
      <td class="hide-sm">${esc(x.customerId ? custName(x.customerId) : '')}</td><td class="hide-sm">${esc(x.method || '')}</td><td class="num">${money(x.amount)}</td></tr>`).join('')}
  </tbody></table></div>${pg.more}` : empty('income', 'No income recorded for this period.')}</div>`;
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
    ${paged(list, 'expenses').rows.map(e => { const j = e.jobId && byId('jobs', e.jobId); return `<tr class="clickable" data-act="editExpense" data-id="${e.id}"><td>${fmtDate(e.date)}</td>
      <td>${esc(e.vendor || '—')} ${e.receipt || e.receiptImg ? `<span title="Receipt attached">${icon('receipt', 'muted').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')}</span>` : ''}<div class="muted small">${esc(e.notes || '')}</div></td>
      <td><span class="badge">${esc(e.category)}</span></td><td class="hide-sm">${j ? esc(j.title) : ''}</td><td class="num">${money(e.amount)}</td></tr>`; }).join('')}
  </tbody></table></div>${paged(list, 'expenses').more}` : empty('expense', 'No expenses for this period.', btn('Add expense', 'newExpense', 'btn-sm'))}</div>`;
};

/* ---------- Reports ---------- */
VIEWS.reports = () => {
  const p = filt('reports', 'period', 'ytd');
  const [from, to] = periodRange(p, state.filters.reports);
  const incList = incomeEntries().filter(x => inRange(x.date, from, to));
  const expList = db.expenses.filter(e => inRange(e.date, from, to));
  const owedComm = commissionsOwed(from, to);
  const inc = sum(incList, x => x.amount), exp = round2(sum(expList, e => e.amount) + owedComm);
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
        ${owedComm ? `<tr><td style="padding-left:18px">Commissions owed (not paid yet)</td><td class="num">−${money(owedComm)}</td></tr>` : ''}
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
  ${[...db.services].sort((a, b) => a.name.localeCompare(b.name)).map(s => `<tr class="clickable" data-act="editService" data-id="${s.id}"><td><b>${esc(s.name)}</b>${s.addon ? ' <span class="badge info">add-on</span>' : ''}</td><td class="hide-sm muted">${esc(s.description || '')}</td>
    <td>${esc(s.unit || '')}</td><td>${s.taxable !== false ? 'Yes' : 'No'}</td><td class="num">${money(s.price)}</td></tr>`).join('')}
  </tbody></table></div>` : empty('tag', 'Your price book is empty.', btn('Add your first service', 'newService', 'btn-sm'))}</div>`;

/* ---------- Messages ---------- */
function msgTime(iso) {
  const d = new Date(iso), t = today(), ds = localDate(iso);
  if (ds === t) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (ds === addDays(t, -1)) return 'Yesterday';
  return daysBetween(ds, t) < 7 ? d.toLocaleDateString(undefined, { weekday: 'short' }) : fmtDateShort(ds);
}
function threads() {
  const map = new Map();
  for (const m of db.messages) {
    const k = threadKey(m), x = map.get(k) || { key: k, c: m.customerId ? cust(m.customerId) : null, phone: m.phone, last: m, unread: 0, n: 0 };
    x.n++; if (m.dir === 'in' && !m.read) x.unread++; if (m.at >= x.last.at) x.last = m;
    map.set(k, x);
  }
  return [...map.values()].sort((a, b) => b.last.at.localeCompare(a.last.at));
}
const textingNote = () => serverHas('sms')
  ? `<span class="badge good">Texting on</span> Texts go from your business number ${esc(formatPhone(db.settings.stripeStatus?.features?.smsFrom || ''))} and replies show up here.`
  : `Texts open your phone’s Messages app, ready to send, and are saved here. To send and get replies right here, <a href="#/settings" data-tabset="settings:tab:messages">turn on texting</a>.`;
VIEWS.messages = id => {
  if (id) return threadView(id);
  const tab = filt('messages', 'tab', 'chats'), q = filt('messages', 'q', '').toLowerCase();
  const actions = btn('New message', 'newMessage', 'btn-primary', '', 'plus') + btn('Promo blast', 'newBlast', '', '', 'share') + (serverHas('inbox') || relayOn() ? btn('Check for updates', 'checkInbox', '', '', 'repeat') : '');
  const tabs = tabsHTML('messages', 'tab', [['chats', 'Conversations'], ['blasts', `Blasts (${db.blasts.length})`]], tab);
  if (tab === 'blasts') {
    return head('Messages', actions) + `<div class="card">${tabs}${db.blasts.length ? [...db.blasts].reverse().map(b => {
      const replies = db.messages.filter(m => m.dir === 'in' && m.at > b.at && b.phones?.includes(digits10(m.phone))).length;
      return `<div class="list-item"><span class="attn-ic info">${icon('share')}</span><div class="grow"><div class="title">${esc(b.body.slice(0, 70))}${b.body.length > 70 ? '…' : ''}</div>
        <div class="muted small">${fmtDate(localDate(b.at))} · ${esc(b.audience)} · ${b.via === 'sms' ? `${b.sent} sent${b.failed ? `, ${b.failed} failed` : ''}` : b.via === 'email' ? `${b.sent} emailed` : `${b.sent} texted from your phone`} · ${replies} repl${replies === 1 ? 'y' : 'ies'}</div></div></div>`;
    }).join('') : empty('share', 'No blasts yet. Send a promotion to all your customers at once.', btn('Create a promo blast', 'newBlast', 'btn-sm btn-primary'))}</div>`;
  }
  const list = threads().filter(t => !q || `${t.c?.name || ''} ${t.phone} ${t.last.body}`.toLowerCase().includes(q));
  return head('Messages', actions, textingNote()) + `<div class="card">${tabs}
    <div class="toolbar"><input type="search" placeholder="Search messages…" value="${esc(q)}" data-filter="messages:q"></div>
    ${list.length ? list.map(t => {
      const name = t.c?.name || formatPhone(t.phone);
      return `<a class="list-item thread-row ${t.unread ? 'unread' : ''}" href="#/messages/${t.key}" style="color:inherit">
        <span class="avatar" style="background:${t.c ? TEAM_COLORS[(t.c.name || '').length % TEAM_COLORS.length] : '#8e8e93'}">${esc((name || '?')[0].toUpperCase())}</span>
        <div class="grow"><div class="row" style="flex-wrap:nowrap;gap:6px"><span class="title" style="flex:1">${esc(name)}</span><span class="muted small">${msgTime(t.last.at)}</span></div>
        <div class="muted small thread-preview">${t.last.dir === 'out' ? 'You: ' : ''}${esc(t.last.body)}</div></div>${t.unread ? `<span class="unread-dot" aria-label="${t.unread} unread"></span>` : ''}</a>`;
    }).join('') : empty('sms', 'No messages yet. Texts you send to customers from the app show up here.')}</div>`;
};
function threadView(key) {
  const c = key.startsWith('p') ? custByPhone(key.slice(1)) : cust(key);
  const phone = c?.phone || key.slice(1);
  if (c && key.startsWith('p')) db.messages.forEach(m => { if (threadKey(m) === key) m.customerId = c.id; }); // number now belongs to a customer
  const k = c ? c.id : key;
  const msgs = db.messages.filter(m => threadKey(m) === k).sort((a, b) => a.at.localeCompare(b.at));
  let lastDay = '';
  const bubbles = msgs.map(m => {
    const day = localDate(m.at), sep = day !== lastDay ? `<div class="chat-day">${day === today() ? 'Today' : fmtDate(day)}</div>` : ''; lastDay = day;
    return `${sep}<div class="bubble ${m.dir} ${m.status === 'failed' ? 'failed' : ''}"><div class="bubble-text">${esc(m.body)}</div>
      <div class="bubble-meta">${new Date(m.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${m.dir === 'out' ? ` · ${m.status === 'failed' ? `Not delivered: ${esc(m.error || '')}` : m.via === 'phone' ? 'from your phone' : m.via === 'email' ? 'email' : 'sent'}` : ''}${m.blastId ? ' · promo' : ''}</div></div>`;
  }).join('');
  const tpls = [['', 'Templates…'], ['tplOnWay', 'On my way'], ['tplAppt', 'Appointment reminder'], ['tplReview', 'Ask for a review'], ['tplQuoteFollow', 'Quote follow-up']];
  return head(esc(c?.name || formatPhone(phone)), (phone ? `<a class="btn" href="tel:${esc(phone)}">${icon('phone')}Call</a>` : '') + (c ? `<a class="btn" href="#/customers/${c.id}">${icon('users')}Customer</a>` : ''),
      `${esc(formatPhone(phone))}${c?.noPromo ? ' · <span class="badge warn">No promotions</span>' : ''}`) + `
    <div class="chat card">${bubbles || '<p class="muted small" style="text-align:center">No messages yet. Say hi 👋</p>'}</div>
    ${phone ? `<form class="composer js-compose" data-key="${esc(k)}" data-phone="${esc(phone)}">
      <select class="js-tpl" aria-label="Insert a template">${opts(tpls, '')}</select>
      <textarea name="body" rows="1" placeholder="Text message" required class="js-sms-body"></textarea>
      <button class="composer-send" type="submit" aria-label="Send">${icon('send')}</button></form>` : ''}
    <p class="muted small chat-note">${textingNote()}</p>`;
}
VIEWS.messages.mount = id => {
  if (!id) return null;
  let changed = false;
  db.messages.forEach(m => { if (m.dir === 'in' && !m.read && (threadKey(m) === id || m.customerId === id)) { m.read = true; changed = true; } });
  if (changed) { save(); renderChrome(); }
  const chat = $('.chat'); if (chat) window.scrollTo(0, document.body.scrollHeight);
  const ta = $('.js-compose textarea');
  ta?.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; });
  $('.js-tpl')?.addEventListener('change', e => {
    const c = cust(id) || custByPhone($('.js-compose').dataset.phone);
    if (e.target.value) { ta.value = fillTemplate(e.target.value, { ...custVars(c), date: 'your appointment day', time: '' }); ta.dispatchEvent(new Event('input')); ta.focus(); }
    e.target.value = '';
  });
  return null;
};
document.addEventListener('submit', async e => {
  const f = e.target.closest?.('.js-compose'); if (!f) return;
  e.preventDefault();
  const body = f.body.value.trim(); if (!body) return;
  const c = cust(f.dataset.key) || custByPhone(f.dataset.phone) || { phone: f.dataset.phone };
  f.querySelector('button').disabled = true;
  const r = await sendText(c, body);
  if (!r.ok) toast('Not sent: ' + r.error);
  render();
});

function newMessageForm(preset = {}) {
  modal({ title: 'New message', submitLabel: serverHas('sms') ? 'Send' : 'Open Messages', body: `
    ${field('To', customerSelect(preset.customerId), 'full')}
    <div class="field" style="margin-top:12px"><label>Message</label><textarea name="body" rows="6" required class="js-sms-body">${esc(preset.body || '')}</textarea><div class="muted small js-sms-count"></div></div>
    <p class="muted small">${textingNote()}</p>`,
    onMount: f => { bindCustomerSelect(f); bindSmsCount(f); },
    onSubmit: (f, d) => {
      const c = cust(d.customerId);
      if (!c?.phone) { toast('This customer has no phone number'); return false; }
      sendText(c, d.body.trim()).then(r => { if (!r.viaPhone) { toast(r.ok ? 'Text sent' : 'Not sent: ' + r.error); go('#/messages/' + c.id); } else setTimeout(() => go('#/messages/' + c.id), 400); });
    } });
}

/* ----- promo blasts ----- */
const AUDIENCES = [['all', 'All customers'], ['plan', 'Customers on a service plan'], ['lapsed', 'Customers you haven’t serviced in 6+ months'],
  ['recent', 'Customers serviced in the last 12 months'], ['tag', 'Customers with a tag…'], ['leads', 'Open leads (not customers yet)']];
function blastPeople(aud, tag = '') {
  const t = today(), sixAgo = addMonths(t, -6), yearAgo = addMonths(t, -12);
  const lastJob = c => db.jobs.filter(j => j.customerId === c.id && j.status === 'completed').map(j => j.date).sort().at(-1) || '';
  const upcoming = c => db.jobs.some(j => j.customerId === c.id && j.status === 'scheduled' && j.date >= t);
  let list;
  if (aud === 'leads') list = db.leads.filter(l => !['won', 'lost'].includes(l.stage) && l.phone && !custByPhone(l.phone)).map(l => ({ name: l.name, phone: l.phone, email: l.email, leadId: l.id }));
  else {
    const ok = {
      all: () => true, plan: c => db.subscriptions.some(p => p.customerId === c.id && p.status === 'active'),
      lapsed: c => { const l = lastJob(c); return l && l < sixAgo && !upcoming(c); }, recent: c => lastJob(c) >= yearAgo,
      tag: c => tag && String(c.tags || '').toLowerCase().split(/[,;]/).map(x => x.trim()).includes(tag.trim().toLowerCase()),
    }[aud] || (() => true);
    list = db.customers.filter(ok);
  }
  const optedOut = list.filter(c => c.noPromo), reach = list.filter(c => !c.noPromo);
  return { send: reach.filter(c => c.phone), noPhone: reach.filter(c => !c.phone), optedOut };
}
const blastText = (body, c, optOut) =>
  `${body.replace(/\{first\}/g, firstName(c.name)).replace(/\{business\}/g, db.settings.businessName || 'us')}${optOut ? '\nReply STOP to opt out.' : ''}`;
function blastForm() {
  const sms = serverHas('sms');
  modal({ title: 'Promo blast', wide: true, submitLabel: 'Review', body: `
    <div class="form-grid">
      ${field('Send to', `<select name="aud">${opts(AUDIENCES, 'all')}</select>`)}
      <div class="field js-tagf hidden"><label>Tag</label><input name="tag" placeholder="e.g. residential"></div>
      <div class="field full"><label>Message <span class="muted">· {first} becomes each customer’s first name</span></label>
        <textarea name="body" rows="5" required class="js-sms-body">Hi {first}! Spring special from {business}: 15% off window cleaning when you book before the end of the month. Reply YES and we’ll get you on the schedule.</textarea>
        <div class="muted small js-sms-count"></div></div>
      <label class="check full"><input type="checkbox" name="optOut" checked> Add “Reply STOP to opt out.” (recommended, and required by Canada’s anti-spam law for promotions)</label>
      ${sms ? '' : `<div class="field full"><label>How to send</label><select name="how">${opts([['phone', 'Text them one at a time from my phone'], ['email', 'Email everyone (BCC, so no one sees the others)']], 'phone')}</select></div>`}
    </div>
    <div class="blast-sum js-bsum"></div>
    <p class="muted small">Only send promotions to customers who agreed to hear from you. Anyone who replies STOP, or that you mark “Don’t send promotions”, is skipped automatically.${sms ? '' : ' To send all texts at once from your business number, turn on texting in Settings → Messages.'}</p>`,
    onMount: f => {
      bindSmsCount(f);
      const upd = () => {
        $('.js-tagf', f).classList.toggle('hidden', f.aud.value !== 'tag');
        const pp = blastPeople(f.aud.value, f.tag.value), how = sms ? 'sms' : f.how.value;
        const n = how === 'email' ? pp.send.concat(pp.noPhone).filter(c => c.email).length : pp.send.length;
        const first = pp.send[0] || { name: 'Alex' };
        $('.js-bsum', f).innerHTML = `<div class="pay-row"><span>Will receive it</span><b>${n} ${n === 1 ? 'person' : 'people'}</b></div>
          ${pp.optedOut.length ? `<div class="pay-row"><span>Skipped: asked not to get promotions</span><span>${pp.optedOut.length}</span></div>` : ''}
          ${how !== 'email' && pp.noPhone.length ? `<div class="pay-row"><span>Skipped: no phone number</span><span>${pp.noPhone.length}</span></div>` : ''}
          <div class="muted small" style="margin-top:8px">Preview for ${esc(firstName(first.name))}:</div><div class="bubble out preview"><div class="bubble-text">${esc(blastText(f.body.value, first, f.optOut.checked))}</div></div>`;
      };
      f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
    },
    onSubmit: (f, d) => {
      const pp = blastPeople(d.aud, d.tag), how = sms ? 'sms' : d.how, audience = AUDIENCES.find(a => a[0] === d.aud)[1].replace('…', d.tag ? `: ${d.tag}` : '');
      const people = how === 'email' ? pp.send.concat(pp.noPhone).filter(c => c.email) : pp.send;
      if (!people.length) { toast('No one to send to'); return false; }
      const blast = { id: uid(), at: new Date().toISOString(), body: d.body.trim(), audience, via: how, sent: 0, failed: 0, phones: people.map(c => digits10(c.phone)).filter(Boolean) };
      const msgOf = c => blastText(blast.body, c, !!d.optOut);
      if (how === 'sms') { if (!confirm(`Send this text to ${people.length} ${people.length === 1 ? 'person' : 'people'} now?`)) return false; setTimeout(() => runBlast(blast, people, msgOf), 50); return; }
      if (how === 'email') {
        const s = db.settings;
        db.blasts.push({ ...blast, sent: people.length }); save();
        location.href = `mailto:${encodeURIComponent(s.email || '')}?bcc=${people.map(c => encodeURIComponent(c.email)).join(',')}&subject=${encodeURIComponent(`A special offer from ${s.businessName || 'us'}`)}&body=${encodeURIComponent(blastText(blast.body, { name: 'there' }, false).replace(/^Hi there!/, 'Hi!'))}`;
        return;
      }
      setTimeout(() => oneByOne(blast, people, msgOf), 50);
    } });
}
async function runBlast(blast, people, msgOf) {
  const m = modal({ title: 'Sending…', noFoot: true, focus: false, body: `<div class="progress" style="height:10px"><i class="js-bar" style="width:0"></i></div><p class="js-bstat muted small">Starting…</p>` });
  db.blasts.push(blast);
  for (let i = 0; i < people.length; i++) {
    const c = people[i], r = await sendText(c, msgOf(c), { blastId: blast.id });
    r.ok ? blast.sent++ : blast.failed++;
    const bar = $('.js-bar', m.form); if (bar) bar.style.width = `${Math.round((i + 1) / people.length * 100)}%`;
    const st = $('.js-bstat', m.form); if (st) st.textContent = `${i + 1} of ${people.length} · ${blast.sent} sent${blast.failed ? ` · ${blast.failed} failed` : ''}`;
    await new Promise(res => setTimeout(res, 120)); // stay well under carrier rate limits
  }
  save(); m.close();
  toast(`Promo sent to ${blast.sent} ${blast.sent === 1 ? 'person' : 'people'}${blast.failed ? ` · ${blast.failed} failed` : ''}`);
  (state.filters.messages ||= {}).tab = 'blasts'; go('#/messages');
}
function oneByOne(blast, people, msgOf) {
  db.blasts.push({ ...blast, sent: 0 }); save();
  const b = db.blasts.at(-1);
  modal({ title: `Text ${people.length} people`, noFoot: true, focus: false, body: `<p class="muted small" style="margin-top:0">Tap each one. Your Messages app opens with the text ready: tap send, then come back for the next.</p>
    ${people.map((c, i) => `<a class="list-item js-one js-raw-sms" data-i="${i}" href="${smsHref(c.phone, msgOf(c))}" style="color:inherit"><span class="avatar sm" style="background:#34c759">${esc(c.name[0] || '?')}</span>
      <div class="grow"><div class="title">${esc(c.name)}</div><div class="muted small">${esc(formatPhone(c.phone))}</div></div><span class="badge js-st">Text</span></a>`).join('')}`,
    onMount: f => $$('.js-one', f).forEach(a => a.addEventListener('click', () => {
      const c = people[+a.dataset.i];
      if (!a.classList.contains('done')) { b.sent++; logMsg({ customerId: c.id || '', phone: c.phone, dir: 'out', body: msgOf(c), via: 'phone', status: 'opened', blastId: b.id }); save(); }
      a.classList.add('done'); $('.js-st', a).textContent = 'Sent ✓'; $('.js-st', a).className = 'badge good js-st';
    })) });
}

/* ---------- Settings ---------- */
VIEWS.settings = () => {
  const s = db.settings;
  const used = (() => { try { return (JSON.stringify(db).length / 1024 / 1024).toFixed(2); } catch { return '?'; } })();
  const sec = filt('settings', 'tab', 'business');
  const show = k => `${k === sec ? '' : 'hidden'}" data-sec="${k}`; // all sections stay in the form; tabs only hide them
  const SECS = [['business', 'Business'], ['money', 'Tax & money'], ['docs', 'Quotes & invoices'], ['plans', 'Plans & payments'], ['messages', 'Messages'], ['lists', 'Pipeline & lists'], ['data', 'Data & backup']];
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
    ${field('Default quote note', `<textarea name="quoteNotes">${esc(s.quoteNotes)}</textarea>`, 'full')}
    ${field('Quote terms (customers agree to these when they approve online)', `<textarea name="quoteTerms" rows="5">${esc(s.quoteTerms)}</textarea>`, 'full')}
  </div></div>
  <div class="card ${show('plans')}"><h2>Stripe: charge cards from this app</h2>
    <p class="muted small">Connect your Stripe account to save customers’ cards securely, charge them in one tap, send pay-online links and refund. Money goes to your Stripe balance and Stripe pays it out to your bank.</p>
    <div class="stripe-status js-stripe-status">${s.stripeStatus ? `<span class="badge good">Connected</span> <b>${esc(s.stripeStatus.account || '')}</b> · ${s.stripeStatus.mode === 'live' ? '<b>Live mode</b>, real charges' : '<span class="badge warn">Test mode</span> no real money moves'}${s.stripeStatus.chargesEnabled ? '' : ' · <span style="color:var(--bad)">Stripe hasn’t enabled charges yet. Finish your Stripe account setup.</span>'}`
      : '<span class="badge">Not connected</span>'}</div>
    <div class="form-grid" style="margin-top:12px">
      ${field('Payment server address', inp('stripeUrl', s.stripeUrl, 'type="url" placeholder="https://business-hub-pay.yourname.workers.dev"'), 'full')}
      <div class="field full"><label>App token (the same one you saved as APP_TOKEN)</label>
        <div class="row" style="flex-wrap:nowrap">${inp('stripeToken', s.stripeToken, 'type="password" autocomplete="off" spellcheck="false"')}
        <button type="button" class="btn btn-sm js-show-token">Show</button><button type="button" class="btn btn-sm js-gen-token">Generate</button></div></div>
      <label class="check full"><input type="checkbox" name="autoChargePlans" ${s.autoChargePlans ? 'checked' : ''}> When I complete a service-plan visit, invoice it and charge the card on file automatically</label>
      <label class="check full"><input type="checkbox" name="saveCardOnPay" ${s.saveCardOnPay ? 'checked' : ''}> Save the customer’s card when they pay an invoice online (so you can charge it next time)</label>
    </div>
    <div class="row" style="margin-top:12px">${btn('Save & test connection', 'stripeTestSave', 'btn-sm', '', 'check')}${s.stripeStatus ? btn('Setup guide', 'connectStripe', 'btn-sm') : ''}
      <a class="btn btn-sm" href="${SETUP_DOC}" target="_blank" rel="noopener">Written guide ↗</a></div>
    ${s.stripeStatus ? '' : `<div class="connect-cta"><div><b>Not set up yet?</b><div class="muted small">A guided setup: about 10 minutes, no coding.</div></div>${btn('Connect Stripe step by step', 'connectStripe', 'btn-primary', '', 'check')}</div>`}</div>
  <div class="card ${show('plans')}"><h2>Payments &amp; cards on file</h2>
    <p class="muted small">Cards are saved securely in your payment processor. This app keeps only the card type, last 4 digits and expiry, so it never holds full card numbers.</p>
    <div class="form-grid">
      ${field('Payment processor', `<select name="processor">${opts(['', ...PROCESSORS].map(x => [x, x || '—']), s.processor)}</select>`)}
      ${field('Processor dashboard link (to charge cards)', inp('processorUrl', s.processorUrl, 'type="url" placeholder="e.g. https://dashboard.stripe.com/customers"'))}
      ${field('Secure “add your card” link for customers (optional)', inp('cardSetupLink', s.cardSetupLink, 'type="url" placeholder="A Stripe, Square or Helcim link where customers save their card"'), 'full')}
    </div></div>
  <div class="card ${show('plans')}"><h2>Service plan defaults</h2>
    <div class="form-grid" style="margin-top:12px">
      ${field('Plan number prefix', inp('planPrefix', s.planPrefix))}${field('Next plan number', inp('nextPlanNo', s.nextPlanNo, 'type="number"'))}
      ${field('Default term (months)', inp('planTermMonths', s.planTermMonths, 'type="number" min="1"'))}
      ${field('Minimum visits before free cancellation', inp('planMinVisits', s.planMinVisits, 'type="number" min="0"'))}
      ${field('Early cancellation fee', inp('cancelFee', s.cancelFee, 'type="number" min="0" step="1"'))}
      ${field('Default terms &amp; conditions', `<textarea name="planTerms" rows="12">${esc(s.planTerms || BH.DEFAULT_TERMS)}</textarea>`, 'full')}
    </div>
    <p class="muted small">Placeholders: <code>{business}</code> <code>{start}</code> <code>{term}</code> <code>{price}</code> <code>{minVisits}</code> <code>{fee}</code> <code>{renew}</code> <code>{customer}</code>.
      These are sensible starting terms, not legal advice. Have them reviewed for your province, since consumer protection rules can limit cancellation fees.</p></div>
  <div class="card ${show('business')}"><h2>Online booking form</h2>
    <p class="muted small">A link new customers can use to request work: they pick services from your price book, add their address and best times, and it lands in Leads. Put it in your Instagram bio, Google profile, website or on door hangers (there’s a QR code).</p>
    <div class="row">${btn('Share booking form', 'bookingShare', 'btn-sm btn-primary', '', 'share')}</div></div>
  <div class="card ${show('plans')}"><h2>Instant updates when customers sign</h2>
    <p class="muted small">When a customer approves a quote or signs an agreement, it comes straight into this app (checked every 30 seconds while it’s open, and whenever you open it). Answers are encrypted on the customer’s phone with a key only you have, then passed through the free ntfy.sh relay, which can’t read them. Answers wait there for 12 hours, so open the app at least twice a day. Customers can also send you a copy by text.</p>
    <label class="check"><input type="checkbox" name="relay" ${s.relay !== false ? 'checked' : ''}> Get customers’ approvals and signatures automatically</label></div>
  <div class="card ${show('messages')}"><h2>Texting from the app</h2>
    <p class="muted small">Without this, texts open your phone’s Messages app ready to send (that works fine). Turn it on to send texts and promo blasts from a business number right here, and see customers’ replies in Messages.</p>
    <div class="stripe-status">${serverHas('sms') ? `<span class="badge good">Texting on</span> Sending from <b>${esc(formatPhone(s.stripeStatus.features.smsFrom))}</b>` : stripeOn() ? '<span class="badge">Not set up</span> Your server is connected. Add Twilio to it (steps below).' : '<span class="badge">Not set up</span> Connect your server first (Settings → Plans & payments → Connect Stripe).'}</div>
    <details style="margin-top:12px" ${stripeOn() && !serverHas('sms') ? 'open' : ''}><summary class="small"><b>How to turn on texting (Twilio, about 10 minutes)</b></summary><ol class="small setup-steps">
      <li>Create a <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener">Twilio account</a> and buy a phone number with SMS in your area (about $1.15 USD a month, plus about 1¢ per text).</li>
      <li>In Twilio, copy your <b>Account SID</b> and <b>Auth Token</b> (Console home page).</li>
      <li>In Cloudflare, open your <b>business-hub-server</b> Worker → Settings → Variables and Secrets. Add <code>TWILIO_ACCOUNT_SID</code> and <code>TWILIO_AUTH_TOKEN</code> as <b>Secrets</b>, and <code>TWILIO_FROM</code> as <b>Text</b> with your Twilio number like <code>+14165550100</code>. Deploy.</li>
      <li>In Twilio → Phone Numbers → your number → Messaging → “A message comes in”: Webhook, HTTP POST, this address:
        <div class="row" style="flex-wrap:nowrap;margin-top:6px"><input readonly value="${esc(stripeOn() ? serverBase() + '/twilio/inbound' : 'Connect your server first')}" onfocus="this.select()">${stripeOn() ? `<button type="button" class="btn btn-sm js-copy-val">Copy</button>` : ''}</div></li>
      <li>Tap <b>Check connection</b>. You should see “Texting on”.</li></ol></details>
    <div class="row" style="margin-top:12px">${btn('Check connection', 'stripeTestSave', 'btn-sm', '', 'check')}</div></div>
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
    <h3 style="margin:20px 0 6px">Automatic daily copies</h3>
    <p class="muted small" style="margin-top:0">The app keeps a copy of your data from each of the last 7 days on this device. If something goes wrong, roll back to one of them. Photos are kept separately and aren’t affected.</p>
    <div class="js-snapshots"><span class="muted small">Loading…</span></div>
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
VIEWS.settings.mount = () => {
  listSnapshots().then(list => {
    const box = $('.js-snapshots'); if (!box) return;
    box.innerHTML = list.length ? list.map(x => `<div class="list-item"><div class="grow"><div class="title">${x.date === today() ? 'Today' : fmtDateShort(x.date)}</div>
      <div class="muted small">${x.customers} customers · ${x.jobs} jobs · ${x.invoices} invoices</div></div>${btn('Restore', 'restoreSnap', 'btn-sm', `data-k="${x.key}"`)}</div>`).join('')
      : '<p class="muted small">No copies yet. The first one is made the next time the app opens.</p>';
  });
};
document.addEventListener('click', e => {
  const cp = e.target.closest('.js-copy-val');
  if (cp) { const v = cp.previousElementSibling.value; navigator.clipboard?.writeText(v).then(() => toast('Copied'), () => prompt('Copy:', v)); }
  if (e.target.closest('.js-show-token')) { const i = $('#settingsForm [name=stripeToken]'); i.type = i.type === 'password' ? 'text' : 'password'; e.target.textContent = i.type === 'password' ? 'Show' : 'Hide'; }
  if (e.target.closest('.js-gen-token')) {
    const i = $('#settingsForm [name=stripeToken]');
    if (i.value && !confirm('Replace the current token? You’ll need to update APP_TOKEN in Cloudflare too.')) return;
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    i.value = newToken(); void bytes; i.type = 'text';
    navigator.clipboard?.writeText(i.value).then(() => toast('Token copied. Paste it as APP_TOKEN in Cloudflare, then Save.'), () => toast('Copy this token into Cloudflare as APP_TOKEN, then Save.'));
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
  for (const k of ['taxRate', 'dueDays', 'mileageRate', 'nextInvoiceNo', 'nextQuoteNo', 'quoteValidDays', 'monthlyGoal', 'nextPlanNo', 'planTermMonths', 'planMinVisits', 'cancelFee']) if (k in d) d[k] = +d[k] || 0;
  for (const k of ['autoChargePlans', 'saveCardOnPay']) d[k] = !!d[k];
  if ('stripeUrl' in d) d.relay = !!d.relay;
  if ('stripeUrl' in d) { d.stripeUrl = d.stripeUrl.trim(); d.stripeToken = d.stripeToken.trim(); if (d.stripeUrl !== db.settings.stripeUrl || d.stripeToken !== db.settings.stripeToken) d.stripeStatus = null; }
  if ('planTerms' in d && d.planTerms.trim() === BH.DEFAULT_TERMS.trim()) d.planTerms = '';
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
    ${field('Sold by (sales rep)', memberSelect('salesRep', c.salesRep, '—'))}
    ${field('Notes', `<textarea name="notes" placeholder="Gate code, pets, preferences…">${esc(c.notes)}</textarea>`, 'full')}
    <label class="check full"><input type="checkbox" name="noPromo" ${c.noPromo ? 'checked' : ''}> Don’t send this customer promotions (they asked not to, or replied STOP)</label></div>`,
    onSubmit: (f, d) => {
      d.noPromo = !!d.noPromo;
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

/* The price box mirrors the first line item, so simple jobs never need the line-item editor. */
function bindJobPrice(f, j) {
  const priceEl = f.jobPrice, hint = $('.js-price-hint', f), rows = () => $$('.js-items tr', f);
  let autoDesc = '';
  const sync = () => {
    if (!j._getItems) return; // form already saved
    const items = j._getItems(), r = rows();
    const simple = r.length <= 1 && (items.length === 0 || (items.length === 1 && +items[0].qty === 1));
    priceEl.disabled = !simple;
    if (document.activeElement !== priceEl) priceEl.value = items.length ? totals({ items }).sub.toFixed(2) : '';
    const t = totals({ items, discount: f.discount.value, taxRate: f.taxRate.value });
    hint.textContent = !simple ? 'Total of the line items below' : t.total ? `${money(t.total)} with ${db.settings.taxName}` : '';
  };
  priceEl.addEventListener('input', () => {
    const tr = rows()[0]; if (!tr) return;
    const desc = $('[data-k=desc]', tr), pr = $('[data-k=price]', tr);
    if (!desc.value.trim()) { autoDesc = f.title.value.trim() || 'Job'; desc.value = autoDesc; desc.dispatchEvent(new Event('input', { bubbles: true })); }
    pr.value = priceEl.value; pr.dispatchEvent(new Event('input', { bubbles: true }));
  });
  f.title.addEventListener('input', () => {
    const tr = rows()[0], desc = tr && $('[data-k=desc]', tr);
    if (desc && autoDesc && desc.value === autoDesc && rows().length === 1) { autoDesc = f.title.value.trim(); desc.value = autoDesc; }
    const svc = db.services.find(x => x.name === f.title.value.trim());
    if (svc && !priceEl.disabled && !+priceEl.value) { priceEl.value = svc.price; priceEl.dispatchEvent(new Event('input')); }
  });
  $('.js-items', f).addEventListener('input', sync);
  f.addEventListener('click', e => { if (e.target.closest('.js-add-item,[data-rm],[data-up]')) setTimeout(sync); });
  f.discount.addEventListener('input', sync); f.taxRate.addEventListener('input', sync);
  sync();
}
function jobForm(j, preset = {}) {
  const isNew = !j; j ||= { status: 'scheduled', date: preset.date || today(), ...preset };
  if (isNew && j.salesRep === undefined && j.customerId) j.salesRep = defaultSalesRep(j.customerId);
  const c = cust(j.customerId);
  const later = !isNew && j.seriesId ? laterInSeries(j) : [];
  modal({ title: isNew ? 'New job' : 'Edit job', wide: true, body: `
  <div class="form-section"><div class="form-grid">
    ${field('Customer *', customerSelect(j.customerId), 'full')}
    ${field('Job title *', inp('title', j.title, 'required placeholder="e.g. Furnace tune-up" list="svcTitles"') + `<datalist id="svcTitles">${db.services.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>`)}
    ${field('Price (before tax)', `<div class="money-input"><span>${curSymbol()}</span>${inp('jobPrice', '', 'type="number" step="0.01" min="0" inputmode="decimal" placeholder="0.00"')}</div><span class="muted small js-price-hint"></span>`)}
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
  ${payFieldsHTML(j)}
  <div class="form-section">${field('Notes / instructions', `<textarea name="notes" placeholder="Gate code, scope of work, materials to bring…">${esc(j.notes)}</textarea>`)}</div>
  <details class="form-section" ${(j.items || []).length ? 'open' : ''}><summary><h3>Line items <span class="muted small">(optional, used when you invoice)</span></h3></summary>${itemsEditorHTML(j)}</details>`,
    onMount: f => {
      j._getItems = mountItemsEditor(f, j);
      bindJobPrice(f, j);
      bindPayFields(f, () => j._getItems?.() || []);
      bindCustomerSelect(f, nc => {
        if (nc && !f.address.value) f.address.value = nc.address || '';
        if (nc && isNew && !f.salesRep.value) { const rep = defaultSalesRep(nc.id); if (rep) { if (f.salesRep.tagName === 'SELECT' && ![...f.salesRep.options].some(o => o.value === rep)) f.salesRep.add(new Option(rep, rep)); f.salesRep.value = rep; f.salesRep.dispatchEvent(new Event('change')); } }
      });
      if (isNew && j.repeat) f.repeat.value = j.repeat;
      if (isNew) bindRepeat(f, () => f.date.value);
    },
    onSubmit: (f, d) => {
      const items = j._getItems();
      const rule = isNew ? readRule(f, d.date || today()) : null;
      if (rule && !d.date) { toast('Pick a start date for a repeating job'); return false; }
      delete j._getItems;
      const base = { customerId: d.customerId, title: d.title.trim(), date: d.date, start: d.start, end: d.end, address: d.address,
        assignedTo: d.assignedTo, status: d.status || j.status || 'scheduled', notes: d.notes, items, discount: +d.discount || 0, taxRate: d.taxRate === '' ? db.settings.taxRate : +d.taxRate,
        salesRep: d.salesRep || '', cleanerPct: d.cleanerPct === '' ? null : +d.cleanerPct, salesPct: d.salesPct === '' ? null : +d.salesPct };
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
    onMount: f => { d._getItems = mountItemsEditor(f, d, { optional: !isInv }); bindCustomerSelect(f); },
    onSubmit: (f, v) => {
      const items = d._getItems();
      if (!items.length) { toast('Add at least one line item'); return false; }
      delete d._getItems;
      const before = !isInv && d.signature ? quoteCanonical(d) : '';
      Object.assign(d, { customerId: v.customerId, date: v.date, notes: v.notes, serviceAddress: v.serviceAddress, items,
        discount: +v.discount || 0, taxRate: v.taxRate === '' ? s.taxRate : +v.taxRate });
      if (isInv) d.dueDate = v.dueDate; else { d.validUntil = v.validUntil; d.depositPct = Math.min(100, Math.max(0, +v.depositPct || 0)); }
      if (before && before !== quoteCanonical(d)) { // like Jobber: changing an approved quote removes the customer's signature
        delete d.signature; d.status = 'sent'; d.approvedAt = ''; setTimeout(() => toast('Quote changed after approval. Send it again for a new signature.'), 400);
      }
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
  let receipt = e.receipt ? { src: e.receipt } : e.receiptImg ? { img: e.receiptImg } : null;
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
      <div class="js-receipt-prev" style="margin-top:6px">${receipt ? `<img ${imgAttr(receipt)} alt="Receipt" style="max-height:160px;border-radius:8px"><br><button type="button" class="btn btn-sm js-rm-receipt">Remove photo</button>` : ''}</div></div>
  </div>`, footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => {
      $('.js-calc-tax', f).addEventListener('click', () => { const r = +db.settings.taxRate; f.tax.value = round2((+f.amount.value || 0) * r / (100 + r)).toFixed(2); });
      const prev = $('.js-receipt-prev', f);
      $('.js-receipt', f).addEventListener('change', async ev => {
        const file = ev.target.files[0]; if (!file) return;
        try { const data = await readImage(file, 1100, 0.6); receipt = await putImage(data); prev.innerHTML = `<img src="${data}" alt="Receipt" style="max-height:160px;border-radius:8px">`; }
        catch { toast('Could not read that image'); }
      });
      hydrateImages(prev);
      prev.addEventListener('click', ev => { if (ev.target.closest('.js-rm-receipt')) { receipt = null; prev.innerHTML = ''; } });
      $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.expenses = db.expenses.filter(x => x.id !== e.id); close(); refresh(); undoToast(snap, 'Expense deleted'); });
    },
    onSubmit: (f, d) => {
      const wasRecurring = e.recurring;
      Object.assign(e, { amount: round2(d.amount), date: d.date, vendor: d.vendor.trim(), category: d.category, tax: d.tax === '' ? 0 : round2(d.tax),
        method: d.method, jobId: d.jobId, notes: d.notes, receipt: receipt?.src || '', receiptImg: receipt?.img || '', recurring: !!d.recurring });
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
    <label class="check full"><input type="checkbox" name="taxable" ${s.taxable !== false ? 'checked' : ''}> Charge ${esc(db.settings.taxName)} on this item</label>
    <label class="check full"><input type="checkbox" name="addon" ${s.addon ? 'checked' : ''}> Offer as an add-on on service plans</label></div>`,
    footExtra: isNew ? '' : `<button type="button" class="btn btn-danger js-del">Delete</button>`,
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => { const snap = snapshot(); db.services = db.services.filter(x => x.id !== s.id); close(); refresh(); undoToast(snap, 'Item deleted'); }),
    onSubmit: (f, d) => {
      Object.assign(s, { name: d.name.trim(), price: round2(d.price), unit: d.unit, description: d.description, taxable: !!d.taxable, addon: !!d.addon });
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
  modal({ title: `Photo · ${fmtDate(ph.date)}`, wide: true, noFoot: true, body: `<img ${imgAttr(ph)} alt="" style="width:100%;border-radius:8px">
    <div class="row" style="margin-top:12px"><a class="btn btn-sm" ${ph.src ? `href="${ph.src}"` : `href="#" data-img-href="${ph.img}"`} download="job-photo-${ph.date}.jpg">${icon('download')}Save</a>
    <button type="button" class="btn btn-sm btn-danger js-del">${icon('trash')}Delete photo</button></div>`,
    onMount: (f, close) => { hydrateImages(f); $('.js-del', f).addEventListener('click', () => { const snap = snapshot(); j.photos = j.photos.filter(p => p.id !== pid); close(); refresh(); undoToast(snap, 'Photo deleted'); }); } });
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
      ['Door knocks', db.pins.filter(x => has(x.address, x.name, x.phone, x.notes)).map(x => [`pin:${x.id}`, x.address || x.name || 'Pinned house', `${KNOCK[x.status]?.label || ''}${x.notes ? ' · ' + x.notes.slice(0, 40) : ''}`])],
      ['Service plans', db.subscriptions.filter(x => has(x.number, x.name, custName(x.customerId))).map(x => [`#/plans/${x.id}`, `${x.number} · ${custName(x.customerId)}`, `${x.name} · ${planStatus(x)}`])],
      ['Quotes', db.quotes.filter(x => has(x.number, custName(x.customerId))).map(x => [`#/quotes/${x.id}`, `${x.number} · ${custName(x.customerId)}`, `${money(totals(x).total)} · ${quoteStatus(x)}`])],
      ['Invoices', db.invoices.filter(x => has(x.number, custName(x.customerId))).map(x => [`#/invoices/${x.id}`, `${x.number} · ${custName(x.customerId)}`, `${money(totals(x).total)} · ${invStatus(x)}`])],
    ].filter(g => g[1].length);
    out.innerHTML = groups.length ? groups.map(([l, items]) => `<h3 class="group-label">${l}</h3>${items.slice(0, 6).map(([href, t, sub]) =>
      href.startsWith('pin:') ? `<button type="button" class="list-item search-hit" data-pin="${href.slice(4)}"><div class="grow"><div class="title">${esc(t)}</div><div class="muted small">${esc(sub)}</div></div></button>`
      : href.startsWith('lead:') ? `<button type="button" class="list-item search-hit" data-lead="${href.slice(5)}"><div class="grow"><div class="title">${esc(t)}</div><div class="muted small">${esc(sub)}</div></div></button>`
        : `<a class="list-item search-hit" href="${href}"><div class="grow"><div class="title">${esc(t)}</div><div class="muted small">${esc(sub)}</div></div></a>`).join('')}`).join('')
      : '<p class="muted small">No matches.</p>';
  };
  input.addEventListener('input', run);
  out.addEventListener('click', e => { const pp = e.target.closest('[data-pin]'); if (pp) { form.closest('.modal-backdrop').remove(); pinForm(byId('pins', pp.dataset.pin)); return; } });
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
      db.expenses.push({ ...e, id: uid(), date: e.recurNext, receipt: '', receiptImg: '', recurring: false, recurNext: '', recurFrom: e.id });
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
/** With Stripe connected, invoice messages include a pay-online link. */
async function payUrlFor(type, d) {
  if (type === 'quote') { try { return await quoteLink(d); } catch { return ''; } }
  if (type !== 'invoice' || !stripeOn() || balance(d) <= 0) return '';
  try { return await ensurePayLink(d); } catch (e) { toast('Sent without a pay link: ' + e.message); return ''; }
}
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
    const n = db.jobs.filter(j => j.customerId === ds.id).length + db.invoices.filter(i => i.customerId === ds.id).length + db.quotes.filter(q => q.customerId === ds.id).length
      + db.subscriptions.filter(x => x.customerId === ds.id).length;
    if (n) return alert('This customer has jobs, quotes, invoices or service plans. Delete those first, so your records stay complete.');
    if (!confirm('Delete this customer?')) return;
    const snap = snapshot();
    db.customers = db.customers.filter(c => c.id !== ds.id);
    db.leads.forEach(l => { if (l.customerId === ds.id) l.customerId = ''; });
    db.tasks.forEach(t => { if (t.customerId === ds.id) t.customerId = ''; });
    db.incomes.forEach(t => { if (t.customerId === ds.id) t.customerId = ''; });
    db.pins.forEach(t => { if (t.customerId === ds.id) t.customerId = ''; });
    save(); go('#/customers'); undoToast(snap, 'Customer deleted');
  },
  importCustomers: () => modal({ title: 'Import customers from CSV', submitLabel: 'Import', body: `<p class="muted small">Upload a CSV with a header row. Columns named <b>name</b>, <b>email</b>, <b>phone</b>, <b>address</b> and <b>notes</b> are recognised (e.g. an export from Homebase, Jobber, or your phone contacts).</p><input type="file" accept=".csv,text/csv" name="file" required>`,
    onSubmit: f => {
      const file = f.file.files[0]; if (!file) return false;
      file.text().then(txt => {
        const rows = parseCSV(txt); const hdr = (rows.shift() || []).map(h => h.toLowerCase().trim());
        const col = (...names) => hdr.findIndex(h => names.some(n => h === n || h.includes(n)));
        const ci = { name: col('name', 'customer'), first: col('first'), last: col('last'), email: col('email'), phone: col('phone', 'mobile'), address: col('address', 'street'), notes: col('note') };
        let n = 0, skipped = 0;
        for (const r of rows) {
          const name = (ci.first >= 0 && ci.last >= 0 ? `${r[ci.first] || ''} ${r[ci.last] || ''}` : r[ci.name] || '').trim();
          if (!name) continue;
          const phone = formatPhone(r[ci.phone] || ''), email = (r[ci.email] || '').trim(), digits = x => String(x || '').replace(/\D/g, '').slice(-10);
          if (db.customers.some(c => (phone && digits(c.phone) && digits(c.phone) === digits(phone)) || (email && (c.email || '').toLowerCase() === email.toLowerCase()))) { skipped++; continue; }
          db.customers.push({ id: uid(), createdAt: today(), name, email, phone, address: r[ci.address] || '', notes: r[ci.notes] || '' }); n++;
        }
        refresh(); toast(`Imported ${n} customer${n === 1 ? '' : 's'}${skipped ? ` · ${skipped} already saved, skipped` : ''}`);
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
  payDefaults: () => payDefaultsForm(),
  payCommission: ds => payCommission(ds.name),
  newMember: () => memberForm(), editMember: ds => memberForm(byId('team', ds.id)),
  myClock: ds => {
    const m = me(); if (!m) return chooseMe(() => ACTIONS.myClock(ds));
    const e = openEntry(m.id);
    if (e) { e.out = localStamp(); refresh(); toast(`Clocked out · ${fmtHours(hoursOf(e))}`); return; }
    const job = ds.job || db.jobs.find(j => j.date === today() && (j.assignedTo || '').toLowerCase() === m.name.toLowerCase() && j.status !== 'completed')?.id || '';
    db.timeEntries.push({ id: uid(), memberId: m.id, in: localStamp(), out: '', breakMin: 0, jobId: job, approved: false });
    refresh(); toast(`Clocked in at ${fmtClock(localStamp())}${job ? ' · ' + byId('jobs', job).title : ''}`);
  },
  editPin: ds => pinForm(byId('pins', ds.id)),
  pinHere: async () => {
    try {
      const [lat, lng] = await currentPosition();
      if (map) map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 19), duration: 600 });
      dropPin(lat, lng);
    } catch { toast('Allow location for this site to pin where you are, or tap the house on the map.'); }
  },
  mapLocate: async () => {
    if (geoCtl) { geoCtl.trigger(); return; }
    try { const [lat, lng] = await currentPosition(); map?.easeTo({ center: [lng, lat], zoom: 18 }); }
    catch { toast('Location is off. Allow location access for this site in your browser settings.'); }
  },
  mapStyle: (ds, el) => {
    state.mapStyle = state.mapStyle === 'street' ? 'sat' : 'street';
    const sat = state.mapStyle !== 'street';
    if (map?.isStyleLoaded()) { map.setLayoutProperty('osm', 'visibility', sat ? 'none' : 'visible'); ['sat', 'roads', 'places'].forEach(l => map.setLayoutProperty(l, 'visibility', sat ? 'visible' : 'none')); }
    el.innerHTML = icon(sat ? 'map' : 'camera'); el.setAttribute('aria-label', sat ? 'Show street map' : 'Show satellite');
    toast(sat ? 'Satellite view' : 'Street map');
  },
  mapNorth: () => map?.easeTo({ bearing: 0, pitch: 0, duration: 500 }),
  mapWhen: (ds, el) => {
    (state.filters.canvass ||= {}).when = ds.v;
    $$('.map-when button').forEach(b => b.classList.toggle('active', b === el));
    drawPins();
  },
  showDue: () => showDueList(),
  showMore: ds => { (state.limits ||= {})[ds.k] = (state.limits[ds.k] || 100) + 200; render(); },
  statPeriod: ds => { const f = (state.filters.canvassStats ||= {}); f.period = ds.v; f.offset = 0; render(); },
  statMove: ds => { const f = (state.filters.canvassStats ||= {}); f.offset = Math.min(0, (+f.offset || 0) + +ds.n); render(); },
  newPlan: ds => planForm(null, { customerId: ds.cust }), editPlan: ds => planForm(byId('subscriptions', ds.id)),
  dupPlan: ds => { const o = byId('subscriptions', ds.id); planForm(null, { ...structuredClone(o), customerId: '', id: undefined }); },
  deletePlan: ds => {
    const p = byId('subscriptions', ds.id);
    const fut = planJobs(p).filter(j => j.status === 'scheduled' && j.date >= today());
    if (!confirm(`Delete ${p.number}?${fut.length ? ` Its ${fut.length} upcoming visit(s) are removed too.` : ''}`)) return;
    const snap = snapshot(), ids = new Set(fut.map(j => j.id));
    db.subscriptions = db.subscriptions.filter(x => x.id !== p.id); db.jobs = db.jobs.filter(j => !ids.has(j.id));
    save(); go('#/plans'); undoToast(snap, `${p.number} deleted`);
  },
  signPlan: ds => signPlanInPerson(byId('subscriptions', ds.id)),
  sendPlan: ds => sendPlan(byId('subscriptions', ds.id)),
  cancelPlan: ds => cancelPlanForm(byId('subscriptions', ds.id)),
  renewPlan: ds => { const p = byId('subscriptions', ds.id); renewPlanTerm(p); refresh(); toast(`Renewed until ${fmtDate(p.end)}`); },
  printPlan: ds => { const p = byId('subscriptions', ds.id), old = document.title; document.title = `Service agreement ${p.number} - ${custName(p.customerId)}`; window.print(); setTimeout(() => { document.title = old; }, 1000); },
  newTemplate: () => templateForm(), editTemplate: ds => templateForm(byId('planTemplates', ds.id)),
  planSettings: () => { (state.filters.settings ||= {}).tab = 'plans'; go('#/settings'); },
  newCard: ds => cardForm(cust(ds.id)),
  editCard: ds => {
    const c = cust(ds.id), k = (c.cards || []).find(x => x.id === ds.cid);
    if (!k?.pmId) return cardForm(c, k);
    modal({ title: cardLabel(k), noFoot: true, body: `<p class="muted small" style="margin-top:0">Saved securely in Stripe · exp ${esc(k.exp)}${k.wallet ? ' · ' + esc(k.wallet.replace('_', ' ')) : ''}</p>
      <div class="stack" style="gap:8px">${k.isDefault ? '<span class="badge info" style="align-self:flex-start">Default card</span>' : '<button type="button" class="btn js-def">Make default card</button>'}
      <button type="button" class="btn btn-danger js-rm">Remove card from Stripe</button></div>`,
      onMount: (f, close) => {
        $('.js-def', f)?.addEventListener('click', () => { c.cards.forEach(x => { x.isDefault = x === k; }); close(); refresh(); });
        $('.js-rm', f).addEventListener('click', async () => {
          if (!confirm(`Remove ${cardLabel(k)}? You won’t be able to charge it any more.`)) return;
          try { await payApi('/cards/remove', { paymentMethod: k.pmId }); await syncStripeCards(c); close(); render(); toast('Card removed'); } catch (e) { alert(e.message); }
        });
      } });
  },
  goCustomerCards: ds => go('#/customers/' + ds.id),
  chargeCard: ds => { const inv = byId('invoices', ds.id); if (stripeOn() && stripeCard(inv.customerId)) stripeChargeForm(inv); else chargeCard(inv); },
  payLink: ds => sendPayLink(byId('invoices', ds.id)),
  checkPaid: ds => { const inv = byId('invoices', ds.id); checkPayLink(inv).then(paid => { if (paid) { render(); toast('Paid online ✓'); } }); },
  refundPay: ds => { const inv = byId('invoices', ds.id); refundPayment(inv, inv.payments.find(x => x.id === ds.pid)); },
  stripeCardLink: ds => stripeCardLink(cust(ds.id)),
  syncCards: ds => syncStripeCards(cust(ds.id)).then(n => { render(); toast(n ? `${n} Stripe card${n > 1 ? 's' : ''} on file` : 'No cards saved in Stripe yet'); }).catch(e => alert(e.message)),
  stripeTest: () => testStripe(),
  stripeTestSave: () => { const f = $('#settingsForm'); f.requestSubmit(); setTimeout(() => { if (stripeOn()) testStripe(); else toast('Enter the payment server address and app token first'); }, 50); },
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
    if (ds.s === 'completed' && j.planId) autoChargeVisit(j);
    if (ds.s === 'completed') jobDoneSheet(j); else toast('Status updated');
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
    if (isPhone()) {
      const cur = location.hash.split('/')[1] || 'dashboard';
      const groups = [{ label: '', items: [] }];
      NAV.forEach(([k, l, ic]) => (k === 'label' ? groups.push({ label: l, items: [] }) : groups.at(-1).items.push([k, l, ic])));
      modal({ title: 'All sections', noFoot: true, focus: false, body: groups.map(gr => `<h3 class="group-label">${esc(gr.label)}</h3>
        <div class="app-grid">${gr.items.map(([k, l, ic]) => `<a class="app-tile ${k === cur ? 'active' : ''}" href="#/${k}"><span class="app-tile-ic" style="--tint:${TINT[k]}">${icon(ic)}</span><span>${esc(l)}</span></a>`).join('')}</div>`).join('') });
      return;
    }
    $('#sidebar').classList.add('open');
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    scrim.onclick = () => { $('#sidebar').classList.remove('open'); scrim.remove(); };
    document.body.append(scrim);
  },
  openDrawer: () => {
    const sb = $('#sidebar');
    if (sb.classList.contains('open')) { sb.classList.remove('open'); $('.scrim')?.remove(); return; }
    sb.classList.add('open'); sb.scrollTop = 0;
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    scrim.onclick = () => { sb.classList.remove('open'); scrim.remove(); };
    document.body.append(scrim);
  },
  openSearch: () => openSearch(),
  hideSetup: () => { db.settings.hideSetup = true; refresh(); },
  hideInstall: () => { db.settings.hideInstall = true; refresh(); },
  quickSetup: () => quickSetupForm(),
  bookingShare: () => bookingShare(),
  sendReminders: () => remindersSheet(),
  remindOverdue: () => overdueSheet(),
  followQuotes: () => quoteFollowSheet(),
  onMyWay: ds => { const j = byId('jobs', ds.id), c = cust(j.customerId); openSms(c.phone, fillTemplate('tplOnWay', { ...custVars(c) })); j.onWayAt = localStamp(); save(); },
  connectStripe: () => connectStripeWizard(),
  newMessage: ds => newMessageForm({ customerId: ds.cust }),
  newBlast: () => blastForm(),
  checkInbox: () => checkInbox(true),
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
  docEmail: async ds => {
    const d = docOf(ds), c = cust(d.customerId) || {}, url = await payUrlFor(ds.type, d);
    const subj = `${ds.type === 'invoice' ? 'Invoice' : 'Quote'} ${d.number} from ${db.settings.businessName || ''}`.trim();
    location.href = mailHref(c.email, subj, docMessage(ds.type, d, 'send', url));
    markSent(ds.type, d); save(); setTimeout(render, 400);
    toast('Tip: attach the PDF. Use Print / PDF → Save as PDF.');
  },
  docText: async ds => {
    const d = docOf(ds), c = cust(d.customerId) || {}, url = await payUrlFor(ds.type, d);
    openSms(c.phone, docMessage(ds.type, d, 'send', url));
    markSent(ds.type, d); save(); setTimeout(render, 400);
  },
  docRemind: async ds => {
    const d = docOf(ds), c = cust(d.customerId) || {}, msg = docMessage('invoice', d, 'reminder', await payUrlFor('invoice', d));
    if (c.phone) openSms(c.phone, msg); else location.href = mailHref(c.email, `Reminder: invoice ${d.number}`, msg);
    d.remindedAt = today(); save(); setTimeout(render, 400);
  },
  docFollow: async ds => {
    const d = docOf(ds), c = cust(d.customerId) || {}, msg = docMessage('quote', d, 'followup', await payUrlFor('quote', d));
    if (c.phone) openSms(c.phone, msg); else location.href = mailHref(c.email, `Following up on quote ${d.number}`, msg);
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
  quoteCopyLink: async ds => {
    const q = byId('quotes', ds.id), link = await quoteLink(q);
    try { await navigator.clipboard.writeText(link); toast('Approval link copied'); } catch { prompt('Copy this link:', link); }
    markSent('quote', q); refresh();
  },
  quotePreview: async ds => { const w = window.open('', '_blank'); const link = await quoteLink(byId('quotes', ds.id)); if (w) w.location = link; else location.href = link; },
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
  quoteToJob: ds => { const q = docOf(ds), items = chosenItems(q.items); jobForm(null, { customerId: q.customerId, title: (items[0]?.desc || 'Job') + (items.length > 1 ? ' + more' : ''), items: structuredClone(items), discount: q.discount, taxRate: q.taxRate, quoteId: q.id, address: q.serviceAddress }); },
  quoteToInvoice: ds => {
    const q = docOf(ds), credit = depositCredit(q.id);
    const inv = invoiceFromItems({ ...q, items: chosenItems(q.items) }, { quoteId: q.id, jobId: q.jobId });
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
    const images = {};
    for (const id of imageIds(db)) { const v = await getImage(id); if (v) images[id] = v; }
    const name = `business-hub-backup-${today()}.json`, data = JSON.stringify({ ...db, settings: { ...db.settings, stripeToken: '' }, images });
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
      file.text().then(async t => {
        let d; try { d = JSON.parse(t); if (!d.settings || !Array.isArray(d.invoices)) throw 0; } catch { return alert('That file is not a valid backup.'); }
        const { images = {}, ...rest } = d, keep = { stripeToken: db.settings.stripeToken, meId: db.settings.meId };
        if (storageMode === 'idb') { for (const [id, v] of Object.entries(images)) { await idb.set('img:' + id, v); imgCache.set(id, v); } }
        else rest.jobs?.forEach(j => (j.photos || []).forEach(ph => { if (ph.img && images[ph.img]) { ph.src = images[ph.img]; delete ph.img; } }));
        db = normalize(rest);
        if (!db.settings.stripeToken && keep.stripeToken) db.settings.stripeToken = keep.stripeToken;
        refresh(); go('#/dashboard'); toast('Backup restored');
      }); } }),
  eraseAll: async () => {
    if (!(confirm('Erase ALL data in this browser? Download a backup first if you might need it.') && confirm('Are you absolutely sure?'))) return;
    await takeSnapshot(true); // today's copy, so this can be undone from Settings → Data
    const s = db.settings; db = blank(); if (confirm('Keep your business settings (name, logo, tax)?')) db.settings = s;
    refresh(); go('#/dashboard'); toast('Erased. Changed your mind? Settings → Data & backup → Automatic daily copies.');
  },
  restoreSnap: async ds => { if (confirm(`Replace your current data with the copy from ${fmtDate(ds.k.slice(5))}?`)) await restoreSnapshot(ds.k); },
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
$('#menuBtn').addEventListener('click', () => ACTIONS.openDrawer());
// Pull down at the top of a screen to check for approvals, booking requests and texts.
(() => {
  let y0 = null, pulled = 0;
  const ind = document.createElement('div'); ind.className = 'ptr'; ind.innerHTML = icon('repeat'); document.body.append(ind);
  document.addEventListener('touchstart', e => {
    y0 = isPhone() && scrollY <= 0 && !$('#modalRoot').children.length && !$('.sheet-backdrop') && !document.body.classList.contains('map-mode') && !e.target.closest('.sidebar, textarea, .kanban, .chat') ? e.touches[0].clientY : null;
    pulled = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (y0 === null) return;
    pulled = Math.max(0, e.touches[0].clientY - y0);
    if (scrollY > 0) { y0 = null; pulled = 0; }
    ind.style.transform = `translate(-50%, ${Math.min(pulled, 110) * .7 - 40}px) rotate(${pulled * 3}deg)`;
    ind.classList.toggle('ready', pulled > 90); ind.style.opacity = Math.min(1, pulled / 60);
  }, { passive: true });
  document.addEventListener('touchend', async () => {
    if (y0 === null) return;
    const go2 = pulled > 90; y0 = null; pulled = 0;
    if (!go2) { ind.style.opacity = 0; ind.style.transform = ''; return; }
    ind.classList.add('spin');
    try { const n = await checkInbox(); if (!n) { render(); toast('Up to date'); } } finally { ind.classList.remove('spin', 'ready'); ind.style.opacity = 0; ind.style.transform = ''; }
  });
})();
// Swipe in from the left edge to open the menu, swipe it back to close.
(() => {
  let x0 = null, y0 = 0, mode = '';
  document.addEventListener('touchstart', e => {
    if (!isPhone() || $('#modalRoot').children.length || document.body.classList.contains('map-mode')) return;
    const t = e.touches[0], open = $('#sidebar').classList.contains('open');
    mode = open ? 'close' : t.clientX < 22 ? 'open' : '';
    x0 = mode ? t.clientX : null; y0 = t.clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (x0 === null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = Math.abs(t.clientY - y0); x0 = null;
    if (dy > 60) return;
    if (mode === 'open' && dx > 50) ACTIONS.openDrawer();
    if (mode === 'close' && dx < -50) { $('#sidebar').classList.remove('open'); $('.scrim')?.remove(); }
  }, { passive: true });
})();
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
    try { (j.photos ||= []).push({ id: uid(), date: today(), ...(await putImage(await readImage(file, 1400, 0.7))) }); }
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
    ['Pressure washing – driveway', 220, 'job'], ['Lawn maintenance visit', 65, 'visit'], ['Materials', 1, 'each'],
    ['Interior window cleaning + track cleaning', 120, 'job'], ['Screen cleaning', 40, 'job']];
  const ADDONS = ['Gutter cleaning', 'Pressure washing – driveway', 'Interior window cleaning + track cleaning', 'Screen cleaning'];
  const services = svc.map(([name, price, unit]) => ({ id: uid(), name, price, unit, taxable: true, addon: ADDONS.includes(name) }));
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
      { id: uid(), name: 'Mike', role: 'Technician', color: TEAM_COLORS[1], phone: '', email: '', rate: 24 },
      { id: uid(), name: 'Jordan', role: 'Sales', color: TEAM_COLORS[2], phone: '', email: '', rate: 0, salesPct: 25 });
    custs.slice(0, 4).forEach(c => { c.salesRep = 'Jordan'; });
    for (const c of custs.slice(0, 4)) { const first = db.jobs.filter(j => j.customerId === c.id).sort((a, b) => a.date.localeCompare(b.date))[0]; if (first) first.salesRep = 'Jordan'; }
    db.jobs.filter(j => j.status === 'completed' && j.date < addDays(t, -14)).forEach(j => { j.cleanerPaid = j.date; if (j.salesRep) j.salesPaid = j.date; });
    const mike = db.team[1];
    for (let k = -6; k < 0; k++) { const d = addDays(t, k); if (parseD(d).getDay() % 6) db.timeEntries.push({ id: uid(), memberId: mike.id, in: `${d}T08:0${k + 7}`, out: `${d}T16:3${k + 7}`, breakMin: 30, approved: k < -3 }); }
  }
  if (!db.pins.length) {
    const streets = [['Maple Cres', 43.6702, -79.4655], ['Lakeview Dr', 43.6718, -79.4631], ['Oak Ave', 43.6689, -79.4609]];
    const weights = ['nothome', 'nothome', 'no', 'no', 'no', 'comeback', 'quote', 'sale', 'nothome', 'no'];
    for (let d = -40; d <= 0; d += 1 + Math.floor(rnd() * 3)) {
      const day = addDays(t, d), n = 6 + Math.floor(rnd() * 14);
      for (let i = 0; i < n; i++) {
        const [st, la, lo] = pick(streets), num = 2 + Math.floor(rnd() * 120) * 2, status = pick(weights);
        const hh = 10 + Math.floor(rnd() * 9), mm = pad(Math.floor(rnd() * 60));
        db.pins.push({ id: uid(), lat: la + (num - 120) * 0.000012 + (rnd() - .5) * 0.0002, lng: lo + (num - 120) * 0.000035 + (rnd() - .5) * 0.0002,
          address: `${num} ${st}, Toronto, ON`, status, name: ['sale', 'quote', 'comeback'].includes(status) ? pick(['Jordan', 'Sam Lee', 'Pat Moreau', 'Chris Ng', 'Taylor']) : '',
          phone: '', notes: status === 'comeback' ? pick(['Asked to come back on the weekend', 'Talk to spouse first', 'Call after 5pm']) : status === 'no' ? pick(['', 'Does it themselves', 'Just had it done']) : '',
          comebackDate: status === 'comeback' ? addDays(day, 3 + Math.floor(rnd() * 5)) : '', createdAt: day,
          history: [{ at: `${day}T${pad(hh)}:${mm}`, status, rep: pick(['Alex', 'Alex', 'Mike']) }] });
      }
    }
  }
  if (!db.planTemplates.length) {
    const tpl = { id: uid(), name: 'Window cleaning: 2 cleans a year', description: 'Spring and fall', billing: 'per_visit', termMonths: 12, minVisits: 2,
      cancelFee: 50, autoRenew: true, rule: { freq: 'month', interval: 6 }, items: [{ desc: 'Window cleaning (exterior)', details: 'All exterior windows, screens and sills', qty: 1, price: 240, taxable: true }], addons: [], discount: 0, taxRate: db.settings.taxRate };
    db.planTemplates.push(tpl,
      { id: uid(), name: 'Lawn care: weekly, May to October', billing: 'monthly', termMonths: 6, minVisits: 4, cancelFee: 50, autoRenew: false, rule: { freq: 'week', interval: 1, weekdays: [3] },
        items: [{ desc: 'Weekly lawn mowing & trimming', details: '', qty: 1, price: 220, taxable: true }], discount: 0, taxRate: db.settings.taxRate });
    const [c1, c2] = [custs[4], custs[6]];
    c1.cards = [{ id: uid(), name: c1.name, brand: 'Visa', last4: '4242', exp: `08/${String(+t.slice(2, 4) + 2)}`, processor: 'Stripe', isDefault: true, addedAt: addMonths(t, -2) }];
    const signed = { ...structuredClone(tpl), id: uid(), templateId: tpl.id, number: nextPlanNumber(), customerId: c1.id, address: c1.address, start: addMonths(t, -2), status: 'draft', createdAt: addMonths(t, -2), assignedTo: 'Mike',
      addons: [{ id: uid(), desc: 'Interior window cleaning + track cleaning', details: '', qty: 1, price: 120, taxable: true, when: 'every' }, { id: uid(), desc: 'Gutter cleaning', details: '', qty: 1, price: 180, taxable: true, when: 'once' }] };
    db.subscriptions.push(signed);
    signed.signature = { name: c1.name, at: `${addMonths(t, -2)}T10:15:00.000Z`, method: 'in_person', hash: 'sample', strokes: [[[20, 150], [40, 90], [60, 160], [80, 70], [100, 150], [120, 110]], [[140, 140], [170, 100], [200, 130], [235, 90]]] };
    signed.cardId = c1.cards[0].id; signed.status = 'active'; signed.activatedAt = signed.start; signed.seriesId = uid(); signed.end = planEnd(signed);
    addPlanVisits(signed, signed.start, signed.end);
    db.jobs.filter(j => j.planId === signed.id && j.date < t).forEach(j => { j.status = 'completed'; j.completedAt = j.date; });
    db.subscriptions.push({ ...structuredClone(tpl), id: uid(), templateId: tpl.id, number: nextPlanNumber(), customerId: c2.id, address: c2.address, start: addDays(t, 7), status: 'sent', sentAt: addDays(t, -4), createdAt: addDays(t, -4) });
  }
  const ins = [...db.expenses].reverse().find(e => e.category === 'Insurance');
  if (ins) { ins.recurring = true; ins.recurNext = addMonths(ins.date, 1); }
}

/* =====================================================================
 * Boot
 * ===================================================================== */
const depthOf = h => { const [, n, id] = (h || '').split('#')[1]?.split('/') || []; return n === 'statement' ? 3 : id ? 2 : 1; };
const scrollMem = {};
let lastHash = location.hash;
window.addEventListener('hashchange', e => {
  scrollMem[lastHash] = scrollY;
  const from = depthOf(lastHash), to = depthOf(location.hash);
  const dir = to > from ? 'push' : to < from ? 'pop' : 'swap';
  lastHash = location.hash;
  $('#modalRoot').innerHTML = ''; render();
  window.scrollTo(0, dir === 'pop' ? scrollMem[location.hash] || 0 : 0);
  updateNavBar();
  const m = $('#main'); m.classList.remove('nav-push', 'nav-pop', 'nav-swap'); void m.offsetWidth; m.classList.add('nav-' + dir);
});
$('#backBtn').addEventListener('click', () => {
  const [, name] = location.hash.split('/');
  if (history.length > 1) history.back(); else go('#/' + (name || 'dashboard'));
});
new MutationObserver(() => document.body.classList.toggle('modal-open', $('#modalRoot').children.length > 0)).observe($('#modalRoot'), { childList: true });
if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) document.documentElement.classList.add('standalone');
try { Object.assign(state, JSON.parse(localStorage.getItem('bizhub.ui') || '{}')); } catch { /* ignore */ }
state.calDay = today(); state.calMonth = today().slice(0, 7); state.tsWeek = '';
window.addEventListener('pagehide', () => { try { localStorage.setItem('bizhub.ui', JSON.stringify({ calView: state.calView, calTeam: state.calTeam, filters: state.filters, mapStyle: state.mapStyle, mapView: state.mapView })); } catch { /* ignore */ } });
load().then(d => {
  db = d; state.loaded = true;
  processRecurring();
  processPlans();
  render();
  migrateImages().then(() => hydrateImages($('#main')));
  takeSnapshot();
  setTimeout(() => checkInbox(), 1500);
  if (storageMode === 'local') toast('Private browsing detected: data may not be kept. Download backups often.');
});
navigator.storage?.persist?.().catch(() => {}); // ask the browser not to clear our data
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
