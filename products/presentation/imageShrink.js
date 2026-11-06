'use strict';

/**
 * Тым үлкен фото (байты шектен асқан) бұрын лақтырылатын — көбіне ең сәйкес кандидат (fit=9–10) жоғалатын.
 * Енді оны Chrome-да кішірейтіп (ені ≤1920 px, фонға жарамды) JPEG-ке қайта сығамыз. Жаңа тәуелділік жоқ:
 * рендерердің өз puppeteer/Chrome-ы. Браузер бір рет ашылып, 30 с бос тұрса жабылады (бұл сирек жағдай).
 */

const IDLE_MS = 30_000;
// [ені, сапа] — кезекпен, шекке сыйғанша
const STEPS = [[1920, 0.86], [1920, 0.74], [1600, 0.72]];

let browserP = null;
let idleTimer = null;
let users = 0;

function getBrowser() {
  clearTimeout(idleTimer);
  if (!browserP) {
    browserP = require('./renderer').launchBrowser(require('puppeteer'));
    browserP.then((b) => b.on('disconnected', () => { browserP = null; })).catch(() => { browserP = null; });
  }
  return browserP;
}

function scheduleClose() {
  if (users > 0) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    const p = browserP;
    browserP = null;
    const b = p && (await p.catch(() => null));
    if (b) await b.close().catch(() => {});
  }, IDLE_MS);
  if (idleTimer.unref) idleTimer.unref();
}

/** Тесттер мен процесс соңы үшін: браузерді бірден жабу */
async function closeShrinker() {
  clearTimeout(idleTimer);
  const p = browserP;
  browserP = null;
  const b = p && (await p.catch(() => null));
  if (b) await b.close().catch(() => {});
}

/**
 * buf — суреттің байттары, type — 'image/jpeg' | 'image/png' | 'image/webp'.
 * Қайтарады { buf, type: 'image/jpeg', w, h, from: [w0, h0], quality } не null (сыймады / Chrome жоқ / сурет бұзық).
 */
async function shrinkImage(buf, type, maxBytes, { steps = STEPS } = {}) {
  users += 1;
  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    const out = await page.evaluate(async (b64, mime, tries, limit) => {
      const blob = await (await fetch(`data:${mime};base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob);
      for (const [maxW, q] of tries) {
        const s = Math.min(1, maxW / bmp.width);
        const w = Math.max(1, Math.round(bmp.width * s));
        const h = Math.max(1, Math.round(bmp.height * s));
        const c = new OffscreenCanvas(w, h);
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff'; // мөлдір PNG қара болып кетпесін
        g.fillRect(0, 0, w, h);
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(bmp, 0, 0, w, h);
        const ob = await c.convertToBlob({ type: 'image/jpeg', quality: q });
        if (ob.size <= limit) {
          const bytes = new Uint8Array(await ob.arrayBuffer());
          let bin = '';
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          return { b64: btoa(bin), w, h, from: [bmp.width, bmp.height], quality: q };
        }
      }
      return { failed: true, from: [bmp.width, bmp.height] };
    }, buf.toString('base64'), type, steps, maxBytes);
    if (!out || out.failed) return null;
    return { buf: Buffer.from(out.b64, 'base64'), type: 'image/jpeg', w: out.w, h: out.h, from: out.from, quality: out.quality };
  } catch (e) {
    console.warn(`[Image] shrink failed: ${String((e && e.message) || e).split('\n')[0].slice(0, 160)}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    users -= 1;
    scheduleClose();
  }
}

module.exports = { shrinkImage, closeShrinker };
