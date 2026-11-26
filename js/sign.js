/* Customer-facing signing page. The agreement arrives packed in the link
 * (after the #); nothing is stored here. After signing, the customer sends a
 * "signed" link back to the business, which records it in their app. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const fail = msg => { app.innerHTML = `<div class="card sign-card"><h1>Something went wrong</h1><p>${esc(msg)}</p><p class="muted">Please ask the business to send the link again.</p></div>`; };

(async () => {
  const raw = location.hash.slice(1);
  if (!raw) return fail('This link is missing the agreement details.');
  let a;
  try { a = await BH.unpack(raw); } catch (e) { return fail(e.message || 'This link could not be read. It may have been cut off.'); }
  document.title = `Service Agreement ${a.n} · ${a.b.name}`;
  const lines = (a.p.items || []).map(([d, q, p]) => `<tr><td>${esc(d)}</td><td class="num">${esc(q)}</td><td class="num">${esc(p)}</td></tr>`).join('');
  app.innerHTML = `
  <article class="card sign-card doc-like">
    <header class="sign-head"><div><div class="sign-biz">${esc(a.b.name)}</div><div class="muted small">${esc([a.b.phone, a.b.email].filter(Boolean).join(' · '))}</div></div>
      <div class="right"><div class="sign-title">SERVICE AGREEMENT</div><div class="muted small">${esc(a.n)}</div></div></header>
    <p>Hi ${esc(a.c.first)}, please review your service plan below. If everything looks right, sign at the bottom and tap <b>Send to ${esc(a.b.name)}</b>.</p>
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
      <form id="signForm" class="stack" style="gap:12px">
        <div class="field"><label for="nm">Your full name</label><input id="nm" name="name" required autocomplete="name" value="${esc(a.c.name)}"></div>
        <div class="field"><label>Your signature</label>
          <div class="sig-box"><canvas id="sig" aria-label="Signature pad. Draw your signature with your finger or mouse."></canvas><span class="sig-hint">Sign here</span></div>
          <button type="button" class="btn btn-sm" id="clearSig" style="align-self:flex-start;margin-top:6px">Clear</button></div>
        <label class="check"><input type="checkbox" id="agree" required> I have read and agree to this agreement and its terms, and I authorize ${esc(a.b.name)} to charge my card on file as described above.</label>
        <button class="btn btn-primary" id="signBtn" type="submit" disabled>Sign agreement</button>
      </form>
    </section>
  </article>`;

  const hint = $('.sig-hint');
  const pad = new BH.SignaturePad($('#sig'), emptyNow => { hint.style.display = emptyNow ? '' : 'none'; check(); });
  const check = () => { $('#signBtn').disabled = pad.isEmpty() || !$('#agree').checked || !$('#nm').value.trim(); };
  $('#agree').addEventListener('change', check); $('#nm').addEventListener('input', check);
  $('#clearSig').addEventListener('click', () => pad.clear());

  $('#signForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#nm').value.trim(), at = new Date().toISOString();
    const back = await BH.pack({ id: a.id, n: a.n, h: a.h, name, at, sig: pad.strokes.filter(s => s.length > 1) });
    const link = `${a.r}#/signed/${back}`;
    const msg = `Signed service agreement ${a.n} from ${name}: ${link}`;
    $('#signSec').innerHTML = `<div class="sign-done"><h2>✓ Signed</h2>
      <p>Thank you, ${esc(name.split(' ')[0])}! <b>One last step:</b> send your signed agreement to ${esc(a.b.name)}.</p>
      <div class="row">
        ${a.b.phone ? `<a class="btn btn-primary" href="sms:${encodeURIComponent(a.b.phone)}?&body=${encodeURIComponent(msg)}">Send by text</a>` : ''}
        ${a.b.email ? `<a class="btn ${a.b.phone ? '' : 'btn-primary'}" href="mailto:${encodeURIComponent(a.b.email)}?subject=${encodeURIComponent('Signed agreement ' + a.n)}&body=${encodeURIComponent(msg)}">Send by email</a>` : ''}
        <button class="btn" id="copyLink" type="button">Copy link</button>
        <button class="btn" type="button" onclick="window.print()">Print / save a copy</button>
      </div>
      <div class="field" style="margin-top:12px"><label for="backLink">Or copy this link and send it to ${esc(a.b.name)} any way you like</label>
        <input id="backLink" readonly value="${esc(link)}" onfocus="this.select()"></div>
      <p class="muted small">Signed by ${esc(name)} on ${new Date(at).toLocaleString()}.</p>
      <div class="sig-print">${BH.sigSVG(pad.strokes)}</div></div>`;
    $('#copyLink').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); $('#copyLink').textContent = 'Copied ✓'; } catch { prompt('Copy this link:', link); }
    });
    pad.destroy();
  });
})();
})();
