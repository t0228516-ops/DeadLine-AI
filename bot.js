'use strict';

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { extractPdfText, parseReceiptText, validateReceipt } = require('./core/receipt');
const { initDB, getUser, registerUser, addCredits, applyReceipt, getAllChatIds, REFERRALS_PER_BONUS, getPartner, requestPartner, setPartnerStatus, creditPartnerCommission, payoutPartner, listPartners, PARTNER_RATE, listLearnedTemplates, listLearnUses, setFeedback, getJob, freeFunnel, countFreeDecksSince, setBlocked, logEvent, funnelStats, funnelDay, setUserProfile, logPayment, getTester, logTesterFeedback, freeQuizStats } = require('./db');
const testerCore = require('./core/tester');
const { ratingKeyboard, commentPromptText, commentKeyboard, parseCommentCallback, parseFeedbackCallback, jobTagOf } = require('./core/feedbackUi');
// Клиентке жазылатын хабарлар: қазақша (әдепкі) / орысша — адамның таңдаған тілі бойынша (core/botText, core/userLang)
const { bt, mainKeyboard, menuAction, MENU_ACTION } = require('./core/botText');
const UL = require('./core/userLang');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Тұрақтылық: Markdown талданбаса хабар форматсыз қайта жіберіледі; ботты бұғаттаған клиент белгіленеді
require('./core/crashGuard').hardenBot(bot, { onBlocked: (chatId) => setBlocked(chatId, true).catch(() => {}) });

