'use strict';
/**
 * «Баяндамаға дайындық» — a Word file the student prepares with (phone or print).
 *
 * Built like a lesson, in the order a student actually gets ready (~30 min):
 *   0. how to use this file — a 4-step rehearsal plan;
 *   1. UNDERSTAND — the topic in one sentence, in plain words, an everyday comparison, key terms;
 *   2. ROUTE — one-page cheat sheet: slide → key idea → cue words (tell it from cues, not from a text);
 *   3. SAY — speaking tips + per slide the key idea, cue words and the spoken text;
 *   4. DEFEND — questions a teacher may ask, with answers, and what to do when you don't know;
 *   5. CHECK — the class quiz as a self-test (answers on a separate page) + how to play it with the class.
 */
const { packDocx, para, run } = require('../referat/docx');
const { speakingMinutes } = require('./speakerNotes');

const L10N = {
  kk: {
    doc: 'БАЯНДАМАҒА ДАЙЫНДЫҚ', topic: 'Тақырыбы', speaker: 'Баяндамашы', group: 'Топ',
    time: (m, n) => `Сөйлеу уақыты: шамамен ${m} мин · ${n} слайд`,
    planTitle: 'Осы құжатпен қалай дайындалу керек (≈30 минут)',
    plan: [
      ['Түсін (5 мин).', ' 1-бөлімді оқып, тақырыпты досыңа не өзіңе өз сөзіңмен айтып көр. Түсінген нәрсені айту оңай, жатталған мәтін ұмытылады.'],
      ['Жолын біл (5 мин).', ' 2-бөлім — бір беттік жоспар: әр слайдтың басты ойы мен кілт сөздері. Осы бетті есте сақтасаң, баяндамадан адаспайсың.'],
      ['Айтып жаттық (15 мин).', ' 3-бөлімдегі мәтінді бір рет дауыстап оқы. Екінші рет тек ► басты ой мен кілт сөздерге қарап, өз сөзіңмен айт. Үшінші рет — сағатпен.'],
      ['Қорғауға дайындал (5 мин).', ' 4-бөлімдегі сұрақтарға дауыстап жауап бер, сосын 5-бөлімдегі квизбен өзіңді тексер.'],
    ],
    s1: '1. Тақырып қарапайым тілмен', core: 'Бір сөйлеммен', simple: 'Қарапайым түсіндірме', analogy: 'Өмірмен салыстыр', glossary: 'Негізгі терминдер',
    s2: '2. Баяндама жоспары', s2hint: 'Бір беттік шпаргалка: слайд → басты ой → кілт сөздер.',
    s3: '3. Сөйлейтін мәтін', keys: 'Кілт сөздер', slide: 'Слайд',
    how: '► — слайдтың басты ойы. Мәтінді жаттап алмаңыз: басты ойды есте сақтап, кілт сөздерге сүйеніп, өз сөзіңізбен айтыңыз.',
    tipsTitle: 'Сөйлеу кеңестері',
    tips: [
      'Сәлемдесіп, тақырыпты бір сөйлеммен атаңыз — алғашқы 20 секунд бүкіл баяндаманың әсерін анықтайды.',
      'Экранға емес, сыныпқа қараңыз. Слайдты оқымаңыз — оны тыңдаушылар өздері оқиды, сіз түсіндіресіз.',
      'Баяу сөйлеңіз. Кідіріс — қате емес: ұмытып қалсаңыз, кілт сөзге қарап, сабырмен жалғастырыңыз.',
      'Сан айтқанда оның мәнін түсіндіріңіз: «бұл әр үшінші адам деген сөз».',
      'Соңында 2–3 басты қорытындыны қайталап, рахмет айтып, сұрақтарға шақырыңыз.',
    ],
    s4: '4. Мұғалім қоюы мүмкін сұрақтар', answer: 'Жауап',
    unknown: 'Жауабын білмесеңіз: «Жақсы сұрақ. Мен білетінім — …» деп, тақырыптан білетініңізді айтыңыз. Ойдан сан не дерек құрастырмаңыз — «бұны нақтылап, кейін айтамын» деу әлдеқайда жақсы.',
    s5: '5. Өзіңді тексер: квиз', quizHint: '10 сұраққа жауап беріп, келесі беттегі жауаптармен салыстыр. 8-ден көп дұрыс болса — дайынсыз.',
    answers: 'Жауаптар',
    classTitle: 'Квизді сыныппен ойнау',
    classQuiz: 'Презентацияның соңғы слайдында QR код тұр. Баяндаманы аяқтаған соң «Квизді бастау» батырмасын басыңыз — проекторда ойын ашылады. Сынып QR кодты телефон камерасымен сканерлеп, атын жазып қосылады. Ойын кезінде дұрыс-қатесі көрсетілмейді — бәрі соңында: алдымен үздіктер, сосын «Жауаптарды талдау» (әр сұрақтың дұрыс жауабы, сыныптың неше пайызы тапқаны, түсіндірме). Сынып ең қиналған сұрақ белгіленеді — оны қайта түсіндіріп жіберіңіз.',
    hostLink: 'Батырма ашылмаса, проектордағы компьютердің браузерінде мына сілтемені ашыңыз:',
    playerLink: 'Сыныпқа арналған сілтеме (QR кодпен бірдей):',
  },
  ru: {
    doc: 'ПОДГОТОВКА К ДОКЛАДУ', topic: 'Тема', speaker: 'Докладчик', group: 'Группа',
    time: (m, n) => `Время выступления: около ${m} мин · ${n} слайдов`,
    planTitle: 'Как готовиться по этому документу (≈30 минут)',
    plan: [
      ['Пойми (5 мин).', ' Прочитай раздел 1 и перескажи тему другу или себе своими словами. Понятое легко рассказать, заученное забывается.'],
      ['Знай маршрут (5 мин).', ' Раздел 2 — план на одну страницу: главная мысль и ключевые слова каждого слайда. Запомнишь эту страницу — не собьёшься.'],
      ['Тренируйся вслух (15 мин).', ' Прочитай текст раздела 3 один раз вслух. Второй раз говори своими словами, глядя только на ► главную мысль и ключевые слова. Третий раз — с таймером.'],
      ['Готовься к защите (5 мин).', ' Ответь вслух на вопросы раздела 4, затем проверь себя квизом из раздела 5.'],
    ],
    s1: '1. Тема простыми словами', core: 'В одном предложении', simple: 'Простое объяснение', analogy: 'Сравнение из жизни', glossary: 'Ключевые термины',
    s2: '2. План доклада', s2hint: 'Шпаргалка на одну страницу: слайд → главная мысль → ключевые слова.',
    s3: '3. Текст выступления', keys: 'Ключевые слова', slide: 'Слайд',
    how: '► — главная мысль слайда. Не заучивайте текст: запомните главную мысль и говорите своими словами, опираясь на ключевые слова.',
    tipsTitle: 'Советы для выступления',
    tips: [
      'Поздоровайтесь и назовите тему одним предложением — первые 20 секунд задают впечатление от всего доклада.',
      'Смотрите на класс, а не на экран. Не читайте слайд — его прочитают сами, а вы объясняете.',
      'Говорите медленно. Пауза — не ошибка: если забыли, посмотрите на ключевое слово и спокойно продолжайте.',
      'Называя число, объясните его смысл: «это каждый третий человек».',
      'В конце повторите 2–3 главных вывода, поблагодарите и пригласите задавать вопросы.',
    ],
    s4: '4. Возможные вопросы преподавателя', answer: 'Ответ',
    unknown: 'Если не знаете ответа: скажите «Хороший вопрос. Что я знаю — …» и расскажите, что знаете по теме. Не придумывайте цифры и факты — честное «уточню и отвечу позже» намного лучше.',
    s5: '5. Проверь себя: квиз', quizHint: 'Ответь на 10 вопросов и сверься с ответами на следующей странице. Больше 8 верных — вы готовы.',
    answers: 'Ответы',
    classTitle: 'Квиз вместе с классом',
    classQuiz: 'На последнем слайде презентации есть QR-код. После доклада нажмите кнопку «Начать квиз» — игра откроется на проекторе. Класс сканирует QR-код камерой телефона и вводит имя. Во время игры верно/неверно не показывается — всё в конце: сначала лучшие, затем «Разбор ответов» (верный ответ, сколько процентов класса ответили верно, объяснение). Самый трудный для класса вопрос отмечен — объясните его ещё раз.',
    hostLink: 'Если кнопка не открывается, откройте эту ссылку в браузере компьютера с проектором:',
    playerLink: 'Ссылка для класса (то же, что QR-код):',
  },
  en: {
    doc: 'PRESENTATION PREP', topic: 'Topic', speaker: 'Speaker', group: 'Group',
    time: (m, n) => `Speaking time: about ${m} min · ${n} slides`,
    planTitle: 'How to prepare with this file (≈30 minutes)',
    plan: [
      ['Understand (5 min).', ' Read part 1 and explain the topic to a friend or to yourself in your own words. What you understand is easy to tell; what you memorise is forgotten.'],
      ['Know the route (5 min).', ' Part 2 is a one-page plan: the key idea and cue words of every slide. Remember this page and you will not get lost.'],
      ['Practise aloud (15 min).', ' Read the text of part 3 aloud once. The second time, speak in your own words looking only at the ► key idea and cue words. The third time, use a timer.'],
      ['Prepare to defend (5 min).', ' Answer the questions of part 4 aloud, then test yourself with the quiz in part 5.'],
    ],
    s1: '1. The topic in plain words', core: 'In one sentence', simple: 'Simple explanation', analogy: 'Everyday comparison', glossary: 'Key terms',
    s2: '2. Talk plan', s2hint: 'One-page cheat sheet: slide → key idea → cue words.',
    s3: '3. Speaker script', keys: 'Cue words', slide: 'Slide',
    how: '► — the key idea of the slide. Do not memorise the text: remember the idea and say it in your own words, using the cue words.',
    tipsTitle: 'Speaking tips',
    tips: [
      'Greet the class and name the topic in one sentence — the first 20 seconds set the tone for the whole talk.',
      'Look at the class, not at the screen. Do not read the slide — they can read it; you explain.',
      'Speak slowly. A pause is not a mistake: if you forget, glance at a cue word and calmly go on.',
      'When you give a number, say what it means: "that is one person in three".',
      'At the end repeat the 2–3 main conclusions, thank the audience and invite questions.',
    ],
    s4: '4. Questions a teacher may ask', answer: 'Answer',
    unknown: 'If you do not know: say "Good question. What I know is…" and tell what you do know about the topic. Never invent numbers or facts — an honest "I will check and come back to you" is much better.',
    s5: '5. Check yourself: quiz', quizHint: 'Answer the 10 questions and compare with the answers on the next page. More than 8 right — you are ready.',
    answers: 'Answers',
    classTitle: 'Play the quiz with the class',
    classQuiz: 'The last slide of the presentation has a QR code. After the talk click "Start quiz" — the game opens on the projector. The class scans the QR code with their phone cameras and types a name. Right or wrong is not shown during the game — everything comes at the end: first the top players, then "Review answers" (the right answer, what share of the class got it, a short explanation). The hardest question for the class is marked — explain it once more.',
    hostLink: 'If the button does not open, open this link in the browser of the projector computer:',
    playerLink: 'Link for the class (same as the QR code):',
  },
};

