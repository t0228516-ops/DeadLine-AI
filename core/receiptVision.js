'use strict';
/**
 * Kaspi чегін КӨЗБЕН оқу (DeepSeek vision): мәтін қабаты жоқ PDF (ішінде сурет) немесе скриншот/фото.
 *
 *   pdfToPng(buffer)          — PDF-тің 1-бетін Chromium + pdf.js арқылы PNG-ге айналдыру
 *   readReceiptImage(img)     — DeepSeek vision → { ok, receiptNo, amount, date, recipient, successful, ... }
 *                               (parseReceiptText-пен бірдей пішін — сондықтан validateReceipt сол күйі қолданылады)
 *
 *   reviewSeen(seen, opts)    — оқылғанды тексеру тізімі (уақыт, алушы, «сәтті», сома, өңдеу белгісі) → админге
 *
 * Сурет ЕШҚАШАН автоматты расталмайды: сынақта қолдан салынған жалған «чектерді» модель нағыз деп оқыды
 * (сенім 90–95%). Сондықтан көзбен оқу тек админге көмек — шешімді әрқашан адам қабылдайды.
 */
const fs = require('fs');
const path = require('path');
const { validateReceipt, _internals: { parseAstanaDate, normName } } = require('./receipt');

const PDFJS_DIR = path.join(path.dirname(require.resolve('pdf-parse/package.json')), 'lib', 'pdf.js', 'v2.0.550', 'build');

/** PDF-тің бірінші бетін PNG-ге (ені ~1400px). Қате болса — null. */
async function pdfToPng(buffer, o = {}) {
  let browser = null;
  try {
    const lib = fs.readFileSync(path.join(PDFJS_DIR, 'pdf.js'), 'utf8');
    const worker = fs.readFileSync(path.join(PDFJS_DIR, 'pdf.worker.js'), 'utf8');
    browser = o.browser || await require('../products/presentation/renderer').launchBrowser(require('puppeteer'));
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: lib });
    const dataUrl = await page.evaluate(async (b64, workerSrc, width) => {
      /* global pdfjsLib */
      const lib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
      lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([workerSrc], { type: 'application/javascript' }));
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const doc = await lib.getDocument({ data: bytes }).promise;
      const pg = await doc.getPage(1);
      const v1 = pg.getViewport(1);
      const vp = pg.getViewport(Math.min(4, width / v1.width));
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: g, viewport: vp }).promise;
      return c.toDataURL('image/png');
    }, Buffer.from(buffer).toString('base64'), worker, o.width || 1400);
    await page.close().catch(() => {});
    const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl || '');
    return m ? Buffer.from(m[1], 'base64') : null;
  } catch (e) {
    console.warn(`[ReceiptVision] PDF render failed: ${e.message}`);
    return null;
  } finally {
    if (browser && !o.browser) await browser.close().catch(() => {});
  }
}

const PROMPT = `This image should be a Kaspi.kz payment receipt (чек / квитанция) from Kazakhstan.
Read it exactly as printed. Do not guess: if a field is not clearly visible, use null.
Return JSON only:
{"is_kaspi_receipt": true|false,
 "successful": true|false,            // the receipt says the payment was successful ("Успешно совершен", "Сәтті", "Successful")
 "amount": number|null,               // the transfer amount in tenge (₸), digits only, without commission
 "receipt_no": "digits"|null,         // № квитанции / чек number, digits only
 "datetime": "DD.MM.YYYY HH:MM"|null, // date and time printed on the receipt
 "recipient": "Фамилия И."|null,      // the RECIPIENT name as printed (not the sender)
 "sender": "..."|null,
 "edited_signs": true|false,          // visible signs of editing: mismatched fonts, misaligned digits, pasted areas
 "confidence": 0.0-1.0}               // how sure you are that every field above is read correctly`;

/**
 * @param {{data:Buffer, mime:string}} img
 * @param {{vision?:Function}} o  тест үшін vision ауыстыруға болады
 * @returns {Promise<object|null>} parseReceiptText пішіні + { source:'vision', edited, confidence }; оқылмаса null
 */
