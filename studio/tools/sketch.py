#!/usr/bin/env python3
"""Hand-drawn sketch animation from live footage (own algorithm, no AI model needed).
Look: graphite pencil lines (XDoG) + soft watercolour wash (edge-preserving flattening, muted palette)
+ cross-hatching in shadows + cream paper texture. The person (MediaPipe selfie mask) gets bolder lines
and richer colour than the background. Animated "on twos" with line boil = feels drawn frame by frame.
"""
import math
import numpy as np, cv2

_rng = np.random.default_rng(7)


def paper(h, w, seed=3):
    rng = np.random.default_rng(seed)
    base = np.zeros((h, w, 3), np.float32) + np.array((244, 238, 226), np.float32)     # warm cream (RGB)
    n = rng.normal(0, 1, (h // 4, w // 4)).astype(np.float32)
    n = cv2.resize(cv2.GaussianBlur(n, (0, 0), 1.2), (w, h))
    fib = rng.normal(0, 1, (h, w)).astype(np.float32)
    fib = cv2.GaussianBlur(fib, (0, 0), sigmaX=0.6, sigmaY=3.0)                         # vertical fibres
    base += (n * 5 + fib * 4)[..., None]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    v = 1 - 0.10 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    return np.clip(base * v[..., None], 0, 255)


def hatch_tex(h, w, angle=35, spacing=7, seed=1):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle)
    d = xx * math.cos(a) + yy * math.sin(a)
    rng = np.random.default_rng(seed)
    wob = cv2.resize(rng.normal(0, 1, (h // 40 + 1, w // 40 + 1)).astype(np.float32), (w, h)) * 1.5
    line = 0.5 + 0.5 * np.cos(2 * np.pi * (d + wob) / spacing)
    return np.clip((line - 0.55) * 4, 0, 1)


def xdog(gray, sigma=1.0, k=1.6, p=22.0, eps=-0.02, phi=10.0):
    g1 = cv2.GaussianBlur(gray, (0, 0), sigma)
    g2 = cv2.GaussianBlur(gray, (0, 0), sigma * k)
    d = (1 + p) * g1 - p * g2
    e = np.where(d >= eps, 1.0, 1.0 + np.tanh(phi * (d - eps)))
    return np.clip(e, 0, 1)            # 1 = paper, <1 = line


def flatten(rgb, iters=3):
    x = rgb
    for _ in range(iters):
        x = cv2.bilateralFilter(x, 9, 40, 9)
    return x


def boil(img, seed, amp=1.6):
    """small random warp = hand-drawn line boil (changes per drawing)"""
    h, w = img.shape[:2]
    rng = np.random.default_rng(seed)
    fx = cv2.resize(rng.normal(0, 1, (h // 60 + 2, w // 60 + 2)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC) * amp
    fy = cv2.resize(rng.normal(0, 1, (h // 60 + 2, w // 60 + 2)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC) * amp
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    return cv2.remap(img, gx + fx, gy + fy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


class Sketcher:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.paper = paper(h, w)
        self.hatch1 = hatch_tex(h, w, 35, 8, 1)
        self.hatch2 = hatch_tex(h, w, -55, 9, 2)
        import mediapipe as mp
        self.seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)
        self.fd = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.4)
        self.face_box = None
        self.prev_mask = None

    def person_mask(self, rgb):
        r = self.seg.process(rgb)
        m = r.segmentation_mask.astype(np.float32)
        m = cv2.GaussianBlur(np.clip((m - 0.35) / 0.3, 0, 1), (0, 0), 2)
        if self.prev_mask is not None:
            m = 0.6 * m + 0.4 * self.prev_mask       # temporal smoothing
        self.prev_mask = m
        return m

    def draw(self, bgr, drawing_id):
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        rgb = cv2.resize(rgb, (self.w, self.h), interpolation=cv2.INTER_AREA)
        m1 = self.person_mask(rgb)
        m = m1[..., None]
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
        g = cv2.bilateralFilter(gray, 9, 0.10, 7)
        # ---- lines: calm background, bold clean character
        l_bg = xdog(g, sigma=1.6, p=16, eps=-0.012, phi=7)
        gs = cv2.bilateralFilter(gray, 9, 0.18, 9)
        l_fg = xdog(gs, sigma=1.3, p=20, eps=-0.025, phi=14)
        l_fg = cv2.erode(l_fg, np.ones((2, 2), np.uint8))          # thicker strokes
        lines = l_bg * (1 - m1) + l_fg * m1
        # finer lines inside the face so eyes / brows / mouth read clearly
        r = self.fd.process(rgb)
        if r.detections:
            bb = r.detections[0].location_data.relative_bounding_box
            box = np.array([bb.xmin * self.w, bb.ymin * self.h, bb.width * self.w, bb.height * self.h])
            self.face_box = box if self.face_box is None else 0.6 * box + 0.4 * self.face_box
        if self.face_box is not None:
            x, y, bw, bh = self.face_box
            fm = np.zeros((self.h, self.w), np.float32)
            cv2.ellipse(fm, (int(x + bw / 2), int(y + bh * 0.45)), (int(bw * 0.62), int(bh * 0.80)), 0, 0, 360, 1.0, -1)
            fm = cv2.GaussianBlur(fm, (0, 0), max(2, bw * 0.08)) * m1
            sig = float(np.clip(bw / 90, 0.45, 1.0))
            l_face = xdog(cv2.bilateralFilter(gray, 5, 0.06, 3), sigma=sig, p=26, eps=-0.03, phi=16)
            lines = lines * (1 - fm) + np.minimum(lines, l_face) * fm
        sil = (m1 > 0.5).astype(np.uint8)
        edge = cv2.morphologyEx(sil, cv2.MORPH_GRADIENT, np.ones((5, 5), np.uint8)).astype(np.float32)
        lines = np.minimum(lines, 1 - 0.95 * cv2.GaussianBlur(edge, (0, 0), 0.9))
        # ---- character colour: cel-shaded (few flat tones)
        flat = rgb
        for _ in range(6):
            flat = cv2.bilateralFilter(flat, 9, 60, 9)
        flat = cv2.medianBlur(flat, 7)
        hsv = cv2.cvtColor(flat, cv2.COLOR_RGB2HSV).astype(np.float32)
        v = hsv[..., 2] / 255
        tone = np.where(v < 0.28, 0.30, np.where(v < 0.55, 0.58, np.where(v < 0.78, 0.82, 0.97)))   # 4 tones
        hsv[..., 2] = tone * 255
        hsv[..., 1] = np.clip(hsv[..., 1] * np.where(v < 0.32, 0.25, 0.85), 0, 255)     # blacks stay neutral charcoal
        cel = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)
        cel = cv2.GaussianBlur(cel, (0, 0), 0.8)
        # ---- background: light watercolour wash, mostly paper
        bgw = rgb
        for _ in range(4):
            bgw = cv2.bilateralFilter(bgw, 9, 50, 9)
        hb = cv2.cvtColor(bgw, cv2.COLOR_RGB2HSV).astype(np.float32)
        hb[..., 1] *= 0.42
        hb[..., 2] = 255 - (255 - hb[..., 2]) * 0.45
        wash = cv2.cvtColor(hb.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)
        wash = np.round(wash / 20) * 20
        wash = cv2.GaussianBlur(wash, (0, 0), 2.0)
        paper = self.paper
        bg = paper * 0.35 + (paper / 255.0) * wash * 0.65
        fg = (paper / 255.0) * cel * 0.92 + paper * 0.08
        col = bg * (1 - m) + fg * m
        # ---- pencil hatching in the shadows (background + character)
        dark = np.clip((0.42 - g) / 0.28, 0, 1)
        hatch = 1 - (0.28 * dark * self.hatch1 + 0.18 * np.clip((0.25 - g) / 0.18, 0, 1) * self.hatch2) * (1 - m[..., 0])
        col *= hatch[..., None]
        lines = boil(lines.astype(np.float32), drawing_id)
        graphite = np.array((40, 36, 36), np.float32)
        out = col * lines[..., None] + graphite * (1 - lines[..., None])
        return np.clip(out, 0, 255)
