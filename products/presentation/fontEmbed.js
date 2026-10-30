'use strict';
/**
 * ДИЗАЙНЕР ҚАРІПТЕРІН PPTX-КЕ ЕНДІРУ (SIL OFL қаріптері, assets/brand-fonts).
 *
 * PowerPoint ендірілген қаріпті «fntdata» бөлігінен оқиды: бұл — EOT (Embedded OpenType) 2.1 тақырыбы + TTF.
 * Canva экспорттары дәл осылай ендіреді (сығылмаған EOT, тақырып нұсқасы 0x00020001) — біз де сол пішінді жасаймын.
 * Әр салмақ — жеке отбасы атауымен (мыс. «Montserrat Bold», Regular слоты), Inter/Open Sans — regular + bold слоты.
 *
 *   await embedFonts(pptxPath, ['Inter', 'Playfair Bold'])   // колодада қолданылған отбасылар
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'assets', 'brand-fonts');
// PowerPoint-тегі отбасы → { regular, bold } файлдары
const BRAND = {
  'Playfair Bold': { regular: 'Playfair-Bold.ttf' },
  'Montserrat Bold': { regular: 'Montserrat-Bold.ttf' },
  Inter: { regular: 'Inter-Regular.ttf', bold: 'Inter-Bold.ttf' },
  'Open Sans': { regular: 'OpenSans-Regular.ttf', bold: 'OpenSans-Bold.ttf' },
};

function tableOffsets(ttf) {
  const n = ttf.readUInt16BE(4); const t = {};
  for (let i = 0; i < n; i++) t[ttf.toString('latin1', 12 + i * 16, 16 + i * 16)] = ttf.readUInt32BE(20 + i * 16);
  return t;
}
/** UTF-16LE жол: [padding u16][size u16][bytes] */
function eotString(s) {
  const b = Buffer.from(String(s), 'utf16le');
  const h = Buffer.alloc(4); h.writeUInt16LE(0, 0); h.writeUInt16LE(b.length, 2);
  return Buffer.concat([h, b]);
}

/** TTF → EOT 2.1 (сығылмаған, XOR жоқ) — Canva fntdata-сымен бірдей пішін */
function makeEot(ttf, family, style) {
  const t = tableOffsets(ttf);
  const os2 = t['OS/2']; const head = t.head;
  const fixed = Buffer.alloc(82);
  ttf.copy(fixed, 16, os2 + 32, os2 + 42);                     // PANOSE[10]
  fixed.writeUInt8(1, 26);                                      // DEFAULT_CHARSET
  fixed.writeUInt8(ttf.readUInt16BE(os2 + 62) & 1 ? 1 : 0, 27); // Italic (fsSelection bit 0)
  fixed.writeUInt32LE(ttf.readUInt16BE(os2 + 4), 28);           // usWeightClass
  fixed.writeUInt16LE(ttf.readUInt16BE(os2 + 8), 32);           // fsType
  fixed.writeUInt16LE(0x504C, 34);                              // MagicNumber
  for (let i = 0; i < 4; i++) fixed.writeUInt32LE(ttf.readUInt32BE(os2 + 42 + i * 4), 36 + i * 4); // ulUnicodeRange1-4
  for (let i = 0; i < 2; i++) fixed.writeUInt32LE(ttf.readUInt32BE(os2 + 78 + i * 4), 52 + i * 4); // ulCodePageRange1-2
  fixed.writeUInt32LE(ttf.readUInt32BE(head + 8), 60);          // checkSumAdjustment
  // 64..79 Reserved1-4 = 0; 80..81 Padding1 = 0
  const names = Buffer.concat([eotString(family), eotString(style), eotString('Version 1.0'), eotString(family)]);
  const tail = Buffer.alloc(4);                                  // Padding5 + RootStringSize = 0
  const header = Buffer.concat([fixed, names.subarray(2), tail]); // FamilyName padding = Padding1 (already in fixed)
  const total = header.length + ttf.length;
  header.writeUInt32LE(total, 0);
  header.writeUInt32LE(ttf.length, 4);
  header.writeUInt32LE(0x00020001, 8);
  header.writeUInt32LE(0, 12);                                   // Flags: сығылмаған
  return Buffer.concat([header, ttf]);
}

/** Колодада қолданылған дизайнер қаріптерін PPTX-ке ендіреді. Бұрынғы файл орнында жаңарады. */
async function embedFonts(pptxPath, families) {
  const want = [...new Set(families || [])].filter((f) => BRAND[f]);
  if (!want.length) return 0;
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(pptxPath));
  const relsPath = 'ppt/_rels/presentation.xml.rels';
  let rels = await zip.file(relsPath).async('string');
  let pres = await zip.file('ppt/presentation.xml').async('string');
  let types = await zip.file('[Content_Types].xml').async('string');
  if (/<p:embeddedFontLst>/.test(pres)) return 0;
  let n = 0; const items = [];
  for (const fam of want) {
    const slots = [];
    for (const slot of ['regular', 'bold']) {
      const file = BRAND[fam][slot];
      if (!file) continue;
      const ttf = fs.readFileSync(path.join(DIR, file));
      n += 1;
      const id = 'rIdDlFont' + n;
      zip.file('ppt/fonts/dlfont' + n + '.fntdata', makeEot(ttf, fam, slot === 'bold' ? 'Bold' : 'Regular'));
      rels = rels.replace('</Relationships>', '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/dlfont' + n + '.fntdata"/></Relationships>');
      slots.push('<p:' + slot + ' r:id="' + id + '"/>');
    }
    items.push('<p:embeddedFont><p:font typeface="' + fam + '"/>' + slots.join('') + '</p:embeddedFont>');
  }
  // схема реті: …sldSz, notesSz, [smartTags], embeddedFontLst, …
  const lst = '<p:embeddedFontLst>' + items.join('') + '</p:embeddedFontLst>';
  pres = /<p:notesSz[^>]*\/>/.test(pres) ? pres.replace(/(<p:notesSz[^>]*\/>)/, '$1' + lst) : pres.replace(/(<p:sldSz[^>]*\/>)/, '$1' + lst);
  pres = pres.replace(/<p:presentation\b([^>]*)>/, (m, attrs) => '<p:presentation' + attrs.replace(/\s*embedTrueTypeFonts="[^"]*"/, '') + ' embedTrueTypeFonts="1">');
  if (!/Extension="fntdata"/.test(types)) types = types.replace('<Default Extension="xml"', '<Default Extension="fntdata" ContentType="application/x-fontdata"/><Default Extension="xml"');
  zip.file(relsPath, rels); zip.file('ppt/presentation.xml', pres); zip.file('[Content_Types].xml', types);
  fs.writeFileSync(pptxPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return n;
}

module.exports = { embedFonts, makeEot, BRAND, DIR };
