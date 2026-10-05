#!/usr/bin/env python3
"""video01 v2 compositor (60 fps).

Per frame: virtual camera (eased zooms, drift, shake, motion blur) -> colour grade with
subject/background separation -> text behind subject -> 3D cutaways with zoom-blur
transitions -> kinetic captions -> grain + vignette.

Inputs: work/base60.mp4 (cut, ungraded), work/mask60.mp4 (subject matte), 3d/renders/<scene>/f_####.png,
        transcribe/transcript.json.  Times below are RAW footage seconds; to_out() maps to the cut.
Usage:  render2.py [--end RAW_SECONDS] [--stills t1 t2 ...]
"""
import json, math, os, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 60
STUDIO = "../.."
FXB = f"{STUDIO}/assets/fonts/Poppins-800.ttf"
FB = f"{STUDIO}/assets/fonts/Poppins-700.ttf"
NAVY = np.array([54, 20, 6], np.float32)       # BGR
BLUE_RGB, GOLD_RGB, RED_RGB = (40, 120, 254), (255, 200, 40), (255, 59, 59)

KEEP = [(0.60, 25.76), (25.95, 58.53)]


def to_out(t):
    off = 0.0
    for a, b in KEEP:
        if t < a:
            return off
        if t <= b:
            return off + t - a
        off += b - a
    return off + (t - KEEP[-1][1])


def clamp01(x):
    return min(max(x, 0.0), 1.0)


def ease_io(x):  # smooth in-out (cubic)
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_out(x):
    x = clamp01(x); return 1 - (1 - x) ** 3


def ease_back(x, c=1.6):
    x = clamp01(x); return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


# ------------------------------------------------------------------ camera
# Each beat: (raw_time, zoom, dy, push_per_second, transition_seconds)
#   zoom 1 = full frame; dy shifts the picture down (px) to make headroom for text behind the head.
BEATS = [
    (0.00, 1.30, 0, 0.000, 0.0),
    (0.45, 1.18, 0, 0.020, 0.30),   # snap in on the first word
    (2.45, 1.04, 0, 0.015, 0.22),   # "video is going to solve"
    (3.30, 0.84, 260, 0.010, 0.28),  # pull back: room for 67% behind the head
    (4.84, 1.16, 0, 0.020, 0.20),   # "of your problems"
    (5.68, 1.00, 0, 0.015, 0.22),   # "let's say for example"
    (6.74, 1.12, 0, 0.020, 0.18),   # "you have a…"
    (9.15, 0.86, 240, 0.010, 0.25),  # back from 3D: MONEY / YEARS / EFFORT stack
    (13.30, 0.84, 260, 0.010, 0.25),  # BIG DREAM
    (14.60, 1.24, 0, 0.030, 0.12),  # "suddenly" — whip punch
    (17.62, 1.14, 0, 0.020, 0.20),  # back from clinic: "and he starts"
    (19.62, 1.00, 0, 0.010, 0.25),
    (99.0, 1.00, 0, 0.0, 0.0),
]
SHAKES = [(3.54, 16, 0.40), (14.64, 20, 0.45), (13.50, 8, 0.30)]  # (raw time, px, seconds)
FACE = (0.461 * W, 0.352 * H)


def camera(t):
    """zoom, dy, shake(x,y), speed (for motion blur) at out-time t."""
    bs = [(to_out(r), z, dy, p, tr) for r, z, dy, p, tr in BEATS]
    i = max(k for k in range(len(bs)) if bs[k][0] <= t)
    t0, z1, dy1, p1, tr = bs[i]
    zp, dyp = (bs[i - 1][1], bs[i - 1][2]) if i else (z1, dy1)
    if i:  # where the previous beat had pushed to when this one started
        zp = zp + bs[i - 1][3] * (t0 - bs[i - 1][0])
    k = ease_io((t - t0) / tr) if tr > 0 else 1.0
    z = zp + (z1 + p1 * (t - t0) - zp) * k
    dy = dyp + (dy1 - dyp) * k
    sx = sy = 0.0
    for r, amp, dur in SHAKES:
        u = t - to_out(r)
        if 0 <= u <= dur:
            a = amp * (1 - u / dur) ** 2
            sx += a * math.sin(u * 2 * math.pi * 11); sy += a * math.cos(u * 2 * math.pi * 9)
    # gentle hand-held drift so the frame is never dead still
    sx += 3.0 * math.sin(t * 0.9) ; sy += 2.5 * math.sin(t * 0.7 + 1)
    speed = abs(k - ease_io((t - t0 - 1 / FPS) / tr)) * abs(z1 - zp) if tr > 0 else 0
    return z, dy, sx, sy, speed


