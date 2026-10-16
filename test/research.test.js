'use strict';
const test = require('node:test');
const assert = require('node:assert');
const R = require('../products/presentation/research');

test('search query drops the task words, keeps the topic', () => {
  assert.strictEqual(R.topicQuery('Зар заман поэзиясы: Шортанбай, Дулат — көзқарасы. 10 слайд, қазақша.'), 'Зар заман поэзиясы: Шортанбай, Дулат — көзқарасы');
  assert.strictEqual(R.topicQuery('Абай туралы презентация жаса 12 слайдтан'), 'Абай туралы');
  assert.strictEqual(R.topicQuery('Машинное обучение в медицине, 10 слайдов, на русском'), 'Машинное обучение в медицине');
});

test('only good, distinct results are kept; authoritative ones first', () => {
  const res = [
    { url: 'https://a.kz/x', title: 'A', summary: 'Дулат 1802 жылы Семей маңында туған', rerank_score: 1.6, authority: 1 },
    { url: 'https://b.kz/y', title: 'B', summary: 'Шортанбай 1818–1881', rerank_score: 1.55, authority: 4 },
    { url: 'https://c.kz/z', title: 'C', summary: 'weak', rerank_score: 0.9, authority: 4 },
    { url: 'https://a.kz/x#p2', title: 'A again', summary: 'other text', rerank_score: 1.7, authority: 1 },
    { url: 'https://d.kz/w', title: 'D', summary: 'Мұрат 1843', rerank_score: 1.3, authority: 3 },
  ];
  const got = R.pick(res, 5);
  assert.deepStrictEqual(got.map((x) => x.title), ['B', 'A again', 'D']);
  assert.match(R.sheetText(got), /^\[1\] Шортанбай 1818–1881 \(source: b\.kz — B\)/);
});

test('no key or RESEARCH=0 → no search, generation continues as before', async () => {
  const keep = { k: process.env.DEEPSEEK_API_KEY, r: process.env.RESEARCH };
  delete process.env.DEEPSEEK_API_KEY;
  assert.strictEqual(await R.gatherTopic('Абай'), null);
  process.env.DEEPSEEK_API_KEY = 'x'; process.env.RESEARCH = '0';
  assert.strictEqual(await R.gatherTopic('Абай'), null);
  if (keep.k === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = keep.k;
  if (keep.r === undefined) delete process.env.RESEARCH; else process.env.RESEARCH = keep.r;
});

test('search errors never throw: 429 is retried once, then empty', async () => {
  const keep = process.env.DEEPSEEK_API_KEY; process.env.DEEPSEEK_API_KEY = 'x';
  let calls = 0;
  const fake = async () => { calls++; return { ok: false, status: 429, json: async () => ({}) }; };
  const out = await R.searchWeb('Абай', { fetch: fake });
  assert.deepStrictEqual(out, []);
  assert.strictEqual(calls, 2);
  const ok = async () => ({ ok: true, status: 200, json: async () => ({ results: [{ url: 'https://x.kz', summary: 's', rerank_score: 2 }] }) });
  assert.strictEqual((await R.searchWeb('Абай', { fetch: ok })).length, 1);
  if (keep === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = keep;
});
