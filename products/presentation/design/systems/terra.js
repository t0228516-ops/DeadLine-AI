'use strict';
/**
 * TERRA («Табиғат») — Canva «Climate Change & Protecting Our Environment» шаблонының дизайнерлік торы, біздің қозғалтқышта:
 * өз композициялары (compositions/terra.js), Montserrat Bold тақырып (шаблондағы TT Fors орнына) + Open Sans мәтін (TT Chocolates орнына).
 * Қою табиғи фон (орман жасылы), ақ тақырып, бір ашық екпін (көгілдір), фото — сол жиегі толқынды, оң жақта;
 * тізім — екпін түсті тік сызық, нөмір — екпін дөңгелек, карточка — жұқа ақшыл жиек.
 */
const S = '#stage.ds-terra';

function css(p) {
  const acc = p.accent;
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .tr-slide{--cl:64px;--cr:64px;--ct:56px;--cb:44px}`,
    `${S} .plate{background:var(--bg)!important}`,
    `${S} .title{color:#ffffff!important;letter-spacing:-.015em}`,
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important}`,
    `${S} .tr-acc{color:${acc}!important}`,
    `${S} .kicker{display:inline-block;color:${acc}!important;letter-spacing:.06em;font-weight:700;text-transform:uppercase}`,
    `${S} .rule{background:${acc}!important}`,
    `${S} .concept,${S} .stat,${S} .ig-card{background:rgba(255,255,255,.04)!important;border:2px solid rgba(255,255,255,.22)!important;border-radius:18px!important;box-shadow:none!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important;font-family:var(--f-display)}`,
    `${S} .row-n{color:${p.bg}!important;background:${acc}!important}`,
    `${S} .photo{border-radius:0!important;box-shadow:none!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.85}`,
  ].join('\n');
}

const MOOD_RE = [
  ['terra_ocean', /теңіз|мұхит|су |өзен|көл|арал|балық|ауа|ғарыш|планета|море|океан|вод|рек|озер|арал|космос|планет|sea|ocean|water|river|lake|space|planet/i],
  ['terra_earth', /тарих|археолог|жер|дала|тау|топырақ|ауыл|мал|көшпелі|истори|археолог|земл|степ|гор|почв|сельск|кочев|history|archaeolog|soil|steppe|mountain|agricultur|nomad/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'terra_forest';
}

module.exports = {
  id: 'terra',
  name: 'Табиғат',
  type: { display: 'montserrat', text: 'opensans', dw: 400, tw: 400, dt: '-0.015em', tt: '-0.01em', dl: 1.0, tl: 1.06 },
  moods: ['terra_forest', 'terra_ocean', 'terra_earth'],
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
