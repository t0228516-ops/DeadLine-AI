'use strict';
/**
 * Шаблон фотоларын тақырыпқа сай фотомен АУЫСТЫРУ (кітапхана шаблондары өз стоктық фотоларымен келеді).
 *
 *   photoSlots(buf)          — әр слайдтағы ауыстыруға болатын фотолар (JPEG не мөлдір емес PNG, слайдтың ≥4%)
 *   replacePhotos(buf, list) — [{ slide, rid, dataUri, focus }] : фото сол қорапқа, «cover» кесумен (басты нысан ортада қалады)
 *
 * Canva шаблондарында фото да PNG (альфа арнасымен) болады, сондықтан «PNG = безендіру» емес: нақты мөлдір
 * пиксель үлесі (<20%) мен түс әртүрлілігі (≥40 деңгей) өлшенеді — гүл, ою, гравюра, жалпақ иллюстрация ауыстырылмайды.
 * Жаңа фото түпнұсқаның ӨЛШЕМІ мен МӨЛДІРЛІК ПІШІНІНЕ (доға, дөңгелек бұрыш) Chromium canvas-та салынады, сондықтан
 * слайдтағы кесу (srcRect) мен пішін сол қалпында қалады; түпнұсқа ақ-қара болса, жаңа фото да ақ-қара.
 */
const { pngStats } = require('./png');
const { readZipAll, writeZipAll } = require('../templateFill');
const { orderedSlides, relsMap, resolvePath, sldSzMatch } = require('../../../design-dna/structure');

const relsPathOf = (p) => p.replace(/([^/]+)$/, '_rels/$1.rels');
const MIN_AREA = Number(process.env.LIBRARY_PHOTO_MIN_AREA) || 0.04;

function slideSize(files) {
  const m = sldSzMatch(files.get('ppt/presentation.xml'));
  return m ? { W: +m[1], H: +m[2] } : { W: 12192000, H: 6858000 };
}

/** PNG мөлдірлігі: түс түрі 4/6 (альфа арнасы) не tRNS бөлігі бар болса — безендіру */
function pngHasAlpha(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return false;
  const colorType = buf[25];
  if (colorType === 4 || colorType === 6) return true;
  return buf.indexOf('tRNS', 33, 'latin1') > 0 && buf.indexOf('tRNS', 33, 'latin1') < Math.min(buf.length, 4096);
}
function isPhotoBytes(name, buf) {
  if (/\.(jpe?g)$/i.test(name)) return true;
  if (!/\.png$/i.test(name)) return false;
  if (!pngHasAlpha(buf)) return true;
  const st = pngStats(buf);
  return !!st && st.transparent < 0.2 && st.colors >= 40;
}

/** Бір слайдтағы <p:pic> блоктары: rId, орын/өлшем (EMU) */
function picsOf(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
    const block = m[0];
    const rid = (block.match(/<a:blip [^>]*r:embed="([^"]+)"/) || [])[1];
    const x = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (!rid || !x || /<a:tile\b/.test(block)) continue;
    out.push({ rid, x: +x[1], y: +x[2], w: +x[3], h: +x[4] });
  }
  return out;
}

/**
 * @param {Buffer} buf
 * @returns {Array<{slide:number, rid:string, w:number, h:number, area:number}>} slide — 0-негізді
 */
function photoSlots(buf) {
  const files = readZipAll(buf);
  const { W, H } = slideSize(files);
  const out = [];
  orderedSlides(files).forEach((sp, i) => {
    const rels = relsMap(files.get(relsPathOf(sp)));
    const seen = new Set();
    for (const p of picsOf(files.get(sp))) {
      const r = rels[p.rid];
      if (!r || seen.has(p.rid)) continue;
      const media = resolvePath(sp, r.target);
      const data = files.get(media);
      const area = (p.w * p.h) / (W * H);
      if (area < MIN_AREA || !isPhotoBytes(media, data)) continue;
      seen.add(p.rid);
      out.push({ slide: i, rid: p.rid, w: p.w, h: p.h, area: +area.toFixed(3), media, alpha: /\.png$/i.test(media) && pngHasAlpha(data) });
    }
  });
  return out;
}

