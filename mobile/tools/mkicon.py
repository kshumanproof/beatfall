#!/usr/bin/env python3
"""
App icons, from Kris's mark.

`mark.png` is the mark on transparency — three beats in place and the one still
coming down. Everything else here is packaging: iOS wants an opaque square and
applies its own rounding, Android wants a foreground that survives being cropped
to a circle, so the glyph is inset to the safe zone rather than filling the tile.
"""
from PIL import Image
import os

HERE   = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets')
MARK   = os.path.join(HERE, 'mark.png')

GROUND = (241, 238, 231)   # --ground
INK    = (43, 38, 32)      # --ink


def placed(size, fill, ground=None):
    """The mark centred on a square, occupying `fill` of the side."""
    art = Image.open(MARK).convert('RGBA')
    w, h = art.size
    scale = (size * fill) / max(w, h)
    art = art.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (ground + (255,)) if ground else (0, 0, 0, 0))
    out.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return out


def main():
    os.makedirs(ASSETS, exist_ok=True)
    # The mark already carries its own rounded tile, so it goes full-bleed for
    # the app icon rather than being pasted onto a second square — iOS applies
    # its own mask over the top and the two roundings agree closely enough.
    jobs = [
        ('icon.png',                     1024, 1.00, GROUND),
        ('splash-icon.png',               512, 0.60, None),
        ('favicon.png',                    96, 1.00, GROUND),
        # Android crops the foreground to a circle; 0.66 keeps the tile inside it
        ('android-icon-foreground.png',  1024, 0.66, None),
    ]
    for name, size, fill, ground in jobs:
        placed(size, fill, ground).save(os.path.join(ASSETS, name))
        print('wrote', name, size)

    Image.new('RGBA', (1024, 1024), GROUND + (255,)) \
         .save(os.path.join(ASSETS, 'android-icon-background.png'))
    print('wrote android-icon-background.png 1024')

    # The monochrome layer is a silhouette: colour is thrown away, so a flat
    # ink stamp of the same shape is the only version that reads.
    mono = placed(1024, 0.66)
    solid = Image.new('RGBA', mono.size, INK + (255,))
    solid.putalpha(mono.getchannel('A'))
    solid.save(os.path.join(ASSETS, 'android-icon-monochrome.png'))
    print('wrote android-icon-monochrome.png 1024')


if __name__ == '__main__':
    main()
