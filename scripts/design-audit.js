'use strict';
/**
 * ДИЗАЙН АУДИТІ — «дизайнер көзі» санмен.
 *   node scripts/design-audit.js [outDir] [--systems=a,b] [--decks=ai,history,science] [--shots]
 *
 * Бірнеше шынайы мазмұн пішінін (қазақша/орысша; тізім, карточка, сан, процесс, салыстыру, дәйексөз, фото) барлық
 * дизайн жүйесінде құрастырып, браузерде (QA скрипті біткен соң, анимациясыз) әр слайдты өлшейді:
 *   • min  — ≥12 таңбалы мәтіннің ең кіші өлшемі (px, 1920 ені; 2 px = 1 pt): қосалқы мәтін ≥ 28 px болуы керек;
 *   • avg  — таңба санымен өлшенген орташа өлшем: негізгі мәтін ≥ 34 px;
 *   • empty — мәтін алмайтын тік үлес (QA-дағы emptyV): 0.4-тен көп болса слайд «бос» көрінеді;
 *   • lost — слайд деректеріндегі мәтін (тақырып, сипаттама, пункт, сан белгісі...) бетте жоқ;
 *   • clip — қорабынан тігінен асып кеткен/кесілген мәтін блогы; hard — QA шеше алмаған ақау; drop — алынып тасталған пункт.
 * Нәтиже: консольдегі кесте + <outDir>/audit.json; --shots болса әр жүйенің контакт-парағы (PNG).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { build3DPresentationHTML } = require(path.join(ROOT, 'products/presentation/html3DBuilder'));
const { applyDeckTheme } = require(path.join(ROOT, 'products/presentation/deckPolish'));
const SYS = require(path.join(ROOT, 'products/presentation/design/systems'));

// фото орнына — суретке ұқсас градиент (өлшем мен орналасу шынайы болсын)
function photo(w, h, c1, c2) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 0.62}" cy="${h * 0.38}" r="${h * 0.18}" fill="rgba(255,255,255,.22)"/><path d="M0 ${h * 0.8} L${w * 0.3} ${h * 0.55} L${w * 0.55} ${h * 0.75} L${w * 0.8} ${h * 0.5} L${w} ${h * 0.78} L${w} ${h} L0 ${h}Z" fill="rgba(0,0,0,.35)"/></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
const PH = (a, b) => photo(1920, 1280, a, b);

const DECKS = {
  // қысқа пункттер, карточкалар, сандар — «бос орын» жиі шығатын мазмұн
  ai: () => [
    { title: 'Жасанды интеллект білім беруде', subtitle: 'Мүмкіндіктер, тәуекелдер және студентке әсері', bullets: ['Орындаған: Айгерім Сейтқалиқызы', 'Тексерген: Т. Әбдіқадыров'], webImageUrl: PH('#6b8fb5', '#1c2a3a'), composition: { visualPurpose: 'cover' } },
    { title: 'Кіріспе', subtitle: 'ЖИ құралдары университет өміріне үш жылда кірді.', body: 'ChatGPT 2022 жылы шыққаннан кейін студенттердің жартысынан көбі оны оқуда қолдана бастады. Бұл оқытудың әдістерін, бағалау жүйесін және оқытушының рөлін өзгертті.', webImageUrl: PH('#9a7b4f', '#2b2118') },
    { title: 'ЖИ қалай көмектеседі', bullets: ['Жеке оқыту — әр студенттің деңгейіне сай тапсырма береді', 'Жедел кері байланыс — қатені бірден түсіндіреді', 'Тіл кедергісі — мәтінді ана тіліне аударады', 'Уақыт үнемі — әдебиетті қысқа шолуға айналдырады'] },
    { title: 'Сандармен', subtitle: '2024 жылғы халықаралық сауалнама', stats: [{ value: '86%', label: 'студенттер ЖИ қолданады' }, { value: '54%', label: 'апта сайын' }, { value: '2×', label: 'жылдам кері байланыс' }] },
    { title: 'Енгізу кезеңдері', bullets: ['Зерттеу — оқытушылар құралдарды сынайды', 'Ереже — университет қолдану саясатын бекітеді', 'Оқыту — студенттерге сауатты қолдануды үйретеді', 'Бағалау — тапсырма форматы өзгереді'], composition: { visualPurpose: 'process' } },
    { title: 'Тәуекелдер', bullets: ['Плагиат — дайын мәтінді өз еңбегі ретінде тапсыру', 'Қате дерек — модель сенімді түрде қате жазады', 'Тәуелділік — өз бетімен ойлау әлсірейді'], webImageUrl: PH('#5e8c61', '#1d2b1e') },
    { title: 'Дәстүрлі және ЖИ-мен оқыту', table: { headers: ['Белгі', 'Дәстүрлі', 'ЖИ-мен'], rows: [['Кері байланыс', 'Аптасына бір', 'Бірден'], ['Тапсырма', 'Бәріне бірдей', 'Жеке'], ['Оқытушы рөлі', 'Түсіндіруші', 'Бағыттаушы']] } },
    { title: 'Негізгі ой', subtitle: 'ЖИ оқытушыны алмастырмайды — ол жақсы оқытушының қолындағы құрал.', composition: { visualPurpose: 'quote' } },
    { title: 'Қорытынды', bullets: ['ЖИ оқуды жекелендіреді және жылдамдатады.', 'Сауатты қолдану ережесі қажет.', 'Бағалау форматы өзгеруі тиіс.'], webImageUrl: PH('#3e7ca8', '#0d2233'), composition: { visualPurpose: 'conclusion' } },
  ],
  // тарих: даталар, ұзын пункттер, дәйексөз, бір сан
  history: () => [
    { title: 'Қазақ хандығының құрылуы және дамуы', subtitle: 'XV–XVII ғасырлардағы саяси тарих', bullets: ['Орындаған: Нұрлан Әбенов', 'Топ: ТК-21'], webImageUrl: PH('#6b4a2b', '#1c120a'), composition: { visualPurpose: 'cover' } },
    { title: 'Тарихи алғышарттар', body: 'XV ғасырдың ортасында Әбілқайыр хандығы ішкі қайшылықтардан әлсіреді. Керей мен Жәнібек сұлтандар өздеріне ерген руларды Моғолстанның батыс шекарасына, Шу мен Талас бойына көшірді. Бұл қоныс жаңа мемлекеттің іргетасы болды.', webImageUrl: PH('#8a6a48', '#20160d') },
    { title: 'Негізгі кезеңдер', bullets: ['1456 — Керей мен Жәнібек Моғолстан шекарасына көшті', '1465 — Қазақ хандығының іргесі қаланды', '1511 — Қасым хан билікке келіп, хандықты нығайтты', '1538 — Хақназар хан тұсында ішкі бірлік қалпына келді'] },
    { title: 'Қасым хан тұсындағы халық саны', stats: [{ value: '1 млн', label: 'адам — Қасым хан тұсындағы халық саны (Мұхаммед Хайдар Дулати бойынша)' }] },
    { title: 'Хандықтың ерекшеліктері', bullets: ['Жүздер жүйесі — аумақтық және рулық бөліну тұрақты басқаруды қамтамасыз етті, әр жүздің өз билері болды', 'Билер кеңесі — дау-жанжалды шешетін жоғары сот органы ретінде әдет-ғұрып құқығына сүйенді', 'Көшпелі шаруашылық — маусымдық жайылымдар мен мал өсіру экономиканың негізін құрады', 'Сауда жолдары — Сыр бойындағы қалалар отырықшы аймақтармен байланыс орталығы болды', 'Әскери ұйым — жасақтар жүз және ру бойынша құрылып, батырлар басқарды'] },
    { title: 'Әз Тәуке', subtitle: 'Жеті жарғы — дала заңының рухы, ол халықты бірлікке шақырды.', composition: { layout: 'quote_hero', visualPurpose: 'quote' } },
    { title: 'Басқару иерархиясы', bullets: ['Хан — жоғарғы билеуші және әскербасы', 'Сұлтандар — аймақтарды басқарушы төрелер', 'Билер — заң және әдет-ғұрып сарапшылары', 'Батырлар — әскери басшылар'], composition: { visualPurpose: 'hierarchy' } },
    { title: 'Қорытынды', bullets: ['Хандық — қазақ мемлекеттілігінің негізі.', 'Жүздер жүйесі басқаруды тұрақтандырды.', 'Сауда мен мал шаруашылығы экономиканы қамтамасыз етті.'], composition: { visualPurpose: 'conclusion' } },
  ],
  // орысша ғылым: анықтама, сандар, процесс, салыстыру, фото+тізім
  science: () => [
    { title: 'Фотосинтез: как растения создают жизнь', subtitle: 'Биология, 9 класс', bullets: ['Выполнила: Анна Ким', 'Проверил: С. Петров'], webImageUrl: PH('#4f8a3c', '#10240c'), composition: { visualPurpose: 'cover' } },
    { title: 'Что такое фотосинтез', body: 'Фотосинтез — процесс, при котором зелёные растения с помощью энергии света превращают углекислый газ и воду в глюкозу и кислород. Он идёт в хлоропластах и поддерживает почти всю жизнь на Земле.', composition: { visualPurpose: 'definition' } },
    { title: 'Две стадии', bullets: ['Световая фаза — свет расщепляет воду, выделяется кислород', 'Темновая фаза — цикл Кальвина связывает углекислый газ в глюкозу'], webImageUrl: PH('#7fb069', '#1f3a19') },
    { title: 'Фотосинтез в цифрах', stats: [{ value: '170 млрд т', label: 'органического вещества в год' }, { value: '50%', label: 'кислорода даёт океан' }, { value: '1–2%', label: 'энергии света запасается' }, { value: '3,5 млрд', label: 'лет назад появился' }] },
    { title: 'Как идёт процесс', bullets: ['Поглощение — хлорофилл улавливает свет', 'Фотолиз — вода распадается на кислород и водород', 'Синтез АТФ — запасается энергия', 'Цикл Кальвина — образуется глюкоза'], composition: { visualPurpose: 'process' } },
    { title: 'Световая и темновая фазы', table: { headers: ['Признак', 'Световая', 'Темновая'], rows: [['Где идёт', 'Тилакоиды', 'Строма'], ['Нужен свет', 'Да', 'Нет'], ['Итог', 'АТФ и кислород', 'Глюкоза']] } },
    { title: 'Значение для планеты', bullets: ['Кислород для дыхания всех живых организмов', 'Пища — основа всех пищевых цепей', 'Климат — растения поглощают углекислый газ', 'Топливо — уголь и нефть образовались из древних растений'], webImageUrl: PH('#2e7d6b', '#0b241f') },
    { title: 'Выводы', bullets: ['Фотосинтез превращает энергию света в химическую.', 'Он даёт кислород и пищу.', 'Без него жизнь на Земле невозможна.'], composition: { visualPurpose: 'conclusion' } },
  ],
};

/**
 * «Бос» көріну — пиксельмен: слайд 48×27 торға бөлінеді, ұяшықтағы жарықтық айырмасы (max−min) 36-дан аз болса — тегіс
 * (бір түсті фон, әлсіз фактура). Мәтін, фото, сызба, әшекей — «толы». hole — ең үлкен тегіс тіктөртбұрыштың слайдтағы үлесі
 * (көрермен «бос» деп көретін аумақ), flat — тегіс ұяшықтардың үлесі.
 */
