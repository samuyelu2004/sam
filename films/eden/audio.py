"""Score for 'The Tree He Left Standing' — 105 s, synthesised, no samples.

One chord per chapter, a harp that keeps returning to the question, a low choir
that enters on the fifth answer, water under the lantern shot, and a bell where
the argument turns.
"""
import wave
import numpy as np

SR = 44100
DUR = 105.0
n = int(SR * DUR)
mix = np.zeros((n, 2))
rng = np.random.default_rng(11)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    m = min(len(sig), n - i)
    if m <= 0:
        return
    mix[i:i + m, 0] += sig[:m] * gain * (1 - max(pan, 0))
    mix[i:i + m, 1] += sig[:m] * gain * (1 + min(pan, 0))


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


NOTE = {
    'D2': 73.42, 'F2': 87.31, 'G2': 98.0, 'A2': 110.0, 'Bb2': 116.54, 'C3': 130.81,
    'D3': 146.83, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'A3': 220.0, 'Bb3': 233.08,
    'C4': 261.63, 'D4': 293.66, 'F4': 349.23, 'A4': 440.0, 'D5': 587.33,
}

# ---------------------------------------------------------------- pad
CHORDS = [
    (0.0, 22.0, ['D3', 'F3', 'A3']),
    (21.8, 34.0, ['Bb2', 'D3', 'F3']),
    (33.8, 46.0, ['F2', 'A2', 'C3']),
    (45.8, 59.0, ['G2', 'Bb2', 'D3']),
    (58.8, 70.0, ['D3', 'F3', 'A3']),
    (69.8, 84.0, ['Bb2', 'D3', 'F3', 'Bb3']),
    (83.8, 100.0, ['D3', 'F#3', 'A3', 'D4']),
    (99.8, 105.0, ['D3', 'A3', 'D4']),
]
for start, end, notes in CHORDS:
    m = int(SR * (end - start))
    t = np.arange(m) / SR
    sig = np.zeros(m)
    for k, name in enumerate(notes):
        f = NOTE[name]
        for det in (-0.05, 0.0, 0.05):
            sig += np.sin(2 * np.pi * (f + det) * t + k * 0.7) * (0.55 + 0.08 * k)
        sig += 0.18 * np.sin(2 * np.pi * f * 2 * t)
    sig = lowpass(sig, 820) / (len(notes) * 3.4)
    a = np.clip(t / 1.6, 0, 1) * np.clip((end - start - t) / 2.2, 0, 1)
    add(sig * a, start, 0.26)

# ---------------------------------------------------------------- low choir (fifth answer)
m = int(SR * 31.0)
t = np.arange(m) / SR
choir = np.zeros(m)
for f in (NOTE['D3'] / 2, NOTE['A3'] / 2, NOTE['D3'], NOTE['F3']):
    vib = 1 + 0.004 * np.sin(2 * np.pi * 4.6 * t + f)
    choir += np.sin(2 * np.pi * f * vib * t) * (1.0 + 0.5 * np.sin(2 * np.pi * 0.19 * t))
choir = lowpass(choir, 620) / 6.0
env = np.clip(t / 6.0, 0, 1) * np.clip((31.0 - t) / 7.0, 0, 1)
add(choir * env, 70.0, 0.16)

# ---------------------------------------------------------------- harp
def pluck(f, dur=2.2, bright=0.35):
    m = int(SR * dur)
    tt = np.arange(m) / SR
    s = (np.sin(2 * np.pi * f * tt) + bright * np.sin(2 * np.pi * f * 2 * tt)
         + 0.12 * np.sin(2 * np.pi * f * 3.01 * tt))
    return s * np.exp(-tt * 2.1) * np.clip(tt / 0.004, 0, 1)


ARPEGGIOS = [
    (23.2, ['Bb2', 'D3', 'F3', 'Bb3']), (27.4, ['F3', 'Bb3', 'D4', 'F3']),
    (47.2, ['G2', 'Bb2', 'D3', 'G3']), (51.4, ['D3', 'G3', 'Bb3', 'D3']),
    (55.2, ['Bb2', 'D3', 'G3', 'Bb3']),
    (85.2, ['D3', 'A3', 'D4', 'F#3']), (89.4, ['A3', 'D4', 'F#3', 'A4']),
    (93.4, ['D4', 'F#3', 'A4', 'D5']), (96.8, ['A4', 'D5', 'F#3', 'D4']),
]
for t0, notes in ARPEGGIOS:
    for i, name in enumerate(notes):
        add(pluck(NOTE[name]), t0 + i * 0.42, 0.075, pan=0.24 if i % 2 else -0.24)

# ---------------------------------------------------------------- water (the lantern shot)
m = int(SR * 13.0)
t = np.arange(m) / SR
water = lowpass(rng.standard_normal(m), 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.23 * t))
water *= np.clip(t / 2.5, 0, 1) * np.clip((13.0 - t) / 3.0, 0, 1)
add(water, 33.0, 0.05, pan=0.2)

# ---------------------------------------------------------------- wind, all through
m = n
t = np.arange(m) / SR
wind = lowpass(rng.standard_normal(m), 380)
wind *= (0.55 + 0.45 * np.sin(2 * np.pi * 0.07 * t + 1.2))
wind *= np.clip(t / 3.0, 0, 1)
add(wind, 0, 0.042, pan=-0.15)
add(-wind * 0.8, 0, 0.034, pan=0.3)


# ---------------------------------------------------------------- bells
def bell(f, dur=4.5):
    m = int(SR * dur)
    tt = np.arange(m) / SR
    s = np.zeros(m)
    for ratio, amp, dec in ((1.0, 1.0, 2.4), (2.01, 0.5, 1.4), (2.98, 0.26, 0.9), (4.2, 0.12, 0.6)):
        s += amp * np.sin(2 * np.pi * f * ratio * tt) * np.exp(-tt / dec)
    return s * np.clip(tt / 0.006, 0, 1)


add(bell(NOTE['D4']), 70.2, 0.15, pan=-0.1)
add(bell(NOTE['A4']), 70.9, 0.075, pan=0.2)
add(bell(NOTE['D4']), 100.1, 0.13, pan=0.0)
add(bell(NOTE['D5'], 3.0), 100.7, 0.06, pan=0.15)

# ---------------------------------------------------------------- master
fade = np.ones(n)
i0 = int(102.2 * SR)
fade[i0:] = np.linspace(1, 0, n - i0) ** 1.5
mix *= fade[:, None]
peak = np.abs(mix).max()
mix = np.tanh(mix * 1.5) * 0.88 / max(peak, 1e-9)
pcm = (mix * 32767).astype(np.int16)
with wave.open('films/eden/score.wav', 'w') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('score.wav', pcm.shape)
