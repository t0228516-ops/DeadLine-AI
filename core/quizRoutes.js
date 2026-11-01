'use strict';
/**
 * Квиз беттері мен API (Express). Ойын логикасы — core/quiz.js; сақтау — db.saveQuiz/getQuiz.
 *
 *   GET  /q/:code                 — телефон беті (сынып)
 *   GET  /q/:code/host?k=…        — проектор беті (баяндамашы)
 *   GET  /api/quiz/:code/info     — тақырып, тіл, сұрақ саны
 *   GET  /api/quiz/:code/qr.svg   — қосылу QR коды (проектор бетінде)
 *   POST /api/quiz/:code/join     — { name } → { pid, secret, name }
 *   GET  /api/quiz/:code/state    — ?pid&s → ойыншы күйі
 *   POST /api/quiz/:code/answer   — { pid, s, qi, choice }
 *   GET  /api/quiz/:code/host/state?k=…  — проектор күйі
 *   POST /api/quiz/:code/host     — { k, action: start|next|prev|close|review|results|restart }
 *   GET  /api/quiz/:code/results?k=… — баяндамашыға: кім неше сұраққа дұрыс жауап берді (өткен ойындар да) + сынып қорытындысы
 * Ойынды бастау мен келесі сұраққа өту — тек баяндамашы (проектор кілті бар адам).
 *
 * Бөлмелер процесс жадында (Railway — бір дана). Сервер қайта қосылса, ойын лоббиден басталады — квиздің өзі базада.
 */
const fs = require('fs');
const path = require('path');
const Q = require('./quiz');

const ROOM_IDLE_MS = 3 * 3600 * 1000;
const MISS_TTL_MS = 60 * 1000;

