#!/usr/bin/env python3
"""video02 — F&F faceless motion-graphics ad, ref16 style (duotone cut-out world in F&F blue, typed Hindi word ladders).
Usage: render.py --stills t1 t2 ... | --part k N
"""
import json, math, os, subprocess, sys
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
import mg
from mg import W, H, cl, eo, eio, eb, spring, INK, BLUE, GOLD, NAVY

FPS = 30
END = 39.6
HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "work", "img")

# ------------------------------------------------------------------ word timings (whisper starts snapped to silence ends)
SIL = [(1.16, 1.47), (2.91, 3.48), (4.52, 4.85), (5.76, 6.27), (9.72, 10.21), (10.87, 11.29), (12.90, 13.51), (14.91, 15.36),
       (15.99, 16.30), (17.95, 18.60), (20.20, 20.57), (22.01, 22.38), (22.94, 23.15), (24.01, 24.37), (24.87, 25.09),
       (25.97, 26.25), (27.08, 27.53), (28.57, 28.85), (30.17, 30.54), (33.09, 33.28), (34.74, 35.16), (36.08, 36.32)]
WORDS = []
for ln in open(os.path.join(HERE, "work", "words.txt")):
    p = ln.split()
    if len(p) < 3 or not p[0][0].isdigit():
        continue
    s, e = float(p[0]), float(p[1])
    for a, b in SIL:
        if a - 0.05 <= s < b:
            s = b
    WORDS.append((s, e, p[2]))


def T(i):
    return WORDS[i][0]


def TE(i):
    return WORDS[i][1]


# ------------------------------------------------------------------ assets
def cut(name, max_side=900, **kw):
    p = os.path.join(IMG, name + ".png")
    return mg.load_cut(p, max_side, **kw) if os.path.exists(p) else None


A = {}


def assets():
    for n in ["shop", "shop2", "scale", "laddoo", "queue", "person1", "person2", "person3", "waiting", "clock", "magnifier",
              "brain", "spotlight", "coins", "camera", "telephone", "phone", "flyimg"]:
        A[n] = cut(n)
    if A["shop2"] is None and A["shop"] is not None:
        A["shop2"] = A["shop"][:, ::-1].copy()        # mirrored twin shop
    # F&F logo pieces (navy F, blue &, navy F) keyed out of the navy square
    lg = np.array(Image.open(os.path.join(HERE, "..", "..", "assets", "brand", "ff_logo.png")).convert("RGB")).astype(np.float32)
    white = np.clip((lg.min(2) - 120) / 100, 0, 1)
    blue = np.clip((lg[..., 2] - lg[..., 0] - 60) / 60, 0, 1) * (1 - white)
    pieces = {}
    for nm, m, col, xs in [("F1", white, NAVY, (0, 236)), ("amp", blue, mg.BLUE, (0, 512)), ("F2", white, NAVY, (236, 512))]:
        mm = np.zeros_like(m); mm[:, xs[0]:xs[1]] = m[:, xs[0]:xs[1]]
        rgba = np.dstack([np.full_like(mm, col[0]), np.full_like(mm, col[1]), np.full_like(mm, col[2]), mm * 255]).astype(np.uint8)
        pieces[nm] = rgba
    # common crop so pieces keep their relative layout
    allm = (white + blue) > 0.05
    ys, xs = np.where(allm)
    y0, y1, x0, x1 = ys.min() - 4, ys.max() + 4, xs.min() - 4, xs.max() + 4
    for nm in pieces:
        A["logo_" + nm] = mg.to_sprite(cv2.resize(pieces[nm][y0:y1, x0:x1], None, fx=2.2, fy=2.2, interpolation=cv2.INTER_CUBIC))
    A["logo_w"] = (x1 - x0) * 2.2
    A["ig"] = mg.ig_glyph(40, INK)
    A["ig_w"] = mg.ig_glyph(56, (255, 255, 255))


# ------------------------------------------------------------------ vector fallbacks / props
def vec_phone(w=500, h=1000):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=int(w * 0.14), fill=(12, 24, 70, 255))
    d.rounded_rectangle((6, 6, w - 7, h - 7), radius=int(w * 0.13), outline=(90, 120, 210, 255), width=3)
    d.rounded_rectangle((w * 0.36, 24, w * 0.64, 50), radius=13, fill=(4, 10, 34, 255))
    return mg.to_sprite(np.array(im))


SCREEN = None   # (x0,y0,x1,y1,r) relative to phone sprite, set in main


def screen_mask(w, h, r):
    m = np.zeros((h, w), np.uint8)
    from PIL import ImageDraw
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=255)
    return np.array(im).astype(np.float32)[..., None] / 255


