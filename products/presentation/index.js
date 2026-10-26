'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { generateSlides, reviewAndImproveSlides, parseUserInput, ensureIntroSlide, languageMismatch, applyCoverCredits, coverCreditItems } = require('./gemini');
const { analyzeTemplate, schemaRuleLine } = require('./templateSchema');
const { writeSlots } = require('./templateWriter');
const { findImage, findImageVision, fallbackQueries, isLatinQuery, isRealSubject } = require('./images');
const { limitTables, limitInfographics, applyDeckTheme } = require('./deckPolish');
const { analyzeReference, referenceItems } = require('../../design-dna');
const REQ = require('../../requirements');
const { applyReferencePlan, layoutMatch } = require('./refPlan');
const { buildTemplateReport } = require('./templateQa');
const { fillTemplatePptx, planTemplateSlots, slotRuleLine } = require('./templateFill');
const { repairTemplateSlides } = require('./templateRepair');
const { planLayout } = require('./templateLayoutPlan');
const { planStoryline } = require('./templateStory');
const { build3DPresentationHTML } = require('./html3DBuilder');
const { pickDeckDecor } = require('./design/decorPick');
const { attachVisuals }            = require('./visual');
const { renderHtmlToPngs }        = require('./renderer');
const { exportToPptx }            = require('./pptxExporter');
const { runQualityLoop, renderWarningsToIssues } = require('./quality');
const { repairDeckComposition, hintsFromOverflowWarnings } = require('./composition');
const { createCostTracker, setActiveCostTracker } = require('../../core/cost');
const { deepseekJson } = require('../../core/llm');
const { maybeAttachReferencesSlide, sanitizeMetaLeakSlides } = require('./sources');
const { runNarrativePass, buildDimensionScores } = require('./narrative');
const { runVisionCritic } = require('./visionCritic');
const { uniqueId } = require('../../core/tmpFiles');
const { generateSpeakerNotes, applySpeakerNotes } = require('./speakerNotes');
const { validateInfographic } = require('./design/infographics');
const { planPhotoSlides } = require('./photoPlan');
const { makePhotoJudge } = require('./photoJudge');
const { makeVisionChooser } = require('./photoVision');
const { gatherTopic } = require('./research');
const { generateSlideImage, deckBudget } = require('./imageGen');
const { buildSpeechDocx } = require('./speechDoc');

// Query-ді жалпылама етіп қысқарту
// мұқаба фотосы бүкіл фонды жабатын пішіндер (қалғандарында фото рамкада/доғада/панельде тұрады)
const FULL_COVERS = new Set(['classic', 'center']);

function simplifyQuery(query) {
  const words = query.split(/[\s,]+/).filter(w => w.length > 3);
  return words.slice(0, 4).join(' ');
}

// Толық brief емес, тек қысқа кілт сөз (толық brief Unsplash-та 414 қатесін береді)
function shortTopicKeyword(topic) {
  if (!topic || typeof topic !== 'string') return '';
  const quoted = topic.match(/[«"“]([^»"”']{4,60})[»"”']/);
  if (quoted) return quoted[1].trim();
  const line = topic.split(/[\n\r]+/).map(s => s.trim()).find(s =>
    s.length >= 4 && s.length <= 80 &&
    !/^\d+-?слайд/i.test(s) && !/Тексерген|Орындаған|Топ:/i.test(s)
  );
  if (line) return line.replace(/^Тақырып\s*[:：]\s*/i, '').slice(0, 60);
  return topic.slice(0, 40);
}

const LAST_FIT = Number(process.env.PHOTO_LAST_RESORT_FIT) || 5;
async function bestSeen(seen, ctx, place) {
  const { canonKey, fitsPlace, downloadCached, imageMeta } = require('./images');
  const { BAD_FLAW } = require('./photoVision');
  const used = ctx.used instanceof Set ? ctx.used : new Set();
  const pool = seen
    .filter((x) => x.s.fit >= LAST_FIT && x.s.appeal >= 5 && !BAD_FLAW.test(x.s.flaw || '') && !used.has(x.c.url) && !used.has(canonKey(x.c.url)))
    .sort((a, b) => (b.s.fit * 0.6 + b.s.appeal * 0.4) - (a.s.fit * 0.6 + a.s.appeal * 0.4));
  for (const x of pool.slice(0, 3)) {
    const key = canonKey(x.c.url);
    used.add(x.c.url); used.add(key);
    const dataUri = await downloadCached(x.c.url);
    if (!dataUri || !fitsPlace(imageMeta(dataUri), place)) continue;
    console.log(`[Image] last resort source=${x.c.source} fit=${x.s.fit} appeal=${x.s.appeal}${x.s.flaw ? ' flaw=' + x.s.flaw : ''}`);
    return { dataUri, focus: x.s.focus || '', source: x.c.source, key, credit: x.c.credit || '', license: x.c.license || '' };
  }
  return null;
}

/**
 * Екінші айналым сұраныстары: бірінші іздеу ештеңе таппағанда DeepSeek-тен шын бар, суретке түскен нысандар сұралады.
 * @returns {Promise<{queries:string[], commons:string[]}>} сәтсіз болса — бос тізімдер (ешқашан лақтырмайды)
 */
async function rescueQueries(slide, ctx, tried, flaws) {
  const empty = { queries: [], commons: [] };
  if (!process.env.DEEPSEEK_API_KEY) return empty;
  const system = 'You find REAL photos for a school presentation slide. The first image search found nothing usable. '
    + 'Suggest search phrases for things that really exist as photos or scans in archives and museums: a named place, building, monument, '
    + 'museum object, period photograph, poster, painting, map, document, or a typical object/scene of that time and region. '
    + 'Never describe a scene that was never photographed (no "protest of peasants in village X"). Keep each phrase 2-5 words, concrete nouns, no adjectives like "beautiful". '
    + 'Return JSON only: {"queries":["3 English phrases"],"commons":["2 phrases as titled on Wikimedia Commons, in Russian or the local language if the subject is from the former USSR/Kazakhstan, else English"]}';
  const user = `Presentation topic: ${String(ctx.topicTitle || ctx.topic || '').slice(0, 200)}\nSlide title: ${String(slide.title || '').slice(0, 160)}\n`
    + (ctx.text ? `Slide says: ${String(ctx.text).slice(0, 400)}\n` : '')
    + `Already searched (found nothing): ${tried.join(' | ').slice(0, 300) || '-'}\n`
    + (flaws.length ? `Photos seen were rejected as: ${flaws.slice(0, 6).join(', ')}\n` : '');
  try {
    const out = await deepseekJson(system, user, 'photo_rescue', 300, { tries: 1, timeoutMs: 15_000, temperature: 0.3 });
    const list = (v, n) => (Array.isArray(v) ? v : []).map((x) => String(x || '').replace(/\s+/g, ' ').trim().slice(0, 80)).filter((x) => x.length >= 3 && !tried.includes(x)).slice(0, n);
    const res = { queries: list(out && out.queries, 3).filter(isLatinQuery), commons: list(out && out.commons, 2) };
    console.log(`[Image] rescue for "${String(slide.title || '').slice(0, 50)}": ${res.commons.concat(res.queries).join(' | ')}`);
    return res;
  } catch (err) {
    console.warn(`[Image] rescue queries failed: ${err.message}`);
    return empty;
  }
}

/**
 * Бір фото-слайдқа сурет — VISION жолы (Google кілті бар болса):
 *   1) слайдтың ӨЗ сұранысы (+ латынша тақырып) бойынша барлық көздерден кандидат → vision көріп таңдайды;
 *   2) ештеңе сай болмаса → AI сурет (атаулы тұлға/оқиға емес болса, лимит ішінде);
 *   3) ол да болмаса → суретсіз (типографиялық слайд). Басқа слайдтың сұранысы ЕШҚАШАН алынбайды.
 * vision шақыруы сәтсіз болса (желі/кілт) → { fallback: true }: ескі мәтіндік тексеру жолы қолданылады.
 */
async function fetchPhotoVision(slide, ctx) {
  const queries = [];
  const add = (q) => { const t = String(q || '').trim(); if (t && isLatinQuery(t) && !queries.includes(t)) queries.push(t); };
  add(ctx.query);
  if (!ctx.query) add(fallbackQueries('', ctx.topic, [])[0]);
  const place = ctx.background ? 'bg' : 'frame';
  const deadline = Date.now() + (Number(process.env.PHOTO_SLIDE_DEADLINE_MS) || 25_000); // бір слайдқа іздеу+таңдау шегі
  // көретін модель қабылдамаған фотолардың себептері («modern», «wrong country») — екінші айналымға беріледі
  const flaws = [];
  const seen = []; // көрілген барлық кандидат + баға: ештеңе өтпесе, ең жақсысы қойылады (слайд бос қалмасын)
  const vision = async (batch) => {
    const r = await ctx.vision(batch);
    if (r !== null && typeof ctx.vision.scoreOf === 'function') {
      for (const c of batch) {
        const sc = ctx.vision.scoreOf(c);
        if (sc && sc.flaw && !flaws.includes(sc.flaw)) flaws.push(sc.flaw);
        if (sc) seen.push({ c, s: sc });
      }
    }
    return r;
  };
  const pack = (hit) => ({ dataUri: hit.dataUri, focus: hit.focus || '', source: hit.source, key: hit.key, credit: hit.credit, license: hit.license });
  for (const q of queries) {
    const hit = await findImageVision(q, { used: ctx.used, avoid: ctx.avoid, free: ctx.free, budget: ctx.budget, vision, maxVariants: 2, place, deadline });
    if (hit && hit.failed) return { fallback: true };
    if (hit && hit.dataUri) return pack(hit);
  }
  // Екінші айналым: DeepSeek шын бар, суретке түскен нысандарды ұсынады (архив фото, музей заты, карта, картина) →
  // алдымен Wikimedia Commons (орысша/жергілікті атаумен де), сосын ағылшынша барлық көздер
  if (process.env.PHOTO_RESCUE !== '0') {
    const alt = await rescueQueries(slide, ctx, queries, flaws);
    const deadline2 = Date.now() + (Number(process.env.PHOTO_RESCUE_DEADLINE_MS) || 25_000);
    const budget2 = { left: Number(process.env.IMAGE_SEARCHES_PER_PHOTO) || 5 };
    const tries = alt.commons.map((q) => ({ q, archive: true }))
      .concat(alt.queries.map((q) => ({ q, archive: true })), alt.queries.slice(0, 1).map((q) => ({ q, archive: false })));
    for (const t of tries) {
      if (Date.now() > deadline2) break;
      const hit = await findImageVision(t.q, { used: ctx.used, avoid: ctx.avoid, free: ctx.free, budget: budget2, vision, maxVariants: 1, place, deadline: deadline2, archive: t.archive });
      if (hit && hit.failed) break;
      if (hit && hit.dataUri) { console.log(`[Image] rescue ok q="${t.q.slice(0, 60)}"${t.archive ? ' (archive)' : ''}`); return pack(hit); }
    }
  }
  // Соңғы сақтандыру: көрілгендердің ішінен тақырыпқа жуық (fit ≥ 5), көрікті (appeal ≥ 5), жарнамасыз/белгісіз ең жақсысы
  const best = await bestSeen(seen, ctx, place);
  if (best) return best;
  // нақты тұлға/оқиға/жыл — AI-мен жасалмайды (жалған тарих); жер/халық атауы («Kazakh steppe») — жасалады
  const named = queries.some((q) => isRealSubject(q));
  const gen = await generateSlideImage({
    topic: ctx.topicTitle, title: slide.title, text: ctx.text, query: queries[0] || '', background: ctx.background, named,
  }, ctx.genBudget).catch((err) => { console.warn(`[ImageGen] failed: ${err.message}`); return null; });
  if (gen) return { dataUri: gen.dataUri, focus: '', source: 'ai', key: '', credit: 'AI', license: '' };
  return { dataUri: null };
}

