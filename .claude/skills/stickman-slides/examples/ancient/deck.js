/* «Ежелгі адамдар» — cinema deck (full-screen cartoon, 8 slides, sound). Text lives in the world, no cards. */
CINE_TITLE = 'Ежелгі адамдар';
CTHEME = { ink: '#2b2621', acc: '#C4561D' };

const HS = 1.5, HY = GY - 132 * HS;          // hero scale / hip y
const KS = 1.45, KY = GY - 132 * KS;         // ancient person
const P = (o) => ({ sc: HS, y: HY, ...o });
const PK = (o) => ({ sc: KS, y: KY, ...o });
const starsAround = (pose, t, n = 4) => { const J = joints({ ...BASE, ...pose }); let s = ''; for (let i = 0; i < n; i++) { const a = t * 4 + i * Math.PI * 2 / n; s += star(J.hc[0] + Math.cos(a) * 70, J.hc[1] - 64 + Math.sin(a) * 18, 15, { rot: a }); } return s; };
const rot = (s, a, x, y) => `<g transform="rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${s}</g>`;
const TX = 80, TY = 60, TW = 900, TH = 760;   // text area (left), characters live on the right
const idleHead = (t) => Math.sin(t * 1.3) * 5;
const crackle = (from, to, step = 1) => { const a = []; for (let t = from; t < to; t += step) a.push([t, 'crackle', .5]); return a; };
const steps = (from, to, dt, gain = .4) => { const a = []; for (let t = from; t < to; t += dt) a.push([+t.toFixed(2), 'step', gain]); return a; };

/* savanna world */
function savanna(t, o = {}) {
  const off = o.off ?? 0;
  let s = skyF(o.sky1 ?? '#FFB86B', o.sky2 ?? '#FFE9B8', 'sk' + (o.id ?? 1));
  s += sunF(o.sunX ?? 1500, (o.sunY ?? 300) - (o.rise ? seg(t, 0, 8, 'o') * 60 : 0), 70, '#FFF3C4');
  s += cloud(380 + (t * 6) % 300, 170, 1.3) + cloud(1180 - (t * 4) % 200, 120, 1);
  s += ridge(off * .2, o.far ?? '#C99A7B', 640, 120, 230, { w: 4 });
  s += ridge(off * .5 + 300, o.mid ?? '#B58B4F', 730, 70, 160, { w: 5 });
  s += acacia(o.treeX ?? 1720, 770, 1.15) + acacia(260 + off * .5, 760, .8);
  s += groundF(o.ground ?? '#D9B36C');
  s += tufts(GY + 10, 0, 22, '#8C9A3A', 5);
  for (let i = 0; i < 3; i++) s += bird(((t * 60 + i * 260) % 2400) - 200, 210 + i * 40 + Math.sin(t + i) * 10, .9, t + i);
  return s;
}

/* ───────── 1. ТИТУЛ ───────── */
CINE[1] = {
  D: 9.5, T: 24, poster: 7.6, music: 'bed',
  notes: 'Бүгін біз уақыт машинасымен 2,6 миллион жыл артқа саяхат жасап, ежелгі адамдардың өмірімен танысамыз.',
  sfx: [[1.0, 'whoosh', .9], [2.7, 'thud', 1], [3.0, 'pop', .6], [3.3, 'twinkle', .5], [4.4, 'whoosh', .5], [4.8, 'ding', .6], [5.5, 'pop', .6], [7.7, 'pop', .6]],
  draw(t) {
    const z = 1 + seg(t, 0, 24, 'l') * .05;
    let w = savanna(t, { rise: true, id: 1 });
    const pu = t < 2.9 ? seg(t, 1.0, 1.8, 'back') : 1 - seg(t, 2.9, 3.4, 'i');
    w += portal(1300, 360, t, pu);
    let hs = '';
    if (t >= 2.0) {
      if (t < 2.7) { const u = seg(t, 2.0, 2.7, 'l'); const x = lerp(1300, 1400, u), y = lerp(360, HY - 70, u) - Math.sin(u * Math.PI) * 120;
        hs = rot(hero(P({ x, y, lua: -150, lfa: -170, rua: 150, rfa: 170, lth: -40, rth: 40, expr: 'scream' })), u * 360, x, y - 60); }
      else if (t < 4.0) { const u = seg(t, 3.3, 4.0, 'back'); const ang = lerp(90, 0, u);
        hs = rot(hero(P({ x: 1400, y: HY + (1 - u) * 20, expr: 'dizzy', face: 1 })), ang, 1400, GY - 10);
        if (t > 2.7) w += dust(1400, GY, t, 2.72, { n: 7, sp: 120 }); }
      else { const look = t > 5.2; const ph = t > 7.4;
        let pose = P({ x: 1400, face: look ? -1 : 1, expr: t < 5.0 ? 'dizzy' : t < 7.4 ? 'shock' : 'worry', head: t < 5 ? Math.sin(t * 6) * 6 : idleHead(t),
          rua: ph ? 120 : 16, rfa: ph ? 200 : 8, lua: look && !ph ? -60 : -16, lfa: look && !ph ? -150 : -8 });
        if (t > 9.6) { const k = (t - 9.6) % 6; pose = k < 1.4 ? { ...pose, rua: 150, rfa: 200, expr: 'worry', head: -8 } : k < 3 ? { ...pose, face: 1, expr: 'normal' } : pose; }
        hs = hero(pose, { front: ph && !(t > 9.6 && (t - 9.6) % 6 < 1.4) ? (J) => phone(J.rh[0] - 6, J.rh[1] - 30, -10, { screen: '#FFE066' }) : null });
        if (t < 5.0) hs += starsAround(pose, t); }
    }
    w += hs;
    w += sfxWord(1410, 700, 'ГҮРС!', t, 2.75, 3.6, { fs: 90 });
    w += freeText(TX, 150, 1000, 700, { k: 'Тарих · уақыт саяхаты', title: 'Ежелгі<br>адамдар', big: '2 600 000', lab: 'жыл бұрын — адамзат тарихы<br>осыдан басталады' }, t, 4.4, 'halo', { css: '--h1:150px;--bigfs:170px' });
    w += bubble(1400, 230, 440, 120, 'Мен қайдамын?!', 1370, 380, t, 5.5, 7.3);
    w += bubble(1420, 220, 560, 150, 'Телефон: «2,6 млн жыл бұрын» 😳', 1400, 380, t, 7.7, 9.6, { fs: 36 });
    return camG(w, CW / 2, CH / 2, z) + vignette(.3);
  },
};

