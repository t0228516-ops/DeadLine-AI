'use strict';
/**
 * ҚҰРАСТЫРЫЛҒАН ФОН — бір түсті пластина + түйіршік/виньетка «мұны ЖИ жасаған» деп көрсетеді.
 * Canva үлгілеріндегідей фон қабаттардан құралады: түс алаңы, шеттен шығып тұрған ірі пішін, жүйенің мотиві.
 *
 * 6 рецепт (кенептегі «Фон А–Ғ»):
 *   field    — тонды ірі шеңбер бұрышта + жіңішке сақина + нүкте патчы + жиек сызығы
 *   diagonal — шеттегі диагональ кесінді + қосымша түсті жіңішке жолақ + штрихталған шеңбер
 *   paper    — крафт фон, үстінде жыртық шетті ақ парақ + скотч (тек ашық палитра)
 *   ornament — жоғарыда ою бордюрі, бұрышта ою, ірі медальон-су белгісі (Мұра)
 *   blocks   — швейцар: жартысында жіңішке тор, бұрышта түсті блок, жиекте қалың сызық
 *   blobs    — ойнақы: пастель блобтар, нүктелі толқын, жұлдызшалар
 * Колода бір рецепт алады (жүйеге сай тізімнен, тұқым бойынша), слайд сайын бұрыш/айна ауысады;
 * мұқаба мен бөлімде батылырақ, ішкі слайдта тынышырақ. Мәтін астына тек ашық тон түседі,
 * қанық түс тек жиек аймағында (мәтін ол жерге шықпайды: GRID шегінісі 104/96/128px).
 * BG_KIT=0 — өшіру; BG_RECIPE=<атау> — барлық колодаға бір рецепт (сынақ үшін).
 */
const fs = require('fs');
const path = require('path');
const T = require('./tokens');

const W = 1920; const H = 1080;
const RECIPES = ['field', 'diagonal', 'paper', 'ornament', 'blocks', 'blobs'];
// жүйенің мінезіне сай рецепттер (бірінші — ең лайықтысы, бірақ тұқым араластырады)
const BY_SYSTEM = {
  heritage: ['ornament', 'paper', 'field'],
  journal: ['paper', 'field', 'diagonal'],
  academy: ['field', 'diagonal', 'blocks'],
  atelier: ['blobs', 'paper', 'field'],
  campus: ['blobs', 'paper', 'field'],
  aurora: ['blobs', 'field', 'diagonal'],
  swiss: ['blocks', 'diagonal', 'field'],
  mono: ['blocks', 'field'],
  numbers: ['blocks', 'diagonal'],
  ledger: ['blocks', 'field', 'paper'],
  blueprint: ['blocks', 'field'],
};

const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const enabled = () => process.env.BG_KIT !== '0';

/** Колодаға рецепт: жүйенің тізімінен тұқым бойынша; қараңғы палитрада «қағаз» жоқ */
function pickRecipe(sysId, seed, palette) {
  if (RECIPES.includes(process.env.BG_RECIPE)) return process.env.BG_RECIPE;
  let list = BY_SYSTEM[sysId] || ['field', 'diagonal', 'blobs', 'blocks'];
  if (palette && palette.isLight === false) list = list.filter((r) => r !== 'paper');
  if (!list.length) list = ['field'];
  return list[hash(String(seed) + '|bg') % list.length];
}

const mix = (a, b, t) => T.mixHex(a, b, t);
const part = (style, inner = '', cls = '') => '<div class="bgk' + (cls ? ' ' + cls : '') + '" aria-hidden="true" style="position:absolute;' + style + '">' + inner + '</div>';
// жиектегі жұқа элементтер (бордюр, жиек сызығы, бұрыш блогы, скотч, жұлдызша) композиция панелінің ҮСТІНДЕ тұрады —
// әйтпесе панель оларды жауып, колоданың «отбасылық» белгісі кейбір слайдта жоғалады
const edge = (style, inner = '') => part(style, inner, 'bgk-solid bgk-edge');
const svgLayer = (body) => '<svg class="bgk" aria-hidden="true" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="position:absolute;left:0;top:0">' + body + '</svg>';

