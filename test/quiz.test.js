'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const Q = require('../core/quiz');
const { appendQuizSlide, guessFonts } = require('../products/presentation/quizSlide');
const { createQuizRouter } = require('../core/quizRoutes');

const item = (k, extra = {}) => ({ q: `Сұрақ ${k}: қай жауап дұрыс?`, options: [`Дұрыс ${k}`, `Қате А ${k}`, `Қате Б ${k}`, `Қате В ${k}`], correct: 0, explain: `Түсіндірме ${k}`, ...extra });
const ten = () => Array.from({ length: 10 }, (_, k) => item(k + 1));

test('normalizeQuestions: keeps valid items, shuffles the right answer, drops bad ones', () => {
  const raw = { quiz: [
    ...ten(),
    { q: 'Тым қысқа?', options: ['a', 'b', 'c', 'd'], correct: 0 },                       // too short q
    item(11, { options: ['x', 'x', 'y', 'z'] }),                                            // duplicate option
    item(12, { correct: 7 }),                                                                // bad index
    item(13, { options: ['Біреуі', 'Екеуі', 'Үшеуі', 'Барлығы дұрыс'] }),                   // "all of the above"
  ] };
  const out = Q.normalizeQuestions(raw, () => 0.99);
  assert.strictEqual(out.length, 10);
  out.forEach((x, k) => { assert.strictEqual(x.options[x.correct], `Дұрыс ${k + 1}`); assert.strictEqual(x.options.length, 4); });
  // араластыру: бәрінде бірдей орын емес (Math.random)
  const spread = new Set(Q.normalizeQuestions({ quiz: ten() }).map((x) => x.correct));
  assert.ok(spread.size >= 2, 'right answer is not always in the same place');
  assert.deepStrictEqual(Q.normalizeQuestions({ quiz: ten().slice(0, 5) }), [], 'fewer than 6 → no quiz');
  assert.strictEqual(Q.normalizeQuestions({ quiz: [...ten(), ...ten()] }).length, 10, 'duplicates dropped, max 10');
});

