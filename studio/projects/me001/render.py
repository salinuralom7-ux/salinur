#!/usr/bin/env python3
"""Money Explained #001 — Lifestyle Creep. Clean, bold, high-contrast explainer (Salinur: "nothing faint, nothing complex").
Look: deep navy stage + gold light, full-colour cut-outs on a soft gold floor light, Anton caps (white/gold/green/red),
Inter Medium Italic connectives in cream at full opacity. One idea per scene.
Usage: render.py --stills t ... | --part k N
"""
import math, os, subprocess, sys
import numpy as np, cv2
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "tools"))
import mg, mgx
from mg import W, H, cl, eo, eio, eb, spring

FPS = 30
END = 42.6
WHITE, CREAM = (255, 255, 255), (246, 236, 214)
GOLD, GOLD_HI = (245, 197, 66), (255, 226, 140)
GREEN, RED = (46, 214, 123), (255, 82, 82)
NAVY = (12, 18, 40)
IMG = os.path.join(HERE, "work", "img")
BRAND = os.path.join(HERE, "..", "..", "pages", "money_explained", "brand")

A, _c = {}, {}


def load():
    for n, w in [("wallet", 760), ("moth", 400), ("bike", 700), ("car", 760), ("chai", 580), ("coffee", 600), ("piggy", 420), ("coins", 340)]:
        p = os.path.join(IMG, n + ".png")
        if os.path.exists(p):
            sp = mg.load_cut(p, 1200, tone=False)
            al = np.clip((sp[..., 3:4] - 0.45) / 0.4, 0, 1)          # drop rembg's half-transparent leftovers
            sp = np.concatenate([sp[..., :3] / np.maximum(sp[..., 3:4], 1e-3) * al, al], axis=2).astype(np.float32)
            ys, xs = np.where(al[..., 0] > 0.05)
            sp = sp[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            A[n] = mg.fit(sp, w, w)
    A["mark"] = mg.fit(mg.to_sprite(np.array(Image.open(os.path.join(BRAND, "mark_transparent.png")).convert("RGBA"))), 460, 460)
    A["mark_s"] = mg.fit(A["mark"], 170, 170)
    A["plane"] = mgx.paper_plane(130)
    A["hand"] = mgx.hand_tap(150)
    A["check"] = mgx.check_mark(70, (255, 255, 255, 255))
    A["check_big"] = mgx.check_mark(150, (255, 255, 255, 255))


# ------------------------------------------------------------------ background: navy stage, gold top light, dust
def make_bg():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - 540) / 1.0) ** 2 + ((yy - 860) / 1.1) ** 2) / 1300
    bg = np.zeros((H, W, 3), np.float32)
    for k, (ci, cm, co) in enumerate(zip((34, 46, 92), (16, 24, 54), (5, 8, 20))):
        bg[..., k] = np.interp(d, [0, 0.45, 1], [ci, cm, co])
    return bg


rng = np.random.default_rng(4)
DUST = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(2.0, 4.5), rng.uniform(12, 40), rng.uniform(0, 6.28)) for _ in range(34)]


def dust(fr, t):
    for x, y, r, v, ph in DUST:
        yy = (y - v * t) % H
        xx = x + 14 * math.sin(t * 0.7 + ph)
        mgx.dot(fr, xx, yy, r, GOLD_HI, 0.35 + 0.2 * math.sin(t * 2 + ph))


def floor(fr, x, y, w, a=1.0):
    mg.place(fr, _floor_spr(int(w)), x, y, 1, 0, a)


