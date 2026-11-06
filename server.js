'use strict';

require('./core/crashGuard').install(); // ұсталмаған қате ботты құлатпайды
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

const { generatePresentation } = require('./products/presentation/index');
const { generateReferat } = require('./products/referat/index');
const { analyzeMaterialFile } = require('./core/materials');
const { ratingKeyboard, ratePromptText, rateDueAt } = require('./core/feedbackUi');
const {
  initDB, getUser, registerUser, useCredit, refundCredit, releaseFreeDeck,
  checkRateLimits, markGenerationAttempt, markGenerationSuccess,
  createJob, updateJob, getJob, getUserJobs, addHistory, getHistory,
  cleanupOldJobs, listUnfinishedJobs, REFERRALS_PER_BONUS, incrementRefCount, closeDB, backend: DB_BACKEND, saveLearnedTemplate, addLearnUse, setFeedback, getFeedbackForJob,
  scheduleRatePrompt, takeDueRatePrompts, recentRateContact, logEvent, setUserProfile, logGen, adminData, addCredits,
  getTester, findUser, setTester, addTesterCredits, useTesterCredit, refundTesterCredit, setTesterPending, testerData,
  getDesignMemory, pushDesignMemory, saveQuiz, getQuiz, deleteExpiredQuizzes, addQuizResults, listQuizResults,
  updateQuizQuestions, countFreeQuizzes, listFreeQuizzes, eventSince, addBonusCredits,
} = require('./db');
const designMemory = require('./core/designMemory');
const libraryCore = require('./products/presentation/library');
const testerCore = require('./core/tester');
const adminCalc = require('./core/admin');
const quizMaker = require('./core/quizMaker');
const QuizCore = require('./core/quiz');

// ─── Config ───────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = (process.env.BOT_USERNAME || 'DeadLine_prezbot').replace(/^@/, '');
// Админ (ADMIN_CHAT_ID): Mini App-та «Админ» бөлімі ашылады, /api/admin/* тек соған
const ADMIN_IDS = String(process.env.ADMIN_CHAT_ID || '').split(',').map((x) => x.trim()).filter(Boolean);
const isAdminId = (id) => ADMIN_IDS.includes(String(id));
const MAINTENANCE = /^(1|true|on)$/i.test(String(process.env.MAINTENANCE || ''));
const WEBAPP_URL = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
// Топқа квиз: QR пен «Квизді бастау» батырмасы осы мекенжайға апарады (жария https керек; жоқ болса — квиз қосылмайды)
// Канал (нұсқаулық видео, жаңалықтар): әр презентацияның астында жіберіледі
const CHANNEL_URL = (process.env.CHANNEL_URL || 'https://t.me/deadline_ai').trim();
const QUIZ_BASE_URL = (process.env.QUIZ_BASE_URL || process.env.WEBAPP_URL || '').replace(/\/+$/, '');

const templateNudged = new Set();
async function nudgeTemplate(chatId) {
  if (!global.__deadlineBot || templateNudged.has(String(chatId))) return;
  templateNudged.add(String(chatId));
  const url = WEBAPP_URL.replace(/\/$/, '') + '/webapp/#template';
  await global.__deadlineBot.sendMessage(chatId,
    '💡 Ұнаған дизайн бар ма? Енді өз шаблоныңызды (.pptx) жүктесеңіз болады — түсі, шрифті, суреттері сол күйі қалады, бот тек мәтінді сіздің тақырыбыңызға жазады.',
    { reply_markup: { inline_keyboard: [[{ text: '🎨 Өз шаблоныммен жасау', web_app: { url } }]] } });
}
const MAX_CONCURRENT = Math.max(1, parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '3', 10) || 3);
const MAX_TOPIC_CHARS = Math.max(200, parseInt(process.env.MAX_TOPIC_CHARS || '8000', 10) || 8000);
const { PRICE, FIRST_PRICE, PLUS, PACK } = require('./core/pricing');
const { formatReport } = require('./requirements');
const KASPI_PHONE = process.env.KASPI_PHONE || '+77713436592';
const KASPI_NAME = process.env.KASPI_NAME || 'Мурзабек Н';

if (!TELEGRAM_BOT_TOKEN) {
  console.error('[Server] TELEGRAM_BOT_TOKEN required');
  process.exit(1);
}
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('[Server] DEEPSEEK_API_KEY required');
  process.exit(1);
}

