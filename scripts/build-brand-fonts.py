#!/usr/bin/env python3
"""
Дизайнер қаріптері (SIL OFL 1.1, Google Fonts) → презентацияға дайын статикалық TTF.

  python3 scripts/build-brand-fonts.py <variable-fonts-dir>

Әр қаріп: (1) айнымалы қаріптен керек салмақ кесіледі, (2) атауы PowerPoint-тегі атауға ауысады
(Canva да солай ендіреді: «Montserrat Bold» — жеке отбасы, Regular слоты), (3) тек латын + кирилл
(қазақ әріптерімен) + тыныс белгілері қалады — PPTX-ке ендірілетін көлем кішірейеді.
Нәтиже: products/presentation/assets/brand-fonts/*.ttf + OFL.txt
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(__file__), '..', 'products', 'presentation', 'assets', 'brand-fonts')
# (файл, айнымалы ось мәндері, PowerPoint-тегі отбасы, стиль, шығыс атауы)
FONTS = [
    # Playfair 2 (Reserved Font Name жоқ — өзгертілген нұсқаны таратуға болады; Playfair Display-де RFN бар)
    ('Playfair.ttf', {'wght': 700, 'opsz': 96, 'wdth': 100}, 'Playfair Bold', 'Regular', 'Playfair-Bold.ttf'),
    ('Inter.ttf', {'wght': 400, 'opsz': 14}, 'Inter', 'Regular', 'Inter-Regular.ttf'),
    ('Inter.ttf', {'wght': 700, 'opsz': 14}, 'Inter', 'Bold', 'Inter-Bold.ttf'),
    ('Montserrat.ttf', {'wght': 700}, 'Montserrat Bold', 'Regular', 'Montserrat-Bold.ttf'),
    ('OpenSans.ttf', {'wght': 400, 'wdth': 100}, 'Open Sans', 'Regular', 'OpenSans-Regular.ttf'),
    ('OpenSans.ttf', {'wght': 700, 'wdth': 100}, 'Open Sans', 'Bold', 'OpenSans-Bold.ttf'),
]
UNICODES = list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + list(range(0x400, 0x530)) + \
    list(range(0x2010, 0x2028)) + [0x2030, 0x2039, 0x203A, 0x20AC, 0x20B8, 0x2116, 0x2122, 0x2212, 0x2022, 0x2026, 0x00D7]

def rename(font, family, style):
    name = font['name']
    full = family if style == 'Regular' else family + ' ' + style
    ps = full.replace(' ', '')
    for rec in list(name.names):
        if rec.nameID in (16, 17, 21, 22, 25):
            name.removeNames(nameID=rec.nameID)
    for nid, val in ((1, family), (2, style), (3, ps + ';DeadLine'), (4, full), (6, ps)):
        name.setName(val, nid, 3, 1, 0x409)
        name.setName(val, nid, 1, 0, 0)
    os2 = font['OS/2']
    os2.fsType = 0  # OFL: ендіруге шектеу жоқ (installable)
    bold = style == 'Bold'
    os2.fsSelection = (os2.fsSelection & ~0b1100001) | (0b100000 if bold else 0b1000000)
    font['head'].macStyle = 1 if bold else 0

os.makedirs(OUT, exist_ok=True)
for src, axes, family, style, out in FONTS:
    f = TTFont(os.path.join(SRC, src))
    if 'fvar' in f:
        f = instantiateVariableFont(f, {k: v for k, v in axes.items() if k in [a.axisTag for a in f['fvar'].axes]})
    opts = subset.Options(); opts.layout_features = ['kern', 'liga', 'calt', 'locl', 'mark', 'mkmk', 'ccmp']; opts.name_IDs = ['*']; opts.notdef_outline = True
    s = subset.Subsetter(opts); s.populate(unicodes=UNICODES); s.subset(f)
    rename(f, family, style)
    f.save(os.path.join(OUT, out))
    print(out, os.path.getsize(os.path.join(OUT, out)))
