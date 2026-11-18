# TREATMENT — Cadet Frenzy (Microgame Frenzy example, 15 s)

Style: `styles/microgame/STYLE.md` (Microgame Frenzy). Language: English (user's language).
Format: 1920×1080, 24 fps, 15.0 s. No voice (command words are the subtitles; host shouts are text-only). No LemoLab credit (user's film).

## 1. Three candidate structures

- **A. Boot-camp ladder** (chosen): home stage → 3 microgames (crayon, pixel, blueprint) with a speed-up between each → boss game mixing all three media. One subject (cadet hero), one goal (survive the frenzy), one turn (the blueprint tower fails, the boss landing redeems it). Fits 15 s; every beat is command → action → result.
- **B. Two players alternating**: each game played by one of two rivals, lives as tug-of-war. Needs a second hero rig; too much for 15 s; cut.
- **C. One day, hour by hour**: each game an hour, speed-ups are rush hours. Needs narration to read; cut.

Why A: hook in 1.5 s (host wakes, first command slams), acceleration is visible (games get shorter), failure has stakes (lives 3 → 2), ending echoes the opening (stage clear on the home stage).

## 2. Logline and arc

A clumsy cadet survives a 15-second boot camp of microgames — DRAW! JUMP! BUILD! — faster and faster, until the boss: LAND! Setup (home stage + DRAW) → turn (BUILD fails, life lost) → ending (boss landing, stage clear).

## 3. Benchmark

- Learn: WarioWare-style grammar (shouted command, timer, lives, stamps, speed-ups) as a system; one medium per game; hero silhouette marks surviving every switch.
- Don't learn: any existing game names, characters, UI, microgames or music. All art, text and music here are original.

## 4. Shot list

| # | Framing | Camera | Dur | Why |
|---|---|---|---|---|
| 1 | Wide (home stage) | Locked frontal; push into TV to start | 0.0–1.5 | The constant; host wakes on beat 1 |
| 2 | TV screen (crayon) | Locked in TV; shrink back with ✓ | 1.5–4.5 | DRAW! — wax pressure channel |
| 3 | Wide (home) | Slot reels (strips spin, stop per beat) | 4.5–5.5 | SPEED UP summary |
| 4 | TV screen (pixel) | Locked in TV; shrink back with ✓ | 5.5–8.5 | JUMP! — indexed buffer |
| 5 | Wide (home) | Slot reels | 8.5–9.5 | SPEED UP |
| 6 | TV screen (blueprint) | Locked in TV; shrink back with ✗ | 9.5–12.0 | BUILD! — line system; tower topples |
| 7 | TV screen (boss mix) | Locked in TV; snap back to wide on the hit | 12.0–15.0 | LAND! — crayon+pixel+blueprint; finale |

## 5. Beat sheet (second by second)

- 0.0–1.5 Home: sunburst stage, host + hero, lives ♥♥♥, badge "STAGE 1". Host ticks on beats. Push into TV at 1.5.
- 1.5–4.5 CRAYON DRAW!: command slams, tags to corner, hero draws a star in wax strokes (pressure = alpha vs paper tooth). ✓ stamp. Timer fuse burns on beats.
- 4.5–5.5 Home: slot reels, "SPEED UP!" banner, tempo steps up.
- 5.5–8.5 PIXEL JUMP!: hero jumps a spike (8 fps stepping, faster than crayon). ✓ stamp.
- 8.5–9.5 Home: slot reels, "SPEED UP!" again.
- 9.5–12.0 BLUEPRINT BUILD!: hero stacks blocks; top block overshoots, tower topples (medium's physics). ✗ stamp, glass crack, lives 3 → 2 (blink).
- 12.0–15.0 BOSS LAND!: silence (one heartbeat) then the hit — hero lands on a pad mixing all three media; snap back to wide, "STAGE CLEAR!", confetti, hero star-jump.

## 6. Cue map

Groove at 132 BPM (steps to 144 at 4.5, 156 at 8.5). Downbeats every 0.4545 s (132 BPM). Every command, stamp, reel stop and the boss hit lands on a listed cue. Boss hit at 12.0 after a 0.5 s silence (12.0 is the loudest moment).

## 7. Sound design

| Section | Groove | Colour instrument | Foley |
|---|---|---|---|
| Home | kit + slap bass + brass stabs | — | spring click, card flips, reel whirr |
| Crayon | same groove | toy piano | wax squeaks |
| Pixel | same groove | pulse arpeggio | bit-crushed jump blips |
| Blueprint | same groove | typewriter ratchets | stamp thuds, glass crack (life lost) |
| Boss | full band + key rise | all three | landing boom + shimmer |

Real silence: 11.5–12.0 (heartbeat only) before the boss hit. Mix ≈ −14 LUFS, grain 0.

## 8. Type

Command word is the subtitle: heavy display face (DejaVuSans-Bold standing in for Titan One), white, thick ink outline, magenta drop, burst behind, skewed ~4°, slams in over ~3 frames (overshoot → settle), holds, then shrinks to a corner tag before the action. Home cards in the home palette with hard shadow. In-game text uses each medium's own type (crayon hand, pixel font, blueprint caps). Command words exported to `subtitles_en.srt` (never burned twice).
