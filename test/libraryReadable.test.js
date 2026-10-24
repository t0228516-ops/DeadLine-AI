'use strict';
// Кітапхана шаблонының оқылуы: кегль, контраст, әшекейден арақашықтық, бөлім нөмірі (желісіз).
const test = require('node:test');
const assert = require('node:assert');
const R = require('../products/presentation/library/readable');

const W = 9144000;
const sp = (x, y, w, h, inner, extra = '') => `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>${extra}</p:spPr>${inner}</p:sp>`;
const txt = (t, sz, color, algn = 'ctr') => `<p:txBody><a:bodyPr/><a:p><a:pPr algn="${algn}"/><a:r><a:rPr lang="kk-KZ" sz="${sz}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${t}</a:t></a:r></a:p></p:txBody>`;
const slide = (body) => `<p:sld><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;
const long = 'Хандық құрылуының себептері мен барысы туралы ұзын дене мәтіні';

test('contrast: WCAG ratio and the readable colour keeps the direction when it can', () => {
  assert.ok(Math.abs(R.contrast('000000', 'FFFFFF') - 21) < 0.01);
  assert.ok(R.contrast('EAEAE5', 'AF8962') < 4.5, 'шаблондағы ақшыл мәтін — нашар');
  const fixed = R.readableColor('EAEAE5', 'AF8962', 4.5);
  assert.ok(R.contrast(fixed, 'AF8962') >= 4.5, fixed);
  const kept = R.readableColor('FFFFFF', '1A1A1A', 4.5);
  assert.strictEqual(kept, 'FFFFFF', 'жеткілікті болса — өзгермейді');
});

test('fixSlide: small body text grows to the minimum, low contrast is fixed on the panel under it', () => {
  const panel = sp(0, 0, W, 5143500, '', '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="AF8962"/></a:solidFill>');
  const body = sp(2000000, 2000000, 4000000, 900000, txt(long, 1000, 'EAEAE5'));
  const r = R.fixSlide(slide(panel + body), { W, theme: {}, bg: 'CBA37B' });
  assert.strictEqual(r.changes.font, 1);
  assert.match(r.xml, /sz="1200"/);
  const c = r.xml.match(/<a:t>Хандық[\s\S]*?$/) && [...r.xml.matchAll(/srgbClr val="(\w{6})"/g)].map((m) => m[1]);
  assert.ok(R.contrast(c[c.length - 1], 'AF8962') >= 4.5);
});

test('fixSlide: a decoration poking in from the side narrows body text; titles and backdrops are left alone', () => {
  const body = sp(2000000, 2000000, 4000000, 900000, txt(long, 1200, '000000', 'l'));
  const decor = `<p:pic><p:nvPicPr><p:cNvPr id="5" name="p"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId9"/></p:blipFill><p:spPr><a:xfrm><a:off x="5400000" y="1800000"/><a:ext cx="1600000" cy="1600000"/></a:xfrm></p:spPr></p:pic>`;
  const r = R.fixSlide(slide(body + decor), { W, theme: {}, bg: 'FFFFFF' });
  assert.strictEqual(r.changes.inset, 1);
  const off = r.xml.match(/<a:off x="2000000" y="2000000"\/><a:ext cx="(\d+)"/);
  assert.ok(off && +off[1] < 3400000 && +off[1] >= 2000000, off && off[1]);
  const title = sp(2000000, 500000, 4000000, 900000, txt('Құрылуының үш себебі', 4400, '000000'));
  const r2 = R.fixSlide(slide(title + decor.replace('1800000', '300000')), { W, theme: {}, bg: 'FFFFFF' });
  assert.strictEqual(r2.changes.inset, 0, 'тақырып тарылмайды');
});

test('numberSections: a divider after content slides becomes part 2', () => {
  const { carveDeck } = require('../products/presentation/library/carve');
  const { readZipAll, writeZipAll } = require('../products/presentation/templateFill');
  const { orderedSlides } = require('../design-dna/structure');
  const fs = require('fs'); const path = require('path');
  const deck = carveDeck(fs.readFileSync(path.join(__dirname, 'fixture-rich.pptx')), [0, 1, 2]);
  const files = readZipAll(deck);
  const sl = orderedSlides(files);
  const num = sp(100, 100, 500000, 500000, '<p:txBody><a:bodyPr/><a:p><a:r><a:rPr lang="en-US"/><a:t>01</a:t></a:r></a:p></p:txBody>');
  files.set(sl[2], files.get(sl[2]).replace(/<p:spTree>[\s\S]*<\/p:spTree>/, `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${num}${sp(0, 900000, 4000000, 600000, txt('Хандықтың нығаюы', 3600, '000000'))}</p:spTree>`));
  const out = readZipAll(R.numberSections(writeZipAll(files), ['cover', 'text', 'section']));
  assert.match(out.get(orderedSlides(out)[2]), /<a:t>02<\/a:t>/);
});

test('small text over a photo gets a translucent backing; titles and text on solid panels do not', () => {
  const { fixSlide } = require('../products/presentation/library/readable');
  const E = 12700;
  const pic = `<p:pic><p:nvPicPr><p:cNvPr id="2" name="p"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${720 * E}" cy="${405 * E}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  const tb = (id, sz, t) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="t${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${200 * E}" y="${(id * 60) * E}"/><a:ext cx="${300 * E}" cy="${40 * E}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr lIns="0" rIns="0"/><a:p><a:r><a:rPr sz="${sz}"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const xml = `<p:sld><p:cSld><p:spTree>${pic}${tb(3, 1200, 'Сұрақтарыңызды қоя аласыздар')}${tb(4, 4400, 'Назарларыңызға рақмет!')}</p:spTree></p:cSld></p:sld>`;
  const r = fixSlide(xml, { W: 720 * E, theme: {}, bg: null, inherited: [] });
  const small = r.xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*Сұрақтарыңызды[\s\S]*?<\/p:sp>/)[0];
  const big = r.xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*Назарларыңызға[\s\S]*?<\/p:sp>/)[0];
  assert.match(small, /<p:spPr>[\s\S]*<a:srgbClr val="000000"><a:alpha val="55000"\/>/, 'white small text → dark translucent backing');
  assert.match(small, /lIns="73152"/);
  assert.doesNotMatch(big, /<a:alpha/, 'titles stay as designed');
});