// ── ою (Мұра): кітапхананың SVG-лері палитра түсіне боялады ──
const ORN = path.join(__dirname, '..', 'assets', 'library', 'ornaments');
const ornCache = new Map();
function ornUri(file, color) {
  const k = file + '|' + color;
  if (ornCache.has(k)) return ornCache.get(k);
  let uri = '';
  try { uri = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(ORN, file), 'utf8').replace(/currentColor/g, color)).toString('base64'); } catch { /* жоқ */ }
  ornCache.set(k, uri);
  return uri;
}

/** Бұрыш: 0 оң-жоғары, 1 сол-төмен, 2 сол-жоғары, 3 оң-төмен (слайд сайын ауысады) */
function corner(c, size, offX, offY) {
  const h = c === 0 || c === 3 ? 'right:' + offX + 'px' : 'left:' + offX + 'px';
  const v = c === 0 || c === 2 ? 'top:' + offY + 'px' : 'bottom:' + offY + 'px';
  return h + ';' + v + ';width:' + size + 'px;height:' + size + 'px';
}
const opposite = (c) => [1, 0, 3, 2][c];

const R = {
  field(p, o) {
    const c = o.c; const big = o.bold ? 960 : 820;
    return part(corner(c, big, -Math.round(big * 0.32), -Math.round(big * 0.46)) + ';border-radius:50%;background:' + mix(p.bg, p.accent, o.bold ? 0.24 : 0.15)) +
      part(corner(opposite(c), 330, 120, -150) + ';border-radius:50%;border:2px solid ' + p.accent) +
      part(corner(opposite(c), 22, 64, 92) + ';border-radius:50%;background:' + p.accent) +
      part((c % 2 ? 'right' : 'left') + ':-30px;top:' + (o.bold ? 420 : 300) + 'px;width:190px;height:120px;background-image:radial-gradient(' + p.accent + ' 1.6px,transparent 2px);background-size:16px 16px;opacity:.32') +
      edge((c % 2 ? 'right:0' : 'left:0') + ';' + (c < 2 ? 'top:0' : 'bottom:0') + ';width:14px;height:210px;background:' + p.accent);
  },
  diagonal(p, o) {
    // шеттегі диагональ: мәтін аймағына тек ашық тон кіреді, қанық жолақ — шетте
    const right = o.c % 2 === 0; const w = o.bold ? 620 : 300; const slant = o.bold ? 200 : 120;
    const band = right
      ? `${W - w + slant},0 ${W},0 ${W},${H} ${W - w},${H}`
      : `0,0 ${w - slant},0 ${w},${H} 0,${H}`;
    const stripe = right
      ? `${W - w + slant - 14},0 ${W - w + slant - 4},0 ${W - w - 4},${H} ${W - w - 14},${H}`
      : `${w - slant + 4},0 ${w - slant + 14},0 ${w + 14},${H} ${w + 4},${H}`;
    // қанық жолақ тек жоғарғы/төменгі жиекте (мәтін ол жерге шықпайды); мәтін астында — тек ашық тон
    const clip = 'bgkclip' + o.index;
    return svgLayer('<polygon points="' + band + '" fill="' + mix(p.bg, p.accent, o.bold ? 0.3 : 0.17) + '"/>') +
      '<svg class="bgk bgk-edge" aria-hidden="true" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="position:absolute;left:0;top:0"><defs><clipPath id="' + clip + '"><rect x="0" y="0" width="' + W + '" height="92"/><rect x="0" y="' + (H - 84) + '" width="' + W + '" height="84"/></clipPath></defs>' +
        '<polygon clip-path="url(#' + clip + ')" points="' + stripe + '" fill="' + (p.accent2 || p.accent) + '"/></svg>' +
      part((right ? 'left' : 'right') + ':-70px;top:-70px;width:240px;height:240px;border-radius:50%;opacity:.25;background-image:repeating-linear-gradient(45deg,' + p.accent + ' 0 2px,transparent 2px 14px)');
  },
  paper(p, o) {
    const kraft = mix(p.bg, p.accent2 || p.accent, 0.16);
    const sheet = mix(p.bg, '#ffffff', 0.6);
    const tilt = o.index % 2 ? 0.5 : -0.5;
    const tape = 'rgba(244,230,170,.78)';
    return part('inset:0;background-color:' + kraft + ';background-image:repeating-linear-gradient(12deg,rgba(90,60,25,.06) 0 1px,transparent 1px 7px),repeating-linear-gradient(-34deg,rgba(255,255,255,.08) 0 1px,transparent 1px 11px)') +
      part('left:54px;top:40px;width:1812px;height:1000px;transform:rotate(' + tilt + 'deg);filter:drop-shadow(0 14px 22px rgba(60,40,15,.28))',
        '<div style="width:100%;height:100%;background:' + sheet + ';clip-path:polygon(0 0,100% 0,100% 12%,99.4% 18%,100% 27%,99.5% 41%,100% 53%,99.3% 67%,100% 80%,99.6% 92%,100% 100%,92% 99.4%,81% 100%,66% 99.2%,52% 100%,37% 99.4%,22% 100%,9% 99.3%,0 100%)"></div>') +
      edge('left:' + (o.c % 2 ? 1620 : 120) + 'px;top:18px;width:160px;height:44px;transform:rotate(' + (o.c % 2 ? 6 : -8) + 'deg);background:' + tape + ';box-shadow:0 1px 2px rgba(0,0,0,.12)') +
      (o.bold ? edge('left:' + (o.c % 2 ? 140 : 1600) + 'px;top:22px;width:160px;height:44px;transform:rotate(' + (o.c % 2 ? -5 : 7) + 'deg);background:' + tape) : '');
  },
  ornament(p, o) {
    const gold = mix(p.accent, '#e2bd6b', 0.6);
    const strip = mix(p.text, p.accent, 0.22);
    const band = ornUri('kz-band-koshkar.svg', gold);
    const med = ornUri(o.index % 2 ? 'kz-medallion-8.svg' : 'kz-medallion-tuyetaban.svg', p.accent);
    const cor = ornUri('kz-corner-koshkar.svg', gold);
    const right = o.c % 2 === 0;
    return edge('left:0;right:0;top:0;height:' + (o.bold ? 76 : 60) + 'px;background:' + strip) +
      (band ? edge('left:0;right:0;top:' + (o.bold ? 14 : 10) + 'px;height:' + (o.bold ? 48 : 40) + 'px;background:url(' + band + ') center/auto 100% repeat-x') : '') +
      edge('left:0;right:0;top:' + (o.bold ? 82 : 66) + 'px;height:2px;background:' + gold) +
      (med ? part((right ? 'right' : 'left') + ':-170px;bottom:-180px;width:' + (o.bold ? 640 : 560) + 'px;height:' + (o.bold ? 640 : 560) + 'px;background:url(' + med + ') center/contain no-repeat;opacity:' + (o.bold ? 0.2 : 0.13)) : '') +
      (cor ? edge((right ? 'left' : 'right') + ':22px;bottom:22px;width:110px;height:110px;background:url(' + cor + ') center/contain no-repeat;transform:rotate(' + (right ? -90 : 180) + 'deg);opacity:.85') : '');
  },
  blocks(p, o) {
    const right = o.c % 2 === 0; const line = mix(p.bg, p.text, 0.07);
    return part((right ? 'left:50%;right:0' : 'left:0;right:50%') + ';top:0;bottom:0;background-image:linear-gradient(' + line + ' 1px,transparent 1px),linear-gradient(90deg,' + line + ' 1px,transparent 1px);background-size:48px 48px') +
      edge((right ? 'right:0' : 'left:0') + ';top:0;width:' + (o.bold ? 300 : 190) + 'px;height:' + (o.bold ? 100 : 92) + 'px;background:' + p.accent) +
      edge((right ? 'left:0' : 'right:0') + ';bottom:0;width:' + (o.bold ? 960 : 640) + 'px;height:10px;background:' + p.text) +
      edge((right ? 'left:56px' : 'right:56px') + ';top:104px;width:3px;height:' + (o.bold ? 420 : 260) + 'px;background:' + p.text);
  },
  blobs(p, o) {
    const a = mix(p.bg, p.accent, o.bold ? 0.26 : 0.17); const b = mix(p.bg, p.accent2 || p.accent, o.bold ? 0.3 : 0.2);
    const flip = o.c % 2 === 1;
    const star = (x, y, s, col) => part('left:' + x + 'px;top:' + y + 'px;width:' + s + 'px;height:' + s + 'px',
      '<svg viewBox="0 0 60 60" width="' + s + '" height="' + s + '"><path d="M30 0C33 22 38 27 60 30C38 33 33 38 30 60C27 38 22 33 0 30C22 27 27 22 30 0Z" fill="' + col + '"/></svg>', 'bgk-solid bgk-edge');
    return part((flip ? 'right' : 'left') + ':-150px;top:-180px;width:560px;height:460px;background:' + a + ';border-radius:58% 42% 63% 37% / 46% 55% 45% 54%') +
      part((flip ? 'left' : 'right') + ':-160px;bottom:-200px;width:640px;height:500px;background:' + b + ';border-radius:41% 59% 38% 62% / 57% 39% 61% 43%') +
      svgLayer('<path d="M-20 1028 C 160 990, 300 1066, 480 1028 S 820 990, 1000 1028 S 1340 1066, 1520 1028 S 1820 994, 1960 1020" fill="none" stroke="' + p.accent + '" stroke-opacity=".4" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>') +
      star(flip ? 70 : 1806, 30, 56, p.accent2 || p.accent) + star(flip ? 140 : 1760, 82, 30, p.accent);
  },
};

