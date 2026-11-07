'use strict';
// Бір реттік еске салу: Mini App-ты ашып, ештеңе жасамай кеткенге — тек бір рет, түнде емес, бұғаттағанға емес.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-nudge-'));
process.env.DB_FILE = path.join(dir, 'db.json');
delete process.env.DATABASE_URL;
const db = require('../storage/jsonDb');
const N = require('../core/nudge');

// 2026-11-06 14:00 Алматы = 09:00 UTC
const T = Date.UTC(2026, 10, 6, 9, 0, 0);
const H = 3600e3;

test('nudge: only people who opened the app 1–6 h ago and did nothing; once a week; never blocked; never at night', async () => {
  await db.initDB();
  for (const id of ['11', '12', '13', '14', '15', '16']) await db.registerUser(id, null);
  await db.logEvent('11', 'app', null, T - 2 * H);   // ашып кетті → еске саламыз
  await db.logEvent('12', 'app', null, T - 2 * H);
  await db.logEvent('12', 'gen', null, T - H);       // презентация жасады → жоқ
  await db.logEvent('13', 'app', null, T - 2 * H);
  await db.logEvent('13', 'quiz', null, T - H);      // квиз жасады → жоқ
  await db.logEvent('14', 'app', null, T - 20 * 60e3); // жаңа ғана ашты (20 мин) → әлі ерте
  await db.logEvent('15', 'app', null, T - 2 * H);
  await db.setBlocked('15', true);                   // бұғаттады → жоқ
  await db.logEvent('16', 'app', null, T - 2 * H);
  await db.logEvent('16', 'nudge', null, T - 3 * 24 * H); // 3 күн бұрын еске салынған → жоқ

  const sent = [];
  const send = async (id, text, opts) => { sent.push({ id, text, opts }); };
  assert.strictEqual(await N.runNudges({ db, send, webappUrl: 'https://app.example', now: T }), 1);
  assert.deepStrictEqual(sent.map((x) => x.id), ['11']);
  assert.match(sent[0].text, /2 минутта/);
  assert.match(JSON.stringify(sent[0].opts.reply_markup), /webapp\/#quiz/);

  // екінші айналым — сол адамға қайта жазылмайды
  assert.strictEqual(await N.runNudges({ db, send, webappUrl: 'https://app.example', now: T + 15 * 60e3 }), 0);

  // түн (02:00 Алматы) — ешкімге жазылмайды
  await db.registerUser('17', null);
  const night = Date.UTC(2026, 10, 6, 21, 0, 0); // 02:00 Алматы (келесі күн)
  await db.logEvent('17', 'app', null, night - 2 * H);
  assert.strictEqual(await N.runNudges({ db, send, now: night }), 0);

  // өшіргіш
  process.env.NUDGE_ABANDONED = '0';
  await db.registerUser('18', null);
  await db.logEvent('18', 'app', null, T - 2 * H);
  assert.strictEqual(await N.runNudges({ db, send, now: T + 30 * 60e3 }), 0);
  delete process.env.NUDGE_ABANDONED;
});

test('nudge: evening text speaks about tomorrow; Almaty clock helpers', () => {
  const eve = Date.UTC(2026, 10, 6, 17, 30, 0); // 22:30 Алматы
  assert.strictEqual(N.almatyHour(eve), 22.5);
  assert.ok(N.evening(eve));
  assert.match(N.nudgeText(eve), /Ертеңге/);
  assert.ok(N.quiet(Date.UTC(2026, 10, 6, 22, 0, 0)));   // 03:00
  assert.ok(!N.quiet(Date.UTC(2026, 10, 6, 3, 30, 0)));  // 08:30
  assert.strictEqual(N.nudgeKeyboard(''), undefined);
});

// Екі жақты реферал: сыйлық кредит «бірінші сатып алу» жеңілдігін (total === 0) бұзбайды; бір реттік белгі
test('referral gift: bonus credits keep total (first-purchase discount) intact; eventSince finds the one-time mark', async () => {
  await db.registerUser('21', '11');
  const before = await db.getUser('21');
  await db.addBonusCredits('21', 1);
  const after = await db.getUser('21');
  assert.strictEqual(after.credits, before.credits + 1);
  assert.strictEqual(after.total, before.total, 'total unchanged → isFirstPurchase stays true');
  assert.strictEqual(await db.eventSince('21', 'refgift', 0), false);
  await db.logEvent('21', 'refgift');
  assert.strictEqual(await db.eventSince('21', 'refgift', 0), true);
  assert.strictEqual(await db.eventSince('21', 'refask', Date.now() - 3 * 24 * H), false);
});

// Түн ортасы (Алматы) ауысқанда да: кеше 23:40-та ашып кеткен адам бүгін кандидат (бұрын «тек бүгінгі күн» сүзгісі жоғалтатын)
test('nudge: an app open just before Almaty midnight is still a candidate after midnight', async () => {
  const mid = Date.UTC(2026, 10, 7, 19, 0, 0); // 00:00 Алматы (8 қараша)
  await db.registerUser('31', null);
  await db.logEvent('31', 'app', null, mid - 20 * 60e3);       // 23:40 Алматы (7 қараша)
  const now = mid + 100 * 60e3;                                 // 01:40 — бір аптаға жуық еске салынбаған
  const got = await db.listAbandoned({ from: now - 6 * H, to: now - H, nudgedSince: now - 7 * 24 * H, limit: 50 });
  assert.ok(got.includes('31'));
  await db.logEvent('31', 'gen', null, mid + 30 * 60e3);        // түннен кейін жасады → енді кандидат емес
  const got2 = await db.listAbandoned({ from: now - 6 * H, to: now - H, nudgedSince: now - 7 * 24 * H, limit: 50 });
  assert.ok(!got2.includes('31'));
});
