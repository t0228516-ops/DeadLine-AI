'use strict';
/**
 * PHOTO VISION — кандидат суреттерді vision-модель КӨЗБЕН қарап таңдайды (сипаттамасына емес, суреттің өзіне).
 *
 * Бұрынғы photoJudge тек alt/tags мәтінін оқитын: «ноутбук ұстаған жігіт» деген сипаттама жоқ сурет те, бұлыңғыр,
 * қараңғы, су таңбалы, коллаж сурет те өтіп кететін. Енді әр кандидаттың кішірейтілген нұсқасы (≈400px) слайд
 * мәтінімен бірге Gemini Flash-Lite-қа беріледі. Модель әр суретке:
 *   fit    0–10 — осы слайдтың нақты тақырыбын көрсете ме (photoJudge-тың ережесі)
 *   appeal 0–10 — әдемі ме: анық, жарық, түсі қанық, композициясы мықты, коллаж/су таңба/мәтін жоқ
 *   bg     0–10 — бүкіл слайдтың фоны бола ала ма (тек фон орны үшін маңызды)
 *   focus  "x% y%" — басты нысан қай жерде (кесілмеуі үшін)
 * қояды. fit ≥ MIN_FIT өткендер ішінен fit пен appeal-дың салмақты қосындысы ең жоғарысы алынады.
 *
 * Құны (gemini-3.5-flash-lite, $0.30 / 1M кіріс, $2.50 шығыс): ≤384px сурет ≈ 258 токен → 12 кандидат + мәтін ≈ 3.7k
 * токен + ~0.9k жауап ≈ $0.0034 ≈ 1.7₸ бір слайдқа (2.5-flash-lite жаңа кілттерге берілмейді). Кілт жоқ / қате → null: шақырушы мәтіндік photoJudge-қа өтеді.
 */
const axios = require('axios');
const { geminiJson, hasGoogleKey } = require('../../core/googleAi');
const { deepseekVisionJson } = require('../../core/llm');

/**
 * Суретті көретін модель: GOOGLE_API_KEY болса — Gemini Flash-Lite, әйтпесе DEEPSEEK_API_KEY арқылы deepseek-flash
 * (V4.1-Flash суретті көреді — бөлек кілт керек емес). PHOTO_VISION_PROVIDER=gemini|deepseek — қолмен таңдау.
 */
function visionProvider() {
  const want = String(process.env.PHOTO_VISION_PROVIDER || '').toLowerCase();
  if (want === 'deepseek') return process.env.DEEPSEEK_API_KEY ? 'deepseek' : null;
  if (want === 'gemini') return hasGoogleKey() ? 'gemini' : null;
  if (hasGoogleKey()) return 'gemini';
  return process.env.DEEPSEEK_API_KEY ? 'deepseek' : null;
}
const hasVision = () => !!visionProvider();
/** parts: [{text}] | [{image:{mime,data,url}}] → таңдалған модель → JSON */
async function visionJson(parts, opts) {
  const prov = visionProvider();
  if (prov === 'gemini') {
    return geminiJson(parts.map((p) => (p.image ? { inline_data: { mime_type: p.image.mime, data: p.image.data } } : { text: p.text })), opts);
  }
  if (prov === 'deepseek') return deepseekVisionJson(parts, opts);
  return null;
}
const { imageUA } = require('./unsplash');

