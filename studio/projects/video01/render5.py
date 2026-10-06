#!/usr/bin/env python3
"""video01 v5 — fresh edit from references/PATTERN_LIBRARY.md (training day 2026-10-06).

House style (own01/own02): instant jump cuts alternating wide <-> punch-in, moody warm relit grade,
small white word-by-word captions with a big yellow keyword, bottom darkening, dense hook.
Motion-graphics target (ref16): story told in a duotone F&F-blue world — 3D dioramas recoloured,
radial gradient studio background, typed condensed-caps word ladders + light italic connectives,
pixel-dissolve, slow drift, orbit ring. Typography play (ref14/ref10/ref15): giant keyword split
behind his head. Premium (ref12): speaker shrinks into a circle for the brand moment.

ALL TIMES ARE OUT-TIME (seconds on the cut timeline; see work/words_out.txt).
Usage: render5.py [--end S] [--stills t1 t2 ...]
"""
import math, os, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import render2 as R

W, H, FPS = 1080, 1920, 60
END = 59.9
F = "../../assets/fonts"
ANTON, BEBAS = f"{F}/Anton-Regular.ttf", f"{F}/BebasNeue-Regular.ttf"
ITAL, ITAL_M = f"{F}/Inter-LightItalic.ttf", f"{F}/Inter-MediumItalic.ttf"
CAP, CAP_B = f"{F}/Poppins-600.ttf", f"{F}/Poppins-800.ttf"
YELLOW, RED, WHITE = (242, 212, 61), (232, 32, 42), (255, 255, 255)
NAVY, BLUE = (14, 26, 80), (40, 120, 254)
eo, eio, eb = R.ease_out, R.ease_io, R.ease_back
cl = R.clamp01

# ------------------------------------------------------------------ shots (jump cuts)
# (start, zoom, push_per_second)
SHOTS = [(0.00, 1.18, 0), (1.24, 1.00, 0), (2.94, 1.00, 0), (5.10, 1.00, 0), (7.54, 1.15, 0), (9.28, 1.00, 0),
         (11.06, 1.20, 0), (12.44, 1.00, 0), (14.04, 1.26, 0), (19.08, 1.22, 0), (25.25, 1.22, 0), (27.65, 1.00, 0),
         (30.75, 1.18, 0), (32.19, 1.00, 0), (35.58, 1.00, 0), (36.69, 1.10, 0.058), (40.52, 1.00, 0),
         (42.69, 1.00, 0), (44.87, 1.18, 0), (46.39, 1.00, 0), (49.45, 1.20, 0), (51.29, 1.00, 0),
         (52.27, 1.15, 0), (53.71, 1.00, 0), (99, 1, 0)]
FACE_X = np.load("work/face_x.npy")
FACE_Y = 0.352 * H


def zoom_at(t):
    for (a, z, p), (b, _, _) in zip(SHOTS, SHOTS[1:]):
        if a <= t < b:
            return z + p * (t - a)
    return 1.0


def frame_cam(fr, mk, i, t):
    z = zoom_at(t)
    fx = FACE_X[min(i, len(FACE_X) - 1)]
    d = (0.48 - fx) * W
    z = max(z, min(1.28, 1 + abs(d) * 2 / W * 0.8))
    cx, cy = R.FACE
    sx = min(max(d, (W - cx) * (1 - z)), cx * (z - 1)); sy = 0.0
    sy = min(max(sy, (H - cy) * (1 - z)), cy * (z - 1))
    return R.warp(fr, z, sy, sx, 0), R.warp(mk, z, sy, sx, 0, border=cv2.BORDER_CONSTANT)


# ------------------------------------------------------------------ grade (relight: face bright, room dark & cool)
def lut():
    x = np.arange(256, dtype=np.float32) / 255
    s = x * x * (3 - 2 * x)
    y = 0.72 * x + 0.28 * s
    mid = 4 * x * (1 - x); sh = (1 - x) ** 2
    r = y + 0.028 * mid; g = y + 0.006 * mid + 0.004 * sh; b = y - 0.026 * mid + 0.022 * sh
    to8 = lambda c: np.clip(c * 255, 0, 255).astype(np.uint8)
    return to8(b), to8(g), to8(r)


