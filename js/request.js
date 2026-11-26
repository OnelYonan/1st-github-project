/* Public booking form. The business's details and public key arrive in the link (after the #).
 * The request is encrypted here so only the business's app can read it, then sent through the relay. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

(async () => {
  let a;
  try { a = await BH.unpack(location.hash.slice(1)); } catch { a = null; }
  if (!a?.t || !a.pk) { app.innerHTML = '<div class="card sign-card"><h1>This link isn’t complete</h1><p class="muted">Please ask the business for their booking link again.</p></div>'; return; }
  document.title = `Book with ${a.b.name}`;
  const chips = (name, list, multi = true) => `<div class="day-chips">${list.map(x => `<label class="chip"><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${esc(x)}"><span>${esc(x)}</span></label>`).join('')}</div>`;
  app.innerHTML = `
  <article class="card sign-card req-card">
    <header class="req-head"><img src="icons/icon-180.png" alt="" width="52" height="52"><div><div class="sign-biz">${esc(a.b.name)}</div><div class="muted small">Request a quote or book a visit${a.b.area ? ` · ${esc(a.b.area)}` : ''}</div></div></header>
    <form id="reqForm" class="stack" style="gap:16px">
      ${a.svc?.length ? `<section><h2>What do you need?</h2>${chips('services', [...a.svc, 'Something else'])}</section>` : ''}
      <section class="form-grid">
        <div class="field full"><label for="nm">Your name *</label><input id="nm" name="name" required autocomplete="name"></div>
        <div class="field"><label for="ph">Mobile phone *</label><input id="ph" name="phone" type="tel" required autocomplete="tel"></div>
        <div class="field"><label for="em">Email</label><input id="em" name="email" type="email" autocomplete="email"></div>
        <div class="field full"><label for="ad">Address of the property *</label><input id="ad" name="address" required autocomplete="street-address" placeholder="Street, city"></div>
      </section>
      <section><h2>When works for you?</h2>${chips('days', DAYS)}
        <div class="day-chips" style="margin-top:8px">${['Morning', 'Afternoon', 'Evening', 'Any time'].map(x => `<label class="chip"><input type="radio" name="time" value="${x}"><span>${x}</span></label>`).join('')}</div>
        <div class="field" style="margin-top:10px"><label for="dt">Preferred date (optional)</label><input id="dt" name="date" type="date"></div></section>
      <div class="field"><label for="nt">Anything we should know?</label><textarea id="nt" name="notes" rows="3" placeholder="e.g. 2-storey house, about 20 windows, dog in the yard"></textarea></div>
      ${a.src?.length ? `<div class="field"><label for="src">How did you hear about us?</label><select id="src" name="source"><option value="">Choose…</option>${a.src.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>` : ''}
      <button class="btn btn-primary req-send" type="submit">Send request</button>
      <p class="muted small" style="text-align:center;margin:0">Your details go only to ${esc(a.b.name)}. They’ll contact you to confirm.</p>
    </form>
  </article>`;
  $('#reqForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, fd = new FormData(f);
    const r = { name: fd.get('name').trim(), phone: fd.get('phone').trim(), email: (fd.get('email') || '').trim(), address: fd.get('address').trim(),
      services: fd.getAll('services'), days: fd.getAll('days'), time: fd.get('time') || '', date: fd.get('date') || '', notes: (fd.get('notes') || '').trim(),
      source: fd.get('source') || '', at: new Date().toISOString() };
    const btn = $('.req-send'); btn.disabled = true; btn.textContent = 'Sending…';
    const summary = `Booking request: ${r.name}, ${r.phone}, ${r.address}. ${r.services.join(', ')}${r.notes ? '. ' + r.notes : ''}`;
    try {
      await BH.relaySend(a.u || 'https://ntfy.sh', a.t, 'request', await BH.sealFor(r, a.pk));
      app.innerHTML = `<div class="card sign-card req-done"><div class="req-check">✓</div><h1>Request sent</h1>
        <p>Thanks, ${esc(r.name.split(' ')[0])}! ${esc(a.b.name)} has your request and will be in touch soon to confirm.</p>
        ${a.b.phone ? `<p class="muted small">In a hurry? Call or text <a href="tel:${esc(a.b.phone)}">${esc(a.b.phone)}</a>.</p>` : ''}</div>`;
    } catch {
      btn.disabled = false; btn.textContent = 'Send request';
      app.insertAdjacentHTML('beforeend', `<div class="card sign-card" style="margin-top:12px"><b>We couldn’t send that online.</b>
        <p class="muted small">Please send it by text or email instead. It’s all filled in for you.</p><div class="row">
        ${a.b.phone ? `<a class="btn btn-primary" href="sms:${encodeURIComponent(a.b.phone)}?&body=${encodeURIComponent(summary)}">Send by text</a>` : ''}
        ${a.b.email ? `<a class="btn" href="mailto:${encodeURIComponent(a.b.email)}?subject=${encodeURIComponent('Booking request')}&body=${encodeURIComponent(summary)}">Send by email</a>` : ''}</div></div>`);
    }
  });
})();
})();
