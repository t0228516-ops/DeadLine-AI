/* Телефон беті.
 *  • тірі ойын: атын жазып қосылады → экранға қарайды → түсті батырманы басады → дұрыс/қате + түсіндірме → соңында орны мен шолу;
 *  • өз бетімен (проектор жоқ): уақытсыз, әр жауаптан кейін бірден дұрыс жауап пен түсіндірме — үйрену режимі.
 * Қосылу деректері localStorage-та: бет жаңарса не телефон ұйықтап қалса — сол ойыншы болып жалғасады. */
(function () {
  'use strict';
  const code = (location.pathname.match(/\/q\/([A-Za-z0-9]+)/) || [])[1].toUpperCase();
  const api = '/api/quiz/' + code;
  const app = document.getElementById('app');
  const S = window.QUIZ_SHAPES; const esc = window.qEsc;
  const store = 'dlquiz:' + code;
  let T = window.QUIZ_I18N.kk;
  let info = null; let me = null; let st = null; let gotAt = 0; let shown = ''; let sending = false; let timer = null;

  function setLang(l) {
    T = window.QUIZ_I18N[l] || window.QUIZ_I18N.kk;
    document.documentElement.lang = l || 'kk';
    document.getElementById('brand').textContent = T.made;
  }
  const top = (right) => '<div class="top"><span>🎯 ' + esc((info && info.topic) || T.quiz) + '</span><span>' + esc(right || '') + '</span></div>';

  async function boot() {
    try {
      const r = await fetch(api + '/info', { cache: 'no-store' });
      if (!r.ok) { setLang('kk'); app.innerHTML = top() + '<div class="center"><div class="wait">🔍</div><p class="note">' + esc(T.notFound) + '</p></div>'; return; }
      info = await r.json(); setLang(info.lang);
    } catch { setLang('kk'); app.innerHTML = '<div class="center"><p class="note">' + esc(T.offline) + '</p></div>'; setTimeout(boot, 3000); return; }
    try { me = JSON.parse(localStorage.getItem(store) || 'null'); } catch { me = null; }
    if (location.hash === '#solo') return solo();
    if (me && me.pid) return poll();
    joinScreen();
  }

  function joinScreen(msg) {
    shown = 'join';
    app.innerHTML = top(T.questions(info.total)) + '<div class="center"><h1>' + esc(T.joinTitle) + '</h1>'
      + '<input class="inp" id="nm" maxlength="20" autocomplete="nickname" placeholder="' + esc(T.name) + '">'
      + '<button class="btn" id="jb">' + esc(T.join) + '</button>'
      + '<p class="note">' + esc(msg || T.noReg) + '</p>'
      + '<a class="link" href="#solo" id="sl">' + esc(T.solo) + '</a></div>';
    const nm = document.getElementById('nm'); const jb = document.getElementById('jb');
    nm.value = localStorage.getItem('dlquiz:name') || '';
    const go = async () => {
      const name = nm.value.trim();
      if (!name) { nm.focus(); return; }
      jb.disabled = true;
      try {
        const r = await fetch(api + '/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        const j = await r.json();
        if (!r.ok) { jb.disabled = false; return joinScreen(j.error === 'full' ? T.full : T.offline); }
        me = { pid: j.pid, s: j.secret, name: j.name };
        localStorage.setItem(store, JSON.stringify(me)); localStorage.setItem('dlquiz:name', name);
        poll();
      } catch { jb.disabled = false; }
    };
    jb.onclick = go;
    nm.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    document.getElementById('sl').onclick = (e) => { e.preventDefault(); location.hash = 'solo'; solo(); };
  }

  async function poll() {
    clearTimeout(timer);
    try {
      const r = await fetch(api + '/state?pid=' + encodeURIComponent(me.pid) + '&s=' + encodeURIComponent(me.s), { cache: 'no-store' });
      if (r.status === 404) { app.innerHTML = top() + '<div class="center"><p class="note">' + esc(T.notFound) + '</p></div>'; return; }
      const s = await r.json();
      if (!s.joined) { localStorage.removeItem(store); me = null; return joinScreen(); } // сервер қайта қосылған — қайта кіреміз
      st = s; gotAt = performance.now(); render();
    } catch { /* желі үзілсе — қайталаймыз */ }
    timer = setTimeout(poll, st && st.phase === 'question' ? 700 : 1200);
  }

  const left = () => Math.max(0, (st.remainingMs || 0) - (performance.now() - gotAt));
  const waitLeft = () => Math.max(0, (st.waitMs || 0) - (performance.now() - gotAt));

  async function pick(i) {
    if (sending || st.myChoice != null) return;
    sending = true;
    st.myChoice = i; render(true);
    if (navigator.vibrate) navigator.vibrate(30);
    try {
      const r = await fetch(api + '/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pid: me.pid, s: me.s, qi: st.qi, choice: i }) });
      const j = await r.json();
      if (j.state) { st = j.state; gotAt = performance.now(); }
      else if (!r.ok && j.error !== 'twice') { st.myChoice = null; st.late = true; }
    } catch { st.myChoice = null; }
    sending = false; render(true);
  }

  function render(force) {
    if (!st) return;
    const key = st.phase + ':' + st.qi + ':' + (st.myChoice != null) + ':' + (waitLeft() > 0);
    if (!force && key === shown && st.phase !== 'question') return;
    if (st.phase === 'lobby') {
      if (shown === key) return; shown = key;
      app.innerHTML = top(T.questions(st.total)) + '<div class="center"><div class="wait">👀</div><h1 style="text-align:center">' + esc(T.joined(st.me.name)) + '</h1><p class="note">' + esc(T.lookScreen) + '</p></div>';
      return;
    }
    if (st.phase === 'question') {
      const q = st.question;
      if (waitLeft() > 0) {
        if (shown !== key) { shown = key; app.innerHTML = top(T.of(st.qi + 1, st.total)) + '<div class="center"><div class="wait">⏳</div><h1 style="text-align:center">' + esc(T.getReady) + '</h1><p class="pq" style="text-align:center">' + esc(q.q) + '</p></div>'; }
        return;
      }
      if (shown !== key || force) {
        shown = key;
        const done = st.myChoice != null;
        app.innerHTML = top(T.of(st.qi + 1, st.total)) + '<div class="tbar"><i id="tb"></i></div>'
          + '<div class="pq">' + esc(q.q) + '</div>'
          + q.options.map((o, i) => '<button class="popt c' + i + (done ? (i === st.myChoice ? ' picked' : ' dim') : '') + '" data-i="' + i + '"' + (done ? ' disabled' : '') + '><i class="shape">' + S[i] + '</i>' + esc(o) + '</button>').join('')
          + (done ? '<p class="note">✓ ' + esc(T.accepted) + ' · ' + esc(T.atEndShort) + '</p>' : (st.late ? '<p class="note">' + esc(T.tooLate) + '</p>' : ''));
        app.querySelectorAll('.popt').forEach((b) => { b.onclick = () => pick(Number(b.dataset.i)); });
      }
      return;
    }
    if (st.phase === 'closed') {
      // дұрыс-қатесі ойын соңында ғана — мұнда тек «қабылданды» не «уақыт бітті»
      if (shown === key) return; shown = key;
      const q = st.question; const got = st.myChoice != null;
      app.innerHTML = top(T.of(st.qi + 1, st.total)) + '<div class="res none">'
        + (got ? '<div class="ic">✓</div><h2>' + esc(T.accepted) + '</h2><div class="ans">' + S[st.myChoice] + ' ' + esc(q.options[st.myChoice]) + '</div>'
          : '<div class="ic">⌛</div><h2>' + esc(T.tooLate) + '</h2>')
        + '<div class="ex">' + esc(T.waitNext) + '</div></div>';
      return;
    }
    if (st.phase === 'end' || st.phase === 'review') {
      if (shown === 'final') return; // проектордағы талдау беттері ауысқанда телефондағы нәтиже қайта салынбайды
      shown = 'final';
      app.innerHTML = top(T.quiz) + finalHtml(st.me.rank, st.me.of, st.me.right, st.total, st.me.score) + reviewHtml(st.review);
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    }
  }

  function finalHtml(rank, of, right, total, score) {
    return '<div class="final"><h1>' + esc(T.over) + '</h1>'
      + (rank ? '<div class="place">#' + rank + '</div><div class="of">' + esc(T.place(rank, of)) + '</div>' : '<div class="place">' + right + '/' + total + '</div><div class="of">' + esc(T.soloScore(right, total)) + '</div>')
      + (rank ? '<div class="sc"><div><b>' + right + ' / ' + total + '</b>' + esc(T.right) + '</div><div><b>' + score + '</b>' + esc(T.points) + '</div></div>' : '') + '</div>';
  }

  function reviewHtml(list) {
    return '<div class="review"><h3>' + esc(T.review) + '</h3>' + (list || []).map((r, i) => '<div class="rv ' + (r.ok ? 'is-ok' : 'is-bad') + '"><div class="q"><span class="mk">' + (r.ok ? '✓' : '✕') + '</span>' + (i + 1) + '. ' + esc(r.q) + '</div>'
      + (r.ok ? '<div class="a ok">' + esc(T.yours) + ' ' + esc(r.answer) + '</div>'
        : (r.mine ? '<div class="a bad">' + esc(T.yours) + ' ' + esc(r.mine) + '</div>' : '<div class="a bad">' + esc(T.noAnswer) + '</div>')
          + '<div class="a ok">' + esc(T.theAnswer) + ' ' + esc(r.answer) + '</div>')
      + (r.explain ? '<div class="e">' + esc(r.explain) + '</div>' : '') + '</div>').join('') + '</div>';
  }

  // таймер жолағы
  (function frame() {
    if (st && st.phase === 'question') {
      if (waitLeft() <= 0 && shown.endsWith(':true')) render();
      const tb = document.getElementById('tb');
      if (tb && st.durMs) tb.style.width = Math.min(100, (left() / st.durMs) * 100) + '%';
    }
    requestAnimationFrame(frame);
  })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && me && st) poll(); });

  // ── өз бетімен (проекторсыз): үйрену режимі ─────────────────────────
  async function solo() {
    clearTimeout(timer);
    let data;
    try {
      const r = await fetch(api + '/solo', { cache: 'no-store' });
      if (r.status === 409) { location.hash = ''; return joinScreen(T.liveNow); }
      data = await r.json();
    } catch { return joinScreen(T.offline); }
    const qs = data.questions || []; const res = [];
    let i = 0;
    const prog = () => '<div class="prog">' + qs.map((_, k) => '<i class="' + (k < res.length ? 'done' : k === i ? 'cur' : '') + '"></i>').join('') + '</div>';
    const ask = () => {
      const q = qs[i];
      app.innerHTML = top(T.of(i + 1, qs.length)) + prog() + '<div class="pq">' + esc(q.q) + '</div>'
        + q.options.map((o, k) => '<button class="popt c' + k + '" data-k="' + k + '"><i class="shape">' + S[k] + '</i>' + esc(o) + '</button>').join('')
        + '<p class="note">' + esc(T.atEndShort) + '</p>';
      app.querySelectorAll('.popt').forEach((b) => { b.onclick = () => answer(Number(b.dataset.k)); });
    };
    // дұрыс-қатесі ойын соңында (тірі ойындағыдай): таңдалғаны белгіленіп, келесі сұраққа өтеді
    const answer = (k) => {
      const q = qs[i];
      res.push({ ok: k === q.correct, mine: q.options[k] });
      app.querySelectorAll('.popt').forEach((b) => { b.disabled = true; b.classList.add(Number(b.dataset.k) === k ? 'picked' : 'dim'); });
      setTimeout(() => { i += 1; if (i < qs.length) ask(); else done(); }, 450);
    };
    const done = () => {
      const right = res.filter((r) => r.ok).length;
      app.innerHTML = top(T.soloTitle) + finalHtml(0, 0, right, qs.length, null)
        + '<button class="btn alt" id="ag" style="margin-top:16px">' + esc(T.soloAgain) + '</button>'
        + reviewHtml(qs.map((q, k) => ({ q: q.q, answer: q.options[q.correct], explain: q.explain, mine: res[k] && res[k].mine, ok: res[k] && res[k].ok })));
      document.getElementById('ag').onclick = () => { res.length = 0; i = 0; ask(); };
    };
    ask();
  }

  boot();
})();
