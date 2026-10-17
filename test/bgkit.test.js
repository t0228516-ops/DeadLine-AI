'use strict';
const test = require('node:test');
const assert = require('node:assert');
const BG = require('../products/presentation/design/bgkit');
const T = require('../products/presentation/design/tokens');
const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');

test('bgkit: recipe comes from the system list; no paper on dark palettes; BG_RECIPE overrides', () => {
  const light = T.buildPalette('sand'); const dark = T.buildPalette('midnight');
  for (let seed = 0; seed < 40; seed++) {
    assert.ok(BG.BY_SYSTEM.heritage.includes(BG.pickRecipe('heritage', seed, light)));
    assert.notStrictEqual(BG.pickRecipe('ledger', seed, dark), 'paper');
  }
  const seen = new Set(Array.from({ length: 40 }, (_, s) => BG.pickRecipe('heritage', s, light)));
  assert.ok(seen.size >= 2, 'decks differ');
  process.env.BG_RECIPE = 'blobs';
  try { assert.strictEqual(BG.pickRecipe('swiss', 1, light), 'blobs'); } finally { delete process.env.BG_RECIPE; }
});

test('bgkit: every recipe draws under-shapes and edge pieces; strong colour stays in the margins', () => {
  const p = T.buildPalette('sand');
  for (const recipe of BG.RECIPES) {
    const o = BG.bgFor({ recipe, palette: p, index: 3, seed: 7, role: 'content' });
    assert.ok(o.under.length > 0 || o.over.length > 0, recipe);
    assert.ok(!/<text/.test(o.under + o.over), recipe + ': no text in the background (PPTX bg must stay text-free)');
  }
  const d = BG.bgFor({ recipe: 'diagonal', palette: p, index: 1, seed: 2, role: 'content' });
  assert.match(d.over, /clipPath/);
  assert.match(d.over, /height="92"/);
  const orn = BG.bgFor({ recipe: 'ornament', palette: p, index: 1, seed: 2, role: 'content' });
  assert.match(orn.over, /data:image\/svg\+xml;base64/);
  // consecutive slides are arranged differently
  const a = BG.bgFor({ recipe: 'field', palette: p, index: 1, seed: 2, role: 'content' });
  const b = BG.bgFor({ recipe: 'field', palette: p, index: 2, seed: 2, role: 'content' });
  assert.notStrictEqual(a.under, b.under);
});

test('bgkit in the builder: layer right above the plate, edge pieces last, off with BG_KIT=0', () => {
  const deck = [
    { title: 'Қазақ хандығы', subtitle: 'Керей мен Жәнібек', bullets: ['Орындаған: A'], composition: { design: 'heritage', mood: 'sand', layoutSeed: 11 } },
    { title: 'Билік', bullets: ['Хан — ең жоғары билеуші, кеңеспен шешті', 'Би — дауды әділ шешті', 'Батыр — әскерді басқарды'], composition: { design: 'heritage', mood: 'sand' } },
  ];
  process.env.BG_RECIPE = 'ornament';
  let html;
  try { html = build3DPresentationHTML(deck, 'T', { system: 'heritage' }); } finally { delete process.env.BG_RECIPE; }
  const art = html.split('<article').slice(1)[1];
  assert.match(art, /class="slide[^"]*bgk-on/);
  const bg = art.slice(art.indexOf('layer-bg'), art.indexOf('layer-mid'));
  assert.ok(bg.indexOf('class="plate') < bg.indexOf('class="bgk'), 'above the plate');
  assert.ok(bg.lastIndexOf('bgk-edge') > bg.indexOf('class="bgk '), 'edge pieces after the under-layer');
  assert.ok(!/class="deco deco-/.test(bg), 'old glow decoration is not stacked on top');
  process.env.BG_KIT = '0';
  try { assert.ok(!/class="bgk/.test(build3DPresentationHTML(deck, 'T', { system: 'heritage' }))); } finally { delete process.env.BG_KIT; }
});
