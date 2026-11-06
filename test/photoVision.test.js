'use strict';
// Суретті көзбен таңдау + AI сурет: Gemini REST жалған fetch-пен, кішірейтілген суреттер жалған axios-пен (желісіз).
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const thumbHits = [];
const fakeAxios = {
  get: async (url) => {
    thumbHits.push(url);
    if (/broken/.test(url)) { const e = new Error('404'); e.response = { status: 404 }; throw e; }
    return { status: 200, headers: { 'content-type': 'image/jpeg' }, data: Buffer.from('jpeg-' + url) };
  },
};
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === 'axios' ? fakeAxios : origLoad.call(this, req, ...rest); };

const G = require('../core/googleAi');
const V = require('../products/presentation/photoVision');
const Gen = require('../products/presentation/imageGen');

const origFetch = global.fetch;
let replies = [];
const sent = [];
function stubFetch() {
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url, body, headers: init.headers });
    const r = replies.shift();
    if (typeof r === 'function') return r(url, body);
    return { ok: true, status: 200, text: async () => JSON.stringify(r) };
  };
}
const jsonReply = (obj) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }], usageMetadata: { promptTokenCount: 3000, candidatesTokenCount: 200, totalTokenCount: 3200 } });

test.afterEach(() => { global.fetch = origFetch; delete process.env.GOOGLE_API_KEY; replies = []; sent.length = 0; thumbHits.length = 0; });

test('no Google key → chooser is null (text judge stays), helpers return null without calling the network', async () => {
  delete process.env.GOOGLE_API_KEY; delete process.env.GEMINI_API_KEY;
  assert.strictEqual(V.makeVisionChooser({ title: 'x' }), null);
  assert.strictEqual(await G.geminiJson([{ text: 'x' }]), null);
  assert.strictEqual(await G.geminiImage('x'), null);
  assert.strictEqual(await Gen.generateSlideImage({ title: 'x', query: 'y' }, { left: 2 }), null);
});

test('vision chooser sends thumbnails (not full images), key in header, ranks by fit+appeal, drops ugly and off-topic', async () => {
  process.env.GOOGLE_API_KEY = 'k';
  stubFetch();
  replies.push(jsonReply({ photos: [
    { i: 0, fit: 9, appeal: 4, bg: 5, focus: '50% 30%', flaw: 'blurry' },   // сай, бірақ бұлыңғыр → түседі
    { i: 1, fit: 3, appeal: 10, bg: 9, focus: '', flaw: '' },                // әдемі, бірақ тақырыпқа жат → түседі
    { i: 2, fit: 8, appeal: 9, bg: 7, focus: '30% 60%', flaw: '' },
    { i: 3, fit: 10, appeal: 7, bg: 6, focus: '62% 40%', flaw: '' },
  ] }));
  const choose = V.makeVisionChooser({ topic: 'Қазақ хандығы', title: 'Керей мен Жәнібек', text: '1465 жыл', query: 'Kazakh Khanate founding' });
  const cands = [
    { url: 'https://big/0.jpg', thumb: 'https://t/0.jpg', source: 'pexels' },
    { url: 'https://big/1.jpg', thumb: 'https://t/1.jpg', source: 'unsplash' },
    { url: 'https://big/2.jpg', thumb: 'https://t/2.jpg', source: 'openverse' },
    { url: 'https://big/3.jpg', thumb: 'https://t/3.jpg', source: 'wikimedia', desc: 'Kazakh Khanate 1465 painting' },
  ];
  const ranked = await choose(cands);
  assert.deepStrictEqual(ranked.map((r) => r.i), [3, 2]);
  assert.strictEqual(ranked[0].focus, '62% 40%');
  assert.deepStrictEqual(thumbHits.sort(), ['https://t/0.jpg', 'https://t/1.jpg', 'https://t/2.jpg', 'https://t/3.jpg']);
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].url, /gemini-3\.5-flash-lite:generateContent$/);
  assert.ok(!/key=/.test(sent[0].url), 'кілт URL-де емес');
  assert.strictEqual(sent[0].headers['x-goog-api-key'], 'k');
  const parts = sent[0].body.contents[0].parts;
  assert.strictEqual(parts.filter((p) => p.inline_data).length, 4);
  assert.match(parts[0].text, /Керей мен Жәнібек/);
  assert.match(parts.find((p) => /Photo 3/.test(p.text || '')).text, /archive caption: Kazakh Khanate/);
  // кэш: қайта сұрағанда шақыру жоқ
  assert.deepStrictEqual((await choose(cands)).map((r) => r.i), [3, 2]);
  assert.strictEqual(sent.length, 1);
  assert.deepStrictEqual(choose.scoreOf(cands[1]).fit, 3);
});

