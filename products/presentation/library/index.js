'use strict';
/**
 * ШАБЛОН КІТАПХАНАСЫ (SlidesCarnival — жазбаша рұқсатпен, шарттары: docs/slidescarnival-permission.md).
 *
 * Шарттар кодта сақталады:
 *  - студентке тек өңделетін .pptx бот арқылы беріледі (бос шаблон, галерея, жүктеу беті жоқ);
 *  - әр презентацияның соңында түпнұсқа Credits слайды (slidescarnival.com сілтемесімен) ӨЗГЕРІССІЗ тұрады;
 *  - шаблон файлдары git-ке салынбайды: бірінші қолданғанда сайттан жүктеліп, серверде (LIBRARY_DIR) сақталады.
 *
 * prepareDeck → { id, deckBuf, creditsBuf, creditsIdx } : deckBuf шаблон режиміне беріледі, толтырылған соң
 * appendCredits(filledBuf, prep) Credits слайдын қосады.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { carveDeck, appendSlideFrom } = require('./carve');
const CATALOG = require('./slidescarnival.json');

const LIB_DIR = process.env.LIBRARY_DIR || path.join(process.env.JOBS_DIR || os.tmpdir(), 'library');
const MAX_DECK_BYTES = (Number(process.env.LIBRARY_MAX_MB) || 45) * 1024 * 1024; // Telegram бот файлы ~50 МБ

const GROUP_RE = {
  history: /тарих|хандық|хандығ|ғасыр|соғыс|ұжымдастыр|ашаршылық|археолог|көне|ежелгі|империя|история|историческ|войн|век[аеу]?\b|ханств|археолог|древн|history|historical|war\b|century|empire|ancient|archaeolog/i,
  science: /физика|химия|биолог|медицин|ағза|ауру|дәрі|жасуша|генетик|технолог|ақпарат|компьютер|бағдарлама|алгоритм|инженер|математик|статистик|электр|транзистор|энерги|хими|физик|медиц|болезн|клетк|технолог|информ|программ|алгоритм|инженер|математ|science|physics|chemistry|biology|medic|health|technolog|computer|software|algorithm|engineer|math/i,
  education: /білім|сабақ|мектеп|педагог|оқыту|оқушы|студент|университет|тәрбие|образован|школ|урок|педагог|обучени|студент|университет|воспитан|education|school|teaching|learning|student|university/i,
  philosophy: /философ|ойшыл|этика|психолог|мәдениет|өнер|әдебиет|философ|психолог|этик|культур|искусств|литератур|philosoph|ethic|psycholog|culture|art\b|literature/i,
};

// Пән: әшекейі пәнге байланған шаблон (subjects) тек сол пәндегі тақырыпқа таңдалады — әшекейлер сақталады, бірақ орынсыз шықпайды
const L = '(?<!\\p{L})';   // сөз басы (кирилл үшін \\b жұмыс істемейді)
const SUBJECT_RE = {
  medicine: new RegExp(`${L}(медицин|дәрігер|ауру|емдеу|денсаулық|вирус|вакцин|хирург|фармац|врач|болезн|лечен|здоров|medic|health|disease|doctor|vaccin|virus|surger)`, 'iu'),
  biology: new RegExp(`${L}(биолог|жасуша|өсімдік|жануар|генетик|ағза|ботаник|зоолог|клетк|растен|животн|генет|организм|biolog|cell|plant|animal|gene|organism|botan|zoolog)`, 'iu'),
  space: new RegExp(`${L}(ғарыш|планета|жұлдыз|астроном|комета|галактик|күн жүйесі|космос|планет|звезд|галакт|space|planet|star|astronom|galax|comet|cosmos)`, 'iu'),
  ecology: new RegExp(`${L}(эколог|қоршаған орта|ластану|климат|табиғат|қоқыс|экожүйе|окружающ|загрязн|природ|ecolog|environment|pollution|climate|nature|waste)`, 'iu'),
  it: new RegExp(`${L}(ақпараттық|компьютер|бағдарлама|интернет|цифрлы|жасанды интеллект|робот|киберқауіпсіз|информац|программ|цифров|искусственн|кибер|computer|software|programming|internet|digital|artificial intelligence|robot|cyber)`, 'iu'),
  psychology: new RegExp(`${L}(психолог|эмоция|стресс|тұлға|мінез-құлық|эмоци|личност|psycholog|emotion|stress|mental|personality)`, 'iu'),
  literature: new RegExp(`${L}(әдебиет|ақын|жазушы|роман|өлең|поэма|шығарма|литератур|поэт|писател|стихотвор|literatur|poet|novel|poem|writer)`, 'iu'),
  geography: new RegExp(`${L}(географ|материк|мұхит|урбаниз|қала құрылыс|океан|geograph|continent|ocean|urban)`, 'iu'),
};

/** Тақырыптың пәндері (бірнеше болуы мүмкін, жоқ болса — бос) */
function topicSubjects(topic) {
  const t = String(topic || '');
  return Object.keys(SUBJECT_RE).filter((k) => SUBJECT_RE[k].test(t));
}

