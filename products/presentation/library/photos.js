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

/** Бір слайдтағы фото блоктары: <p:pic> және Canva-ның суретпен толтырылған пішіні (<p:sp> + blipFill): rId, орын/өлшем (EMU) */
function picsOf(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<p:pic>[\s\S]*?<\/p:pic>|<p:sp>[\s\S]*?<\/p:sp>/g)) {
    const block = m[0];
    if (block.startsWith('<p:sp>') && !/<p:spPr>(?:(?!<\/p:spPr>)[\s\S])*<a:blipFill/.test(block)) continue;
    const rid = (block.match(/<a:blip [^>]*r:embed="([^"]+)"/) || [])[1];
    const x = block.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (!rid || !x || /<a:tile\b/.test(block)) continue;
    // дөңгелек пішін (ellipse не тек қисықтардан тұратын custGeom) — аватарға тән
    const round = /<a:prstGeom prst="ellipse"/.test(block)
      || (/<a:custGeom>/.test(block) && (block.match(/<a:cubicBezTo>/g) || []).length >= 4 && !/<a:lnTo>/.test(block));
    out.push({ rid, x: +x[1], y: +x[2], w: +x[3], h: +x[4], ...(round ? { round: true } : {}) });
  }
  return out;
}

/**
 * @param {Buffer} buf
 * @returns {Array<{slide:number, rid:string, w:number, h:number, area:number}>} slide — 0-негізді
 */
/** Мәтіні бар пішіндердің орны (EMU) — суреттің үстінде мәтін тұр ма, соны білу үшін */
function textBoxesOf(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<p:sp>(?:(?!<p:sp>)[\s\S])*?<\/p:sp>/g)) {
    if (!/<a:t>[^<]*\S[^<]*<\/a:t>/.test(m[0])) continue;
    const x = m[0].match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (x) out.push({ x: +x[1], y: +x[2], w: +x[3], h: +x[4] });
  }
  return out;
}

/** Мәтін қорабының кемінде жартысы сурет ішінде ме (сурет — мәтіннің фоны) */
function underText(p, boxes) {
  return boxes.some((b) => {
    const iw = Math.min(p.x + p.w, b.x + b.w) - Math.max(p.x, b.x);
    const ih = Math.min(p.y + p.h, b.y + b.h) - Math.max(p.y, b.y);
    return iw > 0 && ih > 0 && (iw * ih) / Math.max(1, b.w * b.h) >= 0.5;
  });
}