/* ───────── 2. ТАС ҚҰРАЛ ───────── */
CINE[2] = {
  D: 11, T: 26, poster: 9.4, music: 'bed',
  notes: 'Шамамен 2,6 миллион жыл бұрын «шебер адам» тастан алғашқы құралдарды жасады. Қазақстандағы ең көне құралдар Қаратау жотасынан табылған.',
  sfx: [[.3, 'whoosh', .4], ...steps(1.5, 3.0, .38), [3.3, 'pop', .6], [4.6, 'crack', 1], [4.75, 'boing', .7], [5.7, 'pop', .6], [7.8, 'chop', 1], [8.7, 'pop', .6]],
  draw(t) {
    const z = 1 + seg(t, 0, 26, 'l') * .04;
    let w = savanna(t, { id: 2, sky1: '#9AD7F5', sky2: '#E8F7FF', sunX: 1180, sunY: 170, far: '#9DB6C9', mid: '#A9B866', ground: '#D6B46E', treeX: 1830 });
    w += rock(1420, GY + 6, 220, 80);
    const split = seg(t, 7.8, 8.2, 'o') * 46; const taken = t > 9.0;
    if (t < 7.8) w += melon(1420, GY - 120, 1);
    else w += melonHalf(1420 - split, GY - 120, 1, -1) + (taken ? '' : melonHalf(1420 + split, GY - 120, 1, 1));
    const hx = lerp(1020, 1150, seg(t, 1.5, 3.0, 'l'));
    let hp;
    if (t < 3.0) { const wk = walk((hx - 1020) / 26, 1, 1); hp = P({ x: hx, ...wk, y: HY + (t > 1.5 ? wk.bob : 0), expr: 'smug' }); }
    else if (t < 4.6) { const u = seg(t, 3.6, 4.4); hp = P({ x: 1150, rua: lerp(16, 160, u), rfa: lerp(8, 200, u), expr: 'smug' }); }
    else if (t < 5.4) hp = P({ x: 1150, rua: 70, rfa: 120, expr: 'shock', lean: 8 });
    else if (t < 9.0) hp = P({ x: 1150, rua: 40, rfa: -40, lua: -40, lfa: 40, expr: 'sad', head: 8 });
    else { const chew = Math.sin(t * 10) > 0; hp = P({ x: 1150, rua: 60, rfa: 160, expr: chew ? 'happy' : 'normal' }); }
    const cracked = t > 4.6;
    w += hero(hp, { front: (J) => (t > 3.0 && t < 9.0 ? phone(t < 4.6 ? J.rh[0] : 1390, t < 4.6 ? J.rh[1] - 30 : GY - 170, t < 4.6 ? -20 : 30, { crack: cracked, screen: cracked ? '#4a5a6a' : '#7FD3FF' }) : '') + (taken ? melonHalf(J.rh[0] - 10, J.rh[1] - 16, .6, 1) : '') });
    const kx = lerp(1730, 1560, seg(t, 6.6, 7.4, 'io'));
    let kp;
    if (t < 6.6) kp = PK({ x: 1730, face: -1, expr: t > 4.6 ? 'smug' : 'normal', lua: -30, lfa: -60, rua: 30, rfa: 60, head: idleHead(t) });
    else if (t < 7.8) { const u = seg(t, 7.2, 7.75, 'i'); kp = PK({ x: kx, face: -1, rua: lerp(-150, -60, u), rfa: lerp(-190, -80, u), expr: 'angry' }); }
    else if (t < 9.0) { const u = seg(t, 8.4, 9.0); kp = PK({ x: kx, face: -1, rua: lerp(-60, -95, u), rfa: lerp(-80, -95, u), expr: 'smug' }); }
    else kp = PK({ x: kx, face: -1, expr: 'smug', lua: -20, rua: -30, rfa: -110 + Math.sin(t * 2) * 10 });
    w += caveman(kp, { beard: true, front: (J) => stoneTool(J.rh[0], J.rh[1], -30, .9) });
    w += sfxWord(1420, GY - 300, 'ШЫТЫР!', t, 4.6, 5.4, { fs: 84, f: '#7FD3FF' });
    w += sfxWord(1440, GY - 310, 'ТЫҚ!', t, 7.8, 8.6, { fs: 100 });
    w += bubble(1120, 230, 380, 110, 'Мен кесемін!', 1150, 380, t, 3.3, 4.5);
    w += bubble(1110, 230, 400, 110, 'Айфоным... 😭', 1140, 380, t, 5.7, 7.6);
    w += bubble(1640, 220, 440, 120, 'Тас — сынбайды!', 1600, 370, t, 8.7, 10.8);
    w += freeText(TX, TY, 860, TH, { k: '1 · Алғашқы құралдар', title: 'Тас құрал', big: '2,6 млн жыл', lab: 'бұрын — тұңғыш тас құралдар', lines: ['«Шебер адам» тастан кескіш пен қырғыш жасады', 'Қазақстандағы ең көне құралдар Қаратаудан табылған'] }, t, .3);
    return camG(w, CW / 2, CH / 2, z) + vignette(.28);
  },
};

