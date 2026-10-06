#!/usr/bin/env python3
"""video01 v4 audio (v3 + sounds for the story scenes and front overlays): voice + own-produced beat (music_v3.wav) + designed SFX (assets/sfx/pro).

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
def R_(out_t):     # out-time -> raw-time (inverse of T)
    return out_t + 0.60 if out_t <= 25.16 else out_t + 0.79


EVENTS = [
    (0.45, "subboom", -8),
    (3.50, "impact", -4),                # 67%
    (7.02, "subboom", -10),              # hospital rises behind him
    (9.20, "kaching", -14),              # money rain
] + [(9.30 + 0.09 * k, "paper_flip", -24) for k in range(6)] + [
    (10.24, "pop", -16),                 # calendar appears
] + [(10.42 + 0.22 * k, "paper_flip", -18) for k in range(5)] + [   # pages tear off
    (13.50, "flash", -14),               # big dream
    (R_(14.42), "sting", -6),            # Dr. Pandey arrives (story scene)
    (R_(16.63), "pop", -14),             # OPEN sign
    (R_(17.64), "pop", -16),             # filming scene
    (R_(17.90), "rec_beep", -20),
    (R_(19.58), "subboom", -12),         # someday you step out
    (R_(22.10), "pop", -16),             # the queue
    (25.95, "glitch", -16),              # hard cut: "now this might sound rubbish"
    (29.00, "pop", -16), (29.96, "pop", -16), (31.00, "pop", -16),
    (33.28, "pop", -16), (33.40, "rec_beep", -20),   # just a camera
    (R_(33.69), "subboom", -10),         # patients walk to his clinic
    (37.95, "riser", -12),
    (40.40, "impact", -2),               # FUTURE
    (41.31, "flash", -12), (41.31, "subboom", -8),
    (44.08, "pop", -16), (45.94, "pop", -16),
    (48.55, "subboom", -9),
    (52.65, "phone_ring", -16),          # give us a call
    (55.35, "impact", -8),               # BOOK A CALL
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
     f"apad=whole_dur={DUR}", "-ar", "48000", "-ac", "2", "work/voice4.wav"])
V, _ = lufs("work/voice4.wav")
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
     ";".join(ch) + f";{mixin}amix=inputs={len(EVENTS)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR}", "work/sfx4.wav"])
# the riser must stop dead where the music drops out (just before FUTURE)
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/sfx4.wav", "-af",
     f"volume=enable='between(t,{T(40.33)},{T(40.39)})':volume=0", "work/sfx4b.wav"])

graph = (f"[1]volume={gm:.1f}dB[m];[0]asplit=2[v][key];"
         "[m][key]sidechaincompress=threshold=0.06:ratio=2:attack=30:release=350:makeup=1[md];"
         "[v][md][2]amix=inputs=3:normalize=0[pre]")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice4.wav", "-i", "work/music_v3.wav", "-i", "work/sfx4b.wav",
     "-filter_complex", graph, "-map", "[pre]", "-ar", "48000", "work/premaster4.wav"])
st = subprocess.run(["ffmpeg", "-hide_banner", "-i", "work/premaster4.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                     "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(st[st.rfind("{"):st.rfind("}") + 1])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/premaster4.wav", "-af",
     f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
     f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", "-ar", "48000", "work/mix4.wav"])
I, TP = lufs("work/mix4.wav")
print(f"voice {V:.1f} | music gain {gm:.1f} dB | final {I:.1f} LUFS, TP {TP:.1f}")
