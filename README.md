# The Two Trees — HD-2D HyperFrames Film (`1:45`)

> *"If an all-knowing God already knew Eve would eat the fruit, why didn't He remove the tree from the garden?"*

An **HD-2D** (*Octopath Traveler* / *Triangle Strategy*-inspired) `1:45` (`105s`, `1920×1080 @ 30fps`) narrative short film built with **[HeyGen HyperFrames](https://github.com/heygen-com/hyperframes)** (`v0.9.41`), complete with:

- **7 Custom HD-2D Diorama Scenes** (`compositions/scene-01.html` – `scene-07.html` + `assets/images/scene-01..07.png`) featuring deterministic GSAP 2.5D camera motion, drifting volumetric god-rays, rising pixel-bokeh light motes, tilt-shift depth vignettes, and JRPG chapter/Scripture plaques.
- **Full Spoken Narration + Waveform-Synced Captions** (`assets/audio/vo-scene-01..07.mp3` + `compositions/captions.html`).
- **Original Acoustic Harp & Chamber String Underscore** (`assets/audio/hd2d-score.mp3`).
- **Official HyperFrames Agent Skills** installed in `.agents/skills/` (`hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`).
- **Pre-rendered 1080p30 Master MP4** at `renders/the-two-trees-hd2d.mp4`.

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
index.html                  Root 105s (1:45) HyperFrames composition
compositions/
  scene-01.html             Act I   · The Garden of Eden (0.0s – 16.0s)
  scene-02.html             Act II  · The Gilded Cage (16.0s – 32.6s)
  scene-03.html             Act III · The Fractured World (32.6s – 46.8s)
  scene-04.html             Act IV  · Before the Foundation (46.8s – 62.1s)
  scene-05.html             Act V   · The Second Tree on Calvary (62.1s – 76.6s)
  scene-06.html             Act VI  · Another Garden at Dawn (76.6s – 93.6s)
  scene-07.html             Act VII · The Tree of Life Restored (93.6s – 105.0s)
  captions.html             26 waveform-timed HD-2D story captions
assets/
  images/                   7 mastered 1920×1080 HD-2D diorama scenes
  audio/                    7 narrator voiceover clips + 105s HD-2D chamber score
.agents/skills/             Official heygen-com/hyperframes skills
SPEC.md                     Shot-by-shot timing, visual, and audio specification
renders/
  the-two-trees-hd2d.mp4    Rendered 1920×1080 @ 30fps (1:45) master video
```
