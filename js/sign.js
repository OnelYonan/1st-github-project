/* Customer-facing page for approving a quote or signing a service agreement.
 * Everything arrives packed in the link (after the #); nothing is stored here.
 * The answer goes straight back to the business's server when they have one,
 * otherwise the customer sends a "signed" link back by text or email. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const fail = msg => { app.innerHTML = `<div class="card sign-card"><h1>Something went wrong</h1><p>${esc(msg)}</p><p class="muted">Please ask the business to send the link again.</p></div>`; };

/** Send the answer back: straight to the business's server if it has one, else by a link the customer texts or emails. */
async function sendBack(a, back, { title, label, okText }) {
  const box = $('#signSec');
  if (a.s && /^https:\/\//i.test(a.s) || (a.s && /^http:\/\/localhost/.test(a.s))) {
    box.innerHTML = '<div class="sign-done"><p>Sending…</p></div>';
    try {
      const res = await fetch(a.s.replace(/\/+$/, '') + '/public/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(back) });
      if (res.ok) {
        box.innerHTML = `<div class="sign-done"><h2>✓ ${esc(title)}</h2><p>${okText}</p>
          <div class="row"><button class="btn" type="button" onclick="window.print()">Print / save a copy</button></div>
          <p class="muted small">${esc(label)} by ${esc(back.name)} on ${new Date(back.at).toLocaleString()}.</p>
          ${back.sig?.length ? `<div class="sig-print">${BH.sigSVG(back.sig)}</div>` : ''}</div>`;
        return;
      }
    } catch { /* fall through to the manual way */ }
  }
  const link = `${a.r}#/signed/${await BH.pack(back)}`;
  const msg = `${label} ${a.n} from ${back.name}: ${link}`;
  box.innerHTML = `<div class="sign-done"><h2>✓ ${esc(title)}</h2>
    <p>Thank you, ${esc(back.name.split(' ')[0])}! <b>One last step:</b> send this to ${esc(a.b.name)}.</p>
    <div class="row">
      ${a.b.phone ? `<a class="btn btn-primary" href="sms:${encodeURIComponent(a.b.phone)}?&body=${encodeURIComponent(msg)}">Send by text</a>` : ''}
      ${a.b.email ? `<a class="btn ${a.b.phone ? '' : 'btn-primary'}" href="mailto:${encodeURIComponent(a.b.email)}?subject=${encodeURIComponent(label + ' ' + a.n)}&body=${encodeURIComponent(msg)}">Send by email</a>` : ''}
      <button class="btn" id="copyLink" type="button">Copy link</button>
      <button class="btn" type="button" onclick="window.print()">Print / save a copy</button>
    </div>
    <div class="field" style="margin-top:12px"><label for="backLink">Or copy this link and send it to ${esc(a.b.name)} any way you like</label>
      <input id="backLink" readonly value="${esc(link)}" onfocus="this.select()"></div>
    <p class="muted small">${esc(label)} by ${esc(back.name)} on ${new Date(back.at).toLocaleString()}.</p>
    ${back.sig?.length ? `<div class="sig-print">${BH.sigSVG(back.sig)}</div>` : ''}</div>`;
  $('#copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); $('#copyLink').textContent = 'Copied ✓'; } catch { prompt('Copy this link:', link); }
  });
}

const signBlock = (name, agreeText, btnLabel) => `
  <form id="signForm" class="stack" style="gap:12px">
    <div class="field"><label for="nm">Your full name</label><input id="nm" name="name" required autocomplete="name" value="${esc(name)}"></div>
    <div class="field"><label>Your signature</label>
      <div class="sig-box"><canvas id="sig" aria-label="Signature pad. Draw your signature with your finger or mouse."></canvas><span class="sig-hint">Sign here</span></div>
      <button type="button" class="btn btn-sm" id="clearSig" style="align-self:flex-start;margin-top:6px">Clear</button></div>
    <label class="check"><input type="checkbox" id="agree" required> ${agreeText}</label>
    <button class="btn btn-primary" id="signBtn" type="submit" disabled>${btnLabel}</button>
  </form>`;
function bindPad() {
  const hint = $('.sig-hint');
  const pad = new BH.SignaturePad($('#sig'), emptyNow => { hint.style.display = emptyNow ? '' : 'none'; check(); });
  const check = () => { $('#signBtn').disabled = pad.isEmpty() || !$('#agree').checked || !$('#nm').value.trim(); };
  $('#agree').addEventListener('change', check); $('#nm').addEventListener('input', check);
  $('#clearSig').addEventListener('click', () => pad.clear());
  return pad;
}

