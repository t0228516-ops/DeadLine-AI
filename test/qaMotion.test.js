'use strict';
// QA өлшемі анимация баптауына тәуелді болмауы керек (2026-11-07 табылған ақау):
// prefers-reduced-motion-да әр элементке .01ms transition қойылатын → QA --fs/--bfit өзгерісін бірден көрмей, ескі қаріп
// өлшемін оқып слайдты ×1.32-ге дейін үлкейтетін, ал түсіндірме мәтін қорабынан (тіпті слайдтан) асып кететін.
// Түзету: өлшеу кезінде (.measuring) ешбір transition жоқ. Production (reduced motion-сыз) өзгермеген.
const test = require('node:test');
const assert = require('node:assert');
const { build3DPresentationHTML } = require('../products/presentation/html3DBuilder');

const SYS = 'regalia';
const mood = (() => { const s = require('../products/presentation/design/systems').SYSTEMS[SYS]; return s.moodFor ? s.moodFor('Абай Құнанбайұлы — ақын және ойшыл') : s.moods[0]; })();
const c = (x = {}) => ({ ...x, mood, design: SYS, layoutSeed: 2026 });
// Ұзын орысша белгілер: «направление» екі жолға түседі — ақау осында көрінетін
const DECK = [
  { title: 'Абай Кунанбаев — поэт и мыслитель', subtitle: 'Студенческий доклад', bullets: ['Выполнила: Айгерим Сейткалиева', 'Проверил: Т. Абдыкадыров', 'Группа: ТК-21'], composition: c({ visualPurpose: 'cover' }) },
  { title: 'Основные понятия', bullets: ['Первое направление: основное содержание и определение темы', 'Второе направление: исторические и современные примеры', 'Третье направление: влияние на общество и значение'], composition: c() },
];

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

async function render(b, reduced) {
  const page = await b.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 0.5 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setContent(build3DPresentationHTML(DECK, DECK[0].title, { style: 'academic', system: SYS }), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const qa = await page.evaluate(() => window.__qaDone);
  // QA біткен соң бірнеше кадр — transition бар болса, нақты өлшем енді шығады
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)))));
  const blocks = await page.evaluate(() => [...document.querySelectorAll('.slide')[1].querySelectorAll('.cx-t')]
    .map((e) => ({ h: e.clientHeight, sh: e.scrollHeight, bottom: e.getBoundingClientRect().bottom })));
  await page.close();
  return { fs: qa[1].fs, layout: qa[1].layout, issues: qa[1].issues, blocks };
}

test('QA: reduced motion gives the same fit as production, and a long Russian concept never overflows its box', async (t) => {
  const b = await browser(t); if (!b) return;
  const normal = await render(b, false);
  const reduced = await render(b, true);
  assert.strictEqual(normal.layout, 'cx-concepts-ghostcols');
  assert.strictEqual(reduced.fs, normal.fs, `reduced motion fs ${reduced.fs} vs production ${normal.fs}`);
  assert.ok(reduced.fs <= 1.16, `slide grew to ${reduced.fs}`);
  for (const [name, r] of [['production', normal], ['reduced motion', reduced]]) {
    assert.ok(r.blocks.length === 3, name);
    for (const x of r.blocks) assert.ok(x.sh <= x.h + 3, `${name}: block content ${x.sh}px > box ${x.h}px`);
  }
});
