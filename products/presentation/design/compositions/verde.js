'use strict';
/**
 * «РОМБ» (verde) композициялары — Canva «Company Profile / Larana» шаблонының ӨЛШЕНГЕН торы (1920×1080):
 *   • тақырып БАС ӘРІППЕН, 100–110 px (мұқабада 183 px), қою екпін #047650; сол жиек ~190 px, жоғарғы «лого» жолы y≈117;
 *   • мәтін 28–36 px; тізім нүктелері екпін түсті; «батырма» — жебе ұшты екпін пилюля (48 px ақ жазу);
 *   • ромб фото (≈560 px диагональ) — ақ жиек + жұмсақ көлеңке, артында сұр қиғаш жолақ;
 *   • оң жоғарғы және сол төменгі бұрыштарда екпіннің үш реңкіндегі қиғаш үшбұрыштар;
 *   • сан-чиптер — екпін түсті дөңгелек бұрышты тікбұрыш: ірі сан (73 px) + кіші бас әріпті белгі.
 * Шаблонның файлдары қолданылмайды (тек тор, өлшем, түс қатынасы).
 */
module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, MB, W, HH } = K;
  const SYS = ['verde'];
  const D = require('../decor');
  const LX = 190;
  const plate = '<div class="plate"></div>';
  const tone = (p) => ({ DK: p.accent, BR: p.accent2, MID: P.mix(p.accent, p.accent2, 0.5), GREY: P.mix(p.bg, '#64748b', 0.18) });
  // бас әріп Montserrat кеңірек — өлшемді тар бағанға есептейміз
  const head = (ctx, w, lines = 2, scale = [100, 90, 80, 70, 62, 54]) => H.titleH1(ctx, ctx.a.title, { width: Math.round(w * 0.82), maxLines: lines, scale, hl: false });
  const body = (txt, size = 30, extra = '') => '<div style="' + fs(size) + ';line-height:1.55;color:var(--text)' + extra + '">' + esc(txt) + '</div>';
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);
  const icon = (ctx, txt, used) => D.pickIconDecor(ctx.deckTitle + ' ' + txt, used || new Set(), 1)[0];
  const twoLines = (txt, w, size = 90) => String(txt || '').length * size * 0.78 > w;
  // жебе ұшты «батырма» (шаблондағы PRESENTATION / CONTINUE)
  const pill = (p, txt, size = 34) => '<div data-role="kicker" style="display:inline-block;position:relative;padding:12px 64px 12px 30px;background:' + p.accent + ';color:#fff;' + fs(size) +
    ';font-weight:700;letter-spacing:.06em;text-transform:uppercase;line-height:1.2;clip-path:polygon(0 0,calc(100% - 34px) 0,100% 50%,calc(100% - 34px) 100%,0 100%)">' + esc(txt) + '</div>';
  const dotRow = (p, txt, size, detail) => '<div data-role="row" style="display:flex;gap:20px;align-items:flex-start;padding:9px 0">' +
    '<span style="flex:none;width:14px;height:14px;margin-top:' + Math.round(size * 0.5) + 'px;border-radius:50%;background:' + p.accent2 + '"></span><div>' +
    '<div style="' + fs(size) + ';line-height:1.35;font-weight:' + (detail ? 700 : 400) + ';color:' + (detail ? p.accent : 'var(--text)') + '">' + esc(txt) + '</div>' +
    (detail ? '<div style="margin-top:4px;' + fs(size - 5) + ';line-height:1.45;color:var(--text2)">' + esc(detail) + '</div>' : '') + '</div></div>';

  /** бұрыштағы қиғаш үшбұрыштар: tr — оң жоғары (үш реңк), bl — сол төмен */
  const corners = (p, o = {}) => {
    const c = tone(p); let s = '';
    if (o.tr !== false) {
      s += P.div(P.pos(W - 760, 0, 760, 560) + ';background:' + c.MID + ';clip-path:polygon(0 0,100% 0,100% 100%)');
      s += P.div(P.pos(W - 560, 0, 560, 420) + ';background:' + c.DK + ';clip-path:polygon(0 0,100% 0,100% 100%)');
      s += P.div(P.pos(W - 960, 0, 420, 300) + ';background:' + c.BR + ';opacity:.85;clip-path:polygon(0 0,100% 0,60% 100%)');
    }
    if (o.bl !== false) {
      s += P.div(P.pos(0, HH - 330, 520, 330) + ';background:' + c.DK + ';clip-path:polygon(0 0,100% 100%,0 100%)');
      s += P.div(P.pos(0, HH - 200, 760, 200) + ';background:' + c.BR + ';opacity:.9;clip-path:polygon(0 100%,100% 100%,30% 0)');
    }
    if (o.br) {
      s += P.div(P.pos(W - 640, HH - 420, 640, 420) + ';background:' + c.DK + ';clip-path:polygon(100% 0,100% 100%,0 100%)');
      s += P.div(P.pos(W - 420, HH - 260, 420, 260) + ';background:' + c.BR + ';clip-path:polygon(100% 0,100% 100%,0 100%)');
    }
    return s;
  };
  /** ромб фото: (cx,cy) орталық, d — шаршының қабырғасы (диагональ ≈ 1.41·d); фото жоқ болса — ақ ромб + белгіше */
  const diamond = (ctx, cx, cy, d, o = {}) => {
    const a = ctx.a; const p = ctx.palette; const c = tone(p);
    let s = o.ribbon === false ? '' : P.div(P.pos(cx - d * 1.2, cy - 90, d * 2.4, 180) + ';background:' + c.GREY + ';opacity:.55;transform:rotate(-38deg)');
    const frame = P.pos(cx - d / 2, cy - d / 2, d, d) + ';transform:rotate(45deg);overflow:hidden;background:#fff;border:14px solid #fff;box-sizing:border-box;box-shadow:0 30px 60px -30px rgba(0,0,0,.45)';
    const big = d * 1.42;
    if (o.photo !== false && hasP(a, d)) {
      s += P.div(frame, '<div style="position:absolute;left:' + Math.round((d - big) / 2 - 14) + 'px;top:' + Math.round((d - big) / 2 - 14) + 'px;width:' + Math.round(big) + 'px;height:' + Math.round(big) + 'px;transform:rotate(-45deg)">' +
        I.imgTag(a.photo, a.img, p, { focus: a.focus }) + '</div>');
    } else {
      const ic = o.icon || icon(ctx, a.title + ' ' + (a.subtitle || ''));
      s += P.div(frame) + (ic ? P.div(P.pos(cx - d * 0.28, cy - d * 0.28, d * 0.56, d * 0.56), '<img alt="" src="' + D.iconUri(ic.name, c.DK, 1.2) + '" style="width:100%;height:100%">') : '');
    }
    return s;
  };
  const brand = (ctx) => {
    const lab = H.sectionLabel(ctx);
    return lab ? t('kicker', LX, 104, 900, '<div style="display:flex;align-items:center;gap:14px;' + fs(26) + ';font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)"><span style="width:30px;height:30px;background:' + ctx.palette.accent2 + ';clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)"></span>' + esc(String(lab).slice(0, 60)) + '</div>') : '';
  };

  // ── МҰҚАБА: сол жақта алып бас әріпті тақырып + «батырма», оң жақта ромб фото, бұрыштарда үшбұрыштар ──
  def({
    id: 'vd-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const tw = 860;
      const { metaHtml } = H.coverParts(ctx);
      const bg = plate + corners(p, { bl: false, br: true }) + diamond(ctx, 1490, 480, 500);
      const sub = String(a.subtitle || '');
      const fg = wrap(LX, 280, tw, H.titleH1(ctx, a.title, { role: 'display', width: Math.round(tw * 0.82), maxLines: 4, scale: [140, 120, 104, 90, 78, 66, 58], hl: true }) +
          (sub ? '<div style="margin-top:44px">' + (sub.length <= 34 ? pill(p, sub, 32) : body(sub, 32)) + '</div>' : '')) +
        brand(ctx) + '<div style="position:absolute;left:' + LX + 'px;bottom:' + MB + 'px;width:820px">' + metaHtml + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover vd-slide' };
    },
  });

  // ── ТҰЖЫРЫМ («Welcome to our company»): тақырып, абзац, оң жақта ромб фото ──
  def({
    id: 'vd-intro', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length >= 20 && sh.text.length <= 480,
    render(ctx, sh) {
      const p = ctx.palette; const size = sh.text.length <= 220 ? 36 : sh.text.length <= 340 ? 31 : 28;
      const bg = plate + corners(p, { bl: false }) + diamond(ctx, 1420, 560, 540);
      const fg = brand(ctx) + wrap(LX, 230, 880, head(ctx, 880, 3) + '<div data-role="text" style="margin-top:44px">' + body(sh.text, size) + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });

  // ── ТІЗІМ («Table of contents»): сол жақта ромб фото, оң жақта тақырып + екі бағанды нүктелі тізім ──
  def({
    id: 'vd-list', kind: 'list', systems: SYS,
    fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 8 && sh.items.every((m) => m.label.length <= 60 && !(m.detail && m.detail.length > 90)),
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const two = n >= 6 && sh.items.every((m) => !m.detail && m.label.length <= 26);
      const size = two ? 34 : n > 4 ? 30 : 34;
      const bg = plate + corners(p, { tr: false }) + diamond(ctx, 560, 560, 520);
      const x = 960; const w = W - x - 110;
      let list;
      if (two) {
        const half = Math.ceil(n / 2); const col = (arr) => arr.map((m) => dotRow(p, m.label, size)).join('');
        list = '<div style="display:flex;gap:40px"><div style="flex:1">' + col(sh.items.slice(0, half)) + '</div><div style="flex:1">' + col(sh.items.slice(half)) + '</div></div>';
      } else list = sh.items.map((m) => dotRow(p, m.label, size, m.detail)).join('');
      const fg = brand(ctx) + wrap(x, 200, w, head(ctx, w, 2) + '<div data-role="list" style="margin-top:40px">' + list + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });

  // ── ФОТО + ТІЗІМ («Experience» 9-слайд): сол жақта тақырып пен нүктелі қатарлар, оң жақта ромб фото ──
  def({
    id: 'vd-photolist', kind: 'photoList', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 32 : 38;
      const bg = plate + corners(p, { bl: false }) + diamond(ctx, 1450, 600, 500);
      const fg = brand(ctx) + wrap(LX, 210, 900, head(ctx, 900, 2) + '<div data-role="list" style="margin-top:36px">' + sh.items.map((m) => dotRow(p, m.label, size, m.detail)).join('') + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });

  // ── КОМАНДА / ҰҒЫМДАР («Professional team»): жоғарыда тақырып, төменгі жартысы — екпін жолақ, ішінде ромб белгішелер ──
  def({
    id: 'vd-team', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 4 && sh.items.every((m) => m.label.length <= 34 && (m.detail || '').length <= 90),
    render(ctx, sh) {
      const p = ctx.palette; const c = tone(p); const n = sh.items.length;
      const band = twoLines(ctx.a.title, 1500) ? 420 : 360; const span = W - 2 * 150; const w = span / n; const used = new Set();
      let bg = plate + P.panel(0, band, W, HH - band, c.DK) + P.div(P.pos(W - 520, band, 520, HH - band) + ';background:' + c.MID + ';clip-path:polygon(100% 0,100% 100%,0 100%)');
      let fg = brand(ctx) + wrap(LX, 180, 1500, head(ctx, 1500, 2, [96, 86, 76, 66, 58]));
      sh.items.forEach((m, i) => {
        const cx = 150 + w * i + w / 2; const cy = band + 150;
        const ic = icon(ctx, m.label + ' ' + (m.detail || ''), used) || { name: 'circle-check' }; used.add(ic.name);
        bg += P.div(P.pos(cx - 92, cy - 92, 184, 184) + ';transform:rotate(45deg);background:#fff;border:10px solid ' + c.BR + ';box-sizing:border-box;box-shadow:0 20px 40px -24px rgba(0,0,0,.5)') +
          P.div(P.pos(cx - 54, cy - 54, 108, 108), '<img alt="" src="' + D.iconUri(ic.name, c.DK, 1.3) + '" style="width:100%;height:100%">');
        fg += '<div class="vd-on">' + t('concept', cx - w / 2 + 24, cy + 160, w - 48, '<div style="text-align:center;' + fs(n > 3 ? 32 : 36) + ';line-height:1.2;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#fff">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:12px;text-align:center;' + fs(n > 3 ? 26 : 29) + ';line-height:1.45;color:rgba(255,255,255,.88)">' + esc(m.detail) + '</div>' : ''), 'max-height:' + (HH - cy - 200) + 'px') + '</div>';
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });

  // ── ҚЫЗМЕТТЕР / ҰҒЫМДАР ұзын мәтінмен («Premium service»): жоғарғы жолақ екпін түсті (ақ тақырып), астында ашық екпін карточкалар ──
  def({
    id: 'vd-service', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 3 && sh.items.every((m) => m.label.length <= 50 && (m.detail || '').length <= 220),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p); const n = sh.items.length;
      const bandH = 470; const gap = 50; const x0 = 150; const w = (W - 2 * x0 - gap * (n - 1)) / n; const top = 440;
      let bg = plate + P.panel(0, 0, W, bandH, c.DK) + P.div(P.pos(0, 0, 700, bandH) + ';background:' + c.MID + ';opacity:.6;clip-path:polygon(0 0,100% 0,0 100%)');
      bg += diamond(ctx, 1660, 230, 300, { ribbon: false });
      let fg = '<div class="vd-on">' + wrap(LX, 150, 1150, head(ctx, 1150, 2, [96, 86, 76, 66, 58]) + (a.subtitle ? '<div style="margin-top:16px">' + body(a.subtitle, 28, ';color:rgba(255,255,255,.85)') + '</div>' : '')) + '</div>';
      sh.items.forEach((m, i) => {
        const x = x0 + i * (w + gap);
        bg += P.div(P.pos(x, top, w, HH - top - 110) + ';background:' + c.BR + ';border-radius:16px;box-shadow:0 26px 50px -30px rgba(0,0,0,.55)');
        fg += '<div class="vd-on">' + t('concept', x + 40, top + 44, w - 80, '<div style="' + fs(36) + ';line-height:1.2;font-weight:700;color:#fff">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:16px;' + fs(30) + ';line-height:1.5;color:#fff">' + esc(m.detail) + '</div>' : ''), 'max-height:' + (HH - top - 200) + 'px') + '</div>';
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });

  // ── САНДАР («Experience» 7-слайд): тақырып, түсініктеме, екпін чиптер (ірі сан + бас әріпті белгі), оң жақта ромб фото ──
  def({
    id: 'vd-stats', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 4 && sh.stats.every((s) => String(s.value).length <= 9 && String(s.label || '').length <= 60),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p); const n = sh.stats.length;
      const cols = n <= 2 ? n : 2; const rows = Math.ceil(n / cols); const cw = 420; const ch = 170; const gap = 34;
      const y0 = a.subtitle ? 560 : 470;
      let bg = plate + corners(p, { tr: false }) + diamond(ctx, 1480, 560, 500);
      let fg = brand(ctx) + wrap(LX, 210, 1000, head(ctx, 1000, 2) + (a.subtitle ? '<div style="margin-top:26px">' + body(a.subtitle, 30) + '</div>' : ''));
      sh.stats.forEach((s, i) => {
        const x = LX + (i % cols) * (cw + gap); const y = y0 + Math.floor(i / cols) * (ch + gap);
        if (y + ch > HH - 40) return;
        bg += P.div(P.pos(x, y, cw, ch) + ';background:' + c.DK + ';border-radius:14px;box-shadow:0 20px 40px -26px rgba(0,0,0,.5)');
        const v = String(s.value); const vs = Math.min(76, Math.floor(380 / (v.length * 0.72)));
        fg += t('stat', x + 30, y + 22, cw - 60, '<div style="font-family:var(--f-display);' + fs(vs) + ';line-height:1;color:#fff;white-space:nowrap">' + esc(v) + '</div>' +
          '<div style="margin-top:12px;' + fs(22) + ';line-height:1.25;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.9)">' + esc(s.label || '') + '</div>', 'max-height:' + (ch - 30) + 'px');
      });
      void rows;
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });

  // ── ҚАДАМДАР / УАҚЫТ СЫЗЫҒЫ: сол жақта тақырып, оң жақта жебе-пилюля нөмірлі қатарлар ──
  const stepsRender = (ctx, sh) => {
    const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 36 : 44;
    const bg = plate + corners(p, { tr: false });
    const rows = sh.items.map((m, i) => '<div data-role="row" style="display:flex;gap:30px;align-items:flex-start;padding:12px 0">' +
      '<div style="flex:none;min-width:150px;padding:10px 46px 10px 22px;background:' + (i % 2 ? p.accent2 : p.accent) + ';color:#fff;font-family:var(--f-display);' + fs(m.date ? Math.min(38, Math.floor(260 / (String(m.date).length * 0.78))) : 40) +
      ';line-height:1.1;white-space:nowrap;clip-path:polygon(0 0,calc(100% - 28px) 0,100% 50%,calc(100% - 28px) 100%,0 100%)">' + esc(m.date || String(i + 1).padStart(2, '0')) + '</div>' +
      '<div style="padding-top:6px"><div style="' + fs(size) + ';line-height:1.3;font-weight:700;color:var(--accent)">' + esc(m.label || '') + '</div>' +
      (m.detail ? '<div style="margin-top:6px;' + fs(size - 8) + ';line-height:1.45;color:var(--text)">' + esc(m.detail) + '</div>' : '') + '</div></div>').join('');
    const fg = brand(ctx) + wrap(LX, 300, 620, head(ctx, 620, 4, [96, 84, 74, 64, 56])) + t('list', 880, 140, W - 880 - 110, rows, 'height:' + (HH - 140 - 90) + 'px;display:flex;flex-direction:column;justify-content:center;gap:' + (n > 4 ? 8 : 22) + 'px');
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
  };
  def({ id: 'vd-steps', kind: 'process', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 6, render: stepsRender });
  def({ id: 'vd-timeline', kind: 'timeline', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 6 && sh.items.every((m) => String(m.date || '').length <= 10), render: stepsRender });

  // ── САЛЫСТЫРУ: екі ақ карточка, басында жебе-пилюля тақырып ──
  def({
    id: 'vd-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 5 && sh.right.rows.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const x0 = LX - 40; const gap = 60; const w = (W - x0 - 110 - gap) / 2; const top = twoLines(ctx.a.title, 1230) ? 450 : 360;
      const n = Math.max(sh.left.rows.length, sh.right.rows.length); const size = n > 4 ? 32 : 38;
      const bg = plate + corners(p, { tr: false, br: false }) +
        P.div(P.pos(x0, top + 40, w, HH - top - 110) + ';background:#fff;border-radius:16px;box-shadow:0 24px 50px -30px rgba(0,0,0,.35)') +
        P.div(P.pos(x0 + w + gap, top + 40, w, HH - top - 110) + ';background:#fff;border-radius:16px;box-shadow:0 24px 50px -30px rgba(0,0,0,.35)');
      const col = (cc) => cc.rows.map((r) => dotRow(p, r, size)).join('');
      const fg = brand(ctx) + wrap(LX, 190, 1500, head(ctx, 1500, 2)) +
        t('side', x0 + 40, top, w - 80, pill(p, sh.left.head, 30)) + t('side', x0 + w + gap + 40, top, w - 80, pill({ ...p, accent: p.accent2 }, sh.right.head, 30)) +
        t('list', x0 + 50, top + 120, w - 100, col(sh.left), 'max-height:' + (HH - top - 200) + 'px') +
        t('list', x0 + w + gap + 50, top + 120, w - 100, col(sh.right), 'max-height:' + (HH - top - 200) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });

  // ── БӨЛІМ: толық екпін фон, ақ тақырып, оң жақта ромб фото ──
  def({
    id: 'vd-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p);
      const num = String((ctx.plan && ctx.plan.section) || a.index).padStart(2, '0');
      const bg = plate + P.panel(0, 0, W, HH, c.DK) + P.div(P.pos(0, 0, 1100, HH) + ';background:' + c.MID + ';opacity:.55;clip-path:polygon(0 0,100% 0,40% 100%,0 100%)') + diamond(ctx, 1440, 540, 540, { ribbon: false });
      const fg = '<div class="vd-on">' + wrap(LX, 260, 780, '<div style="font-family:var(--f-display);font-size:160px;line-height:1;color:' + P.mix(c.BR, '#ffffff', 0.45) + '">' + esc(num) + '</div><div style="height:30px"></div>' +
        H.titleH1(ctx, a.title, { role: 'display', width: 620, maxLines: 3, scale: [100, 88, 76, 66, 58], hl: false }) + (a.subtitle ? '<div style="margin-top:24px">' + body(a.subtitle, 32, ';color:rgba(255,255,255,.88)') + '</div>' : '')) + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });

  // ── ДӘЙЕКСӨЗ: ақ фон, екпін ромб ішінде тырнақша, ірі мәтін, автор — жебе-пилюля ──
  def({
    id: 'vd-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 220,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p);
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = plate + corners(p, { bl: false, br: true }) +
        P.div(P.pos(LX, 230, 150, 150) + ';transform:rotate(45deg);background:' + c.DK) +
        P.div(P.pos(LX, 236, 150, 150) + ';display:flex;align-items:center;justify-content:center;font-family:var(--f-display);font-size:150px;line-height:1;color:#fff', '“');
      const fg = t('title', LX, 450, 1250, '<div style="font-family:var(--f-display);' + fs(text.length <= 90 ? 60 : text.length <= 150 ? 50 : 42) + ';line-height:1.3;color:var(--accent)">' + esc(text) + '</div>') +
        (who ? t('lead', LX, 860, 1100, pill(p, who, 30)) : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });

  // ── ҚОРЫТЫНДЫ («Contact us» тілі): тақырып, екпін дөңгелек белгішелі қатарлар, оң жақта ромб фото ──
  def({
    id: 'vd-closing', kind: 'closing', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 32 : 38; const used = new Set();
      const rows = sh.items.map((m) => {
        const ic = icon(ctx, m.label + ' ' + (m.detail || ''), used) || { name: 'circle-check' }; used.add(ic.name);
        return '<div data-role="row" style="display:flex;gap:24px;align-items:center;padding:12px 0"><span style="flex:none;width:64px;height:64px;border-radius:50%;background:' + p.accent + ';display:flex;align-items:center;justify-content:center">' +
          '<img alt="" src="' + D.iconUri(ic.name, '#ffffff', 1.6) + '" style="width:36px;height:36px"></span><div><div style="' + fs(size) + ';line-height:1.3;color:var(--text)">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:2px;' + fs(size - 6) + ';line-height:1.4;color:var(--text2)">' + esc(m.detail) + '</div>' : '') + '</div></div>';
      }).join('');
      const bg = plate + corners(p, { bl: false, br: true }) + diamond(ctx, 1440, 520, 500);
      const fg = brand(ctx) + wrap(LX, 230, 900, head(ctx, 900, 2) + '<div data-role="list" style="margin-top:40px">' + rows + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide vd-slide' };
    },
  });
};
