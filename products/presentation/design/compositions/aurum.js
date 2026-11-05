'use strict';
/**
 * «АЛТЫН» (aurum) композициялары — Canva «Law Firm / Northline Group» шаблонының ӨЛШЕНГЕН торы (1920×1080):
 *   • фон #100F0F, төменгі жолақ #1D1D1E (y≈810-нан), жоғарғы ортада «лого» жолы (алтын шаршы + ақ 40 px жазу, y≈108);
 *   • тақырып ортада, алтын курсив, 160 px (мұқабада 202 px, бірінші сөз алтын, қалғаны ақ);
 *   • мәтін Inter 27 px ақ (бізде 30–34 px), ішкі тақырыптар Inter Semi-Bold ақ;
 *   • фотолар тікбұрышты, төменгі жолақтың үстіне шығып тұрады; тақташалар — алтын / ақ, радиус ~18 px; пилюлялар — ақ / алтын.
 * Шаблонның файлдары қолданылмайды (тек тор, өлшем, түс қатынасы).
 */
module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, MB, W, HH } = K;
  const SYS = ['aurum'];
  const D = require('../decor');
  const BAND = 810;
  const plate = '<div class="plate"></div>';
  const band = (p) => P.mix(p.bg, '#ffffff', 0.065);   // палитра екінші түсті ағартады — жолақ түсі фоннан есептеледі
  const base = (p) => plate + P.panel(0, BAND, W, HH - BAND, band(p));
  const head = (ctx, w = 1500, lines = 1, scale = [150, 130, 112, 96, 84, 72]) => '<div style="text-align:center">' + H.titleH1(ctx, ctx.a.title, { width: w, maxLines: lines, scale, hl: false }) + '</div>';
  const body = (txt, size = 32, extra = '') => '<div style="' + fs(size) + ';line-height:1.6;color:#fff' + extra + '">' + esc(txt) + '</div>';
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);
  const icon = (ctx, txt, used) => D.pickIconDecor(ctx.deckTitle + ' ' + txt, used || new Set(), 1)[0];
  const photo = (ctx, x, y, w, h) => {
    const a = ctx.a; const p = ctx.palette;
    if (hasP(a, Math.min(w, 900))) return P.div(P.pos(x, y, w, h) + ';overflow:hidden', I.imgTag(a.photo, a.img, p, { focus: a.focus }));
    const ic = icon(ctx, a.title + ' ' + (a.subtitle || '')); const s = Math.min(w, h) * 0.45;
    return P.panel(x, y, w, h, '#232324') + (ic ? P.div(P.pos(x + w / 2 - s / 2, y + h / 2 - s / 2, s, s), '<img alt="" src="' + D.iconUri(ic.name, p.accent, 1) + '" style="width:100%;height:100%">') : '');
  };
  const logo = (ctx, y = 96) => {
    const lab = H.sectionLabel(ctx) || ctx.deckTitle;
    return t('kicker', 300, y, W - 600, '<div style="display:flex;justify-content:center;align-items:center;gap:14px;' + fs(30) + ';font-weight:600;color:#fff"><span style="flex:none;width:30px;height:30px;border-radius:5px;background:' + ctx.palette.accent + '"></span>' + esc(String(lab).slice(0, 50)) + '</div>');
  };
  const twoLines = (txt, w, size = 140) => String(txt || '').length * size * 0.45 > w;
  const top = (ctx) => (twoLines(ctx.a.title, 1500) ? 520 : 400);

  // ── МҰҚАБА: сол жақта қою тақта (лого, ірі курсив тақырып: бірінші сөз алтын, қалғаны ақ, сипаттама), оң жақта фото ──
  def({
    id: 'au-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const { metaHtml } = H.coverParts(ctx);
      const bg = plate + P.panel(0, BAND, W, HH - BAND, '#0b0b0b') + P.panel(110, 90, 860, 900, band(p)) + photo(ctx, 970, 90, 840, 900);
      const ws = String(a.title).split(/\s+/); const first = ws.shift(); const rest = ws.join(' ');
      const size = Math.max(60, Math.min(180, Math.floor(680 / (Math.max(first.length, ...rest.split(/\s+/).map((w) => w.length), 4) * 0.56))));
      const lab = H.sectionLabel(ctx);
      const fg = (lab ? t('kicker', 200, 150, 700, '<div style="display:flex;align-items:center;gap:14px;' + fs(28) + ';font-weight:600;color:#fff"><span style="width:28px;height:28px;border-radius:5px;background:' + p.accent + '"></span>' + esc(String(lab).slice(0, 40)) + '</div>') : '') +
        t('title', 200, 260, 700, '<h1 class="title t-display" style="--ts:' + size + 'px;font-size:' + size + 'px;line-height:1.02;margin:0"><span class="au-it au-acc">' + esc(first) + '</span>' + (rest ? '<br><span class="au-it" style="color:#fff">' + esc(rest) + '</span>' : '') + '</h1>' +
          (a.subtitle ? '<div style="margin-top:26px;' + fs(34) + ';line-height:1.3;font-weight:600;color:#fff">' + esc(a.subtitle) + '</div>' : ''), 'max-height:560px') +
        '<div style="position:absolute;left:200px;bottom:' + (MB + 60) + 'px;width:700px">' + metaHtml + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover au-slide' };
    },
  });

  // ── ТҰЖЫРЫМ («About Us»): лого, ортада тақырып; сол жақта мәтін, оң жақта фото (төменгі жолаққа шығып тұр) ──
  def({
    id: 'au-intro', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length >= 20 && sh.text.length <= 460,
    render(ctx, sh) {
      const p = ctx.palette; const y = top(ctx); const size = sh.text.length <= 220 ? 36 : sh.text.length <= 340 ? 32 : 29;
      const bg = base(p) + photo(ctx, 1000, y, 760, HH - y - 120);
      const fg = logo(ctx) + t('title', 160, 180, W - 320, head(ctx, W - 320, 2)) + t('text', 160, y, 760, body(sh.text, size), 'max-height:' + (HH - y - 80) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
    },
  });

  // ── ТІЗІМ («Why Choose Us?»): сол жақта фото, оң жақта ақ және алтын пилюлялар ──
  def({
    id: 'au-pills', kind: 'list', systems: SYS,
    fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5 && sh.items.every((m) => (m.label + (m.detail || '')).length <= 90),
    render(ctx, sh) {
      const p = ctx.palette; const y = top(ctx); const n = sh.items.length; const size = n > 4 ? 30 : 34;
      const bg = base(p) + photo(ctx, 160, y, 820, HH - y - 120);
      const rows = sh.items.map((m, i) => '<div data-role="row" style="margin:0 0 18px;padding:16px 30px;border-radius:14px;background:' + (i < Math.ceil(n / 2) ? '#fff' : p.accent) + ';color:' + (i < Math.ceil(n / 2) ? '#100f0f' : '#100f0f') + ';' + fs(size) + ';line-height:1.3;font-weight:600">' +
        esc(m.label) + (m.detail ? '<span style="font-weight:400"> — ' + esc(m.detail) + '</span>' : '') + '</div>').join('');
      const fg = logo(ctx) + t('title', 160, 180, W - 320, head(ctx, W - 320, 2)) + t('list', 1060, y, 700, rows, 'max-height:' + (HH - y - 60) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
    },
  });

  // ── ФОТО + ТІЗІМ («Specialized Services»): сол жақта кең фото, оң жақта алтын нүктелі қатарлар ──
  def({
    id: 'au-photolist', kind: 'photoList', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const y = top(ctx); const n = sh.items.length; const size = n > 4 ? 30 : 34;
      const bg = base(p) + photo(ctx, 160, y, 900, HH - y - 120);
      const rows = sh.items.map((m) => '<div data-role="row" style="display:flex;gap:18px;padding:10px 0"><span style="flex:none;width:12px;height:12px;margin-top:' + Math.round(size * 0.55) + 'px;border-radius:3px;background:' + p.accent + '"></span><div>' +
        '<div style="' + fs(size) + ';line-height:1.3;font-weight:600;color:#fff">' + esc(m.label || '') + '</div>' + (m.detail ? '<div style="margin-top:4px;' + fs(size - 5) + ';line-height:1.5;color:rgba(255,255,255,.8)">' + esc(m.detail) + '</div>' : '') + '</div></div>').join('');
      const fg = logo(ctx) + t('title', 160, 180, W - 320, head(ctx, W - 320, 2)) + t('list', 1120, y, 650, rows, 'max-height:' + (HH - y - 60) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
    },
  });

  // ── ҚҰНДЫЛЫҚТАР («Core Values»): 2–4 тақташа — алтын / ақ кезектесіп, ішінде белгіше; астында белгі мен түсініктеме ──
  def({
    id: 'au-values', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => m.label.length <= 40 && (m.detail || '').length <= 110),
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const span = 1500; const w = span / n; const tile = 200; const y = top(ctx); const used = new Set();
      let bg = base(p); let fg = logo(ctx) + t('title', 160, 180, W - 320, head(ctx, W - 320, 2));
      sh.items.forEach((m, i) => {
        const cx = (W - span) / 2 + w * i + w / 2; const gold = i % 3 === 0 || i % 3 === 2 && n === 4 ? i !== 2 : false;
        const fill = i % 2 ? '#ffffff' : p.accent;
        const ic = icon(ctx, m.label + ' ' + (m.detail || ''), used) || { name: 'circle-check' }; used.add(ic.name);
        bg += P.div(P.pos(cx - tile / 2, y, tile, tile) + ';border-radius:22px;background:' + fill) + P.div(P.pos(cx - 60, y + 40, 120, 120), '<img alt="" src="' + D.iconUri(ic.name, '#100f0f', 1.4) + '" style="width:100%;height:100%">');
        void gold;
        fg += t('concept', cx - w / 2 + 20, y + tile + 30, w - 40, '<div style="text-align:center"><div style="' + fs(n > 3 ? 32 : 36) + ';line-height:1.25;font-weight:600;color:#fff">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:10px;' + fs(n > 3 ? 26 : 29) + ';line-height:1.5;color:rgba(255,255,255,.78)">' + esc(m.detail) + '</div>' : '') + '</div>', 'max-height:' + (HH - y - tile - 60) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
    },
  });

  // ── ПРОЦЕСС / ХРОНОЛОГИЯ («Legal Process»): ортада алтын жолақ-сипаттама, астында екі бағандағы нөмірлі қадамдар ──
  const stepsRender = (ctx, sh) => {
    const a = ctx.a; const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 32 : 38; const y = top(ctx) + 30;
    const banner = a.subtitle || (sh.kind === 'timeline' ? 'Негізгі кезеңдер хронологиясы' : 'Кезең-кезеңімен');
    const half = Math.ceil(n / 2); const colW = 760;
    const step = (m, i) => '<div data-role="row" style="display:flex;gap:22px;align-items:flex-start;padding:12px 0"><span class="au-it au-acc" style="flex:none;min-width:70px;' + fs(m.date ? 52 : 62) + ';line-height:1">' + esc(m.date || String(i + 1).padStart(2, '0')) + '</span>' +
      '<div><div style="' + fs(size) + ';line-height:1.3;font-weight:600;color:#fff">' + esc(m.label || '') + '</div>' + (m.detail ? '<div style="margin-top:4px;' + fs(size - 5) + ';line-height:1.5;color:rgba(255,255,255,.8)">' + esc(m.detail) + '</div>' : '') + '</div></div>';
    const bg = base(p);
    const fg = logo(ctx) + t('title', 160, 180, W - 320, head(ctx, W - 320, 2)) +
      t('lead', W / 2 - 600, y - 30, 1200, '<div style="text-align:center"><span style="display:inline-block;padding:10px 34px;border-radius:8px;background:' + p.accent + ';color:#100f0f;' + fs(28) + ';font-weight:600">' + esc(String(banner).slice(0, 80)) + '</span></div>') +
      t('list', W / 2 - colW - 40, y + 60, colW, sh.items.slice(0, half).map((m, i) => step(m, i)).join(''), 'max-height:' + (HH - y - 100) + 'px') +
      t('list', W / 2 + 40, y + 60, colW, sh.items.slice(half).map((m, i) => step(m, i + half)).join(''), 'max-height:' + (HH - y - 100) + 'px');
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
  };
  def({ id: 'au-steps', kind: 'process', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 6, render: (c, s) => stepsRender(c, { ...s, kind: 'process' }) });
  def({ id: 'au-timeline', kind: 'timeline', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 6 && sh.items.every((m) => String(m.date || '').length <= 9), render: (c, s) => stepsRender(c, { ...s, kind: 'timeline' }) });

  // ── САНДАР: ортада тақырып, алтын курсив ірі сандар, астында ақ түсініктеме, төменгі жолақта ──
  def({
    id: 'au-stats', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 4 && sh.stats.every((s) => String(s.value).length <= 9 && String(s.label || '').length <= 70),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.stats.length; const span = 1600; const w = span / n; const y = top(ctx) + 20;
      const longest = Math.max(...sh.stats.map((s) => String(s.value).length)); const size = Math.min(170, Math.floor((w - 40) / (longest * 0.5)));
      let bg = base(p);
      let fg = logo(ctx) + t('title', 160, 180, W - 320, head(ctx, W - 320, 2) + (a.subtitle ? '<div style="text-align:center;margin-top:10px;' + fs(28) + ';color:rgba(255,255,255,.8)">' + esc(a.subtitle) + '</div>' : ''));
      sh.stats.forEach((s, i) => {
        const x = (W - span) / 2 + w * i;
        if (i) bg += P.panel(x, y + 20, 2, 360, 'rgba(255,255,255,.18)');
        fg += t('stat', x + 20, y, w - 40, '<div style="text-align:center"><span class="au-it au-acc" style="display:block;' + fs(size) + ';line-height:1;white-space:nowrap">' + esc(s.value) + '</span><div style="margin-top:30px;' + fs(32) + ';line-height:1.4;color:#fff">' + esc(s.label || '') + '</div></div>', 'max-height:' + (HH - y - 60) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
    },
  });

  // ── САЛЫСТЫРУ («Our Mission / Our Vision»): екі баған, ақ жартылай жуан ішкі тақырыптар, астында мәтін ──
  def({
    id: 'au-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 5 && sh.right.rows.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const y = top(ctx); const colW = 740; const n = Math.max(sh.left.rows.length, sh.right.rows.length); const size = n > 4 ? 30 : 33;
      const col = (c) => '<div style="text-align:center;' + fs(58) + ';line-height:1.1;font-weight:600;color:#fff">' + esc(c.head) + '</div><div style="width:90px;height:4px;margin:22px auto 18px;background:' + p.accent + '"></div>' +
        c.rows.map((r) => '<div data-role="row" style="padding:8px 0;' + fs(size) + ';line-height:1.5;color:#fff;text-align:center">' + esc(r) + '</div>').join('');
      const fg = logo(ctx) + t('title', 160, 170, W - 320, head(ctx, W - 320, 2, [130, 112, 96, 84, 72])) + t('side', W / 2 - colW - 60, y, colW, col(sh.left)) + t('side', W / 2 + 60, y, colW, col(sh.right));
      return { bg: base(p), fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
    },
  });

  // ── БӨЛІМ («Thank You» тілі): ортада алтын курсив нөмір мен тақырып, ақ сипаттама, төменде кең фото-жолақ ──
  def({
    id: 'au-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const num = String((ctx.plan && ctx.plan.section) || a.index).padStart(2, '0');
      const bg = base(p) + photo(ctx, 160, 660, W - 320, HH - 660 - 60);
      const fg = t('title', 160, 110, W - 320, '<div style="text-align:center"><span class="au-it" style="display:block;' + fs(90) + ';line-height:1;color:#fff">' + esc(num) + '</span>' +
        H.titleH1(ctx, a.title, { role: 'display', width: W - 320, maxLines: 2, scale: [150, 130, 112, 96], hl: false }) + (a.subtitle ? '<div style="margin-top:16px;' + fs(32) + ';font-weight:600;color:#fff">' + esc(a.subtitle) + '</div>' : '') + '</div>', 'max-height:520px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
    },
  });

  // ── ДӘЙЕКСӨЗ («Client Testimonials»): сол жақта фото, оң жақта ақ карточкада қара мәтін, астында алтын автор ──
  def({
    id: 'au-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 220,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = base(p) + photo(ctx, 160, 230, 700, 760) + P.div(P.pos(940, 300, 820, 470) + ';background:#fff;border-radius:16px');
      const fg = t('title', 1000, 340, 700, '<span class="au-it au-acc" style="display:block;' + fs(110) + ';line-height:.6">“</span><div style="margin-top:20px;' + fs(text.length <= 100 ? 46 : 38) + ';line-height:1.45;color:#100f0f">' + esc(text) + '</div>', 'max-height:400px') +
        (who ? t('lead', 940, 810, 820, '<div class="au-it au-acc" style="' + fs(54) + ';line-height:1.1">' + esc(who) + '</div>') : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
    },
  });

  // ── ҚОРЫТЫНДЫ («Get in Touch»): сол жақта курсив тақырып және ақ / алтын пилюлялар (белгішемен), оң жақта фото ──
  def({
    id: 'au-closing', kind: 'closing', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 28 : 32; const used = new Set(); const half = Math.ceil(n / 2);
      const rows = sh.items.map((m, i) => {
        const ic = icon(ctx, m.label + ' ' + (m.detail || ''), used) || { name: 'circle-check' }; used.add(ic.name);
        return '<div data-role="row" style="display:flex;gap:18px;align-items:center;margin:0 0 16px;padding:12px 24px 12px 14px;border-radius:12px;background:' + (i < half ? '#fff' : p.accent) + '">' +
          '<img alt="" src="' + D.iconUri(ic.name, '#100f0f', 1.6) + '" style="flex:none;width:40px;height:40px"><div style="' + fs(size) + ';line-height:1.3;font-weight:600;color:#100f0f">' + esc(m.label) + (m.detail ? '<span style="font-weight:400"> — ' + esc(m.detail) + '</span>' : '') + '</div></div>';
      }).join('');
      const bg = plate + P.panel(0, BAND, W, HH - BAND, band(p)) + photo(ctx, 1040, 120, 760, 840);
      const fg = wrap(160, 170, 820, H.titleH1(ctx, ctx.a.title, { width: 820, maxLines: 2, scale: [140, 120, 104, 90, 78], hl: false }) + '<div data-role="list" style="margin-top:40px">' + rows + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide au-slide' };
    },
  });
};