def coin(fr, x, y, r, spin, a=1.0):
    """yellow accent coin, flipping"""
    sq = abs(math.cos(spin))
    rx, ry = max(2, int(r * sq)), r
    S = int(r * 2 + 8)
    m = np.zeros((S * 4, S * 4), np.float32)
    rim = np.zeros_like(m)
    cv2.ellipse(m, (S * 2, S * 2), (rx * 4, ry * 4), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
    cv2.ellipse(rim, (S * 2, S * 2), (int(rx * 0.72) * 4, int(ry * 0.72) * 4), 0, 0, 360, 1.0, max(4, r // 3), cv2.LINE_AA)
    m = cv2.resize(m, (S, S), interpolation=cv2.INTER_AREA); rim = cv2.resize(rim, (S, S), interpolation=cv2.INTER_AREA)
    col = np.array(GOLD, np.float32)
    dark = np.array((196, 150, 20), np.float32)
    rgb = col[None, None] * (1 - rim[..., None] * 0.6) + dark[None, None] * rim[..., None] * 0.6
    spr = np.dstack([rgb * m[..., None], m]).astype(np.float32)
    mg.place(fr, spr, x, y, 1, 0, a)


def fly(fr, x, y, t, a=1.0):
    S = 60
    m = np.zeros((S, S), np.float32); wng = np.zeros((S, S), np.float32)
    flap = 0.6 + 0.4 * math.sin(t * 90)
    cv2.ellipse(wng, (S // 2 - 8, S // 2 - 6), (12, int(6 * flap) + 2), -30, 0, 360, 1.0, -1, cv2.LINE_AA)
    cv2.ellipse(wng, (S // 2 + 8, S // 2 - 6), (12, int(6 * flap) + 2), 30, 0, 360, 1.0, -1, cv2.LINE_AA)
    cv2.ellipse(m, (S // 2, S // 2 + 2), (7, 11), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
    cv2.circle(m, (S // 2, S // 2 - 10), 5, 1.0, -1, cv2.LINE_AA)
    rgb = np.zeros((S, S, 3), np.float32) + np.array(NAVY, np.float32)
    rgb = rgb * m[..., None] + np.array((235, 240, 255), np.float32) * wng[..., None] * 0.55 * (1 - m[..., None])
    al = np.clip(m + wng * 0.55, 0, 1)
    mg.place(fr, np.dstack([rgb, al]).astype(np.float32), x, y, 1, 0, a)


def film_frame(img_spr, w=170, h=128):
    """one film-strip cell (dark band + sprockets + duotone thumbnail)"""
    out = np.zeros((h, w, 4), np.float32)
    out[..., :3] = np.array((10, 16, 44), np.float32); out[..., 3] = 1
    for x in range(8, w, 22):
        for y in (6, h - 16):
            out[y:y + 10, x:x + 12, :3] = (225, 232, 255)
    if img_spr is not None:
        th = mg.fit(img_spr, w - 22, h - 46)
        bg = np.zeros((h - 40, w - 16, 4), np.float32); bg[..., :3] = (205, 218, 252); bg[..., 3] = 1
        hh, ww = th.shape[:2]
        y0, x0 = (bg.shape[0] - hh) // 2, (bg.shape[1] - ww) // 2
        sub = bg[y0:y0 + hh, x0:x0 + ww]
        sub[..., :3] = sub[..., :3] * (1 - th[..., 3:4]) + th[..., :3]
        out[20:20 + bg.shape[0], 8:8 + bg.shape[1]] = bg
    return out


# ------------------------------------------------------------------ helpers for scenes
def enter(spr, t, t0, d=0.38, seed=1):
    """pixel-dissolve entry; returns (sprite, scale multiplier)"""
    p = (t - t0) / d
    if p <= 0:
        return None, 0
    return mg.mosaic(spr, p, seed), 0.92 + 0.08 * eo(p)


def exit_k(t, t1, d=0.16):
    return cl((t1 - t) / d)


def hero(fr, name, t, t0, x, y, w=None, h=None, seed=1, sh=True, rot=0.0, drift=0.0, a=1.0, t1=None, anchor="b", sha=0.42):
    spr = A.get(name)
    if spr is None or t < t0:
        return None
    key = (name, w, h)
    if key not in _fitc:
        _fitc[key] = mg.fit(spr, w, h)
    spr = _fitc[key]
    s_drift = 1 + drift * (t - t0)
    ins, k = enter(spr, t, t0, seed=seed)
    if ins is None:
        return None
    ka = a * (exit_k(t, t1) if t1 else 1)
    hh, ww = spr.shape[:2]
    if sh:
        mg.shadow(fr, x, y - 4, ww * 0.9 * k * s_drift, sha * min(1, (t - t0) / 0.3) * ka)
    mg.place(fr, ins, x, y, k * s_drift, rot, ka, anchor=anchor)
    return ww, hh


_fitc = {}


def word(fr, t, text, x, yb, t0, t1, style="B", size=180, colour=INK, anchor="l", italic=False, tend=None, pop=True, maxw=860):
    if yb < 700:
        maxw = min(maxw, 740)          # keep clear of the IG tag top-right
    full = mg.text_width(text, style, size, italic)
    if full > maxw:
        size = int(size * maxw / full)
    s = mg.typed(text, t, t0, t1)
    if not s:
        return
    a = cl((t - t0) / 0.08)
    if tend is not None:
        a *= exit_k(t, tend)
    mg.put_text(fr, s, x, yb, style, size, colour, a, anchor, italic)


def conn(fr, t, text, x, yb, t0, t1=None, size=54, anchor="l", tend=None, colour=INK):
    """light italic connective words (whole phrase fades/types quickly)"""
    word(fr, t, text, x, yb, t0, t1 if t1 else t0 + 0.25 + 0.04 * len(text), "c", size, colour, anchor, False, tend)


# ------------------------------------------------------------------ scenes (each: draw(fr, t))
SC = []


def scene(t0, t1):
    def deco(f):
        SC.append((t0, t1, f)); return f
    return deco


X0 = 96          # left text margin
TOPB = 480       # baseline of the top word line
TOPC = 262       # baseline of the small connective line above it
BOTB = 1460      # baseline of the bottom word line


@scene(0.0, 3.35)
def s1(fr, t):
    e = 3.35
    push = 1 + 0.012 * t
    hero(fr, "shop", t, 0.05, 300, 1150, w=470, seed=1, t1=e, drift=0.01)
    hero(fr, "shop2", t, T(4), 780, 1150, w=470, seed=2, t1=e, drift=0.01)
    conn(fr, t, "ek hi gali mein…", X0, TOPC, 0.0, 0.9, tend=e)
    word(fr, t, "DO", X0, TOPB, T(4), T(4) + 0.18, size=240, tend=e)
    conn(fr, t, "mithai ki", X0 + mg.text_width("DO", "B", 240) + 26, TOPB, T(5), TE(6), size=62, tend=e)
    word(fr, t, "DUKAANEIN", 984, BOTB, T(7), TE(7) + 0.1, size=240, anchor="r", tend=e)
    mg.dotted_ellipse(fr, 540, 1160, 430, 60, phase=t * 0.6, a=0.75 * cl((t - 0.3) / 0.4) * exit_k(t, e))


@scene(3.35, 6.15)
def s2(fr, t):
    e = 6.15
    u = t - 3.35
    wob = 5 * spring(max(0, t - T(9)) * 0.9, 1.4, 2.2) if t < T(12) else 3 * spring(max(0, t - T(12)) * 0.9, 1.4, 3.0)
    if A["scale"] is not None:
        hero(fr, "scale", t, 3.35, 540, 1230, h=640, seed=3, rot=wob, t1=e, drift=0.012)
    else:
        hero(fr, "laddoo", t, 3.35, 330, 1150, w=360, seed=3, t1=e)
        hero(fr, "laddoo", t, 3.6, 750, 1150, w=360, seed=4, t1=e)
    conn(fr, t, "ek jaisa", X0, TOPC, T(9), TE(10), tend=e)
    word(fr, t, "SWAAD", X0, TOPB + 10, T(11), TE(11), size=230, tend=e)
    conn(fr, t, "ek jaisa", 984, BOTB - 255, T(12), TE(13), anchor="r", tend=e)
    word(fr, t, "DAAM", 984, BOTB, T(14), TE(14), size=230, anchor="r", tend=e)
    if t > T(14):
        k = (t - T(14)) / 0.6
        mg.ring(fr, 540, 1000, 120 + 520 * eo(k), 5, a=0.8 * (1 - cl(k)))


@scene(6.15, 10.05)
def s3(fr, t):
    e = 10.05
    hero(fr, "shop", t, 6.15, 250, 1180, w=380, seed=5, t1=e, drift=0.006)
    # queue: people pop in one by one from the shop door outwards
    ppl = [n for n in ("person1", "person2", "person3") if A.get(n) is not None]
    if ppl:
        n_people = 6
        for j in range(n_people):
            tj = T(17) + j * (T(22) - T(17)) / n_people
            x = 470 + j * 95
            s_ = 1 - j * 0.05
            hero(fr, ppl[j % len(ppl)], t, tj, x, 1190 - j * 6, h=int(430 * s_), seed=10 + j, t1=e, sha=0.3)
    elif A.get("queue") is not None:
        hero(fr, "queue", t, T(17), 690, 1190, w=640, seed=6, t1=e, sha=0.3)
    conn(fr, t, "par ek dukaan ke baahar,", X0, TOPC, T(15), TE(19), tend=e)
    word(fr, t, "ROZ", X0, TOPB, T(20), TE(20), style="M", size=170, colour=BLUE, tend=e)
    word(fr, t, "LAMBI LINE", X0, BOTB, T(21), TE(22), size=230, tend=e)
    conn(fr, t, "lagti thi…", 984, BOTB + 90, T(23), TE(24), anchor="r", tend=e)
    # dotted queue line on the floor
    if t > T(17):
        k = eo((t - T(17)) / (T(22) - T(17)))
        n = int(26 * k)
        for i in range(n):
            mg.glow(fr, 420 + i * 24, 1215, 5, a=0.0)
        if n:
            mg.line(fr, (410, 1212), (410 + 600 * k, 1212), 3, (255, 255, 255), 0.7 * exit_k(t, e))


@scene(10.05, 13.35)
def s4(fr, t):
    e = 13.35
    hero(fr, "shop2", t, 10.05, 560, 1170, w=520, seed=7, t1=e, drift=0.008)
    if A.get("waiting") is not None:
        hero(fr, "waiting", t, T(27), 290, 1235, h=380, seed=8, t1=e, sha=0.35)
    # clock floating top-right, orbit dotted ellipse
    if A.get("clock") is not None and t > T(28) - 0.2:
        cx, cy = 800 + 10 * math.sin(t * 1.4), 650 + 12 * math.sin(t * 1.9)
        hero(fr, "clock", t, T(28) - 0.2, cx, cy, w=200, seed=9, sh=False, rot=4 * math.sin(t * 9) * (t > T(28)), t1=e, anchor="c")
    # a fly circling the empty shop
    if t > 10.6:
        th = (t - 10.6) * 3.1
        fx, fy = 560 + 260 * math.cos(th), 860 + 90 * math.sin(th * 1.3)
        if A.get("flyimg") is not None:
            if "fly_s" not in _fitc:
                _fitc["fly_s"] = mg.fit(A["flyimg"], 110)
            ang = math.degrees(math.atan2(90 * 1.3 * math.cos(th * 1.3), -260 * math.sin(th)))
            mg.place(fr, _fitc["fly_s"], fx, fy, 1, -ang, exit_k(t, e) * cl((t - 10.6) / 0.2))
        else:
            fly(fr, fx, fy, t, a=exit_k(t, e))
    conn(fr, t, "aur doosri…", X0, TOPC, T(25), TE(26), tend=e)
    conn(fr, t, "bas", X0, BOTB - 255, T(27), TE(27), tend=e)
    word(fr, t, "INTEZAAR", X0, BOTB, T(28), TE(28), size=240, tend=e)
    conn(fr, t, "karti rahi.", 984, BOTB + 90, T(29), TE(30), anchor="r", tend=e)


@scene(13.35, 15.25)
def s5(fr, t):
    e = 15.25
    hero(fr, "laddoo", t, 13.35, 540, 1240, w=520, seed=11, t1=e, drift=0.02)
    if A.get("magnifier") is not None and t > 13.5:
        k = (t - 13.5) / 1.6
        mx = 340 + 380 * eio(k)
        my = 900 - 120 * math.sin(math.pi * cl(k))
        hero(fr, "magnifier", t, 13.5, mx, my, w=440, seed=12, sh=False, rot=-15 + 25 * eio(k), t1=e, anchor="c")
    word(fr, t, "FARK?", X0, TOPB, T(31), TE(31), size=250, tend=e)
    conn(fr, t, "mithai mein", X0, BOTB, T(32), TE(33), size=62, tend=e)
    word(fr, t, "NAHI THA", X0 + mg.text_width("mithai mein", "c", 62) + 24, BOTB, T(34), TE(35), style="M", size=180, colour=BLUE, tend=e)


@scene(15.25, 18.45)
def s6(fr, t):
    e = 18.45
    hero(fr, "brain", t, 15.25, 560, 1250, w=640, seed=13, t1=e, drift=0.012)
    # the queue shop flies into the brain and lights up on "YAAD"
    if A.get("shop") is not None and t > T(38):
        k = eo((t - T(38)) / (T(40) - T(38) + 0.15))
        x = 1000 - (1000 - 560) * k
        y = 1500 - (1500 - 950) * k
        s = 0.55 - 0.25 * k
        if "shop_small" not in _fitc:
            _fitc["shop_small"] = mg.fit(A["shop"], 400)
        if t > T(40):
            mg.glow(fr, 560, 930, 260, (255, 255, 255), 0.85 * cl((t - T(40)) / 0.2) * exit_k(t, e))
        mg.place(fr, _fitc["shop_small"], x, y, s, -8 * (1 - k), exit_k(t, e))
    if t > T(40):
        for j in range(2):
            k = (t - T(40) - j * 0.18) / 0.7
            if 0 < k < 1:
                mg.ring(fr, 560, 930, 90 + 420 * eo(k), 4, a=0.85 * (1 - k))
    conn(fr, t, "fark tha…", X0, TOPC, T(36), TE(37), tend=e)
    conn(fr, t, "logon ko", X0, BOTB - 255, T(38), TE(39), tend=e)
    word(fr, t, "YAAD", X0, BOTB, T(40), TE(40), size=260, colour=BLUE, tend=e)
    conn(fr, t, "kaun raha.", X0 + mg.text_width("YAAD", "B", 260) + 24, BOTB, T(41), TE(42), size=62, tend=e)


PHONE = {}


def phone_layer(fr, t, cx, cy, s, content, a=1.0):
    """phone + screen content callback content(screen_img, t) drawing into a (sh,sw,3) float image"""
    ph = PHONE["spr"]
    x0, y0, x1, y1, r = PHONE["screen"]
    sw, sh = x1 - x0, y1 - y0
    scr = np.zeros((sh, sw, 3), np.float32) + np.array((226, 234, 255), np.float32)
    content(scr, t)
    spr = ph.copy()
    m = PHONE["mask"]
    spr[y0:y1, x0:x1, :3] = spr[y0:y1, x0:x1, :3] * (1 - m) + scr * m
    spr[y0:y1, x0:x1, 3:4] = np.maximum(spr[y0:y1, x0:x1, 3:4], m)
    mg.shadow(fr, cx, cy + ph.shape[0] * s / 2 + 10, ph.shape[1] * s * 1.1, 0.4 * a)
    mg.place(fr, spr, cx, cy, s, 0, a)


def scr_place(scr, spr, cx, cy, s=1.0, a=1.0):
    """place sprite into a screen buffer (temporarily treat as frame)"""
    h, w = scr.shape[:2]
    big = np.zeros((h, w, 3), np.float32)
    # reuse mg.place by temporarily swapping globals is messy; do a direct composite
    sp = cv2.resize(spr, (max(1, int(spr.shape[1] * s)), max(1, int(spr.shape[0] * s))), interpolation=cv2.INTER_AREA)
    sh_, sw_ = sp.shape[:2]
    x0, y0 = int(cx - sw_ / 2), int(cy - sh_ / 2)
    X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(w, x0 + sw_), min(h, y0 + sh_)
    if X1 <= X0 or Y1 <= Y0:
        return
    sub = sp[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
    scr[Y0:Y1, X0:X1] = scr[Y0:Y1, X0:X1] * (1 - sub[..., 3:4] * a) + sub[..., :3] * a


@scene(18.45, 22.25)
def s7(fr, t):
    e = 22.25
    tp = T(49) - 0.1        # "आपके" → lane shrinks into the phone
    k = eio((t - tp) / 0.7)
    if t < tp + 0.7:
        # the lane: both shops
        a_l = 1 - cl((t - tp) / 0.7)
        s_l = 1 - 0.45 * k
        hero(fr, "shop", t, 18.45, 540 - 240 * s_l, 1150 - 120 * k, w=int(440 * max(0.55, s_l)), seed=21, a=a_l)
        hero(fr, "shop2", t, 18.6, 540 + 240 * s_l, 1150 - 120 * k, w=int(440 * max(0.55, s_l)), seed=22, a=a_l)
    if t > tp:
        def content(scr, tt):
            sh_, sw_ = scr.shape[:2]
            for nm, x in (("shop", sw_ * 0.28), ("shop2", sw_ * 0.72)):
                if A.get(nm) is not None:
                    if ("ph_" + nm) not in _fitc:
                        _fitc["ph_" + nm] = mg.fit(A[nm], int(sw_ * 0.44))
                    scr_place(scr, _fitc["ph_" + nm], x, sh_ * 0.55)
        s = 1.25 - 0.25 * eo((t - tp) / 0.6)
        phone_layer(fr, t, 540, 965, s * 0.70, content, a=cl((t - tp) / 0.25) * exit_k(t, e + 10))
    if t > tp + 0.6:
        rng = np.random.default_rng(9)
        for j in range(9):
            t0j = tp + 0.6 + j * 0.13
            k = (t - t0j) / 1.1
            if 0 < k < 1:
                x = 540 + rng.uniform(-170, 170) + 30 * math.sin(k * 6 + j)
                y = 880 - 260 * eo(k)
                mg.ring(fr, x, y, 16 + 6 * k, 5, (255, 255, 255), 0.85 * (1 - k))
                mg.glow(fr, x, y, 18, (255, 255, 255), 0.5 * (1 - k))
    conn(fr, t, "aaj ye ladaai", X0, TOPC, T(43), TE(45), tend=e)
    word(fr, t, "GALI MEIN NAHI", X0, TOPB, T(46), TE(48), style="M", size=150, tend=e)
    if t > TE(48) - 0.1:
        k2 = eo((t - TE(48) + 0.1) / 0.25)
        wdt = mg.text_width("GALI MEIN NAHI", "M", 150)
        mg.line(fr, (X0 - 10, TOPB - 98), (X0 - 10 + (wdt + 20) * k2, TOPB - 98), 7, BLUE, exit_k(t, e))
    word(fr, t, "AAPKE PHONE PAR", X0, BOTB + 40, T(49), TE(51), size=200, tend=e)
    conn(fr, t, "hoti hai.", 984, BOTB + 120, T(52), TE(53), anchor="r", tend=e)


REELS = ["shop", "laddoo", "brain", "coins", "camera", "shop2", "clock", "scale"]


@scene(22.25, 24.3)
def s8(fr, t):
    e = 24.3
    swipes = [T(54), T(55), T(56), T(57), T(58)]

    def content(scr, tt):
        sh_, sw_ = scr.shape[:2]
        pos = sum(eio((tt - s0) / 0.28) for s0 in swipes)
        for i, nm in enumerate([n for n in REELS if A.get(n) is not None]):
            yc = sh_ / 2 + (i - pos) * sh_
            if -sh_ < yc < 2 * sh_:
                # card background tint alternates
                y0, y1 = int(max(0, yc - sh_ / 2)), int(min(sh_, yc + sh_ / 2))
                if y1 > y0:
                    scr[y0:y1] = np.array((214, 226, 255) if i % 2 else (232, 238, 255), np.float32)
                spr = A.get(nm)
                if spr is not None:
                    key = "reel_" + nm
                    if key not in _fitc:
                        _fitc[key] = mg.fit(spr, int(sw_ * 0.8), int(sh_ * 0.5))
                    scr_place(scr, _fitc[key], sw_ / 2, yc)
                # tiny UI: heart + bars
                for j in range(3):
                    cv2.circle(scr, (int(sw_ * 0.88), int(yc + sh_ * 0.12 + j * 54)), 14, (120, 140, 210), -1, cv2.LINE_AA)
                cv2.rectangle(scr, (int(sw_ * 0.08), int(yc + sh_ * 0.36)), (int(sw_ * 0.6), int(yc + sh_ * 0.36) + 14), (120, 140, 210), -1)
                cv2.rectangle(scr, (int(sw_ * 0.08), int(yc + sh_ * 0.40)), (int(sw_ * 0.42), int(yc + sh_ * 0.40) + 12), (150, 168, 225), -1)
    phone_layer(fr, t, 540, 965, 0.70, content, a=exit_k(t, e))
    # thumb swipe indicator
    for s0 in swipes:
        k = (t - s0) / 0.3
        if 0 < k < 1:
            y = 1150 - 300 * eio(k)
            mg.glow(fr, 600, y, 70, (255, 255, 255), 0.7 * (1 - k))
            mg.ring(fr, 600, y, 34, 4, (255, 255, 255), 0.9 * (1 - k))
    word(fr, t, "HAR DIN.", X0, TOPB, T(54), TE(55), size=200, tend=e)
    word(fr, t, "HAR SCROLL PAR.", X0, BOTB + 40, T(56), TE(58), size=200, colour=BLUE, tend=e)


@scene(24.3, 27.4)
def s9(fr, t):
    e = 27.4
    # spotlight: darken world except a cone on the shop
    on = cl((t - T(60)) / 0.15)
    if on > 0:
        if "cone" not in _fitc:
            m = np.zeros((H // 4, W // 4), np.float32)
            pts = np.array([[150, 470], [205, 430], [790, 1090], [270, 1300]], np.float32) / 4
            cv2.fillConvexPoly(m, pts.astype(np.int32), 1.0, cv2.LINE_AA)
            cv2.ellipse(m, (540 // 4, 1180 // 4), (330 // 4, 90 // 4), 0, 0, 360, 1.0, -1)
            m = cv2.GaussianBlur(m, (0, 0), 9)
            _fitc["cone"] = cv2.resize(m, (W, H))[..., None]
        cone = _fitc["cone"]
        dim = 0.55 * on * exit_k(t, e)
        fr *= (1 - dim) + dim * cone * 1.0
        fr += (cone * np.array((255, 250, 235), np.float32)) * 0.16 * on * exit_k(t, e)
    hero(fr, "shop", t, 24.3, 540, 1200, w=520, seed=31, t1=e, drift=0.012)
    if A.get("spotlight") is not None:
        hero(fr, "spotlight", t, T(60) - 0.25, 180, 470, w=260, seed=32, sh=False, rot=-28, t1=e, anchor="c")
    # coin rain onto the shop on "बिकता"
    tc = T(64) - 0.1
    if t > tc:
        rng = np.random.default_rng(5)
        for j in range(26):
            d = rng.uniform(0, 0.9)
            x = 540 + rng.uniform(-260, 260)
            r = int(rng.uniform(16, 30))
            k = (t - tc - d)
            if k < 0:
                continue
            y = 500 + 2600 * k * k
            land = 1215 - rng.uniform(0, 80)
            if y > land:
                y = land
            coin(fr, x, y, r, (t + j) * 7 if y < land else 0.3, exit_k(t, e))
    lt = (255, 255, 255) if t > T(60) else INK
    conn(fr, t, "kyunki…", X0, TOPC, T(59), TE(59), tend=e, colour=lt)
    word(fr, t, "JO DIKHTA HAI,", X0, TOPB, T(60), TE(62), size=200, tend=e, colour=lt)
    word(fr, t, "WAHI BIKTA HAI.", X0, BOTB + 40, T(63), TE(65), size=210, colour=GOLD, tend=e)


@scene(27.4, 30.4)
def s10(fr, t):
    e = 30.4
    cx, cy = 540, 930
    lw = A["logo_w"]
    order = [("logo_F1", T(66), (-500, 0), 0), ("logo_amp", T(66) + 0.35, (0, 0), 1), ("logo_F2", T(67) + 0.05, (500, 0), 0)]
    for nm, t0, off, spin in order:
        if t < t0:
            continue
        k = (t - t0) / 0.42
        x = cx + off[0] * (1 - eo(k))
        s = (eb(k) if spin else 1.0)
        rot = (1 - eo(k)) * (-90 if spin else 0)
        mg.place(fr, A[nm], x, cy, max(0.01, s) * (1 + 0.012 * (t - 27.4)), rot, cl(k * 3) * exit_k(t, e))
    if t > T(67) + 0.3:
        k = (t - T(67) - 0.3) / 0.8
        if k < 1:
            mg.ring(fr, cx, cy, 200 + 500 * eo(k), 5, a=0.8 * (1 - k))
        mg.dotted_ellipse(fr, cx, cy + 10, lw * 0.62, 120, phase=t * 0.8, a=0.8 * cl(k) * exit_k(t, e))
    word(fr, t, "Frame & Fame", cx, cy + 330, T(68), TE(70), style="M", size=140, anchor="c", tend=e)
    conn(fr, t, "aapki pehchaan, humari kahaani", cx, cy + 420, TE(70) + 0.1, TE(70) + 0.4, size=50, anchor="c", tend=e)


FILM = ["shop", "laddoo", "coins", "brain", "shop2", "scale", "clock", "shop"]


@scene(30.4, 35.05)
def s11(fr, t):
    e = 35.05
    cx, cy = 560, 1010
    hero(fr, "shop", t, 30.4, cx, 1150, w=440, seed=41, t1=e, drift=0.01)
    if A.get("camera") is not None:
        hero(fr, "camera", t, T(72), 830 + 8 * math.sin(t * 1.5), 700 + 10 * math.sin(t * 2.1), w=260, seed=42, sh=False, t1=e, anchor="c", rot=8)
    # film strip orbiting the shop
    if t > T(73):
        if "film" not in _fitc:
            _fitc["film"] = [film_frame(A.get(n)) for n in FILM]
        k_in = eo((t - T(73)) / 0.6)
        n = len(FILM)
        cells = []
        for i in range(n):
            th = 2 * math.pi * i / n + (t - T(73)) * 0.9
            x = cx + 470 * math.cos(th) * k_in
            y = cy + 120 * math.sin(th) * k_in - 40
            depth = math.sin(th)
            cells.append((depth, x, y, th, i))
        for depth, x, y, th, i in sorted(cells):
            s = 0.75 + 0.25 * (depth + 1) / 2
            mg.place(fr, _fitc["film"][i], x, y, s * k_in, -math.degrees(math.cos(th)) * 0.2, (0.55 + 0.45 * (depth + 1) / 2) * exit_k(t, e))
    conn(fr, t, "hum aapke business ko", X0, TOPC, T(71), TE(74), tend=e)
    conn(fr, t, "wo", X0, TOPB - 20, T(75), TE(75), size=60, tend=e)
    word(fr, t, "KAHAANI", X0 + mg.text_width("wo", "c", 60) + 22, TOPB + 10, T(76), TE(76), size=240, tend=e)
    conn(fr, t, "dete hain, jise log", X0, TOPB + 95, T(77), TE(80), tend=e)
    word(fr, t, "BHOOL NAHI PAATE.", X0, BOTB + 30, T(81), TE(83), size=210, colour=BLUE, tend=e)


@scene(35.05, END)
def s12(fr, t):
    e = END
    # outro: telephone rings, number, then darken to navy with the IG handle
    dark = eio((t - 37.9) / 0.6)
    ring_t = t - 35.15
    rot = 0
    if ring_t > 0 and (ring_t % 1.2) < 0.55:
        rot = 7 * math.sin(ring_t * 60)
    hero(fr, "telephone", t, 35.05, 540, 1120, w=560, seed=51, rot=rot, a=1 - dark)
    if ring_t > 0 and (ring_t % 1.2) < 0.55 and dark < 1:
        for j, (dx, sgn) in enumerate([(-260, -1), (260, 1)]):
            for q in range(2):
                r = 40 + q * 34
                mg.ring(fr, 540 + dx * 0.9, 900, r, 5, INK, 0.0)
        for q in range(3):
            k = ((ring_t % 1.2) / 0.55 + q / 3) % 1
            mg.ring(fr, 540, 900, 230 + 160 * k, 4, (255, 255, 255), 0.7 * (1 - k) * (1 - dark))
    word(fr, t, "AAJ HI BAAT KIJIYE.", X0, TOPB, T(84), TE(87), size=190, tend=37.9)
    word(fr, t, "70862 69537", 540, BOTB - 60, 36.15, 36.9, style="B", size=200, anchor="c", colour=BLUE, tend=37.9)
    conn(fr, t, "frameandfame.in", 540, BOTB + 20, 36.9, 37.3, size=58, anchor="c", tend=37.9)
    if dark > 0:
        fr *= (1 - dark * 0.9)
        fr += dark * 0.9 * np.array((8, 16, 48), np.float32)
        a = cl((t - 38.0) / 0.3)
        sc = (0.6 * eb((t - 38.0) / 0.45) if t < 38.45 else 0.6) * (1 + 0.03 * (t - 38.0))
        if "logo_F1_w" in A and t > 38.0:
            mg.place(fr, A["logo_F1_w"], 540, 850, sc, 0, a)
            mg.dotted_ellipse(fr, 540, 860, A["logo_w"] * 0.42, 80, phase=t * 0.8, colour=(150, 185, 255), a=0.7 * a)
        b = cl((t - 38.3) / 0.25)
        mg.place(fr, A["ig_w"], 540, 1060 + 20 * (1 - eo(b)), 1.0, 0, b)
        mg.put_text(fr, "@frameandfame.in_", 540, 1170 + 20 * (1 - eo(b)), "M", 96, (255, 255, 255), b, "c")
        c = cl((t - 38.55) / 0.25)
        mg.put_text(fr, "70862 69537  ·  frameandfame.in", 540, 1270, "M", 64, (150, 185, 255), c, "c")


# ------------------------------------------------------------------ frame
BG = GRAIN = None


def init():
    global BG, GRAIN
    assets()
    BG = mg.make_bg()
    GRAIN = mg.make_grain()
    ph = vec_phone(470, 960)
    PHONE["spr"] = ph
    x0, y0, x1, y1 = 18, 18, 470 - 18, 960 - 18
    PHONE["screen"] = (x0, y0, x1, y1, 52)
    PHONE["mask"] = screen_mask(x1 - x0, y1 - y0, 52)
    # white logo for the outro (all pieces white + blue amp)
    if "logo_F1" in A:
        sprs = [A["logo_F1"], A["logo_amp"], A["logo_F2"]]
        out = np.zeros_like(sprs[0])
        for sp, col in zip(sprs, [(255, 255, 255), mg.BLUE, (255, 255, 255)]):
            al = sp[..., 3:4]
            out[..., :3] = out[..., :3] * (1 - al) + np.array(col, np.float32) * al
            out[..., 3:4] = np.maximum(out[..., 3:4], al)
        A["logo_F1_w"] = out


def frame(t, i):
    fr = BG.copy()
    for (t0, t1, f) in SC:
        if t0 <= t < t1:
            f(fr, t)
    # handle top-right (ref16 keeps the creator's IG tag on screen)
    if t < 37.9:
        mg.place(fr, A["ig"], 900, 268, 0.8, 0, 0.8)
        mg.put_text(fr, "@FRAMEANDFAME.IN_", 900, 318, "M", 30, INK, 0.7, "c")
    fr += GRAIN[i % len(GRAIN)]
    return np.clip(fr, 0, 255).astype(np.uint8)[..., ::-1]


if __name__ == "__main__":
    a = sys.argv[1:]
    init()
    os.makedirs(os.path.join(HERE, "work"), exist_ok=True)
    if "--stills" in a:
        ts = [float(x) for x in a[a.index("--stills") + 1:]]
        for t in ts:
            cv2.imwrite(os.path.join(HERE, "work", f"st_{t:05.2f}.jpg"), frame(t, int(t * FPS)), [cv2.IMWRITE_JPEG_QUALITY, 88])
        sys.exit()
    k, n = (int(a[a.index("--part") + 1]), int(a[a.index("--part") + 2])) if "--part" in a else (0, 1)
    total = int(END * FPS); lo, hi = total * k // n, total * (k + 1) // n
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-pix_fmt", "yuv420p",
                            os.path.join(HERE, "work", f"part{k}.mp4")], stdin=subprocess.PIPE)
    for i in range(lo, hi):
        enc.stdin.write(frame(i / FPS, i).tobytes())
        if (i - lo) % 90 == 0:
            print(k, i, file=sys.stderr, flush=True)
    enc.stdin.close(); enc.wait()