async function readReceiptImage(img, o = {}) {
  const vision = o.vision || require('./llm').deepseekVisionJson;
  let r = null;
  try {
    r = await vision([{ text: PROMPT }, { image: { mime: img.mime, data: Buffer.from(img.data).toString('base64') } }],
      { label: 'receipt-vision', detail: 'high', maxTokens: 600, timeoutMs: 45_000 });
  } catch (e) { console.warn(`[ReceiptVision] ${e.message}`); return null; }
  if (!r || typeof r !== 'object') return null;
  const digits = (v) => (v == null ? null : String(v).replace(/\D/g, '') || null);
  const amount = r.amount == null ? null : Number(String(r.amount).replace(/[^\d.,]/g, '').replace(',', '.'));
  const dateRaw = typeof r.datetime === 'string' && /^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/.test(r.datetime.trim()) ? r.datetime.trim() : null;
  const out = {
    ok: false,
    source: 'vision',
    receiptNo: digits(r.receipt_no),
    amount: Number.isFinite(amount) ? amount : null,
    dateRaw,
    date: dateRaw ? parseAstanaDate(dateRaw) : null,
    recipient: typeof r.recipient === 'string' ? r.recipient.trim() : null,
    sender: typeof r.sender === 'string' ? r.sender.trim() : null,
    successful: r.successful === true,
    isReceipt: r.is_kaspi_receipt === true,
    edited: r.edited_signs === true,
    confidence: Number(r.confidence) || 0,
  };
  out.ok = !!(out.isReceipt && !out.edited && out.confidence >= 0.8
    && out.receiptNo && out.receiptNo.length >= 9 && out.amount !== null && out.date);
  return out;
}

/**
 * Көзбен оқылған чекті ботпен бірдей ережемен тексеріп, әр тармақты бөлек көрсету (админ бір қарап шешсін).
 * @returns {{ok:boolean|null, text:string}[]}  ok:null — оқылмады, анықтау мүмкін емес
 */
function reviewSeen(seen, o = {}) {
  const now = o.now || new Date();
  const maxAgeMin = o.maxAgeMin || 60;
  const out = [];
  if (seen.date) {
    const age = Math.round((now.getTime() - seen.date.getTime()) / 60000);
    out.push(age < -2 ? { ok: false, text: `Уақыты болашақта (${seen.dateRaw})` }
      : age > maxAgeMin ? { ok: false, text: `Уақыты ${age} мин бұрын — ${maxAgeMin} минуттан ескі (${seen.dateRaw})` }
        : { ok: true, text: `Уақыты ${Math.max(0, age)} мин бұрын (${seen.dateRaw})` });
  } else out.push({ ok: null, text: 'Уақыты оқылмады' });
  if (!seen.recipient) out.push({ ok: null, text: 'Алушы оқылмады' });
  else out.push({ ok: !o.expectedName || normName(seen.recipient) === normName(o.expectedName), text: `Алушы: ${seen.recipient}` });
  out.push(seen.successful ? { ok: true, text: '«Сәтті» деп тұр' } : { ok: false, text: '«Сәтті» белгісі көрінбейді' });
  if (seen.amount == null) out.push({ ok: null, text: 'Сома оқылмады' });
  else {
    // сома → кредит: validateReceipt-тің баға ережесі (басқа тармақтарды әдейі өткіземіз)
    const v = validateReceipt({ ok: true, successful: true, recipient: null, date: now, amount: seen.amount },
      { now, pricePerCredit: o.pricePerCredit, firstPrice: o.firstPrice, isFirstPurchase: o.isFirstPurchase, bundles: o.bundles || [] });
    out.push(v.ok ? { ok: true, text: `Сома ${seen.amount}₸ → ${v.credits} кредит` } : { ok: false, text: `Сома ${seen.amount}₸ бағаға сай емес` });
  }
  if (seen.edited) out.push({ ok: false, text: 'Өңдеу белгілері байқалады' });
  if (!seen.isReceipt) out.push({ ok: false, text: 'Kaspi чегіне ұқсамайды' });
  return out;
}

module.exports = { pdfToPng, readReceiptImage, reviewSeen, PROMPT };
