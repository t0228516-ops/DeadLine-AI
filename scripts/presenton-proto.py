#!/usr/bin/env python3
# Presenton template.json → HTML (prototype). usage: pren.py <template_dir> <out.html> [fill.json] [layout_idx,...]
import json, sys, os, html, base64, mimetypes, re

tdir, out = sys.argv[1], sys.argv[2]
fill = json.load(open(sys.argv[3])) if len(sys.argv) > 3 and sys.argv[3] != '-' else None
only = [int(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else None
T = json.load(open(os.path.join(tdir, 'template.json')))
PHOTO = os.environ.get('PHOTO_DIR', '')
photos = sorted(os.path.join(PHOTO, f) for f in os.listdir(PHOTO)) if PHOTO else []
pi = [0]

# қазақ әріптері жоқ қаріптер → бар қаріп (прототип)
SUB = {'Poppins': 'Inter', 'Poppins Medium': 'Inter', 'Poppins Light': 'Inter', 'Poppins Bold': 'Inter', 'Poppins Semi-Bold': 'Inter',
       'Poppins SemiBold': 'Inter', 'Archivo Black': 'Inter', 'DM Sans': 'Inter', 'DM Sans Bold': 'Inter'}
WEIGHT = {'Bold': 700, 'Semi-Bold': 600, 'SemiBold': 600, 'Medium': 500, 'Light': 300, 'Black': 900}

def uri(p):
    if p.startswith('/static/images/replaceable') or 'placeholder' in p:
        if photos:
            f = photos[pi[0] % len(photos)]; pi[0] += 1
            p = f
        else:
            return ''
    else:
        p = os.path.join(tdir, p.lstrip('/'))
    if not os.path.exists(p): return ''
    m = mimetypes.guess_type(p)[0] or 'image/png'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())

def fontcss(f):
    fam = f.get('family', 'Inter'); w = 400
    for k, v in WEIGHT.items():
        if k in fam: w = v
    if fam == 'Archivo Black': w = 900
    if f.get('bold'): w = max(w, 700)
    real = SUB.get(fam, fam)
    s = "font-family:'%s','Inter',sans-serif;font-weight:%d;font-size:%spx;color:%s;" % (real, w, f.get('size', 16), f.get('color', '#000'))
    if f.get('line_height'): s += 'line-height:%s;' % f['line_height']
    if f.get('letter_spacing'):
        ls = f['letter_spacing'] * (0.35 if real != fam and f['letter_spacing'] < 0 else 1)  # ауыстырылған қаріп енсіз — тығыздықты азайтамыз
        s += 'letter-spacing:%spx;' % ls
    if f.get('italic'): s += 'font-style:italic;'
    if f.get('underline'): s += 'text-decoration:underline;'
    return s

slot = {'i': 0}
def filltext(e, orig):
    if not fill or e.get('decorative'): return orig
    name = (e.get('name') or '').lower(); mx = e.get('max_length') or 200
    pool = fill['pool']
    key = 'title' if re.search(r'title|headline|heading', name) and 'sub' not in name else \
          'num' if re.search(r'value|metric|number|stat|figure|year|date', name) else \
          'label' if re.search(r'label|tag|kicker|eyebrow|caption|name|header', name) else 'text'
    arr = pool[key]; v = arr[fill['ix'].setdefault(key, 0) % len(arr)]; fill['ix'][key] += 1
    if len(v) > mx:  # сөз шекарасымен қысқарту
        cut = v[:mx].rsplit(' ', 1)[0]; v = cut if len(cut) > mx * 0.5 else v[:mx]
    return v

def pos(e, absolute=True):
    p = e.get('position') or {}; s = e.get('size') or {}
    css = ''
    if absolute: css += 'position:absolute;left:%spx;top:%spx;' % (p.get('x', 0), p.get('y', 0))
    else: css += 'position:relative;flex:none;'
    if s: css += 'width:%spx;height:%spx;' % (s.get('width', 0), s.get('height', 0))
    if e.get('rotation'): css += 'transform:rotate(%sdeg);' % e['rotation']
    if e.get('opacity') is not None: css += 'opacity:%s;' % e['opacity']
    return css

def el(e, absolute=True):
    t = e.get('type')
    if t == 'group':
        return '<div style="%s">%s</div>' % (pos(e, absolute), ''.join(el(c) for c in e.get('children', [])))
    if t in ('flex', 'grid'):
        css = pos(e, absolute)
        if t == 'flex':
            css += 'display:flex;flex-direction:%s;gap:%spx;align-items:%s;justify-content:%s;' % (
                e.get('direction', 'row'), e.get('gap', 0), e.get('align_items', 'flex-start'), e.get('justify_content', 'flex-start'))
        else:
            css += 'display:grid;grid-template-columns:repeat(%s,auto);column-gap:%spx;row-gap:%spx;' % (e.get('columns', 2), e.get('column_gap', e.get('gap', 0)), e.get('row_gap', e.get('gap', 0)))
        return '<div style="%s">%s</div>' % (css, ''.join(el(c, False) for c in e.get('children', [])))
    if t == 'container':
        return '<div style="%s">%s</div>' % (pos(e, absolute), el(e['child']) if e.get('child') else '')
    if t == 'vector':
        pts = e.get('points') or []
        if not pts: return ''
        fill_ = (e.get('fill') or {}).get('color', 'none'); st = e.get('stroke') or {}
        d = ' '.join('%s,%s' % (q['x'], q['y']) for q in pts)
        w = max(q['x'] for q in pts) + 2; h = max(q['y'] for q in pts) + 2
        fo = (e.get('fill') or {}).get('opacity', 1)
        return '<svg style="position:absolute;left:0;top:0;overflow:visible" width="%s" height="%s"><polygon points="%s" fill="%s" fill-opacity="%s" stroke="%s" stroke-width="%s"/></svg>' % (
            w, h, d, fill_, fo, st.get('color', 'none'), st.get('width', 0))
    if t == 'image':
        u = uri(e.get('data', ''))
        if not u: return '<div style="%sbackground:#d9dde3"></div>' % pos(e, absolute)
        css = pos(e, absolute) + 'object-fit:%s;object-position:%s%% %s%%;' % (e.get('fit', 'cover'), e.get('focus_x', 50), e.get('focus_y', 50))
        if e.get('clip_path'): css += 'clip-path:%s;' % e['clip_path']
        if e.get('flip_h'): css += 'transform:scaleX(-1);'
        return '<img src="%s" style="%s">' % (u, css)
    if t == 'text':
        al = e.get('alignment') or {}
        jv = {'top': 'flex-start', 'middle': 'center', 'center': 'center', 'bottom': 'flex-end'}.get(al.get('vertical', 'top'), 'flex-start')
        css = pos(e, absolute) + 'display:flex;flex-direction:column;justify-content:%s;text-align:%s;' % (jv, al.get('horizontal', 'left'))
        runs = e.get('runs') or []
        orig = ''.join(r.get('text', '') for r in runs)
        txt = filltext(e, orig)
        f = (runs[0].get('font') if runs else None) or e.get('font') or {}
        return '<div style="%s"><div style="%swhite-space:pre-wrap;overflow-wrap:break-word">%s</div></div>' % (css, fontcss(f), html.escape(txt))
    if t == 'text-list':
        f = e.get('font') or {}
        items = e.get('items') or []
        if fill: items = [filltext({'name': 'item', 'max_length': e.get('max_item_length') or 120}, '') for _ in items]
        else: items = [(''.join(r.get('text', '') for r in it.get('runs', [])) if isinstance(it, dict) else str(it)) for it in items]
        li = ''.join('<div style="display:flex;gap:%spx"><span>•</span><span>%s</span></div>' % (e.get('marker_gap', 8), html.escape(x)) for x in items)
        return '<div style="%s%sdisplay:flex;flex-direction:column;gap:%spx">%s</div>' % (pos(e, absolute), fontcss(f), e.get('gap', 8), li)
    if t in ('chart', 'infographic', 'table'):
        return '<div style="%sborder:2px dashed #bbb;display:flex;align-items:center;justify-content:center;font:14px Inter;color:#999">%s</div>' % (pos(e, absolute), t)
    return ''

slides = []
for i, L in enumerate(T['layouts']):
    if only and i not in only: continue
    body = ''
    for c in L['components']:
        p = c.get('position') or {}
        body += '<div style="position:absolute;left:%spx;top:%spx">%s</div>' % (p.get('x', 0), p.get('y', 0), ''.join(el(e) for e in c.get('elements', [])))
    slides.append('<section class="s">%s</section>' % body)

faces = ''
for fam, src in (T.get('fonts') or {}).items():
    if src.startswith('static/'):
        faces += "@font-face{font-family:'%s';src:url('%s')}" % (fam, uri(src))
open(out, 'w').write('<!doctype html><meta charset="utf-8"><style>%sbody{margin:0}.s{position:relative;width:1280px;height:720px;overflow:hidden;background:#fff}</style>%s' % (faces, ''.join(slides)))
print('slides', len(slides))
