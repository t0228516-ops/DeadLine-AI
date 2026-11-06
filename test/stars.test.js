'use strict';
// Telegram Stars: шот → pre-checkout тексерісі → төлем → кредит (бір рет). Желісіз: Telegram әдістері ұсталады.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-stars-'));
Object.assign(process.env, { TELEGRAM_BOT_TOKEN: '123:fake', DB_FILE: path.join(dir, 'db.json'), ADMIN_CHAT_ID: '999', ADMIN_ID: '999', STARS_ENABLED: '1' });
delete process.env.DATABASE_URL;
const TelegramBot = require('node-telegram-bot-api');
const calls = [];
TelegramBot.prototype.sendMessage = async function (chatId, text, opts) { calls.push({ m: 'sendMessage', chatId: String(chatId), text, opts }); return { message_id: calls.length }; };
TelegramBot.prototype.sendInvoice = async function (chatId, title, description, payload, token, currency, prices) { calls.push({ m: 'sendInvoice', chatId: String(chatId), title, payload, token, currency, prices }); return {}; };
TelegramBot.prototype.answerPreCheckoutQuery = async function (id, ok, opts) { calls.push({ m: 'precheckout', id, ok, opts }); return true; };
TelegramBot.prototype.answerCallbackQuery = async function () { return true; };
const { bot } = require('../bot');
const db = require('../db');
const Stars = require('../core/stars');

let uid = 1;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cb = (from, data) => ({ update_id: uid++, callback_query: { id: 'cb' + uid, from: { id: from }, data, message: { message_id: 1, chat: { id: from, type: 'private' } } } });
const pre = (from, payload, amount, currency = 'XTR') => ({ update_id: uid++, pre_checkout_query: { id: 'pq' + uid, from: { id: from }, currency, total_amount: amount, invoice_payload: payload } });
const paid = (from, payload, amount, charge) => ({ update_id: uid++, message: { message_id: uid, date: Math.floor(Date.now() / 1000), chat: { id: from, type: 'private' }, from: { id: from }, successful_payment: { currency: 'XTR', total_amount: amount, invoice_payload: payload, telegram_payment_charge_id: charge, provider_payment_charge_id: '' } } });

test('stars: menu → invoice in XTR with the pack price; pre-checkout accepts only the right person and amount', async () => {
  await db.initDB();
  await db.registerUser('701', null);
  bot.processUpdate(cb(701, 'st:menu'));
  await wait(150);
  const menu = calls.find((c) => c.m === 'sendMessage' && c.chatId === '701');
  assert.ok(menu && /Stars/.test(menu.text));
  assert.match(JSON.stringify(menu.opts.reply_markup), /st:pack/);

  bot.processUpdate(cb(701, 'st:pack'));
  await wait(150);
  const inv = calls.find((c) => c.m === 'sendInvoice');
  const pack = Stars.offerById('pack');
  assert.deepStrictEqual([inv.currency, inv.token, inv.prices[0].amount, inv.payload], ['XTR', '', pack.stars, 'dl:pack:701']);

  bot.processUpdate(pre(701, 'dl:pack:701', pack.stars));
  bot.processUpdate(pre(702, 'dl:pack:701', pack.stars));        // басқа адам
  bot.processUpdate(pre(701, 'dl:pack:701', pack.stars - 1));    // сома бұрмаланған
  bot.processUpdate(pre(701, 'dl:pack:701', pack.stars, 'USD')); // валюта басқа
  await wait(100);
  assert.deepStrictEqual(calls.filter((c) => c.m === 'precheckout').map((c) => c.ok), [true, false, false, false]);
  assert.ok(calls.filter((c) => c.m === 'precheckout' && !c.ok).every((c) => c.opts && c.opts.error_message));
});

test('stars: a successful payment adds the pack credits once, even if Telegram delivers it twice', async () => {
  const pack = Stars.offerById('pack');
  const before = await db.getUser('701');
  bot.processUpdate(paid(701, 'dl:pack:701', pack.stars, 'charge-1'));
  await wait(200);
  bot.processUpdate(paid(701, 'dl:pack:701', pack.stars, 'charge-1')); // қайталанған жеткізу
  await wait(200);
  const after = await db.getUser('701');
  assert.strictEqual(after.credits - before.credits, pack.credits);
  assert.ok(calls.some((c) => c.m === 'sendMessage' && c.chatId === '701' && /Төлем өтті/.test(c.text)));
  assert.ok(calls.some((c) => c.m === 'sendMessage' && c.chatId === '999' && /Stars/.test(c.text)), 'admin informed');
  // басқа төлем — тағы қосылады
  bot.processUpdate(paid(701, 'dl:one:701', Stars.offerById('one').stars, 'charge-2'));
  await wait(200);
  assert.strictEqual((await db.getUser('701')).credits - after.credits, 1);
});

test('stars: switched off → no invoice, pre-checkout refused; unknown payload goes to the admin', async () => {
  process.env.STARS_ENABLED = '0';
  try {
    const n = calls.filter((c) => c.m === 'sendInvoice').length;
    bot.processUpdate(cb(703, 'st:pack'));
    bot.processUpdate(pre(703, 'dl:pack:703', Stars.offerById('pack').stars));
    await wait(150);
    assert.strictEqual(calls.filter((c) => c.m === 'sendInvoice').length, n);
    assert.strictEqual(calls.filter((c) => c.m === 'precheckout').pop().ok, false);
  } finally { process.env.STARS_ENABLED = '1'; }
  assert.strictEqual(Stars.creditFor({ currency: 'XTR', total_amount: 5, invoice_payload: 'hack', telegram_payment_charge_id: 'x' }), null);
  bot.processUpdate(paid(704, 'hack', 5, 'charge-x'));
  await wait(150);
  assert.ok(calls.some((c) => c.m === 'sendMessage' && c.chatId === '999' && /түсінбеген/.test(c.text)));
});

test.after(() => { bot.stopPolling && bot.stopPolling().catch(() => {}); setTimeout(() => process.exit(0), 50); });
