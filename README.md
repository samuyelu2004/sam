# The Village of No Name — HD-2D HyperFrames Film (`2:51`)

> *"What happens to people who never heard of Jesus? If Jesus is the only way to the Father, what about a man born in a remote village who died without ever hearing his name?"*

An **HD-2D** (*Octopath Traveler* / *Triangle Strategy*-inspired) `2:51` (`171s`, `1920×1080 @ 30fps`) explanation short film built with **[HeyGen HyperFrames](https://github.com/heygen-com/hyperframes)** (`v0.9.41`), answering the question of the unevangelized from the Bible — Cornelius (Acts 10), general revelation (Romans 1–2, Acts 17), fair judgment by the light given (Luke 12:48, Genesis 18), and Paul's call to carry the message (Romans 10:14-15).

- **8 Custom HD-2D Diorama Scenes** (`compositions/scene-01.html` – `scene-08.html` + `assets/images/scene-01..08.png`) featuring deterministic GSAP 2.5D camera motion, drifting volumetric god-rays, rising pixel-bokeh light motes, tilt-shift depth vignettes, and JRPG chapter/Scripture plaques.
- **Full Spoken Narration + Waveform-Synced Captions** (`assets/audio/vo-scene-01..08.mp3` + `compositions/captions.html`, 37 captions).
- **Original Acoustic Harp & Chamber String Underscore** (`assets/audio/hd2d-score.mp3`, 171s).
- **Official HyperFrames Agent Skills** installed in `.agents/skills/` (`hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`).
- **Pre-rendered 1080p30 Master MP4** at `renders/village-of-no-name-hd2d.mp4`.
- **Previous film in this repo:** `renders/the-two-trees-hd2d.mp4` (`1:45`, HD-2D) — *"If God knew Eve would eat the fruit, why didn't He remove the tree from the garden?"*

## Quick Commands

```bash
# Lint all compositions (0 errors, 0 warnings)
npm run lint

# Launch HyperFrames Studio timeline editor
npm run dev

# Launch lightweight browser player
npm run play

# Render MP4 via HyperFrames CLI (requires local Chrome + FFmpeg)
npm run render
```

## Project Layout

```text
index.html                  Root 171s (2:51) HyperFrames composition
compositions/
  scene-01.html             Act I   · The Village of No Name (0.0s – 17.3s)
  scene-02.html             Act II  · A Gentile Who Feared God (17.3s – 33.0s)
  scene-03.html             Act III · The Visitor (33.0s – 56.9s)
  scene-04.html             Act IV  · Not a Respecter of Persons (56.9s – 80.1s)
  scene-05.html             Act V   · No One Without Light (80.1s – 107.7s)
  scene-06.html             Act VI  · Judged by the Light Given (107.7s – 127.7s)
  scene-07.html             Act VII · No Other Name (127.7s – 148.9s)
  scene-08.html             Act VIII · The Weight Is Ours (148.9s – 171.0s)
  captions.html             37 waveform-timed HD-2D story captions
assets/
  images/                   8 mastered 1920×1080 HD-2D diorama scenes
  audio/                    8 narrator voiceover clips + 171s HD-2D chamber score
.agents/skills/             Official heygen-com/hyperframes skills
SPEC.md                     Shot-by-shot timing, visual, and audio specification
script-unevangelized.md     Full narration script for this film
renders/
  village-of-no-name-hd2d.mp4   Rendered 1920×1080 @ 30fps (2:51) master video
  the-two-trees-hd2d.mp4        Previous film (1:45) master video
```
