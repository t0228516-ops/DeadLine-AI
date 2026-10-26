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
    if (!/^\s*0?\d{1,2}\s*$/.test(e.text) || e.sz > 40 * (H / 6858000)) continue;
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
    if (!/^\s*0?\d{1,2}\s*$/.test(text)) continue;
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
  const per = slides.map((sp) => folioCandidates(String(files.get(sp)), W, H).filter((c) => /<a:t>\s*0?\d{1,2}\s*<\/a:t>/.test(c.block)));
  const count = new Map();
  for (const list of per) for (const k of new Set(list.map((c) => c.key))) count.set(k, (count.get(k) || 0) + 1);
  let changed = false;
  slides.forEach((sp, i) => {
    let xml = String(files.get(sp));
    for (const c of per[i]) {
      if ((count.get(c.key) || 0) < 3) continue;
      const nb = c.block.replace(/<a:t>(\s*)(0?)(\d{1,2})(\s*)<\/a:t>/, (m, a, z, d, b) => `<a:t>${a}${z || d.length === 2 ? String(i + 1).padStart(2, '0') : String(i + 1)}${b}</a:t>`);
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

/** Шаблонды бейімдеу (толық шаблон, слайд нөмірлері — шаблондағыдай) */
function adaptDeck(buf, id, o = {}) {
  const files = readZipAll(buf);
  const { W, H } = slideSize(files);
  const patch = o.patch || patchOf(id);
  const slides = orderedSlides(files);
  let changed = false;
  slides.forEach((sp, i) => {
    const xml = String(files.get(sp));
    let out = xml;
    const ops = patch && patch.slides && patch.slides[String(i + 1)];
    if (ops) out = applyOps(out, ops, W, H);
    if (out !== xml) { files.set(sp, out); changed = true; }
  });
  return changed ? writeZipAll(files) : buf;
}

module.exports = { adaptDeck, describe, renumberFolios, folioCandidates, applyOps, elements, patchOf };
