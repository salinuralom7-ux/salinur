"""Cut the MySheher brand assets out of the master artwork.

Two sources, because they are different drawings and each is right for a
different job:

  brand/mysheher-icon.png    the mark alone, square and sharp — everything
                             square comes from this
  brand/mysheher-master.png  the full lockup — only the wordmark is taken
                             from it

There is also brand/mysheher-glow.png, the same mark with a bloom around it.
Deliberately unused: a glow eats the safe zone an icon has to live inside and
goes to mush below about 96px. Keep it for a splash or a banner.

Every derivative is generated, so the icon on a phone cannot drift from the
wordmark in the header. Re-run after any change to the artwork:

    python3 tools/make-brand.py
"""
import os
from PIL import Image

ICON_SRC = "brand/mysheher-icon.png"
LOCK_SRC = "brand/mysheher-master.png"
OUT      = "docs/icons"
BRAND_BG = (12, 10, 7, 255)          # --bg, so an icon sits in the app's own dark


def ink_box(im, x0=0, x1=None, y0=0, y1=None):
    """Tightest box round anything brighter than the background."""
    px = im.load()
    x1 = x1 or im.width
    y1 = y1 or im.height
    minx, miny, maxx, maxy = x1, y1, x0, y0
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if r + g + b > 60:
                minx = min(minx, x); maxx = max(maxx, x)
                miny = min(miny, y); maxy = max(maxy, y)
    return minx, miny, maxx + 1, maxy + 1


def keyed(img):
    """Black background out, artwork in. A soft ramp rather than a hard cut,
       so the antialiased edges stay smooth instead of jagged. The mark's own
       negative space goes transparent too, which is what you want: it reads
       as a hole on any background rather than a black patch on a pale one."""
    img = img.convert("RGBA")
    p = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = p[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            p[x, y] = (r, g, b, 0 if lum <= 16 else min(255, int((lum - 16) / 36 * 255)))
    return img


def trim(img, cap):
    """Cap the long edge. Both of these are precached by the service worker, so
       they cost every install, and neither is ever drawn large: the mark is
       22px in the header and at most ~130px as the card watermark, the
       wordmark at most ~33px tall. `cap` leaves 3x headroom and no more.

       Quantising to a palette would be far smaller again — and was tried —
       but the mark is a smooth gradient and 256 colours band it visibly.
       Bytes are not worth a banded logo."""
    if max(img.size) > cap:
        img = img.copy()
        img.thumbnail((cap, cap), Image.LANCZOS)
    return img


def on_dark(img, size, fill):
    """The mark centred on the app's own background, at `fill` of the canvas."""
    card = Image.new("RGBA", (size, size), BRAND_BG)
    a = img.copy()
    a.thumbnail((int(size * fill), int(size * fill)), Image.LANCZOS)
    card.alpha_composite(a, ((size - a.width) // 2, (size - a.height) // 2))
    return card


os.makedirs(OUT, exist_ok=True)

# ---- the mark, from the dedicated square drawing ----
# Note the icon source is deliberately its own big square file. Cutting the
# mark out of the lockup gave 265px of art, and Image.thumbnail only ever
# shrinks — so the 512 tile and the maskable tile both received the same
# unscaled 265px mark, came out byte-identical, and looked soft on a phone.
icon = Image.open(ICON_SRC).convert("RGBA")
mark = keyed(icon.crop(ink_box(icon)))
trim(mark, 384).save(f"{OUT}/logo.png", optimize=True)

# ---- the wordmark, from the lockup, split on the gap in the column profile ----
lock = Image.open(LOCK_SRC).convert("RGBA")
GAP = 548
word = keyed(lock.crop(ink_box(lock, x0=GAP)))
trim(word, 512).save(f"{OUT}/wordmark.png", optimize=True)

# any-purpose icons: the mark nearly filling the tile
for size in (192, 512):
    on_dark(mark, size, 0.80).save(f"{OUT}/icon-{size}.png", optimize=True)
on_dark(mark, 180, 0.80).save(f"{OUT}/apple-touch-icon.png", optimize=True)
on_dark(mark, 180, 0.80).save("docs/apple-touch-icon.png", optimize=True)

# maskable: Android crops to a circle, so the mark lives well inside the safe
# zone and the corners are the brand's own dark rather than nothing
on_dark(mark, 512, 0.58).save(f"{OUT}/maskable-512.png", optimize=True)

# ---- keep the HTML's intrinsic sizes honest ----
# Every <img> carries width/height so the browser reserves the right box before
# the file arrives and the header does not jump. Those numbers are the file's
# real pixels, and when the artwork changed shape they silently became a lie —
# a wrong reserved box is exactly the layout shift the attributes exist to
# prevent. So the generator writes them, rather than trusting anyone to notice.
import glob
import re

sizes = {f"icons/{n}": Image.open(f"{OUT}/{n}").size for n in ("logo.png", "wordmark.png")}
fixed = 0
for page in ["docs/index.html"] + sorted(glob.glob("docs/*/index.html")):
    with open(page) as fh:
        html = fh.read()

    def retag(m):
        global fixed
        src = m.group("src").split("/")[-1]
        w, h = sizes[f"icons/{src}"]
        if (int(m.group("w")), int(m.group("h"))) != (w, h):
            fixed += 1
        return f'{m.group("head")}width="{w}" height="{h}"'

    out = re.sub(
        r'(?P<head><img[^>]*?src="(?P<src>[^"]*icons/(?:logo|wordmark)\.png)[^"]*"[^>]*?)'
        r'width="(?P<w>\d+)" height="(?P<h>\d+)"',
        retag, html)
    if out != html:
        with open(page, "w") as fh:
            fh.write(out)

print(f"mark from {ICON_SRC}: {mark.size}")
print(f"word from {LOCK_SRC}: {word.size}")
print(f"intrinsic width/height corrected in HTML: {fixed}")
for f in ("logo.png", "wordmark.png", "icon-192.png", "icon-512.png",
          "maskable-512.png", "apple-touch-icon.png"):
    p = f"{OUT}/{f}"
    print(f"  {f:22} {Image.open(p).size}  {os.path.getsize(p) // 1024} KB")
