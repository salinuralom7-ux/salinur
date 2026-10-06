#!/usr/bin/env python3
"""video02 mix: ElevenLabs VO + own score (music.py) + SFX on every element (ref16 density ≈1/s). Loudnorm -14 LUFS."""
import json, re, subprocess, sys
sys.argv = [sys.argv[0]]
import render as R
T, TE = R.T, R.TE
DUR = R.END
P1, PP = "../../assets/sfx/pack01", "../../assets/sfx/pro"
MUSIC_UNDER = [(0.0, 10), (13.4, 9), (24.3, 8), (27.45, 6.5), (35.0, 8), (37.9, 3)]
pop, wh, wh2, clk = f"{P1}/04_pop.wav", f"{P1}/01_whoosh.wav", f"{P1}/19_whoosh_2.wav", f"{P1}/03_click.wav"
SFX = [
    (0.02, f"{PP}/subboom.wav", -12), (0.08, pop, -17), (T(4), pop, -15), (T(4), clk, -21), (T(7), clk, -21),
    (3.33, wh, -15), (3.40, pop, -18), (T(11), clk, -21), (T(14), f"{P1}/34_ding.wav", -17), (T(14), clk, -21),
    (6.13, wh, -15), (6.20, pop, -18), (T(20), clk, -21), (T(21), clk, -21),
    (10.03, wh, -15), (10.10, pop, -18), (T(27), pop, -17), (T(28) - 0.2, f"{P1}/31_clock_ticking.wav", -19), (T(28), clk, -21),
    (13.33, f"{P1}/28_sudden_suspense.wav", -13), (13.5, wh2, -18), (T(34), clk, -21),
    (15.23, wh, -15), (15.30, pop, -18), (T(38), wh2, -17), (T(40), f"{P1}/34_ding.wav", -15), (T(40), f"{PP}/subboom.wav", -16),
    (18.43, wh, -15), (TE(48) - 0.1, f"{P1}/20_paper.wav", -19), (T(49) - 0.1, wh, -13), (T(49), pop, -16),
    (T(54), wh2, -17), (T(55), wh2, -18), (T(56), wh2, -17), (T(57), wh2, -18), (T(58), wh2, -18),
    (24.28, wh, -15), (T(60) - 0.02, clk, -12), (T(60), f"{P1}/29_boom.wav", -16), (T(63), f"{P1}/26_cinematic_hit.wav", -9),
    (T(64) - 0.05, f"{P1}/05_cash_register.wav", -14),
    (27.45, f"{P1}/08_whoosh_fire_transition.wav", -12), (27.45, f"{PP}/subboom.wav", -9), (T(66) + 0.35, pop, -14),
    (T(67) + 0.05, wh2, -16), (T(67) + 0.3, f"{P1}/34_ding.wav", -17), (T(68), clk, -21),
    (30.38, wh, -15), (T(72), f"{P1}/18_camera_shutter.wav", -14), (T(73), f"{P1}/27_in_and_out.wav", -18), (T(76), clk, -21),
    (T(81), f"{P1}/26_cinematic_hit.wav", -13),
    (35.03, wh, -15), (35.15, f"{PP}/phone_ring.wav", -17), (36.15, f"{P1}/22_display_digits.wav", -17),
    (37.9, f"{P1}/29_boom.wav", -10), (38.1, pop, -16),
]


def run(c):
    subprocess.run(c, check=True, capture_output=True, text=True)


def lufs(p):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    e = e[e.rfind("Summary:"):]
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", e).group(1))


def peak(p):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-i", p, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.search(r"max_volume: (-?[\d.]+) dB", e).group(1))


run(["ffmpeg", "-y", "-loglevel", "error", "-i", "raw/vo.mp3", "-af",
     "highpass=f=70,acompressor=threshold=-18dB:ratio=2.5:attack=5:release=80:makeup=2dB,alimiter=limit=0.89:level=false,"
     f"apad=whole_dur={DUR}", "-ar", "48000", "-ac", "2", "work/voice.wav"])
V, M = lufs("work/voice.wav"), lufs("work/music.wav")
expr = []
for k, (t0, under) in enumerate(MUSIC_UNDER):
    g = 10 ** ((V - under - M) / 20)
    t1 = MUSIC_UNDER[k + 1][0] if k + 1 < len(MUSIC_UNDER) else 999
    expr.append(f"between(t,{t0},{t1})*{g:.5f}")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/music.wav", "-af", f"volume='{'+'.join(expr)}':eval=frame", "work/music_lv.wav"])
ins, ch = [], []
for k, (t, f, g) in enumerate(SFX):
    ins += ["-i", f]; gain = -3 + g - peak(f); ms = int(max(0, t) * 1000)
    ch.append(f"[{k}]volume={gain:.1f}dB,aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[s{k}]")
run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex",
     ";".join(ch) + ";" + "".join(f"[s{k}]" for k in range(len(SFX))) + f"amix=inputs={len(SFX)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR}",
     "work/sfx.wav"])
g = ("[0]asplit=2[v][key];[1][key]sidechaincompress=threshold=0.08:ratio=2:attack=30:release=300:makeup=1[md];"
     "[v][md][2]amix=inputs=3:normalize=0[pre]")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice.wav", "-i", "work/music_lv.wav", "-i", "work/sfx.wav",
     "-filter_complex", g, "-map", "[pre]", "-ar", "48000", "work/premaster.wav"])
st = subprocess.run(["ffmpeg", "-hide_banner", "-i", "work/premaster.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                    capture_output=True, text=True).stderr
m = json.loads(st[st.rfind("{"):st.rfind("}") + 1])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/premaster.wav", "-af",
     f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
     f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", "-ar", "48000", "work/mix.wav"])
print("SFX", len(SFX), "final", lufs("work/mix.wav"))
