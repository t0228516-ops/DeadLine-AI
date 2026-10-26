#!/usr/bin/env python3
"""
Canva шаблонын кітапханаға дайындау (бір рет, офлайн):

  1) Қаріп: Canva-ның қаріптерінде (Poppins, Garet, Canva Sans...) қазақ әріптері жоқ, ал ендірілгені тек
     ағылшын әріптерімен кесілген. Әр қаріп стилі ұқсас, қазақ әріптері толық Google қаріпіне ауыстырылады
     (FONT_MAP) және файлға ендіріледі (EOT, PowerPoint-тің өз форматы) — студенттің компьютерінде қаріп
     болмаса да мәтін дұрыс көрінеді.
  2) Сурет: 2–5 МБ PNG фотолар 1920 px-ке дейін кішірейтіліп, мөлдірі жоқтары JPEG болады (50 МБ → ~5 МБ).

  python3 scripts/canva-prepare.py IN.pptx OUT.pptx [--fonts-cache DIR]

Google Fonts — OFL, ендіруге рұқсат. Желі тек қаріп жүктеу үшін (кэш болса — керек емес).
"""
import io, os, re, sys, json, struct, zipfile, argparse, urllib.request, urllib.parse
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools import subset

# Canva отбасы → қазақ әріптері толық Google отбасы (стилі бойынша ең жақыны)
FONT_MAP = {
    # бейтарап/геометриялық sans
    'Poppins': 'Montserrat', 'Garet': 'Montserrat', 'Agrandir': 'Montserrat', 'Agrandir Narrow': 'Montserrat',
    'TT Firs Neue': 'Montserrat', 'Gotham': 'Montserrat', 'Proxima Nova': 'Montserrat', 'Glacial Indifference': 'Montserrat',
    'Questrial': 'Montserrat', 'DM Sans': 'Montserrat', 'League Spartan': 'Montserrat', 'Lovelo': 'Montserrat',
    'Anantason ExtraExpanded': 'Montserrat', 'Montserrat': 'Montserrat',
    'Open Sauce': 'Inter', 'Aileron': 'Inter', 'TT Fors': 'Inter', 'Canva Sans': 'Inter', 'Clear Sans': 'Inter',
    'Public Sans': 'Inter', 'Assistant': 'Inter', 'Lato': 'Inter', 'Merriweather Sans': 'Inter', 'Inter': 'Inter',
    'Tufuli Arabic': 'Inter', 'Libre Franklin': 'Libre Franklin',
    'TT Chocolates': 'Rubik', 'Cheddar': 'Rubik',
    'Roboto': 'Roboto', 'Open Sans': 'Open Sans', 'Open Sans 1': 'Open Sans', 'Noto Sans': 'Noto Sans', 'Raleway': 'Raleway',
    'Barlow': 'Fira Sans',
    # тар (condensed)
    'Barlow Condensed': 'Oswald', 'League Gothic': 'Oswald', 'Heading Now 71-78': 'Oswald', 'Pompiere': 'Oswald',
    'Roboto Condensed': 'Roboto Condensed', 'Prachamati SemiCondensed': 'Fira Sans Condensed',
    'Noto Serif Display ExtraCondensed': 'Noto Serif Display',
    # serif
    'Playfair Display': 'Playfair Display', 'Le Jour Serif': 'Playfair Display', 'Cormorant Garamond': 'Cormorant Garamond',
    'Perandory': 'Cormorant Garamond', 'Perandory SemiCondensed': 'Cormorant Garamond', 'Perandory Condensed': 'Cormorant Garamond',
    'Droid Serif': 'Noto Serif', 'Lustria': 'Lora', 'Source Serif Pro': 'Source Serif 4', 'Lancelot': 'Forum',
    'Cinzel Decorative': 'Forum', 'Rustic Printed': 'Old Standard TT', 'Times New Roman MT Condensed': 'PT Serif',
    'Cooper BT': 'Bitter', 'Zilla Slab': 'Roboto Slab', 'Alfa Slab One': 'Roboto Slab', 'Bevan': 'Roboto Slab',
    # жазба (script) — сәнді курсив серифке, қолжазба — Caveat
    'Pinyon Script': 'Cormorant Garamond:i', 'Moontime': 'Cormorant Garamond:i', 'Brittany': 'Cormorant Garamond:i',
    'Blosta Script': 'Cormorant Garamond:i', 'Sloop Script Pro': 'Cormorant Garamond:i', 'Amoresa': 'Cormorant Garamond:i',
    'TAN Mon Cheri': 'Playfair Display', 'Sergio Trendy': 'Caveat', 'Better Faster': 'Caveat', 'Slight': 'Caveat',
    # ойнақы/дисплей
    'Marhey': 'Comfortaa', 'Sensei': 'Balsamiq Sans', 'Guerrilla': 'Balsamiq Sans',
}
WEIGHTS = [('Extra-Light', 200), ('ExtraLight', 200), ('Ultra-Light', 200), ('Thin', 100), ('Light', 300), ('Medium', 500),
           ('Semi-Bold', 600), ('SemiBold', 600), ('Demi-Bold', 600), ('Extra-Bold', 800), ('ExtraBold', 800), ('Ultra-Bold', 800),
           ('Heavy', 900), ('Black', 900), ('Bold', 700), ('Regular', 400)]