/* ---------------- Quote ---------------- */
function quotePage(a) {
  const q = a.q;
  document.title = `Quote ${a.n} · ${a.b.name}`;
  const fmt = n => { try { return new Intl.NumberFormat(q.loc || undefined, { style: 'currency', currency: q.cur || 'CAD' }).format(n); } catch { return '$' + n.toFixed(2); } };
  const picked = new Set(q.items.map((it, i) => (it[5] && it[6] ? i : -1)).filter(i => i >= 0));
  const calc = () => {
    let sub = 0, taxable = 0;
    q.items.forEach(([, , qty, price, tx, opt], i) => { if (opt && !picked.has(i)) return; const line = qty * price; sub += line; if (tx) taxable += line; });
    const disc = Math.min(Math.max(q.disc || 0, 0), sub), base = sub ? taxable - disc * (taxable / sub) : 0;
    const tax = Math.round(base * (q.rate || 0)) / 100, total = Math.round((sub - disc + tax) * 100) / 100;
    return { sub, disc, tax, total, dep: q.dep ? Math.round(total * q.dep) / 100 : 0 };
  };
  const required = q.items.map((it, i) => [it, i]).filter(([it]) => !it[5]);
  const optional = q.items.map((it, i) => [it, i]).filter(([it]) => it[5]);
  const row = ([d, det, qty, price], i, opt) => `<div class="qline ${opt ? 'qopt' : ''}">
      ${opt ? `<label class="qpick"><input type="checkbox" data-i="${i}" ${picked.has(i) ? 'checked' : ''}><span></span></label>` : ''}
      <div class="grow"><b>${esc(d)}</b>${det ? `<div class="muted small" style="white-space:pre-line">${esc(det)}</div>` : ''}${qty !== 1 ? `<div class="muted small">${qty} × ${fmt(price)}</div>` : ''}</div>
      <div class="num"><b>${fmt(qty * price)}</b></div></div>`;
  app.innerHTML = `
  <article class="card sign-card">
    <header class="sign-head"><div><div class="sign-biz">${esc(a.b.name)}</div><div class="muted small">${esc([a.b.phone, a.b.email].filter(Boolean).join(' · '))}</div></div>
      <div class="right"><div class="sign-title">QUOTE</div><div class="muted small">${esc(a.n)} · ${esc(q.date)}</div></div></header>
    <p>Hi ${esc(a.c.first)}, here’s your quote${a.c.address ? ` for <b>${esc(a.c.address)}</b>` : ''}. ${optional.length ? 'Tick any extras you’d like, then' : 'If it looks good,'} approve it at the bottom.</p>
    <section><h2>Services</h2><div class="qlines">${required.map(([it, i]) => row(it, i, false)).join('')}</div></section>
    ${optional.length ? `<section><h2>Optional extras</h2><p class="muted small" style="margin-top:-4px">Tap to add any of these.</p><div class="qlines">${optional.map(([it, i]) => row(it, i, true)).join('')}</div></section>` : ''}
    <div class="totals js-qtot"></div>
    ${q.valid ? `<p class="muted small">This quote is valid until ${esc(q.valid)}.</p>` : ''}
    ${q.notes ? `<section><h2>Notes</h2><div class="sign-terms" style="max-height:none">${esc(q.notes)}</div></section>` : ''}
    ${a.t ? `<section><h2>Terms</h2><div class="sign-terms">${esc(a.t)}</div></section>` : ''}
    <section id="signSec"><h2>Approve this quote</h2>
      ${signBlock(a.c.name, `I approve this quote${a.t ? ' and agree to the terms' : ''}, including the extras I ticked.`, 'Approve quote')}
      <div class="q-changes"><button type="button" class="btn" id="askChanges">Not quite right? Ask for changes</button></div>
    </section>
  </article>`;
  const drawTotals = () => {
    const t = calc();
    $('.js-qtot').innerHTML = `<div><span>Subtotal</span><span>${fmt(t.sub)}</span></div>${t.disc ? `<div><span>Discount</span><span>−${fmt(t.disc)}</span></div>` : ''}
      <div><span>${esc(q.taxName || 'Tax')} (${q.rate}%)</span><span>${fmt(t.tax)}</span></div><div class="grand"><span>Total</span><span>${fmt(t.total)}</span></div>
      ${t.dep ? `<div><span>Deposit to book (${q.dep}%)</span><span>${fmt(t.dep)}</span></div>` : ''}`;
    $('#signBtn') && ($('#signBtn').textContent = `Approve quote · ${fmt(t.total)}`);
  };
  $$('.qpick input').forEach(cb => cb.addEventListener('change', () => { cb.checked ? picked.add(+cb.dataset.i) : picked.delete(+cb.dataset.i); cb.closest('.qline').classList.toggle('on', cb.checked); drawTotals(); }));
  $$('.qpick input:checked').forEach(cb => cb.closest('.qline').classList.add('on'));
  $$('.qopt').forEach(row => row.addEventListener('click', e => {
    if (e.target.closest('.qpick')) return;
    const cb = row.querySelector('input'); cb.checked = !cb.checked; cb.dispatchEvent(new Event('change'));
  }));
  const pad = bindPad();
  drawTotals();
  $('#signForm').addEventListener('submit', async e => {
    e.preventDefault();
    const back = { k: 'quote', act: 'approve', id: a.id, n: a.n, h: a.h, name: $('#nm').value.trim(), at: new Date().toISOString(), sig: pad.strokes.filter(s => s.length > 1), pick: [...picked].sort((x, y) => x - y), total: calc().total };
    pad.destroy();
    await sendBack(a, back, { title: 'Quote approved', label: 'Approved quote', okText: `Thank you! ${esc(a.b.name)} has your approval and will be in touch to book the work.` });
  });
  $('#askChanges').addEventListener('click', () => {
    $('#signSec').innerHTML = `<h2>Ask for changes</h2><form id="chForm" class="stack" style="gap:12px">
      <div class="field"><label for="nm2">Your name</label><input id="nm2" required value="${esc(a.c.name)}"></div>
      <div class="field"><label for="chMsg">What would you like changed?</label><textarea id="chMsg" required rows="4" placeholder="e.g. Can you include the garage windows?"></textarea></div>
      <button class="btn btn-primary" type="submit">Send to ${esc(a.b.name)}</button></form>`;
    $('#chForm').addEventListener('submit', async e => {
      e.preventDefault();
      const back = { k: 'quote', act: 'changes', id: a.id, n: a.n, h: a.h, name: $('#nm2').value.trim(), at: new Date().toISOString(), msg: $('#chMsg').value.trim() };
      await sendBack(a, back, { title: 'Request sent', label: 'Change request for quote', okText: `${esc(a.b.name)} got your message and will send you an updated quote.` });
    });
  });
}

