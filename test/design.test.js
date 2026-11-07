'use strict';
const test = require('node:test');
const assert = require('node:assert');
const T = require('../products/presentation/design/tokens');
const A = require('../products/presentation/design/analyze');
const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');

const deck = [
  { title: 'Cover', subtitle: 'Sub', bullets: ['Орындаған: A'] },
  { title: 'Intro', body: 'word '.repeat(40) },
  { title: 'Steps', bullets: ['A: a', 'B: b', 'C: c'], composition: { visualPurpose: 'process' } },
  { title: 'When', bullets: ['1990: a', '2000: b', '2010: c'], composition: { visualPurpose: 'timeline' } },
  { title: 'Num', stats: [{ value: '87%', label: 'x' }] },
  { title: 'Nums', stats: [{ value: '1', label: 'a' }, { value: '2', label: 'b' }] },
  { title: 'Tbl', table: { headers: ['a', 'b'], rows: [['1', '2']] } },
  { title: 'Quote', subtitle: 'Words', composition: { layout: 'quote_hero' } },
  { title: 'Қорытынды', bullets: ['x', 'y'] },
];

test('every palette keeps text/accent readable', () => {
  for (const mood of Object.keys(T.MOODS)) {
    const p = T.buildPalette(mood, null, '');
    assert.ok(T.contrast(p.text, p.bg) >= 7, mood + ' text');
    assert.ok(T.contrast(p.accent, p.bg) >= 3.4, mood + ' accent');
  }
});

test('classification picks distinct compositions', () => {
  const types = A.planDeck(deck).map((p) => p.type);
  assert.deepStrictEqual(types.slice(0, 1), ['cover']);
  for (const t of ['process', 'timeline', 'number', 'stats', 'comparison', 'quote', 'conclusion']) assert.ok(types.includes(t), t);
});

test('no three identical layouts in a row (rhythm)', () => {
  const same = Array.from({ length: 8 }, (_, i) => ({ title: 'T' + i, bullets: ['a: b', 'c: d', 'e'], body: 'x' }));
  same.unshift({ title: 'Cover' });
  const l = A.planDeck(same).map((p) => p.layout);
  for (let i = 2; i < l.length; i++) assert.ok(l[i] !== l[i - 1], 'adjacent repeat at ' + i + ': ' + l.join(' '));
});

