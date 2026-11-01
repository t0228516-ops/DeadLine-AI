'use strict';
const test = require('node:test');
const assert = require('node:assert');
const JSZip = require('jszip');
const { generateSpeakerNotes, applySpeakerNotes, speakingMinutes } = require('../products/presentation/speakerNotes');
const { buildSpeechDocx } = require('../products/presentation/speechDoc');

const slides = [
  { title: 'Цифрлық экономика', subtitle: 'Болашақтың кілті', bullets: ['Орындаған: Асан'] },
  { title: 'Негізгі ұғымдар', bullets: ['Блокчейн: үлестірілген тізілім', 'Бұлт: қашықтағы есептеу'] },
  { title: 'Сандар', stats: [{ value: '72%', label: 'интернет қолданушылар' }] },
  { title: 'Қорытынды', bullets: ['Цифрландыру — басымдық'] },
];
const speech = (n) => `Құрметті тыңдаушылар, ${n}-слайдта біз маңызды мәселені талқылаймыз. Бұл ұғымды қарапайым мысалмен түсіндірейін: күнделікті өмірде біз оны жиі кездестіреміз, бірақ мәнін ойламаймыз. Келесі бөлімде мұны тереңірек қарастырамыз.`;

function fakeLlm(calls) {
  return async (system, user, label) => {
    calls.push({ label, user });
    if (label === 'studyGuide') {
      return {
        core: 'Цифрлық экономика — деректер мен интернетке сүйенген шаруашылық.',
        simple: 'Бұрын бәрі қағазбен жүрді. Енді төлем, құжат, сауда телефон арқылы өтеді.',
        analogy: 'Бұл қағаз хаттан мессенджерге көшкендей.',
        glossary: [{ term: 'Блокчейн', meaning: 'Деректерді көп компьютерде бірдей сақтайтын тізілім.' }], questions: [{ q: 'Неге цифрландыру маңызды?', a: 'Ол уақыт пен шығынды азайтады.' }],
      };
    }
    if (label === 'classQuiz') {
      return { quiz: Array.from({ length: 10 }, (_, k) => ({ q: `Сұрақ нөмірі ${k + 1}: не дұрыс?`, options: ['Дұрыс жауап ' + k, 'Қате А' + k, 'Қате Б' + k, 'Қате В' + k], correct: 0, explain: 'Себебі слайдта солай.' })) };
    }
    const ns = JSON.parse(user.slice(user.indexOf('Slides:') + 7, user.lastIndexOf('Return')).trim()).map((f) => f.n);
    return { notes: ns.map((n) => ({ n, point: `**Басты ой ${n}**`, cues: ['кілт ' + n, 'сөз'], speech: speech(n) })) };
  };
}

test('notes for every slide + study guide; prompt carries the slide facts and the speaker name', async () => {
  const calls = [];
  const r = await generateSpeakerNotes({ slides, title: 'Цифрлық экономика', topic: 'Цифрлық экономика', language: 'Kazakh', coverMeta: { performedBy: 'Асан' }, llm: fakeLlm(calls) });
  assert.strictEqual(r.ok, 4);
  assert.strictEqual(r.notes[1].point, 'Басты ой 2', 'markdown stripped');
  assert.ok(r.study.glossary.length === 1 && r.study.questions.length === 1);
  assert.ok(/мессенджер/.test(r.study.overview.analogy) && r.study.overview.core);
  assert.deepStrictEqual(r.notes[1].cues, ['кілт 2', 'сөз']);
  assert.strictEqual(r.quiz.length, 10, 'class quiz parsed');
  const qCall = calls.find((c) => c.label === 'classQuiz');
  assert.ok(qCall && /ONLY facts/.test(qCall.user) && /Kazakh/.test(qCall.user), 'quiz prompt: facts only, language');
  const nCall = calls.find((c) => c.label.startsWith('speakerNotes'));
  assert.ok(/Асан/.test(nCall.user) && /72%/.test(nCall.user) && /Kazakh/.test(nCall.user));
  assert.strictEqual(applySpeakerNotes(slides.map((s) => ({ ...s })), r.notes), 4);
  assert.ok(speakingMinutes(r.notes) >= 1);
});

