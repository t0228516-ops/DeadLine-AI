'use strict';
// Мазмұнға қарай макет: форма → шаблон слайды (желісіз, LLM-сіз).
const test = require('node:test');
const assert = require('node:assert');
const A = require('../products/presentation/library/arrange');

const t = { id: 'x', cover: 1, agenda: 2, closing: 20 };
const meta = [
  { slide: 1, role: 'cover', cards: 0, labels: 0, figures: 0, bodies: 0, subtitle: true, photos: 1 },
  { slide: 2, role: 'agenda', cards: 0, labels: 4, figures: 0, bodies: 0, subtitle: false, photos: 0 },
  { slide: 3, role: 'text', cards: 3, labels: 0, figures: 0, bodies: 0, subtitle: false, photos: 0 },
  { slide: 4, role: 'text', cards: 4, labels: 0, figures: 0, bodies: 0, subtitle: false, photos: 0 },
  { slide: 5, role: 'text', cards: 0, labels: 0, figures: 0, bodies: 1, subtitle: true, photos: 1 },
  { slide: 6, role: 'text', cards: 2, labels: 0, figures: 0, bodies: 0, subtitle: false, photos: 0 },
  { slide: 7, role: 'stats', cards: 0, labels: 0, figures: 3, bodies: 0, subtitle: false, photos: 0 },
  { slide: 8, role: 'quote', cards: 0, labels: 0, figures: 0, bodies: 0, subtitle: true, photos: 0 },
  { slide: 20, role: 'closing', cards: 0, labels: 0, figures: 0, bodies: 0, subtitle: false, photos: 0 },
];

test('shapeOfProfile reads the template schema profile', () => {
  assert.deepStrictEqual(A.shapeOfProfile('title; subtitle; 3 card(s): heading + text; 2 key figure(s) with a caption; 1 text block(s); 5 short label(s)'),
    { cards: 3, figures: 2, bodies: 1, labels: 5, subtitle: true });
  assert.deepStrictEqual(A.shapeOfProfile('visual slide with little text'), { cards: 0, figures: 0, bodies: 0, labels: 0, subtitle: false });
});

test('matchPicks: each form gets the slide that fits it', () => {
  const shapes = [{ form: 'explain' }, { form: 'points', count: 4 }, { form: 'points', count: 3 }, { form: 'figures', count: 3 }, { form: 'compare' }, { form: 'quote' }];
  const p = A.matchPicks(t, meta, shapes, { agenda: true, closing: true }).map((x) => x + 1);
  assert.deepStrictEqual(p, [1, 2, 5, 4, 3, 7, 6, 8, 20]);
});

test('matchPicks: no layout twice in a row; a missing form falls back to the plainest slide', () => {
  const noQuote = meta.filter((m) => m.role !== 'quote' && m.role !== 'stats');
  const p = A.matchPicks(t, noQuote, [{ form: 'points', count: 4 }, { form: 'points', count: 4 }, { form: 'quote' }, { form: 'figures', count: 2 }], { agenda: false, closing: false }).map((x) => x + 1);
  for (let i = 1; i < p.length; i++) assert.notStrictEqual(p[i], p[i - 1], p.join(','));
  assert.strictEqual(p[3], 5, 'дәйексөз слайды жоқ — түсіндіру слайды (карточкасыз)');
});

test('toShapes: validates the plan and clamps counts', () => {
  assert.strictEqual(A.toShapes({ title: 'T', slides: [{ heading: 'a' }] }, 2), null, 'саны сәйкес емес');
  const r = A.toShapes({ title: 'T', slides: [{ heading: 'a', form: 'points', count: 9, key_points: ['1', '2'] }, { heading: 'b', form: 'weird' }] }, 2);
  assert.strictEqual(r.shapes[0].count, 6);
  assert.strictEqual(r.shapes[1].form, 'explain');
});

