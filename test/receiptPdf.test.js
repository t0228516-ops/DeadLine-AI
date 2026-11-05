'use strict';
// Kaspi PDF чегінің құрылымы (Android Skia: 1 бет A4, бір сурет 1080 px + маска, мәтін/қаріп/күн жоқ).
// Нағыз чек жеке деректерімен репоға салынбайды — оның құрылымын қайталайтын синтетикалық PDF.
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');
const { kaspiPdfProfile, createdOk } = require('../core/receiptPdf');

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
  assert.deepStrictEqual(r, { ok: true, profile: 'android-skia', created: null, reasons: [] });
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

// iPhone: Quartz PDFContext, Author «Kaspi.kz», әр жол бөлек сурет, CreationDate = бөліскен сәт
function kaspiIos(o = {}) {
  const content = Buffer.from(o.content || 'q Q q 0 100 392 599.6667 re W n /Perceptual ri q 392 0 0 599.6667 0 100 cm\n/Im1 Do Q Q q 24 659.6667 344 16 re W n /Perceptual ri q 344 0 0 16 24 659.6667\ncm /Im2 Do Q Q\n');
  const img = (n) => `${n} 0 obj\n<< /Type /XObject /Subtype /Image /Width 450 /Height 50 /ColorSpace 45 0 R /SMask ${n + 20} 0 R /BitsPerComponent 8 /Length 3 >>\nstream\nabc\nendstream\nendobj\n`;
  const imgs = Array.from({ length: o.images == null ? 12 : o.images }, (_, i) => img(5 + i)).join('');
  const info = `<< /ModDate (${o.mod || "D:20261022104225Z00'00'"}) /Producer (${o.producer || 'iOS Version 26.5 \\(Build 23F77\\) Quartz PDFContext'})\n${o.author === null ? '' : `/Author (${o.author || 'Kaspi.kz'})`} /CreationDate (D:20261022104225Z00'00') >>`;
  const body = `%PDF-1.3\n3 0 obj\n<< /Length ${content.length} >>\nstream\n${content.toString('latin1')}\nendstream\nendobj\n${imgs}`
    + `1 0 obj\n<< /Type /Page /Parent 2 0 R /Resources 4 0 R /Contents 3 0 R /MediaBox [-50 50 439.7667 749.6667] >>\nendobj\n`
    + `2 0 obj\n<< /Type /Pages /Kids [ 1 0 R ] /Count 1 >>\nendobj\n48 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n49 0 obj\n${info}\nendobj\n`
    + 'xref\n0 50\ntrailer\n<< /Size 50 /Root 48 0 R /Info 49 0 R >>\nstartxref\n134292\n%%EOF\n';
  return Buffer.from(body, 'latin1');
}

test('iPhone Kaspi PDF passes; its creation time must not be before the payment', () => {
  const r = kaspiPdfProfile(kaspiIos());
  assert.strictEqual(r.ok, true, r.reasons.join('; '));
  assert.strictEqual(r.profile, 'ios-quartz');
  assert.strictEqual(r.created.toISOString(), '2026-10-22T10:42:25.000Z');
  const paid = new Date('2026-10-22T10:42:00Z');                  // чекте: 22.10.2026 15:42 (Астана)
  assert.strictEqual(createdOk(r, paid, new Date('2026-10-22T11:00:00Z')), true);
  assert.strictEqual(createdOk(r, new Date('2026-10-22T11:30:00Z'), new Date('2026-10-22T11:40:00Z')), false, 'file made before the payment shown on it');
  assert.strictEqual(createdOk({ created: null }, paid), null, 'Android PDFs carry no date');
});

test('iPhone: Quartz may break lines anywhere («Do Q\\nQ», real 11-05 receipt) — still a Kaspi receipt', () => {
  const content = 'q Q q 0 100 366 599 re W n /Perceptual ri q 366 0 0 599 0 100 cm /Im1 Do Q\nQ q 24 659 318 16 re W n /Perceptual ri q 318 0 0 16 24 659 cm /Im2 Do Q Q\n';
  const r = kaspiPdfProfile(kaspiIos({ content }));
  assert.strictEqual(r.ok, true, r.reasons.join('; '));
});

test('iPhone: printed image, edited in Preview, or without Kaspi author is caught', () => {
  for (const [name, o] of Object.entries({
    'iPhone "print" of a single image': { images: 1, author: null },
    'saved again later (ModDate differs)': { mod: "D:20261023090000Z00'00'" },
    'macOS Preview': { producer: 'macOS Version 15.1 \\(Build 24B83\\) Quartz PDFContext' },
    'no Kaspi author': { author: 'Me' },
    'text drawn on page': { content: 'q Q q 0 100 392 599.6667 re W n /Perceptual ri q 392 0 0 599.6667 0 100 cm\n/Im1 Do Q Q BT /F1 12 Tf (100) Tj ET\n' },
  })) assert.strictEqual(kaspiPdfProfile(kaspiIos(o)).ok, false, name);
});
