'use strict';
// Боттың клиентке жазатын хабарлары (core/botText.js): екі тілде бірдей кілттер, орысшасы таза, Markdown бұзылмайды,
// қазақша мәтіндер бұрынғыдай (бір әрпі өзгермеген).
const test = require('node:test');
const assert = require('node:assert');
const { bt, KK, RU, ruPlural, mainKeyboard, menuAction } = require('../core/botText');

const KK_ONLY = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
// Барлық орынды толтыратын үлгі мәндер
const P = {
  price: 250, first: 149, plusLine: '⭐ *Plus:* 50 — *1990₸*', packLine: '🎒 *P*', credits: 5, amount: 990, each: 198, total: 7,
  refEarnings: 3, link: 'https://t.me/DeadLine_prezbot?start=ref_1', per: 2, need: 1, phone: '+7700', name: 'Мурзабек Н', pct: 20,
  balance: 100, earned: 300, paid: 200, buyers: 4, commission: 50, left: 50, count: 7, hint: '', icon: '🎒', bname: 'Сессия',
  plusCredits: 50, plusAmount: 1990, rating: 4, jobId: 'jabc12345', kind: 'presentation', title: 'Тема', scoreNote: '', score: 90,
  mb: 52, url: 'https://t.me/deadline_ai', pages: 12, packCredits: 5, packAmount: 990, ref: 'https://t.me/x?start=ref_1', n: 10,
  topic: 'Фотосинтез', players: 5,
};
const render = (d, k) => (typeof d[k] === 'function' ? d[k](P) : d[k]);
// Тіл ауыстыру жолдары әдейі екінші тілде жазылған
const BILINGUAL = new Set(['lang_other', 'langPick', 'help']);

test('botText: both languages have exactly the same keys and every message renders to non-empty text', () => {
  assert.deepStrictEqual(Object.keys(RU).sort(), Object.keys(KK).sort());
  for (const k of Object.keys(KK)) {
    for (const [lang, d] of [['kk', KK], ['ru', RU]]) {
      const v = render(d, k);
      assert.ok(typeof v === 'string' && v.trim().length, `${lang}.${k} is empty`);
      assert.ok(!/undefined|\[object Object\]/.test(v), `${lang}.${k}: ${v}`);
    }
  }
});

test('botText: Russian messages contain no Kazakh-only letters (except the language-switch lines)', () => {
  for (const k of Object.keys(RU)) {
    if (BILINGUAL.has(k)) continue;
    const v = render(RU, k).replace(/Мурзабек Н|Фотосинтез|Тема|Сессия/g, '');
    assert.ok(!KK_ONLY.test(v), `ru.${k}: ${v}`);
  }
});

// Markdown-сыз жіберілетін хабарлар («_» оларда қауіпсіз)
const PLAIN = new Set(['appMissing']);

test('botText: Telegram Markdown stays valid — paired * outside code, no stray _', () => {
  for (const [lang, d] of [['kk', KK], ['ru', RU]]) {
    for (const k of Object.keys(d)) {
      if (PLAIN.has(k)) continue;
      const v = render(d, k).replace(/`[^`]*`/g, '');   // код ішінде белгі есептелмейді
      assert.strictEqual((v.match(/\*/g) || []).length % 2, 0, `${lang}.${k}: unpaired *`);
      assert.ok(!/_/.test(v.replace(/https?:\/\/\S+/g, '')), `${lang}.${k}: stray _`);
    }
  }
});

test('botText: Kazakh messages are exactly the ones the bot sent before', () => {
  assert.strictEqual(bt('kk', 'paid', { credits: 5, total: 7 }),
    '✅ Төлем расталды!\n\n💳 *5* презентация кредиті қосылды.\n📦 Жалпы кредитіңіз: *7*\n\n«📱 Mini App ашу» батырмасы арқылы бастаңыз! 🚀');
  assert.strictEqual(bt('kk', 'receiptReceived'), '📨 Чегіңіз қабылданды!\n\n⏳ Чекті админ тексеріп жатыр. Расталған соң хабарлама аласыз.');
  assert.strictEqual(bt('kk', 'packLine', { credits: 5, amount: 990, each: 198 }), '🎒 *Сессия пакеті:* 5 презентация — *990₸* (≈198₸/дана, жазыңыз: 5)');
  assert.ok(bt('kk', 'welcome', P).startsWith('👋 *Сәлем!* DeadLine — кәсіби AI презентация студиясы.\n\n💳 *Баға:* 250₸ — 1 презентация\n'));
  assert.strictEqual(bt('kk', 'ratePrompt', { kind: 'referat', jobId: 'jabc12345' }), '📄 Реферат ұнады ма? Жұлдызша қойыңыз:\n#jabc12345');
  assert.strictEqual(bt('xx', 'badCount'), '❗ 1-ден 50-ге дейін сан жазыңыз.', 'unknown language → Kazakh');
  assert.throws(() => bt('kk', 'no_such_key'));
});

test('botText: Russian plural forms and counted words', () => {
  const pres = ['презентация', 'презентации', 'презентаций'];
  assert.deepStrictEqual([1, 2, 5, 11, 21, 22, 50].map((n) => ruPlural(n, pres)),
    ['презентация', 'презентации', 'презентаций', 'презентаций', 'презентация', 'презентации', 'презентаций']);
  assert.match(bt('ru', 'countPrice', { ...P, count: 3, total: 750 }), /^🧾 \*3 презентации — 750₸\*/);
  assert.match(bt('ru', 'packLine', { credits: 5, amount: 990, each: 198 }), /5 презентаций — \*990₸\*/);
  assert.match(bt('ru', 'qHeadDeck', { n: 1 }), /1 вопрос\./);
  assert.match(bt('ru', 'qHostFirst', { players: 3 }), /3 человека/);
});

test('botText: the main menu is translated and both languages map to the same actions', () => {
  const kk = mainKeyboard('kk').reply_markup.keyboard.flat().map((b) => b.text);
  const ru = mainKeyboard('ru').reply_markup.keyboard.flat().map((b) => b.text);
  assert.deepStrictEqual(kk, ['📱 Mini App ашу', '🎯 Тегін квиз', '💰 Кредит сатып алу', '💳 Менің есепшотым', '🔗 Реферал сілтемем', '🤝 Серіктес болу', '❓ Көмек']);
  assert.strictEqual(ru.length, kk.length);
  assert.deepStrictEqual(kk.map(menuAction), ru.map(menuAction));
  assert.deepStrictEqual(kk.map(menuAction), ['app', 'quiz', 'buy', 'balance', 'ref', 'partner', 'help']);
  assert.strictEqual(menuAction('📝 Тақырып жазу'), 'legacy');
  assert.strictEqual(menuAction('сәлем'), null);
});