function createQuizRouter({ db, webappDir, baseUrl, fontsDir }) {
  const express = require('express');
  const router = express.Router();
  const rooms = new Map();      // code → room
  const loading = new Map();    // code → Promise<room|null>
  const misses = new Map();     // code → ts (жоқ квизді базадан қайта-қайта сұрамау)
  const joins = new Map();      // ip → { n, t } (қосылу шегі)

  async function getRoom(code) {
    if (!Q.isCode(code)) return null;
    const have = rooms.get(code);
    if (have) return have;
    const miss = misses.get(code);
    if (miss && Date.now() - miss < MISS_TTL_MS) return null;
    if (loading.has(code)) return loading.get(code);
    const p = (async () => {
      try {
        const quiz = await db.getQuiz(code);
        if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) { misses.set(code, Date.now()); return null; }
        const room = Q.createRoom(quiz);
        rooms.set(code, room);
        return room;
      } catch (e) {
        console.warn(`[Quiz] load ${code}: ${e.message}`);
        return null;
      } finally { loading.delete(code); }
    })();
    loading.set(code, p);
    return p;
  }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) if (now - room.lastActive > ROOM_IDLE_MS) rooms.delete(code);
    for (const [code, t] of misses) if (now - t > MISS_TTL_MS) misses.delete(code);
    for (const [ip, j] of joins) if (now - j.t > 60_000) joins.delete(ip);
  }, 10 * 60 * 1000);
  if (sweep.unref) sweep.unref();

  const page = (file) => (req, res) => {
    if (!Q.isCode(String(req.params.code || '').toUpperCase())) return res.status(404).type('text').send('Not found');
    try {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Referrer-Policy', 'no-referrer'); // проектор кілті басқа сайтқа кетпесін
      res.type('html').send(fs.readFileSync(path.join(webappDir, 'quiz', file), 'utf8'));
    } catch { res.status(500).send('quiz page error'); }
  };
  // беттің қаріптері (OFL, assets/brand-fonts) — тек осы үшеуі
  const FONTS = new Set(['Montserrat-Bold.ttf', 'Inter-Regular.ttf', 'Inter-Bold.ttf']);
  router.get('/quiz-fonts/:f', (req, res) => {
    if (!FONTS.has(req.params.f) || !fontsDir) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.type('font/ttf').sendFile(path.join(fontsDir, req.params.f));
  });
  router.get('/q/:code', page('play.html'));
  router.get('/q/:code/host', page('host.html'));

  const code = (req) => String(req.params.code || '').toUpperCase();
  const noStore = (res) => res.setHeader('Cache-Control', 'no-store');
  const withRoom = (fn) => async (req, res) => {
    noStore(res);
    try {
      const room = await getRoom(code(req));
      if (!room) return res.status(404).json({ error: 'not_found' });
      return await fn(req, res, room);
    } catch (e) {
      console.warn('[Quiz] api error:', e.message);
      return res.status(500).json({ error: 'server' });
    }
  };
  const hostOk = (room, k) => Q.safeEq(room.quiz.hostKey, k);
  const playerUrl = (req) => {
    const base = baseUrl || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
    return `${String(base).replace(/\/+$/, '')}/q/${code(req)}`;
  };

  router.get('/api/quiz/:code/info', withRoom((req, res, room) => res.json({
    topic: room.quiz.topic, lang: room.quiz.language, total: room.quiz.questions.length, url: playerUrl(req),
  })));

  router.get('/api/quiz/:code/qr.svg', withRoom((req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type('image/svg+xml').send(Q.qrSvg(playerUrl(req), { margin: 2 }));
  }));

  // бір сыныпта бір Wi-Fi → шек жоғары
  const tooMany = (req) => {
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const j = joins.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - j.t > 60_000) { j.n = 0; j.t = Date.now(); }
    j.n += 1; joins.set(ip, j);
    return j.n > 40;
  };

  router.post('/api/quiz/:code/join', withRoom((req, res, room) => {
    if (tooMany(req)) return res.status(429).json({ error: 'slow_down' });
    const r = Q.join(room, req.body && req.body.name);
    if (r.error) return res.status(r.error === 'full' ? 409 : 400).json(r);
    return res.json(r);
  }));

  router.get('/api/quiz/:code/state', withRoom((req, res, room) => res.json(Q.playerView(room, String(req.query.pid || ''), String(req.query.s || '')))));

  router.post('/api/quiz/:code/answer', withRoom((req, res, room) => {
    const b = req.body || {};
    const r = Q.answer(room, String(b.pid || ''), String(b.s || ''), b.qi, b.choice);
    if (r.error) return res.status(r.error === 'player' ? 403 : 409).json(r);
    return res.json({ ok: true, state: Q.playerView(room, String(b.pid), String(b.s)) });
  }));

  router.get('/api/quiz/:code/host/state', withRoom((req, res, room) => {
    if (!hostOk(room, req.query.k)) return res.status(403).json({ error: 'key' });
    return res.json({ ...Q.hostView(room), url: playerUrl(req) });
  }));

  router.post('/api/quiz/:code/host', withRoom((req, res, room) => {
    const b = req.body || {};
    if (!hostOk(room, b.k)) return res.status(403).json({ error: 'key' });
    const r = Q.hostAction(room, String(b.action || ''));
    if (r.error) return res.status(409).json(r);
    // тірі ойын бітті → әр ойыншының нәтижесі базаға (бір рет; «кім неше сұраққа дұрыс жауап берді»)
    if (room.phase === 'end' && !room.savedGame && room.players.size && db.addQuizResults) {
      room.savedGame = true;
      db.addQuizResults(code(req), Q.liveResults(room)).catch((e) => console.warn('[Quiz] save live results:', e.message));
    }
    return res.json({ ok: true, state: { ...Q.hostView(room), url: playerUrl(req) } });
  }));

  // баяндамашыға: барлық нәтиже (тірі ойын + өз бетімен өткендер) және сынып қорытындысы
  router.get('/api/quiz/:code/results', withRoom(async (req, res, room) => {
    if (!hostOk(room, req.query.k)) return res.status(403).json({ error: 'key' });
    const rows = db.listQuizResults ? await db.listQuizResults(code(req)) : [];
    return res.json({
      results: rows.map((r) => ({ name: r.name, right: r.right, total: r.total, mode: r.mode, at: r.at })),
      summary: Q.resultsSummary(room.quiz, rows),
    });
  }));

  router._rooms = rooms; // тесттер үшін
  return router;
}

module.exports = { createQuizRouter };
