'use strict';
/**
 * ОҚЫЛУ: кітапхана шаблоны толтырылмас бұрын мәтін қораптары студент проекторда оқи алатындай етіледі.
 *
 *   1) ең кіші кегль — дене мәтіні слайд еніне шаққанда ≥ 12pt (10-дюйм слайдта; 13,3-дюймде = 16pt);
 *   2) контраст — мәтін түсі мен астындағы фонның арасы ≥ 4.5:1 (үлкен тақырыпқа ≥ 3:1); жетпесе түс
 *      сол бағытта (ақшылдау/қоюлау) күшейтіледі, болмаса фонның өз реңкінің қою/ашық нұсқасына ауысады;
 *   3) әшекей — дене мәтінінің қорабына бүйірінен кіріп тұрған сурет/әшекей (бұрыштағы гүл, ананас) болса, қорап сол
 *      жағынан тарылады; мөлдір PNG әшекейдің нақты сызылған пикселі өлшенеді (жақтауы емес);
 *   4) бөлім нөмірі — бөлім слайдының «1» сияқты реттік саны презентациядағы нақты бөлім ретіне түзетіледі (numberSections).
 * Барлығы шаблонның өз XML-ін өзгертеді; толтыру (fillTemplatePptx) жаңа өлшемдерге сыйғызады.
 */
const { readZipAll, writeZipAll } = require('../templateFill');
const { orderedSlides, relsMap, resolvePath, sldSzMatch } = require('../../../design-dna/structure');

const MIN_BODY_PT = Number(process.env.LIBRARY_MIN_BODY_PT) || 12;   // 10-дюйм (9144000 EMU) слайдқа (= 16pt 13,3-дюймде)

