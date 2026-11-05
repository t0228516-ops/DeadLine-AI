'use strict';
/**
 * LIBRO («Кітап») — Canva «Silent Library» шаблонының дизайнерлік торы, біздің қозғалтқышта:
 * өз композициялары (compositions/libro.js), курсив сериф тақырып (шаблондағы Cormorant Garamond Italic орнына —
 * Times New Roman курсиві, кез келген компьютерде бар, мәтін өңделеді) + Inter мәтін (Montserrat Regular орнына).
 * Тыныш шалфей фон, қою қоңыр мәтін, үлкен фото-блоктар (оң жақ баған / төменгі жолақ / сол шаршы), жіңішке сызба белгіше, «→».
 */
const S = '#stage.ds-libro';

function css(p) {
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .lb-slide{--cl:72px;--cr:72px;--ct:56px;--cb:44px}`,
    `${S} .plate{background:var(--bg)!important}`,
    `${S} .title{color:var(--text)!important;font-style:italic;font-weight:400!important;letter-spacing:-.01em}`,
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:var(--text)!important;color:var(--text)!important}`,
    `${S} .lb-on .title,${S} .lb-on .title .hl{color:${p.bg}!important;-webkit-text-fill-color:${p.bg}!important}`,
    `${S} .lb-it{font-family:var(--f-display);font-style:italic;font-weight:400}`,
    `${S} .kicker{display:inline-block;color:var(--text)!important;letter-spacing:.18em;font-weight:400;text-transform:uppercase}`,
    `${S} .rule{background:var(--text)!important;height:2px!important}`,
    `${S} .concept,${S} .stat,${S} .ig-card{background:transparent!important;border:0!important;border-top:2px solid ${p.text}!important;border-radius:0!important;box-shadow:none!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:var(--text)!important;color:var(--text)!important;font-family:var(--f-display);font-style:italic;font-weight:400}`,
    `${S} .row-n{color:var(--text)!important;background:none!important;font-style:italic}`,
    `${S} .photo{border-radius:0!important;box-shadow:none!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.85}`,
  ].join('\n');
}

const MOOD_RE = [
  ['libro_rose', /өнер|музыка|сурет|театр|кино|сән|махаббат|отбасы|психолог|искусств|музык|живопис|театр|кино|мод|любов|семь|психолог|art|music|paint|theatre|cinema|fashion|love|family|psycholog/i],
  ['libro_mist', /философ|дін|этика|құқық|заң|саясат|тарих|философ|религ|этик|право|закон|политик|истори|philosoph|religio|ethic|law|politic|history/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'libro_sage';
}

module.exports = {
  id: 'libro',
  name: 'Кітап',
  type: { display: 'serif', text: 'inter', dw: 400, tw: 400, dt: '-0.01em', tt: '-0.01em', dl: 0.98, tl: 1.02, italicQuote: true },
  moods: ['libro_sage', 'libro_rose', 'libro_mist'],
  moodFor,
  num: 'roman',
  folio: { title: false, total: false, pad: true, cover: false },
  cover: 'center',
  closing: 'rows',
  bgkit: false,
  iconDecor: true,
  iconStroke: 1.1,
  iconMax: 220,
  ownComps: true,
  css,
};
