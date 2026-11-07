/* DeadLine Mini App */
(function () {
  'use strict';

  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor('secondary_bg_color'); } catch {}
    try { tg.setBackgroundColor('bg_color'); } catch {}
  }

  // Интерфейс тілі (webapp/i18n.js): t — мәтін, tn — санға байланған сөз, srv — серверден келген жол, errText — қате
  const I18N = window.DL_I18N || null;
  const UI_RU = !!(I18N && I18N.lang === 'ru');
  const t = (s, v) => (I18N ? I18N.t(s, v) : (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m)) : String(s)));
  const tn = (c, kk) => (I18N ? I18N.n(c, kk) : kk);
  const srv = (s) => (I18N ? I18N.srv(s) : (s == null ? '' : String(s)));
  const errText = (d, fb) => (I18N ? I18N.errText(d, fb) : ((d && d.message) || fb || ''));

  const state = {
    me: null,
    slideCount: 10,
    language: UI_RU ? 'ru' : 'kk',   // орысша интерфейсте презентация да әдепкіде орысша (адам өзгерте алады)
    mode: 'presentation',
    style: '',
    design: '',      // галереядан таңдалған дизайн жүйесі ('' — бот өзі таңдайды)
    step: 1,
    currentJobId: null,
    pollTimer: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  function initDataHeader() {
    const h = {};
    if (tg?.initData) h['X-Telegram-Init-Data'] = tg.initData;
    if (I18N && I18N.chosen) h['X-UI-Lang'] = I18N.chosen;   // тек өзі таңдаса — бот та сол тілде сөйлейді
    return h;
  }

  async function api(path, opts = {}) {
    const url = path.startsWith('http') ? path : path;
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...initDataHeader(),
        ...(opts.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = errText(data) || data.error || res.statusText;
      if (UI_RU) data.message = msg;   // орысша интерфейсте серверден келген қазақша хабар — қате коды бойынша
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // ── Tabs ──────────────────────────────────────────────────────────────
  $$('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach((b) => b.classList.remove('active'));
      $$('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`#tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'history') loadHistory();
    });
  });

  // ── Chips ─────────────────────────────────────────────────────────────
  function bindChips(containerId, key) {
    const el = $(containerId);
    el.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      el.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state[key] = chip.dataset.v === '' ? '' : (isNaN(+chip.dataset.v) ? chip.dataset.v : +chip.dataset.v);
    });
  }
  function clampSlideCount(v) {
    const n = parseInt(v, 10);
    const max = state.mode === 'referat' ? 30 : 15;
    if (isNaN(n)) return state.mode === 'referat' ? 10 : 8;
    return Math.min(Math.max(n, 5), max);
  }
  const slideInput = $('#slideCountInput');
  slideInput.addEventListener('input', () => {
    state.slideCount = clampSlideCount(slideInput.value);
  });
  slideInput.addEventListener('blur', () => {
    const clamped = clampSlideCount(slideInput.value);
    slideInput.value = clamped;
    state.slideCount = clamped;
  });
  bindChips('#langChips', 'language');
  if (UI_RU) $$('#langChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.v === 'ru'));
  $('#modeChips').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b) return;
    $$('#modeChips .seg-btn').forEach((x) => x.classList.toggle('active', x === b));
    state.mode = b.dataset.v;
    applyMode();
    goStep(1);
  });

  function applyMode() {
    const mode = state.mode;
    // Тегін квиз — шеберден бөлек бөлім (webapp/quizmaker.js)
    const isQuiz = mode === 'quiz';
    $('#wizard').classList.toggle('hidden', isQuiz);
    $('#quizMaker').classList.toggle('hidden', !isQuiz);
    $('#quizPromo').classList.toggle('hidden', isQuiz);
    if (isQuiz) { if (window.DeadlineQuiz) window.DeadlineQuiz.open(); return; }
    const isReferat = mode === 'referat';
    const isTemplate = mode === 'template';
    const isAi = mode === 'presentation';

    $$('.referat-only').forEach((el) => el.classList.toggle('hidden', !isReferat));
    $$('.ai-only').forEach((el) => el.classList.toggle('hidden', !isAi));
    $$('.tpl-only').forEach((el) => el.classList.toggle('hidden', !isTemplate));
    $$('.not-template').forEach((el) => el.classList.toggle('hidden', isTemplate));
    $$('.lang-card').forEach((el) => el.classList.toggle('hidden', isTemplate)); // шаблонда аударудың керегі жоқ

    $('#countLabel').textContent = t(isReferat ? 'Бет саны' : 'Слайд саны');
    $('#countHint').textContent = t(isReferat ? '5–30 аралығында' : '5–15 аралығында');
    // Реферат: «қосымша талаптар» сол өрісте (бұрын «Аудитория» өрісінде болатын)
    $('#reqLabel').firstChild.textContent = t(isReferat ? 'Қосымша талаптар' : 'Мұғалімнің талабы') + ' ';
    $('#requirements').placeholder = t(isReferat
      ? 'Мысалы: 3 тарау, тек қазақстандық мысалдар, 15 дереккөз'
      : 'Мысалы: кемінде 10 слайд, әр слайдта 40 сөзден аспасын, соңында әдебиеттер тізімі');
    $('#btnGenText').textContent = t(isReferat ? 'Реферат жасау' : 'Презентация жасау');

    $('#topicLabel').textContent = t(isTemplate ? 'Шаблонға қандай тақырып жазамыз?' : isReferat ? 'Реферат не туралы?' : 'Презентация не туралы?');
    $('#topic').placeholder = t(isTemplate
      ? 'Мысалы: Қазақстан экономикасының даму кезеңдері'
      : 'Мысалы: Жасанды интеллекттің білім берудегі рөлі');
    $('#modeHint').textContent = t(isTemplate
      ? 'Өзіңіз таңдаған .pptx шаблонның түсі, шрифті, суреттері сол күйі қалады — бот тек мәтінді жазады.'
      : isReferat
        ? 'Word (.docx) реферат, ГОСТ форматында. Мұғалім қабылдаған үлгіні келесі қадамда жүктей аласыз.'
        : 'Тақырыпты жазыңыз — құрылым, мәтін, сурет, дизайнды бот өзі жасайды.');

    const input = $('#slideCountInput');
    input.max = isReferat ? 30 : 15;
    input.value = 10;
    state.slideCount = 10;
    $('#btnGenerate').disabled = false;
  }
  function selectMode(v) {
    const b = $(`#modeChips .seg-btn[data-v="${v}"]`);
    if (b) b.click();
  }
  if (window.DeadlineQuiz) window.DeadlineQuiz.init({ api, esc, showToast, haptic, tg, initDataHeader });
  $('#quizPromo').addEventListener('click', () => { haptic('light'); selectMode('quiz'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  // Кешкі дедлайн жолағы: Алматы (UTC+5) 21:00–02:00
  { const h = (new Date().getUTCHours() + 5) % 24; $('#nightStrip').classList.toggle('hidden', !(h >= 21 || h < 2)); }
  // Сілтеме арқылы бірден шаблон / квиз режимі: .../webapp/#template, #quiz немесе startapp=template|quiz
  try {
    const sp = (window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.start_param) || '';
    if (/template/.test(location.hash) || sp === 'template') setTimeout(() => selectMode('template'), 0);
    else if (/quiz/.test(location.hash) || sp === 'quiz') setTimeout(() => selectMode('quiz'), 0);
  } catch {}

  // ── Слайд саны: −/+ ───────────────────────────────────────────────────
  $('#countMinus').addEventListener('click', () => { slideInput.value = clampSlideCount(+slideInput.value - 1); state.slideCount = +slideInput.value; });
  $('#countPlus').addEventListener('click', () => { slideInput.value = clampSlideCount(+slideInput.value + 1); state.slideCount = +slideInput.value; });

  // ── Тақырып мысалдары ─────────────────────────────────────────────────
  $('#examples').addEventListener('click', (e) => {
    const b = e.target.closest('.ex-chip');
    if (!b) return;
    $('#topic').value = b.textContent;
    $('#charCount').textContent = b.textContent.length;
    haptic('light');
  });

  // ── Стиль галереясы (суреттер — webapp/styles/<id>-1..3.jpg, орысшасы <id>-1..3.ru.jpg; алдын ала салынған) ──
  // ?v= — суреттер жаңартылғанда Telegram кэштегі ескісін көрсетпесін (app.js өзі нұсқамен жүктеледі)
  const shot = (id, n) => `styles/${id}-${n}${UI_RU ? '.ru' : ''}.jpg?v=20261107`;
  const STYLES = [
    { id: 'bordeaux', name: 'Бордо', tag: 'тарих' },
    { id: 'northline', name: 'Корпоратив', tag: 'жалпы' },
    { id: 'poster', name: 'Плакат', tag: 'батыл' },
    { id: 'regalia', name: 'Салтанат', tag: 'әдебиет' },
    { id: 'vivid', name: 'Жарқын', tag: 'заманауи' },
    { id: 'heritage', name: 'Мұра', tag: 'классика' },
    { id: 'vital', name: 'Таза', tag: 'медицина' },
    { id: 'verde', name: 'Ромб', tag: 'экономика' },
    { id: 'hexa', name: 'Алтыбұрыш', tag: 'білім' },
    { id: 'meadow', name: 'Алқап', tag: 'мектеп' },
    { id: 'libro', name: 'Кітап', tag: 'әдебиет' },
    { id: 'terra', name: 'Табиғат', tag: 'экология' },
    { id: 'aurum', name: 'Алтын', tag: 'құқық' },
  ];
  const styleName = (id) => t((STYLES.find((x) => x.id === id) || {}).name || 'Авто');
  (function buildGallery() {
    const g = $('#styleGallery');
    g.insertAdjacentHTML('beforeend', STYLES.map((st) =>
      `<button type="button" class="g-card" data-v="${st.id}"><img src="${shot(st.id, 1)}" alt="" loading="lazy"><span class="g-name">${t(st.name)}<small>${t(st.tag)}</small></span></button>`).join(''));
    g.addEventListener('click', (e) => {
      const b = e.target.closest('.g-card, .g-auto');
      if (!b) return;
      if (b.classList.contains('g-auto')) { pickDesign(''); return; }
      openStylePreview(b.dataset.v);
    });
  })();
  function pickDesign(id) {
    state.design = id;
    $$('#styleGallery .g-card, #styleGallery .g-auto').forEach((x) => x.classList.toggle('active', (x.dataset.v || '') === id));
    haptic('light');
  }
  let previewId = '';
  function openStylePreview(id) {
    previewId = id;
    $('#spName').textContent = styleName(id);
    $('#spStrip').innerHTML = [1, 2, 3].map((n) => `<img src="${shot(id, n)}" alt="">`).join('');
    $('#stylePreview').classList.remove('hidden');
  }
  $('#spPick').addEventListener('click', () => { pickDesign(previewId); $('#stylePreview').classList.add('hidden'); });
  $('#spClose').addEventListener('click', () => $('#stylePreview').classList.add('hidden'));

  // ── Қадамдар ──────────────────────────────────────────────────────────
  const STEP_LABEL = { 1: 'ТАҚЫРЫП', 2: { presentation: 'СТИЛЬ', template: 'ШАБЛОН', referat: 'ҮЛГІ' }, 3: 'ТИТУЛ ПАРАҒЫ' };
  function goStep(n) {
    state.step = n;
    $$('.wiz-step').forEach((el) => el.classList.toggle('hidden', +el.dataset.step !== n));
    $$('.wiz-steps i').forEach((el, i) => el.classList.toggle('on', i < n));
    const lab = n === 2 ? STEP_LABEL[2][state.mode] : STEP_LABEL[n];
    $('#wizLabel').textContent = `${n} / 3 · ${t(lab)}`;
    $('#wizBack').classList.toggle('hidden', n === 1);
    $('#wizNext').classList.toggle('hidden', n === 3);
    $('#btnGenerate').classList.toggle('hidden', n !== 3);
    $('#wizNext').textContent = t(n === 1 ? (state.mode === 'presentation' ? 'Әрі қарай → Стиль таңдау' : state.mode === 'template' ? 'Әрі қарай → Шаблон жүктеу' : 'Әрі қарай → Үлгі реферат')
      : 'Әрі қарай → Титул парағы');
    if (n === 3) renderSummary();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('#wizNext').addEventListener('click', () => {
    if (state.step === 1 && $('#topic').value.trim().length < 3) { haptic('error'); return showToast('Тақырыпты жазыңыз'); }
    if (state.step === 2 && state.mode === 'template' && !state.refId) { haptic('error'); return showToast('Алдымен шаблон (.pptx) жүктеңіз'); }
    goStep(state.step + 1);
  });
  $('#wizBack').addEventListener('click', () => goStep(state.step - 1));
  function renderSummary() {
    const lang = t({ kk: 'қазақша', ru: 'орысша', en: 'ағылшынша' }[state.language] || '');
    const unit = tn(state.slideCount, state.mode === 'referat' ? 'бет' : 'слайд');
    const what = state.mode === 'referat' ? t('Word (.docx) реферат') : state.mode === 'template' ? t('сіздің шаблоныңыз') : t('«{name}» стилі', { name: styleName(state.design) });
    $('#wizSum').textContent = `${state.slideCount} ${unit} · ${lang} · ${what}`;
    const pv = $('#wizPreview');
    pv.classList.toggle('hidden', !(state.mode === 'presentation' && state.design));
    if (state.design) $('#wizPreviewImg').src = shot(state.design, 1);
    renderPrice();
  }
  function renderPrice() {
    const me = state.me || {};
    const tester = !!(me.tester && me.tester.active && me.tester.creditsToday > 0);
    $('#genHint').textContent = tester ? t('Тест режимі · тегін')
      : (me.price ? t('1 кредит · {price} ₸', { price: me.price }) : t('1 кредит'))
        + (me.credits != null ? ' · ' + t('қалды: {n} {word}', { n: me.credits, word: tn(me.credits, 'кредит') }) : '');
  }
  applyMode();
  goStep(1);


  $('#topic').addEventListener('input', () => {
    $('#charCount').textContent = $('#topic').value.length;
  });

  // ── Тестер режимі: бүгінгі тегін тест презентациясы ──────────────────────
  function renderTester(ts) {
    const el = $('#testerBanner');
    if (!el) return;
    if (!ts || !ts.active) { el.classList.add('hidden'); return; }
    const until = new Date(ts.until).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit' });
    el.innerHTML = t('🧪 Тест режимі: бүгін <b>{a}/{b}</b> тегін презентация · {until} дейін', { a: ts.creditsToday, b: ts.daily, until })
      + (ts.pending && ts.pending !== 'busy' ? '<br>' + t('⏳ Алдымен алдыңғы презентацияға ботқа пікір жазыңыз') : '');
    el.classList.remove('hidden');
  }

  // ── Load me ───────────────────────────────────────────────────────────
  async function loadMe() {
    try {
      const me = await api('/api/me');
      // Ботта орысша таңдаған (/lang, ?start=ru), ал Mini App-та әлі тіл таңдамаған адам — бет бір рет сол тілге ауысады
      if (I18N && !I18N.chosen && (me.lang === 'ru' || me.lang === 'kk') && me.lang !== I18N.lang) { I18N.setLang(me.lang); return; }
      state.me = me;
      $('#creditsVal').textContent = me.credits;
      $('#credWord').textContent = tn(me.credits, 'кредит');
      $('#statCredits').textContent = me.credits;
      $('#statTotal').textContent = me.total;
      $('#statRefs').textContent = me.refEarnings;
      $('#userName').textContent = [me.firstName, me.lastName].filter(Boolean).join(' ') || t('Пайдаланушы');
      $('#userId').textContent = me.username ? `@${me.username}` : `ID ${me.id}`;
      $('#avatar').textContent = (me.firstName || 'D')[0].toUpperCase();
      $('#refLink').value = me.referralLink;
      $('#priceVal').textContent = me.price;
      if (me.plus) {
        $('#plusCredits').textContent = me.plus.credits;
        $('#plusPrice').textContent = me.plus.amount;
        $('#plusEach').textContent = t('≈ {p}₸ / дана', { p: Math.round(me.plus.amount / me.plus.credits) });
      }
      if (me.pack) {
        $('#packCredits').textContent = me.pack.credits;
        $('#tierPackL').textContent = tn(me.pack.credits, 'презентация');
        $('#packPrice').textContent = me.pack.amount;
        $('#packWord').textContent = me.pack.credits;
        const save = me.price ? Math.round((1 - me.pack.amount / (me.pack.credits * me.price)) * 100) : 0;
        $('#packEach').textContent = t('≈ {p}₸ / дана', { p: Math.round(me.pack.amount / me.pack.credits) }) + (save > 0 ? ` · −${save}%` : '');
      }
      $('#firstPriceNote').textContent = me.firstPrice ? t('бірінші сатып алу — {p}₸', { p: me.firstPrice }) : '';
      renderTester(me.tester);
      renderPrice();
      $('#kaspiPhone').textContent = me.kaspi?.phone || '';
      $('#kaspiName').textContent = me.kaspi?.name || '';
      if (me.isAdmin && window.DeadlineAdmin) window.DeadlineAdmin.init({ api, esc, showToast, haptic });
    } catch (e) {
      console.error(e);
      $('#creditsVal').textContent = '?';
      if (e.status === 401) {
        showToast('Telegram ішінен ашыңыз');
      }
    }
  }

  // ── Reference PPTX ────────────────────────────────────────────────────
  state.refId = null;
  // Үйрену туралы ескерту: бір рет қабылданса, осы құрылғыда есте сақталады (сақтау қолжетімсіз болса — әр жолы сұралады)
  const LEARN_KEY = 'dl_learn_notice_v1';
  state.learnConsent = (() => { try { return localStorage.getItem(LEARN_KEY) === '1'; } catch { return false; } })();
  $('#refBtn').addEventListener('click', () => {
    if (state.learnConsent) { $('#refFile').click(); return; }
    $('#learnNotice').classList.remove('hidden');
    haptic('light');
  });
  // «Түсіндім» — <label for="refFile">: файл таңдау терезесі тікелей басу арқылы ашылады (Telegram WebView-да сенімді)
  $('#learnAccept').addEventListener('click', () => {
    state.learnConsent = true;
    try { localStorage.setItem(LEARN_KEY, '1'); } catch { /* жеке режим — келесі жолы қайта сұралады */ }
    $('#learnNotice').classList.add('hidden');
  });
  $('#learnCancel').addEventListener('click', () => {
    $('#learnNotice').classList.add('hidden');
  });
  $('#refFile').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    state.refId = null;
    if (!f) { $('#refInfo').textContent = ''; return; }
    if (!/\.pptx$/i.test(f.name)) { ev.target.value = ''; return showToast('Тек .pptx қабылданады'); }
    $('.tpl-upload').textContent = t('📎 {name} — басқасын таңдау', { name: f.name });
    if (f.size > 50 * 1024 * 1024) { ev.target.value = ''; return showToast('Файл 50 МБ-тан үлкен'); }
    $('#refInfo').textContent = t('Талдануда...');
    try {
      const r = await fetch('/api/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', ...initDataHeader() },
        body: f,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(errText(d, 'Қате'));
      state.refId = d.refId;
      $('#refInfo').textContent = [t('✓ Референс талданды'), ...(d.lines || []).map(srv).filter(Boolean)].join('\n');
    } catch (e) {
      ev.target.value = '';
      $('#refInfo').textContent = '';
      showToast(e.message || 'Талданбады');
    }
  });

  // ── Үлгі реферат (опционал) ───────────────────────────────────────────
  state.sampleId = null;
  $('#sampleFile').addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    if (!/\.(docx?|pdf|txt|rtf)$/i.test(f.name)) { ev.target.value = ''; return showToast('Word, PDF немесе TXT жүктеңіз'); }
    if (f.size > 50 * 1024 * 1024) { ev.target.value = ''; return showToast('Файл 50 МБ-тан үлкен'); }
    state.sampleId = null;
    $('#sampleBtn').textContent = t('📎 {name} — басқасын таңдау', { name: f.name });
    $('#sampleInfo').textContent = t('Оқылуда...');
    try {
      const r = await fetch('/api/material?name=' + encodeURIComponent(f.name), {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(f.name), ...initDataHeader() },
        body: f,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(errText(d, 'Файл оқылмады'));
      state.sampleId = d.materialId;
      $('#sampleInfo').textContent = t('✓ Үлгі қабылданды — реферат соның құрылымы мен стилімен жазылады');
    } catch (e) {
      $('#sampleBtn').textContent = t('📎 Үлгі рефератты таңдау');
      $('#sampleInfo').textContent = t('Жүктемесеңіз де болады — реферат стандарт талаптармен жасалады.');
      showToast(e.message || 'Файл оқылмады');
    }
    ev.target.value = '';
  });

  state.materialIds = [];
  // ── Generate ──────────────────────────────────────────────────────────
  $('#btnGenerate').addEventListener('click', async () => {
    const topic = $('#topic').value.trim();
    if (topic.length < 3) {
      haptic('error');
      return showToast('Тақырыпты жазыңыз');
    }
    if (state.mode === 'template' && !state.refId) {
      haptic('error');
      return showToast('Алдымен шаблон (.pptx) жүктеңіз');
    }
    const testerNow = !!(state.me && state.me.tester && state.me.tester.active && state.me.tester.creditsToday > 0);
    if (state.me && state.me.credits <= 0 && !testerNow) {
      haptic('error');
      showToast('Кредит жоқ — Аккаунт бөліміне өтіңіз');
      return;
    }

    $('#btnGenerate').disabled = true;
    try {
      const res = await api('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic,
          slideCount: state.slideCount,
          language: state.language,
          design: state.mode === 'presentation' ? (state.design || undefined) : undefined,
          // реферат: «қосымша талаптар» сервердегі бұрынғы audience өрісімен жүреді (генераторға brief)
          audience: state.mode === 'referat' ? ((($('#requirements').value || '').trim()) || undefined) : undefined,
          mode: state.mode,
          requirements: state.mode === 'presentation' ? (($('#requirements').value || '').trim() || undefined) : undefined,
          materialIds: state.mode === 'template' ? state.materialIds : undefined,
          refId: state.mode === 'template' ? (state.refId || undefined) : undefined,
          learnConsent: state.mode === 'template' && state.refId ? !!state.learnConsent : undefined,
          sampleId: state.mode === 'referat' ? (state.sampleId || undefined) : undefined,
          pages: state.mode === 'referat' ? state.slideCount : undefined,
          university: ($('#university').value || '').trim() || undefined,
          faculty: ($('#faculty').value || '').trim() || undefined,
          department: ($('#department').value || '').trim() || undefined,
          group: ($('#groupName').value || '').trim() || undefined,
          city: ($('#city').value || '').trim() || undefined,
          performedBy: ($('#performedBy').value || '').trim() || undefined,
          checkedBy: ($('#checkedBy').value || '').trim() || undefined,
        }),
      });
      state.currentJobId = res.jobId;
      if (res.tester && state.me && state.me.tester) {
        state.me.tester.creditsToday = Math.max(0, state.me.tester.creditsToday - 1);
        state.me.tester.pending = res.jobId;
        renderTester(state.me.tester);
      }
      if (state.me) {
        state.me.credits = res.creditsLeft;
        $('#creditsVal').textContent = res.creditsLeft;
        $('#statCredits').textContent = res.creditsLeft;
      }
      showProgress(0, t('Кезекте'), t('Басталуда...'));
      haptic('medium');
      pollJob(res.jobId);
    } catch (e) {
      haptic('error');
      if (e.status === 402 || e.status === 409) showToast(e.data?.message || 'Кредит жеткіліксіз');
      else if (e.status === 429) showToast(e.data?.message || 'Тым жиі сұраныс');
      else showToast(e.message || 'Қате');
    } finally {
      $('#btnGenerate').disabled = false;
    }
  });

  function showProgress(pct, title, detail) {
    $('#progressOverlay').classList.remove('hidden');
    $('#resultCard').classList.add('hidden');
    $('#progressFill').style.width = `${pct}%`;
    $('#progressPct').textContent = `${pct}%`;
    if (title) $('#progressTitle').textContent = title;
    if (detail) $('#progressDetail').textContent = detail;
  }

  function hideProgress() {
    $('#progressOverlay').classList.add('hidden');
  }

  $('#btnCancelView').addEventListener('click', () => {
    hideProgress();
  });

  async function pollJob(jobId) {
    if (state.pollTimer) clearInterval(state.pollTimer);
    const tick = async () => {
      try {
        const job = await api(`/api/job/${jobId}`);
        const phaseTitles = {
          queued: 'Кезекте',
          start: 'Басталуда',
          content: 'Мазмұн жазылуда',
          qc: 'Сапа тексерісі',
          quality: 'Сапа циклі',
          narrative: 'Нарратив',
          composition: 'Композиция',
          sources: 'Дереккөздер',
          qa: 'Талаптар QA',
          template: 'Шаблонға мәтін салынуда',
          images: 'Суреттер',
          visual: 'Визуалдар',
          html: 'Дизайн құрастыру',
          render: 'Рендер',
          critic: 'Vision Critic',
          redesign: 'Қайта өңдеу',
          pptx: 'PPTX экспорт',
          outline: 'Құрылым',
          write: 'Мәтін жазылуда',
          fit: 'Көлем реттелуде',
          docx: 'Word құрастыру',
          review: 'Визуалды тексеру',
          media: 'Суреттер мен диаграммалар',
          vision: 'Дизайн тексерісі',
          done: 'Дайын',
          failed: 'Сәтсіз',
        };
        showProgress(
          job.progress || 0,
          t(phaseTitles[job.phase] || 'Жұмыс істеуде'),
          srv(job.detail)
        );

        if (job.status === 'done') {
          clearInterval(state.pollTimer);
          state.pollTimer = null;
          hideProgress();
          showResult(job);
          haptic('success');
          loadMe();
        } else if (job.status === 'failed') {
          clearInterval(state.pollTimer);
          state.pollTimer = null;
          hideProgress();
          haptic('error');
          showToast(srv(job.detail) || t('Сәтсіз болды, кредит қайтарылды'));
          loadMe();
        }
      } catch (e) {
        console.error('poll', e);
      }
    };
    await tick();
    state.pollTimer = setInterval(tick, 1500);
  }

  function renderReqReport(rep) {
    const box = $('#reqReport');
    box.textContent = '';
    if (!rep || !rep.results || !rep.results.length) { box.classList.add('hidden'); return; }
    const sm = rep.summary || {};
    const h = document.createElement('div');
    h.className = 'req-head';
    h.textContent = sm.hardTotal ? t('Талаптар: {a}/{b} орындалды', { a: sm.hardPassed, b: sm.hardTotal }) : t('Талаптар');
    box.appendChild(h);
    const mark = { pass: '✅', fail: '❌', soft: '🔸', unverifiable: '➖' };
    for (const r of rep.results) {
      const row = document.createElement('div');
      row.className = 'req-row ' + r.status;
      let line = `${mark[r.status] || '•'} «${r.quote}»`;
      const msg = srv(r.message); const note = srv(r.note);
      if (r.status === 'fail' && msg) line += ' — ' + msg;
      else if (r.status === 'soft') line += r.score == null ? t(' — бағаланбады') : ` — ${Math.round(r.score * 100)}%${note ? ' (' + note + ')' : ''}`;
      else if (r.status === 'unverifiable') line += t(' — тексерілмейді') + (msg ? ': ' + msg : '');
      row.textContent = line;
      box.appendChild(row);
    }
    for (const o of rep.overrides || []) {
      const note = srv(o);
      if (!note) continue;
      const row = document.createElement('div');
      row.className = 'req-row note';
      row.textContent = 'ℹ️ ' + note;
      box.appendChild(row);
    }
    box.classList.remove('hidden');
  }

  function renderTemplateReport(rep) {
    const box = $('#reqReport');
    if (!rep || !rep.checks || !rep.checks.length) return;
    const h = document.createElement('div');
    h.className = 'req-head';
    h.textContent = `🎨 ${srv(rep.summary) || 'Template compliance'}`;
    box.appendChild(h);
    for (const c of rep.checks) {
      const name = srv(c.name); const detail = srv(c.detail);
      if (!name) continue;
      const row = document.createElement('div');
      row.className = 'req-row ' + c.status;
      row.textContent = `${c.status === 'pass' ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`;
      box.appendChild(row);
    }
    box.classList.remove('hidden');
  }

  function showResult(job) {
    $('#resultCard').classList.remove('hidden');
    const ref = job.mode === 'referat';
    const tpl = job.mode === 'template';
    $('#resultTitle').textContent = job.title || t(ref ? 'Реферат дайын!' : 'Презентация дайын!');
    $('#btnDlPptx').classList.toggle('hidden', ref);
    $('#btnDlSpeech').classList.toggle('hidden', ref || !job.hasSpeech);
    $('#btnDlDocx').classList.toggle('hidden', !ref);
    $('#btnNew').textContent = t(ref ? 'Жаңа жұмыс' : 'Жаңа презентация');
    $('#resultScore').textContent = job.qualityScore != null
      ? t('Сапа: {n}/100', { n: Math.round(job.qualityScore) }) + (tpl ? t(' · шаблоннан') : '')
      : (tpl ? t('Шаблон негізінде жасалды') : '');
    $('#reqReport').classList.add('hidden');
    renderReqReport(job.requirementsReport);
    renderTemplateReport(job.templateReport);
    state.currentJobId = job.id;
    $('#btnDlPptx').onclick = () => download(job.id, 'pptx');
    $('#btnDlSpeech').onclick = () => download(job.id, 'speech');
    $('#btnDlDocx').onclick = () => download(job.id, 'docx');
  }

  // ── Баға (1–5) және пікір ─────────────────────────────────────────────
  function paintStars(n) {
    document.querySelectorAll('#stars .star').forEach((b) => b.classList.toggle('on', +b.dataset.v <= n));
  }
  function setupRating(job) {
    const fb = job.feedback || null;
    state.rating = fb ? fb.rating : 0;
    paintStars(state.rating);
    $('#rateComment').value = fb && fb.comment ? fb.comment : '';
    $('#rateMore').classList.toggle('hidden', !state.rating);
    $('#rateTitle').textContent = t(state.rating ? 'Бағаңыз сақталды. Өзгертуге болады' : 'Ұнады ма? Жұлдызша қойыңыз');
  }
  async function sendFeedback(body) {
    if (!state.rateJobId) return null;
    return api(`/api/job/${state.rateJobId}/feedback`, { method: 'POST', body: JSON.stringify(body) });
  }
  // Тарихтан ашылады: клиент файлды қарап шыққан соң бағалайды
  async function openRate(jobId, title) {
    try {
      const job = await api(`/api/job/${jobId}`);
      if (job.status !== 'done') return showToast('Бұл жұмыс аяқталмаған');
      state.rateJobId = jobId;
      $('#rateJobTitle').textContent = title || job.title || t('Бағалау');
      setupRating(job);
      $('#rateCard').classList.remove('hidden');
      haptic('light');
    } catch (e) {
      showToast(e.status === 404 ? 'Жұмыстың мерзімі өтті' : 'Ашылмады');
    }
  }
  $('#rateClose').addEventListener('click', () => {
    $('#rateCard').classList.add('hidden');
    state.rateJobId = null;
    loadHistory();
  });
  document.querySelectorAll('#stars .star').forEach((b) => b.addEventListener('click', async () => {
    const v = +b.dataset.v;
    const prev = state.rating;
    state.rating = v; paintStars(v); haptic('light');
    try {
      await sendFeedback({ rating: v });
      $('#rateMore').classList.remove('hidden');
      $('#rateTitle').textContent = t('Рахмет! Пікір қалдырсаңыз, бот осыдан үйренеді');
    } catch (e) {
      state.rating = prev; paintStars(prev);
      showToast(e.status === 404 ? 'Жұмыстың мерзімі өтті' : 'Баға сақталмады');
    }
  }));
  $('#rateSend').addEventListener('click', async () => {
    const comment = ($('#rateComment').value || '').trim();
    if (!comment) return showToast('Пікір бос');
    try {
      await sendFeedback({ comment });
      showToast('Пікіріңіз сақталды 🙏'); haptic('success');
    } catch (e) {
      showToast(e.data && e.data.message ? e.data.message : 'Пікір сақталмады');
    }
  });

  $('#btnNew').addEventListener('click', () => {
    $('#resultCard').classList.add('hidden');
    state.currentJobId = null;
    goStep(1);
  });

  async function download(jobId, type) {
    try {
      haptic('light');
      const headers = initDataHeader();
      const res = await fetch(`/api/job/${jobId}/download/${type}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sent) throw new Error(data.error === 'bot_unavailable' ? 'Бот қолжетімсіз' : 'Жіберу сәтсіз');
      showToast('Чатқа жіберілді ✅');
      haptic('success');
      if (tg?.close) {
        // let user switch to chat manually; do not auto-close
      }
    } catch (e) {
      showToast(e.message || 'Жіберу қатесі');
      haptic('error');
    }
  }

  // ── History ───────────────────────────────────────────────────────────
  async function loadHistory() {
    try {
      const { items } = await api('/api/history');
      const list = $('#historyList');
      const empty = $('#historyEmpty');
      if (!items || !items.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      list.innerHTML = items.map((h) => {
        const date = new Date(h.createdAt).toLocaleString(UI_RU ? 'ru-RU' : 'kk-KZ', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        const score = h.qualityScore != null ? t('Сапа {n}/100', { n: Math.round(h.qualityScore) }) : '';
        return `<div class="hist-item">
          <div class="hist-title">${esc(h.title || h.topic || t(h.mode === 'referat' ? 'Реферат' : 'Презентация'))}</div>
          <div class="hist-meta"><span>${date}</span><span>${score}</span></div>
          <div class="hist-actions">
            ${h.canRate ? `<button class="btn ghost small rate-btn" data-rate="${h.id}" data-title="${esc(h.title || h.topic || '')}">${h.rating ? '⭐ ' + h.rating : t('☆ Бағалау')}</button>` : ''}
            ${h.mode === 'referat'
              ? `<button class="btn secondary small" data-dl="${h.id}" data-type="docx">Word</button>`
              : `<button class="btn secondary small" data-dl="${h.id}" data-type="pptx">PPTX</button>
${h.hasSpeech ? `<button class="btn secondary small" data-dl="${h.id}" data-type="speech">${t('🎤 Баяндама')}</button>` : ''}`}
          </div>
        </div>`;
      }).join('');
      list.querySelectorAll('[data-dl]').forEach((btn) => {
        btn.addEventListener('click', () => download(btn.dataset.dl, btn.dataset.type));
      });
      list.querySelectorAll('[data-rate]').forEach((btn) => {
        btn.addEventListener('click', () => openRate(btn.dataset.rate, btn.dataset.title));
      });
    } catch (e) {
      console.error(e);
    }
  }

  // ── Account actions ───────────────────────────────────────────────────
  $('#btnCopyRef').addEventListener('click', async () => {
    const link = $('#refLink').value;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Көшірілді');
      haptic('light');
    } catch {
      $('#refLink').select();
      showToast('Таңдалды — көшіріңіз');
    }
  });

  $('#btnOpenBot').addEventListener('click', () => {
    const uname = state.me?.referralLink?.match(/t\.me\/([^?]+)/)?.[1];
    if (tg?.openTelegramLink && uname) {
      tg.openTelegramLink(`https://t.me/${uname}`);
    } else if (uname) {
      window.open(`https://t.me/${uname}`, '_blank');
    }
  });

  // ── Интерфейс тілі (Аккаунт) ──────────────────────────────────────────
  $$('#uiLangChips .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.v === (UI_RU ? 'ru' : 'kk'));
    c.addEventListener('click', () => { if (I18N && c.dataset.v !== I18N.lang) I18N.setLang(c.dataset.v); });
  });

  // ── Utils ─────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function showToast(msg) {
    msg = t(msg == null ? '' : String(msg));   // қазақша кілт болса — орысша интерфейсте аударылады
    if (tg?.showAlert) {
      tg.showAlert(msg);
    } else {
      alert(msg);
    }
  }

  function haptic(type) {
    try {
      if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
      else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
      else if (type === 'medium') tg?.HapticFeedback?.impactOccurred('medium');
      else tg?.HapticFeedback?.impactOccurred('light');
    } catch {}
  }

  // Boot
  loadMe();
})();
