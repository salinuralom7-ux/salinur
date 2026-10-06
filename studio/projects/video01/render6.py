#!/usr/bin/env python3
"""video01 v6 = v5 edit with the story scenes redrawn as premium FLAT 2D vector illustration
(Salinur 2026-10-06: "animated doctor like this — this type looks premium", references/style_doctor_flat.png).
Everything else (cuts, grade, captions, typography, brand, CTA, outro, sound) is v5.

Usage: render6.py [--stills t ...] | [--part k N]   (parts render in parallel; join with ffmpeg concat)
"""
import math, subprocess, sys
import numpy as np, cv2
sys.path.insert(0, "../../tools")
import flatkit as FK
import render5 as V
from render5 import W, H, FPS, END, eo, eb, cl, R

CW, CH = 1080, 1150          # illustration canvas (placed in the middle of the frame)


def shadow(x, y, w):
    return f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{w:.0f}" ry="{w * 0.16:.0f}" fill="#1E2A6A" opacity="0.16"/>'


def tree(x, y, s=1.0):
    return (f'<g transform="translate({x} {y}) scale({s})"><rect x="-9" y="-120" width="18" height="120" rx="8" fill="#8A5A3C"/>'
            '<circle cx="0" cy="-170" r="70" fill="#3FAE6A"/><circle cx="-38" cy="-140" r="46" fill="#36995C"/><circle cx="34" cy="-205" r="44" fill="#4CC07A"/></g>')


GROUND = (f'<ellipse cx="{CW / 2}" cy="{CH - 210}" rx="560" ry="120" fill="#FFFFFF" opacity="0.55"/>'
          f'<ellipse cx="{CW / 2}" cy="{CH - 210}" rx="470" ry="88" fill="#DCE6FF" opacity="0.9"/>')
FLOOR = CH - 230


def ch(kind, x, s, t, **kw):
    """character centred at x with feet on FLOOR (s = scale, 1 => 1000 units tall)"""
    return shadow(x, FLOOR + 4, 120 * s) + FK.place(FK.character(kind, t=t, **kw), x - 200 * s, FLOOR - 1000 * s, s)


def scene_svg(name, u, d):
    k = cl(u / d)
    b = GROUND
    if name == "hospital":
        b += tree(150, FLOOR, 1.0) + tree(930, FLOOR, 1.1) + shadow(540, FLOOR + 6, 380)
        b += FK.place(FK.building("hospital"), 540 - 350 * 1.05, FLOOR - 600 * 1.05, 1.05)
    elif name == "doc_walk":
        b += tree(110, FLOOR, 0.9) + shadow(690, FLOOR + 6, 330)
        b += FK.place(FK.building("clinic"), 690 - 310 * 0.95, FLOOR - 540 * 0.95, 0.95)
        door_x = 690 - 310 * 0.95 + 145 * 0.95
        walk_end = 0.72
        if k < walk_end:
            x = -120 + (door_x - -120) * (k / walk_end)
            b += ch("doctor", x, 0.52, u, walk=1.0, facing=1)
        if k > 0.80:
            pk = eb(cl((k - 0.80) / 0.08))
            b += FK.place(FK.prop("open"), door_x - 60 * pk + 10, FLOOR - 250, pk)
    elif name == "doc_film":
        b += FK.place(FK.prop("ringlight"), 130, FLOOR - 750, 1.0)
        b += ch("doctor", 470, 0.62, u, wave=1.0)
        b += shadow(820, FLOOR + 4, 80) + FK.place(FK.prop("tripod", u), 720, FLOOR - 640, 1.0)
    elif name == "owner_out":
        b += tree(120, FLOOR - 120, 0.8) + tree(960, FLOOR - 120, 0.85)
        b += FK.place(FK.building("hospital"), 540 - 350 * 0.95, FLOOR - 120 - 600 * 0.95, 0.95)
        if k > 0.08:
            q = cl((k - 0.08) / 0.85)
            s = 0.28 + 0.36 * q
            y = FLOOR - 120 + 120 * q
            b += shadow(540, y + 4, 120 * s) + FK.place(FK.character("owner", t=u, walk=1.0), 540 - 200 * s, y - 1000 * s, s)
    elif name == "queue":
        b += FK.place(FK.building("clinic"), 10, FLOOR - 540 * 0.72, 0.72)
        door_x = 10 + 145 * 0.72 + 330
        for j, kind in enumerate(["p1", "p2", "p3", "p4", "p5", "p6"]):
            appear = eb(cl((u - 0.15 * j) / 0.3))
            if appear <= 0:
                continue
            x = door_x + 40 + j * 98
            s = 0.42 * appear
            b += shadow(x, FLOOR + 4, 120 * s) + FK.place(FK.character(kind, t=u + j * 0.3, walk=0.15), x - 200 * s, FLOOR - 1000 * s, s)
    elif name == "steal":
        b += FK.place(FK.building("hospital"), -40, FLOOR - 600 * 0.6, 0.6)
        b += FK.place(FK.building("clinic"), 600, FLOOR - 540 * 0.72, 0.72)
        for j, kind in enumerate(["p1", "p2", "p4", "p6"]):
            q = cl((k - j * 0.10) / 0.75)
            if q <= 0:
                continue
            x = 240 + (660 - 240) * q
            b += ch(kind, x, 0.34, u + j * 0.25, walk=1.0 if q < 1 else 0.0)
    return b


