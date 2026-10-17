'use strict';
/**
 * Қазақ ою-өрнектері — DeadLine-ның ӨЗ SVG жинағы (сыртқы лицензиясыз, кез келген түске боялады).
 * Негізгі элементтер (мүйіз бұйрасы, түйетабан, ботакөз, қазмойын, құстұмсық, …) геометриямен салынып,
 * олардан әшекейлер құралады: жеке элемент, розетка/медальон, бордюр жолағы, бұрыш, бөлгіш, жиектеме.
 *
 *   node scripts/build-ornaments.js  →  products/presentation/assets/library/ornaments/*.svg + index.json
 * Түс: stroke/fill="currentColor" — слайдта CSS color арқылы палитраға бояуға болады.
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'products', 'presentation', 'assets', 'library', 'ornaments');

const f = (n) => Math.round(n * 100) / 100;
const svg = (vb, body, sw = 5, fill = 'none') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="${fill}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const g = (t, inner) => `<g transform="${t}">${inner}</g>`;
const mirror = (inner, cx) => inner + g(`matrix(-1 0 0 1 ${2 * cx} 0)`, inner);
const rot = (inner, n, cx, cy) => Array.from({ length: n }, (_, i) => g(`rotate(${f((360 / n) * i)} ${cx} ${cy})`, inner)).join('');

// ── негізгі элементтер (0..200 координатада, «тамыры» төменде ортада: 100,170) ──
// Мүйіз бұйрасы: сабақтан солға қайырылып, ішке оралатын спираль
const CURL = 'M100 170 C100 128 96 104 76 88 C54 70 22 78 20 108 C18 132 46 140 56 122 C64 108 50 96 40 106';
const CURL_SMALL = 'M100 170 C100 140 96 124 84 114 C70 102 50 108 50 126 C50 140 66 142 70 132';
const parts = {
  // қошқар мүйіз — қос бұйра
  koshkar: () => mirror(`<path d="${CURL}"/>`, 100) + '<path d="M100 170 L100 188"/><path d="M100 60 l9 11 -9 11 -9 -11z" fill="currentColor"/>',
  // сыңар мүйіз — жалғыз бұйра
  synar: () => `<path d="${CURL}"/><path d="M100 170 L100 188"/>`,
  // арқар мүйіз — ішкі кіші бұйрамен қос мүйіз
  arkar: () => mirror(`<path d="${CURL}"/><path d="${CURL_SMALL}"/>`, 100) + '<path d="M100 170 L100 190"/>',
  // сынық мүйіз — бұрыштық (геометриялық) мүйіз
  synyk: () => mirror('<path d="M100 172 L100 120 L64 120 L64 84 L28 84 L28 120 L46 120 L46 102"/>', 100),
  // түйетабан — төрт жапырақты із, ортада ромб
  tuyetaban: () => rot('<path d="M100 96 C80 70 80 40 100 28 C120 40 120 70 100 96Z"/>', 4, 100, 100) + '<path d="M100 84 L116 100 L100 116 L84 100Z" fill="currentColor"/>',
  // ботакөз — кірістірілген ромбылар
  botakoz: () => '<path d="M100 22 L178 100 L100 178 L22 100Z"/><path d="M100 52 L148 100 L100 148 L52 100Z"/><path d="M100 82 L118 100 L100 118 L82 100Z" fill="currentColor"/>',
  // қазмойын — бір-біріне қараған қос мойын (S-иірім)
  kazmoyin: () => mirror('<path d="M100 176 C100 150 60 150 60 120 C60 92 92 86 92 60 C92 40 76 30 62 36 C52 40 54 54 64 52"/>', 100),
  // құстұмсық — ішке иілген төрт тұмсық
  // (әр тармақ екі жаққа симметриялы — бір бағытқа айналған ілмектер жағымсыз символға ұқсайды)
  kustumsyk: () => rot(mirror('<path d="M100 100 L100 40 C100 26 118 22 124 34 C128 44 118 50 112 44"/>', 100), 4, 100, 100) + '<circle cx="100" cy="100" r="9" fill="currentColor"/>',
  // өркеш — толқын-өркештер
  orkesh: () => '<path d="M14 140 C34 140 34 80 58 80 C82 80 82 140 100 140 C118 140 118 80 142 80 C166 80 166 140 186 140"/><path d="M14 160 L186 160"/>',
  // төртқұлақ — төрт мүйізді розетка
  tortkulak: () => rot(`<g transform="translate(0 -70) scale(1) ">${mirror(`<path d="${CURL_SMALL}"/>`, 100)}</g>`, 4, 100, 100) + '<circle cx="100" cy="100" r="12"/>',
  // жұлдыз — сегіз бұрышты жұлдыз
  zhuldyz: () => '<path d="' + Array.from({ length: 16 }, (_, i) => { const r = i % 2 ? 40 : 82; const a = (Math.PI * 2 * i) / 16 - Math.PI / 2; return (i ? 'L' : 'M') + f(100 + r * Math.cos(a)) + ' ' + f(100 + r * Math.sin(a)); }).join(' ') + 'Z"/><circle cx="100" cy="100" r="18"/>',
  // күн — шеңбер + мүйізді сәулелер
  kun: () => '<circle cx="100" cy="100" r="30"/><circle cx="100" cy="100" r="10" fill="currentColor"/>' + rot(mirror('<path d="M100 62 L100 34 M100 34 C100 24 110 20 114 28 C116 34 110 37 107 33"/>', 100), 8, 100, 100),
  // ай — жарты ай мен жұлдыз
  ai: () => '<path d="M128 40 A64 64 0 1 0 128 160 A50 50 0 1 1 128 40Z"/><path d="M150 84 l5 12 13 1 -10 8 3 13 -11 -7 -11 7 3 -13 -10 -8 13 -1z" fill="currentColor"/>',
  // тұмар — үшбұрыш, ішкі үшбұрыш, шашақ
  tumar: () => '<path d="M100 24 L176 140 L24 140Z"/><path d="M100 64 L144 128 L56 128Z"/><path d="M60 140 L60 178 M100 140 L100 186 M140 140 L140 178"/><circle cx="60" cy="182" r="4" fill="currentColor"/><circle cx="100" cy="190" r="4" fill="currentColor"/><circle cx="140" cy="182" r="4" fill="currentColor"/>',
  // шаңырақ — шеңбер ішіндегі айқас уықтар
  shanyrak: () => {
    // шеңбер + екі бағытта айқасқан үш-үштен уық (күлдіреуіш)
    const R = 62; let bars = '';
    for (const off of [-20, 0, 20]) {
      const h = Math.sqrt(R * R - off * off);
      bars += `<path d="M${f(100 + off)} ${f(100 - h)} L${f(100 + off)} ${f(100 + h)}"/>`;
      bars += `<path d="M${f(100 - h)} ${f(100 + off)} L${f(100 + h)} ${f(100 + off)}"/>`;
    }
    return '<circle cx="100" cy="100" r="80"/><circle cx="100" cy="100" r="' + R + '"/>' + bars;
  },
  // гүл — алты күлтелі гүл
  gul: () => rot('<path d="M100 100 C84 76 88 44 100 30 C112 44 116 76 100 100Z"/>', 6, 100, 100) + '<circle cx="100" cy="100" r="10" fill="currentColor"/>',
  // құсқанат — қанат қауырсындары
  kuskanat: () => mirror('<path d="M100 150 C80 120 50 104 22 102 M100 150 C82 112 60 86 34 74 M100 150 C88 104 76 70 58 48 M100 150 C96 104 94 72 86 40"/>', 100),
};
const NAMES = {
  koshkar: 'Қошқар мүйіз', synar: 'Сыңар мүйіз', arkar: 'Арқар мүйіз', synyk: 'Сынық мүйіз', tuyetaban: 'Түйетабан',
  botakoz: 'Ботакөз', kazmoyin: 'Қазмойын', kustumsyk: 'Құстұмсық', orkesh: 'Өркеш', tortkulak: 'Төртқұлақ',
  zhuldyz: 'Жұлдыз', kun: 'Күн', ai: 'Ай', tumar: 'Тұмар', shanyrak: 'Шаңырақ', gul: 'Гүл', kuskanat: 'Құсқанат',
};

const out = {};
const write = (file, body, meta) => { fs.writeFileSync(path.join(OUT, file), body); out[file] = { license: 'own (DeadLine)', source: 'scripts/build-ornaments.js', ...meta }; };

// 1) жеке элементтер
for (const [k, fn] of Object.entries(parts)) write(`kz-${k}.svg`, svg('0 0 200 200', fn()), { kind: 'motif', motif: k, title: NAMES[k], tags: ['kazakh', 'ornament', k] });

// 2) медальон — қошқар мүйіз 4/6/8 рет айналып, шеңбер ішінде
for (const n of [4, 6, 8]) {
  const unit = g('translate(100 100) scale(.42) translate(-100 -186)', parts.koshkar());
  write(`kz-medallion-${n}.svg`, svg('0 0 200 200', '<circle cx="100" cy="100" r="94"/><circle cx="100" cy="100" r="86" stroke-width="2"/>' + rot(unit, n, 100, 100) + '<circle cx="100" cy="100" r="8" fill="currentColor"/>', 4), { kind: 'medallion', motif: 'koshkar', title: `Медальон (${n} мүйіз)`, tags: ['kazakh', 'ornament', 'medallion', 'rosette'] });
}
// 3) бордюр жолағы — мотив қатарынан, жоғары-төмен кезектесіп
for (const m of ['koshkar', 'synyk', 'kazmoyin', 'orkesh', 'botakoz', 'kustumsyk']) {
  const n = 8; const step = 100; const W = n * step;
  let body = `<path d="M0 6 L${W} 6 M0 94 L${W} 94" stroke-width="3"/>`;
  for (let i = 0; i < n; i++) {
    const up = i % 2 === 0;
    const t = up ? `translate(${i * step} 6) scale(.44)` : `translate(${i * step + step} 94) scale(.44) rotate(180 0 0) translate(0 0)`;
    body += g(up ? `translate(${i * step} 8) scale(.44)` : `translate(${i * step + step} 92) rotate(180) scale(.44)`, parts[m]());
  }
  write(`kz-band-${m}.svg`, svg(`0 0 ${W} 100`, body, 6), { kind: 'band', motif: m, title: `Бордюр: ${NAMES[m]}`, tags: ['kazakh', 'ornament', 'border', 'band', m] });
}
// 4) бұрыш — L пішінді жиек + бұрышта мүйіз
for (const m of ['koshkar', 'arkar', 'synyk']) {
  const body = '<path d="M10 190 L10 10 L190 10" stroke-width="4"/><path d="M26 190 L26 26 L190 26" stroke-width="2"/>' + g('translate(26 26) rotate(-45 0 0) translate(-100 -30) scale(1) translate(0 -150) scale(1)', '') + g('translate(40 40) scale(.55) rotate(-45 100 100)', parts[m]());
  write(`kz-corner-${m}.svg`, svg('0 0 200 200', body, 6), { kind: 'corner', motif: m, title: `Бұрыш: ${NAMES[m]}`, tags: ['kazakh', 'ornament', 'corner', m] });
}
// 5) бөлгіш — ортада мотив, екі жаққа жіңішкерген сызық
for (const m of ['koshkar', 'tuyetaban', 'botakoz', 'zhuldyz']) {
  const body = '<path d="M20 60 L300 60 M500 60 L780 60" stroke-width="3"/><path d="M120 70 L300 70 M500 70 L680 70" stroke-width="1.5"/>' + g('translate(340 0) scale(.6)', parts[m]());
  write(`kz-divider-${m}.svg`, svg('0 0 800 120', body, 6), { kind: 'divider', motif: m, title: `Бөлгіш: ${NAMES[m]}`, tags: ['kazakh', 'ornament', 'divider', m] });
}
// 6) жиектеме — төртбұрыш жиек, төрт бұрышта мүйіз
{
  const corner = g('translate(18 18) scale(.36) rotate(-45 100 100)', parts.koshkar());
  const body = '<rect x="10" y="10" width="780" height="430" rx="4" stroke-width="3"/><rect x="24" y="24" width="752" height="402" rx="2" stroke-width="1.5"/>'
    + corner + g('matrix(-1 0 0 1 800 0)', corner) + g('matrix(1 0 0 -1 0 450)', corner) + g('matrix(-1 0 0 -1 800 450)', corner);
  write('kz-frame-koshkar.svg', svg('0 0 800 450', body, 6), { kind: 'frame', motif: 'koshkar', title: 'Жиектеме: қошқар мүйіз', tags: ['kazakh', 'ornament', 'frame'] });
}
// 7) ит құйрық — жүгірген спираль-толқын бордюры
{
  let d = 'M0 50'; let body = '';
  for (let i = 0; i < 8; i++) {
    const x = i * 100;
    d += ` C${x + 30} 50 ${x + 30} 14 ${x + 52} 14 C${x + 72} 14 ${x + 76} 40 ${x + 60} 44 C${x + 48} 47 ${x + 44} 32 ${x + 54} 30`;
    d += ` M${x + 52} 14 C${x + 80} 14 ${x + 84} 50 ${x + 100} 50`;
  }
  body = `<path d="${d}"/><path d="M0 86 L800 86" stroke-width="3"/>`;
  write('kz-band-itkuyryk.svg', svg('0 0 800 100', body, 5), { kind: 'band', motif: 'itkuyryk', title: 'Бордюр: Ит құйрық', tags: ['kazakh', 'ornament', 'border', 'band', 'wave'] });
}
// 8) медальон — басқа мотивтермен
for (const m of ['tuyetaban', 'tortkulak', 'kun', 'gul']) {
  const body = '<circle cx="100" cy="100" r="94"/><circle cx="100" cy="100" r="86" stroke-width="2"/>'
    + rot('<circle cx="100" cy="10" r="3.5" fill="currentColor"/>', 24, 100, 100) + g('translate(22 22) scale(.78)', parts[m]());
  write(`kz-medallion-${m}.svg`, svg('0 0 200 200', body, 5), { kind: 'medallion', motif: m, title: `Медальон: ${NAMES[m]}`, tags: ['kazakh', 'ornament', 'medallion', m] });
}
// 9) бұрыш — төртқұлақ, түйетабан
for (const m of ['tortkulak', 'tuyetaban']) {
  const body = '<path d="M10 190 L10 10 L190 10" stroke-width="4"/><path d="M26 190 L26 26 L190 26" stroke-width="2"/>' + g('translate(34 34) scale(.42)', parts[m]());
  write(`kz-corner-${m}.svg`, svg('0 0 200 200', body, 6), { kind: 'corner', motif: m, title: `Бұрыш: ${NAMES[m]}`, tags: ['kazakh', 'ornament', 'corner', m] });
}
// 10) жиектеме — геометриялық (сынық мүйіз)
{
  const corner = g('translate(14 14) scale(.4)', parts.synyk());
  const body = '<rect x="10" y="10" width="780" height="430" stroke-width="3"/><rect x="26" y="26" width="748" height="398" stroke-width="1.5"/>'
    + corner + g('matrix(-1 0 0 1 800 0)', corner) + g('matrix(1 0 0 -1 0 450)', corner) + g('matrix(-1 0 0 -1 800 450)', corner);
  write('kz-frame-synyk.svg', svg('0 0 800 450', body, 6), { kind: 'frame', motif: 'synyk', title: 'Жиектеме: сынық мүйіз', tags: ['kazakh', 'ornament', 'frame'] });
}
// 11) фон-плиткалар (қайталанатын өрнек: CSS background-repeat)
{
  const tiles = {
    botakoz: '<path d="M50 6 L94 50 L50 94 L6 50Z"/><path d="M50 30 L70 50 L50 70 L30 50Z" fill="currentColor"/>',
    tuyetaban: g('translate(10 10) scale(.4)', parts.tuyetaban()),
    synyk: '<path d="M0 50 L20 50 L20 20 L50 20 L50 80 L80 80 L80 50 L100 50"/>',
    koshkar: g('translate(14 10) scale(.36)', parts.koshkar()),
  };
  for (const [k, body] of Object.entries(tiles)) write(`kz-tile-${k}.svg`, svg('0 0 100 100', body, 3), { kind: 'tile', motif: k, title: `Өрнек-плитка: ${NAMES[k] || k}`, tags: ['kazakh', 'ornament', 'pattern', 'tile', k] });
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'LICENSE.txt'), 'Kazakh ornament set drawn programmatically for DeadLine (scripts/build-ornaments.js). Own work; free to use inside DeadLine products.\nMotifs are traditional Kazakh folk ornament elements (public cultural heritage); the drawings are original.\n');
console.log(Object.keys(out).length, 'ornaments');
