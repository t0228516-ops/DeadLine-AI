'use strict';
/**
 * PHOTO PLAN — ask the stock-photo APIs only for the slides that will actually SHOW a photo.
 *
 * The layout engine picks a slide's composition from its content AND from whether it has a photo, and most
 * layouts (lists, numbers, timelines, tables, infographics…) never show one. Searching a photo for every slide
 * wasted ~10–30 API calls per deck and burned the Unsplash/Pexels hourly limits.
 *
 * So, before any search, we run the same deck planner with a placeholder photo on every slide that may carry one
 * and keep only the slides whose planned layout really displays it. Photos therefore land exactly where they did
 * before; the rest of the slides cost no request at all. A budget caps the count (cover first).
 */
const A = require('./design/analyze');
const { validateInfographic } = require('./design/infographics');

const PLACEHOLDER = 'about:photo'; // not a data: URI → size unknown → treated as sharp enough, like a real photo
/** Layouts that display the slide photo (see design/layouts.js). */
const SHOWS_PHOTO = new Set(['cover', 'imageFocus', 'split', 'fullImage', 'stackSplit', 'section', 'closing', 'editorial']);
/** Which photo slides win when the budget is tight. */
const PRIORITY = { cover: 0, imageFocus: 1, fullImage: 1, split: 2, stackSplit: 2, section: 3, closing: 4, editorial: 5 };

/** Мазмұн слайды фотоға жарай ма: 3-5 пункт не абзац; кесте/сан/сызба/процесс/уақыт сызығы емес */
function photoFriendly(s) {
  const c = s.composition || {};
  if (s.table || (Array.isArray(s.stats) && s.stats.length) || s.visual || s.visualSvg) return false;
  if (/process|hierarchy|timeline|comparison|stats|quote/.test(String(c.visualPurpose || ''))) return false;
  const n = Array.isArray(s.bullets) ? s.bullets.filter(Boolean).length : 0;
  return (n >= 3 && n <= 5) || (!n && String(s.body || '').trim().length > 40);
}

function mayCarryPhoto(slide) {
  const s = slide || {};
  // DeepSeek ырғақ үшін мазмұн слайдына да image:"none" қояды — макетті композиция қозғалтқышы өзі таңдайды, фото жарайтын слайд фотосыз қалмасын
  if (s.composition && s.composition.image === 'none' && !photoFriendly(s)) return false;
  if (validateInfographic(s.infographic)) return false;
  return true;
}

/**
 * @param {object[]} slides
 * @param {{ budget?: number, skin?: boolean }} [opts]
 * @returns {{ indexes: Set<number>, planned: string[] }} slides to search a photo for + their planned layouts
 */
function planPhotoSlides(slides, opts = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const budget = Number.isFinite(opts.budget) ? opts.budget : 4;
  const sim = list.map((s) => Object.assign({}, s, { webImageUrl: mayCarryPhoto(s) ? PLACEHOLDER : '' }));
  const plan = A.planDeck(sim);
  const cands = [];
  // композиция қозғалтқышында қорытынды (closing-seal) мен бөлім (section-band) фотоны көрсетпейді — оларға іздеу бекер
  const compose = process.env.DESIGN_COMPOSE !== '0' && !opts.skin;
  const blind = (layout) => compose && (layout === 'closing' || layout === 'section');
  plan.forEach((p, i) => {
    if (sim[i].webImageUrl && SHOWS_PHOTO.has(p.layout) && !blind(p.layout)) cands.push({ i, layout: p.layout, rank: PRIORITY[p.layout] });
  });
  // Композиция қозғалтқышы (cx-*) 3-5 пункті не абзацы бар кез келген мазмұн слайдына фото қоя алады (photo-half,
  // photo-polaroid, statement-arch...) — ескі жоспарлаушы оларды «фотосыз» деп санап, колодада 1-2 фото ғана қалатын
  const taken = new Set(cands.map((c) => c.i));
  list.forEach((s, i) => {
    if (taken.has(i) || !sim[i].webImageUrl || !photoFriendly(s) || blind(plan[i] && plan[i].layout)) return;
    cands.push({ i, layout: plan[i] && plan[i].layout, rank: 6 });
  });
  cands.sort((a, b) => a.rank - b.rank || a.i - b.i);
  // қосымша слайдтар қатар тұрмасын (фото — фото — фото ырғақты бұзады), орын жетпесе ғана көршілер алынады
  const keep = [];
  for (const c of cands) { if (keep.length >= budget) break; if (c.rank < 6 || !keep.some((k) => Math.abs(k.i - c.i) === 1)) keep.push(c); }
  for (const c of cands) { if (keep.length >= budget) break; if (!keep.includes(c)) keep.push(c); }
  return { indexes: new Set(keep.map((c) => c.i)), planned: plan.map((p) => p.layout) };
}

module.exports = { planPhotoSlides, mayCarryPhoto, SHOWS_PHOTO };
