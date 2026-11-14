#!/usr/bin/env python3
"""Synthesise the score and the two marked hits.

Everything here is generated from sine partials and noise — no samples, no
external assets. Output: public/audio/music.wav, stone-slam.wav, boom.wav.
The README shows the one-line ffmpeg call that turns them into the mp3s the
composition actually loads.

    python3 scripts/make_audio.py
"""
import os
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "audio")
DUR = 65.0


def write_wav(path, stereo):
    data = np.clip(stereo, -1, 1)
    pcm = (data * 32767).astype(np.int16)
    with wave.open(path, "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())


def env_ad(n, attack, decay):
    a = int(attack * SR)
    out = np.ones(n)
    a = min(a, n)
    if a > 0:
        out[:a] = np.linspace(0, 1, a) ** 1.5
    d = np.exp(-np.linspace(0, decay, n - a))
    out[a:] = d
    return out


def note(freq, dur, amp=0.2, detune=0.004, harmonics=(1, 0.35, 0.14), pan=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    left = np.zeros(n)
    right = np.zeros(n)
    for i, h in enumerate(harmonics):
        f = freq * (i + 1)
        vib = 1 + detune * np.sin(2 * np.pi * (0.15 + 0.07 * i) * t + i)
        sig = np.sin(2 * np.pi * f * t * vib) * h
        left += sig * (1 - pan) / 2
        right += sig * (1 + pan) / 2
    e = env_ad(n, 0.9, 1.1)
    return left * amp * e, right * amp * e


def reverb(stereo, mixdur=1.8, amount=0.3):
    n = stereo.shape[1]
    out = stereo.copy()
    rng = np.random.default_rng(7)
    for delay, gain in ((0.062, 0.5), (0.113, 0.38), (0.197, 0.27), (0.311, 0.2)):
        d = int(delay * SR)
        tail = np.zeros_like(stereo)
        tail[:, d:] = stereo[:, : n - d] * gain
        out += tail * amount
    # a little diffusion so it is not a pure echo
    noise = rng.normal(0, 1, (2, n))
    for k in range(1, 5):
        noise[0, k:] = 0.5 * (noise[0, k:] + noise[0, : n - k])
        noise[1, k:] = 0.5 * (noise[1, k:] + noise[1, : n - k])
    return out


def pad():
    total = int((DUR + 3) * SR)
    out = np.zeros((2, total))
    # D minor, B flat major, G minor, A major — eight bars
    chords = [
        [146.83, 174.61, 220.00],  # Dm
        [116.54, 146.83, 174.61],  # Bb
        [98.00, 116.54, 146.83],   # Gm
        [110.00, 138.59, 164.81],  # A
        [146.83, 174.61, 220.00],
        [116.54, 146.83, 174.61],
        [98.00, 130.81, 146.83],
        [110.00, 146.83, 164.81],
    ]
    bar = 8.0
    for c, freqs in enumerate(chords):
        start = int(c * bar * SR)
        for j, f in enumerate(freqs):
            for octave, gain in ((0.5, 0.5), (1.0, 1.0), (2.0, 0.22)):
                l, r = note(f * octave, bar * 1.9, amp=0.075 * gain, pan=(j - 1) * 0.35)
                end = start + len(l)
                if end > total:
                    l = l[: total - start]
                    r = r[: total - start]
                    end = total
                out[0, start:end] += l
                out[1, start:end] += r
    # low heartbeat pulse, one every 1.05 s, quiet
    for i in range(int(DUR / 1.05)):
        start = int(i * 1.05 * SR)
        n = int(0.28 * SR)
        t = np.arange(n) / SR
        sig = np.sin(2 * np.pi * 55 * t) * np.exp(-t * 12) * 0.16
        end = min(total, start + n)
        out[0, start:end] += sig[: end - start]
        out[1, start:end] += sig[: end - start]
    return out


def stone_slam():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(3)
    noise = rng.normal(0, 1, n)
    # crude one-pole low pass over the noise for the body of the hit
    body = np.zeros(n)
    acc = 0.0
    for i in range(n):
        acc += (noise[i] - acc) * 0.02
        body[i] = acc
    body *= np.exp(-t * 4.5)
    thud = np.sin(2 * np.pi * 58 * t) * np.exp(-t * 6.5)
    click = rng.normal(0, 1, n) * np.exp(-t * 90) * 0.5
    sig = body * 2.2 + thud * 0.85 + click * 0.5
    stereo = np.vstack([sig, sig * 0.97])
    return reverb(stereo, amount=0.35) * 0.8


def boom():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(11)
    sweep = np.sin(2 * np.pi * (70 * np.exp(-t * 1.6) + 28) * t) * np.exp(-t * 2.2)
    air = rng.normal(0, 1, n)
    acc = 0.0
    lp = np.zeros(n)
    for i in range(n):
        acc += (air[i] - acc) * 0.01
        lp[i] = acc
    lp *= np.exp(-t * 2.8)
    sig = sweep * 1.1 + lp * 2.4
    stereo = np.vstack([sig, sig])
    return reverb(stereo, amount=0.5) * 0.85


def normalise(x, peak=0.86):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    music = pad()
    # gentle fade in/out so the bed does not start on a click
    fade = int(1.2 * SR)
    music[:, :fade] *= np.linspace(0, 1, fade) ** 2
    music[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    music = normalise(reverb(music, amount=0.22), 0.36)
    write_wav(os.path.join(OUT, "music.wav"), music)

    write_wav(os.path.join(OUT, "stone-slam.wav"), normalise(stone_slam(), 0.9))
    write_wav(os.path.join(OUT, "boom.wav"), normalise(boom(), 0.92))
    print("wrote music.wav, stone-slam.wav, boom.wav to", OUT)
