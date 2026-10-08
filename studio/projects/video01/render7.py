#!/usr/bin/env python3
"""video01 v7 — re-edit in THE style (references/STYLE_REF17.md, Salinur 2026-10-08: follow ref17 100 %).
Steady warm-pastel talking head, ref17 captions (small white words + big peach keyword + script accent),
full-screen visual-story scenes (chevron hero, spotlight icons, handwritten line, card carousel, queue on a wave),
light-leak transitions, IG watermark, dimmed IG outro. All times are OUT-time (work/base60.mp4).
Usage: render7.py --stills t ... | --part k N
"""
import math, os, re, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "tools"))
import mg
from mg import W, H, cl, eo, eio, eb

FPS = 30
END = 60.0
AS = os.path.join(HERE, "..", "..", "assets")
FONT = os.path.join(AS, "fonts")
EMO = os.path.join(AS, "emoji3d")
ICO = os.path.join(AS, "icons", "lucide")

PEACH = (247, 190, 160)
PEACH_HI = (255, 232, 212)
CORAL = (240, 118, 78)
CREAM = (255, 240, 226)
INKD = (46, 36, 36)
WHITE = (255, 255, 255)
RED = (214, 58, 48)


# ------------------------------------------------------------------ words
WORDS = []
for ln in open(os.path.join(HERE, "work", "words_out.txt")):
    p = ln.split()
    if len(p) >= 3:
        WORDS.append((float(p[1]), float(p[2]), p[0]))


def widx(t):
    for i, (s, e, w) in enumerate(WORDS):
        if s >= t - 0.06:
            return i
    return len(WORDS) - 1


# ------------------------------------------------------------------ text rendering (PIL, cached)
_fc = {}


def font(name, size):
    k = (name, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(os.path.join(FONT, name), size)
    return _fc[k]


_tc = {}


def text_spr(text, fname, size, fill=WHITE, grad=None, shadow=0.35, track=0):
    """premultiplied sprite of a text line (+ soft shadow). grad=(top,bottom) colours for a vertical gradient fill."""
    k = (text, fname, size, fill, grad, shadow, track)
    if k in _tc:
        return _tc[k]
    f = font(fname, size)
    pad = int(size * 0.6)
    w = int(f.getlength(text) + track * len(text)) + 2 * pad
    h = int(size * 1.7) + 2 * pad
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    if track:
        x = pad
        for ch in text:
            d.text((x, pad + size * 0.2), ch, font=f, fill=255)
            x += f.getlength(ch) + track
    else:
        d.text((pad, pad + size * 0.2), text, font=f, fill=255)
    a = np.array(m).astype(np.float32) / 255
    ys, xs = np.where(a > 0.02)
    if len(xs) == 0:
        _tc[k] = np.zeros((2, 2, 4), np.float32); return _tc[k]
    y0, y1, x0, x1 = max(0, ys.min() - 30), min(h, ys.max() + 30), max(0, xs.min() - 30), min(w, xs.max() + 30)
    a = a[y0:y1, x0:x1]
    hh, ww = a.shape
    if grad:
        gy = np.linspace(0, 1, hh)[:, None, None]
        col = np.array(grad[0], np.float32) * (1 - gy) + np.array(grad[1], np.float32) * gy
        rgb = np.broadcast_to(col, (hh, ww, 3))
    else:
        rgb = np.broadcast_to(np.array(fill, np.float32), (hh, ww, 3))
    spr = np.dstack([rgb * a[..., None], a]).astype(np.float32)
    if shadow:
        sh = cv2.GaussianBlur(a, (0, 0), max(2, size * 0.06))
        sh = np.roll(sh, int(size * 0.04), axis=0) * shadow
        base = np.dstack([np.zeros((hh, ww, 3), np.float32), sh])
        al = spr[..., 3:4]
        spr = np.concatenate([spr[..., :3] + base[..., :3] * (1 - al), al + base[..., 3:4] * (1 - al)], 2)
    _tc[k] = spr
    return spr


def put(fr, spr, cx, cy, s=1.0, a=1.0, rot=0.0):
    mg.place(fr, spr, cx, cy, s, rot, a)


def tw(text, fname, size):
    return font(fname, size).getlength(text)


# ------------------------------------------------------------------ images
_ic = {}


def emoji(code, size):
    k = ("e", code, size)
    if k not in _ic:
        im = Image.open(os.path.join(EMO, code + ".png")).convert("RGBA").resize((size, size), Image.LANCZOS)
        _ic[k] = mg.to_sprite(np.array(im))
    return _ic[k]


def icon(name, size, colour=WHITE, stroke=2.0):
    k = ("i", name, size, colour, stroke)
    if k not in _ic:
        import cairosvg, io
        svg = open(os.path.join(ICO, name + ".svg")).read()
        svg = re.sub(r'stroke="currentColor"', f'stroke="rgb{colour}"', svg)
        svg = re.sub(r'stroke-width="[\d.]+"', f'stroke-width="{stroke}"', svg)
        png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
        _ic[k] = mg.to_sprite(np.array(Image.open(io.BytesIO(png)).convert("RGBA")))
    return _ic[k]


def rounded(w, h, r, fill, border=None, bw=0):
    k = ("r", w, h, r, fill, border, bw)
    if k not in _ic:
        im = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        if border:
            d.rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), radius=r * 2, fill=border + (255,))
            d.rounded_rectangle((bw * 2, bw * 2, w * 2 - 1 - bw * 2, h * 2 - 1 - bw * 2), radius=(r - bw) * 2, fill=fill + (255,))
        else:
            d.rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), radius=r * 2, fill=fill + (255,))
        im = im.resize((w, h), Image.LANCZOS)
        _ic[k] = mg.to_sprite(np.array(im))
    return _ic[k]


