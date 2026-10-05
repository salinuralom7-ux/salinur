#!/usr/bin/env python3
"""video01 compositor: zooms, motion-graphic cards, word-synced captions.

Reads work/base.mp4 (already cut, 1080x1920@30) and transcribe/transcript.json,
writes work/visual.mp4 (no audio). Times in this file are RAW-footage times;
to_out() maps them onto the cut timeline.
"""
import json, math, subprocess, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1080, 1920, 30
STUDIO = "../.."
FONT_XB = f"{STUDIO}/assets/fonts/Poppins-800.ttf"
FONT_B = f"{STUDIO}/assets/fonts/Poppins-700.ttf"
NAVY, BLUE, WHITE, YELLOW, RED = (6, 20, 54), (40, 120, 254), (255, 255, 255), (255, 215, 0), (255, 59, 59)

# Cut list: raw spans kept, in order (must match the ffmpeg rough cut).
KEEP = [(0.60, 25.76), (25.95, 58.53)]
TAIL = 1.0  # frozen last frame for the end card


def to_out(t):
    off = 0.0
    for a, b in KEEP:
        if t < a:
            return off
        if t <= b:
            return off + t - a
        off += b - a
    return off + (t - KEEP[-1][1])


def ease(x):  # easeOutCubic
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def ease_back(x):  # slight overshoot pop
    x = min(max(x, 0.0), 1.0)
    c = 1.7
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


# ---------------------------------------------------------------- zoom track
# (raw_time, zoom). Instant changes act as jump cuts; ramps are slow pushes.
ZOOM = [
    (0.0, 1.12), (6.45, 1.12), (6.46, 1.00), (9.0, 1.00), (14.9, 1.08),
    (14.91, 1.03), (21.35, 1.03), (21.36, 1.10), (25.76, 1.10),
    (25.95, 1.00), (28.9, 1.00), (28.91, 1.05), (33.55, 1.05),
    (33.56, 1.14), (40.30, 1.18), (40.42, 1.22), (41.2, 1.18),
    (41.30, 1.00), (45.9, 1.00), (45.91, 1.06), (48.6, 1.06), (48.61, 1.10),
    (55.35, 1.10), (55.36, 1.00), (99, 1.00),
]
ZT = np.array([to_out(t) if t < 99 else 999 for t, _ in ZOOM])
ZV = np.array([z for _, z in ZOOM])
FACE_CX, FACE_CY = 0.461 * W, 0.352 * H


def zoom_at(t):
    return float(np.interp(t, ZT, ZV))


def apply_zoom(frame, z):
    if z <= 1.0001:
        return frame
    # scale about the face centre, clamped so the frame stays filled
    cx = min(max(FACE_CX, W / (2 * z)), W - W / (2 * z))
    cy = min(max(FACE_CY, H / (2 * z)), H - H / (2 * z))
    M = np.float32([[z, 0, cx - z * cx], [0, z, cy - z * cy]])
    return cv2.warpAffine(frame, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# ---------------------------------------------------------------- drawing helpers
def font(path, size):
    return ImageFont.truetype(path, size)


def icon(name, color="w", size=300):
    im = Image.open(f"gfx/{name}_{color}.png").convert("RGBA")
    return im.resize((size, size), Image.LANCZOS)


def text_img(txt, size, fill=WHITE, path=FONT_XB, stroke=0, stroke_fill=(0, 0, 0), tracking=0):
    f = font(path, size)
    bbox = f.getbbox(txt, stroke_width=stroke)
    w, h = bbox[2] - bbox[0] + 8, bbox[3] - bbox[1] + 8
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((4 - bbox[0], 4 - bbox[1]), txt, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return im


def panel_bg():
    """Full-screen brand background: navy with a soft blue glow."""
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.40) / H) ** 2)
    glow = np.clip(1 - d / 0.55, 0, 1) ** 2
    img = np.zeros((H, W, 3), np.float32)
    for i in range(3):
        img[..., i] = NAVY[i] + (BLUE[i] - NAVY[i]) * 0.28 * glow
    return Image.fromarray(img.astype(np.uint8)).convert("RGBA")


