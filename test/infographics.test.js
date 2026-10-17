'use strict';
const test = require('node:test');
const assert = require('node:assert');
const IG = require('../products/presentation/design/infographics');
const A = require('../products/presentation/design/analyze');
const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');
const { pickIcon, ICON_NAMES } = require('../products/presentation/design/icons');
const { SAMPLES } = require('../scripts/infographic-gallery');
const P = require('../products/presentation/design/tokens').buildPalette('midnight');

test('every library component validates its showroom sample and renders text as HTML (editable in PPTX)', () => {
  const kinds = new Set();
  for (const s of SAMPLES) {
    const d = IG.validateInfographic(s.infographic);
    assert.ok(d, 'valid: ' + s.infographic.kind);
    kinds.add(d.kind);
    const html = IG.renderInfographic(d, 1000, 600, P);
    assert.ok(html.includes('ig-kind-' + d.kind));
    assert.ok(/data-role="label"/.test(html), d.kind + ' has text labels');
  }
  assert.deepStrictEqual([...kinds].sort(), IG.KIND_NAMES.slice().sort(), 'showroom covers all kinds');
});

test('validators refuse data that cannot be drawn honestly', () => {
  assert.strictEqual(IG.validateInfographic({ kind: 'bar', items: [{ label: 'A', value: 'көп' }, { label: 'B', value: '3' }] }), null);
  assert.strictEqual(IG.validateInfographic({ kind: 'donut', items: [{ label: 'A', value: '100%' }] }), null);
  assert.strictEqual(IG.validateInfographic({ kind: 'matrix', items: [{ label: 'A' }, { label: 'B' }] }), null);
  assert.strictEqual(IG.validateInfographic({ kind: 'pictogram', items: [{ label: 'A', value: '250' }] }), null);
  assert.strictEqual(IG.validateInfographic({ kind: 'unknown', items: [] }), null);
  assert.strictEqual(IG.validateInfographic(null), null);
  const d = IG.validateInfographic({ kind: 'line', unit: 'млн', items: [{ label: '2000', value: 14.9 }, { label: '2010', value: 16 }, { label: '2020', value: 18.7 }] });
  assert.strictEqual(d.items[0].display, '14,9', 'numbers use a decimal comma');
});

test('content is recognised as an infographic even without the LLM field', () => {
  const bar = IG.autoInfographic({ stats: [{ value: '40%', label: 'a' }, { value: '30%', label: 'b' }, { value: '20%', label: 'c' }, { value: '10%', label: 'd' }] });
  assert.strictEqual(bar.kind, 'bar');
  const swot = IG.autoInfographic({ bullets: ['Күшті жақтары: команда', 'Әлсіз жақтары: шығын', 'Мүмкіндіктер: нарық', 'Қауіптер: бәсеке'] });
  assert.strictEqual(swot.kind, 'matrix');
  assert.strictEqual(IG.autoInfographic({ stats: [{ value: '1', label: 'a' }, { value: '2', label: 'b' }] }), null, '2 stats stay cards');
});

test('builder picks the infographic layout (never on the cover) and keeps unrelated slides unchanged', () => {
  const deck = [
    { title: 'Cover', infographic: SAMPLES[0].infographic },
    SAMPLES[0], SAMPLES[6],
    { title: 'Text', bullets: ['a: b', 'c: d'] },
  ];
  const types = A.planDeck(deck).map((p) => p.type);
  assert.deepStrictEqual(types.slice(0, 3), ['cover', 'infographic', 'infographic']);
  assert.notStrictEqual(types[3], 'infographic');
  const html = build3DPresentationHTML(deck, 'T', {});
  assert.ok(html.includes('data-layout="infographic"') && html.includes('ig-kind-bar') && html.includes('ig-kind-cycle'));
});

test('icon picker understands Kazakh / Russian / English words and the explicit name', () => {
  assert.strictEqual(pickIcon('rocket', ''), 'rocket');
  assert.strictEqual(pickIcon('', 'Халық саны'), 'users');
  assert.strictEqual(pickIcon('', 'Экономика'), 'chart-bar');
  assert.strictEqual(pickIcon('', 'бойынша'), null, 'no false match inside words');
  assert.ok(ICON_NAMES.length >= 100);
});