/* ───────── 3. ОТ ───────── */
function night(t, id) {
  let s = skyF('#0B1433', '#2B2F5E', id);
  for (let i = 0; i < 46; i++) { const x = (i * 211) % CW, y = (i * 97) % 520; const tw = .5 + .5 * Math.sin(t * 3 + i); s += `<circle cx="${x}" cy="${y}" r="${(1.6 + (i % 3)).toFixed(1)}" fill="#fff" opacity="${tw.toFixed(2)}"/>`; }
  s += circ(1640, 150, 58, { f: '#F4F1DE', w: 0 }) + circ(1662, 136, 50, { f: '#0F1838', w: 0 });
  s += ridge(0, '#1B2244', 700, 110, 210, { w: 4, c: '#0a0d1c' }) + ridge(400, '#232A4A', 780, 60, 150, { w: 4, c: '#0a0d1c' });
  s += groundF('#3A3248') + tufts(GY + 10, 0, 18, '#22402a', 9);
  return s;
}
CINE[3] = {
  D: 11, T: 26, poster: 9.0, music: 'bed',
  notes: 'Шамамен 1 миллион жыл бұрын адамдар отты пайдалана бастады. От жылу берді, тамақты пісірді және жыртқыштардан қорғады.',
  sfx: [[.3, 'whoosh', .4], [1.5, 'pop', .6], [3.4, 'powerdown', .8], [3.9, 'pop', .6], [6.0, 'spark', .9], [6.3, 'spark', .9], [6.6, 'spark', .9], [6.8, 'ignite', 1], ...crackle(7.4, 26), [8.5, 'pop', .6]],
  draw(t) {
    const z = 1 + seg(t, 0, 26, 'l') * .04;
    let w = night(t, 'sk3');
    const fk = seg(t, 6.8, 7.6, 'back');
    w += fire(1420, GY - 6, t, fk);
    const dead = t > 3.4;
    // flashlight beam before the battery dies
    if (t > 1.2 && t < 3.4) { const bl = .5 + .5 * Math.sin(t * 20); w += `<path d="M1260 600 L1380 ${GY - 20} L1480 ${GY - 20}Z" fill="#FFF6B0" opacity="${(.35 * bl).toFixed(2)}"/>`; }
    let hp;
    if (t < 1.2) hp = P({ x: 1220, expr: 'smug', head: idleHead(t) });
    else if (t < 3.4) hp = P({ x: 1220, rua: 120, rfa: 110, expr: 'smug', lean: 6 });
    else if (t < 7.6) hp = P({ x: 1220, rua: 40, rfa: -20, expr: t < 5.6 ? 'sad' : 'worry', head: 6 });
    else { const rub = Math.sin(t * 8) * 8; hp = P({ x: 1220, rua: 100 + rub, rfa: 100 - rub, lua: 80 - rub, lfa: 100 + rub, expr: 'happy', lean: 6 }); }
    w += hero(hp, { front: (J) => (t > 1.2 && t < 7.6 ? phone(J.rh[0] + 10, J.rh[1] - 20, 70, { screen: dead ? '#111' : '#FFF6B0', bat: dead ? null : .05 }) : '') });
    // caveman: watches → kneels and strikes flints (5.6–6.8) → stands proud
    let kp;
    if (t < 5.4) kp = PK({ x: 1680, face: -1, expr: 'normal', head: idleHead(t), lua: -25, rua: 25 });
    else if (t < 7.0) { const hit = Math.abs(Math.sin((t - 5.6) * Math.PI / .3)); kp = PK({ x: 1580, face: -1, y: KY + 60, lean: -20, lth: -80, lsh: 10, rth: -10, rsh: 40, rua: -90 + hit * 30, rfa: -60 + hit * 40, lua: -60, lfa: -40, expr: 'strain' }); }
    else kp = PK({ x: 1620, face: -1, expr: 'smug', lua: -20, rua: -150, rfa: -170 });
    w += caveman(kp, { beard: true, furC: '#B8743A', front: (J) => (t > 5.4 && t < 7.0 ? stoneTool(J.rh[0], J.rh[1], 0, .7) + stoneTool(J.lh[0], J.lh[1], 40, .7) : '') });
    for (const ts of [6.0, 6.3, 6.6]) if (t > ts && t < ts + .25) { const u = (t - ts) / .25; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .35; w += line(1470 + Math.cos(a) * 30 * u, GY - 60 + Math.sin(a) * 30 * u, 1470 + Math.cos(a) * 90 * u, GY - 60 + Math.sin(a) * 90 * u, { w: 4, c: '#FFE07A' }); } }
    if (fk > 0) w += `<rect x="0" y="0" width="${CW}" height="${CH}" fill="#FF9A3C" opacity="${(.08 * fk * (1 + .2 * Math.sin(t * 11))).toFixed(3)}"/>`;
    w += sfxWord(1420, GY - 330, 'ЛАП!', t, 6.8, 7.6, { fs: 110, f: '#FFD23F' });
    w += bubble(1220, 230, 420, 110, 'Қазір жағамын!', 1220, 380, t, 1.5, 3.2);
    w += bubble(1200, 230, 440, 120, 'Батарея бітті... 🪫', 1210, 380, t, 3.9, 5.6);
    w += bubble(1640, 220, 500, 120, 'Зарядка керек емес!', 1620, 380, t, 8.5, 10.8);
    w += freeText(TX, TY, 860, TH, { k: '2 · Отты игеру', title: 'От', big: '1 млн жыл', lab: 'бұрын адамдар отты пайдалана бастады', lines: ['От жылытты, тамақ пісірді, аңнан қорғады', 'Ең көне іздердің бірі — Африкадағы Вондерверк үңгірінде'] }, t, .3, 'halo dark');
    return camG(w, CW / 2, CH / 2, z) + vignette(.4);
  },
};

