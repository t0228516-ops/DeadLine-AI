'use strict';
/**
 * «БОРДО» (bordeaux) жүйесінің композициялары — Canva «Red Beige Vintage History» шаблонының ӨЛШЕНГЕН торы
 * (1920×1080-ге келтірілген координаталар, қаріп өлшемдері). Шаблонның өз файлдары қолданылмайды:
 *   • қаріп — Playfair (OFL, 172 px тақырып, жоларалық .86) + Inter (26–33 px мәтін);
 *   • фон — қою шарап #33020A, үстінде біздің CC0 гравюра-қала (12% мөлдір), жоғарғы бұрыштарда жіңішке жақтау;
 *   • «Presented by» пилюлясы (354×38, 28 px) → біздің kicker; карточкалар — шабдалы #FCD0A7, мәтіні шарап түсті;
 *   • «мүсін» орнына — тақырыпқа сай ірі гравюра (decorPick/visualFor), шабдалы сызба түсінде.
 */
const path = require('path');

module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, wrapB, MX, MB, W, HH } = K;
  const SYS = ['bordeaux'];
  const D = require('../decor');
  const ENG = path.join(__dirname, '..', '..', 'assets', 'library', 'engravings');
  const TEXTURES = ['old-town-square-1.webp', 'ancient-temple-ruins-1.webp', 'ancient-temple-ruins-2.webp', 'ancient-temple-by-river-1.webp'];
  const tone = (p) => ({ BG: p.bg, PEACH: p.accent, GOLD: p.accent2 || p.accent, BODY: p.text });

  // гравюра-қала фактурасы: шаблондағыдай слайдтың төменгі бөлігінде, шабдалы сызба, мөлдір
  const texture = (a, x, y, w, h) => {
    const uri = D.decorUri(path.join(ENG, TEXTURES[a.index % TEXTURES.length]));
    return uri ? P.div(P.pos(x, y, w, h) + ';opacity:.13', '<img alt="" src="' + uri + '" class="bx-line" style="width:100%;height:100%;object-fit:cover;object-position:50% 70%">') : '';
  };
  // жоғарғы бұрыштардағы жіңішке қос сызық (шаблон: 234×234, x95/x1591, y56)
  const corners = (p) => {
    const c = tone(p).PEACH;
    const L = (x, flip) => P.div(P.pos(x, 56, 234, 234) + ';' + (flip ? 'transform:scaleX(-1)' : ''),
      '<svg viewBox="0 0 234 234" width="234" height="234"><g fill="none" stroke="' + c + '" stroke-width="2" opacity=".75"><path d="M2 232V2h230"/><path d="M22 232V22h210" stroke-width="1"/></g></svg>');
    return L(95, false) + L(1591, true);
  };
  // «мүсін»: тақырыпқа сай ірі гравюра, шабдалы сызба (CSS: .bx-hero)
  const hero = (ctx, env, x, y, w, h, seed) => {
    const v = P.visualFor(ctx.deckTitle + ' ' + ctx.a.title, ctx.sys, ctx.palette, env.used, ctx.a.index + seed, { stroke: 0.9 });
    return v ? P.div(P.pos(x, y, w, h), '<img alt="" src="' + v.uri + '" class="bx-hero" style="width:100%;height:100%;object-fit:contain;object-position:50% 100%">') : '';
  };
  const pill = (ctx) => H.kicker(ctx, H.sectionLabel(ctx) || '');
  const plate = '<div class="plate"></div>';
  const photoBox = (a, p, x, y, w, h) => P.div(P.pos(x, y, w, h) + ';border-radius:16px;overflow:hidden;border:3px solid ' + tone(p).PEACH, I.imgTag(a.photo, a.img, p, { focus: a.focus }));
  const body = (txt, size) => '<div style="' + fs(size) + ';line-height:1.5;color:var(--text)">' + esc(txt) + '</div>';
  const title = (ctx, text, width, lines, scale, extra = {}) => H.titleH1(ctx, text, Object.assign({ role: 'display', width, maxLines: lines, scale, hl: false }, extra));
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);

  // ── МҰҚАБА (1-слайд): ортада алып тақырып, астында гравюра, фонда қала; фото болса — 2-слайд торы ──
  def({
    id: 'bx-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx, sh, env) {
      const a = ctx.a; const p = ctx.palette;
      const { metaHtml } = H.coverParts(ctx);
      if (hasP(a, 700)) {
        const bg = plate + texture(a, 0, 560, W, 520) + corners(p) + photoBox(a, p, 1070, 150, 700, 560);
        const fg = wrap(142, 186, 860, pill(ctx) + '<div style="height:40px"></div>' + title(ctx, a.title, 860, 4, [150, 132, 116, 100, 88, 76]) + H.lead(ctx, a.subtitle, 30, { maxw: 800 })) +
          '<div style="position:absolute;left:142px;bottom:' + MB + 'px;width:900px">' + metaHtml + '</div>';
        return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover bx-slide' };
      }
      const bg = plate + texture(a, 0, 460, W, 620) + corners(p) + hero(ctx, env, 780, 700, 360, 380, 3);
      const fg = wrap(260, 112, 1400, '<div style="text-align:center">' + pill(ctx) + '</div><div style="height:26px"></div>' +
        title(ctx, a.title, 1400, 3, [180, 156, 136, 118, 100, 88], { cls: 'center' }) + H.lead(ctx, a.subtitle, 30, { maxw: 1100, cls: 'cx-center' })) +
        '<div style="position:absolute;left:' + MX + 'px;bottom:' + MB + 'px;width:560px">' + metaHtml + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover bx-slide' };
    },
  });

  // ── ТҰЖЫРЫМ (2-слайд «Project Introduction»): сол жақта алып тақырып, оң жақ жоғарыда жақтаулы фото, астында мәтін ──
  def({
    id: 'bx-intro', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length >= 20 && sh.text.length <= 420,
    render(ctx, sh, env) {
      const a = ctx.a; const p = ctx.palette; const ph = hasP(a, 600);
      let bg = plate + texture(a, 760, 520, 1160, 560) + corners(p);
      bg += ph ? photoBox(a, p, 1170, 160, 600, 420) : hero(ctx, env, 1180, 120, 600, 520, 7);
      // абзац тақырыптың астынан басталады (бұрын әрқашан y=700 — арасы бос) және өз қорабын толтырады (≤ ×1.3)
      const tl = String(a.title || '').length; const top = tl <= 12 ? 500 : tl <= 30 ? 570 : 630;
      const fg = wrap(142, 186, 960, pill(ctx) + '<div style="height:60px"></div>' + title(ctx, a.title, 960, 3, [140, 120, 104, 90, 78])) +
        t('text', 142, top, 1000, body(sh.text, sh.text.length <= 200 ? 34 : 28), 'height:' + (HH - top - MB) + 'px;--fit-max:1.3');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide bx-slide' };
    },
  });

  // ── ТІЗІМ (5-слайд «Main Event» / 6-слайд «Causes»): фото не гравюра бір жақта, тақырып пен абзацтар екінші жақта ──
  const listRender = (ctx, sh, env) => {
    const a = ctx.a; const p = ctx.palette; const ph = hasP(a, 500); const n = sh.items.length;
    const items = sh.items.map((m) => '<div data-role="row" style="margin-bottom:' + (n > 4 ? 18 : 26) + 'px">' +
      '<div style="font-family:var(--f-display);' + fs(n > 4 ? 34 : 40) + ';line-height:1.1;color:var(--accent);margin-bottom:6px">' + esc(m.label) + '</div>' +
      (m.detail ? body(m.detail, n > 4 ? 24 : 27) : '') + '</div>').join('');
    let bg = plate + texture(a, ph ? 1000 : 0, 560, ph ? 920 : 1100, 520) + corners(p);
    // тізім қорабы — тақырыптың астынан шетке дейін: пункттер аз болса QA оларды өсіреді (≤ ×1.4)
    const listBox = 'height:' + (HH - 470 - MB) + 'px;--fit-max:1.4';
    let fg;
    if (ph) {
      bg += photoBox(a, p, 58, 380, 400, 380);
      fg = wrap(201, 123, 700, pill(ctx)) + wrap(520, 230, 1260, title(ctx, a.title, 1260, 2, [128, 112, 98, 86])) + t('list', 520, 470, 1240, items, listBox);
    } else {
      bg += hero(ctx, env, 1220, 300, 620, 780, 11);
      fg = wrap(201, 123, 700, pill(ctx)) + wrap(MX, 250, 1100, title(ctx, a.title, 1100, 2, [112, 98, 86, 76])) + t('list', MX, 470, 1040, items, listBox);
    }
    return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide bx-slide' };
  };
  def({ id: 'bx-list', kind: 'list', systems: SYS, fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5, render: listRender });
  def({ id: 'bx-photolist', kind: 'photoList', systems: SYS, fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 5, render: listRender });

  // ── ҰҒЫМДАР (4-слайд «Important Figures»): ортада тақырып, қатарда шабдалы карточкалар ──
  def({
    id: 'bx-cards', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => (m.detail || '').length <= 120),
    render(ctx, sh, env) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p); const n = sh.items.length;
      const gap = 40; const cw = Math.min(380, (W - 2 * 200 - gap * (n - 1)) / n); const x0 = (W - (cw * n + gap * (n - 1))) / 2; const y = 560;
      const cap = Math.min(...sh.items.map((m) => P.wordFit(m.label, 999, cw - 60, 'inter')));
      let bg = plate + texture(a, 0, 600, W, 480) + corners(p);
      let fg = wrap(260, 123, 1400, '<div style="text-align:center">' + pill(ctx) + '</div>') +
        wrap(260, 220, 1400, title(ctx, a.title, 1400, 2, [128, 112, 98, 86], { cls: 'center' }));
      sh.items.forEach((m, i) => {
        const x = x0 + i * (cw + gap);
        bg += P.panel(x, y, cw, 400, c.PEACH, 'border-radius:22px');
        fg += t('concept', x + 30, y + 34, cw - 60, '<div style="font-weight:700;' + P.fsMax(Math.min(36, cap), cap) + ';line-height:1.18;color:' + c.BG + ';text-align:center">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:16px;' + fs(24) + ';line-height:1.45;color:' + c.BG + ';opacity:.85;text-align:center">' + esc(m.detail) + '</div>' : ''), 'height:332px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide bx-slide' };
    },
  });

  // ── УАҚЫТ СЫЗЫҒЫ (3-слайд «Historical Timeline»): сол жақта алып тақырып + гравюра, оң жақта тік сызық пен алтын нүктелер ──
  def({
    id: 'bx-timeline', kind: 'timeline', systems: SYS,
    fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 4,
    render(ctx, sh, env) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p); const n = sh.items.length;
      const top = 150; const step = (HH - top - 120) / n;
      let bg = plate + texture(a, 0, 600, 1000, 480) + corners(p) + hero(ctx, env, 40, 620, 560, 460, 13) + P.panel(990, top - 30, 3, HH - top, c.PEACH);
      let fg = wrap(237, 186, 700, pill(ctx)) + wrap(144, 330, 800, title(ctx, a.title, 800, 3, [140, 120, 104, 90]));
      sh.items.forEach((m, i) => {
        const y = top + i * step;
        bg += P.div(P.pos(991 - 22, y + 4, 44, 44) + ';border-radius:50%;background:' + c.GOLD);
        // ені қауіпсіз шекараға дейін (бұрын 760 px — оң шекарадан 57 px шығып, QA бүкіл слайдты кішірейтетін)
        fg += t('event', 1057, y, W - MX - 1057, '<div style="font-family:var(--f-display);' + fs(46) + ';line-height:1;color:var(--accent);margin-bottom:8px">' + esc(m.date) + '</div>' +
          '<div style="font-weight:700;' + fs(28) + ';line-height:1.3;color:var(--text)">' + esc(m.label || '') + '</div>' +
          (m.detail ? '<div style="' + fs(24) + ';line-height:1.45;color:var(--text2)">' + esc(m.detail) + '</div>' : ''), 'max-height:' + Math.round(step - 16) + 'px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide bx-slide' };
    },
  });

  // ── САНДАР (8-слайд «Key Facts»): жоғарыда шабдалы жиекті қораптар, төменде алып тақырып ──
  def({
    id: 'bx-facts', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 4 && sh.stats.every((s) => String(s.value).length <= 10 && String(s.label || '').length <= 80),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p); const n = sh.stats.length;
      const gap = 40; const bw = (W - 2 * 160 - gap * (n - 1)) / n;
      let bg = plate + texture(a, 0, 600, W, 480) + corners(p);
      let fg = wrap(258, 123, 700, pill(ctx)) + wrapB(MX, MB, 1500, title(ctx, a.title, 1500, 2, [178, 150, 128, 110, 96]));
      // сипаттама (дереккөз, жыл) жоғалмасын: қораптардың үстінде, kicker-дің астында
      if (a.subtitle) fg += t('lead', 160, 226, 1600, '<div style="' + fs(30) + ';line-height:1.3;color:var(--text2)">' + esc(a.subtitle) + '</div>', 'max-height:80px');
      sh.stats.forEach((s, i) => {
        const x = 160 + i * (bw + gap);
        bg += P.div(P.pos(x, 316, bw, 300) + ';border:2px solid ' + c.PEACH + ';border-radius:6px');
        fg += t('stat', x + 34, 346, bw - 68, '<div style="font-family:var(--f-display);' + fs(String(s.value).length <= 5 ? 96 : 70) + ';line-height:1;color:var(--accent)">' + esc(s.value) + '</div>' +
          '<div style="margin-top:16px;' + fs(26) + ';line-height:1.42;color:var(--text)">' + esc(s.label || '') + '</div>', 'height:240px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide bx-slide' };
    },
  });

  // ── САЛЫСТЫРУ (8-слайд қораптары): екі жиекті қорап, тақырыбы астында ──
  def({
    id: 'bx-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 4 && sh.right.rows.length <= 4,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p); const bw = 820;
      let bg = plate + texture(a, 0, 640, W, 440) + corners(p);
      let fg = wrap(258, 123, 700, pill(ctx)) + wrapB(MX, MB, 1600, title(ctx, a.title, 1600, 2, [128, 112, 98, 86]));
      [[sh.left, MX], [sh.right, MX + bw + 60]].forEach(([col, x]) => {
        bg += P.div(P.pos(x, 316, bw, 400) + ';border:2px solid ' + c.PEACH + ';border-radius:6px');
        fg += t('side', x + 40, 346, bw - 80, '<div style="font-family:var(--f-display);' + fs(54) + ';line-height:1.05;color:var(--accent);margin-bottom:16px">' + esc(col.head) + '</div>' +
          col.rows.map((r) => '<div data-role="row" style="' + fs(26) + ';line-height:1.45;color:var(--text);padding:6px 0">' + esc(r) + '</div>').join(''), 'height:340px');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide bx-slide' };
    },
  });

  // ── БӨЛІМ: ортада пилюля + алып тақырып, астында гравюра ──
  def({
    id: 'bx-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx, sh, env) {
      const a = ctx.a; const p = ctx.palette;
      const bg = plate + texture(a, 0, 520, W, 560) + corners(p) + hero(ctx, env, 760, 600, 400, 480, 17);
      const fg = wrap(260, 170, 1400, '<div style="text-align:center">' + pill(ctx) + '</div><div style="height:30px"></div>' +
        title(ctx, a.title, 1400, 2, [172, 150, 128, 110], { cls: 'center' }) + H.lead(ctx, a.subtitle, 32, { maxw: 1100, cls: 'cx-center' }));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide bx-slide' };
    },
  });

  // ── ДӘЙЕКСӨЗ / ҚЫСҚА ОЙ (9-слайд «Lessons Learned»): жоғарыда мәтін, төменде алып тақырып ──
  def({
    id: 'bx-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 240,
    render(ctx, sh, env) {
      const a = ctx.a; const p = ctx.palette;
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = plate + texture(a, 760, 560, 1160, 520) + corners(p) + hero(ctx, env, 1240, 520, 560, 560, 19);
      const fg = wrap(258, 123, 700, pill(ctx)) +
        t('title', 166, 300, 1300, '<div style="font-family:var(--f-display);' + fs(text.length <= 100 ? 76 : 58) + ';line-height:1.14;color:var(--accent)">«' + esc(text) + '»</div>') +
        (who ? t('lead', 166, 860, 900, '<div style="' + fs(30) + ';letter-spacing:.16em;text-transform:uppercase;color:var(--text)">— ' + esc(who) + '</div>') : '');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide bx-slide' };
    },
  });

  // ── ҚОРЫТЫНДЫ (10-слайд «Conclusion»): алып тақырып, астында түйіндер, оң жақта гравюра ──
  def({
    id: 'bx-closing', kind: 'closing', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4,
    render(ctx, sh, env) {
      const a = ctx.a; const p = ctx.palette; const c = tone(p);
      const bg = plate + texture(a, 760, 560, 1160, 520) + corners(p) + hero(ctx, env, 1180, 300, 640, 780, 23);
      const rows = sh.items.map((m) => '<div data-role="row" style="display:flex;gap:22px;align-items:baseline;padding:10px 0"><span style="flex:none;width:16px;height:16px;border-radius:50%;background:' + c.GOLD + '"></span><div style="' + fs(32) + ';line-height:1.42;color:var(--text)">' +
        (m.detail ? '<b style="font-weight:700;color:var(--accent)">' + esc(m.label) + '</b> — ' + esc(m.detail) : esc(m.label)) + '</div></div>').join('');
      const fg = wrap(258, 123, 700, pill(ctx)) + wrap(155, 280, 1000, title(ctx, a.title, 1000, 2, [160, 136, 118, 100])) + t('list', 155, 560, 976, rows, 'height:' + (HH - 560 - MB) + 'px;--fit-max:1.4');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide bx-slide' };
    },
  });
};
