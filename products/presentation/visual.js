'use strict';

const { recordApiUsage } = require('../../core/cost');

/**
 * Visual stage — кейбір слайдтарға SVG фигура (диаграмма / инфографика / схема-карта) сызу.
 *
 * Қалай жұмыс істейді:
 *   1. DeepSeek слайд мазмұнын жазғанда, СИРЕК слайдқа `visual: {type, brief, data}` қосады.
 *   2. Осы модуль ТЕК сол слайдтарға арнайы бір шақыру жасайды (DeepSeek немесе Claude — env арқылы).
 *   3. Жауап қатаң тазаланады (sanitizeSvg) және мәтін сыятыны тексеріледі (inspectSvg).
 *   4. Сәтті болса — слайдқа `visualSvg` (data: URI) қосылады да, builder "visual" layout-ын қолданады.
 *      Сәтсіз болса — `slide.visual` өшіріледі, слайд қалыпты мәтін-слайд болып қала береді.
 *
 * Ешқашан лақтырмайды: визуал ешқашан бүкіл презентацияны құлатпауы керек.
 *
 * Провайдер (env):
 *   VISUAL_PROVIDER = deepseek (әдепкі: deepseek-v4-pro, ойлау режимі қосулы) | deepseek-flash | anthropic
 *   VISUAL_FALLBACK = deepseek-flash (deepseek үшін әдепкі) | anthropic | deepseek | (бос) — негізгі сәтсіз болса, бір рет қана
 *   VISUAL_VISION_CHECK = 1 (әдепкі) — салынған суретті көретін модель (deepseek-flash) бағалайды; әлсіз болса
 *     ескертулерімен бір рет қайта салынады
 *   Толық тізім — .env.example
 */

const { slideSvgPalette } = require('./html3DBuilder');
const { validateInfographic } = require('./design/infographics');

const DEFAULT_VB = { w: 1100, h: 740 };            // builder-дегі .figure өлшемімен бірдей
// illustration — слайдтың нақты затын салу (киіз үй, домбыра, жүрек, бу машинасы): қорап-сызба емес, заттың өзі
const TYPES = new Set(['diagram', 'infographic', 'map', 'illustration']);
const ANTHROPIC_VERSION = '2023-06-01';

// ═══════════════════════════════ Config ═══════════════════════════════

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}
function flag(v, d) {
  if (v == null || String(v).trim() === '') return d;
  return !/^(0|false|no|off)$/i.test(String(v).trim());
}

// Бағалар: $/1M токен. Anthropic — ресми құжаттан (Sonnet 5.5: $2/$10).
// DeepSeek — бюджет есебі үшін ең қымбат белгілі баға (V4-Pro: дереккөздерде $0.44–1.32 / $0.87–3.96; нақтысы env арқылы).
// Сурет салу — кеңістікті ойлау: Pro моделі ойлау режимімен (thinking) салады; ойлау токендері max_tokens ішінде.
const PROVIDER_DEFAULTS = {
  deepseek:         { api: 'deepseek', model: 'deepseek-v4-pro', priceIn: 1.32, priceOut: 3.96, maxTokens: 20000, thinking: true },
  'deepseek-flash': { api: 'deepseek', model: 'deepseek-flash', priceIn: 0.30, priceOut: 1.20, maxTokens: 8000, thinking: false },
  anthropic:        { api: 'anthropic', model: 'claude-sonnet-5-5', priceIn: 2.00, priceOut: 10.00, maxTokens: 6000, thinking: false },
};

function providerConfig(name, env) {
  const d = PROVIDER_DEFAULTS[name];
  if (!d) return null;
  const P = name.toUpperCase().replace(/-/g, '_');
  return {
    name,
    api: d.api,
    apiKey: d.api === 'deepseek' ? (env.DEEPSEEK_API_KEY || '') : (env.ANTHROPIC_API_KEY || ''),
    model: env[`VISUAL_${P}_MODEL`] || d.model,
    priceIn: num(env[`VISUAL_${P}_PRICE_IN`], d.priceIn),
    priceOut: num(env[`VISUAL_${P}_PRICE_OUT`], d.priceOut),
    maxTokens: Math.floor(num(env[`VISUAL_${P}_MAX_TOKENS`], d.maxTokens)),
    // Sonnet 5.5-те adaptive thinking әдепкіде ҚОСУЛЫ (ресми құжат) — өшірмесек, thinking токендері де ақыланады.
    sendThinkingDisabled: flag(env[`VISUAL_${P}_THINKING_DISABLED`], !d.thinking),
  };
}

function getConfig(env = process.env) {
  const primaryName = String(env.VISUAL_PROVIDER || 'deepseek').trim().toLowerCase();
  // Pro моделі қолжетімсіз/қате болса — Flash (бос мән берілсе — fallback жоқ)
  const fallbackName = String(env.VISUAL_FALLBACK == null ? (primaryName === 'deepseek' ? 'deepseek-flash' : '') : env.VISUAL_FALLBACK).trim().toLowerCase();
  const mp = Number(env.VISUAL_MAX_PER_DECK);
  return {
    enabled: flag(env.VISUAL_ENABLED, true),
    mapsEnabled: flag(env.VISUAL_MAPS, true),
    maxPerDeck: Number.isFinite(mp) && mp >= 0 ? Math.floor(mp) : 2,
    budgetTg: num(env.VISUAL_BUDGET_TG, 120),
    visionCheck: flag(env.VISUAL_VISION_CHECK, true),
    minScore: num(env.VISUAL_MIN_SCORE, 6),
    usdKzt: num(env.USD_KZT, 470),
    timeoutMs: Math.floor(num(env.VISUAL_TIMEOUT_MS, 180000)),
    estInputTokens: 2600,               // system+user промпт бағасы (қор ретінде)
    primaryName,
    primary: providerConfig(primaryName, env),
    fallback: fallbackName && fallbackName !== primaryName ? providerConfig(fallbackName, env) : null,
  };
}

