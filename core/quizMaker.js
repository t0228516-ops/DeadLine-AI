'use strict';
/**
 * ТЕГІН КВИЗ ЖАСАУШЫ — тақырыптан не мұғалімнің өз материалынан тірі квиз (Kahoot / Wayground сияқты).
 *
 * Маркетингтік мақсат (иесінің шешімі, 2026-11-06): квиз тегін; оны бүкіл топ телефонмен ашық ойнайды, ойын соңында
 * әр ойыншы «өз квизіңді жаса — тегін» және «презентация 2 минутта» батырмаларын көреді → бот өзін-өзі таратады.
 *
 * Сапа ережелері:
 *   • материал берілсе — сұрақтар ТЕК сол мәтіннен (мұғалім өз лекциясын тексереді);
 *   • тек тақырып болса — оқулықта бар, тексерілетін фактілер; күмәнді сан/дата/дәйексөз ойдан шығарылмайды;
 *   • оңайдан қиынға; бір нәрсе екі рет сұралмайды; нұсқалар бір түрлі әрі ұқсас ұзындықта;
 *   • модель қатесінің орнын толтыру үшін N+3 сұрақ сұралады, тексерілгеннен кейін N қалады;
 *   • қазақша/орысша квизде кириллица тексеріледі (модель ағылшынша жазып жіберсе — ол сұрақ алынады).
 * LLM шақырушы (llm) тесттерде ауыстырылады; функциялар ешқашан жартылай нәтиже қайтармайды — не толық, не қате.
 */
const { normalizeQuestions } = require('./quiz');

const MIN_COUNT = 5;
const MAX_COUNT = 15;
const DEFAULT_COUNT = 10;
const MAX_TOPIC = 300;
const MAX_MATERIAL = 20000;   // таңба: ~1 лекция; көбі прокси-шығынға ғана әсер етеді, сапаға емес
const LANG = { kk: 'Kazakh (Cyrillic, standard literary Kazakh)', ru: 'Russian', en: 'English' };

const SYSTEM = 'You are an experienced teacher who writes fair, accurate multiple-choice quizzes for a live class game '
  + '(like Kahoot or Wayground). Accuracy matters more than difficulty: a wrong "correct answer" in front of a class is the worst outcome. '
  + 'Respond with valid JSON only.';

const oneLine = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

function clampCount(n) {
  const x = parseInt(n, 10);
  if (!Number.isFinite(x)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, x));
}

function normLang(l) {
  return LANG[l] ? l : 'kk';
}

/** Материалды промптқа дайындау: бос жолдарды қысқарту, шекке дейін кесу (сөз ортасынан емес) */
function prepMaterial(text) {
  const t = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length <= MAX_MATERIAL) return t;
  const cut = t.slice(0, MAX_MATERIAL);
  const sp = cut.lastIndexOf(' ');
  return sp > MAX_MATERIAL * 0.9 ? cut.slice(0, sp) : cut;
}

const RULES = (lang) => `Rules for every question:
- Write EVERYTHING (questions, options, explanations) in ${LANG[lang]}. Keep names, terms and dates in their usual ${lang === 'en' ? 'English' : lang === 'ru' ? 'Russian' : 'Kazakh'} spelling.
- "q": max 110 characters, one clear question, no negatives ("which is NOT"), no trick wording, no "according to the text".
- "options": exactly 4, each max 55 characters, all plausible and of the same kind and similar length; exactly one is correct; never "all of the above" / "none of the above".
- "correct": index 0–3 of the correct option.
- "explain": 1 sentence (max 150 characters) why the answer is right — players read it after the game.
- Every question asks something different; cover different parts of the topic.`;

function createPrompt({ topic, language, count, material }) {
  const lang = normLang(language);
  const ask = count + 3; // артығын сұраймыз: тексеруден өтпегендердің орны толады
  const source = material
    ? `The teacher gave this material. Use ONLY facts and ideas from it — the class studied exactly this:
<<<MATERIAL
${material}
MATERIAL>>>`
    : `Use only well-established facts found in standard school and university textbooks on this topic.
If you are not sure about an exact number, date or quote, ask about the idea instead — never invent facts.`;
  return `Topic: «${topic}».
${source}

Write ${ask} questions for a live class quiz. Order from easy to harder: the first third recall key facts; the middle third check understanding (why / how / what does it mean); the last third apply or compare (which example fits, what would happen if).
${RULES(lang)}
Return {"quiz":[{"q":"...","options":["...","...","...","..."],"correct":0,"explain":"..."}]}`;
}

