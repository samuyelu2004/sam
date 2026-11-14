# Never Heard

**2:20 · 720×1280 vertical · 24 fps · H.264 + AAC**

A short answer film to the question people actually leave in the comments:
*what happens to people who never heard of Jesus?* It follows the twenty beats
of the supplied vertical storyboard — the hook at night, the comment bubbles,
Cornelius in Caesarea (Acts 10), Romans 1, Athens and the altar to an unknown
God (Acts 17), the scales (Luke 12:48), Abraham over Sodom (Genesis 18), the two
readings of the unreached, the cross, the turn in Romans 10, a lamp handed on,
and the brand outro.

Deliverable: [`never-heard-final.mp4`](never-heard-final.mp4)
Captions: [`never-heard.srt`](never-heard.srt)

## Look

The 2.5D pixel diorama: everything is painted in code on a 360×640 art canvas
(2× upscale) — isometric boxes for architecture, rigged sprites for people — then
lit, fogged, tilt-shifted, bloomed and vignetted into a lit tabletop model.
A raking beam crosses every floor, dust drifts through it, and the camera drifts
through each shot rather than the set moving.

## Animation

The set is built once; everything that moves is animated on the frame clock.

- **Figures are a small rig**, not a single drawing: `personSprite(cfg, mode, ph)`
  paints legs, a tapered tunic, two arms that swing from the shoulder and bend at
  the elbow, and a head that bobs. Eight frames per cycle, per pose (`idle`,
  `walk`, `gesture`, `reach`, `point`, `kneel`), cached on first use.
- **Walks are driven by distance, not time** — `track()` lerps a person along a
  line between marks and advances the walk phase with the metres covered, so the
  feet land where the body does and never skate.
- **Blocking is on a path**: the man walks out of the dark to the door and knocks,
  the Roman crosses the street and then points, Paul walks in across the agora,
  Peter and Cornelius meet, the two groups come up to the cross, the traveller
  climbs the road toward the lens, and the lamp is passed from hand to hand.
- **The camera carries the shot**: every shot declares `move: { push, side, rise }`
  — a push as a fraction of the distance to the subject, a truck, a crane — plus a
  breath of hand-held float. Pushes run 5–16 % so the frame is always closing in.
- **The world breathes**: doorway lamps and lanterns flicker (`flick()`), motes
  and sparks drift, and the scales in shot 12 swing on their beam.

Type is DejaVu Serif (italic) in cream over a dark plate: the voice-over sits
top-left, badges are pills at the foot of the frame, scripture arrives on cream
cards with the key words in red, and the outro is the red lintel mark.

## Shot map

| # | time | beat |
|---|------|------|
| 01 | 0:00 | night village, one hut lit, one man in its light |
| 02 | 0:10 | three comment bubbles over the village |
| 03 | 0:15 | Caesarea: a Roman officer and his servant |
| 04 | 0:25 | Cornelius kneeling in prayer, columns behind |
| 05 | 0:30 | the angel in the shaft of light |
| 06 | 0:35 | Peter and Cornelius meet |
| 07 | 0:40 | Acts 10:34–35 (KJV) on a cream card, scene ghosted |
| 08 | 0:50 | the beam finds the hut — badge 1 · God sees the seeker |
| 09 | 0:55 | sepia village, Romans 1:20 typing — badge 2 · No one has zero light |
| 10 | 1:05 | Athens, Paul walks in |
| 11 | 1:10 | the altar — label: TO THE UNKNOWN GOD |
| 12 | 1:15 | the scales — badge 3 · God judges fairly, then Luke 12:48 |
| 13 | 1:25 | Abraham pleading, a town in the corner |
| 14 | 1:35 | ten lights over the town — TEN RIGHTEOUS · Genesis 18:32 |
| 15 | 1:45 | the plain and the cross, two labels, two readings |
| 16 | 1:50 | the beam lands on the cross — saved only through Jesus |
| 17 | 2:00 | the lone traveller, the Romans 10 turn |
| 18 | 2:05 | a lamp passed from one man to another |
| 19 | 2:10 | the comment box: “My grandmother”, hearts, the question |
| 20 | 2:15 | cream end card: The Lintel Network · “Covered, every day.” |

## Rebuild

```bash
cd /home/user/sam
export FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")

node films/never-heard/render.mjs          # 3360 frames -> never-heard.mp4
python3 films/never-heard/audio.py         # 140 s score -> score.wav

$FFMPEG -y -i films/never-heard/never-heard.mp4 -i films/never-heard/score.wav \
  -c:v copy -c:a aac -b:a 160k -shortest films/never-heard/never-heard-final.mp4
```

Stills, for checking the look without a full render:

```bash
STILLS="3.5,45,96" node films/never-heard/render.mjs   # -> /tmp/still-<t>.png
SPRITES=man,angel node films/never-heard/render.mjs    # -> /tmp/sprites.png, every pose x 8
```

`render.mjs` writes `never-heard.srt` from the same narration list that drives
the on-screen voice-over, so captions cannot drift from the picture.

## Sound

`audio.py` synthesises the whole bed — no samples. A modal pad (D minor turning
to D major for the outro), a harp that returns at every turn, a low pulse under
the scales, filtered air where the light lands, and bells on the Acts card, the
scales, the ten lights, the cross and the end card. Master peaks at −1.3 dBFS.

## Sources and licences

- Scripture: King James Version (public domain).
- Type: DejaVu Serif (free licence).
- Everything else — sets, sprites, light, score — is generated by the two
  scripts in this folder. No stock footage, no samples, no third-party art.
- Style: built to the invariants of `styles/hd-2d/STYLE.md` in
  [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) (MIT). The style's
  name is not used as a brand inside the film.

## Notes

The hard part of this brief is not the theology, it is the honesty: three
answers, none of them a verdict, and a last beat that hands the question back
to the viewer. The film is built so that each answer gets a badge, and the only
thing all three agree on gets the cross — that is the argument in one image.
