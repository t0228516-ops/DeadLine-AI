'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../products/presentation/design/decorPick');
const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');

const deck = (design) => [
  { title: 'Қазақ хандығы', subtitle: 'Керей мен Жәнібек', bullets: ['Орындаған: A'], composition: { design, mood: 'sand' } },
  { title: 'Билік', bullets: ['Хан — ең жоғары билеуші', 'Би — дауды шешті', 'Батыр — әскерді басқарды'] },
  { title: 'Сауда', bullets: ['Керуен — Сырдария қалалары', 'Базар — Түркістан', 'Тауар — жылқы мен тері'], webImageUrl: 'https://x/y.jpg' },
  { title: 'Әскер', bullets: ['Атты әскер — негізгі күш', 'Садақ — басты қару', 'Жасақ — рулардан'] },
  { title: 'Қорытынды', bullets: ['Бірлік — халық біріктірілді', 'Мемлекет — шекара қалыптасты'] },
];
const withKey = async (fn) => {
  const old = process.env.DEEPSEEK_API_KEY; process.env.DEEPSEEK_API_KEY = 'test';
  try { return await fn(); } finally { if (old === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = old; }
};

test('decor catalogue: grouped engravings, Kazakh ornaments, no edge-to-edge scenes', () => {
  const c = D.catalogue();
  const kinds = new Set([...c.values()].map((x) => x.kind));
  for (const k of ['engraving', 'ornament', 'doodle']) assert.ok(kinds.has(k), k);
  assert.ok(c.has('o:medallion') && c.has('k:kz-shanyrak'));
  assert.ok(![...c.values()].some((x) => x.files.some((f) => /camel-caravan-1\.webp$/.test(f))), 'landscape scene excluded');
  for (const x of c.values()) assert.ok(x.files.length > 0);
});

test('decor pick: nothing without a key or for systems without decor', async () => {
  const s = deck('heritage');
  const r = await D.pickDeckDecor(s, { llm: async () => { throw new Error('must not be called'); } });
  if (!process.env.DEEPSEEK_API_KEY) assert.deepStrictEqual(r, { asked: 0, picked: 0 });
  await withKey(async () => {
    const r2 = await D.pickDeckDecor(deck('swiss'), { llm: async () => { throw new Error('must not be called'); } });
    assert.deepStrictEqual(r2, { asked: 0, picked: 0 });
  });
});

test('decor pick: valid ids only, once per deck, photo slides skipped, unseen = null', async () => {
  await withKey(async () => {
    const s = deck('heritage');
    let prompt = '';
    const llm = async (sys, user) => {
      prompt = user;
      return { picks: [
        { slide: 2, id: 'e:jeweled-crown' },
        { slide: 3, id: 'e:money-bag-coins' }, // фотолы слайд — алынбайды
        { slide: 4, id: 'e:jeweled-crown' },   // қайталау — алынбайды
        { slide: 5, id: 'e:does-not-exist' },
      ] };
    };
    const r = await D.pickDeckDecor(s, { llm, topic: 'Қазақ хандығы' });
    assert.ok(/MAX = \d/.test(prompt) && /e:jeweled-crown/.test(prompt));
    assert.ok(!/^3\. /m.test(prompt), 'photo slide not offered');
    assert.strictEqual(r.picked, 1);
    assert.ok(s[1].decorPick && /\.webp$/.test(s[1].decorPick.file) && s[1].decorPick.kind === 'engraving');
    assert.strictEqual(s[3].decorPick, null);
    assert.strictEqual(s[4].decorPick, null);
    assert.strictEqual(s[2].decorPick, undefined);
  });
});

test('decor pick: model failure leaves the deck as before', async () => {
  await withKey(async () => {
    const s = deck('heritage');
    const r = await D.pickDeckDecor(s, { llm: async () => { throw new Error('boom'); } });
    assert.strictEqual(r.picked, 0);
    assert.ok(s.every((x) => x.decorPick === undefined));
  });
});

test('builder: library decor goes into the background layer; review "decor" flag and "none" are respected', () => {
  const file = [...D.catalogue().get('e:jeweled-crown').files][0];
  const s = deck('heritage').map((x) => ({ ...x, webImageUrl: '' }));
  s[1].decorPick = { file, kind: 'engraving', id: 'e:jeweled-crown' };
  s[3].decorPick = { file, kind: 'engraving', id: 'e:jeweled-crown' };
  s[3].composition = { cx: { noDecor: true } };
  s[4].decorPick = null;
  const html = build3DPresentationHTML(s, 'Қазақ хандығы', { system: 'heritage' });
  const arts = html.split('<article').slice(1);
  assert.match(arts[1], /class="decor decor-lib decor-engraving"[^>]*src="data:image\/webp;base64,/);
  assert.ok(arts[1].indexOf('decor-lib') < arts[1].indexOf('layer-mid'), 'decor sits in the background layer');
  assert.ok(!/decor-lib/.test(arts[3]), 'visual review asked for no decor');
  assert.ok(!/class="decor/.test(arts[4]), 'model said none → no keyword decor either');
});

test('builder: ornaments are recoloured with the palette accent', () => {
  const file = D.catalogue().get('o:medallion').files[0];
  const uri = D.decorPickUri({ file, kind: 'ornament' }, '#b5651d');
  const svg = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
  assert.ok(svg.includes('#b5651d') && !svg.includes('currentColor'));
});
