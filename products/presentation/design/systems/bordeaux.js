'use strict';
/**
 * BORDEAUX («Бордо») — Canva «Red Beige Vintage History» шаблонының дизайнерлік торы, біздің қозғалтқышта:
 * өз композициялары (compositions/bordeaux.js), Playfair + Inter (SIL OFL, PPTX-ке ендіріледі — fontEmbed.js).
 * Тақырыпқа қарай түс: тарих/құқық — шарап, әдебиет/мәдениет — қою жасыл, философия/дін — түнгі көк.
 */
const S = '#stage.ds-bordeaux';

function css(p) {
  const peach = p.accent; const body = p.text;
  // CC0 гравюра (қара сызық, мөлдір фон) → шабдалы сызба
  const line = 'invert(1) sepia(1) saturate(1.25) hue-rotate(-18deg) brightness(1.02)';
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .plate{background:var(--bg)!important}`,
    `${S} .title{color:${peach}!important;line-height:.92}`,
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:${peach}!important;color:${peach}!important}`,
    `${S} .lead{color:${body}}`,
    // «Presented by» пилюлясы
    `${S} .kicker{display:inline-block;color:${body}!important;border:1.5px solid ${body};border-radius:999px;padding:7px 28px!important;letter-spacing:.02em;font-weight:400;text-transform:none;font-size:22px!important}`,
    `${S} .rule{background:${peach}!important}`,
    `${S} .bx-line{mix-blend-mode:screen;filter:${line}}`,
    `${S} .bx-hero{mix-blend-mode:screen;filter:${line} contrast(1.15);opacity:.92}`,
    // жалпы макеттерге (кесте, процесс) — сол тіл
    `${S} .concept,${S} .stat,${S} .ig-card{background:none!important;border:2px solid ${peach}!important;border-radius:6px!important;box-shadow:none!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:${peach}!important;color:${peach}!important;font-family:var(--f-display)}`,
    `${S} .photo{border-radius:16px!important;border:3px solid ${peach}!important;box-shadow:none!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;mix-blend-mode:screen;filter:${line};opacity:.55}`,
  ].join('\n');
}

const MOOD_RE = [
  ['bordeaux_forest', /әдебиет|ақын|жазушы|поэзи|өлең|мәдениет|өнер|литератур|поэт|писател|культур|искусств|literature|poet|culture|\bart\b/i],
  ['bordeaux_night', /философ|ойшыл|дін|ислам|этика|философ|религ|этик|philosoph|religio|ethic/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'bordeaux_wine';
}

module.exports = {
  id: 'bordeaux',
  name: 'Бордо',
  type: { display: 'playfair', text: 'inter', dw: 400, tw: 400, dt: '-0.01em', tt: '-0.01em', dl: 0.9, tl: 0.94 },
  moods: ['bordeaux_wine', 'bordeaux_forest', 'bordeaux_night'],
  moodFor,
  num: 'pad',
  folio: { title: false, total: false, pad: true, cover: false },
  cover: 'center',
  closing: 'rows',
  decor: true,
  bgkit: false,
  ownComps: true,
  css,
};
