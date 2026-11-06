'use strict';
/** Тегін квиз: JSON дерекқор (жергілікті / CI) — pgDb-мен бірдей API (pg нұсқасы — test/pgDb.test.js) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('jsonDb: тегін квиз — сақтау, жаңарту (материал сақталады), күндік санау, тізім, /stats', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlquiz-'));
  const prev = process.env.DB_FILE;
  process.env.DB_FILE = path.join(dir, 'db.json');
  delete require.cache[require.resolve('../storage/jsonDb')];
  const db = require('../storage/jsonDb');
  try {
    await db.initDB();
    const since = Date.now() - 1000;
    const qs = [{ q: 'Сұрақ 1?', options: ['а', 'ә', 'б', 'в'], correct: 1, explain: '' }, { q: 'Сұрақ 2?', options: ['а', 'ә', 'б', 'в'], correct: 0, explain: '' }];
    await db.saveQuiz({ code: 'AAAA1', hostKey: 'hk', chatId: '7', jobId: null, topic: 'Т', language: 'kk', questions: qs, kind: 'free', material: 'Мәтін', expiresAt: Date.now() + 1e6 });
    await db.saveQuiz({ code: 'AAAA2', hostKey: 'hk2', chatId: '7', jobId: 'job', topic: 'Дек', language: 'kk', questions: qs, expiresAt: Date.now() + 1e6 });
    await db.saveQuiz({ code: 'AAAA3', hostKey: 'hk3', chatId: '8', jobId: null, topic: 'Басқа', language: 'ru', questions: qs, kind: 'free', expiresAt: Date.now() + 1e6 });
    const z = await db.getQuiz('AAAA1');
    assert.deepStrictEqual([z.chatId, z.kind, z.material], ['7', 'free', 'Мәтін']);
    await db.updateQuizQuestions('AAAA1', [qs[1]]);
    const z2 = await db.getQuiz('AAAA1');
    assert.deepStrictEqual([z2.questions.length, z2.material, z2.kind], [1, 'Мәтін', 'free']);
    assert.strictEqual(await db.countFreeQuizzes({ chatId: '7', since }), 1);
    assert.strictEqual(await db.countFreeQuizzes({ since }), 2);
    assert.strictEqual(await db.countFreeQuizzes({ chatId: '7', since: Date.now() + 1000 }), 0, 'tomorrow starts from zero');
    assert.deepStrictEqual((await db.listFreeQuizzes('7')).map((x) => [x.code, x.hostKey, x.n]), [['AAAA1', 'hk', 1]]);
    await db.addQuizResults('AAAA1', [{ name: 'А', right: 1, total: 1, score: 900, mode: 'live', answers: [0] }, { name: 'Б', right: 0, total: 1, score: 0, mode: 'live', answers: [1] }]);
    assert.deepStrictEqual(await db.freeQuizStats(since), { today: 2, total: 2, makers: 2, games: 1, players: 2 });
  } finally {
    if (prev == null) delete process.env.DB_FILE; else process.env.DB_FILE = prev;
    delete require.cache[require.resolve('../storage/jsonDb')];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
