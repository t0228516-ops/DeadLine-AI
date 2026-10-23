'use strict';
/**
 * МАЗМҰНҒА ҚАРАЙ МАКЕТ: шаблонның слайдтары соқыр ретпен емес, мазмұнның формасына қарай таңдалады.
 *
 *   1) slideMeta  — шаблонның әр қор слайдының формасы: неше карточка, сан, мәтін блогы, қысқа белгі, фото (бір рет есептеліп, дискіде сақталады);
 *   2) planShapes — LLM алдымен МАЗМҰНДЫ жоспарлайды: әр слайдтың тақырыбы, мақсаты, негізгі ойлары және ФОРМАСЫ
 *                   («4 пункт», «3 қадам», «2 сан», «салыстыру», «түсіндіру», «дәйексөз», «бөлім»);
 *   3) matchPicks — әр формаға шаблоннан ең сай слайд: 4 пунктке 4 карточкалы, сандарға сан слайды, түсіндіруге мәтін блогы;
 *                   бір макет қатар келмейді, бір макет көп қайталанбайды.
 * Жоспар әңгіме желісі (storyline) ретінде мазмұн генераторына беріледі — жеке LLM шақыруы қосылмайды (planStoryline орнына).
 * LLM болмаса/қате болса — null, кітапхана бұрынғы ретпен (planPicks) жұмыс істейді.
 */
const fs = require('fs');
const path = require('path');

const META_VERSION = 1;
const FORMS = ['points', 'steps', 'figures', 'compare', 'explain', 'quote', 'section'];

/** Профиль жолынан сандар: «title; subtitle; 3 card(s)…; 2 key figure(s)…; 1 text block(s); 5 short label(s)» */
function shapeOfProfile(profile) {
  const n = (re) => +((String(profile).match(re) || [])[1] || 0);
  return {
    cards: n(/(\d+) card\(s\)/),
    figures: n(/(\d+) key figure/),
    bodies: n(/(\d+) text block/),
    labels: n(/(\d+) short label/),
    subtitle: /(^|; )subtitle/.test(profile),
  };
}

/**
 * Шаблонның қор слайдтарының формасы. src — толық шаблон, t — каталог жазбасы.
 * @returns {Array<{slide:number, role:string, cards, figures, bodies, labels, subtitle, photos, profile}>} slide — 1-негізді
 */
function slideMeta(src, t, dir) {
  const file = dir && path.join(dir, `${t.id}.meta.json`);
  try { const c = JSON.parse(fs.readFileSync(file, 'utf8')); if (c.v === META_VERSION) return c.slides; } catch {}
  const { carveDeck } = require('./carve');
  const { analyzeTemplate } = require('../templateSchema');
  const { photoSlots } = require('./photos');
  const roles = [];
  const add = (s, role) => { if (s && !roles.some((r) => r.slide === s)) roles.push({ slide: s, role }); };
  add(t.cover, 'cover'); add(t.agenda, 'agenda');
  (t.section || []).forEach((s) => add(s, 'section'));
  (t.text || []).forEach((s) => add(s, 'text'));
  (t.stats || []).forEach((s) => add(s, 'stats'));
  (t.quote || []).forEach((s) => add(s, 'quote'));
  add(t.closing, 'closing');
  const deck = carveDeck(src, roles.map((r) => r.slide - 1));
  const sch = analyzeTemplate(deck);
  const photos = new Map();
  for (const p of photoSlots(deck)) photos.set(p.slide, (photos.get(p.slide) || 0) + 1);
  const slides = roles.map((r, i) => ({ ...r, ...shapeOfProfile(sch.slides[i] ? sch.slides[i].profile : ''), photos: photos.get(i) || 0, profile: sch.slides[i] ? sch.slides[i].profile : '' }));
  if (file) { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify({ v: META_VERSION, slides })); } catch {} }
  return slides;
}

/** Слайдтағы параллель элементтер саны (карточка не қысқа белгі) */
const itemsOf = (m) => Math.max(m.cards, m.labels, m.bodies > 1 ? m.bodies : 0);