/* ───────── 4. АҚЫЛДЫ АДАМ (эволюция шеруі) ───────── */
CINE[4] = {
  D: 11, T: 24, poster: 8.0, music: 'bed',
  notes: 'Ақылды адам — Homo sapiens — шамамен 300 мың жыл бұрын пайда болды. Ол — біздің тікелей ата-бабамыз, Африкадан бүкіл әлемге тараған.',
  sfx: [[.3, 'whoosh', .4], ...steps(.6, 6.2, .42, .35), [6.6, 'pop', .6], [7.4, 'boing', .8], [8.6, 'pop', .5]],
  draw(t) {
    let w = savanna(t, { id: 4, sky1: '#FFD59A', sky2: '#FFF4D6', sunX: 1700, sunY: 220, treeX: 2400 });
    const S = 1.12, Y = GY - 132 * S;
    const marchers = [
      { lean: 38, arm: 20, beard: true, hair: '#3a2414', tx: 930 },
      { lean: 26, arm: 12, beard: true, hair: '#4A2F1A', tx: 1110 },
      { lean: 14, arm: 6, beard: true, hair: '#5a3a20', tx: 1290, tool: true },
      { lean: 2, arm: 0, beard: false, hair: '#4A2F1A', tx: 1470, spear: true },
    ];
    const stopT = 6.0;
    marchers.forEach((m, i) => {
      const x = lerp(m.tx - 1150, m.tx, seg(t, 0, stopT, 'l')); const ph = t < stopT ? t * 6.5 + i : 0; const wk = t < stopT ? walk(ph, .9, 1) : {};
      const turn = i === 3 && t > 7.0;
      const pose = { sc: S, x, y: Y + (wk.bob || 0), ...wk, lean: m.lean, face: turn ? -1 : 1, lua: (wk.lua || -10) + m.arm, lfa: (wk.lfa || -8) + m.arm, rua: m.spear ? 150 : (wk.rua || 10) + m.arm, rfa: m.spear ? 170 : (wk.rfa || 8) + m.arm, expr: turn ? 'shock' : 'normal', head: m.lean > 20 ? -m.lean * .6 : 0 };
      w += caveman(pose, { beard: m.beard, hairC: m.hair, furC: ['#A86A2E', '#B8743A', '#C9853A', '#D69A4E'][i], front: (J) => (m.spear ? spear(J.rh[0], J.rh[1] + 40, 180, 230) : m.tool ? stoneTool(J.rh[0], J.rh[1], 0, .8) : '') });
    });
    // the hero closes the march, bent over his phone exactly like the first one
    const hx = lerp(1680 - 1150, 1680, seg(t, 0, stopT, 'l')); const wk = t < stopT ? walk(t * 6.5 + 5, .9, 1) : {};
    w += hero({ sc: S, x: hx, y: Y + (wk.bob || 0), ...wk, lean: 38, head: 30, rua: 120, rfa: 160, lua: 110, lfa: 150, expr: 'blank' }, { front: (J) => phone(J.rh[0] + 4, J.rh[1] - 10, 60, { screen: '#7FD3FF' }) });
    w += sfxWord(1470, 470, '?!', t, 7.4, 9.0, { fs: 110, f: '#fff' });
    w += bubble(1690, 330, 360, 110, '...және мен 📱', 1700, 500, t, 6.6, 9.4);
    w += freeText(TX, TY - 10, 1100, 520, { k: '3 · Ақылды адам', title: 'Homo sapiens', big: '300 000 жыл', lab: 'бұрын пайда болды — біздің тікелей ата-бабамыз', lines: ['Ең көне сүйектері Мароккодан (Жебел-Ирхуд) табылған', 'Африкадан бүкіл әлемге тарады'] }, t, .3, 'halo', { css: '--h1:96px;--bigfs:120px' });
    return w + vignette(.28);
  },
};