// Бір слайдқа сурет: сұраныстарды кезекпен сынап, табылған суретті жүктеп, data: URI ретінде қайтарады.
// Ешбір сурет алынбаса — null (builder әдемі fallback фонға түседі). Осы функция ЕШҚАШАН лақтырмайды.
async function fetchImageWithFallback(query, topic, used, deckQueries = [], opts = {}) {
  // бір фотоға ең көбі 5 нақты API іздеу (кэштен алынғандары есептелмейді) — лимитті қорғау
  const budget = { left: Number(process.env.IMAGE_SEARCHES_PER_PHOTO) || 5 };
  const attempts = [];
  for (const q of fallbackQueries(query, topic, deckQueries)) {
    attempts.push(q);
    const simple = simplifyQuery(q);
    if (simple && simple !== q) attempts.push(simple);
  }

  for (const q of attempts) {
    if (!q || !q.trim()) continue;
    try {
      // findImage: табады + жүктейді; жүктелмесе келесі кандидатқа/провайдерге өзі өтеді
      if (budget.left <= 0) break;
      const hit = await findImage(q, { used, free: !!opts.free, budget, judge: opts.judge });
      if (hit && hit.dataUri) return hit.dataUri;
    } catch (err) {
      console.warn(`[Image] "${q}" failed: ${err.message}`);
    }
  }
  return null;
}

/**
 * Кітапхана шаблонының стоктық фотоларын слайдтың өз тақырыбына сай фотомен ауыстыру (library/photos.js).
 * Әр фото орнына слайдтың imageQuery-і бойынша біздің фото жүйесі іздейді (vision таңдау, болмаса мәтіндік тексеру);
 * табылмаса — шаблонның өз фотосы қалады. Ешқашан лақтырмайды.
 */
async function swapLibraryPhotos(buf, slides, ctx) {
  const P = require('./library/photos');
  let slots;
  try { slots = P.photoSlots(buf); } catch (e) { console.warn(`[Library] photo slots: ${e.message}`); return buf; }
  const keep = new Set(ctx.keepMedia || []);
  let tiny = [];
  try { tiny = P.tinyPortraits(buf).filter((s) => !keep.has(s.media.split('/').pop())); } catch {}
  slots = slots.filter((s) => !keep.has(s.media.split('/').pop()));
  const all = slots;
  // мәтін астындағы сурет — дизайнның атмосфералық фоны (қараңғы, бұлыңғыр): оны суретті көрмей (ашық карта, ақ ғимарат) ауыстырсақ,
  // ақ тақырып оқылмай қалады. Canva-да мұқабасы да ауыспайды; SlidesCarnival мұқабасы — ауысады (оның фоны мәтінмен бірге жобаланған)
  slots = slots.filter((s) => !s.underText || (ctx.source !== 'canva' && s.slide === 0));
  // шаблон тақырыптың пәніне арналмаған болса, ауыспай қалған шаблон фотосы (сынып, бөтен адамдар) тақырыпқа жат —
  // олардың байттары (хэш) ctx.neutral-ға жиналады да, Credits қосылғаннан кейін түстік фонға айналады (neutralizeMedia)
  const neutralize = !ctx.subjectFit && ctx.neutral instanceof Set;
  if (!slots.length && !tiny.length && !(neutralize && all.length)) return buf;
  if (ctx.onProgress) await ctx.onProgress('images', 'Тақырыпқа сай суреттер ауыстырылуда...');
  let browser = null;
  try {
    const { readZipAll } = require('./templateFill');
    const files = readZipAll(buf);
    browser = await require('./renderer').launchBrowser(require('puppeteer'));
    const page = await browser.newPage();
    // текстура, карта, әшекей — фото емес, шаблонның өз безендіруі қалады
    const verdict = new Map();
    for (const s of (neutralize ? all : slots).concat(tiny)) {
      if (!verdict.has(s.media)) verdict.set(s.media, P.looksLikePhoto(await P.imageStats(page, files.get(s.media)).catch(() => null)));
    }
    const leftover = (replaced) => {
      if (!neutralize) return;
      for (const s of all) if (verdict.get(s.media) && !replaced.has(`${s.slide}:${s.rid}`)) ctx.neutral.add(P.hashOf(files.get(s.media)));
    };
    // бөтен адамдардың кішкене суреттері (аватарлар) алынады — тақырыпқа жат беттер слайдта қалмасын
    const strangers = tiny.filter((s) => verdict.get(s.media));
    if (strangers.length) {
      buf = P.removePictures(buf, strangers);
      console.log(`[Library] photos: ${strangers.length} small stranger portrait(s) removed`);
      if (!slots.length) { leftover(new Set()); return buf; }
    }
    // слайдтағы барлық фото ауысады (4-ке дейін): ауыспай қалған шаблон фотосы тақырыпқа жат, ал бір макет екі рет келсе — екі слайдта бірдей фото
    const max = Number(process.env.LIBRARY_PHOTO_MAX) || 12;
    const perSlide = new Map();
    slots = slots.filter((s) => verdict.get(s.media)).sort((a, b) => b.area - a.area)
      .filter((s) => { const n = perSlide.get(s.slide) || 0; if (n >= 4) return false; perSlide.set(s.slide, n + 1); return true; }).slice(0, max);
    if (!slots.length) { leftover(new Set()); console.log('[Library] photos: no replaceable photos (decor only)'); return buf; }
    const used = new Set();
    const avoid = ctx.avoid instanceof Set ? ctx.avoid : new Set();
    // broad: слайдқа дәл фото табылмаса — тақырыптың жалпы көрінісі (мыс. «Kazakh steppe»): үлкен фото орны бос түсті тіктөртбұрыш болып қалмасын
    const search = async (slot, broad) => {
      const slide = slides[slot.slide] || {};
      const raw = typeof slide.imageQuery === 'string' ? slide.imageQuery.trim() : '';
      const query = !broad && isLatinQuery(raw) ? raw : fallbackQueries('', ctx.topic, [])[0] || '';
      if (!query) return null;
      const text = broad ? '' : [slide.subtitle, slide.body].concat(Array.isArray(slide.bullets) ? slide.bullets.slice(0, 3) : [])
        .map((x) => (typeof x === 'string' ? x : (x && (x.label || x.text)) || '')).filter(Boolean).join(' · ');
      const slideCtx = { topic: ctx.topic, title: broad ? ctx.topic : slide.title || ctx.topic, query, text, cover: slot.slide === 0, background: slot.area > 0.5 };
      try {
        const vision = makeVisionChooser({ ...slideCtx, maxCalls: 5 });
        if (vision) {
          const got = await fetchPhotoVision(slide, { query, topic: ctx.topic, topicTitle: ctx.topic, text, background: slideCtx.background,
            used, avoid, free: !!ctx.free, vision, genBudget: { left: 0 }, budget: { left: Number(process.env.IMAGE_SEARCHES_PER_PHOTO) || 5 } });
          if (!got.fallback) return got.dataUri ? { ...slot, dataUri: got.dataUri, focus: got.focus || '' } : null;
        }
        const dataUri = await fetchImageWithFallback(query, ctx.topic, used, [], { free: !!ctx.free, judge: makePhotoJudge(slideCtx) });
        return dataUri ? { ...slot, dataUri, focus: '' } : null;
      } catch (e) { console.warn(`[Library] photo slide ${slot.slide + 1}: ${e.message}`); return null; }
    };
    const found = await mapLimit(slots, 3, (slot) => search(slot, false));
    const big = slots.map((sl, i) => (!found[i] && sl.area >= 0.08 ? i : -1)).filter((i) => i >= 0);
    if (big.length) {
      const again = await mapLimit(big, 3, (i) => search(slots[i], true));
      big.forEach((i, k) => { if (again[k]) found[i] = again[k]; });
      console.log(`[Library] photos: broad search filled ${again.filter(Boolean).length}/${big.length} large slot(s)`);
    }
    // тақырыпқа жат шаблонда әлі бос қалған үлкен тіктөртбұрыш фото — осы презентацияда табылған фотоның бірі (басқа кесумен):
    // түсті бос тіктөртбұрыш «сурет түспей қалғандай» көрінеді, ал қайталанған тақырыптық фото — жоқ
    const gotList = found.filter(Boolean);
    if (neutralize && gotList.length) {
      let k = 0;
      slots.forEach((sl, i) => {
        if (found[i] || sl.area < 0.08 || sl.alpha || sl.round) return;
        const src = gotList[k++ % gotList.length];
        found[i] = { ...sl, dataUri: src.dataUri, focus: '' };
      });
    }
    const hits = found.filter(Boolean);
    if (!hits.length) { leftover(new Set()); console.log(`[Library] photos: 0/${slots.length} found — template photos ${neutralize ? 'toned out' : 'kept'}`); return buf; }
    const list = [];
    for (const h of hits) {
      const bytes = await P.composite(page, files.get(h.media), h.media, h.dataUri, h.focus).catch((e) => { console.warn(`[Library] composite: ${e.message}`); return null; });
      if (bytes) list.push({ slide: h.slide, rid: h.rid, bytes });
    }
    const out = P.replacePhotos(buf, list);
    leftover(new Set(list.map((h) => `${h.slide}:${h.rid}`)));
    console.log(`[Library] photos: ${out.replaced}/${slots.length} replaced with on-topic photos`);
    return out.buf;
  } catch (e) {
    console.warn(`[Library] photo swap failed (template photos kept): ${e.message}`);
    return buf;
  } finally { if (browser) await browser.close().catch(() => {}); }
}