// Telegram-нің parse_mode:'Markdown' режимінде "_ * ` [" символдары
// арнайы синтаксис (italic/bold/code/link) деп қабылданады. Пайдаланушы
// жазған тақырыпта (мыс: "Python vs C++_негіздер") немесе Groq
// генерациялаған презентация атауында осы символдардың БІРІ ЖҰП БОЛМАЙ
// кездессе — Telegram "Can't parse entities" қатесімен БҮКІЛ ХАБАРЛАМАНЫ
// жібермей тастайды, бот "жауапсыз" болып көрінеді (нақты байқалған баг:
// реферал сілтемесіндегі "_" себебінен showReferral мүлде жауап бермеді;
// дәл сол қауіп ${topic} мен ${title} арқылы да бар). Бұл функция
// қауіпті символдардың алдына "\" қойып, Telegram-ге оларды әдеттегі
// таңба ретінде көрсетуді айтады — Markdown синтаксисі бұзылмайды.
function escapeMarkdown(text) {
  if (typeof text !== 'string') return String(text);
  return text.replace(/([_*`\[\]])/g, '\\$1');
}

const KASPI_PHONE = '+77713436592';
const KASPI_NAME  = 'Мурзабек Н';
const { PRICE, FIRST_PRICE, PLUS, PACK, BUNDLES, paidFor } = require('./core/pricing');
const packEach = Math.round(PACK.amount / PACK.credits);
/** Пакеттер жолы (Сессия + Plus) адамның тілінде */
const plusLineFor = (lang) => bt(lang, 'plusLine', {
  packLine: bt(lang, 'packLine', { credits: PACK.credits, amount: PACK.amount, each: packEach }),
  credits: PLUS.credits, amount: PLUS.amount,
});
const ADMIN_ID    = process.env.ADMIN_CHAT_ID;
const AUTO_CONFIRM   = process.env.AUTO_CONFIRM !== '0';          // '0' қойса — толық қолмен режим
const RECEIPT_MAX_AGE_MIN = parseInt(process.env.RECEIPT_MAX_AGE_MIN || '60', 10);
// Админ батырма баспаса — осы секундтан кейін автоматты растау (әдепкі 3 мин).
// ӘДЕПКІДЕ ӨШІРУЛІ: бұрын кез келген сурет 3 минуттан кейін кредит алатын. Енді чекті DeepSeek көзбен оқиды,
// оқи алмаса — шешім тек админде. Ескі тәртіпті қайтару: RECEIPT_TIMER_CREDIT=1.
const AUTO_CONFIRM_TIMEOUT_SEC = parseInt(process.env.AUTO_CONFIRM_TIMEOUT_SEC || '180', 10);
const RECEIPT_TIMER_CREDIT = process.env.RECEIPT_TIMER_CREDIT === '1';
// МАҢЫЗДЫ: BOT_USERNAME env-де кейде "@ai_presentation_ybot" түрінде (@-мен)
// қойылып қалуы мүмкін. Telegram deep-link форматы (t.me/<username>?start=...)
// username-нің алдында @ КҮТПЕЙДІ — @-мен жіберілген сілтемені Telegram
// "пайдаланушы табылмады" деп қабылдамайды. Осыны env-ді өзгертпей-ақ,
// кодтың өзінде әрқашан дұрыс шығатындай, басындағы @-ты алып тастаймыз.
const BOT_USERNAME = (process.env.BOT_USERNAME || 'DeadLine_prezbot').replace(/^@/, '');

const waitingForCount = new Set();
// Күтудегі чектер: pendingId → { chatId, timer, adminMsgId }
const pendingReceipts = new Map();
// Өңделген (расталған/бас тартылған) күтудегі чектер: батырма қайта басылса — екінші рет кредит жоқ
const handledPending = new Set();

// ─── Негізгі менюдің батырмалары ───────────────────────────────────────────
let WEBAPP_URL = process.env.WEBAPP_URL || '';

// Негізгі мәзір: тілге қарай (core/botText.mainKeyboard). Әдепкі — қазақша.
const MAIN_KEYBOARD = mainKeyboard('kk');

/** Mini App батырмалары (орысша адамға ?lang=ru — Mini App сол тілде ашылады); withLang — тіл ауыстыру жолы */
function webAppKeyboard(lang = 'kk', { withLang = false } = {}) {
  if (!WEBAPP_URL) return undefined;
  const rows = [
    [{ text: bt(lang, 'wa_app'), web_app: { url: UL.appUrl(WEBAPP_URL, '', lang) } }],
    [{ text: bt(lang, 'wa_quiz'), web_app: { url: UL.appUrl(WEBAPP_URL, '#quiz', lang) } }],
    [{ text: bt(lang, 'wa_template'), web_app: { url: UL.appUrl(WEBAPP_URL, '#template', lang) } }],
  ];
  if (withLang) rows.push([{ text: bt(lang, 'lang_other'), callback_data: lang === 'ru' ? 'lang:kk' : 'lang:ru' }]);
  return { inline_keyboard: rows };
}

/** Тегін квиз: Mini App бірден «Квиз» бөлімімен ашылады */
async function sendQuizOffer(chatId) {
  const lang = await UL.langOf(chatId);
  if (!WEBAPP_URL) return bot.sendMessage(chatId, bt(lang, 'appMissing')).catch(() => {});
  return bot.sendMessage(chatId, bt(lang, 'quizOffer'),
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: bt(lang, 'quizOfferBtn'), web_app: { url: UL.appUrl(WEBAPP_URL, '#quiz', lang) } }]] } }
  ).catch((e) => console.warn('[Bot] quiz offer:', e.message));
}

/** Сәлемдесу (тілге қарай): мәзір + Mini App батырмалары + тіл ауыстыру */
function sendWelcome(chatId, lang) {
  return bot.sendMessage(chatId, bt(lang, 'welcome', { price: PRICE, plusLine: plusLineFor(lang) }),
    { parse_mode: 'Markdown', reply_markup: mainKeyboard(lang).reply_markup }
  ).then(() => {
    const kb = webAppKeyboard(lang, { withLang: true });
    if (kb) {
      return bot.sendMessage(chatId, bt(lang, 'openApp'), {
        reply_markup: isAdminChat(chatId) ? adminKeyboard() : kb,
      });
    }
  });
}

const ADMIN_IDS = String(ADMIN_ID || '').split(',').map((x) => x.trim()).filter(Boolean);
const isAdminChat = (id) => ADMIN_IDS.includes(String(id));
/** Админге: Mini App бірден «Админ» бөлімімен ашылады */
function adminKeyboard() {
  if (!WEBAPP_URL) return undefined;
  const base = WEBAPP_URL.replace(/\/$/, '') + '/webapp/';
  return { inline_keyboard: [[{ text: '🛠 Админ панель', web_app: { url: base + '#admin' } }], [{ text: '📱 Mini App', web_app: { url: base } }]] };
}

bot.onText(/^\/admin\b/, (msg) => {
  if (!isAdminChat(msg.chat.id)) return;
  const kb = adminKeyboard();
  bot.sendMessage(msg.chat.id, kb ? 'Админ панель:' : 'WEBAPP_URL орнатылмаған', kb ? { reply_markup: kb } : {}).catch(() => {});
});

// ─── /start ────────────────────────────────────────────────────────────────
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId   = msg.chat.id;
  const payload  = match?.[1]?.trim();
  let referredBy = null;

  if (payload && payload.startsWith('ref_')) {
    referredBy = payload.replace('ref_', '');
    if (referredBy === String(chatId)) referredBy = null; // өзін жіберген болса — есептемей
  }
  // Арна белгісі: t.me/<bot>?start=madein | tiktok | knu_aidos … — қай арна клиент әкелетінін /stats көрсетеді
  const source = payload && !payload.startsWith('ref_') && /^[\w-]{2,40}$/.test(payload) ? payload.toLowerCase() : null;

  const isNew = await registerUser(chatId, referredBy, source);
  // воронка: осы /start қай арнадан (сілтеме белгісі; реферал → ref; белгісіз → тіркелген арнасы)
  const evSource = source || (referredBy ? 'ref' : null);
  logEvent(chatId, 'start', evSource).catch(() => {});
  if (isNew) logEvent(chatId, 'new', evSource).catch(() => {});
  setBlocked(chatId, false).catch(() => {});
  setUserProfile(chatId, { name: [msg.from && msg.from.first_name, msg.from && msg.from.last_name].filter(Boolean).join(' '), username: msg.from && msg.from.username }).catch(() => {}); // бұрын бұғаттап, қайта оралған адам рассылкаға қайта кіреді
  // Орысша арна (?start=ru, teacher_ru, ru_tiktok …) — бот бірден орысша сөйлейді (кейін /lang-пен ауыстыруға болады)
  if (source && /(^|[_-])ru($|[_-])/.test(source)) await UL.setLang(chatId, 'ru').catch(() => {});
  const lang = await UL.langOf(chatId);

  // Реферал санауы презентация жасатқанда өседі — тіркелуде емес

  sendWelcome(chatId, lang).then(() => {
    // квиз ойнаған адам «өз квизіңді жаса» батырмасын басып келді → бірден квиз жасау батырмасы
    // мұғалімдер арнасы (постер/WhatsApp хабары: ?start=teacher, teacher_ru) — да бірден квиз жасау
    if (source === 'quiz_make' || /^teacher/.test(source || '')) return sendQuizOffer(chatId);
  }).catch((e) => console.warn('[Bot] /start:', e.message));
});

// ─── /lang: интерфейс тілі (қазақша / орысша) ─────────────────────────────
bot.onText(/^\/lang\b/, (msg) => {
  bot.sendMessage(msg.chat.id, bt('kk', 'langPick'), { reply_markup: { inline_keyboard: [[
    { text: 'Қазақша', callback_data: 'lang:kk' }, { text: 'Русский', callback_data: 'lang:ru' },
  ]] } }).catch(() => {});
});
bot.on('callback_query', async (cq) => {
  const m = /^lang:(kk|ru)$/.exec(cq.data || '');
  if (!m) return;
  const chatId = cq.message && cq.message.chat && cq.message.chat.id;
  if (!chatId) return;
  try {
    const lang = await UL.setLang(chatId, m[1]);
    await bot.answerCallbackQuery(cq.id, { text: bt(lang, 'langSet') }).catch(() => {});
    await sendWelcome(chatId, lang);   // жаңа тілде — мәзір батырмалары да ауысады
  } catch (e) {
    console.warn('[Bot] lang switch:', e.message);
    bot.answerCallbackQuery(cq.id).catch(() => {});
  }
});

// ─── /balance & "Менің есепшотым" ─────────────────────────────────────────
bot.onText(/\/balance/, (msg) => showBalance(msg.chat.id));

async function showBalance(chatId) {
  const user = await getUser(chatId);
  const lang = await UL.langOf(chatId);
  bot.sendMessage(chatId, bt(lang, 'balance', { credits: user.credits, total: user.total, refEarnings: user.refEarnings }),
    { parse_mode: 'Markdown', ...mainKeyboard(lang) });
}

// ─── /stats (тек админ): сурет лимиттері, тегін колодалар, арналар ─────────
bot.onText(/\/stats/, async (msg) => {
  if (!ADMIN_ID || String(msg.chat.id) !== String(ADMIN_ID)) return;
  try {
    const img = require('./products/presentation/images').imageStats();
    const H5 = 5 * 3600e3; const t = Date.now() + H5; const today = t - (t % 86400e3) - H5;
    const [ff, freeToday] = await Promise.all([freeFunnel(), countFreeDecksSince(today)]);
    const prov = Object.entries(img.providers).map(([n, p]) => `• ${n}: ${p.calls} сұраныс` + (p.hourLeft != null ? `, осы сағатта қалды ≈${p.hourLeft}` : '') + (p.monthLeft != null ? `, айына қалды ${p.monthLeft}` : '') + (p.paused ? ` ⏸ ${p.paused.slice(0, 16).replace('T', ' ')} UTC-ге дейін` : '') + (p.limited ? `, лимит ${p.limited} рет` : '')).join('\n');
    const conv = ff.freeUsers ? Math.round((ff.paidAfter / ff.freeUsers) * 100) : 0;
    const [fToday, fYest] = await Promise.all([funnelStats(funnelDay()), funnelStats(funnelDay(Date.now() - 86400e3))]);
    const src = (ff.sources || []).map((x) => `• ${x.source}: ${x.users} адам · тегін ${x.free} · төлеген ${x.paid}`).join('\n');
    const qz = await freeQuizStats(today).catch(() => null);
    const quizLine = qz ? `🎯 Тегін квиз: бүгін ${qz.today} · барлығы ${qz.total} · жасаған ${qz.makers} адам · ойналды ${qz.games} рет · ойыншы ${qz.players}\n` : '';
    await bot.sendMessage(msg.chat.id,
      `📊 Статистика\n\n🖼 Суреттер (сервер іске қосылғаннан бері):\n${prov || '—'}\n• кэштен алынды: ${img.cacheHits} · кэш ${img.imageCacheMB} МБ\n\n` +
      `🎁 Тегін презентация: бүгін ${freeToday} · барлығы ${ff.freeUsers} · кейін төлегендер ${ff.paidAfter} (${conv}%)\n` +
      `${quizLine}\n` +
      `🔗 Арналар (барлық уақыт):\n${src || '—'}\n\n` +
      require('./core/funnel').funnelText(fToday, fYest));
  } catch (e) {
    await bot.sendMessage(msg.chat.id, 'stats error: ' + e.message).catch(() => {});
  }
});

// ─── /referral & "Реферал сілтемем" ───────────────────────────────────────
bot.onText(/\/referral/, (msg) => showReferral(msg.chat.id));

async function showReferral(chatId) {
  const user = await getUser(chatId);
  const link = `https://t.me/${BOT_USERNAME}?start=ref_${chatId}`;

  // МАҢЫЗДЫ: сілтемеде екі жеке "_" бар (BOT_USERNAME ішінде және
  // "ref_" префиксінде). Telegram-нің Markdown parser-і "_..._"-ты italic
  // деп қабылдайды — екі бөлек "_" дұрыс жабылмай, БҮКІЛ ХАБАРЛАМА
  // "Can't parse entities" қатесімен ЖІБЕРІЛМЕЙ ҚАЛАДЫ (бот жауапсыз
  // қалады). Дәл байқалған "🔗 Реферал сілтемем батырмасы жауап бермейді"
  // багы осы еді. Шешім: сілтемені backtick (`) ішіне алу — Markdown-да
  // бұл inline code блогы, оның ІШІНДЕГІ "_" арнайы символ ретінде
  // ЕМЕС, әдеттегі таңба ретінде қабылданады.
  const lang = await UL.langOf(chatId);
  bot.sendMessage(chatId, bt(lang, 'referral', {
    link, per: REFERRALS_PER_BONUS, refEarnings: user.refEarnings, need: REFERRALS_PER_BONUS - (user.refEarnings % REFERRALS_PER_BONUS),
  }), { parse_mode: 'Markdown', disable_web_page_preview: true, ...mainKeyboard(lang) });
}

// ─── Серіктес бағдарламасы: әкелген клиенттің әр төлемінен PARTNER_RATE ──────────
const pct = Math.round(PARTNER_RATE * 100);

async function payPartnerCommission(buyerId, amount, ref) {
  try {
    const res = await creditPartnerCommission(buyerId, amount, ref);
    if (!res) return;
    const p = await getPartner(res.partnerId);
    const lang = await UL.langOf(res.partnerId);
    bot.sendMessage(res.partnerId, bt(lang, 'partnerCommission', { commission: res.commission, balance: p.balance }),
      { parse_mode: 'Markdown' }).catch(() => {});
  } catch (e) {
    console.error('[Partner] commission error:', e.message);
  }
}

async function showPartner(chatId, from) {
  const p = await getPartner(chatId);
  const link = `https://t.me/${BOT_USERNAME}?start=ref_${chatId}`;
  const lang = await UL.langOf(chatId);
  if (p.status === 'active') {
    return bot.sendMessage(chatId, bt(lang, 'partnerCabinet', { link, pct, balance: p.balance, earned: p.earned, paid: p.paid, buyers: p.buyers }),
      { parse_mode: 'Markdown', disable_web_page_preview: true, ...mainKeyboard(lang) });
  }
  if (p.status === 'pending') {
    return bot.sendMessage(chatId, bt(lang, 'partnerPending'), mainKeyboard(lang));
  }
  await requestPartner(chatId);
  const name = escapeMarkdown([from && from.first_name, from && from.last_name].filter(Boolean).join(' ') || 'Белгісіз');
  const uname = from && from.username ? ` @${escapeMarkdown(from.username)}` : '';
  if (ADMIN_ID) {
    bot.sendMessage(
      ADMIN_ID,
      `🤝 *Серіктес болуға сұраныс*\n\n👤 ${name}${uname}\n🆔 \`${chatId}\``,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
        { text: '✅ Рұқсат', callback_data: `pa:${chatId}` },
        { text: '❌ Бас тарту', callback_data: `pr:${chatId}` },
      ]] } }
    ).catch(() => {});
  }
  return bot.sendMessage(chatId, bt(lang, 'partnerRequested', { pct }), { parse_mode: 'Markdown', ...mainKeyboard(lang) });
}

