'use strict';

// Тым үлкен фото лақтырылмай, кішірейтіліп сығылады (бұрын «image too large — skipped» болып, ең сәйкес кандидат жоғалатын)
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { PNG } = require('pngjs');
const { shrinkImage, closeShrinker } = require('../products/presentation/imageShrink');
const dl = require('../products/presentation/unsplash');

/** Градиент + әлсіз шу: PNG үлкен (шу сығылмайды), бірақ фото сияқты JPEG-ке жақсы сығылады */
function photoLikePng(w, h, seed = 7) {
  const png = new PNG({ width: w, height: h });
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      const n = (rnd() - 0.5) * 24;
      png.data[i] = Math.max(0, Math.min(255, (x / w) * 200 + 30 + n));
      png.data[i + 1] = Math.max(0, Math.min(255, (y / h) * 180 + 40 + n));
      png.data[i + 2] = Math.max(0, Math.min(255, 150 + Math.sin(x / 40) * 60 + n));
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

const jpegSize = (buf) => {
  // SOF0/SOF2 маркерінен ені мен биіктігі
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (m === 0xc0 || m === 0xc2) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
};

test.after(() => closeShrinker());

let chrome = null;
async function chromeOk(t) {
  if (chrome === null) {
    try { await (await require('../products/presentation/renderer').launchBrowser(require('puppeteer'))).close(); chrome = true; }
    catch (e) { chrome = 'Chromium жоқ: ' + e.message; }
  }
  if (chrome !== true) t.skip(chrome);
  return chrome === true;
}

test('shrinkImage: a wide photo becomes a ≤1920 px JPEG under the byte limit, aspect kept', async (t) => {
  if (!(await chromeOk(t))) return;
  const big = photoLikePng(3000, 2000);
  const out = await shrinkImage(big, 'image/png', 400_000);
  assert.ok(out, 'shrunk');
  assert.strictEqual(out.type, 'image/jpeg');
  assert.ok(out.buf.length <= 400_000, `${out.buf.length} bytes`);
  assert.deepStrictEqual(out.from, [3000, 2000]);
  assert.strictEqual(out.w, 1920);
  assert.strictEqual(out.h, 1280);
  assert.deepStrictEqual(jpegSize(out.buf), { w: 1920, h: 1280 });
});

test('shrinkImage: a photo already narrower than 1920 px keeps its size (only recompressed)', async (t) => {
  if (!(await chromeOk(t))) return;
  const out = await shrinkImage(photoLikePng(1600, 1000), 'image/png', 600_000);
  assert.ok(out);
  assert.strictEqual(out.w, 1600);
  assert.strictEqual(out.h, 1000);
});

test('shrinkImage: impossible limit or broken bytes → null, no throw', async (t) => {
  if (!(await chromeOk(t))) return;
  assert.strictEqual(await shrinkImage(photoLikePng(800, 500), 'image/png', 500), null);
  assert.strictEqual(await shrinkImage(Buffer.from('not an image at all'), 'image/jpeg', 1_000_000), null);
});

function serve(buf, type) {
  return new Promise((resolve) => {
    const srv = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length }); res.end(buf); });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/photo.png` }));
  });
}

test('downloadAsDataUri: a photo over 1.5 MB comes back shrunk instead of being skipped', async (t) => {
  if (!(await chromeOk(t))) return;
  const big = photoLikePng(2600, 1700);
  assert.ok(big.length > dl.MAX_IMAGE_BYTES, `fixture is ${big.length} bytes`);
  const { srv, url } = await serve(big, 'image/png');
  try {
    const uri = await dl.downloadAsDataUri(url);
    assert.ok(uri && uri.startsWith('data:image/jpeg;base64,'), String(uri).slice(0, 40));
    const bytes = Buffer.from(uri.split(',')[1], 'base64');
    assert.ok(bytes.length <= dl.MAX_IMAGE_BYTES);
    assert.deepStrictEqual(jpegSize(bytes), { w: 1920, h: 1255 });
  } finally { srv.close(); }
});

test('downloadAsDataUri: small photos are untouched; if shrinking fails the photo is skipped as before', async () => {
  const small = photoLikePng(300, 200);
  const { srv, url } = await serve(small, 'image/png');
  const orig = dl.shrinkImage;
  try {
    let called = 0;
    dl.shrinkImage = async () => { called += 1; return null; };
    const uri = await dl.downloadAsDataUri(url);
    assert.strictEqual(uri, `data:image/png;base64,${small.toString('base64')}`);
    assert.strictEqual(called, 0);
  } finally { srv.close(); dl.shrinkImage = orig; }

  const big = photoLikePng(2600, 1700);
  const s2 = await serve(big, 'image/png');
  try {
    dl.shrinkImage = async () => null;
    assert.strictEqual(await dl.downloadAsDataUri(s2.url), null);
  } finally { s2.srv.close(); dl.shrinkImage = orig; }
});

test('shrinkImage: a transient browser failure (page closed mid-way) is retried once with a fresh page', async (t) => {
  if (!(await chromeOk(t))) return;
  const seen = [];
  const out = await shrinkImage(photoLikePng(2400, 1500), 'image/png', 600_000, {
    _beforeShrink: async (page, attempt) => { seen.push(attempt); if (attempt === 1) await page.close(); },
  });
  assert.deepStrictEqual(seen, [1, 2]);
  assert.ok(out && out.w === 1920, 'shrunk on the second attempt');
  // бұзық сурет — қайталанбайды (уақытша ақау емес)
  const tries = [];
  const bad = await shrinkImage(Buffer.from('not an image at all'), 'image/png', 600_000, { _beforeShrink: async (p, a) => { tries.push(a); } });
  assert.strictEqual(bad, null);
  assert.deepStrictEqual(tries, [1]);
});
