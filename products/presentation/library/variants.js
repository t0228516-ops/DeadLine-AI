'use strict';
/**
 * Шаблонның нұсқасы: бір Canva шаблоны әр студентте әртүрлі көрінуі үшін (бір шаблон қайталанса да «тағы сол бот» деп танылмасын).
 *
 *   mirrorDeck(buf)        — бүкіл презентация айнадай: элементтер оң↔сол ауысады, асимметриялы пішін, градиент, бұрылыс,
 *                            мәтін астындағы фон суреті (пикселдері, flipImages) де айналады. Мәтін, кіші фотолар,
 *                            бағыттауыш (→) айналмайды — оқылуы сақталады; бір шетте тұрған мәтін қораптары бір шетте қалады.
 *   recolorDeck(buf, deg)  — түс палитрасы: қанық түстердің реңі (hue) deg градусқа бұрылады; ақ, қара, сұр, бозғылт түстер өзгермейді.
 *   pickVariant(t, rng)    — шаблонның рұқсатына қарай (canva.json: mirror:false, recolor:{from,to}) кездейсоқ нұсқа.
 *   applyVariant(buf, v, {page})
 *
 */
const { readZipAll, writeZipAll } = require('../templateFill');
const { sldSzMatch, resolvePath } = require('../../../design-dna/structure');

const PARTS = /^ppt\/(slides\/slide|slideLayouts\/slideLayout|slideMasters\/slideMaster)\d+\.xml$/;
const FULL = 21600000;   // 360° (1/60000 градус)

// айналғанда өзгермейтін не айналмауы керек (бағыт көрсететін) пішіндер
const SYMMETRIC = /^(rect|roundRect|ellipse|line|triangle|diamond|hexagon|octagon|plus|star\d+|donut|frame|can|cube|bevel|plaque|snip2SameRect|round2SameRect|flowChart(Process|Alternate|Decision|Connector|Terminator)|chord|pie|blockArc|arc|noSmoking|heart|sun|moon|cloud|wave|doubleWave|smileyFace|lightningBolt)$/;
const DIRECTIONAL = /Arrow|arrow|chevron|homePlate|callout|Callout|curved|Curved|uturn|bentUp/;

function slideSize(files) {
  const m = sldSzMatch(files.get('ppt/presentation.xml'));
  return m ? { W: +m[1], H: +m[2] } : { W: 12192000, H: 6858000 };
}

// ─── Айналық бейне ──────────────────────────────────────────────────────────

/** custGeom жолдарын айналдыру: x → w - x; arcTo бұрыштары: st → 180° - st, sw → -sw */
function mirrorPaths(geom) {
  return geom.replace(/<a:path\b([^>]*)>([\s\S]*?)<\/a:path>/g, (m, attrs, body) => {
    const w = +((attrs.match(/\bw="(\d+)"/) || [])[1] || 0);
    if (!w) return m;
    const b = body
      .replace(/<a:pt x="(-?\d+)"/g, (x, v) => `<a:pt x="${w - +v}"`)
      .replace(/<a:arcTo\b([^>]*)\/>/g, (x, a) => `<a:arcTo${a
        .replace(/\bstAng="(-?\d+)"/, (s, v) => `stAng="${((FULL / 2 - +v) % FULL + FULL) % FULL}"`)
        .replace(/\bswAng="(-?\d+)"/, (s, v) => `swAng="${-+v}"`)}/>`);
    return `<a:path${attrs}>${b}</a:path>`;
  });
}

/** Градиент бағыты мен радиалды градиент орталығы айнадай */
function mirrorFills(xml) {
  return xml
    .replace(/<a:lin ang="(\d+)"/g, (m, a) => `<a:lin ang="${((FULL / 2 - +a) % FULL + FULL) % FULL}"`)
    .replace(/<a:fillToRect\b([^>]*)\/>/g, (m, a) => {
      const l = (a.match(/\bl="(-?\d+)"/) || [])[1]; const r = (a.match(/\br="(-?\d+)"/) || [])[1];
      return `<a:fillToRect${a.replace(/\s[lr]="-?\d+"/g, '')}${r != null ? ` l="${r}"` : ''}${l != null ? ` r="${l}"` : ''}/>`;
    });
}

