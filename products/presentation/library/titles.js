'use strict';
/**
 * Canva ірі тақырыпты жол-жолымен бөлек қораптарға жазады («HUMAN» / «CELL &» / «GENETICS»). Толтыру жүйесі олардың
 * біреуін ғана тақырып деп таниды да, оған 6 әріп сыйдырады — мұқабада «АЛДЫН» деген жалғыз сөз қалады.
 * mergeStackedTitles: бірінің астында бірі тұрған, бір кегльдегі ірі жазулар бір қорапқа (әр жол — бөлек абзац, өз түсімен) біріктіріледі.
 */
const { readZipAll, writeZipAll } = require('../templateFill');
const { sldSzMatch } = require('../../../design-dna/structure');

const MIN_SZ = 2800;   // 28 pt (16:9, 13.33 дюйм слайдта) — тақырып деңгейіндегі жазу; Canva слайды үлкенірек, шек соған қарай өседі

function boxesOf(xml, W) {
  const out = [];
  for (const m of String(xml).matchAll(/<p:sp>(?:(?!<p:sp>)[\s\S])*?<\/p:sp>/g)) {
    const el = m[0];
    if (/<a:blipFill|<p:ph\b/.test(el) || !/<p:txBody>/.test(el)) continue;
    const paras = el.match(/<a:p>[\s\S]*?<\/a:p>/g) || [];
    const text = [...el.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((x) => x[1]).join('');
    // сан («80%», «17,9») — тақырып емес, статистика бағаны: біріктірілмейді
    if (paras.length !== 1 || !/\p{L}{2}/u.test(text) || /\d/.test(text) || text.length > 30) continue;
    const x = el.match(/<a:xfrm\b([^>]*)>\s*<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (!x || /\srot="(?!0")/.test(x[1])) continue;
    const sz = Math.max(0, ...[...el.matchAll(/\bsz="(\d+)"/g)].map((s) => +s[1]));
    if (sz < MIN_SZ * (W / 12192000)) continue;
    // тек бір жолдық қорап: екі жолға оралған қорапқа «жол биіктігі = келесі қорапқа дейінгі қашықтық» жараспайды
    if (+x[5] / 12700 > (sz / 100) * 1.9) continue;
    const algn = (el.match(/<a:pPr\b[^>]*\balgn="(\w+)"/) || [])[1] || 'l';
    out.push({ el, start: m.index, x: +x[2], y: +x[3], w: +x[4], h: +x[5], sz, algn });
  }
  return out;
}

/** Бір тақырыптың келесі жолы ма: кегль ұқсас, туралауы бірдей, сол шеті (не ортасы, не оң шеті) бір сызықта, арасы жақын */
function nextLine(a, b, W) {
  if (Math.abs(a.sz - b.sz) > Math.max(a.sz, b.sz) * 0.25 || a.algn !== b.algn) return false;
  const tol = W * 0.03;
  const edge = a.algn === 'ctr' ? Math.abs((a.x + a.w / 2) - (b.x + b.w / 2)) : a.algn === 'r' ? Math.abs((a.x + a.w) - (b.x + b.w)) : Math.abs(a.x - b.x);
  const gap = b.y - (a.y + a.h);
  return edge <= tol && b.y > a.y && gap <= a.h * 0.5;
}

function mergeSlide(xml, W) {
  const boxes = boxesOf(xml, W).sort((a, b) => a.y - b.y);
  const used = new Set();
  let out = xml;
  for (const a of boxes) {
    if (used.has(a)) continue;
    const run = [a];
    for (const b of boxes) {
      if (used.has(b) || run.includes(b)) continue;
      if (run.length < 4 && nextLine(run[run.length - 1], b, W)) run.push(b);
    }
    if (run.length < 2) continue;
    run.forEach((r) => used.add(r));
    const x = Math.min(...run.map((r) => r.x)); const y = run[0].y;
    const w = Math.max(...run.map((r) => r.x + r.w)) - x; const h = Math.max(...run.map((r) => r.y + r.h)) - y;
    // жол аралығы түпнұсқадағыдай: әр жолдың биіктігі (lnSpc) = келесі қораптың басына дейінгі қашықтық
    const paras = run.map((r, i) => {
      const p = r.el.match(/<a:p>[\s\S]*?<\/a:p>/)[0];
      if (i === run.length - 1) return p;
      const pitch = Math.round(((run[i + 1].y - r.y) / 12700) * 100);
      const ln = `<a:lnSpc><a:spcPts val="${pitch}"/></a:lnSpc>`;
      const body = p.replace(/<a:lnSpc>[\s\S]*?<\/a:lnSpc>/, '').replace(/<a:spcBef>[\s\S]*?<\/a:spcBef>/, '');
      if (/<a:pPr\b[^>]*\/>/.test(body)) return body.replace(/<a:pPr\b([^>]*)\/>/, `<a:pPr$1>${ln}</a:pPr>`);
      if (/<a:pPr\b[^>]*>/.test(body)) return body.replace(/(<a:pPr\b[^>]*>)/, `$1${ln}`);
      return body.replace('<a:p>', `<a:p><a:pPr>${ln}</a:pPr>`);
    }).join('');
    const merged = run[0].el
      .replace(/<a:off x="-?\d+" y="-?\d+"\/>\s*<a:ext cx="\d+" cy="\d+"\/>/, `<a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/>`)
      .replace(/<a:p>[\s\S]*<\/a:p>/, paras);
    out = out.replace(run[0].el, () => merged);
    for (const r of run.slice(1)) out = out.replace(r.el, '');
  }
  return out;
}

function mergeStackedTitles(buf) {
  const files = readZipAll(buf);
  const m = sldSzMatch(files.get('ppt/presentation.xml'));
  const W = m ? +m[1] : 12192000;
  let changed = false;
  for (const [name, data] of files) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
    const xml = String(data);
    const out = mergeSlide(xml, W);
    if (out !== xml) { files.set(name, out); changed = true; }
  }
  return changed ? writeZipAll(files) : buf;
}

module.exports = { mergeStackedTitles, mergeSlide };
