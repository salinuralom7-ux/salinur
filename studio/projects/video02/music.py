#!/usr/bin/env python3
"""video02 score (own synthesis) — ref16-style cinematic lo-fi bed, 96 BPM, D minor -> F major lift.
0-13.4 story (pad + soft pluck arps + gentle kick/hat) · 13.4-24.3 fuller (bass) · 24.3-27.1 build (riser)
· 27.1-27.45 gap · 27.45 logo drop (full) · 35.0-39.6 outro resolve."""
import sys, os
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
import synth as S

DUR = 39.6
BPM = 96
B = 60 / BPM
BAR = 4 * B
buf = np.zeros((int((DUR + 4) * S.SR), 2))

Dm, Bb, F, C, Gm, A_ = (50, 53, 57), (46, 50, 53), (53, 57, 60), (48, 52, 55), (55, 58, 62), (49, 52, 57)
PROG = [Dm, Bb, F, C]
ROOT = [38, 34, 41, 36]
ARP = [[62, 65, 69, 65, 74, 69, 65, 62], [58, 62, 65, 62, 70, 65, 62, 58], [60, 65, 69, 65, 72, 69, 65, 60], [60, 64, 67, 64, 72, 67, 64, 60]]


def section(t0, t1, pad_lvl, arp_lvl, kick_lvl, hat_lvl, bass_lvl, cutoff, k0=0):
    t = t0; k = k0
    while t < t1 - 0.05:
        d = min(BAR, t1 - t)
        i = k % 4
        S.place(buf, S.pad(PROG[i], d, cutoff=cutoff, attack=0.5, release=1.2, level=0.3), t, pad_lvl)
        if bass_lvl:
            S.place(buf, S.lp(S.bass808(ROOT[i], min(d, BAR) + 0.3) * 0.8, 260), t, bass_lvl)
        for j in range(8):
            tj = t + j * B / 2
            if tj >= t1:
                break
            if arp_lvl:
                S.place(buf, S.reverb(S.pluck(ARP[i][j], 0.8, 0.2), 0.3, 1.8), tj, arp_lvl * (1.0 if j % 2 == 0 else 0.7))
            if hat_lvl and j % 2 == 1:
                S.place(buf, S.stereo(S.hat(), 0.3) if False else S.hat(), tj, hat_lvl)
        for j in range(4):
            tj = t + j * B
            if tj >= t1:
                break
            if kick_lvl and j in (0, 2):
                S.place(buf, S.lp(S.kick(), 1800), tj, kick_lvl)
        t += BAR; k += 1
    return k


k = section(0.0, 13.4, 0.55, 0.45, 0.35, 0.12, 0.0, 900)
k = section(13.4, 24.3, 0.7, 0.55, 0.5, 0.18, 0.55, 1300, k)
k = section(24.3, 27.1, 0.75, 0.6, 0.0, 0.25, 0.6, 1700, k)
S.place(buf, S.sfx_riser(2.8), 24.3, 0.35)
cut0, cut1 = int(27.1 * S.SR), int(27.45 * S.SR)
fl = int(0.04 * S.SR)
buf[cut0 - fl:cut0] *= np.linspace(1, 0, fl)[:, None]; buf[cut0:cut1] = 0
section(27.45, 35.0, 0.85, 0.7, 0.7, 0.22, 0.75, 2400, 2)
k = section(35.0, 38.0, 0.8, 0.55, 0.5, 0.15, 0.7, 2000, 0)
S.place(buf, S.pad((50, 57, 62, 65, 69), 2.6, cutoff=2600, attack=0.05, release=1.8, level=0.36), 38.0, 1.0)
S.place(buf, S.lp(S.bass808(38, 2.6), 260), 38.0, 0.8)
out = buf[: int(DUR * S.SR)]
tail = int(1.2 * S.SR); out[-tail:] *= np.linspace(1, 0, tail)[:, None]
os.makedirs("work", exist_ok=True)
sf.write("work/music.wav", S.norm(out, 0.89).astype(np.float32), S.SR)
print("ok", out.shape)