def _floor_spr(w):
    key = ("floor", w)
    if key not in _c:
        h = max(8, w // 2)
        m = np.zeros((h * 2, w * 2), np.float32)
        cv2.ellipse(m, (w, h), (int(w * 0.42), int(w * 0.06)), 0, 0, 360, 1.0, -1)
        m = cv2.GaussianBlur(m, (0, 0), w * 0.08)
        m = m / max(1e-6, m.max()) * 0.5
        _c[key] = np.dstack([m * GOLD[0], m * GOLD[1], m * GOLD[2], m]).astype(np.float32)
    return _c[key]


# ------------------------------------------------------------------ element helpers
def pop_k(t, t0, d=0.32):
    """scale (overshoot) and alpha for a pop-in starting at t0"""
    k = (t - t0) / d
    if k <= 0:
        return 0.0, 0.0
    return eb(k, 2.2), cl(k * 3)


def out_k(t, t1, d=0.18):
    if t1 is None:
        return 1.0
    return cl((t1 - t) / d)


def obj(fr, name, t, t0, x, y, t1=None, rot=0.0, flo=6.0, light=True, s_mul=1.0):
    """object cut-out standing on a gold floor light; (x,y) = bottom centre"""
    sp = A.get(name)
    if sp is None or t < t0:
        return
    s, a = pop_k(t, t0)
    ko = out_k(t, t1)
    a *= ko
    s = s * (0.8 + 0.2 * ko) * s_mul
    if a <= 0:
        return
    h, w = sp.shape[:2]
    yf = y + flo * math.sin((t - t0) * 2.2)
    if light:
        floor(fr, x, y + 6, w * 1.15 * s_mul, a)
        mg.glow(fr, x, yf - h * s * 0.5, max(w, h) * 0.55 * s_mul, GOLD, 0.16 * a)
    mg.place(fr, sp, x, yf - h * s / 2, s, rot, a)


def txt(fr, t, text, x, yb, t0, size=200, colour=WHITE, style="B", anchor="c", t1=None, maxw=940):
    if t < t0 or not text:
        return
    full = mg.text_width(text, style, size)
    if full > maxw:
        size = int(size * maxw / full)
    k = (t - t0) / 0.22
    pop = 1.0 + 0.22 * (1 - eo(k)) if k < 1 else 1.0
    a = cl(k * 4) * out_k(t, t1)
    mg.put_text(fr, text, x, yb, style, size, colour, a, anchor, False, pop)


def small(fr, t, text, x, yb, t0, size=66, colour=CREAM, anchor="c", t1=None):
    txt(fr, t, text, x, yb, t0, size, colour, "C", anchor, t1)


def ring_burst(fr, t, t0, x, y, r0=80, r1=520, colour=WHITE, n=2, th=6):
    for j in range(n):
        k = (t - t0 - j * 0.12) / 0.6
        if 0 < k < 1:
            mg.ring(fr, x, y, r0 + (r1 - r0) * eo(k), th, colour, 0.9 * (1 - k))


SHAKES = []      # (t0, dur, amp)


# ------------------------------------------------------------------ scenes
SC = []


def scene(t0, t1):
    def d(f):
        SC.append((t0, t1, f)); return f
    return d


def counter_val(t):
    if t < 0.7:
        return 20000 * eo(t / 0.7)
    return 20000 + 40000 * eo((t - 3.95) / 0.85) if t > 3.95 else 20000


def moth(fr, t, t0, x0, y0):
    if t < t0 or "moth" not in A:
        return
    k = (t - t0) / 1.5
    if k > 1:
        return
    x = x0 + 330 * k + 40 * math.sin(k * 14)
    y = y0 - 560 * eo(k) + 30 * math.sin(k * 9)
    flap = 0.55 + 0.45 * abs(math.sin(t * 26))
    sp = A["moth"]
    key = ("moth", round(flap, 2))
    if key not in _c:
        _c[key] = cv2.resize(sp, (sp.shape[1], max(2, int(sp.shape[0] * flap))))
    mg.place(fr, _c[key], x, y, 1.0, -20 + 25 * k, cl((1 - k) * 4) * cl(k * 8))


@scene(0.0, 7.62)
def s_hook(fr, t):
    e = 7.62
    small(fr, t, "salary", 540, 330, -1, 72, CREAM, t1=e)
    v = counter_val(t)
    rolling = 3.95 < t < 4.85 or t < 0.7
    col = GREEN if rolling else GOLD
    # rolling digits get a small vertical jitter = slot-machine feel
    jit = 6 * math.sin(t * 90) if rolling else 0
    txt(fr, t, "₹" + mgx.inr(v), 540, 590 + jit, -1, 250, col, t1=e)
    if 4.85 < t < 5.4:
        ring_burst(fr, t, 4.85, 540, 500, 120, 460, GOLD, 1)
    if 0.7 < t < 1.3:
        ring_burst(fr, t, 0.7, 540, 500, 120, 460, GOLD, 1)
    # wallet: there from frame 1, shakes on "paise khatam"
    rot = 0
    for ts in (3.02, 6.76):
        if ts < t < ts + 0.45:
            rot = 6 * math.sin((t - ts) * 50) * (1 - (t - ts) / 0.45)
    obj(fr, "wallet", t, -0.5, 540, 1190, t1=e, rot=rot)
    moth(fr, t, 3.05, 520, 1050)
    moth(fr, t, 6.80, 560, 1050)
    # verdicts
    small(fr, t, "month end", 540, 1345, 3.02, 70, CREAM, t1=3.9)
    txt(fr, t, "₹0", 540, 1530, 3.25, 220, RED, t1=3.9)
    small(fr, t, "month end", 540, 1345, 6.76, 70, CREAM, t1=e)
    txt(fr, t, "STILL ₹0", 540, 1530, 7.0, 200, RED, t1=e)


@scene(7.62, 8.5)
def s_why(fr, t):
    e = 8.5
    ring_burst(fr, t, 7.66, 540, 980, 100, 700, GOLD, 2, 8)
    txt(fr, t, "AISA", 540, 900, 7.66, 230, WHITE, t1=e)
    txt(fr, t, "KYUN?", 540, 1230, 7.9, 330, GOLD, t1=e)


@scene(8.5, 10.6)
def s_name(fr, t):
    e = 10.6
    small(fr, t, "ise kehte hain", 540, 760, 8.52, 90, CREAM, t1=e)
    txt(fr, t, "LIFESTYLE", 540, 1000, 9.3, 220, WHITE, t1=e)
    txt(fr, t, "CREEP", 540, 1290, 9.6, 300, GOLD, t1=e)
    if t > 9.9:
        k = eo((t - 9.9) / 0.4)
        wd = mg.text_width("CREEP", "B", 300)
        mg.line(fr, (540 - wd / 2 * k, 1345), (540 + wd / 2 * k, 1345), 12, GOLD, out_k(t, e))
    ring_burst(fr, t, 9.75, 540, 1150, 150, 650, GOLD, 1)


GX0, GY0, GX1, GY1 = 140, 1300, 940, 820     # graph box (origin bottom-left)


def gpt(u, f):
    return GX0 + (GX1 - GX0) * u, GY0 - (GY0 - GY1) * f


def income(u):
    return 0.12 + 0.80 * u + 0.03 * math.sin(u * 12)


def expense(u):
    return 0.03 + 0.86 * u ** 1.7


@scene(10.6, 15.6)
def s_graph(fr, t):
    e = 15.6
    a = cl((t - 10.6) / 0.25) * out_k(t, e)
    mg.line(fr, (GX0, GY0), (GX1 + 20, GY0), 5, CREAM, a)
    mg.line(fr, (GX0, GY0), (GX0, GY1 - 40), 5, CREAM, a)
    small(fr, t, "jaise jaise", 540, 300, 10.65, 66, CREAM, t1=e)
    txt(fr, t, "KAMAI BADHI", 540, 500, 11.3, 170, GOLD, t1=e)
    txt(fr, t, "KHARCHE BHI", 540, 680, 12.5, 170, RED, t1=e)
    # income line
    ku = eio((t - 11.2) / 1.2)
    if ku > 0:
        pts = [gpt(u, income(u)) for u in np.linspace(0, ku, 40)]
        mgx.polyline(fr, pts, 11, GOLD, a)
        mgx.dot(fr, pts[-1][0], pts[-1][1], 16, GOLD, a)
        if ku > 0.5:
            lx, ly = gpt(0.45, income(0.45))
            mg.put_text(fr, "KAMAI", lx - 10, ly - 30, "B", 64, GOLD, a * cl((ku - 0.5) * 5), "r")
    # expense line creeping behind
    ke = eio((t - 12.5) / 2.2)
    if ke > 0:
        pts = [gpt(u, expense(u)) for u in np.linspace(0, ke, 40)]
        mgx.polyline(fr, pts, 11, RED, a)
        mgx.dot(fr, pts[-1][0], pts[-1][1], 16, RED, a)
        if ke > 0.6:
            lx, ly = gpt(0.62, expense(0.62))
            mg.put_text(fr, "KHARCHE", lx + 20, ly + 80, "B", 64, RED, a * cl((ke - 0.6) * 5), "l")
    # comment prompt (engagement)
    if t > 13.5:
        s, al = pop_k(t, 13.5, 0.4)
        al *= out_k(t, e)
        wob = 2.5 * math.sin((t - 13.5) * 9) * math.exp(-(t - 13.5) * 1.5)
        mg.place(fr, mgx.pill(940, 140, (255, 255, 255, 255)), 540, 1470, s, wob, al)
        mg.put_text(fr, "COMMENT \"SAME\" IF THIS IS YOU", 540, 1497, "B", 66, NAVY, al, "c", False, s)


def swap(fr, t, first, second, t_a, t_b, t1, x=540, y=1260):
    """first object, then at t_b it pops out and the second pops in (flash ring)"""
    if t < t_b:
        obj(fr, first, t, t_a, x, y, t1=t_b + 0.12)
    else:
        obj(fr, first, t, t_a, x, y, t1=t_b + 0.12)
        obj(fr, second, t, t_b, x, y, t1=t1)
        ring_burst(fr, t, t_b, x, y - 260, 120, 520, GOLD, 1)


def title_pair(fr, t, w1, w2, t1_, t2_, e, c2=GOLD, y=470):
    """BIG w1  small 'se'  BIG w2 — composed centred"""
    size = 170
    a1 = mg.text_width(w1, "B", size); a2 = mg.text_width("se", "C", 70); a3 = mg.text_width(w2, "B", size)
    gap = 26
    tot = a1 + a2 + a3 + 2 * gap
    x = 540 - tot / 2
    txt(fr, t, w1, x, y, t1_, size, WHITE, anchor="l", t1=e)
    small(fr, t, "se", x + a1 + gap, y, t1_ + 0.15, 70, CREAM, anchor="l", t1=e)
    txt(fr, t, w2, x + a1 + a2 + 2 * gap, y, t2_, size, c2, anchor="l", t1=e)


@scene(15.6, 16.78)
def s_bike(fr, t):
    title_pair(fr, t, "BIKE", "CAR", 15.69, 16.2, 16.78)
    swap(fr, t, "bike", "car", 15.69, 16.2, 16.78)


@scene(16.78, 17.95)
def s_chai(fr, t):
    title_pair(fr, t, "CHAI", "COFFEE", 16.85, 18.0, 17.95)
    obj(fr, "chai", t, 16.82, 540, 1260, t1=17.95)


@scene(17.95, 18.95)
def s_coffee(fr, t):
    title_pair(fr, t, "CHAI", "COFFEE", 16.85, 18.0, 18.95)
    obj(fr, "coffee", t, 17.97, 540, 1260, t1=18.95)
    ring_burst(fr, t, 17.97, 540, 1000, 120, 520, GOLD, 1)


def phone_spr(w, h, edge, screen, notch=True):
    key = ("phone", w, h, edge, screen)
    if key not in _c:
        from PIL import ImageDraw
        im = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), radius=int(w * 0.28), fill=edge + (255,))
        d.rounded_rectangle((18, 18, w * 2 - 19, h * 2 - 19), radius=int(w * 0.25), fill=screen + (255,))
        if notch:
            d.rounded_rectangle((w * 0.75, 40, w * 1.25, 72), radius=16, fill=edge + (255,))
        im = im.resize((w, h), Image.LANCZOS)
        _c[key] = mg.to_sprite(np.array(im))
    return _c[key]