const byId = new Map(CATALOG.templates.map((t) => [t.id, t]));

/** Тақырыптың топтары (бірнешеуі болуы мүмкін); ешқайсысы сай келмесе — ['general'] */
function topicGroups(topic) {
  const t = String(topic || '');
  const g = Object.keys(GROUP_RE).filter((k) => GROUP_RE[k].test(t));
  return g.length ? g : ['general'];
}

/**
 * Шаблон таңдау: тақырып тобына сай (пәнге байланған шаблон — тек сол пәнге), студенттің соңғы кітапхана шаблондарынан (avoid) өзгеше.
 * @param {{topic?:string, avoid?:string[], rng?:()=>number}} o
 */
function chooseTemplate(o = {}) {
  const rng = o.rng || Math.random;
  const groups = topicGroups(o.topic);
  const subjects = topicSubjects(o.topic);
  const avoid = new Set(o.avoid || []);
  // пәнге байланған шаблон тек сол пәнге; қалғаны — тақырып тобы бойынша
  const usable = CATALOG.templates.filter((t) => !t.subjects || t.subjects.some((x) => subjects.includes(x)));
  const fit = usable.filter((t) => (t.subjects ? true : t.groups.some((g) => groups.includes(g))));
  const pool = (fit.length ? fit : usable.filter((t) => t.groups.includes('general')));
  const fresh = pool.filter((t) => !avoid.has(t.id));
  // пәні дәл сай шаблон (әшекейі тақырыпқа қатысты) — бірінші кезекте (LIBRARY_SUBJECT_SHARE, әдепкі — әрқашан)
  const exact = fresh.filter((t) => t.subjects);
  const share = process.env.LIBRARY_SUBJECT_SHARE == null || process.env.LIBRARY_SUBJECT_SHARE === '' ? 1 : Number(process.env.LIBRARY_SUBJECT_SHARE);
  if (exact.length && rng() < share) return exact[Math.floor(rng() * exact.length) % exact.length];
  // гүл/қағаз әшекейлі шаблон (decor) тек мектеп, өнер, мәдениет тақырыбына; пәні анық (ЖИ, медицина) не белгісіз тақырыпқа — бейтарап шаблон
  const decorOk = !subjects.length && groups.some((g) => g === 'education' || g === 'philosophy');
  const plain = decorOk ? fresh : fresh.filter((t) => !t.decor);
  const list = plain.length ? plain : fresh.length ? fresh : pool;
  return list[Math.floor(rng() * list.length) % list.length];
}

/**
 * Слайд реті: мұқаба → (мазмұн) → мәтін слайдтары (бір макет қатар келмейді; бір сан мен бір дәйексөз ортасына) → қорытынды.
 * @param {object} t каталог жазбасы
 * @param {number} n слайд саны (Credits-ті қоспағанда)
 * @returns {number[]} 0-негізді слайд нөмірлері
 */
function planPicks(t, n) {
  const N = Math.max(4, Math.min(20, Math.round(n) || 10));
  const head = [t.cover];
  if (t.agenda && N >= 7) head.push(t.agenda);
  const tail = t.closing ? [t.closing] : [];
  const m = Math.max(1, N - head.length - tail.length);
  const middle = [];
  const text = t.text.length ? t.text : t.section;
  const extras = [];
  if (t.stats.length && m >= 4) extras.push({ at: Math.floor(m / 2), slide: t.stats[0] });
  if (t.quote.length && m >= 6) extras.push({ at: m - 1, slide: t.quote[0] });
  if (t.section.length && m >= 8) extras.push({ at: Math.floor(m / 3), slide: t.section[0] });
  let k = 0;
  for (let i = 0; i < m; i++) {
    const ex = extras.find((e) => e.at === i && !e.used);
    if (ex) { ex.used = true; middle.push(ex.slide); continue; }
    let s = text[k % text.length];
    if (middle.length && middle[middle.length - 1] === s && text.length > 1) { k++; s = text[k % text.length]; }
    middle.push(s); k++;
  }
  return head.concat(middle, tail).map((x) => x - 1);
}

/** Каталог бойынша слайдтың рөлі ('cover','agenda','section','text','stats','quote','closing') */
function roleOf(t, slide) {
  if (slide === t.cover) return 'cover';
  if (slide === t.agenda) return 'agenda';
  if (slide === t.closing) return 'closing';
  for (const r of ['section', 'stats', 'quote', 'text']) if ((t[r] || []).includes(slide)) return r;
  return 'text';
}

