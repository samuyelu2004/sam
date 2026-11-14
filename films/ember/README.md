# He Had Been Dead 4 Days

A 65 second vertical short (720×1280, 30 fps) about John 11 — the raising of
Lazarus — made entirely in code with [Remotion](https://remotion.dev). No stock
footage, no downloaded art, no samples: every frame is React, every sound is
synthesised by a Python script in this folder.

For **DID YOU KNOW? BIBLE** · topic tag **TRUE STORY** · **THE EMBER NETWORK**
— *“Scripture, one story at a time.”*

---

## Install and render

```bash
cd films/ember
npm install

# open the timeline in Remotion Studio
npx remotion studio

# render the finished MP4
npx remotion render
```

`npx remotion render` uses the `render` script in `package.json`:

```bash
remotion render John11 out/he-had-been-dead-4-days.mp4
```

Other useful calls:

```bash
# a single frame, to check the look
npx remotion still John11 out/still.png --frame=1010

# render without audio, faster
npx remotion render John11 out/silent.mp4 --muted

# a smaller preview
npx remotion render John11 out/preview.mp4 --scale=0.5 --crf=28
```

The first render downloads Chrome Headless Shell (Remotion does this once). If
you already have a Chrome, point at it and skip the download:

```bash
npx remotion render John11 out/film.mp4 --browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## What is in here

```
films/ember/
├─ src/
│  ├─ data/scenes.json      every line of text, every timing, every action
│  ├─ Scene.tsx             one scene on screen: camera, effects, captions
│  ├─ Video.tsx             the timeline, the header, the audio slots
│  ├─ Root.tsx              the composition (720×1280, 30 fps, 1950 frames)
│  ├─ components/
│  │  ├─ Character.tsx      the jointed figure: 11 poses, 8 joints
│  │  ├─ Sets.tsx           the isometric dioramas and props
│  │  ├─ UI.tsx             captions, quote cards, badges, bubbles, progress
│  │  ├─ Effects.tsx        light beams, sparkles, dust, vignette
│  │  └─ Iso.tsx            the isometric projector and box primitives
│  └─ lib/                  maths, easing, font loading
├─ scripts/make_audio.py    synthesises the score and the two hits
├─ public/fonts/            Archivo Black + Cormorant Garamond (woff2)
└─ public/audio/            music.mp3, stone-slam.mp3, boom.mp3
```

### Everything is data

`src/data/scenes.json` is the single source of truth. Each scene declares its
window in seconds, its camera move, its shake bursts, and its text:

```json
{
  "id": 5, "from": 24, "to": 31, "set": "meet",
  "camera": { "zoomFrom": 1.04, "zoomTo": 1.12, "panX": [-16, 6], "panY": [0, -6] },
  "captions": [{ "from": 0.2, "to": 2.4, "text": "MARTHA RAN TO MEET HIM.", "gold": ["RAN"] }],
  "quotes": [{ "from": 2.6, "to": 5.6, "text": "Lord, if thou hadst been here…", "ref": "John 11:21 KJV" }]
}
```

Change the wording, the timings or a camera move there and the picture, the
captions and the music cues all follow. `gold` is the list of words painted in
the accent colour. Captions are capped at seven words.

### The figures

Every person is built from shapes with real pivots — hips, knees, shoulders,
elbows, neck — and each joint is driven by the film clock, so nobody is ever
completely still:

| pose | what it does |
| --- | --- |
| `idle` | breathing bob, weight shifting, arms swaying |
| `walk` | alternating leg swing with a body bob |
| `run` | longer stride, forward lean, arms pumping |
| `kneel` | hips drop, knees fold, hands together |
| `weep` | kneel plus a shoulder shudder and head down |
| `point` | one arm out toward the tomb |
| `raise` | both arms up into the light |
| `pull` | braced legs, arms back, straining at the stone |
| `carry` | arms forward, carrying the wrapped body |
| `gasp` | the crowd recoiling, arms up |
| `stand` | Jesus, calm, hands at his sides |

Poses are pure functions of `(mode, t, phase)`, so any frame can be rendered on
its own and two frames never disagree.

### Look

Isometric dioramas are projected with a 2:1 projector (`src/components/Iso.tsx`)
into flat low-poly faces: stone houses with flat roofs, olive trees, rocks, a
cave tomb with a round door. A warm key light and a gold pool sit over a cool
indigo grade; light shafts, sparkles and dust float above it.

## Sound

`scripts/make_audio.py` writes three WAVs with numpy — a D minor pad that turns
toward D major, a heartbeat pulse, a stone slam and a sub-bass boom:

```bash
python3 scripts/make_audio.py     # needs numpy
```

then convert (or let the checked-in mp3s stand as they are):

```bash
for f in music stone-slam boom; do
  ffmpeg -y -i public/audio/$f.wav -codec:a libmp3lame -qscale:a 4 public/audio/$f.mp3
done
```

**Voice-over slot.** `src/data/scenes.json` has `audio.voiceover: null`. Drop a
file in `public/audio/`, set it to e.g. `"audio/voiceover.mp3"`, and it plays
over the whole film. The music is ducked automatically at the head and tail; if
you add narration you will probably want to lower `audio.musicVolume` from 0.5.

**Marked hits.** The three sound cues are listed in `scenes.json` with notes:

| at | cue | where |
| --- | --- | --- |
| 13.45 s | `stone-slam` | scene 4 — the stone shuts on Lazarus |
| 31.90 s | `stone-slam` | scene 9 — the stone is dragged aside |
| 59.40 s | `boom` | scene 10 — silence, then the shout |

## Scripture

King James Version, public domain, quoted exactly:

- John 11:6 — *“Two days”* (scene 3)
- John 11:21 — *“Lord, if thou hadst been here, my brother had not died.”*
- John 11:25 — *“I am the resurrection, and the life.”*
- John 11:35 — *“Jesus wept.”*
- John 11:39 — *“Lord, by this time he stinketh: for he hath been dead four days.”*
- John 11:43 — *“Lazarus, come forth.”*
- John 11:44 — *“Loose him, and let him go.”*

Typefaces: Archivo Black and Cormorant Garamond, both SIL Open Font License,
bundled under `public/fonts`.

## The 12 scenes

| # | s | scene |
| --- | --- | --- |
| 1 | 0–3 | a stone door cracks open, gold light, the hook slams in |
| 2 | 3–10 | Lazarus dying, his sisters send word |
| 3 | 10–17 | the messenger finds Jesus — and he stays two more days |
| 4 | 17–24 | he dies, they carry him out, the stone shuts |
| 5 | 24–31 | Martha runs to meet him, John 11:21 |
| 6 | 31–37 | close on Jesus, John 11:25 |
| 7 | 37–43 | the tomb, head bowed, “Jesus wept.” |
| 8 | 43–49 | the crowd steps back, John 11:39 |
| 9 | 49–55 | the stone rolls away, smoke, silence |
| 10 | 55–60 | “Lazarus, come forth.” — white flash |
| 11 | 60–63 | the figure in the doorway, John 11:44 |
| 12 | 63–65 | end card: flame, network, the question |
