"""Small synth + sound-design kit (numpy/scipy). All output is our own work: no licences needed.

Music: kick, 808, hats, clap, pad, pluck, convolution reverb.
SFX:   impact ("make a statement"), sting ("reveal"), tonal riser, pop, sub-boom, glitch, ka-ching, tick.
Everything works at 48 kHz stereo float32 in [-1, 1].
"""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def lp(x, f, order=4):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=4):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=4):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def env_exp(n, decay):  # decay in seconds to -60 dB
    return np.exp(-6.9 * np.arange(n) / (decay * SR))


def stereo(x, width=0.0, delay_ms=0.0):
    if x.ndim == 2:
        return x
    if delay_ms:
        d = int(delay_ms * SR / 1000)
        r = np.concatenate([np.zeros(d), x[:-d] if d else x])
        return np.stack([x, (1 - width) * x + width * r], 1)
    return np.stack([x, x], 1)


def sat(x, drive=2.0):
    return np.tanh(x * drive) / np.tanh(drive)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x * (peak / m)


def reverb_ir(seconds=2.2, pre=0.012, bright=6000):
    n = int(seconds * SR)
    ir = rng.normal(0, 1, (n, 2)) * env_exp(n, seconds)[:, None]
    ir = lp(ir, bright, 2)
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir])
    return ir / np.sqrt(np.sum(ir ** 2, 0, keepdims=True))


IR_HALL = None


def reverb(x, mix=0.25, seconds=2.2, bright=6000):
    global IR_HALL
    ir = reverb_ir(seconds, bright=bright)
    x2 = stereo(x)
    wet = np.stack([fftconvolve(x2[:, 0], ir[:, 0])[: len(x2)], fftconvolve(x2[:, 1], ir[:, 1])[: len(x2)]], 1)
    return x2 * (1 - mix) + wet * mix * 0.6


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    x = stereo(x)
    j = min(len(buf), i + len(x))
    if i < 0:
        x = x[-i:]; i = 0
    buf[i:j] += x[: j - i] * gain


def note_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# ---------------------------------------------------------------- drums / instruments
def kick(d=0.45):
    t = t_(d)
    f = 48 + 110 * np.exp(-t * 38)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_exp(len(t), 0.42)
    click = hp(rng.normal(0, 1, len(t)), 3000) * env_exp(len(t), 0.012) * 0.25
    return sat(body + click, 1.6) * 0.95


def bass808(midi, d=1.1, glide_from=None):
    t = t_(d)
    f0 = note_hz(midi)
    f = f0 if glide_from is None else f0 + (note_hz(glide_from) - f0) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(np.full(len(t), f) if np.isscalar(f) else f) / SR
    x = np.sin(ph) * env_exp(len(t), d * 1.1)
    x *= np.minimum(1, t / 0.004)
    return sat(x, 2.4) * 0.9          # harmonics so phones can hear the bass


def hat(d=0.06, open_=False):
    n = int((0.25 if open_ else d) * SR)
    x = hp(rng.normal(0, 1, n), 7500)
    return x * env_exp(n, 0.22 if open_ else 0.05) * 0.35


def clap():
    n = int(0.35 * SR)
    x = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022, 0.033]):
        i = int(off * SR)
        burst = bp(rng.normal(0, 1, n - i), 900, 3500) * env_exp(n - i, 0.14 if k == 3 else 0.02)
        x[i:] += burst
    tone = np.sin(2 * np.pi * 210 * t_(0.35)) * env_exp(n, 0.05) * 0.3
    return reverb(norm(x + tone, 0.7), 0.22, 1.2)


def saw(f, t, detune=0.0):
    ph = (f * (1 + detune)) * t
    return 2 * (ph - np.floor(ph + 0.5))


def pad(midis, d, cutoff=1200, attack=0.6, release=1.2, level=0.25):
    t = t_(d + release)
    x = np.zeros(len(t))
    for m in midis:
        f = note_hz(m)
        for dt in (-0.006, 0.0, 0.0065):
            x += saw(f, t, dt)
    x = lp(x / (3 * len(midis)), cutoff, 2)
    e = np.minimum(1, t / attack) * np.where(t < d, 1, np.exp(-(t - d) * 4 / release))
    l = x * e
    r = np.concatenate([np.zeros(int(0.011 * SR)), l[: -int(0.011 * SR)]])
    return np.stack([l, r], 1) * level


def pluck(midi, d=0.9, level=0.3):
    t = t_(d)
    f = note_hz(midi)
    x = sum((0.6 ** k) * np.sin(2 * np.pi * f * (k + 1) * t) * env_exp(len(t), d / (k + 1)) for k in range(5))
    x *= np.minimum(1, t / 0.003)
    return x * level