function costTg(p, inTok, outTok, cfg) {
  return ((inTok * p.priceIn + outTok * p.priceOut) / 1e6) * cfg.usdKzt;
}
function worstCaseTg(p, cfg) {
  return costTg(p, cfg.estInputTokens, p.maxTokens, cfg);
}
// Бір дек ішінде максимум неше визуал: бюджет пен maxPerDeck-тің кішісі
function allowedSlots(cfg) {
  if (cfg.maxPerDeck <= 0 || !cfg.primary) return 0;
  const w = worstCaseTg(cfg.primary, cfg);
  return Math.max(1, Math.min(cfg.maxPerDeck, Math.floor(cfg.budgetTg / w)));
}

// ═══════════════════════════ Spec normalization ═══════════════════════════

function normalizeVisualSpec(v) {
  if (!v || typeof v !== 'object') return null;
  const type = String(v.type || '').toLowerCase().trim();
  if (!TYPES.has(type)) return null;
  const brief = String(v.brief || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const data = (Array.isArray(v.data) ? v.data : [])
    .map((x) => (x && typeof x === 'object') ? Object.values(x).join(': ') : String(x == null ? '' : x))
    .map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 140))
    .filter(Boolean)
    .slice(0, 8);
  // сызбаға мәлімет керек (әйтпесе модель ойдан толтырады); затты салуға — не салатынын айтатын brief жеткілікті
  if (type === 'illustration' ? brief.length < 8 : data.length < 2) return null;
  return { type, brief, data: type === 'illustration' ? data.slice(0, 6) : data };
}

// DeepSeek қайтарған слайдтарды тазалау: жарамсыз/қате visual-ды өшіру, мұқабада ешқашан болмайды
function prepareVisuals(slides) {
  (slides || []).forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    if (i === 0) { delete s.visual; return; }
    // our infographic library draws this slide — an extra LLM SVG would only compete with it
    if (validateInfographic(s.infographic)) { delete s.visual; return; }
    const n = normalizeVisualSpec(s.visual);
    if (n) s.visual = n; else delete s.visual;
  });
}

// ═══════════════════════════ SVG sanitizer ═══════════════════════════
// Whitelist принципі: белгілі элементтер мен атрибуттарды ғана қайта жинаймыз.
// Қалғаны (script, foreignObject, image, animate, on*, сыртқы href...) — тасталады.
// Нәтиже <img src="data:image/svg+xml"> ішінде көрсетіледі (онда скрипт/желі бәрібір істемейді) —
// бұл қосымша қорғаныс қабаты.

const ALLOWED_TAGS = {
  svg: 'svg', g: 'g', defs: 'defs', lineargradient: 'linearGradient', radialgradient: 'radialGradient',
  stop: 'stop', rect: 'rect', circle: 'circle', ellipse: 'ellipse', line: 'line', polyline: 'polyline',
  polygon: 'polygon', path: 'path', text: 'text', tspan: 'tspan', title: 'title', desc: 'desc',
  marker: 'marker', use: 'use', symbol: 'symbol', clippath: 'clipPath', pattern: 'pattern', style: 'style',
};
const TEXT_HOSTS = new Set(['text', 'tspan', 'title', 'desc', 'style']);

const ATTR_CANON = {
  viewbox: 'viewBox', preserveaspectratio: 'preserveAspectRatio', gradientunits: 'gradientUnits',
  gradienttransform: 'gradientTransform', patternunits: 'patternUnits', patterntransform: 'patternTransform',
  patterncontentunits: 'patternContentUnits', markerwidth: 'markerWidth', markerheight: 'markerHeight',
  refx: 'refX', refy: 'refY', markerunits: 'markerUnits', clippathunits: 'clipPathUnits',
};
const ALLOWED_ATTRS = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd', 'points', 'transform',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'opacity', 'font-family',
  'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline',
  'alignment-baseline', 'text-decoration', 'dx', 'dy', 'id', 'class', 'offset', 'stop-color', 'stop-opacity',
  'gradientunits', 'gradienttransform', 'patternunits', 'patterntransform', 'patterncontentunits', 'viewbox',
  'preserveaspectratio', 'marker-start', 'marker-mid', 'marker-end', 'markerwidth', 'markerheight', 'refx',
  'refy', 'orient', 'markerunits', 'clip-path', 'clippathunits', 'href', 'xlink:href', 'style', 'visibility',
  'display', 'xmlns',
]);
const STYLE_PROPS = new Set([
  'fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight',
  'font-family', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'stroke-dasharray',
  'stroke-linecap', 'stroke-linejoin', 'text-decoration',
]);
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  laquo: '«', raquo: '»', copy: '©', deg: '°', middot: '·', times: '×', rarr: '→', larr: '←', bull: '•',
};

