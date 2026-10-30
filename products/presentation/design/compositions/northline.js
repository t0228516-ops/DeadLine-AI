'use strict';
/**
 * «NORTHLINE» (ақ корпоратив) композициялары — Canva «Science Project / Northline» шаблонының ӨЛШЕНГЕН торы
 * (1920×1080): Montserrat Bold 107 px тақырып (мұқабада 173 px), Open Sans 33 px мәтін, қою көк #0F172A «чиптер»
 * (ақ жартылай қалың жазу), көк шаршыдағы «01» нөмірлер, тақырып тұсында сол жиекте көк тік белгі, оң жақ төменгі
 * шетте жасыл-лайм сызық, фото — тік бұрышты, шетке дейін. Шаблонның файлдары қолданылмайды (тек тор мен өлшем).
 */
module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, MX, MT, MB, W, HH } = K;
  const SYS = ['northline'];
  const D = require('../decor');
  const tone = (p) => ({ NAVY: p.accent, POP: p.accent2 || '#a3e635', INK: p.text, BG: p.bg });
  const plate = '<div class="plate"></div>';
  // тақырып тұсындағы көк тік белгі (x0, 7×71) + оң жақ төменгі лайм сызық (700×8)
  const marks = (p, o = {}) => P.panel(0, o.tickY || 108, 10, 88, tone(p).NAVY) + (o.noLine ? '' : P.panel(W - 700, HH - 8, 700, 8, tone(p).POP));
  const head = (ctx, w = 1100, lines = 2) => H.titleH1(ctx, ctx.a.title, { width: w, maxLines: lines, scale: [107, 96, 86, 76, 66], hl: false });
  const chip = (txt) => '<div data-role="kicker" class="nl-chip" style="display:inline-block;padding:9px 24px;' + fs(30) + ';font-weight:700;line-height:1.2">' + esc(txt) + '</div>';
  const numSq = (n) => '<span class="nl-num" style="flex:none;width:64px;height:56px;display:flex;align-items:center;justify-content:center;' + fs(27) + ';font-weight:700">' + esc(n) + '</span>';
  const row = (ctx, i, m, size = 33) => '<div data-role="row" style="display:flex;gap:26px;align-items:flex-start;padding:12px 0">' + numSq(H.num(ctx, i + 1)) +
    '<div style="padding-top:4px"><div style="' + fs(size) + ';line-height:1.3;font-weight:700;color:var(--text)">' + esc(m.label) + '</div>' +
    (m.detail ? '<div style="margin-top:4px;' + fs(size - 5) + ';line-height:1.45;color:var(--text2)">' + esc(m.detail) + '</div>' : '') + '</div></div>';
  const body = (txt, size = 33) => '<div style="' + fs(size) + ';line-height:1.55;color:var(--text)">' + esc(txt) + '</div>';
  const photo = (a, p, x, y, w, h) => P.div(P.pos(x, y, w, h) + ';overflow:hidden', I.imgTag(a.photo, a.img, p, { focus: a.focus }));
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);
  // фото жоқ жерге: қою көк алаң + мағынасына сай ірі ақ белгіше (Lucide)
  const iconPanel = (ctx, x, y, w, h) => {
    const p = ctx.palette; const s = ctx.a;
    const ic = D.pickIconDecor(ctx.deckTitle + ' ' + s.title + ' ' + (s.subtitle || ''), new Set(), 1)[0];
    return P.panel(x, y, w, h, tone(p).NAVY) + (ic ? P.div(P.pos(x + w / 2 - 150, y + h / 2 - 150, 300, 300), '<img alt="" src="' + D.iconUri(ic.name, '#ffffff', 1) + '" style="width:100%;height:100%;opacity:.9">') : '');
  };
  const label = (ctx, fallback) => H.sectionLabel(ctx) || fallback;

  // ── МҰҚАБА: сол жақта қою көк алаң (сол жиегінде лайм сызық, жоғарғы бұрышта лайм «құлақша»), оң жақта фото ──
  def({
    id: 'nl-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p); const ph = hasP(a, 800);
      const pw = ph ? 1067 : W;
      const { metaHtml } = H.coverParts(ctx);
      let bg = plate + (ph ? photo(a, p, pw, 0, W - pw, HH) : '') + P.panel(0, 0, pw, HH, c.NAVY) + P.panel(0, 0, 8, HH, c.POP) + P.panel(pw - 50, 0, 50, 104, c.POP);
      if (!ph) {
        const ic = D.pickIconDecor(ctx.deckTitle + ' ' + (a.subtitle || ''), new Set(), 1)[0];
        bg += P.div(P.pos(1300, 300, 440, 440) + ';border:8px solid ' + c.POP) +
          (ic ? P.div(P.pos(1370, 370, 300, 300), '<img alt="" src="' + D.iconUri(ic.name, '#ffffff', 1) + '" style="width:100%;height:100%">') : '');
      }
      const lab = label(ctx, '');
      const fg = '<div class="nl-on-navy">' +
        (lab ? wrap(139, 120, 700, '<div data-role="kicker" style="display:inline-block;border:2px solid #fff;padding:6px 18px;' + fs(24) + ';font-weight:700;color:#fff">' + esc(lab) + '</div>') : '') +
        wrap(MX, 250, ph ? 880 : 1060, H.titleH1(ctx, a.title, { role: 'display', width: ph ? 880 : 1060, maxLines: 4, scale: [150, 130, 112, 96, 84, 72], hl: false }) +
          H.lead(ctx, a.subtitle, 30, { maxw: 780 })) +
        '<div style="position:absolute;left:139px;bottom:' + MB + 'px;width:' + (ph ? 860 : 1060) + 'px">' + metaHtml + '</div></div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover nl-slide' };
    },
  });

  // ── ТҰЖЫРЫМ (2-слайд «Introduction»): жоғарыда тақырып, төменде абзац, оң жақта шетке дейін фото ──
  def({
    id: 'nl-intro', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length >= 20 && sh.text.length <= 460,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const ph = hasP(a, 600);
      const bg = plate + marks(p, { tickY: 96 }) + (ph ? photo(a, p, 1180, 0, W - 1180, HH) : iconPanel(ctx, 1180, 0, W - 1180, HH)) + P.panel(1180, HH - 8, W - 1180, 8, tone(p).POP);
      const fg = wrap(MX, MT, 960, head(ctx, 960, 3)) + t('text', MX, 560, 900, body(sh.text, sh.text.length <= 220 ? 34 : 29), 'max-height:' + (HH - 560 - MB) + 'px');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
    },
  });

  // ── ТІЗІМ (3-слайд «Objectives»): сол жақта тақырып + чип, оң жақта чип пен нөмірлі қатарлар ──
  def({
    id: 'nl-objectives', kind: 'list', systems: SYS,
    fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.items.length;
      const bg = plate + marks(p, { tickY: 96 });
      const fg = wrap(MX, MT, 860, head(ctx, 860, 3) + (a.subtitle ? '<div style="margin-top:40px">' + body(a.subtitle, 30) + '</div>' : '')) +
        t('list', 1000, 200, W - 1000 - MX, chip(label(ctx, 'Негізгі тұстар')) + '<div style="height:24px"></div>' + sh.items.map((m, i) => row(ctx, i, m, n > 4 ? 30 : 34)).join(''));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
    },
  });

  // ── ФОТО + ТІЗІМ (4-слайд «Research Question»): тақырып, астында фото; оң жақта чип + нөмірлі қатарлар ──
  def({
    id: 'nl-photolist', kind: 'photoList', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.items.length;
      const bg = plate + marks(p, { tickY: 128 }) + (hasP(a, 500) ? photo(a, p, MX, 400, 780, HH - 400 - 120) : iconPanel(ctx, MX, 400, 780, HH - 400 - 120));
      const fg = wrap(MX, 128, 820, head(ctx, 820, 2)) +
        t('list', 1000, 128, W - 1000 - MX, chip(label(ctx, 'Негізгі тұстар')) + '<div style="height:24px"></div>' + sh.items.map((m, i) => row(ctx, i, m, n > 4 ? 29 : 32)).join(''));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
    },
  });

  // ── ҰҒЫМДАР (5-слайд «Hypothesis»): тақырып, кең фото-жолақ, астында бағандар — әрқайсысы чип + мәтін ──
  def({
    id: 'nl-columns', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => m.label.length <= 40 && (m.detail || '').length <= 140),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.items.length; const ph = hasP(a, 900);
      const gap = 56; const span = W - 2 * MX; const w = (span - gap * (n - 1)) / n; const y = ph ? 690 : 520;
      let bg = plate + marks(p, { tickY: 128 });
      if (ph) bg += photo(a, p, MX, 300, span, 300);
      let fg = wrap(MX, 128, 1400, head(ctx, 1400, 2));
      sh.items.forEach((m, i) => {
        const x = MX + i * (w + gap);
        fg += t('concept', x, y, w, chip(m.label) + (m.detail ? '<div style="margin-top:22px">' + body(m.detail, n > 3 ? 29 : 33) + '</div>' : ''), 'max-height:' + (HH - y - MB) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
    },
  });

  // ── КЕЗЕҢДЕР / УАҚЫТ СЫЗЫҒЫ (6-слайд «Methodology»): сол жақта тақырып, оң жақта нөмірлі (не жылды) қатарлар ──
  const stepsRender = (ctx, sh) => {
    const a = ctx.a; const p = ctx.palette; const n = sh.items.length;
    const bg = plate + marks(p, { tickY: 128 });
    const rows = sh.items.map((m, i) => {
      const n0 = m.date ? '<span class="nl-num" style="flex:none;min-width:58px;padding:0 12px;height:56px;display:flex;align-items:center;justify-content:center;' + fs(27) + ';font-weight:700">' + esc(m.date) + '</span>' : numSq(H.num(ctx, i + 1));
      return '<div data-role="row" style="display:flex;gap:26px;align-items:flex-start;padding:12px 0">' + n0 + '<div style="padding-top:4px"><div style="' + fs(n > 4 ? 30 : 34) + ';line-height:1.3;font-weight:700;color:var(--text)">' + esc(m.label || '') + '</div>' +
        (m.detail ? '<div style="margin-top:4px;' + fs(n > 4 ? 25 : 28) + ';line-height:1.45;color:var(--text2)">' + esc(m.detail) + '</div>' : '') + '</div></div>';
    }).join('');
    const fg = wrap(MX, 128, 800, head(ctx, 800, 3) + (a.subtitle ? '<div style="margin-top:40px">' + body(a.subtitle, 28) + '</div>' : '')) +
      t('list', 1000, 128, W - 1000 - MX, chip(label(ctx, sh.kind === 'timeline' ? 'Хронология' : 'Кезеңдер')) + '<div style="height:24px"></div>' + rows);
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
  };
  def({ id: 'nl-steps', kind: 'process', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 6, render: stepsRender });
  def({ id: 'nl-timeline', kind: 'timeline', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5, render: stepsRender });

  // ── САНДАР: ірі Montserrat цифрлар, астында чип-белгі ──
  def({
    id: 'nl-stats', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 4 && sh.stats.every((s) => String(s.value).length <= 9 && String(s.label || '').length <= 70),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const n = sh.stats.length;
      const gap = 56; const span = W - 2 * MX; const w = (span - gap * (n - 1)) / n;
      const longest = Math.max(...sh.stats.map((s) => String(s.value).length));
      const size = Math.min(n <= 3 ? 150 : 120, Math.floor(w / (longest * 0.7)));
      const bg = plate + marks(p, { tickY: 128 });
      let fg = wrap(MX, 128, 1400, head(ctx, 1400, 2) + H.lead(ctx, a.subtitle, 28, { maxw: 1100 }));
      sh.stats.forEach((s, i) => {
        const x = MX + i * (w + gap);
        fg += t('stat', x, 520, w, '<div style="font-family:var(--f-display);' + fs(size) + ';line-height:1;letter-spacing:-.02em;color:var(--accent)">' + esc(s.value) + '</div>' +
          '<div style="width:80px;height:8px;margin:26px 0 22px" class="nl-pop"></div>' + body(s.label || '', 27));
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
    },
  });

  // ── САЛЫСТЫРУ: екі баған, әрқайсысының басы — қою көк чип ──
  def({
    id: 'nl-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 5 && sh.right.rows.length <= 5,
    render(ctx, sh) {
      const p = ctx.palette; const span = W - 2 * MX; const w = (span - 80) / 2;
      const bg = plate + marks(p, { tickY: 128 }) + P.panel(MX + w + 39, 420, 2, 520, P.mix(p.bg, p.text, 0.15));
      const col = (c) => chip(c.head) + '<div style="height:20px"></div>' + c.rows.map((r) => '<div data-role="row" style="padding:12px 0;border-bottom:1px solid ' + P.mix(p.bg, p.text, 0.12) + '">' + body(r, 32) + '</div>').join('');
      const fg = wrap(MX, 128, 1400, head(ctx, 1400, 2)) + t('side', MX, 420, w, col(sh.left)) + t('side', MX + w + 80, 420, w, col(sh.right));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
    },
  });

  // ── БӨЛІМ: толық қою көк, лайм сызық пен «құлақша», алып ақ тақырып ──
  def({
    id: 'nl-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p);
      const num = String((ctx.plan && ctx.plan.section) || a.index).padStart(2, '0');
      const bg = plate + P.panel(0, 0, W, HH, c.NAVY) + P.panel(0, 0, 8, HH, c.POP) + P.panel(W - 300, 0, 60, 120, c.POP) +
        P.div(P.pos(1180, 260, 600, 560) + ';display:flex;align-items:center;justify-content:center;font-family:var(--f-display);font-size:420px;line-height:1;color:transparent;-webkit-text-stroke:3px ' + c.POP, esc(num));
      const fg = '<div class="nl-on-navy">' + wrap(MX, 330, 1050, H.titleH1(ctx, a.title, { role: 'display', width: 1050, maxLines: 3, scale: [150, 128, 110, 96], hl: false }) + H.lead(ctx, a.subtitle, 32, { maxw: 900 })) + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
    },
  });

  // ── ДӘЙЕКСӨЗ: қою көк фон, лайм тырнақша, ақ Montserrat ──
  def({
    id: 'nl-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 220,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p);
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = plate + P.panel(0, 0, W, HH, c.NAVY) + P.panel(0, 0, 8, HH, c.POP) +
        P.div(P.pos(MX - 10, 120, 300, 300) + ';font-family:var(--f-display);font-size:340px;line-height:1;color:' + c.POP, '“');
      const fg = '<div class="nl-on-navy">' + t('title', MX, 420, 1500, '<div style="font-family:var(--f-display);' + fs(text.length <= 100 ? 64 : 50) + ';line-height:1.18;color:#fff">' + esc(text) + '</div>') +
        (who ? t('lead', MX, 860, 900, '<div style="' + fs(28) + ';font-weight:700;letter-spacing:.08em;color:' + c.POP + '">— ' + esc(who) + '</div>') : '') + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
    },
  });

  // ── ҚОРЫТЫНДЫ (12-слайд «Conclusion»): тақырып, кең фото-жолақ, астында екі бағандағы нөмірлі түйіндер ──
  def({
    id: 'nl-closing', kind: 'closing', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const ph = hasP(a, 900); const span = W - 2 * MX;
      let bg = plate + marks(p, { tickY: 96 });
      if (ph) bg += photo(a, p, MX, 270, span, 260);
      const y = ph ? 590 : 330; const w = (span - 80) / 2; const half = Math.ceil(sh.items.length / 2);
      const col = (list, off) => list.map((m, i) => row(ctx, i + off, m, 32)).join('');
      const fg = wrap(MX, MT, 1400, head(ctx, 1400, 2)) +
        t('list', MX, y, w, chip(label(ctx, 'Қорытынды')) + '<div style="height:16px"></div>' + col(sh.items.slice(0, half), 0)) +
        t('list', MX + w + 80, y + 66, w, col(sh.items.slice(half), half));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide nl-slide' };
    },
  });
};