// Шек (иесінің келісімі, 2026-11-06 лог талдауы): 7 күнде өткен ~100 фотоның fit=6 «жалпы сайлары» мен appeal=5 фотолары
// көбіне жалпы алмастырғыш не күңгірт болды → сай (fit ≥ 7) әрі көрікті (appeal ≥ 6). Дәл нысанның архив фотосы
// (fit ≥ 9: Абайдың ескі портреті) көріктілігі 5 болса да өтеді — ол үшін басқа фото жоқ.
const MIN_FIT = Number(process.env.PHOTO_VISION_MIN_FIT) || 7;
const MIN_APPEAL = Number(process.env.PHOTO_VISION_MIN_APPEAL) || 6;
const EXACT_FIT = 9;
const MIN_APPEAL_EXACT = Number(process.env.PHOTO_VISION_MIN_APPEAL_EXACT) || 5;
// фонға аса жарамсыз ғана (кішкентай зат, тік кадр) түседі — үстіне бәрібір күңгірт қабат қойылады
const MIN_BG = Number(process.env.PHOTO_VISION_MIN_BG) || 4;
// «жалпы сай» деңгейі (бұрын fit=6 өтетін) енді әдепкіде өшік: env арқылы ғана төмендетіледі
const MIN_FIT_GENERAL = Number(process.env.PHOTO_VISION_MIN_FIT_GENERAL) || MIN_FIT;
const MIN_APPEAL_GENERAL = 6;
const MAX_PER_CALL = Number(process.env.PHOTO_VISION_BATCH) || 12;
const THUMB_MAX_BYTES = 700_000; // музей «web» нұсқасы ~600KB; токен саны пиксельге байланысты, байтқа емес

const SYSTEM = `You are the photo editor of a student presentation. You SEE numbered candidate photos for ONE slide and score each one. Return JSON only:
{"photos":[{"i":0,"fit":0,"appeal":0,"bg":0,"focus":"50% 40%","flaw":""}, ...]} — one entry per photo, same numbers.
fit (0-10): does the photo SHOW this slide's subject? Judge the slide content, not the search query.
  10 = exactly the slide's subject: the named person, event, artwork, place, object, organism or process, or a real scene directly about it (for history: period artworks, archive photos, maps, museum objects of that subject).
  A slide about a PERSON: only a photo, painting or statue showing that person counts as 9-10; their house, grave, plaque, signature, book cover or a place named after them is 4-6.
  Judge what the photo really shows, not words it shares with the query: a desk globe is not a museum curator, an industrial warehouse is not museum storage (0-3).
  7-8 = a real scene a viewer immediately connects with this slide's point.
  4-6 = same broad field but not this slide's point.
  0-3 = generic stand-in (smiling person with laptop, handshake, office, posing students) for a specific subject; wrong country, era, species, object or person; modern reenactors for a real historical event; metaphor/decoration (light bulb, puzzle, chess, crossroads).
appeal (0-10): how beautiful and usable it is on a big screen: sharp, well exposed, vivid natural colour, clear single subject, strong composition, depth. Low (0-4): blurry, noisy, dark/murky, washed out, tiny object on blank backdrop, cluttered, collage/grid, screenshot, scanned text page, heavy caption/watermark/logo, cheesy stock pose, obvious AI artefacts.
bg (0-10): would it work as a FULL-SLIDE BACKGROUND behind a title (wide scene with calm areas)? Small object on plain background, close-up texture, portrait-format crop, busy detail everywhere → 0-3.
focus: where the main subject is, as "x% y%" (0% 0% = top-left), so cropping keeps it.
WRONG PERSON: if the photo shows a specific real, identifiable person (the caption names them, or a famous face) who is NOT the person this slide or presentation is about, fit = 0-2 and flaw = "wrong person" — viewers will take them for the subject. A slide about a general idea (e.g. women in science, a profession, a group) must not get a portrait of some other named person either.
flaw: one or two words if something is wrong (e.g. "watermark", "text", "blurry", "wrong era", "wrong country", "wrong person", "modern" for a present-day scene on a historical slide), else "".
Be strict and honest: a slide without a photo is better than a wrong or ugly photo.`;

// көретін модель өзі «басқа дәуір / басқа ел / қазіргі» деп белгілеген фото fit жоғары болса да өтпейді (1930 жылғы слайдқа қазіргі ферма)
// «modern» өздігінен тоқтатпайды (иесінің шешімі: тақырыпқа жалпы сай фото жарайды) — басқа дәуір/ел/зат, жарнама, белгі тоқтатады
const BAD_FLAW = /wrong|anachron|reenact|watermark|\bads?\b|advert|logo|stock pose|ai[- ]?generated/i;

