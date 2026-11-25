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
function moneyShort(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + +(n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k';
  return '$' + Math.round(n);
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
};
const DEFAULT_CATEGORIES = ['Materials & Supplies', 'Fuel', 'Vehicle Repairs & Maintenance', 'Tools & Equipment', 'Subcontractors',
  'Wages & Payroll', 'Insurance', 'Advertising & Marketing', 'Software & Subscriptions', 'Phone & Internet',
  'Office Supplies', 'Rent & Utilities', 'Meals', 'Licences, Permits & Fees', 'Bank & Payment Fees', 'Professional Fees', 'Other'];
const PAY_METHODS = ['e-Transfer', 'Cash', 'Cheque', 'Credit card', 'Debit', 'Bank transfer', 'Other'];

function blank() {
  return { settings: { ...DEFAULT_SETTINGS }, categories: [...DEFAULT_CATEGORIES], customers: [], services: [], jobs: [],
    quotes: [], invoices: [], expenses: [], incomes: [], mileage: [] };
}
function normalize(d) {
  const b = blank();
  const out = { ...b, ...d, settings: { ...b.settings, ...(d.settings || {}) } };
  for (const k of ['customers', 'services', 'jobs', 'quotes', 'invoices', 'expenses', 'incomes', 'mileage', 'categories'])
    if (!Array.isArray(out[k])) out[k] = b[k];
  return out;
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch { /* fall through */ }
  return blank();
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { toast('Could not save — browser storage is full. Export a backup and remove some receipt photos.'); }
}

const byId = (coll, id) => db[coll].find(x => x.id === id);
const cust = id => byId('customers', id);
const custName = id => cust(id)?.name || '—';

function nextNumber(kind) {
  const s = db.settings;
  if (kind === 'invoice') return s.invoicePrefix + (s.nextInvoiceNo++);
  return s.quotePrefix + (s.nextQuoteNo++);
}

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
function toast(msg) {
  $('.toast')?.remove(); clearTimeout(toastTimer);
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), 2800);
}

function modal({ title, body, wide = false, submitLabel = 'Save', onSubmit, onMount, footExtra = '', noFoot = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<form class="modal ${wide ? 'wide' : ''}" autocomplete="off">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="btn btn-icon" data-close aria-label="Close">✕</button></div>
    <div class="modal-body">${body}</div>
    ${noFoot ? '' : `<div class="modal-foot">${footExtra}<span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary" type="submit">${esc(submitLabel)}</button></div>`}
  </form>`;
  $('#modalRoot').append(wrap);
  const form = $('form', wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (onSubmit?.(form, Object.fromEntries(new FormData(form))) !== false) close();
  });
  onMount?.(form, close);
  setTimeout(() => $('input:not([type=hidden]):not([type=file]),select,textarea', form)?.focus(), 30);
  return { form, close };
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modalRoot .modal-backdrop:last-child')?.remove(); });

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
      <td><input list="svcList" data-k="desc" value="${esc(it.desc)}" placeholder="Service or product"></td>
      <td><input class="qty right" type="number" step="any" data-k="qty" value="${esc(it.qty)}"></td>
      <td><input class="price right" type="number" step="0.01" data-k="price" value="${esc(it.price)}" placeholder="0.00"></td>
      <td class="tx"><input type="checkbox" data-k="taxable" ${it.taxable !== false ? 'checked' : ''}></td>
      <td class="num js-line">${lineAmt(it)}</td>
      <td><button type="button" class="btn btn-icon" data-rm="${i}" aria-label="Remove line">✕</button></td></tr>`).join('');
    drawTotals();
  }
  tb.addEventListener('input', e => {
    const tr = e.target.closest('tr'), k = e.target.dataset.k; if (!tr || !k) return;
    const it = items[+tr.dataset.i];
    it[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k === 'desc') {
      const s = db.services.find(s => s.name === it.desc);
      if (s) { it.price = s.price; it.taxable = s.taxable !== false; $('[data-k=price]', tr).value = s.price; $('[data-k=taxable]', tr).checked = it.taxable; }
    }
    $('.js-line', tr).textContent = lineAmt(it); drawTotals();
  });
  tb.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { items.splice(+b.dataset.rm, 1); if (!items.length) items.push(blankItem()); draw(); } });
  $('.js-add-item', form).addEventListener('click', () => { items.push(blankItem()); draw(); $$('[data-k=desc]', tb).pop()?.focus(); });
  form.discount.addEventListener('input', drawTotals);
  form.taxRate.addEventListener('input', drawTotals);
  draw();
  return () => items.filter(it => String(it.desc).trim() || +it.price)
    .map(it => ({ desc: String(it.desc).trim(), qty: +it.qty || 0, price: round2(it.price), taxable: it.taxable !== false }));
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
  ['dashboard', 'Dashboard', 'home'], ['schedule', 'Schedule', 'calendar'], ['jobs', 'Jobs', 'jobs'],
  ['customers', 'Customers', 'users'], ['quotes', 'Quotes', 'quote'], ['invoices', 'Invoices', 'invoice'],
  ['sep'], ['income', 'Income', 'income'], ['expenses', 'Expenses', 'expense'], ['reports', 'Reports', 'reports'],
  ['sep'], ['services', 'Price Book', 'tag'], ['settings', 'Settings', 'settings'],
];
const state = { calMonth: today().slice(0, 7), calDay: today(), filters: {} };
const filt = (view, key, def) => (state.filters[view] ||= {})[key] ?? def;

function renderChrome() {
  const s = db.settings;
  $$('.js-bizname').forEach(el => el.textContent = s.businessName || 'Business Hub');
  $$('.js-logo').forEach(el => el.innerHTML = s.logo ? `<img src="${s.logo}" alt="">` : esc((s.businessName || 'B')[0].toUpperCase()));
  const cur = (location.hash.split('/')[1] || 'dashboard');
  $('#nav').innerHTML = NAV.map(([k, l, ic]) => k === 'sep' ? '<div class="sep"></div>' :
    `<a href="#/${k}" class="${cur === k ? 'active' : ''}">${icon(ic)}<span>${l}</span></a>`).join('');
  const theme = s.theme === 'auto' ? null : s.theme;
  if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
}

