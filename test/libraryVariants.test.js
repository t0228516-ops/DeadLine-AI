'use strict';
// Шаблон нұсқалары: айна (элементтер оң↔сол, фон суретінің пикселдері, сөз реті сақталады), түс палитрасы, нұсқа таңдау (желісіз).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { readZipAll, writeZipAll } = require('../products/presentation/templateFill');
const V = require('../products/presentation/library/variants');

const FIX = fs.readFileSync(path.join(__dirname, 'fixture-canva.pptx'));
const W = 12192000;

const sp = (id, x, w, text, extra = '') => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm flipH="false" rot="0"><a:off x="${x}" y="1000000"/><a:ext cx="${w}" cy="800000"/></a:xfrm>${extra || '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'}</p:spPr>`
  + (text ? `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r></a:p></p:txBody>` : '') + '</p:sp>';
const bgPic = '<p:sp><p:nvSpPr><p:cNvPr id="9" name="bg"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm flipH="false"><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:blipFill><a:blip r:embed="rId2"/><a:srcRect l="1000" r="5000"/><a:stretch/></a:blipFill></p:spPr></p:sp>';

function deckWith(body) {
  const files = readZipAll(FIX);
  const xml = String(files.get('ppt/slides/slide1.xml')).replace(/<p:bg>[\s\S]*?<\/p:bg>/, '');
  const out = xml.replace(/(<p:spTree>[\s\S]*?(?:<\/p:grpSpPr>|<p:grpSpPr\/>))[\s\S]*(<\/p:spTree>)/, `$1${body}$2`);
  assert.notStrictEqual(out, xml);
  files.set('ppt/slides/slide1.xml', out);
  return writeZipAll(files);
}
const slide1 = (buf) => String(readZipAll(buf).get('ppt/slides/slide1.xml'));
const offs = (xml) => Object.fromEntries([...xml.matchAll(/name="(s\d+)"[\s\S]*?<a:off x="(-?\d+)"/g)].map((m) => [m[1], +m[2]]));

test('mirror: every element moves to the other side (x → W − x − w); applying twice gives the original', () => {
  const buf = deckWith(sp(2, 1000000, 3000000, 'Title') + sp(3, 8000000, 2000000, '', '<a:prstGeom prst="rtTriangle"><a:avLst/></a:prstGeom>'));
  const m = V.mirrorDeck(buf);
  const o = offs(slide1(m.buf));
  assert.strictEqual(o.s2, W - 1000000 - 3000000);
  assert.strictEqual(o.s3, W - 8000000 - 2000000);
  assert.match(slide1(m.buf), /name="s3"[\s\S]*?flipH="1"/, 'асимметриялы пішін айналады');
  assert.doesNotMatch(slide1(m.buf), /name="s2"[\s\S]*?flipH="1"[\s\S]*?name="s3"/, 'мәтін қорабы айналмайды (тек орны)');
  assert.deepStrictEqual(offs(slide1(V.mirrorDeck(m.buf).buf)), offs(slide1(buf)));
});

test('mirror: the XML stays valid — an existing flipH="false" is switched, never duplicated', () => {
  const buf = deckWith(sp(3, 8000000, 2000000, '', '<a:prstGeom prst="rtTriangle"><a:avLst/></a:prstGeom>'));
  const xml = slide1(V.mirrorDeck(buf).buf);
  for (const tag of xml.match(/<a:xfrm\b[^>]*>/g)) assert.ok((tag.match(/flipH=/g) || []).length <= 1, tag);
});

test('mirror: a short label is right-aligned so it keeps hugging the outer edge; a paragraph stays left-aligned', () => {
  const long = 'This is a long paragraph of body text that the student will read aloud to the class';
  const xml = slide1(V.mirrorDeck(deckWith(sp(2, 1000000, 3000000, 'Short title') + sp(4, 1000000, 3000000, long))).buf);
  assert.match(xml, /name="s2"[\s\S]*?algn="r"[\s\S]*?Short title/);
  assert.match(xml, /name="s4"[\s\S]*?algn="l"[\s\S]*?long paragraph/);
});

test('mirror: words in separate boxes on one line keep their order ("Fiscal Policy" never becomes "Policy Fiscal")', () => {
  const buf = deckWith(sp(5, 1000000, 2000000, 'Fiscal') + sp(6, 2900000, 2000000, 'Policy'));
  const o = offs(slide1(V.mirrorDeck(buf).buf));
  assert.ok(o.s5 < o.s6, 'бірінші сөз сол жақта қалады');
  assert.strictEqual(o.s5, W - 1000000 - 3900000, 'жол бір бүтін болып айналады');
});

test('mirror: a full-bleed background picture is flipped by its pixels (a copy), the crop is mirrored, the unused original is dropped', () => {
  const m = V.mirrorDeck(deckWith(bgPic + sp(2, 1000000, 3000000, 'Title')));
  const files = readZipAll(m.buf);
  assert.ok(m.flip.includes('ppt/media/image1_m.png'));
  assert.ok(files.has('ppt/media/image1_m.png'));
  for (const f of m.flip) {
    const src = f.replace('_m.', '.');
    const used = [...files].some(([n, d]) => n.endsWith('.rels') && String(d).includes(src.split('/').pop()));
    assert.strictEqual(files.has(src), used, `${src}: тек әлі қолданылса қалады`);
  }
  assert.match(String(files.get('ppt/slides/_rels/slide1.xml.rels')), /Id="rId2"[^>]*Target="\.\.\/media\/image1_m\.png"/);
  const xml = slide1(m.buf);
  assert.match(xml, /<a:srcRect l="5000" r="1000"\/>/, 'кесу шегі айнадай');
  assert.doesNotMatch(xml, /name="bg"[\s\S]*?flipH="1"/, 'flipH емес — пикселдер айналады');
});

test('mirror: custom geometry paths and arcs are mirrored inside their own box', () => {
  const g = '<a:custGeom><a:pathLst><a:path w="100" h="50"><a:moveTo><a:pt x="10" y="0"/></a:moveTo><a:arcTo wR="5" hR="5" stAng="0" swAng="5400000"/><a:lnTo><a:pt x="100" y="50"/></a:lnTo></a:path></a:pathLst></a:custGeom>';
  const out = V.mirrorPaths(g);
  assert.match(out, /<a:pt x="90" y="0"\/>/);
  assert.match(out, /<a:pt x="0" y="50"\/>/);
  assert.match(out, /stAng="10800000" swAng="-5400000"/);
});

test('recolor: saturated colours turn, greys, black, white and pale backgrounds stay', () => {
  assert.notStrictEqual(V.shiftHex('C8102E', 140), 'C8102E');
  for (const c of ['FFFFFF', '000000', '7F7F7F', 'F7F4EE']) assert.strictEqual(V.shiftHex(c, 140), c, c);
  const out = V.recolorDeck(deckWith(sp(2, 0, 100, 'x', '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="C8102E"/></a:solidFill>')), 120);
  assert.doesNotMatch(slide1(out), /C8102E/);
});

test('variant choice: only Canva templates mirror, mirror:false is respected, colours change only where reviewed', () => {
  const one = () => 0.1;
  assert.deepStrictEqual(V.pickVariant({ source: 'slidescarnival' }, one), { mirror: false, hue: 0 });
  assert.deepStrictEqual(V.pickVariant({ source: 'canva', mirror: false }, one), { mirror: false, hue: 0 });
  assert.deepStrictEqual(V.pickVariant({ source: 'canva' }, one), { mirror: true, hue: 0 }, 'тексерілмеген түс өзгермейді');
  assert.deepStrictEqual(V.pickVariant({ source: 'canva', recolor: { from: 210, to: [355] } }, one), { mirror: true, hue: 145 });
  const seen = new Set();
  let r = 0; const rng = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 200; i++) seen.add(JSON.stringify(V.pickVariant({ source: 'canva', recolor: { from: 210, to: [355] } }, rng)));
  assert.strictEqual(seen.size, 4, 'бір шаблонның 4 түрлі көрінісі');
});

test('applyVariant: without a browser a mirror that needs flipped pictures is skipped, never half-done', async () => {
  const buf = deckWith(bgPic);
  const v = { mirror: true, hue: 0 };
  const out = await V.applyVariant(buf, v, {});
  assert.strictEqual(v.mirror, false);
  assert.ok(out.equals(buf));
});

test('titles: a title split into one-line boxes («HUMAN» / «CELL &» / «GENETICS») becomes one box with the same line pitch', () => {
  const { mergeSlide } = require('../products/presentation/library/titles');
  const line = (id, y, text, color) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="t${id}"/><p:cNvSpPr txBox="true"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm rot="0"><a:off x="660000" y="${y}"/><a:ext cx="6000000" cy="1600000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>`
    + `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="l"><a:lnSpc><a:spcPts val="12021"/></a:lnSpc></a:pPr><a:r><a:rPr lang="en-US" sz="12021"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const sub = '<p:sp><p:nvSpPr><p:cNvPr id="9" name="sub"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="660000" y="7400000"/><a:ext cx="6000000" cy="440000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="3304"/><a:t>University Biology Presentation</a:t></a:r></a:p></p:txBody></p:sp>';
  const stat = (id, y) => line(id, y, '80%', '111111');
  const xml = `<p:spTree>${line(12, 2190000, 'HUMAN', '064649')}${line(13, 3705000, 'CELL &amp;', '469259')}${line(14, 5150000, 'GENETICS', '064D50')}${sub}</p:spTree>`;
  const out = mergeSlide(xml, 18288000);
  assert.strictEqual((out.match(/<p:sp>/g) || []).length, 2, 'үш жол — бір қорап, астындағы жазу бөлек');
  assert.match(out, /HUMAN[\s\S]*CELL &amp;[\s\S]*GENETICS/);
  assert.match(out, /<a:off x="660000" y="2190000"\/><a:ext cx="6000000" cy="4560000"\/>/);
  assert.match(out, /<a:lnSpc><a:spcPts val="11929"\/><\/a:lnSpc>[\s\S]*?HUMAN/, 'жол биіктігі = келесі жолға дейінгі қашықтық');
  assert.match(out, /064649[\s\S]*469259/, 'әр жолдың түсі сақталады');
  const nums = `<p:spTree>${stat(1, 1000000)}${stat(2, 2700000)}</p:spTree>`;
  assert.strictEqual(mergeSlide(nums, 18288000), nums, 'бағандағы сандар біріктірілмейді');
});

test('mirror: a big title is right-aligned even when long, so its letters do not run under mirrored decor', () => {
  const big = (id, x, text) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="1000000"/><a:ext cx="8000000" cy="3000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>`
    + `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="5400"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const xml = slide1(V.mirrorDeck(deckWith(big(2, 1000000, 'EMPOWERING BUSINESSES IN A GLOBALIZED ECONOMY'))).buf);
  assert.match(xml, /name="s2"[\s\S]*?algn="r"/);
});

test('mirror: a transparent PNG (shape cut into its pixels) is flipped too, softly (a photo is kept); an opaque picture only moves', () => {
  const pic = '<p:sp><p:nvSpPr><p:cNvPr id="9" name="bar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm flipH="false"><a:off x="1000000" y="0"/><a:ext cx="6000000" cy="900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect l="-2000" r="-1000"/></a:stretch></a:blipFill></p:spPr></p:sp>';
  const withPng = (colorType) => {
    const files = readZipAll(deckWith(pic));
    const rp = 'ppt/slides/_rels/slide1.xml.rels';
    files.set(rp, String(files.get(rp)).replace('</Relationships>', '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/bar.png"/></Relationships>'));
    files.set('ppt/slides/slide1.xml', slide1(writeZipAll(files)).replace('r:embed="rId2"/><a:stretch><a:fillRect l="-2000"', 'r:embed="rId9"/><a:stretch><a:fillRect l="-2000"'));
    const png = Buffer.alloc(64); png.writeUInt32BE(0x89504e47, 0); png[25] = colorType;
    files.set('ppt/media/bar.png', png);
    return writeZipAll(files);
  };
  const cut = V.mirrorDeck(withPng(6));
  assert.ok(cut.flip.includes('ppt/media/bar_m.png'));
  assert.ok(cut.soft.includes('ppt/media/bar_m.png'), 'фото болса flipImages айналдырмайды');
  assert.match(slide1(cut.buf), /<a:fillRect l="-1000" r="-2000"\/>/, 'кесінді l↔r ауысады');
  const opaque = V.mirrorDeck(withPng(2));
  assert.ok(!opaque.flip.includes('ppt/media/bar_m.png'));
});

test('mirrorSlides: only the listed slide is mirrored, the others stay as they were', () => {
  const files = readZipAll(deckWith(sp(2, 1000000, 3000000, 'Title')));
  const m = V.mirrorDeck(writeZipAll(files), { only: new Set(['ppt/slides/slide999.xml']) });
  assert.strictEqual(offs(slide1(m.buf)).s2, 1000000, 'тізімде жоқ слайд өзгермейді');
  const m2 = V.mirrorDeck(writeZipAll(files), { only: new Set(['ppt/slides/slide1.xml']) });
  assert.strictEqual(offs(slide1(m2.buf)).s2, W - 1000000 - 3000000);
});
