'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { countIn, setCount } = require('../products/presentation/countWords');

test('countWords: finds the one count in kk/ru/en headings and rewrites it, keeping case and grammar', () => {
  assert.strictEqual(countIn('ЖИ төрт саланы өзгертіп жатыр'), 4);
  assert.strictEqual(setCount('ЖИ төрт саланы өзгертіп жатыр', 3), 'ЖИ үш саланы өзгертіп жатыр');
  assert.strictEqual(setCount('ТӨРТ КЕЗЕҢ', 3), 'ҮШ КЕЗЕҢ');
  assert.strictEqual(setCount('Четыре этапа развития', 3), 'Три этапа развития');
  assert.strictEqual(setCount('Четыре этапа развития', 5), 'Четыре этапа развития', '«пять этапа» болмайды');
  assert.strictEqual(setCount('Из трех частей', 4), 'Из четырех частей');
  assert.strictEqual(setCount('Five key steps', 3), 'Three key steps');
  assert.strictEqual(setCount('3 негізгі себеп', 4), '4 негізгі себеп');
  assert.strictEqual(countIn('Екі-үш себеп'), null, 'екі сан — сенімсіз');
  assert.strictEqual(countIn('1991 жылғы тәуелсіздік'), null);
  assert.strictEqual(countIn('Работа с семью'), null, '«семью» — семья');
});
