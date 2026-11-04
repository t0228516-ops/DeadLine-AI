'use strict';
const test = require('node:test');
const assert = require('node:assert');
const BC = require('../core/broadcast');
const { hardenBot } = require('../core/crashGuard');

const tgErr = (msg, code, retry) => Object.assign(new Error(`ETELEGRAM: ${msg}`), {
  code: 'ETELEGRAM', response: { statusCode: code, body: retry ? { parameters: { retry_after: retry } } : {} } });
const quiet = { warn() {} };

test('429: waits the time Telegram asks, retries, and the message still arrives', async () => {
  const calls = [], waits = [];
  let first = true;
  const st = await BC.runBroadcast({
    ids: ['1', '2', '3'],
    send: async (id) => { calls.push(id); if (id === '2' && first) { first = false; throw tgErr('429 Too Many Requests: retry after 3', 429, 3); } },
    wait: async (ms) => { waits.push(ms); }, log: quiet,
  });
  assert.deepStrictEqual(calls, ['1', '2', '2', '3']);
  assert.strictEqual(st.sent, 3);
  assert.deepStrictEqual(st.failed, []);
  assert.strictEqual(st.retries, 1);
  assert.ok(waits.includes(3300), 'waited retry_after + 0.3 s');
});

test('429 parsed from the message text when no parameters are given; gives up after maxRetries', async () => {
  assert.strictEqual(BC.retryAfterMs(new Error('ETELEGRAM: 429 Too Many Requests: retry after 7')), 7000);
  const st = await BC.runBroadcast({ ids: ['9'], maxRetries: 2, send: async () => { throw tgErr('429 Too Many Requests: retry after 1', 429); },
    wait: async () => {}, log: quiet });
  assert.deepStrictEqual(st.failed, ['9']);
  assert.strictEqual(st.retries, 2);
});

test('blocked users are counted and reported, other errors go to the failed list', async () => {
  const blocked = [];
  const st = await BC.runBroadcast({ ids: ['a', 'b', 'c'], wait: async () => {}, log: quiet,
    send: async (id) => { if (id === 'a') throw tgErr('403 Forbidden: bot was blocked by the user', 403); if (id === 'b') throw tgErr('500 Internal', 500); },
    onBlocked: (id) => blocked.push(id) });
  assert.deepStrictEqual(blocked, ['a']);
  assert.strictEqual(st.blocked, 1);
  assert.deepStrictEqual(st.failed, ['b']);
  assert.strictEqual(st.sent, 1);
});

test('progress is reported while it runs', async () => {
  let t = 0; const seen = [];
  await BC.runBroadcast({ ids: ['1', '2', '3', '4'], send: async () => {}, wait: async () => {}, now: () => (t += 6000),
    progressEveryMs: 10000, onProgress: (s) => seen.push(s.done), log: quiet });
  assert.ok(seen.length >= 1 && seen.every((d) => d >= 1 && d <= 4));
});

test('decideFormat: an unpaired «_» (t.me/deadline_ai) → plain, one request per user afterwards', async () => {
  const mode = await BC.decideFormat(async () => { throw tgErr("400 Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 120", 400); });
  assert.strictEqual(mode, 'plain');
  assert.strictEqual(await BC.decideFormat(async () => ({ message_id: 1 })), 'markdown');
  await assert.rejects(BC.decideFormat(async () => { throw tgErr('500 Internal', 500); }));
});

test('hardenBot exposes the raw sender (no hidden second request)', async () => {
  let n = 0;
  const bot = { sendMessage: async () => { n++; throw tgErr("400 Bad Request: can't parse entities", 400); }, editMessageText: async () => {} };
  hardenBot(bot);
  await bot.sendMessage(1, 'a_b', { parse_mode: 'Markdown' }).catch(() => {});
  assert.strictEqual(n, 2, 'hardened send retries once without format');
  n = 0;
  await bot.__rawSendMessage(1, 'a_b', { parse_mode: 'Markdown' }).catch(() => {});
  assert.strictEqual(n, 1, 'raw send makes exactly one request');
});

test('parseTargeted: ids on the first line, text below', () => {
  assert.deepStrictEqual(BC.parseTargeted('111, 222 333\nСәлем!\nекінші жол'), { ids: ['111', '222', '333'], text: 'Сәлем!\nекінші жол' });
  assert.strictEqual(BC.parseTargeted('Сәлем бәріне'), null);
  assert.strictEqual(BC.parseTargeted('111\n   '), null);
});