bot.onText(/^\/partner\b/, (msg) => showPartner(msg.chat.id, msg.from));

// Админ: сұранысты қабылдау / бас тарту
bot.on('callback_query', async (cq) => {
  const data = cq.data || '';
  if (!data.startsWith('pa:') && !data.startsWith('pr:')) return;
  if (String(cq.from.id) !== String(ADMIN_ID)) {
    return bot.answerCallbackQuery(cq.id, { text: 'Тек админ', show_alert: true });
  }
  const targetId = data.slice(3);
  const ok = data.startsWith('pa:');
  try {
    await setPartnerStatus(targetId, ok ? 'active' : 'rejected');
    await bot.answerCallbackQuery(cq.id, { text: ok ? 'Серіктес болды' : 'Бас тартылды' });
    await bot.editMessageText(
      (cq.message.text || '') + (ok ? '\n\n✅ Рұқсат берілді' : '\n\n❌ Бас тартылды'),
      { chat_id: cq.message.chat.id, message_id: cq.message.message_id }
    ).catch(() => {});
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: cq.message.chat.id, message_id: cq.message.message_id }).catch(() => {});
    const tlang = await UL.langOf(targetId);
    bot.sendMessage(targetId, ok ? bt(tlang, 'partnerApproved', { pct }) : bt(tlang, 'partnerRejected'), { parse_mode: 'Markdown' }).catch(() => {});
  } catch (e) {
    console.error('[Partner] callback error:', e.message);
    bot.answerCallbackQuery(cq.id, { text: 'Қате', show_alert: true }).catch(() => {});
  }
});

// Админ: /payout <chatId> <сома> — серіктеске аударылған ақшаны баланстан алу; /partners — тізім
bot.onText(/^\/payout (\d+) (\d+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  const left = await payoutPartner(match[1], parseInt(match[2], 10));
  if (left === null) return bot.sendMessage(msg.chat.id, '❌ Баланс жеткіліксіз немесе серіктес табылмады.');
  bot.sendMessage(msg.chat.id, `✅ ${match[1]}: −${match[2]}₸. Қалған баланс: ${left}₸`);
  bot.sendMessage(match[1], bt(await UL.langOf(match[1]), 'partnerPayout', { amount: match[2], left }), { parse_mode: 'Markdown' }).catch(() => {});
});

// Админ: /learn — үйрену жүйесінің статистикасы; /learn <тақырып> — ұқсас тақырыптағы бұрынғы жұмыстар
bot.onText(/^\/learn(?:\s+(.+))?$/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  const { aggregate, similar } = require('./core/learning');
  try {
    const [templates, uses] = await Promise.all([listLearnedTemplates(1000), listLearnUses(5000)]);
    if (!templates.length) return bot.sendMessage(msg.chat.id, 'Әзірге дерек жоқ: клиент шаблон режимін қолданғанда жиналады.');
    const topic = match && match[1] ? match[1].trim() : '';
    if (topic) {
      const sim = similar(uses, topic, 8);
      return bot.sendMessage(msg.chat.id, sim.length
        ? `🔎 «${topic}» тақырыбына ұқсас бұрынғы жұмыстар:\n` + sim.map((x) => `• ${x.topic} — шаблон ${x.fingerprint}${x.rating ? ' · ' + '⭐'.repeat(x.rating) : ''}${x.outcome === 'failed' ? ' · ❌' : ''}`).join('\n')
        : `«${topic}» тақырыбына ұқсас жұмыс әлі жоқ.`);
    }
    const a = aggregate(templates, uses);
    const fmt = (arr) => arr.map(([k, v]) => `${k} (${v})`).join(', ') || '—';
    const pc = (v) => (v == null ? '—' : (v * 100).toFixed(1) + '%');
    bot.sendMessage(msg.chat.id,
      `🧠 Үйрену жүйесі\n\n` +
      `Шаблон: ${a.templates} (слайд: ${a.slides})\nҚолдану: ${a.uses} · сәтті ${a.done} · құлаған ${a.failed}\n` +
      `Таза сыйды: ${a.cleanFitPct}%\nТексеруші: ${a.qa.withIssues} рет ақау тапты, ${a.qa.allFixed} рет бәрін түзеді\nБаға: ${a.avgRating == null ? '—' : a.avgRating + '/5'} (${a.rated} баға)\n\n` +
      `Тақырып қарпі: слайд биіктігінің ${pc(a.typography.titleSizeRel)} · мәтін ${pc(a.typography.bodySizeRel)} · арақатынас ${a.typography.hierarchy ?? '—'}\n` +
      `Шеттер: сол ${pc(a.margins.left)}, жоғары ${pc(a.margins.top)}\nОрташа сөз/слайд: ${a.avgWordsPerSlide ?? '—'}\nҚараңғы шаблон: ${a.darkPct}%\n\n` +
      `Шрифт жұптары: ${fmt(a.topPairs)}\nТақырып шрифті: ${fmt(a.titleClasses)}\nМәтін шрифті: ${fmt(a.bodyClasses)}\n` +
      `Макеттер: ${fmt(a.topArchetypes)}\nМакет отбасылары (≥2 шаблонда): ${a.families.filter((f) => f.templates >= 2).length}`);
  } catch (e) {
    console.error('[Learn] /learn error:', e.message);
    bot.sendMessage(msg.chat.id, '❌ Статистика оқылмады: ' + e.message);
  }
});

bot.onText(/^\/partners$/, async (msg) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  const list = await listPartners();
  if (!list.length) return bot.sendMessage(msg.chat.id, 'Серіктес жоқ.');
  bot.sendMessage(msg.chat.id, list.map((p) =>
    `${p.chatId}: баланс ${p.balance}₸, тапқаны ${p.earned}₸, аударылған ${p.paid}₸, клиент ${p.buyers}`).join('\n'));
});

// ─── /help ─────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => showHelp(msg.chat.id));

async function showHelp(chatId) {
  const lang = await UL.langOf(chatId);
  // Canva лицензиясының шарты: Canva сервистің ішінде де аталады (docs/canva-permission.md) — мәтінде бар
  bot.sendMessage(chatId, bt(lang, 'help', { phone: KASPI_PHONE, name: KASPI_NAME }), { parse_mode: 'Markdown', ...mainKeyboard(lang) });
}

