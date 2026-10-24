'use strict';
// Kaspi PDF чегінің құрылымы (Android Skia: 1 бет A4, бір сурет 1080 px + маска, мәтін/қаріп/күн жоқ).
// Нағыз чек жеке деректерімен репоға салынбайды — оның құрылымын қайталайтын синтетикалық PDF.
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');
const { kaspiPdfProfile } = require('../core/receiptPdf');

function kaspiLike(o = {}) {
  const content = zlib.deflateSync(Buffer.from(o.content || '1 0 0 -1 0 842 cm\nq\n0 0 595 842 re\nW* n\nq\n340 0 0 -471.00003 20 491.00003 cm\n0 0 0 RG 0 0 0 rg\n/G3 gs\n/X4 Do\nQ\nQ\n'));
  const parts = ['%PDF-1.4\n%\xd3\xeb\xe9\xe1\n'];
  const objs = [
    `1 0 obj\n<</Producer (${o.producer || 'Skia/PDF m112'})${o.info || ''}>>\nendobj\n`,
    `3 0 obj\n<</ca 1 /BM /Normal>>\nendobj\n`,
    `4 0 obj\n<</Type /XObject /Subtype /Image /Width ${o.width || 1080} /Height 1473 /ColorSpace /DeviceRGB /SMask 5 0 R /BitsPerComponent 8 /Filter /FlateDecode /Length 3>>\nstream\nabc\nendstream\nendobj\n`,
    `5 0 obj\n<</Type /XObject /Subtype /Image /Width 1080 /Height 1473 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length 3>>\nstream\nabc\nendstream\nendobj\n`,
  ];
  const head = Buffer.from(parts.join('') + objs.join(''), 'latin1');
  const c6a = Buffer.from(`6 0 obj\n<</Filter /FlateDecode /Length ${content.length}>>\nstream\n`, 'latin1');
  const c6b = Buffer.from('\nendstream\nendobj\n', 'latin1');
  const tail = Buffer.from(`2 0 obj\n<</Type /Page /Resources <</ProcSet [/PDF /Text /ImageB /ImageC /ImageI] /ExtGState <</G3 3 0 R>> /XObject <</X4 4 0 R>>${o.font ? ' /Font <</F1 9 0 R>>' : ''}>> /MediaBox [${o.media || '0 0 595 842'}] /Contents 6 0 R /Parent 7 0 R>>\nendobj\n7 0 obj\n<</Type /Pages /Count 1 /Kids [2 0 R]>>\nendobj\n8 0 obj\n<</Type /Catalog /Pages 7 0 R>>\nendobj\nxref\n0 9\ntrailer\n<</Size 9\n/Root 8 0 R\n/Info 1 0 R>>\nstartxref\n69422\n%%EOF${o.incremental ? '\nxref\n0 1\ntrailer\n<</Prev 69422>>\nstartxref\n70000\n%%EOF' : ''}`, 'latin1');
  return Buffer.concat([head, c6a, content, c6b, tail]);
}

test('a Kaspi-structured PDF passes', () => {
  const r = kaspiPdfProfile(kaspiLike());
  assert.deepStrictEqual(r, { ok: true, profile: 'android-skia', reasons: [] });
});

test('re-saved, edited or hand-made PDFs are caught, each with a reason', () => {
  const cases = {
    'another producer (Word/iLovePDF)': { producer: 'Microsoft® Word for Microsoft 365' },
    'Chrome print-to-PDF adds Creator and dates': { producer: 'Skia/PDF m127', info: ' /Creator (Mozilla/5.0) /CreationDate (D:20261024)' },
    'text with a font': { font: true },
    'edit layer appended': { incremental: true },
    'different image width': { width: 1000 },
    'Letter page': { media: '0 0 612 792' },
    'different page drawing': { content: 'q\n595 0 0 842 0 0 cm\n/X4 Do\nQ\n' },
  };
  for (const [name, o] of Object.entries(cases)) {
    const r = kaspiPdfProfile(kaspiLike(o));
    assert.strictEqual(r.ok, false, name);
    assert.ok(r.reasons.length >= 1, name);
  }
  assert.strictEqual(kaspiPdfProfile(Buffer.from('not a pdf')).ok, false);
});