const TAG_RE = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=\/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
const ATTR_RE = /([^\s=\/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function decodeEntities(str) {
  return str.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const cp = (e[1] === 'x' || e[1] === 'X') ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return (Number.isFinite(cp) && cp > 0 && cp <= 0x10FFFF) ? String.fromCodePoint(cp) : '';
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, e) ? NAMED_ENTITIES[e] : m;
  });
}
function escText(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return escText(s).replace(/"/g, '&quot;'); }

function safeValue(val) {
  if (val.length > 300) return false;
  if (/javascript:|vbscript:|data:|expression\s*\(|@import|[<>{}]/i.test(val)) return false;
  if (/url\s*\(/i.test(val) && !/^url\(\s*['"]?#[\w:.-]+['"]?\s*\)(\s+\S+)?$/i.test(val)) return false;
  return true;
}
function cleanStyleAttr(v) {
  return v.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(':');
    if (i < 0) return null;
    const k = d.slice(0, i).trim().toLowerCase();
    const val = d.slice(i + 1).trim();
    if (!STYLE_PROPS.has(k) || !safeValue(val)) return null;
    return `${k}:${val}`;
  }).filter(Boolean).join(';');
}
function safeStyleElement(css) {
  return css.length <= 4000 && !/@|url\s*\(|expression|javascript|<|\\/i.test(css);
}

function cleanAttrs(attrStr, isRoot) {
  const out = [];
  const seen = new Set();
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(attrStr)) !== null) {
    const raw = m[1];
    const val = m[2] != null ? m[2] : (m[3] != null ? m[3] : m[4]);
    if (val == null) continue;
    if (!/^[A-Za-z_:][\w:.-]*$/.test(raw)) continue;
    let lname = raw.toLowerCase();
    if (/^on/.test(lname)) continue;
    if (lname === 'xlink:href') lname = 'href';         // xlink namespace жариялау қажет болмасын
    if (!ALLOWED_ATTRS.has(lname)) continue;
    if (isRoot && (lname === 'width' || lname === 'height' || lname === 'xmlns')) continue;
    if (seen.has(lname)) continue;
    let v = decodeEntities(val).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    const max = (lname === 'd' || lname === 'points') ? 20000 : 1000;
    if (v.length > max) continue;
    if (lname === 'href') { if (!/^#[\w:.-]{1,64}$/.test(v)) continue; }
    else if (lname === 'id') { if (!/^[\w:.-]{1,64}$/.test(v)) continue; }
    else if (lname === 'style') { v = cleanStyleAttr(v); if (!v) continue; }
    else if (!safeValue(v) && lname !== 'd' && lname !== 'points') continue;
    else if ((lname === 'd' || lname === 'points') && /[^0-9eE\s,.\-+MmLlHhVvCcSsQqTtAaZz]/.test(v)) continue;
    seen.add(lname);
    out.push([ATTR_CANON[lname] || lname, v]);
  }
  return out;
}

/** Модель жауабынан таза, қауіпсіз SVG жасайды. Жарамсыз болса null. */
function sanitizeSvg(input) {
  if (typeof input !== 'string' || input.length > 400000) return null;
  let s = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  const start = s.search(/<svg[\s>\/]/i);
  if (start < 0) return null;
  s = s.slice(start)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, t) => escText(t));

  const out = [];
  const stack = [];
  let skip = 0;
  let rootDone = false;
  let elements = 0;
  let styleBuf = '';
  let vbW = DEFAULT_VB.w;
  let vbH = DEFAULT_VB.h;
  let pos = 0;
  let m;

  const flushText = (t) => {
    if (skip || !stack.length || !t) return;
    const top = stack[stack.length - 1];
    if (!TEXT_HOSTS.has(top.lname)) return;
    if (top.lname === 'style') { styleBuf += decodeEntities(t); return; }
    const clean = escText(decodeEntities(t));
    if (clean.trim() === '') { if (top.lname === 'text' || top.lname === 'tspan') out.push(' '); return; }
    out.push(clean);
  };
  const closeTop = () => {
    const t = stack.pop();
    if (t.lname === 'style') {
      if (safeStyleElement(styleBuf) && styleBuf.trim()) out.push('<style>' + escText(styleBuf) + '</style>');
      styleBuf = '';
    } else {
      out.push('</' + t.name + '>');
    }
  };

  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(s)) !== null) {
    if (rootDone) break;
    flushText(s.slice(pos, m.index));
    pos = TAG_RE.lastIndex;
    const closing = m[1] === '/';
    const lname = m[2].toLowerCase();
    const attrStr = m[3] || '';
    const selfClose = m[4] === '/';

    if (closing) {
      if (skip) { skip--; continue; }
      let idx = -1;
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].lname === lname) { idx = i; break; }
      if (idx < 0) continue;
      while (stack.length > idx + 1) closeTop();
      closeTop();
      if (!stack.length) rootDone = true;
      continue;
    }

    if (skip) { if (!selfClose) skip++; continue; }
    const canon = ALLOWED_TAGS[lname];
    const isRoot = stack.length === 0;
    if (isRoot && lname !== 'svg') return null;
    if (!canon || (!isRoot && lname === 'svg')) { if (!selfClose) skip = 1; continue; }
    if (++elements > 3000) return null;

    const attrs = cleanAttrs(attrStr, isRoot);
    if (isRoot) {
      const vb = attrs.find((a) => a[0] === 'viewBox');
      const nums = vb ? vb[1].split(/[\s,]+/).map(Number) : [];
      if (nums.length === 4 && nums.every(Number.isFinite) && nums[2] > 50 && nums[3] > 50) {
        vbW = nums[2]; vbH = nums[3];
      } else {
        const i = attrs.findIndex((a) => a[0] === 'viewBox');
        if (i >= 0) attrs.splice(i, 1);
        attrs.push(['viewBox', `0 0 ${DEFAULT_VB.w} ${DEFAULT_VB.h}`]);
      }
      attrs.unshift(['xmlns', 'http://www.w3.org/2000/svg']);
    }

    if (lname === 'style') { stack.push({ lname, name: canon }); styleBuf = ''; continue; }
    out.push('<' + canon + attrs.map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('') + (selfClose ? '/>' : '>'));
    if (selfClose) { if (isRoot) rootDone = true; } else stack.push({ lname, name: canon });
  }
  if (!out.length) return null;
  while (stack.length) closeTop();

  const svg = out.join('');
  if (svg.length > 160000 || !/^<svg[\s>]/.test(svg) || !/<\/svg>$/.test(svg)) return null;
  return { svg, vbW, vbH, elements };
}

