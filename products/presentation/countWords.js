'use strict';
/**
 * Тақырыптағы сан сөзі («төрт сала», «три этапа», «five steps») слайдтағы элемент санымен сәйкес пе.
 * Шаблонда 3 карточка тұрса, «ЖИ төрт саланы өзгертіп жатыр» деген тақырып қате — сан түзетіледі.
 *
 *   countIn(text)          → тақырыпта аталған сан (2–9) не null
 *   setCount(text, n)      → сан сөзі n-ге ауыстырылған мәтін (сөздің түрі мен бас әрпі сақталады)
 */

// әр тілдегі сан сөздері: [қалыпты түрі, ...басқа түрлері] — бір индекстегі түрлер бір септікте
const KK = { 2: ['екі'], 3: ['үш'], 4: ['төрт'], 5: ['бес'], 6: ['алты'], 7: ['жеті'], 8: ['сегіз'], 9: ['тоғыз'] };
// орыс: [номинатив (м.р./ср.р.), номинатив (ж.р.), генитив, датив/предл., творит.]
const RU = {
  2: ['два', 'две', 'двух', 'двум', 'двумя'], 3: ['три', 'три', 'трёх', 'трём', 'тремя'], 4: ['четыре', 'четыре', 'четырёх', 'четырём', 'четырьмя'],
  5: ['пять', 'пять', 'пяти', 'пяти', 'пятью'], 6: ['шесть', 'шесть', 'шести', 'шести', 'шестью'], 7: ['семь', 'семь', 'семи', 'семи', ''],   // «семью» — «семья» сөзімен шатасады
  8: ['восемь', 'восемь', 'восьми', 'восьми', 'восемью'], 9: ['девять', 'девять', 'девяти', 'девяти', 'девятью'],
};
const EN = { 2: ['two'], 3: ['three'], 4: ['four'], 5: ['five'], 6: ['six'], 7: ['seven'], 8: ['eight'], 9: ['nine'] };

const norm = (w) => w.toLowerCase().replace(/ё/g, 'е');
const index = new Map();   // сөз → { n, lang, form }
for (const [lang, table] of [['kk', KK], ['ru', RU], ['en', EN]]) {
  for (const [n, forms] of Object.entries(table)) forms.forEach((f, form) => { if (f && !index.has(norm(f))) index.set(norm(f), { n: +n, lang, form }); });
}
const WORD = /[\p{L}]+|\d+/gu;

function lookup(w) {
  if (/^\d+$/.test(w)) { const n = +w; return n >= 2 && n <= 9 ? { n, lang: 'digit', form: 0 } : null; }
  return index.get(norm(w)) || null;
}

/** Тақырыпта аталған элемент саны (2–9) не null. Бірнеше сан болса (жыл, «екі-үш») — сенімсіз, null. */
function countIn(text) {
  const found = [];
  for (const m of String(text || '').matchAll(WORD)) { const x = lookup(m[0]); if (x) found.push(x.n); }
  return found.length === 1 ? found[0] : null;
}

function caseOf(src, word) {
  if (src === src.toUpperCase() && src !== src.toLowerCase()) return word.toUpperCase();
  if (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return word[0].toUpperCase() + word.slice(1);
  return word;
}

/** Сан сөзін n-ге ауыстыру (тек жалғыз сан сөзі болса). n 2–9 емес, сан жоқ не грамматика бұзылатын болса — мәтін өзгермейді. */
function setCount(text, n) {
  const s = String(text || '');
  if (countIn(s) == null || !(n >= 2 && n <= 9)) return s;
  return s.replace(WORD, (w) => {
    const x = lookup(w);
    if (!x) return w;
    if (x.lang === 'digit') return String(n);
    // орысша «четыре этапа» → «пять этапа» болмайды: зат есімнің түрі өзгеретін ауыстыру жасалмайды
    if (x.lang === 'ru' && x.form <= 1 && (x.n <= 4) !== (n <= 4)) return w;
    const table = x.lang === 'kk' ? KK : x.lang === 'ru' ? RU : EN;
    const forms = table[n];
    let out = forms[Math.min(x.form, forms.length - 1)] || forms[0];
    if (x.lang === 'ru' && /ё/.test(w) === false) out = out.replace(/ё/g, 'е');
    return caseOf(w, out);
  });
}

module.exports = { countIn, setCount };