test('builder keeps public API + runtime hooks the renderer relies on', () => {
  const prevC = process.env.DESIGN_COMPOSE; process.env.DESIGN_COMPOSE = '0'; // бұрынғы қозғалтқыштың ілгектері
  const html0 = build3DPresentationHTML(deck, 'Deck', { style: 'business' });
  if (prevC == null) delete process.env.DESIGN_COMPOSE; else process.env.DESIGN_COMPOSE = prevC;
  assert.ok(html0.includes('class="block'));
  const html = build3DPresentationHTML(deck, 'Deck', { style: 'business' });
  for (const hook of ['class="slide', 'id="stage"', 'id="controls"', 'id="dots"', 'window.__qaDone']) {
    assert.ok(html.includes(hook), hook);
  }
  // мұқаба: бұрынғы макет не құрастырылған композиция (compositions/)
  assert.match(html, /data-layout="(cover|cx-cover-[a-z-]+)"/);
  assert.strictEqual((html.match(/<article class="slide/g) || []).length, deck.length);
});

test('empty / malformed slides never throw', () => {
  assert.doesNotThrow(() => build3DPresentationHTML([{}, { title: null, bullets: 'x' }, { stats: [{}] }], 't'));
  assert.doesNotThrow(() => build3DPresentationHTML([], 't'));
});

test('auto-picked palettes are light unless the client asks for a dark background', () => {
  const SYS = require('../products/presentation/design/systems');
  for (let i = 0; i < 40; i++) {
    const d = SYS.pickDesign({ seed: 'seed' + i, brief: 'Қазақ хандығының құрылуы', avoidSystems: ['heritage', 'blueprint', 'academy', 'journal'], avoidMoods: ['sand', 'ivory', 'light'] });
    // «Бордо» — дизайнері қою етіп салған шаблон (проекторда контрасты жоғары: 11:1); қалғаны — ашық
    assert.ok(T.isLightMood(d.mood) || d.system === 'bordeaux', d.system + '/' + d.mood);
    const lit = SYS.pickDesign({ seed: 'seed' + i, brief: 'Қазақ хандығының құрылуы, ақ фон' });
    assert.ok(T.isLightMood(lit.mood) && lit.system !== 'bordeaux', 'ақ фон сұраса: ' + lit.system + '/' + lit.mood);
  }
  const dark = SYS.pickDesign({ seed: 'x', brief: 'Python негіздері, қара фон' });
  assert.ok(!T.isLightMood(dark.mood), 'asked for dark → dark');
});

test('regalia: humanities topics alternate heritage/regalia/bordeaux/libro; colour follows the topic; cover, section and closing use the deep palette', () => {
  const SYS = require('../products/presentation/design/systems');
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(SYS.pickDesign({ seed: 's' + i, brief: 'Қазақ хандығының тарихы' }).system);
  assert.deepStrictEqual([...seen].sort(), ['bordeaux', 'heritage', 'libro', 'regalia']);
  // студенттің соңғы жүйесі regalia болса — келесісі heritage
  assert.strictEqual(SYS.pickDesign({ seed: 's1', brief: 'Қазақ хандығының тарихы', avoidSystems: ['regalia'] }).system, 'heritage');
  const R = SYS.SYSTEMS.regalia;
  assert.strictEqual(R.moodFor('Абай шығармашылығы және қазақ әдебиеті'), 'regalia_malachite');
  assert.strictEqual(R.moodFor('Әл-Фараби философиясы'), 'regalia_lapis');
  assert.strictEqual(R.moodFor('Қазақ хандығының құрылуы'), 'regalia_bordo');
  // жүйенің өз палитрасы басқа жүйелерге түспейді
  for (let i = 0; i < 60; i++) assert.ok(!/^regalia_/.test(SYS.pickDesign({ seed: 'm' + i, brief: 'Маркетинг негіздері' }).mood));
  const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');
  const c = { mood: 'regalia_bordo' };
  const html = build3DPresentationHTML([
    { title: 'Қазақ хандығы', subtitle: 'XV ғасыр', composition: c },
    { title: 'Негізгі ерекшеліктер', bullets: ['Жүздер жүйесі: басқару', 'Билер кеңесі: сот', 'Сауда жолдары: байланыс'], composition: c },
    { title: 'Қорытынды', bullets: ['Хандық — мемлекеттіліктің негізі', 'Жүздер басқаруды тұрақтандырды'], composition: { ...c, visualPurpose: 'conclusion' } },
  ], 'Қазақ хандығы', { system: 'regalia' });
  const slides = html.split('<article class="slide').slice(1);
  assert.match(slides[0], /^[^"]*is-deep/);
  assert.doesNotMatch(slides[1], /^[^"]*is-deep/);
  assert.match(slides[0], /--bg:#3d1219/);
  assert.match(slides[1], /--bg:#f6efe6/);
});

test('vivid: saturated palette follows the topic; long words never spill into the next column', () => {
  const SYS = require('../products/presentation/design/systems');
  const V = SYS.SYSTEMS.vivid;
  assert.strictEqual(V.moodFor('Саяси режимдер'), 'vivid_cobalt');
  assert.strictEqual(V.moodFor('Жасуша биологиясы'), 'vivid_emerald');
  assert.strictEqual(V.moodFor('Бастауыш мектепте оқыту әдістері'), 'vivid_magenta');
  assert.strictEqual(V.moodFor('Python бағдарламалау'), 'vivid_violet');
  const P = require('../products/presentation/design/compositions/parts');
  // «Демократиялық» (Arial Bold) ≈ 7.96 em → 367 px бағанға ≤ 43 px
  assert.ok(P.wordFit('Демократиялық', 999, 367, 'arial') <= 43);
  assert.strictEqual(P.wordFit('Гибридті', 42, 367, 'arial'), 42);
  // сөз сыятын шек (40px) әрқашан қалады; блок өз қорабына бейімделеді (--bfit, DESIGN_FIT)
  assert.match(P.fsMax(42, 40), /min\(calc\(42px\*var\(--fs,1\)\*var\(--wfit,1\)\*var\(--bfit,1\)\),40px\)/);
  process.env.DESIGN_FIT = '0';
  try { assert.match(P.fsMax(42, 40), /min\(calc\(42px\*var\(--fs,1\)\*var\(--wfit,1\)\),40px\)/, 'өшіргіш: бұрынғы өлшем'); } finally { delete process.env.DESIGN_FIT; }
});

// Оқылу шегі (2026-11-06): ұсақ өлшемдер көтеріледі, 34 px-тен үлкені өзгермейді; өшіргіш — бұрынғы өлшем
test('readability lift: small sizes rise toward 34px, large sizes untouched, DESIGN_FIT=0 restores', () => {
  const P = require('../products/presentation/design/compositions/parts');
  assert.strictEqual(P.lift(24), 28.5);
  assert.strictEqual(P.lift(30), 31.8);
  assert.strictEqual(P.lift(34), 34);
  assert.strictEqual(P.lift(96), 96);
  assert.match(P.fsOf(24), /calc\(28\.5px\*var\(--fs,1\)\*var\(--wfit,1\)\*var\(--bfit,1\)\)/);
  process.env.DESIGN_FIT = '0';
  try { assert.strictEqual(P.lift(24), 24); assert.doesNotMatch(P.fsOf(24), /bfit/); } finally { delete process.env.DESIGN_FIT; }
});

// Кіріспе слайдында бірінші сөйлем (subtitle) абзацпен (body) бірге көрінеді (бұрын 22 стильде жоғалатын)
test('statement slides keep the subtitle when a paragraph is present (dedup when repeated)', () => {
  const C = require('../products/presentation/design/compositions');
  assert.strictEqual(C.statementText({ subtitle: 'Бір сөйлем', body: 'Екінші сөйлем.' }), 'Бір сөйлем. Екінші сөйлем.');
  assert.strictEqual(C.statementText({ subtitle: 'Қысқа сөйлем', body: 'Қысқа сөйлем және оның түсіндірмесі.' }), 'Қысқа сөйлем және оның түсіндірмесі.');
  assert.strictEqual(C.statementText({ subtitle: 'Тек сипаттама.' }), 'Тек сипаттама.');
  assert.strictEqual(C.statementText({ body: 'Тек абзац.' }), 'Тек абзац.');
});

test('poster: its own bold compositions come first; other systems never get them', () => {
  const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');
  const c = { mood: 'poster_blue' };
  const deck = [
    { title: 'Саяси режимдер', subtitle: 'Түрлері', composition: c },
    { title: 'Режим түрлері', bullets: ['Демократиялық: еркін сайлау', 'Авторитарлық: билік бір топта', 'Тоталитарлық: толық бақылау'], composition: c },
    { title: 'Бірінші бөлім', subtitle: 'Белгілері', composition: { ...c, visualPurpose: 'section' } },
    { title: 'Қорытынды', bullets: ['Режим — биліктің жұмыс тәсілі', 'Азаматтар режимді өзгерте алады'], composition: { ...c, visualPurpose: 'conclusion' } },
  ];
  const layouts = (sys) => [...build3DPresentationHTML(deck, 'Саяси режимдер', { system: sys }).matchAll(/data-layout="([^"]+)"/g)].map((m) => m[1]);
  const own = layouts('poster');
  assert.ok(own.filter((l) => /^cx-poster-/.test(l)).length >= 3, own.join(' '));
  for (const sys of ['vivid', 'heritage', 'swiss']) assert.ok(!layouts(sys).some((l) => /poster/.test(l)), sys);
});

test('bordeaux / northline: designer-template compositions and fonts are used only by their own system', () => {
  const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');
  const deck = (mood) => [
    { title: 'Қазақ хандығы', subtitle: 'XV ғасыр', composition: { mood } },
    { title: 'Негізгі ерекшеліктер', bullets: ['Жүздер: аумақтық бөліну', 'Билер кеңесі: сот', 'Сауда: Жібек жолы'], composition: { mood } },
    { title: 'Қорытынды', bullets: ['Хандық — мемлекеттіліктің негізі', 'Жүздер басқаруды тұрақтандырды'], composition: { mood, visualPurpose: 'conclusion' } },
  ];
  const bx = build3DPresentationHTML(deck('bordeaux_wine'), 'Хандық', { system: 'bordeaux' });
  assert.ok((bx.match(/data-layout="cx-bx-/g) || []).length >= 3);
  assert.match(bx, /font-family:'Playfair Bold'/);
  const nl = build3DPresentationHTML(deck('northline_lime'), 'Хандық', { system: 'northline' });
  assert.ok((nl.match(/data-layout="cx-nl-/g) || []).length >= 3);
  assert.match(nl, /font-family:'Montserrat Bold'/);
  const other = build3DPresentationHTML(deck('ivory'), 'Хандық', { system: 'swiss' });
  assert.doesNotMatch(other, /cx-(bx|nl)-|Playfair Bold|Montserrat Bold/);
});

test('vital («Таза»): Canva-measured compositions, Inter + Open Sans, accent follows the topic, only its own system uses them', () => {
  const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');
  const V = require('../products/presentation/design/systems').SYSTEMS.vital;
  assert.strictEqual(V.moodFor('Жүрек ауруларының алдын алу'), 'vital_red');
  assert.strictEqual(V.moodFor('Жасуша биологиясы'), 'vital_teal');
  assert.strictEqual(V.moodFor('Цифрлық экономика'), 'vital_blue');
  const c = { mood: 'vital_red' };
  const deck = [
    { title: 'Жүрек денсаулығы', subtitle: 'Медицина негіздері', composition: { ...c, visualPurpose: 'cover' } },
    { title: 'Қауіп факторлары', bullets: ['Қан қысымы: жүктеме', 'Темекі: тамыр зақымы', 'Тамақ: холестерин', 'Қимылсыздық: әлсіздік'], composition: c },
    { title: 'Сандар', stats: [{ value: '80%', label: 'алдын алуға болады' }, { value: '17,9 млн', label: 'жыл сайын' }], composition: c },
    { title: 'Қорытынды', bullets: ['Тексерілу', 'Пайдалы әдет', 'Жүрекке қамқорлық'], composition: { ...c, visualPurpose: 'conclusion' } },
  ];
  const html = build3DPresentationHTML(deck, 'Жүрек', { system: 'vital' });
  assert.ok((html.match(/data-layout="cx-vt-/g) || []).length >= 3, html.match(/data-layout="[^"]+"/g).join(' '));
  assert.match(html, /font-family:'Inter'/);
  const other = build3DPresentationHTML(deck.map((s) => ({ ...s, composition: { ...s.composition, mood: 'ivory' } })), 'Жүрек', { system: 'swiss' });
  assert.doesNotMatch(other, /cx-vt-/);
});

test('Canva-measured styles (verde, hexa, terra, libro, aurum, meadow): own layouts for every slide kind, only in their own system, no fit problems in markup', () => {
  const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');
  const SYS = require('../products/presentation/design/systems').SYSTEMS;
  const T = require('../products/presentation/design/tokens');
  const PREFIX = { verde: 'vd', hexa: 'hx', terra: 'tr', libro: 'lb', aurum: 'au', meadow: 'md' };
  for (const [id, px] of Object.entries(PREFIX)) {
    const sys = SYS[id];
    assert.ok(sys && sys.ownComps, id);
    for (const m of sys.moods) assert.strictEqual(T.MOODS[m].own, id, m);
    const mood = sys.moodFor('Қазақстан экономикасы');
    assert.ok(sys.moods.includes(mood), id + ' ' + mood);
    const c = (x = {}) => ({ ...x, mood });
    const deck = [
      { title: 'Қазақстан экономикасы', subtitle: 'Баяндама', bullets: ['Орындаған: А. Сейт', 'Топ: ЭК-23'], composition: c({ visualPurpose: 'cover' }) },
      { title: 'Өзектілігі', body: 'Бұл тақырып бүгінгі қоғам үшін аса маңызды, себебі өзгерістер көп адамның өміріне әсер етті.', composition: c() },
      { title: 'Негізгі бағыттар', bullets: ['Қолдау: несие мен грант', 'Цифрландыру: онлайн қызмет', 'Білім: оқыту бағдарламасы'], composition: c() },
      { title: 'Сандармен', stats: [{ value: '36%', label: 'ІЖӨ үлесі' }, { value: '4,2 млн', label: 'жұмыс орны' }], composition: c() },
      { title: 'Кезеңдер', bullets: ['Талдау: жағдайды зерттеу', 'Жоспар: мақсатты анықтау', 'Іске асыру: енгізу'], composition: c({ visualPurpose: 'process' }) },
      { title: 'Екінші бөлім', subtitle: 'Мәселелер', composition: c({ visualPurpose: 'section' }) },
      { title: 'Қорытынды', bullets: ['Тақырып өзекті', 'Бірлескен жұмыс қажет', 'Әр адамның үлесі маңызды'], composition: c({ visualPurpose: 'conclusion' }) },
    ];
    const html = build3DPresentationHTML(deck, 'Экономика', { system: id });
    const own = (html.match(new RegExp('data-layout="cx-' + px + '-', 'g')) || []).length;
    assert.ok(own >= 6, id + ': ' + (html.match(/data-layout="[^"]+"/g) || []).join(' '));
    const other = build3DPresentationHTML(deck.map((s) => ({ ...s, composition: { ...s.composition, mood: 'ivory' } })), 'Экономика', { system: 'swiss' });
    assert.doesNotMatch(other, new RegExp('cx-' + px + '-'), id);
  }
});

test('Mini App style gallery: every listed design is a real system with three preview images', () => {
  const fs = require('fs');
  const path = require('path');
  const SYS = require('../products/presentation/design/systems');
  const app = fs.readFileSync(path.join(__dirname, '..', 'webapp', 'app.js'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const ids = [...app.match(/const STYLES = \[([\s\S]*?)\];/)[1].matchAll(/id: '(\w+)'/g)].map((m) => m[1]);
  assert.ok(ids.length >= 6);
  const allowed = server.match(/GALLERY_DESIGNS = new Set\(\[([^\]]*)\]\)/)[1];
  for (const id of ids) {
    assert.ok(SYS.SYSTEMS[id], id);
    assert.ok(allowed.includes(`'${id}'`), 'server whitelist: ' + id);
    for (const n of [1, 2, 3]) assert.ok(fs.existsSync(path.join(__dirname, '..', 'webapp', 'styles', `${id}-${n}.jpg`)), `${id}-${n}.jpg`);
  }
});
