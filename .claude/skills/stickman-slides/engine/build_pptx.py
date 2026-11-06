"""Assemble rendered slides into a PPTX: each slide = full-bleed MP4 that starts automatically;
classic decks loop muted, cinema decks (meta.cinema) play once with sound and hold the last frame; speaker notes from the deck.
Usage: python3 build_pptx.py <outDir> [file name.pptx]   (outDir = render.js output with meta.json)"""
import json, sys, os
from pptx import Presentation
from pptx.util import Emu
from lxml import etree
out = sys.argv[1]
meta = json.load(open(os.path.join(out, 'meta.json')))
name = sys.argv[2] if len(sys.argv) > 2 else meta['title'] + '.pptx'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
prs = Presentation(); prs.slide_width = Emu(12192000); prs.slide_height = Emu(6858000)
for s in meta['slides']:
    n = s['n']
    if not os.path.exists(os.path.join(out, f'slide{n}.mp4')):
        print(f'skip slide {n}: not rendered'); continue
    sl = prs.slides.add_slide(prs.slide_layouts[6])
    mv = sl.shapes.add_movie(os.path.join(out, f'slide{n}.mp4'), 0, 0, prs.slide_width, prs.slide_height,
                             poster_frame_image=os.path.join(out, f'poster{n}.png'), mime_type='video/mp4')
    spid, ms = mv.shape_id, int(s['D'] * 1000)
    # cinema decks: plays once with sound and holds the last frame; classic decks: muted loop
    cine = bool(meta.get('cinema'))
    mute, rep = ('0', '') if cine else ('1', ' repeatCount="indefinite"')
    for t in sl._element.findall(P + 'timing'): sl._element.remove(t)
    # PowerPoint "Start: Automatically" + "Loop until stopped" timing tree
    xml = f'''<p:timing xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>
<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>
<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>
<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>
<p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>
<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="{ms}" fill="hold"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:cmd>
</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>
</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>
<p:video><p:cMediaNode vol="80000" mute="{mute}"><p:cTn id="7"{rep} fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cMediaNode></p:video>
</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>'''
    el = etree.fromstring(xml)
    ext = sl._element.find(P + 'extLst')
    (ext.addprevious(el) if ext is not None else sl._element.append(el))
    if s.get('notes'): sl.notes_slide.notes_text_frame.text = s['notes']
path = os.path.join(out, name)
prs.save(path)
print('pptx →', path, len(prs.slides), 'slides')