@scene(18.95, 21.25)
def s_phone(fr, t):
    e = 21.25
    txt(fr, t, "PURANA PHONE", 540, 470, 18.98, 170, WHITE, t1=19.94)
    txt(fr, t, "NAYI EMI", 540, 470, 19.94, 200, RED, t1=e)
    if t < 19.94:
        s, a = pop_k(t, 18.98)
        floor(fr, 540, 1266, 420, a)
        mg.place(fr, phone_spr(300, 560, (70, 74, 86), (40, 44, 58)), 540, 1240 - 280, s * 0.95, -6, a * out_k(t, 20.0))
    else:
        s, a = pop_k(t, 19.94)
        a *= out_k(t, e)
        floor(fr, 540, 1266, 460, a)
        mg.glow(fr, 540, 960, 330, GOLD, 0.25 * a)
        mg.place(fr, phone_spr(320, 600, GOLD, (18, 26, 60)), 540, 1240 - 300, s, 0, a)
        mg.place(fr, A["mark_s"], 540, 900, s * 0.9, 0, a)
        ring_burst(fr, t, 19.94, 540, 960, 120, 560, GOLD, 1)
        # red EMI stamp slams onto the phone
        if t > 20.3:
            k = (t - 20.3) / 0.22
            ss = 1.6 - 0.6 * eo(k)
            al = cl(k * 3) * out_k(t, e)
            mg.place(fr, mgx.pill(420, 150, RED + (255,), None, 0, 26), 560, 1090, ss, -12, al)
            mg.put_text(fr, "₹2,999/MONTH", 560, 1122, "B", 74, WHITE, al, "c", False, ss) if False else None
            sp, boff, wd = mg.text_sprite("EMI ₹2,999", "B", 86, WHITE, False)
            mg.place(fr, sp, 560, 1090, ss, -12, al)
    if t > 20.4:
        small(fr, t, "har mahine", 540, 1500, 20.45, 72, CREAM, t1=e)