function langCode(language) {
  const l = String(language || '').toLowerCase();
  if (/rus|рус|орыс/.test(l)) return 'ru';
  if (/eng|анг|ағыл/.test(l)) return 'en';
  return 'kk';
}

/** Detect from the text when the deck language was not given explicitly. */
function guessLang(slides) {
  const t = (slides || []).map((s) => (s && s.title) || '').join(' ');
  if (/[әғқңөұүһі]/i.test(t)) return 'kk';
  if (/[а-яё]/i.test(t)) return 'ru';
  return /[a-z]/i.test(t) ? 'en' : 'kk';
}

// ── Классикалық «Баяндама мәтіні» (клиенттерге; жаңа «Дайындық» әзірге тек админ мен тестерлерге — иесінің шешімі) ──
const CLASSIC = {
  kk: { doc: 'БАЯНДАМА МӘТІНІ', how: '► — слайдтың басты ойы. Мәтінді жаттап алмаңыз: басты ойды есте сақтап, өз сөзіңізбен айтыңыз.', glossary: 'Негізгі терминдер', questions: 'Мұғалім қоюы мүмкін сұрақтар' },
  ru: { doc: 'ТЕКСТ ДОКЛАДА', how: '► — главная мысль слайда. Не заучивайте текст: запомните главную мысль и говорите своими словами.', glossary: 'Ключевые термины', questions: 'Возможные вопросы преподавателя' },
  en: { doc: 'SPEAKER SCRIPT', how: '► — the key idea of the slide. Do not memorise the text: remember the idea and say it in your own words.', glossary: 'Key terms', questions: 'Questions a teacher may ask' },
};