def warp(img, z, dy, sx, sy, border=cv2.BORDER_REPLICATE, interp=cv2.INTER_LINEAR):
    """Image warp. When the camera pulls back, the exposed edges are filled by stretching the
    edge pixels (ceiling/wall), which the background grade then blurs and darkens."""
    cx, cy = FACE
    M = np.float32([[z, 0, cx - z * cx + sx], [0, z, cy - z * cy + dy + sy]])
    return cv2.warpAffine(img, M, (W, H), flags=interp, borderMode=border)


# ------------------------------------------------------------------ grade
def build_lut():
    x = np.arange(256, dtype=np.float32) / 255
    s = x * x * (3 - 2 * x)
    y = 0.80 * x + 0.20 * s                      # contrast S-curve
    y = 0.025 + y * 0.965                         # lifted blacks, soft roll-off
    sh, hi = (1 - x) ** 2, x ** 2
    r = y - 0.020 * sh + 0.030 * hi               # warm highlights / skin
    g = y + 0.006 * sh + 0.008 * hi
    b = y + 0.030 * sh - 0.030 * hi               # teal shadows
    to8 = lambda c: np.clip(c * 255, 0, 255).astype(np.uint8)
    return to8(b), to8(g), to8(r)


LUT_B, LUT_G, LUT_R = build_lut()
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIGN = np.clip(1 - 0.38 * (((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H * 0.42) / (H * 0.70)) ** 2) ** 1.4, 0.55, 1)[..., None]
rng = np.random.default_rng(3)
GRAIN = [rng.normal(0, 3.2, (H // 2, W // 2)).astype(np.float32) for _ in range(6)]


def grade(img, m):
    b, g, r = cv2.split(img)
    img = cv2.merge([cv2.LUT(b, LUT_B), cv2.LUT(g, LUT_G), cv2.LUT(r, LUT_R)]).astype(np.float32)
    lum = img @ np.float32([0.114, 0.587, 0.299])
    img = lum[..., None] + (img - lum[..., None]) * 1.10            # saturation
    # background: softer, darker, cooler, less saturated -> subject pops
    small = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    small = cv2.GaussianBlur(small, (0, 0), 2.2)
    bg = cv2.resize(small, (W, H), interpolation=cv2.INTER_LINEAR)
    bl = bg @ np.float32([0.114, 0.587, 0.299])
    bg = (bl[..., None] + (bg - bl[..., None]) * 0.70) * 0.70 + NAVY * 0.10
    m3 = m[..., None]
    out = img * m3 + bg * (1 - m3)
    return out


def finish(img, i):
    img = img * VIGN
    gr = cv2.resize(GRAIN[i % len(GRAIN)], (W, H), interpolation=cv2.INTER_NEAREST)
    img = img + gr[..., None]
    return np.clip(img, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ text helpers
_fonts = {}


def font(p, s):
    if (p, s) not in _fonts:
        _fonts[(p, s)] = ImageFont.truetype(p, s)
    return _fonts[(p, s)]


def text_rgba(txt, size, fill=(255, 255, 255), path=FXB, stroke=0, glow=None, track=0):
    f = font(path, size)
    l, t, r, b = f.getbbox(txt, stroke_width=stroke)
    pad = 60 if glow else 10
    im = Image.new("RGBA", (r - l + 2 * pad + track * len(txt), b - t + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = pad - l
    if track:
        for ch in txt:
            d.text((x, pad - t), ch, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0))
            x += f.getlength(ch) + track
    else:
        d.text((x, pad - t), txt, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0))
    if glow:
        gl = im.copy().filter(ImageFilter.GaussianBlur(28))
        tint = Image.new("RGBA", im.size, glow + (0,)); tint.putalpha(gl.getchannel("A").point(lambda v: min(255, int(v * 1.6))))
        base = Image.new("RGBA", im.size, (0, 0, 0, 0)); base.alpha_composite(tint); base.alpha_composite(im); im = base
    a = np.array(im).astype(np.float32)
    return a[..., [2, 1, 0]], a[..., 3:4] / 255.0   # BGR, alpha


def place(dst, rgb, a, cx, cy, scale=1.0, alpha=1.0, under=None):
    """Alpha-composite rgb/a centred at (cx,cy). If `under` (subject matte) is given, draw behind the subject."""
    if scale <= 0.02 or alpha <= 0.01:
        return
    if abs(scale - 1) > 1e-3:
        w_, h_ = max(1, int(rgb.shape[1] * scale)), max(1, int(rgb.shape[0] * scale))
        rgb = cv2.resize(rgb, (w_, h_), interpolation=cv2.INTER_LINEAR); a = cv2.resize(a, (w_, h_), interpolation=cv2.INTER_LINEAR)[..., None]
    h_, w_ = rgb.shape[:2]
    x0, y0 = int(cx - w_ / 2), int(cy - h_ / 2)
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w_), min(H, y0 + h_)
    if xa >= xb or ya >= yb:
        return
    sr, sa = rgb[ya - y0:yb - y0, xa - x0:xb - x0], a[ya - y0:yb - y0, xa - x0:xb - x0] * alpha
    if under is not None:
        sa = sa * (1 - under[ya:yb, xa:xb, None])
    dst[ya:yb, xa:xb] = dst[ya:yb, xa:xb] * (1 - sa) + sr * sa


# ------------------------------------------------------------------ behind-the-subject words
class Word:
    def __init__(self, raw_in, raw_out, txt, size, y, color=(255, 255, 255), glow=(40, 120, 254), counter=None):
        self.t0, self.t1 = to_out(raw_in), to_out(raw_out)
        self.txt, self.size, self.y, self.color, self.glow, self.counter = txt, size, y, color, glow, counter
        self.cache = {}

    def draw(self, img, t, m):
        if not (self.t0 <= t <= self.t1):
            return
        u = t - self.t0
        txt = self.txt
        if self.counter:
            txt = f"{int(round(self.counter * ease_out(u / 0.6)))}%"
        if txt not in self.cache:
            self.cache[txt] = text_rgba(txt, self.size, self.color, glow=self.glow)
        rgb, a = self.cache[txt]
        if self.y is None:  # first frame: put the text's lower third behind the top of the head
            cols = m[:, int(W * 0.3):int(W * 0.7)].max(1)
            rows = np.where(cols > 0.5)[0]
            top = rows[0] if len(rows) else H * 0.3
            th = self.size * 0.75
            self.y = max(H * 0.10 + th / 2, top - th * 0.22)
        s = 0.6 + 0.4 * ease_back(u / 0.35)
        s *= 1 + 0.03 * u                                  # keeps growing slowly (never static)
        al = min(ease_out(u / 0.15), ease_out((self.t1 - t) / 0.18))
        place(img, rgb, a, W / 2, self.y - 30 * (1 - ease_out(u / 0.3)), s, al, under=m)


BEHIND = [
    Word(3.42, 4.90, "67%", 400, None, counter=67),
    Word(9.24, 10.24, "MONEY", 260, None),
    Word(10.24, 10.72, "YEARS", 260, None),
    Word(10.72, 13.30, "EFFORT", 250, None),
    Word(13.42, 14.62, "BIG DREAM", 150, None, color=GOLD_RGB, glow=(255, 160, 0)),
]

# ------------------------------------------------------------------ 3D cutaways
class Cut3D:
    """Full-screen 3D shot from out-time t0 to t1, using frames f0.. of renders/<scene>."""
    def __init__(self, scene, raw_in, raw_out, f0, title=None, sub=None):
        self.scene, self.t0, self.t1, self.f0 = scene, to_out(raw_in), to_out(raw_out), f0
        self.title = text_rgba(title, 104, glow=(0, 0, 0)) if title else None
        self.sub = text_rgba(sub, 58, BLUE_RGB, path=FB) if sub else None

    def frame(self, t):
        n = self.f0 + int(round((t - self.t0) * FPS))
        p = f"3d/renders/{self.scene}/f_{n:04d}.png"
        if not os.path.exists(p):
            return None
        im = cv2.imread(p, cv2.IMREAD_COLOR)
        if im.shape[1] != W:
            im = cv2.resize(im, (W, H), interpolation=cv2.INTER_CUBIC)
        return im.astype(np.float32)

    def overlay_text(self, img, t):
        u = t - self.t0
        if self.title:
            place(img, *self.title, W / 2, 330 + 40 * (1 - ease_out((u - 0.15) / 0.35)), 0.8 + 0.2 * ease_back((u - 0.15) / 0.35), ease_out((u - 0.15) / 0.2))
        if self.sub:
            place(img, *self.sub, W / 2, 450, 1.0, ease_out((u - 0.35) / 0.25))


CUTS = [
    Cut3D("s1", 7.05, 9.15, 1, "YOUR HOSPITAL"),
    Cut3D("s2", 15.00, 17.62, 1, "DR. PANDEY", "opens a small clinic"),
    Cut3D("s2", 18.45, 19.62, 161, "1 VIDEO / DAY", "every single day"),
]
TR = 0.18  # zoom-through transition length (s)


def zoom_blur(img, strength, steps=6):
    if strength < 0.004:
        return img
    acc = np.zeros_like(img)
    for k in range(steps):
        s = 1 + strength * k / (steps - 1)
        M = cv2.getRotationMatrix2D((W / 2, H * 0.45), 0, s)
        acc += cv2.warpAffine(img, M, (W, H), borderMode=cv2.BORDER_REFLECT_101)
    return acc / steps


# ------------------------------------------------------------------ captions (active-word box)
FIX = {"fnf": "F&F", "dr": "DR.", "i'm": "I'M"}
SILENCES = [(0.49, 0.69), (25.67, 26.04), (36.12, 36.37), (40.99, 41.31), (46.99, 47.18), (49.83, 50.24)]
EMPH = {"67%": GOLD_RGB, "hospital": GOLD_RGB, "money": GOLD_RGB, "years": GOLD_RGB, "effort": GOLD_RGB, "dream": GOLD_RGB,
        "pandey": GOLD_RGB, "clinic": GOLD_RGB, "video": GOLD_RGB, "suddenly": RED_RGB, "future": RED_RGB}


def words():
    d = json.load(open("transcribe/transcript.json"))
    ws = [dict(w=w["w"].strip(), start=w["start"], end=w["end"]) for s in d["segments"] for w in s["words"]]
    out = []
    for w in ws:
        if w["w"] == "%" and out:
            out[-1]["w"] += "%"; out[-1]["end"] = w["end"]
        else:
            out.append(w)
    for i, w in enumerate(out):
        for a, b in SILENCES:
            if w["start"] + 0.1 < (a + b) / 2 < w["end"]:
                w["start"] = b; w["end"] = max(w["end"], b + 0.15)
    res = []
    for w in out:
        k = w["w"].lower().strip(".,!?")
        res.append(dict(key=k, txt=FIX.get(k, k.upper()), t0=to_out(w["start"]), t1=to_out(w["end"])))
    return res


def lines_of(ws, maxw=3):
    L, cur = [], []
    for w in ws:
        if cur and (len(cur) >= maxw or w["t0"] - cur[-1]["t1"] > 0.25 or cur[-1]["key"] in {"business", "problems", "example", "town", "dream", "it", "clinic", "day"}):
            L.append(cur); cur = []
        cur.append(w)
    if cur:
        L.append(cur)
    return L


CAP_Y, CAP_SIZE = int(H * 0.705), 88
_cap_cache = {}


def caption(img, t, lines):
    ln = None
    for L in lines:
        if L[0]["t0"] - 0.03 <= t < (L[-1]["t1"] + 0.25):
            ln = L
    if ln is None:
        return
    f = font(FXB, CAP_SIZE)
    widths = [f.getlength(w["txt"]) for w in ln]
    gap = 28
    total = sum(widths) + gap * (len(ln) - 1)
    act = max([k for k, w in enumerate(ln) if w["t0"] - 0.03 <= t] or [0])
    key = (id(ln), act)
    if key not in _cap_cache:
        im = Image.new("RGBA", (int(total + 120), 190), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        x = 60
        for k, (w, wd) in enumerate(zip(ln, widths)):
            if k > act:
                break
            col = EMPH.get(w["key"], (255, 255, 255))
            if k == act:
                d.rounded_rectangle((x - 16, 38, x + wd + 16, 150), 22, fill=BLUE_RGB + (255,) if col == (255, 255, 255) else (0, 0, 0, 0))
            d.text((x, 95), w["txt"], font=f, fill=col if (k != act or col != (255, 255, 255)) else (255, 255, 255), anchor="lm",
                   stroke_width=0 if (k == act and col == (255, 255, 255)) else 5, stroke_fill=(0, 0, 0))
            x += wd + gap
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh.putalpha(im.getchannel("A").point(lambda v: v * 120 // 255))
        sh = sh.filter(ImageFilter.GaussianBlur(9))
        o = Image.new("RGBA", im.size, (0, 0, 0, 0)); o.alpha_composite(sh, (0, 7)); o.alpha_composite(im)
        a = np.array(o).astype(np.float32)
        _cap_cache[key] = (a[..., [2, 1, 0]], a[..., 3:4] / 255.0)
    rgb, a = _cap_cache[key]
    s = min(1.0, (W * 0.84) / rgb.shape[1])
    pop = 1 + 0.06 * (1 - ease_out((t - ln[act]["t0"]) / 0.12))
    place(img, rgb, a, W / 2, CAP_Y, s * pop)


# ------------------------------------------------------------------ frame
def compose(i, fr, mk, lines):
    t = i / FPS
    z, dy, sx, sy, speed = camera(t)
    # motion blur on fast camera moves: average a few sub-frame warps
    if speed > 0.004:
        n = 4; acc = np.zeros((H, W, 3), np.float32); macc = np.zeros((H, W), np.float32)
        for k in range(n):
            tk = t - (k / n) / FPS
            zk, dk, sxk, syk, _ = camera(tk)
            acc += warp(fr, zk, dk, sxk, syk).astype(np.float32); macc += warp(mk, zk, dk, sxk, syk, border=cv2.BORDER_CONSTANT)
        img, m = acc / n, macc / n
        img = img.astype(np.uint8)
    else:
        img, m = warp(fr, z, dy, sx, sy), warp(mk, z, dy, sx, sy, border=cv2.BORDER_CONSTANT)
    if z < 1.0:  # smooth out the stretched edge fill where the camera pulled back
        ones = np.ones((H, W), np.float32)
        valid = cv2.GaussianBlur(warp(ones, z, dy, sx, sy, border=cv2.BORDER_CONSTANT)[::4, ::4], (0, 0), 6)
        valid = cv2.resize(valid, (W, H))[..., None]
        soft = cv2.resize(cv2.GaussianBlur(cv2.resize(img, (W // 8, H // 8), interpolation=cv2.INTER_AREA), (0, 0), 6), (W, H))
        img = (img * valid + soft * (1 - valid)).astype(np.uint8)
    out = grade(img, m)
    for wd in BEHIND:
        wd.draw(out, t, m)
    # 3D cutaways with zoom-through transitions
    for c in CUTS:
        if c.t0 - TR <= t <= c.t1 + TR:
            if t < c.t0:            # talking head zooms into the cut
                k = (t - (c.t0 - TR)) / TR
                out = zoom_blur(out, 0.25 * ease_io(k))
                out = warp(out, 1 + 0.35 * ease_io(k), 0, 0, 0)
            elif t <= c.t1:
                f3 = c.frame(t)
                if f3 is None:
                    break
                k_in = (t - c.t0) / TR; k_out = (c.t1 - t) / TR
                if k_in < 1:
                    f3 = warp(zoom_blur(f3, 0.25 * (1 - ease_out(k_in))), 1.3 - 0.3 * ease_out(k_in), 0, 0, 0)
                elif k_out < 1:
                    f3 = warp(zoom_blur(f3, 0.25 * (1 - ease_out(k_out))), 1 + 0.3 * (1 - ease_out(k_out)), 0, 0, 0)
                f3 = f3 * 0.96 + 4
                c.overlay_text(f3, t)
                out = f3
            else:                   # back to the talking head, arriving from a zoom
                k = (t - c.t1) / TR
                out = zoom_blur(out, 0.25 * (1 - ease_out(k)))
                out = warp(out, 1.3 - 0.3 * ease_out(k), 0, 0, 0)
            flash = max(0.0, 1 - abs(t - c.t0) / 0.06) * 0.35 + max(0.0, 1 - abs(t - c.t1) / 0.06) * 0.25
            if flash > 0:
                out = out * (1 - flash) + 255 * flash
    caption(out, t, lines)
    return finish(out, i)


def frames(end_raw=None, only=None):
    lines = lines_of(words())
    cap, capm = cv2.VideoCapture("work/base60.mp4"), cv2.VideoCapture("work/mask60.mp4")
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if end_raw:
        n = min(n, int(to_out(end_raw) * FPS))
    if only:
        for t in only:
            i = int(to_out(t) * FPS)
            cap.set(cv2.CAP_PROP_POS_FRAMES, i); capm.set(cv2.CAP_PROP_POS_FRAMES, i)
            ok, fr = cap.read(); ok2, mf = capm.read()
            mk = cv2.resize(mf[..., 0], (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
            yield i, compose(i, fr, mk, lines)
        return
    for i in range(n):
        ok, fr = cap.read(); ok2, mf = capm.read()
        if not (ok and ok2):
            break
        mk = cv2.resize(mf[..., 0], (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
        yield i, compose(i, fr, mk, lines)


if __name__ == "__main__":
    args = sys.argv[1:]
    end = float(args[args.index("--end") + 1]) if "--end" in args else None
    if "--stills" in args:
        ts = [float(x) for x in args[args.index("--stills") + 1:]]
        for (i, img), t in zip(frames(only=ts), ts):
            cv2.imwrite(f"work/v2_{t:05.2f}.jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        sys.exit()
    out = "work/visual_v2.mp4"
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    for i, img in frames(end_raw=end):
        enc.stdin.write(img.tobytes())
        if i % 120 == 0:
            print(i, file=sys.stderr, flush=True)
    enc.stdin.close(); enc.wait()