def runner(fr, cx, cy, t, s=1.0, col=GOLD, a=1.0):
    """pictogram runner: head + limbs as thick lines, simple run cycle"""
    ph = t * 9.0
    hip = (cx, cy - 210 * s + 8 * s * abs(math.sin(ph)))
    neck = (hip[0] + 18 * s, hip[1] - 170 * s)
    mgx.dot(fr, neck[0] + 14 * s, neck[1] - 60 * s, 46 * s, col, a)
    mg.line(fr, hip, neck, 44 * s, col, a)
    for sgn in (1, -1):
        sw = math.sin(ph + (0 if sgn > 0 else math.pi))
        knee = (hip[0] + 70 * s * sw, hip[1] + 100 * s)
        foot = (knee[0] - 40 * s + 50 * s * max(0, -sw), knee[1] + 110 * s - 40 * s * max(0, sw))
        mg.line(fr, hip, knee, 38 * s, col, a); mg.line(fr, knee, foot, 34 * s, col, a)
        elbow = (neck[0] - 60 * s * sw, neck[1] + 80 * s)
        hand = (elbow[0] + 60 * s, elbow[1] - 30 * s * sw + 40 * s)
        mg.line(fr, (neck[0], neck[1] + 20 * s), elbow, 30 * s, col, a); mg.line(fr, elbow, hand, 28 * s, col, a)


