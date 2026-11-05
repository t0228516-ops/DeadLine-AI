'use strict';
/**
 * «АЛҚАП» (meadow) композициялары — Canva «Landforms of the Earth» шаблонының ӨЛШЕНГЕН торы (1920×1080):
 *   • фон #E6F6FF, тақырып #3C2007 112 px (мұқабада 156 px, ортада), сол жиек 108 px, тақырып y≈180;
 *   • мәтін 37 px; пилюлялар — жасыл #007200, ақ 49 px жазу, 293×54, 4 бағанға;
 *   • фото дөңгелек бұрышты (≈24 px), не алып дөңгелек (кіріспеде);
 *   • төменгі ~300 px — пейзаж. Шаблонның суреті ЕМЕС: біздің өз SVG (қабатты төбелер, өзен, үшбұрыш ағаштар),
 *     түсі палитрадан, бұлттар — ақ.
 */
module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, W, HH } = K;
  const SYS = ['meadow'];
  const D = require('../decor');
  const LX = 108;
  const plate = '<div class="plate"></div>';
  const head = (ctx, w, lines = 2, scale = [112, 100, 88, 78, 68, 60]) => H.titleH1(ctx, ctx.a.title, { width: w, maxLines: lines, scale, hl: false });
  const body = (txt, size = 34, extra = '') => '<div style="' + fs(size) + ';line-height:1.55;color:var(--text)' + extra + '">' + esc(txt) + '</div>';
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);
  const icon = (ctx, txt, used) => D.pickIconDecor(ctx.deckTitle + ' ' + txt, used || new Set(), 1)[0];
  const twoLines = (txt, w, size = 100) => String(txt || '').length * size * 0.66 > w;

  /** біздің өз пейзажымыз: қабатты төбелер + өзен + ағаштар (детерминистік, слайд нөміріне қарай аздап өзгереді) */
  const landscape = (p, h = 300, seed = 0) => {
    const y0 = HH - h; const g1 = P.mix(p.accent, '#ffffff', 0.45); const g2 = P.mix(p.accent, '#ffffff', 0.2); const g3 = p.accent; const dk = P.mix(p.accent, '#000000', 0.35);
    const sh = (seed % 3) * 120;
    const hill = (yb, amp, ph, col) => {
      let d = 'M0 ' + h; for (let x = 0; x <= W; x += 60) { const y = yb - amp * Math.sin((x + ph) / 260) - amp * 0.5 * Math.sin((x + ph * 1.7) / 110); d += ' L' + x + ' ' + y.toFixed(1); }
      return '<path d="' + d + ' L' + W + ' ' + h + 'Z" fill="' + col + '"/>';
    };
    let trees = '';
    for (let i = 0; i < 26; i++) {
      const x = (i * 97 + sh * 1.3) % W; const base = h * 0.58 + 22 * Math.sin((x + sh) / 260); const th = 46 + ((i * 37) % 30);
      trees += '<path d="M' + x.toFixed(0) + ' ' + (base - th).toFixed(0) + ' L' + (x - th * 0.32).toFixed(0) + ' ' + base.toFixed(0) + ' L' + (x + th * 0.32).toFixed(0) + ' ' + base.toFixed(0) + 'Z" fill="' + dk + '"/>';
    }
    const rx = 1180 + sh; const river = '<path d="M' + (rx + 220) + ' ' + (h * 0.5) + ' C ' + (rx + 40) + ' ' + (h * 0.62) + ', ' + (rx + 320) + ' ' + (h * 0.78) + ', ' + (rx + 60) + ' ' + h + ' L ' + (rx + 220) + ' ' + h + ' C ' + (rx + 470) + ' ' + (h * 0.8) + ', ' + (rx + 180) + ' ' + (h * 0.64) + ', ' + (rx + 290) + ' ' + (h * 0.5) + 'Z" fill="' + p.accent2 + '"/>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + h + '" viewBox="0 0 ' + W + ' ' + h + '">' +
      hill(h * 0.42, 34, sh, g1) + hill(h * 0.6, 26, sh + 400, g2) + trees + hill(h * 0.8, 20, sh + 900, g3) + river + '</svg>';
    return P.div(P.pos(0, y0, W, h), svg);
  };
  const clouds = (o = {}) => {
    const c = (x, y, s) => P.div(P.pos(x, y, 180 * s, 70 * s), '<svg viewBox="0 0 180 70" width="100%" height="100%"><path d="M20 60 C0 60 0 34 24 34 C26 14 56 6 72 24 C84 4 124 6 128 32 C150 26 172 40 164 60Z" fill="#ffffff"/></svg>');
    return (o.left !== false ? c(40, 110, 1) : '') + (o.right !== false ? c(W - 260, 60, 1.2) : '') + (o.mid ? c(W / 2 + 280, 160, 0.8) : '');
  };
  const rphoto = (ctx, x, y, w, h, r = 24) => {
    const a = ctx.a; const p = ctx.palette;
    if (hasP(a, Math.min(w, 800))) return P.div(P.pos(x, y, w, h) + ';overflow:hidden;border-radius:' + r + 'px;box-shadow:0 18px 40px -24px rgba(0,0,0,.45)', I.imgTag(a.photo, a.img, p, { focus: a.focus }));
    const ic = icon(ctx, a.title + ' ' + (a.subtitle || '')); const s = Math.min(w, h) * 0.46;
    return P.div(P.pos(x, y, w, h) + ';border-radius:' + r + 'px;background:#ffffff') + (ic ? P.div(P.pos(x + w / 2 - s / 2, y + h / 2 - s / 2, s, s), '<img alt="" src="' + D.iconUri(ic.name, p.accent, 1.2) + '" style="width:100%;height:100%">') : '');
  };
  const pill = (p, txt, size = 36) => '<span style="display:inline-block;padding:8px 30px;border-radius:40px;background:' + p.accent + ';color:#fff;' + fs(size) + ';line-height:1.3;font-weight:600">' + esc(txt) + '</span>';
  const seedOf = (ctx) => Number(ctx.a.index) || 0;

  // ── МҰҚАБА: ортада алып тақырып, астында «Presented by» / сипаттама, бұлттар, төменде биік пейзаж ──
  def({
    id: 'md-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const { metaHtml } = H.coverParts(ctx);
      const bg = plate + clouds({ mid: true }) + landscape(p, 380, 0);
      const fg = t('title', 260, 170, W - 520, '<div style="text-align:center">' + H.titleH1(ctx, a.title, { role: 'display', width: W - 520, maxLines: 3, scale: [156, 136, 118, 102, 90, 78], hl: false }) +
          (a.subtitle ? '<div style="margin-top:30px;' + fs(46) + ';line-height:1.3;color:var(--text)">' + esc(a.subtitle) + '</div>' : '') + '</div>') +
        (metaHtml ? '<div style="position:absolute;left:' + (W / 2 - 520) + 'px;top:600px;width:1040px;padding:16px 30px;border-radius:24px;background:rgba(255,255,255,.75)">' + metaHtml + '</div>' : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover md-slide' };
    },
  });

  // ── КІРІСПЕ («Introduction»): сол жақта тақырып пен мәтін, оң жақта алып дөңгелек фото («Жер шары» орнында) ──
  def({
    id: 'md-intro', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length >= 20 && sh.text.length <= 420,
    render(ctx, sh) {
      const p = ctx.palette; const size = sh.text.length <= 200 ? 40 : sh.text.length <= 320 ? 35 : 31;
      const bg = plate + clouds({ left: false }) + landscape(p, 290, seedOf(ctx)) + rphoto(ctx, 1240, 110, 560, 560, 280);
      const fg = wrap(LX, 150, 1000, head(ctx, 1000, 2) + '<div data-role="text" style="margin-top:34px">' + body(sh.text, size) + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide md-slide' };
    },
  });

  // ── ТҮРЛЕРІ («Main Types»): тақырып, астында 2–4 бағанды жасыл пилюлялар (тек қысқа атаулар) ──
  def({
    id: 'md-pills', kind: 'list', systems: SYS,
    fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 8 && sh.items.every((m) => !m.detail && m.label.length <= 22),
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const cols = n <= 4 ? 2 : 4; const cw = cols === 4 ? 400 : 640; const gap = 46;
      const bg = plate + clouds({ left: false }) + landscape(p, 290, seedOf(ctx));
      let fg = wrap(LX, 150, 1500, head(ctx, 1500, 2));
      const y0 = twoLines(ctx.a.title, 1500) ? 470 : 380;
      sh.items.forEach((m, i) => {
        const x = LX + 30 + (i % cols) * (cw + gap); const y = y0 + Math.floor(i / cols) * 110;
        fg += t('row', x, y, cw, '<div style="text-align:center">' + pill(p, m.label, cols === 4 ? 36 : 40) + '</div>');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide md-slide' };
    },
  });

  // ── ТІЗІМ / ФОТО + ТІЗІМ («Mountains»): тақырып, мәтін-қатарлар; бір жағында дөңгелек бұрышты фото (кезектесіп ауысады) ──
  const listRender = (ctx, sh) => {
    const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 33 : 38; const right = seedOf(ctx) % 2 === 0;
    const px = right ? 1180 : LX; const tx = right ? LX : 840; const tw = right ? 980 : W - 840 - 110;
    const rows = sh.items.map((m) => '<div data-role="row" style="display:flex;gap:16px;padding:8px 0"><span style="flex:none;width:14px;height:14px;margin-top:' + Math.round(size * 0.5) + 'px;border-radius:50%;background:' + p.accent + '"></span><div style="' + fs(size) + ';line-height:1.45;color:var(--text)"><b>' + esc(m.label || '') + '</b>' + (m.detail ? ' — ' + esc(m.detail) : '') + '</div></div>').join('');
    const bg = plate + clouds({ left: !right, right }) + landscape(p, 290, seedOf(ctx)) + rphoto(ctx, px, 230, 640, 420);
    const fg = wrap(tx, 150, tw, head(ctx, tw, 2, [104, 92, 82, 72, 62]) + '<div data-role="list" style="margin-top:26px">' + rows + '</div>');
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide md-slide' };
  };
  def({ id: 'md-list', kind: 'list', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5 && sh.items.every((m) => (m.label + (m.detail || '')).length <= 120), render: listRender });
  def({ id: 'md-photolist', kind: 'photoList', systems: SYS, fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5 && sh.items.every((m) => (m.label + (m.detail || '')).length <= 120), render: listRender });

  // ── ҰҒЫМДАР («How do landforms change?»): сол жақта тақырып, оң жақта «1. Атау:» + мәтін (2–4) ──
  const numbered = (ctx, sh) => {
    const p = ctx.palette; const n = sh.items.length; const size = n > 3 ? 35 : 40;
    const rows = sh.items.map((m, i) => '<div data-role="row" style="padding:10px 0"><div style="display:flex;gap:18px;align-items:baseline"><span class="md-acc" style="flex:none;font-family:var(--f-display);' + fs(size + 10) + '">' + (m.date ? esc(m.date) : (i + 1) + '.') + '</span>' +
      '<span style="font-family:var(--f-display);' + fs(size + 6) + ';line-height:1.2;color:var(--text)">' + esc(m.label || '') + '</span></div>' + (m.detail ? '<div style="margin:6px 0 0 ' + (m.date ? 0 : 52) + 'px;' + fs(size - 4) + ';line-height:1.5;color:var(--text)">' + esc(m.detail) + '</div>' : '') + '</div>').join('');
    const bg = plate + clouds({ right: false }) + landscape(p, 260, seedOf(ctx));
    const fg = wrap(LX, 260, 640, head(ctx, 640, 4, [100, 88, 78, 68, 60])) + t('list', 860, 80, W - 860 - 110, rows, 'height:' + (HH - 80 - 280) + 'px;display:flex;flex-direction:column;justify-content:center');
    void p;
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide md-slide' };
  };
  def({ id: 'md-concepts', kind: 'concepts', systems: SYS, fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => m.label.length <= 44 && (m.detail || '').length <= 130), render: numbered });
  def({ id: 'md-steps', kind: 'process', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 4 && sh.items.every((m) => (m.detail || '').length <= 120), render: numbered });
  def({ id: 'md-timeline', kind: 'timeline', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 4 && sh.items.every((m) => String(m.date || '').length <= 9), render: numbered });

  // ── САНДАР: тақырып, ақ дөңгелек бұрышты карточкаларда екпін түсті ірі сан + түсініктеме ──
  def({
    id: 'md-stats', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 4 && sh.stats.every((s) => String(s.value).length <= 9 && String(s.label || '').length <= 70),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.stats.length; const gap = 40; const x0 = 140; const w = (W - 2 * x0 - gap * (n - 1)) / n; const y = a.subtitle ? 400 : 360; const ch = 360;
      const longest = Math.max(...sh.stats.map((s) => String(s.value).length)); const size = Math.min(120, Math.floor((w - 60) / (longest * 0.66)));
      let bg = plate + clouds({ left: false }) + landscape(p, 220, seedOf(ctx));
      let fg = wrap(LX, 130, 1600, head(ctx, 1600, 1) + (a.subtitle ? '<div style="margin-top:10px">' + body(a.subtitle, 32) + '</div>' : ''));
      sh.stats.forEach((s, i) => {
        const x = x0 + i * (w + gap);
        bg += P.div(P.pos(x, y, w, ch) + ';background:#fff;border-radius:28px;box-shadow:0 18px 40px -26px rgba(0,0,0,.35)');
        fg += t('stat', x + 30, y + 50, w - 60, '<div style="text-align:center"><div class="md-acc" style="font-family:var(--f-display);' + fs(size) + ';line-height:1;white-space:nowrap">' + esc(s.value) + '</div><div style="margin-top:26px;' + fs(32) + ';line-height:1.4;color:var(--text)">' + esc(s.label || '') + '</div></div>', 'max-height:' + (ch - 70) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide md-slide' };
    },
  });

  // ── САЛЫСТЫРУ: екі ақ карточка, басында жасыл / көк пилюля ──
  def({
    id: 'md-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 5 && sh.right.rows.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const x0 = 120; const gap = 50; const w = (W - 2 * x0 - gap) / 2; const top = twoLines(ctx.a.title, 1600) ? 400 : 320;
      const n = Math.max(sh.left.rows.length, sh.right.rows.length); const size = n > 4 ? 30 : 34; const ch = HH - top - 200;
      const bg = plate + clouds({ left: false }) + landscape(p, 200, seedOf(ctx)) + P.div(P.pos(x0, top, w, ch) + ';background:#fff;border-radius:28px') + P.div(P.pos(x0 + w + gap, top, w, ch) + ';background:#fff;border-radius:28px');
      const col = (c, pp) => '<div style="text-align:center">' + pill(pp, c.head, 36) + '</div><div style="height:18px"></div>' + c.rows.map((r) => '<div data-role="row" style="display:flex;gap:16px;padding:8px 0"><span style="flex:none;width:14px;height:14px;margin-top:' + Math.round(size * 0.5) + 'px;border-radius:50%;background:' + pp.accent + '"></span><div style="' + fs(size) + ';line-height:1.45;color:var(--text)">' + esc(r) + '</div></div>').join('');
      const fg = wrap(LX, 130, 1600, head(ctx, 1600, 2)) + t('side', x0 + 40, top + 30, w - 80, col(sh.left, p), 'max-height:' + (ch - 40) + 'px') + t('side', x0 + w + gap + 40, top + 30, w - 80, col(sh.right, { ...p, accent: P.mix(p.accent2, '#000000', 0.15) }), 'max-height:' + (ch - 40) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide md-slide' };
    },
  });

  // ── БӨЛІМ («Thank You» тілі): ортада нөмір-пилюля және алып тақырып, биік пейзаж ──
  def({
    id: 'md-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const num = String((ctx.plan && ctx.plan.section) || a.index);
      const bg = plate + clouds({ mid: true }) + landscape(p, 400, seedOf(ctx));
      const fg = t('title', 260, 170, W - 520, '<div style="text-align:center">' + pill(p, num + '-бөлім', 34) + '<div style="height:30px"></div>' + H.titleH1(ctx, a.title, { role: 'display', width: W - 520, maxLines: 2, scale: [150, 130, 112, 96], hl: false }) +
        (a.subtitle ? '<div style="margin-top:20px;' + fs(40) + ';color:var(--text)">' + esc(a.subtitle) + '</div>' : '') + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide md-slide' };
    },
  });

  // ── ДӘЙЕКСӨЗ: ақ «бұлт» карточкада ортада мәтін, астында жасыл пилюла-автор ──
  def({
    id: 'md-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 220,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = plate + clouds({ mid: true }) + landscape(p, 260, seedOf(ctx)) + P.div(P.pos(260, 170, W - 520, 520) + ';background:#fff;border-radius:40px;box-shadow:0 20px 50px -30px rgba(0,0,0,.35)');
      const fg = t('title', 340, 230, W - 680, '<div style="text-align:center"><div class="md-acc" style="font-family:var(--f-display);font-size:140px;line-height:.7">“</div><div style="margin-top:10px;font-family:var(--f-display);' + fs(text.length <= 90 ? 56 : text.length <= 150 ? 46 : 38) + ';line-height:1.3;color:var(--text)">' + esc(text) + '</div></div>', 'max-height:420px') +
        (who ? t('lead', 260, 640, W - 520, '<div style="text-align:center">' + pill(p, who, 32) + '</div>') : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide md-slide' };
    },
  });

  // ── ҚОРЫТЫНДЫ («Conclusion»): тақырып, екі бағандағы нүктелі түйіндер ──
  def({
    id: 'md-closing', kind: 'closing', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 6,
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 34 : 40; const half = Math.ceil(n / 2); const cw = 780;
      const col = (arr) => arr.map((m) => '<div data-role="row" style="display:flex;gap:16px;padding:10px 0"><span style="flex:none;width:16px;height:16px;margin-top:' + Math.round(size * 0.48) + 'px;border-radius:50%;background:' + p.accent + '"></span><div style="' + fs(size) + ';line-height:1.45;color:var(--text)"><b>' + esc(m.label) + '</b>' + (m.detail ? ' — ' + esc(m.detail) : '') + '</div></div>').join('');
      const bg = plate + clouds({ left: false }) + landscape(p, 280, seedOf(ctx));
      const fg = wrap(LX, 150, 1600, head(ctx, 1600, 1)) + t('list', LX, 330, cw, col(sh.items.slice(0, half)), 'max-height:460px') + t('list', LX + cw + 80, 330, cw, col(sh.items.slice(half)), 'max-height:460px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide md-slide' };
    },
  });
};