// ─── Чекті автоматты оқу және растау ─────────────────────────────────────
// Қайтарады: { handled: true } — пайдаланушыға жауап берілді (сәтті/бас тарту),
//            { handled: false, reason } — админге қолмен жіберу керек.
async function tryAutoConfirm(chatId, file) {
  const lang = await UL.langOf(chatId);
  // 1) Файл жүктеу (Telegram Bot API лимиті 20 МБ; чек кішкентай)
  if ((file.size || 0) > 5 * 1024 * 1024) return { handled: false, reason: 'too_big' };

  const link = await bot.getFileLink(file.fileId);
  const resp = await require('axios').get(link, { responseType: 'arraybuffer', timeout: 20000 });
  const buffer = Buffer.from(resp.data);

  // 2) Мәтін + парсинг; мәтін қабаты жоқ PDF не скриншот/фото — DeepSeek көзбен оқиды (core/receiptVision.js)
  let parsed = null;
  if (file.kind === 'pdf') {
    const text = await extractPdfText(buffer);
    if (text && text.trim().length >= 20) parsed = parseReceiptText(text);
  }
  if (!parsed || !parsed.ok) {
    // Мәтінсіз PDF (Kaspi чегі осындай — ішінде бір сурет) не скриншот/фото: DeepSeek көзбен оқиды.
    // Скриншот/фото ЕШҚАШАН автоматты расталмайды (жалған суретті модель ажырата алмайды) — админге тексеру тізімімен.
    // PDF — файл құрылымы Kaspi-дікіне дәл сай болса (core/receiptPdf.js) және оқылғаны сенімді болса ғана авто-растау.
    const V = require('./core/receiptVision');
    const img = file.kind === 'pdf' ? await V.pdfToPng(buffer) : buffer;
    const seen = img ? await V.readReceiptImage({ data: img, mime: file.kind === 'pdf' ? 'image/png' : (file.mime || 'image/jpeg') }) : null;
    const RP = require('./core/receiptPdf');
    const prof = file.kind === 'pdf' ? RP.kaspiPdfProfile(buffer) : null;
    // iPhone чегінде файл жасалған сәт бар: ол чектегі төлем уақытынан бұрын болса — чек жалған
    if (prof && seen && seen.date && RP.createdOk(prof, seen.date) === false) {
      prof.ok = false;
      prof.reasons.push(`файл ${prof.created.toISOString().slice(0, 16).replace('T', ' ')} UTC жасалған — чектегі төлем уақытына сай емес`);
    }
    console.log(`[Receipt] ${chatId}: vision ${seen ? `ok=${seen.ok} conf=${seen.confidence} edited=${seen.edited} amount=${seen.amount} date=${seen.dateRaw || '-'}` : 'failed'}${prof ? ` pdf=${prof.ok ? prof.profile : 'FAIL: ' + prof.reasons.join('; ')}` : ''}`);
    const reason = file.kind === 'pdf' ? (prof && !prof.ok ? 'pdf_not_kaspi' : 'no_text_layer') : 'image';
    if (!seen) return { handled: false, reason };
    if (!seen.isReceipt) return { handled: false, reason: 'vision_not_receipt', seen };
    const adminChecks = async () => {
      const user = await getUser(chatId);
      const checks = V.reviewSeen(seen, {
        expectedName: KASPI_NAME, maxAgeMin: RECEIPT_MAX_AGE_MIN,
        pricePerCredit: PRICE, firstPrice: FIRST_PRICE, isFirstPurchase: user.total === 0, bundles: BUNDLES,
      });
      if (prof) checks.unshift(prof.ok ? { ok: true, text: 'PDF құрылымы Kaspi чегіне сай' } : { ok: false, text: `PDF: ${prof.reasons.join('; ')}` });
      if (seen.receiptNo) {
        const { receiptExists } = require('./db');
        checks.push(await receiptExists(seen.receiptNo).catch(() => false)
          ? { ok: false, text: `№${seen.receiptNo} бұрын қолданылған` }
          : { ok: true, text: `№${seen.receiptNo} жаңа` });
      } else checks.push({ ok: null, text: 'Чек нөмірі оқылмады' });
      return checks;
    };
    if (!(prof && prof.ok && seen.ok)) return { handled: false, reason: prof && prof.ok ? 'vision_unsure' : reason, seen, checks: await adminChecks() };
    parsed = seen;
    parsed.adminChecks = adminChecks;
  }

  // 3) Қайталанған чек — бірден бас тарту (оқылған, бірақ қолданылған)
  const { receiptExists } = require('./db');
  if (await receiptExists(parsed.receiptNo)) {
    await bot.sendMessage(chatId, bt(lang, 'receiptUsed'));
    return { handled: true };
  }

  // 4) Тексеру
  const user = await getUser(chatId);
  const verdict = validateReceipt(parsed, {
    expectedName: KASPI_NAME,
    pricePerCredit: PRICE,
    firstPrice: FIRST_PRICE,
    isFirstPurchase: user.total === 0,
    bundles: BUNDLES,
    maxAgeMin: RECEIPT_MAX_AGE_MIN,
  });

  if (!verdict.ok) {
    // Көзбен оқылған чек: модель қате оқуы мүмкін — адал студентке нақақ бас тартпаймыз, шешім админде
    if (parsed.source === 'vision') return { handled: false, reason: verdict.reason, seen: parsed, checks: await parsed.adminChecks() };
    // Анық жалған/қате себептер — пайдаланушыға айтамыз, админді мазаламаймыз
    const clear = ['wrong_recipient', 'too_old', 'future_date', 'not_successful'];
    if (clear.includes(verdict.reason)) {
      await bot.sendMessage(chatId, bt(lang, 'rc_' + verdict.reason));
      return { handled: true };
    }
    // bad_amount, no_recipient және т.б. — адам қарасын
    return { handled: false, reason: verdict.reason };
  }

  // 5) Атомарлы қолдану (қайталанудан қорғалған)
  const applied = await applyReceipt(chatId, parsed.receiptNo, parsed.amount, verdict.credits);
  if (!applied.applied) {
    await bot.sendMessage(chatId, bt(lang, 'receiptUsedShort'));
    return { handled: true };
  }
  logEvent(chatId, 'paid').catch(() => {});

  await bot.sendMessage(chatId, bt(lang, 'paid', { credits: verdict.credits, total: applied.user.credits }),
    { parse_mode: 'Markdown', ...mainKeyboard(lang) });

  await payPartnerCommission(chatId, parsed.amount, `r:${parsed.receiptNo}`);

  // Админге ақпарат (әрекет қажет емес)
  if (ADMIN_ID) {
    bot.sendMessage(
      ADMIN_ID,
      `🤖 Авто-растау: ${chatId} → +${verdict.credits} кредит (${parsed.amount}₸, чек №${parsed.receiptNo})${parsed.source === 'vision' ? ' · Kaspi PDF (құрылымы тексерілді)' : ''}`
    ).catch(() => {});
  }
  return { handled: true };
}

// ─── Чекті растау (админ батырмасы / таймер / /confirm) ─────────────────
/**
 * Қолмен растау (админ батырмасы / таймер / /confirm).
 * receiptNo белгілі болса (DeepSeek оқыған) — чек нөмірі деректер қорына жазылады (applyReceipt, атомарлы):
 * сол чек қайта келсе (скриншот не PDF) — «бұрын қолданылған», екінші рет кредит берілмейді.
 */
async function confirmPendingReceipt(chatId, credits, source, receiptNo = null) {
  // Сол пайдаланушының күтудегі чектері: таймерлері тоқтайды. ДӘЛ СОЛ чектің (нөмірі бірдей) қайталанған хабары
  // «өңделді» деп белгіленеді — оның батырмасы екінші рет кредит бермейді. Басқа нөмірлі чек (бөлек төлем) күтуде қалады.
  for (const [pid, p] of pendingReceipts) {
    if (String(p.chatId) !== String(chatId)) continue;
    if (receiptNo && p.receiptNo && p.receiptNo !== receiptNo) continue;
    clearTimeout(p.timer);
    pendingReceipts.delete(pid);
    if (receiptNo && p.receiptNo === receiptNo) handledPending.add(pid);
  }

  const before = await getUser(chatId);
  // Қолмен растауда сома белгісіз — кредит санынан бағамен есептейміз (Plus / бірінші баға / әдепкі)
  const paid = paidFor(credits, before.total === 0);
  let user;
  if (receiptNo) {
    const applied = await applyReceipt(chatId, receiptNo, paid, credits);
    if (!applied.applied) {
      if (ADMIN_ID) bot.sendMessage(ADMIN_ID, `⚠️ ${chatId}: чек №${receiptNo} бұрын қолданылған — кредит ҚОСЫЛМАДЫ.`).catch(() => {});
      return null;
    }
    user = applied.user;
  } else {
    user = await addCredits(chatId, credits);
  }
  logEvent(chatId, 'paid').catch(() => {});
  const payRef = receiptNo ? `r:${receiptNo}` : `m:${chatId}:${Date.now()}`;
  logPayment(chatId, paid, credits, payRef).catch((e) => console.warn('[Pay] log failed', e.message));
  await payPartnerCommission(chatId, paid, payRef);

  const lang = await UL.langOf(chatId);
  await bot.sendMessage(chatId, bt(lang, 'paid', { credits, total: user.credits }),
    { parse_mode: 'Markdown', ...mainKeyboard(lang) }).catch(() => {});

  if (ADMIN_ID) {
    bot.sendMessage(
      ADMIN_ID,
      `✅ ${source}: ${chatId} → +${credits} кредит. Қалған: ${user.credits}.`
    ).catch(() => {});
  }
  return user;
}

async function rejectPendingReceipt(chatId, source) {
  console.log(`[Receipt] reject: ${chatId} (${source})`);
  for (const [pid, p] of pendingReceipts) {
    if (String(p.chatId) === String(chatId)) {
      clearTimeout(p.timer);
      pendingReceipts.delete(pid);
      handledPending.add(pid);
    }
  }
  await bot.sendMessage(chatId, bt(await UL.langOf(chatId), 'rejected')).catch(() => {});
  if (ADMIN_ID) {
    bot.sendMessage(ADMIN_ID, `❌ ${source}: ${chatId} — бас тартылды.`).catch(() => {});
  }
}

// ─── /confirm <chatId> <amount> — тек admin ───────────────────────────────
bot.onText(/\/confirm (\d+) (\d+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;

  const targetId = match[1];
  const amount   = parseInt(match[2], 10);

  if (isNaN(amount) || amount < 1) {
    return bot.sendMessage(msg.chat.id, '❌ Дұрыс сан жазыңыз.');
  }

  await confirmPendingReceipt(targetId, amount, '/confirm');
});

