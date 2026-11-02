"""Contact sheets for snap.js: full slides (sheet_full.png) and panel close-ups (sheet_panel.png)."""
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
cols = 2
def sheet(name, crop, size):
    w, h = size
    rows = (len(files) + cols - 1) // cols
    S = Image.new('RGB', (cols * w, rows * h), 'white')
    for i, f in enumerate(files):
        im = Image.open(f)
        if crop: im = im.crop(crop)
        S.paste(im.resize((w, h)), ((i % cols) * w, (i // cols) * h))
    S.save(f'{out}/{name}')
    print('sheet →', f'{out}/{name}')
sheet('sheet_full.png', None, (960, 540))
sheet('sheet_panel.png', (990, 110, 1850, 970), (520, 520))