// ═══════════════════════════ Text-fit heuristic ═══════════════════════════
// Браузерсіз шамамен: символ саны × шрифт × 0.62 (DejaVu/Inter аралығы, консервативті).
// Мақсат — көрінеріктей кесілген мәтінді ұстау (модель тар қорапқа ұзын жол жазса).

function attrMap(attrStr) {
  const o = {};
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(attrStr || '')) !== null) {
    const v = m[2] != null ? m[2] : (m[3] != null ? m[3] : m[4]);
    if (v != null) o[m[1].toLowerCase()] = decodeEntities(v);
  }
  return o;
}
function firstNum(v, d) {
  const n = parseFloat(String(v == null ? '' : v).split(/[\s,]+/)[0]);
  return Number.isFinite(n) ? n : d;
}
function fontSizeOf(a) {
  if (a['font-size'] != null) { const n = parseFloat(a['font-size']); if (Number.isFinite(n)) return n; }
  const sm = a.style && a.style.match(/font-size\s*:\s*([\d.]+)/i);
  return sm ? parseFloat(sm[1]) : null;
}

function inspectSvg(svg, vbW = DEFAULT_VB.w, vbH = DEFAULT_VB.h) {
  const FACTOR = 0.62;
  const scale = Math.min(DEFAULT_VB.w / vbW, DEFAULT_VB.h / vbH);
  const ctx = [{ tx: 0, ty: 0, fs: 16, anchor: 'start' }];
  const res = { overflowPx: 0, texts: 0, minFontOnSlide: Infinity, warnings: [], severe: false, placeholders: 0 };
  let cur = null;
  let pos = 0;
  let m;
  TAG_RE.lastIndex = 0;

  const feed = (t) => {
    if (!cur) return;
    const str = decodeEntities(t).replace(/\s+/g, ' ').trim();
    if (str) { cur.lines[cur.lines.length - 1].chars += str.length; cur.text = (cur.text || '') + str; }
  };
  const finish = (c) => {
    for (const ln of c.lines) {
      if (!ln.chars) continue;
      const w = ln.chars * c.fs * FACTOR;
      const x = ln.x + c.tx;
      const left = c.anchor === 'middle' ? x - w / 2 : (c.anchor === 'end' ? x - w : x);
      const right = left + w;
      res.overflowPx = Math.max(res.overflowPx, -left, right - vbW, 0);
      const y = c.y + c.ty;
      if (y > vbH + 10 || y < -10) res.overflowPx = Math.max(res.overflowPx, 120);
    }
    res.texts++;
    res.minFontOnSlide = Math.min(res.minFontOnSlide, c.fs * scale);
    // «—», «...», «?» — мазмұны жоқ түйін (модель бір тармаққа мәтін таппай қалған): бос түйінді сызба слайдқа шықпайды
    if (/^[\s—–\-.…_?·•]+$/.test(c.text || '')) res.placeholders++;
  };

  while ((m = TAG_RE.exec(svg)) !== null) {
    feed(svg.slice(pos, m.index));
    pos = TAG_RE.lastIndex;
    const closing = m[1] === '/';
    const lname = m[2].toLowerCase();
    if (closing) {
      if (lname === 'text' && cur) { finish(cur); cur = null; }
      if (ctx.length > 1) ctx.pop();
      continue;
    }
    const a = attrMap(m[3]);
    const selfClose = m[4] === '/';
    const parent = ctx[ctx.length - 1];
    const tr = (a.transform || '').match(/translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)/);
    const next = {
      tx: parent.tx + (tr ? parseFloat(tr[1]) : 0),
      ty: parent.ty + (tr && tr[2] ? parseFloat(tr[2]) : 0),
      fs: fontSizeOf(a) || parent.fs,
      anchor: a['text-anchor'] || parent.anchor,
    };
    if (lname === 'text') {
      const x = firstNum(a.x, 0);
      cur = { ...next, x, y: firstNum(a.y, 0), lines: [{ x, chars: 0 }] };
    } else if (lname === 'tspan' && cur) {
      if (a.x != null) cur.lines.push({ x: firstNum(a.x, cur.x), chars: 0 });
      const tfs = fontSizeOf(a);
      if (tfs && tfs > cur.fs) cur.fs = tfs;
      if (a['text-anchor']) cur.anchor = a['text-anchor'];
    }
    if (!selfClose) ctx.push(next);
    else if (lname === 'text' && cur) { finish(cur); cur = null; }
  }

  const tolerance = vbW * 0.01;
  const severeLimit = vbW * 0.08;
  if (res.overflowPx > tolerance) res.warnings.push(`text may overflow by ~${Math.round(res.overflowPx)}px`);
  if (res.overflowPx > severeLimit) res.severe = true;
  if (res.texts && res.minFontOnSlide < 18) res.warnings.push(`small text (~${Math.round(res.minFontOnSlide)}px on slide)`);
  if (!res.texts) res.warnings.push('no text labels');
  if (res.placeholders) { res.warnings.push(`${res.placeholders} empty placeholder label(s)`); res.severe = true; }
  if (!Number.isFinite(res.minFontOnSlide)) res.minFontOnSlide = 0;
  return res;
}