test('arrange: plan → picks + storyline of the same length; no LLM → null', async () => {
  const src = null; // slideMeta кэштен оқылмайды — тікелей тексеру үшін matchPicks/storyFrom
  const plan = A.toShapes({ title: 'Хандық', slides: [{ heading: 'Себептері', form: 'points', count: 4, key_points: ['a', 'b', 'c', 'd'] }, { heading: 'Қорытынды', form: 'explain' }] }, 2);
  const fixed = { agenda: false, closing: true };
  const picks = A.matchPicks(t, meta, plan.shapes, fixed);
  const story = A.storyFrom(plan, picks, meta, t, fixed);
  assert.strictEqual(story.slideTopics.length, picks.length);
  assert.match(story.slideTopics[1], /^Себептері.*Key points: a; b; c; d/);
  assert.match(story.slideTopics[3], /^CLOSING/);
  const saved = process.env.DEEPSEEK_API_KEY; delete process.env.DEEPSEEK_API_KEY;
  assert.strictEqual(await A.arrange({ src, t, n: 10, topic: '' }), null, 'тақырыпсыз');
  if (saved != null) process.env.DEEPSEEK_API_KEY = saved;
});

test('matchPicks: a scarce form (the only figures slide) is not taken by a list that has other options', () => {
  const m = [
    { slide: 1, role: 'cover', cards: 0, labels: 0, figures: 0, bodies: 0, subtitle: false, photos: 0 },
    { slide: 7, role: 'text', cards: 0, labels: 0, figures: 0, bodies: 3, subtitle: false, photos: 0 },
    { slide: 13, role: 'text', cards: 3, labels: 0, figures: 3, bodies: 0, subtitle: false, photos: 0 },
  ];
  const p = A.matchPicks({ cover: 1 }, m, [{ form: 'steps', count: 3 }, { form: 'figures', count: 3 }], { agenda: false, closing: false }).map((x) => x + 1);
  assert.deepStrictEqual(p, [1, 7, 13]);
});

test('fitScore: plain points avoid a figures slide (it would force invented numbers)', () => {
  const figs = { slide: 13, role: 'text', cards: 3, labels: 0, figures: 3, bodies: 0, subtitle: false, photos: 0 };
  const plain = { slide: 7, role: 'text', cards: 0, labels: 0, figures: 0, bodies: 3, subtitle: false, photos: 0 };
  assert.ok(A.fitScore(plain, { form: 'points', count: 3 }) > A.fitScore(figs, { form: 'points', count: 3 }));
  assert.ok(A.fitScore(figs, { form: 'figures', count: 3 }) > 0);
});

test('fitScore: a title-only slide never carries content, only a section divider', () => {
  const bare = { slide: 9, role: 'text', cards: 0, labels: 0, figures: 0, bodies: 0, subtitle: false, photos: 0 };
  for (const form of ['points', 'steps', 'explain', 'compare']) assert.strictEqual(A.fitScore(bare, { form, count: 3 }), -Infinity, form);
  assert.ok(A.fitScore(bare, { form: 'section' }) > 0);
  const picks = A.matchPicks(t, meta.concat(bare), [{ form: 'explain' }, { form: 'explain' }, { form: 'explain' }], { agenda: false, closing: false });
  assert.ok(!picks.includes(8), 'тек тақырыпты слайд алынбады');
});

test('storyFrom: the heading count follows the slide (4 planned, 3 cards → «үш»)', () => {
  const plan = { title: 'ЖИ', shapes: [{ heading: 'ЖИ төрт саланы өзгертіп жатыр', form: 'points', count: 4, purpose: '', points: ['a', 'b', 'c', 'd'] }] };
  const s = A.storyFrom(plan, [0, 2], meta, { cover: 1 }, { agenda: false, closing: false });
  assert.match(s.slideTopics[1], /^ЖИ үш саланы өзгертіп жатыр/);
  assert.match(s.slideTopics[1], /Key points: a; b; c\./);
  assert.match(s.slideTopics[1], /Exactly 3 items/);
});
