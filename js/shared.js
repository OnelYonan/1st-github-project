/* Business Hub — helpers shared by the main app (index.html) and the
 * customer signing page (sign.html). Exposes window.BH. */
(() => {
'use strict';

/* ----- compact, URL-safe packing of data into links ----- */
const b64url = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = str => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};
const canCompress = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** Object -> short string for a URL ("z" = compressed, "j" = plain). */
async function pack(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (!canCompress) return 'j' + b64url(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return 'z' + b64url(new Uint8Array(await new Response(stream).arrayBuffer()));
}
async function unpack(str) {
  const kind = str[0], bytes = fromB64url(str.slice(1));
  if (kind === 'j') return JSON.parse(new TextDecoder().decode(bytes));
  if (kind !== 'z' || !canCompress) throw new Error('This link cannot be opened in this browser.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

/** Short fingerprint of the agreement wording, so a signature is tied to exactly what was shown. */
async function fingerprint(text) {
  const data = new TextEncoder().encode(text);
  if (crypto?.subtle) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return [...h.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const b of data) h = ((h * 33) ^ b) >>> 0; // fallback for very old browsers
  return 'x' + h.toString(16);
}

/* ----- signatures: strokes of points scaled to 0-255 ----- */
const SIG_W = 600, SIG_H = 200;
function sigPath(strokes) {
  return (strokes || []).map(st => st.map(([x, y], i) => `${i ? 'L' : 'M'}${(x / 255 * SIG_W).toFixed(1)} ${(y / 255 * SIG_H).toFixed(1)}`).join('')).join('');
}
function sigSVG(strokes, { color = '#111', height = 70 } = {}) {
  if (!strokes?.length) return '';
  return `<svg viewBox="0 0 ${SIG_W} ${SIG_H}" style="height:${height}px;width:auto;max-width:100%" role="img" aria-label="Signature">
    <path d="${sigPath(strokes)}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Signature pad on a <canvas>. Works with finger, pen or mouse. */
class SignaturePad {
  constructor(canvas, onChange) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.strokes = []; this.cur = null; this.onChange = onChange;
    this.resize = this.resize.bind(this);
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); this.cur = [this.pt(e)]; this.strokes.push(this.cur); this.draw(); });
    canvas.addEventListener('pointermove', e => { if (!this.cur) return; const p = this.pt(e), last = this.cur.at(-1); if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) >= 2) { this.cur.push(p); this.draw(); } });
    const end = () => { if (this.cur) { if (this.cur.length === 1) this.cur.push([...this.cur[0]]); this.cur = null; this.onChange?.(this.isEmpty()); } };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    window.addEventListener('resize', this.resize); this.resize();
  }
  pt(e) {
    const r = this.c.getBoundingClientRect();
    return [Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 255), Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 255)];
  }
  resize() {
    const r = this.c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    this.c.width = Math.max(1, r.width * d); this.c.height = Math.max(1, r.height * d); this.draw();
  }
  draw() {
    const { ctx, c } = this; ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.5 * (window.devicePixelRatio || 1); ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
    for (const st of this.strokes) { ctx.beginPath(); st.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x / 255 * c.width, y / 255 * c.height)); ctx.stroke(); }
  }
  clear() { this.strokes = []; this.draw(); this.onChange?.(true); }
  isEmpty() { return !this.strokes.some(s => s.length > 1); }
  destroy() { window.removeEventListener('resize', this.resize); }
}

/* ----- agreement wording ----- */
// First version, kept so agreements signed or sent with it keep their exact wording.
const DEFAULT_TERMS_V1 = `1. Services. {business} will provide the services listed in this agreement on the schedule shown.
2. Term. This agreement starts on {start} and runs for {term} months.{renew}
3. Payment. You authorize {business} to charge your card on file for the plan price ({price}) and for any other amounts due under this agreement. A receipt will be sent for every charge.
4. Early cancellation. You may cancel at any time by letting us know. If you cancel within the first {term} months and before {minVisits} services have been completed, an early cancellation fee of {fee} will be charged to your card on file.
5. Scheduling. If weather or access prevents a visit, we will contact you to arrange a new date. Please make sure we can safely access the property on service days.
6. Satisfaction. If you are not happy with a service, tell us within 48 hours and we will make it right.
7. Card updates. Please let us know if your card is replaced or expires so your plan is not interrupted.`;

const DEFAULT_TERMS = `1. Services. {business} will provide the services listed in this agreement, including any add-ons, on the schedule shown.
2. Term. This agreement starts on {start} and runs for {term} months.{renew}
3. Payment. You authorize {business} to charge your card on file for the plan price ({price}) and for any other amounts due under this agreement. A receipt will be sent for every charge.
4. Early cancellation. You may cancel at any time by letting us know. If you cancel within the first {term} months and before {minVisits} services have been completed, an early cancellation fee of {fee} will be charged to your card on file.
5. Scheduling and access. If weather or access prevents a visit, we will contact you to arrange a new date. On service days you agree to give us safe access to the property, keep pets secured, close windows and doors, move fragile or valuable items away from work areas, and tell us about any known problems before we start.
6. Pre-existing conditions. Many homes have wear or hidden defects that cannot be seen before work begins. {business} is not responsible for damage that results from pre-existing, hidden or worn conditions, including but not limited to: loose, cracked, rotted, warped or improperly installed windows, frames, screens, seals or tracks; failed or fogged window seals; loose, damaged or improperly secured gutters, downspouts, fascia, soffits, siding, shingles or roofing; peeling, oxidized or failing paint, stain or coatings; deteriorated caulking, mortar, wood or concrete; and items that are old, brittle or already damaged.
7. Water and cleaning products. Window cleaning, gutter cleaning and pressure or soft washing use water and cleaning solutions. {business} is not responsible for water entering through open, unsealed or faulty windows, doors, vents, siding or roofing; for effects on plants, lawns or landscaping when reasonable precautions were taken; or for stains, etching, streaks or discoloration that were already present and become visible after cleaning.
8. Limitation of liability. To the fullest extent permitted by law, {business} and its owners, employees and subcontractors are not liable for any loss, damage, injury or claim arising from the services, except where caused by our gross negligence or wilful misconduct. Our total liability for any claim is limited to the amount you paid for the service visit in question, and we are not liable for indirect, incidental or consequential losses. By signing, you release {business} from any claim beyond these limits.
9. Reporting concerns. Any damage or concern must be reported to us in writing, with photos, within 48 hours of the service. We may inspect and, at our option, repair, re-clean or refund that visit. Concerns not reported within 48 hours are waived.
10. Card updates. Please let us know if your card is replaced or expires so your plan is not interrupted.
11. Entire agreement. This agreement, including the services and add-ons listed above, is the entire agreement between you and {business}. If any part is found to be unenforceable, the rest remains in effect.`;

window.BH = { pack, unpack, fingerprint, sigPath, sigSVG, SignaturePad, DEFAULT_TERMS, DEFAULT_TERMS_V1, SIG_W, SIG_H };
})();
