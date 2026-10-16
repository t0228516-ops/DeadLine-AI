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
const RECOVERABLE = /ETELEGRAM|EFATAL|EPARSE|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|ENOTFOUND|EAI_AGAIN|socket hang up|network|aborted/i;

function describe(e) {
  if (!e) return String(e);
  return [e.code, e.message || String(e)].filter(Boolean).join(' ');
}
function isRecoverable(e) {
  return !!e && (RECOVERABLE.test(String(e.code || '')) || RECOVERABLE.test(String(e.message || '')));
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
function hardenBot(bot, opts = {}) {
  if (!bot || bot.__hardened) return bot;
  bot.__hardened = true;
  const send = bot.sendMessage.bind(bot);
  bot.sendMessage = (chatId, text, o) => send(chatId, text, o).catch((err) => {
    const m = String((err && err.message) || '');
    if (o && o.parse_mode && PARSE_ERR.test(m)) return send(chatId, text, withoutParseMode(o));
    if (BLOCKED_ERR.test(m) && opts.onBlocked) opts.onBlocked(chatId);
    throw err;
  });
  const edit = bot.editMessageText.bind(bot);
  bot.editMessageText = (text, o) => edit(text, o).catch((err) => {
    if (o && o.parse_mode && PARSE_ERR.test(String((err && err.message) || ''))) return edit(text, withoutParseMode(o));
    throw err;
  });
  return bot;
}

module.exports = { install, isRecoverable, describe, hardenBot };