function toDataUri(svg) {
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

// ═══════════════════════════════ Prompt ═══════════════════════════════

const BASE_RULES = `You draw ONE self-contained SVG figure for a presentation slide. Reply with the <svg>…</svg> markup ONLY — no markdown fences, no comments, no explanation.

CANVAS
- Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 740"> — no width/height attributes.
- The figure sits DIRECTLY on the slide (background = PALETTE.bg). There is NO card or panel behind it.
- NEVER draw a background rectangle, an outer frame, a border or a card around the figure. No full-canvas or near-full-canvas <rect>.
- Keep 30px margins: everything inside x 30..1070 and y 30..710. The slide has its own title, so do not add a figure title.
- FILL THE CANVAS. The figure must spread over at least 85% of the width and 70% of the height. A small figure floating in the middle with empty space around it is a failure. Make shapes generous (nodes at least 200px wide or circles of radius 110+).

TEXT (the most common failure — be strict)
- font-family="Inter, 'Segoe UI', 'Noto Sans', Arial, sans-serif".
- Font sizes: labels 30-36, secondary text 26 or more, key numbers 56-96. Never below 24. Big, bold labels read from the back of a classroom.
- The text width in the viewer can be up to: characters × font-size × 0.65. Check EVERY label against the space it has, with 14px padding. If it does not fit: shorten it or break it into lines (separate <text> or <tspan x="…" dy="…">, max 3 lines).
- Write text in the language of DATA exactly as given. Do not translate. Do not add words that are not in DATA.
- Use ONLY the facts, names and numbers in DATA. NEVER invent numbers, dates, percentages or names.

COLOURS
- Use ONLY the PALETTE colors, plus lighter/darker tints of them made with fill-opacity or a linearGradient between two palette colours. The accent colour marks the single most important element.
- Text on a filled shape must contrast with that fill (dark text on light fills, PALETTE.bg-coloured text on accent fills).

FORBIDDEN: <script>, <style>, <foreignObject>, <image>, filters, masks, external links or fonts, animations, emoji.`;

const TYPE_RULES = {
  illustration: `TYPE: ILLUSTRATION — draw the REAL OBJECT itself, recognisable at a glance, like a good textbook or museum illustration.
- Draw the object described in BRIEF: its true silhouette, proportions and characteristic details (a yurt has a dome of roof poles, a lattice wall (kerege), a door and a shanyrak on top; a dombra has a pear-shaped body, a long neck with frets and two strings; a heart has atria, ventricles, aorta and vessels).
- NEVER replace the object with boxes, circles, icons-in-squares, a flowchart or an abstract blob. If a part is mentioned, it must be drawn where it really is.
- Style: flat vector illustration with depth — 3-5 tones per surface (base colour, shade, highlight) using palette colours and their tints, consistent outline (stroke 2-4 in PALETTE.text at 60-90% opacity), curved <path> shapes (C/Q/A commands), soft ground shadow ellipse under the object.
- The object fills 70-85% of the canvas height and is centred (or slightly right if labels go left).
- Labels: if DATA lists parts, add short callout labels (font 30+, bold) with thin leader lines from the label to the exact part; put labels in empty space around the object, never over it. If DATA is empty, no text at all.
- Detail is welcome: up to ~40000 characters, many paths. Quality over brevity.`,
  diagram: `TYPE: DIAGRAM — 3-6 named parts with a clear direction or structure.
- Semantic relationships must be obvious at a glance: clear arrow direction, hierarchy top→bottom or left→right, equal spacing, no overlapping nodes or labels.
- Complexity must match DATA size: 3 parts → 3 nodes; never add decorative boxes without labels from DATA.
- Nodes are shapes that fit their meaning (circles for stages, rounded rectangles rx 18 for components, a cylinder for a store) with soft palette fills — not grey boxes. Each node may carry a small drawn pictogram (2-6 paths) of what it is.
- Arrows: smooth <path> curves with a <marker> arrowhead, stroke 3-4.`,
  infographic: `TYPE: INFOGRAPHIC — one dominant element (a big number, a drawn object or a bar set) plus 2-4 supporting facts.
- Charts: bar lengths/heights proportional to the given numbers; label every bar with its value. If DATA has no numbers, draw a qualitative layout without axis values.
- Prefer a drawn object over a box: e.g. a water drop filled to a level, a person row, a stack of coins — made of real shapes.`,
  map: `TYPE: MAP — a SIMPLIFIED SCHEMATIC only: rough region shapes with soft fills, dots for places, labeled routes with curved dashed paths. Never try exact borders or coastlines. Add the given CAPTION as small text (size 24) at the bottom-left.`,
};
function systemFor(type) { return BASE_RULES + '\n\n' + (TYPE_RULES[type] || TYPE_RULES.diagram); }

function captionFor(texts) {
  const t = texts.join(' ');
  if (/[әғқңөұүһі]/i.test(t)) return 'Сызба, масштабсыз';
  if (/[а-яё]/i.test(t)) return 'Схема, без масштаба';
  return 'Schematic, not to scale';
}

function buildPrompt(slide, palette, critique) {
  const spec = slide.visual;
  const caption = spec.type === 'map' ? captionFor([slide.title || '', ...spec.data]) : null;
  const user = [
    `TYPE: ${spec.type}`,
    `PALETTE: ${JSON.stringify(palette)}`,
    `SLIDE TITLE (context only, do not draw it): ${String(slide.title || '').slice(0, 120)}`,
    `BRIEF: ${spec.brief || '(none — choose the clearest simple layout)'}`,
    spec.data.length ? (spec.type === 'illustration' ? 'PARTS TO LABEL (exact wording):' : 'DATA (the only facts you may use):') : 'DATA: (none — no text labels)',
    ...spec.data.map((d, i) => `${i + 1}. ${d}`),
    caption ? `CAPTION: ${caption}` : '',
    // алдыңғы нұсқаны көретін модель айтқан ақаулар: қайта салғанда түзетілсін
    critique && critique.length ? `A PREVIOUS ATTEMPT WAS REJECTED BY A REVIEWER WHO SAW IT. Fix these problems:\n${critique.map((c) => '- ' + c).join('\n')}` : '',
  ].filter(Boolean).join('\n');
  return { system: systemFor(spec.type), user };
}

// ═══════════════════════════════ HTTP / providers ═══════════════════════════════

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(url, headers, body, cfg, fetchImpl) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
    try {
      const res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
      if (res.ok) return await res.json();
      const text = String(await res.text().catch(() => '')).slice(0, 300);
      const err = new Error(`HTTP ${res.status}: ${text}`);
      err.status = res.status;
      if ([429, 500, 502, 503, 504, 529].includes(res.status) && attempt < 2) {
        lastErr = err;
        const ra = Number(res.headers && res.headers.get && res.headers.get('retry-after'));
        await sleep(Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500, 8000));
        continue;
      }
      throw err;
    } catch (e) {
      if (e.name === 'AbortError') {
        const t = new Error(`timeout after ${cfg.timeoutMs}ms`);
        t.status = 'timeout';                 // қайталамаймыз: сұраныс ақыланып қойған болуы мүмкін
        throw t;
      }
      if (e.status) throw e;
      if (attempt < 2) { lastErr = e; await sleep(1500); continue; }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

async function callProvider(p, system, user, cfg, fetchImpl) {
  if (p.api === 'deepseek') {
    // Формат — gemini.js-тегі жұмыс істеп тұрған шақырумен бірдей (thinking өшірулі)
    const data = await httpJson(
      'https://api.deepseek.com/v1/chat/completions',
      { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      {
        model: p.model,
        ...(p.sendThinkingDisabled ? { thinking: { type: 'disabled' } } : {}),
        max_tokens: p.maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      },
      cfg, fetchImpl
    );
    const ch = data.choices && data.choices[0];
    recordApiUsage(data.usage || null, { label: 'visual:' + p.name, model: p.model });
    return {
      text: (ch && ch.message && ch.message.content) || '',
      stop: ch && ch.finish_reason === 'length' ? 'length' : 'ok',
      inTok: (data.usage && data.usage.prompt_tokens) || 0,
      outTok: (data.usage && data.usage.completion_tokens) || 0,
    };
  }
  // anthropic — temperature/top_p жібермейміз (Sonnet 5-те әдепкіден өзге мән 400 қатесін береді)
  const data = await httpJson(
    'https://api.anthropic.com/v1/messages',
    { 'content-type': 'application/json', 'x-api-key': p.apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    {
      model: p.model,
      max_tokens: p.maxTokens,
      ...(p.sendThinkingDisabled ? { thinking: { type: 'disabled' } } : {}),
      system,
      messages: [{ role: 'user', content: user }],
    },
    cfg, fetchImpl
  );
  recordApiUsage(data.usage || null, { label: 'visual:anthropic', model: p.model });
  return {
    text: (data.content || []).filter((b) => b && b.type === 'text').map((b) => b.text).join('\n'),
    stop: data.stop_reason === 'max_tokens' ? 'length' : (data.stop_reason === 'refusal' ? 'refusal' : 'ok'),
    inTok: (data.usage && data.usage.input_tokens) || 0,
    outTok: (data.usage && data.usage.output_tokens) || 0,
  };
}

// ═══════════════════════════════ Circuit breaker ═══════════════════════════════
// Кілт жарамсыз / баланс бітсе, әр дек бос қате шақырып отырмасын.
const breaker = { fails: 0, openUntil: 0 };
function _resetBreaker() { breaker.fails = 0; breaker.openUntil = 0; }
function noteFailure(err) {
  if (err && [400, 401, 403].includes(err.status)) {
    breaker.fails++;
    if (breaker.fails >= 3) {
      breaker.openUntil = Date.now() + 10 * 60 * 1000;
      breaker.fails = 0;
      console.warn('[Visual] 3 қатарынан auth/billing қатесі — 10 минутқа тоқтатылды');
    }
  }
}
function noteSuccess() { breaker.fails = 0; }
// Pro моделінің атауы өзгерсе/жабылса (400/404 «model …»): процесс бойы Flash-пен жалғасамыз, бүкіл визуалды бөгемейміз
let proMissing = false;
function _resetProMissing() { proMissing = false; }

// ═══════════════════════════════ Vision check ═══════════════════════════════
// Мәтін тексерісі (inspectSvg) суреттің ӨЗІН көрмейді: «жүрек» орнына үш шаршы салынса да өтіп кетеді.
// Сондықтан салынған SVG суретке айналдырылып, көретін модельге (deepseek-flash) көрсетіледі.

const VISION_PROMPT = (spec, title) => `This image is an SVG figure drawn for a presentation slide titled "${String(title || '').slice(0, 120)}".
It was supposed to show (${spec.type}): ${spec.brief || '(see title)'}${spec.data.length ? '\nWith these labels: ' + spec.data.join('; ') : ''}
Judge it strictly, as a picky designer:
- ${spec.type === 'illustration' ? 'Is it clearly the REAL object, recognisable at a glance, with its characteristic parts? Boxes, icons in squares, flowcharts or abstract blobs instead of the object = score 0-3.' : 'Are the parts and their relationships clear at a glance (direction, hierarchy)?'}
- Is any text cut off, overlapping a shape or another label, too small, or written over a busy area?
- Is the figure too small for its canvas, with large empty areas around it? That alone caps the score at 5.
- Is there an unwanted frame, card or background rectangle around the figure?
- Does it look professional (balanced, aligned, pleasant colours), not childish or broken?
Reply JSON only: {"score": 0-10, "issues": ["short concrete problem", ...]} — issues empty if score ≥ 8.`;

/**
 * SVG → PNG (слайд фонында) + суреттің кенептен алатын үлесі (getBBox, viewBox бірлігімен).
 * sharp тәуелділікте жоқ — рендерердің Chromium-ы қолданылады. SVG тазаланған (скрипт/сілтеме жоқ), бетке тікелей қойылады.
 */
async function svgToPng(svg, bg) {
  const puppeteer = require('puppeteer');
  const { launchBrowser } = require('./renderer');
  const browser = await launchBrowser(puppeteer);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 880, height: 592, deviceScaleFactor: 1 });
    const color = /^#[0-9a-f]{3,8}$/i.test(String(bg || '')) ? bg : '#ffffff';
    await page.setContent('<html><body style="margin:0;background:' + color + '"><div id="f" style="width:880px;height:592px">' + svg.replace('<svg', '<svg width="880" height="592"') + '</div></body></html>');
    const fill = await page.evaluate(() => {
      const el = document.querySelector('#f svg'); if (!el) return null;
      const vb = el.viewBox && el.viewBox.baseVal; const b = el.getBBox();
      return vb && vb.width ? { w: b.width / vb.width, h: b.height / vb.height } : null;
    }).catch(() => null);
    const png = await page.screenshot({ type: 'png' });
    return { png, fill };
  } finally {
    await browser.close().catch(() => {});
  }
}

