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
