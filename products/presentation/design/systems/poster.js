'use strict';
/**
 * POSTER («Плакат») — Canva-ның батыл заманауи шаблондары деңгейі: тұтас қанық түс блоктары, алып тақырып,
 * бір-біріне кіретін пішіндер. Құрылымды өз композициялары салады (compositions/poster.js); бұл файл — тері
 * (қаріп, kicker, кілт сөз, тізім/кесте сияқты жалпы макеттер) және тақырыпқа қарай түс жиыны.
 */
const T = require('../tokens');

const S = '#stage.ds-poster';
const POP = { poster_blue: '#ffd400', poster_green: '#c6f432', poster_red: '#ffc21a', poster_violet: '#2ee6c5' };

function css(p) {
  const acc = p.accent;
  const acc2 = p.accent2 || acc;
  const pop = POP[p.mood] || '#ffd400';
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .plate{background:var(--bg)!important}`,
    // kicker — толық түсті чип; түс блогының үстінде — жарқыл түсі
    `${S} .kicker,${S} .cx-pill{display:inline-block;background:${acc}!important;color:#fff!important;border:0!important;border-radius:999px;padding:9px 24px!important;letter-spacing:.14em;font-weight:800}`,
    `${S} .pst-on .kicker{background:${pop}!important;color:#111!important}`,
    // кілт сөз: ақ фонда — қалың маркер; түс блогында — жарқыл түсімен
    `${S} .title .hl{background:linear-gradient(transparent 62%,${T.rgba(pop, 0.85)} 62% 92%,transparent 92%)!important;-webkit-text-fill-color:var(--text)!important;color:var(--text)!important}`,
    `${S} .pst-on .title .hl{background:none!important;-webkit-text-fill-color:${pop}!important;color:${pop}!important}`,
    `${S} .rule{background:${pop}!important;height:12px!important;width:110px!important}`,
    // жалпы макеттерге (кесте, процесс, салыстыру) — сол батыл тіл
    `${S} .concept,${S} .stat,${S} .ig-card{border:0!important;border-radius:22px!important;box-shadow:none!important}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v,${S} .tl-date{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important;font-weight:800;letter-spacing:-.04em}`,
    `${S} .rows{border-top:8px solid ${acc}}${S} .row-n{color:${acc2}!important;font-weight:800}`,
    `${S} .photo{border-radius:0!important;box-shadow:24px 24px 0 ${pop}!important}`,
    `${S} .bleed{border-radius:0!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.9}`,
  ].join('\n');
}

// тақырыпқа қарай: қоғам/құқық/бизнес — көк; жаратылыстану/медицина — жасыл; тарих/мәдениет/спорт — қызыл; IT/өнер — күлгін
const MOOD_RE = [
  ['poster_violet', /бағдарлама|программ|алгоритм|жасанды интеллект|нейрон|деректер|кибер|цифрлық|дизайн|өнер|музыка|software|programming|algorithm|neural|\bai\b|digital|design|\bart\b|music/i],
  ['poster_green', /биолог|экология|табиғат|медицин|денсаулық|химия|физика|ауру|жасуша|орман|эколог|природ|медицин|здоров|хими|физик|biolog|ecolog|nature|medic|health|chemi|physic/i],
  ['poster_red', /тарих|соғыс|мәдениет|әдебиет|спорт|дәстүр|истори|войн|культур|литератур|спорт|history|war\b|culture|literature|sport/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'poster_blue';
}

module.exports = {
  id: 'poster',
  name: 'Плакат',
  type: { display: 'arial', text: 'sans', dw: 800, tw: 800, dt: '-0.035em', tt: '-0.025em', dl: 0.96, tl: 1.02 },
  moods: ['poster_blue', 'poster_green', 'poster_red', 'poster_violet'],
  moodFor,
  num: 'pad',
  folio: { title: false, total: false, pad: true, cover: false },
  cover: 'panel',
  closing: 'rows',
  bgkit: false,
  ownComps: true,  // compositions/poster.js — сай келсе, жалпы композициялардан бұрын
  iconDecor: true,
  iconStroke: 1.4,
  iconMax: 240,
  css,
};
