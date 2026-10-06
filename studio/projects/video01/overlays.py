"""Front overlays for video01 v4 — animations that act out what Salinur says, drawn IN FRONT of him
in the band just above the captions (face stays clear). All procedural, own work.

Each overlay: draw(img_bgr_float, t_out) -> None. Times given in raw-footage seconds, mapped with T().
"""
import math
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import render2 as R

W, H = R.W, R.H
T = R.to_out
ease_out, ease_back, ease_io = R.ease_out, R.ease_back, R.ease_io
FONTS = "../../assets/fonts"
SANS_B = f"{FONTS}/Poppins-800.ttf"
SERIF_B = f"{FONTS}/Tinos-Bold.ttf"
BAND_Y = 0.60 * H          # centre of the "above the captions" band
YELLOW = (255, 214, 10)
rng = np.random.default_rng(11)


def to_np(im):
    a = np.array(im).astype(np.float32)
    return a[..., [2, 1, 0]], a[..., 3:4] / 255.0


def put(img, im, cx, cy, scale=1.0, alpha=1.0, rot=0.0):
    if rot:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    R.place(img, *to_np(im), cx, cy, scale, alpha)


def shadow(im, blur=12, dy=8, op=140):
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh.putalpha(im.getchannel("A").point(lambda v: v * op // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    o = Image.new("RGBA", (im.width + 2 * blur, im.height + 2 * blur + dy), (0, 0, 0, 0))
    o.alpha_composite(sh, (blur, blur + dy)); o.alpha_composite(im, (blur, blur))
    return o


def label(txt, size=46, fill=(255, 255, 255), path=SANS_B):
    f = ImageFont.truetype(path, size)
    l, t, r, b = f.getbbox(txt)
    im = Image.new("RGBA", (r - l + 20, b - t + 20), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10 - l, 10 - t), txt, font=f, fill=fill)
    return shadow(im, 8, 4, 170)


# ---------------------------------------------------------------- money rain
def banknote(w=230, h=110):
    """Stylised green note with a ₹ — not a copy of any real currency design."""
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 10, fill=(64, 150, 92, 255), outline=(30, 95, 55, 255), width=4)
    d.rounded_rectangle((12, 12, w - 13, h - 13), 6, outline=(170, 225, 180, 255), width=2)
    d.ellipse((w / 2 - 34, h / 2 - 34, w / 2 + 34, h / 2 + 34), fill=(120, 195, 140, 255))
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 54)   # has the ₹ glyph
    d.text((w / 2, h / 2 + 2), "₹", font=f, fill=(25, 85, 45, 255), anchor="mm")
    for x in (26, w - 26):
        d.text((x, h / 2), "500", font=ImageFont.truetype(SANS_B, 18), fill=(220, 245, 225, 255), anchor="mm")
    return im


NOTE = banknote()


class MoneyRain:
    def __init__(self, raw0, raw1, n=18):
        self.t0, self.t1 = T(raw0), T(raw1)
        self.notes = [dict(x=rng.uniform(0.05, 0.95) * W, delay=rng.uniform(0, 0.35), speed=rng.uniform(1300, 1800),
                           spin=rng.uniform(-260, 260), flip=rng.uniform(3, 7), sway=rng.uniform(20, 60), s=rng.uniform(0.6, 1.0),
                           ph=rng.uniform(0, 6)) for _ in range(n)]

    def draw(self, img, t):
        if not (self.t0 <= t <= self.t1 + 0.35):
            return
        for nt in self.notes:
            u = t - self.t0 - nt["delay"]
            if u < 0:
                continue
            y = -150 + nt["speed"] * u
            if y > H * 0.86:
                continue
            x = nt["x"] + nt["sway"] * math.sin(u * 3 + nt["ph"])
            sx = abs(math.cos(u * nt["flip"] + nt["ph"])) * 0.85 + 0.15     # paper flipping
            im = NOTE.resize((max(2, int(NOTE.width * nt["s"] * sx)), int(NOTE.height * nt["s"])), Image.BILINEAR)
            put(img, im, x, y, 1.0, 1.0, rot=(nt["spin"] * u) % 360)


# ---------------------------------------------------------------- "years of effort": calendar pages flying off
def cal_page(year):
    w, h = 300, 320
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 22, fill=(250, 250, 248, 255))
    d.rounded_rectangle((0, 0, w - 1, 90), 22, fill=(225, 45, 45, 255)); d.rectangle((0, 60, w - 1, 90), fill=(225, 45, 45, 255))
    for x in (80, w - 80):
        d.ellipse((x - 10, -6, x + 10, 14), fill=(60, 60, 60, 255))
    d.text((w / 2, 48), "YEAR", font=ImageFont.truetype(SANS_B, 34), fill=(255, 255, 255), anchor="mm")
    d.text((w / 2, 200), str(year), font=ImageFont.truetype(SANS_B, 96), fill=(30, 30, 40), anchor="mm")
    return shadow(im, 14, 10, 130)


