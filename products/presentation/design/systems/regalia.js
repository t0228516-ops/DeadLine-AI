'use strict';
/**
 * REGALIA («Салтанат») — тарих, құқық, әдебиет, мәдениет. Canva-ның «бордо тарих» шаблондарынан үйренген көрініс,
 * бірақ бір де бір бөтен файлсыз (бәрі CSS + өз оюларымыз):
 *   • мұқаба, бөлім, қорытынды — қою бордо (не тақырыпқа қарай малахит/лазурит) алаң, алтын бұрыш-жақтау;
 *     мұқаба фотосы оң жақта алаңға біртіндеп сіңеді («перде»);
 *   • мазмұн беттері — ашық пергамент (проектор мен дауыстап оқуға), бордо антиква тақырыптар;
 *   • kicker — алтын жиекті «пилюля»; карточкалар — жылы қызғылт-бежевый, «01» алтын антиква;
 *   • уақыт сызығы — жұқа алтын сызық + толық алтын нүктелер; сандар — ірі бордо антиква.
 * Тақырыпқа қарай өзгеретіні: түс жиыны (moodFor), әр слайдтың гравюрасы (decorPick — тақырып заты: тәж, қылыш, кітап…).
 */
const T = require('../tokens');

const S = '#stage.ds-regalia';
const enc = (svg) => 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';

/** Бұрыш-жақтау: қос сызық + ұшында кішкене бұйра (сол жақ жоғарғы бұрыш; басқасы — айналдырып) */
function corner(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="${c}" stroke-linecap="round">` +
    '<path d="M2 118V2h116" stroke-width="2.2"/><path d="M14 118V14h104" stroke-width="1.1"/>' +
    '<path d="M30 46c0-10 8-16 16-16 7 0 11 5 11 10s-4 8-8 8-6-3-6-6" stroke-width="1.6"/>' +
    '<circle cx="30" cy="54" r="2.2" fill="' + c + '" stroke="none"/></g></svg>';
}
/** Бөлгіш: екі жұқа сызық ортасында ромб-бұйра */
function divider(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 24"><g fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round">` +
    '<path d="M0 12h92M148 12h92"/><path d="M120 3l9 9-9 9-9-9z" fill="' + c + '"/>' +
    '<path d="M104 12c-4-6-10-6-12-1M136 12c4-6 10-6 12-1"/></g></svg>';
}

const DEEP = { regalia_bordo: 'regalia_bordo_deep', regalia_malachite: 'regalia_malachite_deep', regalia_lapis: 'regalia_lapis_deep' };

