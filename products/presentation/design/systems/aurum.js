'use strict';
/**
 * AURUM («Алтын») — Canva «Law Firm / Northline Group» шаблонының дизайнерлік торы, біздің қозғалтқышта:
 * өз композициялары (compositions/aurum.js), курсив сериф тақырып ортада, алтын түсті (шаблондағы Pinyon Script-те
 * кирилл жоқ — Times New Roman курсиві) + Inter мәтін. Қара фон, төменгі ширегінде сәл ашық жолақ,
 * тікбұрышты фотолар, алтын/ақ дөңгелек бұрышты тақташалар мен пилюлялар.
 */
const S = '#stage.ds-aurum';

function css(p) {
  const acc = p.accent;
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .au-slide{--cl:72px;--cr:72px;--ct:56px;--cb:40px}`,
    `${S} .plate{background:var(--bg)!important}`,
    `${S} .title{color:${acc}!important;font-style:italic;font-weight:400!important;letter-spacing:0}`,
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:#ffffff!important;color:#ffffff!important}`,
    `${S} .au-it{font-family:var(--f-display);font-style:italic;font-weight:400}`,
    `${S} .au-acc{color:${acc}!important}`,
    `${S} .kicker{display:inline-block;color:#fff!important;letter-spacing:.02em;font-weight:600;text-transform:none}`,
    `${S} .rule{background:${acc}!important}`,
    `${S} .concept,${S} .stat,${S} .ig-card{background:#1d1d1e!important;border:0!important;border-radius:14px!important;box-shadow:none!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important;font-family:var(--f-display);font-style:italic;font-weight:400}`,
    `${S} .row-n{color:#100f0f!important;background:${acc}!important}`,
    `${S} .photo{border-radius:0!important;box-shadow:none!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.85}`,
  ].join('\n');
}

const MOOD_RE = [
  ['aurum_silver', /бағдарлама|программ|технология|цифрлық|инженер|физика|математика|ғарыш|информат|технолог|цифров|инженер|физик|математ|космос|software|program|technolog|digital|engineer|physics|math|space/i],
  ['aurum_rose', /өнер|музыка|сән|театр|кино|дизайн|сұлулық|искусств|музык|мод|театр|кино|дизайн|красот|art|music|fashion|theatre|cinema|design|beauty/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'aurum_gold';
}

module.exports = {
  id: 'aurum',
  name: 'Алтын',
  type: { display: 'serif', text: 'inter', dw: 400, tw: 400, dt: '0em', tt: '0em', dl: 1.0, tl: 1.04, italicQuote: true },
  moods: ['aurum_gold', 'aurum_silver', 'aurum_rose'],
  moodFor,
  num: 'pad',
  folio: { title: false, total: false, pad: true, cover: false },
  cover: 'panel',
  closing: 'rows',
  bgkit: false,
  iconDecor: true,
  iconStroke: 1.3,
  iconMax: 240,
  ownComps: true,
  galleryOnly: true,   // фоны тек қараңғы — «авто» таңдамайды, тек клиент галереядан таңдаса
  css,
};
