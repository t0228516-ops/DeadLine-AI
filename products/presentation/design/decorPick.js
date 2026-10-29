'use strict';
/**
 * БОС ОРЫНҒА ӘШЕКЕЙ — кітапханадан (assets/library + assets/decor) слайд мағынасына сай зат.
 *
 * Бұрын әшекей сөз тізімімен (decor.js THEMES) табылатын және тек ескі макеттерге қойылатын: құрастырылған
 * композициялардың (cx-*) бос бұрыштары бос қалатын. Енді:
 *   1) колодаға БІР DeepSeek сұрауы: тақырыптар каталогы (≈300 гравюра тақырыбы, ою, doodle) + слайд мәтіндері →
 *      әр слайдқа бір зат не null («сай зат жоқ» — әлсіз сәйкестіктен жақсы);
 *   2) код файлды таңдайды (колодада қайталанбайды) → slide.decorPick;
 *   3) орнын рендер өлшейді (decor.placeDecor): мәтінге, суретке, түсті пішінге тимейтін бос бұрыш; жоқ болса — алынады.
 * Кілт жоқ / қате → ештеңе өзгермейді (бұрынғы әшекей жолы).
 */
const fs = require('fs');
const path = require('path');

const A = path.join(__dirname, '..', 'assets');
const LIB = path.join(A, 'library');

// Жүйенің сипатына сай әшекей түрі: классикалық жүйелер — гравюра; «Мұра» — гравюра + қазақ оюы;
// ойнақы жүйелер — doodle. Қалғандары (swiss, mono, numbers, blueprint, ledger) — әшекейсіз (өз белгішелері бар).
const KINDS = {
  heritage: ['engraving', 'ornament'],
  journal: ['engraving'],
  academy: ['engraving'],
  atelier: ['engraving'],
  campus: ['doodle'],
  aurora: ['doodle'],
};

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const slug = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

let CAT = null;
/** Каталог: id → { id, kind, label, files[] } (гравюралар тақырыбы бойынша топталады) */
function catalogue() {
  if (CAT) return CAT;
  CAT = new Map();
  const add = (id, kind, label, file) => {
    if (!fs.existsSync(file)) return;
    if (!CAT.has(id)) CAT.set(id, { id, kind, label, files: [] });
    CAT.get(id).files.push(file);
  };
  const eng = readJson(path.join(LIB, 'engravings', 'index.json')) || {};
  Object.entries(eng)
    .sort((a, b) => (b[1].quality || 0) - (a[1].quality || 0))
    .forEach(([f, v]) => {
      const subj = String(v.subject || '').trim().toLowerCase();
      // шетіне дейін толы пейзаж/көрініс бұрышта «жапсырылған фото» болып көрінеді — әшекейге тек жеке зат
      if (!subj || v.scene) return;
      const kk = (v.tags_kk || [])[0];
      add('e:' + slug(subj), 'engraving', subj + (kk ? ' / ' + kk : ''), path.join(LIB, 'engravings', f));
    });
  // ескі жинақ (мұқият таңдалған натюрморт заттары + қазақ белгілері: домбыра, шаңырақ, киіз үй…)
  const old = readJson(path.join(A, 'decor', 'index.json')) || {};
  Object.entries(old).forEach(([f, v]) => {
    const tag = String((v && v.tag) || '').trim();
    if (!tag) return;
    const kz = /^kz-/.test(f);
    add((kz ? 'k:' : 'e:') + slug(kz ? f.replace(/\.svg$/, '') : tag), kz ? 'ornament' : 'engraving',
      kz ? 'Kazakh symbol: ' + f.replace(/^kz-|\.svg$/g, '') : tag, path.join(A, 'decor', f));
  });
  const orn = readJson(path.join(LIB, 'ornaments', 'index.json')) || {};
  Object.entries(orn).forEach(([f, v]) => {
    if (v.kind !== 'medallion' && v.kind !== 'corner') return; // бос бұрышқа тек медальон мен бұрыш ою жарасады
    add('o:' + v.kind, 'ornament', 'Kazakh ornament ' + v.kind + ' (ою-өрнек)', path.join(LIB, 'ornaments', f));
  });
  const dd = readJson(path.join(LIB, 'doodles', 'index.json')) || {};
  Object.entries(dd).forEach(([f, v]) => {
    const tags = (v.tags || []).filter((t) => !/^(people|doodle)$/.test(t));
    add('d:' + f.replace(/\.svg$/, ''), 'doodle', 'person ' + tags.join(', '), path.join(LIB, 'doodles', f));
  });
  return CAT;
}

/** Әшекей жарамайтын слайд: фото фон, кесте/инфографика, әдебиеттер, мәтінсіз */
function eligible(s, i, n) {
  if (!s || typeof s !== 'object') return false;
  if (s.webImageUrl || s.imageUrl) return false;
  if (s.table || s.infographic || s.visualSvg) return false;
  if (i === n - 1 && /әдебиет|дереккөз|литератур|источник|reference|bibliograph/i.test(String(s.title || ''))) return false;
  return !!String(s.title || '').trim();
}
const brief = (s) => {
  const b = (Array.isArray(s.bullets) ? s.bullets : []).slice(0, 3).map((x) => (typeof x === 'string' ? x : (x && (x.label || x.text)) || '')).join('; ');
  return (String(s.title || '') + (s.subtitle ? ' — ' + s.subtitle : '') + (b ? ' | ' + b : '') + (s.body ? ' | ' + s.body : '')).replace(/\s+/g, ' ').slice(0, 260);
};