// ақаусыз сипаттар (сапа туралы) — бас әріппен жазылса да ел/жер атауы емес
const QUALITY_FLAW = /^(blurry|dark|text|watermark|cluttered|grainy|noisy|damaged|close-?up|diagram|screenshot|cropped|small|busy|low|faded|sepia|generic|tilted|overexposed|underexposed|black and white|b&w|irrelevant)/i;
// нақты ел/дәуір туралы слайд (жыл, қазақ, кеңес, хан...) — модель «Canada», «not Kazakh» десе, ол фото өтпейді
const PLACE_SPECIFIC = /\b1[0-9]{3}\b|\b20[0-9]{2}\b|қазақ|kazakh|казах|кеңес|совет|soviet|ussr|ксро|хан\b|хандығ|khan|алматы|астана|almaty|astana|ғасыр|век\b|century/i;
function placeFlaw(flaw, specific) {
  const f = String(flaw || '').trim();
  if (!specific || !f) return false;
  if (/\bnot\s+[a-z]/i.test(f)) return true; // «not Kazakh», «not Soviet»
  return /^[A-Z][a-z]{2,}/.test(f) && !QUALITY_FLAW.test(f); // «Canada», «Alberta»
}

const short = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

// ── Бөтен адам: архив жазуы нақты адамды атаса («Barbara McClintock (1902-1992) …», «Portrait of …»), ал слайдта да,
// тақырыпта да, сұраныста да ол аталмаса — фото өтпейді: көрермен оны слайдтағы адам деп ойлайды
// (2026-11-05: «Элис Болл» презентациясының мұқабасына МакКлинтоктың фотосы fit=9 болып түскен).
// сөз: бас әріп + кіші әріппен бітеді (McClintock, O'Neil, DeWitt; «II», «USA» есім емес)
const NAME_WORD = "[A-Z][A-Za-z'’-]*[a-z]";
const NAME_RE = `${NAME_WORD}(?:\\s+(?:[A-Z]\\.|${NAME_WORD}|de|da|van|von|der|di|du|la|le|al|bin|ibn)){1,3}`;
// адам емес атаулар (оқиға, ғимарат, жер): «Great Depression (1929-1939)», «Eiffel Tower (1887–1889)»
const NOT_PERSON = new Set(('great war revolution depression empire kingdom republic dynasty era age period battle siege treaty act expedition '
  + 'tower bridge church cathedral museum university college school palace castle temple mosque monastery station building house hall '
  + 'river mountain mountains lake sea ocean island park street city square valley desert canal railway company society union party '
  + 'army navy exhibition festival games olympics olympic north south east west new old national state central '
  + 'khanate horde sultanate caliphate kazakh soviet ottoman roman mongol golden').split(' '));
const TITLE_WORDS = new Set('dr mr mrs ms sir prof professor lady lord king queen emperor empress tsar sultan khan saint st'.split(' '));
const PERSON_CAPTIONS = [
  // «Name Surname (1902-1992)», «Name Surname (c. 1850–1910)», «Name Surname (born 1950)»
  new RegExp(`(?:^|[^A-Za-z])(${NAME_RE})\\s*\\((?:(?:c|ca)\\.\\s*)?\\d{4}\\s*[-–—]\\s*(?:\\d{2,4}|present)\\s*\\)`),
  new RegExp(`(?:^|[^A-Za-z])(${NAME_RE})\\s*\\((?:born|b\\.)\\s*\\d{4}\\s*\\)`),
  // «Portrait of (Dr.) Name Surname»
  new RegExp(`\\b[Pp]ortrait\\s+of\\s+(?:(?:Dr|Mr|Mrs|Ms|Sir|Prof|Professor|Lady|Lord|King|Queen|Emperor|Tsar|Sultan|Khan)\\.?\\s+)?(${NAME_RE})`),
];
/** Архив жазуы нақты адамды атаса — сол есім, әйтпесе '' */
function captionPerson(desc) {
  const d = String(desc || '');
  for (const re of PERSON_CAPTIONS) {
    const m = d.match(re);
    if (m && !m[1].split(/\s+/).some((w) => NOT_PERSON.has(w.toLowerCase()))) return m[1].trim();
  }
  return '';
}
const CYR = { а: 'a', ә: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', қ: 'k', л: 'l', м: 'm',
  н: 'n', ң: 'ng', о: 'o', ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ұ: 'u', ү: 'u', ф: 'f', х: 'kh', һ: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', і: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya' };
