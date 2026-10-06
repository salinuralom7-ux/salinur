#!/usr/bin/env python3
"""Money Explained #001 score (own synthesis): confident modern beat, 92 BPM, A minor.
Hook 0-9.45 filtered + sparse (tension) · DROP on "Lifestyle Creep" 9.45 · break at "Ilaaj" 24.7 (bright pad)
· full again 26.0-37.7 · outro chord + light groove to the end."""
import os, sys
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "tools"))
import synth as S

DUR = 42.6
B = 60 / 92
BAR = 4 * B
buf = np.zeros((int((DUR + 4) * S.SR), 2))
Am, F, C, G = (57, 60, 64), (53, 57, 60), (48, 52, 55), (55, 59, 62)
PROG, ROOT = [Am, F, C, G], [33, 29, 36, 31]
LEAD = [[76, 72, 69, 72], [77, 72, 69, 72], [76, 72, 67, 72], [74, 71, 67, 71]]


def section(t0, t1, pad=0.5, kick=0.0, clap=0.0, hat=0.0, bass=0.0, lead=0.0, cutoff=1500, k=0):
    t = t0
    while t < t1 - 0.05:
        i = k % 4
        d = min(BAR, t1 - t)
        S.place(buf, S.pad(PROG[i], d, cutoff=cutoff, attack=0.3, release=0.8, level=0.28), t, pad)
        if bass:
            S.place(buf, S.lp(S.bass808(ROOT[i], min(d, BAR) * 0.9) * 0.9, 220), t, bass)
        for j in range(16):
            tj = t + j * B / 4
            if tj >= t1:
                break
            if kick and j in (0, 6, 10):
                S.place(buf, S.kick(), tj, kick)
            if clap and j in (4, 12):
                S.place(buf, S.clap(), tj, clap)
            if hat and j % 2 == 0:
                S.place(buf, S.hat(), tj, hat * (1.0 if j % 4 == 2 else 0.6))
            if lead and j % 4 == 0:
                S.place(buf, S.reverb(S.pluck(LEAD[i][j // 4], 0.5, 0.2), 0.3, 1.6), tj, lead)
        t += BAR; k += 1
    return k


# hook: muffled groove (lowpassed later) so the drop hits
hook = section(0.0, 9.45, pad=0.45, kick=0.35, hat=0.10, bass=0.30, cutoff=700)
i0, i1 = 0, int(9.45 * S.SR)
buf[i0:i1] = np.stack([S.lp(buf[i0:i1, 0], 900), S.lp(buf[i0:i1, 1], 900)], 1)
S.place(buf, S.sfx_riser(1.6), 7.85, 0.30)
k = section(9.45, 24.7, pad=0.55, kick=0.7, clap=0.35, hat=0.22, bass=0.7, lead=0.45, cutoff=2200)
S.place(buf, S.pad((57, 64, 69, 72, 76), 1.4, cutoff=3200, attack=0.05, release=0.8, level=0.34), 24.75, 0.9)
k = section(26.0, 37.7, pad=0.6, kick=0.7, clap=0.35, hat=0.25, bass=0.7, lead=0.55, cutoff=2600, k=2)
k = section(37.7, 41.8, pad=0.6, kick=0.5, hat=0.18, bass=0.6, lead=0.4, cutoff=2600, k=0)
S.place(buf, S.pad((57, 64, 69, 72), 2.4, cutoff=3000, attack=0.02, release=1.4, level=0.36), 41.8, 1.0)
S.place(buf, S.lp(S.bass808(33, 2.2), 220), 41.8, 0.7)
out = buf[: int(DUR * S.SR)]
tail = int(1.0 * S.SR); out[-tail:] *= np.linspace(1, 0, tail)[:, None]
sf.write(os.path.join(HERE, "work", "music.wav"), S.norm(out, 0.89).astype(np.float32), S.SR)
print("ok")
