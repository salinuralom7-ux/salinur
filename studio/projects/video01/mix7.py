#!/usr/bin/env python3
"""video01 v7 mix: voice + v7 bed (quiet under talk, lifts in story scenes) + subtle ref17 SFX."""
import json, re, subprocess
DUR = 60.0
P1, PP = "../../assets/sfx/pack01", "../../assets/sfx/pro"
MUSIC_UNDER = [(0.0, 15), (13.95, 10), (17.18, 16), (22.2, 10), (25.22, 16), (27.88, 10), (31.4, 16),
               (38.22, 11), (40.48, 16), (42.62, 10), (48.36, 16), (57.4, 4)]
pop, wh, wh2, clk = f"{P1}/04_pop.wav", f"{P1}/01_whoosh.wav", f"{P1}/19_whoosh_2.wav", f"{P1}/03_click.wav"
SFX = [(0.0, f"{PP}/subboom.wav", -16), (0.95, wh2, -16), (0.3, pop, -22), (0.6, pop, -22),
       (2.94, f"{P1}/22_display_digits.wav", -20), (6.52, pop, -18), (7.44, wh, -18), (8.64, f"{P1}/05_cash_register.wav", -18),
       (9.66, f"{P1}/22_display_digits.wav", -21), (12.9, pop, -20),
       (13.85, wh, -15), (14.42, pop, -18), (16.46, pop, -18), (17.08, f"{P1}/27_in_and_out.wav", -18), (17.94, pop, -20),
       (22.1, wh, -15), (22.45, pop, -21), (22.73, pop, -21), (23.01, pop, -21), (23.16, f"{P1}/26_cinematic_hit.wav", -16), (25.12, f"{P1}/27_in_and_out.wav", -18),
       (26.95, pop, -20), (27.78, wh, -15), (27.99, clk, -16), (28.73, clk, -16), (29.73, clk, -16), (31.3, f"{P1}/27_in_and_out.wav", -18),
       (32.89, f"{P1}/18_camera_shutter.wav", -18), (34.71, pop, -20), (37.95, pop, -20),
       (38.12, wh, -15), (38.29, f"{P1}/20_paper.wav", -22), (39.8, f"{P1}/34_ding.wav", -20), (40.2, wh2, -16),
       (41.17, pop, -16), (42.39, pop, -20),
       (42.52, wh, -15), (43.0, wh2, -17), (44.85, wh2, -17), (47.1, wh2, -17), (48.26, f"{P1}/27_in_and_out.wav", -18),
       (50.91, pop, -20), (51.97, f"{P1}/34_ding.wav", -17), (52.3, pop, -18), (54.63, pop, -20),
       (57.4, f"{P1}/29_boom.wav", -14), (57.6, pop, -16)]


def run(c):
    subprocess.run(c, check=True, capture_output=True, text=True)


def lufs(p):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    e = e[e.rfind("Summary:"):]
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", e).group(1))


def peak(p):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-i", p, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.search(r"max_volume: (-?[\d.]+) dB", e).group(1))


V, M = lufs("work/voice7.wav"), lufs("work/music7.wav")
# music gain automation as volume expressions per section (smooth 0.8 s ramps)
expr = []
for k, (t0, under) in enumerate(MUSIC_UNDER):
    g = 10 ** ((V - under - M) / 20)
    t1 = MUSIC_UNDER[k + 1][0] if k + 1 < len(MUSIC_UNDER) else 999
    expr.append(f"between(t,{t0},{t1})*{g:.5f}")
vol = "+".join(expr)
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/music7.wav", "-af", f"volume='{vol}':eval=frame", "work/music7_lv.wav"])
ins, ch = [], []
for k, (t, f, g) in enumerate(SFX):
    ins += ["-i", f]; gain = -3 + g - peak(f); ms = int(t * 1000)
    ch.append(f"[{k}]volume={gain:.1f}dB,aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[s{k}]")
run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex",
     ";".join(ch) + ";" + "".join(f"[s{k}]" for k in range(len(SFX))) + f"amix=inputs={len(SFX)}:normalize=0,apad=whole_dur={DUR},atrim=0:{DUR}",
     "work/sfx7.wav"])
g = ("[0]asplit=2[v][key];[1][key]sidechaincompress=threshold=0.06:ratio=2:attack=30:release=350:makeup=1[md];"
     "[v][md][2]amix=inputs=3:normalize=0[pre]")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/voice7.wav", "-i", "work/music7_lv.wav", "-i", "work/sfx7.wav",
     "-filter_complex", g, "-map", "[pre]", "-ar", "48000", "work/premaster7.wav"])
st = subprocess.run(["ffmpeg", "-hide_banner", "-i", "work/premaster7.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                    capture_output=True, text=True).stderr
m = json.loads(st[st.rfind("{"):st.rfind("}") + 1])
run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/premaster7.wav", "-af",
     f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
     f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", "-ar", "48000", "work/mix7.wav"])
print("final", lufs("work/mix7.wav"))
