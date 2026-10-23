'use strict';
// Шаблон кітапханасы (SlidesCarnival): кесу, Credits қосу, слайд реті, таңдау, кімге қосылатыны (желісіз).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.LIBRARY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-test-'));
const { readZipAll } = require('../products/presentation/templateFill');
const { orderedSlides, relsMap, resolvePath } = require('../design-dna/structure');
const { carveDeck, appendSlideFrom, reachable } = require('../products/presentation/library/carve');
const L = require('../products/presentation/library');

const FIX = fs.readFileSync(path.join(__dirname, 'fixture-rich.pptx'));
const textOf = (files, p) => [...String(files.get(p)).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' ');

function noDanglingRels(files) {
  for (const [name, rels] of files) {
    if (!name.endsWith('.rels')) continue;
    const owner = name.replace(/_rels\/([^/]+)\.rels$/, '$1');
    for (const r of Object.values(relsMap(rels))) {
      if (!r.target || /^https?:|^mailto:/i.test(r.target) || r.type === 'hyperlink') continue;
      const p = name === '_rels/.rels' ? r.target.replace(/^\//, '') : resolvePath(owner, r.target);
      assert.ok(files.has(p), `${name} → ${p} жоқ`);
    }
  }
}

test('carve: only the picked slides stay, in order, duplicates allowed; nothing dangles; unused parts are dropped', () => {
  const src = readZipAll(FIX);
  const order = orderedSlides(src);
  const out = carveDeck(FIX, [0, 3, 3, 9]);
  const files = readZipAll(out);
  const slides = orderedSlides(files);
  assert.strictEqual(slides.length, 4);
  assert.strictEqual(textOf(files, slides[0]), textOf(src, order[0]));
  assert.strictEqual(textOf(files, slides[1]), textOf(src, order[3]));
  assert.strictEqual(textOf(files, slides[2]), textOf(src, order[3]), 'қайталанған слайд');
  assert.strictEqual(textOf(files, slides[3]), textOf(src, order[9]));
  noDanglingRels(files);
  const ct = files.get('[Content_Types].xml');
  assert.strictEqual((ct.match(/PartName="\/ppt\/slides\/slide\d+\.xml"/g) || []).length, 4);
  assert.ok(![...files.keys()].some((k) => k.startsWith('ppt/notesSlides/')), 'ескертпелер өшті');
  const keep = reachable(files);
  assert.ok([...files.keys()].filter((k) => k.startsWith('ppt/media/')).every((k) => keep.has(k)), 'сілтенбейтін сурет қалмады');
  assert.ok(out.length <= FIX.length);
  assert.throws(() => carveDeck(FIX, [0, 42]), /жоқ/);
});

test('credits: the original slide is appended unchanged at the end', () => {
  const deck = carveDeck(FIX, [0, 1, 2]);
  const out = appendSlideFrom(deck, FIX, 9);
  const files = readZipAll(out);
  const slides = orderedSlides(files);
  assert.strictEqual(slides.length, 4);
  assert.strictEqual(files.get(slides[3]), readZipAll(FIX).get(orderedSlides(readZipAll(FIX))[9]), 'Credits мәтіні өзгермеген');
  noDanglingRels(files);
  const ids = [...files.get('ppt/presentation.xml').matchAll(/<p:sldId id="(\d+)"/g)].map((m) => m[1]);
  assert.strictEqual(new Set(ids).size, ids.length, 'слайд id қайталанбайды');
});

test('plan: cover first, closing last, the asked length, no layout twice in a row', () => {
  for (const t of L.CATALOG.templates) {
    for (const n of [6, 9, 12, 15]) {
      const p = L.planPicks(t, n);
      assert.strictEqual(p.length, n, `${t.id} n=${n}`);
      assert.strictEqual(p[0], t.cover - 1);
      if (t.closing) assert.strictEqual(p[p.length - 1], t.closing - 1);
      for (let i = 1; i < p.length; i++) if (t.text.length > 1) assert.notStrictEqual(p[i], p[i - 1], `${t.id} n=${n} @${i}`);
      assert.ok(!p.includes(t.credits - 1), 'Credits тек соңынан қосылады');
    }
  }
});

test('catalog: every template has a cover, credits and text slides; groups are known', () => {
  const G = new Set(['general', 'history', 'science', 'education', 'philosophy']);
  assert.ok(L.CATALOG.templates.length >= 10 && L.CATALOG.templates.length <= 30, 'рұқсат: 10–15, кейін 30-ға дейін');
  for (const t of L.CATALOG.templates) {
    assert.ok(t.cover >= 1 && t.credits > t.cover, t.id);
    assert.ok(t.text.length + t.section.length >= 2, t.id);
    assert.ok(t.groups.every((g) => G.has(g)), t.id);
  }
});

test('choose: topic decides the group; the student\'s recent templates are avoided', () => {
  assert.deepStrictEqual(L.topicGroups('1920–1930 жылдардағы ұжымдастыру тарихы'), ['history']);
  assert.ok(L.topicGroups('Транзисторлар және физика').includes('science'));
  assert.deepStrictEqual(L.topicGroups('Менің арманым'), ['general']);
  const t = L.chooseTemplate({ topic: 'Қазақ хандығының тарихы', rng: () => 0 });
  assert.ok(t.groups.includes('history'));
  const avoid = L.CATALOG.templates.filter((x) => x.groups.includes('history')).map((x) => x.id).slice(0, -1);
  const t2 = L.chooseTemplate({ topic: 'Қазақ хандығының тарихы', avoid, rng: () => 0 });
  assert.ok(!avoid.includes(t2.id));
});

test('eligible: off by mode, testers/admins only by default, share splits them', () => {
  assert.strictEqual(L.eligible({ tester: true }, { LIBRARY_MODE: 'off' }, () => 0), false);
  assert.strictEqual(L.eligible({}, {}, () => 0), false, 'әдепкіде тек тестерлер');
  assert.strictEqual(L.eligible({ tester: true }, {}, () => 0.2), true);
  assert.strictEqual(L.eligible({ tester: true }, {}, () => 0.7), false, 'әдепкі үлес 0.5');
  assert.strictEqual(L.eligible({}, { LIBRARY_MODE: 'all', LIBRARY_SHARE: '1' }, () => 0.99), true);
});

test('prepareDeck: downloads once, caches on disk, carves without credits and keeps credits for the end', async () => {
  let calls = 0;
  const http = { get: async () => { calls++; return { data: FIX }; } };
  const entry = { id: 'fx1', slug: 'fixture', style: 'test', groups: ['general'], cover: 1, agenda: 2, section: [], text: [3, 4, 5], stats: [6], quote: [7], closing: 9, credits: 10 };
  const prep = await L.prepareDeck({ entry, slideCount: 8, http });
  assert.strictEqual(prep.slideCount, 8);
  assert.strictEqual(orderedSlides(readZipAll(prep.deckBuf)).length, 8, 'толтыруға Credits-сіз');
  const done = L.appendCredits(prep.deckBuf, prep);
  assert.strictEqual(orderedSlides(readZipAll(done)).length, 9);
  await L.prepareDeck({ entry, slideCount: 6, http });
  assert.strictEqual(calls, 1, 'екінші рет дискіден');
});

test('credits link: the last slide links to slidescarnival.com (a condition of the permission), once', () => {
  const deck = carveDeck(FIX, [0, 1]);
  const out = L.linkCredits(L.linkCredits(appendSlideFrom(deck, FIX, 9), -1), -1);
  const files = readZipAll(out);
  const sp = orderedSlides(files).slice(-1)[0];
  const rels = files.get(sp.replace(/([^/]+)$/, '_rels/$1.rels'));
  const link = Object.entries(relsMap(rels)).filter(([, r]) => /slidescarnival\.com/.test(r.target));
  assert.strictEqual(link.length, 1, 'бір сілтеме');
  const xml = files.get(sp);
  assert.strictEqual((xml.match(/www\.slidescarnival\.com/g) || []).length, 1, 'көрінетін мекенжай бір рет');
  assert.ok(xml.includes(`r:id="${link[0][0]}"`));
  assert.strictEqual(orderedSlides(files).length, 3, 'басқа слайдтар өзгермейді');
});

test('normalizeGroups: scaled groups get real child sizes, nested groups too; same geometry on the slide', () => {
  const { normalizeGroups } = require('../products/presentation/library/carve');
  const grp = (off, ext, ch, chx, body) => `<p:grpSp><p:nvGrpSpPr/><p:grpSpPr><a:xfrm><a:off x="${off[0]}" y="${off[1]}"/><a:ext cx="${ext[0]}" cy="${ext[1]}"/><a:chOff x="${ch[0]}" y="${ch[1]}"/><a:chExt cx="${chx[0]}" cy="${chx[1]}"/></a:xfrm></p:grpSpPr>${body}</p:grpSp>`;
  const sp = (x, y, w, h) => `<p:sp><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm></p:spPr></p:sp>`;
  const xml = grp([1000, 2000], [500, 500], [0, 0], [1000, 1000], sp(200, 400, 600, 200) + grp([0, 0], [1000, 1000], [0, 0], [2000, 2000], sp(1000, 1000, 1000, 1000)));
  const out = normalizeGroups(xml);
  assert.ok(out.includes('<a:off x="1100" y="2200"/><a:ext cx="300" cy="100"/>'), 'бірінші деңгей');
  assert.ok(out.includes('<a:off x="1250" y="2250"/><a:ext cx="250" cy="250"/>'), 'ішкі топ');
  assert.strictEqual((out.match(/<a:chOff x="1000" y="2000"\/><a:chExt cx="500" cy="500"\/>/g) || []).length, 2, 'топтар масштабсыз');
  const plain = grp([10, 10], [100, 100], [10, 10], [100, 100], sp(20, 20, 30, 30));
  assert.strictEqual(normalizeGroups(plain), plain, 'масштабсыз топ өзгермейді');
});

test('subjects: templates with subject-bound decor appear only for that subject, and often there', () => {
  assert.deepStrictEqual(L.topicSubjects('Жүрек ауруларының алдын алу'), ['medicine']);
  assert.deepStrictEqual(L.topicSubjects('Дәріс: экономика негіздері'), [], '«дәріс» — дәрі емес');
  assert.deepStrictEqual(L.topicSubjects('Тауар және баға'), []);
  const bound = new Set(L.CATALOG.templates.filter((t) => t.subjects).map((t) => t.id));
  assert.ok(bound.size >= 5);
  let r = 0; const rng = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 300; i++) assert.ok(!bound.has(L.chooseTemplate({ topic: 'Қазақ хандығының тарихы', rng }).id), 'тарихқа дәрігер/ғарыш шаблоны жоқ');
  let hits = 0;
  for (let i = 0; i < 300; i++) if (L.chooseTemplate({ topic: 'Күн жүйесінің планеталары', rng }).id === 'sc01064') hits++;
  assert.ok(hits > 100, `ғарыш тақырыбына ғарыш шаблоны жиі (${hits}/300)`);
});

