'use strict';
// Mini App интерфейс тілі (webapp/i18n.js): орысша сөздік толық па, көпше түр, сервер мәтіні, HTML аудармасы.
// Қазақша — әдепкі (өзгермейді); орысша — тек адам таңдаса.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const I = require('../webapp/i18n.js');
const WEB = path.join(__dirname, '..', 'webapp');
const CYR = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
const covered = (k) => I.has(k) || Object.prototype.hasOwnProperty.call(I.PLURAL_RU, k);

/**
 * JS файлдағы жол литералдары: '…', "…" және `…`-тің тұрақты бөліктері (${…} ішіндегі код бөлек қаралады).
 * Пікірлер мен regex литералдары өткізіледі. Қайтарады: [{ text, template }].
 */
function stringLiterals(src) {
  const out = [];
  let i = 0;
  let prev = '';            // соңғы маңызды таңба/сөз (regex пе, бөлу ме — соны шешу үшін)
  const REGEX_AFTER = /[(,=:[!&|?{};+\-*%<>~^]$|^(return|typeof|case|in|of|new|delete|void|throw|else|do)$/;
  const skipString = (q) => { i++; while (i < src.length && src[i] !== q) i += src[i] === '\\' ? 2 : 1; i++; };
  function skipExpr() {     // ${ … } соңына дейін (ішкі жолдар мен `…` ескеріледі)
    let depth = 1;
    while (i < src.length) {
      const c = src[i];
      if (c === "'" || c === '"') { skipString(c); continue; }
      if (c === '`') { skipTemplate(); continue; }
      if (c === '{') depth++;
      else if (c === '}' && !--depth) { i++; return; }
      i++;
    }
  }
  function skipTemplate() {
    i++;
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { i += 2; skipExpr(); continue; }
      i++;
    }
    i++;
  }
  function readQuoted(q) {
    let s = ''; i++;
    while (i < src.length && src[i] !== q) { if (src[i] === '\\') { s += src[i + 1]; i += 2; } else s += src[i++]; }
    i++; return s;
  }
  function readTemplate() {
    let s = ''; i++;
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { s += src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        out.push({ text: s, template: true }); s = '';
        const from = i + 2; i = from; skipExpr();
        out.push(...stringLiterals(src.slice(from, i - 1)));   // ${…} ішіндегі код — өз алдына
        continue;
      }
      s += src[i++];
    }
    i++; out.push({ text: s, template: true });
  }
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? src.length : i + 2; continue; }
    if (c === "'" || c === '"') { out.push({ text: readQuoted(c), template: false }); prev = 'x'; continue; }
    if (c === '`') { readTemplate(); prev = 'x'; continue; }
    if (c === '/' && (prev === '' || REGEX_AFTER.test(prev))) {   // regex литералы
      i++; let cls = false;
      while (i < src.length) {
        const d = src[i];
        if (d === '\\') { i += 2; continue; }
        if (d === '[') cls = true; else if (d === ']') cls = false;
        else if (d === '/' && !cls) break;
        i++;
      }
      i++; while (/[a-z]/.test(src[i] || '')) i++;
      prev = 'x'; continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (/[A-Za-z_$0-9]/.test(c)) { let w = ''; while (i < src.length && /[A-Za-z_$0-9]/.test(src[i])) w += src[i++]; prev = w; continue; }
    prev = c; i++;
  }
  return out;
}

test('literal scanner: strings, template parts and nested expressions; comments and regexes are skipped', () => {
  const src = "// 'жоқ'\nconst a = 'бір'; /* \"жоқ\" */ const r = /[\"']/g; const b = `екі ${x ? 'үш' : `төрт ${y}`} бес`; const c = x / 2 / 3;";
  const got = stringLiterals(src).map((l) => l.text.trim()).filter(Boolean);
  assert.deepStrictEqual(got, ['бір', 'екі', 'үш', 'төрт', 'бес']);
});

test('i18n: every Kazakh string in app.js and quizmaker.js has a Russian translation, none is left inside a template literal', () => {
  for (const f of ['app.js', 'quizmaker.js']) {
    const lits = stringLiterals(fs.readFileSync(path.join(WEB, f), 'utf8'));
    const inTemplate = lits.filter((l) => l.template && CYR.test(l.text)).map((l) => l.text.trim());
    assert.deepStrictEqual(inTemplate, [], `${f}: Kazakh text inside \`…\` — move it into t('…{x}…', { x })`);
    const missing = lits.filter((l) => !l.template && CYR.test(l.text) && !covered(l.text)).map((l) => l.text);
    assert.deepStrictEqual(missing, [], `${f}: no Russian translation`);
  }
});

