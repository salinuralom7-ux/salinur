#!/usr/bin/env python3
"""video01 v3 — premium agency-ad style (Salinur chose style A = ref07).

Look: speaker always on screen; warm cinematic grade with soft background; graphics layered
BEHIND the speaker (3D panels, brand panel, growth arrows) or as small white cards up top;
elegant serif captions on a black bottom gradient; big serif display titles for the hook,
the punch line and the CTA. Gentle camera, hard cuts, white flash / warm light leak accents.

Usage: render3.py [--end RAW_SECONDS] [--stills t1 t2 ...]     (times are RAW footage seconds)
"""
import os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import render2 as R

W, H, FPS = R.W, R.H, R.FPS
T = R.to_out
ease_io, ease_out, ease_back, clamp01 = R.ease_io, R.ease_out, R.ease_back, R.clamp01
FONTS = "../../assets/fonts"
SERIF, SERIF_B = f"{FONTS}/Tinos-Regular.ttf", f"{FONTS}/Tinos-Bold.ttf"
DISPLAY = f"{FONTS}/PlayfairDisplay-Black.ttf"
SANS_B = f"{FONTS}/Poppins-700.ttf"
NAVY_RGB, BLUE_RGB, LIGHTBLUE_RGB = (6, 20, 54), (40, 120, 254), (150, 195, 255)

# ------------------------------------------------------------------ camera: gentle, story-driven
R.BEATS = [
    (0.00, 1.06, 0, 0.006, 0.0),
    (3.48, 1.14, 0, 0.010, 0.45),    # "67%"
    (5.68, 1.02, 0, 0.006, 0.50),
    (14.60, 1.10, 0, 0.000, 0.25),   # "suddenly"
    (15.02, 1.00, 0, 0.006, 0.40),
    (21.36, 1.06, 0, 0.006, 0.50),   # "step out of your hospital"
    (25.95, 1.00, 0, 0.006, 0.0),    # hard cut: "now this might sound rubbish"
    (33.55, 1.00, 0, 0.020, 0.30),   # tension build: slow push to ~1.14
    (40.42, 1.20, 0, 0.000, 0.22),   # FUTURE
    (41.31, 1.00, 0, 0.006, 0.35),   # F&F
    (48.60, 1.04, 0, 0.006, 0.40),
    (55.35, 1.06, 0, 0.004, 0.50),
    (99.0, 1.00, 0, 0.0, 0.0),
]
HEADROOM = 210
R.BEATS = [(r, z, HEADROOM, p, tr) for r, z, _, p, tr in R.BEATS]
R.SHAKES = [(40.42, 7, 0.30)]


# ------------------------------------------------------------------ warm cinematic grade (ref07)
def warm_lut():
    x = np.arange(256, dtype=np.float32) / 255
    s = x * x * (3 - 2 * x)
    y = 0.84 * x + 0.16 * s
    y = 0.018 + y * 0.975
    mid = 4 * x * (1 - x)
    r = y + 0.030 * mid + 0.012 * x ** 2
    g = y + 0.012 * mid
    b = y - 0.028 * mid - 0.010 * x ** 2
    to8 = lambda c: np.clip(c * 255, 0, 255).astype(np.uint8)
    return to8(b), to8(g), to8(r)


R.LUT_B, R.LUT_G, R.LUT_R = warm_lut()
R.NAVY = np.float32([10, 14, 22])
_grade_orig = R.grade


def grade(img, m):
    b, g, r = cv2.split(img)
    img = cv2.merge([cv2.LUT(b, R.LUT_B), cv2.LUT(g, R.LUT_G), cv2.LUT(r, R.LUT_R)]).astype(np.float32)
    lum = img @ np.float32([0.114, 0.587, 0.299])
    img = lum[..., None] + (img - lum[..., None]) * 1.06
    small = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    bg = cv2.resize(cv2.GaussianBlur(small, (0, 0), 2.6), (W, H), interpolation=cv2.INTER_LINEAR) * 0.84
    m3 = m[..., None]
    return img * m3 + bg * (1 - m3)


yy = np.arange(H, dtype=np.float32)[:, None, None] / H
BOTTOM = np.clip((yy - 0.60) / 0.30, 0, 1) ** 1.3 * 0.94       # black gradient over the bottom ~35 %
VIGN = np.clip(1 - 0.30 * (((np.arange(W)[None, :, None] - W / 2) / (W * 0.8)) ** 2 + ((yy * H - H * 0.4) / (H * 0.75)) ** 2), 0.6, 1)

