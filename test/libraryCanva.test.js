'use strict';
// Canva шаблондары: «Designed with Canva» credits слайды, сурет-пішіндер (p:sp + blipFill), жеке қойма (S3 қолтаңбасы), каталог (желісіз).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.LIBRARY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-canva-'));
const { readZipAll } = require('../products/presentation/templateFill');
const { orderedSlides, relsMap } = require('../design-dna/structure');
const { carveDeck } = require('../products/presentation/library/carve');
const L = require('../products/presentation/library');
const { picsOf, underText } = require('../products/presentation/library/photos');
const s3 = require('../products/presentation/library/s3');

const FIX = fs.readFileSync(path.join(__dirname, 'fixture-canva.pptx'));
const texts = (xml) => [...String(xml).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);

test('canva credits: largest text says "Designed with Canva", the next links to canva.com, other text is removed', () => {
  const deck = carveDeck(FIX, [0, 0]);
  const out = L.canvaCredits(L.canvaCredits(deck, -1), -1);
  const files = readZipAll(out);
  const [first, last] = orderedSlides(files);
  assert.deepStrictEqual(texts(files.get(last)).sort(), ['Designed with Canva', 'www.canva.com'].sort());
  const rels = files.get(last.replace(/([^/]+)$/, '_rels/$1.rels'));
  const link = Object.entries(relsMap(rels)).filter(([, r]) => r.target === 'https://www.canva.com');
  assert.strictEqual(link.length, 1, 'бір сілтеме');
  const xml = String(files.get(last));
  assert.strictEqual((xml.match(new RegExp(`hlinkClick r:id="${link[0][0]}"`, 'g')) || []).length, 1);
  assert.ok(/<p:cNvPr\b[^>]*><a:hlinkClick [^>]*\/>/.test(xml), 'сілтеме пішінге (мәтін түсі өзгермейді)');
  assert.ok(!/<a:rPr\b[^>]*\sspc="/.test(xml), 'әріп аралығы тарылмайды');
  assert.ok(texts(files.get(first)).length > 2, 'басқа слайд өзгермейді');
  assert.ok(/blipFill/.test(xml), 'дизайн (суреттер) сақталады');
});

test('canva credits: appendCredits picks the Canva form by source; credits slide falls back to closing, then cover', () => {
  assert.strictEqual(L.creditsSlide({ cover: 1, closing: 9, credits: null }), 9);
  assert.strictEqual(L.creditsSlide({ cover: 1, closing: null, credits: null }), 1);
  assert.strictEqual(L.creditsSlide({ cover: 1, closing: 9, credits: 12 }), 12);
  const deck = carveDeck(FIX, [1]);
  const out = L.appendCredits(deck, { source: 'canva', creditsBuf: carveDeck(FIX, [1, 0]), creditsIdx: 1 });
  const files = readZipAll(out);
  const sl = orderedSlides(files);
  assert.strictEqual(sl.length, 2);
  assert.ok(texts(files.get(sl[1])).includes('Designed with Canva'));
});

test('photos: Canva image shapes (p:sp with blipFill) are photo slots; plain shapes and tiled fills are not', () => {
  const pic = '<p:sp><p:nvSpPr/><p:spPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="300" cy="200"/></a:xfrm><a:custGeom/><a:blipFill><a:blip r:embed="rId7"/><a:stretch/></a:blipFill></p:spPr></p:sp>';
  const tiled = pic.replace('<a:stretch/>', '<a:tile/>').replace('rId7', 'rId8');
  const plain = '<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5" cy="5"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>x</a:t></a:r></a:p></p:txBody></p:sp>';
  const textWithBlipBullet = '<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5" cy="5"/></a:xfrm></p:spPr><p:txBody><a:p><a:pPr><a:buBlip><a:blip r:embed="rId9"/></a:buBlip></a:pPr></a:p></p:txBody></p:sp>';
  assert.deepStrictEqual(picsOf(pic + tiled + plain + textWithBlipBullet), [{ rid: 'rId7', x: 10, y: 20, w: 300, h: 200 }]);
});

test('s3: requests are signed (SigV4) for virtual-host and path style; unconfigured storage is reported, not called', async () => {
  const keep = { ...process.env };
  try {
    for (const k of ['LIBRARY_S3_ENDPOINT', 'LIBRARY_S3_BUCKET', 'LIBRARY_S3_KEY', 'LIBRARY_S3_SECRET']) delete process.env[k];
    assert.strictEqual(s3.configured(), false);
    assert.strictEqual(await s3.getObject('canva/x.pptx'), null);
    Object.assign(process.env, { LIBRARY_S3_ENDPOINT: 'https://t3.example.dev', LIBRARY_S3_BUCKET: 'bkt', LIBRARY_S3_KEY: 'AKID', LIBRARY_S3_SECRET: 'secret' });
    const now = new Date('2026-10-25T10:00:00Z');
    const a = s3.signed('GET', 'canva/DAH-1.pptx', null, now);
    assert.strictEqual(a.url, 'https://bkt.t3.example.dev/canva/DAH-1.pptx');
    assert.strictEqual(a.headers['x-amz-date'], '20261025T100000Z');
    assert.match(a.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKID\/20261025\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    assert.strictEqual(s3.signed('GET', 'canva/DAH-1.pptx', null, now).headers.Authorization, a.headers.Authorization, 'тұрақты');
    process.env.LIBRARY_S3_PATH_STYLE = '1';
    const b = s3.signed('PUT', 'canva/DAH-1.pptx', Buffer.from('x'), now);
    assert.strictEqual(b.url, 'https://t3.example.dev/bkt/canva/DAH-1.pptx');
    assert.notStrictEqual(b.headers.Authorization, a.headers.Authorization);
  } finally { process.env = keep; }
});

test('fetchTemplate: a Canva template comes from private storage once, then from disk; missing → error (caller picks another)', async () => {
  const t = L.CATALOG.templates.find((x) => x.source === 'canva');
  assert.ok(t, 'Canva шаблондары каталогта');
  let calls = 0;
  const store = { getObject: async (k) => { calls++; assert.strictEqual(k, `canva/${t.id}.pptx`); return FIX; } };
  assert.ok((await L.fetchTemplate(t, { s3: store })).equals(FIX));
  await L.fetchTemplate(t, { s3: store });
  assert.strictEqual(calls, 1, 'екінші рет дискіден');
  const other = L.CATALOG.templates.filter((x) => x.source === 'canva')[1];
  await assert.rejects(L.fetchTemplate(other, { s3: { getObject: async () => null } }), /қоймада жоқ/);
});

test('canva catalog: ids are Canva design ids, every template has text slides and roles inside the deck, licence cap 100', () => {
  const cv = L.CATALOG.templates.filter((x) => x.source === 'canva');
  assert.ok(cv.length >= 20 && cv.length <= 100);
  assert.strictEqual(new Set(cv.map((t) => t.id)).size, cv.length);
  for (const t of cv) {
    assert.match(t.id, /^DA[A-Za-z0-9_-]{9}$/, t.id);
    assert.ok(t.text.length >= 3, `${t.id}: мәтін слайдтары`);
    const all = [t.cover, t.agenda, t.closing, ...t.text, ...t.section, ...t.stats, ...t.quote].filter(Boolean);
    assert.strictEqual(new Set(all).size, all.length, `${t.id}: бір слайд — бір рөл`);
    assert.ok(!all.includes(1) || t.cover === 1, t.id);
  }
});

test('photos: a picture behind a text box is the slide background (kept in Canva decks); a picture beside text is a photo slot', () => {
  const pic = { x: 0, y: 0, w: 1000, h: 600 };
  assert.strictEqual(underText(pic, [{ x: 100, y: 100, w: 400, h: 100 }]), true, 'мәтін суреттің үстінде');
  assert.strictEqual(underText(pic, [{ x: 1100, y: 100, w: 400, h: 100 }]), false, 'мәтін суреттің жанында');
  assert.strictEqual(underText(pic, [{ x: 900, y: 100, w: 400, h: 100 }]), false, 'аздап қабысады — фон емес');
});

test('storage down: after one Canva template cannot be fetched, the next requests use SlidesCarnival for a while', async () => {
  const t = L.CATALOG.templates.find((x) => x.source === 'canva' && x.subjects && x.subjects.includes('medicine'));
  const picks = () => Array.from({ length: 40 }, () => L.chooseTemplate({ topic: 'Жүрек ауруларының алдын алу' }).source);
  assert.ok(picks().includes('canva'), 'әдетте Canva да таңдалады');
  for (let i = 0; i < 20; i++) assert.strictEqual(L.chooseTemplate({ topic: 'Жүрек ауруларының алдын алу', noCanva: true }).source, 'slidescarnival');
  let asked = 0;
  await assert.rejects(L.prepareDeck({ entry: t, s3: { getObject: async () => { asked++; return null; } }, arrange: false }), /қоймада жоқ/);
  assert.strictEqual(asked, 1);
  assert.ok(!picks().includes('canva'), 'қойма істемейді — 5 минут Canva таңдалмайды');
});

test('disabled templates (failed the quality test) stay in the catalog file but are never chosen', () => {
  const raw = [...require('../products/presentation/library/canva.json').templates, ...require('../products/presentation/library/slidescarnival.json').templates];
  const off = raw.filter((x) => x.disabled).map((x) => x.id);
  assert.ok(off.includes('DAHZA4I5MGw') && off.includes('sc02662'));
  for (const id of off) assert.ok(!L.CATALOG.templates.some((x) => x.id === id), id);
});