class YearsOfEffort:
    """ONE item for the phrase "years of effort": pages 1..5 tear off, then the phrase lands."""
    def __init__(self, raw0, raw1):
        self.t0, self.t1 = T(raw0), T(raw1)
        self.pages = [cal_page(k) for k in range(1, 7)]
        self.title = label("YEARS OF EFFORT", 54, YELLOW)

    def draw(self, img, t):
        if not (self.t0 <= t <= self.t1):
            return
        u = t - self.t0
        a = min(ease_out(u / 0.2), ease_out((self.t1 - t) / 0.2))
        cx, cy = W / 2, BAND_Y - 40
        put(img, self.pages[-1], cx, cy, 0.8 + 0.2 * ease_back(u / 0.3), a)
        for k in range(5):                     # page k flies off at 0.25 s steps
            tk = u - 0.18 - k * 0.22
            if tk < 0:
                put(img, self.pages[4 - k], cx, cy, 0.8 + 0.2 * ease_back(u / 0.3), a)
            elif tk < 0.5:
                put(img, self.pages[4 - k], cx + 900 * tk ** 1.5, cy - 500 * tk + 900 * tk * tk, 1.0, a * (1 - tk / 0.5), rot=-120 * tk)
        put(img, self.title, cx, cy + 215, 1.0, a * ease_out((u - 0.3) / 0.25))


# ---------------------------------------------------------------- "just a camera": camera with blinking REC
def camera_icon():
    w, h = 340, 230
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((10, 40, w - 10, h - 10), 30, fill=(28, 30, 36, 255))
    d.rounded_rectangle((60, 18, 150, 50), 10, fill=(28, 30, 36, 255))
    d.ellipse((w / 2 - 70, h / 2 - 50 + 15, w / 2 + 70, h / 2 + 90 + 15 - 50), fill=(60, 70, 90, 255))
    d.ellipse((w / 2 - 48, h / 2 - 28 + 15, w / 2 + 48, h / 2 + 68 + 15 - 50), fill=(20, 40, 90, 255))
    d.ellipse((w / 2 - 18, h / 2 + 2, w / 2 + 6, h / 2 + 26), fill=(160, 200, 255, 200))
    return im


class CameraRec:
    def __init__(self, raw0, raw1, text="JUST A CAMERA"):
        self.t0, self.t1 = T(raw0), T(raw1)
        self.cam = shadow(camera_icon(), 14, 10, 150)
        self.title = label(text, 50, YELLOW)

    def draw(self, img, t):
        if not (self.t0 <= t <= self.t1):
            return
        u = t - self.t0
        a = min(ease_out(u / 0.2), ease_out((self.t1 - t) / 0.2))
        cx, cy = W / 2, BAND_Y - 30
        bob = 6 * math.sin(u * 4)
        put(img, self.cam, cx, cy + bob, 0.75 + 0.25 * ease_back(u / 0.35), a)
        if (u % 0.8) < 0.45:
            rec = Image.new("RGBA", (190, 60), (0, 0, 0, 0)); d = ImageDraw.Draw(rec)
            d.ellipse((6, 14, 38, 46), fill=(255, 40, 40, 255))
            d.text((50, 30), "REC", font=ImageFont.truetype(SANS_B, 34), fill=(255, 255, 255), anchor="lm")
            put(img, rec, cx + 120, cy - 150 + bob, 1.0, a)
        put(img, self.title, cx, cy + 175, 1.0, a * ease_out((u - 0.2) / 0.25))


# ---------------------------------------------------------------- "give us a call": ringing phone + number
def phone_icon():
    w, h = 190, 330
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 34, fill=(20, 22, 28, 255))
    d.rounded_rectangle((12, 40, w - 13, h - 40), 14, fill=(40, 120, 254, 255))
    d.ellipse((w / 2 - 34, h / 2 - 34, w / 2 + 34, h / 2 + 34), fill=(46, 204, 113, 255))
    hs = Image.open("gfx/phone-call_w.png").convert("RGBA").resize((44, 44), Image.LANCZOS)
    im.alpha_composite(hs, (int(w / 2 - 22), int(h / 2 - 22)))
    return im


class PhoneRing:
    def __init__(self, raw0, raw1, number="70862 69537"):
        self.t0, self.t1 = T(raw0), T(raw1)
        self.phone = shadow(phone_icon(), 14, 10, 150)
        self.num = label(number, 64, YELLOW)

    def draw(self, img, t):
        if not (self.t0 <= t <= self.t1):
            return
        u = t - self.t0
        a = min(ease_out(u / 0.2), ease_out((self.t1 - t) / 0.2))
        cx, cy = W / 2, BAND_Y - 60
        ring = 9 * math.sin(u * 55) * (1 if (u % 1.0) < 0.5 else 0)
        for k in range(3):                     # expanding rings
            r = ((u * 1.4 + k / 3) % 1.0)
            ov = np.zeros((H, W), np.float32)
            cv2.circle(ov, (int(cx), int(cy)), int(140 + 160 * r), 1.0, 6, cv2.LINE_AA)
            al = (ov * a * (1 - r) * 0.7)[..., None]
            img[:] = img * (1 - al) + np.float32([254, 120, 40]) * al
        put(img, self.phone, cx, cy, 0.8 + 0.2 * ease_back(u / 0.35), a, rot=ring)
        put(img, self.num, cx, cy + 225, 1.0, a * ease_out((u - 0.2) / 0.25))
