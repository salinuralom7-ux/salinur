#!/usr/bin/env python3
"""Deep study of one reference video: study_reference.py <video> <name>

Writes references/<name>/ (git-ignored media) and references/<name>/STUDY.md (committed):
  - shot list: every cut with timestamp, shot length, cuts/min, where cuts land vs. speech
  - frames: 4 fps contact sheets + one full-res frame per shot (for typography / graphics reading)
  - motion: per-second motion energy, zoom/punch-in detection (scale change between frames)
  - colour: per-shot exposure, contrast, saturation, white balance, shadow/highlight tint,
            skin-tone hue (face region), black/white points -> what the grade is doing
  - lighting: key/fill ratio on the face (left vs right half luminance), background-to-face ratio
  - text: frames where large flat-colour regions / text-like edges appear (caption & title timing)
  - audio: loudness, then (after the GitHub Demucs job) voice vs music level, music tempo/key/
           brightness, every SFX hit with time, length, pitch band and character
The written breakdown (typography names, animation styles, 3D, why it works) is done by looking
at the extracted frames — this script gathers the evidence and the numbers.
"""
import json, os, subprocess, sys
import numpy as np, cv2

src, name = sys.argv[1], sys.argv[2]
D = f"references/{name}"
os.makedirs(f"{D}/frames", exist_ok=True); os.makedirs(f"{D}/shots", exist_ok=True)
probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", src],
                                  capture_output=True, text=True).stdout)
vs = next(s for s in probe["streams"] if s["codec_type"] == "video")
W, H = int(vs["width"]), int(vs["height"])
fps = eval(vs["r_frame_rate"]); dur = float(probe["format"]["duration"])

# ---------- frames at 4 fps (analysis), downscaled
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-vf", "fps=4,scale=360:-2", f"{D}/frames/f_%04d.jpg"], check=True)
for k, start in enumerate(range(0, int(dur) + 1, 20)):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(start), "-t", "20", "-i", src, "-vf",
                    "fps=4,scale=180:-2,drawtext=text='%{pts\\:hms}':x=3:y=3:fontsize=13:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=10x8:padding=2:color=gray",
                    "-frames:v", "1", "-update", "1", f"{D}/sheet_{k:02d}.jpg"], check=True)

# ---------- read all frames at analysis size for numbers
cap = cv2.VideoCapture(src)
step = max(1, int(round(fps / 10)))          # 10 samples per second
prev, rows, idx = None, [], 0
face = cv2.CascadeClassifier("presets/haarcascade_frontalface_default.xml")
while True:
    ok = cap.grab()
    if not ok:
        break
    if idx % step:
        idx += 1; continue
    ok, f = cap.retrieve(); t = idx / fps; idx += 1
    s = cv2.resize(f, (270, int(270 * H / W)))
    hsv = cv2.cvtColor(s, cv2.COLOR_BGR2HSV).astype(np.float32)
    lab = cv2.cvtColor(s, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[..., 0] / 2.55
    r = dict(t=round(t, 2), luma=float(L.mean()), contrast=float(L.std()), sat=float(hsv[..., 1].mean() / 2.55),
             black=float(np.percentile(L, 1)), white=float(np.percentile(L, 99)),
             a=float(lab[..., 1].mean() - 128), b=float(lab[..., 2].mean() - 128),
             sh_b=float((lab[..., 2] - 128)[L < 25].mean()) if (L < 25).any() else 0.0,
             hi_b=float((lab[..., 2] - 128)[L > 75].mean()) if (L > 75).any() else 0.0)
    g = cv2.cvtColor(s, cv2.COLOR_BGR2GRAY)
    fs = face.detectMultiScale(g, 1.1, 5, minSize=(30, 30))
    if len(fs):
        x, y, w, h = max(fs, key=lambda q: q[2] * q[3])
        fl = L[y:y + h, x:x + w]
        r.update(face_y=round((y + h / 2) / g.shape[0], 3), face_h=round(h / g.shape[0], 3),
                 key_fill=float(fl[:, : w // 2].mean() - fl[:, w // 2:].mean()),
                 face_bg=float(fl.mean() - L.mean()),
                 skin_hue=float(hsv[y:y + h, x:x + w, 0].mean() * 2))
    if prev is not None:
        d = cv2.absdiff(g, prev); r["motion"] = float(d.mean())
        # zoom estimate: phase-correlate log-polar would be heavy; use ECC affine scale on small frames
        try:
            warp = np.eye(2, 3, dtype=np.float32)
            _, warp = cv2.findTransformECC(prev.astype(np.float32), g.astype(np.float32), warp, cv2.MOTION_AFFINE,
                                           (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 1e-4), None, 1)
            r["scale"] = float(np.sqrt(abs(np.linalg.det(warp[:, :2]))))
        except cv2.error:
            r["scale"] = 1.0
    prev = g
    rows.append(r)

# ---------- cuts (scene changes) + one full-res frame per shot
sc = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-vf", "select='gt(scene,0.25)',showinfo", "-vsync", "vfr", "-f", "null", "-"],
                    capture_output=True, text=True).stderr
cuts = [float(x.split(":")[1]) for x in sc.split() if x.startswith("pts_time:")]
bounds = [0.0] + cuts + [dur]
shots = []
for k in range(len(bounds) - 1):
    a, b = bounds[k], bounds[k + 1]
    mid = (a + b) / 2
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{mid:.2f}", "-i", src, "-frames:v", "1", "-update", "1",
                    f"{D}/shots/shot_{k:02d}_{mid:05.2f}.png"], check=True)
    rs = [x for x in rows if a <= x["t"] < b]
    shots.append(dict(i=k, start=round(a, 2), end=round(b, 2), len=round(b - a, 2),
                      luma=round(np.mean([x["luma"] for x in rs]), 1) if rs else None,
                      sat=round(np.mean([x["sat"] for x in rs]), 1) if rs else None))

