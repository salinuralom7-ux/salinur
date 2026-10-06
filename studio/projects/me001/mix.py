#!/usr/bin/env python3
"""me001 mix: tightened ElevenLabs VO + own beat + SFX on every element. Loudnorm -14 LUFS."""
import json, re, subprocess
DUR = 42.6
P1, PP = "../../assets/sfx/pack01", "../../assets/sfx/pro"
MUSIC_UNDER = [(0.0, 12), (9.45, 9), (24.7, 10), (26.0, 9), (37.7, 7), (41.8, 4)]
pop, wh, wh2, clk = f"{P1}/04_pop.wav", f"{P1}/01_whoosh.wav", f"{P1}/19_whoosh_2.wav", f"{P1}/03_click.wav"
SFX = [
    (0.02, f"{PP}/subboom.wav", -12), (0.05, pop, -18), (0.0, f"{P1}/22_display_digits.wav", -17), (0.7, f"{P1}/05_cash_register.wav", -13),
    (3.05, f"{P1}/27_in_and_out.wav", -18), (3.25, f"{P1}/29_boom.wav", -14),
    (3.95, f"{P1}/22_display_digits.wav", -15), (4.85, f"{P1}/05_cash_register.wav", -12),
    (6.80, f"{P1}/27_in_and_out.wav", -18), (7.0, f"{P1}/29_boom.wav", -12),
    (7.66, f"{P1}/26_cinematic_hit.wav", -8),
    (9.45, f"{P1}/08_whoosh_fire_transition.wav", -12), (9.45, f"{PP}/subboom.wav", -10), (9.75, pop, -14),
    (10.65, wh, -15), (11.3, clk, -19), (12.5, clk, -19), (13.5, pop, -13),
    (15.69, wh, -15), (16.2, wh2, -16), (16.2, pop, -15), (16.82, wh, -15), (17.97, pop, -15),
    (18.98, wh, -15), (19.94, pop, -14), (20.3, f"{P1}/25_anvil.wav", -15),
    (21.25, wh, -15), (22.98, clk, -18),
    (24.78, f"{P1}/34_ding.wav", -12),
    (26.0, wh2, -17), (26.4, pop, -15), (26.5, clk, -18), (28.3, wh2, -15), (29.16, clk, -18), (29.25, pop, -15),
    (29.6, f"{P1}/34_ding.wav", -15),
    (30.1, wh2, -17), (31.8, wh2, -16), (32.0, pop, -16),
    (32.55, pop, -15), (33.7, wh, -12), (34.43, clk, -18), (36.65, f"{P1}/29_boom.wav", -16),
    (37.78, f"{P1}/26_cinematic_hit.wav", -10), (37.78, f"{PP}/subboom.wav", -12), (38.4, pop, -14),
    (39.05, clk, -10), (39.08, f"{P1}/34_ding.wav", -14),
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


run(["ffmpeg", "-y", "-loglevel", "error", "-i", "work/vo_fast.wav", "-af",
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