// ─── Админ батырмалары (растау / бас тарту) ───────────────────────────────
bot.on('callback_query', async (cq) => {
  const data = cq.data || '';
  console.log('[Callback] келді:', data, 'from', cq.from && cq.from.id);
  if (!data.startsWith('rc:') && !data.startsWith('rj:')) {
    return; // басқа callback-тар (бар болса) өзгермейді
  }
  if (String(cq.from.id) !== String(ADMIN_ID)) {
    return bot.answerCallbackQuery(cq.id, { text: 'Тек админ', show_alert: true });
  }

  try {
    if (data.startsWith('rc:')) {
      // rc:<chatId>:<credits>:<pendingId>
      const parts = data.split(':');
      const targetId = parts[1];
      const credits  = parseInt(parts[2], 10) || 1;
      const pendingId = parts[3];
      // батырма екі рет басылса / сол пайдаланушының басқа чегі бұрын расталса — қайта кредит жоқ
      if (pendingId && handledPending.has(pendingId)) return bot.answerCallbackQuery(cq.id, { text: 'Бұл чек бұрын өңделген', show_alert: true });
      const entry = pendingId ? pendingReceipts.get(pendingId) : null;
      if (pendingId) handledPending.add(pendingId);
      if (entry) { clearTimeout(entry.timer); pendingReceipts.delete(pendingId); }
      const done = await confirmPendingReceipt(targetId, credits, 'батырма', entry && entry.receiptNo);
      if (!done) {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: cq.message.chat.id, message_id: cq.message.message_id }).catch(() => {});
        return bot.answerCallbackQuery(cq.id, { text: 'Чек бұрын қолданылған — кредит қосылмады', show_alert: true });
      }
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
      }).catch(() => {});
      await bot.answerCallbackQuery(cq.id, { text: `+${credits} кредит` });
      await bot.editMessageText(
        (cq.message.text || '') + `\n\n✅ Расталды: +${credits} кредит`,
        { chat_id: cq.message.chat.id, message_id: cq.message.message_id }
      ).catch(() => {});
    } else if (data.startsWith('rj:')) {
      // rj:<chatId>:<pendingId>
      const parts = data.split(':');
      const targetId = parts[1];
      const pendingId = parts[2];
      if (pendingId && handledPending.has(pendingId)) return bot.answerCallbackQuery(cq.id, { text: 'Бұл чек бұрын өңделген', show_alert: true });
      if (pendingId) handledPending.add(pendingId);
      if (pendingId && pendingReceipts.has(pendingId)) {
        clearTimeout(pendingReceipts.get(pendingId).timer);
        pendingReceipts.delete(pendingId);
      }
      await rejectPendingReceipt(targetId, 'батырма');
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
      }).catch(() => {});
      await bot.answerCallbackQuery(cq.id, { text: 'Бас тартылды' });
      await bot.editMessageText(
        (cq.message.text || '') + '\n\n❌ Бас тартылды',
        { chat_id: cq.message.chat.id, message_id: cq.message.message_id }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[Receipt] callback error:', err.message);
    bot.answerCallbackQuery(cq.id, { text: 'Қате', show_alert: true }).catch(() => {});
  }
});

// ─── Клиент бағасы: ⭐ батырмалары (fb:<jobId>:<1-5>) ─────────────────────
// Пікір жазуды күтіп тұрған чаттар: chatId → { jobId, until }. Мәзір батырмасы басылса — бас тартылады.
const pendingComment = new Map();
const COMMENT_WAIT_MS = 15 * 60 * 1000;
const MENU_TEXTS = new Set(MENU_ACTION.keys());   // екі тілдегі мәзір батырмалары

/** Админге: кім, қандай жұмысқа, қандай баға/пікір (төмен бағада — жазуға сілтеме). Ешқашан лақтырмайды. */
async function notifyAdminFeedback(job, from, { rating, comment } = {}) {
  if (!ADMIN_ID || !job) return;
  try {
    const who = [from && from.first_name, from && from.last_name].filter(Boolean).join(' ') || 'Клиент';
    const user = from && from.username ? ` (@${from.username})` : '';
    const topic = String(job.title || (job.payload && job.payload.topic) || '').slice(0, 80);
    const meta = [job.payload && job.payload.slideCount ? job.payload.slideCount + ' слайд' : '', job.payload && job.payload.free ? 'тегін' : '', job.payload && job.payload.mode === 'template' ? 'шаблон' : job.payload && job.payload.mode === 'referat' ? 'реферат' : ''].filter(Boolean).join(' · ');
    const head = rating ? `${'⭐'.repeat(rating)}${'☆'.repeat(5 - rating)} ${rating}/5` : '💬 Пікір';
    const low = rating && rating <= 3 ? `\n✉️ Жазу: tg://user?id=${job.chatId}` : '';
    await bot.sendMessage(ADMIN_ID,
      `${head} — ${who}${user}\n📊 ${topic}${meta ? '\n' + meta : ''}` + (comment ? `\n\n«${String(comment).slice(0, 1500)}»` : '') + low + `\n🆔 ${job.chatId}`,
      { disable_web_page_preview: true });
    // ⭐1–3: файлдың өзін де жібереміз — не ұнамағанын бірден көру үшін
    if (rating && rating <= 3 && job.pptxPath && require('fs').existsSync(job.pptxPath)) {
      const isDocx = job.payload && job.payload.mode === 'referat';
      await bot.sendDocument(ADMIN_ID, job.pptxPath, { caption: `${rating}/5 · 🆔 ${job.chatId}` }, {
        filename: (String(job.title || 'presentation').replace(/[^\w\u0400-\u04FF\- ]+/g, '').slice(0, 60) || 'file') + (isDocx ? '.docx' : '.pptx'),
        contentType: isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }).catch((e) => console.warn('[Feedback] admin file send failed:', e.message));
    }
  } catch (e) { console.warn('[Feedback] admin notify failed:', e.message); }
}

bot.on('callback_query', async (cq) => {
  // «Пікір жазу» / «Өткізу»
  const cc = parseCommentCallback(cq.data);
  if (cc) {
    const chatId = cq.message.chat.id;
    try {
      const lang = await UL.langOf(chatId);
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: cq.message.message_id }).catch(() => {});
      if (cc.action === 'skip') {
        pendingComment.delete(String(chatId));
        await bot.answerCallbackQuery(cq.id, { text: bt(lang, 'fbSkip') });
        return;
      }
      pendingComment.set(String(chatId), { jobId: cc.jobId, until: Date.now() + COMMENT_WAIT_MS });
      await bot.answerCallbackQuery(cq.id);
      await bot.sendMessage(chatId, bt(lang, 'fbWrite'), mainKeyboard(lang));
    } catch (e) {
      console.error('[Feedback] comment button error:', e.message);
      bot.answerCallbackQuery(cq.id).catch(() => {});
    }
    return;
  }
  const fb = parseFeedbackCallback(cq.data);
  if (!fb) return;
  const lang = await UL.langOf(cq.from.id);
  try {
    const job = await getJob(fb.jobId);
    if (!job || String(job.chatId) !== String(cq.from.id)) {
      return bot.answerCallbackQuery(cq.id, { text: bt(lang, 'fbExpired'), show_alert: false });
    }
    await setFeedback(fb.jobId, job.chatId, { rating: fb.rating });
    await bot.answerCallbackQuery(cq.id, { text: bt(lang, 'fbRated', { rating: fb.rating }) });
    // Жұлдыздарды жаңартамыз (қайта басып өзгертуге болады)
    await bot.editMessageReplyMarkup(ratingKeyboard(fb.jobId, fb.rating), { chat_id: cq.message.chat.id, message_id: cq.message.message_id }).catch(() => {});
    // force_reply ЖОҚ: ол төменгі мәзірді жасырып, адамды жазуға мәжбүрлейтін. Енді — «Пікір жазу / Өткізу» батырмалары.
    await bot.sendMessage(cq.message.chat.id, commentPromptText(fb.jobId, fb.rating, lang), { reply_markup: commentKeyboard(fb.jobId, lang) });
    notifyAdminFeedback(job, cq.from, { rating: fb.rating });
  } catch (e) {
    console.error('[Feedback] callback error:', e.message);
    bot.answerCallbackQuery(cq.id, { text: bt(lang, 'fbError') }).catch(() => {});
  }
});

// ─── /broadcast <хабар> — тек admin, барлық пайдаланушыға жіберу ─────────
// Бір мезгілде тек бір broadcast (екіншісі бір адамға екі рет жіберер еді).
// Логика core/broadcast.js-те: формат бір рет тексеріледі, 429 болса күтіп қайталайды, прогресс көрінеді.
const BC = require('./core/broadcast');
const { plainText } = require('./core/crashGuard');
let broadcastBusy = false;
let lastBroadcast = null; // { body, opts, failed } — /broadcast_retry үшін (процесс қайта қосылғанша)