const GX = 48; const GY = 27;
const HOLE = 0.2; // бір тегіс тіктөртбұрыш слайдтың 20%-ынан үлкен болса — «бос» көрінеді
function pixelEmptiness(pngBuf) {
  const { PNG } = require('pngjs');
  const img = PNG.sync.read(pngBuf);
  const cw = img.width / GX; const ch = img.height / GY;
  const flat = [];
  for (let gy = 0; gy < GY; gy++) {
    const row = [];
    for (let gx = 0; gx < GX; gx++) {
      let lo = 255; let hi = 0;
      for (let y = Math.floor(gy * ch); y < Math.floor((gy + 1) * ch); y += 2) {
        for (let x = Math.floor(gx * cw); x < Math.floor((gx + 1) * cw); x += 2) {
          const k = (img.width * y + x) << 2;
          const l = 0.299 * img.data[k] + 0.587 * img.data[k + 1] + 0.114 * img.data[k + 2];
          if (l < lo) lo = l; if (l > hi) hi = l;
        }
      }
      row.push(hi - lo < 36 ? 1 : 0);
    }
    flat.push(row);
  }
  // ең үлкен тегіс тіктөртбұрыш (гистограмма әдісі)
  const h = new Array(GX).fill(0); let best = 0;
  for (let y = 0; y < GY; y++) {
    for (let x = 0; x < GX; x++) h[x] = flat[y][x] ? h[x] + 1 : 0;
    const st = [];
    for (let x = 0; x <= GX; x++) {
      const cur = x === GX ? 0 : h[x];
      while (st.length && h[st[st.length - 1]] >= cur) {
        const top = st.pop(); const left = st.length ? st[st.length - 1] + 1 : 0;
        best = Math.max(best, h[top] * (x - left));
      }
      st.push(x);
    }
  }
  const nflat = flat.reduce((a, r) => a + r.reduce((b, v) => b + v, 0), 0);
  return { hole: +(best / (GX * GY)).toFixed(3), flat: +(nflat / (GX * GY)).toFixed(3) };
}

