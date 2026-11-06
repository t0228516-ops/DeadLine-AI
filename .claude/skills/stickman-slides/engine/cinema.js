/* Cinema mode: full-screen 1920×1080 cartoon scenes on top of engine.js (rough primitives + stickman rig).
   A cinema deck defines CINE[n] = {D, T, poster, sfx:[[t,name,gain]], music, notes, draw(t)}:
     D — the scripted intro (gag, text reveal); T — total clip length: after D the scene keeps living (idle),
     so the presenter can talk over it; PowerPoint plays it once and holds the last frame (no loop restart).
   Text lives inside the world (stone slab, cave wall, chalkboard) — see slab()/wall()/board(). */

const CW = 1920, CH = 1080, GY = 905;
const CINE = {}; let CINE_TITLE = 'deck'; let CTHEME = {};

/* ---------- world backgrounds (full width) ---------- */
function skyF(c1, c2, id = 'skf') { return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="-200" y="-200" width="${CW + 400}" height="${CH + 400}" fill="url(#${id})"/>`; }
function sunF(x, y, r, c = '#FFD27A') { return `<circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="${c}" opacity=".22"/><circle cx="${x}" cy="${y}" r="${r * 1.35}" fill="${c}" opacity=".3"/>` + circ(x, y, r, { f: c, w: 0, n: 22, j: .3 }); }
function ridge(off, c, y, amp, per, o = {}) {
  const p = [[-200, CH + 50]]; const step = o.step ?? 60;
  for (let x = -200; x <= CW + 200; x += step) { const xx = x + off; p.push([x, y - amp * (0.55 + 0.45 * Math.sin(xx / per)) - amp * 0.35 * Math.sin(xx / (per * 0.37) + 1.3)]); }
  p.push([CW + 200, CH + 50]); return blob(p, { sharp: !!o.sharp, f: c, w: o.w ?? 5, j: 1.2, c: o.c ?? INK });
}
function groundF(c, y = GY) { return blob([[-200, y], [CW + 200, y - 6], [CW + 200, CH + 60], [-200, CH + 60]], { sharp: true, f: c, w: 7, j: 2 }); }
function tufts(y, off, n, c = '#6C8A2E', seed = 3) {
  let s = ''; for (let i = 0; i < n; i++) { const x = ((i * 397 + seed * 131) % (CW + 300)) - 150 + off; const h = 16 + (i * 37) % 22;
    s += line(x, y + (i % 3) * 18, x - 8, y + (i % 3) * 18 - h, { w: 4, c }) + line(x, y + (i % 3) * 18, x + 4, y + (i % 3) * 18 - h - 6, { w: 4, c }) + line(x, y + (i % 3) * 18, x + 12, y + (i % 3) * 18 - h + 4, { w: 4, c }); }
  return s;
}
function acacia(x, y, s = 1, c = '#4E5B2A') {
  return line(x, y, x - 6 * s, y - 150 * s, { w: 14 * s, c: '#5A4027' }) + line(x - 6 * s, y - 110 * s, x - 60 * s, y - 170 * s, { w: 9 * s, c: '#5A4027' }) + line(x - 4 * s, y - 130 * s, x + 50 * s, y - 180 * s, { w: 9 * s, c: '#5A4027' }) +
    ell(x - 10 * s, y - 190 * s, 150 * s, 34 * s, { f: c, w: 5 }) + ell(x - 70 * s, y - 175 * s, 70 * s, 24 * s, { f: c, w: 5 }) + ell(x + 60 * s, y - 196 * s, 80 * s, 26 * s, { f: c, w: 5 });
}
function rock(x, y, w, h, c = '#9C958A') { return blob([[x - w / 2, y], [x - w * .42, y - h * .7], [x - w * .1, y - h], [x + w * .3, y - h * .85], [x + w / 2, y - h * .3], [x + w / 2, y]], { f: c, w: 6, j: 2 }); }
function vignette(op = .35) { return `<defs><radialGradient id="vg" cx="50%" cy="50%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${op}"/></radialGradient></defs><rect x="0" y="0" width="${CW}" height="${CH}" fill="url(#vg)"/>`; }
/** whole-world camera: centre (cx,cy) at zoom z */
const camG = (s, cx = CW / 2, cy = CH / 2, z = 1) => `<g transform="translate(${CW / 2} ${CH / 2}) scale(${z.toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})">${s}</g>`;

/* ---------- in-world text ---------- */
const FO = (x, y, w, h, html, cls = '') => `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" class="tb ${cls}" style="width:${w}px;height:${h}px">${html}</div></foreignObject>`;
const textHTML = (c) => (c.k ? `<div class="k">${c.k}</div>` : '') + (c.title ? `<h1>${c.title}</h1>` : '') + (c.big ? `<div class="big">${c.big}</div>` : '') + (c.lab ? `<div class="lab">${c.lab}</div>` : '') + (c.lines ? `<ul>${c.lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : '');
/** stone slab with carved text; u = drop progress (0 above screen → 1 landed) */
function slab(x, y, w, h, c, u = 1, o = {}) {
  const dy = -(1 - u) * (y + h + 80); const col = o.col ?? '#B7AEA0';
  let s = blob([[x, y + 30], [x + 30, y], [x + w - 40, y + 6], [x + w, y + 40], [x + w - 8, y + h - 20], [x + w - 50, y + h], [x + 24, y + h - 6], [x - 6, y + h - 46]], { sharp: true, f: col, w: 8, j: 2.5 });
  s += blob([[x + 22, y + 34], [x + 44, y + 20], [x + w - 46, y + 26], [x + w - 22, y + 50], [x + w - 28, y + h - 34], [x + w - 60, y + h - 20], [x + 34, y + h - 26], [x + 16, y + h - 56]], { sharp: true, f: o.face ?? '#CFC7B8', w: 0, j: 2 });
  s += line(x + w - 70, y + 14, x + w - 110, y + 70, { w: 3, c: '#6f675c' }) + line(x + w - 110, y + 70, x + w - 96, y + 104, { w: 3, c: '#6f675c' }) + line(x + 30, y + h - 30, x + 76, y + h - 64, { w: 3, c: '#6f675c' });
  s += FO(x + 52, y + 40, w - 104, h - 80, textHTML(c), 'carved');
  return g(s, `translate(0 ${dy.toFixed(1)})`);
}
/** speech bubble: (x,y) bubble centre, (tx,ty) tail tip; t/t0/t1 — visible window with pop */
function bubble(x, y, w, h, text, tx, ty, t, t0, t1, o = {}) {
  if (t < t0 || t > t1 + .2) return '';
  const sc = t < t0 + .25 ? EASE.back(seg(t, t0, t0 + .25, 'l')) : 1; const op = t > t1 ? 1 - seg(t, t1, t1 + .2, 'l') : 1;
  const bx = -w / 2, by = -h / 2; const lx = tx - x, ly = ty - y;
  let s = `<path d="M${-w * .12} ${h / 2 - 4} L${lx} ${ly} L${w * .08} ${h / 2 - 4}Z" fill="#fff" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`;
  s += `<rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="${Math.min(46, h / 2)}" fill="#fff" stroke="${INK}" stroke-width="6"/>`;
  s += `<rect x="${-w * .12 + 4}" y="${h / 2 - 9}" width="${w * .2 - 8}" height="12" fill="#fff"/>`;
  s += `<foreignObject x="${bx + 18}" y="${by + 8}" width="${w - 36}" height="${h - 16}"><div xmlns="http://www.w3.org/1999/xhtml" class="bub" style="height:${h - 16}px;display:flex;align-items:center;justify-content:center;font-size:${o.fs ?? 40}px">${text}</div></foreignObject>`;
  return g(s, `translate(${x} ${y}) scale(${sc.toFixed(3)})`, op);
}
/** big cartoon sound word (no burst star) */
function sfxWord(x, y, label, t, t0, t1, o = {}) {
  if (t < t0 || t > t1 + .2) return ''; const sc = t < t0 + .22 ? EASE.back(seg(t, t0, t0 + .22, 'l')) : 1; const op = t > t1 ? 1 - seg(t, t1, t1 + .2, 'l') : 1;
  return g(txt(0, 0, label, { font: 'Mont', fw: 900, fs: o.fs ?? 96, f: o.f ?? GOLD, stroke: INK, sw: 14 }), `translate(${x} ${y}) rotate(${o.rot ?? -8}) scale(${sc.toFixed(3)})`, op);
}

/* ---------- characters ---------- */
/** the time traveller: red cap + blue backpack */
function hero(p, o = {}) {
  const cap = (J, q) => {
    const { HR, s } = J; const f = q.face || 0;
    let h = `<path d="M${-HR - 4 * s} ${-2 * s} Q${-HR} ${-HR * 1.32} 0 ${-HR - 7 * s} Q${HR} ${-HR * 1.32} ${HR + 4 * s} ${-2 * s} Z" fill="#E63946" stroke="${INK}" stroke-width="${5 * s}" stroke-linejoin="round"/>`;
    if (f) h += `<path d="M${f * HR * 0.2} ${-6 * s} L${f * (HR + 30 * s)} ${-4 * s} L${f * (HR + 30 * s)} ${4 * s} L${f * HR * 0.2} ${2 * s}Z" fill="#E63946" stroke="${INK}" stroke-width="${4.5 * s}" stroke-linejoin="round"/>`;
    else h += ell(0, -2 * s, HR + 10 * s, 8 * s, { f: '#E63946', w: 4.5 * s });
    return g(h, `translate(${J.hc[0].toFixed(1)} ${J.hc[1].toFixed(1)}) rotate(${J.ha.toFixed(1)})`);
  };
  const pack = (J, q) => { const f = q.face || 1; const m = [(J.hip[0] + J.neck[0]) / 2 - f * 26 * J.s, (J.hip[1] + J.neck[1]) / 2 + 4 * J.s];
    return rect(m[0] - 30 * J.s, m[1] - 44 * J.s, 60 * J.s, 86 * J.s, { f: '#2E86DE', w: 6 * J.s }) + rect(m[0] - 22 * J.s, m[1] + 4 * J.s, 44 * J.s, 26 * J.s, { f: '#5DA9F0', w: 4 * J.s }); };
  return stick(p, { ...o, behind: (J, q) => pack(J, q) + (o.behind ? o.behind(J, q) : ''), front: (J, q) => cap(J, q) + (o.front ? o.front(J, q) : '') });
}
/** an ancient person: messy hair, fur tunic, optional beard */
function caveman(p, o = {}) {
  const fur = (J, q) => { const { hip, neck, s } = J; const pts = [[neck[0] - 24 * s, neck[1] + 18 * s], [neck[0] + 20 * s, neck[1] + 14 * s], [hip[0] + 30 * s, hip[1] + 6 * s], [hip[0] + 34 * s, hip[1] + 52 * s], [hip[0] + 6 * s, hip[1] + 44 * s], [hip[0] - 20 * s, hip[1] + 58 * s], [hip[0] - 32 * s, hip[1] + 8 * s]];
    let f = blob(pts, { sharp: true, f: o.furC ?? '#C9853A', w: 5 * s, j: 1.2 }); for (const [a, b] of [[-.1, .45], [.3, .7], [-.2, .9], [.25, .2]]) f += circ(lerp(neck[0], hip[0], b) + a * 40 * s, lerp(neck[1], hip[1], b) + 6 * s, 5 * s, { f: '#8A5222', w: 0, j: .2 });
    return f; };
  const hair = (J, q) => { const { hc, HR, s } = J; const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * (1.05 + i * 0.09); const rr = HR + (i % 2 ? 10 : 2) * s; pts.push([Math.cos(a) * rr, Math.sin(a) * rr - 4 * s]); }
    pts.push([HR * .7, -HR * .2]); pts.push([-HR * .7, -HR * .3]);
    let h = blob(pts, { sharp: true, f: o.hairC ?? '#4A2F1A', w: 4 * s, j: 1 });
    if (o.beard) h += blob([[-HR * .55, HR * .35], [HR * .55, HR * .35], [HR * .3, HR * 1.05], [0, HR * 1.25], [-HR * .3, HR * 1.05]], { f: o.hairC ?? '#4A2F1A', w: 4 * s, j: 1 });
    return g(h, `translate(${hc[0].toFixed(1)} ${hc[1].toFixed(1)}) rotate(${J.ha.toFixed(1)})`); };
  return stick(p, { ...o, beard: (J, q) => fur(J, q) + (o.beard2 ? o.beard2(J, q) : ''), front: (J, q) => hair(J, q) + (o.front ? o.front(J, q) : '') });
}

/* ---------- props ---------- */
function phone(x, y, a = 0, o = {}) {
  let s = rect(-22, -38, 44, 76, { f: '#22252b', w: 5, j: .6 }) + `<rect x="-15" y="-30" width="30" height="58" rx="3" fill="${o.screen ?? '#7FD3FF'}"/>`;
  if (o.crack) s += line(-12, -24, 4, -4, { w: 2.5, c: '#fff' }) + line(4, -4, -6, 12, { w: 2.5, c: '#fff' }) + line(4, -4, 13, 6, { w: 2.5, c: '#fff' });
  if (o.bat != null) s += `<rect x="-9" y="-6" width="16" height="10" fill="none" stroke="#fff" stroke-width="2"/><rect x="-7" y="-4" width="${Math.max(1, 12 * o.bat)}" height="6" fill="${o.bat < .2 ? '#ff4d4d' : '#7CFC8A'}"/>`;
  return g(s, `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a})`);
}
function stoneTool(x, y, a = 0, s = 1) { return g(blob([[-26, 8], [-14, -16], [10, -22], [28, -4], [18, 16], [-8, 20]], { sharp: true, f: '#8E8A84', w: 5, j: .8 }) + line(-8, -8, 12, 6, { w: 3, c: '#5d5952' }), `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a}) scale(${s})`); }
function melon(x, y, s = 1, half = 0, split = 0) {
  if (!half) { let m = ell(x, y, 62 * s, 44 * s, { f: '#7BB24A', w: 6 }); for (let i = -2; i <= 2; i++) m += `<path d="M${x + i * 22 * s} ${y - 40 * s}Q${x + i * 28 * s} ${y} ${x + i * 22 * s} ${y + 40 * s}" stroke="#3F6E22" stroke-width="5" fill="none"/>`; return m; }
  const piece = (dx, sgn) => g(`<path d="M0 ${-44 * s}A${62 * s} ${44 * s} 0 0 ${sgn > 0 ? 1 : 0} 0 ${44 * s}Z" fill="#F7D774" stroke="${INK}" stroke-width="6"/>` + `<path d="M${sgn * 6} ${-36 * s}A${54 * s} ${36 * s} 0 0 ${sgn > 0 ? 1 : 0} ${sgn * 6} ${36 * s}" fill="none" stroke="#7BB24A" stroke-width="7"/>`, `translate(${x + dx} ${y})`);
  return piece(-split, -1) + piece(split, 1);
}
/** one half of a split melon: sgn -1 left half, +1 right half */
function melonHalf(x, y, s = 1, sgn = 1) {
  return g(`<path d="M0 ${-44 * s}A${62 * s} ${44 * s} 0 0 ${sgn > 0 ? 1 : 0} 0 ${44 * s}Z" fill="#F7D774" stroke="${INK}" stroke-width="6"/>` + `<path d="M${sgn * 6} ${-36 * s}A${54 * s} ${36 * s} 0 0 ${sgn > 0 ? 1 : 0} ${sgn * 6} ${36 * s}" fill="none" stroke="#7BB24A" stroke-width="7"/>`, `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
}
function portal(x, y, t, u) { if (u <= 0) return ''; let s = '';
  for (let i = 0; i < 6; i++) { const r = (40 + i * 34) * u; const a0 = t * (3 + i * .6) + i; s += `<path d="M${(x + Math.cos(a0) * r).toFixed(1)} ${(y + Math.sin(a0) * r * .9).toFixed(1)} A${r} ${r * .9} 0 0 1 ${(x + Math.cos(a0 + 2.4) * r).toFixed(1)} ${(y + Math.sin(a0 + 2.4) * r * .9).toFixed(1)}" stroke="${i % 2 ? '#7B61FF' : '#3DE0FF'}" stroke-width="${14 - i}" fill="none" stroke-linecap="round" opacity="${(.95 - i * .1).toFixed(2)}"/>`; }
  return `<circle cx="${x}" cy="${y}" r="${230 * u}" fill="#2a1c66" opacity="${(.35 * u).toFixed(2)}"/>` + s + circ(x, y, 30 * u, { f: '#fff', w: 0, j: .3 }); }
