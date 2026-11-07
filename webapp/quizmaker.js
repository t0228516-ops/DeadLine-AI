/* DeadLine Mini App — ТЕГІН КВИЗ (2026-11).
 * Форма (тақырып / өз материалы, сұрақ саны, тіл) → жасалуда (~30 с) → тексеру (өшіру, ауыстыру) → бастау / WhatsApp / Telegram.
 * «Менің квиздерім» — соңғы 10 квизді қайта ашу. Сервер: /api/quiz-maker, /api/quiz/:code/(questions|edit).
 * app.js-тен бұрын жүктеледі; app.js init(ctx) шақырады (api, esc, haptic, tg, initDataHeader). */
(function () {
  'use strict';
  let C = null;           // app.js-тің көмекшілері
  const $ = (s) => document.querySelector(s);
  // Интерфейс тілі (webapp/i18n.js): T — мәтін, N — санға байланған сөз, ERR — сервер қатесі
  const I18N = window.DL_I18N || null;
  const UI_RU = !!(I18N && I18N.lang === 'ru');
  const T = (s, v) => (I18N ? I18N.t(s, v) : (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m)) : String(s)));
  const N = (c, kk) => (I18N ? I18N.n(c, kk) : kk);
  const ERR = (d, fb) => (I18N ? I18N.errText(d, fb) : ((d && d.message) || fb));
  const S = { lang: UI_RU ? 'ru' : 'kk', count: 10, materialId: null, quiz: null, left: null, perDay: 3, busy: false };
  const LANGS = new Set(['kk', 'ru', 'en']);

  const abs = (u) => (/^https?:\/\//.test(u || '') ? u : location.origin + (u || ''));
  const show = (id) => ['#qmForm', '#qmLoading', '#qmReview'].forEach((x) => $(x).classList.toggle('hidden', x !== id));
  const toast = (m) => C.showToast(m);
  function openLink(u) { try { if (C.tg && C.tg.openLink) return C.tg.openLink(u); } catch { /* браузерде */ } window.open(u, '_blank', 'noopener'); }
  function openTg(u) { try { if (C.tg && C.tg.openTelegramLink) return C.tg.openTelegramLink(u); } catch { /* браузерде */ } window.open(u, '_blank', 'noopener'); }

  // ── Қалған тегін квиз + «Менің квиздерім» ──────────────────────────────
  function renderLeft() {
    const el = $('#qmLeft');
    if (S.left == null) { el.textContent = T('🎁 Квиз тегін · күніне {n} квиз', { n: S.perDay }); return; }
    el.innerHTML = S.left > 0
      ? T('🎁 Квиз тегін · бүгін тағы <b>{n}</b> квиз жасай аласыз', { n: S.left })
      : T('⏳ Бүгінгі тегін квиздер бітті — ертең таңертең қайта толады');
    $('#qmCreate').disabled = S.left <= 0;
  }
  function renderMine(list) {
    const wrap = $('#qmMineWrap'); const box = $('#qmMine');
    if (!list || !list.length) { wrap.classList.add('hidden'); return; }
    box.innerHTML = list.map((z, i) => {
      const d = new Date(z.createdAt).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit' });
      return `<button type="button" class="qm-item" data-i="${i}"><span><b>${C.esc(z.topic)}</b><small>${z.n} ${N(z.n, 'сұрақ')} · ${d}</small></span><span class="qm-open">${T('Ашу ›')}</span></button>`;
    }).join('');
    box.onclick = (e) => { const b = e.target.closest('.qm-item'); if (b) openSaved(list[+b.dataset.i]); };
    wrap.classList.remove('hidden');
  }
  async function refresh() {
    try {
      const d = await C.api('/api/quiz-maker');
      S.left = d.left; S.perDay = d.perDay || S.perDay;
      renderLeft(); renderMine(d.quizzes);
    } catch (e) {
      if (e.status === 401) toast(T('Telegram ішінен ашыңыз'));
    }
  }
  async function openSaved(z) {
    try {
      const r = await fetch(`/api/quiz/${encodeURIComponent(z.code)}/questions?k=${encodeURIComponent(z.hostKey)}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(ERR(d, 'Квиз ашылмады'));
      S.quiz = { code: z.code, hostKey: z.hostKey, links: z.links, topic: d.topic, questions: d.questions };
      renderReview(false);
    } catch (e) { toast(e.message || T('Квиз ашылмады')); }
  }

  // ── Форма ──────────────────────────────────────────────────────────────
  const clampCount = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(15, Math.max(5, n)) : 10; };
  function bindForm() {
    const cnt = $('#qmCount');
    const setCount = (v) => { S.count = clampCount(v); cnt.value = S.count; };
    $('#qmMinus').onclick = () => setCount(S.count - 1);
    $('#qmPlus').onclick = () => setCount(S.count + 1);
    cnt.onblur = () => setCount(cnt.value);
    if (UI_RU) $('#qmLang').querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x.dataset.v === 'ru'));
    $('#qmLang').onclick = (e) => {
      const ch = e.target.closest('.chip'); if (!ch || !LANGS.has(ch.dataset.v)) return;
      S.lang = ch.dataset.v;
      $('#qmLang').querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === ch));
    };
    $('#qmExamples').onclick = (e) => { const b = e.target.closest('.ex-chip'); if (b) { $('#qmTopic').value = b.textContent; C.haptic('light'); } };
    $('#qmFile').onchange = uploadFile;
    $('#qmCreate').onclick = create;
    $('#qmNew').onclick = () => { S.quiz = null; $('#qmTopic').value = ''; show('#qmForm'); refresh(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    $('#qmStart').onclick = () => { if (S.quiz) { C.haptic('medium'); openLink(abs(S.quiz.links.host)); } };
    $('#qmWa').onclick = () => { if (S.quiz) openLink('https://wa.me/?text=' + encodeURIComponent(shareText() + '\n' + abs(S.quiz.links.player))); };
    $('#qmTg').onclick = () => { if (S.quiz) openTg('https://t.me/share/url?url=' + encodeURIComponent(abs(S.quiz.links.player)) + '&text=' + encodeURIComponent(shareText())); };
    $('#qmCopy').onclick = copyLink;
  }
  const shareText = () => T('🎯 Квиз: «{topic}» — сілтемені ашып, атыңызды жазыңыз', { topic: S.quiz.topic });

  async function copyLink() {
    if (!S.quiz) return;
    const url = abs(S.quiz.links.player); const b = $('#qmCopy');
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {
      const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      t.remove();
    }
    if (!ok) return toast(url);
    b.textContent = T('✓ Көшірілді'); C.haptic('success');
    setTimeout(() => { b.textContent = T('🔗 Сілтеме'); }, 1600);
  }

  async function uploadFile(ev) {
    const f = ev.target.files && ev.target.files[0];
    S.materialId = null;
    const info = $('#qmFileInfo'); const btn = $('#qmFileBtn');
    if (!f) { info.textContent = ''; return; }
    if (f.size > 50 * 1024 * 1024) { ev.target.value = ''; return toast(T('Файл 50 МБ-тан үлкен')); }
    info.textContent = T('Оқылуда…'); btn.textContent = `📄 ${f.name}`;
    try {
      const r = await fetch('/api/material?name=' + encodeURIComponent(f.name), {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream', ...C.initDataHeader() }, body: f,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(ERR(d, 'Файл оқылмады'));
      S.materialId = d.materialId;
      info.textContent = T('✓ Файл оқылды — сұрақтар тек осы мәтіннен құрылады');
      $('#qmText').value = '';
    } catch (e) {
      ev.target.value = ''; btn.textContent = T('📄 Файл жүктеу (PDF, Word, PPT, TXT)');
      info.textContent = '✕ ' + (e.message || T('Файл оқылмады'));
    }
  }

  // ── Жасау ──────────────────────────────────────────────────────────────
  const STEPS = ['Тақырып талдануда', 'Сұрақтар құрастырылып жатыр', 'Жауап нұсқалары тексерілуде', 'Оңайдан қиынға реттелуде', 'Аз қалды…'];
  let loadTimer = null;
  function startLoading() {
    show('#qmLoading');
    const t0 = Date.now(); let k = 0;
    $('#qmLoadStep').textContent = T(STEPS[0]); $('#qmLoadFill').style.width = '4%';
    clearInterval(loadTimer);
    loadTimer = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      $('#qmLoadFill').style.width = Math.min(94, 4 + 90 * (1 - Math.exp(-s / 14))) + '%'; // ~30 с ішінде 85%
      const nk = Math.min(STEPS.length - 1, Math.floor(s / 6));
      if (nk !== k) { k = nk; $('#qmLoadStep').textContent = T(STEPS[k]); }
    }, 400);
  }
  const stopLoading = () => { clearInterval(loadTimer); loadTimer = null; };

  async function create() {
    if (S.busy) return;
    const topic = $('#qmTopic').value.replace(/\s+/g, ' ').trim();
    if (topic.length < 3) { C.haptic('error'); $('#qmTopic').focus(); return toast(T('Квиз тақырыбын жазыңыз')); }
    const text = $('#qmText').value.trim();
    if (!S.materialId && text && text.length < 80) { C.haptic('error'); return toast(T('Материал тым қысқа — кемінде бірнеше сөйлем қойыңыз (не бос қалдырыңыз)')); }
    S.busy = true; $('#qmCreate').disabled = true;
    startLoading();
    try {
      const d = await C.api('/api/quiz-maker/create', {
        method: 'POST',
        body: JSON.stringify({ topic, language: S.lang, count: S.count, materialId: S.materialId || undefined, text: S.materialId ? undefined : (text || undefined) }),
      });
      S.quiz = { code: d.code, hostKey: d.hostKey, links: d.links, topic: d.topic, questions: d.questions };
      S.left = d.left; renderLeft();
      C.haptic('success');
      renderReview(true);
    } catch (e) {
      show('#qmForm');
      C.haptic('error');
      if (e.status === 429 && e.data && e.data.error === 'daily_limit') { S.left = 0; renderLeft(); }
      toast((e.data && e.data.message) || T('Байланыс үзілді — қайта көріңіз'));
    } finally {
      stopLoading(); S.busy = false;
      if (S.left == null || S.left > 0) $('#qmCreate').disabled = false;
    }
  }

  // ── Тексеру: сұрақтар, өшіру, ауыстыру ─────────────────────────────────
  function qHtml(q, i) {
    return `<div class="qm-q" data-i="${i}"><div class="qq"><span>${i + 1}.</span>${C.esc(q.q)}</div>`
      + q.options.map((o, j) => `<div class="op${j === q.correct ? ' ok' : ''}">${C.esc(o)}</div>`).join('')
      + (q.explain ? `<div class="ex">💡 ${C.esc(q.explain)}</div>` : '')
      + `<div class="tools"><button type="button" data-a="replace">${T('🔄 Ауыстыру')}</button><button type="button" data-a="delete">${T('🗑 Өшіру')}</button></div></div>`;
  }
  function renderReview(fresh) {
    const z = S.quiz;
    const nq = z.questions.length;
    $('#qmOk').textContent = `${T(fresh ? '✅ Квиз дайын' : '🎯 Квиз')} · ${nq} ${N(nq, 'сұрақ')} · «${z.topic}»`;
    $('#qmList').innerHTML = z.questions.map(qHtml).join('');
    $('#qmList').onclick = onTool;
    show('#qmReview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function confirmAsk(text) {
    return new Promise((res) => {
      try { if (C.tg && C.tg.showConfirm) return C.tg.showConfirm(text, (ok) => res(!!ok)); } catch { /* браузерде */ }
      res(window.confirm(text));
    });
  }
  async function onTool(e) {
    const b = e.target.closest('button[data-a]'); if (!b || !S.quiz) return;
    const card = b.closest('.qm-q'); const qi = +card.dataset.i; const action = b.dataset.a;
    if (action === 'delete' && !(await confirmAsk(T('{n}-сұрақты өшіру керек пе?', { n: qi + 1 })))) return;
    card.classList.add('busy');
    if (action === 'replace') b.textContent = T('⏳ Жасалуда…');
    try {
      const r = await fetch(`/api/quiz/${encodeURIComponent(S.quiz.code)}/edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: S.quiz.hostKey, action, qi }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(ERR(d, 'Өзгерту сәтсіз — қайта көріңіз'));
      S.quiz.questions = d.questions;
      C.haptic('success');
      renderReview(false);
    } catch (err) {
      card.classList.remove('busy');
      if (action === 'replace') b.textContent = T('🔄 Ауыстыру');
      toast(err.message);
    }
  }

  window.DeadlineQuiz = {
    init(ctx) { C = ctx; bindForm(); },
    /** «Квиз» бөлімі ашылғанда: қалған саны мен «Менің квиздерім» */
    open() { if (!C) return; if (!S.quiz) show('#qmForm'); refresh(); },
  };
})();
