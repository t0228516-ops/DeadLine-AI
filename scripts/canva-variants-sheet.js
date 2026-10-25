'use strict';
/**
 * Canva шаблондарының нұсқаларын көзбен тексеру: әр шаблоннан 3 слайд — түпнұсқа (.o), айна (.m), түс ауыстыру (.c).
 *
 *   node scripts/canva-variants-sheet.js DIR OUT
 *
 * DIR — дайындалған шаблондар (<designId>.pptx), OUT — нәтиже .pptx файлдары. Сосын LibreOffice-пен суретке айналдырып,
 * қатар қарау керек; айна жараспаса canva.json-да mirror:false, түс жарасса recolor:{from, to:[рең]} (from — басты рең).
 */
const fs = require('fs');
const path = require('path');
const V = require('../products/presentation/library/variants');
const L = require('../products/presentation/library');
const { carveDeck } = require('../products/presentation/library/carve');

const HUES = [355, 22, 42, 140, 175, 205, 228, 268, 330];

(async () => {
  const [dir, out] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const browser = await require('../products/presentation/renderer').launchBrowser(require('puppeteer'));
  const page = await browser.newPage();
  for (const t of L.CATALOG.templates.filter((x) => x.source === 'canva')) {
    const src = fs.readFileSync(path.join(dir, `${t.id}.pptx`));
    const deck = carveDeck(src, [t.cover, t.text[0], t.text[Math.min(2, t.text.length - 1)]].map((x) => x - 1));
    const from = V.dominantHue(src);
    const to = HUES.filter((h) => Math.min(Math.abs(h - from), 360 - Math.abs(h - from)) >= 90)[0];
    fs.writeFileSync(path.join(out, `${t.id}.o.pptx`), deck);
    fs.writeFileSync(path.join(out, `${t.id}.m.pptx`), await V.applyVariant(deck, { mirror: true, hue: 0 }, { page }));
    fs.writeFileSync(path.join(out, `${t.id}.c.pptx`), V.recolorDeck(deck, ((to - from) % 360 + 360) % 360));
    console.log(t.id, `recolor:{from:${from}, to:[${to}]}`);
  }
  await browser.close();
})();
