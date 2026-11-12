# The Lost Sheep — 15 s, 2.5D Pixel Art

> A shepherd counts ninety-nine in the fold, finds the count one short, and goes
> out into the night after the one. Luke 15:4–7, told in five shots.

**1920×1080 · 24 fps · 15.0 s · H.264 + AAC · made entirely in code.**
Style: [`styles/hd-2d/STYLE.md`](https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/hd-2d/STYLE.md)
from the Lemo-Opuscar library (MIT).

## Shots

| # | Time | Set | What happens |
|---|---|---|---|
| I | 0.0–3.8 | the fold, night | The flock inside the stone ring under the moon; lantern burning. Chapter card **I · THE NINETY-NINE**. |
| II | 3.8–6.8 | outside the gate | A patch of grass pressed flat, scraps of fleece caught in it. *"One is missing."* |
| III | 6.8–10.4 | the path out | He walks away from the fold, lamp in hand; it is the only warm thing in frame. *"So he leaves the ninety-nine."* |
| IV | 10.4–12.8 | the rocks | He kneels at a boulder ledge; the lamb is under it, in the lamp light. *"He searches until he finds it."* |
| V | 12.8–15.0 | back at the fold, dawn | Sun clears the ridge, the palette turns, he carries it in his arms. **REJOICE** — *Luke 15 · 4–7*. |

## How the style is honoured

- **Sprites step, everything else glides** — walk cycles are 4 frames at 8 fps,
  idles at 1.5 Hz; camera, light, fog and focus update every output frame.
- **Light is the subject** — one lantern drives four things at once: the warm
  tint of nearby sprites, the ground pool, the glow sprite, and the dust motes.
- **Two temperatures** — a cold moonlit ambient against one warm practical; the
  hero's robe is the single saturated colour no set uses, so he is findable.
- **Post chain** — pixel art at 960×540 upscaled ×2, then bloom (thresholded at
  quarter res), a masked tilt-shift band that follows the subject, heavy vignette,
  and *no grain*.
- **RPG grammar** — a chapter card, a title card and serif subtitles; the
  `.srt` is exported from the same data that draws them.
- **Figure scale** — the hero is ~1/12 of frame height in wide shots, as the spec
  asks; shot IV's dive-in is the one deliberate close-up.

## What is approximated, honestly

The spec wants a real 3D set with point lights and ray-traced shadows. This
sandbox has no GPU and no browser, so:

- the set is painted through a **pinhole projection** on a 2D canvas, not rendered
  in 3D — geometry is correct, occlusion is manual depth ordering;
- **shadows are painted ellipses**, not cast by the light;
- sprites are **pre-tinted per light step** (8 quantised levels) and cached,
  rather than shaded per pixel;
- the **tilt-shift is a masked blur band**, folded into one pass as the spec
  demands, but it is not a true signed circle of confusion.

Everything else — palette logic, sprite scale, stepped animation, fog, bloom,
vignette, UI — follows the style document.

## Score

`audio.py` synthesises it: a string pad that changes chord with each set
(Dm – Bb – F – Gm – D), a harp that enters when he leaves the fold, one bell on
the find, wind underneath, and footsteps on dirt (peaks ≈ −15 dB mean, 0 dB peak).

## Re-render

```sh
npm install
export FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
node films/lost-sheep/render.mjs          # 360 frames, ~45 s
python3 films/lost-sheep/audio.py
$FFMPEG -y -i films/lost-sheep/lost-sheep.mp4 -i films/lost-sheep/score.wav \
  -c:v copy -c:a aac -b:a 192k -shortest films/lost-sheep/lost-sheep-final.mp4
```

Stills while directing: `STILLS="4.9,11.4" node films/lost-sheep/render.mjs`
writes PNGs to `/tmp`.

## Editing it

- **Timing** lives in `SHOTS` (`t0`, `t1`) and in each shot's `draw(t, pal)`.
- **Palette** is two tables, `NIGHT` and `DAWN`, lerped by `palAt(t)`.
- **Cameras** are one object per shot: `{x, y, z, f, hy}` — `f` is focal length in
  art pixels, `hy` the horizon line. Push the camera back to shrink the figures.
- **Sprites** are painters (`shepherdSprite`, `sheepSprite`, `rockSprite`, …) that
  fill a pixel grid; the 1 px selout outline is added automatically.
