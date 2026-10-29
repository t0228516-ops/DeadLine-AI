'use strict';
/**
 * Көзбен салыстыратын тест (visual regression): әр дизайн жүйесінің эталон колодасы суретке түсіріліп,
 * сақталған эталонмен пиксель бойынша салыстырылады. Код дизайнды байқаусызда бұзса — тест құлайды,
 * айырмашылық суреті __diff__/ қалтасына жазылады (CI артефакт ретінде жүктейді).
 *
 *   npm run test:visual                    — салыстыру
 *   UPDATE_SNAPSHOTS=1 npm run test:visual — әдейі өзгерген дизайнның эталонын жаңарту (PR-да көзбен тексеріледі)
 *
 * Детерминді: тұрақты тұқым (layoutSeed), фото орнына SVG градиент, қаріптер репоның ішінде (assets/fonts),
 * анимация/ауысулар өшірулі. Кішірейтілген (480×270) суреттер — ұсақ рендер шуы эталонды бұзбасын.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { build3DPresentationHTML } = require('../../products/presentation/html3DBuilder');
const { DECK } = require('./fixture');

const SNAP = path.join(__dirname, '__snapshots__');
const DIFF = path.join(__dirname, '__diff__');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';
const SYSTEMS = ['heritage', 'swiss', 'mono', 'journal'];
const MAX_DIFF_RATIO = Number(process.env.VISUAL_MAX_DIFF) || 0.015;   // слайд пикселдерінің 1.5%-ы

const FREEZE = '#controls,#dots,#hint,#progress,#topbar{display:none!important}#stage{box-shadow:none!important}'
  + '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}.layer{transform:none!important}';

let browser;
test.before(async () => { browser = await require('../../products/presentation/renderer').launchBrowser(require('puppeteer')); });
test.after(async () => { if (browser) await browser.close(); });

async function shoot(system) {
  const html = build3DPresentationHTML(DECK, 'Қазақ хандығы', { style: 'academic', system });
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 0.25 });
    // қысқа ауысу (runtime: 40 мс құлып) — слайдтар арасында жылдам әрі детерминді
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // беттегі сыйғызу QA-сы (--fs/--wfit) асинхронды — біткенін күтеміз, әйтпесе мәтін өлшемі түсірген сәтке тәуелді
    await page.waitForFunction(() => window.__qaDone !== undefined, { timeout: 30_000 }).catch(() => {});
    await page.evaluate(() => window.__qaDone);
    await page.addStyleTag({ content: FREEZE });
    const n = await page.evaluate(() => document.querySelectorAll('.slide').length);
    const shots = [];
    for (let i = 0; i < n; i++) {
      // өндірістегі renderer.js сияқты: runtime арқылы ауысу (is-active, слайд түстері), сосын басқа слайдтар жасырылады
      if (i > 0) { await page.keyboard.press('ArrowRight'); await new Promise((r) => setTimeout(r, 150)); }
      await page.evaluate((idx) => document.querySelectorAll('.slide').forEach((el, j) => {
        if (j !== idx) el.style.setProperty('display', 'none', 'important');
        else {
          el.classList.remove('is-leaving', 'from', 'to');
          el.style.removeProperty('display');
          for (const [k, v] of [['opacity', '1'], ['visibility', 'visible'], ['transform', 'none'], ['filter', 'none']]) el.style.setProperty(k, v, 'important');
        }
      }), i);
      const stage = await page.$('#stage');
      shots.push(await stage.screenshot({ type: 'png' }));
    }
    return shots;
  } finally { await page.close(); }
}

async function compare(name, buf) {
  const file = path.join(SNAP, name + '.png');
  if (UPDATE || !fs.existsSync(file)) {
    fs.mkdirSync(SNAP, { recursive: true });
    fs.writeFileSync(file, buf);
    return { created: true };
  }
  const { default: pixelmatch } = await import('pixelmatch');
  const a = PNG.sync.read(fs.readFileSync(file));
  const b = PNG.sync.read(buf);
  if (a.width !== b.width || a.height !== b.height) return { ratio: 1, reason: `size ${a.width}×${a.height} → ${b.width}×${b.height}` };
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12 });
  const ratio = n / (a.width * a.height);
  if (ratio > MAX_DIFF_RATIO) {
    fs.mkdirSync(DIFF, { recursive: true });
    fs.writeFileSync(path.join(DIFF, name + '.diff.png'), PNG.sync.write(diff));
    fs.writeFileSync(path.join(DIFF, name + '.actual.png'), buf);
  }
  return { ratio };
}

for (const system of SYSTEMS) {
  test(`visual: ${system} — every slide matches its reference`, { timeout: 180_000 }, async () => {
    const shots = await shoot(system);
    assert.ok(shots.length >= 10, `колода түсірілмеді (${shots.length} слайд)`);
    // бос (бір түсті) сурет — түсіру бұзылған: эталон ретінде сақталмасын
    const blank = shots.map((b, i) => [i + 1, PNG.sync.read(b)]).filter(([, p]) => { const d = p.data; for (let k = 4; k < d.length; k += 4 * 97) if (Math.abs(d[k] - d[0]) + Math.abs(d[k + 1] - d[1]) + Math.abs(d[k + 2] - d[2]) > 24) return false; return true; }).map(([i]) => i);
    assert.deepStrictEqual(blank, [], `бос слайд суреті: ${blank.join(', ')}`);
    const bad = [];
    for (let i = 0; i < shots.length; i++) {
      const name = `${system}-${String(i + 1).padStart(2, '0')}`;
      const r = await compare(name, shots[i]);
      if (!r.created && r.ratio > MAX_DIFF_RATIO) bad.push(`${name}: ${(r.ratio * 100).toFixed(2)}%${r.reason ? ' ' + r.reason : ''}`);
    }
    assert.deepStrictEqual(bad, [], `дизайн өзгерді (айырмашылық суреттері test/visual-regression/__diff__/): ${bad.join(', ')}`);
  });
}
