'use strict';
/**
 * СЫНЫПҚА АРНАЛҒАН КВИЗ — презентацияның соңында сынып телефонмен ойнайтын 10 сұрақ.
 *
 * Педагогикалық негіз:
 *   • сұрақтар тек презентацияда АЙТЫЛҒАН мазмұннан (сынып жаңа ғана тыңдады) — ойдан факт жоқ;
 *   • оңайдан қиынға: еске түсіру → түсіну (неге/қалай) → қолдану/салыстыру;
 *   • дұрыс/қате ойын кезінде АШЫЛМАЙДЫ (иесінің шешімі): ойын шиеленісті, әлсіз бала әр сұрақта ұялмайды,
 *     ал кешіктірілген кері байланыс есте жақсы сақталады;
 *   • соңында: үздіктер → «жауаптарды талдау» (әр сұрақ: дұрыс жауап, сыныптың % дұрысы, түсіндірме),
 *     ең қиын сұрақ белгіленеді — баяндамашы қайта түсіндіреді; телефонда әркім өз ✓/✕ мен түсіндірмені көреді.
 *
 * Бағдарламалық негіз:
 *   • ойын күйі серверде (жадта), клиенттер секунд сайын сұрайды (polling) — WebSocket керек емес;
 *   • дұрыс жауап пен ұпай ойын біткенше телефонға ЖІБЕРІЛМЕЙДІ (devtools арқылы алдау жоқ);
 *   • уақыт серверде есептеледі: клиентке қалған мс беріледі (телефон сағаты қате болса да дұрыс);
 *   • күй өтуі «жалқау»: кез келген сұрауда уақыт біткені тексеріледі (таймер/интервал керек емес).
 */
const crypto = require('crypto');
const zlib = require('zlib');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O, 1/I жоқ — қолмен терерде шатаспайды
const QUIZ_TTL_MS = 30 * 24 * 3600 * 1000;               // студент презентацияны алдын ала жасайды → 30 күн
const MAX_PLAYERS = 150;
const MIN_QUESTIONS = 6;
const MAX_QUESTIONS = 10;

function makeCode(len = 5) {
  const b = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}
const makeToken = (bytes = 12) => crypto.randomBytes(bytes).toString('base64url');
const isCode = (c) => typeof c === 'string' && /^[A-Z2-9]{4,8}$/.test(c);

