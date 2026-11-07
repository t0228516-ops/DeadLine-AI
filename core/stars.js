'use strict';
/**
 * TELEGRAM STARS (XTR) — халықаралық төлем (2026-11-06, «әлемдік» қадам).
 * Kaspi тек Қазақстанда жұмыс істейді; Stars кез келген елде, Telegram-ның өз ішінде (карта, Apple/Google Pay).
 * Әдепкіде ӨШІК: STARS_ENABLED=1 (Stars бағасы — иесінің шешімі; Telegram/дүкен үлесін ескеріп таңдалады).
 *
 * Ағын: «⭐ Stars» → пакет таңдау → sendInvoice (currency XTR, provider_token '') → pre_checkout_query (тексеру) →
 * successful_payment → applyReceipt(receipt_no = 'stars:<telegram_payment_charge_id>') — атомарлы, екі рет есептелмейді.
 */
const { PRICE, PACK, PLUS } = require('./pricing');

const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };
const enabled = () => process.env.STARS_ENABLED === '1';

/** Пакеттер (кредит пен ₸-баламасы pricing-тен; Stars бағасы env-тен) */
function offers() {
  return [
    { id: 'one', credits: 1, stars: int(process.env.STARS_PRICE_ONE, 30), kzt: PRICE, title: '1 презентация' },
    { id: 'pack', credits: PACK.credits, stars: int(process.env.STARS_PRICE_PACK, 120), kzt: PACK.amount, title: `${PACK.name} пакеті: ${PACK.credits} презентация` },
    { id: 'plus', credits: PLUS.credits, stars: int(process.env.STARS_PRICE_PLUS, 240), kzt: PLUS.amount, title: `Plus: ${PLUS.credits} презентация` },
  ];
}
const offerById = (id) => offers().find((o) => o.id === id) || null;

const payloadFor = (offer, chatId) => `dl:${offer.id}:${chatId}`;
function parsePayload(p) {
  const m = /^dl:(one|pack|plus):(-?\d+)$/.exec(String(p || ''));
  return m ? { id: m[1], chatId: m[2] } : null;
}

/** Шот (sendInvoice аргументтері) */
function invoiceFor(offer, chatId) {
  return {
    title: offer.title.slice(0, 32),
    description: `DeadLine: ${offer.credits} презентация кредиті — слайдтар, айтатын мәтін және топқа квиз.`,
    payload: payloadFor(offer, chatId),
    currency: 'XTR',
    prices: [{ label: offer.title.slice(0, 32), amount: offer.stars }],
  };
}

/** pre_checkout_query: шот осы адамдікі ме, сомасы бағаға сай ма — сай болмаса төлем басталмайды */
function checkPreCheckout(q) {
  if (!enabled()) return { ok: false, error: 'Stars арқылы төлем қазір өшік. Kaspi арқылы төлеңіз.' };
  const p = parsePayload(q && q.invoice_payload);
  const offer = p && offerById(p.id);
  if (!offer || !q || q.currency !== 'XTR' || Number(q.total_amount) !== offer.stars || String(q.from && q.from.id) !== p.chatId) {
    return { ok: false, error: 'Шот ескірген не сәйкес емес — «⭐ Stars» батырмасын қайта басыңыз.' };
  }
  return { ok: true, offer };
}

/**
 * successful_payment → кредит. Төлем жасалып қойған: pre-checkout бекіткен шот бойынша беріледі (баға env-те
 * кейін өзгерсе де — адам шоттағы соманы төледі). Белгісіз payload → null (админге хабар).
 */
function creditFor(sp) {
  const p = parsePayload(sp && sp.invoice_payload);
  const offer = p && offerById(p.id);
  if (!offer || !sp || sp.currency !== 'XTR' || !sp.telegram_payment_charge_id) return null;
  return { receiptNo: 'stars:' + sp.telegram_payment_charge_id, credits: offer.credits, kzt: offer.kzt, stars: Number(sp.total_amount) || 0, offer, priceChanged: Number(sp.total_amount) !== offer.stars };
}

module.exports = { enabled, offers, offerById, invoiceFor, parsePayload, checkPreCheckout, creditFor };
