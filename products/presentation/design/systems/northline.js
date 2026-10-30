'use strict';
/**
 * NORTHLINE («Ақ корпоратив») — Canva «Science Project / Northline» шаблонының дизайнерлік торы, біздің қозғалтқышта:
 * өз композициялары (compositions/northline.js), Montserrat Bold + Open Sans (SIL OFL, PPTX-ке ендіріледі).
 * Тақырыпқа қарай екінші түс: жаратылыстану/IT — лайм, медицина — көгілдір, қоғам/экономика/құқық — маржан.
 */
const T = require('../tokens');

const S = '#stage.ds-northline';

function css(p) {
  const navy = p.accent; const pop = p.accent2 || '#a3e635';
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .plate{background:var(--bg)!important}`,
    `${S} .title{color:${navy}!important;letter-spacing:-.01em}`,
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:${navy}!important;color:${navy}!important}`,
    `${S} .nl-on-navy{--text:#ffffff;--text2:rgba(255,255,255,.86);--text3:rgba(255,255,255,.72);color:#fff}`,
    `${S} .nl-on-navy .title,${S} .nl-on-navy .title .hl{color:#fff!important;-webkit-text-fill-color:#fff!important}`,
    `${S} .nl-chip{background:${navy};color:#fff}`,
    `${S} .nl-num{background:${navy};color:#fff}`,
    `${S} .nl-pop{background:${pop}}`,
    `${S} .kicker{display:inline-block;background:${navy};color:#fff!important;padding:8px 22px!important;letter-spacing:0;font-weight:700;text-transform:none}`,
    `${S} .rule{background:${pop}!important;height:8px!important}`,
    // жалпы макеттерге — сол тіл
    `${S} .concept,${S} .stat,${S} .ig-card{background:#fff!important;border:0!important;border-top:8px solid ${navy}!important;border-radius:0!important;box-shadow:0 18px 40px -28px ${T.rgba(navy, 0.35)}!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:${navy}!important;color:${navy}!important;font-family:var(--f-display)}`,
    `${S} .rows{border-top:8px solid ${navy}}${S} .row-n{color:#fff!important;background:${navy}!important}`,
    `${S} .photo{border-radius:0!important;box-shadow:none!important}`,
    `${S} .bleed{border-radius:0!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.85}`,
  ].join('\n');
}

const MOOD_RE = [
  ['northline_sky', /медицин|денсаулық|ауру|емдеу|дәрі|мейірбике|медиц|здоров|болезн|лечен|medic|health|disease|nurs/i],
  ['northline_coral', /саяси|саясат|құқық|заң|экономика|бизнес|маркетинг|менеджмент|қаржы|қоғам|әлеумет|политик|право|закон|экономик|бизнес|маркетинг|финанс|общест|социал|politic|law|econom|business|marketing|finance|society|social/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'northline_lime';
}

module.exports = {
  id: 'northline',
  name: 'Ақ корпоратив',
  type: { display: 'montserrat', text: 'opensans', dw: 400, tw: 400, dt: '-0.01em', tt: '-0.01em', dl: 1.0, tl: 1.06 },
  moods: ['northline_lime', 'northline_sky', 'northline_coral'],
  moodFor,
  num: 'pad',
  folio: { title: false, total: false, pad: true, cover: false },
  cover: 'panel',
  closing: 'rows',
  bgkit: false,
  iconDecor: true,
  iconStroke: 1.2,
  iconMax: 260,
  ownComps: true,
  css,
};
