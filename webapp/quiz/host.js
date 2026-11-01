/* Басқару беті (баяндамашы): ноутбук→проектор да, телефон да.
 * Лобби (QR, қосылғандар) → сұрақ (таймер) → «қабылданды» (жауап ашылмайды) → … → үздіктер → жауаптарды талдау.
 * Ойынды бастау мен келесі сұраққа өту — ТЕК осы беттен (иесінің шешімі). «📋 Нәтижелер» — кім неше сұраққа дұрыс жауап берді.
 * Күй серверде; бет 0,6–0,9 с сайын сұрайды. Таймер жергілікті сағатпен тегіс жүреді (сервер берген қалған уақыттан). */
(function () {
  'use strict';
  const code = (location.pathname.match(/\/q\/([A-Za-z0-9]+)/) || [])[1].toUpperCase();
  const key = new URLSearchParams(location.search).get('k') || '';
  const api = '/api/quiz/' + code;
  const $ = (id) => document.getElementById(id);
  const S = window.QUIZ_SHAPES; const esc = window.qEsc;
  let T = window.QUIZ_I18N.kk;
  let st = null; let gotAt = 0; let shown = ''; let busy = false; let fails = 0; let lastNames = -1;
  let resCount = 0; let ovOpen = false; let ovTimer = null;

  function setLang(l) {
    T = window.QUIZ_I18N[l] || window.QUIZ_I18N.kk;
    document.documentElement.lang = l || 'kk';
    $('fs').textContent = T.fullscreen; $('brand').textContent = T.made;
    $('resBtn').textContent = T.resultsBtn(resCount);
  }
  setLang('kk');

  $('fs').onclick = () => {
    const d = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen().catch(() => {});
  };
  $('resBtn').onclick = () => openResults();

  async function act(action) {
    if (busy) return; busy = true;
    try {
      const r = await fetch(api + '/host', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: key, action }) });
      const j = await r.json();
      if (j.state) take(j.state);
      if (j.state && j.state.phase === 'end') setTimeout(loadCount, 800);
    } catch { /* келесі сұрауда жаңарады */ } finally { busy = false; }
  }

  function take(s) { st = s; gotAt = performance.now(); render(); }

  async function poll() {
    try {
      const r = await fetch(api + '/host/state?k=' + encodeURIComponent(key), { cache: 'no-store' });
      if (r.status === 403) return fatal(T.badKey);
      if (r.status === 404) return fatal(T.notFound);
      take(await r.json()); fails = 0;
    } catch {
      fails += 1;
      if (fails > 3) { shown = ''; $('screen').innerHTML = '<div class="err">' + esc(T.offline) + '</div>'; }
    }
    setTimeout(poll, st && st.phase === 'question' ? 600 : 900);
  }
  function fatal(msg) { $('screen').innerHTML = '<div class="err">' + esc(msg) + '</div>'; $('ctrl').innerHTML = ''; $('resBtn').classList.add('hidden'); }

  const left = () => Math.max(0, (st.remainingMs || 0) - (performance.now() - gotAt));
  const waitLeft = () => Math.max(0, (st.waitMs || 0) - (performance.now() - gotAt));

  function ctrl(buttons) {
    $('ctrl').innerHTML = buttons.map((b) => '<button class="' + (b.main ? 'bigbtn' : 'ghost') + '" data-a="' + b.a + '">' + esc(b.t) + '</button>').join('');
    $('ctrl').querySelectorAll('button').forEach((el) => { el.onclick = () => act(el.dataset.a); });
  }

  function answersHtml(q, rev, muted) {
    const total = rev ? rev.counts.reduce((a, b) => a + b, 0) : 0;
    return '<div class="answers">' + q.options.map((o, i) => {
      const cls = rev ? (i === rev.correct ? ' ok' : ' dim') : muted ? ' soft' : '';
      const cnt = rev ? '<span class="cnt">' + rev.counts[i] + '</span><span class="fill" style="width:' + (total ? Math.round(rev.counts[i] / total * 100) : 0) + '%"></span>' : '';
      return '<div class="ans c' + i + cls + '"><i class="shape">' + S[i] + '</i><span class="txt">' + esc(o) + '</span>' + cnt + '</div>';
    }).join('') + '</div>';
  }

  function render() {
    if (!st) return;
    if (st.lang && document.documentElement.lang !== st.lang) setLang(st.lang);
    $('topic').textContent = '🎯 ' + (st.topic || T.quiz);
    const key2 = st.phase + ':' + st.qi + ':' + st.version;
    $('badge').textContent = st.phase === 'lobby' ? T.questions(st.total) : st.phase === 'end' ? T.quiz
      : st.phase === 'review' ? T.reviewOf((st.ri || 0) + 1, st.total) : T.of(st.qi + 1, st.total);

    if (st.phase === 'lobby') {
      if (shown !== 'lobby') {
        shown = 'lobby'; lastNames = -1;
        const url = String(st.url || '').replace(/^https?:\/\//, '');
        const cut = url.lastIndexOf('/');
        $('screen').innerHTML = '<div class="lobby"><div>'
          + '<h1>' + esc(T.lobbyTitle) + '</h1><ol>' + T.steps.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>'
          + '<div class="names" id="names"></div>'
          + '<div class="startrow"><span class="pill" id="pc"></span></div>'
          + '</div><div class="qrbox"><div class="card"><img alt="QR" src="' + api + '/qr.svg"></div>'
          + '<div class="url">' + esc(url.slice(0, cut + 1)) + '<b>' + esc(url.slice(cut + 1)) + '</b></div></div></div>';
        ctrl([{ a: 'start', t: T.start, main: true }]);
      }
      if (lastNames !== st.players) {
        lastNames = st.players;
        $('names').innerHTML = (st.names || []).map((n) => '<span class="pill">' + esc(n) + '</span>').join('');
        $('pc').textContent = st.players ? T.players(st.players) : T.noPlayers;
      }
      return;
    }
    if (st.phase === 'question') {
      const q = st.question;
      if (waitLeft() > 0) {
        if (shown !== 'ready' + st.qi) {
          shown = 'ready' + st.qi;
          $('screen').innerHTML = '<div class="ready"><div><div class="n">' + esc(T.of(st.qi + 1, st.total)) + ' · ' + esc(T.getReady) + '</div><div class="q">' + esc(q.q) + '</div></div></div>';
          ctrl([]);
        }
        return;
      }
      if (shown !== 'q' + st.qi) {
        shown = 'q' + st.qi;
        $('screen').innerHTML = '<div class="qhead"><div class="timer" id="tm"><span id="tmn"></span></div>'
          + '<div class="counter"><b id="cnt">0</b>' + esc(T.answered) + '</div></div>'
          + '<div class="qtext">' + esc(q.q) + '</div>' + answersHtml(q, null);
        ctrl([{ a: 'close', t: T.stop }]);
      }
      $('cnt').textContent = st.answered + (st.players ? ' / ' + st.players : '');
      return;
    }
    if (st.phase === 'closed') {
      // дұрыс жауап ашылмайды — тек «жауаптар қабылданды»; келесі сұрақ — баяндамашы басқанда ғана
      if (shown === key2) return;
      shown = key2;
      const q = st.question;
      const all = st.players && st.answered >= st.players;
      $('screen').innerHTML = '<div class="qtext">' + esc(q.q) + '</div>'
        + '<div class="closed"><div class="ic">' + (all ? '✓' : '⏰') + '</div><div class="t">' + esc(all ? T.allAnswered : T.timeUp) + '</div>'
        + '<div class="s">' + esc(T.answeredOf(st.answered, st.players)) + ' · ' + esc(T.atEnd) + '</div></div>'
        + answersHtml(q, null, true);
      ctrl([{ a: 'next', t: st.qi + 1 < st.total ? T.nextQ : T.results, main: true }]);
      return;
    }
    if (st.phase === 'end') {
      if (shown === key2) return;
      shown = key2;
      const medal = ['🥇', '🥈', '🥉'];
      const rows = (st.top || []).slice(0, 5).map((r, i) => '<div class="row' + (i === 0 ? ' r1' : '') + '"><span class="p">' + (medal[i] || (i + 1)) + '</span><span class="nm">' + esc(r.name) + '</span><span class="r">' + r.right + ' / ' + st.total + '</span><span class="s">' + r.score + '</span></div>').join('');
      const s = st.stats || {};
      const hard = s.hardest
        ? '<div class="hard"><div class="lbl">' + esc(T.hardest) + ' · №' + s.hardest.n + ' · ' + esc(T.pct(s.hardest.pct)) + '</div><b>' + esc(s.hardest.q) + '</b><div class="lbl" style="margin-top:.3em">' + esc(T.hardHint) + '</div></div>'
        : '<div class="hard"><b>' + esc(T.allRight) + '</b></div>';
      $('screen').innerHTML = '<div class="board"><h2>' + esc(T.top) + '</h2>' + (rows || '<div class="row">—</div>')
        + '<div class="stats"><div><div class="big">' + (s.avgRight || 0) + ' / ' + (s.total || st.total) + '</div><div class="lbl">' + esc(T.avg) + '</div></div>' + hard + '</div></div>';
      ctrl([{ a: 'restart', t: T.again }, { a: 'review', t: T.reviewGo, main: true }]);
      return;
    }
    if (st.phase === 'review') {
      if (shown === key2 + ':' + st.ri) return;
      shown = key2 + ':' + st.ri;
      const it = st.item;
      $('screen').innerHTML = '<div class="qtext">' + esc(it.q) + '</div>'
        + '<div class="rvmeta">' + (st.hardest ? '<span class="pill hot">' + esc(T.hardBadge) + '</span>' : '')
        + (it.pct != null ? '<span class="pill">' + esc(T.classPct(it.pct)) + '</span>' : '') + '</div>'
        + '<div class="explain">' + esc(it.explain || '') + '</div>'
        + answersHtml(it, { correct: it.correct, counts: it.counts });
      ctrl([{ a: 'prev', t: T.back }, { a: 'next', t: st.ri + 1 < st.total ? T.next : T.results, main: true }]);
    }
  }

  // ── «📋 Нәтижелер»: кім неше сұраққа дұрыс жауап берді (осы және бұрынғы ойындар) ──
  async function fetchResults() {
    const r = await fetch(api + '/results?k=' + encodeURIComponent(key), { cache: 'no-store' });
    if (!r.ok) throw new Error('results ' + r.status);
    return r.json();
  }
  async function loadCount() {
    try { const d = await fetchResults(); resCount = d.results.length; $('resBtn').textContent = T.resultsBtn(resCount); } catch { /* келесіде */ }
  }
  async function openResults() {
    ovOpen = true; $('ov').classList.remove('hidden');
    await drawResults();
  }
  function closeResults() { ovOpen = false; clearTimeout(ovTimer); $('ov').classList.add('hidden'); }
  async function drawResults() {
    clearTimeout(ovTimer);
    if (!ovOpen) return;
    let d = null;
    try { d = await fetchResults(); } catch { /* төменде */ }
    if (!ovOpen) return;
    const head = '<div class="head"><h2>' + esc(T.resultsTitle) + '</h2><button class="bigbtn" id="ovx">' + esc(T.close) + '</button></div>';
    if (!d) { $('ov').innerHTML = head + '<div class="body"><p class="note">' + esc(T.offline) + '</p></div>'; }
    else {
      resCount = d.results.length; $('resBtn').textContent = T.resultsBtn(resCount);
      const sm = d.summary || {};
      const rows = d.results.slice().sort((a, b) => b.right - a.right || a.at - b.at);
      const sum = rows.length
        ? '<div class="stats sum"><div><div class="big">' + (sm.avgRight || 0) + ' / ' + (sm.total || st.total) + '</div><div class="lbl">' + esc(T.avg) + '</div></div>'
          + (sm.hardest ? '<div class="hard"><div class="lbl">' + esc(T.hardest) + ' · №' + sm.hardest.n + ' · ' + esc(T.pct(sm.hardest.pct)) + '</div><b>' + esc(sm.hardest.q) + '</b><div class="lbl">' + esc(T.rightAnsShort) + ': ' + esc(sm.hardest.answer) + '</div></div>' : '<div class="hard"><b>' + esc(T.allRight) + '</b></div>')
          + '</div>'
        : '';
      const table = rows.length
        ? '<table><tr><th></th><th>' + esc(T.colName) + '</th><th>' + esc(T.colRight) + '</th><th></th></tr>'
          + rows.map((r, i) => '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td class="r">' + r.right + ' / ' + r.total + '</td><td class="m">'
            + new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</td></tr>').join('') + '</table>'
        : '<p class="note">' + esc(T.noResults) + '</p>';
      $('ov').innerHTML = head + '<div class="body">' + sum + table + '</div>';
    }
    $('ovx').onclick = closeResults;
    ovTimer = setTimeout(drawResults, 5000);
  }

  // таймер: тегіс анимация (сервер сұрауларының арасында да)
  function frame() {
    if (st && st.phase === 'question') {
      if (shown.startsWith('ready') && waitLeft() <= 0) render();
      const tm = $('tm');
      if (tm) {
        const l = left();
        tm.style.setProperty('--p', st.durMs ? Math.min(1, l / st.durMs) : 0);
        $('tmn').textContent = Math.ceil(l / 1000);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // пернетақта: бос орын / → — келесі қадам, ← — талдауда артқа (кликер де осылай істейді); Esc — нәтижелерді жабу
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ovOpen) { closeResults(); return; }
    if (!st || ovOpen) return;
    const fwd = e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'Enter';
    const back = e.key === 'ArrowLeft' || e.key === 'PageUp';
    if (!fwd && !back) return;
    e.preventDefault();
    if (back) { if (st.phase === 'review') act('prev'); return; }
    if (st.phase === 'lobby') act('start');
    else if (st.phase === 'question') act('close');
    else act('next');
  });

  loadCount();
  setInterval(() => { if (!ovOpen) loadCount(); }, 15000); // басқа құрылғыда ойнаған ойын да санауышқа түседі
  poll();
})();
