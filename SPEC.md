# SPEC — The Two Trees (HD-2D Sacred Film)

## Overview
- **Title:** *The Two Trees — Why Didn't God Remove the Tree from Eden?*
- **Format:** `1920×1080` Landscape · `30 fps` · `105.0s` (`1:45`)
- **Framework:** [HeyGen HyperFrames](https://github.com/heygen-com/hyperframes) (`v0.9.41`)
- **Visual Direction:** **HD-2D Diorama** (*Octopath Traveler* / *Triangle Strategy* inspired) — expressive 16-bit/32-bit pixel-art character sprites set inside layered 2.5D architectural & natural sanctuaries, volumetric golden/celestial god-rays, rising pixel-bokeh motes, miniature tilt-shift shallow depth of field, subtle scanline texture, and antique-gold JRPG filigree framing.

## Palette & Typography
- **Obsidian Ground:** `#09080c`
- **Plaque Surface:** `rgba(12, 10, 18, 0.90)`
- **Antique Filigree Gold:** `#f3d287` / `#e5c16c`
- **Warm Parchment Ink:** `#fcf6e8`
- **Display & Story Serif:** `Playfair Display` (700), `EB Garamond` (400, 500, 700)
- **Scripture & Chapter Metadata:** `JetBrains Mono` (400, 700)

## Seven-Act Timeline (`0.0s – 105.0s`)

| Act | Composition | Window | VO Start | Scripture | Narrative Beat |
| --- | --- | --- | --- | --- | --- |
| **I** | `compositions/scene-01.html` | `0.0s – 16.0s` | `0.90s` | Genesis 2:9 | Eden's luminous sanctuary & the central question: if God foreknew the Fall, why leave the tree? |
| **II** | `compositions/scene-02.html` | `16.0s – 32.6s` | `16.45s` | Deuteronomy 30:19 | The clockwork conservatory: a world with no ability to say *no* turns obedience into mere programming, not love. |
| **III** | `compositions/scene-03.html` | `32.6s – 46.8s` | `33.05s` | Genesis 3:6 | The tree was planted for real freedom, yet humanity's choice fractured the garden in sorrow. |
| **IV** | `compositions/scene-04.html` | `46.8s – 62.1s` | `47.25s` | 1 Peter 1:20 | Before creation's dust was shaped, Jesus — the Lamb slain before the foundation of the world — chose to bear the cost. |
| **V** | `compositions/scene-05.html` | `62.1s – 76.6s` | `62.55s` | 1 Peter 2:24 · Gal 3:13 | From the first tree in Eden to the second tree on Calvary: God steps into history and climbs the Cross. |
| **VI** | `compositions/scene-06.html` | `76.6s – 93.6s` | `77.05s` | John 19:41 · Luke 24:6 | The Great Exchange and the empty garden tomb at dawn on the third morning. |
| **VII** | `compositions/scene-07.html` | `93.6s – 105.0s` | `94.05s` | Revelation 22:2 | Epilogue by the restored Tree of Life: free to love, redeemed forever. |

## Sound Architecture
- **Voiceover (`vo-01` .. `vo-07`):** 7 spoken narration stems (`assets/audio/vo-scene-01.mp3` – `vo-scene-07.mp3`), loudness-normalized to `-16 LUFS` / `-1.5 dBTP`.
- **Chamber Score (`bgm-score`):** `assets/audio/hd2d-score.mp3` — Karplus-Strong acoustic harp arpeggios and warm cathedral string pads shifting key across all 7 acts, mixed at `data-volume="0.14"` beneath the narrator with `1.5s` fade-in and `3.0s` fade-out.
- **Captions (`compositions/captions.html`):** 26 waveform-aligned HD-2D dialogue plaques inside the 80% title-safe zone.