test('background placement also needs bg ≥ 6; broken thumbnails are skipped; API failure → null (fallback)', async () => {
  process.env.GOOGLE_API_KEY = 'k';
  stubFetch();
  replies.push(jsonReply({ photos: [{ i: 0, fit: 9, appeal: 9, bg: 2 }, { i: 1, fit: 8, appeal: 8, bg: 8 }] }));
  const choose = V.makeVisionChooser({ title: 'Cover', background: true, cover: true });
  const ranked = await choose([
    { url: 'https://big/a.jpg', thumb: 'https://t/a.jpg' }, { url: 'https://big/x.jpg', thumb: 'https://t/broken.jpg' }, { url: 'https://big/b.jpg', thumb: 'https://t/b.jpg' },
  ]);
  assert.deepStrictEqual(ranked.map((r) => r.i), [2], 'фонға жарамайтын медаль түседі; сынық thumbnail жіберілмейді');
  assert.strictEqual(sent[0].body.contents[0].parts.filter((p) => p.inline_data).length, 2);

  replies.push(() => ({ ok: false, status: 400, text: async () => 'bad request' }));
  const choose2 = V.makeVisionChooser({ title: 'Other' });
  assert.strictEqual(await choose2([{ url: 'https://big/c.jpg', thumb: 'https://t/c.jpg' }]), null);
});

test('AI image: named subjects never generated; budget caps; generated image is checked (text/artefacts rejected)', async () => {
  process.env.GOOGLE_API_KEY = 'k';
  stubFetch();
  const budget = { left: 2 };
  assert.strictEqual(await Gen.generateSlideImage({ title: 'Абай', query: 'Abai Kunanbayev portrait', named: true }, budget), null);
  assert.strictEqual(budget.left, 2, 'атаулыға ақша жұмсалмайды');

  const img = 'A'.repeat(2000);
  // 1) interactions пішіні: сурет жауапта терең жатыр
  replies.push({ id: 'x', steps: [{ type: 'model_output', content: [{ type: 'image', mime_type: 'image/jpeg', data: img }] }] });
  replies.push(jsonReply({ photos: [{ i: 0, fit: 9, appeal: 8, flaw: '' }] }));
  const ok = await Gen.generateSlideImage({ topic: 'Экология', title: 'Арал теңізі', query: 'dried Aral Sea ship graveyard' }, budget);
  assert.strictEqual(ok.dataUri, 'data:image/jpeg;base64,' + img);
  assert.match(sent[0].url, /\/interactions$/);
  assert.strictEqual(sent[0].body.model, 'gemini-3.1-flash-lite-image');
  assert.strictEqual(sent[0].body.response_format.aspect_ratio, '4:3', 'жақтау орны → 4:3');
  assert.match(sent[0].body.input, /NO text, letters/);
  assert.match(sent[0].body.input, /Арал теңізі/);

  // 2) тексеруден өтпеді (мәтін бар) → алынбайды
  replies.push({ steps: [{ type: 'model_output', content: [{ type: 'image', mime_type: 'image/jpeg', data: img }] }] });
  replies.push(jsonReply({ photos: [{ i: 0, fit: 9, appeal: 8, flaw: 'text' }] }));
  assert.strictEqual(await Gen.generateSlideImage({ title: 'Су', query: 'water' }, budget), null);
  assert.strictEqual(budget.left, 0);
  assert.strictEqual(await Gen.generateSlideImage({ title: 'Тағы', query: 'more' }, budget), null, 'лимит бітті');
});

