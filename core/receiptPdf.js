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

/**
 * Белгілі Kaspi PDF түрлері (жаңа құрылғы/нұсқа үлгісі келсе — осында қосылады).
 *  android-skia — Android: Skia, A4, бір сурет 1080 px (маскамен), тұрақты орында; Info-да тек Producer.
 *  ios-quartz   — iPhone: Quartz PDFContext, Author «Kaspi.kz», әр жол бөлек сурет (/Perceptual ri),
 *                 CreationDate = чекті бөліскен сәт (төлем уақытынан бұрын болмайды).
 */
const PROFILES = [
  {
    name: 'android-skia',
    producer: /^Skia\/PDF m\d{2,3}$/,
    info: ['Producer'],
    check(s, buf, reasons) {
      const mb = (s.match(/\/MediaBox\s*\[([^\]]*)\]/) || [])[1];
      if (!mb || mb.trim().split(/\s+/).map(Number).join() !== '0,0,595,842') reasons.push('бет өлшемі басқа');
      const rgb = [...s.matchAll(/\/Subtype\s*\/Image\b([^>]*)/g)].map((m) => m[1]).filter((d) => /\/DeviceRGB/.test(d));
      if (rgb.length !== 1) reasons.push(`суреттер саны басқа (${rgb.length})`);
      else {
        const w = +((rgb[0].match(/\/Width (\d+)/) || [])[1] || 0);
        if (w !== 1080) reasons.push(`сурет ені ${w}px (Kaspi — 1080)`);
        if (!/\/SMask/.test(rgb[0])) reasons.push('суреттің мөлдірлік маскасы жоқ');
      }
      const objs = (s.match(/\n\d+ 0 obj\b/g) || []).length;
      if (objs < 6 || objs > 10) reasons.push(`құрылымы басқа (${objs} нысан)`);
      const content = pageContent(s, buf);
      if (!content || !/^1 0 0 -1 0 842 cm\nq\n0 0 595 842 re\nW\* n\nq\n340 0 0 -[\d.]+ 20 [\d.]+ cm\n0 0 0 RG 0 0 0 rg\n\/G\d+ gs\n\/X\d+ Do\nQ\nQ\n$/.test(content)) reasons.push('бет мазмұны Kaspi чегіне сай емес');
    },
  },
  {
    name: 'ios-quartz',
    producer: /^iOS Version [\d.]+ \(Build \w+\) Quartz PDFContext$/,
    info: ['Producer', 'Author', 'CreationDate', 'ModDate'],
    check(s, buf, reasons, info) {
      if (info.Author !== 'Kaspi.kz') reasons.push(`Author «${info.Author || '—'}» (Kaspi чегінде — Kaspi.kz)`);
      if (!info.CreationDate || info.CreationDate !== info.ModDate) reasons.push('файл кейін өзгертілген (жасалу/өзгеру уақыты әртүрлі)');
      const imgs = (s.match(/\/Subtype\s*\/Image\b/g) || []).length;
      if (imgs < 8) reasons.push(`суреттер саны тым аз (${imgs}) — Kaspi чегінде әр жол бөлек сурет`);
      const content = pageContent(s, buf);
      // Quartz ұзын жолды кез келген бос орыннан бөледі («Do Q\nQ», «cm\n/Im1»), сондықтан бос орын = \s+
      if (!content || !/^q\s+Q\s+q\s+0\s+100\s+[\d.]+\s+[\d.]+\s+re\s+W\s+n\s+\/Perceptual\s+ri\s+q\s+[\d.]+\s+0\s+0\s+[\d.]+\s+0\s+100\s+cm\s+\/Im1\s+Do\s+Q\s+Q/.test(content)) reasons.push('бет мазмұны Kaspi чегіне сай емес');
      if (/ BT\b|\bTj\b|\bTJ\b/.test(content || '')) reasons.push('бетте мәтін бар (Kaspi чегінде жоқ)');
    },
  },
];

const latin = (b) => b.toString('latin1');
const unesc = (v) => v.replace(/\\([()\\])/g, '$1');

/** Info сөздігі: { Producer, Author, CreationDate, ... } (PDF жолдары, жақшалары ашылған) */
function infoOf(s) {
  const tr = s.slice(s.lastIndexOf('trailer'));
  const n = (tr.match(/\/Info (\d+) 0 R/) || [])[1];
  const m = n && new RegExp(`(?:^|\\n)${n} 0 obj\\s*<<([\\s\\S]*?)>>\\s*endobj`).exec(s);
  const out = {};
  if (!m) return out;
  for (const k of m[1].matchAll(/\/(\w+)\s*\(((?:\\.|[^\\)])*)\)/g)) out[k[1]] = unesc(k[2]);
  return out;
}

