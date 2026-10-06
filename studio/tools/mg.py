#!/usr/bin/env python3
"""Motion-graphics kit for ref16-style faceless videos (duotone cut-out world + typed word ladders).
All frames are float32 RGB 0..255, 1080x1920. Sprites are premultiplied 4-channel float32 (r,g,b,a with rgb*a)."""
import math, os, unicodedata
from functools import lru_cache
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "..", "assets", "fonts")

# F&F palette
NAVY = (10, 22, 66)
INK = (14, 28, 82)          # text
BLUE = (40, 120, 254)       # #2878FE brand blue (accent)
GOLD = (242, 212, 61)       # house yellow, used once per video at most
WHITE = (255, 255, 255)


# ---------------------------------------------------------------- easing
def cl(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def eo(x):      # ease out cubic
    x = cl(x); return 1 - (1 - x) ** 3


def eio(x):
    x = cl(x); return 3 * x * x - 2 * x * x * x


def eb(x, s=1.70158):   # ease out back (overshoot)
    x = cl(x); x -= 1; return x * x * ((s + 1) * x + s) + 1


def spring(x, f=3.0, d=4.0):   # damped wobble 1 -> 0
    return math.exp(-d * x) * math.cos(2 * math.pi * f * x) if x >= 0 else 1.0


# ---------------------------------------------------------------- background
def make_bg(centre=(540, 860), c_in=(240, 244, 255), c_mid=(168, 192, 250), c_out=(44, 96, 226), r=1250):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - centre[0]) / 1.0) ** 2 + ((yy - centre[1]) / 1.08) ** 2) / r
    d = np.clip(d, 0, 1)
    out = np.zeros((H, W, 3), np.float32)
    for k in range(3):
        out[..., k] = np.interp(d, [0, 0.42, 1.0], [c_in[k], c_mid[k], c_out[k]])
    return out


def make_grain(n=8, amp=6.0, seed=3):
    rng = np.random.default_rng(seed)
    gs = []
    for _ in range(n):
        g = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
        g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR) * amp
        gs.append(g[..., None])
    return gs


# ---------------------------------------------------------------- sprites
def to_sprite(rgba_u8):
    a = rgba_u8[..., 3:4].astype(np.float32) / 255.0
    rgb = rgba_u8[..., :3].astype(np.float32) * a
    return np.concatenate([rgb, a], axis=2)


def trim(rgba_u8, pad=6):
    a = rgba_u8[..., 3]
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return rgba_u8
    y0, y1, x0, x1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad), max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad)
    return rgba_u8[y0:y1, x0:x1]


def duotone(rgba_u8, dark=(14, 24, 70), mid=(112, 138, 214), light=(248, 250, 255), contrast=1.08, gamma=0.9):
    rgb = rgba_u8[..., :3].astype(np.float32) / 255
    L = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]
    lo, hi = np.percentile(L[rgba_u8[..., 3] > 128], [2, 98]) if (rgba_u8[..., 3] > 128).any() else (0, 1)
    L = np.clip((L - lo) / max(1e-3, hi - lo), 0, 1)
    L = np.clip((L - 0.5) * contrast + 0.5, 0, 1) ** gamma
    out = np.zeros_like(rgba_u8)
    for k in range(3):
        out[..., k] = np.interp(L, [0, 0.5, 1], [dark[k], mid[k], light[k]])
    out[..., 3] = rgba_u8[..., 3]
    return out


def load_cut(path, max_side=900, tone=True, **kw):
    im = np.array(Image.open(path).convert("RGBA"))
    im = trim(im)
    h, w = im.shape[:2]
    s = max_side / max(h, w)
    im = cv2.resize(im, (max(1, int(w * s)), max(1, int(h * s))), interpolation=cv2.INTER_AREA)
    if tone:
        im = duotone(im, **kw)
    return to_sprite(im)