async function doBroadcast(adminChat, ids, rawText, title) {
  if (broadcastBusy) return bot.sendMessage(adminChat, '⏳ Алдыңғы broadcast әлі жүріп жатыр — аяқталуын күтіңіз.');
  broadcastBusy = true;
  try {
    const raw = bot.__rawSendMessage || bot.sendMessage.bind(bot);
    // 1) Формат: админге алдын ала көрініс Markdown-пен; талданбаса — бәріне форматсыз (әр адамға бір сұраныс)
    let body = rawText, opts = { parse_mode: 'Markdown' };
    const mode = await BC.decideFormat(() => raw(adminChat, rawText, opts));
    if (mode === 'plain') {
      body = plainText(rawText); opts = {};
      await raw(adminChat, body, opts).catch(() => {});
    }
    const targets = [...new Set(ids.map(String))].filter((id) => id !== String(adminChat)); // админ көріністі алды
    console.log(`[Broadcast] start total=${targets.length} format=${mode}`);
    const status = await bot.sendMessage(adminChat,
      `👆 Хабар осылай көрінеді${mode === 'plain' ? ' (Markdown белгілері талданбады — форматсыз жіберіледі)' : ''}.\n\n` +
      BC.progressText({ done: 0, total: targets.length, sent: 0, blocked: 0, failed: [] }, title));
    const edit = (s) => bot.editMessageText(BC.progressText(s, title), { chat_id: adminChat, message_id: status.message_id }).catch(() => {});

    const st = await BC.runBroadcast({
      ids: targets,
      send: (id) => raw(id, body, opts),
      onBlocked: (id) => setBlocked(id, true).catch(() => {}),
      onProgress: edit,
    });
    console.log(`[Broadcast] done total=${st.total} sent=${st.sent} blocked=${st.blocked} failed=${st.failed.length} retries=${st.retries}`);
    lastBroadcast = { body, opts, failed: st.failed };
    await edit(st);
    await bot.sendMessage(adminChat,
      `✅ ${title} аяқталды!\n\n📨 Жеткізілді: ${st.sent}\n⛔ Бұғаттаған/өшірілген: ${st.blocked} (келесі рассылкаға кірмейді)\n❌ Жетпеді: ${st.failed.length}` +
      (st.failed.length ? '\n\nЖетпегендерге қайта жіберу: /broadcast_retry' : ''));
  } catch (err) {
    console.error('[Broadcast] error:', err.message);
    bot.sendMessage(adminChat, `❌ Broadcast тоқтады: ${err.message}`).catch(() => {});
  } finally {
    broadcastBusy = false;
  }
}

// /broadcast <хабар> — тек admin, барлық пайдаланушыға
bot.onText(/\/broadcast ([\s\S]+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  const text = match[1].trim();
  if (!text) return bot.sendMessage(msg.chat.id, '❌ Хабар мәтінін жазыңыз: /broadcast Мәтін...');
  const chatIds = await getAllChatIds();
  return doBroadcast(msg.chat.id, chatIds, text, '📤 Broadcast');
});

// /broadcast_to 123,456 ⏎ Мәтін — тек көрсетілген адамдарға (мысалы бұрын жетпегендерге)
bot.onText(/^\/broadcast_to(?:@\w+)?\s+([\s\S]+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  const t = BC.parseTargeted(match[1]);
  if (!t) return bot.sendMessage(msg.chat.id, '❌ Үлгі:\n/broadcast_to 111111, 222222\nХабар мәтіні (жаңа жолдан)');
  return doBroadcast(msg.chat.id, t.ids, t.text, `📤 Broadcast (${t.ids.length} адамға)`);
});

// /broadcast_retry — соңғы broadcast-та жетпегендерге сол мәтінді қайта жіберу
bot.onText(/^\/broadcast_retry(?:@\w+)?\s*$/, async (msg) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  if (!lastBroadcast || !lastBroadcast.failed.length) return bot.sendMessage(msg.chat.id, 'Қайта жіберетін ешкім жоқ (немесе бот қайта қосылған).');
  const { body, failed } = lastBroadcast;
  return doBroadcast(msg.chat.id, failed, body, `🔁 Қайта жіберу (${failed.length} адамға)`);
});