test('funnel/pyramid: invented round percentages without a source are dropped, real data kept', () => {
  const { validateInfographic } = require('../products/presentation/design/infographics');
  const items = ['A', 'B', 'C', 'D'].map((l, i) => ({ label: l, value: [100, 70, 40, 10][i] + '%' }));
  const fake = validateInfographic({ kind: 'funnel', items });
  assert.ok(fake && fake.items.every((it) => !it.display), 'decorative values removed, stages kept');
  const sourced = validateInfographic({ kind: 'funnel', items, source: 'ҚР Статистика бюросы, 2023' });
  assert.ok(sourced.items.every((it) => it.display), 'sourced values kept');
  const real = validateInfographic({ kind: 'pyramid', items: [{ label: 'A', value: '37%' }, { label: 'B', value: '22%' }, { label: 'C', value: '9%' }] });
  assert.ok(real.items.every((it) => it.display), 'non-round values kept');
  const donut = validateInfographic({ kind: 'donut', items: [{ label: 'A', value: '70%' }, { label: 'B', value: '30%' }] });
  assert.ok(donut && donut.items[0].display, 'charts untouched');
});

test('rhetorical 0%/100% compare without a source is not drawn; roadmap years go in order', () => {
  const { validateInfographic } = require('../products/presentation/design/infographics');
  const fake = validateInfographic({ kind: 'compare', items: [{ label: 'Білімді', value: '100%' }, { label: 'Надан', value: '0%' }] });
  assert.strictEqual(fake, null, 'invented 100% vs 0% falls back to text');
  const real = validateInfographic({ kind: 'compare', items: [{ label: 'Қала', value: '62%' }, { label: 'Ауыл', value: '38%' }] });
  assert.ok(real, 'ordinary compare kept');
  const road = validateInfographic({ kind: 'roadmap', items: [{ label: '1920', detail: 'a' }, { label: '1937', detail: 'b' }, { label: '1930', detail: 'c' }, { label: '1989', detail: 'd' }] });
  assert.deepStrictEqual(road.items.map((it) => it.detail), ['a', 'c', 'b', 'd']);
});

test('composition timeline is chronological', () => {
  const { shapeOf } = require('../products/presentation/design/compositions');
  const A = require('../products/presentation/design/analyze');
  const s = { title: 'Қуғын-сүргін', bullets: ['1920: a', '1937: b', '1930: c', '1989: d'] };
  const a = A.analyzeSlide(s, 3, 8);
  const sh = shapeOf(a, 'timeline');
  assert.deepStrictEqual(sh.items.map((m) => m.date), ['1920', '1930', '1937', '1989']);
});

test('infographics: detail text never shrinks below 20px; pictogram about people uses a person icon', () => {
  const pal = require('../products/presentation/design/tokens').buildPalette('sand');
  const long = 'Өте ұзын сипаттама '.repeat(12);
  const html = IG.renderInfographic(IG.validateInfographic({ kind: 'roadmap', items: [{ label: '2024', detail: long }, { label: '2025', detail: long }, { label: '2026', detail: long }] }), 1664, 620, pal);
  const sizes = [...html.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...sizes) >= 20, 'min ' + Math.min(...sizes));
  const pic = IG.renderInfographic(IG.validateInfographic({ kind: 'pictogram', items: [{ label: 'жастар күн сайын онлайн оқиды', value: '70%' }] }), 1100, 720, pal);
  assert.ok(!/wifi/.test(pic));
});

test('tables: rows with a year column are put in chronological order', () => {
  const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');
  const html = build3DPresentationHTML([{ title: 'Cover' }, { title: 'Хандар', table: { headers: ['Хан', 'Жылдары', 'Жетістігі', 'Астанасы'], rows: [['Тәуке', '1680–1715', 'Жеті жарғы', 'Түркістан'], ['Есім', '1598–1628', 'Ескі жол', 'Түркістан'], ['Керей', '1465–1474', 'Хандық', 'Шу']] } }], 'T');
  const order = ['Керей', 'Есім', 'Тәуке'].map((n) => html.indexOf('>' + n + '<'));
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2], JSON.stringify(order));
});