/** SVG → PNG → көретін модель: { score, issues } не null (тексеру мүмкін болмаса — бөгемейміз) */
async function visionCheck(svg, spec, slide, palette, opts = {}) {
  try {
    const { png, fill } = await (opts.rasterize || svgToPng)(svg, palette && palette.bg);
    // кенептің аз бөлігін алатын (ортада кішкентай, айналасы бос) сурет — көретін модельсіз-ақ қайта салынады
    const small = fill && (fill.w < 0.7 || fill.h < 0.55)
      ? `the figure uses only ${Math.round(fill.w * 100)}% of the width and ${Math.round(fill.h * 100)}% of the height — make it much larger so it fills the canvas`
      : null;
    const ask = opts.vision || require('../../core/llm').deepseekVisionJson;
    const res = await ask([{ text: VISION_PROMPT(spec, slide && slide.title) }, { image: { mime: 'image/png', data: png.toString('base64') } }],
      { label: 'visual:check', maxTokens: 600, detail: 'high' });
    const score = res && res.score != null ? Number(res.score) : NaN;
    const issues = (res && Array.isArray(res.issues) ? res.issues : []).map((x) => String(x).slice(0, 160)).slice(0, 6);
    if (small) return { score: Number.isFinite(score) ? Math.min(score, 4) : 4, issues: [small, ...issues].slice(0, 6) };
    if (!Number.isFinite(score)) return null;
    return { score, issues };
  } catch (e) {
    console.warn('[Visual] vision check unavailable: ' + e.message);
    return null;
  }
}