function css(p) {
  const acc = p.accent;                                  // бордо / малахит / лазурит
  const gold = p.accent2 || '#b8863b';
  const dm = T.MOODS[DEEP[p.mood]] || T.MOODS.regalia_bordo_deep;
  const dgold = dm.accent;
  const card = T.mixHex(p.bg, gold, 0.2);
  const hair = T.mixHex(p.bg, gold, 0.55);
  const cor = enc(corner(dgold));
  const div = enc(divider(gold));
  const ddiv = enc(divider(dgold));
  const D = `${S} .is-deep`;
  return [
    `${S} .deco,${S} .aurora,${S} .halo{display:none!important}`,
    `${S} .layer-bg::before,${S} .layer-bg::after{display:none!important}`,
    // ── қою слайдтар (мұқаба, бөлім, қорытынды): тереңдігі бар алаң + алтын бұрыш-жақтаулар ──
    `${D} .plate,${D} .plate-cover,${D} .plate-section{background:radial-gradient(120% 120% at 72% 28%,${T.mixHex(dm.bg, '#ffffff', 0.06)} 0%,${T.mixHex(dm.bg, '#000000', 0.35)} 100%)!important}`,
    `${D} .layer-bg::after{content:"";display:block!important;position:absolute;left:52px;top:52px;width:120px;height:120px;background:${cor} center/contain no-repeat;z-index:5}`,
    `${D} .layer-mid::after{content:"";position:absolute;right:52px;bottom:52px;width:120px;height:120px;background:${cor} center/contain no-repeat;transform:rotate(180deg);pointer-events:none}`,
    `${D} .rule{background-image:${ddiv}!important}`,
    `${D} .kicker,${D} .cx-pill{color:${dgold}!important;border-color:${T.rgba(dgold, 0.7)}!important}`,
    // мұқаба «перде»: фото оң жақта, сол шеті алаңға сіңеді
    `${S} .veil-photo{position:absolute;right:0;top:0;bottom:0;width:58%;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 46%);mask-image:linear-gradient(90deg,transparent 0%,#000 46%)}`,
    `${S} .veil-photo img{width:100%;height:100%;object-fit:cover}`,

    // ── типографика ──
    `${S} .title .hl{background:none!important;-webkit-text-fill-color:var(--accent2)!important;color:var(--accent2)!important}`,
    `${S} .kicker{display:inline-block;color:${acc};border:1.5px solid ${hair};border-radius:999px;padding:8px 22px!important;letter-spacing:.18em;font-weight:700}`,
    `${S} .rule{width:240px!important;height:24px!important;background:${div} left center/240px 24px no-repeat!important}`,

    // ── карточкалар/ұғымдар: жылы бежевый, алтын антиква нөмір ──
    `${S} .concept,${S} .ig-card,${S} .hn,${S} .st{background:${card}!important;border:0!important;border-radius:20px!important;box-shadow:none!important}`,
    `${S} .concept{padding:34px 32px!important}`,
    `${S} .concept::before,${S} .concept::after{display:none!important}`,
    `${S} .concept-n,${S} .row-n{background:none!important;border:0!important;color:${gold}!important;font-family:var(--f-display);font-weight:400;letter-spacing:0}`,
    `${S} .rows{border-top:0}${S} .row{border-color:${hair}}`,

    // ── уақыт сызығы: алтын ──
    `${S} .tl-mark::before{background:${gold}!important;height:2px!important}`,
    `${S} .tl-mark::after{border-radius:50%!important;background:${gold}!important;box-shadow:0 0 0 7px var(--bg)!important}`,
    `${S} .tl-date{background:none!important;-webkit-text-fill-color:${gold}!important;color:${gold}!important;font-family:var(--f-display);font-weight:400}`,

    // ── сандар ──
    `${S} .numeral-xl,${S} .mega,${S} .st-n,${S} .stat-v{background:none!important;-webkit-text-fill-color:var(--accent)!important;color:var(--accent)!important;font-family:var(--f-display);font-weight:400}`,

    // ── фото: жұқа алтын жиек ──
    `${S} .photo{box-shadow:0 0 0 1.5px ${hair},0 26px 50px -30px rgba(40,10,15,.5)!important}`,

    // ── гравюра-әшекей (decorPick): пергаментте — сия түсті, қою алаңда — алтын сызба ──
    `${S} .decor{position:absolute;visibility:hidden;pointer-events:none;object-fit:contain;mix-blend-mode:multiply;filter:sepia(.6) saturate(.7) brightness(1.1);opacity:.7}`,
    // композиция ішіндегі гравюра (қағазға басылғандай, multiply) қою алаңда көрінбейді → алтын сызбаға айналады
    `${D} .cx-part img[style*="multiply"]{mix-blend-mode:screen!important;filter:invert(1) sepia(1) saturate(1.5) hue-rotate(-12deg) brightness(.95)!important;opacity:.38}`,
    `${D} .decor{mix-blend-mode:screen;filter:invert(1) sepia(1) saturate(1.6) hue-rotate(-12deg) brightness(.92);opacity:.55}`,
  ].join('\n');
}

// тақырыпқа қарай түс: тарих/құқық — бордо; әдебиет/мәдениет — малахит; философия/дін — лазурит
const MOOD_RE = [
  ['regalia_malachite', /әдебиет|ақын|жазушы|поэзи|роман|өлең|мәдениет|өнер|литератур|поэт|писател|культур|искусств|literature|poet|novel|culture|\bart\b/i],
  ['regalia_lapis', /философ|ойшыл|дін|ислам|ғұлама|этика|философ|религ|этик|philosoph|religio|ethic/i],
];
function moodFor(text) {
  const t = String(text || '');
  const hit = MOOD_RE.find(([, re]) => re.test(t));
  return hit ? hit[0] : 'regalia_bordo';
}

module.exports = {
  id: 'regalia',
  name: 'Салтанат',
  type: { display: 'serif', text: 'sans', dw: 700, tw: 700, dt: '-0.015em', tt: '-0.01em', dl: 1.02, tl: 1.06, italicQuote: true },
  moods: ['regalia_bordo', 'regalia_malachite', 'regalia_lapis'],
  moodFor,
  deepMood: DEEP,
  num: 'pad',
  folio: { title: false, total: false, pad: true, cover: false },
  cover: 'veil',
  decor: true,
  bgkit: false,   // өз фоны: пергамент + қою алаңдар; bgkit қағазы қою слайдты бұлдыратады
  closing: 'rows',
  css,
};