// визуалды тесттің эталон колодасы (14 слайд: бөлім, кесте, иерархия, әдебиет тізімі) — аудитке де кіреді
DECKS.fixture = () => JSON.parse(JSON.stringify(require(path.join(ROOT, 'test/visual-regression/fixture')).DECK));

/** Слайд деректеріндегі көрінуі тиіс мәтін бөліктері */
function expected(s) {
  const out = [];
  const add = (x) => { const t = String(x || '').trim(); if (t.length >= 6) out.push(t); };
  // анықтама слайды тақырыптың өзін емес, терминді көрсетеді («Что такое фотосинтез» → «Фотосинтез») — дизайн шешімі
  add(String(s.title || '').replace(/^(что такое|what is)\s+/i, '').replace(/\s*(дегеніміз не|дегеніміз|деген не|ұғымы|анықтамасы|түсінігі)\s*\??$/i, ''));
  add(s.subtitle); add(s.body);
  (s.bullets || []).forEach((b) => { const str = typeof b === 'string' ? b : (b && (b.text || b.label)) || ''; String(str).split(/\s+[—–]\s+|:\s+/).forEach(add); });
  (s.stats || []).forEach((x) => { add(x.label); });
  if (s.table) {
    const hd = s.table.headers || [];
    // 3 бағанды салыстыруда 1-баған тақырыбы («Белгі») — жол белгілерінің атауы, оны көрсетпеу дизайн шешімі
    (hd.length === 3 ? hd.slice(1) : hd).forEach(add);
    (s.table.rows || []).forEach((r) => r.forEach(add));
  }
  return out;
}
const norm = (t) => String(t || '').toLowerCase().replace(/[«»"“”„'’]/g, '').replace(/[^\p{L}\p{N}%]+/gu, ' ').trim();

const IN_PAGE = () => {
  const stage = document.getElementById('stage');
  stage.classList.add('measuring');
  const kk = parseFloat(getComputedStyle(stage).getPropertyValue('--fit')) || 1;
  const report = window.__designReport || [];
  return [].map.call(document.querySelectorAll('.slide'), (s, i) => {
    const sr = s.getBoundingClientRect();
    const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
    let n; let chars = 0; let sum = 0; let min = 999; const texts = [];
    while ((n = w.nextNode())) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!t) continue;
      const p = n.parentElement; if (!p || p.closest('.folio') || p.closest('[data-dropped]')) continue;
      const cs = getComputedStyle(p); if (cs.display === 'none' || +cs.opacity === 0) continue;
      const r = document.createRange(); r.selectNodeContents(n); const bb = r.getBoundingClientRect();
      if (bb.width < 1 || bb.height < 1) continue;
      texts.push(t);
      const f = parseFloat(cs.fontSize) / kk;
      if (t.length >= 12) { min = Math.min(min, f); chars += t.length; sum += f * t.length; }
    }
    // кесілген/асып кеткен блок: биіктігі берілген мәтін блогынан мазмұны тігінен асса
    let clip = 0;
    [].forEach.call(s.querySelectorAll('.cx-t,.cx-fill'), (e) => {
      const st = e.getAttribute('style') || '';
      if (!e.offsetHeight) return;
      let box = 0;
      if (/(^|;)\s*height:/.test(st)) box = e.clientHeight; else { const m = st.match(/max-height:\s*([\d.]+)px/); if (m) box = parseFloat(m[1]); }
      if (!box) return;
      // табиғи биіктік (қорапты уақытша босатып) — flex таратуы мен глиф шығыңқысы «асып кету» емес
      const h = e.style.height; const mh = e.style.maxHeight; const jc = e.style.justifyContent;
      e.style.height = 'auto'; e.style.maxHeight = 'none'; e.style.justifyContent = 'flex-start';
      const nat = e.offsetHeight;
      e.style.height = h; e.style.maxHeight = mh; e.style.justifyContent = jc;
      if (nat > box + 6) clip++;
    });
    const rep = report[i] || {};
    return { i: i + 1, layout: s.getAttribute('data-layout') || '', comp: (s.className.match(/\bcx-[a-z0-9-]+/g) || []).filter((c) => !/^cx-(slide|grow|cover|center|t)$/.test(c)).join(' '),
      min: min === 999 ? null : Math.round(min), avg: chars ? Math.round(sum / chars) : null, empty: rep.empty ?? null, fs: rep.fs ?? 1,
      drop: rep.dropped || 0, hard: (rep.issues || []).filter((x) => x.hard).map((x) => x.type), clip, text: texts.join(' '), w: sr.width };
  });
};