test('i18n: Kazakh stays the default and is never changed by the translator', () => {
  const kk = I.make('kk');
  assert.strictEqual(kk.lang, 'kk');
  assert.strictEqual(kk.t('Презентация жасау'), 'Презентация жасау');
  assert.strictEqual(kk.t('Сапа: {n}/100', { n: 87 }), 'Сапа: 87/100');
  assert.strictEqual(kk.n(5, 'кредит'), 'кредит');
  assert.strictEqual(kk.srv('Мазмұн жазылуда...'), 'Мазмұн жазылуда...');
  assert.strictEqual(kk.errText({ error: 'no_credits', message: 'Кредит жеткіліксіз' }), 'Кредит жеткіліксіз');
  assert.strictEqual(I.make('en').lang, 'kk', 'unknown language → Kazakh');
});

test('i18n: Russian text, placeholders and plural forms', () => {
  const ru = I.make('ru');
  assert.strictEqual(ru.t('Презентация жасау'), 'Создать презентацию');
  assert.strictEqual(ru.t('Сапа: {n}/100', { n: 87 }), 'Качество: 87/100');
  assert.strictEqual(ru.t('бұл кілт жоқ'), 'бұл кілт жоқ', 'unknown text passes through');
  const forms = [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map((c) => `${c} ${ru.n(c, 'кредит')}`);
  assert.deepStrictEqual(forms, ['1 кредит', '2 кредита', '4 кредита', '5 кредитов', '11 кредитов', '12 кредитов', '14 кредитов',
    '21 кредит', '22 кредита', '25 кредитов', '101 кредит', '111 кредитов']);
  assert.strictEqual(ru.n(5, 'сұрақ'), 'вопросов');
  assert.strictEqual(ru.n(3, 'слайд'), 'слайда');
  assert.strictEqual(ru.n(5, 'презентация'), 'презентаций');
  for (const [w, f] of Object.entries(I.PLURAL_RU)) assert.ok(Array.isArray(f) && f.length === 3 && f.every(Boolean), w);
});

test('i18n: server text in the Russian UI — progress lines translated, untranslatable Kazakh lines hidden, errors by code', () => {
  const ru = I.make('ru');
  assert.strictEqual(ru.srv('Мазмұн жазылуда...'), 'Пишем содержание...');
  assert.strictEqual(ru.srv('Мәтін жазылуда... (3/12)'), 'Пишем текст... (3/12)');
  assert.strictEqual(ru.srv('Түс: ашық фон #fff, акцент #c00'), '', 'Kazakh line without translation is hidden');
  assert.strictEqual(ru.srv('Шрифт: Montserrat / Open Sans'), 'Шрифт: Montserrat / Open Sans');
  assert.strictEqual(ru.srv('Макеттер: мұқаба 20%'), '');
  assert.strictEqual(ru.srv(''), '');
  assert.strictEqual(ru.errText({ error: 'maintenance', message: '🛠 DeadLine жаңартылып жатыр — жақында ораламыз!' }), '🛠 DeadLine обновляется — скоро вернёмся!');
  assert.strictEqual(ru.errText({ error: 'something_new', message: 'Error 42' }), 'Error 42', 'no Kazakh-only letters → shown as is');
  assert.strictEqual(ru.errText({ error: 'something_new', message: 'Бір нәрсе бұзылды' }), '', 'untranslatable Kazakh → hidden, never shown in the Russian UI');
  assert.strictEqual(ru.errText({ error: 'something_new', message: 'Қате шықты' }, 'Қате'), 'Ошибка', 'falls back to a translated default');
  for (const [code, msg] of Object.entries(I.ERR_RU)) assert.ok(!I.KK_ONLY.test(msg), `${code}: Russian message has Kazakh letters`);
});

test('i18n: the Russian dictionary is Russian, keeps placeholders and markup, and has no empty values', () => {
  for (const [k, v] of Object.entries(I.RU)) {
    assert.ok(typeof v === 'string' && v.length, `empty translation: ${k}`);
    assert.ok(!I.KK_ONLY.test(v), `Kazakh letters in the Russian text: ${k} → ${v}`);
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    assert.strictEqual(ph(v), ph(k), `placeholders differ: ${k}`);
    const tags = (s) => (s.match(/<\/?[a-z]+[^>]*>/g) || []).sort().join('');
    assert.strictEqual(tags(v), tags(k), `markup differs: ${k}`);
  }
});

// ── Беттің өзі (Chrome): HTML-дегі әр мәтінге аударма бар, орысша режимде қазақша әріп көрінбейді ──
let chrome = null;
async function browser(t) {
  if (chrome === null) {
    try { chrome = await require('../products/presentation/renderer').launchBrowser(require('puppeteer')); }
    catch (e) { chrome = 'Chromium жоқ: ' + e.message; }
  }
  if (typeof chrome === 'string') { t.skip(chrome); return null; }
  return chrome;
}
test.after(async () => { if (chrome && typeof chrome !== 'string') await chrome.close(); });

async function openApp(b, lang, tgLang, query = '', meLang = '') {
  const page = await b.newPage();
  const apiHeaders = [];
  await page.setViewport({ width: 360, height: 740 });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('telegram.org')) {   // Telegram SDK орнына — тілі берілген жалған WebApp
      return r.respond({ status: 200, contentType: 'application/javascript', body:
        `window.Telegram={WebApp:{initData:'',initDataUnsafe:{user:{id:1,language_code:${JSON.stringify(tgLang || '')}}},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},showAlert(m){window.__alerts=(window.__alerts||[]).concat(m)},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};` });
    }
    if (u.includes('/api/')) {
      apiHeaders.push(r.headers());
      if (meLang && u.includes('/api/me')) return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '1', credits: 0, total: 0, refEarnings: 0, price: 250, lang: meLang }) });
      return r.respond({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' });
    }
    return r.continue();
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluateOnNewDocument((l) => { try { localStorage.clear(); if (l) localStorage.setItem('dl_ui_lang', l); } catch { /* — */ } }, lang || '');
  await page.goto('file://' + path.join(WEB, 'index.html') + query, { waitUntil: 'load' });
  return { page, errors, apiHeaders };
}
/** Көрінетін мәтін (data-i18n-skip ішінен басқа) */
const visibleText = (page) => page.evaluate(() => {
  const out = [];
  const walk = (el) => {
    if (el.hasAttribute && el.hasAttribute('data-i18n-skip')) return;
    const st = el.nodeType === 1 ? getComputedStyle(el) : null;
    if (st && (st.display === 'none' || st.visibility === 'hidden')) return;
    for (const c of el.childNodes) {
      if (c.nodeType === 3 && c.nodeValue.trim()) out.push(c.nodeValue.trim());
      else if (c.nodeType === 1) walk(c);
    }
    if (el.nodeType === 1) for (const a of ['placeholder', 'aria-label', 'title']) if (el.getAttribute(a)) out.push(el.getAttribute(a));
  };
  walk(document.body);
  return out;
});

