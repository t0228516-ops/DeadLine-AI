'use strict';
/**
 * КВИЗ СЛАЙДЫ — дайын PPTX-тің ЕҢ СОҢЫНА қосылатын бір слайд (студент сұраған слайд санына кірмейді).
 *
 *   • сол жақта: «Сыныпқа квиз» + «▶ Квизді бастау» батырмасы — көрсету режимінде басқанда проектордың браузерінде
 *     ойын ашылады (гиперсілтеме, Telegram керек емес);
 *   • оң жақта: ақ карточкада QR код — топ телефон камерасымен сканерлеп қосылады, астында қысқа сілтеме.
 *
 * Кез келген PPTX-ке жұмыс істейді (біздің қозғалтқыш та, клиент шаблоны да): соңғы слайдтың макетін қолданады,
 * шебердің әшекейлерін жасырады (showMasterSp="0"), өлшемі слайд пішініне қарай масштабталады (16:9 / 4:3).
 * Мәтін — нативті, өңделетін.
 */
const fs = require('fs');
const { qrPng } = require('../../core/quiz');

const BASE_W = 1920; const BASE_H = 1080;      // жобалау торы (px)
const EMU_PER_PX = 12192000 / BASE_W;          // 6350

const TEXT = {
  kk: {
    kicker: 'ТОПҚА КВИЗ', title: 'Тексеріп көрейік!', body: (n) => `${n} сұрақ · телефон камерасымен QR кодты сканерлеңіз`,
    button: 'Квизді бастау', hint: 'Көрсету режимінде басыңыз — ойын проекторда ашылады',
  },
  ru: {
    kicker: 'КВИЗ ДЛЯ ГРУППЫ', title: 'Проверим себя!', body: (n) => `${n} вопросов · отсканируйте QR-код камерой телефона`,
    button: 'Начать квиз', hint: 'Нажмите в режиме показа — игра откроется на проекторе',
  },
  en: {
    kicker: 'GROUP QUIZ', title: "Let's check!", body: (n) => `${n} questions · scan the QR code with your phone camera`,
    button: 'Start quiz', hint: 'Click it in slide-show mode — the game opens on the projector',
  },
};

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (c, d) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); return m ? m[1].toUpperCase() : d; };
const langAttr = (lang) => (lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'kk-KZ');

/** Тақырып/мәтін қаріптері: соңғы слайдтағы ең үлкен жазу — тақырып қаріпі, ең жиі — мәтін қаріпі */
function guessFonts(slideXml) {
  const runs = [...String(slideXml || '').matchAll(/<a:rPr\b([^>]*)>([\s\S]*?)<\/a:rPr>/g)];
  let head = null; let headSz = 0; const freq = {};
  for (const r of runs) {
    const sz = Number((/\bsz="(\d+)"/.exec(r[1]) || [])[1] || 0);
    const face = (/<a:latin typeface="([^"]+)"/.exec(r[2]) || [])[1];
    if (!face) continue;
    freq[face] = (freq[face] || 0) + 1;
    if (sz > headSz) { headSz = sz; head = face; }
  }
  const body = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || null;
  return { head: head || '+mj-lt', body: body || head || '+mn-lt' };
}

/** Тема түстері (клиент шаблоны үшін): dk1 / lt1 / accent1 */
function themeColors(themeXml) {
  const pick = (name) => {
    const m = new RegExp(`<a:${name}>([\\s\\S]*?)</a:${name}>`).exec(String(themeXml || ''));
    if (!m) return null;
    return (/<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(m[1]) || /lastClr="([0-9A-Fa-f]{6})"/.exec(m[1]) || [])[1] || null;
  };
  return { dark: pick('dk1') || '1F1F1F', light: pick('lt1') || 'FFFFFF', accent: pick('accent1') || '2D7FF9' };
}

