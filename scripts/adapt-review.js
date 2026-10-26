'use strict';
/**
 * Шаблонды бейімдеу алдындағы көзбен тексеру: әр слайдтың екі түрі қатар.
 *   сол жақ  — шаблон (дайындау өтулерінен кейін: тақырып біріктіру, таблетка кеңейту, бейімдеу патчы);
 *   оң жақ   — ұзын қазақ мәтінімен толтырылған + шекаралар: мәтін қорабы қызыл, сурет көк.
 *
 *   node scripts/adapt-review.js SRC.pptx OUTDIR [--raw]
 *
 * OUTDIR/<id>.review.pptx жасалады; оны LibreOffice-пен суретке айналдырып қарау керек (--raw: патчсыз).
 */
const fs = require('fs');
const path = require('path');
const { readZipAll, writeZipAll } = require('../products/presentation/templateFill');

const KK = ('қазақстан мемлекеттік денсаулық жауапкершілік технологиялар ақпараттандыру медицина зерттеулер ' +
  'халықаралық экономикалық тарихи дәстүрлі әлеуметтік ұйымдастыру ғылыми жетістіктер нәтижелері өзгерістер').split(' ');

/** Түпнұсқа мәтінмен бірдей пішіндегі, ~25% ұзынырақ қазақ мәтіні (бас әріп сақталады) */
function kazakhLike(orig, seed) {
  const want = Math.max(2, Math.round(orig.length * 1.25));
  let s = ''; let i = seed;
  while (s.length < want) { s += (s ? ' ' : '') + KK[i % KK.length]; i += 7; }
  s = s.slice(0, want).replace(/\s+\S{0,2}$/, '');
  if (/\d/.test(orig) && orig.length <= 8) return orig;            // сан — сол қалпы
  if (orig === orig.toUpperCase() && /\p{L}/u.test(orig)) return s.toLocaleUpperCase('kk-KZ');
  return s.charAt(0).toLocaleUpperCase('kk-KZ') + s.slice(1);
}

const LINE = (hex) => `<a:ln w="28575"><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></a:ln>`;
function outline(el, hex) {
  return el.replace(/<p:spPr>([\s\S]*?)<\/p:spPr>|<p:spPr\/>/, (m, inner) => {
    const body = (inner || '').replace(/<a:ln\b[^>]*\/>|<a:ln\b[\s\S]*?<\/a:ln>/, '');
    // ln — fill-ден кейін, effectLst-тен бұрын
    const at = body.search(/<a:effectLst|<a:scene3d|<a:sp3d|<a:extLst/);
    return `<p:spPr>${at < 0 ? body + LINE(hex) : body.slice(0, at) + LINE(hex) + body.slice(at)}</p:spPr>`;
  });
}

function reviewSlide(xml) {
  let k = 0;
  return xml.replace(/<p:(sp|pic)>(?:(?!<p:(?:sp|pic)>)[\s\S])*?<\/p:\1>/g, (el, tag) => {
    const hasText = /<a:t>[^<]*[^\s<][^<]*<\/a:t>/.test(el);
    if (hasText) {
      el = el.replace(/<a:t>([^<]*)<\/a:t>/g, (m, t) => `<a:t>${t.trim() ? kazakhLike(t, k++) : t}</a:t>`);
      return outline(el, 'FF2D2D');
    }
    if (tag === 'pic' || /<a:blipFill/.test(el)) return outline(el, '1E6BFF');
    return el;
  });
}

function prepare(buf, o = {}) {
  const T = require('../products/presentation/library/titles');
  let out = T.mergeStackedTitles(buf);
  out = T.widenPillLabels(out);
  if (!o.raw) {
    try { out = require('../products/presentation/library/adapt').adaptDeck(out, o.id); } catch (e) { if (!/Cannot find module/.test(e.message)) throw e; }
  }
  return out;
}

if (require.main === module) {
  const [src, outDir, flag] = process.argv.slice(2);
  const id = path.basename(src).replace(/\.pptx$/, '');
  fs.mkdirSync(outDir, { recursive: true });
  const base = prepare(fs.readFileSync(src), { id, raw: flag === '--raw' });
  const files = readZipAll(base);
  const slides = [...files.keys()].filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const rev = readZipAll(base);
  for (const n of slides) rev.set(n, reviewSlide(String(files.get(n))));
  fs.writeFileSync(path.join(outDir, `${id}.base.pptx`), base);
  fs.writeFileSync(path.join(outDir, `${id}.review.pptx`), writeZipAll(rev));
  console.log(id, slides.length, 'slides');
}

module.exports = { reviewSlide, kazakhLike, prepare };
