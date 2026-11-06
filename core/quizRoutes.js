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
 *
 * Баяндамашыға ескерту (onLobbyWaiting): лоббиде ≥3 адам күтіп, басқару беті ашылмаса — бот баяндамашыға
 * «адамдар қосылды, ойынды сіз бастауыңыз керек» деп жазады (ең көбі 2 рет). 2026-11-03-те бүкіл топ (17 телефон)
 * 7 минут күтіп, ойын басталмай қалды: баяндамашы басқару бетін ашпаған.
 */
const fs = require('fs');
const path = require('path');
const Q = require('./quiz');

const ROOM_IDLE_MS = 3 * 3600 * 1000;
const MISS_TTL_MS = 60 * 1000;
const NUDGE_DEFAULTS = {
  minPlayers: 3,        // баяндамашының өзі тексеріп кірсе — ескертпейміз
  delayMs: 20_000,      // қосылғаннан кейін аз күтеміз: баяндамашы басқару бетін ашып жатуы мүмкін
  hostFreshMs: 30_000,  // басқару беті соңғы 30 с ішінде сұраныс жіберсе — ол ашық, ескерту керек емес
  gapMs: 3 * 60_000,    // екінші ескерту — әлі басталмаса, 3 минуттан кейін
  max: 2,
};

function createQuizRouter({ db, webappDir, baseUrl, fontsDir, onLobbyWaiting, nudge }) {
  const NUDGE = { ...NUDGE_DEFAULTS, ...(nudge || {}) };
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

  // Telegram ішіндегі браузер /webapp/* файлдарын 7 күн кэштейді → жаңа нұсқа шыққанда ескі CSS/JS қалып қоятын.
  // Беттегі сілтемелерге файлдардың мазмұнынан алынған нұсқа (?v=…) қосылады: файл өзгерсе — браузер жаңасын жүктейді.
  const assetVer = (() => {
    try {
      const h = require('crypto').createHash('sha1');
      for (const f of ['quiz.css', 'i18n.js', 'host.js', 'play.js']) h.update(fs.readFileSync(path.join(webappDir, 'quiz', f)));
      return h.digest('hex').slice(0, 10);
    } catch { return String(Date.now()); }
  })();
  const page = (file) => (req, res) => {
    if (!Q.isCode(String(req.params.code || '').toUpperCase())) return res.status(404).type('text').send('Not found');
    try {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Referrer-Policy', 'no-referrer'); // проектор кілті басқа сайтқа кетпесін
      res.type('html').send(fs.readFileSync(path.join(webappDir, 'quiz', file), 'utf8')
        .replace(/(\/webapp\/quiz\/(?:quiz\.css|i18n\.js|host\.js|play\.js))"/g, `$1?v=${assetVer}"`));
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

  const hostFresh = (room) => room.hostSeenAt && Date.now() - room.hostSeenAt < NUDGE.hostFreshMs;
  // лоббиде адамдар күтіп отыр, басқару беті жабық → баяндамашыға бот арқылы ескерту (таймер — бөлмеге біреу)
  function scheduleNudge(room, req, delayMs) {
    if (typeof onLobbyWaiting !== 'function' || !room.quiz.chatId) return;
    if (room.nudgeTimer || (room.nudges || 0) >= NUDGE.max) return;
    const hostUrl = `${playerUrl(req)}/host?k=${encodeURIComponent(room.quiz.hostKey)}`;
    const c = code(req);
    room.nudgeTimer = setTimeout(() => {
      room.nudgeTimer = null;
      if (rooms.get(c) !== room || room.phase !== 'lobby' || room.players.size < NUDGE.minPlayers || hostFresh(room)) return;
      room.nudges = (room.nudges || 0) + 1;
      const n = room.nudges;
      console.log(`[Quiz] ${c}: ${room.players.size} waiting, host page closed → presenter notified (#${n})`);
      Promise.resolve()
        .then(() => onLobbyWaiting({ chatId: room.quiz.chatId, code: c, topic: room.quiz.topic, players: room.players.size, hostUrl, nudge: n }))
        .catch((e) => console.warn(`[Quiz] ${c}: notify presenter failed: ${e.message}`));
      if (n < NUDGE.max) scheduleNudge(room, req, NUDGE.gapMs);
    }, delayMs);
    if (room.nudgeTimer.unref) room.nudgeTimer.unref();
  }

  router.post('/api/quiz/:code/join', withRoom((req, res, room) => {
    if (tooMany(req)) return res.status(429).json({ error: 'slow_down' });
    const r = Q.join(room, req.body && req.body.name);
    if (r.error) return res.status(r.error === 'full' ? 409 : 400).json(r);
    if (room.phase === 'lobby' && room.players.size >= NUDGE.minPlayers && !hostFresh(room)) scheduleNudge(room, req, NUDGE.delayMs);
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
    room.hostSeenAt = Date.now();
    return res.json({ ...Q.hostView(room), url: playerUrl(req) });
  }));

  router.post('/api/quiz/:code/host', withRoom((req, res, room) => {
    const b = req.body || {};
    if (!hostOk(room, b.k)) return res.status(403).json({ error: 'key' });
    room.hostSeenAt = Date.now();
    // қос басудан / желі қайталауынан сақтандыру: батырма басылған кездегі күй (at) қазіргіден өзгеше болса — әрекет қайталанбайды
    Q.tick(room);
    if (b.at && String(b.at) !== `${room.phase}:${room.qi}:${room.ri}`) return res.json({ ok: true, stale: true, state: { ...Q.hostView(room), url: playerUrl(req) } });
    const before = room.phase;
    const r = Q.hostAction(room, String(b.action || ''));
    if (r.error) return res.status(409).json(r);
    // квиз статистикасы логта (тек сандар, аттар жоқ): қанша адаммен басталды, қанша адаммен бітті
    if (before === 'lobby' && room.phase !== 'lobby') console.log(`[Quiz] ${code(req)}: game started, ${room.players.size} players`);
    if (room.phase === 'lobby') room.loggedEnd = false; // «қайта бастау» → келесі ойын да логқа түседі
    if (room.phase === 'end' && !room.loggedEnd) { room.loggedEnd = true; console.log(`[Quiz] ${code(req)}: game finished, ${room.players.size} players`); }
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