function filePath(id) { return path.join(LIB_DIR, `${id}.pptx`); }

/** Шаблонды серверден не SlidesCarnival-дан (бір рет) алу */
async function fetchTemplate(t, o = {}) {
  const fp = filePath(t.id);
  try { const st = fs.statSync(fp); if (st.size > 10000) return fs.readFileSync(fp); } catch {}
  const url = `${CATALOG.site}/download/${t.id}/${t.slug}/pptx`;
  const res = await (o.http || axios).get(url, {
    responseType: 'arraybuffer', timeout: 120000, maxContentLength: 90 * 1024 * 1024, maxRedirects: 5,
    headers: { 'User-Agent': 'Mozilla/5.0 (DeadLine presentation bot; licensed use)' },
  });
  const buf = Buffer.from(res.data);
  if (buf.length < 10000 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error(`library: ${t.id} жүктелмеді (pptx емес)`);
  try { fs.mkdirSync(LIB_DIR, { recursive: true }); fs.writeFileSync(fp, buf); } catch (e) { console.warn(`[Library] cache write: ${e.message}`); }
  return buf;
}

/**
 * Толтыруға дайын кесілген шаблон.
 * @param {{topic?:string, slideCount?:number, avoid?:string[], id?:string, rng?:()=>number, http?:object, brief?:string, language?:string, llm?:Function, arrange?:boolean}} o
 */
async function prepareDeck(o = {}) {
  const fixed = o.entry || (o.id && byId.get(o.id));
  const t = fixed || chooseTemplate(o);
  const src = await fetchTemplate(t, o);
  const want = Math.max(4, Math.min(20, Number(o.slideCount) || 10));
  let n = want;
  let deckBuf = null; let creditsBuf = null; let picks = null;
  // Мазмұнға қарай макет: LLM алдымен мазмұнды жоспарлайды, слайдтар соның формасына сай таңдалады (library/arrange.js)
  let arranged = o.arrange === false ? null : await require('./arrange').arrange({
    src, t, n: want, topic: o.topic, brief: o.brief, language: o.language, llm: o.llm, dir: LIB_DIR,
  }).catch(() => null);
  if (arranged) {
    picks = arranged.picks;
    creditsBuf = carveDeck(src, picks.concat([t.credits - 1]));
    if (creditsBuf.length > MAX_DECK_BYTES) { console.log(`[Library] ${t.id}: arranged deck too large — default order`); arranged = null; }
  }
  // файл тым үлкен болса (ауыр фон суреттері) слайд азаяды
  for (let tries = 0; !arranged && tries < 4; tries++) {
    picks = planPicks(t, n);
    creditsBuf = carveDeck(src, picks.concat([t.credits - 1]));
    if (creditsBuf.length <= MAX_DECK_BYTES || n <= 5) break;
    n = Math.max(5, n - 3);
  }
  // ауыр шаблон сұралған слайд санын бере алмаса — студент аз слайд алмасын, басқа шаблон таңдалады
  if (picks.length < want && !fixed && (o.tries || 0) < 3) {
    console.log(`[Library] ${t.id}: ${want} slides would exceed ${(MAX_DECK_BYTES / 1048576).toFixed(0)}MB — another template`);
    return prepareDeck({ ...o, avoid: [...(o.avoid || []), t.id], tries: (o.tries || 0) + 1 });
  }
  // Credits-сіз нұсқа — толтыруға; мәтін оқылатын етіледі (кегль, контраст, әшекейден арақашықтық)
  deckBuf = carveDeck(creditsBuf, picks.map((_, i) => i));
  if (process.env.LIBRARY_READABLE !== '0') { try { deckBuf = require('./readable').makeReadable(deckBuf); } catch (e) { console.warn(`[Library] readable skipped: ${e.message}`); } }
  console.log(`[Library] ${t.id} (${t.style}) ← «${String(o.topic || '').slice(0, 50)}» groups=${topicGroups(o.topic).join(',')} slides=${picks.length}+credits ${(creditsBuf.length / 1e6).toFixed(1)}MB`);
  return { id: t.id, style: t.style, swapPhotos: t.swapPhotos !== false, keepMedia: t.keepMedia || [], slideCount: picks.length, deckBuf, creditsBuf, creditsIdx: picks.length,
    outline: arranged ? arranged.outline : null, roles: picks.map((p) => roleOf(t, p + 1)) };
}

const SITE_URL = 'https://www.slidescarnival.com';
const HLINK_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

/**
 * Credits слайдында slidescarnival.com-ға СІЛТЕМЕ болуы — рұқсаттың шарты. Көп шаблонда «SlidesCarnival» тек сөз не логотип,
 * сілтемесіз. Сондықтан: бар «SlidesCarnival» сөзіне сілтеме қосылады және слайдтың астына кішкентай «www.slidescarnival.com»
 * сілтемесі жазылады. Слайдтың қалған мазмұны өзгермейді.
 */
function linkCredits(buf, idx) {
  const { readZipAll, writeZipAll } = require('../templateFill');
  const { orderedSlides } = require('../../../design-dna/structure');
  const files = readZipAll(buf);
  const all = orderedSlides(files);
  const sp = all[idx < 0 ? all.length + idx : idx]; // -1 — соңғы слайд
  if (!sp) return buf;
  const rp = sp.replace(/([^/]+)$/, '_rels/$1.rels');
  let rels = files.get(rp) || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const rid = 'rIdDlScLink';
  if (!rels.includes(`Id="${rid}"`)) rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="${HLINK_TYPE}" Target="${SITE_URL}" TargetMode="External"/></Relationships>`);
  let xml = files.get(sp);
  // бар «SlidesCarnival» сөзі сілтемеге айналады (әр <a:r> бөлек қаралады — көрші жолдарға тимейді)
  xml = xml.replace(/<a:r>(?:(?!<\/a:r>)[\s\S])*?<\/a:r>/g, (run) => {
    if (!/<a:t>[^<]*Slides ?Carnival/i.test(run) || /hlinkClick/.test(run)) return run;
    const link = `<a:hlinkClick r:id="${rid}"/>`;
    if (/<a:rPr\b[^>]*\/>/.test(run.slice(0, run.indexOf('<a:t>')))) return run.replace(/<a:rPr\b([^>]*?)\/>/, `<a:rPr$1>${link}</a:rPr>`);
    if (/<a:rPr\b/.test(run)) return run.replace(/(<a:hlinkMouseOver\b|<a:rtl\b|<a:extLst>|<\/a:rPr>)/, `${link}$1`); // схема реті: hlinkClick — extLst алдында
    return run.replace('<a:r>', `<a:r><a:rPr lang="en-US">${link}</a:rPr>`);
  });
  if (!/www\.slidescarnival\.com/i.test(xml)) {
    const { W, H } = require('./photos').slideSize(files);
    const color = (xml.match(/<a:rPr\b[^>]*>\s*<a:solidFill>\s*<a:srgbClr val="([0-9A-Fa-f]{6})"/) || [])[1] || '808080';
    const id = Math.max(1000, ...[...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((x) => +x[1])) + 1;
    const box = `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="SlidesCarnival link"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
      + `<p:spPr><a:xfrm><a:off x="${Math.round(W * 0.66)}" y="${Math.round(H * 0.935)}"/><a:ext cx="${Math.round(W * 0.31)}" cy="${Math.round(H * 0.045)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>`
      + '<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:noAutofit/></a:bodyPr><a:lstStyle/>'
      + `<a:p><a:pPr algn="r"/><a:r><a:rPr lang="en-US" sz="${Math.round(1100 * W / 12192000 / 100) * 100}" u="sng"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/><a:hlinkClick r:id="${rid}"/></a:rPr><a:t>www.slidescarnival.com</a:t></a:r></a:p></p:txBody></p:sp>`;
    xml = xml.replace(/<\/p:spTree>/, `${box}</p:spTree>`);
  }
  files.set(sp, xml);
  files.set(rp, rels);
  return writeZipAll(files);
}

