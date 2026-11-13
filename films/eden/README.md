# The Tree He Left Standing — 1:45, 2.5D Pixel Art

> If God knew Eve would eat the fruit, why not remove the tree?
> An essay film in seven chapters. It does not answer the question; it sets the
> classical answers beside each other and leaves the reader to weigh them.

**1920×1080 · 24 fps · 105.0 s · H.264 + AAC · made entirely in code.**
Style: [`styles/hd-2d/STYLE.md`](https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/hd-2d/STYLE.md)
from the Lemo-Opuscar library (MIT).

## Chapters

| # | Time | Card | The move being made |
|---|---|---|---|
| I | 0:00 | THE QUESTION | The garden whole, both trees, two small figures. *He knew; he made it anyway.* |
| II | 0:22 | FREEDOM | A love that cannot refuse is not love; remove the tree and obedience is machinery. |
| III | 0:34 | FOREKNOWLEDGE | A lantern shows the path and does not walk you down it — knowing is not causing. |
| IV | 0:46 | TRUST | The command was the relationship; the serpent attacked God's character, not the fruit. |
| V | 0:59 | RELOCATION | Removing the tree fixes nothing; the occasion would grow again somewhere else. |
| VI | 1:10 | FELIX CULPA | *O happy fault*: some traditions hold that the rescue was planned before the garden. |
| VII | 1:24 | THE OPEN QUESTION | Traditions, not a proof. The question is left standing. |

End card: **GENESIS 2–3 · A QUESTION, NOT A VERDICT.**

## Who holds which piece

These are the standard positions, summarised for the screen:

- **Foreknowledge does not compel** — Augustine (*City of God* XI; *On Free Choice*),
  and Boethius (*Consolation* V) sharpens it: God's knowledge is not fore-knowledge
  at all, but the whole of time seen at once from outside it.
- **Permission, not causation** — Aquinas (*Summa* I, q.22–23, q.83) distinguishes
  God's willing permission of evil from his causing it.
- **The command as relationship** — a reading common to patristic and Reformed
  commentators: the tree is not a trap but a boundary that makes trust possible.
- **The tree as growth, not only test** — several Eastern fathers read the garden
  as a childhood and the fall as a wound in a process of maturing, not a courtroom
  verdict.
- **Felix culpa** — the phrase is from the Easter *Exsultet* ("O happy fault…"),
  with the idea that the Incarnation was purposed before the foundation of the
  world (1 Peter 1:20; Revelation 13:8) rather than improvised after Genesis 3.

The film deliberately does **not** adjudicate between them, and the narration says
so: *"These are traditions, not a proof."* Anyone who tells you the question is
settled is selling something.

## How the style is honoured

- **Sprites step, everything else glides** — the two figures are single-frame
  drawings; camera, pollen, light and focus move every output frame.
- **Light is the subject** — the lantern in Chapter III owns the frame: its pool,
  its glow, and the warm tint of the ground around it.
- **Two temperatures per set** — daylight green-and-gold; dusk violet with one warm
  lamp; dawn peach. The palette changes by chapter, never by fade.
- **Post chain** — 960×540 pixel art upscaled ×2, bloom thresholded at quarter res
  (dialled down for daylight), a masked tilt-shift band that follows each shot's
  subject, heavy vignette, no grain.
- **RPG grammar** — chapter cards on a dark plate, serif subtitles, an end card;
  the `.srt` is exported from the same `SUBS` array that draws them (21 cues).

## What is approximated, honestly

Same trade-offs as the other films in this repo: no GPU and no browser here, so
the set is a **pinhole projection painted on a canvas**, not a 3D render. Depth
ordering is manual, shadows are painted ellipses, sprites are pre-tinted at eight
quantised light levels, and the tilt-shift is a masked blur band rather than a
signed circle of confusion.

The weakest beats are Chapters V and VI: the stump and the new shoot are small in
a wide field, and the argument is carrying more weight than the image. A closer
lens and a second pass on those two sets would be the first thing to fix.

## Score

`audio.py`, synthesised: one chord per chapter (Dm – Bb – F – Gm – Dm – Bb – D),
a low choir entering on the fifth answer, harp arpeggios in the chapters that
argue, filtered water under the lantern, a bell where the argument turns, and
wind underneath all of it.

## Re-render

```sh
npm install
export FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
node films/eden/render.mjs           # 2520 frames, ~5m45s
python3 films/eden/audio.py
$FFMPEG -y -i films/eden/eden.mp4 -i films/eden/score.wav \
  -c:v copy -c:a aac -b:a 160k -shortest films/eden/eden-final.mp4
```

Stills while directing: `STILLS="3.0,46.0,78.0" node films/eden/render.mjs`.
