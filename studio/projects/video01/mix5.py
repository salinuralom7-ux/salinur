#!/usr/bin/env python3
"""video01 v5 mix: voice + music_v5 (level automation per house style) + SFX (pack01 + pro). OUT-time."""
import json, re, subprocess
DUR = 59.9
P1, PP = "../../assets/sfx/pack01", "../../assets/sfx/pro"
# music level relative to voice (dB below) per section — own01/own02: ~18 hook -> ~10 story -> full outro
MUSIC_UNDER = [(0.0, 18), (14.0, 11), (25.2, 10), (40.5, 9), (57.5, 0)]
SFX = [  # (time, file, dB relative to voice peak)
    (0.05, f"{PP}/subboom.wav", -10),
    (2.94, f"{P1}/22_display_digits.wav", -16), (2.94, f"{P1}/26_cinematic_hit.wav", -10),
    (6.16, f"{P1}/01_whoosh.wav", -12), (6.52, f"{P1}/04_pop.wav", -16), (7.32, f"{P1}/04_pop.wav", -16),
    (7.54, f"{P1}/19_whoosh_2.wav", -16),
    (8.49, f"{P1}/20_paper.wav", -20), (8.64, f"{P1}/05_cash_register.wav", -13),
    (9.66, f"{P1}/31_clock_ticking.wav", -20), (10.14, f"{P1}/04_pop.wav", -16),
    (13.08, f"{P1}/34_ding.wav", -15),
    (14.04, f"{P1}/28_sudden_suspense.wav", -11),
    (14.42, f"{P1}/01_whoosh.wav", -12), (14.72, f"{P1}/04_pop.wav", -16), (16.82, f"{P1}/04_pop.wav", -16),
    (17.20, f"{P1}/27_in_and_out.wav", -18), (18.26, f"{P1}/18_camera_shutter.wav", -14), (18.70, f"{P1}/04_pop.wav", -17),
    (19.08, f"{P1}/19_whoosh_2.wav", -16), (19.58, f"{P1}/29_boom.wav", -14),
    (20.48, f"{P1}/01_whoosh.wav", -12), (20.62, f"{P1}/04_pop.wav", -16), (21.40, f"{P1}/04_pop.wav", -17),
    (22.04, f"{P1}/27_in_and_out.wav", -18), (22.74, f"{P1}/04_pop.wav", -16), (24.56, f"{P1}/04_pop.wav", -17),
    (24.95, f"{P1}/19_whoosh_2.wav", -16),
    (25.25, f"{P1}/24_glitch.wav", -15),
    (27.99, f"{P1}/04_pop.wav", -16), (28.21, f"{P1}/03_click.wav", -16), (29.17, f"{P1}/04_pop.wav", -16), (30.21, f"{P1}/04_pop.wav", -16),
    (32.89, f"{P1}/18_camera_shutter.wav", -14),
    (33.69, f"{P1}/01_whoosh.wav", -12), (34.15, f"{P1}/04_pop.wav", -16), (34.71, f"{P1}/04_pop.wav", -17),
    (35.30, f"{P1}/19_whoosh_2.wav", -16),
    (37.20, f"{PP}/riser.wav", -14),
    (39.63, f"{P1}/26_cinematic_hit.wav", -6),
    (40.52, f"{P1}/08_whoosh_fire_transition.wav", -11), (40.60, f"{PP}/subboom.wav", -10),
    (42.13, f"{P1}/03_click.wav", -18), (42.39, f"{P1}/03_click.wav", -18),
    (43.29, f"{P1}/04_pop.wav", -16), (44.35, f"{P1}/04_pop.wav", -16), (45.15, f"{P1}/04_pop.wav", -16), (45.53, f"{P1}/04_pop.wav", -16),
    (46.95, f"{P1}/01_whoosh.wav", -14), (47.95, f"{P1}/34_ding.wav", -15),
    (51.97, f"{P1}/04_pop.wav", -16),
    (54.0, f"{P1}/26_cinematic_hit.wav", -14),
    (57.50, f"{P1}/29_boom.wav", -6), (58.70, f"{P1}/35_glitch_2.wav", -16),
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


run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice_cut.wav", "-af",
     "highpass=f=80,afftdn=nf=-28:nr=8,equalizer=f=6500:t=q:w=1.2:g=-2,equalizer=f=180:t=q:w=1:g=1.5,"
     "acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=3dB,alimiter=limit=0.89:level=false,"
     f"apad=whole_dur={DUR}", "-ar", "48000", "-ac", "2", "work/voice5.wav"])
V, M = lufs("work/voice5.wav"), lufs("work/music_v5.wav")
# music gain automation as volume expressions per section (smooth 0.8 s ramps)
expr = []
for k, (t0, under) in enumerate(MUSIC_UNDER):
    g = 10 ** ((V - under - M) / 20)
    t1 = MUSIC_UNDER[k + 1][0] if k + 1 < len(MUSIC_UNDER) else 999
    expr.append(f"between(t,{t0},{t1})*{g:.5f}")
vol = "+".join(expr)
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/music_v5.wav", "-af", f"volume='{vol}':eval=frame", "work/music5_lv.wav"])
ins, ch = [], []
for k, (t, f, g) in enumerate(SFX):
    ins += ["-i", f]; gain = -3 + g - peak(f); ms = int(t * 1000)
    ch.append(f"[{k}]volume={gain:.1f}dB,aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[s{k}]")
run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex",
     ";".join(ch) + ";" + "".join(f"[s{k}]" for k in range(len(SFX))) + f"amix=inputs={len(SFX)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR}",
     "work/sfx5.wav"])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/sfx5.wav", "-af", "volume=enable='between(t,39.40,39.60)':volume=0", "work/sfx5b.wav"])
g = ("[0]asplit=2[v][key];[1][key]sidechaincompress=threshold=0.06:ratio=2:attack=30:release=350:makeup=1[md];"
     "[v][md][2]amix=inputs=3:normalize=0[pre]")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice5.wav", "-i", "work/music5_lv.wav", "-i", "work/sfx5b.wav",
     "-filter_complex", g, "-map", "[pre]", "-ar", "48000", "work/premaster5.wav"])
st = subprocess.run(["ffmpeg", "-hide_banner", "-i", "work/premaster5.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                    capture_output=True, text=True).stderr
m = json.loads(st[st.rfind("{"):st.rfind("}") + 1])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/premaster5.wav", "-af",
     f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
     f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", "-ar", "48000", "work/mix5.wav"])
print("final", lufs("work/mix5.wav"))