/** Дыбыстық кілт: латын/кирилл жазылуы бірдей шығады (McClintock ≈ Мак-Клинток → «mklntk», Ball ≈ Болл → «bl») */
function soundKey(word) {
  let w = String(word || '').toLowerCase().replace(/[а-яёәғқңөұүһі]/g, (ch) => CYR[ch] ?? ch).replace(/[^a-z]/g, '');
  w = w.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/[cq]/g, 'k').replace(/x/g, 'ks').replace(/w/g, 'v').replace(/h/g, '');
  return w.replace(/[aeiouy]/g, '').replace(/(.)\1+/g, '$1');
}
function lev(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return row[b.length];
}
/** Есімнің бір бөлігі (тегі не аты) мәтінде аталған ба — қазақша жалғаулармен (Боллдың, Гилберттің) және
 *  транслитерация айырмасымен (Beethoven ≈ Бетховеннің: бір дыбыс айырмасы) */
function personMentioned(name, keys) {
  const parts = String(name).split(/\s+/).filter((p) => /^[A-Z][a-z]/.test(p) && !TITLE_WORDS.has(p.toLowerCase()))
    .map(soundKey).filter((k) => k.length >= 2);
  const all = [...keys];
  return parts.some((k) => keys.has(k)
    || (k.length >= 3 && all.some((c) => c.length > k.length && c.startsWith(k)))
    || (k.length >= 4 && all.some((c) => c.length >= k.length - 1 && lev(k, c.slice(0, k.length + 1)) <= 1)));
}
function contextKeys(...texts) {
  return new Set(texts.join(' ').split(/[^\p{L}'’-]+/u).flatMap((w) => w.split(/[-'’]/).concat(w)).map(soundKey).filter((k) => k.length >= 2));
}
/** desc нақты адамды атайды, бірақ слайд/тақырып/сұраныс ол туралы емес → сол адамның есімі; әйтпесе '' */
function foreignPerson(desc, keys) {
  const name = captionPerson(desc);
  return name && !personMentioned(name, keys) ? name : '';
}

// ── Кішірейтілген нұсқаларды жүктеу (кэшпен) ──
const thumbCache = new Map();
const THUMB_CACHE_MAX = 600;
async function fetchThumb(url) {
  if (!url) return null;
  if (thumbCache.has(url)) return thumbCache.get(url);
  let out = null;
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer', timeout: 8000, maxContentLength: THUMB_MAX_BYTES * 3,
      headers: { 'User-Agent': imageUA(url), Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8' },
      validateStatus: (s) => s === 200,
    });
    const type = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const buf = Buffer.from(res.data);
    if (/^image\/(jpeg|png|webp)$/.test(type) && buf.length <= THUMB_MAX_BYTES) out = { mime: type, data: buf.toString('base64') };
  } catch { /* кандидат өткізіледі */ }
  if (out) { // сәтсіздік кэштелмейді: уақытша 429/желі қатесі сол суретті мәңгі «улап» тастамасын
    thumbCache.set(url, out);
    if (thumbCache.size > THUMB_CACHE_MAX) thumbCache.delete(thumbCache.keys().next().value);
  }
  return out;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

/** Сай әрі көрікті ме (шектер жоғарыда) */
function passes(s) {
  return (s.fit >= MIN_FIT && s.appeal >= MIN_APPEAL) || (s.fit >= EXACT_FIT && s.appeal >= MIN_APPEAL_EXACT)
    || (s.fit >= MIN_FIT_GENERAL && s.appeal >= MIN_APPEAL_GENERAL);
}

/** Салмақты балл: сай болуы басты, әдемілігі екінші; фон орнында фонға жарамдылығы да қосылады */
function rankScore(s, background) {
  return s.fit * 0.6 + s.appeal * 0.4 + (background ? s.bg * 0.15 : 0);
}

function normFocus(f) {
  const m = String(f || '').match(/(\d{1,3})%?\s*[, ]\s*(\d{1,3})%?/);
  if (!m) return '';
  return Math.min(100, +m[1]) + '% ' + Math.min(100, +m[2]) + '%';
}

