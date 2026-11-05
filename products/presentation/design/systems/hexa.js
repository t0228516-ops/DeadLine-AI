'use strict';
/**
 * HEXA («Алтыбұрыш») — Canva «The Future of Education» шаблонының дизайнерлік торы, біздің қозғалтқышта:
 * өз композициялары (compositions/hexa.js), Inter Bold БАС ӘРІП тақырып + Inter мәтін (шаблонның өз қаріптері).
 * Ақ фон, қара тақырып, алтыбұрыш фото + екпін/қою алтыбұрыштар, оң жиекте қара және екпін қиғаш жолақтар;
 * «қараңғы» слайдтарда — қою фон, екпін / қою / ақ карточкалар.
 */
const S = '#stage.ds-hexa';

function css(p) {
  const acc = p.accent;
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .hx-slide{--cl:80px;--cr:72px;--ct:60px;--cb:48px}`,
    `${S} .plate{background:var(--bg)!important}`,
    `${S} .title{color:var(--text)!important;text-transform:uppercase;letter-spacing:.005em}`,
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important}`,
    `${S} .hx-on .title,${S} .hx-on .title .hl{color:#fff!important;-webkit-text-fill-color:#fff!important}`,
    `${S} .kicker{display:inline-block;color:var(--text)!important;letter-spacing:.04em;font-weight:700;text-transform:uppercase}`,
    `${S} .rule{background:${acc}!important}`,
    `${S} .concept,${S} .stat,${S} .ig-card{background:${acc}!important;color:#fff!important;border:0!important;border-radius:22px!important;box-shadow:none!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important;font-family:var(--f-display)}`,
    `${S} .row-n{color:#fff!important;background:${acc}!important}`,
    `${S} .photo{border-radius:0!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.85}`,
  ].join('\n');
}

const MOOD_RE = [
  ['hexa_teal', /медицин|денсаулық|биолог|химия|экология|табиғат|физика|медиц|здоров|биолог|хими|экологи|природ|физик|medic|health|biolog|chemi|ecolog|nature|physics/i],
  ['hexa_crimson', /тарих|құқық|заң|саясат|әдебиет|мәдениет|өнер|истори|право|закон|политик|литератур|культур|искусств|history|law|politic|literature|culture|art/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'hexa_indigo';
}

module.exports = {
  id: 'hexa',
  name: 'Алтыбұрыш',
  type: { display: 'inter', text: 'inter', dw: 700, tw: 700, dt: '0em', tt: '0em', dl: 1.04, tl: 1.08 },
  moods: ['hexa_indigo', 'hexa_teal', 'hexa_crimson'],
  moodFor,
  num: 'pad',
  folio: { title: false, total: false, pad: true, cover: false },
  cover: 'panel',
  closing: 'rows',
  bgkit: false,
  iconDecor: true,
  iconStroke: 1.3,
  iconMax: 260,
  ownComps: true,
  css,
};
