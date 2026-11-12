"""Score for 'The Lost Sheep' — 15 s, synthesised, no samples.

Chamber-fantasy colours per the style's palette: a string pad that changes chord
with every set, a harp that enters as he leaves the fold, one bell for the find,
and wind underneath the whole night. Footsteps are on the dirt, not on a grid.
"""
import wave
import numpy as np

SR = 44100
DUR = 15.0
n = int(SR * DUR)
mix = np.zeros((n, 2))
rng = np.random.default_rng(4)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    m = min(len(sig), n - i)
    if m <= 0:
        return
    mix[i:i + m, 0] += sig[:m] * gain * (1 - max(pan, 0))
    mix[i:i + m, 1] += sig[:m] * gain * (1 + min(pan, 0))


def lowpass(x, cutoff):
    # one-pole; enough to take the edge off sines and noise
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def env_ad(m, attack, release, total, decay=None):
    t = np.arange(m) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    tail = np.clip((total - t) / max(release, 1e-4), 0, 1)
    e = a * tail
    if decay:
        e = e * np.exp(-t / decay)
    return e


NOTE = {
    'D2': 73.42, 'F2': 87.31, 'G2': 98.0, 'A2': 110.0, 'Bb2': 116.54, 'C3': 130.81,
    'D3': 146.83, 'F3': 174.61, 'F#3': 185.0, 'G3': 196.0, 'A3': 220.0, 'Bb3': 233.08,
    'C4': 261.63, 'D4': 293.66, 'F4': 349.23, 'A4': 440.0,
}

# ---------------------------------------------------------------- pad
CHORDS = [
    (0.0, 3.9, ['D3', 'F3', 'A3', 'D4']),
    (3.8, 6.9, ['Bb2', 'D3', 'F3', 'Bb3']),
    (6.8, 10.5, ['F2', 'A2', 'C3', 'F3']),
    (10.4, 12.9, ['G2', 'Bb2', 'D3', 'G3']),
    (12.8, 15.0, ['D3', 'F#3', 'A3', 'D4']),
]
for start, end, notes in CHORDS:
    m = int(SR * (end - start))
    t = np.arange(m) / SR
    sig = np.zeros(m)
    for k, name in enumerate(notes):
        f = NOTE[name]
        for det in (-0.04, 0.0, 0.045):
            sig += np.sin(2 * np.pi * (f + det) * t + k) * (0.5 + 0.1 * k)
        sig += 0.22 * np.sin(2 * np.pi * f * 2 * t)           # octave shimmer
    sig = lowpass(sig, 900) / (len(notes) * 3.2)
    sig *= env_ad(m, 0.55, 1.1, end - start)
    add(sig, start, 0.30)

# ---------------------------------------------------------------- harp
HARP_STEPS = [
    (6.9, ['F3', 'A3', 'C4', 'F4']),
    (8.9, ['F3', 'C4', 'A3', 'F4']),
    (10.6, ['G3', 'Bb3', 'D4', 'G3']),
    (12.4, ['D3', 'A3', 'D4', 'F#3']),
    (13.2, ['D4', 'F#3', 'A3', 'D4']),
    (13.8, ['A4', 'D4', 'F#3', 'D4']),
]
for t0, notes in HARP_STEPS:
    for i, name in enumerate(notes):
        at = t0 + i * 0.22
        f = NOTE[name]
        m = int(SR * 1.6)
        tt = np.arange(m) / SR
        sig = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2 * tt)
               + 0.14 * np.sin(2 * np.pi * f * 3.01 * tt))
        sig *= np.exp(-tt * 3.2) * np.clip(tt / 0.004, 0, 1)
        add(sig, at, 0.085, pan=0.22 if i % 2 else -0.22)

# ---------------------------------------------------------------- bell at the find
def bell(f, dur=2.6):
    m = int(SR * dur)
    tt = np.arange(m) / SR
    sig = np.zeros(m)
    for ratio, amp, dec in ((1.0, 1.0, 1.5), (2.01, 0.5, 0.9), (2.98, 0.28, 0.6), (4.2, 0.14, 0.4)):
        sig += amp * np.sin(2 * np.pi * f * ratio * tt) * np.exp(-tt / dec)
    return sig * np.clip(tt / 0.005, 0, 1)


add(bell(NOTE['D4']), 12.85, 0.16, pan=-0.1)
add(bell(NOTE['A4'], 2.0), 13.05, 0.09, pan=0.15)

# ---------------------------------------------------------------- wind
m = n
t = np.arange(m) / SR
noise = rng.standard_normal(m)
wind = lowpass(noise, 420)
lfo = 0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * t + 0.7)
wind *= lfo * env_ad(m, 1.2, 2.0, DUR)
add(wind, 0, 0.05, pan=-0.1)
add(-wind * 0.7, 0, 0.04, pan=0.25)

# ---------------------------------------------------------------- footsteps (dirt)
def step(soft=1.0):
    m = int(SR * 0.16)
    tt = np.arange(m) / SR
    body = rng.standard_normal(m) * np.exp(-tt * 42)
    thud = np.sin(2 * np.pi * 78 * tt) * np.exp(-tt * 26)
    return (body * 0.5 + thud) * soft


for at in np.arange(6.9, 10.2, 0.62):
    add(step(1.0), at, 0.055, pan=-0.15)
for at in np.arange(12.9, 14.3, 0.66):
    add(step(0.7), at, 0.045, pan=0.1)

# ---------------------------------------------------------------- master
fade = np.ones(n)
i0 = int(14.3 * SR)
fade[i0:] = np.linspace(1, 0, n - i0) ** 1.6
mix *= fade[:, None]

peak = np.abs(mix).max()
mix = np.tanh(mix * 1.3) * 0.9 / max(peak, 1e-9)
pcm = (mix * 32767).astype(np.int16)
with wave.open('films/lost-sheep/score.wav', 'w') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('score.wav', pcm.shape, 'peak', float(np.abs(pcm).max()))
