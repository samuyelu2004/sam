"""Score for 'Never Heard' — 140 s, synthesised, no samples.

A slow modal pad carries the four answers; a harp keeps returning to the
question; a low pulse sits under the scales; air swells where the light lands;
bells mark the scripture cards, the ten righteous, and the cross.
"""
import wave
import numpy as np

SR = 44100
DUR = 140.0
n = int(SR * DUR)
mix = np.zeros((n, 2))
rng = np.random.default_rng(23)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    m = min(len(sig), n - i)
    if m <= 0:
        return
    mix[i:i + m, 0] += sig[:m] * gain * (1 - max(pan, 0))
    mix[i:i + m, 1] += sig[:m] * gain * (1 + min(pan, 0))


def lowpass(x, cutoff, sr=SR):
    """Zero-phase brickwall-ish low pass via the spectrum (fast for long buffers)."""
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    roll = np.clip(1 - (freqs - cutoff) / (cutoff * 0.6), 0, 1)
    return np.fft.irfft(spec * roll, len(x))


def highpass(x, cutoff, sr=SR):
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    roll = np.clip((freqs - cutoff) / (cutoff * 0.8), 0, 1)
    return np.fft.irfft(spec * roll, len(x))


NOTE = {
    'D2': 73.42, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'Bb2': 116.54,
    'C3': 130.81, 'D3': 146.83, 'Db3': 138.59, 'F3': 174.61, 'F#3': 185.00,
    'G3': 196.00, 'A3': 220.00, 'Bb3': 233.08, 'C4': 261.63, 'D4': 293.66,
    'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'D5': 587.33,
}

# ---------------------------------------------------------------- pad
CHORDS = [
    (0.0, 15.2, ['D3', 'F3', 'A3']),          # the question, at night
    (15.0, 35.2, ['F2', 'A2', 'C3']),         # Caesarea
    (35.0, 50.2, ['Bb2', 'D3', 'F3']),        # the house of Cornelius
    (50.0, 65.2, ['G2', 'Bb2', 'D3']),        # sepia, Romans 1
    (65.0, 75.2, ['D3', 'F3', 'A3']),         # Athens
    (75.0, 85.2, ['Bb2', 'Db3', 'F3']),       # the scales
    (85.0, 105.2, ['G2', 'Bb2', 'D3']),       # Abraham
    (105.0, 120.2, ['D3', 'F3', 'A3', 'D4']), # the plain and the cross
    (120.0, 130.2, ['Bb2', 'D3', 'F3']),      # the road
    (130.0, 136.2, ['G2', 'Bb2', 'D3']),      # the lamp
    (136.0, 140.0, ['D3', 'F#3', 'A3', 'D4']),# covered, every day
]
for start, end, notes in CHORDS:
    m = int(SR * (end - start))
    t = np.arange(m) / SR
    sig = np.zeros(m)
    for k, name in enumerate(notes):
        f = NOTE[name]
        for det in (-0.06, 0.0, 0.06):
            sig += np.sin(2 * np.pi * (f + det) * t + k * 0.8) * (0.5 + 0.07 * k)
        sig += 0.16 * np.sin(2 * np.pi * f * 2 * t)
    sig = lowpass(sig, 760) / (len(notes) * 3.2)
    a = np.clip(t / 2.0, 0, 1) * np.clip((end - start - t) / 2.6, 0, 1)
    add(sig * a, start, 0.24)

# ---------------------------------------------------------------- low pulse (the scales)
m = int(SR * 10.0)
t = np.arange(m) / SR
thump = np.sin(2 * np.pi * 55 * t) * np.exp(-(t % 2.0) * 5.5)
thump *= np.clip(t / 1.2, 0, 1) * np.clip((10.0 - t) / 1.6, 0, 1)
add(lowpass(thump, 220), 75.0, 0.16)

# ---------------------------------------------------------------- harp
def pluck(f, dur=2.4, bright=0.34):
    m = int(SR * dur)
    tt = np.arange(m) / SR
    s = (np.sin(2 * np.pi * f * tt) + bright * np.sin(2 * np.pi * f * 2 * tt)
         + 0.11 * np.sin(2 * np.pi * f * 3.01 * tt))
    return s * np.exp(-tt * 2.0) * np.clip(tt / 0.004, 0, 1)


