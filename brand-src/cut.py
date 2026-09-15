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


# ---------------------------------------------------------------------------
# THE LOCKUP WITH THE TAGLINE UNDER IT, WHICH EXISTS FOR EMAIL AND ONLY EMAIL.
#
# Everywhere on the web the tagline is a CSS mask beside the lockup, so it takes
# the ink colour of whatever it sits on. Email has no masks and no reliable CSS
# at all, so the line has to be baked into the picture or it is simply absent,
# which is what Kris saw: the mark arrived and the tagline did not.
#
# The tagline is the one part of the master that is real outlines rather than an
# embedded bitmap, so it is rendered from the master's own paths rather than
# traced or retyped. Its group carries transform matrix(1,0,0,1,47,327) and each
# glyph sits on a baseline at y=32.877743 inside it, so the line's baseline on
# the page is 359.878. Those numbers are read here, not chosen.
#
# This step needs a Chromium to turn those outlines into pixels. If there is
# none it is SKIPPED and the two files above still build, because the ordinary
# lockup is what the product runs on and it must never depend on this.
# ---------------------------------------------------------------------------
TAG_TX, TAG_TY = 47, 327

# The tagline's own ink, matching --ink-3 on the site in each theme. It is a
# quieter grey than the wordmark on purpose: a tagline sits under a name, it
# does not compete with it.
TAG_INK = {'light': '#726859', 'dark': '#9A8F82'}


def chromium():
    import glob
    import shutil
    for c in ('chromium', 'chromium-browser', 'google-chrome'):
        found = shutil.which(c)
        if found:
            return found
    hits = sorted(glob.glob('/opt/pw-browsers/chromium*/chrome-linux/chrome'))
    return hits[-1] if hits else None


def tagline_group():
    """The tagline subtree, lifted whole out of the master."""
    svg = open(MASTER, encoding='utf-8', errors='replace').read()
    svg = re.sub(r'<metadata>.*?</metadata>', '', svg, flags=re.S)
    start = svg.find('<g transform="matrix(1, 0, 0, 1, %d, %d)">' % (TAG_TX, TAG_TY))
    if start < 0:
        raise SystemExit('the tagline group moved in the master; re-read it')
    depth, at = 0, start
    while True:
        m = re.compile(r'</?g\b[^>]*>').search(svg, at)
        if not m:
            raise SystemExit('unbalanced groups around the tagline')
        tag = m.group(0)
        if tag.startswith('</'):
            depth -= 1
        elif not tag.endswith('/>'):
            depth += 1
        at = m.end()
        if depth == 0:
            return svg[start:at]


def render_tagline(scale, ink, exe):
    """The tagline alone, on a transparent page-sized canvas, at `scale`
    pixels per page unit. Keeping the full page as the viewBox means the line
    lands at its true page position and nothing has to be lined up by hand."""
    import subprocess
    import tempfile
    body = tagline_group().replace('fill="#000000"', 'fill="%s"' % ink)
    w, h = round(700 * scale), round(420 * scale)
    # THREE THINGS ARE LOAD BEARING and the first render got two of them wrong.
    # --hide-scrollbars, or Chrome draws its own scrollbars into the picture and
    # they become ink at the far right and the bottom. overflow:hidden with a
    # transparent html AND body, or the shot comes back on white. And
    # svg{display:block}, or the inline baseline leaves a strip under it.
    doc = ('<!doctype html><meta charset="utf-8">'
           '<style>html,body{margin:0;padding:0;background:transparent;'
           'overflow:hidden}svg{display:block}</style>'
           '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
           'viewBox="0 0 700 420">%s</svg>' % (w, h, body))
    with tempfile.TemporaryDirectory() as tmp:
        page, shot = tmp + '/t.html', tmp + '/t.png'
        open(page, 'w', encoding='utf-8').write(doc)
        subprocess.run([exe, '--headless', '--disable-gpu', '--no-sandbox',
                        '--hide-scrollbars', '--default-background-color=00000000',
                        '--force-device-scale-factor=1',
                        '--screenshot=' + shot, '--window-size=%d,%d' % (w, h),
                        'file://' + page],
                       check=True, capture_output=True, timeout=120)
        im = Image.open(shot).convert('RGBA').copy()
    if im.getpixel((1, 1))[3] != 0:
        raise SystemExit('the tagline render came back opaque; it would paint a '
                         'block over the lockup. check the headless flags above.')
    return im


def build_with_tagline(exe):
    """The same page as build(), plus the line, cropped to the box the two of
    them make together. The lockup sets the left and top edges; the tagline
    sets the bottom, and the right where its final full stop overhangs."""
    wm_mask, mk_mask, wm_col, mk_col = embedded()
    p = TARGET_H / INK_H
    out = {}
    for theme in ('light', 'dark'):
        wm = masked(wm_col, wm_mask)
        mk = masked(mk_col, mk_mask)
        if theme == 'dark':
            wm, mk = recolour(wm), recolour(mk)
        wm = wm.resize((round(wm.width * WM_SX * p), round(wm.height * WM_SY * p)), Image.LANCZOS)
        mk = mk.resize((round(mk.width * MK_S * p), round(mk.width * MK_S * p)), Image.LANCZOS)

        page = Image.new('RGBA', (round(700 * p), round(420 * p)), (0, 0, 0, 0))
        page.alpha_composite(mk, (round(MK_TX * p), round(MK_TY * p)))
        page.alpha_composite(wm, (round(WM_TX * p), round(WM_TY * p)))
        tag = render_tagline(p, TAG_INK[theme], exe)
        page.alpha_composite(tag)

        # The lockup's box is measured; the tagline's is read off its own ink,
        # because the master gives no box for it. A sub-pixel fringe on the
        # bottom and the right of a line this small is invisible, and clipping
        # the full stop off the end would not be.
        box = tag.getbbox()
        x0, y0 = round(INK_X0 * p), round(INK_Y0 * p)
        x1 = max(round(INK_X1 * p), box[2])
        y1 = box[3]
        out[theme] = page.crop((x0, y0, x1, y1))
    return out


if __name__ == '__main__':
    light = build()
    dark = recolour(light)
    for where in ('../public/brand', '../mobile/assets'):
        light.save(where + '/lockup.png', optimize=True)
        dark.save(where + '/lockup-dark.png', optimize=True)
    got = light.width / light.height
    print('lockup %dx%d  ratio %.4f  (master %.4f, off %.3f%%)'
          % (light.width, light.height, got, RATIO, abs(got - RATIO) / RATIO * 100))

    exe = chromium()
    if not exe:
        print('no chromium found, so lockup-tagline.png was NOT rebuilt.')
        print('the two files above are unaffected. install one and re-run.')
    else:
        pair = build_with_tagline(exe)
        for theme, suffix in (('light', ''), ('dark', '-dark')):
            im = pair[theme]
            im.save('../public/brand/lockup-tagline%s.png' % suffix, optimize=True)
        im = pair['light']
        print('lockup-tagline %dx%d  ratio %.4f' % (im.width, im.height, im.width / im.height))

    print('written to public/brand/ and mobile/assets/')
