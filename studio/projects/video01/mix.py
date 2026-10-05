#!/usr/bin/env python3
"""video01 audio: cleaned voice + ducked music (A: story, B: F&F) + SFX -> work/mix.wav at -14 LUFS."""
import json, re, subprocess

r = type("R", (), {})()
src = open("render.py").read().split("def main")[0]  # timing helpers only, no rendering
exec(compile(src, "render.py", "exec"), r.__dict__)
to_out = r.to_out

STUDIO = "../.."
DUR = to_out(58.53) + r.TAIL
MUSIC_A = f"{STUDIO}/assets/music/suspense/Investigations.mp3"
MUSIC_B = f"{STUDIO}/assets/music/motivational/Inspired.mp3"
SFX = f"{STUDIO}/assets/sfx"

A_END = to_out(40.30)          # music drops out just before "future"
B_START = to_out(41.31)        # "We are F&F"
MUSIC_UNDER_VOICE_DB = 19      # music loudness below voice before ducking (ducking adds ~5 dB more under speech)
SFX_UNDER_VOICE_DB = 20

# (out_time, file, extra_gain_db)
EVENTS = [
    (to_out(3.54) - 0.02, "pop/k_pluck_002.wav", 0),
    (to_out(7.05) - 0.12, "whoosh/synth_whoosh_fast.wav", 0),
    (to_out(15.25) - 0.12, "whoosh/synth_whoosh_fast.wav", 0),
    (to_out(18.80), "pop/k_pluck_001.wav", 0),
    (to_out(23.55) - 0.12, "whoosh/synth_whoosh_soft.wav", 0),
    (to_out(28.85) - 0.12, "whoosh/synth_whoosh_fast.wav", 0),
    (to_out(29.0) - 0.08, "click/k_click_004.wav", -4),
    (to_out(29.96) - 0.08, "click/k_click_004.wav", -4),
    (to_out(31.0) - 0.08, "click/k_click_004.wav", -4),
    (to_out(40.40) - 1.6, "riser/synth_riser_1s6.wav", -2),
    (to_out(40.99), "impact/k_soft_heavy_000.wav", 2),
    (to_out(41.85) - 0.12, "whoosh/synth_whoosh_soft.wav", 0),
    (to_out(44.00), "pop/k_pluck_002.wav", 0),
    (to_out(45.94) - 0.05, "pop/k_pluck_001.wav", 0),
    (to_out(48.65), "pop/k_drop_002.wav", 0),
    (to_out(52.65), "ding/k_glass_001.wav", 0),
    (to_out(57.55) - 0.12, "whoosh/synth_whoosh_soft.wav", 0),
]


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
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice_cut.wav", "-af",
     "highpass=f=80,afftdn=nf=-28:nr=8,equalizer=f=6500:t=q:w=1.2:g=-2,"
     "acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=3dB,alimiter=limit=0.89:level=false,"
     f"apad=whole_dur={DUR}", "-ar", "48000", "-ac", "2", "work/voice_clean.wav"])
V, _ = lufs("work/voice_clean.wav")

# 2. Music bed in out-time.
run(["ffmpeg", "-y", "-loglevel", "error", "-i", MUSIC_A, "-i", MUSIC_B, "-filter_complex",
     f"[0]atrim=0:{A_END},afade=t=in:d=0.3,afade=t=out:st={A_END - 0.25}:d=0.25,aresample=48000[a];"
     f"[1]atrim=0:{DUR - B_START},afade=t=in:d=0.12,afade=t=out:st={DUR - B_START - 1.6}:d=1.6,"
     f"adelay={int(B_START * 1000)}|{int(B_START * 1000)},aresample=48000[b];"
     f"[a][b]amix=inputs=2:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR}",
     "-ac", "2", "work/music_bed.wav"])
# measure each part separately so both sit at the same level under the voice
run(["ffmpeg", "-y", "-loglevel", "error", "-i", MUSIC_A, "-t", str(A_END), "work/_a.wav"])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", MUSIC_B, "-t", str(DUR - B_START), "work/_b.wav"])
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
     "work/sfx.wav"])

# 4. Duck music under voice, sum, master to -14 LUFS / -1.5 dBTP (two-pass loudnorm).
graph = (f"[1]volume=enable='lt(t,{B_START})':volume={ga:.1f}dB,volume=enable='gte(t,{B_START})':volume={gb:.1f}dB[m];"
         "[0]asplit=2[v][key];"
         "[m][key]sidechaincompress=threshold=0.05:ratio=2.5:attack=30:release=400:makeup=1[md];"
         "[v][md][2]amix=inputs=3:normalize=0[pre]")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice_clean.wav", "-i", "work/music_bed.wav", "-i", "work/sfx.wav",
     "-filter_complex", graph, "-map", "[pre]", "-ar", "48000", "work/premaster.wav"])
st = subprocess.run(["ffmpeg", "-hide_banner", "-i", "work/premaster.wav", "-af",
                     "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(st[st.rfind("{"):st.rfind("}") + 1])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/premaster.wav", "-af",
     f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
     f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", "-ar", "48000", "work/mix.wav"])
I, TP = lufs("work/mix.wav")
print(f"voice {V:.1f} LUFS | music gain A {ga:.1f} dB, B {gb:.1f} dB | final {I:.1f} LUFS, true peak {TP:.1f} dBTP")
