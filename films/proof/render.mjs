/**
 * Swiss Motion Graphics — proof clip.
 * Style spec: lemomo-ai/lemo-opuscar · styles/swiss-motion/STYLE.md
 *
 * Rules honoured here: 12-column grid, one typeface, one signal colour,
 * flat surfaces (no gradients/glow/grain), pitfall-free motion — wipes and
 * clip-reveals only, two curves, everything lands on a 120 BPM beat.
 *
 * Renderer: Skia canvas (@napi-rs/canvas) -> raw RGB frames -> ffmpeg (H.264).
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';

// ---------------------------------------------------------------- fonts
const F = 'node_modules/@expo-google-fonts/inter';
for (const w of ['400Regular', '500Medium', '700Bold', '900Black']) {
  GlobalFonts.registerFromPath(`${F}/${w}/Inter_${w}.ttf`, `Inter${w.slice(0, 3)}`);
}

// ---------------------------------------------------------------- canvas
const W = 1920, H = 1080;          // delivery size (STYLE.md §2: 1920×1080)
const DW = 1280, DH = 720;          // design units the layout below is written in
const S = W / DW;                   // 1.5
const FPS = 24, DUR = 8, N = FPS * DUR;
const OUT = 'films/proof/proof.mp4';
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// ---------------------------------------------------------------- grid
const M = 64, GUT = 16;
const CW = (DW - 2 * M - 11 * GUT) / 12;
const colX = i => M + i * (CW + GUT);
const colW = n => n * CW + (n - 1) * GUT;
const RIGHT = DW - M;

// paper, ink, greys, one signal colour (STYLE.md §3)
const PAGE = '#EAE9E5', PAPER = '#FFFFFF', INK = '#111111';
const GREY1 = '#C9C7C2', GREY2 = '#8E8C86', SIGNAL = '#FF5A00';

// ---------------------------------------------------------------- motion
const clamp01 = v => Math.min(1, Math.max(0, v));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
function bezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const sx = u => ((ax * u + bx) * u + cx) * u;
  const sy = u => ((ay * u + by) * u + cy) * u;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const d = sx(u) - x, slope = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(d) < 1e-6 || Math.abs(slope) < 1e-6) break;
      u -= d / slope;
    }
    return sy(Math.min(1, Math.max(0, u)));
  };
}
const ease = bezier(0.7, 0, 0.2, 1);            // the snap curve
const e = (t, a, b) => ease(seg(t, a, b));
const linear = (t, a, b) => seg(t, a, b);

// ---------------------------------------------------------------- type
const font = (weight, size) => `${size}px Inter${weight}`;
const type = (weight, size, color) => { ctx.font = font(weight, size); ctx.fillStyle = color; };

/** A line rising out of a clip rect from below its baseline (never a fade). */
function rise(text, x, y, weight, size, color, p, align = 'left') {
  if (p <= 0) return;
  type(weight, size, color);
  ctx.textAlign = align;
  const h = size * 1.35;
  const left = align === 'right' ? x - ctx.measureText(text).width : x;
  ctx.save();
  ctx.beginPath(); ctx.rect(left - 8, y - size * 1.05, 4000, h); ctx.clip();
  ctx.fillText(text, x, y + (1 - p) * h);
  ctx.restore();
  ctx.textAlign = 'left';
}

/** A hairline growing along its length. */
function rule(x, y, len, p, color = INK, w = 1) {
  if (p <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, len * p, w);
}

