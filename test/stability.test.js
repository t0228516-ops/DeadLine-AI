'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('../core/crashGuard');

test('network / Telegram errors are recoverable, programming errors are not', () => {
  assert.ok(G.isRecoverable({ code: 'ETELEGRAM', message: 'ETELEGRAM: 403 Forbidden: bot was blocked by the user' }));
  assert.ok(G.isRecoverable({ code: 'ECONNRESET', message: 'socket hang up' }));
  assert.ok(!G.isRecoverable(new TypeError("Cannot read properties of undefined (reading 'x')")));
});

function fakeBot(fail) {
  const calls = [];
  return {
    calls,
    sendMessage(chatId, text, o) { calls.push(['send', o && o.parse_mode]); return fail(o) ? Promise.reject(new Error(fail(o))) : Promise.resolve({ ok: 1 }); },
    editMessageText(text, o) { calls.push(['edit', o && o.parse_mode]); return fail(o) ? Promise.reject(new Error(fail(o))) : Promise.resolve({ ok: 1 }); },
  };
}

test('a message whose Markdown cannot be parsed is re-sent as plain text', async () => {
  const bot = G.hardenBot(fakeBot((o) => (o && o.parse_mode ? "ETELEGRAM: 400 Bad Request: can't parse entities: Can't find end of the entity" : '')));
  assert.deepStrictEqual(await bot.sendMessage(1, 'Python_негіздер', { parse_mode: 'Markdown', reply_markup: {} }), { ok: 1 });
  assert.deepStrictEqual(bot.calls, [['send', 'Markdown'], ['send', undefined]]);
  assert.deepStrictEqual(await bot.editMessageText('a_b', { chat_id: 1, message_id: 2, parse_mode: 'Markdown' }), { ok: 1 });
});

test('a blocked user is marked, the error still reaches the caller', async () => {
  const blocked = [];
  const bot = G.hardenBot(fakeBot(() => 'ETELEGRAM: 403 Forbidden: bot was blocked by the user'), { onBlocked: (id) => blocked.push(id) });
  await assert.rejects(bot.sendMessage(42, 'hi'), /blocked/);
  assert.deepStrictEqual(blocked, [42]);
});

test('plain-text fallback drops Markdown marks; a blocked user is noticed on the fallback too', async () => {
  assert.strictEqual(G.plainText('✅ *Презентация дайын!*\n📌 Python\\_негіздер'), '✅ Презентация дайын!\n📌 Python_негіздер');
  const blocked = [];
  let n = 0;
  const bot = G.hardenBot({
    sendMessage() { n++; return Promise.reject(new Error(n === 1 ? "ETELEGRAM: 400 Bad Request: can't parse entities" : 'ETELEGRAM: 403 Forbidden: bot was blocked by the user')); },
    editMessageText() { return Promise.resolve(); },
  }, { onBlocked: (id) => blocked.push(id) });
  await assert.rejects(bot.sendMessage(7, '*x*', { parse_mode: 'Markdown' }), /blocked/);
  assert.deepStrictEqual(blocked, [7]);
});

test('a programming error that merely mentions "aborted" is not treated as a network error', () => {
  assert.ok(!G.isRecoverable(new TypeError("Cannot read properties of undefined (reading 'aborted')")));
  assert.ok(!G.isRecoverable(new Error('network config missing')));
});