function render() {
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
    invoices: 'newInvoice', expenses: 'newExpense', income: 'newIncome', services: 'newService' };
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
  const staleQuotes = db.quotes.filter(q => q.status === 'sent' && q.sentAt && daysBetween(q.sentAt, t) >= 3 && quoteStatus(q) !== 'expired');
  const uninvoiced = db.jobs.filter(j => j.status === 'completed' && !j.invoiceId && !j.noInvoice);
  const lateJobs = db.jobs.filter(j => j.status === 'scheduled' && j.date && j.date < t);
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const isEmpty = !db.customers.length && !db.invoices.length && !db.jobs.length;

  const welcome = isEmpty ? `<div class="card" style="margin-bottom:16px"><h2>Welcome! Let’s get your business set up 👋</h2>
    <p class="muted">Add your business details and logo so they appear on quotes and invoices, then add your first customer.
    Want to look around first? Load sample data — you can erase it any time from Settings.</p>
    <div class="row"><a class="btn btn-primary" href="#/settings">Set up my business</a>${btn('Add a customer', 'newCustomer')}${btn('Load sample data', 'loadSample')}</div></div>` : '';

  const alerts = [
    overdue.length && `<a class="alert bad" href="#/invoices">${icon('alert')}<span><b>${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}</b> totalling ${money(sum(overdue, balance))} — send a reminder.</span></a>`,
    uninvoiced.length && `<a class="alert warn" href="#/jobs" data-tabset="jobs:tab:uninvoiced">${icon('invoice')}<span><b>${uninvoiced.length} completed job${uninvoiced.length > 1 ? 's' : ''}</b> not invoiced yet.</span></a>`,
    staleQuotes.length && `<a class="alert info" href="#/quotes">${icon('quote')}<span><b>${staleQuotes.length} quote${staleQuotes.length > 1 ? 's' : ''}</b> sent 3+ days ago with no answer — time to follow up.</span></a>`,
    lateJobs.length && `<a class="alert warn" href="#/jobs" data-tabset="jobs:tab:late">${icon('calendar')}<span><b>${lateJobs.length} past job${lateJobs.length > 1 ? 's' : ''}</b> still marked as scheduled — mark them complete.</span></a>`,
  ].filter(Boolean);

  const delta = incLast ? Math.round((inc - incLast) / incLast * 100) : null;
  return head(`${greet}${s.ownerName ? ', ' + esc(firstName(s.ownerName)) : ''}`,
    btn('Job', 'newJob', '', '', 'plus') + btn('Quote', 'newQuote', '', '', 'plus') + btn('Invoice', 'newInvoice', 'btn-primary', '', 'plus'),
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })) + welcome + `
  <div class="grid grid-4">
    <div class="card stat"><div class="label">Income this month</div><div class="value">${money(inc)}</div>
      <div class="sub">${delta === null ? 'Payments received' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs last month`}</div></div>
    <div class="card stat"><div class="label">Expenses this month</div><div class="value">${money(exp)}</div><div class="sub">${db.expenses.filter(x => inRange(x.date, m0, m1)).length} expenses</div></div>
    <div class="card stat"><div class="label">Net profit this month</div><div class="value" style="color:${inc - exp < 0 ? 'var(--bad)' : 'inherit'}">${money(inc - exp)}</div><div class="sub">${inc ? Math.round((inc - exp) / inc * 100) + '% margin' : '—'}</div></div>
    <div class="card stat"><div class="label">Owed to you</div><div class="value">${money(ar)}</div><div class="sub">${open.length} open · <span style="color:${overdue.length ? 'var(--bad)' : 'inherit'}">${overdue.length} overdue</span></div></div>
  </div>
  ${alerts.length ? `<div class="stack" style="margin-top:16px;gap:8px">${alerts.join('')}</div>` : ''}
  <div class="grid grid-2" style="margin-top:16px">
    <div class="card"><div class="card-head"><h2>Next 7 days</h2><a href="#/schedule" class="small">Open schedule →</a></div>
      ${upcoming.length ? upcoming.slice(0, 8).map(jobListItem).join('') : empty('calendar', 'No jobs scheduled this week.', btn('Schedule a job', 'newJob', 'btn-sm'))}</div>
    <div class="card"><div class="card-head"><h2>Income vs expenses</h2><a href="#/reports" class="small">Reports →</a></div>
      ${incExpChart(monthlyRows(monthsInRange(addMonths(monthStart(t), -5), t)))}</div>
  </div>
  <div class="grid grid-2" style="margin-top:16px">
    <div class="card"><div class="card-head"><h2>Unpaid invoices</h2><a href="#/invoices" class="small">All invoices →</a></div>
      ${open.length ? open.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 6).map(i => `
        <a class="list-item" href="#/invoices/${i.id}" style="color:inherit"><div class="grow"><div class="title">${esc(custName(i.customerId))}</div>
        <div class="muted small">${esc(i.number)} · due ${fmtDate(i.dueDate)}</div></div><div class="right"><div class="num">${money(balance(i))}</div>${badge(invStatus(i))}</div></a>`).join('')
        : empty('check', 'All caught up — nothing owing.')}</div>
    <div class="card"><div class="card-head"><h2>Open quotes</h2><a href="#/quotes" class="small">All quotes →</a></div>
      ${(() => { const qs = db.quotes.filter(q => ['draft', 'sent'].includes(q.status)).slice(-6).reverse();
        return qs.length ? qs.map(q => `<a class="list-item" href="#/quotes/${q.id}" style="color:inherit"><div class="grow"><div class="title">${esc(custName(q.customerId))}</div>
        <div class="muted small">${esc(q.number)} · ${fmtDate(q.date)}</div></div><div class="right"><div class="num">${money(totals(q).total)}</div>${badge(quoteStatus(q))}</div></a>`).join('')
        : empty('quote', 'No open quotes.', btn('Create a quote', 'newQuote', 'btn-sm')); })()}</div>
  </div>`;
};

function jobListItem(j) {
  const d = parseD(j.date);
  return `<a class="list-item" href="#/jobs/${j.id}" style="color:inherit">
    <div class="date-chip"><span>${d.toLocaleDateString(undefined, { month: 'short' })}</span><b>${d.getDate()}</b></div>
    <div class="grow"><div class="title">${esc(j.title)}</div>
    <div class="muted small">${esc(custName(j.customerId))}${j.start ? ' · ' + fmtTime(j.start) : ''}${j.assignedTo ? ' · ' + esc(j.assignedTo) : ''}</div></div>
    ${badge(j.status)}</a>`;
}

/* ---------- Schedule ---------- */
VIEWS.schedule = () => {
  const ym = state.calMonth, first = parseD(ym + '-01');
  const start = addDays(ym + '-01', -first.getDay());
  const t = today();
  const byDate = {};
  for (const j of db.jobs) (byDate[j.date] ||= []).push(j);
  Object.values(byDate).forEach(a => a.sort((x, y) => (x.start || '').localeCompare(y.start || '')));
  let cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), js = byDate[d] || [];
    if (i === 35 && d.slice(0, 7) !== ym) break;
    cells += `<div class="day ${d.slice(0, 7) !== ym ? 'other' : ''} ${d === t ? 'today' : ''}" data-day="${d}" style="${d === state.calDay ? 'outline:2px solid var(--primary);outline-offset:-2px' : ''}">
      <div class="dnum">${+d.slice(8)}</div>
      ${js.slice(0, 3).map(j => `<div class="ev ${j.status}" title="${esc(j.title)}">${j.start ? fmtTime(j.start).replace(':00', '').replace(' ', '').toLowerCase() + ' ' : ''}${esc(j.title)}</div>`).join('')}
      ${js.length > 3 ? `<div class="muted small">+${js.length - 3} more</div>` : ''}</div>`;
  }
  const dayJobs = byDate[state.calDay] || [];
  return head('Schedule', btn('Today', 'calToday') + btn('New job', 'newJob', 'btn-primary', `data-date="${state.calDay}"`, 'plus')) + `
  <div class="grid" style="grid-template-columns:minmax(0,1fr)">
    <div class="card">
      <div class="cal-head"><button class="btn btn-sm" data-act="calMove" data-n="-1">‹</button>
        <h2 style="min-width:150px;text-align:center">${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button class="btn btn-sm" data-act="calMove" data-n="1">›</button></div>
      <div class="cal">${cells}</div>
    </div>
    <div class="card"><div class="card-head"><h2>${fmtDateShort(state.calDay)}</h2>${btn('Add job this day', 'newJob', 'btn-sm', `data-date="${state.calDay}"`, 'plus')}</div>
      ${dayJobs.length ? dayJobs.map(jobListItem).join('') : empty('calendar', 'Nothing scheduled.')}
      ${dayJobs.length ? `<div class="muted small" style="margin-top:8px">Day total: ${money(sum(dayJobs.filter(j => j.status !== 'cancelled'), jobValue))}</div>` : ''}</div>
  </div>`;
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
    ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Job</th><th class="hide-sm">Customer</th><th class="hide-sm">Assigned</th><th>Status</th><th class="num">Value</th></tr></thead><tbody>
    ${list.map(j => `<tr class="clickable" data-href="#/jobs/${j.id}"><td>${j.date ? fmtDateShort(j.date) : '<span class="muted">Unscheduled</span>'}<div class="muted small">${fmtTime(j.start)}</div></td>
      <td><b>${esc(j.title)}</b><div class="muted small">${esc(j.address || '')}</div></td><td class="hide-sm">${esc(custName(j.customerId))}</td>
      <td class="hide-sm">${esc(j.assignedTo || '')}</td><td>${badge(j.status)}${j.invoiceId ? ' <span class="badge">invoiced</span>' : ''}</td><td class="num">${money(jobValue(j))}</td></tr>`).join('')}
    </tbody></table></div>` : empty('jobs', 'No jobs here.', btn('New job', 'newJob', 'btn-sm'))}</div>`;
};

function jobDetail(id) {
  const j = byId('jobs', id); if (!j) return empty('jobs', 'Job not found.');
  const c = cust(j.customerId), inv = j.invoiceId && byId('invoices', j.invoiceId);
  const exps = db.expenses.filter(e => e.jobId === j.id);
  const revenue = jobValue(j), cost = sum(exps, e => e.amount), tax = inv ? totals(inv).tax : totals(j).tax;
  const profit = revenue - tax - cost;
  const statusBtns = {
    scheduled: btn('Start job', 'jobStatus', '', `data-id="${j.id}" data-s="in_progress"`) + btn('Mark complete', 'jobStatus', 'btn-primary', `data-id="${j.id}" data-s="completed"`, 'check'),
    in_progress: btn('Mark complete', 'jobStatus', 'btn-primary', `data-id="${j.id}" data-s="completed"`, 'check'),
    completed: btn('Reopen', 'jobStatus', '', `data-id="${j.id}" data-s="scheduled"`),
    cancelled: btn('Restore', 'jobStatus', '', `data-id="${j.id}" data-s="scheduled"`),
  }[j.status] || '';
  return head(`${esc(j.title)} ${badge(j.status)}`, statusBtns +
    (inv ? `<a class="btn" href="#/invoices/${inv.id}">${icon('invoice')}View invoice</a>` : btn('Create invoice', 'jobToInvoice', j.status === 'completed' ? 'btn-primary' : '', `data-id="${j.id}"`, 'invoice')) +
    btn('Edit', 'editJob', '', `data-id="${j.id}"`, 'edit'), `<a href="#/jobs">← All jobs</a>`) + `
  <div class="grid grid-2">
    <div class="card"><h2 style="margin-bottom:10px">Details</h2>
      <div class="stack" style="gap:8px">
        <div><div class="muted small">Customer</div>${c ? `<a href="#/customers/${c.id}"><b>${esc(c.name)}</b></a>` : '—'}</div>
        <div><div class="muted small">When</div>${j.date ? fmtDateShort(j.date) : 'Unscheduled'}${j.start ? `, ${fmtTime(j.start)}${j.end ? ' – ' + fmtTime(j.end) : ''}` : ''}</div>
        ${j.address ? `<div><div class="muted small">Address</div><a target="_blank" rel="noopener" href="https://maps.google.com/?q=${encodeURIComponent(j.address)}">${esc(j.address)} ↗</a></div>` : ''}
        ${j.assignedTo ? `<div><div class="muted small">Assigned to</div>${esc(j.assignedTo)}</div>` : ''}
        ${j.quoteId && byId('quotes', j.quoteId) ? `<div><div class="muted small">From quote</div><a href="#/quotes/${j.quoteId}">${esc(byId('quotes', j.quoteId).number)}</a></div>` : ''}
        ${j.notes ? `<div><div class="muted small">Notes</div><div style="white-space:pre-wrap">${esc(j.notes)}</div></div>` : ''}
      </div>
      ${c ? `<div class="row" style="margin-top:14px">${contactBtns(c, `Hi ${firstName(c.name)}, this is ${db.settings.businessName || 'us'} — just confirming your appointment${j.date ? ' on ' + fmtDateShort(j.date) : ''}${j.start ? ' at ' + fmtTime(j.start) : ''}. See you then!`)}</div>` : ''}
    </div>
    <div class="card"><div class="card-head"><h2>Job costing</h2>${btn('Add expense', 'newExpense', 'btn-sm', `data-job="${j.id}"`, 'plus')}</div>
      <div class="grid grid-3" style="gap:8px;margin-bottom:12px">
        <div><div class="muted small">Revenue (pre-tax)</div><b class="num">${money(revenue - tax)}</b></div>
        <div><div class="muted small">Costs</div><b class="num">${money(cost)}</b></div>
        <div><div class="muted small">Profit</div><b class="num" style="color:${profit < 0 ? 'var(--bad)' : 'var(--good)'}">${money(profit)}</b></div>
      </div>
      ${exps.length ? exps.map(e => `<div class="list-item clickable" data-act="editExpense" data-id="${e.id}" style="cursor:pointer"><div class="grow"><div class="title">${esc(e.vendor || e.category)}</div><div class="muted small">${fmtDate(e.date)} · ${esc(e.category)}</div></div><span class="num">${money(e.amount)}</span></div>`).join('')
        : '<p class="muted small">Link materials, subcontractor and other costs to this job to see your real profit.</p>'}
    </div>
  </div>
  <div class="card"><h2 style="margin-bottom:10px">Line items</h2>${itemsTable(inv || j)}
    ${inv ? `<p class="muted small">Showing the line items from invoice ${esc(inv.number)}.</p>` : ''}</div>
  <div class="row" style="margin-top:16px">${btn('Duplicate', 'dupJob', 'btn-sm', `data-id="${j.id}"`)}
    ${j.status !== 'cancelled' ? btn('Cancel job', 'jobStatus', 'btn-sm', `data-id="${j.id}" data-s="cancelled"`) : ''}
    ${j.status === 'completed' && !j.invoiceId ? btn(j.noInvoice ? 'Needs invoice' : 'No invoice needed', 'toggleNoInvoice', 'btn-sm', `data-id="${j.id}"`) : ''}
    ${btn('Delete', 'deleteJob', 'btn-sm btn-danger', `data-id="${j.id}"`)}</div>`;
}

function contactBtns(c, smsText = '') {
  return [
    c.phone && `<a class="btn btn-sm" href="tel:${esc(c.phone)}">${icon('phone')}Call</a>`,
    c.phone && `<a class="btn btn-sm" href="sms:${esc(c.phone)}${smsText ? '?&body=' + encodeURIComponent(smsText) : ''}">${icon('sms')}Text</a>`,
    c.email && `<a class="btn btn-sm" href="mailto:${esc(c.email)}">${icon('mail')}Email</a>`,
    c.address && `<a class="btn btn-sm" target="_blank" rel="noopener" href="https://maps.google.com/?q=${encodeURIComponent(c.address)}">${icon('map')}Directions</a>`,
  ].filter(Boolean).join('');
}

/* ---------- Customers ---------- */
VIEWS.customers = id => {
  if (id) return customerDetail(id);
  const q = filt('customers', 'q', '').toLowerCase();
  const list = db.customers.filter(c => !q || `${c.name} ${c.email} ${c.phone} ${c.address} ${c.tags}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  return head('Customers', btn('Import CSV', 'importCustomers', '', '', 'download') + btn('New customer', 'newCustomer', 'btn-primary', '', 'plus'), `${db.customers.length} total`) + `<div class="card">
    <div class="toolbar"><input type="search" placeholder="Search name, phone, email, address…" value="${esc(q)}" data-filter="customers:q"></div>
    ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th class="hide-sm">Phone</th><th class="hide-sm">Email</th><th class="num">Lifetime</th><th class="num">Owing</th></tr></thead><tbody>
    ${list.map(c => { const s = custStats(c.id); return `<tr class="clickable" data-href="#/customers/${c.id}"><td><b>${esc(c.name)}</b><div class="muted small">${esc(c.address || '')}</div></td>
      <td class="hide-sm">${esc(c.phone || '')}</td><td class="hide-sm">${esc(c.email || '')}</td><td class="num">${money(s.paid)}</td>
      <td class="num" style="color:${s.owing > 0 ? 'var(--bad)' : 'inherit'}">${s.owing > 0 ? money(s.owing) : '—'}</td></tr>`; }).join('')}
    </tbody></table></div>` : empty('users', q ? 'No matches.' : 'No customers yet.', q ? '' : btn('Add your first customer', 'newCustomer', 'btn-sm'))}</div>`;
};
function custStats(cid) {
  const invs = db.invoices.filter(i => i.customerId === cid && !i.void);
  return { paid: sum(invs, paidAmt) + sum(db.incomes.filter(i => i.customerId === cid), i => i.amount), owing: sum(invs.filter(isOpenInv), balance) };
}
function customerDetail(id) {
  const c = cust(id); if (!c) return empty('users', 'Customer not found.');
  const s = custStats(id);
  const jobs = db.jobs.filter(j => j.customerId === id).sort((a, b) => b.date.localeCompare(a.date));
  const quotes = db.quotes.filter(q => q.customerId === id).reverse();
  const invs = db.invoices.filter(i => i.customerId === id).reverse();
  const tab = filt('customer', 'tab', 'jobs');
  const lists = {
    jobs: jobs.length ? jobs.map(jobListItem).join('') : empty('jobs', 'No jobs yet.'),
    quotes: quotes.length ? quotes.map(q => `<a class="list-item" style="color:inherit" href="#/quotes/${q.id}"><div class="grow"><div class="title">${esc(q.number)}</div><div class="muted small">${fmtDate(q.date)}</div></div><span class="num">${money(totals(q).total)}</span>${badge(quoteStatus(q))}</a>`).join('') : empty('quote', 'No quotes yet.'),
    invoices: invs.length ? invs.map(i => `<a class="list-item" style="color:inherit" href="#/invoices/${i.id}"><div class="grow"><div class="title">${esc(i.number)}</div><div class="muted small">${fmtDate(i.date)}</div></div><span class="num">${money(totals(i).total)}</span>${badge(invStatus(i))}</a>`).join('') : empty('invoice', 'No invoices yet.'),
  };
  return head(esc(c.name), btn('Edit', 'editCustomer', '', `data-id="${id}"`, 'edit') + btn('Job', 'newJob', '', `data-cust="${id}"`, 'plus') +
    btn('Quote', 'newQuote', '', `data-cust="${id}"`, 'plus') + btn('Invoice', 'newInvoice', 'btn-primary', `data-cust="${id}"`, 'plus'), '<a href="#/customers">← All customers</a>') + `
  <div class="grid grid-3">
    <div class="card"><h2 style="margin-bottom:8px">Contact</h2>
      <div class="stack" style="gap:6px">${c.phone ? `<div>${esc(c.phone)}</div>` : ''}${c.email ? `<div>${esc(c.email)}</div>` : ''}${c.address ? `<div>${esc(c.address)}</div>` : ''}
      ${c.tags ? `<div>${c.tags.split(',').map(t => `<span class="badge">${esc(t.trim())}</span>`).join(' ')}</div>` : ''}
      ${c.notes ? `<div class="muted small" style="white-space:pre-wrap">${esc(c.notes)}</div>` : ''}</div>
      <div class="row" style="margin-top:12px">${contactBtns(c)}</div></div>
    <div class="card stat"><div class="label">Lifetime revenue</div><div class="value">${money(s.paid)}</div><div class="sub">${jobs.filter(j => j.status === 'completed').length} completed jobs</div></div>
    <div class="card stat"><div class="label">Currently owing</div><div class="value" style="color:${s.owing ? 'var(--bad)' : 'inherit'}">${money(s.owing)}</div><div class="sub">Customer since ${fmtDate(c.createdAt)}</div></div>
  </div>
  <div class="card">${tabsHTML('customer', 'tab', [['jobs', `Jobs (${jobs.length})`], ['quotes', `Quotes (${quotes.length})`], ['invoices', `Invoices (${invs.length})`]], tab)}${lists[tab]}</div>
  <div class="row" style="margin-top:16px">${btn('Delete customer', 'deleteCustomer', 'btn-sm btn-danger', `data-id="${id}"`)}</div>`;
}

/* ---------- Quotes ---------- */
VIEWS.quotes = id => {
  if (id) return docView('quote', id);
  const tab = filt('quotes', 'tab', 'open'), q = filt('quotes', 'q', '').toLowerCase();
  const tests = { open: x => ['draft', 'sent'].includes(quoteStatus(x)), approved: x => ['approved', 'converted'].includes(quoteStatus(x)),
    closed: x => ['declined', 'expired'].includes(quoteStatus(x)), all: () => true };
  const list = db.quotes.filter(tests[tab]).filter(x => !q || `${x.number} ${custName(x.customerId)}`.toLowerCase().includes(q)).reverse();
  const sent = db.quotes.filter(x => x.status !== 'draft').length, won = db.quotes.filter(x => ['approved', 'converted'].includes(x.status)).length;
  return head('Quotes', btn('New quote', 'newQuote', 'btn-primary', '', 'plus'), sent ? `Win rate: ${Math.round(won / sent * 100)}% (${won} of ${sent} sent)` : '') + `<div class="card">
    ${tabsHTML('quotes', 'tab', [['open', 'Open'], ['approved', 'Won'], ['closed', 'Declined / expired'], ['all', 'All']], tab)}
    <div class="toolbar"><input type="search" placeholder="Search quotes…" value="${esc(q)}" data-filter="quotes:q"></div>
    ${list.length ? docTable(list, 'quotes', x => quoteStatus(x), x => x.validUntil ? 'Valid to ' + fmtDate(x.validUntil) : '') : empty('quote', 'No quotes here.', btn('New quote', 'newQuote', 'btn-sm'))}</div>`;
};
function docTable(list, route, statusFn, extraFn) {
  return `<div class="table-wrap"><table><thead><tr><th>Number</th><th>Customer</th><th class="hide-sm">Date</th><th>Status</th><th class="num">Total</th>${route === 'invoices' ? '<th class="num">Balance</th>' : ''}</tr></thead><tbody>
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
  return head('Invoices', btn('New invoice', 'newInvoice', 'btn-primary', '', 'plus'), `${money(sum(open, balance))} outstanding across ${open.length} invoice${open.length === 1 ? '' : 's'}`) + `<div class="card">
    ${tabsHTML('invoices', 'tab', [['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['draft', 'Drafts'], ['paid', 'Paid'], ['all', 'All']], tab)}
    <div class="toolbar"><input type="search" placeholder="Search invoices…" value="${esc(q)}" data-filter="invoices:q"></div>
    ${list.length ? docTable(list, 'invoices', invStatus, x => x.dueDate ? 'Due ' + fmtDate(x.dueDate) : '') : empty('invoice', 'No invoices here.', btn('New invoice', 'newInvoice', 'btn-sm'))}</div>`;
};