WNAME = {100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: '', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black'}
# ендірілетін таңбалар: латын, кирилл (қазақ әріптерімен), тыныс белгілері, ₸ №
UNICODES = list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + list(range(0x400, 0x530)) + list(range(0x2000, 0x2070)) + [0x20B8, 0x2116, 0x2122, 0x2190, 0x2192, 0x2022, 0x25CF]


def parse_face(name):
    """«Poppins Semi-Bold Italics» → ('Poppins', 600, True)"""
    n = name.strip(); italic = False
    for suf in (' Italics', ' Italic'):
        if n.endswith(suf): n = n[: -len(suf)]; italic = True
    w = 400
    for word, val in WEIGHTS:
        if n.endswith(' ' + word): n = n[: -len(word) - 1]; w = val; break
    n = re.sub(r'\s+(BT|MT)$', lambda m: ' ' + m.group(1), n)
    return n.strip(), w, italic


def target_for(face):
    fam, w, it = parse_face(face)
    repl = FONT_MAP.get(fam)
    if repl is None:
        base = re.sub(r'\s+(Heavy|BT Heavy)$', '', fam)
        repl = FONT_MAP.get(base) or FONT_MAP.get(fam.split(' ')[0])
        if fam.startswith('Cooper'): repl = 'Bitter'; w = max(w, 800)
    if repl is None: return None
    if repl.endswith(':i'): repl = repl[:-2]; it = True
    return repl, w, it


def fetch_ttf(fam, w, it, cache):
    os.makedirs(cache, exist_ok=True)
    fn = os.path.join(cache, f"{fam.replace(' ', '')}-{w}{'i' if it else ''}.ttf")
    if os.path.exists(fn): return open(fn, 'rb').read()
    for ww in [w] + sorted({100, 200, 300, 400, 500, 600, 700, 800, 900} - {w}, key=lambda x: abs(x - w)):
        for ii in ([it, False] if it else [False]):
            q = f"{urllib.parse.quote(fam)}:ital,wght@{1 if ii else 0},{ww}"
            try:
                css = urllib.request.urlopen(urllib.request.Request(f'https://fonts.googleapis.com/css2?family={q}', headers={'User-Agent': 'Mozilla/4.0'}), timeout=30).read().decode()
            except Exception:
                continue
            m = re.search(r'url\((https:[^)]+\.ttf)\)', css)
            if not m: continue
            data = urllib.request.urlopen(m.group(1), timeout=60).read()
            open(fn, 'wb').write(data)
            return data
    raise RuntimeError(f'font not found: {fam} {w}')


def make_face(data, typeface, italic):
    """Кесу (тек керек таңбалар) + атауы typeface болатын жеке қаріп (PowerPoint атауы бойынша табады)"""
    f = TTFont(io.BytesIO(data))
    opt = subset.Options(); opt.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']; opt.name_IDs = ['*']
    opt.notdef_outline = True; opt.glyph_names = False; opt.hinting = False
    s = subset.Subsetter(opt); s.populate(unicodes=UNICODES); s.subset(f)
    style = 'Italic' if italic else 'Regular'
    name = f['name']
    for rec in list(name.names):
        if rec.nameID in (16, 17, 21, 22, 25): name.removeNames(nameID=rec.nameID)
    for nid, val in ((1, typeface), (2, style), (4, f'{typeface} {style}' if italic else typeface), (6, re.sub(r'[^A-Za-z0-9-]', '', typeface) + ('-Italic' if italic else ''))):
        name.setName(val, nid, 3, 1, 0x409); name.setName(val, nid, 1, 0, 0)
    f['OS/2'].fsType = 0
    f['OS/2'].fsSelection = (f['OS/2'].fsSelection & ~0b1100001) | (0b1 if italic else 0b1000000)
    if 'fvar' in f: del f['fvar']
    out = io.BytesIO(); f.save(out); return out.getvalue(), f


def eot(ttf_bytes, f, typeface, italic):
    """Сығылмаған EOT (version 0x00020001) — PowerPoint ppt/fonts/*.fntdata форматы"""
    os2 = f['OS/2']; head = f['head']
    def s16(t): b = t.encode('utf-16-le'); return struct.pack('<H', len(b)) + b
    panose = os2.panose
    pan = bytes([panose.bFamilyType, panose.bSerifStyle, panose.bWeight, panose.bProportion, panose.bContrast,
                 panose.bStrokeVariation, panose.bArmStyle, panose.bLetterForm, panose.bMidline, panose.bXHeight])
    body = (pan + struct.pack('<BB', 1, 1 if italic else 0) + struct.pack('<I', os2.usWeightClass) + struct.pack('<H', 0) + struct.pack('<H', 0x504C)
            + struct.pack('<IIII', os2.ulUnicodeRange1, os2.ulUnicodeRange2, os2.ulUnicodeRange3, os2.ulUnicodeRange4)
            + struct.pack('<II', getattr(os2, 'ulCodePageRange1', 1), getattr(os2, 'ulCodePageRange2', 0))
            + struct.pack('<I', head.checkSumAdjustment) + b'\0' * 16
            + struct.pack('<H', 0) + s16(typeface) + struct.pack('<H', 0) + s16('Italic' if italic else 'Regular')
            + struct.pack('<H', 0) + s16('Version 1.0') + struct.pack('<H', 0) + s16(typeface)
            + struct.pack('<H', 0) + struct.pack('<H', 0))
    hdr_len = 16 + len(body)
    return struct.pack('<IIII', hdr_len + len(ttf_bytes), len(ttf_bytes), 0x00020001, 0) + body + ttf_bytes


def shrink_images(files, rels_targets):
    """Үлкен фото → ≤1920 px; мөлдірі жоқ PNG → JPEG. Қайта аталған файлдар үшін rels сілтемелері жаңарады."""
    renames = {}
    for name in [n for n in files if n.startswith('ppt/media/')]:
        data = files[name]
        if len(data) < 250_000 or not re.search(r'\.(png|jpe?g)$', name, re.I): continue
        try: im = Image.open(io.BytesIO(data)); im.load()
        except Exception: continue
        w, h = im.size; k = min(1.0, 1920 / max(w, h))
        if k < 1: im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
        has_alpha = im.mode in ('RGBA', 'LA', 'P') and (im.convert('RGBA').getchannel('A').getextrema()[0] < 250)
        out = io.BytesIO()
        if has_alpha:
            im.convert('RGBA').save(out, 'PNG', optimize=True); new = name
        else:
            im.convert('RGB').save(out, 'JPEG', quality=84, optimize=True, progressive=True)
            new = re.sub(r'\.(png|jpe?g)$', '.jpeg', name, flags=re.I)
        if len(out.getvalue()) < len(data):
            del files[name]; files[new] = out.getvalue()
            if new != name: renames[name.split('/')[-1]] = new.split('/')[-1]
    if renames:
        for n in list(files):
            if n.endswith('.rels'):
                x = files[n].decode('utf8')
                for a, b in renames.items(): x = x.replace(f'media/{a}"', f'media/{b}"')
                files[n] = x.encode('utf8')
        ct = files['[Content_Types].xml'].decode('utf8')
        if 'Extension="jpeg"' not in ct: ct = ct.replace('<Default ', '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ', 1)
        files['[Content_Types].xml'] = ct.encode('utf8')
    return len(renames)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--fonts-cache', default=os.path.expanduser('~/.cache/deadline-fonts'))
    a = ap.parse_args()
    z = zipfile.ZipFile(a.src); files = {n: z.read(n) for n in z.namelist()}
    xml_parts = [n for n in files if re.match(r'ppt/(slides|slideLayouts|slideMasters|theme|notesMasters|notesSlides)/[^/]+\.xml$', n)]
    faces = set()
    for n in xml_parts: faces.update(re.findall(r'typeface="([^"+@][^"]*)"', files[n].decode('utf8')))
    mapping, unknown = {}, []
    for face in sorted(faces):
        t = target_for(face)
        if not t:
            if face not in ('Times New Roman', 'Arial', 'Calibri'): unknown.append(face)
            continue
        fam, w, it = t
        mapping[face] = (f"{fam} {WNAME[w]}".strip() + (' Italic' if it else ''), fam, w, it)
    # 1) атауларды ауыстыру
    for n in xml_parts:
        x = files[n].decode('utf8')
        x = re.sub(r'typeface="([^"]+)"', lambda m: f'typeface="{mapping[m.group(1)][0]}"' if m.group(1) in mapping else m.group(0), x)
        # Canva бір жолға қаріп атауымен бірге panose/charset жазады — ескі қаріптікі, алынады
        x = re.sub(r'(<a:(?:latin|ea|cs|sym) typeface="[^"]+")(?: panose="[0-9A-Fa-f]+")?(?: pitchFamily="-?\d+")?(?: charset="-?\d+")?', r'\1', x)
        files[n] = x.encode('utf8')
    # 2) ескі ендірілген қаріптер → жаңалары
    pres = files['ppt/presentation.xml'].decode('utf8'); prels = files['ppt/_rels/presentation.xml.rels'].decode('utf8')
    for rid in re.findall(r'<p:(?:regular|bold|italic|boldItalic) r:id="([^"]+)"', pres):
        m = re.search(rf'<Relationship [^>]*Id="{rid}"[^>]*Target="([^"]+)"[^>]*/>', prels)
        if m:
            files.pop('ppt/' + m.group(1).lstrip('/').replace('ppt/', ''), None); prels = prels.replace(m.group(0), '')
    pres = re.sub(r'<p:embeddedFontLst>[\s\S]*?</p:embeddedFontLst>', '', pres)
    emb, used = [], {}
    for face, (tf, fam, w, it) in sorted(mapping.items(), key=lambda kv: kv[1][0]):
        if tf in used: continue
        ttf, ft = make_face(fetch_ttf(fam, w, it, a.fonts_cache), tf, it)
        k = len(used) + 1; path = f'ppt/fonts/dlfont{k}.fntdata'; rid = f'rIdDlFont{k}'
        files[path] = eot(ttf, ft, tf, it); used[tf] = rid
        prels = prels.replace('</Relationships>', f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/dlfont{k}.fntdata"/></Relationships>')
        emb.append(f'<p:embeddedFont><p:font typeface="{tf}"/><p:regular r:id="{rid}"/></p:embeddedFont>')
    if emb:
        lst = '<p:embeddedFontLst>' + ''.join(emb) + '</p:embeddedFontLst>'
        pres = re.sub(r'(</p:notesSz>|<p:notesSz[^>]*/>)', lambda m: m.group(1) + lst, pres, count=1)
        if 'embedTrueTypeFonts' not in pres: pres = pres.replace('<p:presentation ', '<p:presentation embedTrueTypeFonts="1" ', 1)
    files['ppt/presentation.xml'] = pres.encode('utf8'); files['ppt/_rels/presentation.xml.rels'] = prels.encode('utf8')
    ct = files['[Content_Types].xml'].decode('utf8')
    if 'Extension="fntdata"' not in ct:
        ct = ct.replace('<Default ', '<Default Extension="fntdata" ContentType="application/x-fontdata"/><Default ', 1)
    files['[Content_Types].xml'] = ct.encode('utf8')
    # 3) суреттер
    renamed = shrink_images(files, None)
    with zipfile.ZipFile(a.dst, 'w', zipfile.ZIP_DEFLATED) as o:
        o.writestr('[Content_Types].xml', files.pop('[Content_Types].xml'))
        for n, d in files.items(): o.writestr(n, d, zipfile.ZIP_STORED if re.search(r'\.(jpe?g|png)$', n) else zipfile.ZIP_DEFLATED)
    print(json.dumps({'src': os.path.basename(a.src), 'mb_in': round(os.path.getsize(a.src) / 1e6, 1), 'mb_out': round(os.path.getsize(a.dst) / 1e6, 1),
                      'fonts': {k: v[0] for k, v in mapping.items()}, 'unknown': unknown, 'jpeg': renamed}, ensure_ascii=False))


if __name__ == '__main__':
    main()