function buildClassicDocx(o, lang) {
  const slides = Array.isArray(o.slides) ? o.slides : [];
  const notes = Array.isArray(o.notes) ? o.notes : [];
  const t = { ...L10N[lang], ...CLASSIC[lang] };
  const meta = o.coverMeta || {};
  const C = (text, ro = {}, po = {}) => para(run(text, ro), Object.assign({ jc: 'center', firstLine: 0, line: 300 }, po));
  const P = (text, ro = {}, po = {}) => para(run(text, ro), Object.assign({ line: 360, firstLine: 709, after: 120 }, po));
  const body = [];
  body.push(C(t.doc, { bold: true, size: 32 }, { after: 240 }));
  body.push(C(`${t.topic}: «${o.title || ''}»`, { bold: true, size: 28 }, { after: 120 }));
  const who = [meta.performedBy ? `${t.speaker}: ${meta.performedBy}` : '', meta.group ? `${t.group}: ${meta.group}` : ''].filter(Boolean).join(' · ');
  if (who) body.push(C(who, {}, { after: 60 }));
  body.push(C(t.time(speakingMinutes(notes), slides.length), { italic: true, size: 24 }, { after: 240 }));
  body.push(P(t.how, { italic: true, size: 24 }, { firstLine: 0, after: 240 }));
  slides.forEach((s, i) => {
    const n = notes[i];
    if (!n) return;
    body.push(para(run(`${t.slide} ${i + 1}. ${String((s && s.title) || '').trim()}`), { style: 'Heading2', firstLine: 0, before: 240 }));
    if (n.point) body.push(P('► ' + n.point, { bold: true }, { firstLine: 0 }));
    body.push(P(n.speech));
  });
  const study = o.study || null;
  if (study && study.glossary && study.glossary.length) {
    body.push(para(run(t.glossary), { style: 'Heading1', pageBreakBefore: true }));
    study.glossary.forEach((g) => body.push(para(run(g.term, { bold: true }) + run(' — ' + g.meaning), { line: 360, firstLine: 0, after: 120 })));
  }
  if (study && study.questions && study.questions.length) {
    body.push(para(run(t.questions), { style: 'Heading1', pageBreakBefore: !(study.glossary && study.glossary.length) }));
    study.questions.forEach((q, k) => {
      body.push(para(run(`${k + 1}. ${q.q}`, { bold: true }), { line: 360, firstLine: 0, before: 120, after: 60, keepNext: true }));
      body.push(para(run(t.answer + ': ', { italic: true }) + run(q.a), { line: 360, firstLine: 0, after: 120 }));
    });
  }
  return packDocx(lang, o.title || t.doc, body.join(''));
}

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * @param {{ title: string, slides: object[], notes: ({point,cues?,speech}|null)[], study?: object|null, language?: string|null,
 *           coverMeta?: object, quiz?: {q,options,correct,explain}[], quizLinks?: {player:string, host:string}|null,
 *           pedagogy?: boolean }} o — pedagogy:false → классикалық «Баяндама мәтіні»
 * @returns {Buffer} .docx
 */