// Бір уақытта ең көбі N тапсырма (Unsplash-ты және желіні шамадан тыс жүктемеу үшін)
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

/**
 * Pipeline:
 *   тақырып → мазмұн (LLM) → QC → суреттер → HTML (DeadLine Motion, шындық көзі)
 *                                                │
 *                                                ├─► HTML файл  (пайдаланушыға)
 *                                                └─► Puppeteer → PNG → PPTX
 *
 * PPTX — HTML-дің өзінен рендерленеді, сондықтан екеуі бірдей.
 */
/**
 * @param {string} userInput
 * @param {{ onProgress?: (phase: string, detail?: string) => void|Promise<void> }} [options]
 */
async function generatePresentation(userInput, options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : async () => {};
  const genId = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  let design = { mood: null, system: null }; // дизайн жүйесі + палитра (студенттің жадына қайтарылады)
  const photoKeys = []; // осы колодаға алынған суреттер (canonKey) → студенттің жадына (келесіде қайталанбайды)
  const t0 = Date.now();
  const cost = createCostTracker(genId);
  setActiveCostTracker(cost);
  const parsed = parseUserInput(userInput);
  let { topic, slideCount, style, coverMeta } = parsed;
  const mode = options.mode || 'presentation';
  // Нақты тіл (веб-форма таңдауы) мәтіннен табылғаннан басым
  const LANG_BY_CODE = { kk: 'Kazakh', ru: 'Russian', en: 'English', kazakh: 'Kazakh', russian: 'Russian', english: 'English' };
  // Template режимі: аударудың керегі жоқ — тіл тек тақырып мәтінінде нақты жазылса ғана беріледі,
  // әйтпесе модель тақырыппен/материалмен бірдей тілде жазады.
  // Кітапхана шаблоны (options.library) — тілді студент таңдайды, шаблон тек дизайн береді
  const language = mode === 'template' && !options.library
    ? (parsed.language || null)
    : (LANG_BY_CODE[String(options.language || '').toLowerCase()] || parsed.language);

  // Берілген материалдар (файлдардан алынған толық мәтін) — мазмұн генерациясына контекст ретінде қосылады.
  const materialText = options.materialText && String(options.materialText).trim()
    ? String(options.materialText).trim()
    : '';
  if (materialText) console.log(`[Pipeline] id=${genId} Material text: ${materialText.length} chars`);

  console.log(`[Pipeline] id=${genId} Topic: ${topic.slice(0, 120)}`);
  if (slideCount) console.log(`[Pipeline] id=${genId} Slides: ${slideCount}`);
  if (language)   console.log(`[Pipeline] id=${genId} Language: ${language}`);
  if (style)      console.log(`[Pipeline] id=${genId} Style: ${style}`);
  if (coverMeta && (coverMeta.checkedBy || coverMeta.performedBy || coverMeta.group)) {
    console.log(`[Pipeline] id=${genId} Cover meta:`, coverMeta);
  }
  // Титул деректері (университет, факультет, кафедра, орындаған, тексерген, топ) ТОЛЫҚ шығуы керек:
  // review/quality/narrative/composition кезеңдері 1-слайдтың буллеттерін қысқартуы мүмкін → рендер/толтыру алдында қайта қоямыз.
  const restoreCover = (arr) => {
    if (coverMeta && Array.isArray(arr) && arr[0] && applyCoverCredits(arr[0], coverMeta, language)) return true;
    return false;
  };

  // 0a. Промттағы талаптар (мұғалім/клиент жазған мәтін) → RequirementSet. Қате болса талапсыз жалғасады.
  let reqSet = null; let reqNote = null; let reqBrief = '';
  if (options.requirements && String(options.requirements).trim()) {
    try {
      const pr = await REQ.parseRequirements(options.requirements, { llm: options.requirementsLlm, maxChars: options.requirementsMaxChars || 12000 });
      if (pr.set.items.length) {
        reqSet = pr.set;
        const eff = REQ.effectiveSlideCount(reqSet, slideCount);
        if (eff.count && eff.count !== slideCount) { slideCount = eff.count; reqNote = eff.note; }
        reqBrief = REQ.briefFromRequirements(reqSet);
        console.log(`[Pipeline] id=${genId} Requirements: ${reqSet.items.length} item(s) (llm=${pr.llm})${reqNote ? ' · ' + reqNote : ''}`);
      }
    } catch (e) { console.warn(`[Pipeline] id=${genId} Requirements ignored: ${e.message}`); }
  }

  // Тегін колода: слайд саны қатаң шектеледі (тақырып мәтіні немесе талап көбірек сұраса да)
  const maxSlides = Number(options.maxSlides) || null;
  if (maxSlides && (!slideCount || slideCount > maxSlides)) {
    console.log(`[Pipeline] id=${genId} Slides capped: ${slideCount || 'auto'} → ${maxSlides} (free deck)`);
    slideCount = maxSlides;
  }

  // 0. Референс PPTX → Design DNA + құрылым (тек PPTX; ақысыз, XML талдау). Референс промттан басым.
  let refTheme = null; let refDna = null; let refAnalysis = null;
  const referencePptxBuf = options.referencePptx && options.referencePptx.length
    ? (Buffer.isBuffer(options.referencePptx) ? options.referencePptx : Buffer.from(options.referencePptx, 'base64'))
    : null;
  if (referencePptxBuf) {
    try {
      refAnalysis = analyzeReference(referencePptxBuf);
      refDna = refAnalysis.dna; refTheme = refAnalysis.theme;
      console.log(`[Pipeline] id=${genId} Reference: ${refAnalysis.summaryLines.join(' | ')}`);
      if (refAnalysis.warnings.includes('too_large')) { refAnalysis = null; refDna = null; refTheme = null; throw new Error('reference too large'); }
      if (!refAnalysis.warnings.includes('image_only')) {
        const n0 = refAnalysis.outline.slideCount;
        if (slideCount !== n0) reqNote = `Слайд саны референс бойынша ${n0}${slideCount ? ` (формада/промтта ${slideCount} еді)` : ''}`;
        slideCount = n0;
        // промттағы слайд саны талабы референспен қайшы болса, референс жеңеді
        if (reqSet) reqSet.items = reqSet.items.filter((i) => !(i.kind === 'hard' && i.check === 'slide_count'));
        let refIt = referenceItems(refAnalysis.outline).map((it, i) => ({ id: 'ref' + (i + 1), ...it }));
        if (mode === 'template') {
          // Шаблон тек ФОРМА береді: мазмұнға байланған талаптар (мақсат/міндет/кіріспе/өзектілік) қойылмайды,
          // шаблонның бөлім атаулары мен қаңқасы LLM-ге берілмейді (құрылымды templateStory тақырыптан құрады).
          refIt = refIt.filter((it) => it.check === 'slide_count' || ['agenda', 'conclusion', 'references', 'thanks'].includes(it.value));
        } else {
          reqBrief += refAnalysis.brief;
        }
        reqSet = { v: 1, items: (reqSet ? reqSet.items : []).concat(refIt) };
      } else {
        refAnalysis.outline = null; // сенімсіз құрылымды қолданбаймыз, тек түсті
      }
    } catch (e) { console.warn(`[Pipeline] id=${genId} Reference ignored: ${e.message}`); refAnalysis = null; refDna = refDna && refTheme ? refDna : null; }
  }
  // Template-fill: шаблонның әр қорабының сыйымдылығын LLM-ге береміз (мәтін бірден дұрыс ұзындықта жазылсын, «…» арқылы кесілмесін)
  let slotRules = null;
  let slotPlan = null;
  if (mode === 'template' && referencePptxBuf && refAnalysis && refAnalysis.outline) {
    try {
      const plan = planTemplateSlots(referencePptxBuf);
      slotPlan = plan;
      slotRules = plan.map((p, k) => slotRuleLine(p, k + 1));
      console.log(`[Pipeline] id=${genId} Template slots planned: ${plan.length} слайд`);
    } catch (e) { console.warn(`[Pipeline] id=${genId} Slot plan failed (continuing): ${e.message}`); slotRules = null; }
  }
  // Template → Content v2: қораптардың РӨЛДІК схемасы (мәзір, тақырып, сәндік сөз, карточка, сан, авторлар…).
  // Схема болса: мазмұн генераторына жұмсақ «фактілер формасы», ал қораптарға мәтінді templateWriter id бойынша жазады.
  let tplSchema = null;
  if (slotPlan) {
    try {
      tplSchema = analyzeTemplate(referencePptxBuf);
      if (tplSchema.slides.length !== slotPlan.length) throw new Error(`slide count ${tplSchema.slides.length} ≠ ${slotPlan.length}`);
      slotRules = tplSchema.slides.map(schemaRuleLine);
      slotPlan = slotPlan.map((p, k) => ({ ...p, profile: tplSchema.slides[k].profile }));
      const nSlots = tplSchema.slides.reduce((n, x) => n + x.slots.length, 0);
      console.log(`[Pipeline] id=${genId} Template schema: ${nSlots} слот, chrome=${tplSchema.deck.chrome.length}, tags=${tplSchema.deck.tags.length}, logo=${tplSchema.slides.filter((x) => x.logo).length}`);
    } catch (e) { console.warn(`[Pipeline] id=${genId} Template schema failed (old slot path): ${e.message}`); tplSchema = null; }
  }
  const briefBase = materialText
    ? `${userInput}\n\n[SOURCE MATERIALS PROVIDED BY THE USER — study fully, use its structure, facts, sections and requirements]\n${materialText}`
    : userInput;
  const briefForLlm = (refDna && mode !== 'template'
    ? `${briefBase}\n\nReference style (client's own PPTX): ${refDna.summary}. Keep each slide to at most ~${refTheme.maxWordsPerSlide} words.`
    : briefBase) + reqBrief;

  // Template → Content: кәсіби әңгіме желісі ТАҚЫРЫПТАН құрылады (шаблонның мәтіні/бөлім атаулары қолданылмайды)
  let storyOutline = null;
  // Кітапхана шаблоны мазмұнға қарай жиналған болса — сол жоспар әңгіме желісі болады (қосымша LLM шақыруы жоқ)
  const libOutline = options.library && options.library.outline;
  if (slotPlan && libOutline && libOutline.slideTopics.length === slotPlan.length) {
    storyOutline = libOutline;
    console.log(`[Pipeline] id=${genId} Library storyline (content-first): «${storyOutline.title}» — ${storyOutline.slideTopics.length} слайд`);
  } else if (slotPlan) {
    await onProgress('content', 'Презентация құрылымы жоспарлануда...');
    storyOutline = await planStoryline({
      topic, brief: briefBase.slice(0, 12000), language, plan: slotPlan, outline: refAnalysis && refAnalysis.outline,
    });
    if (storyOutline) console.log(`[Pipeline] id=${genId} Template storyline: «${storyOutline.title}» — ${storyOutline.slideTopics.length} слайд`);
  }

  // 0. Мәтін жазылмас БҰРЫН тақырып бойынша дерек жиналады (есім, дата, шығарма модельдің жадынан емес — дереккөзден)
  let research = null;
  try {
    await onProgress('content', 'Тақырып бойынша ақпарат жиналуда...');
    research = await gatherTopic(topic);
  } catch (e) { console.warn(`[Pipeline] id=${genId} research failed: ${e.message}`); research = null; }

  // 1. Мазмұн генерациясы
  await onProgress('content', 'Мазмұн жазылуда...');
  console.log('[Pipeline] Generating content...');
  let presentation = await generateSlides(topic, {
    slideCount, language, style, clientBrief: briefForLlm, coverMeta, slotRules, outline: storyOutline, slotMode: tplSchema ? 'facts' : undefined, research,
  });
  // Модель кейде тақырып тілінде жазып кетеді (орысша таңдалса да қазақша шығады) → 1 рет қайта жазамыз
  const langIssue = mode === 'template' ? null : languageMismatch(presentation && presentation.slides, language);
  if (langIssue) {
    console.warn(`[Pipeline] Language mismatch (${langIssue}) — regenerating once`);
    try {
      const retry = await generateSlides(topic, {
        slideCount, language, style, coverMeta, slotRules, slotMode: tplSchema ? 'facts' : undefined, research,
        clientBrief: userInput + reqBrief + `\n\n[IMPORTANT: write the ENTIRE presentation in ${language}. The topic above may be in another language — translate it.]`,
      });
      if (retry && Array.isArray(retry.slides) && retry.slides.length >= 2 && !languageMismatch(retry.slides, language)) presentation = retry;
      else console.warn('[Pipeline] Regeneration did not fix the language — keeping first result');
    } catch (e) { console.warn('[Pipeline] Language regeneration failed:', e.message); }
  }
  if (!presentation || !Array.isArray(presentation.slides) || presentation.slides.length < 2) {
    throw new Error('Content generation returned too few slides');
  }
  console.log(`[Pipeline] ${presentation.slides.length} slides generated`);
  if (mode !== 'template' && ensureIntroSlide(presentation.slides, language)) console.log('[Pipeline] Intro slide enforced (slide 2)');

  // 2. Визуалды QC
  await onProgress('review', 'Визуалды тексеру...');
  console.log('[Pipeline] Running visual QC...');
  const reviewed = await reviewAndImproveSlides(presentation);
  const title = reviewed.title;
  let slides = Array.isArray(reviewed.slides) ? reviewed.slides : [];
  if (slides.length < 2) {
    throw new Error('Review stage returned too few slides');
  }
  // Drop slides that are effectively empty (no title and no body/bullets/stats/table)
  const beforeCount = slides.length;
  slides = slides.filter((s) => {
    if (!s || typeof s !== 'object') return false;
    const hasTitle = !!(s.title && String(s.title).trim());
    const hasBody = !!(s.body && String(s.body).trim());
    const hasBullets = Array.isArray(s.bullets) && s.bullets.some((b) => b && String(b).trim());
    const hasStats = Array.isArray(s.stats) && s.stats.length > 0;
    const hasTable = !!(s.table && (s.table.headers || s.table.rows));
    return hasTitle || hasBody || hasBullets || hasStats || hasTable;
  });
  if (slides.length < 2) {
    throw new Error('Almost all slides are empty after generation/QC');
  }
  if (slides.length < beforeCount) {
    console.warn(`[Pipeline] Dropped ${beforeCount - slides.length} empty slide(s)`);
  }
  slides.forEach((slide, i) => { slide.index = i + 1; });

  // 2a2. Deterministic meta-leak sanitization (no LLM) — fixes slides where the model's
  // own design/outline instructions bled into visible slide text (e.g. a poisoned
  // "references" slide). quality.js's LLM critic can also flag this pattern, but only
  // probabilistically when it happens to run; this makes the fix unconditional and free.
  try {
    const leak = sanitizeMetaLeakSlides(slides, userInput);
    if (leak.fixed > 0) {
      console.log(`[Pipeline] Sanitized meta-leak content on ${leak.fixed} slide(s)`);
      slides = leak.slides;
      slides.forEach((slide, i) => { slide.index = i + 1; });
    }
  } catch (err) {
    console.warn(`[Pipeline] Meta-leak sanitization error (continuing): ${err.message}`);
  }

  // 2b. Structured quality loop: deterministic QA → LLM critic → targeted repair
  //     (bounded; keeps best version; skips LLM when score already high)
  await onProgress('quality', 'Сапаны тексеру...');
  console.log('[Pipeline] Running quality loop...');
  let qualityMeta = { qualityScore: null, iterations: 0, repairedSlides: [] };
  try {
    const q = await runQualityLoop({
      slides,
      title,
      topic,
      language,
      style,
    });
    slides = q.slides;
    slides.forEach((slide, i) => { slide.index = i + 1; });
    qualityMeta = {
      qualityScore: q.qualityScore,
      iterations: q.iterations,
      repairedSlides: q.repairedSlides,
      critiqueIssues: (q.critique && q.critique.issues) ? q.critique.issues.length : 0,
    };
    console.log(`[Pipeline] Quality score=${qualityMeta.qualityScore} repairs=${qualityMeta.iterations} fixedSlides=[${(qualityMeta.repairedSlides || []).join(',')}]`);
  } catch (err) {
    // Quality must never kill a working generation — log and continue with current slides
    console.warn(`[Pipeline] Quality loop error (continuing): ${err.message}`);
  }

  // 2b2. Deck-level narrative critic (whole presentation, not only slides)
  let narrativeMeta = { narrativeScore: null, applied: [] };
  try {
    await onProgress('narrative', 'Құрылым мен логика...');
    const nar = await runNarrativePass({
      slides,
      title,
      topic,
      language,
    });
    slides = nar.slides;
    slides.forEach((slide, i) => { slide.index = i + 1; });
    narrativeMeta = { narrativeScore: nar.narrativeScore, applied: nar.applied, issues: (nar.narrative && nar.narrative.issues) ? nar.narrative.issues.length : 0 };
    console.log(`[Pipeline] Narrative score=${narrativeMeta.narrativeScore} fixes=${(narrativeMeta.applied || []).length} issues=${narrativeMeta.issues}`);
  } catch (err) {
    console.warn(`[Pipeline] Narrative pass error (continuing): ${err.message}`);
  }

  // 2b'. Table cap: the model tends to turn most slides into tables → keep a few, rest become bullets
  {
    const converted = limitTables(slides);
    if (converted) console.log(`[Pipeline] Tables → bullets on ${converted} slide(s) (variety)`);
  }

  // 2c. Deterministic composition pass (geometry/layout — no LLM).
  //     Template режимінде ӨТКІЗІЛЕДІ: ол HTML-макет үшін буллеттерді 2–4-ке, мәтінді 30 сөзге дейін қияды,
  //     ал шаблонда қорап саны мен ұзындығы тұрақты (slotRules) — мәтін жоғалып, қораптар бос қалатын.
  if (mode !== 'template') {
    const comp = repairDeckComposition(slides);
    if (comp.repairs.length) {
      console.log(`[Pipeline] Composition pre-repair: ${comp.repairs.length} slide(s)`);
      slides = comp.slides;
      slides.forEach((slide, i) => { slide.index = i + 1; });
    }
  }

  // 2d. Optional references slide from real brief sources only (template: слайд саны шаблонмен тең болуы керек — қоспаймыз)
  if (mode !== 'template') {
    const ref = maybeAttachReferencesSlide(slides, userInput, { style, language });
    if (ref.attached) {
      console.log(`[Pipeline] Attached references slide (${ref.sources.length} sources from brief)`);
      slides = ref.slides;
      slides.forEach((slide, i) => { slide.index = i + 1; });
    }
  }

  // 2e. Colour theme + decoration are chosen by CODE (the LLM always copied the same dark/gold example)
  // Дизайн жүйесі + палитра: студенттің соңғы дизайндары қайталанбайды (options.designAvoid — server.js береді)
  design = applyDeckTheme(slides, { seed: `${topic}|${genId}`, style, brief: userInput, field: presentation && presentation.field, refTheme, avoid: options.designAvoid, keep: options.designForce || undefined });
  if (typeof options.onDesign === 'function' && !refTheme) { try { options.onDesign(design); } catch {} }
  console.log(`[Pipeline] Design: system=${design.system} mood=${design.mood}${options.designAvoid ? ` (avoid ${[].concat(options.designAvoid.systems || []).join('/')})` : ''}`);

  // 2f. Референс құрылымын слайдтарға қолдану (макет түрі + мазмұнды сәйкестендіру).
  //     Template режимінде ӨТКІЗІЛЕДІ: бұл HTML-рендерге арналған (буллеттерді кестеге/санға айналдырады),
  //     шаблонды толтыру тек мәтінді қорап ретімен қолданады — кестеге кеткен мәтін қораптарды бос қалдыратын.
  if (refAnalysis && refAnalysis.outline && mode !== 'template') {
    const rp = applyReferencePlan(slides, refAnalysis.outline);
    console.log(`[Pipeline] Reference plan applied to ${rp.assigned} slide(s)${rp.adapted.length ? '; adapted: ' + rp.adapted.map((x) => `${x.n}:${x.what}`).join(', ') : ''}`);
  }

  // 2g. Талаптар бойынша автоматты QA: тексер → түзет → қайта тексер (Mode 2).
  //     Template режимінде референс талаптары құрылым арқылы орындалады — бұл цикл
  //     мұғалім/клиент талаптары үшін ғана жұмыс істейді (соңында бөлек есеп беріледі).
  let reqQaResult = null;
  if (reqSet && reqSet.items.length && mode !== 'template') {
    await onProgress('qa', 'Талаптар бойынша тексеру...');
    try {
      reqQaResult = await REQ.runRequirementsQa(reqSet, slides, {
        language,
        title,
        topic,
        checkers: {},
        overrides: reqNote ? [reqNote] : [],
      });
      slides = reqQaResult.slides;
      slides.forEach((slide, i) => { slide.index = i + 1; });
      const hardTotal = reqQaResult.report.summary.hardTotal;
      const hardPassed = reqQaResult.report.summary.hardPassed;
      console.log(`[Pipeline] Requirements QA: ${hardPassed}/${hardTotal} ✓ (rounds=${reqQaResult.rounds}, repairs=${reqQaResult.repaired.length})`);
      if (reqQaResult.repaired.length) {
        // Слайдтар өзгерген соң тема мен композицияны қайта қолданамыз (жаңа слайдтар да безендірілсін)
        try {
          applyDeckTheme(slides, { seed: `${topic}|${genId}`, style, brief: userInput, refTheme, keep: design });
          if (refAnalysis && refAnalysis.outline && mode !== 'template') applyReferencePlan(slides, refAnalysis.outline);
        } catch (e) { console.warn('[Pipeline] re-theme after QA failed:', e.message); }
      }
    } catch (err) {
      console.warn(`[Pipeline] Requirements QA loop error (continuing): ${err.message}`);
    }
  }

  // 2h. Шығыс айнымалылары + TEMPLATE-FILL (Mode 3): шаблон дизайнын мүлдем өзгертпей,
  //     тек ішіндегі мәтінді жаңа тақырып мәтінімен ауыстырамыз (HTML/рендер жасалмайды).
  let htmlPath = null;
  let pptxPath = null;
  let speechPath = null;   // «Баяндама мәтіні» .docx
  let notesMeta = { ok: 0, study: false };
  let pngPaths = [];
  let bgPaths = [];     // мәтінсіз фондар (өңделетін PPTX)
  let textLayers = [];  // әр слайдтың нативті мәтін блоктары
  let tmpDir = null;
  let overflowWarnings = [];
  let visionMeta = { overallScore: null, source: 'skipped', applied: [] };
  let visualStats = { ok: 0, requested: 0 };

  cost.setSlides(slides.length);
  cost.setQuality(qualityMeta.iterations || 0, (qualityMeta.repairedSlides || []).length);

  const isTemplateFill = mode === 'template' && referencePptxBuf && refAnalysis && refAnalysis.outline;
  let fitInfo = null; let layoutPlanned = null;
  let slotFill = null;
  let templateHealth = null;
  let templateGeomScore = null;
  if (isTemplateFill && tplSchema) {
    // v2: әр қорапқа өз рөліне сай мәтін (LLM) → тексеру → тек қате слоттарды қайта жазу → детерминді қорғаныс
    try {
      await onProgress('template', 'Шаблон қораптарына мәтін жазылуда...');
      const wr = await writeSlots({ schema: tplSchema, slides, topic, language, deckTitle: title || topic, coverMeta, creditLines: coverCreditItems });
      slotFill = wr.plan;
      fitInfo = { writer: { retried: wr.report.retried, fallback: wr.report.fallback, llmFailed: wr.report.llmFailed, problems: wr.report.problems.length } };
      layoutPlanned = 0;
      console.log(`[Pipeline] Template writer: retried=${wr.report.retried} fallback=${wr.report.fallback} llmFailed=${wr.report.llmFailed}${wr.report.problems.length ? ' problems=' + wr.report.problems.slice(0, 8).join(' ') : ''}`);
    } catch (err) {
      console.warn(`[Pipeline] Template writer failed (old path): ${err.message}`);
      slotFill = null;
    }
  }
  let layout = null;
  if (isTemplateFill && !slotFill) {
    // Толтырудан бұрын: мәтін шаблон қораптарының лимитіне сәйкес пе? Сәйкес емес слайдтарды LLM ақау бойынша қайта жазады (≤3 айналым)
    try {
      await onProgress('template', 'Шаблон макетін тексеру...');
      const rep = await repairTemplateSlides({ templateBuf: referencePptxBuf, slides, topic, language });
      slides = rep.slides;
      slides.forEach((slide, i) => { slide.index = i + 1; });
      fitInfo = { before: rep.before, after: rep.after, rounds: rep.rounds, remaining: [...new Set((rep.remaining || []).flatMap((a) => a.issues.map((i) => i.code)))] };
      console.log(`[Pipeline] Template layout check: issues ${rep.before} → ${rep.after}, rounds=${rep.rounds}, fixedSlides=[${rep.fixedSlides.join(',')}]${rep.remaining.length ? ' remaining=' + rep.remaining.map((a) => a.index + ':' + a.issues.map((i) => i.code).join('/')).join(' ') : ''}`);
    } catch (err) {
      console.warn(`[Pipeline] Template layout check failed (continuing): ${err.message}`);
    }
    restoreCover(slides);
    // LLM орналасу жоспары: қай мәтін қай қорапқа, кегль, кедергіні жылжыту. Қате болса — детерминді толтыру (layout = null).
    try {
      await onProgress('template', 'Мәтін орналасуын жоспарлау...');
      layout = await planLayout({ templateBuf: referencePptxBuf, slides, topic, language });
      layoutPlanned = layout.filter(Boolean).length;
      console.log(`[Pipeline] Template layout plan: ${layout.filter(Boolean).length}/${layout.length} slides planned by LLM`);
    } catch (err) {
      console.warn(`[Pipeline] Template layout plan failed (continuing): ${err.message}`);
    }
  }
  if (isTemplateFill) {
    await onProgress('template', 'Шаблонға мәтін салынуда...');
    // Баяндама мәтіні шаблон режимінде де: шаблон қорабына аз мәтін сыяды — студент оқитын толық мәтін .docx-те
    const tplNotesTask = generateSpeakerNotes({ slides: slides.map((sl) => ({ ...sl })), title, topic, language, coverMeta })
      .catch((e) => { console.warn(`[Notes] failed (continuing): ${e.message}`); return null; });
    try {
      pptxPath = path.join(os.tmpdir(), `template-${uniqueId()}.pptx`);
      const qaReport = [];
      fs.writeFileSync(pptxPath, fillTemplatePptx(referencePptxBuf, slides, { language, layout, slotFill, qaReport }));
      // Кітапхана шаблоны: стоктық фотолар → тақырыпқа сай фото; түпнұсқа Credits слайды (авторға сілтеме) соңына өзгеріссіз қосылады
      if (options.library && options.library.creditsBuf) {
        // бөлім слайдының реттік саны — презентациядағы нақты бөлім реті
        try { fs.writeFileSync(pptxPath, require('./library/readable').numberSections(fs.readFileSync(pptxPath), options.library.roles)); } catch (e) { console.warn(`[Library] section numbers: ${e.message}`); }
        // шаблонның өз бет нөмірлері — біздің слайд ретімен (02, 05, 03 … емес)
        try { fs.writeFileSync(pptxPath, require('./library/adapt').renumberFolios(fs.readFileSync(pptxPath))); } catch (e) { console.warn(`[Library] folios: ${e.message}`); }
        const neutral = new Set();
        const withPhotos = options.library.swapPhotos === false ? fs.readFileSync(pptxPath) : await swapLibraryPhotos(fs.readFileSync(pptxPath), slides, {
          topic: title || topic, source: options.library.source, free: !!options.free, avoid: new Set(Array.isArray(options.photoAvoid) ? options.photoAvoid : []), onProgress, keepMedia: options.library.keepMedia,
          subjectFit: !!options.library.subjectFit, neutral,
        });
        let finalBuf = require('./library').appendCredits(withPhotos, options.library);
        // тақырыпқа жат шаблон фотосы (Credits слайдындағысы да) — сол жерінде, пішінімен түстік фонға айналады
        if (!options.library.subjectFit && options.library.swapPhotos !== false) {
          finalBuf = await require('./library/photos').neutralizeMedia(finalBuf, neutral, { lastSlide: true })
            .catch((e) => { console.warn(`[Library] neutralize: ${e.message}`); return finalBuf; });
        }
        // Telegram 50 МБ шегіне жақын ауыр шаблон: суреттер кішірейеді (LIBRARY_SHRINK_MB, әдепкі 20 МБ-тан бастап)
        if (finalBuf.length > (Number(process.env.LIBRARY_SHRINK_MB) || 20) * 1048576) {
          let browser = null;
          try {
            browser = await require('./renderer').launchBrowser(require('puppeteer'));
            const before = finalBuf.length;
            finalBuf = await require('./library/photos').shrinkImages(finalBuf, await browser.newPage());
            console.log(`[Library] images shrunk ${(before / 1e6).toFixed(1)} → ${(finalBuf.length / 1e6).toFixed(1)} MB`);
          } catch (e) { console.warn(`[Library] shrink skipped: ${e.message}`); } finally { if (browser) await browser.close().catch(() => {}); }
        }
        fs.writeFileSync(pptxPath, finalBuf);
        console.log(`[Pipeline] Library ${options.library.id}: Credits slide appended`);
      }
      // соңғы тексерушінің нәтижесі үйрену жүйесіне: қай ақау қанша, нешеуі түзелді
      const qa = qaReport.flatMap((r) => r.issues);
      const unfixed = qa.filter((q) => !q.fixed).length;
      if (qa.length) {
        fitInfo = { ...(fitInfo || {}), qa: { found: qa.length, fixed: qa.length - unfixed, codes: [...new Set(qa.map((q) => q.code))] } };
        console.log(`[Pipeline] Template QA: ${qa.length} ақау, ${qa.length - unfixed} түзелді`);
      }
      // Шаблон «денсаулығы» (шынайы баға): түзелмеген геометрия ақауы, LLM бермей қорғаныспен толтырылған слот, қалған мәтін ақауы
      const w = (fitInfo && fitInfo.writer) || {};
      const oldRemaining = fitInfo && Number.isFinite(fitInfo.after) ? fitInfo.after : 0;
      templateHealth = Math.max(0, Math.min(100, 100 - unfixed * 12 - (w.fallback || 0) * 3 - (w.problems || 0) * 4 - oldRemaining * 2));
      templateGeomScore = Math.max(45, 100 - unfixed * 12);
      console.log(`[Pipeline] Template health=${templateHealth} (unfixedQA=${unfixed} fallback=${w.fallback || 0} problems=${w.problems || 0}${oldRemaining ? ` oldRemaining=${oldRemaining}` : ''})`);
      console.log('[Pipeline] Template-Fill: PPTX = пайдаланушы шаблоны, тек мәтін ауыстырылды');
      const notesRes = await tplNotesTask;
      if (notesRes && notesRes.notes.length === slides.length && notesRes.ok) {
        notesMeta = { ok: notesRes.ok, study: !!notesRes.study };
        try {
          speechPath = path.join(os.tmpdir(), `speech-${uniqueId()}.docx`);
          fs.writeFileSync(speechPath, buildSpeechDocx({ title, slides, notes: notesRes.notes, study: notesRes.study, language, coverMeta }));
        } catch (e) { console.warn(`[Notes] speech docx failed: ${e.message}`); speechPath = null; }
        console.log(`[Pipeline] Template speaker notes: ${notesRes.ok}/${slides.length} slides, study guide=${notesMeta.study}`);
      }
    } catch (err) {
      // Рендерге (сурет-слайд) түспейміз: клиентке өңделетін PPTX керек. Қате болса — кредит қайтарылады.
      console.warn('[Pipeline] Template-Fill failed:', err.message);
      throw new Error(`template_fill_failed: ${err.message}`);
    }
  }

  if (!pptxPath) {
  // Тегін колода: кіріспе/әдебиет слайдтары қосылып шекті асса — ортадағы артығын алып тастаймыз (мұқаба мен соңы қалады)
  if (maxSlides && slides.length > maxSlides) {
    while (slides.length > maxSlides) slides.splice(slides.length - 2, 1);
    slides.forEach((slide, i) => { slide.index = i + 1; });
  }
  // Инфографика сирек болғанда ғана күшті: ~30%-дан аспайды, қатар тұрмайды, бір түрі (екі өсу графигі) қайталанбайды.
  // Қалғаны мәтін/сан/қадам болып қалады → ол слайдтарға фото мен мәтін макеттері түседі
  {
    const converted = limitInfographics(slides);
    if (converted) console.log(`[Pipeline] Infographics → text on ${converted} slide(s) (variety)`);
  }
  // «Made in DeadLine» карточкасы (тек тегін колода): PPTX-те бөлек, өшірілетін нысан; HTML бұрышты бос қалдырады
  const badge = options.badgeUrl !== undefined && options.free
    ? { url: options.badgeUrl || null, dark: !(slides[0] && slides[0].composition && require('./design/tokens').isLightMood(slides[0].composition.mood)) }
    : null;

  // 3. Суреттер мен визуалдар (SVG диаграмма/инфографика) — бір мезгілде, бірін-бірі күтпейді.
  //    Екеуі де ЕШҚАШАН лақтырмайды: сәтсіз болса, слайд қалыпты күйінде қалады.
  // Баяндамашы мәтіні + оқу көмекшісі: мазмұн енді түпкілікті → суреттермен ҚАТАР жазылады (күту уақыты қосылмайды)
  const notesTask = generateSpeakerNotes({
    slides: slides.map((sl) => ({ ...sl })), title, topic, language, coverMeta,
  }).catch((e) => { console.warn(`[Notes] failed (continuing): ${e.message}`); return null; });

  await onProgress('media', 'Суреттер мен диаграммалар...');
  console.log('[Pipeline] Fetching images + drawing visuals...');
  const usedImages = new Set(); // бір сурет екі слайдқа түспесін
  const deckQueries = slides.map((sl) => (typeof sl.imageQuery === 'string' ? sl.imageQuery.trim() : '')).filter(isLatinQuery);
  // Фото тек макеті шынымен фото КӨРСЕТЕТІН слайдтарға ізделеді (бұрын әр слайдқа → API лимиті тез бітетін)
  // ұзын колодада фото көбірек (13 слайдқа 4 фото — тым аз): ~45% слайд, ең көбі 7 (тегінде ~30%, ең көбі 5)
  const photoBudget = options.free
    ? Math.max(Number(process.env.PHOTO_BUDGET_FREE) || 3, Math.min(5, Math.round(slides.length * 0.3)))
    : Math.max(Number(process.env.PHOTO_BUDGET) || 4, Math.min(7, Math.round(slides.length * 0.45)));
  const photoPlan = planPhotoSlides(slides, { budget: photoBudget, skin: !!(refAnalysis && refAnalysis.skin) });
  const sysDef = require('./design/systems').getSystem(design && design.system);
  const sysCover = (sysDef && sysDef.cover) || 'classic';
  const sysClosing = (sysDef && sysDef.closing) || 'rows';
  console.log(`[Pipeline] Photo plan: ${photoPlan.indexes.size}/${slides.length} slides → [${[...photoPlan.indexes].map((i) => i + 1).join(',')}]`);
  const genBudget = deckBudget(!!options.free); // AI сурет: бір презентацияға ең көбі 2 (тегін — 1)
  // осы студенттің бұрынғы презентацияларындағы суреттер (басқа таңдау болса қайталанбайды) + осы колоданікі
  const photoAvoid = new Set(Array.isArray(options.photoAvoid) ? options.photoAvoid : []);
  const imagesTask = mapLimit(slides, 3, async (slide, idx) => {
    if (!photoPlan.indexes.has(idx)) return null;
    // Сурет іздеу тек ағылшынша (латын) сұранысқа. Қазақша/орысша сұраныс ЕШҚАШАН жіберілмейді.
    const raw = typeof slide.imageQuery === 'string' ? slide.imageQuery.trim() : '';
    const query = isLatinQuery(raw) ? raw : '';
    if (raw && !query) console.warn(`[Image] non-English imageQuery ignored: "${raw.slice(0, 60)}"`);
    // кесте/диаграмма слайдтарын фото жоспары әлдеқашан шығарып тастаған (photoPlan.mayCarryPhoto)
    // инфографика слайды фотоны қолданбайды (сызба толық ені/оң жағын алады)
    if (validateInfographic(slide.infographic)) return null;
    console.log(`[Image] query="${query}"`);
    try {
      const layout = photoPlan.planned[idx];
      const slideCtx = {
        topic: title || topic, title: slide.title, query,
        text: [slide.subtitle, slide.body].concat(Array.isArray(slide.bullets) ? slide.bullets.slice(0, 3) : [])
          .map((x) => (typeof x === 'string' ? x : (x && (x.label || x.text)) || '')).filter(Boolean).join(' · '),
        cover: layout === 'cover' || layout === 'closing' || idx === 0 || idx === slides.length - 1,
        // фото бүкіл слайдты жабады ма — жүйенің мұқаба/қорытынды пішініне қарай (доға/журнал/панель — рамка: тік портрет те жарайды)
        background: layout === 'fullImage' || (layout === 'cover' && FULL_COVERS.has(sysCover)) || (layout === 'closing' && sysClosing !== 'split'),
      };
      // Суретті КӨЗБЕН таңдау (Gemini Flash-Lite): кілт бар болса — негізгі жол
      const vision = makeVisionChooser({ ...slideCtx, maxCalls: 5 }); // +2 шақыру екінші айналымға
      if (vision) {
        const got = await fetchPhotoVision(slide, {
          query, topic, topicTitle: title || topic, text: slideCtx.text, background: slideCtx.background,
          used: usedImages, avoid: photoAvoid, free: !!options.free, vision, genBudget,
          budget: { left: Number(process.env.IMAGE_SEARCHES_PER_PHOTO) || 5 },
        });
        if (!got.fallback) {
          if (got.dataUri) {
            if (got.focus) slide.imageFocus = got.focus; // басты нысан кесілмесін
            slide.imageSource = got.source; slide.imageCredit = got.credit || ''; slide.imageLicense = got.license || '';
            if (got.key) photoKeys.push(got.key);
          }
          return got.dataUri || null;
        }
        console.warn('[Image] vision unavailable for this slide — text judge fallback');
      }
      // әр кандидат слайдқа сай ма — сипаттамасы бойынша тексеріледі (тақырыпқа қатысы жоқ сурет қойылмайды)
      const judge = makePhotoJudge(slideCtx);
      return await fetchImageWithFallback(query, topic, usedImages, deckQueries, { free: !!options.free, judge });
    } catch (err) {
      // Бір слайдтың суреті ешқашан бүкіл презентацияны құлатпауы керек
      console.warn(`[Image] slide failed, using fallback background: ${err.message}`);
      return null;
    }
  });
  const visualsTask = attachVisuals(slides, { language });
  // бос бұрыштарға кітапхана әшекейі: DeepSeek әр слайдқа сай зат таңдайды (суреттермен қатар жүреді)
  const decorTask = refAnalysis ? Promise.resolve() : pickDeckDecor(slides, { topic: title }).catch((e) => console.warn('[Decor] ' + e.message));
  const [images, visualStatsOut] = await Promise.all([imagesTask, visualsTask, decorTask]);
  visualStats = visualStatsOut;
  slides.forEach((slide, i) => { slide.webImageUrl = images[i] || ''; if (slide.webImageUrl && slide.decorPick) slide.decorPick = null; });
  // No photo → safe composition (avoid empty half panels / sparse look)
  slides.forEach((slide) => {
    if (slide.webImageUrl) return;
    const c = slide.composition || (slide.composition = {});
    if (c.image === 'right_half' || c.image === 'left_half' || c.image === 'corner_accent' || c.image === 'top_strip' || c.image === 'bottom_strip') {
      c.image = 'full_background';
      c.textPosition = 'center';
      c.overlay = 'dark_gradient_bottom';
    }
    if (!c.overlay || c.overlay === 'none') c.overlay = 'dark_gradient_bottom';
  });
  console.log(`[Pipeline] Images embedded: ${images.filter(Boolean).length}/${slides.length}; visuals: ${visualStats.ok}/${visualStats.requested}`);

  // 4–5. HTML + render with optional composition re-repair on overflow
  await onProgress('html', 'Слайд дизайны жиналуда...');
  console.log('[Pipeline] Building HTML presentation...');

  const cleanupPngs = () => {
    try {
      for (const p of pngPaths) {
        try { fs.unlinkSync(p); } catch {}
      }
      if (tmpDir) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {
          try { fs.rmdirSync(tmpDir); } catch {}
        }
      }
    } catch {}
    pngPaths = [];
    bgPaths = [];
    textLayers = [];
    tmpDir = null;
  };

  const buildAndRender = async (attempt) => {
    const pathHtml = path.join(os.tmpdir(), `presentation-${uniqueId()}.html`);
    restoreCover(slides);
    fs.writeFileSync(pathHtml, build3DPresentationHTML(slides, title, { style, badge: !!badge, skin: refAnalysis ? refAnalysis.skin : null, refRoles: refAnalysis && refAnalysis.outline ? refAnalysis.outline.roles : null, recentComps: options.recentComps || [] }), 'utf8');
    await onProgress('render', attempt > 1 ? 'Қайта рендер...' : 'Өңделетін PPTX жасалуда...');
    console.log(`[Pipeline] Rendering HTML → PNG → PPTX (attempt ${attempt})...`);
    cost.addRenderAttempt();
    const result = await renderHtmlToPngs(pathHtml);
    return { pathHtml, ...result };
  };

  try {
    let attempt = 1;
    let rendered = await buildAndRender(attempt);
    htmlPath = rendered.pathHtml;
    pngPaths = rendered.pngPaths;
    bgPaths = rendered.bgPaths || [];
    textLayers = rendered.textLayers || [];
    tmpDir = rendered.tmpDir;
    overflowWarnings = rendered.overflowWarnings || [];

    if (overflowWarnings.length) {
      console.warn(`[Pipeline] ⚠️ ${overflowWarnings.length} слайдта мәселе: ${overflowWarnings.join(' | ')}`);
      const hints = hintsFromOverflowWarnings(overflowWarnings);
      const hasLayoutProblems = Object.keys(hints.overflowByIndex).length > 0 || hints.blankIndexes.length > 0;
      if (hasLayoutProblems && attempt < 2) {
        console.log('[Pipeline] Applying deterministic composition repair from render QA...');
        const comp = repairDeckComposition(slides, hints);
        if (comp.repairs.length) {
          slides = comp.slides;
          slides.forEach((slide, i) => { slide.index = i + 1; });
          // rebuild HTML + re-render once
          try { fs.unlinkSync(htmlPath); } catch {}
          cleanupPngs();
          attempt = 2;
          rendered = await buildAndRender(attempt);
          htmlPath = rendered.pathHtml;
          pngPaths = rendered.pngPaths;
          bgPaths = rendered.bgPaths || [];
          textLayers = rendered.textLayers || [];
          tmpDir = rendered.tmpDir;
          overflowWarnings = rendered.overflowWarnings || [];
          if (overflowWarnings.length) {
            console.warn(`[Pipeline] After composition repair still: ${overflowWarnings.join(' | ')}`);
          }
        }
      }
    }

    const badRatio = overflowWarnings.length / Math.max(slides.length, 1);
    if (badRatio >= 0.4 && overflowWarnings.length >= 2) {
      const err = new Error(
        `Render QA failed: ${overflowWarnings.length}/${slides.length} slides have layout issues (${overflowWarnings.join('; ')})`
      );
      err.isQualityGate = true;
      throw err;
    }
    if (!pngPaths.length) {
      throw new Error('Render produced zero PNGs');
    }

    // DeepSeek визуал тексеріс: құрастырылған слайдтарды КӨЗБЕН қарау → проблемалыларын ғана қайта жасау,
    // жаңа нұсқа проблема азайса ғана қабылданады (әйтпесе бұрынғысы қалады). DESIGN_REVIEW=0 — өшіру.
    if (process.env.DESIGN_REVIEW !== '0') {
      try {
        const VR = require('./design/visualReview');
        const layouts = VR.layoutsOf(htmlPath);
        const cxIdx = layouts.map((l, i) => (/^cx-/.test(l) ? i : -1)).filter((i) => i >= 0);
        if (cxIdx.length) {
          await onProgress('vision', 'Дизайнды көзбен тексеру...');
          const r1 = await VR.review({ pngPaths, idx: cxIdx, topic });
          console.log(`[Pipeline] Design review: score=${r1 ? r1.score : '-'} flagged=${r1 ? (r1.flagged.map((f) => (f.i + 1) + ':' + f.problems.join('/')).join(' ') || 'none') : 'n/a'}`);
          if (r1 && r1.flagged.length) {
            const before = {
              slides: slides.map((s) => JSON.parse(JSON.stringify(s))), htmlPath, pngPaths: pngPaths.slice(), bgPaths: bgPaths.slice(),
              textLayers: textLayers.slice(), tmpDir, overflowWarnings: (overflowWarnings || []).slice(),
            };
            const changed = VR.applyFixes(slides, layouts, r1.flagged);
            if (changed.length) {
              attempt += 1;
              const re = await buildAndRender(attempt);
              const r2 = await VR.review({ pngPaths: re.pngPaths, idx: changed, topic });
              const n1 = r1.flagged.filter((f) => changed.includes(f.i)).reduce((n, f) => n + f.problems.length, 0);
              const n2 = r2 ? r2.flagged.reduce((n, f) => n + f.problems.length, 0) : n1;
              const ovOk = (re.overflowWarnings || []).length <= before.overflowWarnings.length && re.pngPaths.length === before.pngPaths.length;
              const drop = (h, pngs, dir) => {
                try { fs.unlinkSync(h); } catch {}
                for (const p of pngs) { try { fs.unlinkSync(p); } catch {} }
                if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
              };
              if (r2 && n2 < n1 && ovOk) {
                drop(before.htmlPath, before.pngPaths, before.tmpDir);
                htmlPath = re.pathHtml; pngPaths = re.pngPaths; bgPaths = re.bgPaths || []; textLayers = re.textLayers || [];
                tmpDir = re.tmpDir; overflowWarnings = re.overflowWarnings || [];
                console.log(`[Pipeline] Design review: re-made slides ${changed.map((i) => i + 1).join(',')} accepted (problems ${n1}→${n2})`);
              } else {
                drop(re.pathHtml, re.pngPaths, re.tmpDir);
                slides = before.slides;
                console.log(`[Pipeline] Design review: re-made version rejected (problems ${n1}→${r2 ? n2 : '?'}${ovOk ? '' : ', render QA worse'}) — kept original`);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[Pipeline] Design review error (continuing): ${e.message}`);
      }
    }

    // Ескі Vision Art Director: тек VISION_CRITIC=1 болғанда. Кілтсіз ол PNG көлеміне қарап «бос» деп шешіп,
    // слайд мазмұнын қиып қайта рендерлейтін (+30 с, композицияларды бұзады) — оның орнын DeepSeek визуал тексерісі басты.
    if (process.env.VISION_CRITIC === '1') try {
      await onProgress('vision', 'Визуал сын (Art Director)...');
      const vision = await runVisionCritic({ slides, pngPaths, title, topic });
      visionMeta = {
        overallScore: vision.overallScore,
        source: vision.source,
        applied: vision.applied || [],
        issues: (vision.issues || []).length,
      };
      console.log(
        `[Pipeline] Vision score=${vision.overallScore} source=${vision.source} ` +
        `issues=${visionMeta.issues} redesign=${!!vision.needRedesign} applied=${(vision.applied || []).length}`
      );
      if (vision.needRedesign && (vision.applied || []).length && attempt < 3) {
        // Snapshot BEFORE version for best-version policy
        const beforeSlides = slides.map((s) => JSON.parse(JSON.stringify(s)));
        const beforeHtml = htmlPath;
        const beforePngs = pngPaths.slice();
        const beforeBgs = bgPaths.slice();
        const beforeLayers = textLayers.slice();
        const beforeTmp = tmpDir;
        const beforeOverflow = (overflowWarnings || []).slice();
        const beforeVisionScore = vision.overallScore;
        const beforeSizes = beforePngs.map((p) => {
          try { return fs.statSync(p).size; } catch { return 0; }
        });

        slides = vision.slides;
        slides.forEach((slide, i) => { slide.index = i + 1; });
        // Keep before PNG files; buildAndRender creates a new tmpDir
        pngPaths = [];
        bgPaths = [];
        textLayers = [];
        tmpDir = null;
        attempt = Math.max(attempt, 2) + 1;
        rendered = await buildAndRender(attempt);
        const afterHtml = rendered.pathHtml;
        const afterPngs = rendered.pngPaths;
        const afterTmp = rendered.tmpDir;
        const afterOverflow = rendered.overflowWarnings || [];
        const afterSizes = afterPngs.map((p) => {
          try { return fs.statSync(p).size; } catch { return 0; }
        });

        // Objective comparison without second vision call:
        // fewer overflow warnings, fewer near-blank PNGs, not fewer total slides
        const blankish = (sizes) => sizes.filter((s) => s > 0 && s < 35000).length;
        const beforeBlank = blankish(beforeSizes);
        const afterBlank = blankish(afterSizes);
        const beforeOv = beforeOverflow.length;
        const afterOv = afterOverflow.length;
        const afterBetter =
          afterPngs.length >= beforePngs.length
          && (afterOv < beforeOv || afterBlank < beforeBlank || (afterOv <= beforeOv && afterBlank <= beforeBlank));

        visionMeta.beforeScore = beforeVisionScore;
        visionMeta.afterMetrics = { overflow: afterOv, blankish: afterBlank, pngs: afterPngs.length };
        visionMeta.beforeMetrics = { overflow: beforeOv, blankish: beforeBlank, pngs: beforePngs.length };

        if (afterBetter) {
          // Accept AFTER: drop BEFORE files
          try { fs.unlinkSync(beforeHtml); } catch {}
          for (const p of beforePngs) { try { fs.unlinkSync(p); } catch {} }
          if (beforeTmp) { try { fs.rmSync(beforeTmp, { recursive: true, force: true }); } catch {} }
          htmlPath = afterHtml;
          pngPaths = afterPngs;
          bgPaths = rendered.bgPaths || [];
          textLayers = rendered.textLayers || [];
          tmpDir = afterTmp;
          overflowWarnings = afterOverflow;
          visionMeta.acceptedVersion = 'after';
          visionMeta.redesignAccepted = true;
          console.log(`[Pipeline] Vision AFTER accepted (attempt ${attempt}) ov ${beforeOv}→${afterOv} blankish ${beforeBlank}→${afterBlank}`);
        } else {
          // Revert to BEFORE
          try { fs.unlinkSync(afterHtml); } catch {}
          for (const p of afterPngs) { try { fs.unlinkSync(p); } catch {} }
          if (afterTmp) { try { fs.rmSync(afterTmp, { recursive: true, force: true }); } catch {} }
          slides = beforeSlides;
          htmlPath = beforeHtml;
          pngPaths = beforePngs;
          bgPaths = beforeBgs;
          textLayers = beforeLayers;
          tmpDir = beforeTmp;
          overflowWarnings = beforeOverflow;
          visionMeta.acceptedVersion = 'before';
          visionMeta.redesignAccepted = false;
          console.log(`[Pipeline] Vision AFTER rejected — kept BEFORE (ov ${beforeOv}→${afterOv} blankish ${beforeBlank}→${afterBlank})`);
        }
      }
    } catch (err) {
      console.warn(`[Pipeline] Vision critic error (continuing): ${err.message}`);
    }

    if (!pngPaths.length) {
      throw new Error('Render produced zero PNGs');
    }
    // Баяндамашы мәтіні → PPTX Notes + бөлек .docx (слайд саны өзгермесе ғана — әйтпесе нөмірлер сәйкес келмейді)
    const notesRes = await notesTask;
    if (notesRes && notesRes.notes.length === slides.length) {
      notesMeta = { ok: applySpeakerNotes(slides, notesRes.notes), study: !!notesRes.study };
      try {
        speechPath = path.join(os.tmpdir(), `speech-${uniqueId()}.docx`);
        fs.writeFileSync(speechPath, buildSpeechDocx({ title, slides, notes: notesRes.notes, study: notesRes.study, language, coverMeta }));
      } catch (e) { console.warn(`[Notes] speech docx failed: ${e.message}`); speechPath = null; }
      console.log(`[Pipeline] Speaker notes: ${notesMeta.ok}/${slides.length} slides, study guide=${notesMeta.study}`);
    }
    // Сурет авторы: CC BY / BY-SA лицензиясы атрибуцияны талап етеді → баяндамашы жазбасының соңына (слайдты бүлдірмейді)
    {
      const lab = /russian|рус/i.test(String(language || '')) ? 'Изображение' : /english/i.test(String(language || '')) ? 'Image' : 'Сурет';
      const aiLab = /russian|рус/i.test(String(language || '')) ? 'создано ИИ' : /english/i.test(String(language || '')) ? 'AI-generated' : 'ЖИ жасаған';
      slides.forEach((sl) => {
        if (!sl || !sl.webImageUrl || !sl.imageSource) return;
        const line = sl.imageSource === 'ai' ? `${lab}: ${aiLab}` : (sl.imageCredit ? `${lab}: ${String(sl.imageCredit).slice(0, 220)}${sl.imageLicense && !String(sl.imageCredit).includes(sl.imageLicense) ? ` (${sl.imageLicense})` : ''}` : '');
        if (line) sl.speakerNotes = (sl.speakerNotes ? sl.speakerNotes + '\n\n' : '') + line;
      });
    }
    // Өңделетін PPTX: мәтінсіз фон + нативті мәтін қораптары (HTML тек ішкі «сурет салушы»)
    pptxPath = await exportToPptx(pngPaths, title, slides, { bgPaths, textLayers, language, badge });
  } catch (err) {
    try { if (htmlPath) fs.unlinkSync(htmlPath); } catch {}
    try { if (speechPath) fs.unlinkSync(speechPath); } catch {}
    throw err;
  } finally {
    cleanupPngs();
  }
  } // end if (!pptxPath) — Template-Fill режимінде бұл блок өткізіледі

  const costSnapshot = cost.logSummary();
  const ms = Date.now() - t0;
  console.log(`[Pipeline] id=${genId} Done in ${ms}ms: slides=${slides.length} score=${qualityMeta.qualityScore} pptx=${pptxPath} html=${htmlPath} visuals=${visualStats.ok}/${visualStats.requested}`);
  const expensiveVisuals = !!(visualStats && visualStats.ok > 0);
  const dimensionScores = buildDimensionScores({
    contentScore: qualityMeta.qualityScore,
    narrativeScore: narrativeMeta.narrativeScore,
    visualScore: visionMeta.overallScore != null
      ? visionMeta.overallScore
      : (visualStats.requested
        ? Math.round(40 + 60 * (visualStats.ok / Math.max(visualStats.requested, 1)))
        : 75),
    // шаблон режимінде композиция мен рендер — шаблонды толтырудың шынайы нәтижесі (бұрын 98 «алдайтын»)
    compositionScore: templateHealth != null ? Math.max(30, templateHealth) : qualityMeta.qualityScore,
    readabilityScore: qualityMeta.qualityScore,
    sourceScore: 80,
    // рендер бағасы тек геометрия ақауынан (жеткізуді тоқтататын шлюзге қорғаныс слоттары әсер етпейді)
    renderScore: templateGeomScore != null
      ? templateGeomScore
      : overflowWarnings && overflowWarnings.length
        ? Math.max(40, 100 - overflowWarnings.length * 15)
        : 95,
  });
  console.log(`[Pipeline] Dimensions overall=${dimensionScores.overall} ${JSON.stringify(dimensionScores.dimensions)}`);

  // FINAL QUALITY GATE — critical defects block delivery (refund path in bot)
  {
    const dims = dimensionScores.dimensions || {};
    const critical =
      (dims.renderIntegrity != null && dims.renderIntegrity < 40)
      || (dims.content != null && dims.content < 35)
      || (dimensionScores.overall < 40);
    if (critical) {
      const err = new Error(
        `Final quality gate failed: overall=${dimensionScores.overall} ` +
        `content=${dims.content} render=${dims.renderIntegrity}`
      );
      err.isQualityGate = true;
      throw err;
    }
  }

  // Талаптар есебі (soft бағалау 1 LLM шақыру; сәтсіз болса есеп балсыз қалады)
  let requirementsReport = null;
  let templateReport = null;
  if (reqQaResult) {
    // Mode 2: цикл ішінде жасалған есепті қолданамыз (қосымша LLM шақыру керек емес)
    requirementsReport = reqQaResult.report;
  } else if (reqSet) {
    try {
      if (refAnalysis && refAnalysis.outline) {
        const lm = layoutMatch(slides);
        console.log(`[Pipeline] id=${genId} Reference layout match: ${lm.ok}/${lm.total} (${lm.pct}%)${lm.miss.length ? ' · ' + lm.miss.join('; ') : ''}`);
        if (lm.total) reqSet = { v: 1, items: reqSet.items.concat([{ id: 'refm', kind: 'hard', check: 'layout_match', op: '>=', value: 70, quote: 'Референс PPTX: макеттер сәйкестігі', source: 'reference' }]) };
      }
      requirementsReport = await REQ.auditSlides(reqSet, slides, {
        overrides: reqNote ? [reqNote] : [],
        checkers: { layout_match: (item, sl) => { const lm = layoutMatch(sl); return lm.pct >= item.value ? { status: 'pass', actual: lm.pct, message: `${lm.ok}/${lm.total}` } : { status: 'fail', actual: lm.pct, message: `${lm.ok}/${lm.total} макет сәйкес` + (lm.miss.length ? ': ' + lm.miss.slice(0, 3).join('; ') : '') }; } },
      });
    }
    catch (e) { console.warn(`[Pipeline] id=${genId} Requirement audit failed: ${e.message}`); }
  }

  // Template QA (Mode 3): шаблон дизайнының сақталуын өлшейтін бөлек есеп
  if (refAnalysis && refAnalysis.outline) {
    try {
      templateReport = buildTemplateReport(refAnalysis, slides, { refTheme, style });
      console.log(`[Pipeline] id=${genId} Template QA: ${templateReport.summary}${templateReport.checks.some((c) => c.status === 'fail') ? ' · fails: ' + templateReport.checks.filter((c) => c.status === 'fail').map((c) => c.name).join(', ') : ''}`);
    } catch (e) { console.warn(`[Pipeline] id=${genId} Template QA failed: ${e.message}`); }
  }

  setActiveCostTracker(null);
  return {
    // Үйрену жүйесі үшін толтыру нәтижесі (шаблонның өзін server.js оқиды — тек клиент келіскенде)
    templateLearn: isTemplateFill && !options.library ? { fit: fitInfo, layoutPlanned } : null,
    libraryId: options.library ? options.library.id : null,
    requirementsReport,
    templateReport,
    mode,
    pptxPath,
    htmlPath,
    speechPath,
    title,
    visualStats,
    genId,
    durationMs: ms,
    qualityScore: qualityMeta.qualityScore,
    qualityRepairs: qualityMeta.iterations,
    cost: costSnapshot,
    expensiveVisuals,
    dimensionScores,
    narrativeScore: narrativeMeta.narrativeScore,
    visionScore: visionMeta.overallScore,
    visionSource: visionMeta.source,
    photoKeys,
    // колодада қолданылған композициялар → студенттің дизайн жадына (келесі колодада алдымен басқалары)
    compIds: compIdsOf(htmlPath),
    design,
  };
}

/** HTML-дағы құрастырылған композиция идентификаторлары (data-layout="cx-…") */
function compIdsOf(file) {
  try { return [...new Set([...fs.readFileSync(file, 'utf8').matchAll(/data-layout="cx-([a-z0-9-]+)"/g)].map((m) => m[1]))]; } catch { return []; }
}

module.exports = { generatePresentation, _fetchPhotoVision: fetchPhotoVision, _swapLibraryPhotos: swapLibraryPhotos };