/**
 * Бір слайдтың фон қабаты (HTML). role: cover | section | content. Жоқ болса ''.
 * @param {{recipe:string, palette:object, index:number, seed:number, role:string}} o
 */
function bgFor(o) {
  const f = R[o.recipe];
  if (!f || !o.palette) return { under: '', over: '' };
  const c = (hash(String(o.seed)) + o.index * 3) % 4;
  const html = f(o.palette, { c, index: o.index, bold: o.role === 'cover' || o.role === 'section' });
  // жоғарғы деңгейдегі бөлшектерді бөлеміз: bgk-edge → композиция бөлшектерінің үстіне
  const parts = splitTop(html);
  return { under: parts.filter((x) => !/^<(div|svg) class="bgk[^"]*bgk-edge/.test(x)).join(''), over: parts.filter((x) => /^<(div|svg) class="bgk[^"]*bgk-edge/.test(x)).join('') };
}
/** Жоғарғы деңгейдегі <div>/<svg> элементтері (рецепт HTML-і біз жазған, тепе-тең тегтер) */
function splitTop(html) {
  const out = []; const re = /<(\/?)(div|svg)\b[^>]*>/g; let depth = 0; let start = 0; let m;
  while ((m = re.exec(html))) {
    if (!m[1]) { if (depth === 0) start = m.index; depth++; } else { depth--; if (depth === 0) out.push(html.slice(start, re.lastIndex)); }
  }
  return out;
}

// синтетикалық түйіршік (::after) барлық жерде өшеді; ::before — әдепкі виньетка, бірақ кейбір жүйеде ол жүйенің
// өз қолтаңбасы (академияның жоғарғы акцент жолағы, Мұраның қағаз жиегі) — оларға тиіспейміз
const CSS = '#stage .slide.bgk-on .layer-bg::after{opacity:0!important}' +
  '#stage:not(.ds-academy):not(.ds-heritage) .slide.bgk-on .layer-bg::before{opacity:0!important}' +
  '#stage .slide.bgk-on .deco{display:none}.bgk{pointer-events:none}';

module.exports = { RECIPES, BY_SYSTEM, pickRecipe, bgFor, splitTop, enabled, CSS };