/** xfrm-ді айналдыру: x' = 2·ox + span − x − w; бұрылыс −rot; flipH (керек болса) ауысады */
function mirrorXfrm(xfrm, ox, span, flip) {
  const m = xfrm.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  if (!m) return xfrm;
  const x = +m[1]; const w = +m[3];
  let out = xfrm.replace(/<a:off x="-?\d+"/, `<a:off x="${2 * ox + span - x - w}"`);
  out = out.replace(/(<(?:a|p):xfrm\b[^>]*?)\srot="(-?\d+)"/, (s, h, r) => `${h} rot="${((FULL - +r) % FULL + FULL) % FULL}"`);
  if (flip) {
    // Canva flipH="false" деп те жазады — бар атрибуттың мәні ауысады, жоқ болса қосылады
    const cur = out.match(/^<(?:a|p):xfrm\b[^>]*?\sflipH="([^"]*)"/);
    out = cur ? out.replace(/\sflipH="[^"]*"/, ` flipH="${cur[1] === '1' || cur[1] === 'true' ? '0' : '1'}"`) : out.replace(/<((?:a|p):xfrm)\b/, '<$1 flipH="1"');
  }
  return out;
}

/** Пиксельдері айналатын суреттің кесу шегі (srcRect, fillRect) де айнадай: l ↔ r */
const swapLR = (x) => x.replace(/<a:(srcRect|fillRect)\b([^>]*)\/>/g, (m, tag, a) => {
  const l = (a.match(/\bl="(-?\d+)"/) || [])[1]; const r = (a.match(/\br="(-?\d+)"/) || [])[1];
  return `<a:${tag}${a.replace(/\s[lr]="-?\d+"/g, '')}${r != null ? ` l="${r}"` : ''}${l != null ? ` r="${l}"` : ''}/>`;
});

/**
 * Қысқа жазу (тақырып, белгі, тізім жолы ≤ 40 таңба) айналғанда оңға тегістеледі — сонда ол түпнұсқадағыдай қораптың сыртқы
 * шетіне жабысады және бағандағы қораптар бір сызықта тұрады. Абзац солға тегістелген күйі қалады (оңнан тегістелген абзац қиын оқылады).
 */
function alignShort(el) {
  const text = [...el.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('');
  if (!text.trim() || text.length > 40 || /\balgn="(ctr|r|just|dist)"/.test(el)) return el;
  return el.replace(/<a:p>(?!<a:pPr)/g, '<a:p><a:pPr algn="r"/>')
    .replace(/<a:pPr\b([^>]*?)(\/?)>/g, (m, a, sl) => `<a:pPr${/\balgn=/.test(a) ? a.replace(/\balgn="l"/, 'algn="r"') : `${a} algn="r"`}${sl}>`);
}

/** Бір элемент (sp, pic, cxnSp, graphicFrame); unit — бір жолдағы сөз қораптарының ортақ шегі (сөз реті сақталады) */
function mirrorElement(tag, el, ox, span, ctx, unit) {
  const xfrmRe = /<(a|p):xfrm\b[^>]*>[\s\S]*?<\/\1:xfrm>/;
  const xf = el.match(xfrmRe);
  if (!xf) return el;
  const prst = (el.match(/<a:prstGeom prst="([^"]+)"/) || [])[1];
  const ext = xf[0].match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  const isImage = tag === 'p:pic' || (tag === 'p:sp' && /<p:spPr>(?:(?!<\/p:spPr>)[\s\S])*<a:blipFill/.test(el));
  // мәтін астындағы толық фон (слайд енінің ≥90%): суреттің пикселдері айналады (flipH-ты кейбір бағдарлама суретке қолданбайды)
  const fullBleed = isImage && ext && +ext[1] >= ctx.W * 0.9;
  let flip = false;
  if (isImage) flip = false;                                 // кіші фото: тек орны (адам, мәтінді карта айналмайды)
  else if (tag === 'p:cxnSp' || prst === 'line') flip = !!(ext && +ext[2] > 0) && !/<a:(head|tail)End type="(?!none)/.test(el); // көлденең сызық, нұсқар — айналмайды
  else if (prst) flip = !SYMMETRIC.test(prst) && !DIRECTIONAL.test(prst);
  let out = el.replace(xfrmRe, (x) => {
    const y = mirrorXfrm(x, ox, span, flip);
    if (!unit) return y;
    const x0 = +((x.match(/<a:off x="(-?\d+)"/) || [])[1] || 0);
    return y.replace(/<a:off x="-?\d+"/, `<a:off x="${2 * ox + span - unit.x - unit.w + (x0 - unit.x)}"`);
  });
  if (tag === 'p:sp' && !unit && /<p:txBody>/.test(out)) out = out.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, (t) => alignShort(t));
  if (!flip && /<a:custGeom>/.test(out)) out = out.replace(/<a:custGeom>[\s\S]*?<\/a:custGeom>/, (g) => mirrorPaths(g));
  if (fullBleed) {
    const rid = (out.match(/<a:blip\b[^>]*r:embed="([^"]+)"/) || [])[1];
    if (rid) { ctx.flipRids.add(rid); out = swapLR(out); }
  }
  // пішіннің градиенті (flipH болмаса — өзі айналмайды)
  if (!flip) out = out.replace(/<(p:spPr|p:grpSpPr)>[\s\S]*?<\/\1>/, (x) => mirrorFills(x));
  return out;
}