LB, LG, LR = lut()
yy = np.arange(H, dtype=np.float32)[:, None] / H
xx = np.arange(W, dtype=np.float32)[None, :] / W
VIGN = np.clip(1 - 0.55 * (((xx - 0.5) / 0.75) ** 2 + ((yy - 0.38) / 0.80) ** 2), 0.45, 1)[..., None]
BOTTOM = (np.clip((yy - 0.62) / 0.30, 0, 1) ** 1.4 * 0.88)[..., None]
GRAIN = [np.random.default_rng(k).normal(0, 3.0, (H // 2, W // 2)).astype(np.float32) for k in range(8)]


def grade(img, m):
    f = img.astype(np.float32)
    m3 = cv2.GaussianBlur(m, (0, 0), 6)[..., None]
    subj = f * 1.12
    small = cv2.resize(f, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    bg = cv2.resize(cv2.GaussianBlur(small, (0, 0), 1.6), (W, H)) * 0.40
    bl = bg @ np.float32([0.114, 0.587, 0.299])
    bg = bl[..., None] + (bg - bl[..., None]) * 0.70 + np.float32([6, 2, -2])     # cool, desaturated room
    out = np.clip(subj * m3 + bg * (1 - m3), 0, 255).astype(np.uint8)
    b, g, r = cv2.split(out)
    out = cv2.merge([cv2.LUT(b, LB), cv2.LUT(g, LG), cv2.LUT(r, LR)]).astype(np.float32)
    lum = out @ np.float32([0.114, 0.587, 0.299])
    return lum[..., None] + (out - lum[..., None]) * 1.12


# ------------------------------------------------------------------ text helpers
_fc = {}


def font(p, s):
    if (p, s) not in _fc:
        _fc[(p, s)] = ImageFont.truetype(p, s)
    return _fc[(p, s)]


def txt(s, path, size, fill, shadow=0, track=0):
    f = font(path, size)
    l, t, r, b = f.getbbox(s)
    pad = 24
    w = int(r - l + 2 * pad + track * max(0, len(s) - 1)); h = int(b - t + 2 * pad)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x = pad - l
    if track:
        for ch in s:
            d.text((x, pad - t), ch, font=f, fill=fill); x += f.getlength(ch) + track
    else:
        d.text((x, pad - t), s, font=f, fill=fill)
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh.putalpha(im.getchannel("A").point(lambda v: v * shadow // 255))
        sh = sh.filter(ImageFilter.GaussianBlur(10))
        o = Image.new("RGBA", (w, h + 6), (0, 0, 0, 0)); o.alpha_composite(sh, (0, 6)); o.alpha_composite(im); im = o
    a = np.array(im).astype(np.float32)
    return a[..., [2, 1, 0]], a[..., 3:4] / 255.0


_tc = {}


def put(img, s, path, size, fill, cx, cy, alpha=1.0, scale=1.0, shadow=0, under=None, anchor="c", track=0):
    key = (s, path, size, fill, shadow, track)
    if key not in _tc:
        _tc[key] = txt(s, path, size, fill, shadow, track)
    rgb, a = _tc[key]
    w = rgb.shape[1] * scale
    if anchor == "l":
        cx = cx + w / 2
    elif anchor == "r":
        cx = cx - w / 2
    R.place(img, rgb, a, cx, cy, scale, alpha, under)
    return w


def typed(word, t, t0, t1):
    """letters appear one by one over the spoken duration of the word"""
    if t < t0:
        return ""
    n = len(word)
    k = int(math.ceil(n * cl((t - t0) / max(0.12, (t1 - t0) * 0.85))))
    return word[:max(1, k)]


# ------------------------------------------------------------------ duotone world (ref16)
def world_bg():
    d = np.sqrt(((xx - 0.5) / 0.62) ** 2 + ((yy - 0.47) / 0.55) ** 2)
    k = np.clip(d, 0, 1) ** 1.35
    c0, c1 = np.float32([255, 244, 236]), np.float32([226, 104, 34])          # BGR: near-white lavender-blue -> F&F blue
    return (c0 * (1 - k[..., None]) + c1 * k[..., None]).astype(np.float32)


WORLD = world_bg()
DUO_D, DUO_L = np.float32([60, 16, 6]), np.float32([255, 252, 250])          # BGR navy -> white


def duotone(bgr):
    L = (bgr.astype(np.float32) @ np.float32([0.114, 0.587, 0.299])) / 255
    L = np.clip((L - 0.18) / 0.62, 0, 1)
    L = L * L * (3 - 2 * L)                                                     # strong S-curve: real blacks & whites
    mid = (4 * L * (1 - L))[..., None]
    col = DUO_D * (1 - L[..., None]) + DUO_L * L[..., None]
    return col * (1 - 0.22 * mid) + np.float32([254, 120, 40]) * 0.22 * mid


def mosaic(rgb, a, block):
    if block <= 1:
        return rgb, a
    h, w = rgb.shape[:2]
    sw, sh = max(1, w // block), max(1, h // block)
    r2 = cv2.resize(cv2.resize(rgb, (sw, sh), interpolation=cv2.INTER_AREA), (w, h), interpolation=cv2.INTER_NEAREST)
    a2 = cv2.resize(cv2.resize(a, (sw, sh), interpolation=cv2.INTER_AREA), (w, h), interpolation=cv2.INTER_NEAREST)
    return r2, a2.reshape(h, w, 1)


class Scene:
    """Full-screen cutaway: duotone 3D diorama + typed word ladder.
    words: list of (text, style, x, y, anchor, t0, t1) — style 'B' big Anton, 'b' medium Anton, 'i' light italic."""
    def __init__(self, name, t0, t1, nframes, words, hero_y=0.51, hero_w=1450):
        self.name, self.t0, self.t1, self.n, self.words = name, t0, t1, nframes, words
        self.hero_y, self.hero_w = hero_y, hero_w

    def hero(self, t):
        u = (t - self.t0) / (self.t1 - self.t0)
        f = 1 + int(round(cl(u) * (self.n - 1)))
        p = f"3d/renders/{self.name}/f_{f:04d}.png"
        if not os.path.exists(p):
            return None, None
        im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
        h = int(self.hero_w * im.shape[0] / im.shape[1])
        im = cv2.resize(im, (self.hero_w, h), interpolation=cv2.INTER_CUBIC).astype(np.float32)
        return duotone(im[..., :3]), im[..., 3:4] / 255.0

    def draw(self, t, prev_scene=None):
        img = WORLD.copy()
        u = t - self.t0
        # dotted orbit ring under the hero, slowly rotating
        ring = np.zeros((H, W), np.float32)
        cxr, cyr = W // 2, int(self.hero_y * H + 150)
        for k in range(48):
            a0 = 2 * math.pi * k / 48 + u * 0.35
            if k % 2:
                continue
            p1 = (int(cxr + 470 * math.cos(a0)), int(cyr + 120 * math.sin(a0)))
            p2 = (int(cxr + 470 * math.cos(a0 + 0.07)), int(cyr + 120 * math.sin(a0 + 0.07)))
            cv2.line(ring, p1, p2, 1.0, 3, cv2.LINE_AA)
        ra = (ring * 0.55 * eo(u / 0.4))[..., None]
        img = img * (1 - ra) + np.float32([255, 255, 255]) * ra
        rgb, a = self.hero(t)
        if rgb is not None:
            k_in = cl(u / 0.28)
            block = int(48 * (1 - eo(k_in))) + 1                                  # pixel dissolve in
            rgb, a = mosaic(rgb, a, block)
            s = 0.94 + 0.08 * cl(u / (self.t1 - self.t0))                          # slow drift / push
            fl = 10 * math.sin(u * 1.6)
            # soft contact shadow
            sh = cv2.GaussianBlur(a[..., 0], (0, 0), 22) * 0.35
            R.place(img, np.zeros_like(rgb), sh[..., None], W / 2, self.hero_y * H + 40, s * 1.02, eo(k_in))
            R.place(img, rgb, a, W / 2, self.hero_y * H + fl, s, eo(k_in))
        for (w, style, x, y, anc, w0, w1) in self.words:
            shown = typed(w, t, w0, w1) if style != "i" else (w if t >= w0 else "")
            if not shown:
                continue
            al = eo((t - w0) / 0.12)
            if style == "B":
                put(img, shown, ANTON, 150, NAVY, x * W, y * H, al, anchor=anc)
            elif style == "b":
                put(img, shown, ANTON, 104, NAVY, x * W, y * H, al, anchor=anc)
            else:
                put(img, shown, ITAL, 44, NAVY, x * W, y * H, al, anchor=anc)
        return img


def wl(spec):
    """parse ladder spec: list of (text, style, x, y, anchor, word_index_start, word_index_end)"""
    return [(s, st, x, y, a, WT[i0][0], WT[i1][1]) for s, st, x, y, a, i0, i1 in spec]


WT = []
for line in open("work/words_out.txt"):
    p = line.split()
    WT.append((float(p[-2]), float(p[-1]), " ".join(p[:-2])))


def wi(word, after=0.0):
    for k, (a, b, w) in enumerate(WT):
        if w == word and a >= after - 0.01:
            return k
    raise KeyError(word)


SCENES = [
    Scene("hospital", 6.16, 7.54, 180, wl([
        ("you have a", "i", 0.12, 0.22, "l", wi("YOU", 6.1), wi("A", 6.4)),
        ("HOSPITAL", "B", 0.12, 0.28, "l", wi("HOSPITAL", 6.4), wi("HOSPITAL", 6.4)),
        ("in your", "i", 0.62, 0.74, "l", wi("IN", 6.8), wi("YOUR", 7.1)),
        ("TOWN", "B", 0.62, 0.80, "l", wi("TOWN", 7.3), wi("TOWN", 7.3))])),
    Scene("doc_walk", 14.42, 17.20, 160, wl([
        ("DR. PANDEY", "B", 0.10, 0.25, "l", wi("DR.", 14.4), wi("PANDEY", 14.7)),
        ("comes to your town", "i", 0.10, 0.31, "l", wi("COMES", 15.1), wi("TOWN", 15.6)),
        ("opens a small", "i", 0.38, 0.72, "l", wi("OPENS", 15.8), wi("SMALL", 16.4)),
        ("CLINIC", "B", 0.38, 0.79, "l", wi("CLINIC", 16.8), wi("CLINIC", 16.8))])),
    Scene("doc_film", 17.20, 19.08, 110, wl([
        ("and he starts making", "i", 0.10, 0.25, "l", wi("AND", 17.1), wi("MAKING", 17.9)),
        ("VIDEO", "B", 0.10, 0.31, "l", wi("VIDEO", 18.2), wi("VIDEO", 18.2)),
        ("EVERY DAY", "b", 0.52, 0.78, "l", wi("EVERY", 18.6), wi("DAY", 18.8))])),
    Scene("owner_out", 20.48, 22.04, 140, wl([
        ("you", "i", 0.14, 0.23, "l", wi("YOU", 20.4), wi("YOU", 20.4)),
        ("STEP OUT", "B", 0.14, 0.29, "l", wi("STEP", 20.6), wi("OUT", 20.7)),
        ("of your", "i", 0.50, 0.73, "l", wi("OF", 21.1), wi("YOUR", 21.3)),
        ("HOSPITAL", "b", 0.50, 0.79, "l", wi("HOSPITAL", 21.3), wi("HOSPITAL", 21.3))])),
    Scene("queue", 22.04, 24.95, 170, wl([
        ("and you see there is a", "i", 0.10, 0.23, "l", wi("AND", 21.7), wi("A", 22.6)),
        ("LARGE QUEUE", "B", 0.10, 0.29, "l", wi("LARGE", 22.7), wi("QUEUE", 23.1)),
        ("of patients outside his", "i", 0.30, 0.73, "l", wi("OF", 23.5), wi("HIS", 24.3)),
        ("CLINIC", "b", 0.30, 0.79, "l", wi("CLINIC", 24.5), wi("CLINIC", 24.5))])),
    Scene("steal", 33.69, 35.30, 120, wl([
        ("he is", "i", 0.12, 0.24, "l", wi("IS", 33.6), wi("IS", 33.6)),
        ("STEALING", "B", 0.12, 0.30, "l", wi("STEALING", 34.1), wi("STEALING", 34.1)),
        ("your", "i", 0.46, 0.73, "l", wi("YOUR", 34.5), wi("YOUR", 34.5)),
        ("CUSTOMERS", "b", 0.46, 0.79, "l", wi("CUSTOMERS", 34.7), wi("CUSTOMERS", 34.7))])),
]

# ------------------------------------------------------------------ talking-head typography
class Depth:
    """Giant word split BEHIND his head (matte) with small words in front (ref14/ref10)."""
    def __init__(self, t0, t1, big, size, colour, small=None, y=0.27, counter=None, glow=False):
        self.t0, self.t1, self.big, self.size, self.col, self.small, self.y, self.counter, self.glow = t0, t1, big, size, colour, small, y, counter, glow
        self.yy = None

    def draw(self, img, t, m):
        if not (self.t0 <= t <= self.t1):
            return False
        u = t - self.t0
        al = min(eo(u / 0.15), eo((self.t1 - t) / 0.18))
        s = 0.80 + 0.20 * eb(u / 0.32)
        big = self.big
        if self.counter:
            big = f"{int(round(self.counter * eo(u / 0.7)))}%"
        y = H * 0.645
        if self.small:
            for k, (sm, dy, dt) in enumerate(self.small):
                if u >= dt:
                    put(img, sm, CAP_B, 60, WHITE, W / 2, y - self.size * 0.52, al * eo((u - dt) / 0.15), shadow=230)
        put(img, big, ANTON, self.size, self.col, W / 2, y, al, s, shadow=200, under=HANDS[0])
        return True


class Ladder:
    """Stacked lines that pop in on their words, split depth: big lines behind head, small in front."""
    def __init__(self, lines, t1, y0=0.20, gap=0.085):
        self.lines, self.t1, self.y0, self.gap = lines, t1, y0, gap
        self.t0 = lines[0][1]
        self.top = None

    def draw(self, img, t, m):
        if not (self.t0 <= t <= self.t1):
            return False
        out = eo((self.t1 - t) / 0.18)
        if self.top is None:
            cols = m[:, int(W * 0.3):int(W * 0.7)].max(1); rows = np.where(cols > 0.5)[0]
            self.top = max(H * 0.17, (rows[0] if len(rows) else H * 0.2) + 20)
        for k, (s, w0, col) in enumerate(self.lines):
            if t < w0:
                continue
            u = t - w0
            y = H * (0.58 + k * 0.072)
            put(img, s, ANTON, 120, col, W / 2 + 40 * (1 - eo(u / 0.2)), y, out * eo(u / 0.15),
                0.9 + 0.1 * eb(u / 0.25), shadow=210, under=HANDS[0])
        return True


def hands(img_bgr_u8, m):
    """Occlusion matte for hands only (skin pixels inside the person matte, below the chin)."""
    hsv = cv2.cvtColor(img_bgr_u8, cv2.COLOR_BGR2HSV)
    skin = cv2.inRange(hsv, (0, 40, 60), (25, 200, 255)).astype(np.float32) / 255
    skin = cv2.morphologyEx(skin, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    bin_ = ((skin * m) > 0.5).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(cv2.resize(bin_, (W // 4, H // 4), interpolation=cv2.INTER_NEAREST))
    keep = np.zeros(n, np.uint8)
    for k in range(1, n):
        x, y, w, h, area = stats[k]
        if area > 150 and y * 4 > H * 0.42:          # not connected to the face/neck (which starts higher up)
            keep[k] = 1
    hm = cv2.resize(keep[lab].astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR) * bin_
    return cv2.GaussianBlur(hm.astype(np.float32), (0, 0), 3)


def T(word, after):
    return WT[wi(word, after)][0]


TYPE = [
    Depth(T("67%", 2.9), 5.08, "67%", 380, YELLOW, small=[("OF YOUR PROBLEMS", 230, 1.3)], y=0.25, counter=67),
    Depth(T("YEARS", 9.6), 11.05, "EFFORT", 260, WHITE, small=[("YEARS OF", -150, 0.0)], y=0.27),
    Depth(T("DREAM", 13.0), 14.03, "DREAM", 280, YELLOW, small=[("A BIG", -165, 0.0)], y=0.27, glow=True),
    Ladder([("BETTER", T("BETTER", 27.9), WHITE), ("INFRASTRUCTURE", T("INFRASTRUCTURE", 28.1), YELLOW), ("MORE MANPOWER", T("MANPOWER", 29.1), YELLOW),
            ("MORE FACILITIES", T("FACILITIES", 30.2), WHITE)], 30.74, y0=0.17, gap=0.09),
    Depth(T("CAMERA", 32.8), 33.68, "JUST A CAMERA", 160, YELLOW, y=0.20),
    Depth(T("FUTURE", 39.6), 40.50, "FUTURE", 270, RED, small=[("STEALING YOUR", -170, -0.35)], y=0.27),
    Ladder([("CREATIVE CONTENT", T("CREATIVE", 43.2), WHITE), ("MARKETING", T("MARKETING", 44.3), YELLOW)], 44.86, y0=0.19, gap=0.09),
    Ladder([("PERFORMANCE", T("PERFORMANCE", 45.1), YELLOW), ("MARKETING", T("MARKETING", 45.5), WHITE)], 46.38, y0=0.19, gap=0.09),
    Depth(T("GROW", 47.9), 49.40, "GROW ONLINE", 170, WHITE, y=0.21),
]
HOOK = (0.0, 1.24)
HANDS = [None]   # own01 hook title

# ------------------------------------------------------------------ captions (house: own01/own02)
PHR = [l.strip() for l in """If you have any business
then this video is going to solve
67% of your problems
let's say for example
you have a hospital in your town
you have put your money in
you have years of effort in that business
and more than anything
you have a big dream out of it
suddenly Dr. Pandey comes to your town
opens a small clinic
and he starts making video every day
and suddenly someday
you step out of your hospital
and you see there is a large queue
of patients outside his clinic
now this might sound so rubbish to you
you have better infrastructure
more manpower more facilities
is still that guy
with just a camera and videos
is stealing your customers
if that is your case
he is not just stealing your customers
he is stealing your future
we are F&F
we are a marketing agency
we do creative content marketing
plus performance marketing
so we help businesses grow online
so this evening I'm totally free
give us a call
we are ready to take your call
we have planned for your business
if that works for you
see you soon""".split("\n")]
KEY = {"business", "67%", "example", "money", "effort", "dream", "suddenly", "clinic", "video", "someday", "hospital", "queue",
       "rubbish", "infrastructure", "facilities", "guy", "camera", "customers", "case", "future", "F&F", "agency", "creative",
       "performance", "online", "free", "call", "planned", "soon"}
CAPS = []
_i = 0
for line in PHR:
    ws = line.split()
    seg = WT[_i:_i + len(ws)]; _i += len(ws)
    kidx = max([k for k, w in enumerate(ws) if w.strip(",.").lower() in {x.lower() for x in KEY}] or [None]) if any(w.strip(",.").lower() in {x.lower() for x in KEY} for w in ws) else None
    CAPS.append((seg[0][0], seg[-1][1], ws, [s[0] for s in seg], kidx))
assert _i == len(WT), (_i, len(WT))


def caption(img, t):
    cur = None
    for k, (a, b, ws, starts, kidx) in enumerate(CAPS):
        nxt = CAPS[k + 1][0] if k + 1 < len(CAPS) else b + 0.5
        if a - 0.02 <= t < min(nxt, b + 0.35):
            cur = (ws, starts, kidx)
    if cur is None:
        return
    ws, starts, kidx = cur
    small = [w for k, w in enumerate(ws) if k != kidx and t >= starts[k] - 0.02]
    order = [k for k in range(len(ws)) if k != kidx]
    line1 = " ".join(ws[k] for k in order if t >= starts[k] - 0.02)
    y = 0.775 * H
    if line1:
        put(img, line1, CAP, 50, WHITE, W / 2, y - (34 if kidx is not None and t >= starts[kidx] else 0), 1.0, shadow=190)
    if kidx is not None and t >= starts[kidx] - 0.02:
        u = t - starts[kidx]
        put(img, ws[kidx], CAP_B, 84, YELLOW, W / 2, y + 40, eo(u / 0.08), 0.85 + 0.15 * eb(u / 0.16), shadow=200)


# ------------------------------------------------------------------ brand moment (ref12 circle mask)
LOGO = Image.open("../../assets/brand/ff_logo.png").convert("RGBA")
_l = np.array(LOGO).astype(np.int32)
_l[..., 3] = np.clip((np.abs(_l[..., :3] - np.array([6, 20, 54])).sum(-1) - 30) * 4, 0, 255)
LOGO = Image.fromarray(_l.astype(np.uint8)); LOGO = LOGO.crop(LOGO.getbbox())
_lg = np.array(LOGO.resize((520, int(520 * LOGO.height / LOGO.width)), Image.LANCZOS)).astype(np.float32)
LOGO_NP = (_lg[..., [2, 1, 0]], _lg[..., 3:4] / 255)
_lgs = np.array(LOGO.resize((360, int(360 * LOGO.height / LOGO.width)), Image.LANCZOS)).astype(np.float32)
LOGO_S = (_lgs[..., [2, 1, 0]], _lgs[..., 3:4] / 255)
BRAND = (T("WE", 40.4), T("WE", 42.6))
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def brand(img_talk, t):
    a, b = BRAND
    u = t - a
    rad_full = math.hypot(W, H) / 2 + 20
    r_small = 310
    k = min(eio(u / 0.40), eio((b - t) / 0.35))
    rad = rad_full + (r_small - rad_full) * k
    cy = H * 0.50 + (H * 0.58 - H * 0.50) * k
    dist = np.sqrt((XX - W / 2) ** 2 + (YY - cy) ** 2)
    inside = np.clip(rad - dist, 0, 1)[..., None]
    ring = (np.clip(1 - np.abs(dist - rad - 6) / 5, 0, 1) * k)[..., None]
    shift = int((cy - R.FACE[1]) * k)
    talk = np.roll(img_talk, shift, axis=0)
    if shift > 0:
        talk[:shift] = img_talk[:1]
    out = WORLD * (1 - inside) + talk * inside
    out = out * (1 - ring) + 255 * ring
    if k > 0.6:
        al = cl((k - 0.6) / 0.4)
        R.place(out, *LOGO_NP, W / 2, H * 0.27, 0.8 + 0.2 * eb(cl((u - 0.25) / 0.35)), al)
        lab = typed("MARKETING AGENCY", t, T("MARKETING", 42.0), T("AGENCY", 42.3) + 0.25)
        if lab:
            put(out, lab, ANTON, 92, NAVY, W / 2, H * 0.83, al, track=6)
    return out


# ------------------------------------------------------------------ CTA, outro, watermark
CTA = (T("PLANNED", 54.5) - 0.3, 57.45)


def cta(img, t):
    a, b = CTA
    if not (a <= t <= b):
        return False
    u = t - a; al = min(eo(u / 0.25), eo((b - t) / 0.2))
    put(img, "BOOK A CALL", ANTON, 150, WHITE, W / 2, H * 0.735 + 50 * (1 - eo(u / 0.35)), al, shadow=180)
    put(img, "WITH F&F TODAY", ANTON, 70, YELLOW, W / 2, H * 0.805 + 50 * (1 - eo((u - 0.1) / 0.35)), al * eo((u - 0.1) / 0.2), track=4, shadow=180)
    put(img, "70862 69537  ·  frameandfame.in", CAP, 40, WHITE, W / 2, H * 0.855, al * eo((u - 0.3) / 0.25), shadow=200)
    return True


IG = Image.new("RGBA", (60, 60), (0, 0, 0, 0)); _d = ImageDraw.Draw(IG)
_d.rounded_rectangle((4, 4, 56, 56), 16, outline=(255, 255, 255, 255), width=5); _d.ellipse((18, 18, 42, 42), outline=(255, 255, 255, 255), width=5); _d.ellipse((42, 11, 48, 17), fill=(255, 255, 255, 255))
_ig = np.array(IG).astype(np.float32); IG_NP = (_ig[..., [2, 1, 0]], _ig[..., 3:4] / 255)


def watermark(img, t):
    R.place(img, IG_NP[0], IG_NP[1], W * 0.80, H * 0.135, 0.55, 0.85)
    put(img, "@FRAMEANDFAME.IN_", CAP, 22, WHITE, W * 0.80, H * 0.153, 0.8)


OUT0 = 57.50


def outro(t):
    img = np.zeros((H, W, 3), np.float32)
    u = t - OUT0
    if u < 1.2:
        k = eb(cl(u / 0.4)); al = min(eo(u / 0.15), eo((1.2 - u) / 0.2))
        glow = np.exp(-((XX - W / 2) ** 2 + (YY - H * 0.48) ** 2) / (2 * 260 ** 2))[..., None] * 90 * al
        img = img + glow * np.float32([254, 120, 40]) / 255
        R.place(img, *LOGO_NP, W / 2, H * 0.48, 0.7 + 0.3 * k, al)
    else:
        v = u - 1.2; al = eo(v / 0.2)
        R.place(img, IG_NP[0], IG_NP[1], W / 2, H * 0.48, 2.2 + 0.2 * eb(v / 0.3), al)
        put(img, "@FRAMEANDFAME.IN_", CAP_B, 44, WHITE, W / 2, H * 0.545, al * eo((v - 0.15) / 0.2))
    return img


# ------------------------------------------------------------------ transitions
def leak(img, t, at, dur=0.30, col=(80, 150, 255)):
    u = t - at
    if 0 <= u <= dur:
        k = math.sin(math.pi * u / dur) * 0.55
        grad = (1 - yy[..., None]) * 0.6 + xx[..., None] * 0.4
        img[:] = img * (1 - k * grad) + np.float32(col) * k * grad


def circle_in(talk, world, t, at, dur=0.24):
    k = eio((t - at) / dur)
    rad = 40 + (math.hypot(W, H) / 2) * k
    dist = np.sqrt((XX - W / 2) ** 2 + (YY - H * 0.5) ** 2)
    ins = np.clip(rad - dist, 0, 1)[..., None]
    return talk * (1 - ins) + world * ins


# ------------------------------------------------------------------ frame
def scene_at(t):
    for s in SCENES:
        if s.t0 <= t < s.t1:
            return s
    return None


def compose(i, fr, mk):
    t = i / FPS
    if t >= OUT0:
        return np.clip(outro(t) + cv2.resize(GRAIN[i % 8], (W, H), interpolation=cv2.INTER_NEAREST)[..., None] * 0.5, 0, 255).astype(np.uint8)
    img, m = frame_cam(fr, mk, i, t)
    HANDS[0] = hands(img, m)
    talk = grade(img, m) * VIGN
    sc = scene_at(t)
    if BRAND[0] <= t < BRAND[1]:
        out = brand(talk, t)
        out = out
        caption_ok = False
    elif sc is not None:
        world = sc.draw(t)
        prev = scene_at(sc.t0 - 0.02)
        out = circle_in(talk, world, t, sc.t0) if prev is None and t - sc.t0 < 0.24 else world
        caption_ok = False
    else:
        out = talk * (1 - BOTTOM)
        caption_ok = True
        # arrows behind him for "grow online"
        if T("GROW", 47.0) - 1.0 <= t <= 49.4:
            u = t - (T("GROW", 47.0) - 1.0)
            n = 1 + int(cl(u / 2.4) * 119)
            p = f"3d/renders/s3/f_{n:04d}.png"
            if os.path.exists(p):
                a3 = cv2.imread(p, cv2.IMREAD_UNCHANGED); a3 = cv2.resize(a3, (W, H)).astype(np.float32)
                al = (a3[..., 3] / 255 * (1 - m) * min(eo(u / 0.2), eo((49.4 - t) / 0.2)))[..., None]
                out = out * (1 - al) + a3[..., :3] * al
        if HOOK[0] <= t < HOOK[1]:
            u = t - HOOK[0]
            put(out, typed("IF YOU HAVE", t, 0.0, 0.5), ANTON, 120, RED, W / 2, H * 0.70, 1.0, shadow=170, track=3)
            if t >= T("ANY", 0.4):
                put(out, typed("ANY BUSINESS", t, T("ANY", 0.4), T("BUSINESS", 0.8)), ANTON, 150, WHITE, W / 2, H * 0.775, 1.0, shadow=170, track=3)
            caption_ok = False
        for ty in TYPE:
            if ty.draw(out, t, m):
                caption_ok = False
        if cta(out, t):
            caption_ok = False
        if T("MONEY", 8.5) - 0.15 <= t <= 9.6:
            _money.draw(out, t)
    if caption_ok:
        caption(out, t)
    # transitions out of cutaways (light leak back to his face) and white flash on brand
    for s in SCENES:
        if scene_at(s.t1 + 0.01) is None:
            leak(out, t, s.t1)
    u = t - BRAND[0]
    if -0.03 <= u <= 0.16:
        k = 0.8 * (1 - abs(u) / 0.16)
        out = out * (1 - k) + 255 * k
    watermark(out, t)
    out = out + cv2.resize(GRAIN[i % 8], (W, H), interpolation=cv2.INTER_NEAREST)[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


import overlays as O
_money = O.MoneyRain(0, 0, n=22)
_money.t0, _money.t1 = T("MONEY", 8.5) - 0.15, 9.30


def frames(end=END, only=None):
    cap, capm = cv2.VideoCapture("work/base60.mp4"), cv2.VideoCapture("work/mask60.mp4")
    nb = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    idx = [int(t * FPS) for t in only] if only else range(int(end * FPS))
    last = None
    for i in idx:
        if i < nb:
            if only:
                cap.set(cv2.CAP_PROP_POS_FRAMES, i); capm.set(cv2.CAP_PROP_POS_FRAMES, i)
            ok, fr = cap.read(); ok2, mf = capm.read()
            if ok and ok2:
                mk = cv2.resize(mf[..., 0], (W, H)).astype(np.float32) / 255
                last = (fr, mk)
        fr, mk = last if last else (np.zeros((H, W, 3), np.uint8), np.zeros((H, W), np.float32))
        yield i, compose(i, fr, mk)


if __name__ == "__main__":
    a = sys.argv[1:]
    if "--stills" in a:
        ts = [float(x) for x in a[a.index("--stills") + 1:]]
        for (i, img), t in zip(frames(only=ts), ts):
            cv2.imwrite(f"work/v5_{t:05.2f}.jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        sys.exit()
    end = float(a[a.index("--end") + 1]) if "--end" in a else END
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p", "work/visual_v5.mp4"], stdin=subprocess.PIPE)
    for i, img in frames(end=end):
        enc.stdin.write(img.tobytes())
        if i % 300 == 0:
            print(i, file=sys.stderr, flush=True)
    enc.stdin.close(); enc.wait()
