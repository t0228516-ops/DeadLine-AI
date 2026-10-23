'use strict';
/**
 * Шаблонды КЕСУ: үлкен шаблоннан тек таңдалған слайдтар (қайталау мүмкін) қалады, қалғаны және
 * ешкім сілтемейтін бөліктер (сурет, ескертпе, диаграмма) өшеді. 60 МБ-тық шаблон осылай бірнеше МБ-қа түседі
 * (Telegram бот файлының шегі ~50 МБ).
 *
 *   carveDeck(buf, picks)            — picks: 0-негізді слайд нөмірлері (көрсету реті бойынша)
 *   appendSlideFrom(dest, src, idx)  — src шаблонның idx-слайдын (мыс. Credits) dest соңына сол күйі қосу
 */
const { readZipAll, writeZipAll } = require('../templateFill');
const { orderedSlides, relsMap, resolvePath } = require('../../../design-dna/structure');

const SLIDE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const SLIDE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const relsPathOf = (p) => p.replace(/([^/]+)$/, '_rels/$1.rels');
const isNotesRel = (r) => /\/notesSlide"/.test(r);

/** Бөліктің .rels файлынан ескертпе (notesSlide) сілтемелерін алып тастау — қайталанған слайдта қақтығыспасын */
function stripNotes(rels) {
  return String(rels || '').replace(/<Relationship [^>]*\/>/g, (r) => (isNotesRel(r) ? '' : r));
}

/** presentation.xml: слайд тізімі жаңарады; ескі слайд id-леріне сілтейтін бөлімдер/арнайы көрсетілімдер өшеді */
function rewritePresentation(pres, rids) {
  const list = '<p:sldIdLst>' + rids.map((rid, i) => `<p:sldId id="${256 + i}" r:id="${rid}"/>`).join('') + '</p:sldIdLst>';
  let out = /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>|<p:sldIdLst\/>/.test(pres)
    ? pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>|<p:sldIdLst\/>/, list)
    : pres.replace(/(<p:sldMasterIdLst>[\s\S]*?<\/p:sldMasterIdLst>)/, `$1${list}`);
  out = out.replace(/<p:custShowLst>[\s\S]*?<\/p:custShowLst>/g, '');
  out = out.replace(/<p:ext uri="[^"]*"><p14:sectionLst[\s\S]*?<\/p14:sectionLst><\/p:ext>/g, '');
  return out;
}