/** spTree (не grpSp) ішіндегі тікелей элементтер — ox/span: ата-ананың координат кеңістігі */
function mirrorTree(inner, ox, span, ctx) {
  const items = [];
  const re = /<(p:sp|p:pic|p:cxnSp|p:graphicFrame|p:grpSp|mc:AlternateContent)\b/g;
  let m;
  while ((m = re.exec(inner))) {
    const end = closeOf(inner, m.index, m[1]);
    if (end < 0) break;
    items.push({ tag: m[1], start: m.index, end, el: inner.slice(m.index, end) });
    re.lastIndex = end;
  }
  // бір жолда қатар тұрған мәтін қораптары («Fiscal» + «Policy») — бір бүтін: сөз реті ауыспайды
  const boxes = items.filter((it) => it.tag === 'p:sp' && /<a:t>[^<]*\S/.test(it.el) && !/<a:blipFill/.test(it.el)).map((it) => {
    const mm = it.el.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    return mm ? { it, x: +mm[1], y: +mm[2], w: +mm[3], h: +mm[4] } : null;
  }).filter(Boolean).sort((a, b) => a.x - b.x);
  const near = (a, b) => {
    const h = Math.min(a.h, b.h);
    return Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) < h * 0.3 && Math.abs(a.h - b.h) < Math.max(a.h, b.h) * 0.5
      && b.x > a.x + a.w * 0.5 && b.x >= a.x + a.w - h * 0.8 && b.x - (a.x + a.w) < h * 0.6;
  };
  for (const a of boxes) {
    if (a.unit) continue;
    const run = [a];
    for (let k = boxes.indexOf(a) + 1; k < boxes.length; k++) if (!boxes[k].unit && near(run[run.length - 1], boxes[k])) run.push(boxes[k]);
    if (run.length < 2) continue;
    const u = { x: run[0].x, w: run[run.length - 1].x + run[run.length - 1].w - run[0].x };
    for (const r of run) { r.unit = u; r.it.unit = u; }
  }
  let out = ''; let i = 0;
  for (const it of items) {
    out += inner.slice(i, it.start);
    if (it.tag === 'p:grpSp') {
      const el = it.el;
      const ch = el.match(/<a:chOff x="(-?\d+)" y="-?\d+"\/>\s*<a:chExt cx="(\d+)"/);
      const head = el.indexOf('</p:grpSpPr>') + '</p:grpSpPr>'.length;
      const g = el.slice(0, head).replace(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/, (x) => mirrorXfrm(x, ox, span, false));
      const body = el.slice(head, el.length - '</p:grpSp>'.length);
      out += g + (ch ? mirrorTree(body, +ch[1], +ch[2], ctx) : body) + '</p:grpSp>';
    } else if (it.tag === 'mc:AlternateContent') {
      out += it.el;   // сирек кездеседі (теңдеу, 3D) — өзгертілмейді
    } else {
      out += mirrorElement(it.tag, it.el, ox, span, ctx, it.unit);
    }
    i = it.end;
  }
  return out + inner.slice(i);
}

