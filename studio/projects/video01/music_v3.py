#!/usr/bin/env python3
"""video01 v3 score: dark, modern, bass-led beat (F minor, 100 BPM) built to the edit.

Sections (raw-footage times, mapped to the cut):
  hook+story  0      -> 14.55  pad + 808 + kick + soft hats (clap from 6.46 "let's say")
  DROP        14.55  -> 15.02  silence under "suddenly"
  story       15.02  -> 33.50  full A groove
  build       33.50  -> 40.30  16th hats, pad opens up, rolls
  SILENCE     40.30  -> 41.31  "...stealing your FUTURE" (impact SFX only)
  F&F         41.31  -> 57.40  B groove: brighter pad + pluck motif
  ending      57.40  -> end    final chord rings out
Writes work/music_v3.wav (48 kHz stereo).
"""
import sys
import numpy as np, soundfile as sf
sys.path.insert(0, "../../tools")
import synth as S

KEEP = [(0.60, 25.76), (25.95, 58.53)]


def T(t):
    off = 0.0
    for a, b in KEEP:
        if t < a:
            return off
        if t <= b:
            return off + t - a
        off += b - a
    return off + (t - KEEP[-1][1])


DUR = T(58.53) + 1.0
BPM = 100
STEP = 60 / BPM / 4                  # 16th note
BAR = 16 * STEP
CHORDS = [(53, 56, 60), (49, 53, 56), (56, 60, 63), (51, 55, 58)]   # Fm  Db  Ab  Eb
ROOTS = [29, 25, 32, 27]
MOTIF = [77, 80, 84, 80, 79, 75, 77, None]                         # F5 Ab5 C6 Ab5 G5 Eb5 F5 -

buf = np.zeros((int(DUR * S.SR) + S.SR * 3, 2))
K, B8, HAT, HATO, CLAP = S.kick(), None, S.hat(), S.hat(open_=True), S.clap()


def groove(t0, t1, clap=True, hats=8, pad_cut=1100, motif=False, level=1.0, build=False):
    """Lay bars from t0 to t1 (seconds, out-time). Grid restarts at t0."""
    nbars = int(np.ceil((t1 - t0) / BAR))
    for b in range(nbars):
        bt = t0 + b * BAR
        ch = b % 4
        S.place(buf, S.pad(CHORDS[ch], min(BAR, t1 - bt), cutoff=0.7 * pad_cut + (b * 120 if build else 0), attack=0.25, release=0.6), bt, 0.45 * level)
        for step in range(16):
            st = bt + step * STEP
            if st >= t1:
                break
            if step in (0, 6, 10) or (step == 13 and b % 2):
                S.place(buf, K, st, 0.85 * level)
            if step == 0:
                S.place(buf, S.bass808(ROOTS[ch], 1.6), st, 0.8 * level)
            if step == 10:
                S.place(buf, S.bass808(ROOTS[ch] + (3 if b % 2 else 0), 0.6, glide_from=ROOTS[ch] + 7), st, 0.6 * level)
            if clap and step == 8:
                S.place(buf, CLAP, st, 0.55 * level)
            every = 2 if hats == 8 else 1
            if step % every == 0:
                acc = 1.0 if step % 4 == 0 else 0.6
                S.place(buf, HAT, st, 0.42 * acc * level)
            if build and step >= 12 and b % 2 == 1:     # hat roll into the next bar
                for r in range(2):
                    S.place(buf, HAT, st + r * STEP / 2, 0.32 * level)
            if step == 14 and b % 4 == 3:
                S.place(buf, HATO, st, 0.15 * level)
            if motif and step % 4 == 0:
                n = MOTIF[(b * 4 + step // 4) % len(MOTIF)]
                if n:
                    S.place(buf, S.reverb(S.pluck(n, 0.8), 0.3, 1.6), st, 0.35 * level)
    # cut anything that rang past the section end (the silences must be silent)
    i1 = int(t1 * S.SR)
    fade = int(0.04 * S.SR)
    return i1, fade


def silence(t0, t1, fade_in=0.03):
    i0, i1 = int(t0 * S.SR), int(t1 * S.SR)
    f = int(0.03 * S.SR)
    buf[i0 - f:i0] *= np.linspace(1, 0, f)[:, None]
    buf[i0:i1] = 0


groove(0.0, T(14.55), clap=False, pad_cut=900, level=0.9)
# claps from "let's say" in the first section
for b in range(int((T(14.55) - T(6.46)) / BAR) + 1):
    st = T(6.46) + b * BAR + 8 * STEP
    if st < T(14.5):
        S.place(buf, CLAP, st, 0.5)
silence(T(14.55), T(15.02))
groove(T(15.02), T(33.5), clap=True, pad_cut=1000)
groove(T(33.5), T(40.30), clap=True, hats=16, pad_cut=1100, build=True, level=1.05)
silence(T(40.30), T(41.31))
groove(T(41.31), T(57.40), clap=True, hats=8, pad_cut=2200, motif=True, level=1.0)
silence(T(57.40), T(57.42))
S.place(buf, S.pad(CHORDS[0] + (65,), 2.0, cutoff=2400, attack=0.05, release=1.5), T(57.42), 1.1)
S.place(buf, S.bass808(29, 2.2), T(57.42), 0.8)
S.place(buf, K, T(57.42), 0.9)

out = buf[: int(DUR * S.SR)]
tail = int(1.2 * S.SR)
out[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 1.5
out = S.norm(out, 0.89).astype(np.float32)
sf.write("work/music_v3.wav", out, S.SR)
print("music_v3.wav", round(len(out) / S.SR, 2), "s")
