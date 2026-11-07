'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validateReceipt } = require('../core/receipt');
const { PLUS, PRICE, FIRST_PRICE } = require('../core/pricing');

const base = (amount) => ({ ok: true, successful: true, recipient: 'Мурзабек Н', date: new Date(), amount, receiptNo: '1' });
const opts = { expectedName: 'Мурзабек Н', pricePerCredit: PRICE, firstPrice: FIRST_PRICE, bundles: [PLUS] };

test('Plus: 1990₸ = 50 credits', () => {
  assert.strictEqual(PLUS.amount, 1990);
  assert.strictEqual(PLUS.credits, 50);
  const v = validateReceipt(base(1990), opts);
  assert.ok(v.ok);
  assert.strictEqual(v.credits, 50);
});
test('ordinary prices still work, odd amounts rejected', () => {
  assert.strictEqual(validateReceipt(base(750), opts).credits, 3);
  assert.strictEqual(validateReceipt(base(1991), opts).ok, false);
  assert.strictEqual(validateReceipt(base(1990), { ...opts, bundles: [] }).ok, false);
});

// Сессия пакеті (2026-11-06): 990₸ = 5 кредит; 250-ге бөлінбейді — жай сатып алумен шатаспайды
test('Session pack: 990₸ = 5 credits, both bundles recognised, manual confirm amount', () => {
  const { PACK, BUNDLES, paidFor } = require('../core/pricing');
  assert.strictEqual(PACK.amount, 990);
  assert.strictEqual(PACK.credits, 5);
  assert.notStrictEqual(PACK.amount % PRICE, 0, '990 is not a multiple of the single price');
  const o = { ...opts, bundles: BUNDLES };
  assert.deepStrictEqual([validateReceipt(base(990), o).credits, validateReceipt(base(1990), o).credits, validateReceipt(base(500), o).credits], [5, 50, 2]);
  assert.strictEqual(validateReceipt(base(989), o).ok, false);
  // қолмен растау: сома кредит санынан
  assert.strictEqual(paidFor(5, false), 990);
  assert.strictEqual(paidFor(50, false), 1990);
  assert.strictEqual(paidFor(1, true), FIRST_PRICE);
  assert.strictEqual(paidFor(3, false), 3 * PRICE);
});
