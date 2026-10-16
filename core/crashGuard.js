'use strict';
/**
 * Процесс деңгейіндегі қорғаныс: ұсталмаған қате ботты ҚҰЛАТПАЙДЫ.
 *
 * Node 15+ ұсталмаған Promise қатесінде процесті өлтіреді. Ботта Telegram-ға жіберілетін хабарлардың көбі
 * .catch-сіз: клиент ботты бұғаттаса, Markdown бұзылса, WEBAPP_URL қате болса — бүкіл бот (барлық клиенттің
 * генерациясы қоса) құлайтын (нақты болған: WEBAPP_URL https-сіз → 400 → процесс өлді).
 *   unhandledRejection → тек логқа жазылады, процесс жұмысын жалғастырады;
 *   uncaughtException  → желі/Telegram қатесі болса — логқа; басқа (бағдарлама қатесі) — логқа жазып шығады,
 *                         Railway процесті таза күйден қайта қосады (күйі бұзылған процесс жұмыс істемесін).
 */
const NET_CODES = new Set(['ETELEGRAM', 'EFATAL', 'EPARSE', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT']);
// хабар бойынша тек нақты белгілер (жалпы «network»/«aborted» сөзі бағдарлама қатесінде де кездеседі)
const NET_MSG = /^(ETELEGRAM|EFATAL|EPARSE):|socket hang up|read ECONNRESET|connect ETIMEDOUT/i;

function describe(e) {
  if (!e) return String(e);
  return [e.code, e.message || String(e)].filter(Boolean).join(' ');
}
function isRecoverable(e) {
  return !!e && (NET_CODES.has(String(e.code || '')) || NET_MSG.test(String(e.message || '')));
}

let installed = false;
function install(opts = {}) {
  if (installed) return;
  installed = true;
  const exit = opts.exit || ((c) => process.exit(c));
  process.on('unhandledRejection', (reason) => {
    console.error('[Process] unhandledRejection (жалғасады):', describe(reason));
  });
  process.on('uncaughtException', (err) => {
    if (isRecoverable(err)) { console.error('[Process] uncaughtException, желі/Telegram (жалғасады):', describe(err)); return; }
    console.error('[Process] uncaughtException — қайта қосылады:', err && err.stack ? err.stack : err);
    exit(1);
  });
}

/**
 * Telegram жіберу қабаты: parse_mode:'Markdown' мәтіні талданбаса (клиент тақырыбындағы жұпсыз «_», «*») —
 * хабар жоғалмайды, сол мәтін форматсыз қайта жіберіледі; клиент ботты бұғаттаса — onBlocked(chatId).
 * Басқа қате шақырушыға бұрынғыдай қайтады.
 */
const PARSE_ERR = /can't parse entities|can't find end of the entity/i;
const BLOCKED_ERR = /bot was blocked by the user|user is deactivated|bot can't initiate conversation/i;
const withoutParseMode = (o) => { const c = { ...o }; delete c.parse_mode; return c; };
/** Markdown белгілерін алып тастайды: «\\_» → «_», қалың «*» жоғалады — клиент қиғаш сызық пен жұлдызша көрмейді */
const plainText = (t) => String(t).replace(/\\([_*`\[\]])/g, '$1').replace(/\*/g, '');
function hardenBot(bot, opts = {}) {
  if (!bot || bot.__hardened) return bot;
  bot.__hardened = true;
  const send = bot.sendMessage.bind(bot);
  const blocked = (chatId) => (err) => {
    if (BLOCKED_ERR.test(String((err && err.message) || '')) && opts.onBlocked) opts.onBlocked(chatId);
    throw err;
  };
  bot.sendMessage = (chatId, text, o) => send(chatId, text, o).catch((err) => {
    if (o && o.parse_mode && PARSE_ERR.test(String((err && err.message) || ''))) {
      return send(chatId, plainText(text), withoutParseMode(o)).catch(blocked(chatId));
    }
    return blocked(chatId)(err);
  });
  const edit = bot.editMessageText.bind(bot);
  bot.editMessageText = (text, o) => edit(text, o).catch((err) => {
    if (o && o.parse_mode && PARSE_ERR.test(String((err && err.message) || ''))) return edit(plainText(text), withoutParseMode(o));
    throw err;
  });
  return bot;
}

module.exports = { install, isRecoverable, describe, hardenBot, plainText };