// ─── Негізгі хабар обработчигі ────────────────────────────────────────────
// ─── Тестер пікірі: презентациядан кейінгі 3 сұраққа бір хабарламамен жауап ─────
const TESTER_MIN_CHARS = 15;
/** true → хабарлама тестер пікірі ретінде өңделді */
async function handleTesterFeedback(chatId, text, from) {
  if (!text || MENU_TEXTS.has(text)) return false;
  const t = await getTester(chatId).catch(() => null);
  if (!t || !t.tester_pending || t.tester_pending === 'busy') return false;
  const job = await getJob(t.tester_pending).catch(() => null);
  if (!job || job.status !== 'done' || String(job.chatId) !== String(chatId)) return false;
  if (text.trim().length < TESTER_MIN_CHARS) {
    await bot.sendMessage(chatId, '✍️ Сәл толығырақ жазыңыз: 3 сұрақтың әрқайсысына қысқа жауап (сурет/мәтін, факт, мұғалімге тапсырар ма едіңіз).');
    return true;
  }
  await logTesterFeedback(job.id, chatId, text.trim());
  pendingComment.delete(String(chatId));
  const left = testerCore.creditsToday(await getTester(chatId).catch(() => null));
  await bot.sendMessage(chatId, `🙏 Рахмет! Пікіріңіз сақталды.
🧪 Бүгін тағы ${left} тегін презентация жасай аласыз.`, MAIN_KEYBOARD).catch(() => {});
  if (ADMIN_ID) {
    try {
      const who = [from && from.first_name, from && from.last_name].filter(Boolean).join(' ') || 'Тестер';
      const user = from && from.username ? ` (@${from.username})` : '';
      const topic = String(job.title || (job.payload && job.payload.topic) || '').slice(0, 80);
      await bot.sendMessage(ADMIN_ID, `🧪 Тестер пікірі — ${who}${user}\n📊 ${topic}\n\n«${text.trim().slice(0, 3000)}»\n🆔 ${chatId}`, { disable_web_page_preview: true });
      if (job.pptxPath && require('fs').existsSync(job.pptxPath)) {
        const isDocx = job.payload && job.payload.mode === 'referat';
        await bot.sendDocument(ADMIN_ID, job.pptxPath, { caption: `🧪 ${who} · 🆔 ${chatId}` }, {
          filename: (String(job.title || 'presentation').replace(/[^\w\u0400-\u04FF\- ]+/g, '').slice(0, 60) || 'file') + (isDocx ? '.docx' : '.pptx'),
          contentType: isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        });
      }
    } catch (e) { console.warn('[Tester] admin notify failed:', e.message); }
  }
  return true;
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text   = msg.text;

  if (text && text.startsWith('/')) return;
  if (msg.successful_payment) return; // Stars төлемі — төмендегі бөлек өңдеуші (onStarsPaid)
  const lang = await UL.langOf(chatId);
  const MK = mainKeyboard(lang);

  // Тестер пікір күтіп тұрса — мәтін соған жазылады (мәзір батырмалары өтеді)
  try {
    if (await handleTesterFeedback(chatId, text, msg.from)) return;
  } catch (e) { console.error('[Tester] feedback error:', e.message); }

  // Пікір: біздің «Пікір қалдырғыңыз келсе…» хабарламамызға Reply ретінде жазылған мәтін
  const replied = msg.reply_to_message;
  if (text && replied && replied.from && replied.from.is_bot && jobTagOf(replied.text)) {
    const jobId = jobTagOf(replied.text);
    try {
      const job = await getJob(jobId);
      if (!job || String(job.chatId) !== String(chatId)) return bot.sendMessage(chatId, bt(lang, 'fbExpiredComment'));
      const saved = await setFeedback(jobId, chatId, { comment: text });
      pendingComment.delete(String(chatId));
      if (saved) notifyAdminFeedback(job, msg.from, { comment: text });
      return bot.sendMessage(chatId, bt(lang, saved ? 'fbThanks' : 'fbRateFirst'), MK);
    } catch (e) {
      console.error('[Feedback] comment error:', e.message);
      return bot.sendMessage(chatId, bt(lang, 'fbNotSavedLater'));
    }
  }

  // «✍️ Пікір жазу» басылғаннан кейінгі бірінші мәтін — пікір; мәзір батырмасы басылса — пікірден бас тартамыз
  const pend = pendingComment.get(String(chatId));
  if (pend) {
    pendingComment.delete(String(chatId));
    if (text && !MENU_TEXTS.has(text) && Date.now() < pend.until) {
      try {
        const job = await getJob(pend.jobId);
        if (job && String(job.chatId) === String(chatId)) {
          const saved = await setFeedback(pend.jobId, chatId, { comment: text });
          if (saved) notifyAdminFeedback(job, msg.from, { comment: text });
          return bot.sendMessage(chatId, bt(lang, saved ? 'fbThanks' : 'fbNotSaved'), MK);
        }
      } catch (e) { console.error('[Feedback] pending comment error:', e.message); }
    }
  }

  // Мәзір батырмалары екі тілде де танылады (тіл ауысқанда ескі пернетақта да жұмыс істейді)
  const act = menuAction(text);
  if (act === 'balance') return showBalance(chatId);
  if (act === 'help')    return showHelp(chatId);
  if (act === 'ref')     return showReferral(chatId);
  if (act === 'partner') return showPartner(chatId, msg.from);

  if (act === 'quiz') return sendQuizOffer(chatId);

  if (act === 'app') {
    const kb = webAppKeyboard(lang);
    if (kb) return bot.sendMessage(chatId, bt(lang, 'appIntro'), { parse_mode: 'Markdown', reply_markup: kb });
    return bot.sendMessage(chatId, bt(lang, 'appMissing'));
  }

  // Ескі пернетақтадағы «Тақырып жазу» (чатта генерация енді жоқ) → Mini App-қа бағыттаймыз
  if (act === 'legacy') {
    // Ескі пернетақта: алдымен мәзірді жаңартамыз, сосын Mini App батырмасы
    await bot.sendMessage(chatId, bt(lang, 'menuUpdated'), MK).catch(() => {});
    return sendMiniAppHint(chatId, lang);
  }

  if (act === 'buy') {
    const user = await getUser(chatId);
    if (user.total === 0) {
      return bot.sendMessage(chatId,
        bt(lang, 'firstPurchase', { first: FIRST_PRICE, price: PRICE, plusLine: plusLineFor(lang), phone: KASPI_PHONE, name: KASPI_NAME }),
        { parse_mode: 'Markdown', ...starsButton(lang) });
    }
    waitingForCount.add(chatId);
    return bot.sendMessage(chatId, bt(lang, 'askCount', { price: PRICE, plusLine: plusLineFor(lang) }),
      { parse_mode: 'Markdown', ...starsButton(lang) });
  }

  // Чек: PDF, сурет-файл не фото (скриншот)
  const isImageDoc = msg.document && /^image\//.test(msg.document.mime_type || '');
  if (msg.document || (msg.photo && msg.photo.length)) {
    const fileName = ((msg.document && msg.document.file_name) || '').toLowerCase();
    const isPdf    = !!msg.document && (fileName.endsWith('.pdf') || msg.document.mime_type === 'application/pdf');

    if (msg.document && !isPdf && !isImageDoc) {
      return bot.sendMessage(chatId, bt(lang, 'receiptAsPdf'), { parse_mode: 'Markdown' });
    }
    const photo = msg.photo && msg.photo.length ? msg.photo[msg.photo.length - 1] : null;   // ең үлкен өлшемі
    const file = isPdf
      ? { kind: 'pdf', fileId: msg.document.file_id, size: msg.document.file_size }
      : photo ? { kind: 'image', fileId: photo.file_id, size: photo.file_size, mime: 'image/jpeg' }
        : { kind: 'image', fileId: msg.document.file_id, size: msg.document.file_size, mime: msg.document.mime_type };

    const userName = escapeMarkdown([msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || 'Белгісіз');

    // ── Автоматты растау: мәтін не DeepSeek көзбен оқу; сәтті болса бірден растайды ─────────
    let failReason = 'manual';
    let seenByVision = null;
    let checks = null;
    if (AUTO_CONFIRM) {
      try {
        const result = await tryAutoConfirm(chatId, file);
        if (result.handled) return;
        failReason = result.reason;
        seenByVision = result.seen || null;
        checks = result.checks || null;
        // фото/скриншот чек емес болса (кездейсоқ сурет) — студентке айтамыз, админді мазаламаймыз
        if (file.kind === 'image' && failReason === 'vision_not_receipt') {
          return bot.sendMessage(chatId, bt(lang, 'notReceipt'), { parse_mode: 'Markdown' });
        }
        console.log(`[Receipt] ${chatId}: авто-растау өтпеді (${result.reason}) → админ${RECEIPT_TIMER_CREDIT ? ' + таймер' : ''}`);
      } catch (err) {
        console.error('[Receipt] parse error:', err.message);
      }
    }

    // ── Админге батырма + таймер (парсингсіз сенім) ──────────────────────
    if (!ADMIN_ID) {
      return bot.sendMessage(chatId, bt(lang, 'noAdmin'));
    }

    const pendingId = `${chatId}_${Date.now()}`;
    const timeoutSec = AUTO_CONFIRM_TIMEOUT_SEC;
    const timeoutMin = Math.max(1, Math.round(timeoutSec / 60));

    await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id);

    const why = {
      image: '🖼 Скриншот/фото — тек қолмен растау',
      pdf_not_kaspi: '⚠️ PDF Kaspi чегінің құрылымына сай емес (басқа бағдарламада жасалған/өңделген болуы мүмкін)',
      vision_unsure: '❔ PDF түпнұсқа, бірақ DeepSeek чекті сенімді оқи алмады',
      no_text_layer: '❔ PDF чегі оқылмады',
      vision_not_receipt: '⚠️ DeepSeek: бұл Kaspi чегі емес сияқты',
      bad_amount: '❔ Сома бағаға сай емес',
      no_recipient: '❔ Алушы оқылмады',
      wrong_recipient: '⚠️ Алушы басқа сияқты',
      too_old: '⚠️ Чек 60 минуттан ескі сияқты',
      future_date: '⚠️ Чектің уақыты дұрыс емес сияқты',
      not_successful: '⚠️ «Сәтті» белгісі көрінбейді',
    }[failReason] || '❔ Автоматты тексеру өтпеді';
    // DeepSeek не оқыды + әр тармақтың тексерісі — админ чекпен бірден салыстырсын.
    // Ескерту: сурет жалған болуы мүмкін — түпкі тексеріс Kaspi қосымшасындағы түсім.
    const mark = (c) => (c.ok === true ? '✅' : c.ok === false ? '❌' : '❔');
    const seenLine = checks
      ? `\n\n🤖 DeepSeek оқығаны (сенім ${Math.round((seenByVision.confidence || 0) * 100)}%):\n`
        + checks.map((c) => `${mark(c)} ${escapeMarkdown(c.text)}`).join('\n')
        + '\n⚠️ Суретті жасау оңай — Kaspi-де түсімді өзіңіз тексеріңіз'
      : seenByVision
        ? `\n🤖 DeepSeek оқығаны: ${seenByVision.amount != null ? `${seenByVision.amount}₸` : '?'} · ${seenByVision.dateRaw || '?'} · ${escapeMarkdown(seenByVision.recipient || '?')}`
        : '';
    // сол чек нөмірі әлі шешілмеген басқа хабарда тұр ма (студент екі рет жіберген)
    const receiptNo = (seenByVision && seenByVision.receiptNo) || null;
    const dupPending = receiptNo && [...pendingReceipts.values()].some((p) => p.receiptNo === receiptNo);
    const dupLine = dupPending ? `\n\n⚠️ Бұл чек (№${receiptNo}) жоғарыда күтіп тұр — ЕКІНШІ рет жіберілген. Біреуін ғана растаңыз.` : '';
    const adminMsg = await bot.sendMessage(
      ADMIN_ID,
      `📥 *Жаңа чек!*\n\n👤 ${userName}\n🆔 \`${chatId}\`\n${why} (\`${failReason}\`)${seenLine}${dupLine}\n\n` +
      (RECEIPT_TIMER_CREDIT ? `⏱ ${timeoutMin} мин ішінде жауап бермесеңіз — *автоматты +1 кредит*.\n` : '👆 Чекті қарап, шешім қабылдаңыз (автоматты кредит жоқ).\n') +
      `Немесе: \`/confirm ${chatId} <сан>\``,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ 1 кредит', callback_data: `rc:${chatId}:1:${pendingId}` },
              { text: '✅ 2', callback_data: `rc:${chatId}:2:${pendingId}` },
              { text: '✅ 3', callback_data: `rc:${chatId}:3:${pendingId}` },
            ],
            [
              { text: `✅ ${PACK.credits} · ${PACK.name}`, callback_data: `rc:${chatId}:${PACK.credits}:${pendingId}` },
              { text: '❌ Растамау', callback_data: `rj:${chatId}:${pendingId}` },
            ],
          ],
        },
      }
    );

    // Таймер (тек RECEIPT_TIMER_CREDIT=1): админ баспаса — автоматты +1 кредит
    const timer = !RECEIPT_TIMER_CREDIT ? null : setTimeout(async () => {
      if (!pendingReceipts.has(pendingId)) return;
      pendingReceipts.delete(pendingId);
      handledPending.add(pendingId);
      try {
        await confirmPendingReceipt(chatId, 1, `таймер ${timeoutMin}мин`, receiptNo);
        if (adminMsg && adminMsg.message_id) {
          bot.editMessageText(
            (adminMsg.text || '') + `\n\n🤖 Автоматты расталды (+1) — ${timeoutMin} мин өтті`,
            { chat_id: ADMIN_ID, message_id: adminMsg.message_id }
          ).catch(() => {});
          bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: ADMIN_ID, message_id: adminMsg.message_id,
          }).catch(() => {});
        }
      } catch (err) {
        console.error('[Receipt] auto-timeout confirm error:', err.message);
      }
    }, timeoutSec * 1000);

    pendingReceipts.set(pendingId, { chatId, timer, adminMsgId: adminMsg.message_id, receiptNo });

    return bot.sendMessage(chatId, bt(lang, 'receiptReceived'), { parse_mode: 'Markdown' });
  }

  if (!text) return;

  if (/^\s*(plus|плюс|\+)\s*$/i.test(text)) {
    waitingForCount.delete(chatId);
    return sendBundleOffer(chatId, PLUS, lang);
  }
  if (/^\s*(сессия|session|пакет)\s*$/i.test(text)) {
    waitingForCount.delete(chatId);
    return sendBundleOffer(chatId, PACK, lang);
  }

  if (waitingForCount.has(chatId)) {
    const count = parseInt(text.trim(), 10);
    if (isNaN(count) || count < 1 || count > 50) {
      return bot.sendMessage(chatId, bt(lang, 'badCount'));
    }
    waitingForCount.delete(chatId);
    if (count === PACK.credits) return sendBundleOffer(chatId, PACK, lang);
    if (count === PLUS.credits) return sendBundleOffer(chatId, PLUS, lang);
    const total = count * PRICE;
    // көп сұраса — пакет арзанырақ екенін айтамыз (студент артық төлемесін)
    const hint = count > PACK.credits && total > PLUS.amount
      ? bt(lang, 'hintPlus', { count, total, plusCredits: PLUS.credits, plusAmount: PLUS.amount })
      : count > PACK.credits - 2 && count < PACK.credits
        ? bt(lang, 'hintPack', { credits: PACK.credits, amount: PACK.amount })
        : '';
    return bot.sendMessage(chatId, bt(lang, 'countPrice', { count, total, hint, phone: KASPI_PHONE, name: KASPI_NAME }), { parse_mode: 'Markdown' });
  }

  // Чатта презентация жасалмайды: кез келген басқа мәтінге — Mini App батырмасы
  return sendMiniAppHint(chatId, lang);
});

