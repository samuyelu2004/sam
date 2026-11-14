/**
 * Never Heard — 2:20 vertical explainer in the 2.5D Pixel Art style.
 * Style spec: lemomo-ai/lemo-opuscar · styles/hd-2d/STYLE.md
 *
 * Built from the supplied 20-shot storyboard (720x1280): Cornelius (Acts 10),
 * Romans 1, Athens (Acts 17), the scales (Luke 12:48), Abraham (Genesis 18),
 * the cross, Romans 10, the lamp handed on, and the brand outro.
 *
 * Look: a lit, fogged tabletop diorama seen from a high three-quarter angle.
 * Flat pixel sprites receive light and cast shadows inside a smoothly moving
 * camera, through a tilt-shift band, with bloom and heavy vignette. An RPG
 * chapter card and serif subtitles sit on top.
 *
 * Renderer: Skia canvas -> raw RGBA -> ffmpeg. No browser, no 3D engine, so the
 * set is painted with a pinhole projection rather than ray-traced; light and fog
 * are quantised per sprite, and the tilt-shift is a masked blur band.
 */
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';

// ---------------------------------------------------------------- canvas
const ART_W = 360, ART_H = 640;          // vertical: art px = 2 output px
const OUT_W = 720, OUT_H = 1280;
const FPS = 24, DUR = 140, N = FPS * DUR;
const OUT = 'films/never-heard/never-heard.mp4';

const art = createCanvas(ART_W, ART_H);
const g = art.getContext('2d');
const out = createCanvas(OUT_W, OUT_H);
const o = out.getContext('2d');
const sharp = createCanvas(OUT_W, OUT_H), sctx = sharp.getContext('2d');
const blurC = createCanvas(OUT_W, OUT_H), bctx = blurC.getContext('2d');
const maskC = createCanvas(OUT_W, OUT_H), mctx = maskC.getContext('2d');
const blo1 = createCanvas(480, 270), b1 = blo1.getContext('2d');
const blo2 = createCanvas(480, 270), b2 = blo2.getContext('2d');
const blo3 = createCanvas(240, 135), b3 = blo3.getContext('2d');

// ---------------------------------------------------------------- maths
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = t => 1 - Math.pow(1 - clamp(t), 3);