/* ───────── 5. МАМОНТ ───────── */
function tundra(t, id) {
  let s = skyF('#BFD9EE', '#F2F8FF', id);
  s += ridge(0, '#DCE7F2', 620, 160, 260, { w: 4 }) + ridge(300, '#C7D6E6', 720, 90, 170, { w: 4 });
  s += groundF('#F4F8FC') + tufts(GY + 10, 0, 14, '#9FB7C9', 4);
  for (let i = 0; i < 70; i++) { const x = ((i * 157 + t * (40 + i % 5 * 9)) % (CW + 100)) - 50, y = ((i * 89 + t * (70 + i % 4 * 15)) % (CH + 40)) - 20; s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${3 + i % 3}" fill="#fff" opacity=".85"/>`; }
  return s;
}
CINE[5] = {
  D: 11, T: 24, poster: 4.9, music: 'bed',
  notes: 'Мұз дәуірінде адамдар жүнді мамонтты аулады. Мамонттың биіктігі 3,4 метрге жетті, сондықтан оны тек бірлесіп, топпен аулаған. Еті тамақ, терісі киім, сүйегі баспана болды.',
  sfx: [[.3, 'whoosh', .4], [1.0, 'pop', .6], [3.0, 'bigthud', .8], [3.6, 'bigthud', .8], [4.2, 'bigthud', .9], [4.4, 'trumpet', 1], [5.4, 'run', .9], [7.6, 'pop', .6]],
  draw(t) {
    let w = tundra(t, 'sk5');
    const shake = t > 2.9 && t < 4.4 ? Math.sin(t * 60) * 5 : 0;
    // hunters (respectful: they prepare, nobody is hurt)
    const ready = t > 7.2;
    for (const [x, f] of [[960, '#A86A2E'], [1080, '#C9853A']]) w += caveman(PK({ x, face: 1, sc: 1.3, y: GY - 132 * 1.3, rua: ready ? 140 : 40, rfa: ready ? 160 : 20, expr: ready ? 'angry' : 'normal', head: idleHead(t + x) }), { beard: true, furC: f, front: (J) => spear(J.rh[0], J.rh[1] + 30, ready ? 120 : 175, 220) });
    // mammoth walks in from the right
    const mx = lerp(2300, 1660, seg(t, 2.9, 4.3, 'o')); const tr = t > 4.3 && t < 6 ? seg(t, 4.3, 4.6) : seg(t, 6, 6.6, 'l') > 0 ? 1 - seg(t, 6, 6.6) : 0;
    w += mammoth(mx, GY, .88, t, { trunk: tr, step: t < 4.3 ? t * 5 : 0, angry: t > 4.4 && t < 7 });
    // hero
    let hp, hx = 1310;
    if (t < 4.6) hp = P({ x: 1310, face: -1, rua: 150, rfa: 190, lua: -40, lfa: -100, expr: 'smug', head: idleHead(t) });
    else if (t < 5.4) hp = P({ x: 1310, face: 1, expr: 'scream', lua: -150, lfa: -170, rua: 150, rfa: 170 });
    else if (t < 6.0) { const r = run(t * 30, -1); hp = P({ x: 1310, ...r, y: HY + r.bob, face: -1, expr: 'scream' }); }
    else { hx = lerp(1310, -400, seg(t, 6.0, 7.2, 'i')); const r = run(t * 22, -1); hp = P({ x: hx, ...r, y: HY + r.bob, face: -1, expr: 'scream' }); }
    if (t < 7.3) w += hero(hp, { front: (J) => (t < 4.6 ? spear(J.rh[0], J.rh[1] + 30, 160, 200) : '') });
    if (t > 5.4 && t < 6.0) for (let i = 0; i < 3; i++) w += circ(1310 + (i - 1) * 40, GY - 4, 22, { f: '#E9EEF4', w: 3, op: .8 });
    if (t > 6.0) w += dust(1210, GY, t, 6.05, { n: 8, sp: 200 });
    w += sfxWord(1500, 300, 'ПРРРУУ!', t, 4.4, 5.8, { fs: 104, f: '#FFD23F' });
    w += bubble(1330, 230, 460, 110, 'Мен бір өзім-ақ!', 1310, 380, t, 1.0, 2.8);
    w += bubble(1030, 330, 500, 120, 'Мамонтты — топпен!', 1030, 470, t, 7.6, 10.4);
    w += freeText(TX, TY - 10, 880, 520, { k: '4 · Мұз дәуірі', title: 'Мамонт аулау', big: '3,4 м', lab: 'жүнді мамонттың биіктігі', lines: ['Адамдар оны топпен, найза мен тұзақ арқылы аулады', 'Еті — тамақ, терісі — киім, сүйегі — баспана болды'] }, t, .3);
    return g(w, `translate(${shake.toFixed(1)} 0)`) + vignette(.25);
  },
};

/* ───────── 6. ҮҢГІР ӨНЕРІ ───────── */
function cave(t) {
  let s = `<rect x="0" y="0" width="${CW}" height="${CH}" fill="#5A3E2B"/>`;
  s += blob([[-50, -50], [CW + 50, -50], [CW + 50, 120], [1500, 90], [1100, 140], [700, 80], [300, 130], [-50, 100]], { f: '#3E2A1C', w: 6 });
  s += blob([[-50, 160], [900, 120], [1700, 170], [CW + 50, 140], [CW + 50, 860], [-50, 880]], { f: '#B88A5E', w: 7, j: 3 });
  for (let i = 0; i < 14; i++) s += ell((i * 263) % CW, 220 + (i * 131) % 560, 60 + (i % 4) * 30, 24 + (i % 3) * 10, { f: '#A87B50', w: 0, j: 2, op: .6 });
  s += blob([[-50, 840], [CW + 50, 860], [CW + 50, CH + 50], [-50, CH + 50]], { f: '#4A3322', w: 7 });
  return s;
}
CINE[6] = {
  D: 11, T: 24, poster: 7.8, music: 'bed',
  notes: 'Ежелгі адамдар үңгір қабырғаларына аңдардың суретін салды. Ең көне аң суреттері 45 мың жылдан астам бұрын салынған, олар Индонезиядағы Сулавеси аралынан табылған. Қазақстанда Таңбалы шатқалында мыңдаған петроглиф бар.',
  sfx: [[.3, 'whoosh', .4], ...crackle(0, 24, 1.3), [4.0, 'pop', .6], [4.2, 'chalk', .7], [6.8, 'spray', 1], [7.4, 'pop', .6], [9.6, 'pop', .5]],
  draw(t) {
    let w = cave(t);
    w += torch(960, 250, t) + torch(1880, 430, t + 1);
    // ancient handprints already on the wall
    w += handprint(1820, 260, .9, '#C2441C', .8) + handprint(1180, 230, .7, '#8A3A1A', .7);
    w += bison(1520, 470, 1.05, seg(t, .8, 3.6, 'l'));
    // hero's phone doodle (4.2–5.2), then covered by a handprint (6.8)
    const pd = seg(t, 4.2, 5.2, 'l');
    if (pd > 0) w += g(rect(1180, 330, 70 * pd + 1, 120 * pd + 1, { w: 8, c: '#1b1b1b' }) + (pd > .9 ? rect(1192, 344, 46, 80, { w: 4, c: '#1b1b1b' }) : ''), '', 1);
    if (t > 6.8) w += handprint(1215, 390, 1.5, '#C2441C', clamp((t - 6.8) * 5, 0, 1));
    let hp;
    if (t < 4.0) hp = P({ x: 1060, face: 1, expr: 'normal', head: idleHead(t) });
    else if (t < 5.4) { const sc = Math.sin(t * 14) * 10; hp = P({ x: 1060, face: 1, rua: 130 + sc, rfa: 150 + sc, expr: 'smug' }); }
    else if (t < 6.8) hp = P({ x: 1060, face: 1, rua: 30, rfa: 10, expr: 'smug', head: idleHead(t) });
    else hp = P({ x: 1040, face: 1, expr: t < 9 ? 'shock' : 'sad', lua: -150, lfa: -180, rua: 40, rfa: -10 });
    w += hero(hp, { front: (J) => (t > 4 && t < 5.4 ? line(J.rh[0], J.rh[1], J.rh[0] + 14, J.rh[1] - 30, { w: 9, c: '#222' }) : '') });
    // the artist paints (0.8–3.6), turns (6.0), blows ochre (6.6–6.9)
    let kp;
    if (t < 3.6) { const p = Math.sin(t * 9) * 12; kp = PK({ x: 1730, face: -1, rua: -130 + p, rfa: -150 + p, expr: 'normal' }); }
    else if (t < 6.0) kp = PK({ x: 1730, face: -1, expr: 'smug', head: idleHead(t), rua: -30, rfa: -50 });
    else if (t < 7.0) kp = PK({ x: lerp(1730, 1420, seg(t, 6.0, 6.5)), face: -1, expr: 'angry', rua: -100, rfa: -100, lua: -90, lfa: -100 });
    else kp = PK({ x: 1420, face: -1, expr: 'smug', rua: -40, rfa: -60, head: idleHead(t) });
    w += caveman(kp, { beard: true, furC: '#B8743A', front: (J) => (t < 3.6 ? line(J.rh[0], J.rh[1], J.rh[0] - 26, J.rh[1] - 20, { w: 10, c: '#C2441C' }) : '') });
    if (t > 6.6 && t < 7.0) for (let i = 0; i < 14; i++) { const u = (t - 6.6) / .4; w += circ(1340 - u * 120 + Math.sin(i * 7) * 30 * u, 400 + Math.cos(i * 3) * 40 * u, 6, { f: '#C2441C', w: 0 }); }
    w += sfxWord(1240, 300, 'ПЫРС!', t, 6.8, 7.6, { fs: 100, f: '#FF8C1A' });
    w += bubble(1080, 200, 480, 110, 'Мен де суретшімін!', 1080, 360, t, 4.0, 5.6);
    w += bubble(1440, 190, 420, 110, 'Бұл — өнер!', 1440, 350, t, 7.4, 9.6);
    w += freeText(TX, TY + 80, 820, TH - 80, { k: '5 · Үңгір өнері', title: 'Алғашқы суреттер', big: '45 000+ жыл', lab: 'бұрынғы аң суреттері (Сулавеси, Индонезия)', lines: ['Бояуды охрадан және көмірден жасады', 'Қазақстанда — Таңбалы петроглифтері (ЮНЕСКО)'] }, t, .3, 'paint');
    return w + vignette(.55);
  },
};

/* ───────── 7. ЕГІН ЖӘНЕ ЖЫЛҚЫ (Ботай) ───────── */
function steppe(t, id) {
  let s = skyF('#7EC8F2', '#E9F7FF', id) + sunF(1540, 170, 60, '#FFF0B3') + cloud(500 + (t * 8) % 400, 160, 1.4) + cloud(1300 - (t * 5) % 300, 110, 1);
  s += ridge(0, '#A9C98B', 700, 70, 260, { w: 4 }) + groundF('#C9B06A');
  for (let r = 0; r < 4; r++) for (let i = 0; i < 26; i++) { const x = 40 + i * 74 + (r % 2) * 36, y = GY + 18 + r * 40; const sw = Math.sin(t * 2 + i * .7 + r) * 5;
    s += line(x, y, x + sw, y - 46, { w: 4, c: '#B08A2E' }) + ell(x + sw, y - 52, 7, 14, { f: '#E2B33C', w: 3, j: .4 }); }
  return s;
}
CINE[7] = {
  D: 12, T: 25, poster: 7.0, music: 'bed',
  notes: 'Шамамен 12 мың жыл бұрын адамдар егін егіп, мал бағуды үйренді. Солтүстік Қазақстандағы Ботай қонысы — жылқыны қолға үйретудің ең ерте іздерінің бірі, шамамен 5500 жыл бұрын.',
  sfx: [[.3, 'whoosh', .4], [1.0, 'pop', .5], [2.4, 'thud', .6], [2.6, 'neigh', .8], [3.0, 'whoosh', .8], [4.0, 'hay', 1], ...steps(4.8, 5.9, .2, .35), [6.0, 'boing', .5], [6.6, 'pop', .6], [9.0, 'pop', .5]],
  draw(t) {
    let w = steppe(t, 'sk7');
    // haystack on the right
    w += blob([[1700, GY + 4], [1730, GY - 120], [1810, GY - 170], [1890, GY - 120], [1920, GY + 4]], { f: '#E8C25A', w: 6 });
    // horse: stands → rears (2.5–3.1) → calm; Botai kid rides it away (6.4→)
    const rideX = lerp(1380, 1580, seg(t, 6.4, 12, 'l'));
    const rear = t > 2.5 && t < 3.3 ? Math.sin((t - 2.5) / .8 * Math.PI) : 0;
    const hxs = t > 6.4 ? rideX : 1380;
    w += horse(hxs, GY, 1.15, t, { rear, step: t > 6.4 ? t * 6 : 0 });
    // hero: jumps on (1.6–2.4) → thrown (2.9–4.0) into the hay → legs sticking out → crawls out (8.6)
    if (t < 2.4) { const u = seg(t, 1.6, 2.4, 'o'); const x = lerp(1120, 1360, u), y = HY - Math.sin(u * Math.PI) * 160 - u * 90;
      w += hero(P({ x, y, expr: 'smug', lth: u > 0 ? -60 : -9, rth: u > 0 ? 60 : 9, rua: u > 0 ? 130 : 16, rfa: u > 0 ? 150 : 8 })); }
    else if (t < 2.9) w += rot(hero(P({ x: 1360, y: HY - 90 - rear * 40, expr: 'shock', lth: -70, lsh: 0, rth: 70, rsh: 0, lua: -150, lfa: -170, rua: 150, rfa: 170 })), -rear * 30, 1300, GY);
    else if (t < 4.0) { const u = seg(t, 2.9, 4.0, 'l'); const x = lerp(1360, 1810, u), y = lerp(HY - 90, GY - 150, u) - Math.sin(u * Math.PI) * 330;
      w += rot(hero(P({ x, y, expr: 'scream', lua: -150, lfa: -170, rua: 150, rfa: 170, lth: -40, rth: 40 })), u * 540, x, y - 60); }
    else if (t < 8.6) { const k = Math.sin(t * 6) * 15; w += line(1790, GY - 140, 1760 + k, GY - 230, { w: 13.5 }) + line(1830, GY - 140, 1860 - k, GY - 225, { w: 13.5 }); }
    else { const u = seg(t, 8.6, 9.2, 'back'); w += hero(P({ x: 1730, y: HY + (1 - u) * 120, expr: 'worry', face: -1, head: idleHead(t) }), { front: (J) => line(J.hc[0] - 30, J.hc[1] - 50, J.hc[0] + 20, J.hc[1] - 70, { w: 5, c: '#C79A2E' }) + line(J.hc[0] - 10, J.hc[1] - 56, J.hc[0] + 36, J.hc[1] - 40, { w: 5, c: '#C79A2E' }) }); }
    // Botai kid
    const KS2 = 1.05, KY2 = GY - 132 * KS2;
    if (t > 4.8 && t < 6.0) { const x = lerp(900, 1300, seg(t, 4.8, 6.0, 'l')); const r = run(t * 18, 1); w += caveman({ sc: KS2, x, y: KY2 + r.bob, ...r, expr: 'happy' }, { furC: '#D69A4E' }); }
    else if (t >= 6.0) { const u = seg(t, 6.0, 6.4, 'o'); w += caveman({ sc: KS2, x: hxs - 10, y: lerp(KY2, GY - 330, u), face: 1, lth: 60, lsh: 10, rth: -60, rsh: -10, rua: 150 + Math.sin(t * 5) * 20, rfa: 190, expr: 'happy' }, { furC: '#D69A4E' }); }
    w += sfxWord(1600, 330, 'УУУ!', t, 3.0, 4.0, { fs: 96 });
    w += sfxWord(1810, GY - 230, 'ТАРС!', t, 4.0, 4.8, { fs: 96 });
    w += bubble(1140, 260, 420, 110, 'Мен шабандозбын!', 1140, 400, t, .9, 2.3);
    w += bubble(1420, 300, 420, 110, 'Жылқы — досым!', 1430, 470, t, 6.6, 8.8);
    w += bubble(1640, 300, 480, 120, 'Мен де үйренемін...', 1700, 440, t, 9.4, 11.8);
    w += freeText(TX, TY - 10, 880, 600, { k: '6 · Неолит', title: 'Егін мен мал', big: '12 000 жыл', lab: 'бұрын адамдар егін егіп, мал бағуды үйренді', lines: ['Тамақты іздемей, өздері өсіре бастады', 'Ботай (Қазақстан) — жылқыны қолға үйретудің ең ерте іздерінің бірі, 5 500 жыл'] }, t, .3, 'halo', { css: '--h1:96px;--bigfs:130px' });
    return w + vignette(.25);
  },
};

/* ───────── 8. ҚОРЫТЫНДЫ (сыныпқа оралу) ───────── */
CINE[8] = {
  D: 11, T: 24, poster: 8.0, music: 'bed',
  notes: 'Тас құралдан бастап отқа, өнерге және егіншілікке дейін — әр жаңалық адамзаттың алға басқан қадамы болды. Біз — солардың ұрпағымыз. Назарларыңызға рахмет!',
  sfx: [[.5, 'whoosh', .9], [1.3, 'thud', .8], [2.6, 'pop', .6], [3.0, 'chalk', .6], [3.6, 'chalk', .6], [4.2, 'chalk', .6], [5.2, 'applause', 1], [7.6, 'pop', .6], [8.0, 'ding', .5]],
  draw(t) {
    let w = `<rect x="0" y="0" width="${CW}" height="${CH}" fill="#F3E6C8"/>` + `<rect x="0" y="${GY - 10}" width="${CW}" height="${CH}" fill="#C08A54"/>` + line(0, GY - 10, CW, GY - 10, { w: 7 });
    // chalkboard (the text is written on it)
    w += rect(60, 70, 1060, 700, { f: '#2F5D46', w: 10 }) + rect(40, 760, 1100, 26, { f: '#8B5A2B', w: 6 });
    w += rect(1300, 120, 260, 200, { f: '#BFE3F2', w: 8 }) + line(1430, 120, 1430, 320, { w: 6 }) + line(1300, 220, 1560, 220, { w: 6 });
    const pu = t < 1.6 ? seg(t, .5, 1.0, 'back') : 1 - seg(t, 1.6, 2.0, 'i');
    w += portal(1500, 500, t, pu);
    // hero lands (1.0–1.3), shows the stone tool (2.4→), bows (6.2–7.0), waves
    let hp;
    if (t < 1.0) hp = null;
    else if (t < 1.3) { const u = seg(t, 1.0, 1.3, 'i'); hp = P({ x: 1500, y: lerp(400, HY, u), expr: 'shock', lua: -150, lfa: -170, rua: 150, rfa: 170 }); }
    else if (t < 2.4) hp = P({ x: 1500, expr: 'dizzy', head: Math.sin(t * 6) * 6 });
    else if (t < 6.2) hp = P({ x: 1500, face: -1, expr: 'happy', lua: -150, lfa: -170 });
    else if (t < 7.0) hp = P({ x: 1500, face: 0, lean: 30 * Math.sin(seg(t, 6.2, 7.0) * Math.PI), expr: 'happy' });
    else hp = P({ x: 1500, face: 0, expr: 'happy', rua: 150 + Math.sin(t * 6) * 15, rfa: 200, head: idleHead(t) });
    if (hp) w += hero(hp, { front: (J) => (t > 2.4 && t < 6.2 ? stoneTool(J.lh[0], J.lh[1] - 10, 20, 1.2) : '') });
    if (t > 1.3 && t < 2.4) w += starsAround(hp, t);
    // classmates (back view, foreground): clap after 5.2
    for (let i = 0; i < 6; i++) { const x = 140 + i * 300, up = t > 5.2 && t < 9 ? Math.abs(Math.sin(t * 9 + i)) * 20 : 0;
      w += circ(x, 1010 - up * .3, 62, { f: '#fff', w: 7 }) + ell(x, 990 - up * .3, 66, 40, { f: ['#3a2414', '#1d1d1f', '#6b4226', '#2b2b2b', '#4a2f1a', '#7a4b2a'][i], w: 5 });
      if (up) w += line(x - 60, 1080, x - 20, 960 - up, { w: 9 }) + line(x + 60, 1080, x + 20, 960 - up, { w: 9 }); }
    w += sfxWord(1720, 560, 'ТАРС!', t, 1.3, 2.0, { fs: 80 });
    w += bubble(1480, 230, 600, 120, 'Мен ежелгі адамдармен болдым!', 1470, 380, t, 2.6, 5.0, { fs: 36 });
    w += bubble(1480, 230, 560, 120, 'Назарларыңызға рахмет!', 1480, 380, t, 7.6, 11, { fs: 40 });
    w += freeText(120, 110, 960, 640, { k: 'Қорытынды', title: 'Біз — солардың ұрпағымыз', lines: ['Тас құрал → от → өнер → егін', 'Әр жаңалық — алға басқан қадам', '2,6 млн жыл бұрын → бүгін'] }, t, 2.8, 'chalk', { step: .6 });
    return w + vignette(.2);
  },
};
