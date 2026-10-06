#!/usr/bin/env python3
"""Extra clean vector widgets for explainer pages (Money Explained etc.), drawn with PIL at 2x and composited via mg.place."""
import math
from functools import lru_cache
import numpy as np, cv2
from PIL import Image, ImageDraw
import mg


def _spr_from_pil(im):
    """PIL RGBA (drawn at 2x) -> premultiplied sprite at 1x"""
    im = im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS)
    return mg.to_sprite(np.array(im))


@lru_cache(maxsize=64)
def pill(w, h, fill, outline=None, ow=0, r=None):
    r = h // 2 if r is None else r
    im = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((ow, ow, w * 2 - 1 - ow, h * 2 - 1 - ow), radius=r * 2, fill=fill, outline=outline, width=ow * 2 if outline else 0)
    return _spr_from_pil(im)


@lru_cache(maxsize=16)
def check_mark(size, colour):
    im = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    s = size * 2
    d.line([(s * 0.12, s * 0.55), (s * 0.40, s * 0.82), (s * 0.90, s * 0.18)], fill=colour, width=int(s * 0.16), joint="curve")
    return _spr_from_pil(im)


@lru_cache(maxsize=16)
def paper_plane(size, colour=(255, 255, 255)):
    s = size * 2
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(s * 0.05, s * 0.45), (s * 0.95, s * 0.10), (s * 0.55, s * 0.92), (s * 0.42, s * 0.58)], fill=colour + (255,))
    d.polygon([(s * 0.42, s * 0.58), (s * 0.95, s * 0.10), (s * 0.48, s * 0.80)], fill=tuple(int(c * 0.78) for c in colour) + (255,))
    return _spr_from_pil(im)


@lru_cache(maxsize=16)
def hand_tap(size, colour=(255, 255, 255)):
    """simple pointing-finger cursor"""
    s = size * 2
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    w = s * 0.2
    d.rounded_rectangle((s * 0.40, s * 0.05, s * 0.40 + w, s * 0.62), radius=int(w / 2), fill=colour + (255,), outline=(20, 20, 30, 255), width=6)
    d.rounded_rectangle((s * 0.30, s * 0.45, s * 0.85, s * 0.95), radius=int(s * 0.14), fill=colour + (255,), outline=(20, 20, 30, 255), width=6)
    d.rounded_rectangle((s * 0.41, s * 0.40, s * 0.40 + w - 6, s * 0.55), radius=int(w / 2), fill=colour + (255,))
    return _spr_from_pil(im)


def coin_stack(fr, x, y_base, n, r=60, t=0.0, gold=(245, 197, 66), dark=(170, 120, 30), a=1.0):
    """stack of n flat coins (side view), bottom at y_base"""
    th = r * 0.22
    for i in range(n):
        cy = y_base - i * th - th / 2
        s = Image.new("RGBA", (int(r * 4.4), int(r * 1.4 + th * 2)), (0, 0, 0, 0))
        d = ImageDraw.Draw(s)
        W2 = s.width; H2 = s.height
        cx2, cy2 = W2 / 2, H2 / 2
        d.rounded_rectangle((cx2 - r * 2, cy2 - th, cx2 + r * 2, cy2 + th), radius=int(th), fill=dark + (255,))
        d.ellipse((cx2 - r * 2, cy2 - th - r * 0.55, cx2 + r * 2, cy2 - th + r * 0.55), fill=gold + (255,), outline=dark + (255,), width=4)
        d.ellipse((cx2 - r * 1.45, cy2 - th - r * 0.38, cx2 + r * 1.45, cy2 - th + r * 0.38), outline=(255, 232, 160, 255), width=4)
        mg.place(fr, _spr_from_pil(s), x, cy, 1, 0, a)


def bar(fr, x, y_base, w, h, colour, a=1.0, r=18):
    if h < 2:
        return
    sp = pill(int(w), int(h), colour + (255,), None, 0, r)
    mg.place(fr, sp, x, y_base - h / 2, 1, 0, a)


def polyline(fr, pts, th, colour, a=1.0):
    """antialiased thick polyline drawn into a full-frame overlay region"""
    if len(pts) < 2:
        return
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0 = int(min(xs) - th - 4), int(min(ys) - th - 4)
    x1, y1 = int(max(xs) + th + 4), int(max(ys) + th + 4)
    m = np.zeros((y1 - y0, x1 - x0), np.float32)
    P = np.array([[(px - x0) * 16, (py - y0) * 16] for px, py in pts], np.int32)
    cv2.polylines(m, [P], False, 1.0, int(th), cv2.LINE_AA, shift=4)
    spr = np.dstack([m * colour[0], m * colour[1], m * colour[2], m]).astype(np.float32)
    mg.place(fr, spr, (x0 + x1) / 2, (y0 + y1) / 2, 1, 0, a)


def dot(fr, x, y, r, colour, a=1.0):
    S = int(r * 2 + 6)
    m = np.zeros((S * 4, S * 4), np.float32)
    cv2.circle(m, (S * 2, S * 2), int(r * 4), 1.0, -1, cv2.LINE_AA)
    m = cv2.resize(m, (S, S), interpolation=cv2.INTER_AREA)
    mg.place(fr, np.dstack([m * colour[0], m * colour[1], m * colour[2], m]).astype(np.float32), x, y, 1, 0, a)


def arrow(fr, x0, y0, x1, y1, th, colour, a=1.0, head=34):
    mg.line(fr, (x0, y0), (x1, y1), th, colour, a)
    ang = math.atan2(y1 - y0, x1 - x0)
    for s in (-1, 1):
        hx = x1 - head * math.cos(ang + s * 0.5)
        hy = y1 - head * math.sin(ang + s * 0.5)
        mg.line(fr, (x1, y1), (hx, hy), th, colour, a)


def inr(v):
    """Indian digit grouping: 60000 -> 60,000 ; 125000 -> 1,25,000"""
    s = str(int(round(v)))
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:]); head = head[:-2]
    if head:
        parts.insert(0, head)
    return ",".join(parts + [tail])
