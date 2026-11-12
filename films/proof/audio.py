"""Minimal score for the proof clip: a 120 BPM click grid, a bass pulse, a mallet
tone. Everything is synthesised — no samples, no library music.

Musical logic follows the style's sound palette: a steady pulse whose subdivisions
give the picture its snap durations.
"""
import wave
import numpy as np

SR = 44100
DUR = 8.0
BEAT = 0.5                      # 120 BPM
n = int(SR * DUR)
mix = np.zeros((n, 2), dtype=np.float64)
t_all = np.arange(n) / SR


def env(dur, attack=0.002, decay=None, tau=0.08):
    m = int(SR * dur)
    tt = np.arange(m) / SR
    a = np.clip(tt / max(attack, 1e-6), 0, 1)
    d = np.exp(-tt / (tau if decay is None else decay))
    return a * d


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    m = min(len(sig), n - i)
    if m <= 0:
        return
    left, right = gain * (1 - max(pan, 0)), gain * (1 + min(pan, 0))
    mix[i:i + m, 0] += sig[:m] * left
    mix[i:i + m, 1] += sig[:m] * right


rng = np.random.default_rng(7)

# click on every beat: a dry mid-century metronome tick
for k in range(int(DUR / BEAT)):
    at = k * BEAT
    body = np.sin(2 * np.pi * 1750 * np.arange(int(SR * 0.03)) / SR) * env(0.03, decay=0.006)
    noise = rng.standard_normal(int(SR * 0.006)) * env(0.006, decay=0.002) * 0.5
    add(body, at, 0.075, pan=(-0.12 if k % 2 else 0.12))
    add(noise, at, 0.05)

# bass pulse on the bar: 55 Hz plus its fifth, heard more than felt
for k in (0, 4, 8, 12):
    tt = np.arange(int(SR * 0.9)) / SR
    sig = (np.sin(2 * np.pi * 55 * tt) + 0.45 * np.sin(2 * np.pi * 82.5 * tt))
    add(sig * env(0.9, attack=0.01, decay=0.32), k * BEAT, 0.14)

# mallet tone on the off-beat: one voice at a time, a build as the picture builds
for k in range(1, int(DUR / BEAT), 2):
    freq = 660 if k % 4 == 1 else 880
    tt = np.arange(int(SR * 0.5)) / SR
    sig = np.sin(2 * np.pi * freq * tt) * env(0.5, attack=0.004, decay=0.12)
    sig += 0.3 * np.sin(2 * np.pi * freq * 2.02 * tt) * env(0.5, attack=0.004, decay=0.06)
    add(sig, k * BEAT, 0.035, pan=0.25 if k % 4 == 1 else -0.25)

# one near-silent moment before the end plate (style: drop the band for a reveal)
duck = np.ones(n)
i = int(5.75 * SR)
j = int(6.05 * SR)
duck[i:j] = np.linspace(1, 0.25, j - i)
mix *= duck[:, None]

mix = np.tanh(mix * 1.2) * 0.82 / max(1e-9, np.abs(mix).max())
pcm = (mix * 32767).astype(np.int16)

with wave.open("films/proof/pulse.wav", "w") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("pulse.wav", pcm.shape)