async function main() {
  const args = process.argv.slice(2);
  const out = path.resolve(args.find((a) => !a.startsWith('--')) || 'design-audit');
  const opt = (k) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1].split(',') : null; };
  const systems = opt('systems') || Object.keys(SYS.SYSTEMS);
  const decks = opt('decks') || Object.keys(DECKS);
  const shots = args.includes('--shots');
  const pixels = args.includes('--pixels');
  fs.mkdirSync(out, { recursive: true });
  const { launchBrowser, renderHtmlToPngs } = require(path.join(ROOT, 'products/presentation/renderer'));
  const browser = await launchBrowser(require('puppeteer'));
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  const rows = [];
  for (const sys of systems) {
    for (const dk of decks) {
      const d = DECKS[dk]();
      const data = DECKS[dk]();
      applyDeckTheme(d, { seed: 'audit|' + dk, keep: { system: sys, mood: SYS.SYSTEMS[sys].moods[0] } });
      const html = build3DPresentationHTML(d, d[0].title, { style: 'academic' });
      const file = path.join(out, `${sys}-${dk}.html`);
      fs.writeFileSync(file, html);
      await page.goto('file://' + file, { waitUntil: 'load' });
      await page.evaluate(() => window.__qaDone);
      const res = await page.evaluate(IN_PAGE);
      res.forEach((r) => {
        const s = data[r.i - 1] || {};
        const hay = norm(r.text);
        const lost = expected(s).filter((x) => !hay.includes(norm(x).slice(0, 28)));
        delete r.text;
        rows.push({ sys, deck: dk, ...r, lost });
      });
      if (pixels) {
        await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}#controls,#dots,#hint,#progress,#topbar{display:none!important}.layer{transform:none!important}' });
        const n = res.length;
        for (let k = 0; k < n; k++) {
          await page.evaluate((idx) => {
            document.querySelectorAll('.slide').forEach((el, j) => { el.classList.remove('is-leaving', 'from', 'to'); el.classList.toggle('is-active', j === idx); });
          }, k);
          const el = await page.$('#stage');
          const buf = await el.screenshot({ type: 'png' });
          const pe = pixelEmptiness(buf);
          const row = rows[rows.length - n + k];
          row.hole = pe.hole; row.flat = pe.flat;
          if (shots) { const dir = path.join(out, 'png', `${sys}-${dk}`); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, String(k + 1).padStart(2, '0') + '.png'), buf); }
        }
      } else if (shots) {
        const rr = await renderHtmlToPngs(file);
        const dir = path.join(out, 'png', `${sys}-${dk}`); fs.mkdirSync(dir, { recursive: true });
        (rr.pngPaths || []).forEach((p, k) => fs.copyFileSync(p, path.join(dir, String(k + 1).padStart(2, '0') + '.png')));
      }
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify(rows, null, 1));

  // ── жиынтық ──
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const summarize = (list) => {
    const withText = list.filter((r) => r.min != null);
    const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    return {
      slides: list.length,
      min28: pct(withText.filter((r) => r.min < 28).length, withText.length),
      avg34: pct(withText.filter((r) => r.avg < 34).length, withText.length),
      medMin: med(withText.map((r) => r.min)), medAvg: med(withText.map((r) => r.avg)),
      empty: pct(list.filter((r) => r.empty != null && r.empty > 0.4).length, list.length),
      lost: list.reduce((a, r) => a + r.lost.length, 0), clip: list.reduce((a, r) => a + r.clip, 0),
      hard: list.filter((r) => r.hard.length).length, drop: list.reduce((a, r) => a + r.drop, 0),
      hole: pct(list.filter((r) => r.hole != null && r.hole > HOLE).length, list.filter((r) => r.hole != null).length),
    };
  };
  const line = (name, s) => [name.padEnd(10), String(s.slides).padStart(4), (s.min28 + '%').padStart(7), (s.avg34 + '%').padStart(7), String(s.medMin).padStart(6), String(s.medAvg).padStart(6),
    (s.empty + '%').padStart(7), String(s.lost).padStart(5), String(s.clip).padStart(5), String(s.hard).padStart(5), String(s.drop).padStart(5), (s.hole + '%').padStart(7)].join(' ');
  console.log(`system     slides  min<28 avg<34 medMin medAvg empty>.4  lost  clip  hard  drop hole>${HOLE}`);
  for (const sys of systems) console.log(line(sys, summarize(rows.filter((r) => r.sys === sys))));
  const all = summarize(rows);
  console.log(line('ALL', all));
  const lostList = rows.filter((r) => r.lost.length);
  if (lostList.length) {
    console.log('\nLost text:');
    lostList.slice(0, 40).forEach((r) => console.log(`  ${r.sys}/${r.deck} #${r.i} ${r.comp || r.layout}: ${r.lost.map((x) => '«' + x.slice(0, 50) + '»').join(', ')}`));
  }
  const hardList = rows.filter((r) => r.hard.length || r.clip);
  if (hardList.length) {
    console.log('\nHard issues / clipped blocks:');
    hardList.slice(0, 40).forEach((r) => console.log(`  ${r.sys}/${r.deck} #${r.i} ${r.comp || r.layout}: ${r.hard.join(',')}${r.clip ? ' clip=' + r.clip : ''}`));
  }
  // ең «бос» және ең ұсақ композициялар
  const byComp = {};
  rows.forEach((r) => { const k = r.comp || r.layout; (byComp[k] = byComp[k] || []).push(r); });
  const worst = Object.entries(byComp).map(([k, l]) => ({ k, n: l.length, hole: l.filter((r) => r.hole > HOLE).length, small: l.filter((r) => r.min != null && r.min < 28).length }))
    .filter((x) => x.hole || x.small).sort((a, b) => (b.hole + b.small) - (a.hole + a.small)).slice(0, 30);
  console.log(`\nWorst compositions (hole>${HOLE} / min<28 of n):`);
  worst.forEach((x) => console.log(`  ${x.k.padEnd(28)} hole ${x.hole}/${x.n}  small ${x.small}/${x.n}`));
  return all;
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { DECKS, expected, norm };
