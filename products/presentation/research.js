'use strict';
/**
 * RESEARCH — мәтін жазылмас БҰРЫН тақырып бойынша дерек жиналады (DeepSeek Search API).
 *
 * Бұрын мазмұнның бәрі модельдің жадынан жазылатын: қазақ гуманитарлық тақырыптарында ол шатасады
 * («Зар заман ақындары» → Мұқағали Мақатаев, Дулаттың туған жері Сырдария деп). Енді:
 *   1) жоспардан бұрын — тақырыптың өзі бойынша 2 іздеу (жалпы + Уикипедия) → «факт парағы»;
 *   2) жоспардан кейін — әр мазмұн слайдына 1 нақты іздеу (тақырып + слайд атауы);
 *   3) мәтін жазатын модель есім, дата, шығарма атауын осы парақтан алады.
 *
 * API: POST https://api.deepseek.com/v1/tools/search — $0.75 / 1000 сәтті сұрау, аккаунтқа 5 QPS.
 * Бір колодаға ≈ 10 сұрау ≈ $0.0075. Кілт жоқ / RESEARCH=0 / қате → null: генерация бұрынғыдай жүре береді.
 */

const ENDPOINT = 'https://api.deepseek.com/v1/tools/search';
const MIN_GAP_MS = 230;          // аккаунт шегі 5 QPS — бір процестегі барлық генерацияға ортақ
const TIMEOUT_MS = 12_000;
const MIN_SCORE = 1.5;           // құжат: rerank_score ≥ 1.5 — жоғары сапа
const MIN_SCORE_AUTH = 1.2;      // беделді сайт (authority ≥ 3) болса — сәл төменірек ұпай да жарайды
const SUMMARY_MAX = 700;
const MAX_SLIDE_QUERIES = Number(process.env.RESEARCH_MAX_SLIDES) || 8;

const enabled = () => process.env.RESEARCH !== '0' && !!process.env.DEEPSEEK_API_KEY;

// ── аккаунт шегі: сұраулар арасы ≥ MIN_GAP_MS (процесс бойынша ортақ кезек) ──
let nextSlot = 0;
function throttle() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_GAP_MS;
  return at > now ? new Promise((r) => setTimeout(r, at - now)) : Promise.resolve();
}

let searchCount = 0; // тест/лог үшін

/** Бір іздеу → results[] (қате/бос → []) */
async function searchWeb(query, opts = {}) {
  const q = clip(query, 128);
  if (!q || !enabled()) return [];
  const doFetch = opts.fetch || fetch;
  for (let attempt = 0; attempt < 2; attempt++) {
    await throttle();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs || TIMEOUT_MS);
    try {
      searchCount++;
      const res = await doFetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ query: q, count: opts.count || 10 }),
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500 || res.status === 408) {
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 1200)); continue; }
        console.warn(`[Research] HTTP ${res.status} for "${q.slice(0, 60)}"`);
        return [];
      }
      if (!res.ok) { console.warn(`[Research] HTTP ${res.status} for "${q.slice(0, 60)}"`); return []; }
      const data = await res.json().catch(() => ({}));
      return Array.isArray(data.results) ? data.results : [];
    } catch (e) {
      if (attempt === 0 && e.name !== 'AbortError') continue;
      console.warn(`[Research] ${e.name === 'AbortError' ? 'timeout' : e.message} for "${q.slice(0, 60)}"`);
      return [];
    } finally { clearTimeout(timer); }
  }
  return [];
}