test('credits link: only the SlidesCarnival run is linked, before extLst; neighbours untouched', () => {
  const deck = carveDeck(FIX, [0]);
  const files = readZipAll(deck);
  const sp = orderedSlides(files)[0];
  const runs = '<a:r><a:rPr lang="en-US"/><a:t>Thanks to</a:t></a:r><a:r><a:rPr lang="en-US" b="1"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:extLst><a:ext uri="{X}"/></a:extLst></a:rPr><a:t>SlidesCarnival</a:t></a:r>';
  files.set(sp, files.get(sp).replace('</p:spTree>', `<p:sp><p:nvSpPr><p:cNvPr id="9" name="c"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p>${runs}</a:p></p:txBody></p:sp></p:spTree>`));
  const { writeZipAll, xmlProblem } = require('../products/presentation/templateFill');
  const out = readZipAll(L.linkCredits(writeZipAll(files), 0));
  const xml = out.get(sp);
  assert.strictEqual(xmlProblem(xml), null);
  assert.ok(xml.includes('<a:r><a:rPr lang="en-US"/><a:t>Thanks to</a:t></a:r>'), 'көрші жол өзгермеді');
  assert.ok(/<a:hlinkClick r:id="rIdDlScLink"\/><a:extLst>/.test(xml), 'hlinkClick extLst алдында');
});

test('prepareDeck: an explicitly chosen template that is too heavy is shortened, not swapped', async () => {
  const http = { get: async () => ({ data: FIX }) };
  const heavy = { id: 'fxH', slug: 'h', style: 't', groups: ['general'], cover: 1, agenda: 2, section: [], text: [3, 4, 5], stats: [6], quote: [7], closing: 9, credits: 10 };
  const old = process.env.LIBRARY_MAX_MB;
  process.env.LIBRARY_MAX_MB = '0.0001';
  delete require.cache[require.resolve('../products/presentation/library')];
  const L2 = require('../products/presentation/library');
  const fixed = await L2.prepareDeck({ entry: heavy, slideCount: 12, http });
  assert.strictEqual(fixed.id, 'fxH');
  assert.ok(fixed.slideCount < 12);
  if (old == null) delete process.env.LIBRARY_MAX_MB; else process.env.LIBRARY_MAX_MB = old;
  delete require.cache[require.resolve('../products/presentation/library')];
});
