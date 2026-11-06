'use strict';
/** Тегін квиз жасаушы: тақырыптан / материалдан сұрақтар, тіл тексеруі, ауыстыру (LLM — жалған) */
const test = require('node:test');
const assert = require('node:assert');
const M = require('../core/quizMaker');

const kkQ = (i) => ({ q: `Фотосинтез туралы ${i}-сұрақ: хлорофилл не істейді?`, options: [`Жарықты сіңіреді ${i}`, `Суды буландырады ${i}`, `Тамырды өсіреді ${i}`, `Тұқым береді ${i}`], correct: 0, explain: 'Хлорофилл жарық энергиясын сіңіреді.' });
const enQ = (i) => ({ q: `English question number ${i} about plants?`, options: ['Light', 'Water', 'Soil', 'Air'], correct: 0, explain: 'x' });

test('generateQuiz: asks for N+3, keeps N valid questions in the right language, prompt carries topic and material', async () => {
  let seen = null;
  const llm = async (sys, user, label) => { seen = { sys, user, label }; return { quiz: [enQ(1), ...Array.from({ length: 12 }, (_, i) => kkQ(i + 1))] }; };
  const r = await M.generateQuiz({ topic: '  Фотосинтез  ', language: 'kk', count: 10, material: 'Хлорофилл — жасыл пигмент. '.repeat(10), llm, rnd: () => 0 });
  assert.strictEqual(r.questions.length, 10);
  assert.ok(r.questions.every((q) => /[А-Яа-яӘәҚқ]/.test(q.q)), 'English question dropped from a Kazakh quiz');
  assert.strictEqual(r.topic, 'Фотосинтез'); assert.strictEqual(r.fromMaterial, true);
  assert.match(seen.user, /Write 13 questions/); assert.match(seen.user, /<<<MATERIAL/); assert.match(seen.user, /Kazakh/);
  assert.strictEqual(seen.label, 'freeQuiz');
  for (const q of r.questions) { assert.strictEqual(q.options.length, 4); assert.ok(q.correct >= 0 && q.correct < 4); }
});

test('generateQuiz: count is clamped to 5–15; topic-only prompt forbids invented facts; too few valid → error code few', async () => {
  assert.strictEqual(M.clampCount(2), 5); assert.strictEqual(M.clampCount(99), 15); assert.strictEqual(M.clampCount('x'), 10);
  let prompt = '';
  const r = await M.generateQuiz({ topic: 'Newton laws', language: 'en', count: 5, llm: async (s, u) => { prompt = u; return { quiz: Array.from({ length: 8 }, (_, i) => enQ(i)) }; } });
  assert.strictEqual(r.questions.length, 5);
  assert.match(prompt, /never invent facts/); assert.doesNotMatch(prompt, /MATERIAL/);
  await assert.rejects(M.generateQuiz({ topic: 'Тақырып', language: 'kk', count: 10, llm: async () => ({ quiz: [kkQ(1), kkQ(2)] }) }), (e) => e.code === 'few');
  await assert.rejects(M.generateQuiz({ topic: 'a', llm: async () => ({}) }), (e) => e.code === 'topic');
});

test('replaceQuestion: returns a new question that is not already in the quiz', async () => {
  const questions = Array.from({ length: 5 }, (_, i) => kkQ(i + 1));
  let prompt = '';
  const fresh = await M.replaceQuestion({
    topic: 'Фотосинтез', language: 'kk', questions, qi: 2, rnd: () => 0,
    llm: async (s, u) => { prompt = u; return { quiz: [kkQ(1), kkQ(9)] }; }, // біріншісі — бар сұрақтың қайталауы
  });
  assert.strictEqual(fresh.q, kkQ(9).q);
  assert.match(prompt, /removed this question/); assert.match(prompt, /do NOT repeat/);
  await assert.rejects(M.replaceQuestion({ language: 'kk', questions, qi: 9, llm: async () => ({}) }), (e) => e.code === 'index');
  await assert.rejects(M.replaceQuestion({ language: 'kk', questions, qi: 0, llm: async () => ({ quiz: [kkQ(2)] }) }), (e) => e.code === 'few');
});

test('prepMaterial: long material is cut at a word boundary, whitespace squeezed', () => {
  const t = M.prepMaterial('сөз   '.repeat(10000));
  assert.ok(t.length <= M.MAX_MATERIAL && !/\s{2,}/.test(t) && !t.endsWith(' '));
});