// ─── Express ──────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// Static Mini App
// Кэш: index.html ешқашан кэштелмейді, ал app.js/styles.css сілтемесіне нұсқа (?v=…) қосылады —
// әр деплойдан кейін Telegram WebView ескі файлды көрсетпейді (бұрын 1 сағат ескі app.js қалатын).
const WEBAPP_DIR = path.join(__dirname, 'webapp');
const assetVersion = (() => {
  try {
    const h = require('crypto').createHash('sha1');
    for (const f of ['app.js', 'admin.js', 'quizmaker.js', 'styles.css', 'index.html']) h.update(fs.readFileSync(path.join(WEBAPP_DIR, f)));
    return h.digest('hex').slice(0, 10);
  } catch { return String(Date.now()); }
})();
const sendIndex = (req, res) => {
  try {
    const html = fs.readFileSync(path.join(WEBAPP_DIR, 'index.html'), 'utf8')
      .replace(/(src|href)="(app\.js|admin\.js|quizmaker\.js|styles\.css)"/g, `$1="$2?v=${assetVersion}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.type('html').send(html);
  } catch (e) { res.status(500).send('webapp error'); }
};
app.get(['/webapp', '/webapp/', '/webapp/index.html'], sendIndex);
// Топқа квиз: /q/КОД (телефон), /q/КОД/host (проектор) + /api/quiz/*
app.use(require('./core/quizRoutes').createQuizRouter({
  db: { getQuiz, addQuizResults, listQuizResults, updateQuizQuestions },
  webappDir: WEBAPP_DIR, baseUrl: QUIZ_BASE_URL || null,
  fontsDir: path.join(__dirname, 'products', 'presentation', 'assets', 'brand-fonts'),
  onLobbyWaiting: (x) => notifyQuizHost(x),
  botUrl: BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : null,
  replaceQuestion: (x) => quizMaker.replaceQuestion(x),
}));
app.use('/webapp', express.static(WEBAPP_DIR, {
  index: false,
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,   // ?v=… өзгергенде жаңа файл жүктеледі
  setHeaders(res) {
    res.setHeader('X-Frame-Options', 'ALLOWALL'); // Telegram WebView
  },
}));

// Jobs output dir (PPTX/HTML served securely)
// Railway-де файлдар жүйесі уақытша: сақтау керек болса Volume қосып, JOBS_DIR=/data/jobs сияқты беріңіз
const JOBS_DIR = process.env.JOBS_DIR || path.join(__dirname, 'jobs');
// ─── Тегін бірінші презентация — алынып тасталды (иесінің шешімі). Бұрын басталған тегін жұмыстар ғана осы шекпен аяқталады ───
const FREE_MAX_SLIDES = 10;
// Mini App стиль галереясындағы жүйелер (webapp/styles/<id>-1..3.jpg)
const GALLERY_DESIGNS = new Set(['bordeaux', 'northline', 'poster', 'regalia', 'vivid', 'heritage', 'vital', 'verde', 'hexa', 'meadow', 'libro', 'terra', 'aurum']);
const madeInUrl = () => (process.env.BOT_USERNAME ? `https://t.me/${process.env.BOT_USERNAME}?start=madein` : null);
const speechFile = (jobId) => path.join(JOBS_DIR, String(jobId).replace(/[^\w-]/g, ''), 'speech.docx');
fs.mkdirSync(JOBS_DIR, { recursive: true });

// ─── Telegram WebApp initData validation ──────────────────────────────────
function validateInitData(initData) {
  if (!initData || typeof initData !== 'string') return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();
    const calculated = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    if (calculated !== hash) return null;

    // Auth date freshness (24h)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (Date.now() / 1000 - authDate > 86400) return null;

    const userRaw = params.get('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);
    if (!user || !user.id) return null;
    return user;
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || req.query.initData || '';
  const user = validateInitData(initData);
  if (!user) {
    // Dev fallback: allow ?devUser=123 when WEBAPP_DEV=1
    if (process.env.WEBAPP_DEV === '1' && req.query.devUser) {
      req.tgUser = { id: parseInt(req.query.devUser, 10), first_name: 'Dev' };
      return next();
    }
    return res.status(401).json({ error: 'unauthorized', message: 'Telegram WebApp auth required' });
  }
  req.tgUser = user;
  next();
}

// ─── Кітапхана шаблондарын жеке қоймаға жүктеу (тек LIBRARY_UPLOAD_TOKEN бар болса; жүктеп болған соң айнымалы өшіріледі) ───
app.put('/api/library/:id', express.raw({ type: '*/*', limit: '80mb' }), async (req, res) => {
  const token = process.env.LIBRARY_UPLOAD_TOKEN || '';
  const got = String(req.headers['x-upload-token'] || '');
  if (token.length < 24 || got.length !== token.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(token))) return res.status(404).end();
  const id = String(req.params.id || '');
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id) || !Buffer.isBuffer(req.body) || req.body.length < 10000 || req.body.readUInt32LE(0) !== 0x04034b50) return res.status(400).json({ error: 'bad file' });
  try {
    await require('./products/presentation/library/s3').putObject(`canva/${id}.pptx`, req.body);
    res.json({ ok: true, id, bytes: req.body.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '3.0.0', service: 'DeadLine' });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const chatId = String(req.tgUser.id);
    let user = await getUser(chatId);
    if (!user) {
      await registerUser(chatId, null);
      user = await getUser(chatId);
    }
    logEvent(chatId, 'app').catch(() => {});
    setUserProfile(chatId, { name: [req.tgUser.first_name, req.tgUser.last_name].filter(Boolean).join(' '), username: req.tgUser.username }).catch(() => {});
    res.json({
      isAdmin: isAdminId(chatId),
      id: chatId,
      firstName: req.tgUser.first_name || '',
      lastName: req.tgUser.last_name || '',
      username: req.tgUser.username || '',
      credits: user.credits || 0,
      total: user.total || 0,
      refEarnings: user.refEarnings || 0,
      referralLink: `https://t.me/${BOT_USERNAME}?start=ref_${chatId}`,
      price: PRICE,
      plus: { amount: PLUS.amount, credits: PLUS.credits },
      pack: { name: PACK.name, amount: PACK.amount, credits: PACK.credits },
      firstPrice: (user.total || 0) === 0 ? FIRST_PRICE : null,
      kaspi: { phone: KASPI_PHONE, name: KASPI_NAME },
      referralsPerBonus: REFERRALS_PER_BONUS,
      tester: testerCore.testerView(await getTester(chatId).catch(() => null)),
    });
  } catch (err) {
    console.error('[API] /me', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/history', authMiddleware, async (req, res) => {
  try {
    const list = await getHistory(req.tgUser.id, 30);
    // Тарихта реферат па, презентация ма — job payload-тан аламыз
    let modes = {}; const done = new Set();
    try {
      const jobs = await getUserJobs(req.tgUser.id, 50);
      for (const j of jobs) { modes[j.id] = j.payload?.mode || 'presentation'; if (j.status === 'done') done.add(j.id); }
    } catch {}
    // Баға: жұмыс әлі сақталса (48 сағат) бағалауға болады; бар бағаны көрсетеміз
    const ratings = {};
    await Promise.all(list.filter((h) => done.has(h.id)).map(async (h) => {
      try { const f = await getFeedbackForJob(h.id); if (f && String(f.chat_id) === String(req.tgUser.id)) ratings[h.id] = f.rating; } catch {}
    }));
    res.json({ items: list.map(h => ({ ...h, mode: modes[h.id] || 'presentation', canRate: done.has(h.id), rating: ratings[h.id] || null, hasSpeech: fs.existsSync(speechFile(h.id)) })) });
  } catch (err) {
    console.error('[API] /history', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/jobs', authMiddleware, async (req, res) => {
  try {
    const list = await getUserJobs(req.tgUser.id, 20);
    res.json({
      items: list.map(j => ({
        id: j.id,
        status: j.status,
        phase: j.phase,
        detail: j.detail,
        progress: j.progress,
        title: j.title,
        qualityScore: j.qualityScore,
        error: j.error,
        createdAt: j.createdAt,
        finishedAt: j.finishedAt,
        mode: j.payload?.mode || 'presentation',
        hasPptx: j.payload?.mode !== 'referat' && !!j.pptxPath,
        hasDocx: j.payload?.mode === 'referat' && !!j.pptxPath,
        hasSpeech: fs.existsSync(speechFile(j.id)),
      })),
    });
  } catch (err) {
    console.error('[API] /jobs', err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/job/:id', authMiddleware, async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job || job.chatId !== String(req.tgUser.id)) {
      return res.status(404).json({ error: 'not_found' });
    }
    let requirementsReport = null;
    try {
      const rp = path.join(JOBS_DIR, job.id, 'requirements.json');
      if (fs.existsSync(rp)) requirementsReport = JSON.parse(fs.readFileSync(rp, 'utf8'));
    } catch {}
    let templateReport = null;
    try {
      const tp = path.join(JOBS_DIR, job.id, 'template.json');
      if (fs.existsSync(tp)) templateReport = JSON.parse(fs.readFileSync(tp, 'utf8'));
    } catch {}
    res.json({
      requirementsReport,
      templateReport,
      id: job.id,
      status: job.status,
      phase: job.phase,
      detail: job.detail,
      progress: job.progress,
      title: job.title,
      qualityScore: job.qualityScore,
      error: job.error,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      mode: job.payload?.mode || 'presentation',
      hasPptx: job.payload?.mode !== 'referat' && !!job.pptxPath,
      hasDocx: job.payload?.mode === 'referat' && !!job.pptxPath,
      hasSpeech: fs.existsSync(speechFile(job.id)),
      feedback: await getFeedbackForJob(job.id).then((f) => (f && String(f.chat_id) === job.chatId ? { rating: f.rating, comment: f.comment || '' } : null)).catch(() => null),
      payload: {
        topic: job.payload?.topic,
        slideCount: job.payload?.slideCount,
        pages: job.payload?.pages,
        language: job.payload?.language,
        style: job.payload?.style,
      },
    });
  } catch (err) {
    console.error('[API] /job', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Клиент бағасы (1–5) және пікірі. Баға бірінші, пікір кейін қосылуы мүмкін; қайта жіберілсе — жаңарады.
app.post('/api/job/:id/feedback', authMiddleware, async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job || job.chatId !== String(req.tgUser.id)) return res.status(404).json({ error: 'not_found' });
    if (job.status !== 'done') return res.status(400).json({ error: 'not_done' });
    const body = req.body || {};
    const rating = body.rating == null ? null : parseInt(body.rating, 10);
    if (rating != null && !(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'bad_rating' });
    const comment = body.comment == null ? null : String(body.comment).replace(/\u0000/g, '').trim().slice(0, 1000);
    if (rating == null && comment == null) return res.status(400).json({ error: 'empty' });
    const fb = await setFeedback(job.id, job.chatId, { rating, comment });
    if (!fb) return res.status(400).json({ error: 'rating_first', message: 'Алдымен жұлдызша қойыңыз' });
    res.json({ rating: fb.rating, comment: fb.comment || '' });
  } catch (err) {
    console.error('[API] feedback', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Референс PPTX жүктеу (тек .pptx): сырой бинарлы дене, DNA талданады, файл уақытша сақталады
const REF_DIR = path.join(JOBS_DIR, '_ref');
fs.mkdirSync(REF_DIR, { recursive: true });
app.post('/api/reference', authMiddleware, express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  try {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length < 1000 || buf.readUInt32LE(0) !== 0x04034b50) {
      return res.status(400).json({ error: 'not_pptx', message: 'Тек .pptx файлы қабылданады' });
    }
    let an;
    try { an = require('./design-dna').analyzeReference(buf); }
    catch { return res.status(400).json({ error: 'not_pptx', message: 'Бұл .pptx емес немесе оқылмады' }); }
    const maxN = require('./design-dna').MAX_REFERENCE_SLIDES;
    if (an.outline.slideCount > maxN) {
      return res.status(400).json({ error: 'too_large', message: `Референс ${maxN} слайдтан аспауы керек (қазір ${an.outline.slideCount})` });
    }
    const refId = `${String(req.tgUser.id)}-${Date.now().toString(36)}`;
    fs.writeFileSync(path.join(REF_DIR, refId + '.pptx'), buf);
    res.json({ refId, lines: an.summaryLines, slides: an.outline.slideCount, warnings: an.warnings });
  } catch (e) { console.error('[API] /reference', e); res.status(500).json({ error: 'server_error' }); }
});

// Материал жүктеу (Mode 2/3): PDF, DOC/DOCX, PPT/PPTX, TXT, сурет/screenshot.
// Файл сақталады және мазмұны толық талданады — жауапта preview мен түрі қайтарылады.
const MATERIAL_DIR = path.join(JOBS_DIR, '_mat');
fs.mkdirSync(MATERIAL_DIR, { recursive: true });
const MATERIAL_EXT = /\.(pdf|docx?|pptx?|txt|md|rtf|csv|json|log|png|jpe?g|webp|gif|bmp)$/i;
app.post('/api/material', authMiddleware, express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  try {
    const buf = req.body;
    const name = String(req.query.name || req.headers['x-file-name'] || 'file');
    if (!Buffer.isBuffer(buf) || buf.length < 4) {
      return res.status(400).json({ error: 'bad_file', message: 'Бос немесе зақымдалған файл' });
    }
    if (!MATERIAL_EXT.test(name)) {
      return res.status(400).json({ error: 'bad_type', message: 'Қолдау көрсетілмейтін формат. PDF, DOC(X), PPT(X), TXT немесе сурет жүктеңіз' });
    }
    const analysis = await analyzeMaterialFile({ buffer: buf, name });
    if (!analysis.text && analysis.kind !== 'image') {
      return res.status(422).json({ error: 'unreadable', message: analysis.note || 'Файлдан мәтін алынбады', preview: '' });
    }
    const materialId = `${String(req.tgUser.id)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const ext = (name.split('.').pop() || 'bin').slice(0, 8);
    fs.writeFileSync(path.join(MATERIAL_DIR, materialId + '.' + ext), buf);
    res.json({
      materialId,
      name: String(name).slice(0, 120),
      kind: analysis.kind,
      preview: analysis.preview,
      meta: analysis.meta || {},
      note: analysis.note || '',
    });
  } catch (e) { console.error('[API] /material', e); res.status(500).json({ error: 'server_error' }); }
});

// ─── Тегін квиз (маркетинг, 2026-11-06): тақырыптан не өз материалынан 30 секундта тірі квиз ───────────────
// Шек: бір адамға күніне QUIZ_FREE_PER_DAY (әдепкі 3), бәріне күніне QUIZ_FREE_DAILY_CAP (әдепкі 1000) — шығынға сақтандыру.
// Қатар екі сұраныс (қос басу) бір адамнан қабылданбайды. Сұрақтарды тек квиз иесі (host key) өзгерте алады — core/quizRoutes.
const QUIZ_FREE_PER_DAY = Math.max(0, parseInt(process.env.QUIZ_FREE_PER_DAY || '3', 10) || 0);
const QUIZ_FREE_DAILY_CAP = Math.max(0, parseInt(process.env.QUIZ_FREE_DAILY_CAP || '1000', 10) || 0);
/** Алматы тәулігінің басы (UTC+5, воронкамен бірдей) */
const almatyDayStart = (t = Date.now()) => { const d = new Date(t + 5 * 3600e3); d.setUTCHours(0, 0, 0, 0); return d.getTime() - 5 * 3600e3; };
const quizMaking = new Set(); // қазір квиз жасатып жатқан адамдар

async function freeQuizLeft(chatId) {
  if (isAdminId(chatId)) return QUIZ_FREE_PER_DAY || 99; // админ сынай алсын (шексіз)
  const used = await countFreeQuizzes({ chatId, since: almatyDayStart() });
  return Math.max(0, QUIZ_FREE_PER_DAY - used);
}
const quizLinks = (code, hostKey) => {
  const base = QUIZ_BASE_URL || '';
  return { player: `${base}/q/${code}`, host: `${base}/q/${code}/host?k=${encodeURIComponent(hostKey)}` };
};

app.get('/api/quiz-maker', authMiddleware, async (req, res) => {
  try {
    const chatId = String(req.tgUser.id);
    const [left, mine] = await Promise.all([freeQuizLeft(chatId), listFreeQuizzes(chatId, 10)]);
    res.json({
      left, perDay: QUIZ_FREE_PER_DAY, min: quizMaker.MIN_COUNT, max: quizMaker.MAX_COUNT,
      quizzes: mine.map((z) => ({ code: z.code, topic: z.topic, n: z.n, createdAt: z.createdAt, hostKey: z.hostKey, links: quizLinks(z.code, z.hostKey) })),
    });
  } catch (e) { console.error('[API] /quiz-maker', e); res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/quiz-maker/create', authMiddleware, async (req, res) => {
  const chatId = String(req.tgUser.id);
  if (quizMaking.has(chatId)) return res.status(409).json({ error: 'busy', message: 'Квиз жасалып жатыр — бір сәт күтіңіз' });
  quizMaking.add(chatId);
  const t0 = Date.now();
  try {
    const b = req.body || {};
    const topic = String(b.topic || '').replace(/\s+/g, ' ').trim();
    if (topic.length < 3) return res.status(400).json({ error: 'invalid_topic', message: 'Тақырыпты жазыңыз' });
    if (topic.length > quizMaker.MAX_TOPIC) return res.status(400).json({ error: 'topic_too_long', message: `Тақырып ${quizMaker.MAX_TOPIC} таңбадан аспасын` });
    if (MAINTENANCE && !isAdminId(chatId) && !testerCore.isActive(await getTester(chatId).catch(() => null))) {
      return res.status(503).json({ error: 'maintenance', message: '🛠 DeadLine жаңартылып жатыр — жақында ораламыз!' });
    }
    if (!(await getUser(chatId))) await registerUser(chatId, null);
    if ((await freeQuizLeft(chatId)) <= 0) {
      return res.status(429).json({ error: 'daily_limit', message: `Бүгінгі ${QUIZ_FREE_PER_DAY} тегін квиз бітті — ертең қайта жасай аласыз 🙂` });
    }
    if (QUIZ_FREE_DAILY_CAP && (await countFreeQuizzes({ since: almatyDayStart() })) >= QUIZ_FREE_DAILY_CAP) {
      console.warn(`[QuizMaker] daily cap ${QUIZ_FREE_DAILY_CAP} reached`);
      return res.status(503).json({ error: 'busy_today', message: 'Бүгін квиз өте көп жасалды — ертең қайта көріңіз 🙏' });
    }

    // Мұғалімнің материалы: жүктелген файл (тек өзінікі) не қойылған мәтін
    let material = '';
    const mid = String(b.materialId || '');
    if (mid) {
      if (!/^[\w-]+$/.test(mid) || !mid.startsWith(chatId + '-')) return res.status(400).json({ error: 'bad_material' });
      const files = fs.readdirSync(MATERIAL_DIR).filter((f) => f.startsWith(mid + '.'));
      if (!files.length) return res.status(404).json({ error: 'material_gone', message: 'Файл табылмады — қайта жүктеңіз' });
      const an = await analyzeMaterialFile({ buffer: fs.readFileSync(path.join(MATERIAL_DIR, files[0])), name: files[0] });
      material = String(an.text || '');
      if (material.trim().length < 80) return res.status(422).json({ error: 'unreadable', message: 'Файлдан мәтін оқылмады — мәтінін көшіріп қойыңыз' });
    } else if (typeof b.text === 'string' && b.text.trim()) {
      material = b.text.slice(0, 60000);
      if (material.trim().length < 80) return res.status(400).json({ error: 'short_text', message: 'Материал тым қысқа — кемінде бірнеше сөйлем қойыңыз' });
    }

    let made;
    try {
      made = await quizMaker.generateQuiz({ topic, language: b.language, count: b.count, material });
    } catch (e) {
      console.warn(`[QuizMaker] generate failed chat=${chatId}: ${e.message}`);
      return res.status(502).json({ error: 'generate_failed', message: 'Квиз жасалмады — тақырыпты нақтылап, қайта көріңіз' });
    }

    // бірегей код (сирек қайталанса — жаңасы)
    let code = '';
    for (let i = 0; i < 6 && !code; i++) { const c = QuizCore.makeCode(); if (!(await getQuiz(c))) code = c; }
    if (!code) throw new Error('no free quiz code');
    const hostKey = QuizCore.makeToken(12);
    await saveQuiz({
      code, hostKey, chatId, jobId: null, topic: made.topic, language: made.language, questions: made.questions,
      kind: 'free', material: material ? quizMaker.prepMaterial(material) : '', expiresAt: Date.now() + QuizCore.QUIZ_TTL_MS,
    });
    // мерзімі өткен, бірақ әлі тазаланбаған квизбен код сәйкес келсе, INSERT … DO NOTHING үнсіз өтеді — тексереміз
    const stored = await getQuiz(code);
    if (!stored || stored.hostKey !== hostKey) throw new Error(`quiz ${code} was not stored`);
    logEvent(chatId, 'quiz').catch(() => {});
    const links = quizLinks(code, hostKey);
    console.log(`[QuizMaker] ${code} chat=${chatId} n=${made.questions.length} lang=${made.language} material=${material ? 'yes' : 'no'} ms=${Date.now() - t0}`);
    sendQuizLinks(chatId, { code, topic: made.topic, questions: made.questions, links }, { free: true })
      .catch((e) => console.warn(`[QuizMaker] links message: ${e.message}`));
    return res.json({
      code, hostKey, links, topic: made.topic, language: made.language, questions: made.questions,
      left: await freeQuizLeft(chatId),
    });
  } catch (e) {
    console.error('[API] /quiz-maker/create', e);
    return res.status(500).json({ error: 'server_error', message: 'Қате шықты — қайта көріңіз' });
  } finally {
    quizMaking.delete(chatId);
  }
});

app.post('/api/generate', authMiddleware, async (req, res) => {
  let testerHold = null; // тестер-кредит алынды, бірақ жұмыс әлі жасалмады → қате болса қайтарылады
  try {
    const chatId = String(req.tgUser.id);
    const { topic, slideCount, language, style, audience, performedBy, checkedBy, mode, pages, university, faculty, department, group, city, refId, requirements, materialIds, sampleId, learnConsent, design } = req.body || {};
    const PRESENTATION_MODES = new Set(['presentation', 'template']);
    const genMode = PRESENTATION_MODES.has(String(mode)) ? String(mode) : (mode === 'referat' ? 'referat' : 'presentation');
    const isReferat = genMode === 'referat';

    const topicStr = String(topic || '').trim();
    if (!topicStr || topicStr.length < 3) {
      return res.status(400).json({ error: 'invalid_topic', message: 'Тақырып тым қысқа' });
    }
    if (topicStr.length > MAX_TOPIC_CHARS) {
      return res.status(400).json({ error: 'topic_too_long', message: `Максимум ${MAX_TOPIC_CHARS} таңба` });
    }

    const rate = await checkRateLimits(chatId);
    if (!rate.allowed) {
      return res.status(429).json({
        error: 'rate_limited',
        message: rate.message || 'Тым жиі сұраныс',
        retryAfter: rate.retryAfterSec,
      });
    }

    // Ensure user exists
    let user = await getUser(chatId);
    if (!user) {
      await registerUser(chatId, null);
      user = await getUser(chatId);
    }
    // Тестер: күніне 3 тегін презентация (жиналмайды); алдыңғысына пікір жазылмайынша келесісі жоқ
    let isTester = false;
    const tst = await getTester(chatId).catch(() => null);
    // Жаңарту режимі (MAINTENANCE=1): өнім «топ» деңгейге жеткенше тек админ мен белсенді тестерлер жасатады
    if (MAINTENANCE && !isAdminId(chatId) && !testerCore.isActive(tst)) {
      return res.status(503).json({ error: 'maintenance', message: '🛠 DeadLine жаңартылып жатыр — жақында әлдеқайда әдемі презентациялармен ораламыз!' });
    }
    if (testerCore.isActive(tst)) {
      const block = await testerBlock(tst);
      if (block) return res.status(409).json(block);
      if ((await useTesterCredit(chatId)) != null) { isTester = true; testerHold = chatId; }
      else if (!user || user.credits <= 0) {
        return res.status(402).json({ error: 'tester_limit', message: `Бүгінгі ${testerCore.DAILY} тегін тест презентациясы бітті — ертең таңертең қайта толады 🙂` });
      }
    }
    // Тегін тариф жоқ: кредитсіз (тестер емес) адам жасата алмайды
    const isFree = false;
    if (!isTester && (!user || user.credits <= 0)) {
      return res.status(402).json({
        error: 'no_credits',
        message: 'Кредит жеткіліксіз. Сатып алыңыз немесе реферал шақырыңыз.',
        credits: user?.credits || 0,
      });
    }
    const effSlides = isFree ? Math.min(parseInt(slideCount, 10) || FREE_MAX_SLIDES, FREE_MAX_SLIDES) : slideCount;

    // Build free-text input compatible with existing parseUserInput
    const parts = [topicStr];
    if (effSlides) parts.push(`${effSlides} слайд`);
    if (language) parts.push(language === 'en' ? 'ағылшынша' : language === 'ru' ? 'орысша' : 'қазақша');
    if (style) parts.push(style);
    if (audience) parts.push(`аудитория: ${audience}`);
    let userInput = parts.join('. ');
    // Титул: Орындаған / Тексерген — жеке жолдарға (parseCoverMeta жол соңына дейін оқиды)
    const clean = (v) => String(v || '').replace(/\s*[,;\n\r]+\s*/g, ' / ').replace(/[:：]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (clean(university)) userInput += '\nУниверситет: ' + clean(university);
    if (clean(faculty)) userInput += '\nФакультет: ' + clean(faculty);
    if (clean(department)) userInput += '\nКафедра: ' + clean(department);
    if (clean(group)) userInput += '\nТоп: ' + clean(group);
    if (clean(performedBy)) userInput += '\nОрындаған: ' + clean(performedBy);
    if (clean(checkedBy)) userInput += '\nТексерген: ' + clean(checkedBy);
    const referatMeta = {
      university: clean(university), faculty: clean(faculty), department: clean(department),
      group: clean(group), city: clean(city), performedBy: clean(performedBy), checkedBy: clean(checkedBy),
    };

    const charged = isFree || isTester || await useCredit(chatId);
    if (!charged) {
      return res.status(402).json({ error: 'no_credits', message: 'Кредит жеткіліксіз' });
    }
    await markGenerationAttempt(chatId);
    logEvent(chatId, 'gen').catch(() => {});
    if (isFree) logEvent(chatId, 'free').catch(() => {});

    // Берілген материал файлдарын толық талдау (Mode 2/3). Бірнеше файл — бір контекст.
    let materialText = '';
    let materialMeta = [];
    if (!isReferat && Array.isArray(materialIds) && materialIds.length) {
      for (const mid of materialIds.slice(0, 8)) {
        if (!/^[\w-]+$/.test(String(mid || ''))) continue;
        try {
          const files = fs.readdirSync(MATERIAL_DIR).filter((f) => f.startsWith(String(mid) + '.'));
          const filePath = files.length ? path.join(MATERIAL_DIR, files[0]) : null;
          if (filePath && fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            const an = await analyzeMaterialFile({ buffer: buf, name: files[0] });
            materialMeta.push({ id: mid, name: files[0], kind: an.kind, preview: an.preview, note: an.note });
            if (an.text) materialText += `\n\n===== ${files[0]} (${an.kind}) =====\n${an.text}`;
          }
        } catch (e) {
          console.warn('[API] material load failed:', e.message);
        }
      }
      if (materialText) console.log(`[API] materials: ${materialMeta.length} file(s), ${materialText.length} chars`);
    }

    // Реферат: мұғалім қабылдаған үлгі реферат (опционал) — мәтіні толық оқылып, генераторда терең талданады
    let sampleText = '';
    let sampleName = '';
    if (isReferat && /^[\w-]+$/.test(String(sampleId || ''))) {
      try {
        const files = fs.readdirSync(MATERIAL_DIR).filter((f) => f.startsWith(String(sampleId) + '.'));
        if (files.length) {
          const an = await analyzeMaterialFile({ buffer: fs.readFileSync(path.join(MATERIAL_DIR, files[0])), name: files[0] });
          sampleText = String(an.text || '').slice(0, 60000);
          sampleName = files[0];
        }
      } catch (e) {
        console.warn('[API] sample load failed:', e.message);
      }
    }

    // Қосымша талап мәтіні (опционал, тек AI Presentation режимінде)
    const typedRequirements = !isReferat && genMode === 'presentation' ? String(requirements || '').trim() : '';
    const requirementsSource = typedRequirements.slice(0, 2000);

    console.log(`[API] generate: mode=${genMode}${isFree ? ' FREE' : ''}${isTester ? ' TESTER' : ''} language=${language || '(жоқ → kk)'} slides=${effSlides || '-'} pages=${pages || '-'} materials=${materialMeta.length}${sampleName ? ' sample=' + sampleName : ''} chat=${chatId}`);
    const job = await createJob(chatId, {
      topic: topicStr,
      slideCount: effSlides || null,
      free: isFree,
      tester: isTester,
      language: language || 'kk',
      style: style || null,
      // Mini App галереясынан таңдалған дизайн жүйесі (тек тізімдегілер; әйтпесе — бот өзі таңдайды)
      design: genMode === 'presentation' && GALLERY_DESIGNS.has(String(design || '')) ? String(design) : null,
      audience: audience || null,
      userInput,
      mode: genMode,
      requirements: requirementsSource || null,
      materialText: materialText.slice(0, 60000) || null,
      materialMeta,
      refId: !isReferat && /^[\w-]+$/.test(String(refId || '')) ? String(refId) : null,
      // Клиент шаблонды жүктеу алдындағы ескертуді қабылдады → шаблонның дизайн-деректері (файлсыз, мәтінсіз) үйрену үшін сақталады
      learnConsent: !isReferat && genMode === 'template' && learnConsent === true,
      pages: isReferat ? Math.max(5, Math.min(30, parseInt(pages, 10) || 10)) : null,
      meta: isReferat ? referatMeta : null,
      sampleText: sampleText || null,
      sampleName: sampleName || null,
    });
    logGen(job.id, {
      chat_id: chatId, mode: genMode, topic: topicStr.slice(0, 500), slides: isReferat ? null : (effSlides || null),
      language: language || 'kk', free: isFree, tester: isTester, status: 'queued', created_at: Date.now(),
    }).catch((e) => console.warn('[GenLog]', e.message));
    if (isTester) { await setTesterPending(chatId, job.id).catch((e) => console.warn('[Tester] pending', e.message)); testerHold = null; }

    // Fire-and-forget generation
    runGeneration(job.id, { free: isFree }).catch(err => {
      console.error('[Job] unhandled', job.id, err);
    });

    res.status(202).json({
      jobId: job.id,
      status: 'queued',
      creditsLeft: isFree || isTester ? (user.credits || 0) : (user.credits || 1) - 1,
      free: isFree,
      tester: isTester,
    });
  } catch (err) {
    console.error('[API] /generate', err);
    if (testerHold) await refundTesterCredit(testerHold).catch(() => {});
    res.status(500).json({ error: 'server_error' });
  }
});

// Resend file to the user's Telegram chat (blob-download doesn't work in Telegram WebView)
app.get('/api/job/:id/download/:type', authMiddleware, async (req, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job || job.chatId !== String(req.tgUser.id)) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (job.status !== 'done') {
      return res.status(400).json({ error: 'not_ready' });
    }
    const type = req.params.type;
    let filePath, mime, name;
    if (type === 'pptx' && job.pptxPath && job.payload?.mode !== 'referat') {
      filePath = job.pptxPath;
      mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      name = `${(job.title || 'presentation').replace(/[^\w\u0400-\u04FF\- ]+/g, '').slice(0, 60)}.pptx`;
    } else if (type === 'speech' && job.payload?.mode !== 'referat' && fs.existsSync(speechFile(job.id))) {
      filePath = speechFile(job.id);
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      name = `${(job.title || 'presentation').replace(/[^\w\u0400-\u04FF\- ]+/g, '').slice(0, 50)} — баяндама.docx`;
    } else if (type === 'docx' && job.payload?.mode === 'referat' && job.pptxPath) {
      filePath = job.pptxPath;
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      name = `${(job.title || 'referat').replace(/[^\w\u0400-\u04FF\- ]+/g, '').slice(0, 60) || 'referat'}.docx`;
    } else {
      return res.status(404).json({ error: 'file_not_found' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'file_missing' });
    }
    if (!global.__deadlineBot) {
      return res.status(503).json({ error: 'bot_unavailable' });
    }
    await global.__deadlineBot.sendDocument(job.chatId, filePath, {}, {
      filename: name,
      contentType: mime,
    });
    res.json({ sent: true });
  } catch (err) {
    console.error('[API] download', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── АДМИН ПАНЕЛЬ (тек ADMIN_CHAT_ID) ──────────────────────────────────────
function adminOnly(req, res, next) {
  if (!req.tgUser || !isAdminId(req.tgUser.id)) return res.status(403).json({ error: 'forbidden' });
  next();
}
const adminRoute = (fn) => async (req, res) => {
  try { res.json(await fn(req)); } catch (e) { console.error('[Admin]', req.path, e); res.status(500).json({ error: 'server_error', message: e.message }); }
};
const clampInt = (v, d, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v, 10) || d));

app.get('/api/admin/overview', authMiddleware, adminOnly, adminRoute(async (req) => {
  const days = clampInt(req.query.days, 14, 1, 90);
  const data = await adminData({ since: Date.now() - days * 86400e3 });
  const ov = adminCalc.overview(data, { days }); // users — әрқашан барлығы
  let images = null;
  try { images = require('./products/presentation/images').imageStats(); } catch {}
  return { ...ov, images };
}));

app.get('/api/admin/users', authMiddleware, adminOnly, adminRoute(async (req) => {
  const data = await adminData({ since: 0 });
  return adminCalc.usersList(data, { q: req.query.q, filter: req.query.filter, limit: clampInt(req.query.limit, 50, 1, 200), offset: clampInt(req.query.offset, 0, 0, 1e6) });
}));

app.get('/api/admin/user/:id', authMiddleware, adminOnly, adminRoute(async (req) => {
  const data = await adminData({ chatId: req.params.id });
  return adminCalc.userDetail(data, req.params.id) || { error: 'not_found' };
}));

app.get('/api/admin/gens', authMiddleware, adminOnly, adminRoute(async (req) => {
  const days = clampInt(req.query.days, 30, 1, 365);
  const data = await adminData({ since: Date.now() - days * 86400e3 });
  return adminCalc.gensList(data, { filter: req.query.filter, limit: clampInt(req.query.limit, 50, 1, 200), offset: clampInt(req.query.offset, 0, 0, 1e6) });
}));

app.get('/api/admin/payments', authMiddleware, adminOnly, adminRoute(async (req) => {
  const days = clampInt(req.query.days, 30, 1, 365);
  const data = await adminData({ since: Date.now() - days * 86400e3 });
  return adminCalc.paymentsList(data, { limit: 200 });
}));

// Клиентке кредит қосу (сыйлық / өтемақы — табыс есебіне кірмейді)
app.post('/api/admin/user/:id/credits', authMiddleware, adminOnly, adminRoute(async (req) => {
  const n = clampInt(req.body && req.body.n, 0, -50, 50);
  if (!n) throw new Error('n керек (-50..50, 0 емес)');
  const user = await addCredits(req.params.id, n);
  if (n > 0 && req.body.notify !== false && global.__deadlineBot) {
    global.__deadlineBot.sendMessage(req.params.id, `🎁 Сізге *${n}* презентация кредиті қосылды. Жалпы: *${user.credits}*`, { parse_mode: 'Markdown' }).catch(() => {});
  }
  console.log(`[Admin] credits ${req.params.id} ${n > 0 ? '+' : ''}${n}`);
  return { ok: true, credits: user.credits };
}));

// Клиентке бот атынан хабарлама
app.post('/api/admin/user/:id/message', authMiddleware, adminOnly, adminRoute(async (req) => {
  const text = String((req.body && req.body.text) || '').trim().slice(0, 3500);
  if (!text) throw new Error('мәтін бос');
  if (!global.__deadlineBot) throw new Error('бот қосылмаған');
  await global.__deadlineBot.sendMessage(req.params.id, text);
  return { ok: true };
}));

// Генерация файлын админнің Telegram-ына жіберу (файл JOB_RETENTION_HOURS бойы сақталады)
app.post('/api/admin/gen/:jobId/send', authMiddleware, adminOnly, adminRoute(async (req) => {
  const job = await getJob(req.params.jobId);
  if (!job || !job.pptxPath || !fs.existsSync(job.pptxPath)) {
    return { ok: false, message: `Файл жоқ: жұмыстар ${Math.round(RETENTION_MS / 3600e3)} сағаттан кейін өшіріледі` };
  }
  if (!global.__deadlineBot) throw new Error('бот қосылмаған');
  const to = String(req.tgUser.id);
  const isDocx = job.payload && job.payload.mode === 'referat';
  const base = String(job.title || 'presentation').replace(/[^\wЀ-ӿ\- ]+/g, '').slice(0, 60) || 'file';
  await global.__deadlineBot.sendDocument(to, job.pptxPath, { caption: `🆔 ${job.chatId} · ${job.id}` }, {
    filename: base + (isDocx ? '.docx' : '.pptx'),
    contentType: isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  const sp = speechFile(job.id);
  if (!isDocx && fs.existsSync(sp)) {
    await global.__deadlineBot.sendDocument(to, sp, {}, { filename: base.slice(0, 50) + ' — баяндама.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }).catch(() => {});
  }
  return { ok: true };
}));

// ─── Тестерлер бөлімі ─────────────────────────────────────────────────────
app.get('/api/admin/testers', authMiddleware, adminOnly, adminRoute(async () => testerCore.testersList(await testerData())));

// @username немесе ID бойынша тестер ету (адам ботқа бір рет кірген болуы керек)
app.post('/api/admin/testers', authMiddleware, adminOnly, adminRoute(async (req) => {
  const who = testerCore.parseWho(req.body && req.body.who);
  if (!who) return { ok: false, message: '@username немесе ID жазыңыз' };
  const u = await findUser(who);
  if (!u) return { ok: false, message: 'Бұл адам ботқа әлі кірмеген. Алдымен ол ботқа /start басуы керек (не Mini App-ты бір рет ашуы керек).' };
  const days = clampInt(req.body.days, testerCore.DEFAULT_DAYS, 1, 60);
  const t = await setTester(u.chat_id, testerCore.untilFor(days));
  const until = new Date(t.tester_until + 5 * 3600e3).toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('.');
  if (req.body.notify !== false && global.__deadlineBot) {
    global.__deadlineBot.sendMessage(u.chat_id,
      `🧪 *Сіз DeadLine тест тобына қосылдыңыз!*\n\n${until} дейін күн сайын *${testerCore.DAILY} презентация тегін* (жұмсалмағаны жиналмайды, күнде ${testerCore.DAILY}-ке дейін толады).\n\n`
      + 'Шарты: әр презентациядан кейін бот 3 сұрақ қояды — бір хабарламамен жауап бересіз. Пікір жазылғаннан кейін келесі презентация ашылады.\n\nMini App-ты ашып, тақырыбыңызды жазыңыз 👇',
      { parse_mode: 'Markdown' }).catch((e) => console.warn('[Tester] welcome failed:', e.message));
  }
  console.log(`[Admin] tester ${u.chat_id} until ${new Date(t.tester_until).toISOString()}`);
  return { ok: true, id: u.chat_id, name: u.name || (u.username ? '@' + u.username : u.chat_id), tester: testerCore.testerView(t) };
}));

// Тестердің бүгінгі тегін презентациясына қосу/азайту (ертең бәрібір 3-ке дейін толады, артығы сақталады)
app.post('/api/admin/tester/:id/credits', authMiddleware, adminOnly, adminRoute(async (req) => {
  const n = clampInt(req.body && req.body.n, 0, -20, 20);
  if (!n) throw new Error('n керек (-20..20, 0 емес)');
  const t = await addTesterCredits(req.params.id, n);
  if (!t) return { ok: false, message: 'Тестер мерзімі біткен — алдымен қайта тестер етіңіз' };
  if (n > 0 && req.body.notify !== false && global.__deadlineBot) {
    global.__deadlineBot.sendMessage(req.params.id, `🧪 Сізге бүгін тағы *${n}* тегін тест презентациясы қосылды. Бүгін барлығы: *${testerCore.creditsToday(t)}*`, { parse_mode: 'Markdown' }).catch(() => {});
  }
  return { ok: true, tester: testerCore.testerView(t) };
}));

// Тестерлікті тоқтату (тарихы мен пікірлері сақталады)
app.post('/api/admin/tester/:id/remove', authMiddleware, adminOnly, adminRoute(async (req) => {
  const t = await setTester(req.params.id, null);
  return { ok: true, tester: testerCore.testerView(t) };
}));

// Root → Mini App
app.get('/', (_req, res) => {
  res.redirect('/webapp/');
});

// ─── Тестер режимі ────────────────────────────────────────────────────────
/** Құлаған/жіберілмеген жұмыс: кредит қайда алынса, сонда қайтарылады */
async function refundFor(job) {
  const chatId = job.chatId;
  if (job.payload?.tester) return refundTesterCredit(chatId).catch((e) => console.warn('[Tester] refund', e.message));
  if (job.payload?.free) return releaseFreeDeck(chatId);
  return refundCredit(chatId);
}
/**
 * Тестер келесі презентацияны жасай ала ма? null → иә. Пікір күтіліп тұрса — себебі.
 * Жұмыс өшіп кетсе (48 сағ) не 30 минуттан астам «жасалып жатыр» күйінде қатып қалса — бөгемейміз.
 */
async function testerBlock(tst) {
  const pend = tst && tst.tester_pending;
  if (!pend) return null;
  const job = pend === 'busy' ? null : await getJob(pend).catch(() => null);
  const stale = !job || (job.status !== 'done' && Date.now() - (Number(job.createdAt) || 0) > 30 * 60e3);
  if (pend === 'busy' || stale) {
    if (stale && pend !== 'busy') await setTesterPending(tst.chat_id, null).catch(() => {});
    return pend === 'busy' ? { error: 'tester_busy', message: 'Алдыңғы презентация әлі жасалып жатыр — сәл күтіңіз.' } : null;
  }
  if (job.status !== 'done') return { error: 'tester_busy', message: 'Алдыңғы презентация әлі жасалып жатыр — сәл күтіңіз.' };
  return {
    error: 'tester_feedback',
    message: `🧪 Алдымен «${String(job.title || job.payload?.topic || '').slice(0, 60)}» презентациясына пікір жазыңыз — ботқа бір хабарламамен (3 сұраққа жауап). Сосын келесі тегін презентация ашылады.`,
  };
}
/** Тестерге 3 сұрақ (жұлдызша батырмасымен бірге) */
async function askTester(job, title) {
  if (!global.__deadlineBot) return;
  await global.__deadlineBot.sendMessage(job.chatId, testerCore.questionsText(title || job.payload?.topic), {
    parse_mode: 'Markdown', reply_markup: ratingKeyboard(job.id),
  }).catch((e) => console.warn('[Tester] ask failed:', e.message));
}

// ─── Кешіктірілген баға сұрауы ────────────────────────────────────────────
// Файл жеткен бойда емес: клиент презентацияны ашып қарап үлгеруі үшін RATE_PROMPT_DELAY_MIN (әдепкі 60) минуттан кейін,
// түнде (23:00–08:00, TZ_OFFSET_MIN бойынша, әдепкі Алматы +300) — таңғы 10:00-де. Кезек БД-да: бот қайта қосылса да жоғалмайды.
const RATE_DELAY_MIN = Math.max(1, parseInt(process.env.RATE_PROMPT_DELAY_MIN || '60', 10) || 60);
const TZ_OFFSET_MIN = parseInt(process.env.TZ_OFFSET_MIN || '300', 10) || 300;
function queueRatePrompt(job, kind) {
  scheduleRatePrompt({ jobId: job.id, chatId: job.chatId, kind, dueAt: rateDueAt(Date.now(), { delayMin: RATE_DELAY_MIN, tzOffsetMin: TZ_OFFSET_MIN }) })
    .catch((e) => console.warn('[Rate] schedule failed:', e.message));
}
async function sendDueRatePrompts() {
  if (!global.__deadlineBot) return;
  let due = [];
  try { due = await takeDueRatePrompts(Date.now(), 20); } catch (e) { return console.warn('[Rate] take failed:', e.message); }
  // бір адамға тәулігіне ≤1 сұрау: топтамадан тек соңғы презентация, 24 сағатта сұралған/бағалаған болса — жоқ
  const latest = new Map();
  for (const p of due) if (!latest.has(p.chatId) || p.dueAt >= latest.get(p.chatId).dueAt) latest.set(p.chatId, p);
  const batch = due.map((p) => p.jobId);
  for (const p of latest.values()) {
    try {
      if (await recentRateContact(p.chatId, Date.now() - 24 * 3600e3, batch)) continue;
      const job = await getJob(p.jobId);
      if (!job || job.status !== 'done') continue;               // жұмыс өшкен/құлаған — сұрамаймыз
      const fb = await getFeedbackForJob(p.jobId).catch(() => null);
      if (fb && fb.rating) continue;                              // Mini App-та бұрын бағалаған
      await global.__deadlineBot.sendMessage(p.chatId, ratePromptText(p.jobId, p.kind), { reply_markup: ratingKeyboard(p.jobId) });
    } catch (e) {
      console.warn('[Rate] send failed:', e.message);             // бот блокталған т.б. — қайта жібермейміз
    }
  }
}

// ─── Реферал бонусы (2 адам = 1 кредит) ──────────────────────────────────
// Бұрын тек чатта жасалған презентацияда саналатын; чатта генерация жойылған соң — Mini App-тағы сәтті презентациядан кейін.
// Тек сәтті жеткізілгеннен кейін (құлаған жұмыс санауышты өсірмейді).
// Екі жақты реферал (2026-11-06): сілтемемен келген дос бірінші сәтті презентациясынан кейін өзі де +1 кредит алады.
// Сыйлық total-ға қосылмайды (бірінші сатып алу жеңілдігі сақталады), бір адамға бір рет ('refgift' оқиғасы). Өшіру: REF_FRIEND_BONUS=0
const REF_FRIEND_BONUS = Math.max(0, parseInt(process.env.REF_FRIEND_BONUS ?? '1', 10) || 0);
async function giftReferredFriend(chatId) {
  if (!REF_FRIEND_BONUS || await eventSince(chatId, 'refgift', 0).catch(() => true)) return;
  await logEvent(chatId, 'refgift');
  await addBonusCredits(chatId, REF_FRIEND_BONUS);
  if (global.__deadlineBot) {
    global.__deadlineBot.sendMessage(chatId,
      `🎁 Досыңыздың шақыруымен келгеніңіз үшін *+${REF_FRIEND_BONUS} кредит* сыйлық! Келесі презентацияңыз — тегін, белгісіз, толық нұсқа.`,
      { parse_mode: 'Markdown' }).catch(() => {});
  }
}

/** Қуаныш сәті: презентация жеткен соң курстасқа бір батырмамен ұсыну (3 күнде бір рет; WhatsApp — көпшілік сол жақтан) */
async function offerReferralShare(chatId) {
  if (!global.__deadlineBot || !BOT_USERNAME || process.env.REF_SHARE === '0') return;
  if (await eventSince(chatId, 'refask', Date.now() - 3 * 24 * 3600e3).catch(() => true)) return;
  await logEvent(chatId, 'refask');
  const link = `https://t.me/${BOT_USERNAME}?start=ref_${chatId}`;
  const pitch = 'DeadLine — 2 минутта презентация, айтатын мәтін және топқа квиз. Мына сілтемемен кірсең, бонус кредит аласың:';
  await global.__deadlineBot.sendMessage(chatId,
    '🎁 Курстасыңызға ұсыныңыз: ол сіздің сілтемеңізбен келіп презентация жасаса — *екеуіңізге де бонус кредит*.',
    { parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: { inline_keyboard: [[
      { text: '📲 WhatsApp-қа жіберу', url: 'https://wa.me/?text=' + encodeURIComponent(pitch + ' ' + link) },
      { text: '✈️ Telegram', url: 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(pitch) },
    ]] } }).catch(() => {});
}

async function countReferral(chatId) {
  try {
    const u = await getUser(chatId);
    if (!u || !u.referredBy) return;
    await giftReferredFriend(chatId).catch((e) => console.warn('[Referral] gift failed:', e.message));
    const { newCount, bonusGiven } = await incrementRefCount(u.referredBy);
    if (!newCount || !global.__deadlineBot) return;
    const need = REFERRALS_PER_BONUS - (newCount % REFERRALS_PER_BONUS);
    const text = bonusGiven
      ? `🎉 *+1 кредит!* Сенің реферал сілтемең арқылы ${newCount} адам презентация жасатты!\n\nКелесі кредит үшін тағы *${REFERRALS_PER_BONUS} адам* қажет.`
      : `👥 Сенің реферал сілтемең арқылы жаңа адам презентация жасатты!\n\nКредит алу үшін тағы *${need} адам* керек.`;
    global.__deadlineBot.sendMessage(u.referredBy, text, { parse_mode: 'Markdown' }).catch(() => {});
  } catch (e) {
    console.warn('[Referral] count failed:', e.message);
  }
}

// ─── Үйрену жүйесі ────────────────────────────────────────────────────────
// Клиент келіскен шаблон режимі жұмысынан кейін (сәтті де, сәтсіз де) шаблон файлын ОҚИМЫЗ:
// дизайн-деректері (орналасу, өлшем, түс, шрифт, элементтер; мәтінсіз, суретсіз) сақталады, файлдың өзі — жоқ
// (ол бұрынғыдай JOB_RETENTION_HOURS бойынша өшеді). Клиентті күттірмеу үшін жауаптан кейін, фонда.
const LEARN_ENABLED = process.env.LEARN_FROM_TEMPLATES !== '0';
function scheduleLearn(job, outcome, info) {
  if (!LEARN_ENABLED || !job || !job.payload || !job.payload.learnConsent || !job.payload.refId) return;
  setImmediate(async () => {
    try {
      const file = path.join(REF_DIR, job.payload.refId + '.pptx');
      if (!fs.existsSync(file)) return;
      const { readTemplate } = require('./design-dna/learnReader');
      const { topicWords } = require('./core/learning');
      const read = readTemplate(fs.readFileSync(file));
      const saved = await saveLearnedTemplate(read);
      await addLearnUse({
        fingerprint: read.fingerprint, jobId: job.id, topic: String(job.payload.topic || '').slice(0, 200),
        topicWords: topicWords(job.payload.topic), language: job.payload.language || null, outcome,
        slideCount: read.template.slideCount,
        fit: info && info.fit ? info.fit : null, layoutPlanned: info && info.layoutPlanned != null ? info.layoutPlanned : null,
        error: info && info.error ? info.error : null,
      });
      console.log(`[Learn] ${job.id}: шаблон ${read.fingerprint} ${saved && saved.isNew ? 'жаңа' : 'бұрын көрген'} · ${outcome}`);
    } catch (e) {
      console.warn('[Learn] skipped:', e.message);
    }
  });
}

// ─── Generation runner ────────────────────────────────────────────────────
// Бір тапсырманың ең ұзақ уақыты: сыртқы қызмет (DeepSeek, суреттер) ілініп қалса — қате, кредит қайтады, кезектегі орын босайды
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS) || 15 * 60 * 1000;
function withDeadline(promise, ms, label) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`[timeout] ${label} ${Math.round(ms / 60000)} мин ішінде бітпеді`)), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

let activeGenerations = 0;
const waitQueue = []; // [{ resolve, free }]

/** Кезек: бір уақытта MAX_CONCURRENT генерация; бос орын шыққанда ақылы (не тестер) тапсырыс тегіннен бұрын өтеді */
async function runGeneration(jobId, opts = {}) {
  if (activeGenerations >= MAX_CONCURRENT) {
    await new Promise(resolve => waitQueue.push({ resolve, free: !!opts.free }));
  }
  activeGenerations++;
  try {
    await executeJob(jobId);
  } finally {
    activeGenerations = Math.max(0, activeGenerations - 1);
    const paid = waitQueue.findIndex((w) => !w.free);
    const next = waitQueue.splice(paid >= 0 ? paid : 0, 1)[0];
    if (next) next.resolve();
  }
}

/**
 * Деплой не қайта қосылу кезінде үзілген тапсырыстар (кезекте/жасалып жатқан, соңғы 3 сағат): бір рет қайта
 * басталады. Қайта басталған жұмыс тағы үзілсе (error='resumed' белгісі) — қайталанбайды: кредит қайтарылып,
 * клиентке хабар барады (бір жұмыс серверді қайта-қайта құлатып, шексіз айналмасын).
 */
const BOOT_AT = Date.now();
const RESUME_DELAY_MS = Number(process.env.RESUME_DELAY_MS) || 120_000;
async function resumeInterruptedJobs() {
  const jobs = await listUnfinishedJobs(3 * 3600 * 1000).catch((e) => { console.warn('[Resume] list:', e.message); return []; });
  for (const job of jobs) {
    // Railway жаңа нұсқаны қосқанда ескісі біраз уақыт жұмыс істей береді: сол уақытта жаңарған жұмыс — тірі,
    // оған тимейміз (екі рет жасалмасын, екі рет қайтарылмасын). Тек осы процесс қосылғаннан бері жаңармағаны — үзілген.
    if (!(Number(job.updatedAt) < BOOT_AT)) continue;
    if (job.error === 'resumed') {
      console.warn(`[Resume] ${job.id} екінші рет үзілді — кредит қайтарылады`);
      await updateJob(job.id, { status: 'failed', phase: 'failed', detail: 'Сервер қайта қосылды', progress: 0, error: 'interrupted' }).catch(() => {});
      await refundFor(job).catch((e) => console.warn('[Resume] refund', e.message));
      logGen(job.id, { status: 'failed', error: 'interrupted', finished_at: Date.now() }).catch(() => {});
      if (global.__deadlineBot) {
        global.__deadlineBot.sendMessage(job.chatId, '❌ Сервер жаңартылып жатқанда тапсырысыңыз үзілді, кредитіңіз қайтарылды. Қайта жасатып көріңіз.').catch(() => {});
      }
      continue;
    }
    console.log(`[Resume] ${job.id} қайта басталды (${job.status})`);
    await updateJob(job.id, { status: 'queued', phase: 'queued', detail: 'Қайта басталды', progress: 0, error: 'resumed' }).catch(() => {});
    runGeneration(job.id, { free: !!(job.payload && job.payload.free) }).catch((err) => console.error('[Resume] unhandled', job.id, err));
  }
}

// ─── Реферат (.docx) ──────────────────────────────────────────────────────
async function executeReferatJob(job) {
  const jobId = job.id;
  const chatId = job.chatId;
  console.log(`[Job] ${jobId} referat language=${job.payload?.language} pages=${job.payload?.pages}`);
  try {
    const progressMap = { outline: 8, write: 35, fit: 80, docx: 92 };
    const result = await withDeadline(generateReferat({
      topic: job.payload.topic,
      pages: job.payload.pages,
      language: job.payload.language,
      meta: job.payload.meta || {},
      brief: job.payload.audience || '',
      sample: job.payload.sampleText || '',
      onProgress: async (phase, detail) => {
        await updateJob(jobId, {
          phase: String(phase || ''),
          detail: String(detail || phase || ''),
          progress: progressMap[phase] || 20,
        });
      },
    }), JOB_TIMEOUT_MS, 'referat');
    const destDir = path.join(JOBS_DIR, jobId);
    fs.mkdirSync(destDir, { recursive: true });
    const docxPath = path.join(destDir, 'referat.docx');
    fs.copyFileSync(result.docxPath, docxPath);
    try { fs.unlinkSync(result.docxPath); } catch {}

    await updateJob(jobId, {
      status: 'done', phase: 'done', detail: 'Дайын!', progress: 100,
      title: result.title || job.payload.topic, qualityScore: null,
      pptxPath: docxPath, htmlPath: null,
    });
    logGen(jobId, { status: 'done', title: result.title || job.payload.topic, finished_at: Date.now() }).catch(() => {});
    await markGenerationSuccess(chatId, false);
    await addHistory(chatId, {
      id: jobId, title: result.title || job.payload.topic, topic: job.payload.topic,
      qualityScore: null, slideCount: job.payload.pages, language: job.payload.language, createdAt: Date.now(),
    });
    try {
      if (global.__deadlineBot) {
        await global.__deadlineBot.sendMessage(
          chatId,
          `✅ *Реферат дайын!*\n\n📌 ${escapeMd(result.title || job.payload.topic)}\n📄 ${result.pages} бет\n\n⚠️ Әдебиеттер тізімін өзіңіз тексеріп алыңыз.`,
          { parse_mode: 'Markdown' }
        );
        const name = `${(result.title || 'referat').replace(/[^\w\u0400-\u04FF\- ]+/g, '').slice(0, 60) || 'referat'}.docx`;
        await global.__deadlineBot.sendDocument(chatId, docxPath, {}, {
          filename: name,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
      }
    } catch (e) {
      console.warn('[Job] referat send failed', e.message);
    }
    if (job.payload?.tester) askTester(job, result.title); else queueRatePrompt(job, 'referat');
    console.log(`[Job] ${jobId} referat done — ${result.title} (${result.pages} pages, fillOk=${result.fillOk})`);
  } catch (err) {
    console.error(`[Job] ${jobId} referat failed:`, err.message);
    logGen(jobId, { status: 'failed', error: String(err.message || 'unknown'), finished_at: Date.now() }).catch(() => {});
    // алдымен «failed» белгісі, сосын қайтару: арасында сервер өлсе — қайта қосылғанда жұмыс қайта басталмайды, екі рет қайтарылмайды
    await updateJob(jobId, {
      status: 'failed', phase: 'failed', detail: 'Қате орын алды', progress: 0, error: err.message || 'unknown',
    });
    await refundFor(job);
    try {
      if (global.__deadlineBot) {
        await global.__deadlineBot.sendMessage(chatId, '❌ Реферат жасалмады, кредитіңіз қайтарылды.\nҚайта көріңіз.');
      }
    } catch {}
  }
}

async function executeJob(jobId) {
  const job = await getJob(jobId);
  if (!job) return;
  const chatId = job.chatId;
  const userInput = job.payload.userInput || job.payload.topic;

  await updateJob(jobId, { status: 'running', phase: 'start', detail: 'Басталуда...', progress: 2 });
  if (job.payload?.mode === 'referat') return executeReferatJob(job);

  try {
    console.log(`[Job] ${jobId} language=${job.payload?.language}`);
    let referencePptx = null;
    if (job.payload?.refId) {
      try { referencePptx = fs.readFileSync(path.join(REF_DIR, job.payload.refId + '.pptx')); } catch {}
      // шаблон файлы жоғалса (мыс. деплойдан кейін) — шаблонсыз «жалпы» колода жасап ақы алмаймыз: қате → кредит қайтады
      if (!referencePptx) throw new Error('template file missing');
    }
    // Студенттің дизайн жады: соңғы жүйелер/палитралар/суреттер қайталанбайды (оқу сәтсіз → бос жад, генерация жалғасады)
    const memory = await getDesignMemory(chatId).catch(() => null);
    const { recentLibs, ...avoid } = designMemory.avoidOptions(memory);
    // Шаблон кітапханасы (SlidesCarnival, рұқсатпен): студент өз шаблонын жүктемесе, бот кейде дайын шаблонды өзі таңдайды
    let library = null;
    // ұзын презентация (12-ден көп слайд) — шаблонның 8–10 макеті жетпей, мәтін қораптарға шатасып түседі: боттың өз макеттері
    const LIB_MAX_SLIDES = Number(process.env.LIBRARY_MAX_SLIDES) || 12;
    // студент галереядан стиль таңдаса — дәл сол жүйе (кітапхана шаблоны да, «соңғысы қайталанбасын» ережесі де қолданылмайды)
    const chosenDesign = (() => {
      const id = job.payload?.design;
      if (!id) return null;
      const sys = require('./products/presentation/design/systems').SYSTEMS[id];
      if (!sys) return null;
      const mood = (sys.moodFor && sys.moodFor(String(job.payload?.topic || ''))) || sys.moods[0];
      return { system: id, mood };
    })();
    if (!referencePptx && !chosenDesign && (job.payload?.mode || 'presentation') === 'presentation'
      && !(Number(job.payload?.slideCount) > LIB_MAX_SLIDES)
      && libraryCore.eligible({ tester: !!job.payload?.tester, admin: isAdminId(chatId) })) {
      try {
        await updateJob(jobId, { phase: 'content', detail: 'Презентация құрылымы жоспарлануда...', progress: 12 }).catch(() => {});
        library = await libraryCore.prepareDeck({
          topic: job.payload?.topic || userInput, slideCount: job.payload?.slideCount, avoid: recentLibs,
          brief: userInput, language: job.payload?.language,
        });
        pushDesignMemory(chatId, { lib: library.id }).catch(() => {});
      } catch (e) { console.warn(`[Library] skipped: ${e.message}`); library = null; }
    }
    const genOpts = (lib) => ({
      ...avoid,
      designForce: lib ? undefined : (chosenDesign || undefined),
      library: lib,
      // таңдалған сәтте жадқа жазамыз — студенттің қатар жіберген екінші тапсырысы сол дизайнды алмасын
      onDesign: (d) => { if (d && d.system) pushDesignMemory(chatId, { system: d.system, mood: d.mood }).catch(() => {}); },
      language: job.payload?.language,
      // Топқа квиз + «Баяндамаға дайындық» — барлық клиентке (иесінің шешімі, 2026-11-01)
      pedagogy: true,
      quiz: QUIZ_BASE_URL ? { baseUrl: QUIZ_BASE_URL } : null,
      mode: lib ? 'template' : (job.payload?.mode || 'presentation'),
      materialText: job.payload?.materialText || null,
      referencePptx: lib ? lib.deckBuf : referencePptx,
      requirements: job.payload?.requirements || null,
      free: !!job.payload?.free,
      maxSlides: job.payload?.free ? FREE_MAX_SLIDES : null,
      badgeUrl: job.payload?.free ? madeInUrl() : null,
      onProgress: async (phase, detail) => {
        const progressMap = {
          content: 15,
          qc: 25,
          quality: 35,
          narrative: 42,
          composition: 48,
          sources: 52,
          qa: 58,
          template: 80,
          images: 60,
          visual: 68,
          html: 75,
          render: 85,
          critic: 90,
          redesign: 93,
          pptx: 97,
        };
        const progress = progressMap[phase] || Math.min(95, (await getJob(jobId))?.progress || 10);
        await updateJob(jobId, {
          phase: String(phase || ''),
          detail: String(detail || phase || ''),
          progress,
        });
      },
    });
    let result;
    try {
      result = await withDeadline(generatePresentation(userInput, genOpts(library)), JOB_TIMEOUT_MS, 'generation');
    } catch (e) {
      if (!library) throw e;
      console.warn(`[Library] ${library.id}: template generation failed (${e.message}) — own layouts`);
      result = { failed: true };
    }
    // Сапа қақпасы: кітапхана шаблонымен шыққан презентация сапасы төмен болса (сыймаған/қабаттасқан мәтін т.б.) —
    // клиентке жіберілмейді, боттың өз макеттерімен қайта жасалады
    const MIN_HEALTH = Number(process.env.LIBRARY_MIN_HEALTH) || 90;
    if (library && (result.failed || !(result.templateHealth >= MIN_HEALTH))) {
      console.warn(`[Library] ${library.id}: health=${result.templateHealth ?? '—'} < ${MIN_HEALTH} — discarded, regenerating with own layouts`);
      for (const f of [result.pptxPath, result.htmlPath, result.speechPath]) { if (f) { try { fs.unlinkSync(f); } catch {} } }
      library = null;
      result = await withDeadline(generatePresentation(userInput, genOpts(null)), JOB_TIMEOUT_MS, 'generation');
    }

    // Move outputs into jobs dir for stable serving
    const destDir = path.join(JOBS_DIR, jobId);
    fs.mkdirSync(destDir, { recursive: true });
    let pptxPath = null;
    let htmlPath = null;

    if (result.pptxPath && fs.existsSync(result.pptxPath)) {
      pptxPath = path.join(destDir, 'presentation.pptx');
      fs.copyFileSync(result.pptxPath, pptxPath);
      try { fs.unlinkSync(result.pptxPath); } catch {}
    }
    // HTML — тек ішкі «сурет салушы» (PPTX сол арқылы жасалады), клиентке жіберілмейді
    if (result.htmlPath) { try { fs.unlinkSync(result.htmlPath); } catch {} }
    // «Баяндама мәтіні» (.docx): тұрақты жолда сақталады — DB бағаны керек емес (speechFile(jobId))
    let speechPath = null;
    if (result.speechPath && fs.existsSync(result.speechPath)) {
      speechPath = speechFile(jobId);
      try { fs.copyFileSync(result.speechPath, speechPath); } catch (e) { console.warn('[Job] speech.docx', e.message); speechPath = null; }
      try { fs.unlinkSync(result.speechPath); } catch {}
    }

    // Топқа квиз: слайдтағы QR осы кодқа апарады → базаға (30 күн)
    if (result.quiz) {
      try {
        await saveQuiz({ ...result.quiz, chatId, jobId, expiresAt: Date.now() + require('./core/quiz').QUIZ_TTL_MS });
      } catch (e) { console.warn(`[Job] quiz save failed (${result.quiz.code}): ${e.message}`); }
    }

    if (result.requirementsReport) {
      try { fs.writeFileSync(path.join(destDir, 'requirements.json'), JSON.stringify(result.requirementsReport)); } catch (e) { console.warn('[Job] requirements.json', e.message); }
    }
    if (result.templateReport) {
      try { fs.writeFileSync(path.join(destDir, 'template.json'), JSON.stringify(result.templateReport)); } catch (e) { console.warn('[Job] template.json', e.message); }
    }

    scheduleLearn(job, 'done', result.templateLearn);
    if (!job.payload?.tester) queueRatePrompt(job, 'presentation');

    await updateJob(jobId, {
      status: 'done',
      phase: 'done',
      detail: 'Дайын!',
      progress: 100,
      title: result.title || job.payload.topic,
      qualityScore: result.qualityScore ?? null,
      pptxPath,
      htmlPath,
    });

    logGen(jobId, {
      status: 'done', title: result.title || job.payload.topic, quality: result.qualityScore ?? null,
      cost_tg: result.cost && result.cost.estimatedCostTg != null ? result.cost.estimatedCostTg : null,
      tokens: result.cost ? result.cost.totalTokens || null : null, duration_ms: result.durationMs || null, finished_at: Date.now(),
    }).catch(() => {});
    if (Array.isArray(result.photoKeys) && result.photoKeys.length) pushDesignMemory(chatId, { photos: result.photoKeys }).catch(() => {});
    if (Array.isArray(result.compIds) && result.compIds.length) pushDesignMemory(chatId, { comps: result.compIds }).catch(() => {});
    await markGenerationSuccess(chatId, !!result.expensiveVisuals);
    await countReferral(chatId);
    await addHistory(chatId, {
      id: jobId,
      title: result.title || job.payload.topic,
      topic: job.payload.topic,
      qualityScore: result.qualityScore ?? null,
      slideCount: job.payload.slideCount,
      language: job.payload.language,
      createdAt: Date.now(),
    });

    // Notify via bot and send files directly to chat
    try {
      if (global.__deadlineBot) {
        const scoreNote = result.qualityScore != null
          ? `\n⭐ Сапа: ${Math.round(result.qualityScore)}/100`
          : '';
        await global.__deadlineBot.sendMessage(
          chatId,
          `✅ *Презентация дайын!*\n\n📌 ${escapeMd(result.title || job.payload.topic)}${scoreNote}\n\nФайлдар төменде жіберілді 👇`,
          { parse_mode: 'Markdown' }
        );
        if (result.requirementsReport) {
          const rt = formatReport(result.requirementsReport, job.payload?.language);
          if (rt) await global.__deadlineBot.sendMessage(chatId, rt).catch(() => {});
        }
        if (result.templateReport && result.templateReport.checks && result.templateReport.checks.length) {
          const tr = result.templateReport;
          const lines = [`🎨 ${tr.summary}`];
          for (const c of tr.checks) lines.push(`${c.status === 'pass' ? '✅' : '❌'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
          await global.__deadlineBot.sendMessage(chatId, lines.join('\n')).catch(() => {});
        }
        if (pptxPath && fs.existsSync(pptxPath) && fs.statSync(pptxPath).size > 50 * 1024 * 1024) {
          // Telegram боты 50 МБ-тан үлкен файлды жібере алмайды (шаблон 50 МБ-қа жақын болса, нәтиже де сондай)
          const mb = Math.round(fs.statSync(pptxPath).size / 1024 / 1024);
          console.warn(`[Job] ${jobId} pptx ${mb}MB > Telegram 50MB limit`);
          await refundFor(job);
          await global.__deadlineBot.sendMessage(chatId, `⚠️ Дайын файл ${mb} МБ — Telegram 50 МБ-тан үлкен файлды жібере алмайды. Кредитіңіз қайтарылды.\nШаблондағы суреттерді кішірейтіп (сығып) қайта жүктеңіз.`).catch(() => {});
        } else if (pptxPath && fs.existsSync(pptxPath)) {
          const pptxName = `${(result.title || job.payload.topic || 'presentation').replace(/[^\w\u0400-\u04FF\- ]+/g, '').slice(0, 60)}.pptx`;
          await global.__deadlineBot.sendDocument(chatId, pptxPath, {}, {
            filename: pptxName,
            contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          });
          if (speechPath && fs.existsSync(speechPath)) {
            const speechName = `${(result.title || job.payload.topic || 'presentation').replace(/[^\w\u0400-\u04FF\- ]+/g, '').slice(0, 50)} — дайындық.docx`;
            await global.__deadlineBot.sendDocument(chatId, speechPath, {
              caption: '🎓 Баяндамаға дайындық: тақырып қарапайым тілмен, бір беттік жоспар, әр слайдта не айту керек, мұғалімнің сұрақтары және өзіңді тексеретін квиз. Сөйлейтін мәтін PPTX-тің «Заметки» бөлімінде де бар.',
            }, {
              filename: speechName,
              contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            }).catch((e) => console.warn('[Job] speech send failed', e.message));
          }
          // Топқа квиз: сілтемелер Telegram арқылы — топ сілтемесі (топ чатына) + басқару беті (тек баяндамашыға)
          if (result.quiz && result.quiz.links) await sendQuizLinks(chatId, result.quiz).catch((e) => console.warn('[Job] quiz links send failed', e.message));
          // квиз жоқ болса да — канал сілтемесі әр презентацияның астында (иесінің шешімі)
          else if (CHANNEL_URL) await global.__deadlineBot.sendMessage(chatId, `📢 Жаңалықтар мен нұсқаулықтар (квизді қалай ойнау т.б.): ${CHANNEL_URL}`, { disable_web_page_preview: true }).catch(() => {});
          // қуаныш сәті: курстасқа ұсыну (тегін колодада өз хабарында бар — қайталамаймыз)
          if (!job.payload?.free) await offerReferralShare(chatId).catch((e) => console.warn('[Referral] share offer failed:', e.message));
        }
      }
    } catch (e) {
      console.warn('[Job] file send failed', e.message);
    }

    // Тегін колодадан кейін: келесі қадамды бір хабармен ұсынамыз (баға, Plus, реферал)
    if (job.payload?.free && global.__deadlineBot) {
      const ref = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?start=ref_${chatId}` : '';
      global.__deadlineBot.sendMessage(chatId,
        '🎁 Бұл — сіздің *тегін* презентацияңыз (оң жақ бұрыштағы «Made in DeadLine» белгісін PowerPoint-та өшіре аласыз).\n\n' +
        `Келесі презентация: *${FIRST_PRICE}₸* (бірінші сатып алу), кейін ${PRICE}₸ · Сессия пакеті: ${PACK.credits} презентация — ${PACK.amount}₸ · Plus: ${PLUS.credits} презентация — ${PLUS.amount}₸.\n` +
        'Ақылы презентацияда белгі болмайды, слайд саны шектелмейді, шаблон режимі де ашылады.' +
        (ref ? `\n\n👥 Курстасыңызға сілтеме жіберіңіз — ол презентация жасатса, *екеуіңізге де* бонус кредит: ${ref}` : ''),
        { parse_mode: 'Markdown', disable_web_page_preview: true }).catch(() => {});
    }

    if (job.payload?.tester) await askTester(job, result.title);

    // Шаблон режимін әлі қолданбағандарға бір рет еске саламыз (процесс ішінде бір рет)
    if (job.mode !== 'template' && job.payload?.mode !== 'template') nudgeTemplate(chatId).catch(() => {});

    console.log(`[Job] ${jobId} done — ${result.title}`);
  } catch (err) {
    console.error(`[Job] ${jobId} failed:`, err.message);
    console.log(`[Job] ${jobId} FAILED: ${String(err.stack || err.message).slice(0, 1500)}`);
    scheduleLearn(job, 'failed', { error: String(err.message || 'unknown').slice(0, 80) });
    logGen(jobId, { status: 'failed', error: err.isQualityGate ? 'quality_gate' : String(err.message || 'unknown'), finished_at: Date.now() }).catch(() => {});
    // алдымен «failed» белгісі, сосын қайтару (арасында сервер өлсе — екі рет қайтарылмайды, қайта басталмайды)
    await updateJob(jobId, {
      status: 'failed',
      phase: 'failed',
      detail: err.isQualityGate ? 'Сапа шегінен өтпеді' : 'Қате орын алды',
      progress: 0,
      error: err.isQualityGate ? 'quality_gate' : (err.message || 'unknown'),
    });
    await refundFor(job);
    try {
      if (global.__deadlineBot) {
        await global.__deadlineBot.sendMessage(
          chatId,
          err.isQualityGate
            ? '❌ Сапа шегінен өтпеді, кредитіңіз қайтарылды.\nТақырыпты сәл өзгертіп қайта көріңіз.'
            : '❌ Қате орын алды, кредитіңіз қайтарылды.\nҚайта көріңіз немесе қолдауға жазыңыз.'
        );
      }
    } catch {}
  }
}

function escapeMd(text) {
  if (typeof text !== 'string') return String(text);
  return text.replace(/([_*`\[\]])/g, '\\$1');
}

// ─── Ескі нәтижелерді тазалау ─────────────────────────────────────────────
// Клиенттердің презентация/рефераттары, жүктелген шаблон мен материалдар JOB_RETENTION_HOURS
// (әдепкі 48 сағат) өткен соң базадан да, дисктен де өшіріледі.
const RETENTION_MS = Math.max(1, parseInt(process.env.JOB_RETENTION_HOURS || '48', 10) || 48) * 3600 * 1000;

function removeOldFiles(dir, cutoff, keep = new Set()) {
  let n = 0;
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch { return 0; }
  for (const name of entries) {
    if (keep.has(name)) continue;
    const p = path.join(dir, name);
    try {
      if (fs.statSync(p).mtimeMs < cutoff) { fs.rmSync(p, { recursive: true, force: true }); n++; }
    } catch {}
  }
  return n;
}

/**
 * Квиз сілтемелері ботпен: «📲 WhatsApp-қа» / «📤 Telegram-ға» (топқа ойыншы сілтемесі) + «🎮 Квизді басқару» (бастау,
 * келесі сұрақ, нәтижелер). opts.free — тегін квиз (Mini App-тан жасалған; соңғы слайд/QR жоқ).
 */
async function sendQuizLinks(chatId, quiz, opts = {}) {
  if (!global.__deadlineBot || !quiz || !quiz.links) return;
  const n = (quiz.questions || []).length || 10;
  const shareText = `🎯 Квиз: «${String(quiz.topic || '').slice(0, 120)}» — сілтемені ашып, атыңызды жазыңыз`;
  const share = `https://t.me/share/url?url=${encodeURIComponent(quiz.links.player)}&text=${encodeURIComponent(shareText)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${quiz.links.player}`)}`;
  const text = (opts.free ? `🎯 Квиз дайын: «${String(quiz.topic || '').slice(0, 120)}» — ${n} сұрақ.\n\n` : `🎯 Топқа квиз дайын — ${n} сұрақ.\n\n`)
    + (opts.free
      ? '1️⃣ Ойыншы сілтемесін топқа жіберіңіз (WhatsApp не Telegram) — не басқару бетіндегі QR-ды проекторға шығарыңыз. Әркім атын жазып қосылады, тіркелу керек емес.\n'
      : '1️⃣ Сілтемені топ чатына жіберіңіз (не топ соңғы слайдтағы QR кодты сканерлейді). Әркім атын жазып қосылады.\n')
    + '2️⃣ «🎮 Квизді басқару» — ойынды СІЗ бастайсыз, келесі сұраққа да сіз өткізесіз. Ноутбукта ашып, проекторға шығарыңыз (телефоннан да болады).\n'
    + '📋 Кім неше сұраққа дұрыс жауап бергені — сол беттегі «Нәтижелер».\n\n'
    + '⚠️ Басқару сілтемесін топқа жібермеңіз — ол тек сізге.'
    + (CHANNEL_URL ? `\n\n🎬 Квизді қалай ойнау керек — видео нұсқаулық біздің каналда: ${CHANNEL_URL}` : '');
  await global.__deadlineBot.sendMessage(chatId, text, {
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: '📲 WhatsApp-қа', url: wa }, { text: '📤 Telegram-ға', url: share }], [{ text: '🎮 Квизді басқару', url: quiz.links.host }]]
        .concat(CHANNEL_URL ? [[{ text: '🎬 Қалай ойнау — видео', url: CHANNEL_URL }]] : []),
    },
  });
}

/** Квиз лоббиінде адамдар күтіп отыр, ал басқару беті ашылмаған → баяндамашыға «ойынды сіз бастауыңыз керек» (core/quizRoutes) */
async function notifyQuizHost({ chatId, players, hostUrl, nudge }) {
  if (!global.__deadlineBot || !chatId || !hostUrl) return;
  const text = nudge > 1
    ? `⏳ Квизде ${players} адам әлі сізді күтіп отыр.\n\nОйынды тек сіз бастай аласыз: батырманы басып, ашылған бетте «▶ Бастау»-ды басыңыз.`
    : `🎮 Квизге ${players} адам қосылды және сізді күтіп отыр!\n\n`
      + 'Ойынды сіз бастауыңыз керек: төмендегі батырманы басып, ашылған бетте «▶ Бастау»-ды басыңыз. '
      + 'Ноутбукта ашып, проекторға шығарсаңыз жақсы, бірақ телефоннан да болады.';
  await global.__deadlineBot.sendMessage(chatId, text, {
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: '▶ Квизді бастау', url: hostUrl }]] },
  });
}

let cleanupRunning = false;
async function runCleanup() {
  if (cleanupRunning) return;
  cleanupRunning = true;
  try {
    const cutoff = Date.now() - RETENTION_MS;
    const jobs = await cleanupOldJobs(RETENTION_MS).catch((e) => { console.warn('[Cleanup] db:', e.message); return 0; });
    const quizzes = await deleteExpiredQuizzes().catch((e) => { console.warn('[Cleanup] quizzes:', e.message); return 0; });
    if (quizzes) console.log(`[Cleanup] мерзімі біткен квиз: ${quizzes}`);
    const files = removeOldFiles(JOBS_DIR, cutoff, new Set(['_ref', '_mat']))
      + removeOldFiles(REF_DIR, cutoff)
      + removeOldFiles(MATERIAL_DIR, cutoff);
    if (jobs || files) console.log(`[Cleanup] өшірілді: ${jobs} жұмыс (базадан), ${files} файл/папка (${RETENTION_MS / 3600000} сағаттан ескі)`);
  } finally {
    cleanupRunning = false;
  }
}

// ─── Start ────────────────────────────────────────────────────────────────
async function main() {
  await initDB();
  await runCleanup();
  setInterval(runCleanup, 60 * 60 * 1000).unref(); // сағат сайын
  setInterval(() => { sendDueRatePrompts().catch(() => {}); }, 60 * 1000).unref(); // баға сұраулары — минут сайын
  // Mini App-ты ашып, ештеңе жасамай кеткенге бір реттік еске салу (core/nudge.js; өшіру: NUDGE_ABANDONED=0)
  setInterval(() => {
    if (!global.__deadlineBot) return;
    require('./core/nudge').runNudges({ db: require('./db'), webappUrl: WEBAPP_URL, send: (id, text, opts) => global.__deadlineBot.sendMessage(id, text, opts) })
      .catch((e) => console.warn('[Nudge] failed:', e.message));
  }, 15 * 60 * 1000).unref();

  // Start bot in same process (shared DB + notify)
  try {
    const botModule = require('./bot');
    if (botModule && botModule.startBot) {
      await botModule.startBot({ webappUrl: WEBAPP_URL });
    }
  } catch (err) {
    console.warn('[Server] Bot start skipped/failed:', err.message);
  }

  // үзілген тапсырыстар — ескі нұсқа толық тоқтаған соң (RESUME_DELAY_MS), бот іске қосылған (хабар жете алатын) күйде
  setTimeout(() => { resumeInterruptedJobs().catch((e) => console.warn('[Resume]', e.message)); }, RESUME_DELAY_MS).unref();

  const server = http.createServer(app);
  // Railway қайта іске қосқанда SIGTERM жібереді — базаға қосылымдарды дұрыс жабамыз
  const shutdown = (sig) => {
    console.log(`[Server] ${sig} — тоқтатылуда...`);
    server.close();
    Promise.resolve(closeDB && closeDB()).finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  server.listen(PORT, () => {
    console.log(`[Server] DeadLine v3 listening on :${PORT} (db=${DB_BACKEND || 'json'})`);
    console.log(`[Server] Mini App: ${WEBAPP_URL}/webapp/`);
  });
}

main().catch(err => {
  console.error('[Server] fatal', err);
  process.exit(1);
});

module.exports = { app };