// ── көмекшілер ──
function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).trim();
}
/** Студент промтындағы «10 слайд», «қазақша», «презентация жаса» сияқты тапсырма сөздерін алып тастайды */
function topicQuery(topic) {
  let t = String(topic || '').split(/\n/).map((l) => l.trim()).find((l) => l.length > 2) || '';
  t = t
    .replace(/(?<![\p{L}\p{N}])\d{1,2}\s*(слайд|slide|бет)\p{L}*/giu, ' ')
    .replace(/(?<![\p{L}])(қазақша|орысша|ағылшынша|на русском|на казахском|in english|in kazakh|in russian)(?![\p{L}])/giu, ' ')
    .replace(/(презентаци|presentation)\p{L}*(\s+(жаса|сделай|make|create)\p{L}*)?/giu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s.,;:—–-]+$/u, '').trim();
  return clip(t, 120);
}
const good = (r) => r && r.url && (r.summary || r.snippet)
  && ((Number(r.rerank_score) >= MIN_SCORE) || (Number(r.rerank_score) >= MIN_SCORE_AUTH && Number(r.authority) >= 3));
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Сапалы, қайталанбайтын нәтижелер (ұпай бойынша) */
function pick(results, max, seen = new Set()) {
  const out = [];
  // беделді дереккөз (энциклопедия, университет, ұлттық кітапхана: authority 3–4) сәл алға шығады
  const rank = (r) => Number(r.rerank_score) + 0.15 * Math.max(0, Number(r.authority) || 0);
  const sorted = [...results].filter(good).sort((a, b) => rank(b) - rank(a));
  for (const r of sorted) {
    const key = String(r.url).replace(/[#?].*$/, '');
    const body = norm(r.summary || r.snippet).slice(0, 120);
    if (seen.has(key) || seen.has(body)) continue;
    seen.add(key); seen.add(body);
    out.push({
      title: clip(r.title, 140),
      url: String(r.url),
      site: r.site_name || hostOf(r.url),
      date: r.date || null,
      summary: clip(r.summary || r.snippet, SUMMARY_MAX),
      authority: Number(r.authority),
    });
    if (out.length >= max) break;
  }
  return out;
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

/** Модельге берілетін мәтін: нөмірленген фактілер + дереккөзі */
function sheetText(items) {
  return items.map((it, i) => `[${i + 1}] ${it.summary} (source: ${it.site || hostOf(it.url)}${it.title ? ' — ' + clip(it.title, 80) : ''})`).join('\n');
}

/**
 * 1-кезең: жоспардан бұрын. Қайтарады { query, items, sheet, sources } не null.
 */
async function gatherTopic(topic, opts = {}) {
  if (!enabled()) return null;
  const q = topicQuery(topic);
  if (q.length < 3) return null;
  const t0 = Date.now(); const before = searchCount;
  const [a, b] = await Promise.all([
    searchWeb(q, opts),
    searchWeb(clip(q, 80) + ' site:wikipedia.org', opts),
  ]);
  const seen = new Set();
  const items = pick([...b, ...a], 7, seen);
  console.log(`[Research] topic "${q.slice(0, 60)}": ${items.length} sources (${searchCount - before} searches, ${Date.now() - t0}ms)`);
  if (!items.length) return null;
  return { query: q, items, sheet: sheetText(items), seen, perSlide: {} };
}

/**
 * 2-кезең: жоспар дайын болған соң — әр мазмұн слайдына нақты іздеу.
 * slideTopics — жоспардағы атаулар; skip(i) — мұқаба/кіріспе/қорытынды сияқты іздеу керек емес слайдтар.
 * research.perSlide[i] = { items, sheet } толтырылады.
 */
async function gatherSlides(research, slideTopics, opts = {}) {
  if (!research || !Array.isArray(slideTopics)) return research;
  const skip = opts.skip || (() => false);
  const base = clip(research.query, 60);
  const jobs = slideTopics
    .map((t, i) => ({ i, t: String(t || '') }))
    .filter((x) => x.t && !skip(x.i))
    .slice(0, MAX_SLIDE_QUERIES);
  const t0 = Date.now(); const before = searchCount;
  await Promise.all(jobs.map(async (x) => {
    const q = clip(`${base} ${x.t.replace(/[—:–-]\s*$/, '')}`, 128);
    const items = pick(await searchWeb(q, opts), 3, research.seen);
    if (items.length) research.perSlide[x.i] = { items, sheet: sheetText(items) };
  }));
  const filled = Object.keys(research.perSlide).length;
  console.log(`[Research] slides: ${filled}/${jobs.length} with sources (${searchCount - before} searches, ${Date.now() - t0}ms)`);
  return research;
}

/** Әдебиеттер слайдына: нақты табылған дереккөздер (ойдан емес) */
function sourceList(research, max = 6) {
  if (!research) return [];
  // әдебиеттер тізіміне тек беделді дереккөздер (газет мақаласы емес); жетпесе — қалғаны
  const all0 = [...research.items, ...Object.values(research.perSlide || {}).flatMap((p) => p.items)];
  const all = [...all0.filter((it) => it.authority >= 3), ...all0.filter((it) => !(it.authority >= 3))];
  const seen = new Set(); const out = [];
  for (const it of all) {
    const k = it.url.replace(/[#?].*$/, '');
    if (seen.has(k)) continue; seen.add(k);
    out.push(`${it.title}${it.site ? ' — ' + it.site : ''}. ${k}`);
    if (out.length >= max) break;
  }
  return out;
}

module.exports = { gatherTopic, gatherSlides, sourceList, searchWeb, topicQuery, pick, sheetText, enabled, _count: () => searchCount };
