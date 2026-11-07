'use strict';
// Бот адамның тілінде сөйлейді: әдепкі қазақша, «🌐 Русский язык» / /lang / ?start=ru → орысша; мәзір екі тілде де танылады.
// Желісіз: Telegram әдістері ұсталады, дерекқор — уақытша JSON.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-lang-'));
Object.assign(process.env, { TELEGRAM_BOT_TOKEN: '123:fake', DB_FILE: path.join(dir, 'db.json'), ADMIN_CHAT_ID: '999', ADMIN_ID: '999', WEBAPP_URL: 'https://app.example' });
delete process.env.DATABASE_URL;
const TelegramBot = require('node-telegram-bot-api');
const calls = [];
TelegramBot.prototype.sendMessage = async function (chatId, text, opts) { calls.push({ chatId: String(chatId), text, opts }); return { message_id: calls.length }; };
TelegramBot.prototype.answerCallbackQuery = async function (id, opts) { calls.push({ chatId: 'cb', text: (opts && opts.text) || '' }); return true; };
const { bot } = require('../bot');
const db = require('../db');
const UL = require('../core/userLang');

let uid = 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const msg = (from, text) => ({ update_id: uid++, message: { message_id: uid, date: Math.floor(Date.now() / 1000), chat: { id: from, type: 'private' }, from: { id: from, first_name: 'T' }, text } });
const cmd = (from, text) => { const m = msg(from, text); m.message.entities = [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }]; return m; };
const cb = (from, data) => ({ update_id: uid++, callback_query: { id: 'cb' + uid, from: { id: from }, data, message: { message_id: 1, chat: { id: from, type: 'private' } } } });
const to = (id) => calls.filter((c) => c.chatId === String(id));
const last = (id) => to(id).slice(-1)[0];
const keys = (c) => JSON.stringify(c && c.opts && c.opts.reply_markup);

test('bot language: Kazakh by default; «🌐 Русский язык» switches the bot (and its menu) to Russian and stores the choice', async () => {
  await db.initDB();
  bot.processUpdate(cmd(801, '/start'));
  await wait(250);
  const [welcome, open] = to(801);
  assert.match(welcome.text, /^👋 \*Сәлем!\*/);
  assert.match(keys(welcome), /Менің есепшотым/);
  assert.match(keys(open), /"lang:ru"/);
  assert.match(keys(open), /"url":"https:\/\/app.example\/webapp\/"/, 'Kazakh Mini App link has no ?lang');

  bot.processUpdate(cb(801, 'lang:ru'));
  await wait(250);
  assert.strictEqual(await db.getUserLang('801'), 'ru');
  const ru = to(801).slice(2);
  assert.match(ru[0].text, /^👋 \*Привет!\*/);
  assert.match(keys(ru[0]), /Мой счёт/);
  assert.match(keys(ru[1]), /webapp\/\?lang=ru"/, 'Mini App opens in Russian');
  assert.match(keys(ru[1]), /"lang:kk"/);
});

test('bot language: a Russian user gets Russian answers from both the new and the old (Kazakh) menu buttons', async () => {
  bot.processUpdate(msg(801, '💳 Мой счёт'));
  await wait(150);
  assert.match(last(801).text, /^📊 \*Мой счёт\*/);
  bot.processUpdate(msg(801, '💳 Менің есепшотым'));   // тіл ауысқанға дейінгі ескі пернетақта
  await wait(150);
  assert.match(last(801).text, /^📊 \*Мой счёт\*/);
  bot.processUpdate(msg(801, '💰 Купить кредиты'));
  await wait(150);
  assert.match(last(801).text, /^🎁 Первая презентация/);
  assert.match(last(801).text, /После оплаты отправьте \*чек \(PDF\)\*/);
  bot.processUpdate(msg(801, '❓ Помощь'));
  await wait(150);
  assert.match(last(801).text, /^📖 \*Как пользоваться:\*/);
  bot.processUpdate(msg(801, 'привет'));
  await wait(150);
  assert.match(last(801).text, /только в \*Mini App\*/);
});

test('bot language: /lang offers both languages; switching back to Kazakh restores the Kazakh bot', async () => {
  bot.processUpdate(cmd(801, '/lang'));
  await wait(150);
  assert.match(keys(last(801)), /"lang:kk".*"lang:ru"/);
  bot.processUpdate(cb(801, 'lang:kk'));
  await wait(250);
  assert.strictEqual(await UL.langOf('801'), 'kk');
  const n = to(801).length;
  bot.processUpdate(msg(801, '💳 Мой счёт'));
  await wait(150);
  assert.strictEqual(to(801).length, n + 1);
  assert.match(last(801).text, /^📊 \*Менің есепшотым\*/);
});

test('bot language: ?start=ru and ?start=teacher_ru open the bot in Russian; teacher links still offer the free quiz', async () => {
  bot.processUpdate(cmd(802, '/start ru'));
  await wait(250);
  assert.match(to(802)[0].text, /^👋 \*Привет!\*/);
  bot.processUpdate(cmd(803, '/start teacher_ru'));
  await wait(300);
  const t = to(803);
  assert.match(t[0].text, /^👋 \*Привет!\*/);
  assert.ok(t.some((c) => /^🎯 \*Бесплатный квиз/.test(c.text) && /webapp\/\?lang=ru#quiz/.test(keys(c))), 'Russian quiz offer');
  bot.processUpdate(cmd(804, '/start teacher'));
  await wait(300);
  assert.match(to(804)[0].text, /^👋 \*Сәлем!\*/, 'plain teacher link stays Kazakh');
  assert.ok(to(804).some((c) => /^🎯 \*Тегін квиз/.test(c.text)));
});

test('bot language: the stored language survives a cache reset (read from the database)', async () => {
  await UL.setLang('805', 'ru').catch(() => {});   // адам тіркелмеген — жазылмайды
  assert.strictEqual(await db.getUserLang('805'), null);
  await db.registerUser('805', null);
  await UL.setLang('805', 'ru');
  UL._cache.clear();
  assert.strictEqual(await UL.langOf('805'), 'ru');
  assert.strictEqual(await UL.langOf('806'), 'kk', 'unknown user → Kazakh');
  assert.strictEqual(UL.appUrl('https://a.b/', '#quiz', 'ru'), 'https://a.b/webapp/?lang=ru#quiz');
  assert.strictEqual(UL.appUrl('https://a.b', '', 'kk'), 'https://a.b/webapp/');
});

test.after(() => { bot.stopPolling && bot.stopPolling().catch(() => {}); setTimeout(() => process.exit(0), 50); });