function replacePrompt({ topic, language, material, existing, drop }) {
  const lang = normLang(language);
  const source = material
    ? `Use ONLY facts from the teacher's material:
<<<MATERIAL
${material}
MATERIAL>>>`
    : 'Use only well-established textbook facts — never invent numbers, dates or quotes.';
  return `Topic: «${topic}». The teacher removed this question from a class quiz: «${drop}».
${source}

The quiz already has these questions — do NOT repeat or rephrase any of them:
${existing.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Write 3 NEW alternative questions on a different aspect of the topic, of similar difficulty to the removed one.
${RULES(lang)}
Return {"quiz":[{"q":"...","options":["...","...","...","..."],"correct":0,"explain":"..."}]}`;
}

const CYR = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
/** Тіл тексеруі: қаз/орыс квизінде сұрақ пен нұсқалардың басым бөлігі кириллицада болуы керек */
function langOk(item, lang) {
  if (lang === 'en') return !CYR.test(item.q);
  if (!CYR.test(item.q)) return false;
  return item.options.filter((o) => CYR.test(o) || /^[\d\s.,:%–-]+$/.test(o)).length >= 2;
}

const keyOf = (q) => String(q || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function defaultLlm(system, user, label) {
  const { deepseekJson } = require('./llm');
  return deepseekJson(system, user, label, 0, { temperature: 0.3, timeoutMs: 60_000 });
}

/**
 * @param {{ topic: string, language?: string, count?: number, material?: string, llm?: Function, rnd?: Function }} o
 * @returns {Promise<{ topic: string, language: string, questions: {q:string, options:string[], correct:number, explain:string}[], fromMaterial: boolean }>}
 */
async function generateQuiz(o = {}) {
  const topic = oneLine(o.topic, MAX_TOPIC);
  if (topic.length < 3) { const e = new Error('topic'); e.code = 'topic'; throw e; }
  const language = normLang(o.language);
  const count = clampCount(o.count);
  const material = o.material ? prepMaterial(o.material) : '';
  const llm = o.llm || defaultLlm;
  const raw = await llm(SYSTEM, createPrompt({ topic, language, count, material }), 'freeQuiz');
  const all = normalizeQuestions(raw, o.rnd, { min: 1, max: count + 3 }).filter((x) => langOk(x, language));
  const questions = all.slice(0, count);
  if (questions.length < Math.min(MIN_COUNT, count)) {
    const e = new Error(`only ${questions.length} valid questions`); e.code = 'few'; throw e;
  }
  return { topic, language, questions, fromMaterial: !!material };
}

/**
 * Бір сұрақты жаңасымен ауыстырады (қалғандарымен қайталанбайтын).
 * @returns {Promise<{q:string, options:string[], correct:number, explain:string}>}
 */
async function replaceQuestion(o = {}) {
  const language = normLang(o.language);
  const questions = Array.isArray(o.questions) ? o.questions : [];
  const qi = Number(o.qi);
  if (!Number.isInteger(qi) || qi < 0 || qi >= questions.length) { const e = new Error('index'); e.code = 'index'; throw e; }
  const llm = o.llm || defaultLlm;
  const existing = questions.filter((_, i) => i !== qi).map((x) => x.q);
  const material = o.material ? prepMaterial(o.material) : '';
  const raw = await llm(SYSTEM, replacePrompt({ topic: oneLine(o.topic, MAX_TOPIC), language, material, existing, drop: questions[qi].q }), 'freeQuizReplace');
  const taken = new Set(questions.map((x) => keyOf(x.q)));
  const fresh = normalizeQuestions(raw, o.rnd, { min: 1, max: 3 }).filter((x) => langOk(x, language) && !taken.has(keyOf(x.q)));
  if (!fresh.length) { const e = new Error('no replacement'); e.code = 'few'; throw e; }
  return fresh[0];
}

module.exports = {
  generateQuiz, replaceQuestion, clampCount, prepMaterial, createPrompt, replacePrompt, langOk,
  MIN_COUNT, MAX_COUNT, DEFAULT_COUNT, MAX_TOPIC, MAX_MATERIAL,
};
