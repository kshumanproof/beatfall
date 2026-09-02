#!/usr/bin/env python3
"""
Placeholder app icons, in the Beatfall palette.

This is deliberately not a mark. Kris closed the branding question and the
designer has not delivered one; an app will not build or install without an
icon, so this is the plainest possible stand-in — paper, a rule, and the
wordmark's own letterform. Replace all four files when the real mark lands.
"""
from PIL import Image, ImageDraw, ImageFont
import os

HERE   = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets')
FACE   = os.path.join(HERE, '..', 'node_modules', '@expo-google-fonts',
                      'newsreader', '600SemiBold', 'Newsreader_600SemiBold.ttf')

GROUND = (241, 238, 231)   # --ground
CARD   = (253, 251, 246)   # --card
INK    = (43, 38, 32)      # --ink
RULE   = (224, 217, 203)   # --rule


def letter(size, bg, glyph_ratio=0.60, card=True, pad_ratio=0.14):
    """One paper square with a serif 'b' sitting on it."""
    img = Image.new('RGBA', (size, size), bg + (255,))
    d = ImageDraw.Draw(img)

    if card:
        p = int(size * pad_ratio)
        r = max(2, int(size * 0.035))
        d.rounded_rectangle([p, p, size - p, size - p], radius=r,
                            fill=CARD, outline=RULE, width=max(1, size // 220))

    f = ImageFont.truetype(FACE, int(size * glyph_ratio))
    box = d.textbbox((0, 0), 'b', font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text((size / 2 - w / 2 - box[0], size / 2 - h / 2 - box[1]), 'b', font=f, fill=INK)
    return img


def main():
    os.makedirs(ASSETS, exist_ok=True)
    out = {
        'icon.png':                    letter(1024, GROUND),
        'splash-icon.png':             letter(512, GROUND, card=False, glyph_ratio=0.52),
        'favicon.png':                 letter(96, GROUND, pad_ratio=0.10),
        # Android draws its own background layer, and crops the foreground to a
        # circle — so the glyph has to sit well inside the safe area.
        'android-icon-foreground.png': letter(1024, GROUND, glyph_ratio=0.38, card=False),
    }
    for name, img in out.items():
        img.save(os.path.join(ASSETS, name))
        print('wrote', name, img.size)

    flat = Image.new('RGBA', (1024, 1024), GROUND + (255,))
    flat.save(os.path.join(ASSETS, 'android-icon-background.png'))
    print('wrote android-icon-background.png (1024, 1024)')

    mono = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    md = ImageDraw.Draw(mono)
    mf = ImageFont.truetype(FACE, 390)
    bb = md.textbbox((0, 0), 'b', font=mf)
    md.text((512 - (bb[2] - bb[0]) / 2 - bb[0], 512 - (bb[3] - bb[1]) / 2 - bb[1]),
            'b', font=mf, fill=(0, 0, 0, 255))
    mono.save(os.path.join(ASSETS, 'android-icon-monochrome.png'))
    print('wrote android-icon-monochrome.png (1024, 1024)')


if __name__ == '__main__':
    main()
