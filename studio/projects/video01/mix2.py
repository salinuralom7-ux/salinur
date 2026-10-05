#!/usr/bin/env python3
"""video01 v2 audio (dense sound design): cleaned voice + ducked music (A: story, B: F&F) + SFX -> work/mix.wav at -14 LUFS."""
import json, re, subprocess

r = type("R", (), {})()
src = open("render2.py").read().split("# ------------------------------------------------------------------ grade")[0]  # timing helpers only, no rendering
exec(compile(src, "render.py", "exec"), r.__dict__)
to_out = r.to_out

STUDIO = "../.."
import sys
END_RAW = float(sys.argv[1]) if len(sys.argv) > 1 else 58.53
DUR = to_out(END_RAW) + (0.6 if END_RAW < 58 else 1.0)
MUSIC_A = f"{STUDIO}/assets/music/suspense/Investigations.mp3"
MUSIC_B = f"{STUDIO}/assets/music/motivational/Inspired.mp3"
SFX = f"{STUDIO}/assets/sfx"

A_END = min(DUR, to_out(40.30))
B_START = to_out(41.31)
MUSIC_UNDER_VOICE_DB = 19
SFX_UNDER_VOICE_DB = 19
DROP = (to_out(14.60), to_out(15.00))   # music ducks out on "suddenly"

T = to_out
EVENTS = [
    (0.0, "whoosh/synth_whoosh_soft.wav", -4),
    (T(2.45) - 0.05, "whoosh/synth_whoosh_soft.wav", -8),
    (T(3.30), "whoosh/synth_whoosh_fast.wav", -3),
    (T(3.45), "synth/boom.wav", 0),
] + [(T(3.45) + 0.06 * k, "click/k_tick_001.wav", -9) for k in range(9)] + [
    (T(4.84) - 0.03, "whoosh/synth_whoosh_soft.wav", -8),
    (T(5.68) - 0.03, "whoosh/synth_whoosh_soft.wav", -8),
    (T(7.05) - 0.18, "whoosh/synth_whoosh_fast.wav", 0),
    (T(7.05) + 0.42, "impact/k_soft_heavy_000.wav", -2),
    (T(7.05) + 0.55, "pop/k_pluck_002.wav", -2),
    (T(9.15) - 0.15, "swoosh-out/synth_swoosh_out.wav", -2),
    (T(9.24), "synth/coin.wav", -4),
    (T(10.24), "click/k_click_004.wav", -2),
    (T(10.72), "impact/k_punch_medium_000.wav", -4),
    (T(12.20), "riser/synth_riser_1s6.wav", -6),
    (T(13.42), "synth/shimmer.wav", 2),
    (T(14.60), "synth/k_scratch_001.wav", 0),
    (T(14.62), "synth/boom.wav", -3),
    (T(15.00) - 0.18, "whoosh/synth_whoosh_fast.wav", 0),
    (T(15.00) + 0.35, "impact/k_soft_heavy_000.wav", -4),
    (T(15.00) + 0.57, "pop/k_pluck_001.wav", -3),
    (T(15.00) + 0.67, "pop/k_drop_002.wav", -3),
    (T(17.62) - 0.15, "swoosh-out/synth_swoosh_out.wav", -2),
    (T(18.45) - 0.18, "whoosh/synth_whoosh_fast.wav", 0),
    (T(18.45) + 0.05, "synth/shutter.wav", -4),
    (T(18.45) + 0.30, "synth/rec_beep.wav", -6),
]
EVENTS = [e for e in EVENTS if e[0] < DUR - 0.2]


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def lufs(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summ = err[err.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summ).group(1))
    return i, tp


def peak(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.search(r"max_volume: (-?[\d.]+) dB", err).group(1))


# 1. Voice: rumble cut, gentle de-noise, de-ess-ish shelf, compression, soft limit.
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice_cut.wav", "-t", str(DUR), "-af",
     "highpass=f=80,afftdn=nf=-28:nr=8,equalizer=f=6500:t=q:w=1.2:g=-2,"
     "acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=3dB,alimiter=limit=0.89:level=false,"
     f"apad=whole_dur={DUR}", "-ar", "48000", "-ac", "2", "work/voice_clean2.wav"])
V, _ = lufs("work/voice_clean2.wav")

# 2. Music bed in out-time.
run(["ffmpeg", "-y", "-loglevel", "error", "-i", MUSIC_A, "-i", MUSIC_B, "-filter_complex",
     f"[0]atrim=0:{A_END},afade=t=in:d=0.3,afade=t=out:st={A_END - 0.6}:d=0.6,aresample=48000,"
     f"volume=enable='between(t,{DROP[0]},{DROP[1]})':volume=0.08[a];"
     + (f"[1]atrim=0:{DUR - B_START},afade=t=in:d=0.12,afade=t=out:st={DUR - B_START - 1.6}:d=1.6,"
        f"adelay={int(B_START * 1000)}|{int(B_START * 1000)},aresample=48000[b];[a][b]amix=inputs=2:normalize=0," if DUR > B_START + 2 else "[a]anull,")
     + f"apad=whole_dur={DUR},atrim=0:{DUR}",
     "-ac", "2", "work/music_bed2.wav"])
# measure each part separately so both sit at the same level under the voice
run(["ffmpeg", "-y", "-loglevel", "error", "-i", MUSIC_A, "-t", str(A_END), "work/_a.wav"])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", MUSIC_B, "-t", str(max(3, DUR - B_START)), "work/_b.wav"])
ga = V - MUSIC_UNDER_VOICE_DB - lufs("work/_a.wav")[0]
gb = V - MUSIC_UNDER_VOICE_DB - lufs("work/_b.wav")[0]

# 3. SFX track.
inputs, chains = [], []
target_peak = -3 - SFX_UNDER_VOICE_DB  # voice peaks around -3 dBFS after the limiter
for k, (t, f, extra) in enumerate(EVENTS):
    path = f"{SFX}/{f}"; inputs += ["-i", path]
    g = target_peak - peak(path) + extra
    ms = max(0, int(t * 1000))
    chains.append(f"[{k}]volume={g:.1f}dB,aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[s{k}]")
mixin = "".join(f"[s{k}]" for k in range(len(EVENTS)))
run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex",
     ";".join(chains) + f";{mixin}amix=inputs={len(EVENTS)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR}",
     "work/sfx2.wav"])

# 4. Duck music under voice, sum, master to -14 LUFS / -1.5 dBTP (two-pass loudnorm).
graph = (f"[1]volume=enable='lt(t,{B_START})':volume={ga:.1f}dB,volume=enable='gte(t,{B_START})':volume={gb:.1f}dB[m];"
         "[0]asplit=2[v][key];"
         "[m][key]sidechaincompress=threshold=0.05:ratio=2.5:attack=30:release=400:makeup=1[md];"
         "[v][md][2]amix=inputs=3:normalize=0[pre]")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice_clean2.wav", "-i", "work/music_bed2.wav", "-i", "work/sfx2.wav",
     "-filter_complex", graph, "-map", "[pre]", "-ar", "48000", "work/premaster2.wav"])
st = subprocess.run(["ffmpeg", "-hide_banner", "-i", "work/premaster2.wav", "-af",
                     "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(st[st.rfind("{"):st.rfind("}") + 1])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/premaster2.wav", "-af",
     f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
     f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", "-ar", "48000", "work/mix2.wav"])
I, TP = lufs("work/mix2.wav")
print(f"voice {V:.1f} LUFS | music gain A {ga:.1f} dB, B {gb:.1f} dB | final {I:.1f} LUFS, true peak {TP:.1f} dBTP")
