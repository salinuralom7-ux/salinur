#!/usr/bin/env python3
"""Runs on GitHub's runner. Wav2Lip (GAN) lip-sync of <dir>/face.mp4 to <dir>/audio.wav, then GFPGAN face restore.
Writes <dir>/out_wav2lip.mp4 and <dir>/out_ai.mp4 (restored). Weights are found on HuggingFace / original hosts."""
import os, subprocess, sys, glob, urllib.request
import cv2, numpy as np

D = os.path.abspath(sys.argv[1])
W2L = os.path.abspath("Wav2Lip")


def fetch_hf(fname, prefer=()):
    from huggingface_hub import HfApi, hf_hub_download
    api = HfApi()
    repos = list(prefer) + [m.id for m in api.list_models(search="wav2lip", limit=60)]
    for r in repos:
        try:
            files = api.list_repo_files(r)
        except Exception:
            continue
        for f in files:
            if f.endswith(fname):
                try:
                    p = hf_hub_download(r, f)
                    print("got", fname, "from", r, f, flush=True)
                    return p
                except Exception as e:
                    print("fail", r, f, e)
    raise SystemExit("could not find " + fname)


ck = fetch_hf("wav2lip_gan.pth", prefer=("Nekochu/Wav2Lip", "camenduru/Wav2Lip", "numz/wav2lip_studio"))
s3 = os.path.join(W2L, "face_detection/detection/sfd/s3fd.pth")
try:
    urllib.request.urlretrieve("https://www.adrianbulat.com/downloads/python-fan/s3fd-619a316812.pth", s3)
except Exception as e:
    print("s3fd primary failed", e)
    import shutil; shutil.copy(fetch_hf("s3fd.pth"), s3)

subprocess.run([sys.executable, "inference.py", "--checkpoint_path", ck, "--face", os.path.join(D, "face.mp4"),
                "--audio", os.path.join(D, "audio.wav"), "--outfile", os.path.join(D, "out_wav2lip.mp4"),
                "--pads", "0", "20", "0", "0", "--face_det_batch_size", "4", "--wav2lip_batch_size", "32"], cwd=W2L, check=True)

# GFPGAN restore on every frame, blended only over the lower face so eyes/skin stay real
from gfpgan import GFPGANer
gp = "GFPGANv1.4.pth"
urllib.request.urlretrieve("https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth", gp)
restorer = GFPGANer(model_path=gp, upscale=1, arch="clean", channel_multiplier=2, bg_upsampler=None)
cap = cv2.VideoCapture(os.path.join(D, "out_wav2lip.mp4"))
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    _, _, out = restorer.enhance(f, has_aligned=False, only_center_face=True, paste_back=True, weight=0.6)
    frames.append(out if out is not None else f)
h, w = frames[0].shape[:2]
vw = cv2.VideoWriter("/tmp/rest.avi", cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
for f in frames:
    vw.write(f)
vw.release()
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "/tmp/rest.avi", "-i", os.path.join(D, "audio.wav"), "-c:v", "libx264",
                "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", os.path.join(D, "out_ai.mp4")], check=True)
print("done")