/** Форма мен слайдтың сәйкестігі (көп — жақсы; -Infinity — мүлде болмайды) */
function fitScore(m, shape) {
  const k = itemsOf(m);
  const want = Math.max(1, Math.min(6, Number(shape.count) || 0));
  switch (shape.form) {
    case 'quote': return m.role === 'quote' ? 10 : -Infinity;
    case 'section': return m.role === 'section' ? 10 : -Infinity;
    case 'figures': return m.figures ? 10 - 2 * Math.abs(m.figures - want) : -Infinity;
    case 'compare': return m.role === 'text' || m.role === 'section' ? (k === 2 ? 9 : k ? 5 - Math.abs(k - 2) : 1) : -Infinity;
    case 'explain':
      if (m.role !== 'text') return -Infinity;
      return (m.bodies || m.subtitle ? 6 : 2) - 2 * Math.max(0, k - 1) + (m.photos ? 1 : 0);
    case 'points': case 'steps':
      if (m.role !== 'text') return -Infinity;
      if (!k) return m.bodies || m.subtitle ? 1 : 0;   // бір абзацқа тізім де сыяды, бірақ нашар
      return 10 - 3 * Math.abs(k - want);
    default: return m.role === 'text' ? 0 : -Infinity;
  }
}

/**
 * Формалар → шаблон слайдтары (0-негізді, carveDeck үшін).
 * @param {object} t каталог жазбасы
 * @param {Array} meta slideMeta
 * @param {Array<{form, count}>} shapes ортаңғы слайдтар (мұқаба/мазмұны/қорытынды — жоқ)
 * @param {{agenda:boolean, closing:boolean}} fixed
 */
function matchPicks(t, meta, shapes, fixed) {
  const head = [t.cover];
  if (fixed.agenda && t.agenda) head.push(t.agenda);
  const used = new Map();
  const middle = [];
  const pick = (sh) => {
    let best = null; let bs = -Infinity;
    for (const m of meta) {
      let s = fitScore(m, sh);
      if (s === -Infinity) continue;
      s -= 5 * (used.get(m.slide) || 0);                         // бір макет көп қайталанбасын
      if (middle.length && middle[middle.length - 1] === m.slide) s -= 12; // қатар келмесін
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  };
  for (const sh of shapes) {
    // сай слайд жоқ (мыс. шаблонда дәйексөз/сан слайды жоқ) — «түсіндіру» формасына ең жақын слайд (элементі ең аз)
    let best = pick(sh) || pick({ form: 'explain', count: 1 });
    if (!best) best = meta.find((m) => m.role === 'text') || meta.find((m) => m.role !== 'cover');
    used.set(best.slide, (used.get(best.slide) || 0) + 1);
    middle.push(best.slide);
  }
  const tail = fixed.closing && t.closing ? [t.closing] : [];
  return head.concat(middle, tail).map((x) => x - 1);
}

function buildPrompt({ topic, brief, language, n, middle, agenda, closing, hasQuote, hasSection, hasFigures }) {
  const forms = [
    '"points" — 2–6 parallel ideas/components/causes, each a heading + 1–2 sentences (set "count")',
    '"steps" — 2–6 ordered stages/events/steps (set "count")',
    hasFigures ? '"figures" — 1–4 REAL numbers (years, %, counts) with what they measure (set "count"); only if the topic has well-known figures' : null,
    '"compare" — two sides compared (before/after, pros/cons, two views)',
    '"explain" — one idea explained in a short paragraph with a concrete fact or example',
    hasQuote ? '"quote" — one real, well-known quotation by a real person relevant to the topic (at most once)' : null,
    hasSection ? '"section" — a short divider introducing the next part (at most once, only in longer decks)' : null,
  ].filter(Boolean).map((x) => `  - ${x}`).join('\n');
  return `TOPIC: ${topic}
${brief ? `CLIENT BRIEF / WISHES:\n"""\n${String(brief).slice(0, 6000)}\n"""\n` : ''}OUTPUT LANGUAGE: ${language || 'the language of the topic'} (every string).

You are a senior presentation strategist and a subject-matter expert. Plan the CONTENT of a ${n}-slide student presentation first; the design will be fitted to your content afterwards.
Fixed slides (do not plan them): slide 1 = cover${agenda ? ', slide 2 = agenda' : ''}${closing ? `, slide ${n} = closing/thank you` : ''}.
Plan exactly ${middle} content slides that tell a clear story: context → core ideas → how it works / evidence / examples → significance → conclusion (the last content slide is the conclusion).
For each slide choose the FORM that the content naturally has — do not force lists; vary forms across the deck:
${forms}

Return JSON only:
{"title":"presentation title",
 "slides":[{"heading":"informative heading that states the point","form":"points","count":4,"purpose":"what the audience must understand","key_points":["concrete point","..."]}]}
"slides" must have exactly ${middle} entries. For points/steps/figures, key_points has exactly "count" items. Facts must be accurate; no invented people, organisations or numbers.`;
}

/** LLM жауабы → формалар + storyline жолдары; жарамсыз болса null */
function toShapes(o, middle) {
  if (!o || !Array.isArray(o.slides) || o.slides.length !== middle) return null;
  const clean = (v, k) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, k);
  const shapes = [];
  for (const s of o.slides) {
    const heading = clean(s && s.heading, 120);
    if (!heading) return null;
    const form = FORMS.includes(s.form) ? s.form : 'explain';
    const pts = (Array.isArray(s.key_points) ? s.key_points : []).map((x) => clean(x, 160)).filter(Boolean).slice(0, 6);
    const count = ['points', 'steps', 'figures'].includes(form) ? Math.max(1, Math.min(6, Number(s.count) || pts.length || 3)) : form === 'compare' ? 2 : 1;
    shapes.push({ heading, form, count, purpose: clean(s.purpose, 240), points: pts });
  }
  const title = clean(o.title, 160);
  return title ? { title, shapes } : null;
}

