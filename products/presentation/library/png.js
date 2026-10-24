'use strict';
/** Минимал PNG оқушы (8-бит RGB/RGBA/сұр): мөлдірлік үлесі мен түс әртүрлілігі — фото мен безендіруді ажырату үшін */
const zlib = require('zlib');

function decodePng(buf) {
  if (!Buffer.isBuffer(buf) || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let p = 8; let w = 0, h = 0, depth = 0, ct = 0, interlace = 0; const idat = [];
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('latin1', p + 4, p + 8); const d = p + 8;
    if (type === 'IHDR') { w = buf.readUInt32BE(d); h = buf.readUInt32BE(d + 4); depth = buf[d + 8]; ct = buf[d + 9]; interlace = buf[d + 12]; }
    else if (type === 'IDAT') idat.push(buf.subarray(d, d + len));
    else if (type === 'IEND') break;
    p = d + len + 4;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  if (!w || !h || depth !== 8 || !ch || interlace) return null;
  let raw; try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch { return null; }
  const stride = w * ch; const out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const src = y * (stride + 1) + 1; const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[dst + x - ch] : 0; const b = y ? out[dst - stride + x] : 0; const c = x >= ch && y ? out[dst - stride + x - ch] : 0;
      const v = raw[src + x];
      let r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b; else if (f === 3) r = v + ((a + b) >> 1);
      else { const pp = a + b - c; const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[dst + x] = r & 255;
    }
  }
  return { w, h, ch, data: out };
}

/** { transparent: 0..1, colors: түс саны (64-деңгейлі квант, іріктеме) } */
function pngStats(buf) {
  const img = decodePng(buf);
  if (!img) return null;
  const { w, h, ch, data } = img;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 20000)));
  let n = 0, clear = 0; const colors = new Set();
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * ch; n++;
    const alpha = ch === 4 ? data[i + 3] : ch === 2 ? data[i + 1] : 255;
    if (alpha < 200) { clear++; continue; }
    const r = data[i], g = ch >= 3 ? data[i + 1] : r, b = ch >= 3 ? data[i + 2] : r;
    colors.add(((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2));
  }
  return { w, h, transparent: n ? clear / n : 0, colors: colors.size };
}

module.exports = { decodePng, pngStats };