/** Ашылған тегтің жабылу орны (бір аттас ішкі тегтерді санап) */
function closeOf(s, from, tag) {
  const open = new RegExp(`<${tag}\\b[^>]*?(/?)>|</${tag}>`, 'g');
  open.lastIndex = from;
  let depth = 0; let mm;
  while ((mm = open.exec(s))) {
    if (mm[0].startsWith('</')) { depth--; if (depth === 0) return open.lastIndex; } else if (mm[1] !== '/') depth++;
    else if (depth === 0) return open.lastIndex;
  }
  return -1;
}

/**
 * Бүкіл презентацияны айналдыру. Пикселдері айналуы керек суреттер (толық фон, слайд фоны) жаңа атпен көшіріледі
 * (сол сурет басқа жерде айналмай тұруы мүмкін) — олардың тізімі `flip`; пикселдерді flipImages айналдырады.
 * @returns {{buf:Buffer, flip:string[]}}
 */
function mirrorDeck(buf) {
  const files = readZipAll(buf);
  const { W } = slideSize(files);
  const flip = [];
  for (const [name, data] of [...files]) {
    if (!PARTS.test(name)) continue;
    const ctx = { W, flipRids: new Set() };
    let xml = String(data).replace(/(<p:spTree>[\s\S]*?(?:<\/p:grpSpPr>|<p:grpSpPr\/>))([\s\S]*)(<\/p:spTree>)/, (mm, head, body, tail) => head + mirrorTree(body, 0, W, ctx) + tail);
    xml = xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, (bg) => {
      const rid = (bg.match(/<a:blip\b[^>]*r:embed="([^"]+)"/) || [])[1];
      if (rid) { ctx.flipRids.add(rid); return swapLR(bg); }
      return mirrorFills(bg);
    });
    if (ctx.flipRids.size) {
      const rp = name.replace(/([^/]+)$/, '_rels/$1.rels');
      let rels = String(files.get(rp) || '');
      for (const rid of ctx.flipRids) {
        rels = rels.replace(new RegExp(`(<Relationship\\b[^>]*\\bId="${rid}"[^>]*\\bTarget=")([^"]+)(")|(<Relationship\\b[^>]*\\bTarget=")([^"]+)("[^>]*\\bId="${rid}")`), (mm, a1, t1, z1, a2, t2, z2) => {
          const t = t1 || t2;
          const src = resolvePath(name, t);
          if (!files.has(src)) return mm;
          const dst = src.replace(/(\.[a-z]+)$/i, '_m$1');
          if (!files.has(dst)) { files.set(dst, files.get(src)); flip.push(dst); }
          const nt = t.replace(/(\.[a-z]+)$/i, '_m$1');
          return a1 ? a1 + nt + z1 : a2 + nt + z2;
        });
      }
      files.set(rp, rels);
    }
    files.set(name, xml);
  }
  // түпнұсқа сурет енді ешкімге керек емес болса — алынады (файл екі есе өспесін)
  if (flip.length) {
    const used = new Set();
    for (const [n, d] of files) {
      if (!n.endsWith('.rels')) continue;
      const owner = n.replace(/_rels\/([^/]+)\.rels$/, '$1');
      for (const mm of String(d).matchAll(/Target="([^"]+)"/g)) if (!/^https?:/.test(mm[1])) used.add(resolvePath(owner, mm[1]));
    }
    for (const dst of flip) {
      const src = dst.replace(/_m(\.[a-z]+)$/i, '$1');
      if (!used.has(src)) files.delete(src);
    }
  }
  return { buf: writeZipAll(files), flip };
}