// ─── Telegram Stars (халықаралық төлем; әдепкіде өшік — STARS_ENABLED=1) ─────────────
const Stars = require('./core/stars');
/** Сатып алу хабарының астына «⭐ Stars» батырмасы (тек қосулы болса) */
function starsButton(lang = 'kk') {
  if (!Stars.enabled()) return {};
  return { reply_markup: { inline_keyboard: [[{ text: bt(lang, 'starsBtn'), callback_data: 'st:menu' }]] } };
}
bot.on('callback_query', async (cq) => {
  const data = cq.data || '';
  if (!data.startsWith('st:')) return;
  const chatId = cq.message && cq.message.chat && cq.message.chat.id;
  if (!chatId) return;
  const lang = await UL.langOf(chatId);
  try {
    if (!Stars.enabled()) return bot.answerCallbackQuery(cq.id, { text: bt(lang, 'starsOff'), show_alert: true });
    await bot.answerCallbackQuery(cq.id).catch(() => {});
    if (data === 'st:menu') {
      return bot.sendMessage(chatId, bt(lang, 'starsMenu'), {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: Stars.offers(lang).map((o) => [{ text: `${o.title} — ${o.stars} ⭐`, callback_data: 'st:' + o.id }]) },
      });
    }
    const offer = Stars.offerById(data.slice(3), lang);
    if (!offer) return;
    const inv = Stars.invoiceFor(offer, cq.from.id, lang);
    await bot.sendInvoice(chatId, inv.title, inv.description, inv.payload, '', inv.currency, inv.prices);
  } catch (e) {
    console.warn('[Stars] invoice failed:', e.message);
    bot.sendMessage(chatId, bt(lang, 'starsInvoiceFail')).catch(() => {});
  }
});
// Telegram төлемді бастамас бұрын сұрайды (10 с ішінде жауап керек): шот осы адамдікі әрі сомасы сай ма
bot.on('pre_checkout_query', async (q) => {
  const v = Stars.checkPreCheckout(q, await UL.langOf(q.from && q.from.id).catch(() => 'kk'));
  if (!v.ok) console.warn(`[Stars] pre-checkout refused for ${q.from && q.from.id}: ${q.invoice_payload} ${q.total_amount}`);
  bot.answerPreCheckoutQuery(q.id, v.ok, v.ok ? {} : { error_message: v.error }).catch((e) => console.warn('[Stars] pre-checkout answer failed:', e.message));
});
/** Төлем өтті → кредит (charge id — чек нөмірі: екі рет есептелмейді) */
async function onStarsPaid(msg) {
  const chatId = msg.chat.id;
  const sp = msg.successful_payment;
  const c = Stars.creditFor(sp);
  const lang = await UL.langOf(chatId);
  if (!c) {
    console.warn(`[Stars] unknown payment from ${chatId}: ${sp && sp.invoice_payload}`);
    if (ADMIN_ID) bot.sendMessage(ADMIN_ID, `⚠️ Stars: түсінбеген төлем ${chatId} · ${sp && sp.total_amount}⭐ · ${sp && sp.invoice_payload} · ${sp && sp.telegram_payment_charge_id}`).catch(() => {});
    return bot.sendMessage(chatId, bt(lang, 'starsUnknown')).catch(() => {});
  }
  const applied = await applyReceipt(chatId, c.receiptNo, c.kzt, c.credits);
  if (!applied.applied) return; // бұл төлем бұрын есептелген
  logEvent(chatId, 'paid').catch(() => {});
  logPayment(chatId, c.kzt, c.credits, c.receiptNo).catch((e) => console.warn('[Pay] log failed', e.message));
  console.log(`[Stars] ${chatId} paid ${c.stars}⭐ → +${c.credits} credits (${c.receiptNo})${c.priceChanged ? ' (price changed since invoice)' : ''}`);
  await bot.sendMessage(chatId, bt(lang, 'starsPaid', { credits: c.credits, total: applied.user.credits }),
    { parse_mode: 'Markdown', ...mainKeyboard(lang) }).catch(() => {});
  if (ADMIN_ID) bot.sendMessage(ADMIN_ID, `⭐ Stars: ${chatId} → +${c.credits} кредит (${c.stars}⭐, ≈${c.kzt}₸)`).catch(() => {});
}
bot.on('message', (msg) => { if (msg.successful_payment) onStarsPaid(msg).catch((e) => console.error('[Stars] credit failed:', e.message)); });

/** Пакетті сатып алу нұсқауы: дәл сома маңызды — чек сомасы бойынша пакет танылады */
function sendBundleOffer(chatId, b, lang = 'kk') {
  return bot.sendMessage(chatId, bt(lang, 'bundleOffer', {
    icon: b === PLUS ? '⭐' : '🎒', bname: b.name, credits: b.credits, amount: b.amount,
    each: Math.round(b.amount / b.credits), price: PRICE, phone: KASPI_PHONE, name: KASPI_NAME,
  }), { parse_mode: 'Markdown' });
}

function sendMiniAppHint(chatId, lang = 'kk') {
  const kb = webAppKeyboard(lang);
  return bot.sendMessage(chatId, bt(lang, 'appHint'), kb ? { parse_mode: 'Markdown', reply_markup: kb } : { ...mainKeyboard(lang) });
}

// ─── Іске қосу ───────────────────────────────────────────────────────────
bot.on('polling_error', (err) => {
  console.error('[Bot] polling_error:', err && err.message ? err.message : err);
});
bot.on('error', (err) => {
  console.error('[Bot] error:', err && err.message ? err.message : err);
});

async function startBot(opts = {}) {
  if (opts.webappUrl) WEBAPP_URL = opts.webappUrl;
  global.__deadlineBot = bot;
  await initDB();
  // Telegram allowed_updates баптауын есте сақтайды: бұрын біреу (ескі нұсқа,
  // басқа сервер) тек ['message'] деп қойса, inline батырма басқанда
  // callback_query боттың өзіне келмейді (Telegram-да тек жалтырап тұрады).
  // Сондықтан нақты көрсетіп, бір рет қолмен қайта орнатамыз.
  // pre_checkout_query — Telegram Stars төлемі (онсыз төлем 10 с-тан соң «бот жауап бермеді» деп құлайды)
  const ALLOWED = JSON.stringify(['message', 'callback_query', 'pre_checkout_query']);
  await bot.deleteWebHook().catch(() => {});
  await bot.getUpdates({ timeout: 0, limit: 1, allowed_updates: ALLOWED })
    .catch(err => console.error('[Bot] allowed_updates reset error:', err.message));
  bot.options.polling = { params: { allowed_updates: ALLOWED } };
  bot.startPolling({ restart: true });
  console.log('[Bot] Іске қосылды (allowed_updates: message, callback_query, pre_checkout_query)');
  return bot;
}

// Standalone mode (npm run bot-only)
if (require.main === module) {
  require('./core/crashGuard').install();
  startBot().catch(err => {
    console.error('[Bot] Init error:', err);
    process.exit(1);
  });
}

module.exports = { startBot, bot, escapeMarkdown };

