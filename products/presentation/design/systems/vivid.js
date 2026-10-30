'use strict';
/**
 * VIVID («Жарқын») — Canva-ның батыл заманауи шаблондарынан үйренген: ақ фон + ҚАНЫҚҚАН түс блоктары.
 * Басқа жүйелердің түсі фонмен араласып бозғылт шығады; мұнда түс — құрылымның өзі:
 *   • мұқаба, бөлім, қорытынды — толық қанық түсті алаң (кобальт / изумруд / маджента / күлгін), ақ мәтін, сары акцент;
 *   • мазмұн беттері — таза ақ (оқылуы), сол жақ төменгі бұрышта қанық жолақ;
 *   • kicker — толық түсті «чип»; тақырыптағы кілт сөз астында қалың маркер;
 *   • карточкалар, сандар — кезектесетін қанық түстер (ақ мәтінмен); фото артында түсті «көлеңке-блок».
 * Тақырыпқа қарай: түс жиыны (moodFor) және мағынасына сай ірі белгішелер (iconDecor).
 */
const T = require('../tokens');

const S = '#stage.ds-vivid';
const DEEP = { vivid_cobalt: 'vivid_cobalt_deep', vivid_emerald: 'vivid_emerald_deep', vivid_magenta: 'vivid_magenta_deep', vivid_violet: 'vivid_violet_deep' };

function css(p) {
  const acc = p.accent;
  const acc2 = p.accent2 || acc;
  const dm = T.MOODS[DEEP[p.mood]] || T.MOODS.vivid_cobalt_deep;
  const pop = dm.accent;                       // сары/жасыл «жарқыл» (қою алаңда)
  const ink = p.text;
  const fills = [acc, acc2, T.mixHex(acc, ink, 0.35)];
  const on = (c) => (T.contrast('#ffffff', c) >= 3 ? '#ffffff' : ink);
  const D = `${S} .is-deep`;
  const nth = (sel) => fills.map((c, i) => `${S} ${sel}:nth-child(3n+${i + 1}){background:${c}!important;--text:${on(c)};--text2:${T.rgba(on(c), 0.86)};--text3:${T.rgba(on(c), 0.75)};color:${on(c)}}`).join('\n');
  return [
    `${S} .deco,${S} .aurora,${S} .halo,${S} .ghost{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    `${S} .plate{background:var(--bg)!important}`,
    // ── мазмұн беттері: сол жақ төменгі бұрышта қанық жолақ ──
    `${S} .slide:not(.is-deep) .layer-mid::before{content:"";position:absolute;left:0;bottom:0;width:220px;height:16px;background:${acc};pointer-events:none}`,
    // ── қою (қанық) слайдтар: толық түс, кілт сөз мен чип — сары жарқыл ──
    `${D} .plate,${D} .plate-cover,${D} .plate-section{background:var(--bg)!important}`,
    `${D} .title .hl{-webkit-text-fill-color:${pop}!important;color:${pop}!important;background:none!important}`,
    `${D} .kicker,${D} .cx-pill{background:${pop}!important;color:${dm.bg}!important;border-color:${pop}!important}`,
    `${D} .rule{background:${pop}!important}`,

    // ── типографика ──
    `${S} .title .hl{background:linear-gradient(transparent 64%,${T.rgba(acc2, 0.45)} 64% 94%,transparent 94%)!important;-webkit-text-fill-color:${ink}!important;color:${ink}!important}`,
    `${S} .kicker,${S} .cx-pill{display:inline-block;background:${acc}!important;color:#fff!important;border:0!important;border-radius:999px;padding:9px 22px!important;letter-spacing:.14em;font-weight:800}`,
    `${S} .rule{background:${acc2}!important;height:10px!important;width:96px!important;border-radius:0}`,

    // ── карточкалар/ұғымдар/сандар: кезектесетін қанық түстер ──
    `${S} .concept,${S} .stat,${S} .ig-card{border:0!important;border-radius:22px!important;box-shadow:none!important}`,
    `${S} .concept::before,${S} .concept::after,${S} .stat::before,${S} .stat::after,${S} .meter{display:none!important}`,
    nth('.concept'), nth('.stat'),
    `${S} .concept,${S} .stat{padding:34px 32px!important}`,
    `${S} .concept-n,${S} .row-n{background:none!important;border:0!important;color:inherit!important;opacity:.8;font-weight:800}`,
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v{background:none!important;-webkit-text-fill-color:currentColor!important;font-weight:800;letter-spacing:-.04em}`,
    `${S} .slide:not(.is-deep) .numeral-xl,${S} .slide:not(.is-deep) .mega{-webkit-text-fill-color:${acc}!important;color:${acc}!important}`,
    `${S} .rows{border-top:6px solid ${acc}}${S} .row-n{color:${acc}!important}`,
    // ── уақыт сызығы: қалың түсті сызық, түйіндер кезектесіп ──
    `${S} .tl-mark::before{background:${acc}!important;height:6px!important}`,
    `${S} .tl-mark::after{border-radius:50%!important;background:${acc2}!important;box-shadow:0 0 0 7px var(--bg)!important}`,
    `${S} .tl-date{background:none!important;-webkit-text-fill-color:${acc}!important;color:${acc}!important;font-weight:800}`,
    // ── фото: бұрышы тік, артында түсті блок ──
    `${S} .photo{border-radius:0!important;box-shadow:22px 22px 0 ${acc2}!important}`,
    `${S} .bleed{border-radius:0!important}`,
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;opacity:.9}`,
  ].join('\n');
}

// тақырыпқа қарай түс: қоғам/бизнес — кобальт; жаратылыстану/медицина — изумруд; білім/өнер/психология — маджента; IT — күлгін
const MOOD_RE = [
  ['vivid_violet', /бағдарлама|программ|алгоритм|жасанды интеллект|нейрон|деректер|кибер|цифрлық|software|programming|algorithm|neural|\bai\b|digital|data\b/i],
  ['vivid_emerald', /биолог|экология|табиғат|медицин|денсаулық|химия|физика|ауру|жасуша|орман|су\b|биолог|эколог|природ|медицин|здоров|хими|физик|biolog|ecolog|nature|medic|health|chemi|physic/i],
  ['vivid_magenta', /педагог|психолог|оқыту|мектеп|тәрбие|өнер|дизайн|музыка|сән|педагог|психолог|обучен|школ|искусств|дизайн|музык|education|teaching|psycholog|school|\bart\b|design|music|fashion/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'vivid_cobalt';
}

module.exports = {
  id: 'vivid',
  name: 'Жарқын',
  type: { display: 'arial', text: 'sans', dw: 800, tw: 800, dt: '-0.035em', tt: '-0.025em', dl: 0.98, tl: 1.04 },
  moods: ['vivid_cobalt', 'vivid_emerald', 'vivid_magenta', 'vivid_violet'],
  moodFor,
  deepMood: DEEP,
  num: 'pad',
  folio: { title: false, total: false, pad: true, cover: false },
  cover: 'panel',
  closing: 'rows',
  bgkit: false,
  iconDecor: true,
  iconStroke: 1.4,
  iconMax: 260,
  css,
};