// ═══════════════════════════════ One visual ═══════════════════════════════

async function runProvider(p, slide, palette, cfg, fetchImpl, critique, opts = {}) {
  const started = Date.now();
  const r = { provider: p.name, ok: false, reason: '', inTok: 0, outTok: 0, costTg: 0, ms: 0, warnings: [] };
  try {
    const { system, user } = buildPrompt(slide, palette, critique);
    const resp = await callProvider(p, system, user, cfg, fetchImpl);
    r.inTok = resp.inTok;
    r.outTok = resp.outTok;
    r.costTg = costTg(p, resp.inTok, resp.outTok, cfg);
    noteSuccess();
    if (resp.stop === 'refusal') { r.reason = 'model refused'; return r; }
    if (resp.stop === 'length') { r.reason = `truncated at max_tokens (${p.maxTokens})`; return r; }
    const clean = sanitizeSvg(resp.text);
    if (!clean) { r.reason = 'no valid SVG in response'; return r; }
    const q = inspectSvg(clean.svg, clean.vbW, clean.vbH);
    r.warnings = q.warnings;
    if (q.severe) { r.reason = q.placeholders ? `${q.placeholders} empty label(s)` : `text overflow ~${Math.round(q.overflowPx)}px`; return r; }
    if (cfg.visionCheck) {
      const v = await visionCheck(clean.svg, slide.visual, slide, palette, opts);
      if (v) {
        r.score = v.score;
        if (v.score < cfg.minScore) { r.reason = `vision score ${v.score}: ${v.issues.join('; ') || 'weak'}`; r.issues = v.issues; return r; }
      }
    }
    r.ok = true;
    r.svg = clean.svg;
    r.dataUri = toDataUri(clean.svg);
    return r;
  } catch (e) {
    r.reason = e.message || String(e);
    if (p.name === 'deepseek' && [400, 404].includes(e.status) && /model/i.test(r.reason)) {
      if (!proMissing) console.warn(`[Visual] ${p.model} қолжетімсіз (${r.reason.slice(0, 120)}) — Flash-пен жалғасамыз`);
      proMissing = true;
    } else noteFailure(e);
    return r;
  } finally {
    r.ms = Date.now() - started;
  }
}

// ═══════════════════════════════ Deck-level ═══════════════════════════════

/**
 * slides ішінде visual белгісі бар слайдтарға SVG сызады (ең көбі cfg.maxPerDeck, бюджет шегінде).
 * Мутация жасайды: сәтті → slide.visualSvg; сәтсіз/шектен тыс → slide.visual өшіріледі.
 * Ешқашан лақтырмайды. Есеп (stats) қайтарады.
 */
