# Proof clip — Swiss Motion Graphics

An 8-second, 1920×1080, 24 fps film made entirely in code: no video model, no
footage, no browser. Every frame is drawn on a Skia canvas and piped straight
into ffmpeg.

- **Style** — [`styles/swiss-motion/STYLE.md`](https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/swiss-motion/STYLE.md)
  from the Lemo-Opuscar library (MIT): 12-column grid, one typeface (Inter), one
  signal colour (`#FF5A00`), flat surfaces, wipes and clip-reveals only, every
  move landing on a 120 BPM beat.
- **Score** — `audio.py` synthesises the click grid, bass pulse and mallet tone
  with numpy; no samples.

## Files

| File | What it is |
|---|---|
| `render.mjs` | The whole film: grid, type, camera, motion, timing. Frames → ffmpeg stdin. |
| `audio.py` | Synthesised 8 s score → `pulse.wav`. |
| `proof-final.mp4` | Picture + sound, muxed. (Ignored by git.) |

## Re-render

```sh
npm install
export FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
node films/proof/render.mjs          # 8 s of frames, ~3 s of wall clock
python3 films/proof/audio.py
$FFMPEG -y -i films/proof/proof.mp4 -i films/proof/pulse.wav \
  -c:v copy -c:a aac -b:a 192k -shortest films/proof/proof-final.mp4
```

## Why not the repo's own renderer

Lemo renders HTML/Three.js frames through Playwright → Chromium. This sandbox has
no system ffmpeg and the Playwright browser CDN is unreachable, so
`@napi-rs/canvas` (Skia, prebuilt, from npm) stands in for the browser, and
`imageio-ffmpeg` (from PyPI) provides the encoder. The style rules are followed
in canvas code instead of CSS/WebGL — same grid, same curves, same timings.

## Changing it

Everything is a function of `t` (seconds) in `draw()`, so edits are surgical:

- **Beats** — tempo is 120 BPM; one beat is 0.5 s, one note value is 12 frames.
  Move an entrance by moving its `e(t, start, start + 0.35)` window.
- **Colour** — `SIGNAL` is the single signal colour. Per the style, adding a
  second one breaks it.
- **Type** — weights 400/500/700/900 of Inter; swap the `@expo-google-fonts/*`
  package for another OFL grotesque.
- **Length** — `DUR` and the scene windows at the bottom of `draw()`.