ARPEGGIOS = [
    (15.6, ['F2', 'A2', 'C3', 'F3']),
    (25.6, ['Bb2', 'D3', 'F3', 'Bb3']),
    (40.9, ['D3', 'F3', 'A3', 'D4']),
    (50.6, ['G2', 'Bb2', 'D3', 'G3']),
    (65.6, ['D3', 'F3', 'A3', 'D4']),
    (90.2, ['G2', 'Bb2', 'D3', 'G3']),
    (96.2, ['D3', 'G3', 'Bb3', 'D4']),
    (100.4, ['Bb2', 'D3', 'G3', 'Bb3']),
    (120.6, ['Bb2', 'D3', 'F3', 'Bb3']),
    (125.6, ['F3', 'Bb3', 'D4', 'F3']),
    (130.6, ['G2', 'Bb2', 'D3', 'G3']),
]
for t0, notes in ARPEGGIOS:
    for i, name in enumerate(notes):
        add(pluck(NOTE[name]), t0 + i * 0.40, 0.070, pan=0.22 if i % 2 else -0.22)

# ---------------------------------------------------------------- air, where the light lands
def air(dur, up=1.0):
    m = int(SR * dur)
    tt = np.arange(m) / SR
    src = rng.standard_normal(m)
    sw = lowpass(src, 900 + 1400 * up)
    sw = highpass(sw, 240)
    env = np.clip(tt / (dur * 0.42), 0, 1) ** 1.4 * np.clip((dur - tt) / (dur * 0.45), 0, 1)
    return sw * env


for at, dur, g, pan in ((30.1, 5.2, 0.055, -0.2), (50.2, 4.8, 0.045, 0.15),
                        (110.4, 5.6, 0.050, 0.0), (135.2, 4.6, 0.040, 0.0)):
    add(air(dur), at, g, pan=pan)

# ---------------------------------------------------------------- wind, all through
m = n
t = np.arange(m) / SR
wind = lowpass(rng.standard_normal(m), 340)
wind *= (0.55 + 0.45 * np.sin(2 * np.pi * 0.06 * t + 0.7))
wind *= np.clip(t / 3.5, 0, 1)
add(wind, 0, 0.040, pan=-0.12)
add(-wind * 0.8, 0, 0.030, pan=0.28)


# ---------------------------------------------------------------- bells
def bell(f, dur=4.6):
    m = int(SR * dur)
    tt = np.arange(m) / SR
    s = np.zeros(m)
    for ratio, amp, dec in ((1.0, 1.0, 2.3), (2.01, 0.46, 1.3), (2.98, 0.24, 0.85), (4.2, 0.10, 0.55)):
        s += amp * np.sin(2 * np.pi * f * ratio * tt) * np.exp(-tt / dec)
    return s * np.clip(tt / 0.006, 0, 1)


for at, name, g, pan in ((40.8, 'D4', 0.13, -0.1), (45.2, 'A3', 0.07, 0.2),
                         (75.4, 'Bb3', 0.13, 0.0), (80.6, 'F3', 0.07, -0.15),
                         (96.3, 'D4', 0.10, 0.1), (111.3, 'D4', 0.14, 0.0),
                         (115.8, 'A4', 0.06, -0.1), (135.6, 'D4', 0.14, 0.0),
                         (136.2, 'D5', 0.06, 0.15)):
    add(bell(NOTE[name]), at, g, pan=pan)

# ---------------------------------------------------------------- master
fade = np.ones(n)
i0 = int(136.4 * SR)
fade[i0:] = np.linspace(1, 0, n - i0) ** 1.6
mix *= fade[:, None]
mix = np.tanh(mix * 1.25)
mix = mix * 0.86 / max(np.abs(mix).max(), 1e-9)
pcm = (mix * 32767).astype(np.int16)
with wave.open('films/never-heard/score.wav', 'w') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('score.wav', pcm.shape)
