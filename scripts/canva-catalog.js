'use strict';
/**
 * Canva шаблондары → products/presentation/library/canva.json жобасы (слайд рөлдері автоматты).
 *
 *   node scripts/canva-catalog.js DIR meta.json > draft.json
 *
 * DIR — canva-prepare.py өңдеген .pptx файлдары (<designId>.pptx), meta.json — { id: {title, groups, subjects, style} }.
 * Рөл слайдтың өз мәтінінен (шаблон тақырыптары: «Contents», «Thank you», «Our Team»...) және мәтін қораптарының
 * пішінінен (templateSchema) анықталады. Адамдар, команда, байланыс, тест, диаграмма слайдтары алынбайды.
 * Нәтижені адам көзбен тексереді (scripts шығарған кесте + рендер).
 */
const fs = require('fs');
const path = require('path');
const { readZipAll } = require('../products/presentation/templateFill');
const { orderedSlides } = require('../design-dna/structure');
const { analyzeTemplate } = require('../products/presentation/templateSchema');

const textOf = (xml) => [...String(xml).matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' ').replace(/\s+/g, ' ').trim();
const SKIP = /\b(our team|meet (the|our)|team members?|about me|contact|get in touch|follow us|social media|our clients|testimonial|pricing|price|question \d|quiz|answer key|credits|resources? page|attribution|references?)\b/i;
const AGENDA = /\b(contents|table of contents|agenda|outline|overview of topics|topics)\b/i;
const CLOSING = /\b(thank\s*you|thanks|q\s*&\s*a|qna|questions\??$|any questions)\b/i;
const QUOTE = /[“"«]|\bquote\b/i;

/** Слайдтың тақырыбы — ең ірі әріппен жазылған мәтін (сайт мәзірі, «Presented by» сияқты ұсақ жазулар емес) */
function titleOf(xml) {
  // тақырып деңгейіндегі мәтіндер: ең ірі кегльдің 60%-ынан кем емес (тақырып пен аты-жөн бірдей ірі болуы мүмкін)
  const items = [];
  for (const m of String(xml).matchAll(/<p:sp>(?:(?!<p:sp>)[\s\S])*?<\/p:sp>/g)) {
    const t = textOf(m[0]); if (!t) continue;
    items.push({ t, sz: Math.max(0, ...[...m[0].matchAll(/\bsz="(\d+)"/g)].map((x) => +x[1])) });
  }
  const max = Math.max(0, ...items.map((x) => x.sz));
  return items.filter((x) => x.sz >= max * 0.6).map((x) => x.t).join(' | ');
}

function roles(buf) {
  const files = readZipAll(buf);
  const slides = orderedSlides(files);
  const sch = analyzeTemplate(buf);
  const out = { cover: 1, agenda: null, section: [], text: [], stats: [], quote: [], closing: null, skipped: [] };
  slides.forEach((sp, i) => {
    const n = i + 1;
    if (n === 1) return;
    const xml = String(files.get(sp));
    const t = textOf(xml);
    const title = titleOf(xml);
    const prof = (sch.slides[i] && sch.slides[i].profile) || '';
    if (/<c:chart|graphicFrame[\s\S]*?chart/.test(xml) || /<a:tbl>/.test(xml)) { out.skipped.push(`${n}:chart/table`); return; }
    if (SKIP.test(title)) { out.skipped.push(`${n}:${(title.match(SKIP) || [''])[0]}`); return; }
    if (!out.agenda && AGENDA.test(title)) { out.agenda = n; return; }
    if ((CLOSING.test(title) || CLOSING.test(t.replace(/\s*\|\s*/g, ' ').slice(0, 60))) && n >= slides.length - 2) { out.closing = n; return; }
    if (/key figure/.test(prof)) { out.stats.push(n); return; }
    if (QUOTE.test(t) && t.length < 320 && !/card/.test(prof)) { out.quote.push(n); return; }
    if (/^title$/.test(prof) || (/^title; subtitle$/.test(prof) && t.length < 60)) { out.section.push(n); return; }
    out.text.push(n);
  });
  return { roles: out, count: slides.length, profiles: sch.slides.map((s, i) => `${i + 1}:${s.profile}`) };
}

if (require.main === module) {
  const [dir, metaFile] = process.argv.slice(2);
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const templates = [];
  for (const id of Object.keys(meta)) {
    const fp = path.join(dir, `${id}.pptx`);
    if (!fs.existsSync(fp)) { console.error('missing', id); continue; }
    const r = roles(fs.readFileSync(fp));
    const m = meta[id];
    templates.push({ id, slug: m.title, style: m.style, groups: m.groups, ...(m.subjects ? { subjects: m.subjects } : {}), ...(m.decor ? { decor: true } : {}),
      ...r.roles, credits: null });
    console.error(`${id} ${m.title} (${r.count}) agenda=${r.roles.agenda} closing=${r.roles.closing} text=${r.roles.text} stats=${r.roles.stats} quote=${r.roles.quote} section=${r.roles.section} skip=${r.roles.skipped.join('|')}`);
  }
  process.stdout.write(JSON.stringify({ source: 'Canva', site: 'https://www.canva.com', permission: 'docs/canva-permission.md', templates }, null, 1));
}

module.exports = { roles };
