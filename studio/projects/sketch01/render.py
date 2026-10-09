#!/usr/bin/env python3
"""sketch01: Salinur's school clip as a hand-drawn sketch animation (on twos, line boil), original audio kept."""
import os, sys, subprocess
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "tools"))
import sketch

W, H = 1080, 1920
src = os.path.join(HERE, "raw", "clip.mov")
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
S = sketch.Sketcher(W, H)
out = os.path.join(HERE, "work", "sketch_video.mp4")
enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps),
                        "-i", "-", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
i, drawing, last, prev_small = 0, 0, None, None
while True:
    ok, f = cap.read()
    if not ok:
        break
    small = cv2.resize(f, (54, 96)).astype(np.float32)
    cut = prev_small is not None and np.abs(small - prev_small).mean() > 28
    prev_small = small
    if cut:
        S.prev_mask = None; S.face_box = None
    if i % 2 == 0 or cut:          # animate on twos (12-15 drawings per second), new drawing on every cut
        drawing += 1
        img = S.draw(f, drawing)
        dx, dy = np.random.default_rng(drawing).integers(-2, 3, 2)     # paper sheet shifts slightly per drawing
        img = np.roll(img, (int(dy), int(dx)), (0, 1))
        last = np.clip(img, 0, 255).astype(np.uint8)[..., ::-1]
    enc.stdin.write(last.tobytes())
    i += 1
    if i % 60 == 0:
        print(i, file=sys.stderr, flush=True)
enc.stdin.close(); enc.wait()
final = os.path.join(HERE, "final"); os.makedirs(final, exist_ok=True)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", out, "-i", src, "-map", "0:v", "-map", "1:a?", "-c:v", "copy", "-c:a", "aac",
                "-b:a", "256k", "-shortest", "-movflags", "+faststart", os.path.join(final, "sketch_scene_1080p.mp4")], check=True)
print("done")
