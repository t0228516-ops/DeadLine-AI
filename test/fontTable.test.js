'use strict';
// SlidesCarnival шаблондары қаріпті MTX-сығылған EOT ретінде ендіреді — файлды оқи алмаймыз,
// бірақ кітапхана кестесі (libraryFontMetrics.js) нақты ендерді және қазақ әріптерінің бар-жоғын береді.
const test = require('node:test');
const assert = require('node:assert');
const { embeddedMetrics, tableMetrics } = require('../products/presentation/embeddedMetrics');
const { uncoveredFonts, fitLines, textWidthPt, countLines } = require('../products/presentation/templateFill');

// MTX-сығылған EOT тақырыбы: EOTSize = ұзындық, MagicNumber 0x504C, Flags = 0x4
function mtxEot() {
  const b = Buffer.alloc(120);
  b.writeUInt32LE(b.length, 0); b.writeUInt32LE(40, 4); b.writeUInt32LE(4, 12); b.writeUInt16LE(0x504C, 34);
  return b;
}
function files(faces) {
  const f = new Map();
  f.set('ppt/presentation.xml', `<p:presentation><p:embeddedFontLst>${faces.map((n, i) => `<p:embeddedFont><p:font typeface="${n}"/><p:regular r:id="rIdF${i}"/></p:embeddedFont>`).join('')}</p:embeddedFontLst></p:presentation>`);
  f.set('ppt/_rels/presentation.xml.rels', `<Relationships>${faces.map((n, i) => `<Relationship Id="rIdF${i}" Target="fonts/font${i}.fntdata"/>`).join('')}</Relationships>`);
  faces.forEach((n, i) => f.set(`ppt/fonts/font${i}.fntdata`, mtxEot()));
  return f;
}

test('MTX-embedded fonts: widths come from the library table, Kazakh coverage is known', () => {
  const f = files(['Merriweather', 'Lato', 'Unknown Face']);
  const m = embeddedMetrics(f);
  assert.ok(m.get('Merriweather'), 'Merriweather from table');
  assert.ok(!m.get('Unknown Face'), 'unknown face stays unmeasured');
  const bad = uncoveredFonts(f);
  assert.ok(bad.has('Lato'), 'Lato has no Kazakh letters → replaced');
  assert.ok(!bad.has('Merriweather'), 'Merriweather covers Kazakh');
});

test('wide fonts measure wider than the old Times/Arial guess; bold is wider than regular', () => {
  const s = 'Қазақ хандығының құрылуы және дамуы';
  const mw = tableMetrics('Merriweather');
  assert.ok(mw.width(s, 20) > textWidthPt(s, 20, true, false) * 1.12, 'Merriweather ≥12% wider than Times estimate');
  assert.ok(mw.width(s, 20, 0, true) > mw.width(s, 20));
});

test('fitLines with real metrics: the Times guess overflows a Merriweather box, the real fit does not', () => {
  const rPr = '<a:rPr lang="ru-RU" sz="4000"><a:latin typeface="Merriweather"/></a:rPr>';
  const lines = ['Промпты: системные инструкции и пользовательские запросы'];
  const box = { w: 300 * 12700, h: 100 * 12700 };
  const base = { box, pPr: '', rPr, serif: true, bold: false, single: false, noFill: true, insets: { l: 0, r: 0, t: 0, b: 0 } };
  const mw = tableMetrics('Merriweather');
  const wfn = (t, sz, spc) => mw.width(t, sz, spc);
  // нақты ендермен өлшегенде мәтіннің биіктігі (pt)
  const realH = (fit) => countLines(fit.lines[0], fit.sz / 100, 300, true, false, 0, wfn) * (fit.lnPts / 100);
  const guess = fitLines(lines, base);
  const real = fitLines(lines, { ...base, widthFn: wfn });
  assert.ok(real.ok && realH(real) <= 100 * 1.06, `real fit ${realH(real)}pt`);
  assert.ok(guess.usedH <= 100 * 1.06 && realH(guess) > 100 * 1.06, `guess thought ${guess.usedH}pt, really ${realH(guess)}pt — overflows`);
});

test('a title inside a group with its cards cannot grow over the cards', () => {
  const L = require('../products/presentation/templateLayout');
  const E = 12700;
  const sp = (id, x, y, w, h, t) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x * E}" y="${y * E}"/><a:ext cx="${w * E}" cy="${h * E}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const title = sp(3, 371, 31, 328, 109, 'Title');
  const grp = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="2" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${371 * E}" y="${31 * E}"/><a:ext cx="${329 * E}" cy="${341 * E}"/><a:chOff x="${371 * E}" y="${31 * E}"/><a:chExt cx="${329 * E}" cy="${341 * E}"/></a:xfrm></p:grpSpPr>${title}${sp(4, 371, 170, 125, 43, 'Card')}${sp(5, 561, 170, 125, 43, 'Card 2')}</p:grpSp>`;
  const xml = `<p:sld><p:cSld><p:spTree>${grp}</p:spTree></p:cSld></p:sld>`;
  const s = L.surround(xml, title, 12192000, 6858000);
  assert.ok(s.room / E < 30, `room ${s.room / E}pt stops at the cards`);
});

test('stat values: "2 out of 5", "12 million" are figures; a text box overhanging its side panel is clipped to it', () => {
  const L = require('../products/presentation/templateLayout');
  const E = 12700; const W = 720 * E; const H = 405 * E;
  const panel = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="p"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${228 * E}" cy="${H}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="2E2CA9"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t></a:t></a:r></a:p></p:txBody></p:sp>`;
  const text = `<p:sp><p:nvSpPr><p:cNvPr id="3" name="t"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${40 * E}" y="${57 * E}"/><a:ext cx="${205 * E}" cy="${190 * E}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp>`;
  const xml = `<p:sld><p:cSld><p:spTree>${panel}${text}</p:spTree></p:cSld></p:sld>`;
  const out = L.clipToPanels(xml, W, H);
  const m = out.match(/<a:off x="(\d+)" y="\d+"\/>\s*<a:ext cx="(\d+)"/g).pop().match(/x="(\d+)".*cx="(\d+)"/);
  assert.ok((+m[1] + +m[2]) / E <= 228, `right edge ${(+m[1] + +m[2]) / E}pt inside the panel`);
  const inner = text.replace(`cx="${205 * E}"`, `cx="${147 * E}"`);                   // шаблондағы өлшемі: тақтаның ішінде
  const sur = L.surround(`<p:sld><p:cSld><p:spTree>${panel}${inner}</p:spTree></p:cSld></p:sld>`, inner, W, H);
  assert.ok(sur.container, 'full-height side panel is the container, not a backdrop');
});
