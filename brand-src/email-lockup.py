"""The logo at the top of every Beatfall email: the lockup with its tagline under it.

All three emails (sign-in code, sign-up, deletion warning) ask for
/brand/lockup-tagline.png and, in dark mode, /brand/lockup-tagline-dark.png, in a
182 x 57 box. Neither file existed, so every email opened on a broken image.

Built from the same pieces and the same proportions as the masthead on every
page, so the email and the site cannot drift apart: the lockup is the type size
x 0.913 tall, the tagline is the type size x 4.254 wide, with a gap of the type
size x 0.1481 between them, and the tagline takes --ink-3 for its theme. Those
proportions come out at 3.195 to 1, which is the 182 x 57 box the emails
already reserve.

Drawn at three times that size so it is sharp on a phone. Re-run after the
lockup or the tagline changes:

    pip install cairosvg pillow
    python brand-src/email-lockup.py
"""
import io, os, re
import cairosvg
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, 'public', 'brand')
W = 546                      # 182 x 3
WM = W / 4.254               # the type size the masthead is built from
LOCK_H = WM * 0.913
GAP = WM * 0.1481
INK3 = {'light': '#726859', 'dark': '#9A8F82'}   # --ink-3 in theme.css

svg = open(os.path.join(BRAND, 'tagline.svg'), encoding='utf-8').read()
vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
TAG_H = W * vb[3] / vb[2]
H = round(LOCK_H + GAP + TAG_H)

for theme, lockfile, out in (('light', 'lockup.png', 'lockup-tagline.png'),
                             ('dark', 'lockup-dark.png', 'lockup-tagline-dark.png')):
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    lock = Image.open(os.path.join(BRAND, lockfile)).convert('RGBA')
    lw = round(LOCK_H * lock.width / lock.height)
    canvas.alpha_composite(lock.resize((lw, round(LOCK_H)), Image.LANCZOS), (0, 0))
    coloured = svg.replace('fill="#000"', 'fill="%s"' % INK3[theme], 1)
    png = cairosvg.svg2png(bytestring=coloured.encode('utf-8'),
                           output_width=W, output_height=round(TAG_H))
    tag = Image.open(io.BytesIO(png)).convert('RGBA')
    canvas.alpha_composite(tag, (0, round(LOCK_H + GAP)))
    canvas.save(os.path.join(BRAND, out), optimize=True)
    print(out, canvas.size)