/** Суреттердің пикселдерін көлденең айналдыру (Chromium canvas; PNG мөлдірлігі сақталады) */
async function flipImages(buf, paths, page) {
  if (!paths.length) return buf;
  const files = readZipAll(buf);
  for (const p of paths) {
    const data = files.get(p);
    if (!data) continue;
    const mime = /\.png$/i.test(p) ? 'image/png' : 'image/jpeg';
    const b64 = await page.evaluate(async (src, type) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(img, 0, 0);
      return c.toDataURL(type, 0.86).split(',')[1];
    }, `data:${mime};base64,${Buffer.from(data).toString('base64')}`, mime);
    files.set(p, Buffer.from(b64, 'base64'));
  }
  return writeZipAll(files);
}

// ─── Түс палитрасы ─────────────────────────────────────────────────────────

function rgbToHsl(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255; const g = parseInt(hex.slice(2, 4), 16) / 255; const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min; const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex(h, s, l) {
  const f = (n) => { const k = (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Түс ауысады ма: қанық (s ≥ 0.18) әрі тым қараңғы не тым ашық емес — сұр, қара, ақ, крем фон сол қалпында */
const tinted = ([, s, l]) => s >= 0.18 && l > 0.08 && l < 0.94;

function shiftHex(hex, deg) {
  const hsl = rgbToHsl(hex);
  if (!tinted(hsl)) return hex;
  return hslToHex(((hsl[0] + deg) % 360 + 360) % 360, hsl[1], hsl[2]);
}

function recolorDeck(buf, deg) {
  if (!deg) return buf;
  const files = readZipAll(buf);
  for (const [name, data] of files) {
    if (!PARTS.test(name) && !/^ppt\/theme\/theme\d+\.xml$/.test(name)) continue;
    files.set(name, String(data).replace(/<a:srgbClr val="([0-9A-Fa-f]{6})"/g, (m, v) => `<a:srgbClr val="${shiftHex(v, deg)}"`));
  }
  return writeZipAll(files);
}

/** Шаблонның басты (ең жиі) қанық түсінің реңі — жаңа палитраны таңдау үшін */
function dominantHue(buf) {
  const files = readZipAll(buf);
  const count = new Map();
  for (const [name, data] of files) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
    for (const m of String(data).matchAll(/<a:srgbClr val="([0-9A-Fa-f]{6})"/g)) {
      const hsl = rgbToHsl(m[1]);
      if (tinted(hsl)) { const k = Math.round(hsl[0] / 15) * 15 % 360; count.set(k, (count.get(k) || 0) + 1); }
    }
  }
  let best = null; let n = 0;
  for (const [k, v] of count) if (v > n) { best = k; n = v; }
  return best;
}

/**
 * Шаблонның нұсқасы. Әр Canva шаблоны үш нұсқада көзбен тексерілген (scripts/canva-variants-sheet.js):
 * айна жараспаса — canva.json-да mirror:false; түс ауыстыру тек жарасатын шаблонға — recolor:{from, to:[...]} (басты рең → жаңа рең).
 * @param {object} t каталог жазбасы
 * @returns {{mirror:boolean, hue:number}} hue — реңнің бұрылысы, градус (0 — түпнұсқа түс)
 */
function pickVariant(t, rng = Math.random) {
  const mirror = t.source === 'canva' && t.mirror !== false && rng() < 0.5;
  let hue = 0;
  const rc = t.recolor;
  if (rc && Array.isArray(rc.to) && rc.to.length && rng() < 0.5) {
    const to = rc.to[Math.floor(rng() * rc.to.length) % rc.to.length];
    hue = ((to - rc.from) % 360 + 360) % 360;
  }
  return { mirror, hue };
}

/**
 * @param {Buffer} buf
 * @param {{mirror:boolean, hue:number}} v
 * @param {{page?:object}} o page — Chromium беті (айналатын суреттер үшін); жоқ болса айнаға қажет сурет болғанда айна жасалмайды
 */
async function applyVariant(buf, v, o = {}) {
  let out = buf;
  if (v && v.hue) out = recolorDeck(out, v.hue);
  if (v && v.mirror) {
    const m = mirrorDeck(out);
    if (!m.flip.length) out = m.buf;
    else if (o.page) out = await flipImages(m.buf, m.flip, o.page);
    else v.mirror = false;
  }
  return out;
}

module.exports = { mirrorDeck, flipImages, recolorDeck, dominantHue, pickVariant, applyVariant, shiftHex, mirrorPaths, closeOf };
