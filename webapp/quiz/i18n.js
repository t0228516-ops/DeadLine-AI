/* Квиз беттерінің мәтіні: kk / ru / en (тіл — презентация тілі) */
window.QUIZ_I18N = {
  kk: {
    rightAnsShort: 'Дұрыс жауап',
   
   
    resultsTitle: 'Нәтижелер', resultsBtn: (n) => `📋 Нәтижелер (${n})`, colName: 'Аты', colRight: 'Дұрыс', modeLive: 'проектор', modeSolo: 'телефон',
    noResults: 'Әзірге ешкім өтпеді. Сілтемені топтың чатына жіберіңіз.', close: 'Жабу', shareHint: 'Сілтеме:',
    stop: '⏹ Тоқтату', allAnswered: 'Барлығы жауап берді', timeUp: 'Уақыт бітті', answeredOf: (n, m) => `Жауап берді: ${n} / ${m}`,
    atEnd: 'дұрыс жауаптар соңында ашылады', nextQ: 'Келесі сұрақ →', reviewGo: 'Жауаптарды талдау →', reviewOf: (i, n) => `Талдау · ${i} / ${n}`,
    hardBadge: '🔥 Топ ең қиналған сұрақ — қайта түсіндіріңіз', classPct: (p) => `Топтың ${p}%-ы дұрыс тапты`, back: '← Артқа',
    atEndShort: 'Дұрыс-қатесі ойын соңында көрсетіледі', waitNext: 'Экранға қараңыз — келесі сұрақ жақында. Нәтижеңізді соңында көресіз.',
    quiz: 'Квиз', questions: (n) => `${n} сұрақ`, of: (i, n) => `${i} / ${n}`,
    lobbyTitle: 'Телефоныңызды алыңыз 📱', steps: ['Камерамен QR кодты сканерлеңіз', 'Атыңызды жазыңыз', 'Сұрақтар экранда шығады — жауабын телефоннан басыңыз'],
    start: '▶ Бастау', players: (n) => `${n} қатысушы`, noPlayers: 'Қатысушылар күтілуде…',
    answered: 'жауап берді', next: 'Келесі →', results: 'Нәтиже →', again: '↺ Қайта ойнау', getReady: 'Дайындалыңыз!',
    top: 'Үздіктер 🏆', avg: 'орташа дұрыс жауап', hardest: 'Топ ең қиналған сұрақ', hardHint: 'Осыны тағы бір рет түсіндіріп жіберіңіз.',
    pct: (p) => `${p}% дұрыс`, allRight: 'Барлық сұраққа топ жақсы жауап берді 👏',
    badKey: 'Проектор сілтемесі қате. Презентацияның соңғы слайдындағы «Квизді бастау» батырмасын қайта басыңыз.',
    notFound: 'Квиз табылмады немесе мерзімі өтіп кетті.', offline: 'Байланыс үзілді — қайта қосылуда…', fullscreen: '⛶ Толық экран',
    joinTitle: 'Квизге қосылу', name: 'Атыңыз', join: 'Қосылу →', noReg: 'Тіркелу қажет емес',
    joined: (n) => `Сіз қосылдыңыз, ${n}!`, lookScreen: 'Баяндамашы квизді бастағанда сұрақтар осы жерде шығады. Экранға қараңыз.',
    accepted: 'Жауабыңыз қабылданды', tooLate: 'Уақыт бітті',
    noAnswer: 'Жауап берілмеді', theAnswer: 'Дұрыс жауап:',
    place: (r, n) => `Сіз ${r}-орындасыз (${n} қатысушы)`, points: 'ұпай', right: 'дұрыс',
    over: 'Квиз аяқталды!', review: 'Сұрақтар мен жауаптар', yours: 'Сіздің жауабыңыз:',
   
   
    full: 'Бұл квизде орын қалмады.', made: 'DeadLine-да жасалды',
  },
  ru: {
    rightAnsShort: 'Верный ответ',
   
   
    resultsTitle: 'Результаты', resultsBtn: (n) => `📋 Результаты (${n})`, colName: 'Имя', colRight: 'Верно', modeLive: 'проектор', modeSolo: 'телефон',
    noResults: 'Пока никто не прошёл. Отправьте ссылку в чат группы.', close: 'Закрыть', shareHint: 'Ссылка:',
    stop: '⏹ Стоп', allAnswered: 'Все ответили', timeUp: 'Время вышло', answeredOf: (n, m) => `Ответили: ${n} / ${m}`,
    atEnd: 'верные ответы — в конце', nextQ: 'Следующий вопрос →', reviewGo: 'Разбор ответов →', reviewOf: (i, n) => `Разбор · ${i} / ${n}`,
    hardBadge: '🔥 Самый трудный вопрос — объясните ещё раз', classPct: (p) => `Верно ответили ${p}% группы`, back: '← Назад',
    atEndShort: 'Верно или нет — покажем в конце игры', waitNext: 'Смотрите на экран — скоро следующий вопрос. Результат увидите в конце.',
    quiz: 'Квиз', questions: (n) => `${n} вопросов`, of: (i, n) => `${i} / ${n}`,
    lobbyTitle: 'Возьмите телефоны 📱', steps: ['Отсканируйте QR-код камерой', 'Введите своё имя', 'Вопросы появятся на экране — отвечайте с телефона'],
    start: '▶ Начать', players: (n) => `участников: ${n}`, noPlayers: 'Ждём участников…',
    answered: 'ответили', next: 'Дальше →', results: 'Итоги →', again: '↺ Сыграть снова', getReady: 'Приготовьтесь!',
    top: 'Лучшие 🏆', avg: 'верных в среднем', hardest: 'Самый трудный вопрос для группы', hardHint: 'Объясните его ещё раз.',
    pct: (p) => `${p}% верно`, allRight: 'Группа хорошо ответила на все вопросы 👏',
    badKey: 'Неверная ссылка проектора. Нажмите кнопку «Начать квиз» на последнем слайде ещё раз.',
    notFound: 'Квиз не найден или срок его действия истёк.', offline: 'Нет связи — переподключаемся…', fullscreen: '⛶ Полный экран',
    joinTitle: 'Войти в квиз', name: 'Ваше имя', join: 'Войти →', noReg: 'Регистрация не нужна',
    joined: (n) => `Вы в игре, ${n}!`, lookScreen: 'Когда докладчик начнёт квиз, вопросы появятся здесь. Смотрите на экран.',
    accepted: 'Ответ принят', tooLate: 'Время вышло',
    noAnswer: 'Нет ответа', theAnswer: 'Верный ответ:',
    place: (r, n) => `Вы на ${r}-м месте (участников: ${n})`, points: 'очков', right: 'верно',
    over: 'Квиз окончен!', review: 'Вопросы и ответы', yours: 'Ваш ответ:',
   
   
    full: 'В этом квизе нет мест.', made: 'Сделано в DeadLine',
  },
  en: {
    rightAnsShort: 'Right answer',
   
   
    resultsTitle: 'Results', resultsBtn: (n) => `📋 Results (${n})`, colName: 'Name', colRight: 'Right', modeLive: 'projector', modeSolo: 'phone',
    noResults: 'Nobody has played yet. Send the link to the group chat.', close: 'Close', shareHint: 'Link:',
    stop: '⏹ Stop', allAnswered: 'Everyone answered', timeUp: "Time's up", answeredOf: (n, m) => `Answered: ${n} / ${m}`,
    atEnd: 'right answers are shown at the end', nextQ: 'Next question →', reviewGo: 'Review answers →', reviewOf: (i, n) => `Review · ${i} / ${n}`,
    hardBadge: '🔥 The hardest question — explain it again', classPct: (p) => `${p}% of the group got it right`, back: '← Back',
    atEndShort: 'Right or wrong — you will see at the end', waitNext: 'Look at the screen — the next question is coming. Your result is shown at the end.',
    quiz: 'Quiz', questions: (n) => `${n} questions`, of: (i, n) => `${i} / ${n}`,
    lobbyTitle: 'Grab your phones 📱', steps: ['Scan the QR code with your camera', 'Type your name', 'Questions appear on the screen — answer on your phone'],
    start: '▶ Start', players: (n) => `${n} players`, noPlayers: 'Waiting for players…',
    answered: 'answered', next: 'Next →', results: 'Results →', again: '↺ Play again', getReady: 'Get ready!',
    top: 'Top players 🏆', avg: 'right answers on average', hardest: 'The question the group found hardest', hardHint: 'Explain it once more.',
    pct: (p) => `${p}% right`, allRight: 'The group answered every question well 👏',
    badKey: 'Wrong projector link. Click "Start quiz" on the last slide again.',
    notFound: 'Quiz not found or expired.', offline: 'Connection lost — reconnecting…', fullscreen: '⛶ Full screen',
    joinTitle: 'Join the quiz', name: 'Your name', join: 'Join →', noReg: 'No sign-up needed',
    joined: (n) => `You are in, ${n}!`, lookScreen: 'When the presenter starts the quiz, the questions appear here. Look at the screen.',
    accepted: 'Answer received', tooLate: "Time's up",
    noAnswer: 'No answer', theAnswer: 'Right answer:',
    place: (r, n) => `You are #${r} of ${n}`, points: 'points', right: 'right',
    over: 'Quiz finished!', review: 'Questions and answers', yours: 'Your answer:',
   
   
    full: 'This quiz is full.', made: 'Made with DeadLine',
  },
};
window.QUIZ_SHAPES = ['▲', '◆', '●', '■'];
window.qEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Сақтандыру: мобильді желіде fetch кейде мәңгі «ілініп» қалады → бет қатып қалады. Әр сұрауға уақыт шегі. */
window.qFetch = function (url, opts, ms) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => { if (ctl) ctl.abort(); }, ms || 8000);
  return fetch(url, Object.assign({ cache: 'no-store' }, opts || {}, ctl ? { signal: ctl.signal } : {})).finally(() => clearTimeout(t));
};
/* localStorage кейбір in-app браузерлерде (жеке режим) қате лақтырады — ойын бұзылмасын */
window.qStore = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* жоқ болса — жай ғана сақталмайды */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* — */ } },
};
