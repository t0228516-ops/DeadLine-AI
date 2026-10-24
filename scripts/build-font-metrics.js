'use strict';
/**
 * Кітапхана шаблондарының қаріп метрикасы → products/presentation/libraryFontMetrics.js
 *
 * SlidesCarnival шаблондары қаріпті MTX-сығылған EOT ретінде ендіреді — embeddedMetrics оны оқи алмайды,
 * сондықтан сыйғызу Arial/Times бағасымен есептеліп, кең қаріпте (Merriweather, Montserrat) мәтін сыймай қалатын.
 * Бұл скрипт Google Fonts-тан (OFL) әр қаріптің толық файлын алып, тек әріп ендерін (1/1000 em) және
 * қазақ әріптерін қамтитынын жазады. Қаріп файлының өзі репоға қосылмайды.
 *
 *   node scripts/build-font-metrics.js            # шаблондардағы барлық typeface
 *   FONT_DIR=/path node scripts/build-font-metrics.js   # жүктелген .ttf файлдарын осы жерге де сақтау (жергілікті рендер үшін)
 */
const fs = require('fs');
const path = require('path');
const { parseFont } = require('../products/presentation/embeddedMetrics');

// PowerPoint атауы → Google Fonts отбасы + салмақ («Montserrat Light» = Montserrat 300)
const WEIGHTS = { Thin: 100, ExtraLight: 200, Light: 300, Medium: 500, SemiBold: 600, ExtraBold: 800, Black: 900 };
const FACES = [
  'Alike', 'Amaranth', 'Anton', 'Archivo Black', 'Arimo', 'Barlow', 'Barlow Light', 'Barlow Medium', 'Barlow SemiBold', 'Cabin',
  'Caveat', 'Caveat Brush', 'Chakra Petch', 'Cormorant Garamond', 'Cormorant Garamond Light', 'Cormorant Garamond SemiBold',
  'DM Sans', 'EB Garamond', 'EB Garamond SemiBold', 'Encode Sans Semi Condensed', 'IBM Plex Sans', 'Inter', 'Inter ExtraLight',
  'Inter Light', 'Inter Medium', 'Inter SemiBold', 'Inter Thin', 'Josefin Sans', 'Jura', 'Kalam', 'KoHo', 'Lato', 'League Spartan',
  'Libre Baskerville', 'Libre Franklin', 'Libre Franklin Light', 'Merriweather', 'Montserrat', 'Montserrat Black', 'Montserrat Light',
  'Montserrat Medium', 'Nunito', 'Nunito Light', 'Nunito Sans', 'Nunito Sans Black', 'Open Sans', 'Open Sans Light', 'Pacifico',
  'Playfair Display', 'Poiret One', 'Poppins', 'Roboto', 'Sansita', 'Source Sans 3', 'Source Sans 3 Medium', 'Sriracha',
];
// Өлшенетін таңбалар: ASCII, кирилл (қазақ әріптерімен), жиі тыныс белгілері
const CHARS = (() => {
  const s = [];
  for (let c = 0x20; c <= 0x7e; c++) s.push(c);
  for (let c = 0x400; c <= 0x4ff; c++) s.push(c);
  for (const c of '«»–—…‘’“”„•№₸°×·') s.push(c.codePointAt(0));
  return String.fromCodePoint(...s);
})();
const KK = [0x4D8, 0x4D9, 0x492, 0x493, 0x49A, 0x49B, 0x4A2, 0x4A3, 0x4E8, 0x4E9, 0x4B0, 0x4B1, 0x4AE, 0x4AF, 0x4BA, 0x4BB, 0x406, 0x456];

function split(face) {
  const m = face.match(/^(.*?) (Thin|ExtraLight|Light|Medium|SemiBold|ExtraBold|Black)$/);
  return m ? { family: m[1], weight: WEIGHTS[m[2]] } : { family: face, weight: 400 };
}

async function ttf(family, weight) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`)).text();
  const url = (css.match(/url\((https:[^)]+\.ttf)\)/) || [])[1];
  if (!url) return null;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  if (process.env.FONT_DIR) fs.writeFileSync(path.join(process.env.FONT_DIR, `${family.replace(/\s+/g, '')}-${weight}.ttf`), buf);
  return buf;
}

function widths(buf) {
  const f = parseFont(buf);
  if (!f) return null;
  const arr = [];
  for (const ch of CHARS) { const v = f.adv(ch.codePointAt(0)); arr.push(v == null ? -1 : Math.round((v / f.upm) * 1000)); }
  return { arr, kk: KK.every((c) => f.adv(c) != null) };
}

(async () => {
  if (process.env.FONT_DIR) fs.mkdirSync(process.env.FONT_DIR, { recursive: true });
  const faces = {};
  for (const face of FACES) {
    // алдымен толық атау өз отбасы ретінде («Archivo Black», «Caveat Brush»), болмаса «отбасы + салмақ»
    let { family, weight } = { family: face, weight: 400 };
    try {
      let reg = await ttf(family, weight);
      if (!reg && split(face).weight !== 400) { ({ family, weight } = split(face)); reg = await ttf(family, weight); }
      // «қалың» нұсқа: шаблон b="1" қойса PowerPoint қалың салмақты алады (жоқ болса — синтетикалық, ені шамамен бірдей)
      const bold = await ttf(family, Math.min(900, Math.max(700, weight + 300))).catch(() => null);
      const r = reg && widths(reg);
      if (!r) { console.warn('missing', face); continue; }
      const b = bold && widths(bold);
      faces[face] = { kk: r.kk, r: r.arr, ...(b ? { b: b.arr } : {}) };
      console.log(face.padEnd(30), family, weight, 'kk', r.kk, b ? 'bold' : '-');
    } catch (e) { console.warn('fail', face, e.message); }
  }
  const out = path.join(__dirname, '..', 'products', 'presentation', 'libraryFontMetrics.js');
  fs.writeFileSync(out, `'use strict';
// Кітапхана шаблондарының қаріп метрикасы (Google Fonts, OFL) — scripts/build-font-metrics.js жасаған, қолмен өңдемеңіз.
// chars[i] таңбасының ені r[i] (regular) / b[i] (bold), 1/1000 em; -1 — қаріпте жоқ. kk — қазақ әріптері толық бар ма.
module.exports = ${JSON.stringify({ chars: CHARS, faces })};
`);
  console.log('wrote', out, Object.keys(faces).length, 'faces');
})();
