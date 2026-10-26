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

test('shrinkImages: a big opaque PNG becomes a smaller JPEG (links and content types follow); a transparent PNG stays PNG', async (t) => {
  let browser;
  try { browser = await require('../products/presentation/renderer').launchBrowser(require('puppeteer')); } catch (e) { t.skip('Chromium жоқ: ' + e.message); return; }
  try {
    const page = await browser.newPage();
    const make = (alpha) => page.evaluate((alpha) => {
      const c = document.createElement('canvas'); c.width = 2600; c.height = 1600; const g = c.getContext('2d');
      // фотоға ұқсас (шулы) сурет — PNG-де ауыр, JPEG-те жеңіл
      const d = g.createImageData(2600, 1600);
      // тегіс градиент + сәл шу (фотоға ұқсас): PNG-де ауыр, JPEG-те жеңіл
      for (let i = 0; i < d.data.length; i += 4) { const p = i >> 2; const x = p % 2600; const y = (p / 2600) | 0; const n = Math.random() * 24;
        d.data[i] = (x / 11 + n) & 255; d.data[i + 1] = (y / 7 + n) & 255; d.data[i + 2] = ((x + y) / 17 + n) & 255; d.data[i + 3] = alpha && x < 400 ? 0 : 255; }
      g.putImageData(d, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    }, alpha).then((b) => Buffer.from(b, 'base64'));
    const files = readZipAll(FIX);
    const media = [...files.keys()].filter((n) => /^ppt\/media\/.+\.png$/.test(n));
    assert.ok(media.length >= 2);
    const opaque = await make(false); const clear = await make(true);
    files.set(media[0], opaque); files.set(media[1], clear);
    const out = await require('../products/presentation/library/photos').shrinkImages(require('../products/presentation/templateFill').writeZipAll(files), page);
    const f2 = readZipAll(out);
    const j = media[0].replace(/\.png$/, '_s.jpeg');
    assert.ok(f2.has(j) && !f2.has(media[0]), 'мөлдір емес PNG → JPEG');
    assert.ok(f2.get(j).length < opaque.length);
    assert.ok([...f2].some(([n, d]) => n.endsWith('.rels') && String(d).includes(j.split('/').pop())), 'сілтеме жаңарды');
    assert.ok(!([...f2].some(([n, d]) => n.endsWith('.rels') && new RegExp(`/${media[0].split('/').pop()}"`).test(String(d)))), 'ескі атқа сілтеме қалмады');
    assert.match(String(f2.get('[Content_Types].xml')), /Extension="jpeg"/);
    assert.ok(f2.has(media[1]) && f2.get(media[1]).readUInt32BE(0) === 0x89504e47, 'мөлдір PNG — PNG күйінде');
  } finally { await browser.close(); }
});

test('photos: small round stranger avatars are found for removal (scaled groups measured at real size); square timeline photos are not', () => {
  const P = require('../products/presentation/library/photos');
  const circ = '<a:custGeom><a:pathLst><a:path w="100" h="100"><a:moveTo><a:pt x="50" y="0"/></a:moveTo><a:cubicBezTo><a:pt x="0" y="0"/><a:pt x="0" y="0"/><a:pt x="0" y="50"/></a:cubicBezTo><a:cubicBezTo><a:pt x="0" y="0"/><a:pt x="0" y="0"/><a:pt x="50" y="100"/></a:cubicBezTo><a:cubicBezTo><a:pt x="0" y="0"/><a:pt x="0" y="0"/><a:pt x="100" y="50"/></a:cubicBezTo><a:cubicBezTo><a:pt x="0" y="0"/><a:pt x="0" y="0"/><a:pt x="50" y="0"/></a:cubicBezTo><a:close/></a:path></a:pathLst></a:custGeom>';
  const pic = (geom, rid) => `<p:sp><p:nvSpPr><p:cNvPr id="5" name="a"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4000000" cy="4000000"/></a:xfrm>${geom}<a:blipFill><a:blip r:embed="${rid}"/><a:stretch/></a:blipFill></p:spPr></p:sp>`;
  // топ 5 есе кішірейтеді: ішіндегі 4 000 000 EMU сурет слайдта 800 000 EMU (≈0,8%)
  const grp = (body) => `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="9" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="1600000" cy="1600000"/><a:chOff x="0" y="0"/><a:chExt cx="8000000" cy="8000000"/></a:xfrm></p:grpSpPr>${body}</p:grpSp>`;
  const files = readZipAll(FIX);
  const media = [...files.keys()].filter((n) => /^ppt\/media\/.+\.png$/.test(n));
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20000, 7)]);
  files.set(media[0].replace(/\.png$/, '.jpg'), jpg);
  const rels = files.get('ppt/slides/_rels/slide1.xml.rels');
  files.set('ppt/slides/_rels/slide1.xml.rels', rels.replace('</Relationships>', `<Relationship Id="rIdAv" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media[0].split('/').pop().replace(/\.png$/, '.jpg')}"/></Relationships>`));
  const xml = String(files.get('ppt/slides/slide1.xml'));
  files.set('ppt/slides/slide1.xml', xml.replace('</p:spTree>', grp(pic(circ, 'rIdAv')) + '</p:spTree>'));
  const buf = require('../products/presentation/templateFill').writeZipAll(files);
  const tiny = P.tinyPortraits(buf);
  assert.ok(tiny.some((s) => s.rid === 'rIdAv' && s.round), 'дөңгелек аватар табылды');
  const out = P.removePictures(buf, tiny.filter((s) => s.rid === 'rIdAv'));
  assert.ok(!String(readZipAll(out).get('ppt/slides/slide1.xml')).includes('rIdAv"/>'), 'аватар алынды');
  const square = String(files.get('ppt/slides/slide1.xml')).replace(circ, '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>');
  files.set('ppt/slides/slide1.xml', square);
  assert.ok(!P.tinyPortraits(require('../products/presentation/templateFill').writeZipAll(files)).some((s) => s.rid === 'rIdAv'), 'шаршы фото — мазмұн, алынбайды');
});

test('canva credits: the pill that held removed text and the arrow inside it are removed too', () => {
  const pill = '<p:sp><p:nvSpPr><p:cNvPr id="70" name="pill"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1000000" y="4000000"/><a:ext cx="3000000" cy="800000"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="333366"/></a:solidFill></p:spPr></p:sp>'
    + '<p:sp><p:nvSpPr><p:cNvPr id="71" name="arrow"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1100000" y="4200000"/><a:ext cx="300000" cy="300000"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></p:spPr></p:sp>'
    + '<p:sp><p:nvSpPr><p:cNvPr id="72" name="pilltext"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1500000" y="4100000"/><a:ext cx="2300000" cy="600000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1200"/><a:t>small note</a:t></a:r></a:p></p:txBody></p:sp>';
  const files = readZipAll(carveDeck(FIX, [0]));
  const sp = orderedSlides(files)[0];
  files.set(sp, String(files.get(sp)).replace('</p:spTree>', pill + '</p:spTree>'));
  const out = L.canvaCredits(require('../products/presentation/templateFill').writeZipAll(files), -1);
  const xml = String(readZipAll(out).get(orderedSlides(readZipAll(out))[0]));
  assert.ok(xml.includes('Designed with Canva'));
  assert.ok(!xml.includes('name="pill"') && !xml.includes('name="arrow"'), 'бос таблетка мен белгіше алынды');
});
