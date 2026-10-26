'use strict';
/**
 * ШАБЛОНДЫ БЕЙІМДЕУ: бөтен шаблон DeadLine-ға ыңғайлы болып бір рет түзетіледі (толтыру кезінде жамалмайды).
 *
 *   adaptDeck(buf, id)  — жалпы өтулер + library/adapt/<id>.json патчы (бар болса); prepareDeck-те шаблон жүктелген соң.
 *   describe(buf)       — әр слайдтың элементтері (аты, түрі, қорабы % түрінде) — патч жазуға.
 *
 * Бет нөмірі: шаблонның өз нөмірі («02» шеттегі шеңбер) біздің слайд ретімізге сай емес — renumberFolios толтырылған
 * презентацияда оны нақты ретпен қайта жазады (дизайн элементі сақталады).
 *
 * Патч (<id>.json): { "slides": { "<шаблон слайд нөмірі>": [ op, … ] } }, op:
 *   { "op":"box",    "name":"TextBox 5", "x":%, "y":%, "w":%, "h":% }   — қорапты жылжыту/өлшемі (берілгендері ғана)
 *   { "op":"remove", "name":"Freeform 9" }                              — элементті алу (иллюстрация мәтінді жапса)
 *   { "op":"algn",   "name":"TextBox 5", "algn":"l|ctr|r" }             — туралау
 *   { "op":"maxpt",  "name":"TextBox 5", "pt":40 }                      — кегльдің жоғарғы шегі (тым ірі тақырып)
 * Аттар шаблондағыдай; бір слайдта бірдей аты екеу болса, "nth" (0-негізді) беріледі.
 */
const fs = require('fs');
const path = require('path');
const { readZipAll, writeZipAll } = require('../templateFill');
const { sldSzMatch, orderedSlides } = require('../../../design-dna/structure');

const DIR = path.join(__dirname, 'adapt');
const EL_RE = /<p:(sp|pic|cxnSp)>(?:(?!<p:(?:sp|pic|cxnSp)>)[\s\S])*?<\/p:\1>/g;

function slideSize(files) {
  const m = sldSzMatch(files.get('ppt/presentation.xml'));
  return m ? { W: +m[1], H: +m[2] } : { W: 12192000, H: 6858000 };
}

/** Топтардың аралықтары (ішіндегі координат басқа кеңістікте) */
function groupSpans(xml) {
  const spans = []; const OPEN = '<p:grpSp>'; const CLOSE = '</p:grpSp>';
  let i = 0;
  for (;;) {
    const a = xml.indexOf(OPEN, i); if (a < 0) return spans;
    let depth = 0; let j = a; let end = -1;
    while (j < xml.length) {
      const o = xml.indexOf(OPEN, j); const c = xml.indexOf(CLOSE, j);
      if (c < 0) break;
      if (o >= 0 && o < c) { depth++; j = o + OPEN.length; } else { depth--; j = c + CLOSE.length; if (!depth) { end = j; break; } }
    }
    if (end < 0) return spans;
    spans.push([a, end]); i = end;
  }
}

/** Слайдтың жоғарғы деңгейдегі элементтері */
function elements(xml) {
  const spans = groupSpans(xml);
  const out = [];
  for (const m of String(xml).matchAll(EL_RE)) {
    const inGroup = spans.some(([a, b]) => m.index > a && m.index < b);
    const el = m[0];
    const name = (el.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/) || [])[1] || '';
    const x = el.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    const text = [...el.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join('');
    const sz = Math.max(0, ...[...el.matchAll(/\bsz="(\d+)"/g)].map((s) => +s[1])) / 100;
    out.push({ el, index: m.index, name, inGroup, text, sz, img: /<a:blipFill/.test(el) || m[1] === 'pic',
      box: x ? { x: +x[1], y: +x[2], w: +x[3], h: +x[4] } : null });
  }
  return out;
}

const pct = (v, of) => Math.round((v / of) * 1000) / 10;