class FlatScene(V.Scene):
    def hero(self, t):
        u = t - self.t0
        rgba = FK.render(scene_svg(self.name, u, self.t1 - self.t0), CW, CH).astype(np.float32)
        return rgba[..., [2, 1, 0]], rgba[..., 3:4] / 255.0

    def draw(self, t, prev_scene=None):
        img = V.WORLD.copy()
        u = t - self.t0
        rgb, a = self.hero(t)
        k_in = cl(u / 0.25)
        s = 0.97 + 0.05 * cl(u / (self.t1 - self.t0))                  # slow push
        R.place(img, rgb, a, W / 2, H * 0.53, s * eb(k_in) if k_in < 1 else s, eo(k_in))
        for (w, style, x, y, anc, w0, w1) in self.words:
            shown = V.typed(w, t, w0, w1) if style != "i" else (w if t >= w0 else "")
            if not shown:
                continue
            al = eo((t - w0) / 0.12)
            size = {"B": 150, "b": 104}.get(style)
            if size:
                V.put(img, shown, V.ANTON, size, V.NAVY, x * W, y * H, al, anchor=anc)
            else:
                V.put(img, shown, V.ITAL, 44, V.NAVY, x * W, y * H, al, anchor=anc)
        return img


# swap the story scenes; move bottom word lines a touch lower so they sit under the illustration
V.SCENES = [FlatScene(s.name, s.t0, s.t1, s.n, [(w, st, x, (y + 0.04 if y > 0.6 else y), a, w0, w1) for (w, st, x, y, a, w0, w1) in s.words])
            for s in V.SCENES]

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--stills" in a:
        ts = [float(x) for x in a[a.index("--stills") + 1:]]
        for (i, img), t in zip(V.frames(only=ts), ts):
            cv2.imwrite(f"work/v6_{t:05.2f}.jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        sys.exit()
    k, n = (int(a[a.index("--part") + 1]), int(a[a.index("--part") + 2])) if "--part" in a else (0, 1)
    total = int(END * FPS); lo, hi = total * k // n, total * (k + 1) // n
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-crf", "14", "-preset", "fast", "-pix_fmt", "yuv420p", f"work/v6_part{k}.mp4"], stdin=subprocess.PIPE)
    cap, capm = cv2.VideoCapture("work/base60.mp4"), cv2.VideoCapture("work/mask60.mp4")
    nb = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, min(lo, nb - 1)); capm.set(cv2.CAP_PROP_POS_FRAMES, min(lo, nb - 1))
    last = None
    for i in range(lo, hi):
        if i < nb:
            ok, fr = cap.read(); ok2, mf = capm.read()
            if ok and ok2:
                last = (fr, cv2.resize(mf[..., 0], (W, H)).astype(np.float32) / 255)
        fr, mk = last
        enc.stdin.write(V.compose(i, fr, mk).tobytes())
        if (i - lo) % 150 == 0:
            print(k, i, file=sys.stderr, flush=True)
    enc.stdin.close(); enc.wait()
