'use strict';
// Кітапхана шаблонының фотоларын ауыстыру: PNG талдау (фото ↔ безендіру), ұяларды табу, сілтемені ауыстыру (желісіз).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { readZipAll } = require('../products/presentation/templateFill');
const { orderedSlides, relsMap, resolvePath } = require('../design-dna/structure');
const { pngStats } = require('../products/presentation/library/png');
const P = require('../products/presentation/library/photos');

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
/** px(x, y) → [r, g, b, a] ; ct 6 = RGBA, 2 = RGB */
function makePng(w, h, ct, px) {
  const ch = ct === 6 ? 4 : 3; const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * ch); row[0] = y % 2; // 0/1 сүзгілерін араластырамыз
    for (let x = 0; x < w; x++) {
      const v = px(x, y);
      for (let k = 0; k < ch; k++) {
        const left = x ? px(x - 1, y)[k] : 0;
        row[1 + x * ch + k] = row[0] === 1 ? (v[k] - left) & 255 : v[k];
      }
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = ct;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

test('png: photo-like RGBA (opaque, many tones) vs ornament (mostly transparent, few colours)', () => {
  const photo = makePng(40, 30, 6, (x, y) => [(x * 7 + y * 3) & 255, (x * 5) & 255, (y * 9) & 255, 255]);
  const st = pngStats(photo);
  assert.strictEqual(st.w, 40); assert.strictEqual(st.h, 30);
  assert.ok(st.transparent < 0.01 && st.colors >= 40, JSON.stringify(st));
  const ornament = makePng(40, 30, 6, (x, y) => ((x + y) % 5 === 0 ? [200, 30, 30, 255] : [0, 0, 0, 0]));
  const so = pngStats(ornament);
  assert.ok(so.transparent > 0.5 && so.colors < 10, JSON.stringify(so));
  assert.strictEqual(P.pngHasAlpha(photo), true);
  assert.strictEqual(P.pngHasAlpha(makePng(4, 4, 2, () => [1, 2, 3])), false);
  assert.deepStrictEqual(P.imageSize(photo), { w: 40, h: 30 });
});

test('coverCrop: keeps the box ratio and the focus point inside the frame', () => {
  const crop = P.coverCrop({ w: 2000, h: 1000 }, { w: 1, h: 1 }, '0% 50%');
  assert.match(crop, /l="0" t="0" r="50000" b="0"/);
  const mid = P.coverCrop({ w: 1000, h: 2000 }, { w: 1, h: 1 }, '');
  assert.match(mid, /l="0" t="20000" r="0" b="30000"/, "әдепкі фокус сәл жоғары (45%)");
});

test('photoSlots + replacePhotos: the slide points at the new photo, the old media is dropped, nothing dangles', () => {
  const buf = fs.readFileSync(path.join(__dirname, 'fixture-canva.pptx'));
  const slots = P.photoSlots(buf);
  assert.ok(slots.length >= 3, 'Canva фотолары (RGBA PNG) табылады');
  assert.ok(slots.every((s) => s.area >= 0.04));
  const s = slots[0];
  const bytes = makePng(32, 24, 2, (x, y) => [x * 8, y * 10, 128]);
  const out = P.replacePhotos(buf, [{ slide: s.slide, rid: s.rid, bytes }, { slide: 99, rid: 'rIdX', bytes }]);
  assert.strictEqual(out.replaced, 1, 'жоқ слайд өткізіледі');
  const files = readZipAll(out.buf);
  const sp = orderedSlides(files)[s.slide];
  const target = resolvePath(sp, relsMap(files.get(sp.replace(/([^/]+)$/, '_rels/$1.rels')))[s.rid].target);
  assert.ok(/dl_photo_/.test(target) && files.get(target).equals(bytes), target);
  for (const [name, rels] of files) {
    if (!name.endsWith('.rels') || name === '_rels/.rels') continue;
    const owner = name.replace(/_rels\/([^/]+)\.rels$/, '$1');
    for (const r of Object.values(relsMap(rels))) {
      if (!r.target || /^https?:|^mailto:/i.test(r.target) || r.type === 'hyperlink') continue;
      assert.ok(files.has(resolvePath(owner, r.target)), `${name} → ${r.target}`);
    }
  }
  assert.match(files.get('[Content_Types].xml'), /Extension="png"/i);
});