BG = panel_bg()


def paste_center(canvas, im, cx, cy, scale=1.0, alpha=1.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    if abs(scale - 1) > 1e-3:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    if alpha < 0.999:
        a = im.getchannel("A").point(lambda v: int(v * alpha))
        im = im.copy(); im.putalpha(a)
    canvas.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


def rounded(w, h, r, fill):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=fill)
    return im


def shadowed(im, blur=18, offset=8, opacity=150):
    pad = blur * 2
    out = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, opacity)); sh.putalpha(im.getchannel("A").point(lambda v: v * opacity // 255))
    out.alpha_composite(sh, (pad, pad + offset)); out = out.filter(ImageFilter.GaussianBlur(blur))
    out.alpha_composite(im, (pad, pad))
    return out


def ig_glyph(size, col):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im); s = size
    lw = max(3, s // 12)
    d.rounded_rectangle((lw, lw, s - lw, s - lw), s // 4, outline=col, width=lw)
    d.ellipse((s * .3, s * .3, s * .7, s * .7), outline=col, width=lw)
    d.ellipse((s * .7, s * .2, s * .8, s * .3), fill=col)
    return im


LOGO = Image.open(f"{STUDIO}/assets/brand/ff_logo.png").convert("RGBA")
# logo has its own navy square; crop to the letters and key out the navy
_l = np.array(LOGO).astype(np.int32)
_dist = np.abs(_l[..., :3] - np.array(NAVY)).sum(-1)
_l[..., 3] = np.clip((_dist - 30) * 4, 0, 255)
LOGO = Image.fromarray(_l.astype(np.uint8)).crop(Image.fromarray(_l.astype(np.uint8)).getbbox())


# ---------------------------------------------------------------- cards
class Card:
    """A graphic shown from t0 to t1 (out time). full=True covers the frame."""
    def __init__(self, t0, t1, draw, full=True):
        self.t0, self.t1, self.draw, self.full = t0, t1, draw, full

    def alpha(self, t):
        return min(ease((t - self.t0) / 0.18), ease((self.t1 - t) / 0.15))


def card_title(c, t, local, icon_name, title, sub=None, title_size=104):
    k = ease_back(local / 0.35)
    paste_center(c, shadowed(icon(icon_name, "w", 300)), W / 2, 640 - 60 * (1 - ease(local / 0.3)), scale=0.6 + 0.4 * k)
    paste_center(c, text_img(title, title_size), W / 2, 880, alpha=ease((local - 0.08) / 0.2))
    if sub:
        paste_center(c, text_img(sub, 54, fill=BLUE, path=FONT_B), W / 2, 985, alpha=ease((local - 0.18) / 0.2))


def mk_hospital(c, t, l):
    card_title(c, t, l, "hospital", "YOUR HOSPITAL", "money • years • a big dream")


def mk_pandey(c, t, l):
    card_title(c, t, l, "stethoscope", "DR. PANDEY", "opens a small clinic")


def mk_queue(c, t, l):
    paste_center(c, text_img("LONG QUEUE", 104), W / 2, 880, alpha=ease(l / 0.2))
    paste_center(c, text_img("outside his clinic", 54, fill=BLUE, path=FONT_B), W / 2, 985, alpha=ease((l - 0.15) / 0.2))
    n = 7
    for i in range(n):
        li = l - 0.12 * i
        if li <= 0:
            continue
        x = 150 + i * (W - 300) / (n - 1)
        paste_center(c, icon("user", "b" if i == 0 else "w", 150), x, 640, scale=0.4 + 0.6 * ease_back(li / 0.3), alpha=ease(li / 0.15))


CHECKS = [(to_out(29.0), "Better infrastructure"), (to_out(29.96), "More manpower"), (to_out(31.0), "More facilities")]


def mk_checks(c, t, l):
    paste_center(c, text_img("YOU HAVE", 70, fill=BLUE, path=FONT_B), W / 2, 470, alpha=ease(l / 0.2))
    for i, (tc, label) in enumerate(CHECKS):
        y = 620 + i * 150
        li = t - tc + 0.1
        a = ease(li / 0.2)
        if a <= 0:
            continue
        row = Image.new("RGBA", (860, 120), (0, 0, 0, 0))
        row.alpha_composite(rounded(860, 120, 30, (255, 255, 255, 22)))
        box = rounded(84, 84, 20, BLUE + (255,)); row.alpha_composite(box, (20, 18))
        tick = icon("check", "w", 64); row.alpha_composite(tick, (30, 28))
        row.alpha_composite(text_img(label, 54, path=FONT_B), (130, 26))
        paste_center(c, row, W / 2 + 80 * (1 - ease(li / 0.25)), y, alpha=a)


def mk_ff(c, t, l):
    k = ease_back(l / 0.4)
    paste_center(c, shadowed(LOGO.resize((560, int(560 * LOGO.height / LOGO.width)), Image.LANCZOS)), W / 2, 700, scale=0.5 + 0.5 * k, alpha=ease(l / 0.15))
    paste_center(c, text_img("FRAME & FAME", 76), W / 2, 930, alpha=ease((l - 0.15) / 0.2))
    paste_center(c, text_img("Marketing Agency", 54, fill=BLUE, path=FONT_B), W / 2, 1020, alpha=ease((l - 0.25) / 0.2))


def mk_end(c, t, l):
    paste_center(c, shadowed(LOGO.resize((460, int(460 * LOGO.height / LOGO.width)), Image.LANCZOS)), W / 2, 560, scale=0.6 + 0.4 * ease_back(l / 0.4), alpha=ease(l / 0.15))
    paste_center(c, text_img("FRAME & FAME", 70), W / 2, 770, alpha=ease((l - 0.1) / 0.2))
    rows = [("phone-call", "70862 69537"), ("globe", "frameandfame.in"), (None, "@frameandfame.in_")]
    for i, (ic, label) in enumerate(rows):
        li = l - 0.2 - 0.12 * i
        a = ease(li / 0.2)
        if a <= 0:
            continue
        row = Image.new("RGBA", (800, 110), (0, 0, 0, 0))
        row.alpha_composite(rounded(800, 110, 55, (255, 255, 255, 26)))
        row.alpha_composite(icon(ic, "b", 64) if ic else ig_glyph(64, BLUE + (255,)), (40, 23))
        row.alpha_composite(text_img(label, 50, path=FONT_B), (130, 24))
        paste_center(c, row, W / 2, 920 + i * 135 + 30 * (1 - ease(li / 0.25)), alpha=a)


# Overlays (not full screen): a floating pill in the band between face and captions.
def pill(c, l, icon_name, label, y=1130, ic_col="w", bg=BLUE + (255,), fg=WHITE):
    a = ease(l / 0.15); s = 0.7 + 0.3 * ease_back(l / 0.3)
    tw = text_img(label, 56, fill=fg)
    w = tw.width + 170; row = rounded(w, 120, 60, bg)
    row.alpha_composite(icon(icon_name, ic_col, 70), (34, 25)); row.alpha_composite(tw, (130, 60 - tw.height // 2))
    paste_center(c, shadowed(row, 14, 6, 120), W / 2, y, scale=s, alpha=a)


def mk_video(c, t, l):
    pill(c, l, "video", "1 VIDEO / DAY")


def mk_services(c, t, l):
    pill(c, l, "sparkles", "CREATIVE CONTENT", y=1060)
    l2 = t - to_out(45.94) + 0.05
    if l2 > 0:
        pill(c, l2, "target", "PERFORMANCE MARKETING", y=1200, bg=WHITE + (255,), ic_col="b", fg=NAVY)


def mk_grow(c, t, l):
    pill(c, l, "trending-up", "GROW ONLINE")


def mk_call(c, t, l):
    pill(c, l, "phone-call", "70862 69537")


CARDS = [
    Card(to_out(7.05), to_out(8.95), mk_hospital),
    Card(to_out(15.25), to_out(17.95), mk_pandey),
    Card(to_out(18.80), to_out(20.25), mk_video, full=False),
    Card(to_out(23.55), to_out(25.70), mk_queue),
    Card(to_out(28.85), to_out(32.10), mk_checks),
    Card(to_out(41.85), to_out(43.95), mk_ff),
    Card(to_out(44.00), to_out(48.40), mk_services, full=False),
    Card(to_out(48.65), to_out(50.40), mk_grow, full=False),
    Card(to_out(52.65), to_out(55.30), mk_call, full=False),
    Card(to_out(57.55), to_out(58.53) + TAIL + 0.5, mk_end),
]

# ---------------------------------------------------------------- captions
FIX = {"fnf": "F&F", "dr": "DR.", "i'm": "I'M", "67%": "67%"}
HIGHLIGHT = {"67%", "hospital", "dream", "pandey", "clinic", "video", "queue", "rubbish", "infrastructure",
             "manpower", "facilities", "camera", "customers", "fnf", "creative", "performance", "grow", "call", "soon"}
RED_WORDS = {"future"}


# Real pauses measured with silencedetect (raw time). Whisper smears words across them.
SILENCES = [(0.49, 0.69), (25.67, 26.04), (36.12, 36.37), (40.99, 41.31), (46.99, 47.18), (49.83, 50.24)]


def raw_words():
    d = json.load(open("transcribe/transcript.json"))
    ws = [dict(w=w["w"].strip(), start=w["start"], end=w["end"]) for s in d["segments"] for w in s["words"]]
    out = []
    for w in ws:  # "67" + "%" -> "67%"
        if w["w"] == "%" and out:
            out[-1]["w"] += "%"; out[-1]["end"] = w["end"]
        else:
            out.append(w)
    for i, w in enumerate(out):  # a word that swallowed a pause starts after it
        for a, b in SILENCES:
            if w["start"] + 0.1 < (a + b) / 2 < w["end"]:
                w["start"] = b
                if i:
                    out[i - 1]["end"] = min(out[i - 1]["end"], a) if out[i - 1]["end"] > a else out[i - 1]["end"]
                w["end"] = max(w["end"], b + 0.15)
    for i in range(1, len(out)):  # previous word ends where the pause begins
        for a, b in SILENCES:
            if out[i]["start"] == b and out[i - 1]["end"] < a:
                out[i - 1]["end"] = a
    return out


def load_words():
    ws = []
    if True:
        for w in raw_words():
            raw = w["w"].strip()
            key = raw.lower().strip(".,!?")
            txt = FIX.get(key, raw.upper().strip(".,!?"))
            ws.append(dict(key=key, txt=txt, t0=to_out(w["start"]), t1=to_out(w["end"])))
    # "dr" + "pandey" read better together
    return ws


def group(ws, maxw=3, maxdur=1.1):
    lines, cur = [], []
    for w in ws:
        brk = cur and (len(cur) >= maxw or w["t1"] - cur[0]["t0"] > maxdur or w["t0"] - cur[-1]["t1"] > 0.25
                       or cur[-1]["key"] in {"future", "problems", "town", "dream", "clinic", "customers", "online", "call", "soon"})
        if brk:
            lines.append(cur); cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    for i, ln in enumerate(lines):
        nxt = lines[i + 1][0]["t0"] if i + 1 < len(lines) else ln[-1]["t1"] + 0.6
        ln_end = min(nxt, ln[-1]["t1"] + 0.4)
        for w in ln:
            w["line_end"] = ln_end
    return lines


CAP_SIZE, CAP_Y = 92, int(H * 0.70)


def render_line(ln, t):
    """Whole line visible; words already spoken are fully opaque, upcoming ones dimmed slightly."""
    f = font(FONT_XB, CAP_SIZE); fr = font(FONT_XB, int(CAP_SIZE * 1.25))
    parts = []
    for w in ln:
        txt = w["txt"]
        if w["key"] == "67%" and t < w["t0"] + 0.7:  # counter 0 -> 67
            txt = f"{int(67 * ease((t - w['t0']) / 0.55))}%"
        big = w["key"] in RED_WORDS
        col = RED if big else (YELLOW if w["key"] in HIGHLIGHT else WHITE)
        parts.append((txt, fr if big else f, col, w))
    space = 26
    widths = [p[1].getbbox(p[0], stroke_width=6)[2] for p in parts]
    total = sum(widths) + space * (len(parts) - 1)
    scale = min(1.0, (W * 0.80) / total)
    im = Image.new("RGBA", (int(total + 40), int(CAP_SIZE * 1.8)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im); x = 20
    for (txt, f_, col, w), wd in zip(parts, widths):
        said = t >= w["t0"] - 0.03
        fill = col
        a = 255 if said else 0
        base = im.height - 30
        d.text((x, base), txt, font=f_, fill=fill + (a,), stroke_width=6, stroke_fill=(0, 0, 0, a), anchor="ls")
        x += wd + space
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sh.putalpha(im.getchannel("A").point(lambda v: v * 110 // 255))
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0)); out.alpha_composite(sh, (0, 6)); out.alpha_composite(im)
    if scale < 1:
        out = out.resize((int(out.width * scale), int(out.height * scale)), Image.LANCZOS)
    return out


def main():
    lines = group(load_words())
    cap = cv2.VideoCapture("work/base.mp4")
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "14", "-preset", "medium",
                            "-pix_fmt", "yuv420p", "work/visual.mp4"], stdin=subprocess.PIPE)
    vign = vignette()
    li = 0
    for i in range(n):
        ok, fr = cap.read()
        if not ok:
            break
        t = i / FPS
        while li < len(lines) - 1 and t >= lines[li + 1][0]["t0"] - 0.02:
            li += 1
        enc.stdin.write(compose(fr, t, lines[li], vign).convert("RGB").tobytes())
        if i % 150 == 0:
            print(f"{i}/{n}", file=sys.stderr, flush=True)
    enc.stdin.close(); enc.wait()


def compose(fr, t, ln, vign):
    hit0, hit1 = to_out(40.40), to_out(41.30)
    fr = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
    fr = apply_zoom(fr, zoom_at(t))
    if hit0 <= t <= hit1:  # darken the edges on "future"
        k = min(ease((t - hit0) / 0.1), ease((hit1 - t) / 0.3))
        fr = (fr * (1 - k + k * vign)).astype(np.uint8)
    canvas = Image.fromarray(fr).convert("RGBA")
    for cd in CARDS:
        if cd.t0 <= t <= cd.t1:
            a = cd.alpha(t)
            layer = BG.copy() if cd.full else Image.new("RGBA", (W, H), (0, 0, 0, 0))
            cd.draw(layer, t, t - cd.t0)
            if cd.full:  # slide up + fade in over the footage
                lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                lay.alpha_composite(layer, (0, int(70 * (1 - ease((t - cd.t0) / 0.22)))))
                layer = lay
            if a < 0.999:
                layer.putalpha(layer.getchannel("A").point(lambda v, a=a: int(v * a)))
            canvas.alpha_composite(layer)
    if ln[0]["t0"] - 0.02 <= t <= ln[0]["line_end"] and t < to_out(57.55):
        im = render_line(ln, t)
        pop = 0.85 + 0.15 * ease_back((t - ln[0]["t0"]) / 0.12)
        paste_center(canvas, im, W / 2, CAP_Y, scale=pop)
    return canvas


def vignette():
    yy, xx = np.mgrid[0:H, 0:W]
    return np.clip(1 - 0.55 * (((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H * 0.42) / (H * 0.62)) ** 2), 0.35, 1)[..., None].astype(np.float32)


def stills(raw_times):
    """Render single frames (given in RAW time) to work/still_<t>.png for checking."""
    lines = group(load_words()); vign = vignette()
    cap = cv2.VideoCapture("work/base.mp4")
    for rt in raw_times:
        t = to_out(rt); cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * FPS)); ok, fr = cap.read()
        ln = [l for l in lines if l[0]["t0"] - 0.02 <= t][-1]
        compose(fr, t, ln, vign).convert("RGB").save(f"work/still_{rt:05.2f}.png")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--stills":
        stills([float(x) for x in sys.argv[2:]])
    else:
        main()
