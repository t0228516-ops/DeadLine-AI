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

test('regalia: humanities topics alternate heritage/regalia/bordeaux; colour follows the topic; cover, section and closing use the deep palette', () => {
  const SYS = require('../products/presentation/design/systems');
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(SYS.pickDesign({ seed: 's' + i, brief: 'Қазақ хандығының тарихы' }).system);
  assert.deepStrictEqual([...seen].sort(), ['bordeaux', 'heritage', 'regalia']);
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
  assert.match(P.fsMax(42, 40), /min\(calc\(42px\*var\(--fs,1\)\*var\(--wfit,1\)\),40px\)/);
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
