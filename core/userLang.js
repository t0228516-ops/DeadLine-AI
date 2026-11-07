'use strict';
/**
 * Адамның интерфейс тілі (бот пен сервердің клиентке жазатын хабарлары үшін): 'kk' (әдепкі) не 'ru'.
 * Дереккөз — users.lang: Mini App-та «RU / ҚАЗ» таңдағанда (X-UI-Lang) не ботта /lang басқанда жазылады.
 * Әр хабарда дерекқорға бармас үшін — жадта 10 минут (өзгерген сәтте бірден жаңарады).
 */
const TTL = 10 * 60e3;
const cache = new Map();   // chatId → { lang, at }
const db = () => require('../db');

async function langOf(chatId) {
  if (chatId == null || chatId === '') return 'kk';
  const k = String(chatId);
  const c = cache.get(k);
  if (c && Date.now() - c.at < TTL) return c.lang;
  let lang = 'kk';
  try { lang = (await db().getUserLang(k)) || 'kk'; } catch { /* дерекқор қолжетімсіз — қазақша */ }
  cache.set(k, { lang, at: Date.now() });
  if (cache.size > 20000) cache.delete(cache.keys().next().value);
  return lang;
}

async function setLang(chatId, lang) {
  const l = lang === 'ru' ? 'ru' : 'kk';
  await db().setUserLang(String(chatId), l);
  cache.set(String(chatId), { lang: l, at: Date.now() });
  return l;
}

/** Mini App сілтемесі: орысша адамға ?lang=ru (Mini App сол тілде ашылады) */
function appUrl(base, hash, lang) {
  if (!base) return '';
  return String(base).replace(/\/$/, '') + '/webapp/' + (lang === 'ru' ? '?lang=ru' : '') + (hash || '');
}

module.exports = { langOf, setLang, appUrl, _cache: cache };