def fit(spr, w=None, h=None):
    sh, sw = spr.shape[:2]
    s = min((w / sw) if w else 9e9, (h / sh) if h else 9e9)
    return cv2.resize(spr, (max(1, int(sw * s)), max(1, int(sh * s))), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)


def mosaic(spr, p, seed=0, bmax=46):
    """pixel dissolve in: p 0..1 (blocks resolve into the image)"""
    if p >= 1:
        return spr
    if p <= 0:
        return spr * 0
    b = max(1, int(bmax * (1 - p) ** 1.4))
    h, w = spr.shape[:2]
    sw, sh = max(1, w // b), max(1, h // b)
    small = cv2.resize(spr, (sw, sh), interpolation=cv2.INTER_AREA)
    rng = np.random.default_rng(seed)
    r = cv2.resize(rng.random((24, 24)).astype(np.float32), (sw, sh), interpolation=cv2.INTER_NEAREST)
    vis = np.clip((p * 1.5 - r) * 6, 0, 1)
    small = small * vis[..., None]
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)


def place(fr, spr, cx, cy, s=1.0, rot=0.0, a=1.0, anchor="c"):
    """composite premultiplied sprite; (cx,cy) = centre (anchor 'c') or bottom-centre ('b')"""
    if a <= 0.003 or s <= 0.01:
        return
    h, w = spr.shape[:2]
    if anchor == "b":
        cy = cy - h * s / 2
    if abs(rot) < 0.01 and abs(s - 1) < 0.002:
        img = spr
    else:
        rad = math.radians(rot)
        bw = int(abs(w * s * math.cos(rad)) + abs(h * s * math.sin(rad))) + 4
        bh = int(abs(w * s * math.sin(rad)) + abs(h * s * math.cos(rad))) + 4
        M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, s)
        M[0, 2] += bw / 2 - w / 2; M[1, 2] += bh / 2 - h / 2
        img = cv2.warpAffine(spr, M, (bw, bh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    ih, iw = img.shape[:2]
    x0, y0 = int(round(cx - iw / 2)), int(round(cy - ih / 2))
    X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x0 + iw), min(H, y0 + ih)
    if X1 <= X0 or Y1 <= Y0:
        return
    sub = img[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
    al = sub[..., 3:4] * a
    fr[Y0:Y1, X0:X1] = fr[Y0:Y1, X0:X1] * (1 - al) + sub[..., :3] * a


@lru_cache(maxsize=8)
def _shadow_sprite():
    S = np.zeros((200, 600), np.float32)
    cv2.ellipse(S, (300, 100), (250, 46), 0, 0, 360, 1.0, -1)
    S = cv2.GaussianBlur(S, (0, 0), 22)
    S /= S.max()
    spr = np.zeros((200, 600, 4), np.float32)
    for k in range(3):
        spr[..., k] = NAVY[k] * S
    spr[..., 3] = S
    return spr


def shadow(fr, cx, cy, width, a=0.42, squash=1.0):
    sp = _shadow_sprite()
    s = width / 500
    sp2 = cv2.resize(sp, (max(1, int(600 * s)), max(1, int(200 * s * squash))))
    place(fr, sp2, cx, cy, 1.0, 0, a)


def glow(fr, cx, cy, r, colour=(255, 255, 255), a=0.6):
    size = int(r * 3.8)
    S = np.zeros((size, size), np.float32)
    cv2.circle(S, (size // 2, size // 2), int(r * 0.6), 1.0, -1)
    S = cv2.GaussianBlur(S, (0, 0), r * 0.35)
    S /= max(1e-6, S.max())
    spr = np.dstack([S * colour[0], S * colour[1], S * colour[2], S]).astype(np.float32)
    place(fr, spr, cx, cy, 1, 0, a)


# ---------------------------------------------------------------- vector strokes (antialiased, drawn into a sprite)
def ring(fr, cx, cy, r, th, colour=(255, 255, 255), a=1.0):
    if a <= 0 or r <= 1:
        return
    R = int(r + th + 4)
    m = np.zeros((2 * R, 2 * R), np.float32)
    cv2.circle(m, (R * 4, R * 4), int(r * 4), 1.0, max(1, int(th * 4)), cv2.LINE_AA, shift=2)
    spr = np.dstack([m * colour[0], m * colour[1], m * colour[2], m]).astype(np.float32)
    place(fr, spr, cx, cy, 1, 0, a)


def dotted_ellipse(fr, cx, cy, rx, ry, phase=0.0, n=46, dot=4, colour=(255, 255, 255), a=0.9, front=None):
    """front: None = all dots, True = lower half only (in front of hero), False = upper half only"""
    for k in range(n):
        th = 2 * math.pi * k / n + phase
        y = math.sin(th)
        if front is True and y < 0:
            continue
        if front is False and y >= 0:
            continue
        x, yy = cx + rx * math.cos(th), cy + ry * y
        m = np.zeros((dot * 4 + 4, dot * 4 + 4), np.float32)
        cv2.ellipse(m, ((dot * 2 + 2) * 4, (dot * 2 + 2) * 4), (dot * 2 * 4, dot * 4), math.degrees(th + math.pi / 2), 0, 360, 1.0, -1, cv2.LINE_AA, shift=2)
        spr = np.dstack([m * colour[0], m * colour[1], m * colour[2], m]).astype(np.float32)
        place(fr, spr, x, yy, 1, 0, a)


def line(fr, p0, p1, th, colour=INK, a=1.0):
    x0, y0 = min(p0[0], p1[0]) - th - 4, min(p0[1], p1[1]) - th - 4
    x1, y1 = max(p0[0], p1[0]) + th + 4, max(p0[1], p1[1]) + th + 4
    w, h = int(x1 - x0), int(y1 - y0)
    m = np.zeros((h, w), np.float32)
    cv2.line(m, (int((p0[0] - x0) * 4), int((p0[1] - y0) * 4)), (int((p1[0] - x0) * 4), int((p1[1] - y0) * 4)), 1.0, int(th), cv2.LINE_AA, shift=2)
    spr = np.dstack([m * colour[0], m * colour[1], m * colour[2], m]).astype(np.float32)
    place(fr, spr, (x0 + x1) / 2, (y0 + y1) / 2, 1, 0, a)


# ---------------------------------------------------------------- type
FONT_FILES = {
    # Hinglish on screen (Salinur 2026-10-06): ref16 type — Anton caps, Bebas, Inter light italic.
    "B": ("teko-devanagari-700-normal.ttf", "Anton-Regular.ttf"),
    "M": ("teko-devanagari-600-normal.ttf", "BebasNeue-Regular.ttf"),
    "c": ("mukta-devanagari-300-normal.ttf", "Inter-LightItalic.ttf"),
    "C": ("mukta-devanagari-600-normal.ttf", "Inter-MediumItalic.ttf"),
}


@lru_cache(maxsize=64)
def _font(file, size):
    return ImageFont.truetype(os.path.join(FONTS, file), size, layout_engine=ImageFont.Layout.RAQM)


def _is_deva(ch):
    return "ऀ" <= ch <= "ॿ" or ch in "‌‍₹"   # ₹ comes from the Devanagari face (Anton has none)


def _runs(text):
    runs, cur, kind = [], "", None
    for ch in text:
        k = _is_deva(ch) if ch != " " else kind
        if kind is None or k == kind:
            cur += ch; kind = k if k is not None else kind
        else:
            runs.append((cur, kind)); cur, kind = ch, k
    if cur:
        runs.append((cur, kind))
    return runs


def clusters(text):
    """split into aksharas (grapheme-ish clusters) so typing never shows a broken conjunct"""
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        if out and (cat in ("Mn", "Mc") or out[-1].endswith("्") or ch in "‌‍"):
            out[-1] += ch
        else:
            out.append(ch)
    return out


@lru_cache(maxsize=512)
def text_sprite(text, style="B", size=180, colour=INK, italic=False):
    deva, lat = FONT_FILES[style]
    runs = _runs(text)
    fonts = [(_font(deva, size) if k else _font(lat, int(size * (1.0 if style != "c" else 0.95)))) for _, k in runs]
    pad = int(size * 0.5)
    widths = [f.getlength(r) for (r, _), f in zip(runs, fonts)]
    Wt, Ht = int(sum(widths) + 2 * pad), int(size * 2.0)
    im = Image.new("L", (Wt, Ht), 0)
    d = ImageDraw.Draw(im)
    x = pad
    base = int(size * 1.25)
    for (r, k), f, w in zip(runs, fonts, widths):
        d.text((x, base), r, font=f, fill=255, anchor="ls")
        x += w
    a = np.array(im)
    if italic:
        sh = 0.2
        M = np.float32([[1, -sh, sh * base], [0, 1, 0]])
        a = cv2.warpAffine(a, M, (Wt + int(sh * Ht), Ht))
    ys, xs = np.where(a > 0)
    if len(xs) == 0:
        return np.zeros((2, 2, 4), np.float32), 0, 0
    # keep the baseline frame: crop x tight, y from top of ink
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a = a[y0:y1, x0:x1].astype(np.float32) / 255
    spr = np.dstack([a * colour[0], a * colour[1], a * colour[2], a]).astype(np.float32)
    return spr, base - y0, x1 - x0      # sprite, baseline offset from sprite top, width


def text_width(text, style="B", size=180, italic=False):
    return text_sprite(text, style, size, INK, italic)[2]


def put_text(fr, text, x, y_base, style="B", size=180, colour=INK, a=1.0, anchor="l", italic=False, pop=1.0):
    """draw text with its BASELINE at y_base. anchor l/c/r horizontally."""
    if not text or a <= 0:
        return
    spr, boff, w = text_sprite(text, style, size, colour, italic)
    h = spr.shape[0]
    cx = {"l": x + w / 2, "c": x, "r": x - w / 2}[anchor]
    cy = y_base - boff + h / 2
    place(fr, spr, cx, cy, pop, 0, a)


def typed(text, t, t0, t1):
    if t < t0:
        return ""
    cs = clusters(text)
    n = len(cs) if t >= t1 else max(1, int(math.ceil(len(cs) * (t - t0) / max(1e-3, t1 - t0))))
    return "".join(cs[:n])


# ---------------------------------------------------------------- icons
def ig_glyph(size=44, colour=(255, 255, 255)):
    m = np.zeros((size * 4, size * 4), np.float32)
    s = size * 4
    th = max(4, int(s * 0.09))
    r = int(s * 0.28)
    cv2.rectangle(m, (th, th), (s - th, s - th), 1.0, th, cv2.LINE_AA)
    m2 = np.zeros_like(m)
    # rounded corners by drawing a rounded rect manually
    m[:] = 0
    rr = int(s * 0.26)
    for (cx, cy) in [(th + rr, th + rr), (s - th - rr, th + rr), (th + rr, s - th - rr), (s - th - rr, s - th - rr)]:
        cv2.circle(m2, (cx, cy), rr, 1.0, -1, cv2.LINE_AA)
    cv2.rectangle(m2, (th + rr, th), (s - th - rr, s - th), 1.0, -1)
    cv2.rectangle(m2, (th, th + rr), (s - th, s - th - rr), 1.0, -1)
    inner = cv2.erode(m2, np.ones((th, th), np.uint8))
    m = np.clip(m2 - inner, 0, 1)
    cv2.circle(m, (s // 2, s // 2), r, 1.0, th, cv2.LINE_AA)
    cv2.circle(m, (int(s * 0.74), int(s * 0.26)), int(th * 0.75), 1.0, -1, cv2.LINE_AA)
    m = cv2.resize(m, (size, size), interpolation=cv2.INTER_AREA)
    return np.dstack([m * colour[0], m * colour[1], m * colour[2], m]).astype(np.float32)