@scene(21.25, 24.72)
def s_tread(fr, t):
    e = 24.72
    a = cl((t - 21.25) / 0.25) * out_k(t, e)
    small(fr, t, "aap daud zyada rahe hain…", 540, 330, 21.29, 70, CREAM, t1=e)
    # treadmill: belt with moving stripes, console post with a 0.0 km display
    by = 1240
    floor(fr, 540, by + 40, 760, a)
    mg.place(fr, mgx.pill(760, 70, (30, 34, 48, 255)), 540, by, 1, 0, a)
    off = (t * 420) % 80
    for i in range(12):
        x = 180 + i * 80 - off
        if 175 < x < 905:
            mg.line(fr, (x, by - 18), (x - 20, by + 18), 6, (90, 96, 120), a)
    mg.line(fr, (860, by - 20), (900, 760), 18, (120, 128, 150), a)
    mg.place(fr, mgx.pill(230, 96, (18, 22, 34, 255), None, 0, 18), 880, 740, 1, 0, a)
    mg.put_text(fr, "0.0 KM", 880, 768, "B", 62, RED, a, "c")
    runner(fr, 520, by - 32, t, 1.15, GOLD, a)
    # speed lines behind
    for j in range(4):
        x = 330 - ((t * 900 + j * 160) % 520)
        mg.line(fr, (x, 900 + j * 60), (x - 120, 900 + j * 60), 6, CREAM, 0.6 * a)
    txt(fr, t, "PAHUNCH WAHIN", 540, 1500, 22.98, 170, GOLD, t1=e)