function photoSlots(buf, o = {}) {
  const minArea = o.minArea != null ? o.minArea : MIN_AREA;
  const files = readZipAll(buf);
  const { W, H } = slideSize(files);
  const out = [];
  orderedSlides(files).forEach((sp, i) => {
    const rels = relsMap(files.get(relsPathOf(sp)));
    const seen = new Set();
    // масштабталған топтың ішіндегі сурет — нақты өлшемімен (әйтпесе кішкене аватар «үлкен фото» болып көрінеді)
    const geo = require('./carve').normalizeGroups(String(files.get(sp)));
    const boxes = textBoxesOf(geo);
    for (const p of picsOf(geo)) {
      const r = rels[p.rid];
      if (!r || seen.has(p.rid)) continue;
      const media = resolvePath(sp, r.target);
      const data = files.get(media);
      const area = (p.w * p.h) / (W * H);
      if (area < minArea || !isPhotoBytes(media, data)) continue;
      seen.add(p.rid);
      out.push({ slide: i, rid: p.rid, w: p.w, h: p.h, area: +area.toFixed(3), media, alpha: /\.png$/i.test(media) && pngHasAlpha(data), underText: underText(p, boxes), round: !!p.round });
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
 * Шаблонның бөтен адамдары: кішкене (слайдтың < 2,5%-ы), дөңгелек фото-аватарлар (команда, пікір, «кім айтты»).
 * Шаршы кішкене фото (уақыт сызығының суреттері) — мазмұн, алынбайды.
 * Тақырыпқа сай кішкене фото табу қиын әрі қымбат — олар слайдтан алынады (иконка, әшекей, логотип — фото емес, қалады).
 * @returns {Array<{slide:number, rid:string, media:string}>} — removeTiny-ге (looksLikePhoto тексерісінен кейін)
 */
function tinyPortraits(buf) {
  return photoSlots(buf, { minArea: 0.002 })
    .filter((s) => s.area < 0.025 && s.round && Math.abs(s.w - s.h) <= Math.max(s.w, s.h) * 0.15);
}

/** Берілген (слайд, rId) суреттерін слайдтан алу; енді ешкімге керек емес медиа өшеді */
function removePictures(buf, list) {
  if (!list.length) return buf;
  const files = readZipAll(buf);
  const slides = orderedSlides(files);
  const BLOCK = /<p:pic>(?:(?!<p:pic>)[\s\S])*?<\/p:pic>|<p:sp>(?:(?!<p:sp>)[\s\S])*?<\/p:sp>/g;
  const rectOf = (b) => { const m = b.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/); return m ? { x: +m[1], y: +m[2], w: +m[3], h: +m[4] } : null; };
  for (const it of list) {
    const sp = slides[it.slide];
    if (!sp) continue;
    const re = new RegExp(`r:embed="${it.rid}"`);
    const gone = [];
    let xml = String(files.get(sp)).replace(BLOCK, (b) => {
      if (!(re.test(b) && (b.startsWith('<p:pic>') || /<p:spPr>(?:(?!<\/p:spPr>)[\s\S])*<a:blipFill/.test(b)) && !/<a:t>[^<]*[^\s<]/.test(b))) return b;
      const r = rectOf(b); if (r) gone.push(r);
      return '';
    });
    // аватардың жиегі (сақина, ақ дөңгелек): мәтінсіз, суретсіз, ортасы бір, өлшемі аватардан сәл ғана үлкен — бос шеңбер болып қалмасын
    xml = xml.replace(BLOCK, (b) => {
      if (/<a:t>[^<]*[^\s<]/.test(b) || /<a:blipFill/.test(b)) return b;
      const r = rectOf(b);
      if (!r) return b;
      return gone.some((g) => Math.abs((r.x + r.w / 2) - (g.x + g.w / 2)) < g.w * 0.15 && Math.abs((r.y + r.h / 2) - (g.y + g.h / 2)) < g.h * 0.15
        && r.w >= g.w * 0.9 && r.w <= g.w * 1.5 && r.h <= g.h * 1.5) ? '' : b;
    });
    files.set(sp, xml);
  }
  require('./carve').collectGarbage(files);
  return writeZipAll(files);
}

/**
 * Файл Telegram шегіне (50 МБ) жақындамасын: үлкен суреттер ≤ maxPx-ке кішірейеді, мөлдір емес PNG — JPEG болады
 * (жаңа атпен; сілтемелер мен мазмұн түрлері жаңарады), мөлдір PNG — PNG күйінде тек кішірейеді. Слайдтағы орны мен кесуі өзгермейді.
 * @param {Buffer} buf
 * @param {object} page Chromium беті
 * @param {{minBytes?:number, maxPx?:number, quality?:number}} [o] minBytes — осыдан кіші суретке тимейміз
 * @returns {Promise<Buffer>}
 */
async function shrinkImages(buf, page, o = {}) {
  const minBytes = o.minBytes || 700 * 1024; const maxPx = o.maxPx || 1920; const quality = o.quality || 0.85;
  const files = readZipAll(buf);
  let ct = files.get('[Content_Types].xml') || '';
  const renamed = new Map();
  for (const [name, data] of [...files]) {
    if (!/^ppt\/media\/[^/]+\.(png|jpe?g)$/i.test(name) || data.length < minBytes) continue;
    const png = Buffer.from(data).readUInt32BE(0) === 0x89504e47;
    // альфа арнасы бар PNG көбіне іс жүзінде мөлдір емес (Canva): пикселдер тексеріледі — шын мөлдір болса ғана PNG қалады
    const res = await page.evaluate(async (src, mayAlpha, maxPx, q) => {
      const img = new Image(); img.src = src; await img.decode();
      const k = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, c.width, c.height);
      let alpha = false;
      if (mayAlpha) { const d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { alpha = true; break; } }
      if (alpha) return { png: true, b64: c.toDataURL('image/png').split(',')[1] };
      const c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height;
      const g2 = c2.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, c2.width, c2.height); g2.drawImage(c, 0, 0);
      return { png: false, b64: c2.toDataURL('image/jpeg', q).split(',')[1] };
    }, `data:${png ? 'image/png' : 'image/jpeg'};base64,${Buffer.from(data).toString('base64')}`, png && pngHasAlpha(data), maxPx, quality).catch(() => null);
    if (!res) continue;
    const keepPng = res.png; const b64 = res.b64;
    const out = Buffer.from(b64, 'base64');
    if (out.length >= data.length * 0.9) continue;                          // ұтыс аз — түпнұсқа қалады
    if (png && !keepPng) {
      const jn = name.replace(/\.png$/i, '_s.jpeg');
      files.delete(name); files.set(jn, out); renamed.set(name.split('/').pop(), jn.split('/').pop());
    } else files.set(name, out);
  }
  if (renamed.size) {
    for (const [n, d] of [...files]) {
      if (!n.endsWith('.rels')) continue;
      const x = String(d).replace(/Target="([^"]*\/)?([^"/]+)"/g, (m, dir, f) => (renamed.has(f) ? `Target="${dir || ''}${renamed.get(f)}"` : m));
      if (x !== String(d)) files.set(n, x);
    }
    if (!/Extension="jpeg"/i.test(ct)) ct = ct.replace(/(<Types[^>]*>)/, '$1<Default Extension="jpeg" ContentType="image/jpeg"/>');
    files.set('[Content_Types].xml', ct);
  }
  return writeZipAll(files);
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
  // пішінге кесілген фото (Canva: алтыбұрыш, қиғаш шетті фото — пішіні мөлдір PNG-де): мөлдір бұрыштары бар, бірақ түсі өте көп әрі біркелкі таралған.
  // Жаңа фото сол пішінге кесіледі (composite альфаны сақтайды)
  if (st.opaque >= 0.7 && st.opaque < 0.88) return st.colors >= 200 && st.top8 <= 0.45 && st.lumStd >= 25;
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

const hashOf = (bytes) => require('crypto').createHash('sha1').update(bytes).digest('hex');

/**
 * Тақырыпқа жат шаблон фотосын түстік фонға айналдыру: фотоның өз түстерінен (үсті мен асты) жұмсақ градиент,
 * пішіні (альфа) мен өлшемі сол — макет бұзылмайды, ал жарықтығы сақталғандықтан үстіндегі мәтін бұрынғыдай оқылады.
 * hashes — ауыстырылмай қалған фотолардың байт хэштері (swapLibraryPhotos жинайды); сол байттағы әр медиа файл орнында ауысады.
 */
async function neutralizeMedia(buf, hashes, o = {}) {
  hashes = new Set(hashes || []);
  let extra = [];
  if (o.lastSlide) { const all = photoSlots(buf); const last = Math.max(-1, ...all.map((p) => p.slide)); extra = all.filter((p) => p.slide === last && last === orderedSlides(readZipAll(buf)).length - 1); }
  if (!hashes.size && !extra.length) return buf;
  const files = readZipAll(buf);
  let browser = null;
  try {
    let page = o.page;
    if (!page) { browser = await require('../renderer').launchBrowser(require('puppeteer')); page = await browser.newPage(); }
    // Credits слайды (жабу/мұқаба негізінде) өз фотосымен келеді — ол да тексеріледі
    for (const p of extra) if (looksLikePhoto(await imageStats(page, files.get(p.media)).catch(() => null))) hashes.add(hashOf(files.get(p.media)));
    const targets = [...files.keys()].filter((n) => /^ppt\/media\/[^/]+\.(png|jpe?g)$/i.test(n) && hashes.has(hashOf(files.get(n))));
    if (!targets.length) return buf;
    // түс — шаблонның өз негізгі реңі (сұр-қоңыр дақ емес, әдейі жасалған түсті пішін болып көрінсін); жарықтығы фотоның өзінікі
    const hue = o.hue != null ? o.hue : (require('./variants').dominantHue(buf) ?? 220);
    // осы презентацияда табылған тақырыптық фотолар: бос түсті қорап емес, солардың бірі шаблон реңіне боялып қойылады (duotone)
    const pool = (o.photos || []).filter((x) => typeof x === 'string' && /^data:image\//.test(x));
    // фото тек фон емес орынға (қорап, карточка) және әрқайсысы бір-ақ рет: үлкен фондағы не қайта-қайта қойылған
    // бір фото (портрет) бүкіл презентацияны толтырып жібереді — оларға бұрынғыдай шаблон реңінің түсі
    const areaOf = new Map();
    try { for (const sl of photoSlots(buf)) areaOf.set(sl.media, Math.max(areaOf.get(sl.media) || 0, sl.area || 0)); } catch {}
    let k = 0;
    for (const name of targets) {
      const png = /\.png$/i.test(name);
      const mime = png ? 'image/png' : 'image/jpeg';
      const out = await page.evaluate(async (src, type, hue, photo) => {
        const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = src; });
        const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
        const W = Math.max(1, Math.round(im.naturalWidth * k)), H = Math.max(1, Math.round(im.naturalHeight * k));
        const sc = document.createElement('canvas'); sc.width = 24; sc.height = 24; const sg = sc.getContext('2d'); sg.drawImage(im, 0, 0, 24, 24);
        const px = sg.getImageData(0, 0, 24, 24).data;
        let sum = 0, n = 0;
        for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 128) continue; sum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255; n++; }
        const L = Math.round((n ? sum / n : 0.5) * 100);
        const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
        const gr = g.createLinearGradient(0, 0, W * 0.35, H);
        const hsl = (l, sat) => `hsl(${hue}, ${sat}%, ${Math.max(16, Math.min(84, l))}%)`;
        gr.addColorStop(0, hsl(L + 12, 55)); gr.addColorStop(1, hsl(L - 10, 62));
        if (photo) {
          // фото — қорапты толтыратын кесу; сұр түске → шаблон реңі (жарықтығы сақталады) → түпнұсқа жарықтығына жақындатылады (мәтін оқылуы)
          const ph = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = photo; });
          const s = Math.max(W / ph.naturalWidth, H / ph.naturalHeight);
          g.filter = 'grayscale(1) contrast(0.9)';
          g.drawImage(ph, (W - ph.naturalWidth * s) / 2, (H - ph.naturalHeight * s) / 2, ph.naturalWidth * s, ph.naturalHeight * s);
          g.filter = 'none';
          g.globalCompositeOperation = 'color'; g.fillStyle = gr; g.fillRect(0, 0, W, H);
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.6; g.fillStyle = hsl(L, 50); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
        } else { g.fillStyle = gr; g.fillRect(0, 0, W, H); }
        if (type === 'image/png') { g.globalCompositeOperation = 'destination-in'; g.drawImage(im, 0, 0, W, H); }
        return c.toDataURL(type, 0.9);
      }, `data:${mime};base64,${Buffer.from(files.get(name)).toString('base64')}`, mime, hue, k < pool.length && (areaOf.get(name) || 0) < 0.5 ? pool[k++] : null);
      const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(out || '');
      if (m) files.set(name, Buffer.from(m[2], 'base64'));
    }
    console.log(`[Library] photos: ${targets.length} off-topic template photo(s) toned (${k} on-topic duotone, ${targets.length - k} plain colour)`);
    return writeZipAll(files);
  } finally { if (browser) await browser.close().catch(() => {}); }
}

module.exports = { hashOf, neutralizeMedia, picsOf, underText, shrinkImages, tinyPortraits, removePictures, looksLikePhoto, imageStats, slideSize, photoSlots, replacePhotos, coverCrop, pngHasAlpha, imageSize, composite };
