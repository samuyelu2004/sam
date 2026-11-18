# TREATMENT — The Last Delivery (16-bit Pixel RPG example, 15 s)

Style: `styles/pixel-rpg/STYLE.md` (16-bit Pixel RPG). Language: English (user's language).
Format: 320×180 indexed framebuffer ×6 → 1920×1080, 24 fps, 15.0 s. No voice (text blips only, allowed by STYLE §7). No LemoLab credit (user's film).

## 1. Three candidate structures

- **A. Single journey** (chosen): title → overworld walk → item-get → palette collapse → flood → save. One subject (courier), one goal (deliver the red flower), one turn (the world loses colour, then returns). Fits 15 s; every beat is a native game system.
- **B. Shop + inventory**: story told through items bought/sold. Needs more UI time than 15 s allows; cut.
- **C. Turn-based duel**: two sides alternate moves. No conflict in this topic; cut.

Why A: hook in 2 s (PRESS START + walking hero), one signature move at the peak (palette collapse/flood with the protected red flower as match cut), ending echoes the opening (save screen answers PRESS START).

## 2. Logline and arc

A tiny courier with a red scarf walks across pixel town to deliver a red flower to the save crystal; the world drains to faded grey on the way, then floods back in full colour when the flower is placed. Setup (title + walk) → turn (collapse) → ending (save + CONTINUE).

## 3. Benchmark

- Learn: mid-90s console RPG grammar (dialog boxes, menus, save files, fanfares) as a system; indexed-palette swaps as emotion; integer-pixel camera.
- Don't learn: any existing game names, characters, UI frames, fonts, logos, melodies or sound effects. All art, text and music here are original.

## 4. Shot list

| # | Framing | Camera | Dur | Why |
|---|---|---|---|---|
| 1 | Wide (title) | Locked, starfield drift | 0.0–2.0 | PRESS START grammar; hook |
| 2 | Wide (overworld) | Side-scroll track, 3 parallax layers, integer px | 2.0–5.0 | Journey; hero small (1/6 height) |
| 3 | Medium (item-get) | Locked, UI left third | 5.0–7.5 | Menu speaks; flower visible right |
| 4 | Wide (collapse) | Hold — no move, palette steps only | 7.5–10.5 | Loss without motion (native move) |
| 5 | Wide (flood) | Slow push (integer zoom) + Bayer flood | 10.5–12.5 | Resolve; colour returns |
| 6 | Medium (save) | Locked, crystal right | 12.5–15.0 | Save file = memory; CONTINUE prompt |

## 5. Beat sheet (second by second)

- 0.0–2.0 Title: starfield, "THE LAST DELIVERY" (2× outlined), "PRESS START" blinks 2 Hz. Music starts on 0.0.
- 2.0–5.0 Overworld: hero walks right (8 fps walk cycle), dialog types "HELLO, TRAVELER! I HAVE A DELIVERY." (38 cps), ▼ blinks when done.
- 5.0–7.5 Item-get: mosaic in, pedestal + red flower, "GOT RED FLOWER!" fanfare, sparkles, stat window "FLOWER +1".
- 7.5–10.5 Collapse: hold; palette full → c16 (7.5) → c8 (8.5) → faded (9.5); music loses one layer per step; bit-drop each step; red flower + scarf stay red (protected).
- 10.5–12.5 Flood: Bayer wave flood back to full; full band returns; hero hops forward; "THE COLOUR IS BACK!" dialog.
- 12.5–15.0 Save: hero kneels, crystal hum, "GAME SAVED" + ticks, "CONTINUE ▶" blinks; end card "16-BIT PIXEL RPG".

## 6. Cue map

120 BPM, 4/4, F major. Downbeats 0, 2, 4, 6, 8, 10, 12, 14. Original motif (F major): F4 C5 A4 Bb4 C5 F5 (ascending, not the demo's). Lead: 25% pulse; bass: triangle; drums: LFSR noise; echo: 3 taps ~180/270/370 ms, feedback 0.4, low-pass in loop. Collapse: harmony leaves at 7.5, echo/stereo at 8.5, bass at 9.5, one square tone 9.5–10.5, full band returns at 10.5 on the flood.

## 7. Sound design

| Section | Ambience | Foley | Music state |
|---|---|---|---|
| Title | — | blip on PRESS START | motif, stereo + echo |
| Overworld | wind (filtered noise, low) | footsteps (echo), text blips (pitch per speaker) | full |
| Item-get | — | fanfare arp, sparkle shimmer | full, fanfare over |
| Collapse | — | bit-drop per step (lower/coarser) | loses layers per step |
| Flood | — | reverse swell, hop | full band returns |
| Save | crystal hum | save ticks, select blip | music-box resolve to tonic |

Silences: 9.5–10.5 near-silence (one tone) before the flood; true zero 10.4–10.5 (echo tails cut). Mix ≈ −14 LUFS, grain 0.

## 8. Type

Dialog box is the subtitle (bottom quarter, y 134–176, 3-layer border, 32×32 portrait, original pixel font cap 7, 1-px shadow, types with blips, ▼ blink). Title 2× outlined, Bayer-dissolved in/out. `.srt` exported from the same subtitle array (`subtitles_en.srt`).
