'use strict';
/**
 * «ТАЗА» (vital) композициялары — Canva «Preventing Heart Disease» шаблонының ӨЛШЕНГЕН торы (1920×1080):
 *   • Inter Bold тақырып 102–140 px (қою көк #12355B), астында 170×7 екпін сызығы (тақырыптан ~30 px төмен);
 *   • Open Sans мәтін 32–42 px, сол жиек ~110 px;
 *   • фото — оң жақта, сол жиегі қиғаш; оның алдында ашық сұр-көк қиғаш жолақ, төменгі оң бұрышта екпін-үшбұрыш;
 *   • карточкалар — ашық көк #EEF2F9, тігісінде екпін түсті дөңгелек белгіше; қадамдар — екпін түсті «01» + тік сызық;
 *   • сандар — екпін түсті 150–165 px, оң жағында түсініктеме, арасында жіңішке сызық;
 *   • салыстыру — көкшіл және қызғылт екі алаң, тақырыптары қою көк / екпін түсті.
 * Шаблонның файлдары қолданылмайды (тек тор, өлшем, түс қатынасы).
 */
module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, MX, MT, MB, W, HH } = K;
  const SYS = ['vital'];
  const D = require('../decor');
  const LX = 110;                                         // шаблонның сол жиегі
  const ice = (p) => P.mix('#ffffff', p.text, 0.075);     // карточка / сол алаң (#EEF2F9 шамасы)
  const blush = (p) => P.mix('#ffffff', p.accent, 0.11);  // оң алаң (қызғылт)
  const wedge = (p) => P.mix('#ffffff', p.text, 0.16);    // фото алдындағы қиғаш жолақ
  const plate = '<div class="plate"></div>';
  const bar = '<div class="vt-bar"></div>';
  const head = (ctx, w = 1100, lines = 2, scale = [106, 96, 86, 76, 66]) => H.titleH1(ctx, ctx.a.title, { width: w, maxLines: lines, scale, hl: false }) + bar;
  const body = (txt, size = 34, extra = '') => '<div style="' + fs(size) + ';line-height:1.5;color:var(--text)' + extra + '">' + esc(txt) + '</div>';
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);
  const label = (ctx, fallback) => H.sectionLabel(ctx) || fallback;
  // тақырып бір жолға сыя ма (Inter Bold ≈ 0.62 em, ~90 px) — астындағы блок соған қарай төмен түседі
  const twoLines = (txt, w, size = 90) => String(txt || '').length * size * 0.62 > w;
  const icon = (ctx, txt, used) => D.pickIconDecor(ctx.deckTitle + ' ' + txt, used || new Set(), 1)[0];

  /** Оң жақтағы қиғаш фото: x0 — төменгі сол бұрыш, жоғарғы сол бұрыш x0+slant; алдында жолақ, бұрышта үшбұрыш. */
  const diagPhoto = (ctx, x0, o = {}) => {
    const a = ctx.a; const p = ctx.palette; const slant = o.slant == null ? 230 : o.slant;
    const pw = W - x0;
    const clip = 'clip-path:polygon(' + slant + 'px 0,100% 0,100% 100%,0 100%)';
    let s = P.div(P.pos(x0 - 70, 0, pw + 70, HH) + ';background:' + wedge(p) + ';clip-path:polygon(' + slant + 'px 0,' + (slant + 70) + 'px 0,70px 100%,0 100%)');
    if (hasP(a, Math.min(pw, 900))) s += P.div(P.pos(x0, 0, pw, HH) + ';overflow:hidden;' + clip, I.imgTag(a.photo, a.img, p, { focus: a.focus }));
    else {
      const ic = icon(ctx, a.title + ' ' + (a.subtitle || ''));
      s += P.div(P.pos(x0, 0, pw, HH) + ';background:' + ice(p) + ';' + clip) +
        (ic ? P.div(P.pos(x0 + slant / 2 + pw / 2 - 190, HH / 2 - 160, 320, 320), '<img alt="" src="' + D.iconUri(ic.name, p.accent, 1) + '" style="width:100%;height:100%;opacity:.9">') : '');
    }
    if (o.tri !== false) s += P.div(P.pos(W - 285, HH - 790, 285, 790) + ';background:' + p.accent + ';clip-path:polygon(100% 0,100% 100%,0 100%)');
    return s;
  };
  const dot = (p, x, y, r = 23) => P.div(P.pos(x - r, y - r, 2 * r, 2 * r) + ';border-radius:50%;background:#fff;border:6px solid ' + p.accent + ';box-sizing:border-box');

  // ── МҰҚАБА (1-слайд): сол жақта екі жолды тақырып (екінші бөлігі екпін түсті), сызық, сипаттама; оң жақта қиғаш фото ──
  def({
    id: 'vt-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const tw = 860;
      const { metaHtml } = H.coverParts(ctx);
      const bg = plate + diagPhoto(ctx, 930, { slant: 250 });
      const fg = wrap(LX, 170, tw, H.titleH1(ctx, a.title, { role: 'display', width: tw, maxLines: 4, scale: [116, 104, 92, 82, 72, 64], hl: true }) + bar +
          H.lead(ctx, a.subtitle, 40, { maxw: 780 })) +
        '<div style="position:absolute;left:' + LX + 'px;bottom:' + MB + 'px;width:' + 800 + 'px">' + metaHtml + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover vt-slide' };
    },
  });

  // ── ТҰЖЫРЫМ (3-слайд «Why Heart Health Matters»): тақырып, сызық, абзац; оң жақта қиғаш фото ──
  def({
    id: 'vt-intro', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length >= 20 && sh.text.length <= 460,
    render(ctx, sh) {
      const bg = plate + diagPhoto(ctx, 1000);
      const size = sh.text.length <= 200 ? 40 : sh.text.length <= 320 ? 35 : 31;
      const fg = wrap(LX, 108, 860, head(ctx, 860, 3) + '<div data-role="text" style="margin-top:56px">' + body(sh.text, size) + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vt-slide' };
    },
  });

  // ── ТІЗІМ (2-слайд «Contents» тілі): тақырып, сызық, астында жіңішке сызықпен бөлінген қатарлар; оң жақта фото ──
  def({
    id: 'vt-list', kind: 'list', systems: SYS,
    fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 6,
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 30 : 34;
      const line = P.mix('#ffffff', p.text, 0.14);
      const rows = sh.items.map((m, i) => '<div data-role="row" style="display:flex;gap:28px;align-items:baseline;padding:14px 0;border-bottom:2px solid ' + line + '">' +
        '<span class="vt-acc" style="flex:none;font-family:var(--f-display);font-weight:700;' + fs(size + 4) + '">' + esc(H.num(ctx, i + 1)) + '</span>' +
        '<div><div style="' + fs(size) + ';line-height:1.3;font-weight:700;color:var(--text)">' + esc(m.label) + '</div>' +
        (m.detail ? '<div style="margin-top:4px;' + fs(size - 6) + ';line-height:1.45;color:var(--text2)">' + esc(m.detail) + '</div>' : '') + '</div></div>').join('');
      const bg = plate + diagPhoto(ctx, 1080);
      const fg = wrap(LX, 100, 900, head(ctx, 900, 2)) + t('list', LX, 330, 860, rows, 'max-height:' + (HH - 330 - MB) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vt-slide' };
    },
  });

  // ── КАРТОЧКАЛАР (4-слайд «Main Risk Factors»): 2–4 ашық көк карточка, тігісінде екпін-дөңгелек белгіше ──
  def({
    id: 'vt-cards', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => m.label.length <= 44 && (m.detail || '').length <= 150),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.items.length;
      const gap = 30; const x0 = 82; const span = W - 2 * x0; const w = (span - gap * (n - 1)) / n;
      const used = new Set();
      // карточканың төменгі бөлігі мәтінге қарай: қысқа түсініктемеде аласа, ұзынында биік
      const longD = Math.max(...sh.items.map((m) => (m.detail || '').length));
      const cardH = longD <= 50 ? 330 : longD <= 100 ? 420 : 500;
      const top = Math.round((HH - 300 - cardH) / 2 + 160); const seam = top + 200;
      const ph = hasP(a, 900);
      // жоғарғы бөлік: фото бар болса — бір кең фото, карточкалар арасы ақ саңылаумен бөлінеді; болмаса — екпіннің ашық реңкі
      let bg = plate + (ph ? P.div(P.pos(x0, top, span, seam - top) + ';overflow:hidden', I.imgTag(a.photo, a.img, p, { focus: a.focus })) : '');
      let fg = wrap(LX - 30, 70, 1500, head(ctx, 1500, 1, [100, 90, 80, 70, 62]));
      sh.items.forEach((m, i) => {
        const x = x0 + i * (w + gap);
        if (!ph) bg += P.panel(x, top, w, seam - top, P.mix('#ffffff', p.accent, 0.16));
        if (i) bg += P.panel(x - gap, top, gap, HH - top, '#ffffff');
        bg += P.panel(x, seam, w, cardH, ice(p));
        bg += P.panel(x, seam - 3, w, 7, p.accent);
        // белгіше табылмаса — жалпы «белгі» (бір карточкада сан, қалғанында сурет болып тұрмасын)
        const ic = icon(ctx, m.label + ' ' + (m.detail || ''), used) || { name: 'circle-check' }; used.add(ic.name);
        bg += P.div(P.pos(x + w / 2 - 74, seam - 74, 148, 148) + ';border-radius:50%;background:' + p.accent + ';border:8px solid #fff;box-sizing:border-box' +
          (ic ? '' : ';display:flex;align-items:center;justify-content:center;font-family:var(--f-display);font-weight:700;font-size:54px;color:#fff'), ic ? '' : esc(H.num(ctx, i + 1)));
        if (ic) bg += P.div(P.pos(x + w / 2 - 38, seam - 38, 76, 76), '<img alt="" src="' + D.iconUri(ic.name, '#ffffff', 1.4) + '" style="width:100%;height:100%">');
        fg += t('concept', x + 26, seam + 96, w - 52,
          '<div style="text-align:center;' + fs(n > 3 ? 36 : 40) + ';line-height:1.25;font-weight:700;color:var(--text)">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:18px;text-align:center;' + fs(n > 3 ? 31 : 34) + ';line-height:1.45;color:var(--text2)">' + esc(m.detail) + '</div>' : ''),
          'max-height:' + (cardH - 110) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vt-slide' };
    },
  });

  // ── ҚАДАМДАР / УАҚЫТ СЫЗЫҒЫ (5-слайд «Prevention Steps»): екпін «01», ақ дөңгелек белгі + тік сызық, оң жақта фото ──
  const stepsRender = (ctx, sh) => {
    const p = ctx.palette; const n = sh.items.length;
    const top = twoLines(ctx.a.title, 960) ? 400 : 300; const bottom = HH - 80; const rowH = (bottom - top) / n;
    const lineX = 268;
    let bg = plate + diagPhoto(ctx, 1150) + P.panel(lineX - 3, top + 30, 7, rowH * (n - 1), P.mix('#ffffff', p.text, 0.12));
    let fg = wrap(LX - 20, 92, 960, head(ctx, 960, 2, [100, 90, 80, 70, 62]));
    const big = n <= 4;
    sh.items.forEach((m, i) => {
      const y = top + i * rowH;
      bg += dot(p, lineX, y + 30);
      const marker = m.date || String(i + 1).padStart(2, '0');
      const mSize = m.date ? Math.min(60, Math.floor(150 / (String(m.date).length * 0.62))) : 74;
      fg += t('row', 80, y, 150, '<div class="vt-acc" style="font-family:var(--f-display);font-weight:700;' + fs(mSize) + ';line-height:.9;text-align:left">' + esc(marker) + '</div>');
      fg += t('row', 330, y - 4, 770, '<div style="' + fs(big ? 38 : 32) + ';line-height:1.25;font-weight:700;color:var(--text)">' + esc(m.label || '') + '</div>' +
        (m.detail ? '<div style="margin-top:6px;' + fs(big ? 32 : 27) + ';line-height:1.4;color:var(--text2)">' + esc(m.detail) + '</div>' : ''), 'max-height:' + (rowH - 8) + 'px');
    });
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vt-slide' };
  };
  def({ id: 'vt-steps', kind: 'process', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5, render: stepsRender });
  def({ id: 'vt-timeline', kind: 'timeline', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5 && sh.items.every((m) => String(m.date || '').length <= 9), render: stepsRender });

  // ── ФОТО + ТІЗІМ: тақырып, нөмірлі қатарлар (екпін «01»), оң жақта қиғаш фото ──
  def({
    id: 'vt-photolist', kind: 'photoList', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4,
    render: (ctx, sh) => stepsRender(ctx, sh),
  });

  // ── САНДАР (6-слайд «Key Statistics»): сол жақта екпін түсті ірі сандар, оң жағында түсініктеме, арасында сызық ──
  def({
    id: 'vt-stats', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 3 && sh.stats.every((s) => String(s.value).length <= 9 && String(s.label || '').length <= 90),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.stats.length;
      const top = 310; const rowH = (HH - 80 - top) / n; const colW = 960;
      const longest = Math.max(...sh.stats.map((s) => String(s.value).length));
      const size = Math.min(150, Math.floor(390 / (longest * 0.66)), Math.floor(rowH * 0.78));
      let bg = plate;
      // оң жақта — дөңгелек фото (шаблондағы ірі дөңгелек орнында), бар болмаса — ашық көк дөңгелек + белгіше
      const cx = 1500; const cy = 570; const r = 340;
      bg += P.div(P.pos(cx - r, cy - r, 2 * r, 2 * r) + ';border-radius:50%;background:' + ice(p));
      if (hasP(a, 600)) bg += P.div(P.pos(cx - r + 40, cy - r + 40, 2 * r - 80, 2 * r - 80) + ';border-radius:50%;overflow:hidden', I.imgTag(a.photo, a.img, p, { focus: a.focus }));
      else { const ic = icon(ctx, a.title); if (ic) bg += P.div(P.pos(cx - 170, cy - 170, 340, 340), '<img alt="" src="' + D.iconUri(ic.name, p.accent, 1) + '" style="width:100%;height:100%">'); }
      bg += P.div(P.pos(W - 346, HH - 1012, 346, 1012) + ';background:' + p.accent + ';clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.95');
      let fg = wrap(LX - 10, 96, 1100, head(ctx, 1100, 2, [110, 98, 86, 76, 66]) + (a.subtitle ? '<div style="margin-top:18px">' + body(a.subtitle, 28, ';color:var(--text2)') + '</div>' : ''));
      sh.stats.forEach((s, i) => {
        const y = top + i * rowH;
        if (i) bg += P.panel(LX, y - 6, colW - 40, 3, P.mix('#ffffff', p.text, 0.14));
        fg += t('stat', LX, y + 6, 410, '<div class="vt-acc" style="font-family:var(--f-display);font-weight:700;' + fs(size) + ';line-height:1;letter-spacing:-.02em;white-space:nowrap">' + esc(s.value) + '</div>');
        fg += t('stat', 560, y + 10, 480, body(s.label || '', 34, ';line-height:1.35'), 'max-height:' + (rowH - 20) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vt-slide' };
    },
  });

  // ── САЛЫСТЫРУ (7-слайд «Healthy vs Unhealthy»): көкшіл және қызғылт екі алаң; оң алаңның тақырыбы мен мәтіні екпін түсті ──
  def({
    id: 'vt-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 5 && sh.right.rows.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const x0 = 84; const gap = 52; const w = (W - 2 * x0 - gap) / 2; const top = 270;
      const n = Math.max(sh.left.rows.length, sh.right.rows.length); const size = n > 4 ? 34 : 40;
      const lines = (rows) => rows.reduce((k, r) => k + Math.max(1, Math.ceil(String(r).length * size * 0.56 / (w - 140))), 0);
      const ph = Math.min(HH - top - 50, 96 + 60 + Math.max(lines(sh.left.rows), lines(sh.right.rows)) * Math.round(size * 1.4) + n * 24 + 60);
      const bg = plate + P.panel(x0, top, w, ph, ice(p)) + P.panel(x0 + w + gap, top, w, ph, blush(p)) +
        P.panel(x0, top, w, 96, P.mix('#ffffff', p.text, 0.16)) + P.panel(x0 + w + gap, top, w, 96, P.mix('#ffffff', p.accent, 0.22));
      const col = (c, acc) => c.rows.map((r) => '<div data-role="row" style="display:flex;gap:18px;align-items:flex-start;padding:12px 0">' +
        '<span style="flex:none;width:14px;height:14px;margin-top:' + Math.round(size * 0.5) + 'px;border-radius:50%;background:' + (acc ? p.accent : p.text) + '"></span>' +
        '<div' + (acc ? ' class="vt-acc"' : '') + ' style="' + fs(size) + ';line-height:1.4;color:' + (acc ? p.accent : 'var(--text)') + '">' + esc(r) + '</div></div>').join('');
      const hd = (txt, acc) => '<div style="text-align:center;font-family:var(--f-display);font-weight:700;' + fs(42) + ';line-height:96px;white-space:nowrap;overflow:hidden;text-overflow:clip;color:' + (acc ? p.accent : 'var(--text)') + '">' + esc(txt) + '</div>';
      const fg = wrap(LX - 30, 80, 1600, head(ctx, 1600, 1, [100, 90, 80, 70, 62])) +
        t('side', x0 + 30, top, w - 60, hd(sh.left.head, false)) + t('side', x0 + w + gap + 30, top, w - 60, hd(sh.right.head, true)) +
        t('list', x0 + 50, top + 130, w - 100, col(sh.left, false), 'max-height:' + (HH - top - 200) + 'px') +
        t('list', x0 + w + gap + 50, top + 130, w - 100, col(sh.right, true), 'max-height:' + (HH - top - 200) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vt-slide' };
    },
  });

  // ── БӨЛІМ: ақ фон, сол жақта ірі екпін нөмірі мен тақырып, оң жақта қиғаш фото ──
  def({
    id: 'vt-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a;
      const num = String((ctx.plan && ctx.plan.section) || a.index).padStart(2, '0');
      const bg = plate + diagPhoto(ctx, 1080);
      const fg = wrap(LX, 230, 900, '<div class="vt-acc" style="font-family:var(--f-display);font-weight:700;font-size:200px;line-height:1;letter-spacing:-.03em">' + esc(num) + '</div>' +
        '<div style="height:30px"></div>' + H.titleH1(ctx, a.title, { role: 'display', width: 880, maxLines: 3, scale: [110, 96, 84, 74], hl: false }) + bar + H.lead(ctx, a.subtitle, 36, { maxw: 820 }));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vt-slide' };
    },
  });

  // ── ДӘЙЕКСӨЗ (8-слайд «Doctor's Quote»): тақырып, екпін тырнақшалар, дәйексөз, сызық, автор; оң жақта фото ──
  def({
    id: 'vt-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 220,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = plate + diagPhoto(ctx, 1100, { tri: true }) +
        P.div(P.pos(LX - 6, 250, 120, 120) + ';font-family:var(--f-display);font-weight:700;font-size:150px;line-height:1;color:' + p.accent, '“');
      const fg = t('title', LX + 10, 380, 860, '<div style="font-family:var(--f-display);font-weight:700;' + fs(text.length <= 90 ? 58 : text.length <= 150 ? 48 : 40) + ';line-height:1.25;color:var(--text)">' + esc(text) + '</div>') +
        (who ? t('lead', LX + 10, 820, 860, bar.replace('margin-top:30px', 'margin-top:0') + '<div style="margin-top:30px;font-family:var(--f-display);font-weight:700;' + fs(44) + ';line-height:1.2;color:var(--text)">' + esc(who) + '</div>') : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vt-slide' };
    },
  });

  // ── ҚОРЫТЫНДЫ (9-слайд «Conclusion»): тақырып, сызықпен бөлінген түйіндер, соңғысы екпін түсті; оң жақта фото ──
  def({
    id: 'vt-closing', kind: 'closing', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 32 : 38;
      const line = P.mix('#ffffff', p.text, 0.14);
      const rows = sh.items.map((m, i) => {
        const last = i === n - 1;
        return '<div data-role="row" style="padding:18px 0;' + (last ? '' : 'border-bottom:3px solid ' + line) + '">' +
          '<div' + (last ? ' class="vt-acc"' : '') + ' style="' + fs(last ? size + 4 : size) + ';line-height:1.3;font-weight:' + (last ? 700 : 400) + ';color:' + (last ? p.accent : 'var(--text)') + '">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:4px;' + fs(size - 8) + ';line-height:1.45;color:var(--text2)">' + esc(m.detail) + '</div>' : '') + '</div>';
      }).join('');
      const bg = plate + diagPhoto(ctx, 1000);
      const fg = wrap(LX, MT, 860, head(ctx, 860, 2, [116, 104, 92, 80, 70])) + t('list', LX, 340, 780, rows, 'max-height:' + (HH - 340 - MB) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vt-slide' };
    },
  });
};