const SYSTEM = `You add ONE small decorative illustration to some presentation slides (it fills an empty corner, like a vintage engraving in a book margin).
For each slide choose an item id from the CATALOGUE whose subject is clearly about the slide's meaning — the literal object discussed, or a widely understood symbol of it (scales → law, quill → literature, mounted archer → nomad warfare, globe → geography).
Rules:
- If no catalogue subject clearly fits the slide, answer null. A weak or generic match is worse than nothing.
- Never pick something that contradicts the topic (European knight or a jeweled European crown/tiara for Kazakh khans, Egyptian temple for a Kazakh khanate, a ship for a steppe topic).
- Kazakh ornament / Kazakh symbol items only for slides about Kazakh history, culture, traditions, literature or people.
- No figurative metaphors: a word used figuratively is not its object ("heart/core of the personality" is not an anatomical heart, "communication" is not a telephone, "engine of progress" is not a machine). Body parts and organs only for medicine/biology slides; tools and machines only when the slide is about that technology.
- Each id at most once per deck. At most MAX slides get an item; prefer slides whose text names a concrete object.
- The slide text may be in Kazakh, Russian or English; the catalogue is in English (some with a Kazakh word).
Return JSON: {"picks":[{"slide":<number>,"id":"<catalogue id>"|null}]}`;

/**
 * Колодаға әшекей таңдайды: slide.decorPick = { file, kind, id } не null («сай зат жоқ»).
 * @returns {Promise<{asked:number, picked:number}>}
 */
async function pickDeckDecor(slides, opts = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const system = opts.system || (list[0] && list[0].composition && list[0].composition.design) || '';
  const kinds = KINDS[system];
  if (!kinds || process.env.DECOR_PICK === '0' || !process.env.DEEPSEEK_API_KEY) return { asked: 0, picked: 0 };
  const cat = [...catalogue().values()].filter((c) => kinds.includes(c.kind));
  const idx = list.map((s, i) => (eligible(s, i, list.length) ? i : -1)).filter((i) => i >= 0);
  if (!cat.length || !idx.length) return { asked: 0, picked: 0 };
  const max = Math.max(2, Math.round(idx.length * 0.5));
  const user = 'CATALOGUE (id — subject):\n' + cat.map((c) => c.id + ' — ' + c.label).join('\n') +
    '\n\nMAX = ' + max + '\nDECK TOPIC: ' + String(opts.topic || (list[0] && list[0].title) || '').slice(0, 160) +
    '\n\nSLIDES:\n' + idx.map((i) => (i + 1) + '. ' + brief(list[i])).join('\n');
  const call = opts.llm || require('../../../core/llm').deepseekJson;
  let res;
  try { res = await call(SYSTEM.replace('MAX slides', max + ' slides'), user, 'decor-pick', 0, { timeoutMs: 40_000 }); } catch (e) {
    console.warn('[Decor] pick failed: ' + e.message);
    return { asked: idx.length, picked: 0 };
  }
  const byId = new Map(cat.map((c) => [c.id, c]));
  const usedIds = new Set(); const usedFiles = new Set(); let picked = 0;
  idx.forEach((i) => { list[i].decorPick = null; }); // модель көрді: таңдамаса — «сай зат жоқ»
  const picks = (res && Array.isArray(res.picks) ? res.picks : [])
    .map((p) => ({ i: Number(p && p.slide) - 1, id: p && typeof p.id === 'string' ? p.id.trim() : null }))
    .filter((p) => idx.includes(p.i) && p.id && byId.has(p.id))
    .sort((a, b) => a.i - b.i);
  for (const p of picks) {
    // ырғақ (қатарынан үш слайдта әшекей болмасын) — html3DBuilder-де: өз суреті бар композицияға әшекей түспейді,
    // оны тек салу кезінде білеміз
    if (picked >= max || usedIds.has(p.id)) continue;
    const c = byId.get(p.id);
    const file = c.files.find((f) => !usedFiles.has(f));
    if (!file) continue;
    usedIds.add(p.id); usedFiles.add(file);
    list[p.i].decorPick = { file, kind: c.kind, id: c.id };
    picked++;
  }
  console.log('[Decor] ' + system + ': ' + picked + '/' + idx.length + ' slides got a library decor (' + picks.map((p) => (p.i + 1) + ':' + p.id).join(' ') + ')');
  return { asked: idx.length, picked };
}

const uriCache = new Map();
/** Әшекей → data URI. Ою мен doodle палитраның түсіне боялады. */
function decorPickUri(pick, color) {
  if (!pick || !pick.file) return '';
  const key = pick.file + '|' + (color || '');
  if (uriCache.has(key)) return uriCache.get(key);
  let uri = '';
  try {
    if (/\.svg$/i.test(pick.file)) {
      let svg = fs.readFileSync(pick.file, 'utf8');
      // ою — currentColor; Open Doodles — қызғылт реңктер: екеуі де палитраның акцент түсіне боялады
      if (color) svg = svg.replace(/currentColor/g, color).replace(/#(CF536D|FF788F|FF5678|FFB3B3)\b/gi, color);
      uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    } else {
      uri = 'data:image/webp;base64,' + fs.readFileSync(pick.file).toString('base64');
    }
  } catch { /* файл жоқ */ }
  uriCache.set(key, uri);
  return uri;
}

module.exports = { pickDeckDecor, decorPickUri, catalogue, eligible, KINDS };
