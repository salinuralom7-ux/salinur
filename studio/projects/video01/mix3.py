#!/usr/bin/env python3
"""video01 v3 audio: voice + own-produced beat (music_v3.wav) + designed SFX (assets/sfx/pro).

Levels from the references (REFERENCE_BREAKDOWN.md): music ~10 dB under the voice while talking
(gentle 3 dB duck), impacts close to the voice, pops/ticks well under it. Master -14 LUFS / -1.5 dBTP.
"""
import json, re, subprocess, sys

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
P = "../../assets/sfx/pro"
MUSIC_UNDER_VOICE_DB = 7

# (raw time, sfx, gain dB relative to the "voice peak" reference)
EVENTS = [
    (0.45, "subboom", -8),           # first word lands on a low boom
    (3.50, "impact", -4),            # 67% — make a statement
    (7.02, "subboom", -10),          # hospital panel rises behind
    (9.24, "kaching", -14),          # MONEY card
    (10.26, "pop", -16), (10.28, "tick", -20),
    (10.74, "pop", -16), (10.76, "tick", -20),
    (13.50, "flash", -14),           # big dream
    (15.02, "sting", -6),            # reveal: Dr. Pandey
    (18.45, "pop", -16),             # REC shot
    (23.34, "pop", -16),
] + [(23.50 + 0.12 * k, "tick", -22) for k in range(7)] + [   # queue fills up
    (25.95, "glitch", -16),          # hard cut "now this might sound rubbish"
    (29.00, "pop", -16), (29.96, "pop", -16), (31.00, "pop", -16),
    (33.68, "pop", -16),
    (37.95, "riser", -12),           # builds into FUTURE (riser is cut dead at 40.35)
    (40.40, "impact", -2),           # FUTURE
    (41.31, "flash", -12), (41.31, "subboom", -8),   # F&F brand reveal
    (44.08, "pop", -16), (45.94, "pop", -16),
    (48.55, "subboom", -9),          # growth arrows
    (52.70, "pop", -16), (52.72, "tick", -20),
    (55.35, "impact", -8),           # BOOK A CALL
]


def run(c):
    subprocess.run(c, check=True, capture_output=True, text=True)


def lufs(p):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    e = e[e.rfind("Summary:"):]
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", e).group(1)), float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", e).group(1))


def peak(p):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-i", p, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.search(r"max_volume: (-?[\d.]+) dB", e).group(1))


run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice_cut.wav", "-af",
     "highpass=f=80,afftdn=nf=-28:nr=8,equalizer=f=6500:t=q:w=1.2:g=-2,equalizer=f=180:t=q:w=1:g=1.5,"
     "acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=3dB,alimiter=limit=0.89:level=false,"
     f"apad=whole_dur={DUR}", "-ar", "48000", "-ac", "2", "work/voice3.wav"])
V, _ = lufs("work/voice3.wav")
M, _ = lufs("work/music_v3.wav")
gm = V - MUSIC_UNDER_VOICE_DB - M

ins, ch = [], []
for k, (rt, name, g) in enumerate(EVENTS):
    p = f"{P}/{name}.wav"; ins += ["-i", p]
    gain = -3 + g - peak(p)
    ms = int(T(rt) * 1000)
    ch.append(f"[{k}]volume={gain:.1f}dB,aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[s{k}]")
mixin = "".join(f"[s{k}]" for k in range(len(EVENTS)))
run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex",
     ";".join(ch) + f";{mixin}amix=inputs={len(EVENTS)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR}", "work/sfx3.wav"])
# the riser must stop dead where the music drops out (just before FUTURE)
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/sfx3.wav", "-af",
     f"volume=enable='between(t,{T(40.33)},{T(40.39)})':volume=0", "work/sfx3b.wav"])

graph = (f"[1]volume={gm:.1f}dB[m];[0]asplit=2[v][key];"
         "[m][key]sidechaincompress=threshold=0.06:ratio=2:attack=30:release=350:makeup=1[md];"
         "[v][md][2]amix=inputs=3:normalize=0[pre]")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice3.wav", "-i", "work/music_v3.wav", "-i", "work/sfx3b.wav",
     "-filter_complex", graph, "-map", "[pre]", "-ar", "48000", "work/premaster3.wav"])
st = subprocess.run(["ffmpeg", "-hide_banner", "-i", "work/premaster3.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                     "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(st[st.rfind("{"):st.rfind("}") + 1])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/premaster3.wav", "-af",
     f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
     f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", "-ar", "48000", "work/mix3.wav"])
I, TP = lufs("work/mix3.wav")
print(f"voice {V:.1f} | music gain {gm:.1f} dB | final {I:.1f} LUFS, TP {TP:.1f}")