/**
 * @param {{topic?:string, title?:string, text?:string, query?:string, cover?:boolean, background?:boolean, maxCalls?:number}} ctx
 * @returns {null | ((cands: Array<{url:string, thumb?:string, desc?:string, source?:string}>) => Promise<Array<{i:number, fit:number, appeal:number, bg:number, focus:string, flaw:string, score:number}>|null>)}
 *   null → vision қолжетімсіз (кілт жоқ). Функция: сайлары (MIN_FIT өткен) ең жақсысы бірінші; null → шақыру сәтсіз.
 */
function makeVisionChooser(ctx = {}) {
  if (!hasVision() || process.env.PHOTO_VISION === '0') return null;
  const subject = [short(ctx.topic, 160), short(ctx.title, 140), ctx.background ? 'bg' : 'frame'].join(' / ');
  const cache = new Map(); // url → scores (осы слайд үшін)
  let calls = 0;
  let apiFailures = 0;
  const maxCalls = ctx.maxCalls || 3;
  const specific = PLACE_SPECIFIC.test([ctx.topic, ctx.title, ctx.query].filter(Boolean).join(' '));
  const ctxKeys = contextKeys(ctx.topic || '', ctx.title || '', ctx.text || '', ctx.query || '');

  async function scoreBatch(batch) {
    const thumbs = await mapLimit(batch, 6, (c) => fetchThumb(c.thumb || c.url));
    const shown = batch.map((c, k) => ({ c, t: thumbs[k] })).filter((x) => x.t);
    if (!shown.length) return;
    if (calls >= maxCalls) return;
    calls += 1;
    const parts = [{ text: SYSTEM + '\n\n'
      + `Presentation topic: ${short(ctx.topic, 200) || '-'}\n`
      + `Slide${ctx.cover ? ' (cover or closing)' : ''}: ${short(ctx.title, 160) || '-'}\n`
      + (ctx.text ? `Slide says: ${short(ctx.text, 400)}\n` : '')
      + (ctx.background ? 'Placement: the photo FILLS THE WHOLE SLIDE behind the title (bg matters).\n' : 'Placement: the photo sits in a frame next to the text.\n')
      + `Search query used: ${short(ctx.query, 160) || '-'}\n\nCandidates:` }];
    shown.forEach((x, k) => {
      parts.push({ text: `Photo ${k}${x.c.desc ? ` (archive caption: ${short(x.c.desc, 120)})` : ''}:` });
      parts.push({ image: { mime: x.t.mime, data: x.t.data, url: x.c.thumb || x.c.url } });
    });
    const out = await visionJson(parts, { label: 'photo:vision', maxTokens: 60 * shown.length + 200, timeoutMs: 25_000 });
    const rows = Array.isArray(out && out.photos) ? out.photos : (Array.isArray(out) ? out : []);
    if (!rows.length) { // шақыру сәтсіз → бағаланбады (кэшке «жоқ» деп жазылмайды)
      apiFailures += 1;
      console.warn(`[PhotoVision] "${short(ctx.title, 50)}" ${visionProvider()} gave no scores (${out ? 'keys: ' + Object.keys(out).slice(0, 4).join(',') : 'no reply'})`);
      return;
    }
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0; };
    shown.forEach((x, k) => {
      const r = rows.find((q) => q && Number(q.i) === k) || rows[k] || null;
      const sc = r ? { fit: num(r.fit), appeal: num(r.appeal), bg: num(r.bg), focus: normFocus(r.focus), flaw: short(r.flaw, 40) } : null;
      // архив жазуы басқа нақты адамды атайды → модель жоғары баға берсе де өтпейді (соңғы сақтандыруда да)
      const who = sc && foreignPerson(x.c.desc, ctxKeys);
      if (who) {
        console.log(`[PhotoVision] "${short(ctx.title, 50)}" fit ${sc.fit}→1: caption names another person (${short(who, 40)})`);
        sc.fit = Math.min(sc.fit, 1); sc.flaw = 'wrong person';
      }
      cache.set(x.c.url, sc);
    });
    const best = shown.map((x) => ({ x, s: cache.get(x.c.url) })).filter((y) => y.s).sort((a, b) => rankScore(b.s, ctx.background) - rankScore(a.s, ctx.background))[0];
    console.log(`[PhotoVision] "${short(ctx.title, 50)}" ${ctx.background ? 'bg' : 'frame'} n=${shown.length} `
      + `fit=[${shown.map((x) => (cache.get(x.c.url) || {}).fit ?? '-').join(',')}] `
      + (best ? `best=${best.x.c.source || ''} fit=${best.s.fit} appeal=${best.s.appeal}${best.s.flaw ? ' flaw=' + best.s.flaw : ''}` : 'best=none'));
  }

  async function choose(cands) {
    if (!Array.isArray(cands) || !cands.length) return [];
    const todo = cands.filter((c) => c && c.url && !cache.has(c.url));
    for (let k = 0; k < todo.length && calls < maxCalls; k += MAX_PER_CALL) {
      try { await scoreBatch(todo.slice(k, k + MAX_PER_CALL)); } catch (err) { console.warn(`[PhotoVision] failed: ${err.message}`); }
    }
    // API шынымен сәтсіз болып, бірде-біреуі бағаланбаса ғана → резерв (мәтіндік тексеру). Кішірейтілген нұсқа
    // жүктелмесе не шақыру шегі бітсе — «сай сурет жоқ» ([]), vision-мен жұмыс істеп тұрған слайд резервке түспейді.
    if (apiFailures && todo.length && todo.every((c) => !cache.has(c.url))) return null;
    return cands
      .map((c, i) => ({ i, s: cache.get(c.url) }))
      .filter((x) => x.s && (!ctx.background || x.s.bg >= MIN_BG) && !BAD_FLAW.test(x.s.flaw || '') && !placeFlaw(x.s.flaw, specific)
        && passes(x.s))
      // дәл сай (fit ≥ MIN_FIT) алдымен, жалпы сайлар — тек солардан кейін
      .map((x) => ({ i: x.i, ...x.s, exact: x.s.fit >= MIN_FIT, score: rankScore(x.s, ctx.background) }))
      .sort((a, b) => (b.exact - a.exact) || b.score - a.score || a.i - b.i);
  }
  choose.scoreOf = (c) => (c && cache.has(c.url) ? cache.get(c.url) : null);
  choose.calls = () => calls;
  return choose;
}

