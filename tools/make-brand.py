"""Cut the MySheher brand assets out of the supplied logo.

One source image, every derivative generated from it, so the icon on a phone
can never drift from the wordmark in the header. Re-run after any change to
the master artwork.

    python3 tools/make-brand.py path/to/logo.png
"""
import sys, os
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "brand/mysheher-master.png"
OUT = "docs/icons"
BRAND_BG = (12, 10, 7, 255)          # --bg, so an icon sits in the app's own dark

im = Image.open(SRC).convert("RGBA")
px = im.load(); w, h = im.size

def ink_box(x0, x1, y0=0, y1=None):
    """Tightest box round anything brighter than the background."""
    y1 = y1 or h
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
       so the antialiased edges of the mark stay smooth instead of jagged."""
    img = img.convert("RGBA")
    p = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = p[x, y]
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            p[x, y] = (r, g, b, 0 if lum <= 16 else min(255, int((lum - 16) / 36 * 255)))
    return img

def on_dark(img, size, fill):
    """The mark centred on the app's own background, at `fill` of the canvas."""
    card = Image.new("RGBA", (size, size), BRAND_BG)
    side = int(size * fill)
    a = img.copy()
    a.thumbnail((side, side), Image.LANCZOS)
    card.alpha_composite(a, ((size - a.width) // 2, (size - a.height) // 2))
    return card

# the gap between the mark and the wordmark, found by column profile
GAP = 548
mark_box = ink_box(0, GAP)
word_box = ink_box(GAP, w)
mark = keyed(im.crop(mark_box))
word = keyed(im.crop(word_box))

os.makedirs(OUT, exist_ok=True)
mark.save(f"{OUT}/logo.png")
word.save(f"{OUT}/wordmark.png")

# any-purpose icons: the mark nearly filling the tile
for size in (192, 512):
    on_dark(mark, size, 0.78).save(f"{OUT}/icon-{size}.png")
on_dark(mark, 180, 0.78).save(f"{OUT}/apple-touch-icon.png")
on_dark(mark, 180, 0.78).save("docs/apple-touch-icon.png")

# maskable: Android crops to a circle, so the mark lives inside the 80% safe
# zone and the corners are the brand's dark rather than nothing
on_dark(mark, 512, 0.56).save(f"{OUT}/maskable-512.png")

print("mark  ", mark_box, mark.size)
print("word  ", word_box, word.size)
for f in ("logo.png","wordmark.png","icon-192.png","icon-512.png","maskable-512.png","apple-touch-icon.png"):
    p = f"{OUT}/{f}"
    print(f"  {f:22} {Image.open(p).size}  {os.path.getsize(p)//1024} KB")