test('QR: PNG and SVG are generated', () => {
  const png = Q.qrPng('https://example.app/q/ABCDE');
  assert.strictEqual(png.slice(1, 4).toString(), 'PNG');
  assert.ok(png.length > 200);
  assert.ok(/^<svg[\s\S]*<path d="M/.test(Q.qrSvg('https://example.app/q/ABCDE')));
});

test('live game: right/wrong, score and rank stay hidden until the end; then results and a per-question review', () => {
  const quiz = { code: 'ABCDE', hostKey: 'k', topic: 'T', language: 'kk', questions: Q.normalizeQuestions({ quiz: ten() }, () => 0) };
  let now = 1_000_000;
  const room = Q.createRoom(quiz, now);
  const a = Q.join(room, '  Аружан  ', now); const b = Q.join(room, 'аружан', now); const c = Q.join(room, 'Дана', now);
  assert.strictEqual(a.name, 'Аружан'); assert.strictEqual(b.name, 'аружан 2', 'same name gets a number');
  assert.ok(Q.join(room, '   ', now).error);
  assert.strictEqual(Q.hostView(room, now).names.length, 3);

  assert.ok(Q.hostAction(room, 'start', now).ok);
  let pv = Q.playerView(room, a.pid, a.secret, now);
  assert.strictEqual(pv.phase, 'question');
  assert.ok(!('correct' in pv.question), 'correct answer is not sent to phones');
  assert.strictEqual(Q.answer(room, a.pid, a.secret, 0, 0, now).error, 'early', 'get-ready pause');
  now += 2000;
  const right = quiz.questions[0].correct;
  assert.ok(Q.answer(room, a.pid, a.secret, 0, right, now).ok);
  assert.strictEqual(Q.answer(room, a.pid, a.secret, 0, right, now).error, 'twice');
  assert.strictEqual(Q.answer(room, a.pid, 'wrong-secret', 0, right, now).error, 'player');
  now += 5000;
  Q.answer(room, b.pid, b.secret, 0, (right + 1) % 4, now);
  assert.strictEqual(room.phase, 'question', 'not everyone answered yet');
  Q.answer(room, c.pid, c.secret, 0, right, now);
  assert.strictEqual(room.phase, 'closed', 'everyone answered → question closed');
  const ra = room.players.get(a.pid).score; const rc = room.players.get(c.pid).score;
  assert.ok(ra > rc && rc >= 500 && ra <= 1000, 'faster right answer scores more');
  assert.strictEqual(room.players.get(b.pid).score, 0);

  // ойын кезінде: дұрыс/қате, ұпай, орын — ешкімге көрінбейді
  pv = Q.playerView(room, b.pid, b.secret, now);
  assert.strictEqual(pv.myChoice, (right + 1) % 4);
  for (const k of ['reveal', 'review']) assert.ok(!(k in pv), 'no ' + k + ' during the game');
  assert.deepStrictEqual(Object.keys(pv.me), ['name'], 'no score/rank during the game');
  assert.ok(!JSON.stringify(pv).includes('"correct"'));
  let hv = Q.hostView(room, now);
  assert.strictEqual(hv.answered, 3);
  for (const k of ['top', 'stats', 'item', 'reveal']) assert.ok(!(k in hv), 'projector shows no ' + k + ' during the game');
  assert.ok(!JSON.stringify(hv).includes('"correct"'));

  // 2-сұрақ: уақыт бітеді → жабылады
  Q.hostAction(room, 'next', now);
  assert.strictEqual(room.phase, 'question');
  now += 1500 + room.durMs + 10;
  assert.strictEqual(Q.hostView(room, now).phase, 'closed', 'timer end → closed');
  for (let i = 2; i < 10; i++) { Q.hostAction(room, 'next', now); Q.hostAction(room, 'close', now); }
  Q.hostAction(room, 'next', now);
  hv = Q.hostView(room, now);
  assert.strictEqual(hv.phase, 'end');
  assert.strictEqual(hv.top[0].name, 'Аружан');
  assert.strictEqual(hv.stats.players, 3);
  assert.ok(hv.stats.hardest && hv.stats.hardest.n === 1 && hv.stats.hardest.pct === 67, 'hardest = lowest share among answered questions');
  const end = Q.playerView(room, a.pid, a.secret, now);
  assert.strictEqual(end.review.length, 10); assert.strictEqual(end.me.rank, 1); assert.ok(end.me.score > 0);
  assert.strictEqual(end.review[0].ok, true);
  assert.strictEqual(Q.playerView(room, b.pid, b.secret, now).review[0].ok, false);

  // жауаптарды талдау: әр сұрақ — дұрыс жауап, сыныптың %, түсіндірме; алға/артқа
  Q.hostAction(room, 'next', now);
  hv = Q.hostView(room, now);
  assert.strictEqual(hv.phase, 'review'); assert.strictEqual(hv.ri, 0);
  assert.strictEqual(hv.item.correct, right); assert.strictEqual(hv.item.pct, 67); assert.strictEqual(hv.hardest, true);
  assert.deepStrictEqual(hv.item.counts.reduce((x, y) => x + y, 0), 3);
  Q.hostAction(room, 'next', now); assert.strictEqual(room.ri, 1);
  Q.hostAction(room, 'prev', now); assert.strictEqual(room.ri, 0);
  assert.ok(Q.playerView(room, a.pid, a.secret, now).review, 'phones keep the result during the review');
  for (let i = 0; i < 10; i++) Q.hostAction(room, 'next', now);
  assert.strictEqual(room.phase, 'end', 'after the last question → results again');
  Q.hostAction(room, 'restart', now);
  assert.strictEqual(room.phase, 'lobby'); assert.strictEqual(room.players.get(a.pid).score, 0);
});

test('quiz slide: appended after the last slide (or before Credits), QR + start link, valid package', async () => {
  const PptxGenJS = require('pptxgenjs');
  const p = new PptxGenJS(); p.layout = 'LAYOUT_WIDE';
  p.addSlide().addText('Мұқаба', { x: 1, y: 1, w: 6, h: 1, fontFace: 'Montserrat Bold', fontSize: 40 });
  p.addSlide().addText('Қорытынды', { x: 1, y: 1, w: 6, h: 1, fontFace: 'Inter', fontSize: 20 });
  const file = path.join(os.tmpdir(), `quiz-slide-${process.pid}.pptx`);
  fs.writeFileSync(file, await p.write({ outputType: 'nodebuffer' }));
  const n = await appendQuizSlide(file, { playerUrl: 'https://x.app/q/ABCDE', hostUrl: 'https://x.app/q/ABCDE/host?k=KEY', count: 10, language: 'kk', palette: { bg: '#33020a', text: '#e6e7d7', accent: '#fcd0a7' } });
  assert.strictEqual(n, 3);
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const pres = await zip.file('ppt/presentation.xml').async('string');
  assert.strictEqual((pres.match(/<p:sldId /g) || []).length, 3);
  const slide = await zip.file('ppt/slides/slide3.xml').async('string');
  const rels = await zip.file('ppt/slides/_rels/slide3.xml.rels').async('string');
  assert.ok(slide.includes('Квизді бастау') && slide.includes('showMasterSp="0"') && /hlinkClick r:id="rId3"/.test(slide));
  assert.ok(rels.includes('https://x.app/q/ABCDE/host?k=KEY') && /TargetMode="External"/.test(rels) && rels.includes('slideLayout'));
  assert.ok(zip.file(/ppt\/media\/dlquiz3\.png/).length === 1);
  assert.ok((await zip.file('[Content_Types].xml').async('string')).includes('/ppt/slides/slide3.xml'));
  assert.ok(slide.includes('typeface="Inter"'), 'deck font reused');
  assert.deepStrictEqual(guessFonts('<a:rPr sz="4000"><a:latin typeface="Montserrat Bold"/></a:rPr><a:rPr sz="1800"><a:latin typeface="Inter"/></a:rPr><a:rPr sz="1800"><a:latin typeface="Inter"/></a:rPr>'), { head: 'Montserrat Bold', body: 'Inter' });

  // beforeLast: Credits соңында қалады
  const n2 = await appendQuizSlide(file, { playerUrl: 'https://x.app/q/FGHJK', hostUrl: 'https://x.app/q/FGHJK/host?k=K2', language: 'ru', palette: null, beforeLast: true });
  assert.strictEqual(n2, 3);
  const pres2 = await (await JSZip.loadAsync(fs.readFileSync(file))).file('ppt/presentation.xml').async('string');
  const order = [...pres2.matchAll(/<p:sldId id="(\d+)"/g)].map((m) => Number(m[1]));
  assert.strictEqual(order.length, 4);
  assert.ok(order[2] > order[3], 'new slide sits before the old last one');
  fs.unlinkSync(file);
});

test('routes: pages, join/answer/state, host key, solo blocked during a live game', async () => {
  const express = require('express');
  const quiz = { code: 'ABCDE', hostKey: 'secret-key', topic: 'Тақырып', language: 'kk', questions: Q.normalizeQuestions({ quiz: ten() }, () => 0) };
  const app = express(); app.use(express.json());
  app.use(createQuizRouter({ db: { getQuiz: async (c) => (c === 'ABCDE' ? quiz : null) }, webappDir: path.join(__dirname, '..', 'webapp'), baseUrl: 'https://x.app' }));
  const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
  const j = async (u, o) => { const r = await fetch(base + u, o); return { status: r.status, body: await r.json().catch(() => null) }; };
  const post = (u, b) => j(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  try {
    assert.strictEqual((await fetch(base + '/q/ABCDE')).status, 200);
    assert.ok((await (await fetch(base + '/q/ABCDE/host')).text()).includes('host.js'));
    assert.strictEqual((await j('/api/quiz/NOPE2/info')).status, 404);
    const info = await j('/api/quiz/ABCDE/info');
    assert.strictEqual(info.body.total, 10); assert.strictEqual(info.body.url, 'https://x.app/q/ABCDE');
    assert.strictEqual((await j('/api/quiz/ABCDE/host/state?k=bad')).status, 403);
    const me = (await post('/api/quiz/ABCDE/join', { name: 'Айбек' })).body;
    assert.ok(me.pid && me.secret);
    assert.strictEqual((await j('/api/quiz/ABCDE/solo')).status, 200, 'solo works before the game');
    assert.strictEqual((await post('/api/quiz/ABCDE/host', { k: 'bad', action: 'start' })).status, 403);
    assert.strictEqual((await post('/api/quiz/ABCDE/host', { k: 'secret-key', action: 'start' })).body.state.phase, 'question');
    assert.strictEqual((await j('/api/quiz/ABCDE/solo')).status, 409, 'answers not exposed during a live game');
    assert.ok(!('top' in (await j('/api/quiz/ABCDE/host/state?k=secret-key')).body), 'no leaderboard mid-game');
    const st = (await j(`/api/quiz/ABCDE/state?pid=${me.pid}&s=${me.secret}`)).body;
    assert.strictEqual(st.joined, true); assert.ok(!('review' in st) && !('score' in st.me));
    const svg = await fetch(base + '/api/quiz/ABCDE/qr.svg');
    assert.ok((await svg.text()).startsWith('<svg'));
  } finally { srv.close(); }
});
