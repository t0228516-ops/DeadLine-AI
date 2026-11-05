'use strict';
/**
 * MEADOW («Алқап») — Canva «Landforms of the Earth» шаблонының дизайнерлік торы (мектеп), біздің қозғалтқышта:
 * өз композициялары (compositions/meadow.js), Montserrat Bold тақырып (шаблондағы Cooper Heavy орнына) + Inter мәтін.
 * Ашық аспан фон, қою қоңыр тақырып, жасыл пилюлялар, дөңгелек бұрышты фото; төменде — БІЗДІҢ өз SVG пейзажымыз
 * (қабатты төбелер, өзен, ағаштар, түсі палитрадан), шаблонның иллюстрациясы қолданылмайды.
 */
const S = '#stage.ds-meadow';

function css(p) {
  const acc = p.accent;
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .md-slide{--cl:72px;--cr:72px;--ct:56px;--cb:40px}`,
    `${S} .plate{background:var(--bg)!important}`,
    `${S} .title{color:var(--text)!important;letter-spacing:-.01em}`,
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important}`,
    `${S} .md-acc{color:${acc}!important}`,
    `${S} .kicker{display:inline-block;color:#fff!important;background:${acc};padding:6px 22px;border-radius:30px;letter-spacing:.02em;font-weight:700;text-transform:none}`,
    `${S} .rule{background:${acc}!important}`,
    `${S} .concept,${S} .stat,${S} .ig-card{background:#ffffff!important;border:0!important;border-radius:24px!important;box-shadow:0 14px 30px -22px rgba(0,0,0,.3)!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important;font-family:var(--f-display)}`,
    `${S} .row-n{color:#fff!important;background:${acc}!important}`,
    `${S} .photo{border-radius:24px!important;box-shadow:none!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.85}`,
  ].join('\n');
}

const MOOD_RE = [
  ['meadow_autumn', /тарих|әдебиет|ертегі|халық|мәдениет|дала|егін|күз|истори|литератур|сказк|народ|культур|степ|урожай|осен|history|literature|tale|folk|culture|steppe|harvest|autumn/i],
  ['meadow_snow', /математика|физика|химия|ғарыш|планета|қыс|информатика|математ|физик|хими|космос|планет|зим|информат|math|physics|chemi|space|planet|winter|computer/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'meadow_green';
}

module.exports = {
  id: 'meadow',
  name: 'Алқап',
  type: { display: 'montserrat', text: 'inter', dw: 400, tw: 400, dt: '-0.01em', tt: '-0.01em', dl: 1.04, tl: 1.08 },
  moods: ['meadow_green', 'meadow_autumn', 'meadow_snow'],
  moodFor,
  num: 'plain',
  folio: { title: false, total: false, pad: true, cover: false },
  cover: 'center',
  closing: 'rows',
  bgkit: false,
  iconDecor: true,
  iconStroke: 1.3,
  iconMax: 240,
  ownComps: true,
  css,
};
