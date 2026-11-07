'use strict';
/**
 * БІР РЕТТІК ЕСКЕ САЛУ (иесінің келісімі, 2026-11-06, «сататын амалдар» №3).
 * Mini App-ты ашып, бірақ презентация / реферат / квиз жасамай кеткен адамға 1–6 сағаттан кейін бір хабар:
 *   • аптасына ең көбі бір рет (оқиға 'nudge'), бұғаттағандарға — жоқ;
 *   • түнде (00:30–08:00 Алматы) — жазбаймыз; кешке (21:00-ден) дедлайн туралы нұсқа;
 *   • бір айналымда ең көбі 25 хабар (Telegram шегі мен «спам» сезімінен сақтану).
 * Өшіру: NUDGE_ABANDONED=0.
 */

const HOUR = 3600e3;
/** Алматы уақыты (UTC+5), сағат бөлшегімен: 21.5 = 21:30 */
function almatyHour(t) {
  const d = new Date(t + 5 * HOUR);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}
const quiet = (t) => { const h = almatyHour(t); return h >= 0.5 && h < 8; };
const { bt } = require('./botText');
const { appUrl } = require('./userLang');
const evening = (t) => almatyHour(t) >= 21 || almatyHour(t) < 0.5;

function nudgeText(t, lang = 'kk') {
  return bt(lang, evening(t) ? 'nudgeEvening' : 'nudgeDay');
}

function nudgeKeyboard(webappUrl, lang = 'kk') {
  if (!webappUrl) return undefined;
  return { inline_keyboard: [[{ text: bt(lang, 'nudgeBtnDeck'), web_app: { url: appUrl(webappUrl, '', lang) } }], [{ text: bt(lang, 'nudgeBtnQuiz'), web_app: { url: appUrl(webappUrl, '#quiz', lang) } }]] };
}

/**
 * @param {{ db: { listAbandoned: Function, logEvent: Function, setBlocked?: Function },
 *           send: (chatId: string, text: string, opts: object) => Promise<any>, webappUrl?: string, now?: number, max?: number,
 *           langOf?: (chatId: string) => Promise<string> }} o
 * @returns {Promise<number>} жіберілген хабар саны
 */
async function runNudges(o) {
  const now = o.now || Date.now();
  if (process.env.NUDGE_ABANDONED === '0' || quiet(now)) return 0;
  const ids = await o.db.listAbandoned({ from: now - 6 * HOUR, to: now - HOUR, nudgedSince: now - 7 * 24 * HOUR, limit: o.max || 25 });
  let sent = 0;
  for (const id of ids) {
    // алдымен белгі: екі сервер/айналым қатар жүрсе де екі рет жазылмайды
    await o.db.logEvent(id, 'nudge', null, now).catch(() => {});
    try {
      const lang = o.langOf ? await o.langOf(id).catch(() => 'kk') : 'kk';
      await o.send(id, nudgeText(now, lang), { parse_mode: 'Markdown', reply_markup: nudgeKeyboard(o.webappUrl, lang) });
      sent += 1;
    } catch (e) {
      const code = e && e.response && e.response.statusCode;
      if (code === 403 && o.db.setBlocked) await o.db.setBlocked(id, true).catch(() => {});
    }
  }
  if (sent) console.log(`[Nudge] ${sent} reminder(s) sent`);
  return sent;
}

module.exports = { runNudges, nudgeText, nudgeKeyboard, almatyHour, quiet, evening };
