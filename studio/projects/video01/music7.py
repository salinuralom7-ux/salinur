#!/usr/bin/env python3
"""video01 v7 score (own synthesis): soft, bright modern bed (ref17 feel) — 100 BPM, C major, light beat.
Quiet under talking, lifts inside the full-screen story scenes, warm resolve on the outro."""
import os, sys
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "tools"))
import synth as S

DUR = 60.0
B = 60 / 100
BAR = 4 * B
buf = np.zeros((int((DUR + 4) * S.SR), 2))
C, G, Am, F = (60, 64, 67), (55, 59, 62), (57, 60, 64), (53, 57, 60)
PROG, ROOT = [C, G, Am, F], [36, 31, 33, 29]
ARP = [[72, 76, 79, 76], [71, 74, 79, 74], [72, 76, 81, 76], [72, 77, 81, 77]]

t, k = 0.0, 0
while t < DUR - 0.1:
    i = k % 4
    S.place(buf, S.pad(PROG[i], BAR, cutoff=2400, attack=0.25, release=0.8, level=0.24), t, 0.55)
    S.place(buf, S.lp(S.bass808(ROOT[i], BAR * 0.9) * 0.7, 200), t, 0.45)
    for j in range(16):
        tj = t + j * B / 4
        if j in (0, 8):
            S.place(buf, S.lp(S.kick(), 1500), tj, 0.45)
        if j in (4, 12):
            S.place(buf, S.clap(), tj, 0.16)
        if j % 2 == 0:
            S.place(buf, S.hat(), tj, 0.07 if j % 4 else 0.04)
        if j % 4 == 2:
            S.place(buf, S.reverb(S.pluck(ARP[i][j // 4], 0.45, 0.18), 0.35, 1.6), tj, 0.35)
    t += BAR; k += 1
S.place(buf, S.pad((60, 64, 67, 72), 2.6, cutoff=3000, attack=0.05, release=1.5, level=0.34), 57.4, 1.0)
out = buf[: int(DUR * S.SR)]
tail = int(1.5 * S.SR); out[-tail:] *= np.linspace(1, 0, tail)[:, None]
sf.write(os.path.join(HERE, "work", "music7.wav"), S.norm(out, 0.89).astype(np.float32), S.SR)
print("ok")