/** _rels/.rels-тен бастап барлық сілтенетін бөліктер жиыны */
function reachable(files) {
  const seen = new Set(); const stack = [];
  const visitRels = (owner, relsPath) => {
    const map = relsMap(files.get(relsPath));
    for (const r of Object.values(map)) {
      if (!r.target || /^https?:|^mailto:/i.test(r.target)) continue;
      const p = owner ? resolvePath(owner, r.target) : r.target.replace(/^\//, '');
      if (p && files.has(p) && !seen.has(p)) { seen.add(p); stack.push(p); }
    }
  };
  visitRels('', '_rels/.rels');
  while (stack.length) {
    const p = stack.pop();
    const rp = relsPathOf(p);
    if (files.has(rp)) visitRels(p, rp);
  }
  return seen;
}

/** Ешкім сілтемейтін бөліктерді (және олардың .rels-ін, Content_Types жазбасын) өшіру */
function collectGarbage(files) {
  const keep = reachable(files);
  const gone = [];
  for (const name of [...files.keys()]) {
    if (name === '[Content_Types].xml' || name === '_rels/.rels' || keep.has(name)) continue;
    if (name.endsWith('.rels')) {
      const owner = name.replace(/_rels\/([^/]+)\.rels$/, '$1');
      if (keep.has(owner)) continue;
    }
    files.delete(name); gone.push(name);
  }
  const ct = files.get('[Content_Types].xml');
  if (ct) files.set('[Content_Types].xml', ct.replace(/<Override [^>]*PartName="\/([^"]+)"[^>]*\/>/g, (o, part) => (files.has(part) ? o : '')));
  return gone;
}

/**
 * @param {Buffer} buf  шаблон .pptx
 * @param {number[]} picks 0-негізді слайд нөмірлері (көрсету реті бойынша), қайталау рұқсат
 * @returns {Buffer} жаңа .pptx: тек picks слайдтары, сол ретпен
 */
function carveDeck(buf, picks) {
  const files = readZipAll(buf);
  const order = orderedSlides(files);
  if (!Array.isArray(picks) || !picks.length) throw new Error('carve: бос таңдау');
  picks.forEach((k) => { if (!Number.isInteger(k) || k < 0 || k >= order.length) throw new Error(`carve: слайд ${k} жоқ (барлығы ${order.length})`); });
  const src = new Map(order.map((p) => [p, { xml: files.get(p), rels: files.get(relsPathOf(p)) }]));

  // ескі слайдтар мен ескертпелер өшеді (ескертпе слайдқа кері сілтейді — қайталанғанда қақтығысады)
  for (const name of [...files.keys()]) {
    if (/^ppt\/slides\/(_rels\/)?slide\d+\.xml(\.rels)?$/.test(name) || /^ppt\/notesSlides\//.test(name)) files.delete(name);
  }
  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  let presRels = (files.get(presRelsPath) || '').replace(/<Relationship [^>]*\/>/g, (r) => (r.includes(`Type="${SLIDE_REL}"`) ? '' : r));
  const rids = [];
  const relAdd = [];
  picks.forEach((k, i) => {
    const s = src.get(order[k]);
    const name = `ppt/slides/slide${i + 1}.xml`;
    files.set(name, s.xml);
    if (s.rels != null) files.set(`ppt/slides/_rels/slide${i + 1}.xml.rels`, stripNotes(s.rels));
    const rid = `rIdDl${i + 1}`;
    rids.push(rid);
    relAdd.push(`<Relationship Id="${rid}" Type="${SLIDE_REL}" Target="slides/slide${i + 1}.xml"/>`);
  });
  files.set(presRelsPath, presRels.replace('</Relationships>', relAdd.join('') + '</Relationships>'));
  files.set('ppt/presentation.xml', rewritePresentation(files.get('ppt/presentation.xml') || '', rids));

  let ct = files.get('[Content_Types].xml') || '';
  ct = ct.replace(/<Override [^>]*PartName="\/ppt\/(slides|notesSlides)\/[^"]+"[^>]*\/>/g, '');
  ct = ct.replace('</Types>', picks.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${SLIDE_CT}"/>`).join('') + '</Types>');
  files.set('[Content_Types].xml', ct);

  const app = files.get('docProps/app.xml');
  if (app) files.set('docProps/app.xml', app.replace(/<Slides>\d+<\/Slides>/, `<Slides>${picks.length}</Slides>`).replace(/<Notes>\d+<\/Notes>/, '<Notes>0</Notes>'));
  pruneLayouts(files);
  collectGarbage(files);
  return writeZipAll(files);
}

/** Қалған слайдтар қолданбайтын макеттер (көбінде үлкен фон суреттері) master-ден ажыратылады — GC оларды өшіреді */
function pruneLayouts(files) {
  const used = new Set();
  for (const [name, rels] of files) {
    if (!/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(name)) continue;
    for (const r of Object.values(relsMap(rels))) if (r.type === 'slideLayout') used.add(resolvePath(name.replace('_rels/', '').replace(/\.rels$/, ''), r.target));
  }
  for (const name of [...files.keys()]) {
    if (!/^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)) continue;
    const rp = relsPathOf(name);
    const map = relsMap(files.get(rp));
    const drop = new Set(Object.entries(map).filter(([, r]) => r.type === 'slideLayout' && !used.has(resolvePath(name, r.target))).map(([id]) => id));
    if (!drop.size) continue;
    files.set(rp, files.get(rp).replace(/<Relationship [^>]*\/>/g, (r) => (drop.has((r.match(/Id="([^"]+)"/) || [])[1]) ? '' : r)));
    files.set(name, files.get(name).replace(/<p:sldLayoutId [^>]*\/>/g, (t) => (drop.has((t.match(/r:id="([^"]+)"/) || [])[1]) ? '' : t)));
  }
}

/** Кеңейтімге қарай әдепкі мазмұн түрі (Content_Types-та Default жоқ болса қосылады) */
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', emf: 'image/x-emf', wmf: 'image/x-wmf', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff' };

/**
 * src шаблонның srcIdx-слайдын dest соңына ЕШ ӨЗГЕРІССІЗ қосу (Credits — атрибуция мәтіні толтырылмауы керек).
 * Слайд сілтейтін сурет/макет dest-те жоқ болса src-тен көшіріледі.
 */
function appendSlideFrom(destBuf, srcBuf, srcIdx) {
  const dest = readZipAll(destBuf);
  const src = readZipAll(srcBuf);
  const sp = orderedSlides(src)[srcIdx];
  if (!sp) throw new Error(`append: слайд ${srcIdx} жоқ`);
  const n = orderedSlides(dest).length + 1;
  let name = `ppt/slides/slide${n}.xml`;
  for (let k = n; dest.has(name); k++) name = `ppt/slides/slide${k + 1}.xml`;
  const rels = stripNotes(src.get(relsPathOf(sp)) || '');
  dest.set(name, src.get(sp));
  if (rels) dest.set(relsPathOf(name), rels);

  // слайд сілтейтін бөліктер (сурет, макет) — dest-те жоқ болса көшіреміз (ұқсас жолмен)
  const copyPart = (part) => {
    if (dest.has(part) || !src.has(part)) return;
    dest.set(part, src.get(part));
    const pr = relsPathOf(part);
    if (src.has(pr)) {
      dest.set(pr, src.get(pr));
      for (const r of Object.values(relsMap(src.get(pr)))) if (r.target && !/^https?:/i.test(r.target)) copyPart(resolvePath(part, r.target));
    }
    const ctSrc = src.get('[Content_Types].xml') || '';
    const ov = ctSrc.match(new RegExp(`<Override [^>]*PartName="/${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`));
    let ct = dest.get('[Content_Types].xml') || '';
    if (ov && !ct.includes(`PartName="/${part}"`)) ct = ct.replace('</Types>', ov[0] + '</Types>');
    const ext = (part.match(/\.([a-z0-9]+)$/i) || [])[1];
    if (ext && MIME[ext.toLowerCase()] && !new RegExp(`Extension="${ext}"`, 'i').test(ct)) ct = ct.replace('<Types', '<Types').replace(/(<Types[^>]*>)/, `$1<Default Extension="${ext}" ContentType="${MIME[ext.toLowerCase()]}"/>`);
    dest.set('[Content_Types].xml', ct);
  };
  for (const r of Object.values(relsMap(rels))) if (r.target && !/^https?:/i.test(r.target)) copyPart(resolvePath(name, r.target));

  const rid = `rIdDl${n}x`;
  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  dest.set(presRelsPath, dest.get(presRelsPath).replace('</Relationships>', `<Relationship Id="${rid}" Type="${SLIDE_REL}" Target="${name.replace(/^ppt\//, '')}"/></Relationships>`));
  const pres = dest.get('ppt/presentation.xml');
  const maxId = Math.max(255, ...[...pres.matchAll(/<p:sldId id="(\d+)"/g)].map((m) => +m[1]));
  dest.set('ppt/presentation.xml', pres.replace('</p:sldIdLst>', `<p:sldId id="${maxId + 1}" r:id="${rid}"/></p:sldIdLst>`));
  dest.set('[Content_Types].xml', dest.get('[Content_Types].xml').replace('</Types>', `<Override PartName="/${name}" ContentType="${SLIDE_CT}"/></Types>`));
  const app = dest.get('docProps/app.xml');
  if (app) dest.set('docProps/app.xml', app.replace(/<Slides>\d+<\/Slides>/, `<Slides>${n}</Slides>`));
  return writeZipAll(dest);
}

module.exports = { carveDeck, appendSlideFrom, collectGarbage, reachable };
