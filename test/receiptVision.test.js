'use strict';
// Чекті көзбен оқу: DeepSeek vision жауабы → parseReceiptText пішіні → бұрынғы қатаң тексеру (желісіз, vision ауыстырылған).
const test = require('node:test');
const assert = require('node:assert');
const { readReceiptImage } = require('../core/receiptVision');
const { validateReceipt } = require('../core/receipt');

const img = { data: Buffer.from('x'), mime: 'image/png' };
const now = new Date('2026-10-24T01:40:00Z');          // Астана 06:40
const good = { is_kaspi_receipt: true, successful: true, amount: '1 000 ₸', receipt_no: '1234567890123', datetime: '24.10.2026 06:30', recipient: 'Мурзабек Н.', sender: 'Сериков А.', edited_signs: false, confidence: 0.95 };
const opts = { expectedName: 'Мурзабек Н', pricePerCredit: 500, firstPrice: 250, maxAgeMin: 60, now };

test('a clear receipt is read and passes the same strict checks as a text PDF', async () => {
  const p = await readReceiptImage(img, { vision: async () => good });
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.amount, 1000);
  assert.strictEqual(p.receiptNo, '1234567890123');
  assert.deepStrictEqual(validateReceipt(p, opts), { ok: true, credits: 2 });
});

test('the code decides, not the model: wrong recipient, old receipt, failed payment are rejected', async () => {
  const wrong = await readReceiptImage(img, { vision: async () => ({ ...good, recipient: 'Ахметов Б.' }) });
  assert.strictEqual(validateReceipt(wrong, opts).reason, 'wrong_recipient');
  const old = await readReceiptImage(img, { vision: async () => ({ ...good, datetime: '23.10.2026 06:30' }) });
  assert.strictEqual(validateReceipt(old, opts).reason, 'too_old');
  const failed = await readReceiptImage(img, { vision: async () => ({ ...good, successful: false }) });
  assert.strictEqual(validateReceipt(failed, opts).reason, 'not_successful');
});

test('unsure, edited, not a receipt or no answer never auto-confirms', async () => {
  for (const r of [{ ...good, confidence: 0.5 }, { ...good, edited_signs: true }, { ...good, is_kaspi_receipt: false }, { ...good, receipt_no: '12' }, { ...good, datetime: 'кеше' }]) {
    const p = await readReceiptImage(img, { vision: async () => r });
    assert.strictEqual(p.ok, false, JSON.stringify(r));
  }
  assert.strictEqual(await readReceiptImage(img, { vision: async () => null }), null);
  assert.strictEqual(await readReceiptImage(img, { vision: async () => { throw new Error('net'); } }), null);
});