/** Таңдалған слайдтардың нақты формасымен storyline (generateSlides outline форматы) */
function storyFrom(plan, picks, meta, t, fixed) {
  const byIdx = new Map(meta.map((m) => [m.slide - 1, m]));
  const topics = [];
  const n = picks.length;
  let k = 0;
  picks.forEach((p, i) => {
    const m = byIdx.get(p);
    if (i === 0) { topics.push(`COVER: ${plan.title}`); return; }
    if (fixed.agenda && t.agenda && i === 1) { topics.push('AGENDA: the contents of this presentation (its own section names)'); return; }
    if (fixed.closing && t.closing && i === n - 1) { topics.push('CLOSING: thank-you / questions slide'); return; }
    const s = plan.shapes[k++];
    if (!s) { topics.push('Conclusion — key takeaways'); return; }
    topics.push([s.heading, s.purpose ? ` — ${s.purpose}` : '', s.points.length ? `. Key points: ${s.points.join('; ')}` : '',
      m && m.profile ? `. Slide form: ${m.profile}` : ''].join(''));
  });
  return { title: plan.title, slideTopics: topics };
}

/**
 * Мазмұнды жоспарлап, шаблон слайдтарын соған сай таңдайды.
 * @returns {Promise<{picks:number[], outline:{title, slideTopics:string[]}, shapes}|null>}
 */
async function arrange({ src, t, n, topic, brief, language, llm, dir }) {
  if (!topic) return null;
  const meta = slideMeta(src, t, dir);
  const fixed = { agenda: !!t.agenda && n >= 7, closing: !!t.closing };
  const middle = n - 1 - (fixed.agenda ? 1 : 0) - (fixed.closing ? 1 : 0);
  if (middle < 2) return null;
  const call = llm || (process.env.DEEPSEEK_API_KEY ? require('../../../core/llm').deepseekJson : null);
  if (!call) return null;
  try {
    const o = await call('You plan professional presentations. Respond with valid JSON only.', buildPrompt({
      topic, brief, language, n, middle, agenda: fixed.agenda, closing: fixed.closing,
      hasQuote: meta.some((m) => m.role === 'quote'), hasSection: meta.some((m) => m.role === 'section') && n >= 10,
      hasFigures: meta.some((m) => m.figures),
    }), 'library-arrange', 5000, { temperature: 0.4, timeoutMs: 90_000 });
    const plan = toShapes(o, middle);
    if (!plan) { console.warn('[Library] arrange: invalid plan — default order'); return null; }
    const picks = matchPicks(t, meta, plan.shapes, fixed);
    console.log(`[Library] arrange ${t.id}: ${plan.shapes.map((s) => s.form + (s.count > 1 ? s.count : '')).join(' ')} → slides ${picks.map((p) => p + 1).join(',')}`);
    return { picks, outline: storyFrom(plan, picks, meta, t, fixed), shapes: plan.shapes };
  } catch (e) {
    console.warn(`[Library] arrange failed (${e.message}) — default order`);
    return null;
  }
}

module.exports = { arrange, slideMeta, shapeOfProfile, fitScore, matchPicks, buildPrompt, toShapes, storyFrom, FORMS };
