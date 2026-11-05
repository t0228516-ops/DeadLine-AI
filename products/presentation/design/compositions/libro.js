'use strict';
/**
 * «КІТАП» (libro) композициялары — Canva «Silent Library» шаблонының ӨЛШЕНГЕН торы (1920×1080):
 *   • фон #E0E6D8, мәтін #3B2919; тақырып курсив сериф 149 px (жоларалық тығыз), мұқабада 274–311 px ашық түсті;
 *   • мәтін 28 px (бізде оқылу үшін 30–34 px), жіңішке; жанында жіңішке сызба белгіше (≈110 px);
 *   • үш фото торы: оң жақ толық биік баған (x≥1350) · төменгі толық ені жолақ (y≥560) · сол жақ шаршы (120..700);
 *   • оң жақ төменгі / жоғарғы бұрышта жіңішке «→».
 * Шаблонның файлдары қолданылмайды (тек тор, өлшем, түс қатынасы).
 */
module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, MB, W, HH } = K;
  const SYS = ['libro'];
  const D = require('../decor');
  const plate = '<div class="plate"></div>';
  const head = (ctx, w, lines = 2, scale = [140, 124, 110, 96, 84, 72], cls) => H.titleH1(ctx, ctx.a.title, { width: w, maxLines: lines, scale, hl: false, cls });
  const body = (txt, size = 32, extra = '') => '<div style="' + fs(size) + ';line-height:1.6;color:var(--text)' + extra + '">' + esc(txt) + '</div>';
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);
  const icon = (ctx, txt, used) => D.pickIconDecor(ctx.deckTitle + ' ' + txt, used || new Set(), 1)[0];
  const photo = (ctx, x, y, w, h) => {
    const a = ctx.a; const p = ctx.palette;
    if (hasP(a, Math.min(w, 900))) return P.div(P.pos(x, y, w, h) + ';overflow:hidden', I.imgTag(a.photo, a.img, p, { focus: a.focus }));
    const ic = icon(ctx, a.title + ' ' + (a.subtitle || '')); const s = Math.min(w, h) * 0.42;
    return P.panel(x, y, w, h, P.mix(p.bg, p.text, 0.08)) + (ic ? P.div(P.pos(x + w / 2 - s / 2, y + h / 2 - s / 2, s, s), '<img alt="" src="' + D.iconUri(ic.name, p.text, 0.9) + '" style="width:100%;height:100%;opacity:.75">') : '');
  };
  const sketch = (ctx, x, y, s = 110, txt) => { const ic = icon(ctx, txt || ctx.a.title); return ic ? P.div(P.pos(x, y, s, s), '<img alt="" src="' + D.iconUri(ic.name, ctx.palette.text, 0.9) + '" style="width:100%;height:100%">') : ''; };
  const arrow = (p, x, y, color) => P.div(P.pos(x, y, 60, 30), '<svg viewBox="0 0 60 30" width="60" height="30"><path d="M2 15H56M44 4L57 15L44 26" fill="none" stroke="' + (color || p.text) + '" stroke-width="2.4" stroke-linecap="round"/></svg>');
  const brand = (ctx, x = 150, y = 70) => { const lab = H.sectionLabel(ctx); return lab ? t('kicker', x, y, 900, '<div style="' + fs(22) + ';letter-spacing:.2em;text-transform:uppercase;color:var(--text)">' + esc(String(lab).slice(0, 60)) + '</div>') : ''; };
  const it = (txt, size, extra = '') => '<span class="lb-it" style="' + fs(size) + ';line-height:1;' + extra + '">' + esc(txt) + '</span>';
  const rowsHtml = (ctx, items, size) => items.map((m, i) => '<div data-role="row" style="display:flex;gap:26px;align-items:baseline;padding:14px 0;border-top:1.5px solid ' + P.mix(ctx.palette.bg, ctx.palette.text, 0.3) + '">' +
    '<span style="flex:none;min-width:60px">' + it(m.date || H.num(ctx, i + 1), m.date ? size + 4 : size + 10) + '</span><div><div style="' + fs(size) + ';line-height:1.35;font-weight:700;color:var(--text)">' + esc(m.label || '') + '</div>' +
    (m.detail ? '<div style="margin-top:4px;' + fs(size - 5) + ';line-height:1.5;color:var(--text2)">' + esc(m.detail) + '</div>' : '') + '</div></div>').join('');

  // ── МҰҚАБА: толық фото + қою жабын, ортада алып ашық курсив тақырып, жиекті «пилюля» сипаттама, «→» ──
  def({
    id: 'lb-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const { metaHtml } = H.coverParts(ctx);
      const bg = plate + photo(ctx, 0, 0, W, HH) + P.div(P.pos(0, 0, W, HH) + ';background:linear-gradient(180deg,rgba(20,12,6,.55),rgba(20,12,6,.72))') + arrow(p, W - 150, HH - 110, p.bg);
      const sub = String(a.subtitle || '');
      const fg = '<div class="lb-on" style="--text:' + p.bg + ';--text2:' + p.bg + 'cc;--text3:' + p.bg + 'aa;color:' + p.bg + '">' +
        t('title', 200, 130, W - 400, '<div style="text-align:center">' + H.titleH1(ctx, a.title, { role: 'display', width: W - 400, maxLines: 3, scale: [200, 170, 146, 124, 106, 92], hl: false }) +
          (sub ? '<div style="margin-top:44px"><span style="display:inline-block;padding:12px 44px;border:2px solid ' + p.bg + ';border-radius:40px;' + fs(30) + ';letter-spacing:.12em;text-transform:uppercase;line-height:1.35">' + esc(sub) + '</span></div>' : '') + '</div>') +
        '<div style="position:absolute;left:200px;bottom:' + MB + 'px;width:1100px">' + metaHtml + '</div></div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover lb-slide' };
    },
  });

  // ── ТҰЖЫРЫМ («The Timeless Charm»): сол жақ жоғарыда тақырып, астында белгіше + абзац; оң жақта толық биік фото-баған ──
  def({
    id: 'lb-intro', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length >= 20 && sh.text.length <= 460,
    render(ctx, sh) {
      const p = ctx.palette; const size = sh.text.length <= 220 ? 36 : sh.text.length <= 340 ? 32 : 29;
      const bg = plate + photo(ctx, 1380, 0, W - 1380, HH) + sketch(ctx, 150, 590, 120) + arrow(p, 1260, 70);
      const fg = brand(ctx) + wrap(150, 150, 1150, head(ctx, 1150, 2)) + t('text', 340, 560, 900, body(sh.text, size), 'max-height:' + (HH - 560 - 50) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide lb-slide' };
    },
  });

  // ── ТІЗІМ («Spaces for Discovery»): сол жақта шаршы фото, оң жақта оңға тураланған тақырып, астында курсив нөмірлі қатарлар ──
  def({
    id: 'lb-list', kind: 'list', systems: SYS,
    fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5 && sh.items.reduce((k, m) => k + m.label.length + (m.detail || '').length, 0) <= 340,
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 30 : 34;
      const bg = plate + photo(ctx, 120, 140, 600, 760) + arrow(p, W - 170, HH - 110);
      const fg = brand(ctx, 820) + t('title', 820, 120, W - 820 - 140, '<div style="text-align:right">' + head(ctx, W - 820 - 140, 2, [130, 116, 102, 90, 78]) + '</div>') +
        t('list', 820, 480, W - 820 - 140, rowsHtml(ctx, sh.items, size), 'max-height:' + (HH - 480 - 60) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide lb-slide' };
    },
  });

  // ── ФОТО + ТІЗІМ / ҚОРЫТЫНДЫ («A Home for Stories»): жоғарыда тақырып пен қатарлар, төменгі жартысы — толық ені фото ──
  const bandRender = (ctx, sh) => {
    const p = ctx.palette; const n = sh.items.length; const size = n > 3 ? 32 : 36;
    const band = n > 3 ? 660 : 600;
    const bg = plate + photo(ctx, 0, band, W, HH - band) + sketch(ctx, 1640, 300, 110) + arrow(p, W - 170, 70);
    const fg = brand(ctx) + wrap(150, 120, 720, head(ctx, 720, 3, [124, 108, 96, 84, 74])) +
      t('list', 900, 110, 740, sh.items.map((m) => '<div data-role="row" style="padding:8px 0;' + fs(size) + ';line-height:1.45;color:var(--text)"><b>' + esc(m.label) + '</b>' + (m.detail ? ' — ' + esc(m.detail) : '') + '</div>').join(''), 'max-height:' + (band - 140) + 'px');
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide lb-slide' };
  };
  def({ id: 'lb-photolist', kind: 'photoList', systems: SYS, fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5 && sh.items.every((m) => (m.label + (m.detail || '')).length <= 110), render: bandRender });
  def({ id: 'lb-closing', kind: 'closing', systems: SYS, fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5 && sh.items.every((m) => (m.label + (m.detail || '')).length <= 110), render: bandRender });

  // ── ҰҒЫМДАР: тақырып, астында 2–4 баған — жоғарғы жіңішке сызық, курсив нөмір, қалың белгі, мәтін ──
  def({
    id: 'lb-columns', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => m.label.length <= 50 && (m.detail || '').length <= 160),
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const gap = 60; const x0 = 150; const w = (W - 2 * x0 - gap * (n - 1)) / n; const y = 470;
      let bg = plate + sketch(ctx, W - 290, 130, 130) + arrow(p, W - 170, HH - 110);
      let fg = brand(ctx) + wrap(150, 130, 1400, head(ctx, 1400, 2));
      sh.items.forEach((m, i) => {
        const x = x0 + i * (w + gap);
        bg += P.panel(x, y, w, 2, p.text);
        fg += t('concept', x, y + 30, w, it(H.num(ctx, i + 1), 64) + '<div style="margin-top:18px;' + fs(n > 3 ? 35 : 38) + ';line-height:1.3;font-weight:700;color:var(--text)">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:12px;' + fs(n > 3 ? 30 : 33) + ';line-height:1.55;color:var(--text2)">' + esc(m.detail) + '</div>' : ''), 'max-height:' + (HH - y - 90) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide lb-slide' };
    },
  });

  // ── КЕЗЕҢДЕР / УАҚЫТ СЫЗЫҒЫ: сол жақта тақырып, оң жақта курсив нөмір/жылды қатарлар, оң жақ шетте фото-баған ──
  const stepsRender = (ctx, sh) => {
    const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 32 : 37;
    const bg = plate + photo(ctx, 1500, 0, W - 1500, HH) + arrow(p, 1380, HH - 110);
    const fg = brand(ctx) + wrap(150, 150, 560, head(ctx, 560, 4, [124, 108, 96, 84, 74])) + t('list', 760, 150, 660, rowsHtml(ctx, sh.items, size), 'max-height:' + (HH - 150 - 60) + 'px');
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide lb-slide' };
  };
  def({ id: 'lb-steps', kind: 'process', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5, render: stepsRender });
  def({ id: 'lb-timeline', kind: 'timeline', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5 && sh.items.every((m) => String(m.date || '').length <= 9), render: stepsRender });

  // ── САНДАР: алып курсив сандар (сызықпен бөлінген бағандар), астында түсініктеме ──
  def({
    id: 'lb-stats', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 4 && sh.stats.every((s) => String(s.value).length <= 9 && String(s.label || '').length <= 80),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.stats.length; const x0 = 150; const span = W - 2 * x0; const w = span / n;
      const longest = Math.max(...sh.stats.map((s) => String(s.value).length)); const size = Math.min(170, Math.floor((w - 50) / (longest * 0.5)));
      let bg = plate + arrow(p, W - 170, 70);
      let fg = brand(ctx) + wrap(150, 120, 1400, head(ctx, 1400, 2, [124, 108, 96, 84]) + (a.subtitle ? '<div style="margin-top:14px">' + body(a.subtitle, 30, ';color:var(--text2)') + '</div>' : ''));
      sh.stats.forEach((s, i) => {
        const x = x0 + w * i;
        if (i) bg += P.panel(x, 520, 2, 420, P.mix(p.bg, p.text, 0.35));
        fg += t('stat', x + 40, 520, w - 80, it(s.value, size, 'display:block;white-space:nowrap') + '<div style="margin-top:30px;' + fs(32) + ';line-height:1.45;color:var(--text)">' + esc(s.label || '') + '</div>', 'max-height:420px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide lb-slide' };
    },
  });

  // ── САЛЫСТЫРУ: екі баған, курсив тақырыптар, ортада жіңішке тік сызық ──
  def({
    id: 'lb-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 5 && sh.right.rows.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const x0 = 150; const gap = 120; const w = (W - 2 * x0 - gap) / 2; const top = String(ctx.a.title).length * 110 * 0.44 > 1500 ? 520 : 400;
      const n = Math.max(sh.left.rows.length, sh.right.rows.length); const size = n > 4 ? 30 : 34;
      const bg = plate + P.panel(x0 + w + gap / 2 - 1, top, 2, HH - top - 90, P.mix(p.bg, p.text, 0.35)) + arrow(p, W - 170, 70);
      const col = (c) => it(c.head, 66, 'display:block') + '<div style="height:20px"></div>' + c.rows.map((r) => '<div data-role="row" style="padding:12px 0;border-top:1.5px solid ' + P.mix(p.bg, p.text, 0.3) + ';' + fs(size) + ';line-height:1.45;color:var(--text)">' + esc(r) + '</div>').join('');
      const fg = brand(ctx) + wrap(150, 110, 1500, head(ctx, 1500, 2, [116, 100, 88, 78])) + t('side', x0, top, w, col(sh.left)) + t('side', x0 + w + gap, top, w, col(sh.right));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide lb-slide' };
    },
  });

  // ── БӨЛІМ: толық фото + жабын, ортада курсив нөмір мен тақырып ──
  def({
    id: 'lb-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']; const k = Number((ctx.plan && ctx.plan.section) || a.index) || 1; const num = ROMAN[k] || String(k);
      const bg = plate + photo(ctx, 0, 0, W, HH) + P.div(P.pos(0, 0, W, HH) + ';background:rgba(20,12,6,.62)');
      const fg = '<div class="lb-on" style="color:' + p.bg + '">' + t('title', 200, 260, W - 400, '<div style="text-align:center">' + it(num, 150, 'display:block;color:' + p.bg) + '<div style="height:20px"></div>' +
        H.titleH1(ctx, a.title, { role: 'display', width: W - 400, maxLines: 2, scale: [150, 130, 112, 96], hl: false }) + (a.subtitle ? '<div style="margin-top:26px;' + fs(30) + ';letter-spacing:.12em;text-transform:uppercase;color:' + p.bg + '">' + esc(a.subtitle) + '</div>' : '') + '</div>') + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide lb-slide' };
    },
  });

  // ── ДӘЙЕКСӨЗ: ортада алып курсив мәтін, астында бас әріпті автор; бұрышта белгіше ──
  def({
    id: 'lb-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 220,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = plate + sketch(ctx, W / 2 - 60, 120, 120, text) + arrow(p, W - 170, HH - 110);
      const fg = t('title', 240, 330, W - 480, '<div style="text-align:center">' + it('«' + text + '»', text.length <= 90 ? 84 : text.length <= 150 ? 68 : 54, 'line-height:1.18;display:block') + '</div>') +
        (who ? t('lead', 240, 860, W - 480, '<div style="text-align:center;' + fs(28) + ';letter-spacing:.2em;text-transform:uppercase;color:var(--text)">' + esc(who) + '</div>') : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide lb-slide' };
    },
  });
};