# ---------------------------------------------------------------- SFX
def sfx_impact():
    """Cinematic 'make a statement' hit: sub drop + low harmonic chord + transient + hall tail."""
    t = t_(2.6)
    f = 32 + 70 * np.exp(-t * 7)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), 2.0)
    chord = sum(np.sin(2 * np.pi * note_hz(m) * t) for m in (29, 36, 41, 44)) * env_exp(len(t), 1.6) * 0.22
    trans = lp(rng.normal(0, 1, len(t)), 2500) * env_exp(len(t), 0.06) * 0.8
    x = sat(sub * 0.9 + chord + trans, 1.8)
    return norm(reverb(x, 0.35, 2.8, 3500), 0.95)


def sfx_sting():
    """'Reveal something unexpected': low sustained bass + dissonant brass-like stab, swelling."""
    t = t_(2.4)
    stab = sum(saw(note_hz(m), t, dt) for m in (41, 47, 52) for dt in (-0.004, 0.004)) / 6
    stab = lp(stab, 1800, 2) * env_exp(len(t), 1.8) * np.minimum(1, t / 0.01)
    low = np.sin(2 * np.pi * note_hz(29) * t) * env_exp(len(t), 2.4) * 0.8
    hit = sfx_impact()[: len(t)] * 0.5
    x = stereo(sat(stab * 0.9 + low, 1.5)) + hit
    return norm(reverb(x, 0.3, 2.5, 5000), 0.95)


def sfx_riser(d=2.4):
    """Tonal riser: stacked tones gliding up an octave+ with a noise swell, cut dead at the end."""
    t = t_(d)
    k = t / d
    x = np.zeros(len(t))
    for m in (48, 55, 60, 67):
        f = note_hz(m) * 2 ** (1.4 * k ** 1.6)
        x += np.sin(2 * np.pi * np.cumsum(f) / SR)
    noise = hp(rng.normal(0, 1, len(t)), 1500) * 0.25
    amp = k ** 2.2
    x = (x / 4 + noise * k) * amp
    x[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    return norm(reverb(x, 0.25, 1.5), 0.85)


def sfx_pop():
    t = t_(0.12)
    f = 300 + 700 * np.exp(-t * 60)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), 0.07) * np.minimum(1, t / 0.0015)
    return norm(x, 0.8)


def sfx_subboom():
    t = t_(1.8)
    f = 28 + 60 * np.exp(-t * 5)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), 1.6) * np.minimum(1, t / 0.006)
    return norm(sat(x, 2.0), 0.95)


def sfx_glitch():
    n = int(0.35 * SR)
    x = np.zeros(n)
    src = rng.normal(0, 1, n) * 0.5 + np.sin(2 * np.pi * 180 * t_(0.35)) * 0.5
    for i in range(0, n, int(0.025 * SR)):
        if rng.random() < 0.65:
            seg = src[i:i + int(0.018 * SR)]
            seg = np.round(seg * 6) / 6
            x[i:i + len(seg)] = seg
    return norm(bp(x, 200, 9000) * env_exp(n, 0.4), 0.7)


def sfx_kaching():
    t = t_(1.3)
    bell = sum(a * np.sin(2 * np.pi * f * t) * env_exp(len(t), dcy) for f, a, dcy in
               ((2093, 0.5, 1.1), (2637, 0.35, 0.9), (3520, 0.25, 0.6), (5274, 0.15, 0.4), (4186, 0.2, 0.7)))
    drawer = bp(rng.normal(0, 1, len(t)), 300, 2500) * env_exp(len(t), 0.18) * 0.6
    drawer = np.concatenate([np.zeros(int(0.12 * SR)), drawer[: -int(0.12 * SR)]])
    return norm(reverb(bell + drawer, 0.18, 1.0), 0.8)


def sfx_tick():
    n = int(0.03 * SR)
    return norm(hp(rng.normal(0, 1, n), 3000) * env_exp(n, 0.008), 0.6)


def sfx_flash():
    """Soft airy shimmer for a white flash (no 'whoosh')."""
    t = t_(1.2)
    x = sum(np.sin(2 * np.pi * note_hz(m) * t) for m in (84, 88, 91, 96)) / 4
    x *= np.minimum(1, t / 0.02) * env_exp(len(t), 1.0) * (0.7 + 0.3 * np.sin(2 * np.pi * 7 * t))
    air = hp(rng.normal(0, 1, len(t)), 6000) * env_exp(len(t), 0.4) * 0.15
    return norm(reverb(x * 0.5 + air, 0.4, 1.8), 0.6)
