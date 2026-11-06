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

// 2026-11-06: «Лони мен Қарағанды» — студент «добавь их фото» деп жазған, ал LLM 7 слайдтың бәріне imageQuery "NONE" қойған →
// бірде-бір фото ізделмеді (0/7). Студент фото сұраса NONE еленбейді; бәрі NONE болса — кемінде мұқабаға іздеу.
test('photo plan: «NONE» on every slide — the cover is still searched; if the student asked for photos, NONE is ignored', () => {
  const { planPhotoSlides, wantsPhotos } = require('../products/presentation/photoPlan');
  const types = ['full_background', 'right_half', 'left_half', 'full_background', 'none', 'right_half', 'full_background'];
  const slides = types.map((t, i) => ({ title: `Слайд ${i}`, subtitle: 'Қысқа', bullets: i === 4 ? [] : ['Бір — дерек', 'Екі — дерек', 'Үш — дерек'],
    body: i === 4 ? 'Ұзын абзац мәтіні осында тұр, қырық таңбадан асады, иә.' : '', imageQuery: 'NONE', composition: { image: t } }));
  assert.deepStrictEqual([...planPhotoSlides(slides, { budget: 4 }).indexes], [0]);
  assert.ok(planPhotoSlides(slides, { budget: 4, wantsPhotos: true }).indexes.size >= 3);
  // кейбір слайд қана NONE (абстракт ұғым) → олар фотосыз қалады
  const mixed = slides.map((s, i) => ({ ...s, imageQuery: i % 2 ? 'NONE' : 'Loni Ghaziabad smog street' }));
  assert.ok([...planPhotoSlides(mixed, { budget: 4 }).indexes].every((i) => i % 2 === 0));

  assert.strictEqual(wantsPhotos('самый грязный город в мире напиши про Лони и Караганда и добавь их фото'), true);
  assert.strictEqual(wantsPhotos('Абай туралы, суреттерімен'), true);
  assert.strictEqual(wantsPhotos('History of Rome with photos'), true);
  assert.strictEqual(wantsPhotos('Фотосинтез процесі'), false);
  assert.strictEqual(wantsPhotos('Фотон және фотоэффект'), false);
  assert.strictEqual(wantsPhotos('Photosynthesis in plants'), false);
});