/**
 * Жасалған (AI) суретті тексеру: слайдқа сай ма, бұрмаланған мәтін/қол/бет жоқ па.
 * @returns {Promise<{ok:boolean, fit:number, appeal:number, flaw:string}|null>}
 */
async function checkGenerated(dataUri, ctx = {}) {
  if (!hasVision()) return null;
  const m = String(dataUri || '').match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return null;
  const parts = [
    { text: `${SYSTEM}\n\nThis photo was AI-generated for the slide below. Also set "flaw" to "text" if it contains any letters/words/numbers, "artefact" for distorted hands/faces/objects or melted details, "fake" if it looks obviously artificial.\n`
      + `Presentation topic: ${short(ctx.topic, 200) || '-'}\nSlide: ${short(ctx.title, 160) || '-'}\n${ctx.text ? `Slide says: ${short(ctx.text, 400)}\n` : ''}Photo 0:` },
    { image: { mime: m[1], data: m[2] } },
  ];
  const out = await visionJson(parts, { label: 'photo:gen-check', maxTokens: 200 });
  const r = Array.isArray(out && out.photos) ? out.photos[0] : null;
  if (!r) return null;
  const fit = Number(r.fit) || 0; const appeal = Number(r.appeal) || 0; const flaw = short(r.flaw, 40);
  return { ok: fit >= MIN_FIT && appeal >= 6 && !/text|artefact|artifact|fake/i.test(flaw), fit, appeal, flaw };
}

module.exports = { visionProvider, makeVisionChooser, checkGenerated, rankScore, normFocus, fetchThumb, SYSTEM, MIN_FIT, BAD_FLAW, placeFlaw,
  captionPerson, soundKey, contextKeys, foreignPerson, passes, MIN_APPEAL };