/** Толтырылған колодаға түпнұсқа Credits слайдын қосу (атрибуция мен slidescarnival.com сілтемесі — рұқсаттың міндетті шарты) */
function appendCredits(filledBuf, prep) {
  const out = appendSlideFrom(filledBuf, prep.creditsBuf, prep.creditsIdx);
  return linkCredits(out, -1);
}

/**
 * Кітапхана кімге: LIBRARY_MODE = off | testers | all (әдепкі testers — иесі «топ» деп бекіткенше тек тестер/админ).
 * LIBRARY_SHARE (0..1, әдепкі 0.5) — рұқсаты барлардың қанша бөлігі кітапхана шаблонын алады (қалғаны — өз қозғалтқышымыз).
 */
function eligible(o = {}, env = process.env, rng = Math.random) {
  const mode = String(env.LIBRARY_MODE || 'testers').toLowerCase();
  if (mode === 'off' || mode === '0') return false;
  if (mode !== 'all' && !o.tester && !o.admin) return false;
  const share = env.LIBRARY_SHARE == null || env.LIBRARY_SHARE === '' ? 0.5 : Math.max(0, Math.min(1, Number(env.LIBRARY_SHARE)));
  return rng() < share;
}

module.exports = { CATALOG, linkCredits, topicGroups, topicSubjects, SUBJECT_RE, chooseTemplate, planPicks, prepareDeck, appendCredits, eligible, fetchTemplate, LIB_DIR };