/** PDF күні «D:20261022104225Z00'00'» → Date (UTC) */
function pdfDate(v) {
  const m = /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(Z|[+-]\d{2}'?\d{2}'?)?/.exec(v || '');
  if (!m) return null;
  let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const z = m[7] && m[7] !== 'Z' ? /([+-])(\d{2})'?(\d{2})/.exec(m[7]) : null;
  if (z) t -= (z[1] === '-' ? -1 : 1) * (+z[2] * 60 + +z[3]) * 60000;
  return new Date(t);
}

function streamOf(src, objNo) {
  const m = new RegExp(`(?:^|\\n)${objNo} 0 obj\\s*<<([\\s\\S]*?)>>\\s*stream\\r?\\n`).exec(src);
  if (!m) return null;
  return { dict: m[1], start: m.index + m[0].length, len: +((m[1].match(/\/Length (\d+)/) || [])[1] || -1) };
}

/** Жалғыз беттің мазмұн ағымы (ашылған мәтін) */
function pageContent(s, buf) {
  const ref = (s.match(/\/Type\s*\/Page\b[^]*?\/Contents (\d+) 0 R/) || [])[1];
  const st = ref && streamOf(s, ref);
  if (!st || st.len <= 0) return null;
  try {
    const raw = Buffer.from(buf).subarray(st.start, st.start + st.len);
    return /\/FlateDecode/.test(st.dict) ? zlib.inflateSync(raw).toString('latin1') : raw.toString('latin1');
  } catch (e) { return null; }
}

/**
 * @param {Buffer} buf
 * @returns {{ok:boolean, profile:string|null, created:Date|null, reasons:string[]}}
 *   created — файл жасалған сәт (iPhone чегінде бар): төлем уақытымен салыстыру үшін (receiptPdf.createdOk)
 */
function kaspiPdfProfile(buf) {
  const reasons = [];
  const s = latin(Buffer.from(buf));
  if (!s.startsWith('%PDF-')) return { ok: false, profile: null, created: null, reasons: ['PDF емес'] };

  if ((s.match(/%%EOF/g) || []).length !== 1 || (s.match(/startxref/g) || []).length !== 1) reasons.push('файл өңделген (үстіне жаңа қабат жазылған)');
  const info = infoOf(s);
  const producer = (info.Producer || '').trim();
  const prof = PROFILES.find((p) => p.producer.test(producer));
  if (!prof) reasons.push(producer ? `PDF-ті «${producer.slice(0, 50)}» жасаған (Kaspi емес)` : 'PDF жасағышы көрсетілмеген');
  else {
    const extra = Object.keys(info).filter((k) => !prof.info.includes(k));
    if (extra.length) reasons.push(`қосымша мәлімет жазылған: ${extra.join(', ')} (басқа бағдарламада сақталған)`);
  }
  if (/\/Font\b|\/FontDescriptor|\/FontFile/.test(s)) reasons.push('ішінде қаріп бар (Kaspi чегінде мәтін жоқ)');
  if (/\/Annots|\/AcroForm|\/JavaScript|\/OpenAction|\/EmbeddedFile/.test(s)) reasons.push('ішінде түсініктеме/форма/скрипт бар');
  if (/\/Metadata\b/.test(s)) reasons.push('XMP метадерегі бар (басқа бағдарламада сақталған)');
  const pages = (s.match(/\/Type\s*\/Page\b/g) || []).length;
  if (pages !== 1) reasons.push(`${pages} бет (Kaspi чегі — 1 бет)`);
  if (prof) prof.check(s, buf, reasons, info);
  return { ok: reasons.length === 0, profile: prof ? prof.name : null, created: pdfDate(info.CreationDate), reasons };
}

/**
 * Файл жасалған сәт төлем уақытына сай ма: чек төлемнен БҰРЫН жасала алмайды (2 мин рұқсат — сағат айырмасы),
 * және болашақта емес. Күні жоқ профиль (Android) — тексерілмейді (null).
 */
function createdOk(prof, paidAt, now = new Date()) {
  if (!prof || !prof.created || !paidAt) return null;
  const c = prof.created.getTime();
  return c >= paidAt.getTime() - 2 * 60000 && c <= now.getTime() + 2 * 60000;
}

module.exports = { kaspiPdfProfile, createdOk, pdfDate, PROFILES };