# ------------------------------------------------------------------ text helpers
_f = {}


def font(p, s):
    if (p, s) not in _f:
        _f[(p, s)] = ImageFont.truetype(p, s)
    return _f[(p, s)]


def to_np(im):
    a = np.array(im).astype(np.float32)
    return a[..., [2, 1, 0]], a[..., 3:4] / 255.0


def shadowed(im, blur=10, dy=5, opacity=150):
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh.putalpha(im.getchannel("A").point(lambda v: v * opacity // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    o = Image.new("RGBA", (im.width, im.height + dy), (0, 0, 0, 0)); o.alpha_composite(sh, (0, dy)); o.alpha_composite(im)
    return o


def gradient_text(txt, size, top, bottom, path=DISPLAY, track=0):
    f = font(path, size)
    l, t, r, b = f.getbbox(txt)
    w = int(r - l + 40 + track * len(txt)); h = int(b - t + 40)
    mask = Image.new("L", (w, h), 0); d = ImageDraw.Draw(mask)
    x = 20 - l
    for ch in txt:
        d.text((x, 20 - t), ch, font=f, fill=255); x += f.getlength(ch) + track
    grad = np.linspace(0, 1, h)[:, None, None]
    col = (np.array(top)[None, None, :] * (1 - grad) + np.array(bottom)[None, None, :] * grad)
    rgba = np.concatenate([np.broadcast_to(col, (h, w, 3)), np.array(mask)[..., None]], 2).astype(np.uint8)
    return shadowed(Image.fromarray(rgba, "RGBA"), 14, 8, 170)


def plain_text(txt, size, path=SERIF, fill=(255, 255, 255), track=0):
    f = font(path, size)
    l, t, r, b = f.getbbox(txt)
    w = int(r - l + 30 + track * len(txt)); h = int(b - t + 30)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x = 15 - l
    for ch in txt:
        d.text((x, 15 - t), ch, font=f, fill=fill); x += f.getlength(ch) + track
    return shadowed(im, 8, 4, 140)


def place_im(dst, im, cx, cy, scale=1.0, alpha=1.0, under=None):
    rgb, a = to_np(im) if isinstance(im, Image.Image) else im
    R.place(dst, rgb, a, cx, cy, scale, alpha, under)


# ------------------------------------------------------------------ captions (serif, phrase-level)
FIX = {"fnf": "F&F", "dr": "Dr.", "pandey": "Pandey", "i'm": "I'm", "i": "I", "67%": "67%"}


def phrases():
    ws = R.words()
    out, cur = [], []
    for w in ws:
        brk = cur and (len(cur) >= 5 or w["t0"] - cur[-1]["t1"] > 0.22 or len(" ".join(x["txt"] for x in cur)) > 26
                       or cur[-1]["key"] in {"business", "problems", "example", "town", "dream", "it", "clinic", "day", "hospital",
                                             "you", "facilities", "videos", "customers", "future", "agency", "online", "free", "call", "soon", "fnf", "money"} and len(cur) >= 2)
        if brk:
            out.append(cur); cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    res = []
    for k, ph in enumerate(out):
        words_ = []
        for i, w in enumerate(ph):
            t = FIX.get(w["key"], w["key"])
            if i == 0 and (k == 0 or ph[0]["t0"] - out[k - 1][-1]["t1"] > 0.3):
                t = t[:1].upper() + t[1:]
            words_.append(t)
        end = min(ph[-1]["t1"] + 0.25, out[k + 1][0]["t0"] if k + 1 < len(out) else 1e9)
        res.append((ph[0]["t0"], end, " ".join(words_)))
    return res


def wrap(text, maxc=24):
    """One line if it fits, else two lines split where they are most even."""
    if len(text) <= maxc:
        return [text]
    ws = text.split()
    best = min(range(1, len(ws)), key=lambda k: max(len(" ".join(ws[:k])), len(" ".join(ws[k:]))) + (99 if ws[k - 1] == "Dr." else 0))
    return [" ".join(ws[:best]), " ".join(ws[best:])]


_cap = {}


def caption_img(text):
    if text not in _cap:
        lines = wrap(text)
        f = font(SERIF, 66)
        lh = 76
        w = int(max(f.getlength(l) for l in lines) + 40); h = lh * len(lines) + 30
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        for i, l in enumerate(lines):
            d.text((w / 2, 15 + i * lh + lh / 2), l, font=f, fill=(255, 255, 255), anchor="mm")
        _cap[text] = to_np(shadowed(im, 9, 4, 160))
    return _cap[text]


# ------------------------------------------------------------------ display titles (hide captions)
class Title:
    def __init__(self, raw0, raw1, parts):
        self.t0, self.t1, self.parts = T(raw0), T(raw1), parts   # parts: list of (image, dy, delay)

    def draw(self, img, t):
        if not (self.t0 <= t <= self.t1):
            return False
        u = t - self.t0
        out = ease_out((self.t1 - t) / 0.2)
        for im, dy, delay in self.parts:
            k = ease_out((u - delay) / 0.35)
            place_im(img, im, W / 2, H * 0.765 + dy + 24 * (1 - k), 0.92 + 0.08 * k, min(k, out))
        return True


TITLES = [
    Title(3.46, 5.62, [(gradient_text("67%", 250, (255, 255, 255), LIGHTBLUE_RGB), -40, 0.0),
                       (plain_text("OF YOUR PROBLEMS", 60, SERIF_B, track=6), 110, 0.12)]),
    Title(40.40, 41.30, [(plain_text("stealing your", 58, SERIF), -125, 0.0),
                         (gradient_text("FUTURE", 210, (255, 255, 255), (255, 90, 80)), 15, 0.04)]),
    Title(55.35, 59.80, [(gradient_text("BOOK", 230, LIGHTBLUE_RGB, BLUE_RGB), -40, 0.0),
                         (plain_text("A CALL WITH US", 62, SERIF_B, track=5), 105, 0.15),
                         (plain_text("70862 69537  ·  frameandfame.in", 42, SANS_B), 185, 0.35)]),
]

# ------------------------------------------------------------------ small white cards (front, top area; ref07 flow cards)
def card_img(icon, label, w=200, h=230):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    g = np.linspace(250, 222, h).astype(np.uint8)
    bgc = Image.fromarray(np.dstack([np.broadcast_to(g[:, None], (h, w))] * 3 + [np.full((h, w), 255, np.uint8)]), "RGBA")
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), 20, fill=255)
    im.paste(bgc, (0, 0), m)
    ic = Image.open(f"gfx/{icon}_b.png").convert("RGBA").resize((96, 96), Image.LANCZOS)
    im.alpha_composite(ic, ((w - 96) // 2, 38))
    f = font(SANS_B, 26 if len(label) < 14 else 22)
    lines = label.split("\n")
    for i, l in enumerate(lines):
        d.text((w / 2, 165 + i * 30), l, font=f, fill=NAVY_RGB, anchor="mm")
    return shadowed(im, 16, 8, 120)


class Cards:
    def __init__(self, raw_end, items, y=345):
        self.items = [(T(r), card_img(ic, lab, w, 230), w) for r, ic, lab, w in items]
        self.t0, self.t1, self.y = self.items[0][0], T(raw_end), y
        gap = 16
        total = sum(w for _, _, w in self.items) + gap * (len(self.items) - 1)
        x = (W * 0.94 - total) / 2 + 10
        self.xs = []
        for _, _, w in self.items:
            self.xs.append(x + w / 2); x += w + gap

    def draw(self, img, t):
        if not (self.t0 - 0.01 <= t <= self.t1):
            return
        out = ease_out((self.t1 - t) / 0.18)
        for (ti, im, w), x in zip(self.items, self.xs):
            k = ease_out((t - ti) / 0.28)
            if k > 0:
                place_im(img, im, x, self.y - 26 * (1 - k), 0.94 + 0.06 * ease_back((t - ti) / 0.3), min(k, out))


CARDS = [
    Cards(14.50, [(9.24, "wallet", "Money", 200), (10.26, "calendar-clock", "Years", 200), (10.74, "flame", "Effort", 200), (13.50, "sparkles", "Big dream", 200)]),
    Cards(25.70, [(23.34, "users", "Long queue\nof patients", 300)]),
    Cards(33.40, [(29.00, "building-2", "Infrastructure", 230), (29.96, "users", "Manpower", 230), (31.00, "stethoscope", "Facilities", 230)]),
    Cards(37.00, [(33.68, "video", "Just a camera", 260)]),
    Cards(48.45, [(44.08, "clapperboard", "Creative\ncontent", 260), (45.94, "target", "Performance\nmarketing", 260)]),
    Cards(55.30, [(52.70, "phone-call", "70862 69537", 300)]),
]

# ------------------------------------------------------------------ layers BEHIND the speaker
def top_alpha(y_full=0.40, y_zero=0.62):
    a = np.clip((y_zero - yy[..., 0]) / (y_zero - y_full), 0, 1)
    return np.broadcast_to(a, (H, W))


TOPA = top_alpha()


class Behind:
    """Image sequence shown behind the speaker in the top part of the frame."""
    def __init__(self, scene, raw0, raw1, f0, f1, shift=-0.17, scale=0.90, full=False, alpha_from_png=False):
        self.scene, self.t0, self.t1, self.f0, self.f1 = scene, T(raw0), T(raw1), f0, f1
        self.shift, self.scale, self.full, self.png_alpha = shift, scale, full, alpha_from_png

    def frame(self, t):
        u = (t - self.t0) / (self.t1 - self.t0)
        n = int(round(self.f0 + u * (self.f1 - self.f0)))
        p = f"3d/renders/{self.scene}/f_{n:04d}.png"
        if not os.path.exists(p):
            return None, None
        im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
        im = cv2.resize(im, (W, H), interpolation=cv2.INTER_CUBIC)
        M = np.float32([[self.scale, 0, W * (1 - self.scale) / 2], [0, self.scale, H * self.shift + H * (1 - self.scale) / 2]])
        border = (0, 0, 0, 0) if im.shape[2] == 4 else tuple(int(v) for v in im[2, 2])
        im = cv2.warpAffine(im, M, (W, H), borderMode=cv2.BORDER_CONSTANT, borderValue=border)
        if im.shape[2] == 4:
            return im[..., :3].astype(np.float32), im[..., 3].astype(np.float32) / 255
        return im.astype(np.float32), None

    def draw(self, img, t, m):
        if not (self.t0 <= t <= self.t1):
            return
        rgb, a = self.frame(t)
        if rgb is None:
            return
        k = min(ease_out((t - self.t0) / 0.22), ease_out((self.t1 - t) / 0.22))
        alpha = (a if a is not None else np.ones((H, W), np.float32)) * (1 if self.full else TOPA) * k * (1 - m)
        img[:] = img * (1 - alpha[..., None]) + rgb * alpha[..., None]


BEHIND = [
    Behind("s1", 7.05, 9.20, 1, 129),
    Behind("s2", 15.02, 17.62, 1, 156),
    Behind("s2", 18.45, 21.35, 161, 235),
    Behind("s3", 48.55, 50.60, 1, 120, shift=-0.05, scale=1.0, full=True),
]

# F&F brand panel behind the speaker (ref07 "META AD EXPERT")
LOGO = Image.open("../../assets/brand/ff_logo.png").convert("RGBA")
_l = np.array(LOGO).astype(np.int32)
_l[..., 3] = np.clip((np.abs(_l[..., :3] - np.array(NAVY_RGB)).sum(-1) - 30) * 4, 0, 255)
LOGO = Image.fromarray(_l.astype(np.uint8)); LOGO = LOGO.crop(LOGO.getbbox())


def brand_panel():
    yy2 = np.linspace(0, 1, H)[:, None]
    col = np.array(NAVY_RGB)[None, None, ::-1] * (1 - yy2[..., None] * 0.3) + np.array([60, 30, 10])[None, None, :] * yy2[..., None] * 0.0
    img = np.broadcast_to(col, (H, W, 3)).astype(np.float32).copy()
    glow = np.exp(-(((np.arange(W)[None, :] - W / 2) / (W * 0.45)) ** 2 + ((np.arange(H)[:, None] - H * 0.2) / (H * 0.2)) ** 2))
    img += glow[..., None] * np.array(BLUE_RGB[::-1], np.float32) * 0.35
    lg = LOGO.resize((420, int(420 * LOGO.height / LOGO.width)), Image.LANCZOS)
    R.place(img, *to_np(lg), W / 2, H * 0.105)
    R.place(img, *to_np(plain_text("MARKETING AGENCY", 50, SERIF, track=8)), W / 2, H * 0.185)
    return img


BRAND = brand_panel()
BRAND_T0, BRAND_T1 = T(41.31), T(43.98)

# ------------------------------------------------------------------ accents
FLASHES = [(T(41.31), 0.16, (255, 255, 255), 0.85), (T(48.55), 0.45, (255, 170, 80), 0.35), (T(15.02), 0.10, (255, 255, 255), 0.35)]


def grid_lines(alpha):
    g = np.zeros((H, W), np.float32)
    for x in range(0, W, 120):
        g[:, x:x + 2] = 1
    for y in range(0, H, 120):
        g[y:y + 2, :] = 1
    return cv2.GaussianBlur(g, (0, 0), 0.8) * alpha


GRID = grid_lines(0.45)

# ------------------------------------------------------------------ frame
CAPS = phrases()
ONES = np.ones((H, W), np.float32)
FACE_X = np.load("work/face_x.npy")


def compose(i, fr, mk):
    t = i / FPS
    z, dy, sx, sy, speed = R.camera(t)
    # follow the face: glide it back toward the centre, zooming in a little when he drifts far
    fx = FACE_X[min(i, len(FACE_X) - 1)]
    d = (0.48 - fx) * W * 0.75
    z = max(z, min(1.22, 1 + abs(d) * 2 / W * 0.55))
    sx += d
    img = R.warp(fr, z, dy, sx, sy)
    m = R.warp(mk, z, dy, sx, sy, border=cv2.BORDER_CONSTANT)
    # fill the headroom we opened at the top with a soft extension of the background
    valid = cv2.GaussianBlur(R.warp(ONES, z, dy, sx, sy, border=cv2.BORDER_CONSTANT)[::4, ::4], (0, 0), 8)
    valid = cv2.resize(valid, (W, H))[..., None]
    soft = cv2.resize(cv2.GaussianBlur(cv2.resize(img, (W // 8, H // 8), interpolation=cv2.INTER_AREA), (0, 0), 5), (W, H))
    img = (img * valid + soft * (1 - valid)).astype(np.uint8)
    out = grade(img, m)
    # behind-the-speaker layers
    for b in BEHIND:
        if b.scene == "s3" and b.t0 <= t <= b.t1:
            k = min(ease_out((t - b.t0) / 0.2), ease_out((b.t1 - t) / 0.25))
            ga = GRID * k * (1 - m)
            out = out * (1 - ga[..., None]) + np.float32([255, 140, 40])[None, None, :] * ga[..., None]
        b.draw(out, t, m)
    if BRAND_T0 <= t <= BRAND_T1:
        k = min(ease_out((t - BRAND_T0) / 0.15), ease_out((BRAND_T1 - t) / 0.25))
        a = TOPA * k * (1 - m)
        out = out * (1 - a[..., None]) + BRAND * a[..., None]
        out = out * (1 - 0.18 * k) + np.float32(BLUE_RGB[::-1]) * 0.18 * k     # brand tint over the shot
    out = out * VIGN
    out = out * (1 - BOTTOM)
    for c in CARDS:
        c.draw(out, t)
    titled = any(tt.draw(out, t) for tt in TITLES)
    if not titled:
        for t0, t1, text in CAPS:
            if t0 - 0.02 <= t <= t1 and t < T(55.3):
                k = ease_out((t - t0 + 0.02) / 0.12)
                rgb, a = caption_img(text)
                R.place(out, rgb, a, W / 2, H * 0.775 + 8 * (1 - k), 1.0, k)
                break
    for ft, dur, col, peak in FLASHES:
        u = t - ft
        if -0.03 <= u <= dur:
            k = peak * (1 - abs(u) / dur if u > 0 else 1 + u / 0.03)
            out = out * (1 - k) + np.float32(col[::-1]) * k
    return R.finish(out, i)


def frames(end_raw=None, only=None):
    cap, capm = cv2.VideoCapture("work/base60.mp4"), cv2.VideoCapture("work/mask60.mp4")
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if end_raw:
        n = min(n, int(T(end_raw) * FPS))
    idx = [int(T(t) * FPS) for t in only] if only else range(n)
    for i in idx:
        if only:
            cap.set(cv2.CAP_PROP_POS_FRAMES, i); capm.set(cv2.CAP_PROP_POS_FRAMES, i)
        ok, fr = cap.read(); ok2, mf = capm.read()
        if not (ok and ok2):
            break
        mk = cv2.resize(mf[..., 0], (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
        yield i, compose(i, fr, mk)


if __name__ == "__main__":
    import subprocess
    a = sys.argv[1:]
    end = float(a[a.index("--end") + 1]) if "--end" in a else None
    if "--stills" in a:
        ts = [float(x) for x in a[a.index("--stills") + 1:]]
        for (i, img), t in zip(frames(only=ts), ts):
            cv2.imwrite(f"work/v3_{t:05.2f}.jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        sys.exit()
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-pix_fmt", "yuv420p", "work/visual_v3.mp4"], stdin=subprocess.PIPE)
    for i, img in frames(end_raw=end):
        enc.stdin.write(img.tobytes())
        if i % 300 == 0:
            print(i, file=sys.stderr, flush=True)
    enc.stdin.close(); enc.wait()
