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

test('reference list takes only real titles with stable links', () => {
  assert.ok(R.citable({ url: 'https://zenodo.org/records/14556619', title: 'БАСПА СӨЗДЕ ЗАРЗАМАН ПОЭЗИЯСЫНЫҢ ӨКІЛДЕРІ' }));
  assert.ok(!R.citable({ url: 'https://nabrk.kz/a.pdf?time=1766&key=f95', title: 'Зар заман' }), 'temporary link');
  assert.ok(!R.citable({ url: 'https://x.kz/a.pdf', title: 'Шығармалары қайшылыққа толы, күрделі тұлға саналған зар-заман ақындарына М' }), 'cut sentence');
  assert.ok(!R.citable({ url: 'https://x.kz/a', title: 'Идеологиялық қатаң қысымшылыққа қарамастан аталған дәуірдің айтулы өкілдері Дулат, Шортанбай, Мұрат, Әбубәкір, Асан шығармаларын' }), 'too long');
});

test('re-running slide research (language retry) starts clean; slide sources carry no raw URL', async () => {
  const keep = process.env.DEEPSEEK_API_KEY; process.env.DEEPSEEK_API_KEY = 'x';
  const realFetch = global.fetch;
  const hit = (u, t) => ({ url: u, title: t, site_name: 'kk.wikipedia.org', summary: t + ' мәтін', rerank_score: 2, authority: 4 });
  global.fetch = async (url, init) => {
    const q = JSON.parse(init.body).query;
    const results = /site:wikipedia/.test(q) ? [hit('https://kk.wikipedia.org/wiki/%D0%97%D0%B0%D1%80', 'Зар заман')] : [hit('https://x.kz/' + encodeURIComponent(q.split(' ').pop()), 'Дереккөз ' + q.split(' ').pop())];
    return { ok: true, status: 200, json: async () => ({ results }) };
  };
  try {
    const r = await R.gatherTopic('Зар заман ақындары');
    await R.gatherSlides(r, ['Мұқаба', 'Дулат', 'Шортанбай', 'Қорытынды'], { skip: (i) => i === 0 || i === 3 });
    const first = Object.keys(r.perSlide).sort().join(',');
    await R.gatherSlides(r, ['Мұқаба', 'Мұрат', 'Дулат', 'Қорытынды'], { skip: (i) => i === 0 || i === 3 });
    assert.strictEqual(first, '1,2');
    assert.deepStrictEqual(Object.keys(r.perSlide).sort().join(','), '1,2', 'second plan gets its own facts, not leftovers');
    const list = R.sourceList(r);
    assert.ok(list.length && list.every((x) => !/https?:/.test(x)), 'slide entries: title — site, no URL');
    assert.strictEqual(R.citableSources(r, 1)[0].url, 'https://kk.wikipedia.org/wiki/Зар', 'readable decoded link for the referat');
  } finally {
    global.fetch = realFetch;
    if (keep === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = keep;
  }
});
