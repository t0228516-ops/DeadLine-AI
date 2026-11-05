'use strict';
/**
 * «ТАБИҒАТ» (terra) композициялары — Canva «Climate Change & Protecting Our Environment» шаблонының ӨЛШЕНГЕН торы (1920×1080):
 *   • қою фон #08352E, тақырып ақ жуан 124–144 px (мұқабада 134 px, 4 жол), сол жиек 70–110 px;
 *   • мәтін 33–40 px; кілт сөздер мен ішкі тақырыптар — екпін көгілдір #5AAFD2;
 *   • фото оң жақта (x≈1060-тан), сол жиегі толқын; мұқабада — толық фото, сол жағы фонмен қосылады;
 *   • сандар: екпін тік сызық + ірі екпін сан (150 px), оң жағында түсініктеме (33 px) және қайнар (25 px);
 *   • карточкалар — жұқа ақшыл жиек, жоғарғы бөлігі фото/белгіше.
 * Шаблонның файлдары қолданылмайды (тек тор, өлшем, түс қатынасы).
 */
module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, MB, W, HH } = K;
  const SYS = ['terra'];
  const D = require('../decor');
  const LX = 90;
  const plate = '<div class="plate"></div>';
  const head = (ctx, w, lines = 2, scale = [124, 108, 96, 84, 74, 64]) => H.titleH1(ctx, ctx.a.title, { width: w, maxLines: lines, scale, hl: true });
  const body = (txt, size = 36, extra = '') => '<div style="' + fs(size) + ';line-height:1.5;color:var(--text)' + extra + '">' + esc(txt) + '</div>';
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);
  const icon = (ctx, txt, used) => D.pickIconDecor(ctx.deckTitle + ' ' + txt, used || new Set(), 1)[0];
  const twoLines = (txt, w, size = 110) => String(txt || '').length * size * 0.66 > w;
  const line = 'rgba(255,255,255,.22)';
  /** оң жақтағы фото, сол жиегі толқын. x0 — толқынның ең сол нүктесі */
  const wavePhoto = (ctx, x0, o = {}) => {
    const a = ctx.a; const p = ctx.palette; const w = W - x0;
    const clip = "clip-path:path('M 120 0 C -40 260, 200 520, 40 760 C -30 880, 60 1000, 90 1080 L " + w + ' 1080 L ' + w + " 0 Z')";
    if (hasP(a, Math.min(w, 800))) return P.div(P.pos(x0, 0, w, HH) + ';overflow:hidden;' + clip, I.imgTag(a.photo, a.img, p, { focus: a.focus }));
    const ic = icon(ctx, a.title + ' ' + (a.subtitle || ''));
    return P.div(P.pos(x0, 0, w, HH) + ';' + clip + ';background:' + P.mix(p.bg, p.accent, 0.18)) +
      (ic ? P.div(P.pos(x0 + w / 2 - 150, HH / 2 - 150, 300, 300), '<img alt="" src="' + D.iconUri(ic.name, p.accent, 1) + '" style="width:100%;height:100%;opacity:.9">') : '');
  };
  const brand = (ctx, y = 60) => {
    const lab = H.sectionLabel(ctx);
    return lab ? t('kicker', LX, y, 900, '<div class="tr-acc" style="' + fs(24) + ';font-weight:700;letter-spacing:.08em;text-transform:uppercase">' + esc(String(lab).slice(0, 60)) + '</div>') : '';
  };

  // ── МҰҚАБА: толық фото, сол жағы фонмен қосылады; сол жақта ақ ірі тақырып, астында екпін сипаттама ──
  def({
    id: 'tr-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const tw = 900;
      const { metaHtml } = H.coverParts(ctx);
      let bg = plate;
      if (hasP(a, 1200)) bg += P.div(P.pos(0, 0, W, HH) + ';overflow:hidden', I.imgTag(a.photo, a.img, p, { focus: a.focus }));
      else bg += wavePhoto(ctx, 980);
      bg += P.div(P.pos(0, 0, W, HH) + ';background:linear-gradient(90deg,' + p.bg + ' 0%,' + p.bg + ' 30%,' + P.mix(p.bg, '#000000', 0) + 'cc 48%,transparent 72%)');
      const fg = wrap(LX, 180, tw, H.titleH1(ctx, a.title, { role: 'display', width: tw, maxLines: 4, scale: [134, 118, 104, 92, 80, 70], hl: true }) +
          (a.subtitle ? '<div style="margin-top:40px;' + fs(40) + ';line-height:1.35" class="tr-acc">' + esc(a.subtitle) + '</div>' : '')) +
        brand(ctx) + '<div style="position:absolute;left:' + LX + 'px;bottom:' + MB + 'px;width:820px">' + metaHtml + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover tr-slide' };
    },
  });

  // ── ТҰЖЫРЫМ («The Problem»): тақырып, екпін түсті абзац, оң жақта толқынды фото ──
  def({
    id: 'tr-intro', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length >= 20 && sh.text.length <= 460,
    render(ctx, sh) {
      const size = sh.text.length <= 200 ? 42 : sh.text.length <= 330 ? 36 : 31;
      const bg = plate + wavePhoto(ctx, 1080);
      const fg = brand(ctx) + wrap(LX, 110, 920, head(ctx, 920, 3) + '<div data-role="text" style="margin-top:56px">' + body(sh.text, size) + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide tr-slide' };
    },
  });

  // ── ТІЗІМ / ФОТО + ТІЗІМ («Content» / «The Problem» тілі): тақырып, екпін тік сызық бойындағы қатарлар (екпін белгі + ақ мәтін), оң жақта фото ──
  const listRender = (ctx, sh) => {
    const p = ctx.palette; const n = sh.items.length; const size = n > 4 || sh.items.reduce((k, m) => k + m.label.length + (m.detail || '').length, 0) > 240 ? 31 : 38;
    const rows = sh.items.map((m) => '<div data-role="row" style="padding:12px 0">' +
      '<div style="' + fs(size + 2) + ';line-height:1.25;font-weight:700;color:' + p.accent + '">' + esc(m.label || '') + '</div>' +
      (m.detail ? '<div style="margin-top:4px;' + fs(size - 2) + ';line-height:1.45;color:var(--text)">' + esc(m.detail) + '</div>' : '') + '</div>').join('');
    const bg = plate + wavePhoto(ctx, 1120);
    const y = twoLines(ctx.a.title, 960) ? 400 : 290;
    const fg = brand(ctx) + wrap(LX, 100, 980, head(ctx, 980, 2)) +
      t('list', LX + 40, y, 940, '<div style="border-left:5px solid ' + p.accent + ';padding-left:40px">' + rows + '</div>', 'max-height:' + (HH - y - 50) + 'px');
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide tr-slide' };
  };
  def({ id: 'tr-list', kind: 'list', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5 && sh.items.reduce((k, m) => k + m.label.length + (m.detail || '').length, 0) <= 360, render: listRender });
  def({ id: 'tr-photolist', kind: 'photoList', systems: SYS, fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5 && sh.items.reduce((k, m) => k + m.label.length + (m.detail || '').length, 0) <= 360, render: listRender });

  // ── СЕБЕПТЕР («Main Causes»): тақырып, 2–4 жұқа жиекті карточка — жоғарғы бөлігі фото (бар болса, бір кең жолақ) не белгіше ──
  def({
    id: 'tr-cards', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => m.label.length <= 50 && (m.detail || '').length <= 150),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.items.length; const gap = 34; const x0 = 90; const w = (W - 2 * x0 - gap * (n - 1)) / n;
      const imgH = 250; const used = new Set(); const ph = hasP(a, 900);
      const longD = Math.max(...sh.items.map((m) => (m.detail || '').length)); const cardH = imgH + (longD <= 60 ? 260 : longD <= 110 ? 340 : 420);
      const top = Math.max(twoLines(a.title, 1700) ? 380 : 290, Math.round((HH - cardH) / 2 + 90));
      let bg = plate;
      if (ph) bg += P.div(P.pos(x0, top, W - 2 * x0, imgH) + ';overflow:hidden;border-radius:18px 18px 0 0', I.imgTag(a.photo, a.img, p, { focus: a.focus }));
      let fg = brand(ctx) + wrap(LX, 90, 1700, head(ctx, 1700, 2, [124, 108, 96, 84, 74]));
      sh.items.forEach((m, i) => {
        const x = x0 + i * (w + gap);
        if (ph && i) bg += P.panel(x - gap, top, gap, imgH, p.bg);
        bg += P.div(P.pos(x, top, w, cardH) + ';border:2px solid ' + line + ';border-radius:18px;box-sizing:border-box');
        if (!ph) {
          const ic = icon(ctx, m.label + ' ' + (m.detail || ''), used) || { name: 'leaf' }; used.add(ic.name);
          bg += P.div(P.pos(x + 2, top + 2, w - 4, imgH - 4) + ';border-radius:16px 16px 0 0;background:' + P.mix(p.bg, p.accent, 0.14)) +
            P.div(P.pos(x + w / 2 - 70, top + imgH / 2 - 70, 140, 140), '<img alt="" src="' + D.iconUri(ic.name, p.accent, 1.2) + '" style="width:100%;height:100%">');
        }
        fg += t('concept', x + 36, top + imgH + 34, w - 72, '<div style="' + fs(n > 3 ? 32 : 36) + ';line-height:1.25;font-weight:700;color:#fff">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:14px;' + fs(n > 3 ? 27 : 31) + ';line-height:1.45;color:rgba(255,255,255,.86)">' + esc(m.detail) + '</div>' : ''), 'max-height:' + (cardH - imgH - 60) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide tr-slide' };
    },
  });

  // ── ШЕШІМДЕР / КЕЗЕҢДЕР («Solutions»): екпін дөңгелек нөмірлер тік сызықпен, оң жақта үлкен дөңгелек фото ──
  const stepsRender = (ctx, sh) => {
    const a = ctx.a; const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 32 : 38;
    const top = twoLines(a.title, 900) ? 380 : 280; const rowH = (HH - 60 - top) / n; const cx = LX + 34;
    let bg = plate + P.panel(cx - 3, top + 34, 6, rowH * (n - 1), P.mix(p.bg, p.accent, 0.5));
    const R = 470; const ccx = 1450; const ccy = 560;
    if (hasP(a, 700)) bg += P.div(P.pos(ccx - R, ccy - R, 2 * R, 2 * R) + ';border-radius:50%;overflow:hidden', I.imgTag(a.photo, a.img, p, { focus: a.focus }));
    else { const ic = icon(ctx, a.title); bg += P.div(P.pos(ccx - R, ccy - R, 2 * R, 2 * R) + ';border-radius:50%;background:' + P.mix(p.bg, p.accent, 0.16)) + (ic ? P.div(P.pos(ccx - 160, ccy - 160, 320, 320), '<img alt="" src="' + D.iconUri(ic.name, p.accent, 1) + '" style="width:100%;height:100%">') : ''); }
    let fg = brand(ctx) + wrap(LX, 90, 900, head(ctx, 900, 2));
    sh.items.forEach((m, i) => {
      const y = top + i * rowH; const mark = m.date || String(i + 1);
      const ms = Math.min(34, Math.floor(120 / (String(mark).length * 0.62)));
      bg += P.div(P.pos(cx - 34, y, m.date ? Math.max(68, String(mark).length * ms * 0.7 + 30) : 68, 68) + ';border-radius:34px;background:' + p.accent);
      fg += t('row', cx - 34, y + 34 - ms * 0.62, m.date ? Math.max(68, String(mark).length * ms * 0.7 + 30) : 68, '<div style="text-align:center;font-family:var(--f-display);' + fs(ms) + ';line-height:1.2;color:' + p.bg + ';white-space:nowrap">' + esc(mark) + '</div>');
      const tx = m.date ? cx + Math.max(68, String(mark).length * ms * 0.7 + 30) : cx + 70;
      fg += t('row', tx, y + 6, 880 - (tx - LX), '<div style="' + fs(size) + ';line-height:1.25;font-weight:700;color:#fff">' + esc(m.label || '') + '</div>' +
        (m.detail ? '<div style="margin-top:6px;' + fs(size - 6) + ';line-height:1.45;color:rgba(255,255,255,.85)">' + esc(m.detail) + '</div>' : ''), 'max-height:' + (rowH - 8) + 'px');
    });
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide tr-slide' };
  };
  def({ id: 'tr-steps', kind: 'process', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5, render: stepsRender });
  def({ id: 'tr-timeline', kind: 'timeline', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5 && sh.items.every((m) => String(m.date || '').length <= 9), render: stepsRender });

  // ── САНДАР («Key Figures»): екпін тік сызық + ірі екпін сан, оң жағында түсініктеме; оң жақта толқынды фото ──
  def({
    id: 'tr-stats', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 3 && sh.stats.every((s) => String(s.value).length <= 9 && String(s.label || '').length <= 90),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.stats.length;
      const top = (twoLines(a.title, 1100) ? 400 : 280) + (a.subtitle ? 50 : 0); const rowH = (HH - 50 - top) / n;
      const longest = Math.max(...sh.stats.map((s) => String(s.value).length));
      const size = Math.min(150, Math.floor(420 / (longest * 0.7)), Math.floor(rowH * 0.7));
      let bg = plate + wavePhoto(ctx, 1240);
      let fg = brand(ctx) + wrap(LX, 90, 1100, head(ctx, 1100, 2, [124, 108, 96, 84]) + (a.subtitle ? '<div style="margin-top:14px;' + fs(30) + '" class="tr-acc">' + esc(a.subtitle) + '</div>' : ''));
      sh.stats.forEach((s, i) => {
        const y = top + i * rowH;
        bg += P.panel(LX + 30, y + 10, 7, rowH - 40, p.accent);
        fg += t('stat', LX + 70, y + 8, 440, '<div style="font-family:var(--f-display);' + fs(size) + ';line-height:1;letter-spacing:-.02em;color:' + p.accent + ';white-space:nowrap">' + esc(s.value) + '</div>');
        fg += t('stat', 640, y + 14, 560, body(s.label || '', 34, ';line-height:1.35'), 'max-height:' + (rowH - 30) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide tr-slide' };
    },
  });

  // ── САЛЫСТЫРУ («Past vs Future»): екі баған, екпін бас әріпті тақырыптар, ортасында тік сызық ──
  def({
    id: 'tr-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 5 && sh.right.rows.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const x0 = 110; const gap = 120; const w = (W - 2 * x0 - gap) / 2; const top = twoLines(ctx.a.title, 1700) ? 400 : 300;
      const n = Math.max(sh.left.rows.length, sh.right.rows.length); const size = n > 4 ? 32 : 38;
      const bg = plate + P.panel(x0 + w + gap / 2 - 2, top, 4, HH - top - 80, line);
      const col = (c, accent) => '<div style="' + fs(46) + ';line-height:1.2;font-weight:700;color:' + accent + '">' + esc(c.head) + '</div><div style="height:22px"></div>' +
        c.rows.map((r) => '<div data-role="row" style="padding:10px 0 10px 28px;border-left:5px solid ' + accent + ';margin:10px 0;' + fs(size) + ';line-height:1.4;color:var(--text)">' + esc(r) + '</div>').join('');
      const fg = brand(ctx) + wrap(LX, 90, 1700, head(ctx, 1700, 2)) + t('side', x0, top, w, col(sh.left, p.accent)) + t('side', x0 + w + gap, top, w, col(sh.right, p.accent2));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide tr-slide' };
    },
  });

  // ── БӨЛІМ: толық фото, сол жағы фонмен қосылады; ірі екпін нөмір + ақ тақырып ──
  def({
    id: 'tr-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const num = String((ctx.plan && ctx.plan.section) || a.index).padStart(2, '0');
      let bg = plate + (hasP(a, 1200) ? P.div(P.pos(0, 0, W, HH) + ';overflow:hidden', I.imgTag(a.photo, a.img, p, { focus: a.focus })) : wavePhoto(ctx, 1100));
      bg += P.div(P.pos(0, 0, W, HH) + ';background:linear-gradient(90deg,' + p.bg + ' 0%,' + p.bg + ' 34%,' + p.bg + 'aa 55%,transparent 80%)');
      const fg = wrap(LX, 280, 960, '<div style="font-family:var(--f-display);font-size:180px;line-height:1;color:' + p.accent + '">' + esc(num) + '</div><div style="height:24px"></div>' +
        H.titleH1(ctx, a.title, { role: 'display', width: 920, maxLines: 3, scale: [124, 108, 96, 84, 72], hl: false }) + (a.subtitle ? '<div style="margin-top:26px;' + fs(38) + '" class="tr-acc">' + esc(a.subtitle) + '</div>' : ''));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide tr-slide' };
    },
  });

  // ── ДӘЙЕКСӨЗ: екпін тырнақша, ақ ірі жуан мәтін (соңғы сөздер — екпін), «— автор»; оң жақта толқынды фото ──
  def({
    id: 'tr-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 220,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = plate + wavePhoto(ctx, 1180) + P.div(P.pos(LX + 10, 170, 160, 160) + ';font-family:var(--f-display);font-size:220px;line-height:1;color:' + p.accent, '“');
      const fg = t('title', LX + 10, 360, 1050, '<div style="font-family:var(--f-display);' + fs(text.length <= 90 ? 72 : text.length <= 150 ? 58 : 46) + ';line-height:1.18;letter-spacing:-.01em;color:#fff">' + esc(text) + '</div>') +
        (who ? t('lead', LX + 10, 880, 900, '<div style="' + fs(32) + ';color:rgba(255,255,255,.85)">— ' + esc(who) + '</div>') : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide tr-slide' };
    },
  });

  // ── ҚОРЫТЫНДЫ («Conclusion»): екпін нөмірлі, сызықпен бөлінген түйіндер; соңғысы — жиекті қорапта екпін мәтін; оң жақта фото ──
  def({
    id: 'tr-closing', kind: 'closing', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 32 : 36;
      const rows = sh.items.map((m, i) => {
        const last = i === n - 1 && n >= 3;
        const txt = esc(m.label) + (m.detail ? ' <span style="opacity:.8">' + esc(m.detail) + '</span>' : '');
        return last ? '<div data-role="row" style="margin-top:22px;padding:22px 30px;border:2px solid ' + line + ';border-left:6px solid ' + p.accent + ';' + fs(size + 2) + ';line-height:1.3;font-weight:700;color:' + p.accent + '">' + txt + '</div>'
          : '<div data-role="row" style="display:flex;gap:26px;align-items:baseline;padding:14px 0;border-bottom:2px solid ' + line + '"><span style="flex:none;font-family:var(--f-display);' + fs(size) + ';color:' + p.accent + '">' + String(i + 1).padStart(2, '0') + '</span><div style="' + fs(size) + ';line-height:1.35;color:var(--text)">' + txt + '</div></div>';
      }).join('');
      const bg = plate + wavePhoto(ctx, 1130);
      const fg = brand(ctx) + wrap(LX, 90, 960, head(ctx, 960, 2) + '<div data-role="list" style="margin-top:40px">' + rows + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide tr-slide' };
    },
  });
};