/** Патч жазуға: әр слайдтың элементтері, % түрінде */
function describe(buf) {
  const files = readZipAll(buf);
  const { W, H } = slideSize(files);
  return orderedSlides(files).map((sp, i) => ({
    slide: i + 1,
    items: elements(String(files.get(sp))).filter((e) => e.box && !e.inGroup).map((e) => ({
      name: e.name, kind: e.text.trim() ? 'text' : e.img ? 'image' : 'shape',
      x: pct(e.box.x, W), y: pct(e.box.y, H), w: pct(e.box.w, W), h: pct(e.box.h, H),
      ...(e.text.trim() ? { sz: e.sz, text: e.text.slice(0, 40) } : {}),
    })),
  }));
}

/**
 * Шаблонның өз бет нөмірі (folio): шеттегі (үстіңгі/астыңғы 15%) кішкене 1–2 цифрлы жазу не цифры ғана бар кішкене топ
 * (шеңбер + сан). Мазмұндағы нөмір (кезең «01», қадам «4») емес екенін білу үшін — шаблонның ≥3 слайдында бір орында тұруы керек.
 * @returns {Array<{key:string, block:string}>}
 */
function folioCandidates(xml, W, H) {
  const els = elements(xml).filter((e) => e.box && !e.inGroup);
  const key = (cx, cy) => `${Math.round((cx / W) * 20)}:${Math.round((cy / H) * 20)}`;
  const out = [];
  for (const e of els) {
    if (!/^\s*(?:\p{L}+\.?\s+)?0?\d{1,2}\s*$/u.test(e.text) || e.sz > 40 * (H / 6858000)) continue;
    const b = e.box; const cx = b.x + b.w / 2; const cy = b.y + b.h / 2;
    if (!(cy > H * 0.85 || cy < H * 0.15) || b.w > W * 0.08) continue;
    out.push({ key: key(cx, cy), block: e.el });
    // нөмірдің астындағы шеңбер/таблетка (мәтінсіз, кішкене, нөмірдің ортасын қамтиды)
    for (const h of els) {
      if (h === e || h.text.trim() || !h.box) continue;
      const r = h.box;
      if (r.w < W * 0.08 && r.h < H * 0.14 && cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h) out.push({ key: key(cx, cy), block: h.el });
    }
  }
  // Canva: нөмір мен шеңбері бір топта
  for (const [a, b] of groupSpans(xml)) {
    const g = xml.slice(a, b);
    const text = [...g.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join('');
    if (!/^\s*(?:\p{L}+\.?\s+)?0?\d{1,2}\s*$/u.test(text)) continue;
    const x = g.match(/<p:grpSpPr>\s*<a:xfrm\b[^>]*>\s*<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (!x) continue;
    const cx = +x[1] + +x[3] / 2; const cy = +x[2] + +x[4] / 2;
    if (+x[3] > W * 0.08 || +x[4] > H * 0.14 || !(cy > H * 0.85 || cy < H * 0.15)) continue;
    out.push({ key: key(cx, cy), block: g });
  }
  return out;
}

/**
 * Толтырылған презентацияда шаблонның бет нөмірлерін нақты ретпен қайта жазу (01, 02 …; түпнұсқа пішімі — «1» не «01» — сақталады).
 * Нөмір орны кемі 3 слайдта қайталануы керек (мазмұндағы «01-кезең» тиіспейді). Credits слайды есепке кірмейді (ол кейін қосылады).
 */
function renumberFolios(buf) {
  const files = readZipAll(buf);
  const { W, H } = slideSize(files);
  const slides = orderedSlides(files);
  const per = slides.map((sp) => folioCandidates(String(files.get(sp)), W, H).filter((c) => /<a:t>[^<]*\d{1,2}\s*<\/a:t>/.test(c.block)));
  const count = new Map();
  for (const list of per) for (const k of new Set(list.map((c) => c.key))) count.set(k, (count.get(k) || 0) + 1);
  let changed = false;
  slides.forEach((sp, i) => {
    let xml = String(files.get(sp));
    for (const c of per[i]) {
      if ((count.get(c.key) || 0) < 3) continue;
      const nb = c.block.replace(/<a:t>([^<]*?)(0?)(\d{1,2})(\s*)<\/a:t>/, (m, a, z, d, b) => `<a:t>${a}${z || d.length === 2 ? String(i + 1).padStart(2, '0') : String(i + 1)}${b}</a:t>`);
      if (nb !== c.block) { xml = xml.replace(c.block, () => nb); changed = true; }
    }
    files.set(sp, xml);
  });
  return changed ? writeZipAll(files) : buf;
}

function setBox(el, box, W, H) {
  return el.replace(/<a:off x="(-?\d+)" y="(-?\d+)"\/>(\s*)<a:ext cx="(\d+)" cy="(\d+)"\/>/, (m, x, y, sp, w, h) => {
    const nx = box.x != null ? Math.round((box.x / 100) * W) : +x; const ny = box.y != null ? Math.round((box.y / 100) * H) : +y;
    const nw = box.w != null ? Math.round((box.w / 100) * W) : +w; const nh = box.h != null ? Math.round((box.h / 100) * H) : +h;
    return `<a:off x="${nx}" y="${ny}"/>${sp}<a:ext cx="${nw}" cy="${nh}"/>`;
  });
}

function setAlgn(el, algn) {
  return el.replace(/<a:p>(?!<a:pPr)/g, `<a:p><a:pPr algn="${algn}"/>`)
    .replace(/<a:pPr\b([^>]*?)(\/?)>/g, (m, a, sl) => `<a:pPr${/\balgn=/.test(a) ? a.replace(/\balgn="\w+"/, `algn="${algn}"`) : `${a} algn="${algn}"`}${sl}>`);
}

function applyOps(xml, ops, W, H) {
  let out = xml;
  for (const op of ops || []) {
    const hits = elements(out).filter((e) => e.name === op.name && !e.inGroup);
    const e = hits[op.nth || 0];
    if (!e) continue;
    let next = e.el;
    if (op.op === 'remove') next = '';
    else if (op.op === 'box') next = setBox(e.el, op, W, H);
    else if (op.op === 'algn') next = setAlgn(e.el, op.algn);
    else if (op.op === 'maxpt') next = e.el.replace(/\bsz="(\d+)"/g, (m, v) => `sz="${Math.min(+v, Math.round(op.pt * 100))}"`);
    out = out.replace(e.el, () => next);
  }
  return out;
}

function patchOf(id) {
  if (!id) return null;
  try { return JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8')); } catch { return null; }
}

/**
 * Шеттегі кішкене жапсырма (бұрыштағы тақ/бренд сөз: «Tech», «2025»): қорабы ағылшын сөзіне ғана сай тар —
 * қазақ сөзі сыймай сөз ортасынан бөлінеді. Слайдтың ішіне қарай (туралауына сай) кеңейтіледі.
 */
function widenEdgeLabels(xml, W, H) {
  let out = xml;
  const all = elements(xml).filter((x) => x.box && !x.inGroup);
  for (const e of all) {
    if (!e.box || e.inGroup || !e.text.trim() || e.text.length > 24 || /<p:ph\b/.test(e.el) || !/\p{L}{2}/u.test(e.text)) continue;
    if ((e.el.match(/<a:p>/g) || []).length !== 1 || /\srot="(?!0")/.test(e.el)) continue;
    const b = e.box; const want = W * 0.16;
    if (b.w >= want || b.h > H * 0.12) continue;
    const nearRight = b.x + b.w > W * 0.9; const nearLeft = b.x < W * 0.1;
    const corner = b.y < H * 0.15 || b.y + b.h > H * 0.85;
    if ((!nearRight && !nearLeft) || !corner) continue;
    const algn = (e.el.match(/<a:pPr\b[^>]*\balgn="(\w+)"/) || [])[1] || 'l';
    // оң жақтағы (оңға туралған) — сол жаққа; сол жақтағы — оң жаққа; ортаға туралған — екі жаққа
    const nx = algn === 'ctr' ? Math.max(0, b.x + b.w / 2 - want / 2) : nearRight ? b.x + b.w - want : b.x;
    const nw = Math.min(want, W - nx);
    // кеңейген қорап басқа мәтінге тимейді
    const hit = all.some((o) => o !== e && o.text.trim() && o.box.x < nx + nw && o.box.x + o.box.w > nx && o.box.y < b.y + b.h && o.box.y + o.box.h > b.y);
    if (hit) continue;
    const el2 = e.el.replace(/(<a:off x=")-?\d+(" y="-?\d+"\/>\s*<a:ext cx=")\d+/, `$1${Math.round(nx)}$2${Math.round(nw)}`);
    // оң шетте тұрып солға туралған болса — оңға туралады (мәтін бұрынғы орнында, бұрышта қалсын)
    out = out.replace(e.el, () => (nearRight && algn === 'l' ? el2.replace(/<a:pPr\b(?![^>]*algn=)/, '<a:pPr algn="r"').replace(/(<a:pPr\b[^>]*\balgn=")l"/, '$1r"') : el2));
  }
  return out;
}

/** Шаблонды бейімдеу (толық шаблон, слайд нөмірлері — шаблондағыдай) */
function adaptDeck(buf, id, o = {}) {
  const files = readZipAll(buf);
  const { W, H } = slideSize(files);
  const patch = o.patch || patchOf(id);
  const slides = orderedSlides(files);
  let changed = false;
  slides.forEach((sp, i) => {
    const xml = String(files.get(sp));
    let out = widenEdgeLabels(xml, W, H);
    const ops = patch && patch.slides && patch.slides[String(i + 1)];
    if (ops) out = applyOps(out, ops, W, H);
    if (out !== xml) { files.set(sp, out); changed = true; }
  });
  return changed ? writeZipAll(files) : buf;
}

/**
 * Тақырыпқа жат «тұлға» әшекейі (Рим императорының мүсіні — Қазақ хандығы тақырыбында): алынып, орнына өз кітапханамыздан
 * (design/decor.js — гравюра, қазақ ою-нақышы) тақырыпқа сай элемент қойылады. Түсі — алынған әшекейдің өз түсі (шаблон үйлесімі сақталады),
 * өлшемі — сол қорапқа пропорциямен, асты сол жерде (мүсін тұғырда тұрғандай).
 * Патч: "figures": [{ "media": "image3.png", "keep": "рим|грек|antique" }] — keep тақырыпқа сай болса, әшекей қалады.
 * page — ашық puppeteer беті (webp/svg → түсті PNG).
 */
async function replaceFigures(buf, id, topic, page, o = {}) {
  const patch = o.patch || patchOf(id);
  const figs = ((patch && patch.figures) || []).filter((f) => !(f.keep && new RegExp(f.keep, 'iu').test(String(topic || ''))));
  if (!figs.length || !page) return buf;
  const D = require('../design/decor');
  const files = readZipAll(buf);
  const { W, H } = slideSize(files);
  const used = new Set();
  let n = 0;
  for (const sp of orderedSlides(files)) {
    const rp = sp.replace(/([^/]+)$/, '_rels/$1.rels');
    let rels = String(files.get(rp) || '');
    const target = (rid) => (rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)) || [])[1];
    let xml = String(files.get(sp));
    for (const e of elements(xml)) {
      if (!e.box || e.inGroup) continue;
      const rid = (e.el.match(/<a:blip\b[^>]*r:embed="([^"]+)"/) || [])[1];
      const t = rid && target(rid);
      if (!t || !figs.some((f) => t.split('/').pop() === f.media)) continue;
      const fig = figs.find((f) => t.split('/').pop() === f.media);
      // тақырыптан әшекей табылмаса — шаблонның өз саласының сөздері (медицина шаблонында — медицина), сосын жалпы
      const pick = D.pickDecor(topic, used, n) || (fig.fallback && D.pickDecor(fig.fallback, used, n)) || D.pickDecor('кітап білім тарих мұра ғасыр', used, n);
      if (!pick) { xml = xml.replace(e.el, ''); continue; }
      const orig = files.get('ppt/media/' + t.split('/').pop());
      const res = await page.evaluate(async (src, origSrc) => {
        const load = (u) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('img')); i.src = u; });
        const [im, og] = await Promise.all([load(src), load(origSrc)]);
        // алынған әшекейдің орташа түсі (мөлдір емес пикселдері) — жаңа элемент сол түске боялады
        const sc = document.createElement('canvas'); sc.width = 32; sc.height = 32; const sg = sc.getContext('2d'); sg.drawImage(og, 0, 0, 32, 32);
        const px = sg.getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0, k = 0;
        for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 160) { r += px[i]; g += px[i + 1]; b += px[i + 2]; k++; }
        const tint = k ? [r / k, g / k, b / k].map((v) => Math.round(Math.min(255, v * 1.08))) : [230, 220, 200];
        const nw = im.naturalWidth || 480; const nh = im.naturalHeight || 480; const s = Math.min(1, 900 / Math.max(nw, nh));
        const c = document.createElement('canvas'); c.width = Math.round(nw * s); c.height = Math.round(nh * s); const cg = c.getContext('2d');
        cg.drawImage(im, 0, 0, c.width, c.height);
        cg.globalCompositeOperation = 'source-in'; cg.fillStyle = `rgb(${tint.join(',')})`; cg.fillRect(0, 0, c.width, c.height);
        return { uri: c.toDataURL('image/png'), w: c.width, h: c.height };
      }, D.decorUri(pick.file), `data:image/png;base64,${Buffer.from(orig || '').toString('base64')}`).catch(() => null);
      if (!res) continue;
      const media = `ppt/media/dl_fig_${++n}.png`;
      files.set(media, Buffer.from(res.uri.split(',')[1], 'base64'));
      const nrid = `rIdDlFig${n}`;
      rels = rels.replace('</Relationships>', `<Relationship Id="${nrid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media.split('/').pop()}"/></Relationships>`);
      // қорапқа пропорциямен (90%), асты мен ортасы сол жерде
      // қораптың слайдта КӨРІНЕТІН бөлігі (мүсін көбіне слайдтың астынан шығып тұрады)
      const bx0 = Math.max(0, e.box.x); const by0 = Math.max(0, e.box.y);
      const b = { x: bx0, y: by0, w: Math.min(W, e.box.x + e.box.w) - bx0, h: Math.min(H, e.box.y + e.box.h) - by0 };
      if (b.w <= 0 || b.h <= 0) continue;
      const k = Math.min((b.w * 0.9) / res.w, (b.h * 0.85) / res.h);
      const w = Math.round(res.w * k); const h = Math.round(res.h * k);
      const x = Math.round(b.x + (b.w - w) / 2); const y = Math.round(b.y + b.h - h);
      // Canva суреттің SVG нұсқасын да қосады (asvg:svgBlip) — көрсетушілер соны алады: ол да алынады, әйтпесе ескі мүсін көрініп тұрады
      const el2 = e.el.replace(/(<a:blip\b[^>]*>)\s*<a:extLst>[\s\S]*?svgBlip[\s\S]*?<\/a:extLst>\s*(<\/a:blip>)/, '$1$2')
        .replace(`r:embed="${rid}"`, `r:embed="${nrid}"`)
        .replace(/<a:srcRect\b[^>]*\/>/, '').replace(/<a:fillRect\b[^>]*\/>/, '<a:fillRect/>')
        .replace(/<a:off x="-?\d+" y="-?\d+"\/>(\s*)<a:ext cx="\d+" cy="\d+"\/>/, `<a:off x="${x}" y="${y}"/>$1<a:ext cx="${w}" cy="${h}"/>`)
        .replace(/<a:path\b([^>]*)\bw="\d+"([^>]*)\bh="\d+"/, '<a:path$1w="' + w + '"$2h="' + h + '"').replace(/<a:path\b([^>]*)\bh="\d+"([^>]*)\bw="\d+"/, '<a:path$1h="' + h + '"$2w="' + w + '"');
      // custGeom жолы ескі өлшемде — тіктөртбұрышқа ауыстырылады (жаңа элемент пішінге кесілмейді)
      xml = xml.replace(e.el, () => el2.replace(/<a:custGeom>[\s\S]*?<\/a:custGeom>/, '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'));
    }
    files.set(sp, xml); files.set(rp, rels);
  }
  if (!n) return buf;
  let ct = String(files.get('[Content_Types].xml') || '');
  if (!/Extension="png"/i.test(ct)) { ct = ct.replace(/(<Types[^>]*>)/, '$1<Default Extension="png" ContentType="image/png"/>'); files.set('[Content_Types].xml', ct); }
  try { require('./carve').collectGarbage(files); } catch { /* ескі сурет қалса да зиянсыз */ }
  console.log(`[Library] figures: ${n} off-topic figure(s) → own decor`);
  return writeZipAll(files);
}

module.exports = { replaceFigures, widenEdgeLabels, adaptDeck, describe, renumberFolios, folioCandidates, applyOps, elements, patchOf };
