'use strict';
const test = require('node:test');
const assert = require('node:assert');
const V = require('../products/presentation/visual');

const BOXES = '<svg viewBox="0 0 1100 740"><rect x="100" y="100" width="200" height="120" rx="16" fill="#eee"/><text x="200" y="170" text-anchor="middle" font-size="24">Шаңырақ</text></svg>';
const YURT = '<svg viewBox="0 0 1100 740"><ellipse cx="550" cy="660" rx="380" ry="30" fill="#000" fill-opacity="0.1"/>' +
  '<path d="M200 620 L200 420 L900 420 L900 620 Z" fill="#c9a24a"/><path d="M180 420 C 300 220, 800 220, 920 420 Z" fill="#e8d9b5"/>' +
  '<circle cx="550" cy="250" r="40" fill="#9a4a1f"/><text x="980" y="250" font-size="24">Шаңырақ</text></svg>';

function reply(content, status = 200) {
  const body = status === 200 ? { choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 3000, completion_tokens: 9000 } } : null;
  return {
    ok: status === 200, status,
    json: async () => body,
    text: async () => (status === 200 ? JSON.stringify(body) : content),
    headers: { get: () => null },
  };
}
const deck = () => [
  { title: 'Қазақ киіз үйі' },
  { title: 'Киіз үйдің құрылысы', bullets: ['Шаңырақ — күмбездің төбесі', 'Кереге — ағаш тор қабырға'],
    visual: { type: 'illustration', brief: 'Kazakh yurt: dome of roof poles (uyk), lattice wall (kerege), door, shanyrak on top', data: ['Шаңырақ', 'Уық', 'Кереге'] },
    composition: { mood: 'sand' } },
];
const env = { DEEPSEEK_API_KEY: 'test' };

test('visual config: Pro model with thinking, Flash as fallback; an empty fallback means none', () => {
  const c = V.getConfig(env);
  assert.strictEqual(c.primary.model, 'deepseek-v4-pro');
  assert.strictEqual(c.primary.sendThinkingDisabled, false);
  assert.strictEqual(c.fallback.model, 'deepseek-flash');
  assert.strictEqual(c.fallback.sendThinkingDisabled, true);
  assert.ok(V.allowedSlots(c) >= 1);
  assert.strictEqual(V.getConfig({ ...env, VISUAL_FALLBACK: '' }).fallback, null);
  assert.strictEqual(V.getConfig({ ...env, VISUAL_DEEPSEEK_MODEL: 'deepseek-flash' }).primary.model, 'deepseek-flash');
});

test('visual spec: an illustration needs only a brief; a diagram still needs data', () => {
  assert.deepStrictEqual(V.normalizeVisualSpec({ type: 'illustration', brief: 'A dombra with two strings and frets', data: [] }).data, []);
  assert.strictEqual(V.normalizeVisualSpec({ type: 'illustration', brief: 'x' }), null);
  assert.strictEqual(V.normalizeVisualSpec({ type: 'diagram', brief: 'a → b', data: ['one'] }), null);
});

test('visual prompt: draw the real object, no frame/card; reviewer issues are passed back on retry', () => {
  const sys = V.systemFor('illustration');
  assert.match(sys, /REAL OBJECT/);
  assert.match(sys, /NEVER draw a background rectangle, an outer frame/);
  assert.match(sys, /NEVER replace the object with boxes/);
  const s = deck()[1];
  s.visual = V.normalizeVisualSpec(s.visual);
  const { user } = V.buildPrompt(s, { bg: '#fff' }, ['boxes instead of a yurt']);
  assert.match(user, /PARTS TO LABEL/);
  assert.match(user, /REJECTED BY A REVIEWER[\s\S]*boxes instead of a yurt/);
});

test('visual sanitizer: detailed illustrations (many paths) are accepted', () => {
  const paths = Array.from({ length: 1500 }, (_, i) => `<path d="M${i % 900} 100 C 10 20, 30 40, 50 60" fill="#c9a24a"/>`).join('');
  const r = V.sanitizeSvg('<svg viewBox="0 0 1100 740">' + paths + '</svg>');
  assert.ok(r && r.elements > 1500);
});

test('visual pipeline: the vision reviewer rejects boxes, the model redraws with its notes, the object passes', async () => {
  V._resetBreaker(); V._resetProMissing();
  const s = deck();
  const bodies = [];
  let n = 0;
  const fetchImpl = async (url, init) => { const b = JSON.parse(init.body); bodies.push(b); n++; return reply(n === 1 ? BOXES : YURT); };
  const vision = async (parts) => {
    const txt = parts[0].text;
    assert.match(txt, /REAL object/);
    return bodies.length === 1 ? { score: 2, issues: ['three boxes instead of a yurt'] } : { score: 8, issues: [] };
  };
  const st = await V.attachVisuals(s, { env, fetchImpl, vision });
  assert.strictEqual(st.ok, 1);
  assert.match(s[1].visualSvg, /^data:image\/svg\+xml;base64,/);
  assert.strictEqual(bodies.length, 2);
  assert.strictEqual(bodies[0].model, 'deepseek-v4-pro');
  assert.ok(!('thinking' in bodies[0]), 'thinking stays on for Pro');
  assert.match(bodies[1].messages[1].content, /three boxes instead of a yurt/);
});

test('visual pipeline: a missing Pro model falls back to Flash and later decks go straight to Flash', async () => {
  V._resetBreaker(); V._resetProMissing();
  const models = [];
  const fetchImpl = async (url, init) => {
    const b = JSON.parse(init.body); models.push(b.model);
    return b.model === 'deepseek-v4-pro' ? reply('{"error":{"message":"Model Not Exist"}}', 400) : reply(YURT);
  };
  const vision = async () => ({ score: 9, issues: [] });
  const s1 = deck();
  await V.attachVisuals(s1, { env, fetchImpl, vision });
  assert.ok(s1[1].visualSvg);
  assert.deepStrictEqual(models, ['deepseek-v4-pro', 'deepseek-flash']);
  models.length = 0;
  const s2 = deck();
  await V.attachVisuals(s2, { env, fetchImpl, vision });
  assert.deepStrictEqual(models, ['deepseek-flash']);
  V._resetProMissing();
});

test('visual pipeline: without a working vision check the figure is still accepted', async () => {
  V._resetBreaker(); V._resetProMissing();
  const s = deck();
  const st = await V.attachVisuals(s, { env, fetchImpl: async () => reply(YURT), vision: async () => null });
  assert.strictEqual(st.ok, 1);
});
