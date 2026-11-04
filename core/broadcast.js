'use strict';
/**
 * Broadcast (барлық пайдаланушыға хабар) — Telegram шектеуін сақтап жіберу.
 *
 * Бұрынғы қате (2026-11-04): мәтінде жұпсыз «_» болды (t.me/deadline_ai) → Markdown талданбай, әр адамға
 * ЕКІ сұраныс кетті (форматпен → қате → форматсыз), секундына ~50 сұраныс → Telegram 429 «retry after 3»
 * қайтарды, ал код күтпей, ол адамды «сәтсіз» деп өткізіп жіберді — хабар оларға жетпеді, прогресс көрінбеді.
 *
 * Енді: формат бір рет алдын ала тексеріледі (decideFormat), әр адамға бір сұраныс; 429 болса Telegram айтқан
 * уақыт күтіліп, қайта жіберіледі; прогресс onProgress арқылы хабарланады; жетпегендер тізімі қайтарылады.
 */
const PARSE_ERR = /can't parse entities|can't find end of the entity/i;
const BLOCKED_ERR = /\b403\b|blocked|deactivated|chat not found/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const msgOf = (err) => String((err && err.message) || err || '');

function is429(err) {
  return !!err && ((err.response && err.response.statusCode === 429) || /\b429\b|Too Many Requests/i.test(msgOf(err)));
}
/** Telegram «retry after N» → миллисекунд (белгісіз болса null) */
function retryAfterMs(err) {
  const p = err && err.response && err.response.body && err.response.body.parameters;
  let s = p && p.retry_after;
  if (s == null) { const m = /retry after (\d+)/i.exec(msgOf(err)); if (m) s = Number(m[1]); }
  return s == null || !Number.isFinite(Number(s)) ? null : Number(s) * 1000;
}

/**
 * Мәтін Markdown ретінде өте ме — бір рет тексеру (мысалы админге алдын ала көрініс жіберу арқылы).
 * tryMarkdown() — Markdown-пен жібереді; талдау қатесі болса → форматсыз режим.
 * @returns {Promise<'markdown'|'plain'>}
 */
async function decideFormat(tryMarkdown) {
  try { await tryMarkdown(); return 'markdown'; }
  catch (err) { if (PARSE_ERR.test(msgOf(err))) return 'plain'; throw err; }
}

/**
 * @param {object} a
 * @param {Array<string|number>} a.ids
 * @param {(id) => Promise<any>} a.send          бір адамға БІР сұраныс (fallback-сыз)
 * @param {(id) => any} [a.onBlocked]
 * @param {(state) => any} [a.onProgress]       әр progressEveryMs сайын
 * @param {number} [a.gapMs=60]                 хабарлар арасы (~16/сек — Telegram шегі ~30/сек)
 * @param {number} [a.maxRetries=5]             429 кезінде қайталау саны
 */
async function runBroadcast({ ids, send, onBlocked, onProgress, gapMs = 60, maxRetries = 5, progressEveryMs = 10000, wait = sleep, now = Date.now, log = console }) {
  const st = { total: ids.length, done: 0, sent: 0, blocked: 0, failed: [], retries: 0 };
  let lastProgress = now();
  for (const id of ids) {
    for (let attempt = 0; ; attempt++) {
      try { await send(id); st.sent++; break; }
      catch (err) {
        if (is429(err) && attempt < maxRetries) {
          st.retries++;
          await wait((retryAfterMs(err) ?? 1000) + 300);
          continue;
        }
        if (BLOCKED_ERR.test(msgOf(err))) { st.blocked++; if (onBlocked) await Promise.resolve(onBlocked(id)).catch(() => {}); }
        else { st.failed.push(id); log.warn(`[Broadcast] failed for ${id}: ${msgOf(err)}`); }
        break;
      }
    }
    st.done++;
    if (onProgress && now() - lastProgress >= progressEveryMs) {
      lastProgress = now();
      await Promise.resolve(onProgress({ ...st, failed: st.failed.slice() })).catch(() => {});
    }
    if (st.done < st.total) await wait(gapMs);
  }
  return st;
}

/** «/broadcast_to 123, 456 789\nМәтін» → { ids, text } (қате болса null) */
function parseTargeted(input) {
  const m = /^\s*([\d,\s]+?)\s*\n([\s\S]+)$/.exec(String(input || ''));
  if (!m) return null;
  const ids = [...new Set(m[1].split(/[\s,]+/).filter((x) => /^\d+$/.test(x)))];
  const text = m[2].trim();
  return ids.length && text ? { ids, text } : null;
}

const progressText = (s, title = '📤 Broadcast') =>
  `${title}: ${s.done}/${s.total}\n✅ Жеткізілді: ${s.sent}\n⛔ Бұғаттаған: ${s.blocked}\n❌ Жетпеді: ${s.failed.length}` +
  (s.retries ? `\n⏳ Telegram күттірді: ${s.retries} рет` : '');

module.exports = { runBroadcast, decideFormat, parseTargeted, progressText, is429, retryAfterMs, PARSE_ERR };
