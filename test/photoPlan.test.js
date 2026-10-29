'use strict';
const test = require('node:test');
const assert = require('node:assert');
const A = require('../products/presentation/design/analyze');
const { planPhotoSlides } = require('../products/presentation/photoPlan');
const { SAMPLES } = require('../scripts/infographic-gallery');

const PHOTO = 'data:image/jpeg;base64,' + Buffer.alloc(30).toString('base64');
const deck = [
  { title: 'Cover', subtitle: 'Sub' },
  { title: 'Intro', body: 'word '.repeat(40) },
  { title: 'Points', bullets: ['a: b c', 'd: e f', 'g: h i'] },
  { title: 'Numbers', stats: [{ value: '40%', label: 'a' }, { value: '20%', label: 'b' }] },
  { title: 'Photo moment', subtitle: 'short line' },
  SAMPLES[0],
  { title: 'Steps', bullets: ['A: a', 'B: b', 'C: c'], composition: { visualPurpose: 'process' } },
  { title: 'Table', table: { headers: ['a', 'b'], rows: [['1', '2']] }, composition: { image: 'none' } },
  { title: 'Қорытынды', bullets: ['x', 'y'] },
];

test('photos are searched only where the layout shows one, and the layouts stay exactly the same', () => {
  const { indexes } = planPhotoSlides(deck, { budget: 99 });
  const all = deck.map((s) => ({ ...s, webImageUrl: PHOTO }));
  const only = deck.map((s, i) => ({ ...s, webImageUrl: indexes.has(i) ? PHOTO : '' }));
  assert.deepStrictEqual(A.planDeck(only).map((p) => p.layout), A.planDeck(all).map((p) => p.layout));
  assert.ok(indexes.has(0), 'cover gets a photo');
  for (const i of [3, 5, 6, 7]) assert.ok(!indexes.has(i), 'no search for slide ' + (i + 1));
  assert.ok(indexes.size < deck.length);
});

test('the budget keeps the cover first', () => {
  const { indexes } = planPhotoSlides(deck, { budget: 1 });
  assert.deepStrictEqual([...indexes], [0]);
  assert.strictEqual(planPhotoSlides(deck, { budget: 0 }).indexes.size, 0);
});

test('photo plan: content slides the composition engine can show a photo on get one, even when DeepSeek set image "none"; closing/section are skipped', () => {
  const { planPhotoSlides } = require('../products/presentation/photoPlan');
  const B = ['Бір — ұзын толық факт сегіз он төрт сөзден тұратын мысал сөйлем', 'Екі — ұзын толық факт сегіз он төрт сөзден тұратын мысал сөйлем', 'Үш — ұзын толық факт сегіз он төрт сөзден тұратын мысал сөйлем'];
  const deck = [
    { title: 'Мұқаба', subtitle: 'x' },
    { title: 'Бастауы', bullets: B, composition: { image: 'none' } },
    { title: 'Сандар', stats: [{ value: '1', label: 'a' }, { value: '2', label: 'b' }] },
    { title: 'Әдістері', bullets: B, composition: { image: 'none' } },
    { title: 'Кезеңдер', bullets: ['1928 — a', '1929 — b', '1931 — c'], composition: { visualPurpose: 'timeline' } },
    { title: 'Салдары', bullets: B, composition: { image: 'none' } },
    { title: 'Қорытынды', bullets: B, composition: { visualPurpose: 'conclusion' } },
  ];
  const p = planPhotoSlides(deck, { budget: 4 });
  assert.ok(p.indexes.has(0), 'мұқаба');
  assert.ok(p.indexes.size >= 3, 'кемі 3 фото слайд: ' + [...p.indexes]);
  assert.ok(!p.indexes.has(2) && !p.indexes.has(4), 'сандар мен уақыт сызығына фото ізделмейді');
  if (p.planned[6] === 'closing') assert.ok(!p.indexes.has(6), 'closing-seal фотоны көрсетпейді');
});

test('imageQuery "NONE" (no photographable subject): no photo search for that slide', () => {
  const { mayCarryPhoto } = require('../products/presentation/photoPlan');
  const { isLatinQuery } = require('../products/presentation/images');
  assert.strictEqual(mayCarryPhoto({ title: 'Мотивация құрылымы', bullets: ['a', 'b', 'c'], imageQuery: 'NONE' }), false);
  assert.strictEqual(mayCarryPhoto({ title: 'Мотивация', bullets: ['a', 'b', 'c'], imageQuery: 'career counselor talking with student' }), true);
  assert.strictEqual(isLatinQuery('NONE'), false, 'NONE іздеу сұранысы емес');
});