function lum(h) {
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const contrast = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/**
 * @param {string} pptxPath — орнында жаңартылады
 * @param {{ playerUrl: string, hostUrl: string, count?: number, language?: string,
 *           palette?: { bg, text, text2, accent, accentInk }|null, fonts?: {head, body}|null, beforeLast?: boolean }} o
 * @returns {Promise<number>} жаңа слайдтың нөмірі
 */
async function appendQuizSlide(pptxPath, o) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(pptxPath));
  const lang = o.language === 'ru' || o.language === 'en' ? o.language : 'kk';
  const L = TEXT[lang];

  let pres = await zip.file('ppt/presentation.xml').async('string');
  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  let presRels = await zip.file(presRelsPath).async('string');
  let types = await zip.file('[Content_Types].xml').async('string');

  // слайд өлшемі → біркелкі масштаб (4:3 шаблонда да пішін бұзылмайды), ортаға
  const sz = /<p:sldSz[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(pres);
  const cx = sz ? Number(sz[1]) : 12192000; const cy = sz ? Number(sz[2]) : 6858000;
  const k = Math.min(cx / (BASE_W * EMU_PER_PX), cy / (BASE_H * EMU_PER_PX));
  const offX = Math.round((cx - BASE_W * EMU_PER_PX * k) / 2); const offY = Math.round((cy - BASE_H * EMU_PER_PX * k) / 2);
  const X = (px) => Math.round(offX + px * EMU_PER_PX * k);
  const Y = (px) => Math.round(offY + px * EMU_PER_PX * k);
  const D = (px) => Math.round(px * EMU_PER_PX * k);
  const F = (px) => Math.max(800, Math.round(px * 0.5 * k * 100)); // px → pt*100

  // соңғы слайд: макеті мен қаріптері
  const ids = [...pres.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"[^>]*\br:id="([^"]+)"/g)];
  if (!ids.length) throw new Error('no slides');
  const lastRid = ids[ids.length - 1][2];
  const relRe = (rid) => new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*>`);
  const lastRel = relRe(lastRid).exec(presRels);
  const lastTarget = lastRel && (/Target="([^"]+)"/.exec(lastRel[0]) || [])[1];
  const lastPath = 'ppt/' + String(lastTarget || '').replace(/^\.?\//, '').replace(/^\/?ppt\//, '');
  const lastName = lastPath.split('/').pop();
  const lastRelsFile = zip.file(`ppt/slides/_rels/${lastName}.rels`);
  const lastRels = lastRelsFile ? await lastRelsFile.async('string') : '';
  const layout = (/Type="[^"]*\/slideLayout"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*\/slideLayout"/.exec(lastRels) || []);
  const layoutTarget = layout[1] || layout[2] || '../slideLayouts/slideLayout1.xml';
  const lastXml = zip.file(lastPath) ? await zip.file(lastPath).async('string') : '';

  // түстер: қозғалтқыштың палитрасы, болмаса шаблон темасы
  let pal;
  if (o.palette) {
    pal = {
      bg: hex(o.palette.bg, 'FFFFFF'), text: hex(o.palette.text, '111111'), text2: hex(o.palette.text2 || o.palette.text, '444444'),
      accent: hex(o.palette.accent, '2D7FF9'),
    };
  } else {
    const themeFile = Object.keys(zip.files).find((f) => /^ppt\/theme\/theme\d+\.xml$/.test(f));
    const th = themeColors(themeFile ? await zip.file(themeFile).async('string') : '');
    pal = { bg: th.light, text: th.dark, text2: th.dark, accent: th.accent };
  }
  if (contrast(pal.text, pal.bg) < 4.5) pal.text = lum(pal.bg) > 0.4 ? '111111' : 'FFFFFF';
  if (contrast(pal.text2, pal.bg) < 4.5) pal.text2 = pal.text;
  if (contrast(pal.accent, pal.bg) < 2) pal.accent = pal.text;            // батырма фонда көрінсін
  const ink = o.palette && o.palette.accentInk ? hex(o.palette.accentInk, 'FFFFFF') : (contrast('FFFFFF', pal.accent) >= contrast('111111', pal.accent) ? 'FFFFFF' : '111111');
  const fonts = o.fonts || guessFonts(lastXml);

  // жаңа слайд файлы
  const nums = Object.keys(zip.files).map((f) => (/^ppt\/slides\/slide(\d+)\.xml$/.exec(f) || [])[1]).filter(Boolean).map(Number);
  const n = Math.max(0, ...nums) + 1;
  const slidePath = `ppt/slides/slide${n}.xml`;
  const mediaName = `dlquiz${n}.png`;
  zip.file(`ppt/media/${mediaName}`, qrPng(o.playerUrl, { scale: 12, margin: 3 }));

  const slideRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="${esc(layoutTarget)}"/>`
    + `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`
    + `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(o.hostUrl)}" TargetMode="External"/>`
    + `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(o.playerUrl)}" TargetMode="External"/>`
    + '</Relationships>';

  const la = langAttr(lang);
  let sid = 2;
  const font = (face) => `<a:latin typeface="${esc(face)}"/><a:cs typeface="${esc(face)}"/>`;
  const runXml = (text, { size, color, bold, face, link, spc }) => `<a:r><a:rPr lang="${la}" sz="${F(size)}"${bold ? ' b="1"' : ''}${spc ? ` spc="${spc}"` : ''} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${font(face)}${link ? `<a:hlinkClick r:id="${link}"/>` : ''}</a:rPr><a:t>${esc(text)}</a:t></a:r>`;
  const textBox = (name, x, y, w, h, text, st, { algn = 'l', anchor = 't' } = {}) => {
    sid += 1;
    return `<p:sp><p:nvSpPr><p:cNvPr id="${sid}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
      + `<p:spPr><a:xfrm><a:off x="${X(x)}" y="${Y(y)}"/><a:ext cx="${D(w)}" cy="${D(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>`
      + `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>`
      + `<a:p><a:pPr algn="${algn}"><a:lnSpc><a:spcPct val="${st.line || 100000}"/></a:lnSpc></a:pPr>${runXml(text, st)}</a:p></p:txBody></p:sp>`;
  };

  const shapes = [];
  shapes.push(textBox('Quiz kicker', 128, 250, 900, 50, L.kicker, { size: 30, color: pal.accent, bold: true, face: fonts.body, spc: 300 }));
  shapes.push(textBox('Quiz title', 128, 305, 1000, 150, L.title, { size: 96, color: pal.text, bold: true, face: fonts.head, line: 92000 }, { anchor: 't' }));
  shapes.push(textBox('Quiz text', 128, 470, 900, 110, L.body(o.count || 10), { size: 36, color: pal.text2, face: fonts.body, line: 110000 }));
  // батырма: гиперсілтеме пішінде (мәтінде емес — әйтпесе PowerPoint оны көк астын сызып бояйды)
  sid += 1;
  shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${sid}" name="Quiz start button"><a:hlinkClick r:id="rId3"/></p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${X(128)}" y="${Y(620)}"/><a:ext cx="${D(600)}" cy="${D(128)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 22000"/></a:avLst></a:prstGeom>`
    + `<a:solidFill><a:srgbClr val="${pal.accent}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>`
    + `<p:txBody><a:bodyPr wrap="none" lIns="${D(72)}" tIns="0" rIns="0" bIns="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/>${runXml(L.button, { size: 44, color: ink, bold: true, face: fonts.head })}</a:p></p:txBody></p:sp>`);
  // ▶ белгісі — қаріптің глифі емес, пішін (қаріпте ▶ жоқ болса, PowerPoint оны эмодзи етіп салады)
  sid += 1;
  shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${sid}" name="Quiz start icon"><a:hlinkClick r:id="rId3"/></p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm rot="5400000"><a:off x="${X(222)}" y="${Y(664)}"/><a:ext cx="${D(40)}" cy="${D(40)}"/></a:xfrm><a:prstGeom prst="triangle"><a:avLst/></a:prstGeom>`
    + `<a:solidFill><a:srgbClr val="${ink}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`);
  shapes.push(textBox('Quiz hint', 128, 772, 900, 60, L.hint, { size: 24, color: pal.text2, face: fonts.body }));
  // QR карточкасы
  sid += 1;
  shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${sid}" name="QR card"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${X(1176)}" y="${Y(160)}"/><a:ext cx="${D(616)}" cy="${D(616)}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 6000"/></a:avLst></a:prstGeom>`
    + '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>'
    + `<a:ln w="${pal.bg === 'FFFFFF' || lum(pal.bg) > 0.85 ? 12700 : 0}">${lum(pal.bg) > 0.85 ? '<a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill>' : '<a:noFill/>'}</a:ln></p:spPr></p:sp>`);
  sid += 1;
  shapes.push(`<p:pic><p:nvPicPr><p:cNvPr id="${sid}" name="Quiz QR" descr="QR: ${esc(o.playerUrl)}"><a:hlinkClick r:id="rId4"/></p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
    + `<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`
    + `<p:spPr><a:xfrm><a:off x="${X(1196)}" y="${Y(180)}"/><a:ext cx="${D(576)}" cy="${D(576)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
  shapes.push(textBox('Quiz link', 1100, 800, 768, 60, String(o.playerUrl).replace(/^https?:\/\//, ''), { size: 30, color: pal.text, bold: true, face: fonts.body }, { algn: 'ctr' }));

  const slideXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" showMasterSp="0">'
    + `<p:cSld name="Quiz"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${pal.bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`
    + '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
    + shapes.join('')
    + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  zip.file(slidePath, slideXml);
  zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, slideRels);

  // presentation.xml + rels + content types (+ app.xml слайд саны)
  const maxId = Math.max(...ids.map((m) => Number(m[1])));
  const relNums = [...presRels.matchAll(/\bId="rId(\d+)"/g)].map((m) => Number(m[1]));
  const newRid = 'rId' + (Math.max(0, ...relNums) + 1);
  presRels = presRels.replace('</Relationships>', `<Relationship Id="${newRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/></Relationships>`);
  const entry = `<p:sldId id="${maxId + 1}" r:id="${newRid}"/>`;
  // beforeLast: кітапхана шаблонының автор слайды (Credits) соңында қалады, квиз — қорытындыдан кейін
  if (o.beforeLast && ids.length > 1) {
    const lastEntry = new RegExp(`<p:sldId\\b[^>]*\\br:id="${lastRid}"[^>]*/>`).exec(pres);
    pres = lastEntry ? pres.replace(lastEntry[0], entry + lastEntry[0]) : pres.replace('</p:sldIdLst>', entry + '</p:sldIdLst>');
  } else pres = pres.replace('</p:sldIdLst>', entry + '</p:sldIdLst>');
  types = types.replace('</Types>', `<Override PartName="/${slidePath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
  if (!/Extension="png"/i.test(types)) types = types.replace('<Default Extension="xml"', '<Default Extension="png" ContentType="image/png"/><Default Extension="xml"');
  zip.file('ppt/presentation.xml', pres);
  zip.file(presRelsPath, presRels);
  zip.file('[Content_Types].xml', types);
  const app = zip.file('docProps/app.xml');
  if (app) {
    const ax = await app.async('string');
    zip.file('docProps/app.xml', ax.replace(/<Slides>(\d+)<\/Slides>/, (m, c) => `<Slides>${Number(c) + 1}</Slides>`));
  }
  fs.writeFileSync(pptxPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return o.beforeLast && ids.length > 1 ? ids.length : ids.length + 1;
}

module.exports = { appendQuizSlide, guessFonts, themeColors, TEXT };