test('i18n page: every Kazakh text and attribute in index.html has a Russian translation', async (t) => {
  const b = await browser(t); if (!b) return;
  const { page, errors } = await openApp(b, 'kk');
  const keys = await page.evaluate(() => window.DL_I18N.collect(document.body).map((x) => x.key));
  await page.close();
  assert.deepStrictEqual(errors, []);
  const missing = [...new Set(keys)].filter((k) => CYR.test(k) && !covered(k));
  assert.deepStrictEqual(missing, [], 'index.html: no Russian translation');
});

test('i18n page: Russian UI shows no Kazakh-only letters on any create step, the quiz maker and the account tab (360 px, no overflow)', async (t) => {
  const b = await browser(t); if (!b) return;
  const { page, errors } = await openApp(b, 'ru');
  const seen = [];
  const look = async (where) => {
    const kk = (await visibleText(page)).filter((s) => I.KK_ONLY.test(s));
    seen.push(...kk.map((s) => `${where}: ${s}`));
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(wide <= 360, `${where}: page is ${wide}px wide`);
  };
  assert.strictEqual(await page.evaluate(() => document.documentElement.lang), 'ru');
  for (const mode of ['presentation', 'referat', 'template']) {
    await page.click(`#modeChips .seg-btn[data-v="${mode}"]`);
    await look(`${mode} step 1`);
    await page.type('#topic', 'Тема для проверки');
    await page.click('#wizNext'); await look(`${mode} step 2`);
    if (mode === 'template') { await page.evaluate(() => { document.querySelector('#wizNext').click(); }); }
    else { await page.click('#wizNext'); await look(`${mode} step 3`); }
    await page.evaluate(() => { document.querySelector('#topic').value = ''; });
  }
  await page.click('#modeChips .seg-btn[data-v="quiz"]'); await look('quiz form');
  await page.click('.tab[data-tab="account"]'); await look('account');
  await page.click('.tab[data-tab="history"]'); await look('history');
  await page.close();
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(seen, []);
});