function sparkle(x, y, r, op = 1) { return `<path d="M${x} ${y - r}L${x + r * .22} ${y - r * .22}L${x + r} ${y}L${x + r * .22} ${y + r * .22}L${x} ${y + r}L${x - r * .22} ${y + r * .22}L${x - r} ${y}L${x - r * .22} ${y - r * .22}Z" fill="#fff" opacity="${op}"/>`; }
function bird(x, y, s, t) { const f = Math.sin(t * 9) * 10 * s; return `<path d="M${x - 22 * s} ${y + f}Q${x - 10 * s} ${y - 8 * s} ${x} ${y}Q${x + 10 * s} ${y - 8 * s} ${x + 22 * s} ${y + f}" stroke="${INK}" stroke-width="${4 * s}" fill="none" stroke-linecap="round"/>`; }

/* ---------- render loop ---------- */
let CSC, CSTAGE;
window.render = function (t) {
  SEED = Math.floor(t * 8) + 1; CT = 0;
  let body = CSC.draw(t);
  const fin = CSC.fadeIn ?? .35; if (t < fin) body += `<rect x="0" y="0" width="${CW}" height="${CH}" fill="#000" opacity="${(1 - t / fin).toFixed(3)}"/>`;
  CSTAGE.innerHTML = body;
};
window.deckMeta = () => ({ title: CINE_TITLE, cinema: true, slides: Object.keys(CINE).map(Number).sort((a, b) => a - b).map((n) => ({ n, D: CINE[n].T ?? CINE[n].D, intro: CINE[n].D, notes: CINE[n].notes || '', poster: CINE[n].poster ?? 1, sfx: CINE[n].sfx || [], music: CINE[n].music || null })) });
window.ready = new Promise((res, rej) => {
  const q = new URLSearchParams(location.search); const N = +(q.get('s') || 1);
  const sc = document.createElement('script'); sc.src = q.get('deck'); sc.onerror = () => rej(new Error('deck not found'));
  sc.onload = async () => {
    for (const [k, v] of Object.entries(CTHEME)) document.documentElement.style.setProperty('--' + k, v);
    CSC = CINE[N]; CSTAGE = document.getElementById('stage');
    await Promise.all(['700 20px Nunito', '400 20px Nunito', '900 20px Mont', '800 20px Mont', '700 20px Caveat'].map((f) => document.fonts.load(f, 'Әә'))).catch(() => {});
    await document.fonts.ready; render(0); res(CSC.T ?? CSC.D);
  };
  document.head.appendChild(sc);
});