def ig_glyph(size, colour=WHITE):
    k = ("ig", size, colour)
    if k not in _ic:
        s = size * 4
        im = Image.new("L", (s, s), 0)
        d = ImageDraw.Draw(im)
        th = int(s * 0.085)
        d.rounded_rectangle((th // 2, th // 2, s - th // 2, s - th // 2), radius=int(s * 0.28), outline=255, width=th)
        r = int(s * 0.22)
        d.ellipse((s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r), outline=255, width=th)
        rr = int(s * 0.06)
        d.ellipse((s * 0.74 - rr, s * 0.26 - rr, s * 0.74 + rr, s * 0.26 + rr), fill=255)
        a = np.array(im.resize((size, size), Image.LANCZOS)).astype(np.float32) / 255
        if colour == "grad":
            yy, xx = np.mgrid[0:size, 0:size] / size
            u = np.clip((xx * 0.5 + (1 - yy) * 0.5), 0, 1)[..., None]
            c0, c1, c2 = np.array((254, 218, 117.)), np.array((214, 41, 118.)), np.array((79, 91, 213.))
            rgb = np.where(u < 0.5, c0 * (1 - u * 2) + c1 * u * 2, c1 * (1 - (u - 0.5) * 2) + c2 * (u - 0.5) * 2)
            # gradient runs bottom-left (yellow) -> top-right (purple)
            rgb = rgb[::-1]
        else:
            rgb = np.broadcast_to(np.array(colour, np.float32), (size, size, 3))
        _ic[k] = np.dstack([rgb * a[..., None], a]).astype(np.float32)
    return _ic[k]


# ------------------------------------------------------------------ grade + talking head
def build_luts():
    x = np.arange(256, dtype=np.float32) / 255
    # soft pastel curve: lifted blacks, gentle S, soft highlights
    y = 0.05 + 0.93 * x ** 0.92
    y = y + 0.04 * np.sin(np.pi * x) * (x - 0.5)
    y = np.clip(y, 0, 0.985)
    r = np.clip(y * 1.02 + 0.006, 0, 1)
    g = np.clip(y * 1.000 + 0.002, 0, 1)
    b = np.clip(y * 0.965, 0, 1)
    return [(np.stack([b, g, r][k]) * 255).astype(np.uint8) for k in range(3)]


LUT = None
GLOW = None


def grade(bgr):
    out = cv2.merge([cv2.LUT(bgr[..., k], LUT[k]) for k in range(3)])
    f = out.astype(np.float32)
    lum = f.mean(2, keepdims=True) / 255
    # peach in the highlights, a touch more saturation
    f += np.array((-4, 1, 6), np.float32) * lum ** 2      # BGR
    g = f.mean(2, keepdims=True)
    f = g + (f - g) * 0.97
    f = f[..., ::-1] + GLOW       # -> RGB + warm lamp glow top-right
    return f


def lower_shade():
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    a = np.clip((y - 0.50) / 0.35, 0, 1) ** 1.4 * 0.55
    return a


SHADE = None


def head_frame(base, t, card=None):
    """graded talking head with a slow push. card=(scale, cx, cy) puts it in a rounded card."""
    f = grade(base)
    seg_t0 = max([s for s in PUSH if s <= t] + [0])
    z = 1.0 + 0.045 * eio((t - seg_t0) / 6.0)
    if z > 1.001:
        M = cv2.getRotationMatrix2D((W / 2, H * 0.42), 0, z)
        f = cv2.warpAffine(f, M, (W, H), borderMode=cv2.BORDER_REPLICATE)
    f = f * (1 - SHADE)
    return f


PUSH = [0, 7.54, 13.44, 17.2, 25.25, 31.43, 40.45, 48.39]


# ------------------------------------------------------------------ backgrounds for scenes
def peach_bg():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    u = np.clip((yy / H) * 0.8 + (xx / W) * 0.2, 0, 1)[..., None]
    return np.array((246, 168, 140), np.float32) * (1 - u) + np.array((253, 222, 190), np.float32) * u


def chevron_bg():
    im = Image.fromarray(np.clip(peach_bg(), 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im, "RGBA")
    for x0, x1 in [(120, 380), (700, 960)]:
        cx = (x0 + x1) / 2
        d.polygon([(x0, 0), (x1, 0), (x1, 980), (cx, 1260), (x0, 980)], fill=CORAL + (255,))
    d.polygon([(0, 1920), (0, 1500), (540, 1880), (1080, 1500), (1080, 1920)], fill=CORAL + (255,))
    d.polygon([(0, 1500), (540, 1880), (1080, 1500), (1080, 1540), (540, 1920), (0, 1540)], fill=(248, 150, 110, 255))
    return np.array(im).astype(np.float32)


def dark_bg():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    bg = np.zeros((H, W, 3), np.float32) + np.array((26, 26, 29), np.float32)
    # diagonal soft light from top-left
    d = (xx * 0.6 + yy * 0.8) / 2200
    beam = np.clip(1 - np.abs((xx - yy * 0.55) - 120) / 380, 0, 1) * np.clip(1 - yy / 1500, 0, 1)
    bg += (beam[..., None] * 38)
    bg += np.clip(0.4 - d, 0, 1)[..., None] * 30
    for x in range(0, W, 180):
        bg[:, x:x + 2] += 9
    for y in range(60, H, 180):
        bg[y:y + 2, :] += 9
    for x in range(90, W, 360):
        for y in range(150, H, 360):
            bg[y - 12:y + 12, x - 1:x + 1] += 30
            bg[y - 1:y + 1, x - 12:x + 12] += 30
    return bg


BGS = {}


# ------------------------------------------------------------------ captions (ref17)
PH = [  # (t0, small words, KEY, after/script, extra)
    (0.09, "if you have any", "BUSINESS", None, None),
    (1.24, "then this video is going to", "SOLVE", None, None),
    (2.94, "", "67%", "of your problems", "ruler67"),
    (5.10, "let's say for example", None, None, "plain"),
    (6.16, "you have a", "HOSPITAL", "in your town", "hosp"),
    (7.54, "you have put your", "MONEY", "in", "coins"),
    (9.28, "you have", "YEARS", "of effort", "years"),
    (11.06, "and more than anything", None, None, "plain"),
    (12.44, "you have a", "DREAM", "big", "script"),
    (13.44, "out of it", None, None, "plain"),
    (17.20, "and he starts making", "VIDEOS", "every day", "videos"),
    (19.08, "and suddenly someday", None, None, "plain"),
    (20.48, "you step out of your", "HOSPITAL", None, None),
    (21.74, "and you see", None, None, "plain"),
    (25.25, "now this might sound", "RUBBISH", "so", "script"),
    (27.45, "you you have", None, None, "plain"),
    (31.43, "is still that guy with just a", "CAMERA", None, "camera"),
    (33.21, "and videos", None, None, "plain"),
    (33.69, "is stealing your", "CUSTOMERS", None, None),
    (35.58, "if that is your case", None, None, "plain"),
    (36.69, "he is not just stealing your", "CUSTOMERS", None, None),
    (40.52, "we are", "F&F", None, "logo"),
    (41.71, "we are a marketing", "AGENCY", None, None),
    (49.45, "so this evening I'm totally", "FREE", None, None),
    (51.29, "give us a", "CALL", None, "call"),
    (52.70, "are ready to take your call", None, None, "plain"),
    (53.71, "we have", "PLANNED", "for your business", None),
    (55.73, "if that works for you", None, None, "plain"),
    (56.85, "see you", "SOON", None, None),
]
FS = [  # full-screen visual-story scenes (t0, t1, name)
    (13.95, 17.18, "pandey"),
    (22.20, 25.22, "queue"),
    (27.88, 31.40, "spot"),
    (38.22, 40.48, "write"),
    (42.62, 48.36, "cards"),
]


def phrase_times():
    out = []
    for k, (t0, small, key, after, extra) in enumerate(PH):
        i = widx(t0)
        n_s = len(small.split()) if small else 0
        st = [WORDS[min(i + j, len(WORDS) - 1)][0] for j in range(n_s)]
        kt = WORDS[min(i + n_s, len(WORDS) - 1)][0] if key else None
        n_a = len(after.split()) if (after and extra != "script") else 0
        at = WORDS[min(i + n_s + 1, len(WORDS) - 1)][0] if after else None
        t1 = PH[k + 1][0] if k + 1 < len(PH) else 57.45
        for a, b, _ in FS:
            if t0 < a < t1:
                t1 = a
        out.append(dict(t0=t0, t1=t1, small=small, key=key, after=after, extra=extra, st=st, kt=kt, at=at))
    return out


PT = None
CY = 1330       # keyword baseline area (centre of the keyword)


def draw_caption(fr, t):
    for p in PT:
        if not (p["t0"] - 0.02 <= t < p["t1"]):
            continue
        fade = cl((p["t1"] - t) / 0.12)
        if p["extra"] == "plain":
            words = p["small"].split()
            shown = [w for w, s in zip(words, p["st"]) if t >= s - 0.03]
            if not shown:
                return
            # two lines max, centred
            txt = " ".join(shown)
            spr = text_spr(txt, "Inter-700.ttf", 86, WHITE, shadow=0.4)
            if spr.shape[1] > 1000:
                spr = text_spr(txt, "Inter-700.ttf", int(86 * 1000 / spr.shape[1]), WHITE, shadow=0.4)
            k = (t - p["st"][len(shown) - 1]) / 0.15
            put(fr, spr, 540, CY, 1 + 0.06 * (1 - eo(k)), fade)
            # the little white pill drifting near the caption (ref17)
            ph = t * 1.7
            put(fr, rounded(46, 30, 15, WHITE), 540 + 330 * math.sin(ph), CY - 120 + 30 * math.cos(ph * 1.3), 1, 0.85 * fade)
            return
        # small line above the keyword
        key_t = p["kt"] if p["key"] else 1e9
        if p["small"]:
            words = p["small"].split()
            shown = [w for w, s in zip(words, p["st"]) if t >= s - 0.03]
            if shown:
                spr = text_spr(" ".join(shown), "Inter-700.ttf", 58, WHITE, shadow=0.45)
                put(fr, spr, 540, CY - 120, 1, fade)
        if p["key"] and p["extra"] in ("ruler67",) and t >= key_t - 0.04:
            extras(fr, t, p, key_t, fade)
            if p["after"] and p["at"] is not None and t >= p["at"] - 0.03:
                put(fr, text_spr(p["after"], "Inter-700.ttf", 58, WHITE, shadow=0.45), 540, CY + 330, 1, cl((t - p["at"]) / 0.15) * fade)
            return
        if p["key"] and t >= key_t - 0.04:
            key = p["key"]
            size = 168 if len(key) <= 8 else int(168 * 8 / len(key))
            full = tw(key, "Inter-800.ttf", size)
            x = 540 - full / 2
            for j, ch in enumerate(key):
                tj = key_t + j * 0.035
                if t < tj:
                    break
                k = (t - tj) / 0.16
                spr = text_spr(ch, "Inter-800.ttf", size, grad=(PEACH_HI, PEACH), shadow=0.45)
                cw = tw(ch, "Inter-800.ttf", size)
                put(fr, spr, x + cw / 2, CY + 20 + 18 * (1 - eo(k)), 1, cl(k * 2) * fade)
                x += cw
            # script accent
            if p["extra"] == "script" and p["after"]:
                k = (t - key_t - 0.25) / 0.3
                if k > 0:
                    spr = text_spr(p["after"], "MrsSaintDelafield.ttf", 120, WHITE, shadow=0.4)
                    put(fr, spr, 540 - full / 2 + 40, CY - 40, 1, cl(k * 2) * fade, -6)
            elif p["after"] and p["extra"] == "years" and p["at"] is not None and t >= p["at"] - 0.03:
                put(fr, text_spr(p["after"], "Inter-700.ttf", 58, WHITE, shadow=0.45), 540, CY + 330, 1, cl((t - p["at"]) / 0.15) * fade)
            elif p["after"] and p["at"] is not None and t >= p["at"] - 0.03:
                spr = text_spr(p["after"], "MrsSaintDelafield.ttf", 96, WHITE, shadow=0.4)
                k = (t - p["at"]) / 0.3
                put(fr, spr, 540 + full / 2 - spr.shape[1] / 2 + 40, CY + 110, 1, cl(k * 2) * fade, -4)
            extras(fr, t, p, key_t, fade)
        return


def bubble_row(fr, t, t0, codes, y, fade, r=62):
    n = len(codes)
    for j, c in enumerate(codes):
        k = (t - t0 - j * 0.09) / 0.3
        if k <= 0:
            continue
        x = 540 + (j - (n - 1) / 2) * (r * 2 + 16)
        s = eb(min(k, 1), 2.0)
        put(fr, rounded(r * 2, r * 2, r, (255, 255, 255)), x, y, s, 0.22 * fade)
        put(fr, emoji(c, int(r * 1.5)), x, y, s, fade)


def extras(fr, t, p, key_t, fade):
    e = p["extra"]
    if e == "hosp":
        k = (t - key_t) / 0.35
        put(fr, emoji("1f3e5", 230), 540, CY - 300 - 10 * math.sin(t * 2), eb(min(k, 1)), fade)
    elif e == "coins":
        bubble_row(fr, t, key_t - 0.1, ["1f4b0", "1f4b0", "1f4b0"], CY - 270, fade)
    elif e == "videos":
        bubble_row(fr, t, key_t - 0.1, ["1f4f9", "1f4f1", "1f3ac"], CY - 270, fade)
    elif e == "camera":
        bubble_row(fr, t, key_t - 0.1, ["1f4f9"], CY - 270, fade, 80)
    elif e == "logo":
        k = (t - key_t) / 0.35
        s_ = eb(min(k, 1))
        put(fr, rounded(330, 170, 40, (255, 255, 255)), 540, CY - 330, s_, fade)
        put(fr, LOGO_N, 540, CY - 330, s_ * 0.5, fade)
    elif e == "call":
        bubble_row(fr, t, key_t - 0.1, ["1f4de"], CY - 290, fade, 80)
        k = (t - key_t - 0.3) / 0.3
        if k > 0:
            put(fr, rounded(560, 104, 52, (255, 255, 255)), 540, CY + 200, eb(min(k, 1)), fade)
            put(fr, text_spr("70862 69537", "Inter-800.ttf", 64, INKD, shadow=0), 540, CY + 200, eb(min(k, 1)), fade)
    elif e == "ruler67":
        ruler(fr, t, key_t, [f"{v}%" for v in range(55, 80)], 12, fade)
    elif e == "years":
        ruler(fr, t, key_t, [str(y) for y in range(2012, 2027)], 13, fade, big=False)


def ruler(fr, t, t0, labels, target, fade, big=True):
    """ref17 timeline: labels slide right->left and settle with the target centred, bigger and peach."""
    k = eo((t - t0 + 0.05) / 0.9)
    pos = target * k               # index at centre
    sp = 300 if big else 250
    y = CY + 190
    mg.line(fr, (40, y + 50), (1040, y + 50), 4, WHITE, 0.8 * fade)
    for j, lab in enumerate(labels):
        x = 540 + (j - pos) * sp
        if not (-150 < x < 1230):
            continue
        cen = 1 - min(1, abs(j - pos))
        size = int(64 + (110 if big else 26) * cen)
        col = PEACH_HI if cen > 0.6 else WHITE
        spr = text_spr(lab, "Inter-600.ttf", size, col, shadow=0.35)
        put(fr, spr, x, y - 10 - (40 * cen if big else 0), 1, (0.55 + 0.45 * cen) * fade)
        mg.line(fr, (x, y + 30), (x, y + 70), 4, WHITE, 0.8 * fade)
        mg.line(fr, (x + sp / 2, y + 40), (x + sp / 2, y + 60), 3, WHITE, 0.5 * fade)


# ------------------------------------------------------------------ full-screen scenes
def blur_in(spr, k):
    """ref17 ghost entry: soft blur + fade"""
    if k >= 1:
        return spr
    r = int(18 * (1 - k)) * 2 + 1
    return cv2.GaussianBlur(spr, (r, r), 0) if r > 1 else spr


def three_d_text(text, size, colour=(58, 48, 48), depth=14):
    k = ("3d", text, size, depth)
    if k in _tc:
        return _tc[k]
    base = text_spr(text, "Anton-Regular.ttf", size, colour, shadow=0)
    shade = text_spr(text, "Anton-Regular.ttf", size, (120, 70, 55), shadow=0)
    h, w = base.shape[:2]
    out = np.zeros((h + depth * 3 + 40, w + depth * 3 + 40, 4), np.float32)
    soft = cv2.GaussianBlur(base[..., 3], (0, 0), 14)
    out[20 + depth * 2:20 + depth * 2 + h, 20 + depth * 2:20 + depth * 2 + w, 3] += soft * 0.35
    for d in range(depth, 0, -1):
        sub = out[20 + d:20 + d + h, 20 + d:20 + d + w]
        al = shade[..., 3:4]
        sub[..., :3] = sub[..., :3] * (1 - al) + shade[..., :3]
        sub[..., 3:4] = np.maximum(sub[..., 3:4], al)
    sub = out[20:20 + h, 20:20 + w]
    al = base[..., 3:4]
    sub[..., :3] = sub[..., :3] * (1 - al) + base[..., :3]
    sub[..., 3:4] = np.maximum(sub[..., 3:4], al)
    _tc[k] = out
    return out


def scene_pandey(fr, t, t0, t1):
    fr[:] = BGS["chev"]
    u = t - t0
    # hero: 3D doctor, ghost blur-in, gentle float
    k = cl(u / 0.45)
    doc = emoji("1f468-200d-2695-fe0f", 640)
    put(fr, blur_in(doc, k), 540, 1180 + 12 * math.sin(u * 2), 0.92 + 0.08 * eo(k), k)
    # small lead-in words + big 3D name typed letter by letter
    put(fr, text_spr("suddenly", "Inter-600.ttf", 52, INKD, shadow=0), 300, 470, 1, cl((t - 14.04) / 0.2))
    name = "PANDEY"
    tt = 14.42
    shown = name[:max(0, min(len(name), int((t - tt) / 0.07) + 1))] if t >= tt else ""
    if shown:
        spr = three_d_text(shown, 250)
        put(fr, spr, 540 - (three_d_text(name, 250).shape[1] - spr.shape[1]) / 2, 640, 1, 1)
    if t > 14.5:
        put(fr, text_spr("Dr.", "MrsSaintDelafield.ttf", 170, (150, 40, 32), shadow=0), 820, 540, 1, cl((t - 14.5) / 0.3), -10)
    if t > 15.88:
        put(fr, text_spr("opens a", "Inter-600.ttf", 52, INKD, shadow=0), 360, 820, 1, cl((t - 15.88) / 0.2))
        put(fr, text_spr("small clinic", "MrsSaintDelafield.ttf", 130, (160, 50, 40), shadow=0), 640, 830, 1, cl((t - 16.46) / 0.3), -5)
    if t > 16.4:
        k2 = (t - 16.4) / 0.4
        put(fr, emoji("1f3e5", 260), 860, 1430 + 8 * math.sin(u * 2.5), eb(min(k2, 1)), 1)


def scene_queue(fr, t, t0, t1):
    fr[:] = BGS["peach"]
    u = t - t0
    # coral wave line
    pts = [(x, 1260 + 70 * math.sin(x / 300 + u * 0.8)) for x in range(-20, 1110, 20)]
    from mgx import polyline
    polyline(fr, pts, 26, (244, 140, 110), 0.9)
    # clinic card on the left
    k = cl(u / 0.4)
    card = rounded(380, 440, 30, (255, 247, 238), border=(245, 165, 92), bw=12)
    cy = 1260 + 70 * math.sin(230 / 300 + u * 0.8) - 230
    put(fr, card, 230, cy, 0.9 + 0.1 * eo(k), k)
    put(fr, emoji("1f3e5", 250), 230, cy - 40, 0.9 + 0.1 * eo(k), k)
    put(fr, text_spr("Dr. Pandey", "Inter-700.ttf", 46, INKD, shadow=0), 230, cy + 160, 1, k)
    # people bubbles arriving along the wave
    codes = ["1f9d1", "1f468-200d-2695-fe0f", "1f9d1", "1f465", "1f9d1", "1f465"]
    codes = ["1f468", "1f469", "1f474", "1f9d4", "1f475", "1f466"]
    for j, c in enumerate(codes):
        tj = t0 + 0.2 + j * 0.28
        if t < tj:
            continue
        kk = eo((t - tj) / 0.7)
        xt = 470 + j * 150
        x = 1250 + (xt - 1250) * kk
        y = 1260 + 70 * math.sin(x / 300 + u * 0.8) - 90
        put(fr, rounded(150, 150, 75, (255, 255, 255)), x, y, 1, 0.6)
        put(fr, emoji(c, 120), x, y - 4 + 4 * math.sin(t * 6 + j), 1, 1)
    # headline
    put(fr, text_spr("a large", "Inter-600.ttf", 56, INKD, shadow=0), 540, 470, 1, cl((t - 22.74) / 0.2))
    if t > 23.16:
        spr = three_d_text("QUEUE", 240)
        k3 = (t - 23.16) / 0.3
        put(fr, spr, 540, 640, 0.9 + 0.1 * eo(k3), cl(k3 * 2))
    if t > 23.7:
        put(fr, text_spr("of patients outside his clinic", "MrsSaintDelafield.ttf", 96, (160, 50, 40), shadow=0), 540, 800, 1, cl((t - 23.7) / 0.4), -3)


def scene_spot(fr, t, t0, t1):
    fr[:] = BGS["dark"]
    targets = [(27.99, "building-2", -90, "INFRASTRUCTURE"), (28.73, "users", 0, "MANPOWER"), (29.73, "settings", 90, "FACILITIES")]
    cx, cy = 540, 900
    # current target + swing
    ang = targets[0][2] - 60
    cur = -1
    for j, (tt, _, a, _) in enumerate(targets):
        if t >= tt - 0.25:
            prev = targets[j - 1][2] if j else targets[0][2] - 60
            k = eio((t - tt + 0.25) / 0.45)
            ang = prev + (a - prev) * k
            cur = j
    if t < targets[0][0] - 0.25:
        ang = -150 + 60 * eio((t - t0) / 0.4)
    # cone
    L = 330
    cone = _cone()
    M = cv2.getRotationMatrix2D((cone.shape[1] / 2, cone.shape[0] / 2), -ang, 1.0)
    rc = cv2.warpAffine(cone, M, (cone.shape[1], cone.shape[0]))
    put(fr, rc, cx, cy, 1, 0.95)
    put(fr, rounded(130, 130, 65, (255, 255, 255)), cx, cy, 1, 1)
    for j, (tt, name, a, label) in enumerate(targets):
        x, y = cx + L * math.cos(math.radians(a)), cy + L * math.sin(math.radians(a))
        lit = 1.0 if j == cur else 0.22
        if t < tt - 0.3 and j != cur:
            lit = 0.12
        put(fr, icon(name, 120, (255, 255, 255), 1.8), x, y, 1, lit)
        if j == cur:
            k = (t - tt) / 0.25
            put(fr, text_spr(label, "Inter-700.ttf", 46, WHITE, shadow=0.3), cx, 1500, 1, cl(k * 2))
    put(fr, text_spr("you have better", "Inter-600.ttf", 52, (230, 230, 230), shadow=0), cx, 420, 1, cl((t - t0) / 0.3))


_cone_c = None


def _cone():
    global _cone_c
    if _cone_c is None:
        S = 760
        m = np.zeros((S, S), np.float32)
        c = S // 2
        pts = np.array([[c, c], [c + 330, c - 130], [c + 330, c + 130]], np.int32)
        cv2.fillConvexPoly(m, pts, 1.0, cv2.LINE_AA)
        xx = np.arange(S, dtype=np.float32)[None, :]
        m *= np.clip(1 - (xx - c) / 360, 0, 1) ** 0.8
        m = cv2.GaussianBlur(m, (0, 0), 6)
        _cone_c = np.dstack([m * 255, m * 255, m * 255, m]).astype(np.float32)
    return _cone_c


WRITE = [(38.29, "he is stealing"), (39.01, "your"), (39.63, "future")]


def scene_write(fr, t, t0, t1):
    fr[:] = BGS["peach"]
    lines = [("he is stealing", 820, 38.29, 39.0), ("your future", 1040, 39.01, 40.0)]
    for txt, y, ta, tb in lines:
        spr = text_spr(txt, "MrsSaintDelafield.ttf", 190, (44, 30, 30), shadow=0)
        h, w = spr.shape[:2]
        p = cl((t - ta) / (tb - ta))
        if p <= 0:
            continue
        xs = np.arange(w, dtype=np.float32)
        mask = np.clip((p * w * 1.05 - xs) / 40, 0, 1)[None, :, None]
        put(fr, spr * mask, 540, y, 1, 1, -3)
    if t > 39.75:
        k = eo((t - 39.75) / 0.35)
        w2 = text_spr("future", "MrsSaintDelafield.ttf", 190, (44, 30, 30), shadow=0).shape[1]
        x0 = 540 + 10
        mg.line(fr, (x0, 1125), (x0 + w2 * 0.9 * k, 1110), 11, RED, 1)
    if t > t1 - 0.32:
        k = (t - (t1 - 0.32)) / 0.32
        mg.ring(fr, 540, 960, 80 + 1100 * eo(k), 14, WHITE, 0.9 * (1 - k))


CARDS = [(43.29, "1f3ac", "Creative Content"), (45.15, "1f3af", "Performance Marketing"), (47.39, "1f4c8", "Grow Online")]


def scene_cards(fr, t, t0, t1):
    fr[:] = BGS["peach"]
    u = t - t0
    from mgx import polyline
    pts = [(x, 1150 - 170 * math.sin(math.pi * x / 1080) + 10 * math.sin(u * 2)) for x in range(-20, 1110, 20)]
    polyline(fr, pts, 30, (244, 140, 110), 0.9)
    put(fr, text_spr("we do", "Inter-600.ttf", 54, INKD, shadow=0), 540, 420, 1, cl(u / 0.3))
    for j, (tt, code, label) in enumerate(CARDS):
        nxt = CARDS[j + 1][0] if j + 1 < len(CARDS) else 99
        if t < tt - 0.35:
            continue
        kin = eo((t - tt + 0.35) / 0.5)
        kout = eio((t - nxt + 0.3) / 0.5) if t > nxt - 0.3 else 0
        x = 1400 - 860 * kin - 900 * kout
        y = 930 + 14 * math.sin(t * 2.2 + j)
        card = rounded(580, 690, 40, (255, 247, 238), border=(245, 165, 92), bw=14)
        rot = (1 - kin) * 8 - kout * 6
        put(fr, card, x, y, 1, 1, rot)
        put(fr, rounded(500, 450, 26, (255, 226, 205)), x, y - 75, 1, 1, rot)
        put(fr, emoji(code, 340), x, y - 75 + 6 * math.sin(t * 3), 1, 1, rot)
        put(fr, text_spr(label, "Inter-700.ttf", 54 if len(label) < 16 else 46, INKD, shadow=0), x, y + 250, 1, 1, rot)
    if t > 46.99:
        put(fr, text_spr("we help businesses grow online", "Inter-700.ttf", 58, INKD, shadow=0), 540, 1460, 1, cl((t - 46.99) / 0.3))


SCENES = {"pandey": scene_pandey, "queue": scene_queue, "spot": scene_spot, "write": scene_write, "cards": scene_cards}


# ------------------------------------------------------------------ transitions, hook, watermark, outro
def leak(fr, t, t0, colour, d=0.36):
    k = (t - t0) / d
    if not (0 <= k <= 1):
        return
    a = math.sin(math.pi * k)
    yy, xx = np.ogrid[0:H:4, 0:W:4]
    cx = 540 + 500 * (k - 0.5)
    g = np.exp(-(((xx - cx) / 520.0) ** 2 + ((yy - 1100) / 700.0) ** 2)).astype(np.float32)
    g = cv2.resize(g, (W, H))[..., None]
    fr += g * np.array(colour, np.float32) * a * 0.6
    fr *= (1 - 0.08 * a)


def hook(fr, head, t):
    """0-1.25 s: talking head inside a rounded card on peach, 3D emoji faces floating; expands to full."""
    k = eio((t - 0.95) / 0.32)
    if k >= 1:
        fr[:] = head
        return
    fr[:] = BGS["peach"]
    s = 0.66 + 0.34 * k
    cw, ch = int(W * s), int(H * s)
    small = cv2.resize(head, (cw, ch), interpolation=cv2.INTER_AREA)
    r = int(46 * (1 - k)) + 2
    m = np.zeros((ch, cw), np.float32)
    cv2.rectangle(m, (r, 0), (cw - r, ch), 1, -1); cv2.rectangle(m, (0, r), (cw, ch - r), 1, -1)
    for (x, y) in [(r, r), (cw - r, r), (r, ch - r), (cw - r, ch - r)]:
        cv2.circle(m, (x, y), r, 1, -1, cv2.LINE_AA)
    cx, cy = int(540 + 40 * (1 - k)), int(960)
    x0, y0 = cx - cw // 2, cy - ch // 2
    X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x0 + cw), min(H, y0 + ch)
    sub = small[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]; mm = m[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0, None]
    # card shadow
    sh = np.zeros((H, W), np.float32); sh[Y0 + 20:Y1 + 20, X0 + 10:X1 + 10] = 1
    sh = cv2.GaussianBlur(sh, (0, 0), 28)[..., None] * 0.35
    fr[:] = fr * (1 - sh)
    fr[Y0:Y1, X0:X1] = fr[Y0:Y1, X0:X1] * (1 - mm) + sub * mm
    faces = [("1f914", 110, 330, 300), ("1f928", 900, 270, 260), ("1f615", 120, 1560, 280), ("1f62e", 930, 1620, 300), ("1f914", 860, 1000, 210)]
    for j, (c, x, y, sz) in enumerate(faces):
        a = (1 - k)
        put(fr, emoji(c, sz), x + 20 * math.sin(t * 1.5 + j), y + 25 * math.sin(t * 1.2 + j * 2), 1 + 0.05 * math.sin(t * 2 + j), a, 10 * math.sin(t + j))


def watermark(fr, t):
    if t > 57.4:
        return
    put(fr, ig_glyph(46), 1010, 262, 1, 0.92)
    put(fr, text_spr("@FRAMEANDFAME.IN_", "BebasNeue-Regular.ttf", 34, WHITE, shadow=0.3), 905, 318, 1, 0.85)


def outro(fr, t):
    k = eio((t - 57.4) / 0.5)
    fr *= (1 - 0.72 * k)
    if t < 57.6:
        return
    a = cl((t - 57.6) / 0.25)
    g = cl((t - 58.2) / 0.8)
    put(fr, ig_glyph(190), 540, 860, 1 + 0.06 * (1 - eo(a)), a * (1 - g))
    put(fr, ig_glyph(190, "grad"), 540, 860, 1, a * g)
    put(fr, text_spr("@FRAMEANDFAME.IN_", "BebasNeue-Regular.ttf", 96, WHITE, shadow=0.3), 540, 1040, 1, a)
    put(fr, text_spr("70862 69537  ·  frameandfame.in", "Inter-600.ttf", 44, (235, 220, 210), shadow=0), 540, 1130, 1, cl((t - 58.4) / 0.3))


# ------------------------------------------------------------------ frame
LOGO = None
LOGO_N = None


def init():
    global LUT, GLOW, SHADE, PT, LOGO
    LUT = build_luts()
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    g = np.exp(-(((xx - 1000) / 520) ** 2 + ((yy - 300) / 700) ** 2))[..., None]
    GLOW = g * np.array((18, 8, 0), np.float32)
    SHADE = lower_shade()
    PT = phrase_times()
    BGS["peach"] = peach_bg(); BGS["chev"] = chevron_bg(); BGS["dark"] = dark_bg()
    lg = np.array(Image.open(os.path.join(AS, "brand", "ff_logo.png")).convert("RGB")).astype(np.float32)
    navy = np.array((6, 20, 54), np.float32)
    a = np.clip((np.abs(lg - navy[::-1] * 0 - navy).max(2) - 40) / 60, 0, 1)
    LOGO = np.dstack([lg * a[..., None], a]).astype(np.float32)
    # navy version for light badges: white letters -> navy, blue & stays
    wht = (lg.min(2) > 150)[..., None]
    lgn = np.where(wht, navy, lg)
    global LOGO_N
    LOGO_N = np.dstack([lgn * a[..., None], a]).astype(np.float32)


def compose(t, base):
    head = head_frame(base, t)
    fr = head.copy()
    if t < 1.3:
        hook(fr, head, t)
    sc = None
    for a, b, name in FS:
        if a <= t < b:
            sc = (a, b, name)
    if sc:
        SCENES[sc[2]](fr, t, sc[0], sc[1])
        # blur-dissolve in from the talking head
        k = (t - sc[0]) / 0.22
        if k < 1:
            fr[:] = fr * eo(k) + cv2.GaussianBlur(head, (0, 0), 12) * (1 - eo(k))
    else:
        draw_caption(fr, t)
    # light leaks on every scene boundary (orange in, green back to the face)
    for a, b, _ in FS:
        leak(fr, t, a - 0.12, (255, 130, 70))
        leak(fr, t, b - 0.10, (70, 235, 150))
    leak(fr, t, 7.44, (255, 130, 70))
    leak(fr, t, 25.15, (255, 130, 70))
    watermark(fr, t)
    if t >= 57.4:
        outro(fr, t)
    return np.clip(fr, 0, 255).astype(np.uint8)[..., ::-1]


def frames_iter(lo, hi):
    cap = cv2.VideoCapture(os.path.join(HERE, "work", "base60.mp4"))
    nb = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, min(lo * 2, nb - 1))
    last = None
    pos = min(lo * 2, nb - 1)
    for i in range(lo, hi):
        want = min(i * 2, nb - 1)
        while pos <= want:
            ok, f = cap.read()
            if ok:
                last = f
            pos += 1
        yield i, last


if __name__ == "__main__":
    a = sys.argv[1:]
    init()
    if "--stills" in a:
        cap = cv2.VideoCapture(os.path.join(HERE, "work", "base60.mp4"))
        for t in [float(x) for x in a[a.index("--stills") + 1:]]:
            cap.set(cv2.CAP_PROP_POS_FRAMES, min(int(t * 60), 3524))
            ok, f = cap.read()
            cv2.imwrite(os.path.join(HERE, "work", f"v7_{t:05.2f}.jpg"), compose(t, f), [cv2.IMWRITE_JPEG_QUALITY, 88])
        sys.exit()
    k, n = (int(a[a.index("--part") + 1]), int(a[a.index("--part") + 2])) if "--part" in a else (0, 1)
    total = int(END * FPS); lo, hi = total * k // n, total * (k + 1) // n
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p",
                            os.path.join(HERE, "work", f"v7_part{k}.mp4")], stdin=subprocess.PIPE)
    for i, f in frames_iter(lo, hi):
        enc.stdin.write(compose(i / FPS, f).tobytes())
    enc.stdin.close(); enc.wait()
