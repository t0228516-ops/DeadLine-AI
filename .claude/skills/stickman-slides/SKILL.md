---
name: stickman-slides
description: Make a funny, meme-style animated presentation (stickman doodle comic panel that acts out each slide's fact without words) as looping MP4 slides + an auto-playing PPTX + Canva-ready videos. Use when the owner asks for an "ерекше / күлкілі / мем / анимациялық презентация", a stickman/doodle/comic deck, a "wow" first-impression portfolio deck, or to restyle/animate an existing topic in this style. Kazakh-first (fonts cover ә ғ қ ң ө ұ ү һ і), works for ru/en too.
---

# Stickman slides — meme-comic animated presentations

A deck is **N slides × (text column on the left + a comic panel on the right)**. In the panel a stickman acts out the
slide's key fact as a silent 4–7 s gag that loops; a meme caption sits on top, and a punchline caption pops at the bottom.
The text column carries the real content (title, one big number, 3 bullets) so a teacher sees substance, not a circus.

Reference result: `examples/rome/deck.js` («Рим империясы», 6 slides). The owner saw it and approved the style
(«Өте жақсы, қызық — даже 1-нұсқа болса да»). Start every new deck by copying it.

## Output (what the owner gets)
| File | What it is |
|---|---|
| `preview.mp4` | All slides once, back to back. Send this first: it is the quickest way to judge. |
| `<Title>.pptx` | Each slide is a full-bleed muted MP4 that **starts automatically and loops**. Speaker notes come from `NOTES`. |
| `slideN.mp4` (zipped) | For Canva: the user uploads them by hand (see Limits). |

## Workflow
1. **Brief.** Get the topic, language, slide count and audience (school/college/university). For a client order, also ask who the teacher is and how strict they are.
2. **Facts first.** Research and verify the dates and numbers before writing jokes. Each slide gets **one big fact**: a number or year for the sticky note, plus 3 bullets of 1–2 sentences each (≤ ~110 characters).
3. **Comedy plan.** Make a table per slide: fact → gag (setup → punch) → top caption → bottom caption → the second the punch lands. Show the table to the owner before coding (CLAUDE.md: plan first, then code). Keep captions to ≤ 20 characters, uppercase.
4. **Write the deck.** Copy `examples/rome/deck.js` and fill in `DECK_TITLE`, `THEME`, `LEFT[n]`, `NOTES[n]` and `SCENES[n]`. Reuse the scene functions from Rome wherever possible.
5. **QA with your own eyes.** Run `snap.js` at the setup, punch and after-punch moments, then **look** at `sheet_panel.png` and `sheet_full.png`. Fix the problems and snap again. See the checklist below.
6. **Render.** Run `render.js` (≈2 min for 6 slides, all slides in parallel), then `build_pptx.py`, and zip the MP4s for Canva.
7. **Deliver** with SendUserFile: `preview.mp4` (render), then the pptx and the zip (attach). Explain the slides to the owner in Kazakh as a short table: slide → what happens.

```bash
E=.claude/skills/stickman-slides/engine            # from the repo root
OUT=<scratchpad>/<deck>                              # never inside the repo
node $E/snap.js   path/to/deck.js $OUT/snap '{"1":[1.3,4.8],"2":[2.5,5.2]}'   # omit JSON → 4 moments/slide
node $E/render.js path/to/deck.js $OUT/out           # --only 2,5 to re-render some slides, --fps 30
python3 $E/build_pptx.py $OUT/out                    # → $OUT/out/<DECK_TITLE>.pptx
(cd $OUT/out && zip -q canva.zip slide*.mp4)
```
Needs Node + playwright (pre-installed Chromium), ffmpeg, python-pptx and Pillow. The fonts are bundled in `engine/fonts` (OFL).

## Style bible (keep it; vary only THEME colours and backgrounds)
- **Page:** cream school-notebook paper (48 px grid) with a red margin line. Text column at x 120–920; comic panel 840×840 at (1000,120), rotated 1.2°, with two pieces of yellow tape.
- **Fonts:**
  - Titles: Caveat 700 with a yellow highlighter stroke.
  - Body: Nunito 400/700 at 28.5 px.
  - Kicker pill and meme captions: Montserrat 800/900.
  - The big number: Caveat 700 in the accent colour, on a tilted sticky note.
- **Meme captions:**
  - White Montserrat 900 with an 11 px black stroke, auto-fit to 780 px.
  - The top caption is always visible and sets the joke up.
  - The bottom caption pops in at `botAt`, the punchline.
- **Drawing:**
  - Everything is a "rough" hand-drawn line with an 8 fps line-boil (the jitter is reseeded every 1/8 s).
  - Stickman bones are 9 px black; the head is a white circle.
  - Flat fills only; no gradients except the sky.
- **Comic effects:** use `burst()` (BAM / ТЫҚ / ПЫРС / ГҮРС / Р-Р-Р), stars around the head, sweat drops, dust clouds, music notes and speed lines.

## Comedy rules (important)
- **The joke is always on the stickman himself:** pride → fail, physics, scale, time-lapse, cartoon physics (hanging in mid-air), reversal ("Plan A: sword → Plan B: slipper").
- **One idea per gag**, readable without sound in ≤ 2 s.
  - The punch lands at ~65–75 % of `D`; then hold it ≥ 1 s.
  - The engine cross-fades the last 0.6 s back to t=0, so design t=0 as a clean start pose.
- **Never make a joke of real victims or suffering:**
  - slavery and whipping, war crimes, genocide, Ашаршылық, deportations, epidemics' dead;
  - religion and ethnic groups;
  - mocking living real people.
  - On such slides the stickman is respectful (e.g. it bows or holds a candle) or is left out, and the facts are told seriously in the text column.
  - In Rome, for example, the slave-whipping idea was rejected; slavery appears only as a serious bullet.
- **Local, relatable humour works best:** апа's тапочка, a camel on the Silk Road, бешбармақ, a dombra, exam-night panic.
- **Teacher-safe:**
  - The panel never covers the text column.
  - No profanity, nothing romantic or sexual, no toilet humour.

## Engine API (`engine/engine.js`)
**Panel space:**
- 840×840. Ground is `G=700`; a standing pose has its hip at `HIPY=G-132`.
- **Safe zone for action: y 140–740.** The top caption covers y≈30–100 and the bottom caption y≈740–800.
- The panel clips at 8 px.

**Scene:** `SCENES[n]={D, poster, top, bot, botAt, draw(t)}`.
- `draw` returns an SVG string.
- `poster` is the time in seconds of the PPTX poster frame. Default 0.6; use a frame where the character is visible.

**Timing:**
- `seg(t,a,b,ease)` gives 0..1 eased; `EASE` = `l io o i back bounce`.
- `track([[t,{props},ease],…])` gives a keyframe interpolator. Numbers interpolate; strings switch at their keyframe.
- `lerp`, `clamp`, `lerpC(hex1,hex2,u)`.

**Stickman:** `stick(pose, opts)`.
- **Pose fields:**
  - `x`, `y` (hip), `lean` (torso, ° from vertical, + leans right), `head` (tilt), `face` (1 right, −1 left, 0 front), `sc` (scale).
  - Limb angles are **absolute** in degrees: 0 = straight down, 90 = right, −90 = left, ±180 = up.
  - The limb fields are `lua`/`lfa` (left upper arm/forearm), `rua`/`rfa`, `lth`/`lsh` (left thigh/shin) and `rth`/`rsh`.
  - Arms raised overhead are ±150 for the upper arm and ±(170…215) for the forearm.
- **`expr`:** `normal smug happy shock scream worry sad dizzy strain angry blank`.
- **`opts`:**
  - `helmet:{drop,crestH,crestW,hc,crestC}` (drop 0→1 slides the helmet over the eyes);
  - `toga:true`;
  - `beard(J,p)`, `behind(J,p)` (drawn first, e.g. a backpack) and `front(J,p)` (props in hands), each returning SVG;
  - `noFace`.
- **`joints(pose)`** gives `J` with `hip neck sh hc HR le lh re rh lk lf rk rf`, for attaching props to hands, head or feet.
- **Cycles:**
  - `walk(phase, amp, facing)` and `run(phase, facing)` return limb angles plus `bob` (add it to `y`).
  - Drive `phase` from distance travelled so the feet don't skate.

**Primitives** (all hand-drawn): `line(x1,y1,x2,y2,{w,c,op})`, `blob(points,{f,w,sharp})`, `ell`, `circ`, `rect`, `txt(x,y,s,{font,fw,fs,f,stroke})`, `g(svg,transform,opacity)`, `star`.

**Effects:**
- `burst(x,y,r,label,t,t0,t1,{fs,rot})`
- `dust(x,y,t,t0,{n,sp,r,d})`
- `sweat(x,y,s)`, `note(x,y,s)`, `zip(x,y,len,n)`

**Props:** `sword(x,y,angle,len)`, `scutum(x,y,{rot,sc})`, `rshield(x,y,r)`, `laurel(cx,cy,rx,ry,'back'|'front'|'all')`, `slipper(x,y,a)`, `sign(x,y,label,{w,h,bh,fs})`.
- For a ring around the body, draw `laurel` in two halves: `'back'` before `stick()` and `'front'` after it.

**Backgrounds:** `sky(c1,c2)`, `ground(color)`, `cloud(x,y,s)`, `hills(scrollOffset,color,y)` (parallax for walk-in-place), `column(x,yBase,h,w)`.

**Determinism:**
- **Never use `Math.random()` or `Date`.** Use `R()` (a seeded RNG), and keep the draw order the same from frame to frame.
- Renders are frame-exact, so the same deck always produces the same video.

**Left column:**
- Content slide: `LEFT[n]={kicker,num,title,big,label,bullets:[html]}`. `<b>` is allowed in bullets.
- Title slide: `{type:'title',kicker,title:'<span>Line1</span><br>Line2',sub,chips:[],who}`.

## QA checklist (look at the sheets, every time)
- Nothing important under the top/bottom caption bands. Raised arms, signs and heads must stay below y≈140.
- The character is never clipped by the panel edge, except on purpose for entering or leaving.
- Props sit in the hands and accessories on the head. Check helmets at `drop:0`: the eyes must be visible.
- Faces read at thumbnail size, and the expression matches the beat (shock at the reveal, dizzy after a hit).
- Large fills don't swallow the body. An early beard covered the torso and looked like a sack; keep such shapes to the face side.
- `snap.js` prints `WARN … overflows` when the text column is too long. Shorten the text; never shrink the font below 28 px.
- The punchline is visible in at least one snapped frame, and the loop restart (last 0.6 s) looks clean.
- After rendering, open `preview.mp4` frames, or ffmpeg-extract a few, before sending.

## Limits (tell the owner honestly)
- **Text is baked into the video,** so the student cannot edit it. This is fine for showcase and portfolio decks. For a real client order, offer the text corrected on request, or build an editable variant: render the panel only as video and put native PPTX text boxes on the left. That variant isn't built yet; it needs the owner's go-ahead.
- **Autoplay and loop in PowerPoint are unverified.** The PPTX uses the standard "Start: Automatically + Loop until stopped" timing XML, but it was not tested in real PowerPoint here. Ask the owner to check once. PowerPoint 2010 and older may not play MP4.
- **Canva:** the Canva connector's upload endpoint rejects PPTX and MP4 ("Unsupported file format"). The user uploads the MP4s in Canva themselves (Uploads → drag the files → one per page, full-page).
- **Rendering cost:** about 1 s of wall time per 3 frames per slide. Render slides in parallel, which `render.js` already does.
