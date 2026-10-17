'use strict';
// Екінші айналым: бірінші іздеу сай фото таппаса, DeepSeek шын бар нысан ұсынады → Commons-тан табылады (желісіз).
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const calls = [];
const png = (w, h) => { const b = Buffer.alloc(33); b.write('\x89PNG\r\n\x1a\n', 0, 'latin1'); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const commons = (name) => ({ data: { query: { pages: { 1: { index: 1, title: `File:${name}.jpg`, imageinfo: [{
  mime: 'image/jpeg', url: `https://upload.wikimedia.org/wikipedia/commons/a/aa/${name}.jpg`,
  thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/${name}.jpg/1920px-${name}.jpg`, width: 1920, height: 1280 }] } } } } });
const fakeAxios = {
  get: async (url, cfg = {}) => {
    calls.push({ url, q: (cfg.params || {}).gsrsearch || (cfg.params || {}).q || '' });
    if (url.startsWith('https://commons.wikimedia.org/')) return commons(/Колхоз/.test(cfg.params.gsrsearch) ? 'Kolkhoz_1931' : 'Modern_farm');
    if (url.startsWith('https://upload.wikimedia.org/')) return { status: 200, headers: { 'content-type': 'image/png' }, data: png(1920, 1280) };
    const e = new Error('no stub'); e.response = { status: 404, headers: {} }; throw e;
  },
  post: async () => { throw new Error('no post'); },
};
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === 'axios' ? fakeAxios : origLoad.call(this, req, ...rest); };
for (const k of ['PEXELS_API_KEY', 'UNSPLASH_ACCESS_KEY', 'PIXABAY_API_KEY', 'EUROPEANA_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY']) delete process.env[k];
process.env.DEEPSEEK_API_KEY = 'test';

const { _fetchPhotoVision } = require('../products/presentation/index');

test('photo rescue: nothing fits → DeepSeek suggests real archive subjects (Russian for Commons) → archive photo found', async () => {
  let asked = '';
  global.fetch = async (url, init) => {
    asked = JSON.parse(init.body).messages[1].content;
    const content = JSON.stringify({ queries: ['Soviet kolkhoz 1930s photograph'], commons: ['Колхоз Казахстан 1930'] });
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: {} }), text: async () => content };
  };
  const scores = new Map();
  const vision = async (batch) => batch.map((c, i) => {
    const s = /Kolkhoz/.test(c.url) ? { fit: 9, appeal: 7, flaw: '' } : { fit: 3, appeal: 7, flaw: 'modern' };
    scores.set(c.url, s);
    return { i, ...s };
  }).filter((r) => r.fit >= 7);
  vision.scoreOf = (c) => scores.get(c.url) || null;
  const got = await _fetchPhotoVision({ title: 'Ұжымдастыру барысы' }, {
    query: 'Kazakh peasants protest against collectivization', topic: '1920–1930 ұжымдастыру', topicTitle: '1920–1930 ұжымдастыру',
    text: 'Шаруалар колхозға күштеп біріктірілді', used: new Set(), avoid: new Set(), vision, budget: { left: 5 },
  });
  assert.ok(got.dataUri, 'сурет табылды');
  assert.strictEqual(got.source, 'wikimedia');
  assert.match(asked, /rejected as: modern/, 'бас тартылған себеп DeepSeek-ке берілді');
  assert.ok(calls.some((c) => c.q === 'Колхоз Казахстан 1930'), 'орысша атау Commons-та ізделді');
});

test('last resort: nothing passes even after the rescue round → the best photo seen (fit ≥ 5) still goes on the slide', async () => {
  global.fetch = async () => {
    const content = JSON.stringify({ queries: [], commons: [] });
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: {} }), text: async () => content };
  };
  const scores = new Map();
  const vision = async (batch) => { batch.forEach((c) => scores.set(c.url, { fit: 5, appeal: 6, bg: 5, flaw: 'modern' })); return []; };
  vision.scoreOf = (c) => scores.get(c.url) || null;
  const got = await _fetchPhotoVision({ title: 'Ұжымдастыру саясаты' }, {
    query: 'Kazakh village collectivization 1930s', topic: 'Ұжымдастыру', topicTitle: 'Ұжымдастыру',
    used: new Set(), avoid: new Set(), vision, budget: { left: 5 },
  });
  assert.ok(got.dataUri, 'бос қалмады');
});
