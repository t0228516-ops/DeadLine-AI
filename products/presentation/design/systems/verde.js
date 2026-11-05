'use strict';
/**
 * VERDE («Ромб») — Canva «Company Profile / Larana» шаблонының дизайнерлік торы, біздің қозғалтқышта:
 * өз композициялары (compositions/verde.js), Montserrat Bold БАС ӘРІП тақырып (шаблондағы Garet орнына) + Inter мәтін.
 * Ақшыл фон, ромб пішінді фото (ақ жиек + көлеңке), бұрыштарда екпін түсінің үш реңкіндегі қиғаш үшбұрыштар,
 * жебе ұшты «батырма»-белгі, екпін түсті сан-чиптер.
 */
const S = '#stage.ds-verde';

function css(p) {
  const acc = p.accent;
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .vd-slide{--cl:96px;--cr:72px;--ct:60px;--cb:48px}`,
    `${S} .plate{background:var(--bg)!important}`,
    `${S} .title{color:${acc}!important;text-transform:uppercase;letter-spacing:.01em}`,
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:${p.accent2}!important;color:${p.accent2}!important}`,
    `${S} .vd-on .title,${S} .vd-on .title .hl{color:#fff!important;-webkit-text-fill-color:#fff!important}`,
    `${S} .vd-acc{color:${acc}!important}`,
    `${S} .kicker{display:inline-block;color:${acc}!important;letter-spacing:.06em;font-weight:700;text-transform:uppercase}`,
    `${S} .rule{background:${acc}!important}`,
    `${S} .concept,${S} .stat,${S} .ig-card{background:#fff!important;border:0!important;border-radius:14px!important;box-shadow:0 18px 40px -26px rgba(0,0,0,.35)!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important;font-family:var(--f-display)}`,
    `${S} .row-n{color:#fff!important;background:${acc}!important}`,
    `${S} .photo{border-radius:0!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.85}`,
  ].join('\n');
}

const MOOD_RE = [
  ['verde_blue', /бағдарлама|программ|алгоритм|жасанды интеллект|цифрлық|ақпарат|желі|инженер|физика|математика|ғарыш|информат|цифров|сеть|инженер|физик|математ|космос|software|program|digital|network|engineer|physics|math|space|\bai\b|\bit\b/i],
  ['verde_plum', /педагог|психолог|оқыту|мектеп|әлеумет|отбасы|мәдениет|өнер|дизайн|педагог|психолог|обучени|школ|социал|семь|культур|искусств|дизайн|education|psycholog|school|social|family|culture|art|design/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'verde_green';
}

module.exports = {
  id: 'verde',
  name: 'Ромб',
  type: { display: 'montserrat', text: 'inter', dw: 400, tw: 400, dt: '0.01em', tt: '0.01em', dl: 1.02, tl: 1.06 },
  moods: ['verde_green', 'verde_blue', 'verde_plum'],
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