@scene(24.72, 25.98)
def s_fix(fr, t):
    e = 25.98
    s, a = pop_k(t, 24.78)
    a *= out_k(t, e)
    # rotating light rays
    for i in range(12):
        ang = i * math.pi / 6 + t * 0.6
        mg.line(fr, (540 + 140 * math.cos(ang), 760 + 140 * math.sin(ang)), (540 + 360 * math.cos(ang), 760 + 360 * math.sin(ang)), 10, GREEN, 0.35 * a)
    mgx.dot(fr, 540, 760, 130 * s, GREEN, a)
    mg.place(fr, A["check_big"], 540, 765, s, 0, a)
    txt(fr, t, "ILAAJ", 540, 1170, 24.85, 250, GREEN, t1=e)
    txt(fr, t, "AASAAN HAI", 540, 1350, 25.1, 150, WHITE, t1=e)


@scene(25.98, 30.06)
def s_split(fr, t):
    e = 30.06
    small(fr, t, "agli baar salary badhe…", 540, 320, 26.0, 70, CREAM, t1=e)
    s, a = pop_k(t, 26.4)
    a *= out_k(t, e)
    if a > 0:
        mg.place(fr, mgx.pill(560, 130, GREEN + (255,)), 540, 480, s, 0, a)
        mg.put_text(fr, "+₹10,000 RAISE", 540, 512, "B", 84, NAVY, a, "c", False, s)
    tsplit = 28.3
    if t < tsplit:
        obj(fr, "coins", t, 26.5, 540, 1100, t1=tsplit + 0.1)
    else:
        k = eo((t - tsplit) / 0.45)
        xl, xr = 540 - 250 * k, 540 + 250 * k
        into = eio((t - 29.3) / 0.45)        # left stack drops into the piggy bank
        floor(fr, xl, 1106, 320, out_k(t, e)); floor(fr, xr, 1106, 320, out_k(t, e))
        if into < 1:
            mgx.coin_stack(fr, xl, 1100, 6, 60, t, a=(1 - into) * out_k(t, e))
        mgx.coin_stack(fr, xr, 1100, 6, 60, t, a=out_k(t, e))
        obj(fr, "piggy", t, 29.25, xl, 1100, t1=e, light=False, s_mul=0.75)
        txt(fr, t, "₹5,000", xl, 1220, tsplit + 0.2, 96, GREEN, t1=e)
        txt(fr, t, "₹5,000", xr, 1220, tsplit + 0.2, 96, GOLD, t1=e)
        txt(fr, t, "SAVE", xl, 1310, tsplit + 0.3, 84, GREEN, t1=e)
        txt(fr, t, "ENJOY", xr, 1310, tsplit + 0.3, 84, GOLD, t1=e)

    small(fr, t, "badhotri ka aadha", 540, 660, 27.55, 70, CREAM, t1=e)
    txt(fr, t, "PEHLE SAVE", 540, 1530, 29.16, 170, GREEN, t1=e)