function imageSize(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const mk = buf[i + 1];
    if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/** «cover» кесу: сурет қораптың пропорциясына, басты нысан (focus "x% y%") кадрда қалады. srcRect бірлігі — 1/1000 %. */
function coverCrop(img, box, focus) {
  if (!img || !img.w || !img.h || !box.w || !box.h) return null;
  const fm = String(focus || '').match(/(\d{1,3})%\s+(\d{1,3})%/);
  const fx = fm ? Math.min(100, +fm[1]) / 100 : 0.5; const fy = fm ? Math.min(100, +fm[2]) / 100 : 0.45;
  const ir = img.w / img.h; const br = box.w / box.h;
  let l = 0, t = 0, r = 0, b = 0;
  if (ir > br) { // сурет кеңірек — екі жағынан кесеміз
    const keep = br / ir; const cut = 1 - keep;
    l = Math.max(0, Math.min(cut, fx - keep / 2)); r = cut - l;
  } else {
    const keep = ir / br; const cut = 1 - keep;
    t = Math.max(0, Math.min(cut, fy - keep / 2)); b = cut - t;
  }
  const k = (v) => Math.round(v * 100000);
  return `<a:srcRect l="${k(l)}" t="${k(t)}" r="${k(r)}" b="${k(b)}"/>`;
}

/**
 * @param {Buffer} buf
 * @param {Array<{slide:number, rid:string, dataUri:string, focus?:string}>} list
 * @returns {{buf:Buffer, replaced:number}}
 */
function replacePhotos(buf, list) {
  const files = readZipAll(buf);
  const slides = orderedSlides(files);
  let n = 0;
  let ct = files.get('[Content_Types].xml') || '';
  for (const it of list || []) {
    const sp = slides[it.slide];
    const m = it.bytes ? null : String(it.dataUri || '').match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
    if (!sp || (!m && !it.bytes)) continue;
    const bytes = it.bytes || Buffer.from(m[2], 'base64');
    const ext = it.bytes ? (bytes.readUInt32BE(0) === 0x89504e47 ? 'png' : 'jpeg') : (m[1] === 'png' ? 'png' : 'jpeg');
    const media = `ppt/media/dl_photo_${it.slide + 1}_${it.rid.replace(/\W/g, '')}.${ext}`;
    const rp = relsPathOf(sp);
    const rels = files.get(rp);
    if (!rels || !new RegExp(`Id="${it.rid}"`).test(rels)) continue;
    files.set(media, bytes);
    files.set(rp, rels.replace(new RegExp(`(<Relationship [^>]*Id="${it.rid}"[^>]*Target=")[^"]+(")`), `$1../media/${media.split('/').pop()}$2`)
      .replace(new RegExp(`(<Relationship [^>]*Target=")[^"]+("[^>]*Id="${it.rid}")`), `$1../media/${media.split('/').pop()}$2`));
    const img = imageSize(bytes);
    files.set(sp, files.get(sp).replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (block) => {
      if (!new RegExp(`r:embed="${it.rid}"`).test(block)) return block;
      if (it.bytes) return block; // canvas-та түпнұсқа өлшемге салынған — кесу мен пішін өзгермейді
      const x = block.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
      const crop = coverCrop(img, { w: x ? +x[1] : 1, h: x ? +x[2] : 1 }, it.focus);
      let b = block.replace(/<a:srcRect\b[^>]*\/>|<a:srcRect\b[^>]*>[\s\S]*?<\/a:srcRect>/, '');
      if (crop) b = b.replace(/(<a:blip\b[^>]*\/>|<a:blip\b[^>]*>[\s\S]*?<\/a:blip>)/, `$1${crop}`);
      return b;
    }));
    if (!new RegExp(`Extension="${ext}"`, 'i').test(ct)) ct = ct.replace(/(<Types[^>]*>)/, `$1<Default Extension="${ext}" ContentType="image/${ext === 'png' ? 'png' : 'jpeg'}"/>`);
    n++;
  }
  files.set('[Content_Types].xml', ct);
  // ауыстырылған ескі суреттер енді ешкімге керек емес — өшеді (файл кішірейеді)
  if (n) require('./carve').collectGarbage(files);
  return { buf: writeZipAll(files), replaced: n };
}

/**
 * Суреттің пиксель сипаты (Chromium canvas, 64×64): фото ме, әлде текстура/иллюстрация ма.
 *   lumStd  — жарықтық ауытқуы (қағаз, бір түсті фон — өте аз)
 *   top8    — ең жиі 8 түс (4 бит/арна) қанша пиксельді алады (жалпақ иллюстрация, карта, әшекей — көп)
 *   opaque  — мөлдір емес пиксель үлесі;  sat — орташа қанықтық (ақ-қара фото ≈ 0)
 */
