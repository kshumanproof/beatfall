"""Cut the Beatfall brand assets from the master artwork.

    cd brand-src ; python3 cut.py

Writes ../public/brand/lockup.png and lockup-dark.png, and the same two files
into ../mobile/assets/. Nothing here is drawn or traced. Every number is read
out of the master, and the point of this file existing is that nobody has to
eyeball the lockup ever again.

WHY THIS EXISTS. Until 15 September the shipped lockup.png had been redrawn with
the mark 19 per cent larger against the wordmark than the master sets it, with
the letterspacing opened up to match. The old note in CLAUDE.md admits it and
gives the reason: "his exact ratio turns the bars to mush at UI size." It was
the first thing Kris noticed when he looked at the product properly. If the bars
ever do look mushy at some size, fix it by drawing that size bigger, not by
redrawing his artwork.

WHAT THE MASTER ACTUALLY IS. "Where your story falls into place.svg" is a Canva
page export, and it is only half vector. The mark and the wordmark are each an
embedded PNG plus a separate white-on-black mask PNG, placed by an SVG
transform. Only the tagline is real outlines. So PNG is the honest output here;
there is no vector of the mark to be had, and webp would break the email, which
Outlook renders without it.

THE RESOLUTION CEILING is the wordmark: 669 pixels of ink across 421.47 page
units, or 1.59 pixels per unit. The mark is three times finer. Export sized
against the mark and you are inventing wordmark detail that was never there.
"""
import base64
import io
import re

import numpy as np
from PIL import Image

MASTER = 'Where your story falls into place.svg'

# Transforms, verbatim out of the master.
WM_SX, WM_SY, WM_TX, WM_TY = 0.63, 0.629032, 113.965228, 210.735245
MK_S, MK_TX, MK_TY = 0.1875, 9.398502, 183.800344

# The lockup's ink on the master's page: each mask's own ink box put through its
# own transform. Everything else is derived from these four numbers.
INK_X0, INK_Y0, INK_X1, INK_Y1 = 47.649, 205.925, 560.005, 317.042
INK_W, INK_H = INK_X1 - INK_X0, INK_Y1 - INK_Y0        # 512.356 x 111.117
RATIO = INK_W / INK_H                                  # 4.6110

# Light is the master's own four inks, untouched. Dark is the mapping the
# product already established, which is the theme's own dark tokens.
DARK = {
    (0x2B, 0x26, 0x20): (0xEF, 0xE9, 0xDE),   # ink       -> dark ink
    (0x2C, 0x5C, 0x8F): (0x8F, 0xB6, 0xDE),   # blue      -> dark blue
    (0x26, 0x4A, 0x7E): (0x8F, 0xB6, 0xDE),   # mark navy -> dark blue
    (0xBF, 0x95, 0x51): (0xD9, 0xBC, 0x77),   # mark gold -> dark gold
}

# 260px of lockup height is about 2.34 pixels per page unit: generous headroom
# over every size this is drawn at, and short of upscaling the wordmark past
# reason. It also makes the file's own dimensions carry the true ratio, so the
# CSS can just say `aspect-ratio: 1199 / 260` and be right.
TARGET_H = 260


def embedded():
    """The four bitmaps inside the master, in document order:
       wordmark mask, mark mask, wordmark colour, mark colour."""
    svg = open(MASTER, encoding='utf-8', errors='replace').read()
    svg = re.sub(r'<metadata>.*?</metadata>', '', svg, flags=re.S)
    blobs = re.findall(r'<image[^>]*?(?:xlink:)?href="data:image/png;base64,([^"]+)"', svg)
    if len(blobs) != 4:
        raise SystemExit('expected 4 embedded images in the master, found %d' % len(blobs))
    return [Image.open(io.BytesIO(base64.b64decode(b))) for b in blobs]


def masked(colour, mask):
    out = Image.new('RGBA', colour.size)
    out.paste(colour.convert('RGB'), (0, 0))
    out.putalpha(mask.convert('L'))
    return out


def recolour(im):
    """Swap each flat ink for its dark counterpart, carrying the swap through
    the antialiased pixels between them by nearest source ink."""
    a = np.array(im).astype(np.int16)
    rgb, alpha = a[..., :3], a[..., 3]
    src = np.array(list(DARK.keys()), dtype=np.int16)
    dst = np.array(list(DARK.values()), dtype=np.int16)
    flat = rgb.reshape(-1, 3)
    nearest = ((flat[:, None, :] - src[None, :, :]) ** 2).sum(axis=2).argmin(axis=1)
    out = dst[nearest].reshape(rgb.shape)
    return Image.fromarray(np.dstack([out, alpha]).astype(np.uint8), 'RGBA')


def build():
    wm_mask, mk_mask, wm_col, mk_col = embedded()
    wm = masked(wm_col, wm_mask)
    mk = masked(mk_col, mk_mask)

    p = TARGET_H / INK_H
    wm = wm.resize((round(wm.width * WM_SX * p), round(wm.height * WM_SY * p)), Image.LANCZOS)
    mk = mk.resize((round(mk.width * MK_S * p), round(mk.width * MK_S * p)), Image.LANCZOS)

    page = Image.new('RGBA', (round(700 * p), round(420 * p)), (0, 0, 0, 0))
    page.alpha_composite(mk, (round(MK_TX * p), round(MK_TY * p)))
    page.alpha_composite(wm, (round(WM_TX * p), round(WM_TY * p)))

    # Crop to the ink box the master defines. Cropping on alpha instead drags in
    # the invisible antialiased fringe and reports the lockup fatter than it is,
    # which is one of the ways the ratio drifted in the first place.
    return page.crop(tuple(round(v * p) for v in (INK_X0, INK_Y0, INK_X1, INK_Y1)))


if __name__ == '__main__':
    light = build()
    dark = recolour(light)
    for where in ('../public/brand', '../mobile/assets'):
        light.save(where + '/lockup.png', optimize=True)
        dark.save(where + '/lockup-dark.png', optimize=True)
    got = light.width / light.height
    print('lockup %dx%d  ratio %.4f  (master %.4f, off %.3f%%)'
          % (light.width, light.height, got, RATIO, abs(got - RATIO) / RATIO * 100))
    print('written to public/brand/ and mobile/assets/')