test('a failing or short answer never breaks the deck', async () => {
  const bad = await generateSpeakerNotes({ slides, title: 'T', llm: async () => { throw new Error('down'); } });
  assert.strictEqual(bad.ok, 0); assert.strictEqual(bad.study, null);
  assert.deepStrictEqual(bad.notes, [null, null, null, null]);
  const short = await generateSpeakerNotes({ slides, title: 'T', llm: async (s, u, label) => (label === 'studyGuide' ? {} : { notes: [{ n: 1, speech: 'тым қысқа' }] }) });
  assert.strictEqual(short.ok, 0);
});

test('slides get PPTX notes text with the key idea first', () => {
  const sl = [{ title: 'A' }, { title: 'B' }];
  applySpeakerNotes(sl, [{ point: 'Басты ой', speech: speech(1) }, null]);
  assert.ok(sl[0].speakerNotes.startsWith('► Басты ой\n\n'));
  assert.strictEqual(sl[1].speakerNotes, undefined);
});

test('speech .docx: per-slide script, glossary and teacher questions', async () => {
  const r = await generateSpeakerNotes({ slides, title: 'Цифрлық экономика', language: 'Kazakh', llm: fakeLlm([]) });
  const links = { player: 'https://x.app/q/ABCDE', host: 'https://x.app/q/ABCDE/host?k=key' };
  const buf = buildSpeechDocx({ title: 'Цифрлық экономика', slides, notes: r.notes, study: r.study, language: 'Kazakh', coverMeta: { performedBy: 'Асан', group: 'ТК-21' }, quiz: r.quiz, quizLinks: links });
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  // сабақ ретімен: түсін → жоспар → айт → қорға → тексер
  const order = ['БАЯНДАМАҒА ДАЙЫНДЫҚ', 'Осы құжатпен қалай дайындалу керек', '1. Тақырып қарапайым тілмен', 'қағаз хаттан мессенджерге', 'Негізгі терминдер',
    '2. Баяндама жоспары', '[кілт 2 · сөз]', '3. Сөйлейтін мәтін', 'Сөйлеу кеңестері', 'Слайд 2. Негізгі ұғымдар', '► Басты ой 3', 'Кілт сөздер: кілт 3 · сөз',
    '4. Мұғалім қоюы мүмкін сұрақтар', 'Жауабын білмесеңіз', '5. Өзіңді тексер: квиз', 'Жауаптар', 'Квизді сыныппен ойнау', links.host];
  let at = -1;
  for (const s of order) { const i = xml.indexOf(s, at + 1); assert.ok(i > at, 'order: ' + s); at = i; }
  for (const s of ['Баяндамашы: Асан', 'Блокчейн', 'A) ', 'D) ']) assert.ok(xml.includes(s), s);
  assert.ok(!/w:firstLine="0" w:hanging/.test(xml), 'no firstLine+hanging together');
  const ru = await JSZip.loadAsync(buildSpeechDocx({ title: 'Экономика', slides, notes: r.notes, study: null, language: 'Russian' }));
  const rx = await ru.file('word/document.xml').async('string');
  assert.ok(rx.includes('ПОДГОТОВКА К ДОКЛАДУ') && !rx.includes('Квиз вместе с классом'), 'ru, no quiz section without quiz');
});

test('clients (pedagogy:false): classic prompts, no class quiz call, classic «Баяндама мәтіні»', async () => {
  const calls = [];
  const r = await generateSpeakerNotes({ slides, title: 'Цифрлық экономика', language: 'Kazakh', llm: fakeLlm(calls), pedagogy: false });
  assert.ok(!calls.some((c) => c.label === 'classQuiz'), 'no quiz call for clients');
  assert.ok(!calls.some((c) => /"cues"/.test(c.user) || /12-year-old/.test(c.user)), 'classic prompts');
  assert.deepStrictEqual(r.quiz, []);
  const xml = await (await JSZip.loadAsync(buildSpeechDocx({ title: 'Т', slides, notes: r.notes, study: r.study, language: 'Kazakh', pedagogy: false }))).file('word/document.xml').async('string');
  assert.ok(xml.includes('БАЯНДАМА МӘТІНІ') && xml.includes('Мұғалім қоюы мүмкін сұрақтар') && !xml.includes('БАЯНДАМАҒА ДАЙЫНДЫҚ') && !xml.includes('Өзіңді тексер'));
});