/* ---------- Invoice / quote document ---------- */
function docHTML(type, d) {
  const s = db.settings, c = cust(d.customerId) || {}, t = totals(d), isInv = type === 'invoice';
  const paid = isInv ? paidAmt(d) : 0, status = isInv ? invStatus(d) : quoteStatus(d);
  return `<div class="doc">
    <div class="doc-top">
      <div>${s.logo ? `<img class="doc-logo" src="${s.logo}" alt="">` : ''}
        <div style="font-weight:700;font-size:16px">${esc(s.businessName || 'Your Business Name')}</div>
        <div style="white-space:pre-line;color:#444">${esc([s.address, s.phone, s.email, s.website].filter(Boolean).join('\n'))}</div>
        ${s.taxNumber ? `<div style="color:#444">${esc(s.taxName)} # ${esc(s.taxNumber)}</div>` : ''}</div>
      <div><h1>${isInv ? 'INVOICE' : 'QUOTE'}</h1>
        <div class="meta"><div><span>${isInv ? 'Invoice' : 'Quote'} #</span><b>${esc(d.number)}</b></div>
        <div><span>Date</span><b>${fmtDate(d.date)}</b></div>
        ${isInv && d.dueDate ? `<div><span>Due</span><b>${fmtDate(d.dueDate)}</b></div>` : ''}
        ${!isInv && d.validUntil ? `<div><span>Valid until</span><b>${fmtDate(d.validUntil)}</b></div>` : ''}</div></div>
    </div>
    <div class="bill-to"><div class="lbl">${isInv ? 'Bill to' : 'Prepared for'}</div><b>${esc(c.name || '')}</b>
      <div style="white-space:pre-line;color:#444">${esc([c.address, c.phone, c.email].filter(Boolean).join('\n'))}</div>
      ${d.serviceAddress && d.serviceAddress !== c.address ? `<div style="margin-top:6px"><span class="lbl">Service address:</span> ${esc(d.serviceAddress)}</div>` : ''}</div>
    <table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>
      ${(d.items || []).map(it => `<tr><td>${esc(it.desc)}</td><td class="num">${+it.qty}</td><td class="num">${money(it.price)}</td><td class="num">${money(it.qty * it.price)}</td></tr>`).join('')}
    </tbody></table>
    <div class="totals">
      <div><span>Subtotal</span><span>${money(t.sub)}</span></div>
      ${t.disc ? `<div><span>Discount</span><span>−${money(t.disc)}</span></div>` : ''}
      <div><span>${esc(s.taxName)} (${t.rate}%)</span><span>${money(t.tax)}</span></div>
      <div class="grand"><span>Total</span><span>${money(t.total)}</span></div>
      ${isInv && paid ? `<div><span>Paid</span><span>−${money(paid)}</span></div><div class="grand"><span>Balance due</span><span>${money(balance(d))}</span></div>` : ''}
    </div>
    ${status === 'paid' ? '<div class="paid-stamp">PAID</div>' : ''}
    ${d.notes ? `<div class="notes">${esc(d.notes)}</div>` : ''}
    ${isInv && s.paymentInstructions && status !== 'paid' ? `<div class="notes"><div class="lbl">How to pay</div>${esc(s.paymentInstructions)}</div>` : ''}
    ${!isInv ? `<div class="notes" style="margin-top:40px;display:flex;gap:40px;flex-wrap:wrap"><div>Accepted by: ________________________</div><div>Date: ______________</div></div>` : ''}
  </div>`;
}
function docMessage(type, d) {
  const s = db.settings, c = cust(d.customerId) || {}, t = totals(d);
  const biz = s.businessName || 'us';
  if (type === 'invoice') {
    const bal = balance(d);
    return `Hi ${firstName(c.name)},\n\nHere is invoice ${d.number} from ${biz} for ${money(t.total)}${bal !== t.total ? ` (balance due ${money(bal)})` : ''}${d.dueDate ? `, due ${fmtDate(d.dueDate)}` : ''}.\n\n` +
      (d.items || []).map(it => `• ${it.desc} — ${money(it.qty * it.price)}`).join('\n') +
      `\n\n${s.paymentInstructions || ''}\n\nThank you!\n${s.ownerName || biz}${s.phone ? '\n' + s.phone : ''}`;
  }
  return `Hi ${firstName(c.name)},\n\nThanks for the opportunity! Here is quote ${d.number} from ${biz} for ${money(t.total)}${d.validUntil ? `, valid until ${fmtDate(d.validUntil)}` : ''}.\n\n` +
    (d.items || []).map(it => `• ${it.desc} — ${money(it.qty * it.price)}`).join('\n') +
    `\n\nJust reply to let me know if you'd like to go ahead and we'll get you booked in.\n\n${s.ownerName || biz}${s.phone ? '\n' + s.phone : ''}`;
}
function docView(type, id) {
  const coll = type === 'invoice' ? 'invoices' : 'quotes';
  const d = byId(coll, id); if (!d) return empty(type, 'Not found.');
  const c = cust(d.customerId) || {};
  const isInv = type === 'invoice';
  const status = isInv ? invStatus(d) : quoteStatus(d);
  const a = (l, act, cls = '', ic = '') => btn(l, act, cls, `data-id="${id}" data-type="${type}"`, ic);
  const actions = isInv
    ? (status !== 'void' ? (status !== 'paid' ? a('Record payment', 'recordPayment', 'btn-primary', 'check') : '') + a('Email', 'docEmail', '', 'mail') + a('Text', 'docText', '', 'sms') +
      a('Print / PDF', 'docPrint', '', 'print') + a('Edit', 'editDoc', '', 'edit') : '')
    : (['draft', 'sent', 'expired'].includes(status) ? a('Approve', 'quoteApprove', 'btn-primary', 'check') : '') +
      (['approved'].includes(status) ? a('Schedule job', 'quoteToJob', 'btn-primary', 'calendar') + a('Convert to invoice', 'quoteToInvoice', '', 'invoice') : '') +
      a('Email', 'docEmail', '', 'mail') + a('Text', 'docText', '', 'sms') + a('Print / PDF', 'docPrint', '', 'print') + a('Edit', 'editDoc', '', 'edit');
  const pays = isInv ? (d.payments || []) : [];
  return head(`${isInv ? 'Invoice' : 'Quote'} ${esc(d.number)} ${badge(status)}`, '', `<a href="#/${coll}">← All ${coll}</a> · ${esc(c.name || '')}`) + `
    <div class="doc-actions">${actions}</div>
    ${!c.email && !c.phone ? '<div class="alert warn no-print" style="margin-bottom:12px">' + icon('alert') + 'This customer has no email or phone saved — add one to send from here.</div>' : ''}
    ${docHTML(type, d)}
    ${isInv ? `<div class="card no-print" style="margin-top:16px;max-width:820px;margin-left:auto;margin-right:auto">
      <div class="card-head"><h2>Payments</h2>${status !== 'paid' && status !== 'void' ? a('Record payment', 'recordPayment', 'btn-sm', 'plus') : ''}</div>
      ${pays.length ? pays.map(p => `<div class="list-item"><div class="grow"><div class="title">${money(p.amount)}</div><div class="muted small">${fmtDate(p.date)} · ${esc(p.method || '')}${p.note ? ' · ' + esc(p.note) : ''}</div></div>
        <button class="btn btn-sm btn-danger" data-act="deletePayment" data-id="${id}" data-pid="${p.id}">Remove</button></div>`).join('') : '<p class="muted small">No payments recorded yet.</p>'}
      ${d.sentAt ? `<p class="muted small">Sent ${fmtDate(d.sentAt)}.</p>` : ''}
    </div>` : `${d.sentAt ? `<p class="muted small no-print" style="text-align:center">Sent ${fmtDate(d.sentAt)}.</p>` : ''}`}
    <div class="row no-print" style="margin-top:16px;justify-content:center">
      ${d.sent || d.status === 'sent' ? '' : a('Mark as sent', 'markSent', 'btn-sm')}
      ${a('Duplicate', 'dupDoc', 'btn-sm')}
      ${!isInv && ['draft', 'sent', 'expired'].includes(status) ? a('Mark declined', 'quoteDecline', 'btn-sm') : ''}
      ${isInv && status !== 'void' && !pays.length ? a('Void', 'voidInvoice', 'btn-sm') : ''}
      ${isInv && d.jobId && byId('jobs', d.jobId) ? `<a class="btn btn-sm" href="#/jobs/${d.jobId}">View job</a>` : ''}
      ${!isInv && d.jobId && byId('jobs', d.jobId) ? `<a class="btn btn-sm" href="#/jobs/${d.jobId}">View job</a>` : ''}
      ${!isInv && d.invoiceId && byId('invoices', d.invoiceId) ? `<a class="btn btn-sm" href="#/invoices/${d.invoiceId}">View invoice</a>` : ''}
      ${a('Delete', 'deleteDoc', 'btn-sm btn-danger')}
    </div>`;
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
  return head('Settings') + `<form id="settingsForm" class="stack">
  <div class="card"><h2 style="margin-bottom:12px">Business details</h2><p class="muted small">Shown on your quotes and invoices.</p>
    <div class="form-grid">
      ${field('Business name', inp('businessName', s.businessName, 'placeholder="e.g. Yonan Home Services"'))}
      ${field('Your name', inp('ownerName', s.ownerName))}
      ${field('Email', inp('email', s.email, 'type="email"'))}${field('Phone', inp('phone', s.phone, 'type="tel"'))}
      ${field('Address', `<textarea name="address" rows="2">${esc(s.address)}</textarea>`, 'full')}
      ${field('Website', inp('website', s.website))}${field('Tax / business number (e.g. HST #)', inp('taxNumber', s.taxNumber))}
      <div class="field full"><label>Logo</label><div class="row">${s.logo ? `<img src="${s.logo}" style="height:48px;border-radius:6px;border:1px solid var(--border)">` : ''}
        <input type="file" accept="image/*" id="logoFile" style="width:auto">${s.logo ? '<button type="button" class="btn btn-sm" id="rmLogo">Remove</button>' : ''}</div></div>
    </div></div>
  <div class="card"><h2 style="margin-bottom:12px">Tax &amp; money</h2><div class="form-grid">
    ${field('Currency', `<select name="currency">${opts(['CAD', 'USD', 'GBP', 'EUR', 'AUD', 'NZD'], s.currency)}</select>`)}
    ${field('Tax name', inp('taxName', s.taxName))}
    ${field('Default tax rate (%)', inp('taxRate', s.taxRate, 'type="number" step="0.001" min="0"'))}
    ${field('Payment terms (days until due)', inp('dueDays', s.dueDays, 'type="number" min="0"'))}
    ${field('Mileage rate (per unit)', inp('mileageRate', s.mileageRate, 'type="number" step="0.01" min="0"'))}
    ${field('Distance unit', `<select name="distanceUnit">${opts(['km', 'mi'], s.distanceUnit)}</select>`)}
  </div></div>
  <div class="card"><h2 style="margin-bottom:12px">Quotes &amp; invoices</h2><div class="form-grid">
    ${field('Invoice number prefix', inp('invoicePrefix', s.invoicePrefix))}${field('Next invoice number', inp('nextInvoiceNo', s.nextInvoiceNo, 'type="number"'))}
    ${field('Quote number prefix', inp('quotePrefix', s.quotePrefix))}${field('Next quote number', inp('nextQuoteNo', s.nextQuoteNo, 'type="number"'))}
    ${field('Quotes valid for (days)', inp('quoteValidDays', s.quoteValidDays, 'type="number" min="0"'))}<div></div>
    ${field('How customers can pay you (printed on invoices)', `<textarea name="paymentInstructions">${esc(s.paymentInstructions)}</textarea>`, 'full')}
    ${field('Default invoice note', `<textarea name="invoiceNotes">${esc(s.invoiceNotes)}</textarea>`, 'full')}
    ${field('Default quote note / terms', `<textarea name="quoteNotes">${esc(s.quoteNotes)}</textarea>`, 'full')}
  </div></div>
  <div class="card"><h2 style="margin-bottom:12px">Expense categories</h2>
    ${field('One per line', `<textarea name="categories" rows="8">${esc(db.categories.join('\n'))}</textarea>`)}</div>
  <div class="card"><h2 style="margin-bottom:12px">Appearance</h2>
    ${field('Theme', `<select name="theme" style="max-width:240px">${opts([['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}</select>`)}</div>
  <div class="row"><button class="btn btn-primary" type="submit">Save settings</button></div>
  </form>
  <div class="card" style="margin-top:16px"><h2 style="margin-bottom:8px">Your data</h2>
    <p class="muted small">Everything is saved privately in this browser on this device (${used} MB used). <b>Download a backup regularly</b>, and use Restore to move your data to another phone or computer.</p>
    <div class="row">${btn('Download backup', 'exportBackup', 'btn-primary', '', 'download')}${btn('Restore from backup', 'importBackup')}
    ${btn('Load sample data', 'loadSample')}${btn('Erase everything', 'eraseAll', 'btn-danger')}</div></div>`;
};

/* =====================================================================
 * Forms (create / edit)
 * ===================================================================== */
function customerForm(c, onSaved) {
  const isNew = !c; c ||= {};
  modal({ title: isNew ? 'New customer' : 'Edit customer', body: `<div class="form-grid">
    ${field('Name *', inp('name', c.name, 'required placeholder="Full name or company"'), 'full')}
    ${field('Mobile phone', inp('phone', c.phone, 'type="tel"'))}${field('Email', inp('email', c.email, 'type="email"'))}
    ${field('Address', inp('address', c.address, 'placeholder="Street, city, postal code"'), 'full')}
    ${field('Tags', inp('tags', c.tags, 'placeholder="e.g. residential, referral"'))}
    ${field('Lead source', `<select name="source">${opts(['', 'Referral', 'Google', 'Facebook / Instagram', 'Website', 'Door hanger / flyer', 'Repeat customer', 'Other'], c.source || '')}</select>`)}
    ${field('Notes', `<textarea name="notes" placeholder="Gate code, pets, preferences…">${esc(c.notes)}</textarea>`, 'full')}</div>`,
    onSubmit: (f, d) => {
      Object.assign(c, d, { name: d.name.trim() });
      if (isNew) { c.id = uid(); c.createdAt = today(); db.customers.push(c); }
      save(); toast(isNew ? 'Customer added' : 'Customer saved');
      if (onSaved) onSaved(c); else render();
    } });
}

function jobForm(j, preset = {}) {
  const isNew = !j; j ||= { status: 'scheduled', date: preset.date || today(), ...preset };
  const c = cust(j.customerId);
  modal({ title: isNew ? 'New job' : 'Edit job', wide: true, body: `<div class="form-grid">
    ${field('Customer *', customerSelect(j.customerId), 'full')}
    ${field('Job title *', inp('title', j.title, 'required placeholder="e.g. Furnace tune-up"'), 'full')}
    ${field('Date', inp('date', j.date, 'type="date"'))}
    <div class="form-grid" style="gap:8px">${field('Start', inp('start', j.start, 'type="time"'))}${field('End', inp('end', j.end, 'type="time"'))}</div>
    ${field('Service address', inp('address', j.address ?? c?.address ?? '', 'placeholder="Defaults to the customer address"'), 'full')}
    ${field('Assigned to', inp('assignedTo', j.assignedTo, 'placeholder="Team member" list="teamList"') + `<datalist id="teamList">${[...new Set(db.jobs.map(x => x.assignedTo).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>`)}
    ${field('Status', `<select name="status">${opts([['scheduled', 'Scheduled'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']], j.status)}</select>`)}
    ${isNew ? field('Repeat', `<select name="repeat">${opts([['', 'Does not repeat'], ['7', 'Every week'], ['14', 'Every 2 weeks'], ['m1', 'Every month'], ['m3', 'Every 3 months'], ['m12', 'Every year']], '')}</select>`) +
      field('Number of visits', inp('occurrences', 6, 'type="number" min="1" max="104"')) : ''}
    ${field('Notes / instructions', `<textarea name="notes">${esc(j.notes)}</textarea>`, 'full')}
  </div><h3 style="margin:16px 0 8px">Line items <span class="muted small">(optional — used when you invoice)</span></h3>${itemsEditorHTML(j)}`,
    onMount: f => {
      j._getItems = mountItemsEditor(f, j);
      bindCustomerSelect(f, nc => { if (nc && !f.address.value) f.address.value = nc.address || ''; });
    },
    onSubmit: (f, d) => {
      const items = j._getItems(); delete j._getItems;
      const base = { customerId: d.customerId, title: d.title.trim(), date: d.date, start: d.start, end: d.end, address: d.address,
        assignedTo: d.assignedTo, status: d.status, notes: d.notes, items, discount: +d.discount || 0, taxRate: d.taxRate === '' ? db.settings.taxRate : +d.taxRate };
      if (!isNew) { Object.assign(j, base); save(); toast('Job saved'); render(); return; }
      const n = d.repeat ? Math.min(Math.max(+d.occurrences || 1, 1), 104) : 1;
      const series = n > 1 ? uid() : undefined;
      let date = d.date, firstId;
      for (let i = 0; i < n; i++) {
        const nj = { ...base, id: uid(), createdAt: today(), date, seriesId: series, quoteId: j.quoteId };
        if (i > 0) nj.status = 'scheduled';
        db.jobs.push(nj); firstId ||= nj.id;
        if (d.repeat && date) date = d.repeat.startsWith('m') ? addMonths(date, +d.repeat.slice(1)) : addDays(date, +d.repeat);
      }
      if (j.quoteId) { const q = byId('quotes', j.quoteId); if (q) { q.status = 'converted'; q.jobId = firstId; } }
      save(); toast(n > 1 ? `${n} visits scheduled` : 'Job scheduled');
      go('#/jobs/' + firstId);
    } });
}

function docForm(type, d, preset = {}) {
  const isInv = type === 'invoice', isNew = !d, s = db.settings;
  d ||= { customerId: preset.customerId, date: today(), items: preset.items || [], notes: isInv ? s.invoiceNotes : s.quoteNotes,
    taxRate: s.taxRate, discount: preset.discount || 0, jobId: preset.jobId, quoteId: preset.quoteId };
  if (isNew) { if (isInv) d.dueDate = addDays(d.date, +s.dueDays || 0); else d.validUntil = addDays(d.date, +s.quoteValidDays || 30); }
  const dateField = isInv ? field('Due date', inp('dueDate', d.dueDate, 'type="date"')) : field('Valid until', inp('validUntil', d.validUntil, 'type="date"'));
  modal({ title: `${isNew ? 'New' : 'Edit'} ${type}`, wide: true, submitLabel: isNew ? `Create ${type}` : 'Save', body: `<div class="form-grid">
    ${field('Customer *', customerSelect(d.customerId), 'full')}
    ${field(isInv ? 'Invoice date' : 'Quote date', inp('date', d.date, 'type="date" required'))}${dateField}
    ${field('Service address (if different)', inp('serviceAddress', d.serviceAddress), 'full')}
  </div><h3 style="margin:16px 0 8px">Line items</h3>${itemsEditorHTML(d)}
  ${field('Notes shown to customer', `<textarea name="notes">${esc(d.notes)}</textarea>`, 'full')}`,
    onMount: f => { d._getItems = mountItemsEditor(f, d); bindCustomerSelect(f); },
    onSubmit: (f, v) => {
      const items = d._getItems();
      if (!items.length) { toast('Add at least one line item'); return false; }
      delete d._getItems;
      Object.assign(d, { customerId: v.customerId, date: v.date, notes: v.notes, serviceAddress: v.serviceAddress, items,
        discount: +v.discount || 0, taxRate: v.taxRate === '' ? s.taxRate : +v.taxRate });
      if (isInv) d.dueDate = v.dueDate; else d.validUntil = v.validUntil;
      if (isNew) {
        Object.assign(d, { id: uid(), number: nextNumber(type), createdAt: today() });
        if (isInv) { d.payments = []; db.invoices.push(d); } else { d.status = 'draft'; db.quotes.push(d); }
        if (d.jobId) { const j = byId('jobs', d.jobId); if (j) j.invoiceId = d.id; }
        if (d.quoteId) { const q = byId('quotes', d.quoteId); if (q) { q.status = 'converted'; q.invoiceId = d.id; } }
      }
      save(); toast(isNew ? `${isInv ? 'Invoice' : 'Quote'} ${d.number} created` : 'Saved');
      go(`#/${isInv ? 'invoices' : 'quotes'}/${d.id}`);
    } });
}