@scene(30.06, 32.45)
def s_bars(fr, t):
    e = 32.45
    a = cl((t - 30.06) / 0.25) * out_k(t, e)
    base = 1280
    h1 = 360 * eo((t - 30.2) / 0.8)
    h2 = 560 * eo((t - 31.8) / 0.6)
    floor(fr, 540, base + 10, 700, a)
    mgx.bar(fr, 360, base, 230, max(0, h1), GOLD, a)
    mgx.bar(fr, 720, base, 230, max(0, h2), GREEN, a)
    txt(fr, t, "LIFESTYLE", 360, base + 100, 30.1, 84, GOLD, t1=e)
    txt(fr, t, "PAISA", 720, base + 100, 31.76, 84, GREEN, t1=e)
    txt(fr, t, "LIFESTYLE BHI", 540, 430, 30.1, 150, GOLD, t1=e)
    txt(fr, t, "AUR PAISA BHI", 540, 600, 31.76, 150, GREEN, t1=e)
    if t > 32.0:
        ring_burst(fr, t, 32.0, 720, base - 560, 60, 300, GREEN, 1)


@scene(32.45, 37.7)
def s_share(fr, t):
    e = 37.7
    small(fr, t, "ye video us dost ko", 540, 320, 32.51, 70, CREAM, t1=e)
    txt(fr, t, "SEND THIS", 540, 500, 33.7, 190, WHITE, t1=e)
    s, a = pop_k(t, 32.55)
    a *= out_k(t, e)
    if a > 0:
        cy = 930
        floor(fr, 540, cy + 300, 420, a)
        mg.place(fr, phone_spr(300, 560, GOLD, (18, 26, 60)), 540, cy, s * 1.3, 0, a)
        mg.place(fr, A["mark_s"], 540, cy - 100, s * 1.2, 0, a)
        # share button on the phone
        pulse = 1 + 0.1 * math.sin(t * 10) if t < 33.7 else 1
        mgx.dot(fr, 540, cy + 200, 64 * s * pulse, (40, 120, 254), a)
        mg.place(fr, mgx.paper_plane(70), 540, cy + 200, s, 0, a)
    # paper plane flies out on "bhejiye"
    if t > 33.7:
        k = (t - 33.7) / 1.1
        if k < 1:
            x = 540 + 520 * eio(k)
            y = 1130 - 620 * eio(k) - 120 * math.sin(math.pi * k)
            for j in range(10):
                kk = k - j * 0.035
                if kk > 0:
                    xx = 540 + 520 * eio(kk); yy = 1130 - 620 * eio(kk) - 120 * math.sin(math.pi * kk)
                    mgx.dot(fr, xx, yy, 6, WHITE, 0.7 * (1 - j / 10))
            mg.place(fr, A["plane"], x, y, 1, -25, 1)
    txt(fr, t, "SALARY: BADHTI", 540, 1430, 34.43, 120, GREEN, t1=e)
    txt(fr, t, "SAVINGS: ZERO", 540, 1550, 36.65, 120, RED, t1=e)