async function attachVisuals(slides, opts = {}) {
  const env = opts.env || process.env;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  let cfg = opts.config || getConfig(env);
  if (proMissing && cfg.primaryName === 'deepseek' && cfg.fallback) cfg = { ...cfg, primary: cfg.fallback, fallback: null };
  const stats = { requested: 0, attempted: 0, ok: 0, failed: 0, costTg: 0, provider: cfg.primary ? cfg.primary.name : cfg.primaryName, results: [] };

  try {
    prepareVisuals(slides);
    const cand = slides.map((s, i) => ({ s, i })).filter((x) => x.s && x.s.visual);
    stats.requested = cand.length;
    if (!cand.length) return stats;

    const dropAll = (why) => {
      cand.forEach(({ s }) => { delete s.visual; });
      console.log(`[Visual] өткізілді: ${why}`);
      return stats;
    };
    if (!cfg.enabled) return dropAll('VISUAL_ENABLED=0');
    if (!cfg.primary) return dropAll(`белгісіз провайдер "${cfg.primaryName}"`);
    if (!cfg.primary.apiKey) return dropAll(`${cfg.primary.name} API кілті жоқ`);
    if (typeof fetchImpl !== 'function') return dropAll('fetch қолжетімсіз (Node 18+ керек)');
    if (Date.now() < breaker.openUntil) return dropAll('circuit breaker ашық');

    const slots = allowedSlots(cfg);
    const eligible = cand.filter(({ s }) => cfg.mapsEnabled || s.visual.type !== 'map');
    const chosen = eligible.slice(0, slots);
    cand.filter((c) => !chosen.includes(c)).forEach(({ s }) => { delete s.visual; });

    // Дек бюджеті: in-flight сұраныстардың ең жаман шығыны резервтеледі
    const budget = { spent: 0, reserved: 0 };
    const fbUsable = cfg.fallback && cfg.fallback.apiKey;

    await Promise.all(chosen.map(async ({ s, i }) => {
      const vtype = s.visual.type;
      const palette = slideSvgPaletteSafe(s);
      const worst = worstCaseTg(cfg.primary, cfg);
      budget.reserved += worst;
      let r = await runProvider(cfg.primary, s, palette, cfg, fetchImpl, null, opts);
      budget.reserved -= worst;
      budget.spent += r.costTg;
      stats.attempted++;
      const attempts = [r];

      // көретін модель қабылдамаса — оның ескертулерімен сол модель бір рет қайта салады
      if (!r.ok && r.issues && r.issues.length && budget.spent + budget.reserved + worst <= cfg.budgetTg) {
        budget.reserved += worst;
        const again = await runProvider(cfg.primary, s, palette, cfg, fetchImpl, r.issues, opts);
        budget.reserved -= worst;
        budget.spent += again.costTg;
        attempts.push(again);
        r = again;
      }

      if (!r.ok && fbUsable) {
        const fw = worstCaseTg(cfg.fallback, cfg);
        if (budget.spent + budget.reserved + fw <= cfg.budgetTg) {
          budget.reserved += fw;
          const r2 = await runProvider(cfg.fallback, s, palette, cfg, fetchImpl, r.issues || null, opts);
          budget.reserved -= fw;
          budget.spent += r2.costTg;
          attempts.push(r2);
          r = r2;
        } else {
          console.log(`[Visual] слайд ${i + 1}: fallback өткізілді (бюджет ${cfg.budgetTg} тг)`);
        }
      }

      const cost = attempts.reduce((a, x) => a + x.costTg, 0);
      if (r.ok) {
        s.visualSvg = r.dataUri;
        stats.ok++;
      } else {
        delete s.visual;
        stats.failed++;
      }
      stats.results.push({
        slide: i + 1, ok: r.ok, provider: r.provider, reason: r.reason || undefined,
        inTok: attempts.reduce((a, x) => a + x.inTok, 0),
        outTok: attempts.reduce((a, x) => a + x.outTok, 0),
        costTg: Math.round(cost * 10) / 10, ms: attempts.reduce((a, x) => a + x.ms, 0),
        warnings: r.warnings && r.warnings.length ? r.warnings : undefined,
      });
      console.log(
        `[Visual] слайд ${i + 1} (${vtype}) ${r.ok ? '✅' : '❌ ' + r.reason} ` +
        `${r.provider}: ${attempts.reduce((a, x) => a + x.inTok, 0)}→${attempts.reduce((a, x) => a + x.outTok, 0)} tok, ` +
        `~${cost.toFixed(1)} тг, ${((attempts.reduce((a, x) => a + x.ms, 0)) / 1000).toFixed(1)}с` +
        (r.warnings && r.warnings.length ? ` ⚠ ${r.warnings.join('; ')}` : '')
      );
    }));

    stats.costTg = Math.round(budget.spent * 10) / 10;
    console.log(`[Visual] жиыны: ${stats.ok}/${stats.attempted} сәтті, ~${stats.costTg} тг`);
  } catch (err) {
    // Мұнда ешнәрсе лақтырылмауы керек, бірақ визуал ешқашан пайплайнды құлатпасын
    console.warn(`[Visual] күтпеген қате: ${err.message}`);
    (slides || []).forEach((s) => { if (s && !s.visualSvg) delete s.visual; });
  }
  return stats;
}

/** Бір слайдқа бір провайдермен сызып көру (салыстыру скрипті үшін). Ешқашан лақтырмайды. */
async function drawOnce(slide, providerName, opts = {}) {
  const env = opts.env || process.env;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const cfg = opts.config || getConfig(env);
  const p = providerConfig(String(providerName).toLowerCase(), env);
  if (!p) return { ok: false, provider: providerName, reason: 'белгісіз провайдер', costTg: 0, inTok: 0, outTok: 0, ms: 0, warnings: [] };
  if (!p.apiKey) return { ok: false, provider: p.name, reason: `${p.name} API кілті жоқ`, costTg: 0, inTok: 0, outTok: 0, ms: 0, warnings: [] };
  const spec = normalizeVisualSpec(slide.visual);
  if (!spec) return { ok: false, provider: p.name, reason: 'жарамсыз visual spec', costTg: 0, inTok: 0, outTok: 0, ms: 0, warnings: [] };
  return runProvider(p, { ...slide, visual: spec }, slideSvgPaletteSafe(slide), cfg, fetchImpl, null, opts);
}

function slideSvgPaletteSafe(slide) {
  try { return slideSvgPalette(slide); } catch { return slideSvgPalette({}); }
}

module.exports = {
  attachVisuals, drawOnce, prepareVisuals, normalizeVisualSpec, sanitizeSvg, inspectSvg, buildPrompt, systemFor, visionCheck,
  getConfig, providerConfig, costTg, worstCaseTg, allowedSlots, _resetBreaker, _resetProMissing,
};
