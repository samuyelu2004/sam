# The Village of No Name — HD-2D HyperFrames Specification

**Question:** What happens to people who never heard of Jesus? If Jesus is the only way to the Father, what about a man born in a remote village who died without ever hearing his name?

**Style:** HD-2D HyperFrames — pixel-art / 2.5D layered sprite dioramas with tilt-shift depth-of-field, volumetric god-rays, bokeh motes, scanlines, JRPG filigree framing, rich vignette.

**Duration:** 2:51 (171 seconds) · 1920×1080 · 30fps · H.264 High + AAC stereo

**Voice:** voice-01 (narration), mastered to -16 LUFS
**Score:** Karplus-Strong harp arpeggios + chamber string pads, 171s, -18 LUFS

## 8-Act Timeline

| # | Scene | Time | VO | Act Plaque | Scripture |
|---|-------|------|-----|-----------|-----------|
| 1 | THE QUESTION | 0.0–17.3s | @ 0.40s | ACT I · THE VILLAGE OF NO NAME | Romans 10:14 |
| 2 | CORNELIUS IN CAESAREA | 17.3–33.0s | @ 17.70s | ACT II · A GENTILE WHO FEARED GOD | Acts 10:1-2 |
| 3 | THE VISITOR | 33.0–56.9s | @ 33.40s | ACT III · THE VISITOR | Acts 10:3-8 |
| 4 | NOT A RESPECTER OF PERSONS | 56.9–80.1s | @ 57.30s | ACT IV · NOT A RESPECTER OF PERSONS | Acts 10:34-35 |
| 5 | NO ONE WITHOUT LIGHT | 80.1–107.7s | @ 80.50s | ACT V · NO ONE WITHOUT LIGHT | Romans 1:20 · Acts 17:23 |
| 6 | JUDGED BY THE LIGHT GIVEN | 107.7–127.7s | @ 108.10s | ACT VI · JUDGED BY THE LIGHT GIVEN | Luke 12:48 · Genesis 18:25 |
| 7 | NO OTHER NAME | 127.7–148.9s | @ 128.10s | ACT VII · NO OTHER NAME | Acts 4:12 |
| 8 | THE WEIGHT IS OURS | 148.9–171.0s | @ 149.30s | ACT VIII · THE WEIGHT IS OURS | Romans 10:14-15 |

- Intro title card: scene-01, 0.15–4.75s
- Epilogue card ("THE ANSWER IS US"): scene-08, 17.5–20.7s local
- 37 synchronized dialogue captions

## Visual System (per scene)
- Full-frame 1920×1080 HD-2D diorama image with slow camera drift (scale 1.03→1.12)
- Volumetric god-rays layer (screen blend, drift animation)
- 14 bokeh motes with two-phase float animation
- Tilt-shift depth-of-field + vignette, subtle scanlines
- JRPG filigree frame + chapter plaque (ACT title + scripture ref)

## Sound Architecture
- 8 narration clips (`assets/audio/vo-scene-01..08.mp3`), -16 LUFS, placed at scene start + 0.40s
- Score `assets/audio/hd2d-score.mp3` at 0.14 volume with 1.5s fade-in / 3.0s fade-out

## CLI Commands
```bash
PATH="/home/user/.local/bin:$PATH" npx hyperframes lint
PATH="/home/user/.local/bin:$PATH" npx hyperframes timeline --json
PATH="/home/user/.local/bin:$PATH" npx hyperframes render --output renders/village-of-no-name-hd2d.mp4
```