/* ---------------- Service agreement ---------------- */
function planPage(a) {
  document.title = `Service Agreement ${a.n} · ${a.b.name}`;
  if (a.cs && !/^https:\/\//i.test(a.cs)) a.cs = ''; // only secure web links
  const lines = (a.p.items || []).map(([d, q, p]) => `<tr><td>${esc(d)}</td><td class="num">${esc(q)}</td><td class="num">${esc(p)}</td></tr>`).join('');
  app.innerHTML = `
  <article class="card sign-card doc-like">
    <header class="sign-head"><div><div class="sign-biz">${esc(a.b.name)}</div><div class="muted small">${esc([a.b.phone, a.b.email].filter(Boolean).join(' · '))}</div></div>
      <div class="right"><div class="sign-title">SERVICE AGREEMENT</div><div class="muted small">${esc(a.n)}</div></div></header>
    <p>Hi ${esc(a.c.first)}, please review your service plan below. If everything looks right, sign at the bottom.</p>
    <section><h2>${esc(a.p.name)}</h2>
      <div class="sign-facts">
        <div><span>Customer</span><b>${esc(a.c.name)}</b></div>
        ${a.c.address ? `<div><span>Service address</span><b>${esc(a.c.address)}</b></div>` : ''}
        <div><span>Price</span><b>${esc(a.p.price)}</b></div>
        <div><span>Schedule</span><b>${esc(a.p.schedule)}</b></div>
        <div><span>Starts</span><b>${esc(a.p.start)}</b></div>
        <div><span>Term</span><b>${esc(a.p.term)}</b></div>
      </div>
      ${lines ? `<table class="sign-items"><thead><tr><th>Service</th><th class="num">Qty</th><th class="num">Price</th></tr></thead><tbody>${lines}</tbody></table>` : ''}
      ${a.p.fee ? `<div class="sign-callout"><b>Early cancellation:</b> if you cancel within the first ${esc(a.p.termMonths)} months and before ${esc(a.p.minVisits)} services are completed, a fee of <b>${esc(a.p.fee)}</b> is charged to your card on file.</div>` : ''}
    </section>
    <section><h2>Terms and conditions</h2><div class="sign-terms">${esc(a.t)}</div></section>
    ${a.cs ? `<section><h2>Card for payments</h2><p class="muted small">Your card is saved securely by our payment provider. It is never shared with us in full.</p>
      <a class="btn" href="${esc(a.cs)}" target="_blank" rel="noopener">Add or update your card securely ↗</a></section>` : ''}
    <section id="signSec"><h2>Sign</h2>
      ${signBlock(a.c.name, `I have read and agree to this agreement and its terms, and I authorize ${esc(a.b.name)} to charge my card on file as described above.`, 'Sign agreement')}
    </section>
  </article>`;
  const pad = bindPad();
  $('#signForm').addEventListener('submit', async e => {
    e.preventDefault();
    const back = { k: 'plan', id: a.id, n: a.n, h: a.h, name: $('#nm').value.trim(), at: new Date().toISOString(), sig: pad.strokes.filter(s => s.length > 1) };
    pad.destroy();
    await sendBack(a, back, { title: 'Signed', label: 'Signed service agreement', okText: `Thank you! ${esc(a.b.name)} has your signed agreement.` });
  });
}

(async () => {
  const raw = location.hash.slice(1);
  if (!raw) return fail('This link is missing the details.');
  let a;
  try { a = await BH.unpack(raw); } catch (e) { return fail(e.message || 'This link could not be read. It may have been cut off.'); }
  if (a.k === 'quote') quotePage(a); else planPage(a);
})();
})();