@scene(37.7, END + 1)
def s_follow(fr, t):
    s, a = pop_k(t, 37.78, 0.4)
    ring_burst(fr, t, 37.78, 540, 720, 120, 640, GOLD, 2)
    mg.place(fr, A["mark"], 540, 720, s * 0.9, 0, a)
    txt(fr, t, "MONEY", 540, 1110, 37.95, 200, GOLD)
    small(fr, t, "explained", 540, 1200, 38.1, 90, CREAM)
    # FOLLOW button -> tap -> FOLLOWING ✓
    tb, ttap = 38.4, 39.05
    bs, ba = pop_k(t, tb)
    if ba > 0:
        tapped = t >= ttap
        press = 0.92 if ttap <= t < ttap + 0.1 else 1.0
        col = GREEN if tapped else (40, 120, 254)
        if tapped and t > 39.6:
            press *= 1 + 0.035 * math.sin((t - 39.6) * 6)
        mg.place(fr, mgx.pill(560, 140, col + (255,)), 540, 1380, bs * press, 0, ba)
        if tapped:
            mg.put_text(fr, "FOLLOWING", 510, 1412, "B", 88, WHITE, ba, "c", False, bs * press)
            mg.place(fr, A["check"], 735, 1380, 1, 0, ba)
            ring_burst(fr, t, ttap, 540, 1380, 80, 420, GREEN, 1)
        else:
            mg.put_text(fr, "FOLLOW", 540, 1412, "B", 92, WHITE, ba, "c", False, bs * press)
    # hand cursor glides in and taps
    if t > 38.55:
        k = eio((t - 38.55) / 0.45)
        hx, hy = 860 - 240 * k, 1680 - 230 * k
        sc = 0.88 if ttap <= t < ttap + 0.12 else 1.0
        ha = cl((t - 38.55) / 0.15) * (1 - cl((t - 39.7) / 0.3))
        mg.place(fr, A["hand"], hx + 30, hy + 60, sc, -18, ha)
    small(fr, t, "roz ek naya money concept", 540, 1530, 39.65, 70, CREAM)


# ------------------------------------------------------------------ progress bar + frame
def progress(fr, t):
    k = cl(t / END)
    mg.place(fr, mgx.pill(960, 10, (255, 255, 255, 60)), 540, 236, 1, 0, 1)
    w = int(960 * k)
    if w > 12:
        mg.place(fr, mgx.pill(w, 10, GOLD + (255,)), 60 + w / 2, 236, 1, 0, 1)


BG = GRAIN = None


def init():
    global BG, GRAIN
    load()
    BG = make_bg()
    GRAIN = mg.make_grain(8, 4.0)
    SHAKES.extend([(3.25, 0.25, 10), (7.0, 0.25, 10), (7.9, 0.3, 14), (9.75, 0.25, 10), (20.3, 0.25, 12)])


def frame(t, i):
    fr = BG.copy()
    dust(fr, t)
    for t0, t1, f in SC:
        if t0 <= t < t1:
            f(fr, t)
    for t0, d, amp in SHAKES:
        if t0 <= t < t0 + d:
            k = 1 - (t - t0) / d
            dx, dy = amp * k * math.sin(t * 95), amp * k * math.cos(t * 77)
            fr = cv2.warpAffine(fr, np.float32([[1, 0, dx], [0, 1, dy]]), (W, H), borderMode=cv2.BORDER_REPLICATE)
    progress(fr, t)
    fr += GRAIN[i % len(GRAIN)]
    return np.clip(fr, 0, 255).astype(np.uint8)[..., ::-1]


if __name__ == "__main__":
    a = sys.argv[1:]
    init()
    if "--stills" in a:
        for t in [float(x) for x in a[a.index("--stills") + 1:]]:
            cv2.imwrite(os.path.join(HERE, "work", f"st_{t:05.2f}.jpg"), frame(t, int(t * FPS)), [cv2.IMWRITE_JPEG_QUALITY, 88])
        sys.exit()
    k, n = (int(a[a.index("--part") + 1]), int(a[a.index("--part") + 2])) if "--part" in a else (0, 1)
    total = int(END * FPS); lo, hi = total * k // n, total * (k + 1) // n
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p",
                            os.path.join(HERE, "work", f"part{k}.mp4")], stdin=subprocess.PIPE)
    for i in range(lo, hi):
        enc.stdin.write(frame(i / FPS, i).tobytes())
    enc.stdin.close(); enc.wait()