# ---------- audio
au = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
summ = au[au.rfind("Summary:"):]
import re
lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1)) if "LUFS" in summ else None
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-vn", "-c:a", "libopus", "-b:a", "128k", f"{D}/analyze_in.opus"])

# ---------- summarise
def stat(key, rs=rows):
    v = [x[key] for x in rs if key in x]
    return (round(float(np.median(v)), 2), round(float(np.percentile(v, 10)), 2), round(float(np.percentile(v, 90)), 2)) if v else None


punch = [x["t"] for x in rows if abs(x.get("scale", 1) - 1) > 0.012]
summary = dict(name=name, size=f"{W}x{H}", fps=round(fps, 2), duration=round(dur, 2), lufs=lufs,
               cuts=len(cuts), cuts_per_min=round(len(cuts) / dur * 60, 1), avg_shot=round(dur / (len(cuts) + 1), 2),
               shots=shots, zoom_moves_at=punch[:60],
               colour=dict(luma=stat("luma"), contrast=stat("contrast"), saturation=stat("sat"), black_point=stat("black"),
                           white_point=stat("white"), tint_a=stat("a"), warmth_b=stat("b"), shadow_tint_b=stat("sh_b"), highlight_tint_b=stat("hi_b")),
               face=dict(centre_y=stat("face_y"), height=stat("face_h"), key_minus_fill=stat("key_fill"), face_minus_frame=stat("face_bg"),
                         skin_hue=stat("skin_hue")),
               motion=dict(mean=stat("motion")))
json.dump(dict(summary=summary, rows=rows), open(f"{D}/study.json", "w"), indent=1)
md = [f"# STUDY — {name}", "", f"`{W}x{H}` · {fps:.0f} fps · {dur:.1f} s · {lufs} LUFS · {len(cuts)} cuts ({summary['cuts_per_min']}/min, avg shot {summary['avg_shot']} s)", "",
      "## Colour & light (median / 10th / 90th pct)", ""]
for k, v in summary["colour"].items():
    md.append(f"- {k}: {v}")
for k, v in summary["face"].items():
    md.append(f"- face {k}: {v}")
md += ["", "## Shots", "", "| # | start | len (s) | luma | sat |", "|---|---|---|---|---|"]
md += [f"| {s['i']} | {s['start']} | {s['len']} | {s['luma']} | {s['sat']} |" for s in shots]
md += ["", f"Zoom/punch moves at: {', '.join(str(t) for t in punch[:40])}", "",
       "## Breakdown (filled in after looking at the frames)", "",
       "- **Typography:**", "- **Captions:**", "- **Colour grade:**", "- **Lighting:**", "- **Camera & motion:**",
       "- **Transitions:**", "- **Graphics / B-roll / 3D placement:**", "- **Music:**", "- **Sound effects:**", "- **Why it retains:**", "- **Steal this:**"]
open(f"{D}/STUDY.md", "w").write("\n".join(md) + "\n")
print(json.dumps({k: v for k, v in summary.items() if k not in ("shots", "zoom_moves_at")}, indent=1))
