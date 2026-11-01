'use strict';
/**
 * SPEAKER NOTES + STUDY GUIDE — what the student SAYS and what they should UNDERSTAND.
 *
 * Runs once the slide text is final (after review / quality / narrative / requirements passes), in parallel with
 * the image stage, so it adds no waiting time and never goes stale.
 *   • notes  — for every slide: one-line key idea + a 30–60 s spoken explanation (goes into PPTX Notes);
 *   • study  — the topic in plain words (core idea, simple explanation, everyday comparison), glossary of the deck's
 *              terms and the questions a teacher is likely to ask, with short answers;
 *   • quiz   — 10 multiple-choice questions for the class (core/quiz.js plays them live after the talk).
 * Pedagogy: the student must UNDERSTAND first, then tell it in their own words from short cues, then defend it —
 * so the notes give a key idea + 2–3 cue words per slide and a speech in short, easy-to-say sentences.
 * Never throws: a failed call only leaves those parts empty.
 */
const { deepseekJson } = require('../../core/llm');
const { normalizeQuestions } = require('../../core/quiz');

const BATCH = 8;
const MAX_SPEECH = 1100;   // chars — ~120–160 words, a minute at most
const MIN_SPEECH = 60;

const clean = (v, max) => String(v == null ? '' : v)
  .replace(/\*\*|__|`|#+\s/g, '')       // no markdown in a speech
  .replace(/\s*\n\s*/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim()
  .slice(0, max || 2000);

/** Compact view of a slide for the prompt (what the audience sees). */
function slideFacts(s, i, total) {
  const st = (Array.isArray(s.stats) ? s.stats : []).filter((x) => x && x.value != null)
    .map((x) => String(x.value) + (x.label ? ' — ' + x.label : ''));
  const tb = s.table && Array.isArray(s.table.rows) ? s.table.rows.slice(0, 4).map((r) => (Array.isArray(r) ? r.join(' | ') : String(r))) : [];
  const role = i === 0 ? 'cover' : i === total - 1 ? 'closing' : /әдебиет|\breferences?\b|литератур|источник|\bsources\b/i.test(String(s.title || '')) ? 'references' : 'content';
  return {
    n: i + 1,
    role,
    title: clean(s.title, 200),
    subtitle: clean(s.subtitle, 300) || undefined,
    body: clean(s.body, 600) || undefined,
    bullets: (Array.isArray(s.bullets) ? s.bullets : []).map((b) => clean(b, 220)).filter(Boolean).slice(0, 6),
    numbers: st.length ? st.slice(0, 6) : undefined,
    table: tb.length ? tb : undefined,
  };
}

function langRule(language) {
  return language
    ? `Write EVERYTHING in ${language}.`
    : 'Write in the same language as the slides.';
}

const NOTES_SYSTEM = `You are a presentation coach who also teaches. You write what a student will SAY while showing each slide.
Respond with valid JSON only.`;

function notesPrompt({ title, topic, language, speaker, batch, total, pedagogy }) {
  if (!pedagogy) return classicNotesPrompt({ title, topic, language, speaker, batch, total });
  return `Presentation: «${title}» (topic: ${clean(topic, 300)}), ${total} slides. ${langRule(language)}
${speaker ? `The speaker's name: ${speaker}.` : ''}

The student is not an expert and will be nervous: everything must be easy to UNDERSTAND and easy to SAY.
For EVERY slide below write:
- "point": the key idea of the slide in ONE short sentence (max 16 words) — what the listener must remember;
- "cues": 2–3 cue words or very short phrases (max 3 words each) in the order the speech uses them — the student glances at them instead of reading;
- "speech": what the speaker says aloud, 60–120 words, natural spoken language, first person.
  • Short sentences (max ~15 words), everyday words; no long chains of clauses, no bookish phrases that are hard to pronounce.
  • Do NOT read the slide back: explain WHY / HOW, give one concrete example or comparison, define any term a classmate may not know in simple words.
  • Numbers: say what they mean ("бұл әр үшінші адам дегенді білдіреді"), never invent new figures.
  • End with a short bridge to the next slide (not on the last slide).
  • cover: greet the audience, name the topic${speaker ? ' and introduce yourself by name' : ''}, say in one sentence what the talk will show.
  • closing: sum up 2–3 main conclusions, thank the audience and invite questions.
  • references: one sentence about what sources were used.
- No markdown, no lists, no stage directions, no "on this slide we see".

Slides:
${JSON.stringify(batch)}

Return {"notes":[{"n":<slide number>,"point":"...","cues":["...","..."],"speech":"..."}]} — exactly ${batch.length} items, same numbers.`;
}

// Классикалық нұсқа (клиенттерге): кілт сөздерсіз, сөйлеу стилі туралы қосымша талапсыз — бұрынғы мінез
function classicNotesPrompt({ title, topic, language, speaker, batch, total }) {
  return `Presentation: «${title}» (topic: ${clean(topic, 300)}), ${total} slides. ${langRule(language)}
${speaker ? `The speaker's name: ${speaker}.` : ''}

For EVERY slide below write:
- "point": the key idea of the slide in ONE short sentence (max 16 words) — what the listener must remember;
- "speech": what the speaker says aloud, 60–120 words, natural spoken language, first person.
  • Do NOT read the slide back: explain WHY / HOW, give one concrete example or comparison, define any term a classmate may not know in simple words.
  • Numbers: say what they mean ("бұл әр үшінші адам дегенді білдіреді"), never invent new figures.
  • End with a short bridge to the next slide (not on the last slide).
  • cover: greet the audience, name the topic${speaker ? ' and introduce yourself by name' : ''}, say in one sentence what the talk will show.
  • closing: sum up 2–3 main conclusions, thank the audience and invite questions.
  • references: one sentence about what sources were used.
- No markdown, no lists, no stage directions, no "on this slide we see".

Slides:
${JSON.stringify(batch)}

Return {"notes":[{"n":<slide number>,"point":"...","speech":"..."}]} — exactly ${batch.length} items, same numbers.`;
}

function classicStudyPrompt({ title, topic, language, facts }) {
  return `Presentation: «${title}» (topic: ${clean(topic, 300)}). ${langRule(language)}
Slides (what the student will show):
${JSON.stringify(facts.map((f) => ({ n: f.n, title: f.title, bullets: f.bullets, numbers: f.numbers })))}

Prepare the student:
- "glossary": 4–8 key terms USED in these slides, each with a simple 1-sentence meaning a classmate understands;
- "questions": 5 questions a teacher is likely to ask about THIS presentation (why/how/compare/what-if, not trivia), each with a short answer (2–3 sentences) based on the slides; never invent statistics.
Return {"glossary":[{"term":"...","meaning":"..."}],"questions":[{"q":"...","a":"..."}]}`;
}

const STUDY_SYSTEM = `You are an experienced teacher preparing a student to present and defend a topic they only met this week.
Respond with valid JSON only.`;

function studyPrompt({ title, topic, language, facts, pedagogy }) {
  if (!pedagogy) return classicStudyPrompt({ title, topic, language, facts });
  return `Presentation: «${title}» (topic: ${clean(topic, 300)}). ${langRule(language)}
Slides (what the student will show):
${JSON.stringify(facts.map((f) => ({ n: f.n, title: f.title, bullets: f.bullets, numbers: f.numbers })))}

Help the student UNDERSTAND the topic first, then defend it:
- "core": the whole topic in ONE sentence (max 25 words) — the single message the class should leave with;
- "simple": the topic explained in plain words in 4–6 short sentences, as if to a 12-year-old: what it is, why it matters, how it works / what happened;
- "analogy": one comparison with everyday life that makes the main idea click (1–2 sentences);
- "glossary": 4–8 key terms USED in these slides, each with a simple 1-sentence meaning a classmate understands;
- "questions": 5 questions a teacher is likely to ask about THIS presentation (why/how/compare/what-if, not trivia), each with a short answer (2–3 sentences) the student can say aloud, based on the slides; never invent statistics.
Return {"core":"...","simple":"...","analogy":"...","glossary":[{"term":"...","meaning":"..."}],"questions":[{"q":"...","a":"..."}]}`;
}

const QUIZ_SYSTEM = `You are a teacher who writes fair, clear multiple-choice quizzes for a class. Respond with valid JSON only.`;

function quizPrompt({ title, topic, language, facts }) {
  return `A student has just presented «${title}» (topic: ${clean(topic, 300)}) to the class. ${langRule(language)}
What the class saw and heard:
${JSON.stringify(facts.filter((f) => f.role === 'content').map((f) => ({ title: f.title, body: f.body, bullets: f.bullets, numbers: f.numbers })))}

Write a 10-question quiz the class plays on their phones right after the talk.
- Use ONLY facts and ideas from the slides above — the class must be able to answer from the talk. Never invent numbers, dates or names.
- Order from easy to harder: questions 1–3 recall a key fact; 4–7 check understanding (why / how / what does it mean); 8–10 apply or compare (which example fits, what would happen if).
- Cover different slides; do not ask the same thing twice.
- "q": max 110 characters, clear, no negatives ("which is NOT"), no trick wording.
- "options": exactly 4, each max 55 characters, all plausible and of the same kind and similar length; exactly one is correct; no "all of the above" / "none of the above".
- "correct": index 0–3 of the correct option.
- "explain": 1 sentence (max 150 characters) why the answer is right — the class reads it after answering.
Return {"quiz":[{"q":"...","options":["...","...","...","..."],"correct":0,"explain":"..."}]}`;
}

async function notesForBatch(llm, ctx, batch) {
  const out = await llm(NOTES_SYSTEM, notesPrompt({ ...ctx, batch }), `speakerNotes[${batch[0].n}-${batch[batch.length - 1].n}]`);
  const arr = Array.isArray(out && out.notes) ? out.notes : [];
  const byN = new Map();
  arr.forEach((x, k) => {
    const n = Number(x && x.n) || (batch[k] && batch[k].n);
    const speech = clean(x && x.speech, MAX_SPEECH);
    if (!n || speech.length < MIN_SPEECH) return;
    const cues = (Array.isArray(x.cues) ? x.cues : []).map((c) => clean(c, 40)).filter(Boolean).slice(0, 3);
    byN.set(n, { point: clean(x.point, 200), cues, speech });
  });
  return byN;
}

async function pool(items, limit, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

/**
 * @param {{ slides: object[], title?: string, topic?: string, language?: string|null, coverMeta?: object, llm?: Function, quiz?: boolean, pedagogy?: boolean }} opts
 * @returns {Promise<{ notes: ({point:string, cues:string[], speech:string}|null)[], study: {overview:object, glossary:object[], questions:object[]}|null, quiz: object[], ok: number }>}
 */
async function generateSpeakerNotes(opts = {}) {
  const slides = Array.isArray(opts.slides) ? opts.slides : [];
  const llm = opts.llm || ((sys, user, label) => deepseekJson(sys, user, label, 0, { temperature: label === 'classQuiz' ? 0.4 : 0.7, timeoutMs: 90_000 }));  // квиз — факт, шығармашылық емес
  const total = slides.length;
  const facts = slides.map((s, i) => slideFacts(s || {}, i, total));
  const speaker = opts.coverMeta && opts.coverMeta.performedBy ? clean(opts.coverMeta.performedBy, 120) : '';
  // pedagogy: жаңа «Дайындық» (кілт сөздер, қарапайым түсіндірме, жеңіл сөйлемдер) — әзірге тек админ мен тестерлер
  const pedagogy = opts.pedagogy !== false;
  const ctx = { title: clean(opts.title || opts.topic, 200), topic: opts.topic || opts.title || '', language: opts.language || null, speaker, total, pedagogy };

  const batches = [];
  for (let i = 0; i < facts.length; i += BATCH) batches.push(facts.slice(i, i + BATCH));

  const notesTask = pool(batches, 2, (b) => notesForBatch(llm, ctx, b).catch((e) => {
    console.warn(`[Notes] batch ${b[0].n}-${b[b.length - 1].n} failed: ${e.message}`);
    return new Map();
  }));
  const studyTask = total >= 3
    ? llm(STUDY_SYSTEM, studyPrompt({ ...ctx, facts }), 'studyGuide').catch((e) => { console.warn('[Notes] study guide failed: ' + e.message); return null; })
    : Promise.resolve(null);
  const quizTask = total >= 4 && pedagogy && opts.quiz !== false
    ? llm(QUIZ_SYSTEM, quizPrompt({ ...ctx, facts }), 'classQuiz').catch((e) => { console.warn('[Notes] quiz failed: ' + e.message); return null; })
    : Promise.resolve(null);
  const [maps, studyRaw, quizRaw] = await Promise.all([notesTask, studyTask, quizTask]);

  const all = new Map();
  maps.forEach((m) => m.forEach((v, k) => all.set(k, v)));
  const notes = facts.map((f) => all.get(f.n) || null);

  let study = null;
  if (studyRaw) {
    const glossary = (Array.isArray(studyRaw.glossary) ? studyRaw.glossary : [])
      .map((g) => ({ term: clean(g && g.term, 80), meaning: clean(g && g.meaning, 300) }))
      .filter((g) => g.term && g.meaning).slice(0, 8);
    const questions = (Array.isArray(studyRaw.questions) ? studyRaw.questions : [])
      .map((q) => ({ q: clean(q && q.q, 250), a: clean(q && q.a, 600) }))
      .filter((q) => q.q && q.a).slice(0, 6);
    const overview = {
      core: clean(studyRaw.core, 260), simple: clean(studyRaw.simple, 900), analogy: clean(studyRaw.analogy, 400),
    };
    if (glossary.length || questions.length || overview.simple) study = { overview, glossary, questions };
  }
  const quiz = quizRaw ? normalizeQuestions(quizRaw) : [];
  if (quizRaw && !quiz.length) console.warn('[Notes] quiz: not enough valid questions');
  return { notes, study, quiz, ok: notes.filter(Boolean).length };
}

/** PPTX Notes text: key idea first, then the speech. */
function notesText(n) {
  if (!n) return '';
  return (n.point ? '► ' + n.point + '\n\n' : '') + n.speech;
}

/** Stamp notes on the slides (exporter writes slide.speakerNotes into the PPTX). Returns how many were set. */
function applySpeakerNotes(slides, notes) {
  let k = 0;
  (Array.isArray(slides) ? slides : []).forEach((s, i) => {
    const n = notes && notes[i];
    if (s && n) { s.speakerNotes = notesText(n); k += 1; }
  });
  return k;
}

/** ~130 spoken words per minute. */
function speakingMinutes(notes) {
  const words = (notes || []).filter(Boolean).reduce((a, n) => a + n.speech.split(/\s+/).length, 0);
  return Math.max(1, Math.round(words / 130));
}

module.exports = { generateSpeakerNotes, applySpeakerNotes, notesText, speakingMinutes, slideFacts };
