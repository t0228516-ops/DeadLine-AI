'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const F = require('../products/presentation/fontEmbed');
const { officeFont } = require('../products/presentation/pptxExporter');

test('designer fonts: every file exists, has the Kazakh letters and may be embedded (OFL, fsType 0)', () => {
  const { parseFont } = require('../products/presentation/embeddedMetrics');
  for (const [fam, slots] of Object.entries(F.BRAND)) {
    for (const file of Object.values(slots)) {
      const buf = fs.readFileSync(path.join(F.DIR, file));
      const f = parseFont(buf);
      assert.ok(f, file);
      for (const ch of 'ӘҒҚҢӨҰҮҺІәғқңөұүһі') assert.ok(f.adv(ch.codePointAt(0)) > 0, fam + ' ' + ch);
    }
  }
  assert.ok(fs.existsSync(path.join(F.DIR, 'OFL.txt')));
});

test('EOT wrapper has the same layout as a Canva export (uncompressed EOT 2.1, family name inside)', () => {
  const ttf = fs.readFileSync(path.join(F.DIR, 'Inter-Regular.ttf'));
  const e = F.makeEot(ttf, 'Inter', 'Regular');
  assert.strictEqual(e.readUInt32LE(0), e.length);
  assert.strictEqual(e.readUInt32LE(4), ttf.length);
  assert.strictEqual(e.readUInt32LE(8), 0x00020001);
  assert.strictEqual(e.readUInt32LE(12), 0);
  assert.strictEqual(e.readUInt16LE(34), 0x504C);
  assert.strictEqual(e.length - ttf.length, 156); // Canva-ның Inter fntdata тақырыбы да 156 байт
  assert.ok(e.subarray(e.length - ttf.length).equals(ttf));
  assert.strictEqual(e.subarray(84, 94).toString('utf16le'), 'Inter');
});

test('CSS font stacks map to the embedded PowerPoint family names; Office fonts stay as before', () => {
  assert.strictEqual(officeFont('"Playfair Bold","Times New Roman",serif'), 'Playfair Bold');
  assert.strictEqual(officeFont('"Montserrat Bold",Arial,sans-serif'), 'Montserrat Bold');
  assert.strictEqual(officeFont('Inter,Calibri,sans-serif'), 'Inter');
  assert.strictEqual(officeFont('"Open Sans",Calibri,sans-serif'), 'Open Sans');
  assert.strictEqual(officeFont('Calibri,Carlito,sans-serif'), 'Calibri');
  assert.strictEqual(officeFont('"Times New Roman","Liberation Serif",serif'), 'Times New Roman');
});

test('embedFonts adds fntdata parts, relationships, content type and embeddedFontLst in schema order', async () => {
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.addSlide().addText('Сәлем', { x: 1, y: 1, w: 3, h: 1, fontFace: 'Inter' });
  const file = path.join(os.tmpdir(), 'embed-test-' + process.pid + '.pptx');
  await pptx.writeFile({ fileName: file });
  const n = await F.embedFonts(file, ['Inter', 'Montserrat Bold', 'Calibri']);
  assert.strictEqual(n, 3); // Inter regular+bold, Montserrat Bold; Calibri — Office қаріпі, ендірілмейді
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const pres = await zip.file('ppt/presentation.xml').async('string');
  assert.match(pres, /<p:notesSz[^>]*\/><p:embeddedFontLst><p:embeddedFont><p:font typeface="Inter"\/><p:regular r:id="rIdDlFont1"\/><p:bold r:id="rIdDlFont2"\/>/);
  assert.match(pres, /embedTrueTypeFonts="1"/);
  assert.match(await zip.file('[Content_Types].xml').async('string'), /Extension="fntdata"/);
  assert.match(await zip.file('ppt/_rels/presentation.xml.rels').async('string'), /Target="fonts\/dlfont3.fntdata"/);
  assert.strictEqual(await F.embedFonts(file, ['Inter']), 0, 'екінші рет ендірілмейді');
  fs.unlinkSync(file);
});