test('generateContent image shape is understood too (inlineData in candidates)', () => {
  const img = 'B'.repeat(1500);
  const hit = G.findImageData({ candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: img } }] } }] });
  assert.deepStrictEqual(hit, { mime: 'image/png', data: img });
  assert.strictEqual(G.findImageData({ candidates: [{ content: { parts: [{ text: 'no image' }] } }] }), null);
  assert.strictEqual(V.normFocus('62%, 140%'), '62% 100%');
  assert.strictEqual(V.normFocus('center'), '');
});

test('no Google key but DeepSeek key → vision runs on deepseek-flash (image_url parts, detail low); 400 on data URL → retried with the thumbnail link', async () => {
  delete process.env.GOOGLE_API_KEY; delete process.env.GEMINI_API_KEY;
  process.env.DEEPSEEK_API_KEY = 'ds';
  try {
    assert.strictEqual(V.visionProvider(), 'deepseek');
    stubFetch();
    replies.push(() => ({ ok: false, status: 400, text: async () => 'image url too long' }));
    replies.push({ choices: [{ message: { content: JSON.stringify({ photos: [{ i: 0, fit: 9, appeal: 8, bg: 7, focus: '40% 30%' }] }) } }], usage: { prompt_tokens: 900, completion_tokens: 40 } });
    const choose = V.makeVisionChooser({ title: 'Арал теңізі', query: 'Aral Sea ships' });
    const ranked = await choose([{ url: 'https://big/s.jpg', thumb: 'https://t/s.jpg' }]);
    assert.deepStrictEqual(ranked.map((r) => [r.i, r.focus]), [[0, '40% 30%']]);
    assert.match(sent[0].url, /api\.deepseek\.com/);
    assert.strictEqual(sent[0].body.model, 'deepseek-flash');
    assert.deepStrictEqual(sent[0].body.thinking, { type: 'disabled' }, 'ойлау режимі өшірулі (әйтпесе жауап бос/кеш)');
    const img = sent[0].body.messages[0].content.find((c) => c.type === 'image_url');
    assert.match(img.image_url.url, /^data:image\/jpeg;base64,/);
    assert.strictEqual(img.image_url.detail, 'low');
    assert.strictEqual(sent[1].body.messages[0].content.find((c) => c.type === 'image_url').image_url.url, 'https://t/s.jpg');
  } finally { delete process.env.DEEPSEEK_API_KEY; }
});

// 2026-11-06 (иесінің келісімі, лог талдауы): fit=6 «жалпы сай» мен appeal=5 фотолар көбіне жалпы алмастырғыш не күңгірт болды →
// сай (fit ≥ 7) әрі көрікті (appeal ≥ 6); дәл нысанның архив фотосы (fit ≥ 9) appeal 5 болса да өтеді
test('thresholds: fit 7 + appeal 6, or an exact archive photo (fit 9, appeal 5); fit 6 and appeal 5 fail; bg 4 is enough; a foreign place fails only on a place-specific slide', async () => {
  process.env.GOOGLE_API_KEY = 'k';
  stubFetch();
  replies.push(jsonReply({ photos: [
    { i: 0, fit: 6, appeal: 7, bg: 5, flaw: '' },          // жалпы сай → енді түседі
    { i: 1, fit: 7, appeal: 5, bg: 4, flaw: '' },          // сай, бірақ күңгірт → түседі
    { i: 2, fit: 6, appeal: 5, bg: 8, flaw: '' },          // түседі
    { i: 3, fit: 8, appeal: 8, bg: 3, flaw: '' },          // фонға мүлдем жарамсыз → түседі
    { i: 4, fit: 9, appeal: 5, bg: 5, flaw: '' },          // дәл нысанның архив фотосы → өтеді, бірінші
    { i: 5, fit: 7, appeal: 6, bg: 4, flaw: '' },          // сай әрі көрікті → өтеді
  ] }));
  const choose = V.makeVisionChooser({ topic: 'Девиантты мінез-құлық', title: 'Қорытынды', background: true });
  const cands = [0, 1, 2, 3, 4, 5].map((k) => ({ url: `https://big/g${k}.jpg`, thumb: `https://t/g${k}.jpg` }));
  assert.deepStrictEqual((await choose(cands)).map((r) => r.i), [4, 5]);
  assert.match(V.SYSTEM, /plaque/, 'адам слайдына үйі/тақтайшасы портрет емес');

  assert.strictEqual(V.placeFlaw('Canada', true), true);
  assert.strictEqual(V.placeFlaw('not Kazakh', true), true);
  assert.strictEqual(V.placeFlaw('Blurry', true), false);
  assert.strictEqual(V.placeFlaw('Canada', false), false, 'жалпы тақырыпта ел маңызды емес');
});

