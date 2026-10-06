#!/usr/bin/env python3
"""video01 v5 score — house style (own01/own02): soft cinematic pad + long sub-bass notes, no drums.
Sections (out-time): hook 0-14.0 (sparse, low) · story 14.0-25.2 (swell) · tension 25.2-39.45 (darker, rising)
· silence 39.45-40.5 (before/at FUTURE) · F&F 40.5-57.5 (bright, pluck motif) · outro 57.5-59.9 (full chord)."""
import sys
import numpy as np, soundfile as sf
sys.path.insert(0, "../../tools")
import synth as S

DUR = 59.9
buf = np.zeros((int((DUR + 3) * S.SR), 2))
BAR = 3.2   # slow chord changes every 3.2 s (house: 3-6 s)


def chords(t0, t1, prog, roots, cutoff, level, pluck=None, bass=True):
    t = t0; k = 0
    while t < t1 - 0.2:
        d = min(BAR, t1 - t)
        S.place(buf, S.pad(prog[k % len(prog)], d, cutoff=cutoff, attack=0.9, release=1.6, level=0.30), t, level)
        if bass:
            S.place(buf, S.lp(S.bass808(roots[k % len(roots)], d + 0.5) * 0.7, 300), t, level * 0.9)
        if pluck:
            for j, n in enumerate(pluck[k % len(pluck)]):
                S.place(buf, S.reverb(S.pluck(n, 1.2, 0.22), 0.35, 2.2), t + j * BAR / 4, level * 0.8)
        t += BAR; k += 1


def cut(t0, t1):
    i0, i1 = int(t0 * S.SR), int(t1 * S.SR); f = int(0.05 * S.SR)
    buf[i0 - f:i0] *= np.linspace(1, 0, f)[:, None]; buf[i0:i1] = 0


Fm, Db, Ab, Eb, Bbm, C = (53, 56, 60), (49, 53, 56), (56, 60, 63), (51, 55, 58), (58, 61, 65), (48, 52, 55)
chords(0.0, 14.0, [Fm, Db], [29, 25], 700, 0.55)
chords(14.0, 25.2, [Fm, Db, Ab, Eb], [29, 25, 32, 27], 1100, 0.85)
chords(25.2, 39.45, [Bbm, Fm, Db, C], [34, 29, 25, 24], 1400, 1.0)
cut(39.45, 40.50)
chords(40.50, 57.5, [Ab, Eb, Fm, Db], [32, 27, 29, 25], 2600, 0.95,
       pluck=[[72, 75, 79, 75], [70, 74, 77, 74], [72, 77, 80, 77], [73, 77, 80, 77]])
cut(57.42, 57.5)
S.place(buf, S.pad((56, 60, 63, 68), 2.3, cutoff=3000, attack=0.05, release=1.8, level=0.42), 57.5, 1.0)
S.place(buf, S.lp(S.bass808(32, 2.5), 300), 57.5, 0.9)
out = buf[: int(DUR * S.SR)]
tail = int(1.0 * S.SR); out[-tail:] *= np.linspace(1, 0, tail)[:, None]
sf.write("work/music_v5.wav", S.norm(out, 0.89).astype(np.float32), S.SR)
print("ok")