const hex = c => {
  if (c.startsWith('rgb')) {
    const m = c.match(/[\d.]+/g);
    return [m[0] | 0, m[1] | 0, m[2] | 0];
  }
  const s = c.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const rgb = (r, gg, b) => `rgb(${r | 0},${gg | 0},${b | 0})`;
const mix = (c1, c2, t) => {
  const a = hex(c1), b = hex(c2);
  return rgb(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
};
const hash = n => {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---------------------------------------------------------------- palettes
const GOLD = {   // Caesarea, Athens, the golden interiors
  skyTop: '#b8794f', skyMid: '#d2955f', skyLow: '#e8b47c',
  fog: '#c99a72', ground: '#b9825a', groundLit: '#d39a68',
  ink: '#33200f', warm: '#fff0c8', warmDeep: '#ffb26a', moon: '#fff8e6',
};
const NIGHTV = { // the village at night
  skyTop: '#171225', skyMid: '#241a2b', skyLow: '#3a2830',
  fog: '#2a2032', ground: '#2b2228', groundLit: '#40323a',
  ink: '#0a0810', warm: '#ffd08a', warmDeep: '#ff9a4a', moon: '#e8f0ff',
};
const RUST = {   // the scales, the Abraham room
  skyTop: '#431b16', skyMid: '#5e2a20', skyLow: '#83402c',
  fog: '#5a2a20', ground: '#6e3524', groundLit: '#8a4830',
  ink: '#240e0a', warm: '#ffd9a0', warmDeep: '#ffa864', moon: '#ffe8c8',
};
const DUSKPLAIN = { // Sepia, dust, the open plain
  skyTop: '#a06a52', skyMid: '#c08868', skyLow: '#ddaa80',
  fog: '#bb8a6c', ground: '#a9744e', groundLit: '#c48c60',
  ink: '#331d12', warm: '#ffe0b0', warmDeep: '#ffb478', moon: '#fff0d8',
};
const NIGHTROAD = {
  skyTop: '#131a2e', skyMid: '#212d46', skyLow: '#3a4a62',
  fog: '#26374f', ground: '#2f3c4e', groundLit: '#465468',
  ink: '#080c14', warm: '#ffd08a', warmDeep: '#ff9a4a', moon: '#e8f0ff',
};
const CREAM = {  // quote cards and the outro
  skyTop: '#f3e9d4', skyMid: '#f6eeda', skyLow: '#f8f1e0',
  fog: '#e8dcc4', ground: '#e6dac2', groundLit: '#f0e6d0',
  ink: '#3a2a1e', warm: '#fff6e2', warmDeep: '#c85a3c', moon: '#ffffff',
};
const lerpPal = (a, b, k) => {
  const o = {};
  for (const key of Object.keys(a)) {
    if (key.startsWith('_')) continue;
    o[key] = mix(a[key], b[key], k);
  }
  o._night = lerp(a._night || 0, b._night || 0, k);
  return o;
};
const PAL = { GOLD, NIGHTV, RUST, DUSKPLAIN, NIGHTROAD, CREAM };
for (const k of Object.keys(PAL)) PAL[k]._night = (PAL[k] === NIGHTV || PAL[k] === NIGHTROAD) ? 1 : 0;
const palAt = t => {
  const k = SHOTPAL(t);
  if (typeof k === 'string') return PAL[k] || GOLD;
  const [a, b, f] = k.__lerp;
  return lerpPal(PAL[a], PAL[b], clamp(f));
};
// each shot names its palette and may cross-fade into the next one
const SHOTPAL = t => {
  for (const sh of SHOTS) if (t >= sh.t0 && t < sh.t1) {
    if (sh.palTo && sh.palFade && t > sh.t1 - sh.palFade) {
      return { __lerp: [sh.pal, sh.palTo, (t - (sh.t1 - sh.palFade)) / sh.palFade] };
    }
    return sh.pal;
  }
  return 'GOLD';
};

// ---------------------------------------------------------------- sprites
const spriteCache = new Map();

function paintCanvas(w, h, paint) {
  const c = createCanvas(w, h);
  const cx = c.getContext('2d');
  const img = cx.createImageData(w, h);
  const put = (x, y, col) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const [r, gg, b] = hex(col);
    const i = (y * w + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  };
  paint(put);
  // 1 px selout: a darkened neighbour outside the silhouette
  const src = new Uint8ClampedArray(img.data);
  const at = (x, y) => (y * w + x) * 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[at(x, y) + 3] !== 0) continue;
    let r = 0, gg = 0, b = 0, n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (src[at(nx, ny) + 3] === 0) continue;
      r += src[at(nx, ny)]; gg += src[at(nx, ny) + 1]; b += src[at(nx, ny) + 2]; n++;
    }
    if (!n) continue;
    const i = at(x, y);
    img.data[i] = (r / n) * 0.38; img.data[i + 1] = (gg / n) * 0.38; img.data[i + 2] = (b / n) * 0.42;
    img.data[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return c;
}

/** Flat, low-resolution sprite from a painter, cached per variant. */
function variant(base, fogAmt, lightAmt, ink, fogCol, warm) {
  const key = `${base.key}|${Math.round(fogAmt * 8)}|${Math.round(lightAmt * 8)}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const c = createCanvas(base.c.width, base.c.height);
  const cx = c.getContext('2d');
  cx.drawImage(base.c, 0, 0);
  const img = cx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const f = [hex(fogCol), hex(warm), hex(ink)];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i], gg = d[i + 1], b = d[i + 2];
    // a practical multiplies the sprite and pushes it warm; the blue channel
    // gives way first, so a robe stays blue instead of turning cream
    const li = 0.40 + 0.50 * lightAmt;
    r *= li * (1 + 0.12 * lightAmt);
    gg *= li * (1 + 0.02 * lightAmt);
    b *= li * (1 - 0.16 * lightAmt);
    // fog lifts everything toward the set's fog colour
    r = lerp(r, f[0][0], fogAmt * 0.62); gg = lerp(gg, f[0][1], fogAmt * 0.62); b = lerp(b, f[0][2], fogAmt * 0.62);
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  }
  cx.putImageData(img, 0, 0);
  spriteCache.set(key, c);
  return c;
}

// ---- tiny polygon filler, so everything can be drawn on the pixel grid ----
function fillPoly(put, pts, col) {
  const ys = pts.map(q => q[1]);
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y + 0.5) !== (yj > y + 0.5)) xs.push(xi + ((y + 0.5 - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) put(x, y, col);
    }
  }
}

const K = 26;                     // pixels per metre inside a sprite

/** A flat-shaded isometric box: the whole diorama is built from these. */
function boxSprite(wm, hm, dm, cTop, cLeft, cRight, extra) {
  const w = Math.round(wm * K), h = Math.round(hm * K);
  const dx = Math.round(dm * K * 0.52), dy = Math.round(dm * K * 0.30);
  const W = w + dx + 2, H = h + dy + 2;
  return paintCanvas(W, H, put => {
    const x0 = 1, yb = H - 1, yt = yb - h;
    // left face (the lit one) and right face (in shadow)
    fillPoly(put, [[x0, yt], [x0 + w, yt], [x0 + w, yb], [x0, yb]], cLeft);
    fillPoly(put, [[x0 + w, yt], [x0 + w + dx, yt - dy], [x0 + w + dx, yb - dy], [x0 + w, yb]], cRight);
    // top
    fillPoly(put, [[x0, yt], [x0 + dx, yt - dy], [x0 + w + dx, yt - dy], [x0 + w, yt]], cTop);
    if (extra) extra(put, { x0, yt, yb, w, h, dx, dy });
  });
}

// ---- people ----------------------------------------------------------
function personSprite(cfg) {
  const {
    robe = '#c8b18a', robeSh = '#9c8763', skin = '#c99a6a', skinSh = '#a67a50',
    hair = '#3a2a1e', beard = false, hood = false, helmet = false, wings = false,
    cloak = null, pose = 'stand', female = false,
  } = cfg;
  const W = 34, H = 58, cx = 17;
  const kneel = pose === 'kneel';
  return paintCanvas(W, H, put => {
    const R = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c); };
    const shut = (c, k) => mix(c, '#000000', k);
    const lit = (c, k) => mix(c, '#fff3d8', k);

    // wings, behind everything
    if (wings) {
      for (let i = 0; i < 3; i++) {
        const sp = 6 + i * 3;
        for (let y = 10 + i * 5; y < 26 + i * 5; y++) {
          const half = sp + Math.round((y - 10 - i * 5) * 0.7);
          for (let x = cx - 5 - half; x < cx - 4; x++) put(x, y, i === 0 ? '#fbf4e2' : (i === 1 ? '#e9dfc7' : '#d3c6aa'));
          for (let x = cx + 5; x < cx + 5 + half; x++) put(x, y, i === 0 ? '#e6dac0' : (i === 1 ? '#d6c8ab' : '#c2b394'));
        }
        for (let x = cx - 5 - sp - 6; x < cx - 5 - sp; x++) put(x, 10 + i * 5 + 2, '#b9a884');
        for (let x = cx + 5 + sp; x < cx + 5 + sp + 7; x++) put(x, 10 + i * 5 + 2, '#ae9d7c');
      }
    }
    // cloak: hangs off the right shoulder, its edge is broken into steps
    if (cloak) {
      for (let y = 16; y < (kneel ? 50 : 54); y++) {
        const half = 6 + Math.round(((y - 16) / 38) * 4);
        for (let x = cx + 3; x <= cx + half + 2; x++) put(x, y, x > cx + half ? shut(cloak, 0.18) : cloak);
        put(cx + half + 1 + (y % 3 === 0 ? 1 : 0), y, shut(cloak, 0.3));
      }
    }

    const hem = kneel ? 47 : (female ? 48 : 42);
    // legs (hidden by the robe when kneeling)
    if (!kneel) {
      R(cx - 4, hem, 3, 10, '#5c4630');
      R(cx + 1, hem, 3, 10, '#493722');
      R(cx - 5, 53, 4, 3, '#33241a'); R(cx + 1, 53, 4, 3, '#33241a');
    } else {
      // one knee forward, the other folded under
      R(cx - 7, 44, 14, 4, shut(robeSh, 0.1));
      R(cx - 8, 47, 16, 3, robeSh);
      R(cx + 3, 42, 5, 3, shut(robeSh, 0.2));
    }

    // body: row-by-row taper, lit on the left, shadowed on the right
    const top = kneel ? 20 : 15;
    for (let y = top; y < hem; y++) {
      const k = (y - top) / Math.max(1, hem - top);
      const half = Math.round(4.5 + k * 2.6);
      for (let x = cx - half; x <= cx + half; x++) {
        let c = robe;
        if (x === cx - half) c = lit(robe, 0.16);
        else if (x >= cx + half - 1) c = robeSh;
        else if (k > 0.55 && x > cx + Math.round(half * 0.3)) c = mix(robe, robeSh, 0.45);
        put(x, y, c);
      }
    }
    // sash
    const sashY = top + (kneel ? 15 : 19);
    for (let x = cx - 6; x <= cx + 6; x++) { put(x, sashY, '#e8d4a8'); put(x, sashY + 1, '#c2ab80'); }
    for (let y = sashY + 2; y < sashY + 8; y++) put(cx + 2, y, '#c2ab80');
    // shoulders
    R(cx - 6, top - 2, 13, 3, lit(robe, 0.1));
    // arms
    if (pose === 'reach') {
      for (let i = 0; i < 11; i++) R(cx + 5 + i, top - 2 - Math.round(i * 0.85), 2, 3, i > 7 ? skin : robe);
      R(cx - 7, top + 1, 2, 13, robeSh);
      R(cx - 7, top + 14, 2, 2, skin);
    } else if (pose === 'pray' || pose === 'kneel') {
      R(cx - 7, top + 1, 2, 11, robeSh);
      R(cx + 6, top + 1, 2, 11, robe);
      const hy = top + 9;
      R(cx - 3, hy, 3, 3, skin); R(cx, hy, 3, 3, lit(skin, 0.1));
      R(cx - 2, hy - 4, 2, 5, robeSh); R(cx + 1, hy - 4, 2, 5, robe);
    } else if (pose === 'walk') {
      R(cx - 7, top + 1, 2, 12, robeSh); R(cx - 8, top + 13, 2, 2, skin);
      R(cx + 6, top + 2, 2, 10, robe); R(cx + 7, top + 12, 2, 2, skin);
      R(cx - 4, hem, 3, 6, robeSh); R(cx + 2, hem - 1, 3, 7, shut(robeSh, 0.12));
    } else {
      R(cx - 7, top + 1, 2, 13, mix(robeSh, '#000', 0.12)); R(cx - 7, top + 14, 2, 3, skinSh);
      R(cx + 6, top + 1, 3, 13, robe); R(cx + 6, top + 14, 3, 3, skin);
    }
    // neck + head
    const hy0 = kneel ? 13 : 9;
    R(cx - 1, hy0 + 6, 3, 2, skinSh);
    R(cx - 5, hy0 - 1, 10, 9, skin);
    R(cx + 3, hy0 - 1, 2, 9, mix(skin, skinSh, 0.35));
    R(cx - 5, hy0 + 7, 10, 1, mix(skin, skinSh, 0.55));
    put(cx - 2, hy0 + 4, '#2a1f18'); put(cx + 2, hy0 + 4, '#2a1f18');
    R(cx - 3, hy0 + 6, 2, 1, mix(skin, skinSh, 0.6));
    if (beard) {
      R(cx - 4, hy0 + 5, 9, 2, hair);
      R(cx - 3, hy0 + 7, 8, 2, hair);
      put(cx - 1, hy0 + 7, skinSh); put(cx + 2, hy0 + 7, skinSh);
    }
    // hair / hood / helmet
    if (helmet) {
      R(cx - 5, hy0 - 3, 11, 4, '#8e7a44');
      R(cx - 5, hy0 - 3, 11, 1, '#b09a5c');
      R(cx - 5, hy0 + 1, 2, 5, '#7a6838'); R(cx + 4, hy0 + 1, 2, 5, '#7a6838');
      R(cx - 1, hy0 - 6, 3, 4, '#8c2f22');
      R(cx, hy0 - 7, 1, 2, '#b03a28');
    } else if (hood) {
      R(cx - 5, hy0 - 2, 11, 12, hood);
      R(cx - 4, hy0 - 2, 9, 2, shut(hood, 0.25));
      R(cx - 3, hy0 + 1, 7, 6, skin);
      put(cx - 2, hy0 + 4, '#2a1f18'); put(cx + 2, hy0 + 4, '#2a1f18');
      R(cx - 5, hy0 + 8, 11, 2, shut(hood, 0.3));
    } else {
      R(cx - 5, hy0 - 2, 11, 4, hair);
      R(cx - 5, hy0 + 1, 2, 3, hair); R(cx + 4, hy0 + 1, 2, 3, hair);
      if (female) R(cx - 5, hy0 + 4, 2, 12, hair), R(cx + 4, hy0 + 4, 2, 12, hair);
    }
  });
}

// ---- props -----------------------------------------------------------
function hutSprite() {
  return boxSprite(3.2, 2.0, 2.6, '#b08a5e', '#c8a276', '#8e6f4e', (put, g2) => {
    const { x0, yt, w, dx, dy } = g2;
    // thatch: two dark slabs with a lit edge
    fillPoly(put, [[x0 - 7, yt + 2], [x0 + dx - 7, yt - dy + 2], [x0 + w + dx + 7, yt - dy + 2], [x0 + w + 7, yt + 2]], '#8a6034');
    fillPoly(put, [[x0 - 7, yt + 2], [x0 + w + 7, yt + 2], [x0 + w + 7, yt - 3], [x0 - 7, yt - 3]], '#6d4a28');
    fillPoly(put, [[x0 - 6, yt + 1], [x0 + dx - 6, yt - dy + 1], [x0 + w + dx + 6, yt - dy + 1], [x0 + w + 6, yt + 1]], '#a8783f');
    // door: a dark frame with a lit room behind it
    const dxr = x0 + Math.round(w * 0.30), dw = Math.round(w * 0.30);
    for (let y = yt + 6; y < g2.yb; y++) for (let x = dxr; x < dxr + dw; x++) put(x, y, '#3a2517');
    for (let y = yt + 9; y < g2.yb - 1; y++) for (let x = dxr + 2; x < dxr + dw - 2; x++) put(x, y, y < g2.yb - 8 ? '#ffcf8e' : '#f0a860');
    for (let y = yt + 12; y < g2.yb - 9; y++) for (let x = dxr + 4; x < dxr + dw - 4; x++) put(x, y, '#ffe3ae');
    // window, lit
    const wx = x0 + Math.round(w * 0.70);
    for (let y = yt + 10; y < yt + 24; y++) for (let x = wx; x < wx + 12; x++) put(x, y, '#ffd79a');
    for (let y = yt + 10; y < yt + 24; y++) { put(wx + 5, y, '#c98a44'); put(wx + 6, y, '#c98a44'); }
    for (let x = wx; x < wx + 12; x++) put(x, yt + 17, '#c98a44');
    // a beam end
    for (let x = x0 + 2; x < x0 + w - 2; x++) { put(x, yt + 4, '#6d4a28'); put(x, yt + 5, '#8a6034'); }
  });
}

function buildingSprite(wm, hm, cTop, cLeft, cRight, windows) {
  return boxSprite(wm, hm, 3.0, cTop, cLeft, cRight, (put, g) => {
    if (windows) {
      for (let y = g.yt + 12; y < g.yb - 10; y += 22) {
        for (let x = g.x0 + 8; x < g.x0 + g.w - 8; x += 20) {
          for (let k = 0; k < 8; k++) for (let j = 0; j < 6; j++) put(x + j, y + k, '#f0d8a8');
        }
      }
    }
  });
}

function columnSprite() {
  const w = 10, h = 62;
  return paintCanvas(w + 12, h + 14, put => {
    const x0 = 6, y0 = 8;
    // shaft
    for (let x = x0; x < x0 + w; x++) {
      for (let y = y0; y < y0 + h; y++) {
        const c = x < x0 + 2 ? '#f0e2c4' : (x > x0 + w - 4 ? '#bfae8c' : '#dcccb0');
        put(x, y, c);
      }
    }
    // flutes
    for (let x = x0 + 3; x < x0 + w - 3; x += 3) for (let y = y0 + 2; y < y0 + h - 2; y++) put(x, y, '#cbbb9c');
    // capital + base
    for (let x = x0 - 5; x < x0 + w + 5; x++) {
      for (let y = y0 - 6; y < y0; y++) put(x, y, y < y0 - 4 ? '#f6ecd6' : '#d6c6a6');
      for (let y = y0 + h; y < y0 + h + 6; y++) put(x, y, y < y0 + h + 4 ? '#e2d4b6' : '#b8a684');
    }
  });
}

function altarSprite() {
  return boxSprite(1.4, 0.9, 1.1, '#efe0c2', '#f6ecd6', '#cbb894', (put, g) => {
    for (let y = g.yt + 6; y < g.yb - 4; y += 8) for (let x = g.x0 + 3; x < g.x0 + g.w - 3; x += 10) put(x, y, '#b9a682');
  });
}

function crossSprite() {
  const w = 40, h = 78;
  return paintCanvas(w, h, put => {
    for (let y = 0; y < h; y++) for (let x = 18; x < 23; x++) put(x, y, x < 20 ? '#6b4a2e' : '#4a3220');
    for (let y = 18; y < 24; y++) for (let x = 3; x < 38; x++) put(x, y, y < 21 ? '#7d5a38' : '#503622');
  });
}

function scalesSprite() {
  const W = 92, H = 86;
  return paintCanvas(W, H, put => {
    const G='#e8c078', GL='#ffe6ae', GD='#b08a48', GK='#7a5c2e';
    // plinth
    for (let y = H - 8; y < H; y++) for (let x = 28; x < 64; x++) put(x, y, y < H - 3 ? G : GD);
    for (let y = H - 12; y < H - 8; y++) for (let x = 34; x < 58; x++) put(x, y, GL);
    // post
    for (let y = 16; y < H - 12; y++) for (let x = 44; x < 49; x++) put(x, y, x < 46 ? GL : G);
    // beam
    for (let x = 8; x < 85; x++) { put(x, 14, GL); put(x, 15, G); put(x, 16, GD); }
    for (let y = 8; y < 14; y++) for (let x = 43; x < 50; x++) put(x, y, y < 11 ? GL : G);
    // chains and pans
    for (const px of [16, 76]) {
      for (let y = 17; y < 40; y++) put(px, y, GK);
      for (let y = 17; y < 30; y++) { put(px - 3, y, GK); put(px + 3, y, GK); }
      for (let x = px - 13; x <= px + 13; x++) {
        const d = Math.abs(x - px);
        const yy = 40 + Math.round(d * d / 26);
        for (let y = yy; y < yy + 4; y++) put(x, y, y < yy + 2 ? GL : G);
      }
      for (let x = px - 13; x <= px + 13; x++) put(x, 44 + Math.round((x - px) * (x - px) / 26), GD);
    }
  });
}

function lampSprite() {
  return paintCanvas(12, 14, put => {
    for (let y = 8; y < 13; y++) for (let x = 3; x < 9; x++) put(x, y, y === 8 ? '#c87a3a' : '#8a4a22');
    for (let y = 3; y < 8; y++) put(6, y, '#ffd07a');
    put(5, 4, '#ffe8b0'); put(7, 4, '#ffe8b0'); put(6, 2, '#fff2cc');
  });
}

function canopy(put, cx, cy, rx, ry, lit, mid, dark, seed) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      const n = hs(x * 0.7 + seed, y * 0.7) * 0.28;
      if (d > 0.92 + n) continue;
      let col = mid;
      if (y < -ry * 0.15 && x < rx * 0.35) col = lit;
      else if (d > 0.55 || y > ry * 0.35) col = dark;
      if (hs(x + seed, y * 1.7) > 0.88) col = dark;
      put(cx + x, cy + y, col);
    }
  }
}
const hs = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };

function treeSprite(seed) {
  const W = 26, H = 30;
  return paintCanvas(W, H, put => {
    for (let y = H - 12; y < H; y++) for (let x = 12; x < 15; x++) put(x, y, '#7a5230');
    canopy(put, 13, 12, 11, 10, '#8fae62', '#5c8046', '#3a5730', seed);
  });
}

function tuftSprite(seed) {
  return paintCanvas(10, 7, put => {
    for (let i = 0; i < 6; i++) {
      const x = 1 + Math.floor(hash(seed + i) * 8), h = 2 + Math.floor(hash(seed + i * 3) * 4);
      for (let y = 0; y < h; y++) put(x, 6 - y, h > 3 ? '#9a8a5a' : '#7a6a44');
    }
  });
}

function rockSprite(seed) {
  const W = 26, H = 18;
  return paintCanvas(W, H, put => {
    const v = [[2, 16], [5, 9], [10, 4], [17, 3], [23, 7], [25, 16]];
    const inside = (x, y) => {
      let c = false;
      for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
        const [xi, yi] = v[i], [xj, yj] = v[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      put(x, y, y < 8 ? '#b09a78' : (x < 13 ? '#8a7658' : '#5f5038'));
    }
  });
}

// ---------------------------------------------------------------- camera
let CAM = { x: 0, y: 6.0, z: 8.0, f: 880, hy: 205 };
const P = (x, y, z) => {
  const dz = z - CAM.z;
  const s = CAM.f / Math.max(dz, 0.4);
  return { x: ART_W / 2 + (x - CAM.x) * s, y: CAM.hy + (CAM.y - y) * s, s, dz };
};
const fogOf = dz => clamp((dz - 9) / 52) * 0.72;
const lightOf = (x, z, pal, src) => {
  const d = Math.hypot(x - src.x, z - src.z);
  const k = clamp(1 - d / (src.r || 11));
  return clamp(0.06 + Math.pow(k, 0.85) * 0.94);
};

// ---------------------------------------------------------------- sprites registry
const SP = {};
const PEOPLE = {
  man:        { robe: '#b9986b', robeSh: '#8e7350', hair: '#3a2a1e' },
  cornelius:  { robe: '#9c4a3c', robeSh: '#7a352c', cloak: '#8c3a30', helmet: true, skin: '#b07a4e' },
  corneliusKneel: { robe: '#a85442', robeSh: '#7f3a2e', cloak: '#8c3a30', helmet: true, skin: '#b07a4e', pose: 'kneel' },
  roman:      { robe: '#a5503e', robeSh: '#7f3a2e', cloak: '#8f3a2e', helmet: true, skin: '#b07a4e' },
  servant:    { robe: '#7d8a92', robeSh: '#5e6a72', hair: '#2e2620', pose: 'walk' },
  peter:      { robe: '#cbb894', robeSh: '#a08e6c', beard: true, hair: '#6a5a48' },
  paul:       { robe: '#a8825c', robeSh: '#836444', beard: true, hair: '#3e3026', pose: 'walk' },
  worshipper: { robe: '#8f7f6a', robeSh: '#6e6152', pose: 'kneel', hair: '#2e2620' },
  worshipper2:{ robe: '#a89070', robeSh: '#867052', pose: 'kneel', hair: '#4a3a2a' },
  woman:      { robe: '#bd8f8a', robeSh: '#96706c', female: true, pose: 'kneel', hair: '#33261e' },
  abraham:    { robe: '#c6ac86', robeSh: '#9c8564', beard: true, hair: '#c8c0b0', pose: 'kneel' },
  traveler:   { robe: '#9a8464', robeSh: '#77644a', hood: '#4e4030', cloak: '#6a563e', pose: 'walk' },
  angel:      { robe: '#fbf3dc', robeSh: '#dccfae', wings: true, hair: '#e6cf90', skin: '#f4e6cc', pose: 'stand' },
};
const initSprites = () => {
  for (const k of Object.keys(PEOPLE)) SP[k] = personSprite(PEOPLE[k]);
  SP.huts = [hutSprite(), hutSprite()];
  SP.buildings = [
    buildingSprite(4.2, 5.6, '#b9986b', '#dcc39a', '#9a7c58', true),
    buildingSprite(3.4, 4.6, '#a98a66', '#cfb28c', '#8c7050', true),
    buildingSprite(1.6, 1.9, '#b09a78', '#d2bc98', '#8e7a58', false),
  ];
  SP.column = columnSprite();
  SP.lintel = boxSprite(8.6, 0.9, 0.8, '#e6d6b8', '#f2e6cf', '#c9b696');
  SP.step = boxSprite(9.2, 0.30, 1.4, '#dcccb0', '#eddcc0', '#c0ae8e');
  SP.altar = altarSprite();
  SP.cross = crossSprite();
  SP.scales = scalesSprite();
  SP.lamp = lampSprite();
  SP.trees = [treeSprite(1), treeSprite(7)];
  SP.rocks = [rockSprite(1), rockSprite(7), rockSprite(13)];
  SP.tufts = [tuftSprite(3), tuftSprite(8), tuftSprite(11)];
};

// ---------------------------------------------------------------- drawing helpers
function drawSprite(sprite, wx, wy, wz, heightM, pal, opts = {}) {
  const p = P(wx, wy, wz);
  if (p.dz <= 0.8) return;
  const scale = (heightM * p.s) / sprite.height;
  const w = sprite.width * scale, h = sprite.height * scale;
  const fog = fogOf(p.dz);
  const light = clamp(opts.light ?? lightOf(wx, wz, pal, LIGHT_SRC));
  const img = variant({ c: sprite, key: spriteKey(sprite) }, fog, light, pal.ink, pal.fog, pal.warm);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - h), Math.round(w), Math.round(h));
  // contact shadow, thrown away from the lantern
  if (opts.shadow !== false) {
    const shW = w * 0.46, shH = Math.max(1.2, h * 0.055);
    const dx = LIGHT_SRC ? (wx - LIGHT_SRC.x) * 0.06 * p.s : 0;
    const alpha = 0.32 * (1 - fog * 0.6);
    g.fillStyle = `rgba(6,9,16,${alpha})`;
    g.beginPath();
    g.ellipse(p.x + dx, p.y + 1, shW * 0.5, shH, 0, 0, Math.PI * 2);
    g.fill();
  }
}
const spriteKey = c => c.__k || (c.__k = 's' + Math.random().toString(36).slice(2));

let LIGHT_SRC = { x: -2.6, z: 22, r: 12 };

function glow(x, y, radius, color, alpha) {
  const gr = g.createRadialGradient(x, y, 0, x, y, radius);
  gr.addColorStop(0, color.replace(')', `,${alpha})`).replace('rgb', 'rgba'));
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, radius, 0, Math.PI * 2); g.fill();
}

function bayerFill(x0, y0, w, h, colA, colB, threshold, size = 2) {
  g.fillStyle = colA;
  g.fillRect(x0, y0, w, h);
  g.fillStyle = colB;
  const B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const m = B[((y / size) | 0) % 4][((x / size) | 0) % 4] / 16;
      if (m < threshold) g.fillRect(x0 + x, y0 + y, size, size);
    }
  }
}

// ---------------------------------------------------------------- the set
// ---------------------------------------------------------------- the kit
function sky(pal, t, opts = {}) {
  const grad = g.createLinearGradient(0, 0, 0, ART_H);
  grad.addColorStop(0, pal.skyTop); grad.addColorStop(0.55, pal.skyMid); grad.addColorStop(1, pal.skyLow);
  g.fillStyle = grad; g.fillRect(0, 0, ART_W, ART_H);
  if ((pal._night ?? 0) > 0.05) {
    for (let i = 0; i < 70; i++) {
      const x = hash(i * 2.3) * ART_W, y = hash(i * 5.9) * ART_H * 0.5;
      g.fillStyle = `rgba(226,236,255,${(0.25 + 0.5 * hash(i * 7.1)) * pal._night})`;
      g.fillRect(x | 0, y | 0, 1, 1);
    }
  }
  if (opts.moon) {
    const mx = ART_W * 0.72, my = ART_H * 0.17;
    glow(mx, my, 46, 'rgb(220,235,255)', 0.35 * (pal._night ?? 0));
    g.fillStyle = pal.moon; g.beginPath(); g.arc(mx, my, 9, 0, 7); g.fill();
  }
  if (opts.sun) {
    const sx = ART_W * 0.5, sy = ART_H * 0.30;
    glow(sx, sy, 130, 'rgb(255,240,200)', 0.22);
  }
}

function floorPlane(pal, t, spec = {}) {
  const top = spec.top ?? ART_H * 0.42;
  const grad = g.createLinearGradient(0, top, 0, ART_H);
  grad.addColorStop(0, mix(pal.ground, pal.fog, 0.6));
  grad.addColorStop(0.4, mix(pal.ground, pal.fog, 0.18));
  grad.addColorStop(1, mix(pal.ground, pal.ink, 0.22));
  g.fillStyle = grad; g.fillRect(0, top, ART_W, ART_H - top);
  // tile seams, faint, receding
  g.strokeStyle = 'rgba(0,0,0,0.05)'; g.lineWidth = 1;
  for (let z = 6; z < 40; z += 4) {
    const p = P(0, 0, z);
    g.beginPath(); g.moveTo(0, p.y); g.lineTo(ART_W, p.y); g.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const x = -14 + hash(i * 1.7) * 28, z = 8 + hash(i * 4.3) * 26;
    const p = P(x, 0, z);
    if (p.dz <= 1) continue;
    g.fillStyle = hash(i * 9.1) > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    g.fillRect(p.x, p.y, Math.max(1, p.s * 0.05), Math.max(1, p.s * 0.03));
  }
}

/** A beam of light: the story's signature effect. */
function shaft(x, topY, botY, halfTop, halfBot, color, alpha, t) {
  const grad = g.createLinearGradient(0, topY, 0, botY);
  grad.addColorStop(0, color.replace('ALPHA', (alpha * 0.15).toFixed(3)));
  grad.addColorStop(0.45, color.replace('ALPHA', (alpha * 0.9).toFixed(3)));
  grad.addColorStop(1, color.replace('ALPHA', (alpha * 0.35).toFixed(3)));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x - halfTop, topY); g.lineTo(x + halfTop, topY);
  g.lineTo(x + halfBot, botY); g.lineTo(x - halfBot, botY);
  g.closePath(); g.fill();
  // dust in the beam
  for (let i = 0; i < 40; i++) {
    const ph = hash(i * 3.3);
    const yy = topY + ((ph * (botY - topY) + t * (8 + ph * 10)) % (botY - topY));
    const k = (yy - topY) / (botY - topY);
    const xx = x + (hash(i * 7.7) - 0.5) * 2 * lerp(halfTop, halfBot, k);
    g.fillStyle = `rgba(255,240,200,${0.10 + 0.16 * hash(i * 1.9)})`;
    g.fillRect(xx | 0, yy | 0, 1, 1);
  }
}

function sparkles(cx, cy, r, n, t, color = 'rgba(255,246,214,') {
  for (let i = 0; i < n; i++) {
    const a = hash(i * 2.7) * Math.PI * 2;
    const rr = (0.3 + hash(i * 5.1)) * r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.6;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.2 + i));
    g.fillStyle = color + (0.35 * tw).toFixed(3) + ')';
    g.fillRect(x | 0, y | 0, tw > 0.7 ? 2 : 1, tw > 0.7 ? 2 : 1);
  }
}

function pool(x, y, rx, ry, color, alpha) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, color.replace('ALPHA', alpha.toFixed(3)));
  grad.addColorStop(1, color.replace('ALPHA', '0'));
  g.fillStyle = grad; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill();
  g.restore();
}

/** The raking light that crosses the floor in every wide shot. */
function floorBeam(xTop, wTop, xBot, wBot, color, alpha) {
  const y0 = ART_H * 0.42, y1 = ART_H;
  const grad = g.createLinearGradient(0, y0, 0, y1);
  grad.addColorStop(0, color.replace('ALPHA', (alpha * 0.25).toFixed(3)));
  grad.addColorStop(0.55, color.replace('ALPHA', (alpha * 0.75).toFixed(3)));
  grad.addColorStop(1, color.replace('ALPHA', '0'));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(ART_W * xTop, y0); g.lineTo(ART_W * (xTop + wTop), y0);
  g.lineTo(ART_W * (xBot + wBot), y1); g.lineTo(ART_W * xBot, y1);
  g.closePath(); g.fill();
}

function motes(t, n = 42, alpha = 0.5) {
  for (let i = 0; i < n; i++) {
    const sp = 0.4 + hash(i * 2.1) * 0.9;
    const x = (hash(i * 3.7) * ART_W + Math.sin(t * 0.5 + i) * 9) % ART_W;
    const y = (hash(i * 5.3) * ART_H + t * 6 * sp) % ART_H;
    const a = (0.25 + 0.55 * hash(i * 9.1)) * alpha * (0.6 + 0.4 * Math.sin(t * 2 + i));
    g.fillStyle = `rgba(255,238,204,${clamp(a).toFixed(3)})`;
    g.fillRect(x | 0, y | 0, 1, 1);
  }
}

/** A far town on the horizon: solid silhouette, no tricks. */
function horizonBand(pal, y, h = 30) {
  const gr = g.createLinearGradient(0, y - h * 0.7, 0, y + h * 0.9);
  gr.addColorStop(0, 'rgba(28,14,8,0)');
  gr.addColorStop(0.42, 'rgba(28,14,8,0.20)');
  gr.addColorStop(1, 'rgba(28,14,8,0)');
  g.fillStyle = gr;
  g.fillRect(0, y - h * 0.7, ART_W, h * 1.6);
  g.fillStyle = 'rgba(255,226,178,0.10)';
  g.fillRect(0, y - h * 0.42, ART_W, 1);
}

function townGround(pal, cx, baseY, w) {
  const gr = g.createLinearGradient(0, baseY - 6, 0, baseY + 20);
  gr.addColorStop(0, 'rgba(30,16,10,0)');
  gr.addColorStop(0.45, 'rgba(30,16,10,0.22)');
  gr.addColorStop(1, 'rgba(30,16,10,0)');
  g.fillStyle = gr;
  g.fillRect(cx - w / 2 - 10, baseY - 6, w + 20, 26);
}

function citySilhouette(pal, cx, baseY, w, h, n, seed = 0) {
  const dark = mix(pal.ground, pal.ink, 0.34);
  const roof = mix(pal.ink, pal.warmDeep, 0.16);
  for (let i = 0; i < n; i++) {
    const bw = w / n * (0.95 + hash(seed + i * 3.1) * 0.7);
    const bh = h * (0.45 + hash(seed + i * 7.7) * 0.9);
    const bx = cx - w / 2 + (i + 0.5) * (w / n) - bw / 2;
    const by = baseY - bh;
    g.fillStyle = dark;
    g.fillRect(bx | 0, by | 0, Math.max(2, bw) | 0, bh | 0);
    g.fillStyle = mix(dark, '#000', 0.18);
    g.fillRect((bx + bw * 0.62) | 0, by | 0, Math.max(1, bw * 0.38) | 0, bh | 0);
    g.fillStyle = roof;
    g.fillRect((bx - 1) | 0, by | 0, Math.max(3, bw + 2) | 0, 2);
    // one lamp in a window
    if (hash(seed + i * 11) > 0.45) {
      g.fillStyle = 'rgba(255,206,140,0.85)';
      g.fillRect((bx + bw * 0.3) | 0, (by + bh * 0.55) | 0, 1, 1);
    }
  }
  g.fillStyle = mix(pal.fog, pal.ground, 0.4);
  g.fillRect((cx - w / 2 - 6) | 0, baseY | 0, (w + 12) | 0, 2);
}

// ---------------------------------------------------------------- sets
function setVillage(t, pal, opts = {}) {
  sky(pal, t, { moon: true });
  floorPlane(pal, t, { top: ART_H * 0.40 });
  floorBeam(0.10, 0.30, 0.02, 0.72, 'rgba(255,214,158,ALPHA)', 0.20);
  const HZ = 31;
  drawSprite(SP.huts[1], 5.6, 0, HZ + 6, 2.9, pal, { light: 0.22 });
  drawSprite(SP.huts[0], -6.4, 0, HZ + 7, 2.7, pal, { light: 0.18 });
  drawSprite(SP.huts[0], -1.1, 0, HZ, 3.1, pal, { light: 0.95 });
  const door = P(-1.1, 0.1, HZ - 1.3);
  pool(door.x, door.y, 5.4 * door.s, 1.9 * door.s, 'rgba(255,196,110,ALPHA)', 0.26);
  glow(door.x, door.y - 1.5 * door.s, 40, 'rgb(255,186,110)', 0.26);
  drawSprite(SP.trees[0], -8.4, 0, HZ + 9, 2.5, pal, { light: 0.2 });
  drawSprite(SP.trees[1], 8.2, 0, HZ + 4, 2.1, pal, { light: 0.2 });
  for (let i = 0; i < 4; i++) drawSprite(SP.rocks[i % 3], -9 + hash(i) * 18, 0, 24 + i * 2, 0.45, pal, { light: 0.3 });
  if (opts.man !== false) drawSprite(SP.man, -2.6, 0, HZ - 3.6, 1.74, pal, { light: 0.95 });
  motes(t, 30, 0.5);
}

function setGoldenRoom(t, pal, opts = {}) {
  sky(pal, t);
  // back wall, its cornice, and the shadow it throws
  const wallTop = 0;
  g.fillStyle = mix(pal.ground, pal.fog, 0.5);
  g.fillRect(0, wallTop, ART_W, ART_H * 0.46);
  grad_wall(pal, wallTop);
  const cornY = ART_H * 0.155;
  g.fillStyle = mix(pal.ground, pal.ink, 0.28); g.fillRect(0, cornY, ART_W, 5);
  g.fillStyle = mix(pal.ground, pal.fog, 0.75); g.fillRect(0, cornY + 5, ART_W, 2);
  g.fillStyle = 'rgba(30,16,8,0.18)'; g.fillRect(0, cornY + 7, ART_W, 10);
  // pilasters, receding
  for (let i = 0; i < 2; i++) {
    const px = i === 0 ? ART_W * 0.10 : ART_W * 0.86;
    g.fillStyle = mix(pal.ground, pal.fog, 0.7); g.fillRect(px, cornY + 6, 16, ART_H * 0.46 - cornY);
    g.fillStyle = 'rgba(30,16,8,0.16)'; g.fillRect(px + 12, cornY + 6, 6, ART_H * 0.46 - cornY);
    g.fillStyle = mix(pal.ground, pal.fog, 0.85); g.fillRect(px - 3, cornY + 2, 22, 4);
  }
  floorPlane(pal, t, { top: ART_H * 0.44 });
  floorBeam(0.12, 0.26, 0.04, 0.70, 'rgba(255,226,176,ALPHA)', 0.20);
  const sx = ART_W * (opts.beamX ?? 0.46);
  shaft(sx, -10, ART_H * 0.88, 8, 40, 'rgba(255,240,196,ALPHA)', 0.26, t);
  pool(sx, ART_H * 0.86, 54, 20, 'rgba(255,232,170,ALPHA)', 0.30);
  if (opts.sparkle) sparkles(sx, ART_H * 0.66, 40, 26, t);
  if (opts.extra) opts.extra(t, pal, sx);
  motes(t, 36, 0.55);
}

function grad_wall(pal, top) {
  const gr = g.createLinearGradient(0, top, 0, ART_H * 0.46);
  gr.addColorStop(0, 'rgba(40,22,12,0.35)');
  gr.addColorStop(1, 'rgba(40,22,12,0)');
  g.fillStyle = gr; g.fillRect(0, top, ART_W, ART_H * 0.40);
}

function setStreet(t, pal, opts = {}) {
  sky(pal, t);
  floorPlane(pal, t, { top: ART_H * 0.42 });
  // far end of the street
  for (let i = 0; i < 4; i++) {
    drawSprite(SP.buildings[2], -9 + i * 6, 0, 46, 2.4 + (i % 2) * 0.6, pal, { light: 0.3 });
  }
  // the two walls that make it a street
  drawSprite(SP.buildings[0], -6.0, 0, 29, 7.4, pal, { light: 0.45 });
  drawSprite(SP.buildings[1], 6.2, 0, 31, 7.8, pal, { light: 0.55 });
  drawSprite(SP.buildings[1], -8.4, 0, 36, 6.0, pal, { light: 0.3 });
  drawSprite(SP.buildings[0], 8.6, 0, 38, 6.4, pal, { light: 0.35 });
  // the road
  const road = g.createLinearGradient(0, ART_H * 0.52, 0, ART_H);
  road.addColorStop(0, 'rgba(245,220,178,0.12)');
  road.addColorStop(1, 'rgba(232,198,150,0.26)');
  g.fillStyle = road;
  g.beginPath();
  g.moveTo(ART_W * 0.36, ART_H * 0.52); g.lineTo(ART_W * 0.64, ART_H * 0.52);
  g.lineTo(ART_W * 0.90, ART_H); g.lineTo(ART_W * 0.10, ART_H);
  g.closePath(); g.fill();
  drawSprite(SP.column, -3.4, 0, 26, 4.6, pal, { light: 0.5 });
  drawSprite(SP.column, 3.6, 0, 28, 4.6, pal, { light: 0.45 });
  floorBeam(0.16, 0.24, 0.06, 0.66, 'rgba(255,226,170,ALPHA)', 0.16);
  motes(t, 30, 0.4);
  if (opts.people !== false) {
    drawSprite(SP.roman, 1.0, 0, 21.4, 1.74, pal, { light: 0.7 });
    drawSprite(SP.servant, 2.8, 0, 22.3, 1.66, pal, { light: 0.6 });
  }
  if (opts.meet) {
    drawSprite(SP.peter, 0.7, 0, 21.5, 1.76, pal, { light: 0.85 });
    drawSprite(SP.roman, 3.0, 0, 21.9, 1.76, pal, { light: 0.85 });
  }
}

function setAthens(t, pal, opts = {}) {
  sky(pal, t);
  floorPlane(pal, t, { top: ART_H * 0.42 });
  // stylobate: two steps
  for (let i = 0; i < 2; i++) {
    drawSprite(SP.step, 0, 0, 30 - i * 2, 0.30, pal, { light: 0.5 - i * 0.08 });
  }
  for (let i = 0; i < 4; i++) {
    const x = -5.4 + i * 3.6;
    drawSprite(SP.column, x, 0, 27, 4.4, pal, { light: 0.55 });
  }
  drawSprite(SP.lintel, 0.4, 4.3, 27, 0.62, pal, { light: 0.45 });
  drawSprite(SP.altar, 0.5, 0, 20.5, 1.15, pal, { light: 0.8 });
  const ap = P(0.5, 0.1, 20.5);
  pool(ap.x, ap.y, 28, 9, 'rgba(255,236,180,ALPHA)', 0.22);
  if (opts.worshippers !== false) {
    drawSprite(SP.worshipper, -1.9, 0, 21.4, 1.56, pal, { light: 0.75 });
    drawSprite(SP.worshipper2, 2.4, 0, 22.0, 1.56, pal, { light: 0.65 });
    drawSprite(SP.woman, 3.9, 0, 23.0, 1.56, pal, { light: 0.55 });
  }
  if (opts.paul) drawSprite(SP.paul, -4.2, 0, 19.6, 1.74, pal, { light: 0.8 });
  floorBeam(0.14, 0.26, 0.04, 0.68, 'rgba(255,226,170,ALPHA)', 0.12);
  motes(t, 28, 0.4);
}

function setDesert(t, pal, opts = {}) {
  sky(pal, t, { sun: true });
  floorPlane(pal, t, { top: ART_H * 0.38 });
  drawSprite(SP.cross, 0.2, 0, 22, 3.4, pal, { light: 0.8 });
  for (let i = 0; i < 5; i++) drawSprite(SP.rocks[i % 3], -10 + i * 5.2, 0, 16 + i * 2, 0.45, pal);
  if (opts.groups) {
    for (let i = 0; i < 3; i++) {
      drawSprite(i === 1 ? SP.woman : SP.worshipper, -4.4 + i * 0.9, 0, 19.2 + i * 0.6, 1.6, pal, { light: 0.55 });
      drawSprite(i === 1 ? SP.woman : SP.servant, 4.0 - i * 0.9, 0, 19.8 + i * 0.6, 1.6, pal, { light: 0.5 });
    }
  }
  motes(t, 26, 0.35);
  if (opts.beam) {
    const p = P(0.2, 0, 22);
    shaft(p.x, ART_H * 0.06, p.y, 8, 34, 'rgba(255,244,206,ALPHA)', 0.45, t);
    sparkles(p.x, p.y - 40, 40, 20, t);
  }
}

function setScales(t, pal, opts = {}) {
  sky(pal, t);
  g.fillStyle = mix(pal.ground, pal.ink, 0.34);
  g.fillRect(0, 0, ART_W, ART_H * 0.40);
  const cor = ART_H * 0.40;
  g.fillStyle = mix(pal.ground, pal.fog, 0.55); g.fillRect(0, cor - 4, ART_W, 4);
  g.fillStyle = 'rgba(20,8,6,0.22)'; g.fillRect(0, cor, ART_W, 12);
  floorPlane(pal, t, { top: cor });
  floorBeam(0.14, 0.30, 0.04, 0.78, 'rgba(255,216,160,ALPHA)', 0.16);
  const p = P(0.2, 1.25, 20);
  drawSprite(SP.scales, 0.2, 1.2, 20, 2.7, pal, { light: 0.95, shadow: false });
  pool(p.x, p.y + 46, 66, 20, 'rgba(255,214,150,ALPHA)', 0.22);
  // a hanging lamp, so the room has a source
  const lampX = ART_W * 0.80, lampY = ART_H * 0.20;
  g.fillStyle = 'rgba(30,14,8,0.5)'; g.fillRect(lampX, 0, 1, lampY - 6);
  g.fillStyle = '#c98a44'; g.fillRect(lampX - 5, lampY - 6, 11, 8);
  g.fillStyle = '#ffe3ac'; g.fillRect(lampX - 4, lampY + 2, 9, 3);
  glow(lampX, lampY, 70, 'rgb(255,206,140)', 0.35);
  if (opts.shelf) drawSprite(SP.altar, 5.4, 0, 24, 0.9, pal, { light: 0.4 });
  motes(t, 26, 0.4);
}

function setRoad(t, pal, opts = {}) {
  sky(pal, t);
  floorPlane(pal, t, { top: ART_H * 0.44 });
  drawSprite(SP.huts[1], 8.5, 0, 30, 2.6, pal, { light: 0.25 });
  drawSprite(SP.trees[0], -7.5, 0, 24, 2.4, pal, { light: 0.3 });
  for (let i = 0; i < 5; i++) drawSprite(SP.rocks[i % 3], -8 + i * 4.2, 0, 14 + i * 2.5, 0.4, pal);
  floorBeam(0.22, 0.26, 0.10, 0.72, 'rgba(190,208,238,ALPHA)', 0.08);
  for (let i = 0; i < 6; i++) drawSprite(SP.tufts[i % 3], -6 + i * 2.6, 0, 13 + i * 0.8, 0.42, pal, { shadow: false });
  drawSprite(SP.traveler, 0.4, 0, 19, 1.76, pal, { light: 0.55 });
  motes(t, 26, 0.35);
}

function setHandoff(t, pal) {
  sky(pal, t, { moon: true });
  floorPlane(pal, t, { top: ART_H * 0.46 });
  floorBeam(0.10, 0.24, 0.00, 0.66, 'rgba(255,214,158,ALPHA)', 0.10);
  drawSprite(SP.huts[0], 3.0, 0, 26, 3.0, pal, { light: 0.6 });
  const door = P(3.0, 0.1, 24.7);
  pool(door.x, door.y, 5.0 * door.s, 1.6 * door.s, 'rgba(255,196,110,ALPHA)', 0.24);
  drawSprite(SP.man, -0.9, 0, 19.7, 1.76, pal, { light: 0.65 });
  drawSprite(SP.worshipper, 2.1, 0, 20.0, 1.72, pal, { light: 0.8 });
  const lp = P(0.6, 1.02, 19.8);
  drawSprite(SP.lamp, 0.6, 0.94, 19.8, 0.30, pal, { light: 1.0, shadow: false });
  glow(lp.x, lp.y, 26, 'rgb(255,206,130)', 0.5);
  glow(lp.x, lp.y, 78, 'rgb(255,180,110)', 0.28);
  glow(lp.x, lp.y, 190, 'rgb(255,170,100)', 0.10);
  pool(lp.x, lp.y + 16, 32, 11, 'rgba(255,200,130,ALPHA)', 0.28);
  for (let i = 0; i < 4; i++) drawSprite(SP.rocks[i % 3], -7 + i * 3.2, 0, 14 + i, 0.4, pal, { light: 0.3 });
  motes(t, 26, 0.4);
}

// ---------------------------------------------------------------- shots
const DEF_CAM = { x: 0, y: 6.0, z: 8.0, f: 880, hy: 205 };
/** Frame by intent: how tall the subject reads, and where its feet land. */
function camFor(o = {}) {
  const hy = o.hy ?? 205, f = o.f ?? 880;
  const subjZ = o.z ?? 22, hM = o.h ?? 1.75;
  const s = ((o.size ?? 0.20) * ART_H) / hM;
  const dz = f / s;
  const feetY = (o.feet ?? 0.80) * ART_H;
  return { x: o.x ?? 0, y: (feetY - hy) / s, z: subjZ - dz, f, hy };
}
const SHOTS = [
  { // 01 · 0:00 — the village at night, one hut lit, one man in the light
    t0: 0, t1: 10, pal: 'NIGHTV', cam: camFor({ x: -0.4, z: 27.4, size: 0.13, feet: 0.80 }),
    focus: 0.58, blur: 5.5, light: { x: -0.4, z: 16, r: 9 },
    draw(t, pal) { setVillage(t, pal, { light: 0.55 }); },
  },
  { // 02 · 0:10 — the questions people actually leave in the comments
    t0: 10, t1: 15, pal: 'NIGHTV', cam: camFor({ x: 0.2, z: 27.4, size: 0.13, feet: 0.84 }),
    focus: 0.54, blur: 5, light: { x: -0.4, z: 16, r: 8 },
    section: { text: 'HONEST QUESTIONS', in: 10.1, out: 14.9 },
    bubbles: true,
    draw(t, pal) { setVillage(t, pal, { light: 0.4 }); },
  },
  { // 03 · 0:15 — Caesarea: a Roman and his servant on the street
    t0: 15, t1: 25, pal: 'GOLD', cam: camFor({ x: 0.8, z: 21.5, size: 0.155 }),
    focus: 0.60, blur: 5, light: { x: 0.6, z: 21, r: 13 },
    draw(t, pal) { setStreet(t, pal); },
  },
  { // 04 · 0:25 — Cornelius on his knees, columns behind
    t0: 25, t1: 30, pal: 'GOLD', cam: camFor({ x: 0.1, z: 18.6, size: 0.26, feet: 0.82, f: 980 }),
    focus: 0.62, blur: 5.5, light: { x: 0.1, z: 17, r: 8 },
    draw(t, pal) {
      setGoldenRoom(t, pal, {
        beamX: 0.44,
        extra(t2, p2, sx) {
          drawSprite(SP.column, -1.9, 0, 21.5, 4.6, p2, { light: 0.5 });
          drawSprite(SP.column, 2.3, 0, 22.4, 4.6, p2, { light: 0.4 });
          drawSprite(SP.corneliusKneel, 0.35, 0, 18.6, 1.34, p2, { light: 0.95 });
        },
      });
    },
  },
  { // 05 · 0:30 — the angel in the shaft of light
    t0: 30, t1: 35, pal: 'GOLD', cam: camFor({ x: 0.2, z: 19.0, size: 0.30, feet: 0.84, f: 980 }),
    focus: 0.55, blur: 6, light: { x: 0.2, z: 16, r: 9 },
    draw(t, pal) {
      setGoldenRoom(t, pal, {
        beamX: 0.5, sparkle: true,
        extra(t2, p2, sx) {
          drawSprite(SP.angel, 0.1, 1.1, 19.2, 2.5, p2, { light: 1.0, shadow: false });
          glow(P(0.1, 3.2, 19.2).x, P(0.1, 3.2, 19.2).y, 54, 'rgb(255,240,200)', 0.42);
          glow(sx, P(0.1, 1.9, 19.0).y, 60, 'rgb(255,238,190)', 0.5);
          drawSprite(SP.corneliusKneel, -0.5, 0, 18.6, 1.34, p2, { light: 0.9 });
          drawSprite(SP.servant, 1.9, 0, 19.4, 1.58, p2, { light: 0.7 });
          sparkles(sx, ART_H * 0.62, 80, 40, t2 * 1.4);
        },
      });
    },
  },
  { // 06 · 0:35 — Peter and Cornelius, face to face
    t0: 35, t1: 40, pal: 'GOLD', cam: camFor({ x: 1.4, z: 21.7, size: 0.16 }),
    focus: 0.60, blur: 5.5, light: { x: 1.4, z: 20, r: 10 },
    draw(t, pal) { setStreet(t, pal, { meet: true }); },
  },
  { // 07 · 0:40 — the key verse on a cream card, the scene ghosted behind
    t0: 40, t1: 50, pal: 'GOLD', cam: camFor({ x: 1.4, z: 21.7, size: 0.16 }),
    focus: 0.62, blur: 6.5, light: { x: 1.4, z: 20, r: 10 },
    draw(t, pal) { setStreet(t, pal, { meet: true }); },
    quote: {
      in: 40.7, out: 49.4, size: 37, source: 'ACTS 10:34–35 · KJV',
      text: 'God is no *respecter* of persons: but in every nation he that *feareth* him, and worketh righteousness, is *accepted* with him.',
    },
  },
  { // 08 · 0:50 — the beam finds the hut: answer one
    t0: 50, t1: 55, pal: 'NIGHTV', cam: camFor({ x: -0.2, z: 29, size: 0.14, feet: 0.86 }),
    focus: 0.60, blur: 5.5, light: { x: -0.5, z: 17, r: 8 },
    badge: { n: '1', text: 'GOD SEES THE SEEKER', in: 50.5, out: 54.9 },
    draw(t, pal) {
      setVillage(t, pal, { light: 0.7, man: false });
      const h = P(-0.4, 2.2, 20);
      shaft(h.x, ART_H * 0.12, h.y, 6, 26, 'rgba(210,226,255,ALPHA)', 0.30, t);
      sparkles(h.x, h.y, 50, 18, t, 'rgba(220,232,255,');
    },
  },
  { // 09 · 0:55 — sepia village, Romans 1 beginning to type
    t0: 55, t1: 65, pal: 'DUSKPLAIN', cam: camFor({ x: -0.6, z: 27.4, size: 0.13, feet: 0.82 }),
    focus: 0.58, blur: 6, light: { x: -0.4, z: 17, r: 8 },
    badge: { n: '2', text: 'NO ONE HAS ZERO LIGHT', in: 55.4, out: 59.6 },
    quote: {
      in: 59.8, out: 64.7, size: 30, type: 3.4, source: 'ROMANS 1:20 · KJV',
      text: 'For the invisible things of him from the creation of the world are clearly *seen*, being understood by the things that are made.',
    },
    draw(t, pal) { setVillage(t, pal, { light: 0.45, man: true }); },
  },
  { // 10 · 1:05 — Athens, and Paul walking in
    t0: 65, t1: 70, pal: 'GOLD', cam: camFor({ x: 0.6, z: 20, size: 0.145 }),
    focus: 0.60, blur: 5, light: { x: 0.4, z: 20, r: 12 },
    section: { text: 'NEVER HEARD', in: 65.1, out: 69.9 },
    draw(t, pal) { setAthens(t, pal, { paul: true }); },
  },
  { // 11 · 1:10 — the altar, and its inscription
    t0: 70, t1: 75, pal: 'GOLD', cam: camFor({ x: 0.4, z: 19.5, size: 0.17, f: 980 }),
    focus: 0.62, blur: 6, light: { x: 0.4, z: 18, r: 7 },
    draw(t, pal) { setAthens(t, pal, { paul: false }); },
    labels: [{ text: 'TO THE UNKNOWN GOD', x: 0.5, y: 0.50, in: 70.5, out: 74.9 }],
  },
  { // 12 · 1:15 — the scales
    t0: 75, t1: 85, pal: 'RUST', cam: camFor({ x: 0.2, z: 20, size: 0.24, f: 980 }),
    focus: 0.58, blur: 5.5, light: { x: 0.2, z: 16, r: 11 },
    badge: { n: '3', text: 'GOD JUDGES FAIRLY', in: 75.4, out: 79.5 },
    quote: {
      in: 79.9, out: 84.7, size: 35, source: 'LUKE 12:48 · KJV',
      text: 'For unto whomsoever much is given, of him shall be *much required*.',
    },
    draw(t, pal) { setScales(t, pal, { shelf: true }); },
  },
  { // 13 · 1:25 — Abraham, pleading
    t0: 85, t1: 95, pal: 'RUST', cam: camFor({ x: -0.2, z: 18, size: 0.22 }),
    focus: 0.58, blur: 6, light: { x: 0.0, z: 17, r: 9 },
    draw(t, pal) {
      setGoldenRoom(t, pal, {
        beamX: 0.46,
        extra(t2, p2, sx) {
          drawSprite(SP.abraham, -0.2, 0, 18.0, 1.7, p2, { light: 0.9 });
          const tb = P(3.0, 0, 26.5);
          horizonBand(p2, tb.y - 6, 34);
          townGround(p2, tb.x, tb.y, 190);
          for (let i = 0; i < 6; i++) {
            drawSprite(SP.huts[i % 2], 2.0 + (i % 3) * 1.8, 0, 25.5 + (i % 2) * 2.2, 1.05 + (i % 2) * 0.16, p2, { light: 0.30 });
          }
          drawSprite(SP.tufts[0], -3.2, 0, 15.5, 0.4, p2, { shadow: false });
        },
      });
    },
  },
  { // 14 · 1:35 — ten points of light over the city
    t0: 95, t1: 105, pal: 'RUST', cam: camFor({ x: 0.0, z: 17.4, size: 0.17 }),
    focus: 0.55, blur: 6.5, light: { x: 0.0, z: 17, r: 9 },
    labels: [{ text: 'TEN RIGHTEOUS — GENESIS 18:32', x: 0.5, y: 0.815, in: 97.4, out: 104.8 }],
    draw(t, pal) {
      setGoldenRoom(t, pal, {
        beamX: 0.30,
        extra(t2, p2) {
          const tb = P(0.2, 0, 27);
          horizonBand(p2, tb.y - 6, 38);
          townGround(p2, tb.x, tb.y, 230);
          for (let i = 0; i < 7; i++) {
            const hx = -3.6 + (i % 4) * 2.2 + Math.floor(i / 4) * 1.2;
            const hz = 26 + (i % 3) * 2.0;
            drawSprite(SP.huts[i % 2], hx, 0, hz, 1.05 + (i % 3) * 0.13, p2, { light: 0.32 });
          }
          drawSprite(SP.abraham, -1.6, 0, 17.4, 1.7, p2, { light: 0.85 });
          // ten lights, rising one by one
          for (let i = 0; i < 10; i++) {
            const k = smooth(seg(t2, 96.0 + i * 0.42, 96.7 + i * 0.42));
            if (k <= 0) continue;
            const bx = ART_W * 0.58 + ((i % 5) - 2) * 22 + Math.floor(i / 5) * 9;
            const by = ART_H * 0.375 + Math.floor(i / 5) * 20 + Math.sin(t2 * 1.6 + i) * 2 - (1 - k) * 12;
            g.fillStyle = 'rgba(255,238,186,1)';
            g.fillRect((bx - 1) | 0, (by - 1) | 0, 3, 3);
            glow(bx, by, 22 * k, 'rgb(255,214,140)', 0.7 * k);
            glow(bx, by, 52 * k, 'rgb(255,190,120)', 0.22 * k);
          }
        },
      });
    },
  },
  { // 15 · 1:45 — the plain, the cross, the two readings
    t0: 105, t1: 110, pal: 'DUSKPLAIN', cam: camFor({ x: 0.4, z: 22, size: 0.20, feet: 0.80, h: 3.4 }),
    focus: 0.52, blur: 5, light: { x: 0.2, z: 22, r: 16 },
    labels: [
      { text: 'HEAR AND TRUST IN THIS LIFE', x: 0.5, y: 0.325, in: 105.9, out: 109.9 },
      { text: 'CHRIST MAY SAVE THE UNREACHED', x: 0.5, y: 0.395, in: 106.6, out: 109.9 },
    ],
    draw(t, pal) { setDesert(t, pal, { groups: true }); },
  },
  { // 16 · 1:50 — the light lands on the cross
    t0: 110, t1: 120, pal: 'DUSKPLAIN', cam: camFor({ x: 0.2, z: 22, size: 0.30, feet: 0.88, h: 3.4 }),
    focus: 0.54, blur: 6, light: { x: 0.2, z: 22, r: 14 },
    badge: { n: '+', text: 'SAVED ONLY THROUGH JESUS', in: 111.2, out: 119.4 },
    draw(t, pal) {
      setDesert(t, pal, { groups: true, beam: true });
    },
  },
  { // 17 · 2:00 — the road, and the turn in Romans 10
    t0: 120, t1: 125, pal: 'NIGHTROAD', cam: camFor({ x: 0.5, z: 19, size: 0.24, feet: 0.82 }),
    focus: 0.58, blur: 6, light: { x: 0.6, z: 16, r: 8 },
    draw(t, pal) { setRoad(t, pal); },
  },
  { // 18 · 2:05 — a lamp, handed over
    t0: 125, t1: 130, pal: 'NIGHTV', cam: camFor({ x: 0.3, z: 19.8, size: 0.26, feet: 0.84 }),
    focus: 0.54, blur: 6.5, light: { x: 0.2, z: 19, r: 9 },
    draw(t, pal) { setHandoff(t, pal); },
  },
  { // 19 · 2:10 — the comment box
    t0: 130, t1: 135, pal: 'NIGHTV', cam: camFor({ x: -0.2, z: 31, size: 0.12, feet: 0.86 }),
    focus: 0.60, blur: 4, light: { x: -0.4, z: 17, r: 7 },
    comment: { in: 130.4, out: 134.9 },
    draw(t, pal) { setVillage(t, pal, { light: 0.3, man: false }); },
  },
  { // 20 · 2:15 — the lintel
    t0: 135, t1: 140, pal: 'CREAM', cam: {}, focus: 0.5, blur: 4, light: { x: 0, z: 20, r: 10 }, bloom: 0.12,
    draw(t, pal) {
      g.fillStyle = '#f4ead6'; g.fillRect(0, 0, ART_W, ART_H);
      for (let i = 0; i < 260; i++) {
        const x = hash(i * 3.1) * ART_W, y = hash(i * 7.7) * ART_H;
        g.fillStyle = `rgba(120,96,70,${0.05 + 0.05 * hash(i)})`;
        g.fillRect(x | 0, y | 0, 1, 1);
      }
    },
  },
];

// narration, in the order it is spoken — the .srt is exported from this list
const SUBS = [
  { text: 'What happens to people who *never heard* of Jesus?', in: 0.8, out: 4.6 },
  { text: 'It is the question we are asked most — and always in a whisper.', in: 5.2, out: 9.4 },
  { text: 'What about those who never heard? Is it fair? What about my ancestors?', in: 10.4, out: 14.6 },
  { text: 'In Caesarea there lived a Roman officer, Cornelius.', in: 15.4, out: 20.0 },
  { text: 'A Gentile. Outside the covenant. And still, God saw him.', in: 20.4, out: 24.6 },
  { text: 'He feared God with all his house. He gave much to the *poor*. He *prayed*.', in: 25.2, out: 29.4 },
  { text: 'An *angel* told him: send for a man called Peter.', in: 30.2, out: 34.4 },
  { text: 'When Peter walked into that house, he said something that changes the question.', in: 35.2, out: 39.4 },
  { text: 'God is no *respecter* of persons.', in: 40.9, out: 44.6 },
  { text: 'In every nation, the man who fears him and does right is *accepted* with him.', in: 45.0, out: 49.2 },
  { text: 'And he sent the gospel straight to the seeker.', in: 50.4, out: 54.6 },
  { text: 'Because no one has *zero* light.', in: 56.0, out: 59.4 },
  { text: 'The invisible things of him are clearly seen in the things that are made.', in: 60.2, out: 64.6 },
  { text: 'When Paul walked through *Athens*, he found an altar...', in: 65.4, out: 69.6 },
  { text: '...to the unknown God. Built by people reaching for a God they did not yet know.', in: 70.4, out: 74.6 },
  { text: 'The *third* answer: God will judge every person.', in: 75.4, out: 79.6 },
  { text: 'To whom much was given, much will be required.', in: 80.6, out: 84.8 },
  { text: 'Centuries earlier, *Abraham* pleaded with God for a city.', in: 85.4, out: 89.8 },
  { text: 'God agreed: if even *ten* righteous people could be found, he would spare it.', in: 90.2, out: 94.8 },
  { text: 'Ten. Not a hundred. Ten.', in: 96.2, out: 99.6 },
  { text: 'Mercy in judgment — the judge looking for a reason to save.', in: 100.4, out: 104.6 },
  { text: 'Christians have not agreed about the unreached.', in: 105.6, out: 109.6 },
  { text: 'Some say: hear and trust in this life. Others say Christ may save them by a way we cannot see.', in: 110.4, out: 115.4 },
  { text: 'But every one of those views agrees: salvation is *only* through Jesus.', in: 115.8, out: 119.8 },
  { text: 'Then Paul asks a question that puts the weight on us.', in: 120.4, out: 124.6 },
  { text: 'Faith comes by hearing — and hearing, by someone who was sent.', in: 125.4, out: 129.6 },
  { text: 'Think of the person who first told you about Jesus.', in: 130.4, out: 134.4 },
];

// ---------------------------------------------------------------- type
const FONT_SERIF = 'DejaVu Serif';
const CREAM_TXT = '#fdf6e4';
const RED_TXT = '#e2653f';
const RED_SOFT = '#f0a07a';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Word-wrapped, weight-mixed serif. `*word*` is drawn in the accent colour. */
function richText(str, x, y, maxW, size, lineH, opts = {}) {
  const italic = opts.italic ?? true;
  const font = `${italic ? 'italic ' : ''}${size}px ${FONT_SERIF}`;
  o.font = font;
  const base = o.fillStyle;
  const words = str.split(' ');
  const lines = [];
  let line = [], w = 0;
  for (const word of words) {
    const red = word.includes('*');
    const clean = word.replace(/\*/g, '');
    const m = o.measureText(clean + ' ').width;
    if (w + m > maxW && line.length) { lines.push({ line, w }); line = []; w = 0; }
    line.push({ clean, red, m }); w += m;
  }
  if (line.length) lines.push({ line, w });
  let budget = opts.reveal ?? Infinity;
  lines.forEach((ln, i) => {
    const ly = y + i * lineH;
    if (opts.align === 'center') o.textAlign = 'left';
    let lx = x + (opts.align === 'center' ? (maxW - ln.w) / 2 : 0);
    for (const wd of ln.line) {
      if (budget <= 0) return;
      const shown = wd.clean.slice(0, budget);
      budget -= wd.clean.length + 1;
      o.fillStyle = wd.red ? (opts.red || RED_TXT) : base;
      o.fillText(shown, lx, ly);
      lx += o.measureText(wd.clean + ' ').width;
    }
  });
  return lines.length * lineH;
}

const spaced = str => str.split('').join(' ');
function topBar(label, dark = false) {
  o.save();
  const my = 62;
  const ink = dark ? 'rgba(58,40,28,0.85)' : 'rgba(250,242,226,0.88)';
  const soft = dark ? 'rgba(58,40,28,0.55)' : 'rgba(250,242,226,0.60)';
  const rule = dark ? 'rgba(58,40,28,0.18)' : 'rgba(250,242,226,0.14)';
  o.strokeStyle = '#c0432f'; o.lineWidth = 2.6;
  o.beginPath(); o.moveTo(40, my + 12); o.lineTo(40, my - 8); o.lineTo(58, my - 8); o.lineTo(58, my + 12); o.stroke();
  o.lineWidth = 2;
  o.beginPath(); o.moveTo(44, my - 8); o.lineTo(49, my - 15); o.lineTo(54, my - 8); o.stroke();
  o.textAlign = 'left';
  o.fillStyle = ink;
  o.font = `600 15px ${FONT_SERIF}`;
  o.fillText(spaced(label), 70, my + 4);
  o.textAlign = 'right';
  o.fillStyle = soft;
  o.fillText(spaced('NEVER HEARD'), OUT_W - 40, my + 4);
  o.strokeStyle = rule; o.lineWidth = 1;
  o.beginPath(); o.moveTo(40, my + 26); o.lineTo(OUT_W - 40, my + 26); o.stroke();
  o.restore();
}

function voiceOver(sub, t) {
  const a = smooth(seg(t, sub.in, sub.in + 0.4)) * (1 - smooth(seg(t, sub.out, sub.out + 0.45)));
  if (a <= 0.01) return;
  o.save();
  o.globalAlpha = a;
  o.textAlign = 'left';
  o.textBaseline = 'alphabetic';
  const plate = o.createLinearGradient(0, 0, 0, OUT_H * 0.40);
  plate.addColorStop(0, 'rgba(6,8,14,0.46)');
  plate.addColorStop(1, 'rgba(6,8,14,0)');
  o.fillStyle = plate; o.fillRect(0, 0, OUT_W, OUT_H * 0.40);
  o.fillStyle = CREAM_TXT;
  o.shadowColor = 'rgba(0,0,0,0.72)'; o.shadowBlur = 16;
  richText(sub.text, 36, 140, 626, 45, 61, { red: RED_SOFT });
  o.restore();
}

function badge(b, t) {
  const a = smooth(seg(t, b.in, b.in + 0.5)) * (1 - smooth(seg(t, b.out, b.out + 0.5)));
  if (a <= 0.01) return;
  o.save(); o.globalAlpha = a;
  o.textAlign = 'left';
  const label = b.text.split('').join(' ');
  o.font = `600 22px ${FONT_SERIF}`;
  const tw = o.measureText(label).width;
  const w = tw + 118, h = 62, x = OUT_W / 2 - w / 2, y = OUT_H - 250;
  o.fillStyle = 'rgba(16,12,10,0.74)';
  roundRect(o, x, y, w, h, 31); o.fill();
  o.strokeStyle = 'rgba(244,232,206,0.55)'; o.lineWidth = 1.2; o.stroke();
  // numeral
  o.fillStyle = 'rgba(244,232,206,0.95)';
  o.beginPath(); o.arc(x + 34, y + h / 2, 17, 0, 7); o.fill();
  o.fillStyle = '#241a14'; o.textAlign = 'center';
  o.font = `600 20px ${FONT_SERIF}`;
  o.fillText(b.n, x + 34, y + h / 2 + 7);
  o.fillStyle = '#f8f0dc'; o.textAlign = 'left';
  o.font = `600 22px ${FONT_SERIF}`;
  o.fillText(label, x + 62, y + h / 2 + 8);
  o.restore();
}

function labelChip(lb, t) {
  const a = smooth(seg(t, lb.in, lb.in + 0.5)) * (1 - smooth(seg(t, lb.out, lb.out + 0.45)));
  if (a <= 0.01) return;
  o.save(); o.globalAlpha = a;
  o.textAlign = 'center';
  const label = lb.text.split('').join(' ');
  o.font = `600 20px ${FONT_SERIF}`;
  const tw = o.measureText(label).width;
  const w = tw + 52, h = 52, cx = OUT_W * lb.x, cy = OUT_H * lb.y;
  o.fillStyle = 'rgba(14,11,9,0.78)';
  roundRect(o, cx - w / 2, cy - h / 2, w, h, 26); o.fill();
  o.strokeStyle = 'rgba(244,232,206,0.6)'; o.lineWidth = 1; o.stroke();
  o.fillStyle = '#f8f0dc';
  o.fillText(label, cx, cy + 7);
  o.restore();
}

function quoteCard(q, t) {
  const a = smooth(seg(t, q.in, q.in + 0.45)) * (1 - smooth(seg(t, q.out, q.out + 0.4)));
  if (a <= 0.01) return;
  o.save();
  // the previous scene stays visible, pushed back
  o.fillStyle = `rgba(10,8,7,${0.52 * a})`;
  o.fillRect(0, 0, OUT_W, OUT_H);
  o.globalAlpha = a;
  const x = 48, w = OUT_W - 96, y = 268, h = 604;
  o.shadowColor = 'rgba(0,0,0,0.55)'; o.shadowBlur = 30;
  o.fillStyle = '#f4ead4';
  roundRect(o, x, y, w, h, 3); o.fill();
  o.shadowBlur = 0;
  o.strokeStyle = 'rgba(60,40,28,0.28)'; o.lineWidth = 1; o.stroke();
  // red rule + ornament
  o.fillStyle = RED_TXT; o.fillRect(x + 34, y + 40, 46, 3);
  o.fillStyle = 'rgba(58,40,28,0.75)';
  o.textAlign = 'left';
  o.font = `${64}px ${FONT_SERIF}`;
  o.fillText('“', x + 32, y + 122);
  // body
  const reveal = q.type ? (t - q.in - 0.35) * (q.text.length / q.type) : Infinity;
  o.fillStyle = '#3b2a1c';
  richText(q.text, x + 56, y + 186, w - 112, q.size ?? 32, (q.size ?? 32) * 1.52, {
    red: RED_TXT, align: 'center', reveal,
  });
  // source
  o.fillStyle = 'rgba(58,40,28,0.55)'; o.fillRect(x + 34, y + h - 96, w - 68, 1);
  o.textAlign = 'center';
  o.fillStyle = '#7a5a40';
  o.font = `600 18px ${FONT_SERIF}`;
  o.fillText(q.source.split('').join(' '), OUT_W / 2, y + h - 58);
  o.restore();
}

// the three questions, as chat bubbles over the village
const BUBBLES = [
  { text: 'What about people who never heard of Jesus?', in: 10.5, out: 15.0, x: 0.47, y: 0.455 },
  { text: 'Is it fair if they never had a chance?', in: 11.5, out: 15.0, x: 0.53, y: 0.565 },
  { text: 'What about my ancestors?', in: 12.5, out: 15.0, x: 0.48, y: 0.675 },
];
function bubbles(t) {
  BUBBLES.forEach((b, i) => {
    const a = smooth(seg(t, b.in, b.in + 0.5)) * (1 - smooth(seg(t, b.out, b.out + 0.35)));
    if (a <= 0.01) return;
    o.save(); o.globalAlpha = a;
    o.font = `italic 24px ${FONT_SERIF}`;
    const tw = o.measureText(b.text).width;
    const w = Math.min(tw + 86, 646), h = 68, cx = OUT_W * b.x, cy = OUT_H * b.y;
    const x = cx - w / 2;
    o.shadowColor = 'rgba(0,0,0,0.45)'; o.shadowBlur = 20;
    o.fillStyle = '#f7f0de';
    roundRect(o, x, cy - h / 2, w, h, 18); o.fill();
    o.shadowBlur = 0;
    o.beginPath(); o.moveTo(x + 26, cy + h / 2 - 2); o.lineTo(x + 24, cy + h / 2 + 17); o.lineTo(x + 46, cy + h / 2 - 2); o.closePath(); o.fill();
    o.fillStyle = 'rgba(120,106,92,0.42)';
    o.beginPath(); o.arc(x + 34, cy, 13, 0, 7); o.fill();
    o.fillStyle = '#3f2f22';
    o.textAlign = 'left';
    o.fillText(b.text, x + 58, cy + 9);
    o.restore();
  });
}

function commentBox(c, t) {
  const a = smooth(seg(t, c.in, c.in + 0.5)) * (1 - smooth(seg(t, c.out, c.out + 0.5)));
  if (a <= 0.01) return;
  o.save(); o.globalAlpha = a;
  const x = 56, w = OUT_W - 112, y = 336, h = 332;
  o.shadowColor = 'rgba(0,0,0,0.5)'; o.shadowBlur = 28;
  o.fillStyle = 'rgba(13,11,16,0.86)';
  roundRect(o, x, y, w, h, 22); o.fill();
  o.shadowBlur = 0;
  o.strokeStyle = 'rgba(240,230,210,0.26)'; o.lineWidth = 1; o.stroke();
  // avatar
  o.fillStyle = '#c9a06a'; roundRect(o, x + 26, y + 26, 54, 54, 14); o.fill();
  o.fillStyle = '#8a6a44';
  o.beginPath(); o.arc(x + 53, y + 46, 11, 0, 7); o.fill();
  o.beginPath(); o.arc(x + 53, y + 82, 21, Math.PI, 0); o.fill();
  o.fillStyle = 'rgba(240,232,214,0.5)';
  o.textAlign = 'left'; o.font = `600 17px ${FONT_SERIF}`;
  o.fillText(spaced('YOU'), x + 94, y + 52);
  // the comment being typed
  const full = 'My grandmother';
  const n = Math.floor(clamp((t - c.in - 0.5) / 1.7) * full.length);
  o.fillStyle = '#fdf6e4';
  o.font = `italic 40px ${FONT_SERIF}`;
  o.fillText(full.slice(0, n), x + 28, y + 138);
  if (n < full.length && Math.sin(t * 7) > -0.3) {
    const cw = o.measureText(full.slice(0, n)).width;
    o.fillStyle = 'rgba(253,246,228,0.9)'; o.fillRect(x + 29 + cw, y + 108, 2, 34);
  }
  o.fillStyle = 'rgba(240,232,214,0.28)'; o.fillRect(x + 26, y + 166, w - 52, 1);
  // the prompt
  o.fillStyle = '#fdf6e4';
  o.font = `italic 30px ${FONT_SERIF}`;
  o.fillText('Who first told you', x + 28, y + 214);
  o.fillText('about Jesus?', x + 28, y + 250);
  o.fillStyle = 'rgba(240,160,122,0.95)';
  o.font = `600 13px ${FONT_SERIF}`;
  o.fillText('TYPE THEIR NAME IN THE COMMENTS', x + 28, y + 300);
  // hearts rising beside the box
  for (let i = 0; i < 8; i++) {
    const p = ((t - c.in) * 0.26 + i * 0.14) % 1;
    const hx = x + w - 22 + Math.sin(p * 6 + i) * 26;
    const hy = y + 250 - p * 300;
    o.globalAlpha = a * Math.sin(p * Math.PI) * 0.85;
    o.fillStyle = i % 3 === 0 ? '#e2653f' : '#eba38f';
    const sz = 11 + (i % 3) * 4;
    o.beginPath();
    o.arc(hx - sz * 0.42, hy, sz * 0.5, 0, 7);
    o.arc(hx + sz * 0.42, hy, sz * 0.5, 0, 7);
    o.moveTo(hx - sz * 0.86, hy + sz * 0.16);
    o.lineTo(hx, hy + sz * 1.05);
    o.lineTo(hx + sz * 0.86, hy + sz * 0.16);
    o.closePath(); o.fill();
  }
  o.restore();
}

function endCard(t) {
  const a = smooth(seg(t, 135.0, 135.8));
  if (a <= 0.01) return;
  o.save(); o.globalAlpha = a;
  const cx = OUT_W / 2, top = OUT_H * 0.265, w = 250, h = 250;
  const post = 24;
  // the doorway: a dark opening, then the posts and the lintel in red
  const door = o.createLinearGradient(0, top + post, 0, top + h);
  door.addColorStop(0, 'rgba(52,22,14,0.86)');
  door.addColorStop(0.5, 'rgba(52,22,14,0.66)');
  door.addColorStop(1, 'rgba(52,22,14,0.44)');
  o.fillStyle = door;
  o.fillRect(cx - w / 2 + post, top + post, w - post * 2, h - post);
  o.fillStyle = '#b23a2a';
  o.fillRect(cx - w / 2, top + post, post, h - post);              // left post
  o.fillRect(cx + w / 2 - post, top + post, post, h - post);       // right post
  o.fillRect(cx - w / 2, top, w, post);                            // lintel
  o.fillStyle = 'rgba(255,255,255,0.12)';
  o.fillRect(cx - w / 2, top, w, 4);
  const base = o.createLinearGradient(0, top + h - 6, 0, top + h + 16);
  base.addColorStop(0, 'rgba(60,34,22,0.20)');
  base.addColorStop(1, 'rgba(60,34,22,0)');
  o.fillStyle = base;
  o.fillRect(cx - w / 2 - 8, top + h - 6, w + 16, 22);
  // the mark, still on the beam
  o.strokeStyle = '#8f2a1d'; o.lineWidth = 6; o.lineCap = 'round';
  o.beginPath(); o.moveTo(cx - 30, top + post + 2); o.lineTo(cx, top + post - 10); o.lineTo(cx + 30, top + post + 2); o.stroke();
  o.fillStyle = '#8f2a1d'; o.fillRect(cx - 2, top + post, 4, 26);
  // name
  o.textAlign = 'center';
  o.fillStyle = '#3a2a1e';
  o.font = `600 33px ${FONT_SERIF}`;
  o.fillText('THE LINTEL NETWORK', cx, top + h + 96);
  o.strokeStyle = 'rgba(60,40,28,0.32)'; o.lineWidth = 1;
  o.beginPath(); o.moveTo(cx - 140, top + h + 126); o.lineTo(cx + 140, top + h + 126); o.stroke();
  o.fillStyle = '#a8472f';
  o.font = `italic 38px ${FONT_SERIF}`;
  o.fillText('“Covered, every day.”', cx, top + h + 186);
  o.fillStyle = 'rgba(58,42,30,0.5)';
  o.font = `600 10px ${FONT_SERIF}`;
  o.fillText(spaced('WHAT HAPPENS TO PEOPLE WHO NEVER HEARD?'), cx, top + h + 248);
  o.restore();
}

// ---------------------------------------------------------------- post
function bloomAndComposite(focusY, blurPx, bloomK = 1) {
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.imageSmoothingEnabled = false;
  sctx.clearRect(0, 0, OUT_W, OUT_H);
  sctx.drawImage(art, 0, 0, ART_W, ART_H, 0, 0, OUT_W, OUT_H);

  // --- bloom: threshold at quarter res, then two blurs for a wide falloff
  b1.clearRect(0, 0, 480, 270);
  b1.imageSmoothingEnabled = true;
  b1.drawImage(sharp, 0, 0, 480, 270);
  const img = b1.getImageData(0, 0, 480, 270);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    const k = lum > 0.72 ? Math.min(1, (lum - 0.72) / 0.26) : 0;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  b1.putImageData(img, 0, 0);

  b2.clearRect(0, 0, 480, 270);
  b2.filter = 'blur(5px)'; b2.drawImage(blo1, 0, 0); b2.filter = 'none';
  b3.clearRect(0, 0, 240, 135);
  b3.filter = 'blur(9px)'; b3.drawImage(blo1, 0, 0, 240, 135); b3.filter = 'none';

  // --- tilt-shift: a masked blur band, no separate pass (STYLE.md §9)
  bctx.clearRect(0, 0, OUT_W, OUT_H);
  bctx.filter = `blur(${blurPx}px)`;
  bctx.drawImage(sharp, 0, 0);
  bctx.filter = 'none';

  mctx.clearRect(0, 0, OUT_W, OUT_H);
  mctx.globalCompositeOperation = 'source-over';
  mctx.drawImage(sharp, 0, 0);
  const bandH = OUT_H * 0.30, feather = OUT_H * 0.22;
  const top = focusY - bandH / 2, bot = focusY + bandH / 2;
  const grad = mctx.createLinearGradient(0, top - feather, 0, bot + feather);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.34, 'rgba(0,0,0,1)');
  grad.addColorStop(0.66, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  mctx.globalCompositeOperation = 'destination-in';
  mctx.fillStyle = grad;
  mctx.fillRect(0, 0, OUT_W, OUT_H);

  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, OUT_W, OUT_H);
  o.drawImage(blurC, 0, 0);
  o.drawImage(maskC, 0, 0);

  o.globalCompositeOperation = 'lighter';
  o.globalAlpha = 0.42 * bloomK; o.drawImage(blo2, 0, 0, 480, 270, 0, 0, OUT_W, OUT_H);
  o.globalAlpha = 0.30 * bloomK; o.drawImage(blo3, 0, 0, 240, 135, 0, 0, OUT_W, OUT_H);
  o.globalAlpha = 1;
  o.globalCompositeOperation = 'source-over';

  // --- vignette
  const vg = o.createRadialGradient(OUT_W / 2, OUT_H * 0.52, OUT_H * 0.28, OUT_W / 2, OUT_H * 0.52, OUT_H * 0.86);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(3,4,10,0.58)');
  o.fillStyle = vg; o.fillRect(0, 0, OUT_W, OUT_H);
}

// ---------------------------------------------------------------- frame
const camOf = c => ({ ...DEF_CAM, ...(c || {}) });
function shotAt(t) {
  for (const s of SHOTS) if (t >= s.t0 && t < s.t1) return s;
  return SHOTS[SHOTS.length - 1];
}

function renderFrame(t) {
  const shot = shotAt(t);
  const pal = palAt(t);
  // the set never moves; the camera drifts through the shot
  const k = smooth(seg(t, shot.t0, shot.t1));
  const cam = camOf(shot.cam);
  CAM = { ...cam, z: cam.z + k * 0.55, y: cam.y - k * 0.16 };
  LIGHT_SRC = shot.light;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, ART_W, ART_H);
  shot.draw(t, pal);

  bloomAndComposite(OUT_H * shot.focus, Math.min(shot.blur, 3.4), (0.42 + 0.5 * (pal._night ?? 0)) * (shot.bloom ?? 1));

  // ---- text layer, in the order the eye should meet it
  topBar('HONEST QUESTIONS', shot.pal === 'CREAM');
  if (shot.bubbles) bubbles(t);
  for (const s2 of SHOTS) if (s2.labels) for (const lb of s2.labels) labelChip(lb, t);
  const quoteActive = SHOTS.some(s2 => s2.quote && t > s2.quote.in && t < s2.quote.out);
  if (!quoteActive) for (const sub of SUBS) if (t >= sub.in - 0.45 && t <= sub.out + 0.5) voiceOver(sub, t);
  for (const s2 of SHOTS) if (s2.quote) quoteCard(s2.quote, t);
  for (const s2 of SHOTS) if (s2.badge) badge(s2.badge, t);
  for (const s2 of SHOTS) if (s2.comment) commentBox(s2.comment, t);
  if (t >= 134.6) endCard(t);

  const fade = Math.min(1, seg(t, 0, 0.9)) * (1 - seg(t, 138.6, 139.9));
  if (fade < 1) {
    o.fillStyle = `rgba(0,0,0,${1 - fade})`;
    o.fillRect(0, 0, OUT_W, OUT_H);
  }
}

// ---------------------------------------------------------------- srt
const tc = sec => {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  const s2 = Math.floor(ms / 1000) % 60, r = ms % 1000;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s2)},${pad(r, 3)}`;
};
initSprites();
const SRT_FILE = 'films/never-heard/never-heard.srt';
fs.writeFileSync(SRT_FILE, SUBS.map((s2, i) =>
  `${i + 1}\n${tc(s2.in)} --> ${tc(s2.out)}\n${s2.text.replace(/\*/g, '')}\n`).join('\n'));
console.log(`${SRT_FILE} · ${SUBS.length} cues`);

// ---------------------------------------------------------------- encode
const FFMPEG = process.env.FFMPEG;
if (!FFMPEG) { console.error('Set FFMPEG=/path/to/ffmpeg'); process.exit(1); }

const STILLS_ONLY = !!process.env.STILLS;
const proc = STILLS_ONLY ? { stdin: { write: () => true, end() {} } } : spawn(FFMPEG, [
  '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${OUT_W}x${OUT_H}`, '-r', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', OUT,
], { stdio: ['pipe', 'ignore', 'inherit'] });

// stills mode: STILLS="1.0,4.5,9.2" renders PNGs instead of the film
if (process.env.STILLS) {
  for (const ts of process.env.STILLS.split(',')) {
    const t = parseFloat(ts);
    renderFrame(t);
    fs.writeFileSync(`/tmp/still-${ts}.png`, out.toBuffer('image/png'));
  }
  console.log('stills written');
  process.exit(0);
}

const t0 = Date.now();
for (let f = 0; f < N; f++) {
  renderFrame(f / FPS);
  const buf = o.getImageData(0, 0, OUT_W, OUT_H).data;
  if (!proc.stdin.write(Buffer.from(buf.buffer))) await once(proc.stdin, 'drain');
  if (f % 60 === 0) process.stdout.write(`  ${f}/${N} frames · ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
}
proc.stdin.end();
if (!STILLS_ONLY) { const [code] = await once(proc, 'close');
if (code !== 0) { console.error('ffmpeg exited', code); process.exit(1); }
console.log(`${OUT} · ${N} frames · ${DUR}s · ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