async function imageStats(page, bytes) {
  const mime = Buffer.from(bytes).readUInt32BE(0) === 0x89504e47 ? 'image/png' : 'image/jpeg';
  return page.evaluate(async (src) => {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = src; });
    const N = 64; const c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d');
    g.drawImage(im, 0, 0, N, N);
    const p = g.getImageData(0, 0, N, N).data; const hist = new Map(); let n = 0, s = 0, s2 = 0, sat = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 200) continue; n++;
      const y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; s += y; s2 += y * y;
      const mx = Math.max(p[i], p[i + 1], p[i + 2]); sat += mx ? (mx - Math.min(p[i], p[i + 1], p[i + 2])) / mx : 0;
      const k = ((p[i] >> 4) << 8) | ((p[i + 1] >> 4) << 4) | (p[i + 2] >> 4); hist.set(k, (hist.get(k) || 0) + 1);
    }
    if (!n) return { opaque: 0, lumStd: 0, top8: 1, colors: 0, sat: 0 };
    const top = [...hist.values()].sort((a, b) => b - a).slice(0, 8).reduce((a, b) => a + b, 0);
    const m = s / n;
    return { opaque: +(n / (N * N)).toFixed(2), lumStd: +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(1), top8: +(top / n).toFixed(2), colors: hist.size, sat: +(sat / n).toFixed(2) };
  }, `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`);
}

/**
 * Ауыстыруға болатын фото ма (imageStats бойынша)? Текстура (қағаз, бір түсті фон), жалпақ иллюстрация (карта, сызба),
 * мөлдір фонды әшекей (кітап, гүл суреті) — жоқ. Ақ-қара фотоның түсі аз болады, сондықтан түс саны тек түрлі-түстіге қаралады.
 */
function looksLikePhoto(st) {
  if (!st) return false;
  if (st.opaque < 0.88) return false;
  if (st.lumStd < 15) return false;
  if (st.sat > 0.08 && st.colors <= 35 && st.lumStd < 40) return false;
  return true;
}

/**
 * Жаңа фотоны түпнұсқа сурет орнына салу (Chromium canvas): өлшем сол, «cover» кесу басты нысан бойынша,
 * түпнұсқаның мөлдір пішіні (альфа) сақталады. page — ашық puppeteer беті.
 * @returns {Promise<Buffer|null>} PNG (альфасы бар болса) не JPEG
 */
async function composite(page, origBytes, origMedia, dataUri, focus) {
  const isPng = /\.png$/i.test(origMedia);
  const mime = isPng ? 'image/png' : 'image/jpeg';
  const orig = `data:${mime};base64,${Buffer.from(origBytes).toString('base64')}`;
  const keepAlpha = isPng && pngHasAlpha(origBytes);
  const out = await page.evaluate(async (o) => {
    const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = src; });
    const [a, b] = await Promise.all([load(o.orig), load(o.next)]);
    const k = Math.min(1, 1920 / Math.max(a.naturalWidth, a.naturalHeight));
    const W = Math.round(a.naturalWidth * k), H = Math.round(a.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const fm = /(\d{1,3})%\s+(\d{1,3})%/.exec(o.focus || ''); const fx = fm ? Math.min(100, +fm[1]) / 100 : 0.5; const fy = fm ? Math.min(100, +fm[2]) / 100 : 0.45;
    const s = Math.max(W / b.naturalWidth, H / b.naturalHeight); const dw = b.naturalWidth * s, dh = b.naturalHeight * s;
    const dx = Math.min(0, Math.max(W - dw, W / 2 - fx * dw)), dy = Math.min(0, Math.max(H - dh, H / 2 - fy * dh));
    g.drawImage(b, dx, dy, dw, dh);
    // түпнұсқа ақ-қара болса (минимал/сәулет стилі) — жаңа фото да ақ-қара, шаблон стилі бұзылмайды
    const sc = document.createElement('canvas'); sc.width = 48; sc.height = 48; const sg = sc.getContext('2d'); sg.drawImage(a, 0, 0, 48, 48);
    const px = sg.getImageData(0, 0, 48, 48).data; let sat = 0, cnt = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 128) continue; const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]); sat += mx ? (mx - mn) / mx : 0; cnt++; }
    if (cnt && sat / cnt < 0.08) {
      const d = g.getImageData(0, 0, W, H); const p = d.data;
      for (let i = 0; i < p.length; i += 4) { const y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = y; }
      g.putImageData(d, 0, 0);
    }
    if (o.keepAlpha) { g.globalCompositeOperation = 'destination-in'; g.drawImage(a, 0, 0, W, H); }
    return c.toDataURL(o.keepAlpha ? 'image/png' : 'image/jpeg', 0.86);
  }, { orig, next: dataUri, focus: focus || '', keepAlpha });
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(out || '');
  return m ? Buffer.from(m[2], 'base64') : null;
}

module.exports = { looksLikePhoto, imageStats, slideSize, photoSlots, replacePhotos, coverCrop, pngHasAlpha, imageSize, composite };
