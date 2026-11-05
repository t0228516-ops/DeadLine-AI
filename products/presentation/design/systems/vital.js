'use strict';
/**
 * VITAL («Таза») — Canva «Preventing Heart Disease» шаблонының дизайнерлік торы, біздің қозғалтқышта:
 * өз композициялары (compositions/vital.js), Inter Bold тақырып + Open Sans мәтін (SIL OFL, PPTX-ке ендіріледі).
 * Ақ фон, қою көк мәтін, бір ашық екпін түсі (тақырыпқа қарай: медицина/спорт — қызыл, биология/экология — көкшіл-жасыл,
 * қалғаны — көк), фото — қиғаш жиекпен оң жақта, төменгі бұрышта екпін-үшбұрыш.
 */
const S = '#stage.ds-vital';

function css(p) {
  const acc = p.accent;
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    // шаблонның өз жиектері (сол жиек ~110 px, жоғары/төмен ~60 px) — қозғалтқыштың 128/104/96 әдепкісінен тар
    `${S} .vt-slide{--cl:72px;--cr:72px;--ct:60px;--cb:44px}`,
    `${S} .plate{background:var(--bg)!important}`,
    `${S} .title{color:var(--text)!important;letter-spacing:-.01em}`,
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important}`,
    `${S} .vt-bar{width:170px;height:7px;background:${acc};margin-top:30px}`,
    `${S} .vt-acc{color:${acc}!important}`,
    `${S} .kicker{display:inline-block;color:${acc}!important;letter-spacing:.04em;font-weight:700;text-transform:none}`,
    `${S} .rule{background:${acc}!important;height:7px!important}`,
    // жалпы макеттерге — сол тіл
    `${S} .concept,${S} .stat,${S} .ig-card{background:#eef2f9!important;border:0!important;border-radius:0!important;box-shadow:none!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important;font-family:var(--f-display)}`,
    `${S} .row-n{color:${acc}!important;background:none!important}`,
    `${S} .photo{border-radius:0!important;box-shadow:none!important}`,
    `${S} .bleed{border-radius:0!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.85}`,
  ].join('\n');
}

const MOOD_RE = [
  ['vital_red', /медицин|денсаулық|ауру|емдеу|дәрі|жүрек|қан|мейірбике|спорт|салауатты|тамақтан|медиц|здоров|болезн|лечен|сердц|кров|спорт|питани|medic|health|disease|heart|blood|nurs|sport|nutrition/i],
  ['vital_teal', /биолог|жасуша|ген|экология|табиғат|өсімдік|жануар|климат|су |орман|химия|биолог|клетк|экологи|природ|растени|животн|климат|хими|biolog|cell|gene|ecolog|nature|plant|animal|climate|chemi/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'vital_blue';
}

module.exports = {
  id: 'vital',
  name: 'Таза',
  type: { display: 'inter', text: 'opensans', dw: 700, tw: 700, dt: '-0.01em', tt: '-0.01em', dl: 1.0, tl: 1.06 },
  moods: ['vital_red', 'vital_teal', 'vital_blue'],
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