test('i18n page: Russian UI defaults the deck and quiz language to Russian; Kazakh UI keeps Kazakh; the switch is offered once to a non-Kazakh Telegram', async (t) => {
  const b = await browser(t); if (!b) return;
  let { page } = await openApp(b, 'ru');
  assert.deepStrictEqual(await page.evaluate(() => [document.querySelector('#langChips .chip.active').dataset.v, document.querySelector('#qmLang .chip.active').dataset.v, document.querySelector('#uiLangBtn').textContent]), ['ru', 'ru', 'ҚАЗ']);
  await page.close();
  ({ page } = await openApp(b, '', 'ru'));
  assert.deepStrictEqual(await page.evaluate(() => [document.querySelector('#langChips .chip.active').dataset.v, document.querySelector('#uiLangBtn').textContent, !document.querySelector('#uiLangOffer').classList.contains('hidden'), document.querySelector('.tab').textContent]), ['kk', 'RU', true, 'Жасау']);
  await page.close();
  ({ page } = await openApp(b, '', 'kk'));
  assert.strictEqual(await page.evaluate(() => document.querySelector('#uiLangOffer').classList.contains('hidden')), true, 'no offer for a Kazakh Telegram');
  await page.close();
});

test('i18n page: a bot link with ?lang=ru opens the Mini App in Russian and remembers it; the server hears the language only when chosen', async (t) => {
  const b = await browser(t); if (!b) return;
  let { page, apiHeaders } = await openApp(b, '', 'kk', '?lang=ru');
  await new Promise((r) => setTimeout(r, 300));
  assert.deepStrictEqual(await page.evaluate(() => [document.documentElement.lang, localStorage.getItem('dl_ui_lang'), document.querySelector('.tab').textContent]), ['ru', 'ru', 'Создать']);
  assert.ok(apiHeaders.length && apiHeaders.every((h) => h['x-ui-lang'] === 'ru'), 'X-UI-Lang: ru sent with API calls');
  await page.close();
  ({ page, apiHeaders } = await openApp(b, '', 'ru'));
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(apiHeaders.length && apiHeaders.every((h) => !('x-ui-lang' in h)), 'no choice → no header (the bot keeps its language)');
  await page.close();
});

test('i18n page: a person who chose Russian in the bot gets the Russian Mini App even when opened without ?lang (one reload)', async (t) => {
  const b = await browser(t); if (!b) return;
  const { page } = await openApp(b, '', 'kk', '', 'ru');
  await page.waitForFunction(() => document.documentElement.lang === 'ru', { timeout: 5000 }).catch(() => {});
  assert.deepStrictEqual(await page.evaluate(() => [document.documentElement.lang, localStorage.getItem('dl_ui_lang')]), ['ru', 'ru']);
  await page.close();
});

test('i18n page: with storage blocked (private mode) the switch still happens once — no reload loop', async (t) => {
  const b = await browser(t); if (!b) return;
  const page = await b.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('telegram.org')) return r.respond({ status: 200, contentType: 'application/javascript', body: "window.Telegram={WebApp:{initData:'',initDataUnsafe:{user:{id:1,language_code:'ru'}},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},showAlert(){},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};" });
    if (u.includes('/api/me')) return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '1', credits: 0, total: 0, price: 250, lang: 'ru' }) });
    if (u.includes('/api/')) return r.respond({ status: 401, contentType: 'application/json', body: '{}' });
    return r.continue();
  });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  let navs = 0;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs++; });
  await page.goto('file://' + path.join(WEB, 'index.html'), { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 1500));
  assert.strictEqual(await page.evaluate(() => document.documentElement.lang), 'ru');
  assert.ok(navs <= 2, `navigated ${navs} times`);
  await page.close();
});

test('i18n: every gallery style has three Kazakh and three Russian preview images; the Russian UI uses the Russian ones', async (t) => {
  const src = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
  const ids = [...src.matchAll(/\{ id: '([a-z]+)', name: '/g)].map((m) => m[1]);
  assert.ok(ids.length >= 13, 'styles found');
  for (const id of ids) for (const n of [1, 2, 3]) for (const sfx of ['', '.ru']) {
    assert.ok(fs.existsSync(path.join(WEB, 'styles', `${id}-${n}${sfx}.jpg`)), `${id}-${n}${sfx}.jpg`);
  }
  const b = await browser(t); if (!b) return;
  for (const [lang, want] of [['ru', /-1\.ru\.jpg\?v=/], ['kk', /-1\.jpg\?v=/]]) {
    const { page } = await openApp(b, lang);
    const srcs = await page.evaluate(() => [...document.querySelectorAll('#styleGallery img')].map((i) => i.getAttribute('src')));
    await page.close();
    assert.ok(srcs.length >= 13 && srcs.every((s) => want.test(s)), `${lang}: ${srcs[0]}`);
  }
});