// 2026-11-05: «Элис Болл» презентациясының мұқабасына (сұраныс «female scientist laboratory microscope») МакКлинтоктың
// фотосы fit=9 болып түскен. Архив жазуы басқа нақты адамды атаса, ол фото өтпейді — модель жоғары баға берсе де.
test('wrong person: a photo whose caption names someone the slide is not about is dropped even with fit 9', async () => {
  process.env.GOOGLE_API_KEY = 'k';
  stubFetch();
  replies.push(jsonReply({ photos: [
    { i: 0, fit: 9, appeal: 7, bg: 6, focus: '', flaw: '' },
    { i: 1, fit: 7, appeal: 8, bg: 7, focus: '', flaw: '' },
  ] }));
  const choose = V.makeVisionChooser({ topic: 'Элис Болл және Сара Гилберт: ғылымдағы әйелдер', title: 'Ғылымдағы әйелдер', cover: true, background: true, query: 'female scientist laboratory microscope' });
  const got = await choose([
    { url: 'https://big/mc.jpg', thumb: 'https://t/mc.jpg', source: 'wikimedia', desc: 'Barbara McClintock (1902-1992) shown in her laboratory in 1947.' },
    { url: 'https://big/lab.jpg', thumb: 'https://t/lab.jpg', source: 'pexels', desc: 'Scientist looking into a microscope' },
  ]);
  assert.deepStrictEqual(got.map((x) => x.i), [1]);
  assert.match(sent[0].body.contents[0].parts[0].text, /WRONG PERSON/);
});

test('wrong person: the named person IS the slide subject (Kazakh/Russian spelling, case endings) → photo stays', () => {
  const ok = (topic, title, query, desc) => V.foreignPerson(desc, V.contextKeys(topic, title, '', query));
  assert.strictEqual(ok('Генетика тарихы', 'Барбара Мак-Клинток және секіргіш гендер', 'female scientist laboratory', 'Barbara McClintock (1902-1992) in her laboratory'), '');
  assert.strictEqual(ok('Бетховен шығармашылығы', 'Бетховеннің 9-симфониясы', '', 'Ludwig van Beethoven (1770-1827)'), '');
  assert.strictEqual(ok('Мұхтар Әуезов', 'Әуезовтің өмірі', '', 'Mukhtar Auezov (1897–1961)'), '');
  assert.strictEqual(ok('Ньютон заңдары', 'Бірінші заң', '', 'Isaac Newton (1643–1727)'), '');
  assert.strictEqual(ok('Элис Болл', 'Алапес емі', 'Alice Ball chemist', 'Portrait of Dr. Alice Ball, chemist'), '');
  // басқа адам
  assert.strictEqual(ok('Элис Болл және Сара Гилберт', 'Кіріспе', 'female scientist', 'Barbara McClintock (1902-1992)'), 'Barbara McClintock');
  assert.strictEqual(ok('ДНҚ құрылымы', 'Қос спираль', 'DNA double helix', 'Rosalind Franklin (1920-1958) with microscope'), 'Rosalind Franklin');
});

test('wrong person: captions about events, buildings and states are not people', () => {
  for (const d of ['Great Depression (1929-1939) breadline', 'Eiffel Tower (1887–1889) at night', 'World War II (1939–1945) soldiers',
    'Kazakh Khanate (1465–1847) map', 'A river running through a valley', 'Statue of Liberty']) {
    assert.strictEqual(V.captionPerson(d), '', d);
  }
  assert.strictEqual(V.captionPerson('Sarah Gilbert (born 1962), vaccinologist'), 'Sarah Gilbert');
});