// ── түс ─────────────────────────────────────────────────────────────
const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (c) => c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
function lum(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const mix = (hex, to, k) => rgbToHex(hexToRgb(hex).map((v, i) => v + (hexToRgb(to)[i] - v) * k));

/** Мәтін түсін фонға қарай оқылатын етеді: алдымен сол бағытта күшейту, жетпесе фон реңкінің қарама-қарсы нұсқасы */
function readableColor(text, bg, need) {
  if (contrast(text, bg) >= need) return text;
  const lighter = lum(text) >= lum(bg);
  for (let k = 0.2; k <= 1.0001; k += 0.2) {
    const c = mix(text, lighter ? 'FFFFFF' : '000000', k);
    if (contrast(c, bg) >= need) return c;
  }
  for (let k = 0.6; k <= 0.95001; k += 0.05) {                       // қарама-қарсы: фонның қою/ашық реңкі
    const c = mix(bg, lighter ? '000000' : 'FFFFFF', k);
    if (contrast(c, bg) >= need) return c;
  }
  return lighter ? '000000' : 'FFFFFF';
}

// ── тема түстері (schemeClr → hex) ───────────────────────────────────
function themeColors(files) {
  const theme = [...files.keys()].find((k) => /^ppt\/theme\/theme\d+\.xml$/.test(k));
  const xml = String(files.get(theme) || '');
  const out = {};
  for (const n of ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']) {
    const m = xml.match(new RegExp(`<a:${n}>[\\s\\S]*?(?:srgbClr val="([0-9A-Fa-f]{6})"|lastClr="([0-9A-Fa-f]{6})")`));
    if (m) out[n] = (m[1] || m[2]).toUpperCase();
  }
  Object.assign(out, { bg1: out.lt1, tx1: out.dk1, bg2: out.lt2, tx2: out.dk2 });
  return out;
}
function colorOf(fragment, theme) {
  const m = String(fragment || '').match(/<a:solidFill>\s*<a:(srgbClr|schemeClr) val="(\w+)"(\/>|>([\s\S]*?)<\/a:\1>)/);
  if (!m) return null;
  let hex = m[1] === 'srgbClr' ? m[2].toUpperCase() : theme[m[2]];
  if (!hex || !/^[0-9A-F]{6}$/.test(hex)) return null;
  const mods = m[4] || '';
  const al = mods.match(/<a:alpha val="(\d+)"/);
  if (al && +al[1] < 50000) return null;                           // жартылай мөлдір — фон емес
  const lm = mods.match(/<a:lumMod val="(\d+)"/); const lo = mods.match(/<a:lumOff val="(\d+)"/);
  if (lm || lo) hex = rgbToHex(hexToRgb(hex).map((v) => v * (lm ? +lm[1] / 1e5 : 1) + 255 * (lo ? +lo[1] / 1e5 : 0)));
  return { hex, tag: m[0], hasMods: !!mods.trim() };
}

// ── геометрия ───────────────────────────────────────────────────────
const boxOf = (blk) => {
  const m = blk.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  return m ? { x: +m[1], y: +m[2], w: +m[3], h: +m[4] } : null;
};
const textOf = (blk) => [...blk.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('');
const contains = (a, px, py) => px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h;
const isRotated = (blk) => /<a:xfrm[^>]*\brot="(?!0")/.test(blk);

/** Слайд → макет → мастер фоны (тек тұтас түс; сурет/градиент — null) */
function slideBg(files, slidePath, theme) {
  let part = slidePath;
  for (const want of ['slideLayout', 'slideMaster', null]) {
    const xml = String(files.get(part) || '');
    const bg = xml.match(/<p:bg>[\s\S]*?<\/p:bg>/);
    if (bg) { const c = /<a:blipFill|<a:gradFill/.test(bg[0]) ? null : colorOf(bg[0], theme); return c ? c.hex : null; }
    if (!want) return null;
    const rel = Object.values(relsMap(files.get(part.replace(/([^/]+)$/, '_rels/$1.rels')))).find((r) => r.type === want);
    if (!rel) return null;
    part = resolvePath(part, rel.target);
  }
  return null;
}

/**
 * Бір слайдтың XML-ін оқылатын етеді.
 * @returns {{xml:string, changes:{font:number, color:number, inset:number}}}
 */
function fixSlide(xml, ctx) {
  const { W, theme, bg } = ctx;
  const minPt = MIN_BODY_PT * W / 9144000;
  const changes = { font: 0, color: 0, inset: 0 };
  const tree = (xml.match(/<p:spTree>[\s\S]*<\/p:spTree>/) || [''])[0];
  // жалпақ тізім (топтың ішіндегілер де — normalizeGroups-тан кейін координаталары слайдтікі)
  const blocks = [...tree.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)].map((m) => ({ blk: m[0], kind: m[1], box: boxOf(m[0]) }));
  const shapes = blocks.filter((b) => b.box);
  const repl = new Map();
  shapes.forEach((s, idx) => {
    if (s.kind !== 'sp' || !/<p:txBody>/.test(s.blk)) return;
    const text = textOf(s.blk);
    if (!text.trim() || /^[\p{P}\p{S}\s\d]+$/u.test(text) || isRotated(s.blk)) return;
    let blk = s.blk;
    const sizes = [...blk.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map((m) => +m[1] / 100);
    const maxSz = sizes.length ? Math.max(...sizes) : 0;
    const large = maxSz >= 18 * W / 9144000;                       // тақырып деңгейі
    // 1) ең кіші кегль: шаблонда ұзын мәтін (дене) болған қораптар
    if (text.length >= 30 && maxSz && maxSz < minPt) {
      const k = minPt / maxSz;
      blk = blk.replace(/(<a:(?:rPr|endParaRPr|defRPr)\b[^>]*\bsz=")(\d+)"/g, (m, a, v) => `${a}${Math.round((+v * k) / 50) * 50}"`);
      changes.font++;
    }
    // 2) контраст: астындағы ең жоғарғы тұтас түсті пішін, болмаса слайд фоны
    const cx = s.box.x + s.box.w / 2; const cy = s.box.y + s.box.h / 2;
    // астындағы фон: тек СЕНІМДІ тұтас түс өзгертуге негіз болады; сурет/градиент/стиль толтыруы — белгісіз, түс өзгермейді
    let under = null;
    for (let j = idx - 1; j >= 0 && !under; j--) {
      const u = shapes[j];
      if (!contains(u.box, cx, cy)) continue;
      if (u.kind === 'pic') { under = 'unknown'; break; }
      const spPr = (u.blk.match(/<p:spPr[\s\S]*?<\/p:spPr>|<p:spPr\/>/) || [''])[0].split(/<a:ln[\s>]/)[0];
      if (/<a:blipFill|<a:gradFill|<a:pattFill|<a:grpFill/.test(spPr)) { under = 'unknown'; break; }
      const c = colorOf(spPr, theme);
      if (c) { under = c.hex; break; }
      if (/<a:noFill\/>/.test(spPr)) continue;                                  // мөлдір пішін — астына қараймыз
      if (/<a:fillRef idx="[1-9]/.test(u.blk)) { under = 'unknown'; break; }    // тема стилінің толтыруы
    }
    // слайдта жоқ болса — макет пен мастердің әшекей пішіндері (жоғарғысынан бастап)
    for (let j = (ctx.inherited || []).length - 1; j >= 0 && !under; j--) {
      const u = ctx.inherited[j];
      if (!contains(u.box, cx, cy)) continue;
      if (u.kind === 'pic') { under = 'unknown'; break; }
      const spPr = (u.blk.match(/<p:spPr[\s\S]*?<\/p:spPr>|<p:spPr\/>/) || [''])[0].split(/<a:ln[\s>]/)[0];
      if (/<a:blipFill|<a:gradFill|<a:pattFill|<a:grpFill/.test(spPr)) { under = 'unknown'; break; }
      const c = colorOf(spPr, theme);
      if (c) { under = c.hex; break; }
      if (/<a:fillRef idx="[1-9]/.test(u.blk) && !/<a:noFill\/>/.test(spPr)) { under = 'unknown'; break; }
    }
    const bgHex = under === 'unknown' ? null : (under || bg);
    if (bgHex) {
      const need = large ? 3 : 4.5;
      blk = blk.replace(/(<a:rPr\b[^>]*>)(\s*<a:solidFill>\s*<a:(srgbClr|schemeClr) val="\w+"(?:\/>|>[\s\S]*?<\/a:\3>)\s*<\/a:solidFill>)/g, (m, open, fill) => {
        const c = colorOf(fill, theme);
        if (!c) return m;
        // контраст 2:1-ден төмен болса, дизайнер олай жасамайды — демек фонды қате таптық, тимейміз
        if (contrast(c.hex, bgHex) < 2) return m;
        const fixed = readableColor(c.hex, bgHex, need);
        if (fixed === c.hex) return m;
        changes.color++;
        return `${open}<a:solidFill><a:srgbClr val="${fixed}"/></a:solidFill>`;
      });
    }
    // 3) бүйірден кірген әшекей → дене мәтінінің қорабы сол жағынан тарылады (тақырып — ірі, тарылса жолы көбейіп, көршіге түседі)
    const b = s.box;
    let left = b.x; let right = b.x + b.w;
    if (!large) {
      for (const d of shapes) {
        if (d === s || contains(d.box, cx, cy)) continue;                               // мәтіннің астындағы фон/панель
        if (d.kind === 'sp' && /<a:t>[^<]+<\/a:t>/.test(d.blk)) continue;               // басқа мәтін — оны толтыру өзі қарайды
        if (d.kind === 'sp' && !/<a:blipFill|<a:custGeom|<p:style>/.test(d.blk)) continue;
        const y0 = Math.max(b.y, d.box.y); const y1 = Math.min(b.y + b.h, d.box.y + d.box.h);
        if (y1 - y0 < b.h * 0.25) continue;
        const dcx = d.box.x + d.box.w / 2;
        const fromRight = dcx > cx;
        // мөлдір PNG: тек сызылған пиксельдер (жақтаудың бос бұрышы есептелмейді)
        const span = ctx.inkSpan ? ctx.inkSpan(d, (y0 - d.box.y) / d.box.h, (y1 - d.box.y) / d.box.h) : null;
        if (span === 'empty') continue;
        const inkL = span ? d.box.x + span[0] * d.box.w : d.box.x;
        const inkR = span ? d.box.x + span[1] * d.box.w : d.box.x + d.box.w;
        const pad = W * 0.006;
        if (fromRight && inkL < right && inkR > b.x + b.w * 0.5) right = Math.min(right, inkL - pad);
        if (!fromRight && inkR > left && inkL < b.x + b.w * 0.5) left = Math.max(left, inkR + pad);
      }
    }
    // астынан кірген әшекей (жапырақ, гүл) → қораптың төменгі шеті сызылған пиксельдің үстінде тоқтайды
    let bottom = b.y + b.h;
    if (!large) {
      for (const d of shapes) {
        if (d === s || contains(d.box, cx, cy) || d.box.y + d.box.h / 2 <= cy) continue;
        if (d.kind === 'sp' && /<a:t>[^<]+<\/a:t>/.test(d.blk)) continue;
        if (d.kind === 'sp' && !/<a:blipFill|<a:custGeom|<p:style>/.test(d.blk)) continue;
        const x0 = Math.max(left, d.box.x); const x1 = Math.min(right, d.box.x + d.box.w);
        if (x1 - x0 < (right - left) * 0.25) continue;
        const span = ctx.inkSpan ? ctx.inkSpan(d, (x0 - d.box.x) / d.box.w, (x1 - d.box.x) / d.box.w, 'y') : null;
        if (span === 'empty') continue;
        const inkTop = d.box.y + (span ? span[0] : 0) * d.box.h;
        if (inkTop < bottom && inkTop > b.y + b.h * 0.5) bottom = inkTop - W * 0.006;
      }
    }
    if (bottom < b.y + b.h) {
      blk = blk.replace(/(<a:off x="-?\d+" y="-?\d+"\/>\s*<a:ext cx="\d+" cy=")\d+("\/>)/, `$1${Math.round(bottom - b.y)}$2`);
      changes.inset++;
    }
    if (left > b.x || right < b.x + b.w) {
      const centered = /algn="ctr"/.test(blk);
      if (centered) {                                                                    // ортаға тураланған — мүмкін болса симметриялы
        const cut = Math.max(left - b.x, b.x + b.w - right);
        if (b.w - 2 * cut >= b.w * 0.55) { left = b.x + cut; right = b.x + b.w - cut; }
      }
      if (right - left >= b.w * 0.5) {
        blk = blk.replace(/<a:off x="-?\d+" y="(-?\d+)"\/>\s*<a:ext cx="\d+" cy="(\d+)"\/>/, `<a:off x="${Math.round(left)}" y="$1"/><a:ext cx="${Math.round(right - left)}" cy="$2"/>`);
        changes.inset++;
      }
    }
    if (blk !== s.blk) repl.set(s.blk, blk);
  });
  let out = xml;
  for (const [a, b2] of repl) out = out.replace(a, b2);
  return { xml: out, changes };
}

/**
 * Мөлдір PNG әшекейдің [f0..f1] биіктік жолағындағы сызылған пиксельдерінің көлденең шегі (0..1), бос болса 'empty'.
 * PNG емес / альфасыз / кесілген (srcRect) суретте — null (қорап шегі қолданылады).
 */
function inkSpanOf(files, sp, rels, d, f0, f1, inkCache, axis = 'x') {
  const rid = (d.blk.match(/<a:blip\b[^>]*r:embed="([^"]+)"/) || [])[1];
  if (!rid || !rels[rid] || /<a:srcRect\b[^>]*[ltrb]="[1-9]/.test(d.blk)) return null;
  const media = resolvePath(sp, rels[rid].target);
  let img = inkCache.get(media);
  if (img === undefined) {
    const { decodePng } = require('./png');
    img = /\.png$/i.test(media) ? decodePng(files.get(media)) : null;
    if (img && img.ch !== 4 && img.ch !== 2) img = null;
    inkCache.set(media, img);
  }
  if (!img) return null;
  const flipH = /<a:xfrm\b[^>]*flipH="1"/.test(d.blk); const flipV = /<a:xfrm\b[^>]*flipV="1"/.test(d.blk);
  // axis 'x': [f0..f1] — биіктік жолағы, нәтиже — көлденең шек; axis 'y': [f0..f1] — ені жолағы, нәтиже — тік шек
  const across = axis === 'x' ? img.h : img.w; const along = axis === 'x' ? img.w : img.h;
  const flipAcross = axis === 'x' ? flipV : flipH; const flipAlong = axis === 'x' ? flipH : flipV;
  let r0 = Math.max(0, Math.floor(Math.min(f0, f1) * across)); let r1 = Math.min(across - 1, Math.ceil(Math.max(f0, f1) * across));
  if (flipAcross) [r0, r1] = [across - 1 - r1, across - 1 - r0];
  const a = img.ch - 1; let lo = Infinity; let hi = -Infinity;
  const at = (i, j) => img.data[((axis === 'x' ? i * img.w + j : j * img.w + i)) * img.ch + a] > 40;   // i — жолақ бойы, j — шек бойы
  const step = Math.max(1, Math.floor((r1 - r0) / 200));
  for (let i = r0; i <= r1; i += step) {
    for (let j = 0; j < along; j++) if (at(i, j)) { lo = Math.min(lo, j); break; }
    for (let j = along - 1; j >= 0; j--) if (at(i, j)) { hi = Math.max(hi, j); break; }
  }
  if (lo === Infinity) return 'empty';
  let s0 = lo / along; let s1 = (hi + 1) / along;
  if (flipAlong) [s0, s1] = [1 - s1, 1 - s0];
  return [s0, s1];
}

/** Макет пен мастердің орынтолтырғыш емес пішіндері (мастер → макет реті, яғни төменнен жоғары) */
function inheritedShapes(files, slidePath) {
  const chain = [];
  let part = slidePath;
  for (const want of ['slideLayout', 'slideMaster']) {
    const rel = Object.values(relsMap(files.get(part.replace(/([^/]+)$/, '_rels/$1.rels')))).find((r) => r.type === want);
    if (!rel) break;
    part = resolvePath(part, rel.target);
    chain.unshift(part);
  }
  const out = [];
  for (const p of chain) {
    const xml = String(files.get(p) || '');
    if (/showMasterSp="0"/.test(xml) && /slideMaster/.test(p)) continue;
    const tree = (xml.match(/<p:spTree>[\s\S]*<\/p:spTree>/) || [''])[0];
    for (const m of tree.matchAll(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g)) {
      if (/<p:ph\b/.test(m[0])) continue;
      const box = boxOf(m[0]);
      if (box) out.push({ blk: m[0], kind: m[1], box });
    }
  }
  return out;
}

/** Колоданың барлық слайдтарын оқылатын етеді */
function makeReadable(buf) {
  const files = readZipAll(buf);
  const m = sldSzMatch(files.get('ppt/presentation.xml'));
  const W = m ? +m[1] : 12192000;
  const theme = themeColors(files);
  const total = { font: 0, color: 0, inset: 0 };
  const inkCache = new Map();                                   // осы колоданың суреттері ғана
  for (const sp of orderedSlides(files)) {
    const rels = relsMap(files.get(sp.replace(/([^/]+)$/, '_rels/$1.rels')));
    const inkSpan = (d, f0, f1, axis) => inkSpanOf(files, sp, rels, d, f0, f1, inkCache, axis);
    const r = fixSlide(String(files.get(sp)), { W, theme, bg: slideBg(files, sp, theme), inkSpan, inherited: inheritedShapes(files, sp) });
    files.set(sp, r.xml);
    for (const k of Object.keys(total)) total[k] += r.changes[k];
  }
  console.log(`[Library] readable: font +${total.font}, contrast ${total.color}, clear of decor ${total.inset}`);
  return writeZipAll(files);
}

/**
 * Бөлім слайдтарының реттік санын («1», «02») презентациядағы нақты бөлім ретіне түзетеді:
 * бөлімге дейін мазмұн слайды болса, ол — 1-бөлім (бөлім слайдының өзі 2-бөлімнен басталады).
 * @param {Buffer} buf толтырылған колода; roles — әр слайдтың рөлі ('cover','section','text'...)
 */
function numberSections(buf, roles) {
  if (!Array.isArray(roles) || !roles.includes('section')) return buf;
  const files = readZipAll(buf);
  const slides = orderedSlides(files);
  let n = roles.slice(0, roles.indexOf('section')).some((r) => r === 'text' || r === 'stats' || r === 'quote') ? 1 : 0;
  roles.forEach((r, i) => {
    if (r !== 'section' || !slides[i]) return;
    n++;
    const xml = String(files.get(slides[i]));
    const fixed = xml.replace(/(<a:t>)\s*0?(\d{1,2})([.)]?)\s*(<\/a:t>)/, (m0, a, d, p, b) => `${a}${/^0\d/.test(m0.replace(/<[^>]+>/g, '').trim()) ? String(n).padStart(2, '0') : n}${p}${b}`);
    files.set(slides[i], fixed);
  });
  return writeZipAll(files);
}

module.exports = { makeReadable, fixSlide, numberSections, readableColor, contrast, themeColors };
