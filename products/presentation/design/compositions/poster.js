'use strict';
/**
 * «ПЛАКАТ» жүйесінің өз композициялары (Canva-ның батыл заманауи шаблондарынан үйренген, бөтен файлсыз):
 *   ірі тұтас түс блоктары (фонмен араластырылмайды), алып тақырып, бір-біріне кіретін пішіндер (шеңбер фото мен блокқа
 *   шығып тұрады), алып сандар, әр плитка — өз қанық түсі. Тек `systems: ['poster']` — басқа жүйеге түспейді.
 *
 * Түстер (жүйенің палитрасынан): A — негізгі қанық түс, B — қарсы түс, POP — «жарқыл» (сары/лайм/көгілдір), INK — қою мәтін.
 * Түс блогының үстіндегі мәтін түсі әрқашан контраст бойынша (P.inkOn) — оқылуы бұзылмайды.
 */
module.exports = function register(def, K) {
  const { P, H, I, esc, t, fs, wrap, MX, MT, MB, W, HH } = K;
  const SYS = ['poster'];
  const POP = { poster_blue: '#ffd400', poster_green: '#c6f432', poster_red: '#ffc21a', poster_violet: '#2ee6c5' };
  const colors = (p) => ({ A: p.accent, B: p.accent2 || p.accent, POP: POP[p.mood] || '#ffd400', INK: p.text });
  // блок ішіндегі мәтін: айнымалылар ауысады (title, lead, kicker бәрі var(--text)-ті қолданады)
  const onFill = (fill, p, inner, style = '') => {
    const k = P.inkOn(fill, p);
    return '<div class="pst-on" style="--text:' + k.hex + ';--text2:' + k.ink2 + ';--text3:' + k.ink2 + ';color:' + k.hex + ';' + style + '">' + inner + '</div>';
  };
  const box = (x, y, w, h, inner, extra = '') => '<div style="position:absolute;left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;width:' + Math.round(w) + 'px;height:' + Math.round(h) + 'px;display:flex;flex-direction:column;justify-content:center;' + extra + '">' + inner + '</div>';
  const circle = (cx, cy, r, color, extra = '') => P.div(P.pos(cx - r, cy - r, 2 * r, 2 * r) + ';border-radius:50%;background:' + color + ';' + extra);
  const ring = (cx, cy, r, color, wpx) => P.div(P.pos(cx - r, cy - r, 2 * r, 2 * r) + ';border-radius:50%;border:' + wpx + 'px solid ' + color);
  const photo = (a, p, x, y, w, h, extra = '') => P.div(P.pos(x, y, w, h) + ';overflow:hidden;' + extra, I.imgTag(a.photo, a.img, p, { focus: a.focus }));
  const big = (n, color, extra = '') => '<div style="font-family:var(--f-display);font-weight:800;' + fs(n) + ';line-height:.9;letter-spacing:-.05em;color:' + color + ';' + extra + '">';
  const hasP = (a, w) => a.hasPhoto && I.sharpEnough(a.img, w);

  // ───────── МҰҚАБА: сол жақта толық түсті блок + алып тақырып, оң жақта фото, шекарасында сары шеңбер ─────────
  def({
    id: 'poster-cover', kind: 'cover', systems: SYS,
    fits: () => true,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p);
      const ph = hasP(a, 1000);
      const bw = ph ? 1040 : W;
      const { metaHtml } = H.coverParts(ctx);
      let bg = '<div class="plate plate-cover"></div>';
      if (ph) bg += photo(a, p, 900, 0, W - 900, HH);
      bg += P.panel(0, 0, bw, HH, c.A) +
        circle(ph ? 1040 : 1700, ph ? 860 : 900, ph ? 230 : 420, c.POP) +
        (ph ? '' : ring(1700, 900, 600, P.mix(c.A, '#ffffff', 0.18), 3)) +
        P.panel(MX, 150, 120, 16, c.POP);
      const tw = ph ? 860 : 1300;
      const fg = wrap(MX, 220, tw, onFill(c.A, p,
        H.kicker(ctx, H.sectionLabel(ctx)) +
        H.titleH1(ctx, a.title, { role: 'display', width: tw, maxLines: 4, scale: [132, 116, 100, 88, 76, 66], hl: true }) +
        H.lead(ctx, a.subtitle, 34, { maxw: tw - 80 }))) +
        '<div style="position:absolute;left:' + MX + 'px;bottom:' + MB + 'px;width:' + (ph ? 760 : 1100) + 'px">' + onFill(c.A, p, metaHtml) + '</div>';
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide cx-cover pst-slide' };
    },
  });

  // ───────── ҰҒЫМДАР: әрқайсысы өз қанық түсіндегі биік плитка, алып нөмір ─────────
  def({
    id: 'poster-tiles', kind: 'concepts', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => m.label.length <= 34 && (m.detail || '').length <= 110),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p); const n = sh.items.length;
      const fills = [c.A, c.B, c.INK, c.POP];
      const gap = 24; const span = W - 2 * MX; const w = (span - gap * (n - 1)) / n; const y = 420; const h = HH - y - 90;
      const cap = Math.min(...sh.items.map((m) => P.wordFit(m.label, 999, w - 80, ctx.kind)));
      let bg = '<div class="plate"></div>' + circle(W - 40, 40, 190, c.POP);
      let fg = wrap(MX, MT, 1300, H.kicker(ctx, H.sectionLabel(ctx)) + H.titleH1(ctx, a.title, { width: 1300, maxLines: 2, scale: [84, 74, 64, 56, 50], hl: true }));
      sh.items.forEach((m, i) => {
        const x = MX + i * (w + gap); const f = fills[(i + a.index) % fills.length]; const k = P.inkOn(f, p);
        const yy = y + (i % 2 ? 50 : 0); const hh = h - (i % 2 ? 50 : 0);
        bg += P.panel(x, yy, w, hh, f, 'border-radius:26px') +
          P.div(P.pos(x + w - 230, yy + 10, 220, 220) + ';font-family:var(--f-display);font-weight:800;font-size:210px;line-height:1;letter-spacing:-.06em;text-align:right;color:' + P.mix(f, k.hex, 0.22), esc(H.num(ctx, i + 1)));
        fg += t('concept', x + 40, yy + 230, w - 80, onFill(f, p,
          '<div style="font-family:var(--f-display);font-weight:800;' + P.fsMax(Math.min(n <= 3 ? 54 : 46, cap), cap) + ';line-height:1.05;letter-spacing:-.02em">' + esc(m.label) + '</div>' +
          (m.detail ? '<div style="margin-top:18px;' + fs(n <= 3 ? 32 : 28) + ';line-height:1.4;color:var(--text2)">' + esc(m.detail) + '</div>' : '')),
        'height:' + Math.round(hh - 270) + 'px;display:flex;flex-direction:column;justify-content:flex-end');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide pst-slide' };
    },
  });

  // ───────── ТІЗІМ: сол жақта биік түс блогы + алып тақырып, оң жақта ірі нөмірлі қатарлар ─────────
  const listRender = (ctx, sh) => {
    const a = ctx.a; const p = ctx.palette; const c = colors(p);
    const ph = a.hasPhoto && hasP(a, 700);
    const bw = 720;
    const fill = a.index % 2 ? c.B : c.A;
    let bg = '<div class="plate"></div>';
    if (ph) bg += photo(a, p, 0, 0, bw, HH) + P.panel(0, 0, bw, 470, fill);
    else bg += P.panel(0, 0, bw, HH, fill);
    bg += circle(bw, ph ? 470 : HH - 170, 110, c.POP);
    const fg = box(MX, ph ? 60 : MT, bw - MX - 70, ph ? 400 : HH - MT - MB, onFill(fill, p,
      H.kicker(ctx, H.sectionLabel(ctx)) + H.titleH1(ctx, a.title, { role: 'display', width: bw - MX - 70, maxLines: ph ? 4 : 6, scale: [92, 80, 70, 62, 54, 48], hl: true })));
    const n = sh.items.length;
    const rows = sh.items.map((m, i) => '<div data-role="row" style="display:flex;gap:34px;align-items:flex-start;padding:' + (n > 4 ? 16 : 22) + 'px 0;border-bottom:3px solid ' + P.mix(p.bg, p.text, 0.08) + '">' +
      big(n > 4 ? 64 : 76, i % 2 ? c.B : c.A, 'flex:none;width:' + (n > 4 ? 96 : 116) + 'px') + esc(H.num(ctx, i + 1)) + '</div>' +
      '<div style="padding-top:6px"><div style="font-weight:800;' + fs(n > 4 ? 30 : 34) + ';line-height:1.18;color:var(--text)">' + esc(m.label) + '</div>' +
      (m.detail ? '<div style="margin-top:8px;' + fs(n > 4 ? 24 : 27) + ';line-height:1.42;color:var(--text2)">' + esc(m.detail) + '</div>' : '') + '</div></div>').join('');
    const rx = bw + 140;
    return { bg, fg: fg + box(rx, MT, W - rx - MX, HH - MT - MB, '<div data-role="list">' + rows + '</div>') + H.folio(ctx), cls: 'cx-slide pst-slide' };
  };
  def({ id: 'poster-list', kind: 'list', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5, render: listRender });
  def({ id: 'poster-photolist', kind: 'photoList', systems: SYS, fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 5, render: listRender });

  // ───────── САНДАР: алып цифрлар, астында қалың түсті жолақ ─────────
  def({
    id: 'poster-stats', kind: 'stats', systems: SYS,
    fits: (a, sh) => sh.stats.length >= 2 && sh.stats.length <= 4 && sh.stats.every((s) => String(s.value).length <= 9 && String(s.label || '').length <= 70),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p); const n = sh.stats.length;
      const gap = 60; const span = W - 2 * MX; const w = (span - gap * (n - 1)) / n;
      const longest = Math.max(...sh.stats.map((s) => String(s.value).length));
      const size = Math.min(n <= 2 ? 220 : n === 3 ? 170 : 132, Math.floor(w / (longest * 0.6)));
      let bg = '<div class="plate"></div>' + circle(W - 160, HH + 60, 420, c.POP) + P.panel(0, 0, 26, HH, c.A);
      let fg = wrap(MX, MT, 1300, H.kicker(ctx, H.sectionLabel(ctx)) + H.titleH1(ctx, a.title, { width: 1300, maxLines: 2, scale: [84, 74, 64, 56], hl: true }) + H.lead(ctx, a.subtitle, 28, { maxw: 1100 }));
      sh.stats.forEach((s, i) => {
        const x = MX + i * (w + gap); const col = i % 2 ? c.B : c.A;
        fg += t('stat', x, 470, w, big(size, col) + esc(s.value) + '</div>' +
          '<div style="width:100%;height:16px;background:' + col + ';margin:30px 0 24px"></div>' +
          '<div style="' + fs(30) + ';line-height:1.36;font-weight:700;color:var(--text)">' + esc(s.label || '') + '</div>');
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide pst-slide' };
    },
  });

  // ───────── ТҰЖЫРЫМ: фото оң жақта, сол жақта қарсы түсті блок + алып тақырып; фотосыз — толық түс ─────────
  def({
    id: 'poster-statement', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length <= 240,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p);
      const ph = hasP(a, 900);
      const fill = c.B;
      let bg = '<div class="plate"></div>';
      if (ph) bg += photo(a, p, 860, 0, W - 860, HH) + P.panel(0, 0, 1000, HH, fill) + circle(1000, 230, 150, c.POP);
      else bg += P.panel(0, 0, W, HH, fill) + circle(W - 200, HH - 150, 380, c.POP) + ring(W - 200, HH - 150, 520, P.mix(fill, '#ffffff', 0.25), 3);
      const tw = ph ? 1000 - MX - 90 : 1250;
      const fg = box(MX, MT, tw, HH - MT - MB, onFill(fill, p,
        H.kicker(ctx, H.sectionLabel(ctx)) + H.titleH1(ctx, a.title, { role: 'display', width: tw, maxLines: 4, scale: [110, 96, 84, 74, 64], hl: true }) +
        (sh.text ? '<div data-role="lead" style="margin-top:36px;' + fs(sh.text.length <= 120 ? 44 : 36) + ';line-height:1.34;color:var(--text2)">' + esc(sh.text) + '</div>' : '')));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide pst-slide' };
    },
  });

  // ───────── УАҚЫТ СЫЗЫҒЫ: қалың түсті сызық, жарқыл дөңгелектер, алып жылдар ─────────
  def({
    id: 'poster-timeline', kind: 'timeline', systems: SYS,
    fits: (a, sh) => sh.items.length >= 3 && sh.items.length <= 4,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p); const n = sh.items.length;
      const span = W - 2 * MX; const w = span / n; const ly = 600;
      let bg = '<div class="plate"></div>' + P.panel(0, ly - 9, W, 18, c.A);
      let fg = wrap(MX, MT, 1300, H.kicker(ctx, H.sectionLabel(ctx)) + H.titleH1(ctx, a.title, { width: 1300, maxLines: 2, scale: [84, 74, 64, 56], hl: true }));
      sh.items.forEach((m, i) => {
        const x = MX + i * w;
        bg += circle(x + 30, ly, 30, i === n - 1 ? c.B : c.POP, 'box-shadow:0 0 0 10px ' + p.bg);
        fg += t('date', x, ly - 210, w - 30, big(String(m.date).length > 6 ? 84 : 128, i === n - 1 ? c.B : c.A) + esc(m.date) + '</div>') +
          t('event', x, ly + 70, w - 50, '<div style="font-weight:800;' + fs(36) + ';line-height:1.2;color:var(--text)">' + esc(m.label || '') + '</div>' +
            (m.detail ? '<div style="margin-top:10px;' + fs(29) + ';line-height:1.4;color:var(--text2)">' + esc(m.detail) + '</div>' : ''));
      });
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide pst-slide' };
    },
  });

  // ───────── БӨЛІМ: толық қарсы түс, алып контур-нөмір ─────────
  def({
    id: 'poster-section', kind: 'section', systems: SYS,
    fits: () => true,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p);
      const num = String((ctx.plan && ctx.plan.section) || sh.n || a.index);
      const fill = c.A; const k = P.inkOn(fill, p);
      const bg = '<div class="plate plate-section"></div>' + P.panel(0, 0, W, HH, fill) + circle(1500, 540, 330, c.POP) +
        P.div(P.pos(1180, 90, 680, 900) + ';display:flex;align-items:center;justify-content:center;font-family:var(--f-display);font-weight:800;font-size:820px;line-height:.85;letter-spacing:-.06em;color:transparent;-webkit-text-stroke:6px ' + k.hex, esc(num.padStart(2, '0')));
      const fg = box(MX, MT, 1000, HH - MT - MB, onFill(fill, p,
        H.kicker(ctx, H.sectionLabel(ctx) || '') + H.titleH1(ctx, a.title, { role: 'display', width: 1000, maxLines: 4, scale: [130, 112, 96, 84, 72], hl: true }) +
        H.lead(ctx, a.subtitle, 34, { maxw: 900 })));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide pst-slide' };
    },
  });

  // ───────── ДӘЙЕКСӨЗ: толық жарқыл түсі, алып тырнақша ─────────
  def({
    id: 'poster-quote', kind: 'quote', systems: SYS,
    fits: (a) => String(a.subtitle || a.body || a.title).length <= 200,
    render(ctx) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p);
      const text = a.subtitle || a.body || a.title; const who = a.subtitle || a.body ? a.title : '';
      const bg = '<div class="plate"></div>' + P.panel(0, 0, W, HH, c.POP) + P.panel(0, HH - 40, W, 40, c.A) +
        P.div(P.pos(MX - 20, 40, 500, 420) + ';font-family:var(--f-display);font-weight:800;font-size:480px;line-height:1;color:' + c.A, '“');
      const fg = box(MX, 300, 1500, HH - 300 - 140, onFill(c.POP, p,
        '<blockquote data-role="title" style="margin:0;font-family:var(--f-display);font-weight:800;' + fs(text.length <= 90 ? 76 : 58) + ';line-height:1.12;letter-spacing:-.02em">' + esc(text) + '</blockquote>' +
        (who ? '<div data-role="lead" style="margin-top:40px;' + fs(30) + ';font-weight:800;letter-spacing:.12em;text-transform:uppercase">— ' + esc(who) + '</div>' : '')), 'justify-content:flex-start');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide pst-slide' };
    },
  });

  // ───────── ҚОРЫТЫНДЫ: фото толық фонда, үстінде түс блогы; фотосыз — екі түс ─────────
  def({
    id: 'poster-closing', kind: 'closing', systems: SYS,
    fits: (a, sh) => sh.items.length >= 2 && sh.items.length <= 4 && sh.items.every((m) => (m.label + ' ' + (m.detail || '')).length <= 130),
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p);
      const ph = a.hasPhoto && I.bleedOK(a.img, 1920, a.imgAI);
      const fill = c.A;
      let bg = '<div class="plate plate-section"></div>';
      bg += ph ? photo(a, p, 0, 0, W, HH) + P.panel(0, 0, 1180, HH, fill) : P.panel(0, 0, 1180, HH, fill) + P.panel(1180, 0, W - 1180, HH, c.B);
      bg += circle(1180, HH - 200, 140, c.POP);
      const rows = sh.items.map((m) => '<div data-role="row" style="display:flex;gap:24px;align-items:baseline;padding:12px 0"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:' + c.POP + '"></span><div style="' + fs(38) + ';line-height:1.36">' +
        (m.detail ? '<b style="font-weight:800">' + esc(m.label) + '</b> — ' + esc(m.detail) : esc(m.label)) + '</div></div>').join('');
      const fg = box(MX, MT, 1180 - MX - 90, HH - MT - MB, onFill(fill, p,
        H.kicker(ctx, H.sectionLabel(ctx)) + H.titleH1(ctx, a.title, { role: 'display', width: 980, maxLines: 2, scale: [110, 96, 84, 72], hl: true }) +
        '<div style="margin-top:34px">' + rows + '</div>'));
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide pst-slide' };
    },
  });
  // ───────── САЛЫСТЫРУ: екі тұтас түс жартысы, ортада жарқыл «VS» дөңгелегі ─────────
  def({
    id: 'poster-compare', kind: 'compare', systems: SYS,
    fits: (a, sh) => sh.left.rows.length <= 4 && sh.right.rows.length <= 4,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p);
      const top = 300; const half = W / 2;
      let bg = '<div class="plate"></div>' + P.panel(0, top, half, HH - top, c.A) + P.panel(half, top, half, HH - top, c.B) + circle(half, top + 90, 80, c.POP);
      let fg = wrap(MX, MT, 1500, H.kicker(ctx, H.sectionLabel(ctx)) + H.titleH1(ctx, a.title, { width: 1500, maxLines: 2, scale: [84, 74, 64, 56], hl: true }));
      fg += t('vs', half - 80, top + 52, 160, '<div style="text-align:center;font-weight:800;' + fs(44) + ';color:#111">VS</div>');
      const side = (x, fill, col) => {
        const rows = col.rows.map((r) => '<div data-role="row" style="padding:12px 0;border-top:2px solid ' + P.mix(fill, P.inkOn(fill, p).hex, 0.25) + ';' + fs(32) + ';line-height:1.32">' + esc(r) + '</div>').join('');
        return t('side', x, top + 200, half - MX - 120, onFill(fill, p, '<div style="font-family:var(--f-display);font-weight:800;' + fs(60) + ';line-height:1.04;letter-spacing:-.02em;margin-bottom:20px">' + esc(col.head) + '</div>' + rows));
      };
      fg += side(MX, c.A, sh.left) + side(half + 100, c.B, sh.right);
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide pst-slide' };
    },
  });

  // ───────── ТҰЖЫРЫМ-2: дөңгелек фото + оны қиып өтетін түс жолағы (екінші тұжырым слайдына) ─────────
  def({
    id: 'poster-statement-ring', kind: 'statement', systems: SYS,
    fits: (a, sh) => sh.text.length <= 220 && a.hasPhoto,
    render(ctx, sh) {
      const a = ctx.a; const p = ctx.palette; const c = colors(p);
      if (!hasP(a, 600)) throw new Error('no visual');
      const r = 360; const cx = 1440; const cy = 540;
      const bg = '<div class="plate"></div>' + P.panel(0, 0, W, 360, c.A) + circle(cx, cy, r + 40, c.POP) +
        P.div(P.pos(cx - r, cy - r, 2 * r, 2 * r) + ';border-radius:50%;overflow:hidden', I.imgTag(a.photo, a.img, p, { focus: a.focus }));
      const tw = 980;
      const fg = wrap(MX, MT, tw, onFill(c.A, p, H.kicker(ctx, H.sectionLabel(ctx)) + H.titleH1(ctx, a.title, { role: 'display', width: tw, maxLines: 2, scale: [92, 80, 70, 62], hl: true }))) +
        t('lead', MX, 470, 1440 - 400 - 60 - MX, '<div style="width:110px;height:12px;background:' + c.B + ';margin-bottom:34px"></div><div style="' + fs(sh.text.length <= 120 ? 46 : 38) + ';line-height:1.34;font-weight:700;color:var(--text)">' + esc(sh.text) + '</div>');
      return { bg, fg: fg + H.folio(ctx), cls: 'cx-slide pst-slide' };
    },
  });
};