function expenseForm(e, preset = {}) {
  const isNew = !e; e ||= { date: today(), category: db.categories[0], method: 'Debit', ...preset };
  let receipt = e.receipt || '';
  const jobs = db.jobs.filter(j => j.status !== 'cancelled').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);
  modal({ title: isNew ? 'Add expense' : 'Edit expense', body: `<div class="form-grid">
    ${field('Amount (total paid) *', inp('amount', e.amount, 'type="number" step="0.01" min="0" required inputmode="decimal"'))}
    ${field('Date *', inp('date', e.date, 'type="date" required'))}
    ${field('Vendor / store', inp('vendor', e.vendor, `list="vendorList" placeholder="e.g. Home Depot"`) + `<datalist id="vendorList">${[...new Set(db.expenses.map(x => x.vendor).filter(Boolean))].map(v => `<option value="${esc(v)}">`).join('')}</datalist>`)}
    ${field('Category', `<select name="category">${opts(db.categories, e.category)}</select>`)}
    ${field(`${esc(db.settings.taxName)} included (optional)`, inp('tax', e.tax, 'type="number" step="0.01" min="0" placeholder="Tax portion of the total"') + `<button type="button" class="btn btn-sm js-calc-tax" style="margin-top:4px;align-self:flex-start">Calculate at ${db.settings.taxRate}%</button>`)}
    ${field('Paid with', `<select name="method">${opts(['Debit', 'Credit card', 'Cash', 'e-Transfer', 'Cheque', 'Bank transfer', 'Other'], e.method)}</select>`)}
    ${field('Link to job (for job costing)', `<select name="jobId"><option value="">— None —</option>${jobs.map(j => `<option value="${j.id}" ${j.id === e.jobId ? 'selected' : ''}>${esc(fmtDate(j.date) + ' · ' + j.title + ' · ' + custName(j.customerId))}</option>`).join('')}</select>`, 'full')}
    ${field('Notes', `<textarea name="notes" rows="2">${esc(e.notes)}</textarea>`, 'full')}
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
      $('.js-del', f)?.addEventListener('click', () => { if (confirm('Delete this expense?')) { db.expenses = db.expenses.filter(x => x.id !== e.id); close(); refresh(); toast('Expense deleted'); } });
    },
    onSubmit: (f, d) => {
      Object.assign(e, { amount: round2(d.amount), date: d.date, vendor: d.vendor.trim(), category: d.category, tax: d.tax === '' ? 0 : round2(d.tax),
        method: d.method, jobId: d.jobId, notes: d.notes, receipt });
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
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => { if (confirm('Delete this income entry?')) { db.incomes = db.incomes.filter(i => i.id !== x.id); close(); refresh(); } }),
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
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => { if (confirm('Delete this trip?')) { db.mileage = db.mileage.filter(x => x.id !== m.id); close(); refresh(); } }),
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
    onMount: (f, close) => $('.js-del', f)?.addEventListener('click', () => { if (confirm('Delete this item?')) { db.services = db.services.filter(x => x.id !== s.id); close(); refresh(); } }),
    onSubmit: (f, d) => {
      Object.assign(s, { name: d.name.trim(), price: round2(d.price), unit: d.unit, description: d.description, taxable: !!d.taxable });
      if (isNew) { s.id = uid(); db.services.push(s); }
      refresh(); toast('Saved');
    } });
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
    const n = db.jobs.filter(j => j.customerId === ds.id).length + db.invoices.filter(i => i.customerId === ds.id).length;
    if (n) return alert('This customer has jobs or invoices. Delete those first, so your records stay complete.');
    if (confirm('Delete this customer?')) { db.customers = db.customers.filter(c => c.id !== ds.id); save(); go('#/customers'); }
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
  newJob: ds => jobForm(null, { date: ds.date || today(), customerId: ds.cust }),
  editJob: ds => jobForm(byId('jobs', ds.id)),
  dupJob: ds => { const j = byId('jobs', ds.id); jobForm(null, { ...structuredClone(j), id: undefined, invoiceId: undefined, quoteId: undefined, seriesId: undefined, status: 'scheduled', date: today() }); },
  jobStatus: ds => {
    const j = byId('jobs', ds.id); j.status = ds.s; if (ds.s === 'completed') j.completedAt = today(); refresh();
    if (ds.s === 'completed' && !j.invoiceId) toast('Job complete — create the invoice while it’s fresh!'); else toast('Status updated');
  },
  toggleNoInvoice: ds => { const j = byId('jobs', ds.id); j.noInvoice = !j.noInvoice; refresh(); },
  deleteJob: ds => {
    const j = byId('jobs', ds.id);
    const series = j.seriesId ? db.jobs.filter(x => x.seriesId === j.seriesId && x.date >= j.date && x.status === 'scheduled' && x.id !== j.id) : [];
    if (!confirm('Delete this job?')) return;
    let ids = [j.id];
    if (series.length && confirm(`Also delete the ${series.length} later visit(s) in this repeating series?`)) ids = ids.concat(series.map(x => x.id));
    db.jobs = db.jobs.filter(x => !ids.includes(x.id));
    db.expenses.forEach(e => { if (ids.includes(e.jobId)) e.jobId = ''; });
    save(); go('#/jobs');
  },
  jobToInvoice: ds => {
    const j = byId('jobs', ds.id);
    if (!(j.items || []).length) return docForm('invoice', null, { customerId: j.customerId, jobId: j.id });
    const inv = invoiceFromItems(j, { jobId: j.id }); j.invoiceId = inv.id;
    save(); toast(`Invoice ${inv.number} created`); go('#/invoices/' + inv.id);
  },
  calMove: ds => { state.calMonth = addMonths(state.calMonth + '-01', +ds.n).slice(0, 7); render(); },
  calToday: () => { state.calMonth = today().slice(0, 7); state.calDay = today(); render(); },
  newQuote: ds => docForm('quote', null, { customerId: ds.cust }),
  newInvoice: ds => docForm('invoice', null, { customerId: ds.cust }),
  editDoc: ds => {
    const d = docOf(ds);
    if (ds.type === 'quote' && d.status === 'converted' && !confirm('This quote was already converted. Edit anyway?')) return;
    docForm(ds.type, d);
  },
  dupDoc: ds => { const d = docOf(ds); docForm(ds.type, null, { customerId: d.customerId, items: structuredClone(d.items), discount: d.discount }); },
  deleteDoc: ds => {
    const d = docOf(ds);
    if (ds.type === 'invoice' && (d.payments || []).length && !confirm('This invoice has payments recorded. Deleting it also removes those payments from your income. Continue?')) return;
    if (!confirm(`Delete ${ds.type} ${d.number}? This cannot be undone.`)) return;
    if (ds.type === 'invoice') { db.invoices = db.invoices.filter(x => x.id !== d.id); db.jobs.forEach(j => { if (j.invoiceId === d.id) j.invoiceId = ''; }); }
    else db.quotes = db.quotes.filter(x => x.id !== d.id);
    save(); go(`#/${ds.type === 'invoice' ? 'invoices' : 'quotes'}`);
  },
  markSent: ds => { markSent(ds.type, docOf(ds)); refresh(); toast('Marked as sent'); },
  docEmail: ds => {
    const d = docOf(ds), c = cust(d.customerId) || {};
    const subj = `${ds.type === 'invoice' ? 'Invoice' : 'Quote'} ${d.number} from ${db.settings.businessName || ''}`.trim();
    location.href = `mailto:${encodeURIComponent(c.email || '')}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(docMessage(ds.type, d) + '\n\n(Tip: attach the PDF — use Print / PDF → Save as PDF.)')}`;
    markSent(ds.type, d); save(); setTimeout(render, 400);
  },
  docText: ds => {
    const d = docOf(ds), c = cust(d.customerId) || {};
    location.href = `sms:${encodeURIComponent(c.phone || '')}?&body=${encodeURIComponent(docMessage(ds.type, d))}`;
    markSent(ds.type, d); save(); setTimeout(render, 400);
  },
  docPrint: ds => {
    const d = docOf(ds); const old = document.title;
    document.title = `${ds.type === 'invoice' ? 'Invoice' : 'Quote'} ${d.number} - ${custName(d.customerId)}`;
    window.print(); setTimeout(() => document.title = old, 1000);
  },
  printPage: () => window.print(),
  recordPayment: ds => paymentForm(docOf(ds)),
  deletePayment: ds => { const inv = byId('invoices', ds.id); if (confirm('Remove this payment?')) { inv.payments = inv.payments.filter(p => p.id !== ds.pid); refresh(); } },
  voidInvoice: ds => { if (confirm('Void this invoice? It will stay in your records but no longer count as owed.')) { docOf(ds).void = true; refresh(); } },
  quoteApprove: ds => { const q = docOf(ds); q.status = 'approved'; q.approvedAt = today(); q.sentAt ||= today(); refresh(); toast('Quote approved — schedule the job next'); },
  quoteDecline: ds => { const q = docOf(ds); q.status = 'declined'; refresh(); },
  quoteToJob: ds => { const q = docOf(ds); jobForm(null, { customerId: q.customerId, title: (q.items[0]?.desc || 'Job') + (q.items.length > 1 ? ' + more' : ''), items: structuredClone(q.items), discount: q.discount, taxRate: q.taxRate, quoteId: q.id, address: q.serviceAddress }); },
  quoteToInvoice: ds => { const q = docOf(ds); const inv = invoiceFromItems(q, { quoteId: q.id, jobId: q.jobId }); q.status = 'converted'; q.invoiceId = inv.id; save(); go('#/invoices/' + inv.id); },
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
  exportBackup: () => { download(`business-hub-backup-${today()}.json`, JSON.stringify(db), 'application/json'); db.settings.lastBackup = today(); save(); },
  importBackup: () => modal({ title: 'Restore from backup', submitLabel: 'Restore', body: '<p class="muted">This replaces all data in this browser with the backup file.</p><input type="file" accept=".json,application/json" name="file" required>',
    onSubmit: f => { const file = f.file.files[0]; if (!file) return false;
      file.text().then(t => { try { const d = JSON.parse(t); if (!d.settings || !Array.isArray(d.invoices)) throw 0; db = normalize(d); refresh(); toast('Backup restored'); } catch { alert('That file is not a valid backup.'); } }); } }),
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
  if (day) { state.calDay = day.dataset.day; if (day.dataset.day.slice(0, 7) !== state.calMonth) state.calMonth = day.dataset.day.slice(0, 7); render(); }
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
document.addEventListener('submit', e => {
  if (e.target.id !== 'settingsForm') return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const cats = d.categories.split('\n').map(x => x.trim()).filter(Boolean);
  delete d.categories;
  for (const k of ['taxRate', 'dueDays', 'mileageRate', 'nextInvoiceNo', 'nextQuoteNo', 'quoteValidDays']) d[k] = +d[k] || 0;
  Object.assign(db.settings, d);
  if (cats.length) db.categories = cats;
  refresh(); toast('Settings saved');
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'logoFile') return;
  const file = e.target.files[0]; if (!file) return;
  try { db.settings.logo = await readImage(file, 400, 0.85); refresh(); toast('Logo updated'); } catch { toast('Could not read that image'); }
});
document.addEventListener('click', e => { if (e.target.id === 'rmLogo') { db.settings.logo = ''; refresh(); } });

// Mobile menu
$('#menuBtn').addEventListener('click', () => {
  $('#sidebar').classList.add('open');
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  scrim.onclick = () => { $('#sidebar').classList.remove('open'); scrim.remove(); };
  document.body.append(scrim);
});

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
  const team = ['Onel', 'Mike', 'Onel'];
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
}

/* =====================================================================
 * Boot
 * ===================================================================== */
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
