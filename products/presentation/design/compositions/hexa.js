'use strict';
/**
 * «АЛТЫБҰРЫШ» (hexa) композициялары — Canva «The Future of Education» шаблонының ӨЛШЕНГЕН торы (1920×1080):
 *   • тақырып Inter Bold БАС ӘРІП, 88–113 px, қара; сол жиек 108 px; астында қалың бас әріпті ішкі тақырып (32–41 px);
 *   • мәтін Inter 28 px; «Presented by» — қою дөңгелек бұрышты жолақ (ақ жазу);
 *   • оң жақта алтыбұрыш фото, айналасында екпін / қою алтыбұрыштар, жиекте қара және екпін қиғаш жолақтар;
 *   • қараңғы слайд: қою фон (фото күңгірттеліп), карточкалар — екпін, қою, ақ (радиус ~22 px).
 * Шаблонның файлдары қолданылмайды (тек тор, өлшем, түс қатынасы).
 */
module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, MB, W, HH } = K;
  const SYS = ['hexa'];
  const D = require('../decor');
  const LX = 108;
  const plate = '<div class="plate"></div>';
  const HEX = 'clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)';
  const head = (ctx, w, lines = 2, scale = [96, 88, 78, 68, 60, 54]) => H.titleH1(ctx, ctx.a.title, { width: Math.round(w * 0.86), maxLines: lines, scale, hl: false });
  const body = (txt, size = 30, extra = '') => '<div style="' + fs(size) + ';line-height:1.55;color:var(--text)' + extra + '">' + esc(txt) + '</div>';
  const sub = (txt, size = 32, color = 'var(--text)') => txt ? '<div style="margin-top:34px;' + fs(size) + ';line-height:1.3;font-weight:700;color:' + color + '">' + esc(txt) + '</div>' : '';
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);
  const icon = (ctx, txt, used) => D.pickIconDecor(ctx.deckTitle + ' ' + txt, used || new Set(), 1)[0];
  const twoLines = (txt, w, size = 96) => String(txt || '').length * size * 0.8 > w;
  const hex = (x, y, w, fill, extra = '') => P.div(P.pos(x, y, w, Math.round(w * 0.87)) + ';background:' + fill + ';' + HEX + (extra ? ';' + extra : ''));
  const hexPhoto = (ctx, x, y, w) => {
    const a = ctx.a; const p = ctx.palette;
    if (hasP(a, w * 0.8)) return P.div(P.pos(x, y, w, Math.round(w * 0.87)) + ';overflow:hidden;' + HEX, I.imgTag(a.photo, a.img, p, { focus: a.focus }));
    const ic = icon(ctx, a.title + ' ' + (a.subtitle || ''));
    return hex(x, y, w, P.mix('#ffffff', p.accent, 0.1)) + (ic ? P.div(P.pos(x + w * 0.3, y + w * 0.87 * 0.3 - 10, w * 0.4, w * 0.4), '<img alt="" src="' + D.iconUri(ic.name, p.accent, 1.1) + '" style="width:100%;height:100%">') : '');
  };
  /** оң жақтағы топтама: қиғаш жолақтар + үлкен алтыбұрыш фото + кіші алтыбұрыштар. x0 — фотоның сол жиегі */
  const cluster = (ctx, x0 = 1000, y0 = 150, w = 660) => {
    const p = ctx.palette; const h = Math.round(w * 0.87);
    let s = P.div(P.pos(0, 0, W, HH) + ';background:#000;clip-path:polygon(' + (x0 + w * 0.55) + 'px 0,' + W + 'px 0,' + W + 'px ' + (HH * 0.42) + 'px)');
    s += P.div(P.pos(0, 0, W, HH) + ';background:' + p.accent2 + ';clip-path:polygon(' + (x0 + w * 0.2) + 'px ' + HH + 'px,' + (x0 + w * 0.75) + 'px ' + HH + 'px,' + W + 'px ' + (HH * 0.48) + 'px,' + W + 'px ' + (HH * 0.18) + 'px)');
    s += P.div(P.pos(0, 0, W, HH) + ';background:' + p.accent + ';clip-path:polygon(' + (x0 + w * 0.75) + 'px ' + HH + 'px,' + (x0 + w * 1.05) + 'px ' + HH + 'px,' + W + 'px ' + (HH * 0.72) + 'px,' + W + 'px ' + (HH * 0.48) + 'px)');
    s += hexPhoto(ctx, x0, y0, w);
    s += hex(x0 - 70, y0 + h * 0.62, 130, p.accent) + hex(x0 + w * 0.78, y0 - 40, 120, p.accent) + hex(x0 + w * 0.55, y0 + h - 40, 170, p.accent2);
    return s;
  };
  /** қараңғы фон: фото бар болса — күңгірттелген фото, әйтпесе қою реңк */
  const darkBg = (ctx) => {
    const a = ctx.a; const p = ctx.palette;
    return P.panel(0, 0, W, HH, '#08080f') + (hasP(a, 1200) ? P.div(P.pos(0, 0, W, HH) + ';overflow:hidden;opacity:.32', I.imgTag(a.photo, a.img, p, { focus: a.focus })) : P.div(P.pos(0, 0, W, HH) + ';background:radial-gradient(circle at 80% 20%,' + P.mix(p.accent2, '#000', 0.2) + ',#06060c 70%)'));
  };
  const brand = (ctx, y = 96, color = 'var(--text)') => {
    const lab = H.sectionLabel(ctx);
    return lab ? t('kicker', LX, y, 900, '<div style="display:flex;align-items:center;gap:14px;' + fs(26) + ';font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:' + color + '"><span style="width:34px;height:30px;background:' + ctx.palette.accent + ';' + HEX + '"></span>' + esc(String(lab).slice(0, 60)) + '</div>') : '';
  };
  const card = (x, y, w, h, fill, inner, ink) => ({ bg: P.div(P.pos(x, y, w, h) + ';background:' + fill + ';border-radius:22px'), fg: '<div style="color:' + ink + '">' + inner + '</div>' });

  // ── МҰҚАБА: сол жақта қара бас әріпті тақырып, ішкі тақырып, қою «Presented by» жолағы; оң жақта алтыбұрыш топтама ──
  def({
    id: 'hx-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const tw = 840;
      const { metaHtml } = H.coverParts(ctx);
      const bg = plate + cluster(ctx, 1020, 140, 640);
      const fg = brand(ctx) + wrap(LX, 210, tw, H.titleH1(ctx, a.title, { role: 'display', width: Math.round(tw * 0.86), maxLines: 4, scale: [113, 100, 88, 78, 68, 60], hl: false }) + sub(a.subtitle, 38)) +
        (metaHtml ? '<div class="hx-on" style="position:absolute;left:' + LX + 'px;bottom:' + MB + 'px;width:' + tw + 'px;padding:20px 34px;border-radius:26px;background:' + p.accent2 + ';--text:#fff;--text2:rgba(255,255,255,.8);--text3:rgba(255,255,255,.7);color:#fff">' + metaHtml + '</div>' : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover hx-slide' };
    },
  });

  // ── ТҰЖЫРЫМ («Technology in the classroom»): тақырып, қалың ішкі тақырып, абзац; оң жақта топтама ──
  def({
    id: 'hx-intro', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length >= 20 && sh.text.length <= 460,
    render(ctx, sh) {
      const a = ctx.a; const size = sh.text.length <= 200 ? 36 : sh.text.length <= 330 ? 32 : 28;
      const bg = plate + cluster(ctx, 1080, 170, 600);
      const fg = brand(ctx) + wrap(LX, 200, 860, head(ctx, 860, 3) + sub(a.subtitle && a.subtitle !== sh.text ? a.subtitle : '', 32) + '<div data-role="text" style="margin-top:44px">' + body(sh.text, size) + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
    },
  });

  // ── ТІЗІМ / ФОТО + ТІЗІМ: тақырып, алтыбұрыш нөмірлі қатарлар; оң жақта топтама ──
  const listRender = (ctx, sh) => {
    const p = ctx.palette; const n = sh.items.length; const size = n > 4 || sh.items.reduce((k, m) => k + m.label.length + (m.detail || '').length, 0) > 260 ? 32 : 38;
    const rows = sh.items.map((m, i) => '<div data-role="row" style="display:flex;gap:24px;align-items:flex-start;padding:12px 0">' +
      '<span style="flex:none;width:66px;height:57px;display:flex;align-items:center;justify-content:center;background:' + (i % 2 ? p.accent2 : p.accent) + ';color:#fff;font-weight:700;' + fs(24) + ';' + HEX + '">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<div style="padding-top:4px"><div style="' + fs(size) + ';line-height:1.3;font-weight:700;color:var(--text)">' + esc(m.label || '') + '</div>' +
      (m.detail ? '<div style="margin-top:4px;' + fs(size - 7) + ';line-height:1.45;color:var(--text2)">' + esc(m.detail) + '</div>' : '') + '</div></div>').join('');
    const bg = plate + cluster(ctx, 1130, 200, 560);
    const fg = brand(ctx) + wrap(LX, 190, 930, head(ctx, 930, 2) + '<div data-role="list" style="margin-top:40px">' + rows + '</div>');
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
  };
  def({ id: 'hx-list', kind: 'list', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5 && sh.items.reduce((k, m) => k + m.label.length + (m.detail || '').length, 0) <= 380, render: listRender });
  def({ id: 'hx-photolist', kind: 'photoList', systems: SYS, fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5 && sh.items.reduce((k, m) => k + m.label.length + (m.detail || '').length, 0) <= 380, render: listRender });

  // ── ТІРЕКТЕР («Key pillars», қараңғы): сол жақта ақ тақырып, оң жақта бір кең екпін карточка + астында қою және ақ ──
  def({
    id: 'hx-pillars', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length === 3 && sh.items.every((m) => m.label.length <= 50 && (m.detail || '').length <= 170),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const x0 = 820; const R = W - 110; const gap = 40;
      const cw = (R - x0 - gap) / 2;
      const boxes = [[x0 + 20, 120, R - x0 - 20, 330, p.accent, '#fff'], [x0, 500, cw, 470, p.accent2, '#fff'], [x0 + cw + gap, 500, cw, 470, '#ffffff', '#000']];
      let bg = darkBg(ctx); let fg = '<div class="hx-on">' + wrap(LX, 280, 620, head(ctx, 620, 4, [88, 78, 68, 60, 52]) + sub(a.subtitle, 30, 'rgba(255,255,255,.88)')) + '</div>';
      sh.items.forEach((m, i) => {
        const [x, y, w, h, fill, ink] = boxes[i];
        const c = card(x, y, w, h, fill, '<div style="' + fs(32) + ';line-height:1.25;font-weight:700">' + esc(m.label) + '</div>' + (m.detail ? '<div style="margin-top:16px;' + fs(28) + ';line-height:1.5;opacity:.92">' + esc(m.detail) + '</div>' : ''), ink);
        bg += c.bg; fg += t('concept', x + 40, y + 36, w - 80, c.fg, 'max-height:' + (h - 60) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
    },
  });

  // ── АРТЫҚШЫЛЫҚТАР («Benefits», қараңғы): ортада ақ тақырып, төменде 2–4 екпін карточка ──
  def({
    id: 'hx-benefits', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => m.label.length <= 44 && (m.detail || '').length <= 150),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.items.length; const gap = 40; const x0 = 130; const w = (W - 2 * x0 - gap * (n - 1)) / n;
      const longD = Math.max(...sh.items.map((m) => (m.detail || '').length)); const ch = longD <= 60 ? 380 : longD <= 110 ? 450 : 520;
      const tTop = twoLines(a.title, 1500) ? 470 : 380; const top = Math.max(tTop, Math.round((HH - ch) / 2 + 120)); const used = new Set();
      let bg = darkBg(ctx);
      let fg = '<div class="hx-on">' + t('title', 160, 110, W - 320, '<div style="text-align:center">' + head(ctx, W - 320, 2, [88, 78, 68, 60, 52]) + (a.subtitle ? '<div style="margin-top:22px;' + fs(30) + ';font-weight:700;color:rgba(255,255,255,.9)">' + esc(a.subtitle) + '</div>' : '') + '</div>') + '</div>';
      sh.items.forEach((m, i) => {
        const x = x0 + i * (w + gap);
        const ic = icon(ctx, m.label + ' ' + (m.detail || ''), used) || { name: 'circle-check' }; used.add(ic.name);
        bg += P.div(P.pos(x, top, w, ch) + ';background:' + p.accent + ';border-radius:22px') +
          hex(x + 36, top + 36, 92, '#ffffff') + P.div(P.pos(x + 60, top + 54, 44, 44), '<img alt="" src="' + D.iconUri(ic.name, p.accent, 1.6) + '" style="width:100%;height:100%">');
        fg += t('concept', x + 36, top + 160, w - 72, '<div style="color:#fff"><div style="' + fs(n > 3 ? 35 : 38) + ';line-height:1.25;font-weight:700">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:14px;' + fs(n > 3 ? 29 : 32) + ';line-height:1.5;opacity:.92">' + esc(m.detail) + '</div>' : '') + '</div>', 'max-height:' + (ch - 190) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
    },
  });

  // ── САНДАР: тақырып, екпін/қою алтыбұрыштардағы ақ сандар, астында түсініктеме ──
  def({
    id: 'hx-stats', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 4 && sh.stats.every((s) => String(s.value).length <= 9 && String(s.label || '').length <= 70),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.stats.length; const span = W - 2 * 140; const w = span / n; const hw = Math.min(360, w - 40);
      const y = (twoLines(a.title, 1500) ? 440 : 340) + (a.subtitle ? 50 : 0);
      let bg = plate + P.div(P.pos(0, 0, W, HH) + ';background:#000;clip-path:polygon(' + (W - 380) + 'px 0,' + W + 'px 0,' + W + 'px 300px)') + P.div(P.pos(0, 0, W, HH) + ';background:' + p.accent + ';clip-path:polygon(0 ' + (HH - 220) + 'px,0 ' + HH + 'px,420px ' + HH + 'px)');
      let fg = brand(ctx) + wrap(LX, 180, 1500, head(ctx, 1500, 2) + (a.subtitle ? '<div style="margin-top:18px;' + fs(32) + ';font-weight:700;color:var(--text)">' + esc(a.subtitle) + '</div>' : ''));
      sh.stats.forEach((s, i) => {
        const cx = 140 + w * i + w / 2; const v = String(s.value); const vs = Math.min(92, Math.floor(hw * 0.8 / (v.length * 0.62)));
        bg += hex(cx - hw / 2, y, hw, i % 2 ? p.accent2 : p.accent);
        fg += t('stat', cx - hw / 2 + 20, y + hw * 0.87 / 2 - vs * 0.6, hw - 40, '<div style="text-align:center;font-weight:700;' + fs(vs) + ';line-height:1.1;color:#fff;white-space:nowrap">' + esc(v) + '</div>');
        fg += t('stat', cx - w / 2 + 20, y + hw * 0.87 + 30, w - 40, '<div style="text-align:center;' + fs(30) + ';line-height:1.4;color:var(--text)">' + esc(s.label || '') + '</div>', 'max-height:' + (HH - y - hw * 0.87 - 60) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
    },
  });

  // ── ҚАДАМДАР / УАҚЫТ СЫЗЫҒЫ: көлденең алтыбұрыштар тізбегі, арасы сызық, астында мәтін ──
  const stepsRender = (ctx, sh) => {
    const a = ctx.a; const p = ctx.palette; const n = sh.items.length; const span = W - 2 * 110; const w = span / n; const hw = 180;
    const y = twoLines(a.title, 1500) ? 470 : 400;
    let bg = plate + P.panel(110 + w / 2, y + hw * 0.87 / 2 - 3, span - w, 6, P.mix('#ffffff', p.accent, 0.35));
    let fg = brand(ctx) + wrap(LX, 180, 1500, head(ctx, 1500, 2));
    sh.items.forEach((m, i) => {
      const cx = 110 + w * i + w / 2; const mark = m.date || String(i + 1).padStart(2, '0'); const ms = Math.min(52, Math.floor(hw * 0.78 / (String(mark).length * 0.64)));
      bg += hex(cx - hw / 2, y, hw, i % 2 ? p.accent2 : p.accent);
      fg += t('row', cx - hw / 2, y + hw * 0.87 / 2 - ms * 0.62, hw, '<div style="text-align:center;font-weight:700;' + fs(ms) + ';line-height:1.2;color:#fff;white-space:nowrap">' + esc(mark) + '</div>');
      fg += t('row', cx - w / 2 + 16, y + hw * 0.87 + 34, w - 32, '<div style="text-align:center"><div style="' + fs(n > 4 ? 32 : 38) + ';line-height:1.25;font-weight:700;color:var(--text)">' + esc(m.label || '') + '</div>' +
        (m.detail ? '<div style="margin-top:12px;' + fs(n > 4 ? 27 : 31) + ';line-height:1.45;color:var(--text2)">' + esc(m.detail) + '</div>' : '') + '</div>', 'max-height:' + (HH - y - hw - 80) + 'px');
    });
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
  };
  def({ id: 'hx-steps', kind: 'process', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5, render: stepsRender });
  def({ id: 'hx-timeline', kind: 'timeline', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5 && sh.items.every((m) => String(m.date || '').length <= 9), render: stepsRender });

  // ── САЛЫСТЫРУ: екі карточка — қою (ақ мәтін) және ақ, жиегі екпін түсті ──
  def({
    id: 'hx-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 5 && sh.right.rows.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const x0 = 110; const gap = 50; const w = (W - 2 * x0 - gap) / 2; const top = twoLines(ctx.a.title, 1500) ? 430 : 350;
      const n = Math.max(sh.left.rows.length, sh.right.rows.length); const size = n > 4 ? 30 : 36;
      const bg = plate + P.div(P.pos(x0, top, w, HH - top - 70) + ';background:' + p.accent2 + ';border-radius:22px') + P.div(P.pos(x0 + w + gap, top, w, HH - top - 70) + ';background:#fff;border:4px solid ' + p.accent + ';border-radius:22px;box-sizing:border-box');
      const col = (c, ink, dot) => '<div style="' + fs(36) + ';font-weight:700;line-height:1.2;color:' + ink + ';text-transform:uppercase">' + esc(c.head) + '</div><div style="height:22px"></div>' +
        c.rows.map((r) => '<div data-role="row" style="display:flex;gap:18px;align-items:flex-start;padding:10px 0"><span style="flex:none;width:22px;height:19px;margin-top:' + Math.round(size * 0.42) + 'px;background:' + dot + ';' + HEX + '"></span><div style="' + fs(size) + ';line-height:1.4;color:' + ink + '">' + esc(r) + '</div></div>').join('');
      const fg = brand(ctx) + wrap(LX, 180, 1500, head(ctx, 1500, 2)) + t('side', x0 + 50, top + 46, w - 100, col(sh.left, '#fff', p.accent === p.accent2 ? '#fff' : P.mix(p.accent, '#ffffff', 0.5))) + t('side', x0 + w + gap + 50, top + 46, w - 100, col(sh.right, '#000', p.accent));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
    },
  });

  // ── БӨЛІМ: қараңғы фон, ірі екпін нөмір мен ақ тақырып, оң жақта алтыбұрыштар ──
  def({
    id: 'hx-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const num = String((ctx.plan && ctx.plan.section) || a.index).padStart(2, '0');
      const bg = P.panel(0, 0, W, HH, p.accent2) + hexPhoto(ctx, 1080, 200, 640) + hex(1010, 640, 150, p.accent) + hex(1600, 110, 130, p.accent) + hex(1600, 780, 200, '#000');
      const fg = '<div class="hx-on">' + wrap(LX, 270, 860, '<div style="font-weight:700;font-size:170px;line-height:1;color:' + P.mix(p.accent, '#ffffff', 0.45) + '">' + esc(num) + '</div><div style="height:26px"></div>' +
        H.titleH1(ctx, a.title, { role: 'display', width: 720, maxLines: 3, scale: [100, 88, 78, 68, 60], hl: false }) + (a.subtitle ? '<div style="margin-top:26px;' + fs(32) + ';font-weight:700;color:rgba(255,255,255,.88)">' + esc(a.subtitle) + '</div>' : '')) + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
    },
  });

  // ── ДӘЙЕКСӨЗ: ақ фон, екпін алтыбұрыштағы тырнақша, қара ірі мәтін, автор — қою жолақ ──
  def({
    id: 'hx-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 220,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette;
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = plate + hex(LX, 190, 170, p.accent) + P.div(P.pos(LX, 196, 170, 148) + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:150px;line-height:1;color:#fff', '“') + cluster(ctx, 1240, 240, 480);
      const fg = t('title', LX, 420, 1060, '<div style="font-weight:700;' + fs(text.length <= 90 ? 58 : text.length <= 150 ? 48 : 40) + ';line-height:1.3;color:#000">' + esc(text) + '</div>') +
        (who ? t('lead', LX, 850, 900, '<div style="display:inline-block;padding:16px 34px;border-radius:26px;background:' + p.accent2 + ';color:#fff;' + fs(30) + ';font-weight:700">' + esc(who) + '</div>') : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
    },
  });

  // ── ҚОРЫТЫНДЫ («Thank you» тілі): тақырып, қою жолақтардағы түйіндер (ақ дөңгелек белгіше), оң жақта топтама ──
  def({
    id: 'hx-closing', kind: 'closing', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const n = sh.items.length; const size = n > 4 ? 28 : 32; const used = new Set();
      const rows = sh.items.map((m) => {
        const ic = icon(ctx, m.label + ' ' + (m.detail || ''), used) || { name: 'circle-check' }; used.add(ic.name);
        return '<div data-role="row" style="display:flex;gap:20px;align-items:center;margin:12px 0;padding:12px 26px 12px 14px;border-radius:40px;background:' + p.accent2 + '">' +
          '<span style="flex:none;width:52px;height:52px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center"><img alt="" src="' + D.iconUri(ic.name, p.accent, 1.6) + '" style="width:30px;height:30px"></span>' +
          '<div style="' + fs(size) + ';line-height:1.3;font-weight:700;color:#fff">' + esc(m.label) + (m.detail ? '<span style="font-weight:400;opacity:.85"> — ' + esc(m.detail) + '</span>' : '') + '</div></div>';
      }).join('');
      const bg = plate + cluster(ctx, 1150, 190, 560);
      const fg = brand(ctx) + wrap(LX, 190, 900, head(ctx, 900, 2, [110, 96, 84, 74, 64]) + '<div data-role="list" style="margin-top:40px">' + rows + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide hx-slide' };
    },
  });
};