function safeEq(a, b) {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

const clean = (v, max) => String(v == null ? '' : v)
  .replace(/\*\*|__|`/g, '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim()
  .slice(0, max);

/** Fisher–Yates; rnd — тесттер үшін */
function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * LLM жауабын тексеріп, ойынға дайын күйге келтіреді.
 * Дұрыс жауап моделі көбіне «A»-ға қояды → нұсқаларды араластырамыз (дұрыс жауап 4 орынға тең бөлінеді).
 * @returns {{q:string, options:string[], correct:number, explain:string}[]}
 */
function normalizeQuestions(raw, rnd = Math.random) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.quiz) ? raw.quiz : []);
  const out = []; const seen = new Set();
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const q = clean(it.q || it.question, 160);
    const opts = (Array.isArray(it.options) ? it.options : []).map((o) => clean(o, 80));
    let c = Number(it.correct);
    if (!Number.isInteger(c) && typeof it.answer === 'string') c = opts.indexOf(clean(it.answer, 80));
    if (q.length < 8 || opts.length !== 4 || !Number.isInteger(c) || c < 0 || c > 3) continue;
    if (opts.some((o) => !o) || new Set(opts.map((o) => o.toLowerCase())).size !== 4) continue;
    if (opts.some((o) => /^(барлығы|бәрі|все|all|none|ешқайсысы|ни один)\b.*(дұрыс|жоғары|верн|above|of the)/i.test(o))) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const right = opts[c];
    const mixed = shuffle(opts, rnd);
    out.push({ q, options: mixed, correct: mixed.indexOf(right), explain: clean(it.explain || it.explanation, 220) });
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out.length >= MIN_QUESTIONS ? out : [];
}

/** Оқу уақыты: сұрақ + нұсқалар ұзындығына қарай 15–30 с (баяу оқитын бала да үлгерсін) */
function questionSeconds(item) {
  const chars = String(item.q || '').length + (item.options || []).reduce((a, o) => a + String(o).length, 0);
  return Math.max(15, Math.min(30, Math.round(10 + chars / 12)));
}

// ─── QR ─────────────────────────────────────────────────────────────────
function qrMatrix(text) {
  const qrcode = require('qrcode-generator');
  const qr = qrcode(0, 'M'); // M: 15% зақым көтереді — проектордан сканерлегенде жеткілікті
  qr.addData(String(text), 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return { n, dark: (r, c) => qr.isDark(r, c) };
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** QR → ақ-қара PNG (тәуелділіксіз). margin — «тыныш аймақ» (стандарт бойынша ≥4 модуль). */
function qrPng(text, { scale = 16, margin = 4 } = {}) {
  const m = qrMatrix(text);
  const size = (m.n + margin * 2) * scale;
  const row = size + 1;
  const raw = Buffer.alloc(row * size, 255);
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0; // filter: none
    const r = Math.floor(y / scale) - margin;
    for (let x = 0; x < size; x++) {
      const c = Math.floor(x / scale) - margin;
      if (r >= 0 && c >= 0 && r < m.n && c < m.n && m.dark(r, c)) raw[y * row + 1 + x] = 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit grayscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** QR → SVG (бет үшін: кез келген өлшемде анық) */
function qrSvg(text, { margin = 4 } = {}) {
  const m = qrMatrix(text);
  const size = m.n + margin * 2;
  let d = '';
  for (let r = 0; r < m.n; r++) {
    for (let c = 0; c < m.n; c++) if (m.dark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// ─── Тірі ойын ──────────────────────────────────────────────────────────
/**
 * Бөлме — бір квиздің бір ойыны.
 * Фазалар: lobby → question → closed (уақыт бітті / бәрі жауап берді; дұрыс жауап АШЫЛМАЙДЫ) → … →
 *          end (үздіктер + сынып нәтижесі) → review (жауаптарды талдау, сұрақ сайын) → end.
 * quiz: { code, topic, language, questions:[{q, options, correct, explain}] }
 */
function createRoom(quiz, now = Date.now()) {
  return {
    quiz,
    phase: 'lobby',
    qi: -1,
    ri: -1,             // талдаудағы сұрақ
    startedAt: 0,
    durMs: 0,
    players: new Map(), // pid → { name, secret, score, answers: [{choice, ok, gained, ms}], joinedAt }
    answers: [],        // qi → Map(pid → choice)
    lastActive: now,
    savedGame: false,   // тірі ойын нәтижесі базаға жазылды ма
    version: 0,
  };
}

function cleanName(name) {
  return String(name || '').replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

function join(room, name, now = Date.now()) {
  room.lastActive = now;
  let n = cleanName(name);
  if (!n) return { error: 'name' };
  if (room.players.size >= MAX_PLAYERS) return { error: 'full' };
  const taken = new Set([...room.players.values()].map((p) => p.name.toLowerCase()));
  if (taken.has(n.toLowerCase())) {
    let k = 2;
    while (taken.has((n.slice(0, 17) + ' ' + k).toLowerCase())) k += 1;
    n = n.slice(0, 17) + ' ' + k;
  }
  const pid = makeToken(6); const secret = makeToken(12);
  room.players.set(pid, { name: n, secret, score: 0, answers: [], joinedAt: now });
  room.version += 1;
  return { pid, secret, name: n };
}

function player(room, pid, secret) {
  const p = room.players.get(String(pid || ''));
  return p && safeEq(p.secret, secret) ? p : null;
}

function remainingMs(room, now) {
  return room.phase === 'question' ? Math.max(0, room.startedAt + room.durMs - now) : 0;
}

/** Уақыт біткенін не бәрі жауап бергенін тексеру (кез келген сұрауда шақырылады) */
function tick(room, now = Date.now()) {
  if (room.phase !== 'question') return;
  const got = room.answers[room.qi] ? room.answers[room.qi].size : 0;
  const everyone = room.players.size > 0 && got >= room.players.size;
  if (remainingMs(room, now) <= 0 || everyone) close(room);
}

function openQuestion(room, qi, now) {
  room.phase = 'question';
  room.qi = qi;
  room.startedAt = now + 1500; // 1,5 с «дайындал» — сұрақты оқып үлгеруге (жауап батырмалары кейін ашылады)
  room.durMs = questionSeconds(room.quiz.questions[qi]) * 1000;
  room.answers[qi] = new Map();
  room.version += 1;
}

function close(room) {
  if (room.phase !== 'question') return;
  room.phase = 'closed';
  room.version += 1;
}

/** Ұпай: дұрыс → 500 + жылдамдыққа 0–500 (ойын қызықты, бірақ білім басты). Ойын біткенше жасырын. */
function answer(room, pid, secret, qi, choice, now = Date.now()) {
  room.lastActive = now;
  tick(room, now);
  const p = player(room, pid, secret);
  if (!p) return { error: 'player' };
  if (room.phase !== 'question' || Number(qi) !== room.qi) return { error: 'closed' };
  if (now < room.startedAt) return { error: 'early' };
  const c = Number(choice);
  if (!Number.isInteger(c) || c < 0 || c > 3) return { error: 'choice' };
  const box = room.answers[room.qi];
  if (box.has(pid)) return { error: 'twice' };
  box.set(pid, c);
  const item = room.quiz.questions[room.qi];
  const ok = c === item.correct;
  const left = remainingMs(room, now);
  const gained = ok ? 500 + Math.round(500 * (left / room.durMs)) : 0;
  p.score += gained;
  p.answers[room.qi] = { choice: c, ok, gained, ms: now - room.startedAt };
  room.version += 1;
  tick(room, now);
  return { ok: true };
}

/** start · next (сұрақты жабу → келесі сұрақ → нәтиже → талдау → … → нәтиже) · close · review · results · restart */
function hostAction(room, action, now = Date.now()) {
  room.lastActive = now;
  tick(room, now);
  const total = room.quiz.questions.length;
  const bump = () => { room.version += 1; };
  if (action === 'start') {
    if (room.phase !== 'lobby') return { error: 'state' };
    openQuestion(room, 0, now);
  } else if (action === 'close' || action === 'reveal') {
    close(room);
  } else if (action === 'next') {
    if (room.phase === 'question') close(room);
    else if (room.phase === 'closed') {
      if (room.qi + 1 < total) openQuestion(room, room.qi + 1, now);
      else { room.phase = 'end'; bump(); }
    } else if (room.phase === 'end') { room.phase = 'review'; room.ri = 0; bump(); }
    else if (room.phase === 'review') {
      if (room.ri + 1 < total) room.ri += 1; else room.phase = 'end';
      bump();
    } else return { error: 'state' };
  } else if (action === 'prev') {
    if (room.phase !== 'review') return { error: 'state' };
    if (room.ri > 0) room.ri -= 1; else room.phase = 'end';
    bump();
  } else if (action === 'review') {
    if (room.phase !== 'end' && room.phase !== 'review') return { error: 'state' };
    room.phase = 'review'; room.ri = 0; bump();
  } else if (action === 'results') {
    if (room.phase !== 'review') return { error: 'state' };
    room.phase = 'end'; bump();
  } else if (action === 'restart') {
    room.phase = 'lobby'; room.qi = -1; room.ri = -1; room.answers = []; room.savedGame = false;
    room.players.forEach((p) => { p.score = 0; p.answers = []; });
    bump();
  } else return { error: 'action' };
  return { ok: true };
}

const finished = (room) => room.phase === 'end' || room.phase === 'review';

function ranking(room) {
  return [...room.players.entries()]
    .map(([pid, p]) => ({ pid, name: p.name, score: p.score, right: p.answers.filter((a) => a && a.ok).length }))
    .sort((a, b) => b.score - a.score || b.right - a.right || a.name.localeCompare(b.name));
}

/** Бір сұрақтың сынып нәтижесі */
function questionStats(room, i) {
  const item = room.quiz.questions[i];
  const counts = [0, 0, 0, 0];
  const box = room.answers[i];
  if (box) box.forEach((c) => { counts[c] += 1; });
  const n = box ? box.size : 0;
  return { counts, answered: n, pct: n ? Math.round((counts[item.correct] / n) * 100) : null };
}

/** Сынып нәтижесі: әр сұрақтың дұрыс жауап үлесі, ең қиыны, орташа балл */
function classStats(room) {
  const total = room.quiz.questions.length;
  const per = room.quiz.questions.map((_, i) => ({ i, ...questionStats(room, i) }));
  const played = per.filter((x) => x.answered > 0);
  const hardest = played.length ? played.slice().sort((a, b) => a.pct - b.pct || a.i - b.i)[0] : null;
  const players = room.players.size;
  const avg = players ? Math.round((ranking(room).reduce((a, r) => a + r.right, 0) / players) * 10) / 10 : 0;
  const q = hardest ? room.quiz.questions[hardest.i] : null;
  return {
    total, players, avgRight: avg,
    hardest: hardest && hardest.pct < 100 ? { n: hardest.i + 1, q: q.q, pct: hardest.pct, answer: q.options[q.correct] } : null,
  };
}

/** Проектор көретін күй */
function hostView(room, now = Date.now()) {
  tick(room, now);
  const total = room.quiz.questions.length;
  const v = {
    phase: room.phase, qi: room.qi, ri: room.ri, total, version: room.version,
    topic: room.quiz.topic, lang: room.quiz.language,
    players: room.players.size,
  };
  if (room.phase === 'lobby') v.names = [...room.players.values()].slice(-60).map((p) => p.name);
  if (room.phase === 'question' || room.phase === 'closed') {
    const item = room.quiz.questions[room.qi];
    v.question = { q: item.q, options: item.options };
    v.remainingMs = remainingMs(room, now);
    v.waitMs = Math.max(0, room.startedAt - now);
    v.durMs = room.durMs;
    v.answered = room.answers[room.qi] ? room.answers[room.qi].size : 0;
  }
  if (finished(room)) {
    v.top = ranking(room).slice(0, 10).map(({ name, score, right }) => ({ name, score, right }));
    v.stats = classStats(room);
  }
  if (room.phase === 'review') {
    const item = room.quiz.questions[room.ri];
    const st = questionStats(room, room.ri);
    v.ri = room.ri;
    v.item = { q: item.q, options: item.options, correct: item.correct, explain: item.explain, counts: st.counts, pct: st.pct, answered: st.answered };
    v.hardest = !!(v.stats.hardest && v.stats.hardest.n === room.ri + 1);
  }
  return v;
}

/** Телефон көретін күй: ойын кезінде тек «қабылданды»; дұрыс/қате, ұпай, орын — тек соңында */
function playerView(room, pid, secret, now = Date.now()) {
  tick(room, now);
  const p = player(room, pid, secret);
  const total = room.quiz.questions.length;
  const v = { phase: room.phase, qi: room.qi, total, version: room.version, topic: room.quiz.topic, lang: room.quiz.language, joined: !!p };
  if (!p) return v;
  v.me = { name: p.name };
  if (room.phase === 'question' || room.phase === 'closed') {
    const item = room.quiz.questions[room.qi];
    v.question = { q: item.q, options: item.options };
    v.remainingMs = remainingMs(room, now);
    v.waitMs = Math.max(0, room.startedAt - now);
    v.durMs = room.durMs;
    const a = p.answers[room.qi];
    v.myChoice = a ? a.choice : null;
  }
  if (finished(room)) {
    const rk = ranking(room);
    v.me.score = p.score;
    v.me.rank = rk.findIndex((r) => r.pid === pid) + 1;
    v.me.of = rk.length;
    v.me.right = p.answers.filter((a) => a && a.ok).length;
    // әр сұрақ: өз жауабы ✓/✕, дұрыс жауап, түсіндірме (үйрену үшін)
    v.review = room.quiz.questions.map((item, i) => ({
      q: item.q, answer: item.options[item.correct], explain: item.explain,
      mine: p.answers[i] ? item.options[p.answers[i].choice] : null, ok: !!(p.answers[i] && p.answers[i].ok),
    }));
  }
  return v;
}

/** Тірі ойын біткенде — әр ойыншының нәтижесі (базаға бір рет жазу үшін) */
function liveResults(room) {
  return ranking(room).map((r) => ({
    name: r.name, right: r.right, total: room.quiz.questions.length, score: r.score, mode: 'live',
    answers: room.quiz.questions.map((_, i) => { const a = room.players.get(r.pid).answers[i]; return a ? a.choice : null; }),
  }));
}

/** Нәтижелер тізімінен сынып қорытындысы: орташа, әр сұрақтың %, ең қиыны */
function resultsSummary(quiz, rows) {
  const total = quiz.questions.length;
  const per = quiz.questions.map((item, i) => {
    const got = rows.filter((r) => Array.isArray(r.answers) && r.answers[i] != null);
    const right = got.filter((r) => r.answers[i] === item.correct).length;
    return { n: i + 1, answered: got.length, pct: got.length ? Math.round((right / got.length) * 100) : null };
  });
  const played = per.filter((x) => x.answered > 0);
  const hard = played.length ? played.slice().sort((a, b) => a.pct - b.pct || a.n - b.n)[0] : null;
  const avg = rows.length ? Math.round((rows.reduce((a, r) => a + (r.right || 0), 0) / rows.length) * 10) / 10 : 0;
  return {
    count: rows.length, total, avgRight: avg, per,
    hardest: hard && hard.pct < 100 ? { n: hard.n, q: quiz.questions[hard.n - 1].q, pct: hard.pct, answer: quiz.questions[hard.n - 1].options[quiz.questions[hard.n - 1].correct] } : null,
  };
}

module.exports = {
  QUIZ_TTL_MS, MAX_PLAYERS, MIN_QUESTIONS, MAX_QUESTIONS,
  makeCode, makeToken, isCode, safeEq, normalizeQuestions, questionSeconds, shuffle,
  qrMatrix, qrPng, qrSvg,
  createRoom, join, answer, hostAction, tick, hostView, playerView, ranking, classStats, questionStats, cleanName,
  liveResults, resultsSummary,
};
