'use strict';
/**
 * Kaspi PDF чегінің ТҮПНҰСҚАЛЫҒЫ (файл құрылымы бойынша).
 *
 * Kaspi қосымшасы чекті мәтінсіз PDF етіп береді: Android-тың Skia жасағышы, бір бет A4, ішінде бір сурет
 * (ені 1080 px, мөлдірлік маскасымен), бет үстіне тұрақты орында салынған; қаріп, мәтін, күн, «Creator» жоқ.
 * Word / iLovePDF / Canva / «Print to PDF» / Photoshop арқылы жасалған не қайта сақталған файлда бұл
 * белгілердің бірі міндетті түрде өзгереді (жасағыш атауы, күндер, қаріп, қосымша нысандар, өңдеу қабаты).
 *
 * Бұл — жалғанның ДӨРЕКІ түрін сүзгі. Құрылымды әдейі қайталап жасаған адамды тоқтатпайды; сондықтан
 * автоматты растау тағы да сома, алушы, уақыт (≤60 мин) және чек нөмірінің қайталанбауын тексереді.
 *
 *   kaspiPdfProfile(buffer) → { ok, profile, reasons: [...] }
 */
const zlib = require('zlib');

/** Белгілі Kaspi PDF түрлері (жаңа құрылғы/нұсқа үлгісі келсе — осында қосылады) */
const PROFILES = [
  {
    name: 'android-skia',
    producer: /^Skia\/PDF m\d{2,3}$/,
    mediaBox: [0, 0, 595, 842],
    imageWidth: 1080,
    // бет мазмұны: Skia-ның ағымы — сурет ені 340pt, сол жақтан 20pt
    content: /^1 0 0 -1 0 842 cm\nq\n0 0 595 842 re\nW\* n\nq\n340 0 0 -[\d.]+ 20 [\d.]+ cm\n0 0 0 RG 0 0 0 rg\n\/G\d+ gs\n\/X\d+ Do\nQ\nQ\n$/,
  },
];

const latin = (b) => b.toString('latin1');

function streamOf(src, objNo) {
  const m = new RegExp(`(?:^|\\n)${objNo} 0 obj\\s*<<([\\s\\S]*?)>>\\s*stream\\r?\\n`).exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  const len = +((m[1].match(/\/Length (\d+)/) || [])[1] || -1);
  return { dict: m[1], start, len };
}

/**
 * @param {Buffer} buf
 * @returns {{ok:boolean, profile:string|null, reasons:string[]}}
 */
function kaspiPdfProfile(buf) {
  const reasons = [];
  const s = latin(Buffer.from(buf));
  if (!s.startsWith('%PDF-')) return { ok: false, profile: null, reasons: ['PDF емес'] };

  const eofs = (s.match(/%%EOF/g) || []).length;
  const xrefs = (s.match(/startxref/g) || []).length;
  if (eofs !== 1 || xrefs !== 1) reasons.push('файл өңделген (үстіне жаңа қабат жазылған)');

  const producer = ((s.match(/\/Producer\s*\(([^)]*)\)/) || [])[1] || '').trim();
  const prof = PROFILES.find((p) => p.producer.test(producer));
  if (!prof) reasons.push(producer ? `PDF-ті «${producer.slice(0, 40)}» жасаған (Kaspi емес)` : 'PDF жасағышы көрсетілмеген');

  if (/\/(Creator|CreationDate|ModDate|Author|Title)\s*\(/.test(s)) reasons.push('қосымша мәлімет жазылған (басқа бағдарламада сақталған)');
  if (/\/Font\b|\/FontDescriptor|\/FontFile/.test(s)) reasons.push('ішінде қаріп бар (Kaspi чегінде мәтін жоқ)');
  if (/\/Annots|\/AcroForm|\/JavaScript|\/OpenAction|\/EmbeddedFile/.test(s)) reasons.push('ішінде түсініктеме/форма/скрипт бар');
  if (/\/Metadata\b/.test(s)) reasons.push('XMP метадерегі бар (басқа бағдарламада сақталған)');

  const pages = (s.match(/\/Type\s*\/Page\b/g) || []).length;
  if (pages !== 1) reasons.push(`${pages} бет (Kaspi чегі — 1 бет)`);
  const objs = (s.match(/\n\d+ 0 obj\b/g) || []).length;
  if (objs < 6 || objs > 10) reasons.push(`құрылымы басқа (${objs} нысан)`);

  if (prof) {
    const mb = (s.match(/\/MediaBox\s*\[([^\]]*)\]/) || [])[1];
    if (!mb || mb.trim().split(/\s+/).map(Number).join() !== prof.mediaBox.join()) reasons.push('бет өлшемі басқа');
    const imgs = [...s.matchAll(/\/Subtype\s*\/Image\b([^>]*)/g)].map((m) => m[1]);
    const rgb = imgs.filter((d) => /\/DeviceRGB/.test(d));
    if (rgb.length !== 1) reasons.push(`суреттер саны басқа (${rgb.length})`);
    else {
      const w = +((rgb[0].match(/\/Width (\d+)/) || [])[1] || 0);
      if (w !== prof.imageWidth) reasons.push(`сурет ені ${w}px (Kaspi — ${prof.imageWidth})`);
      if (!/\/SMask/.test(rgb[0])) reasons.push('суреттің мөлдірлік маскасы жоқ');
    }
    // бет мазмұнының ағымы
    const contentsRef = (s.match(/\/Type\s*\/Page\b[^]*?\/Contents (\d+) 0 R/) || [])[1];
    const st = contentsRef && streamOf(s, contentsRef);
    let content = null;
    if (st && st.len > 0) {
      try {
        const raw = Buffer.from(buf).subarray(st.start, st.start + st.len);
        content = /\/FlateDecode/.test(st.dict) ? zlib.inflateSync(raw).toString('latin1') : raw.toString('latin1');
      } catch (e) { content = null; }
    }
    if (!content || !prof.content.test(content)) reasons.push('бет мазмұны Kaspi чегіне сай емес');
  }
  return { ok: reasons.length === 0, profile: prof ? prof.name : null, reasons };
}

module.exports = { kaspiPdfProfile, PROFILES };