function buildSpeechDocx(o) {
  const slides = Array.isArray(o.slides) ? o.slides : [];
  const notes = Array.isArray(o.notes) ? o.notes : [];
  const lang = o.language ? langCode(o.language) : guessLang(slides);
  if (o.pedagogy === false) return buildClassicDocx(o, lang);
  const t = L10N[lang];
  const meta = o.coverMeta || {};
  const study = o.study || null;
  const quiz = Array.isArray(o.quiz) ? o.quiz : [];
  const C = (text, ro = {}, po = {}) => para(run(text, ro), Object.assign({ jc: 'center', firstLine: 0, line: 300 }, po));
  const P = (text, ro = {}, po = {}) => para(run(text, ro), Object.assign({ line: 360, firstLine: 709, after: 120 }, po));
  const L = (inner, po = {}) => {
    const o2 = Object.assign({ line: 336, firstLine: 0, after: 100, jc: 'left' }, po);
    if (o2.hanging != null) delete o2.firstLine; // w:ind: firstLine мен hanging бірге болмайды
    return para(inner, o2);
  };
  const H1 = (text, brk = true) => para(run(text), { style: 'Heading1', pageBreakBefore: brk });
  const H2 = (text) => para(run(text), { style: 'Heading2', firstLine: 0, before: 240 });
  const body = [];

  // ── шапка + дайындық жоспары ─────────────────────────────────────────
  body.push(C(t.doc, { bold: true, size: 32 }, { after: 240 }));
  body.push(C(`${t.topic}: «${o.title || ''}»`, { bold: true, size: 28 }, { after: 120 }));
  const who = [meta.performedBy ? `${t.speaker}: ${meta.performedBy}` : '', meta.group ? `${t.group}: ${meta.group}` : ''].filter(Boolean).join(' · ');
  if (who) body.push(C(who, {}, { after: 60 }));
  body.push(C(t.time(speakingMinutes(notes), slides.length), { italic: true, size: 24 }, { after: 300 }));
  body.push(H2(t.planTitle));
  t.plan.forEach(([head, rest], k) => body.push(L(run(`${k + 1}. ${head}`, { bold: true }) + run(rest), { left: 360, hanging: 360 })));

  // ── 1. ТҮСІН ─────────────────────────────────────────────────────────
  const ov = (study && study.overview) || {};
  const gl = (study && study.glossary) || [];
  if (ov.core || ov.simple || ov.analogy || gl.length) {
    body.push(H1(t.s1, false)); // жоспармен бір бетте — қағаз үнемі
    if (ov.core) { body.push(H2(t.core)); body.push(P(ov.core, { bold: true }, { firstLine: 0 })); }
    if (ov.simple) { body.push(H2(t.simple)); body.push(P(ov.simple)); }
    if (ov.analogy) { body.push(H2(t.analogy)); body.push(P(ov.analogy, { italic: true })); }
    if (gl.length) {
      body.push(H2(t.glossary));
      gl.forEach((g) => body.push(L(run(g.term, { bold: true }) + run(' — ' + g.meaning))));
    }
  }

  // ── 2. ЖОСПАР (шпаргалка) ────────────────────────────────────────────
  const rows = slides.map((s, i) => ({ s, n: notes[i], i })).filter((x) => x.n);
  if (rows.length) {
    body.push(H1(t.s2));
    body.push(P(t.s2hint, { italic: true, size: 24 }, { firstLine: 0, after: 200 }));
    rows.forEach(({ s, n, i }) => {
      const title = String((s && s.title) || '').trim();
      body.push(L(run(`${i + 1}. ${title}`, { bold: true, size: 26 }), { after: 0, keepNext: true }));
      const cues = Array.isArray(n.cues) && n.cues.length ? n.cues.join(' · ') : '';
      body.push(L((n.point ? run('► ' + n.point, { size: 26 }) : '') + (cues ? run('   [' + cues + ']', { italic: true, size: 24 }) : ''), { left: 360, after: 140 }));
    });
  }

  // ── 3. АЙТ ───────────────────────────────────────────────────────────
  if (rows.length) {
    body.push(H1(t.s3));
    body.push(H2(t.tipsTitle));
    t.tips.forEach((tip) => body.push(L(run('• ' + tip), { left: 360, hanging: 240 })));
    body.push(P(t.how, { italic: true, size: 24 }, { firstLine: 0, before: 200, after: 240 }));
    rows.forEach(({ s, n, i }) => {
      const title = String((s && s.title) || '').trim();
      body.push(para(run(`${t.slide} ${i + 1}. ${title}`), { style: 'Heading2', firstLine: 0, before: 240 }));
      if (n.point) body.push(P('► ' + n.point, { bold: true }, { firstLine: 0, after: 60 }));
      if (Array.isArray(n.cues) && n.cues.length) body.push(P(`${t.keys}: ${n.cues.join(' · ')}`, { italic: true, size: 24 }, { firstLine: 0 }));
      body.push(P(n.speech));
    });
  }

  // ── 4. ҚОРҒА ─────────────────────────────────────────────────────────
  if (study && study.questions && study.questions.length) {
    body.push(H1(t.s4));
    study.questions.forEach((q, k) => {
      body.push(para(run(`${k + 1}. ${q.q}`, { bold: true }), { line: 360, firstLine: 0, before: 120, after: 60, keepNext: true }));
      body.push(para(run(t.answer + ': ', { italic: true }) + run(q.a), { line: 360, firstLine: 0, after: 120 }));
    });
    body.push(P(t.unknown, { italic: true, size: 24 }, { firstLine: 0, before: 240 }));
  }

  // ── 5. ТЕКСЕР: квиз ──────────────────────────────────────────────────
  if (quiz.length) {
    body.push(H1(t.s5));
    body.push(P(t.quizHint, { italic: true, size: 24 }, { firstLine: 0, after: 200 }));
    quiz.forEach((q, k) => {
      body.push(L(run(`${k + 1}. ${q.q}`, { bold: true }), { before: 160, after: 40, keepNext: true }));
      q.options.forEach((opt, j) => body.push(L(run(`${LETTERS[j]}) ${opt}`), { left: 360, after: 0, keepNext: j < 3 })));
    });
    body.push(para(run(t.answers), { style: 'Heading2', firstLine: 0, pageBreakBefore: true }));
    quiz.forEach((q, k) => {
      body.push(L(run(`${k + 1} — ${LETTERS[q.correct]}) ${q.options[q.correct]}`, { bold: true }) + (q.explain ? run('. ' + q.explain) : '')));
    });
    if (o.quizLinks && o.quizLinks.host) {
      body.push(H2(t.classTitle));
      body.push(P(t.classQuiz, {}, { firstLine: 0 }));
      body.push(L(run(t.hostLink, { italic: true, size: 24 }), { after: 40 }));
      body.push(L(run(o.quizLinks.host, { size: 24 }), { after: 160 }));
      if (o.quizLinks.player) {
        body.push(L(run(t.playerLink, { italic: true, size: 24 }), { after: 40 }));
        body.push(L(run(o.quizLinks.player, { size: 24 })));
      }
    }
  }
  return packDocx(lang, o.title || t.doc, body.join(''));
}

module.exports = { buildSpeechDocx, langCode, guessLang };