// ---------------------------------------------------------------- frame
function draw(t) {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, DW, DH);

  // drafting grid: on the page while building, gone before the film is done
  const gridA = e(t, 0, 0.35) * (1 - e(t, 2.9, 3.4));
  if (gridA > 0.001) {
    ctx.strokeStyle = GREY1; ctx.globalAlpha = gridA * 0.85; ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) {
      const x = Math.round(colX(i)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, DH); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- beat 0–2 · the programme header ---------------------------------
  rule(M, 64, colW(7) * e(t, 0, 0.45), 0, INK, 1);
  rise('SAM × LEMO-OPUSCAR', M, 94, 500, 15, INK, e(t, 0.1, 0.5));
  rise('01 — 08s · 120 BPM', RIGHT, 94, 400, 13, GREY2, e(t, 0.25, 0.6), 'right');

  // ---- beat 2–7 · the count --------------------------------------------
  // giant numeral climbs in eased steps, one module at a time (§5)
  const stepA = e(t, 1.0, 1.35), stepB = e(t, 1.5, 1.85), stepC = e(t, 2.0, 2.35);
  let climb = 120 * (3 - (stepA + stepB + stepC));
  // knife cut at 3.0, then collapse to the midline (§5 deletions)
  const cut = e(t, 3.0, 3.2), collapse = e(t, 3.2, 3.45);
  if (t >= 0.98 && collapse < 0.999) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 180, colW(7), 420); ctx.clip();
    ctx.translate(0, 420);
    ctx.scale(1, Math.max(0.001, 1 - collapse));
    ctx.translate(0, -420);
    ctx.globalAlpha = 1;
    rise('99', M, 560 + climb, 900, 300, INK, e(t, 1.0, 1.25));
    ctx.restore();
    ctx.restore();
    if (cut > 0) {                     // the cut spans the glyphs, not the grid
      ctx.font = font(900, 300);
      const gw = ctx.measureText('99').width;
      ctx.fillStyle = INK;
      ctx.fillRect(M - 6, 419, (gw + 12) * cut, 2);
    }
  }

  if (t > 1.4 && t < 3.5) {
    rule(colX(7), 300, colW(5) * e(t, 1.4, 1.7), 0, INK, 1);
    rise('FILM STYLES', colX(7), 352, 900, 40, INK, e(t, 1.5, 1.85));
    rise('MADE ENTIRELY IN CODE', colX(7), 386, 500, 16, GREY2, e(t, 1.75, 2.1));
    if (t > 1.5) {
      ctx.fillStyle = SIGNAL;
      ctx.fillRect(colX(7), 420, colW(5) * e(t, 1.5, 2.5), 10);
    }
    rise('GRID 12 · BASELINE 24 · GUTTER 16', M, 664, 400, 12, GREY2, e(t, 1.6, 1.9));
    rise('COUNT 99 / 99', RIGHT, 664, 400, 12, GREY2, e(t, 2.2, 2.5), 'right');
  }

  // ---- beat 7–12 · the statement ---------------------------------------
  if (t > 3.45) {
    rise('THE PICTURE IS', M, 300, 500, 17, GREY2, e(t, 3.5, 3.8));
    rise('NO VIDEO', M, 396, 900, 92, INK, e(t, 3.6, 4.0));
    rise('MODEL', M, 492, 900, 92, INK, e(t, 4.3, 4.7));

    rule(M, 596, colW(12) * e(t, 4.9, 5.25), 0, INK, 1);
    rise('SKIA CANVAS → FFMPEG · EVERY FRAME WRITTEN AS CODE', M, 622, 500, 14, GREY2, e(t, 5.0, 5.3));
    rise('RENDER 1280 × 720 · 24 FPS', RIGHT, 622, 400, 12, GREY2, e(t, 5.1, 5.4), 'right');

    // the exception: one element leaves the system, and moves linearly (§3, §6)
    const drift = linear(t, 5.0, 6.0);
    const ex = colX(9) + drift * 46, ey = 150 + drift * 26;
    if (t > 4.9) {
      ctx.fillStyle = SIGNAL;
      ctx.fillRect(ex, ey, 28, 28);
      rise(`x ${Math.round(ex)} · y ${Math.round(ey)} · ${drift > 0.02 ? 'OFF GRID' : 'ON GRID'}`,
        colX(9), ey + 54, 400, 12, GREY2, e(t, 5.0, 5.2));
    }
  }

  // ---- beat 12–16 · end plate ------------------------------------------
  if (t > 6.0) {
    const wipe = e(t, 6.0, 6.3);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, DW * wipe, DH);

    // the grid runs past the page: the system is bigger than the artifact (§6)
    const ext = e(t, 6.2, 6.9);
    if (ext > 0) {
      ctx.strokeStyle = GREY1; ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const x = Math.round(colX(i)) + 0.5;
        const half = (DH / 2) * ext;
        ctx.beginPath(); ctx.moveTo(x, DH / 2 - half); ctx.lineTo(x, DH / 2 + half); ctx.stroke();
      }
    }

    rise('MADE', M, 340, 900, 88, INK, e(t, 6.35, 6.7));
    rise('IN CODE', M, 432, 900, 88, INK, e(t, 6.65, 7.0));

    const land = e(t, 6.8, 7.1);
    ctx.fillStyle = SIGNAL;
    ctx.fillRect(colX(11), 264 + (1 - land) * -40, 24, 24);

    rule(M, 596, colW(12) * e(t, 6.9, 7.3), 0, INK, 1);
    rise('SAM × LEMO-OPUSCAR', M, 622, 500, 13, INK, e(t, 7.0, 7.3));
    rise('02 / 02', RIGHT, 622, 400, 13, GREY2, e(t, 7.05, 7.35), 'right');
  }
}

// ---------------------------------------------------------------- encode
const ffmpeg = process.env.FFMPEG;
if (!ffmpeg) { console.error('Set FFMPEG=/path/to/ffmpeg'); process.exit(1); }

const proc = spawn(ffmpeg, [
  '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', OUT,
], { stdio: ['pipe', 'ignore', 'pipe'] });
proc.stderr.on('data', d => { const s = d.toString(); if (/error|Invalid/i.test(s)) process.stderr.write(s); });

const rgb = Buffer.alloc(W * H * 3);
for (let f = 0; f < N; f++) {
  draw(f / FPS);
  const src = canvas.data();               // RGBA
  for (let i = 0, j = 0; i < src.length; i += 4, j += 3) {
    rgb[j] = src[i]; rgb[j + 1] = src[i + 1]; rgb[j + 2] = src[i + 2];
  }
  if (!proc.stdin.write(Buffer.from(rgb))) await once(proc.stdin, 'drain');
}
proc.stdin.end();
const [code] = await once(proc, 'close');
if (code !== 0) { console.error('ffmpeg exited', code); process.exit(1); }
console.log(`${OUT} · ${N} frames · ${DUR}s · ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB`);
