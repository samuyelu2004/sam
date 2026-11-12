/**
 * The Lost Sheep — a 15-second film in the 2.5D Pixel Art style.
 * Style spec: lemomo-ai/lemo-opuscar · styles/hd-2d/STYLE.md
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
const ART_W = 960, ART_H = 540;          // art resolution: 1 art px = 2 output px
const OUT_W = 1920, OUT_H = 1080;
const FPS = 24, DUR = 15, N = FPS * DUR;
const OUT = 'films/lost-sheep/lost-sheep.mp4';

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
const NIGHT = {
  skyTop: '#0a1330', skyMid: '#17294f', skyLow: '#3d5480',
  fog: '#24365e', ground: '#2a3a52', groundLit: '#3f5069',
  ink: '#0a0f18', warm: '#ffc07a', warmDeep: '#ff8a3d', moon: '#d6e4ff',
};
const DAWN = {
  skyTop: '#20264e', skyMid: '#7a5580', skyLow: '#ffc48a',
  fog: '#7d5c75', ground: '#3a3044', groundLit: '#7a5a58',
  ink: '#140f1e', warm: '#ffe2b4', warmDeep: '#ffab6b', moon: '#fff0d8',
};
const palAt = t => {
  const k = smooth(seg(t, 12.4, 14.2));
  const outP = {};
  for (const key of Object.keys(NIGHT)) outP[key] = mix(NIGHT[key], DAWN[key], k);
  outP._night = 1 - k;
  return outP;
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
    const li = 0.44 + 0.68 * lightAmt;
    r *= li * (1 + 0.14 * lightAmt);
    gg *= li * (1 + 0.03 * lightAmt);
    b *= li * (1 - 0.20 * lightAmt);
    // fog lifts everything toward the set's fog colour
    r = lerp(r, f[0][0], fogAmt * 0.78); gg = lerp(gg, f[0][1], fogAmt * 0.78); b = lerp(b, f[0][2], fogAmt * 0.78);
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  }
  cx.putImageData(img, 0, 0);
  spriteCache.set(key, c);
  return c;
}

// ---- the shepherd: robe, headscarf, staff; poses are data -------------
const ROBE = '#2f6fbf', ROBE_HI = '#4b8ad8', ROBE_SH = '#1d4780', TRIM = '#e8cf94';
const SKIN = '#c99a6a', SCARF = '#efe6d2', SCARF_SH = '#c9bda6', WOOD = '#6b4a2f';

function shepherdSprite(frame, pose) {
  return paintCanvas(22, 48, put => {
    const cx = 9;
    // staff, held out to the side so the silhouette reads
    for (let y = 8; y <= 45; y++) { put(17, y, WOOD); put(18, y, mix(WOOD, '#000000', 0.35)); }
    put(16, 8, WOOD); put(15, 7, WOOD); put(14, 7, WOOD); put(14, 8, WOOD);

    // robe: a cloak that flares to the ground
    for (let y = 19; y <= 42; y++) {
      const halfW = 4 + Math.round((y - 19) * 0.30);
      for (let x = cx - halfW; x <= cx + halfW; x++) {
        const d = x - (cx - halfW);
        let col = ROBE;
        if (d <= 1) col = ROBE_HI;
        else if (x >= cx + halfW - 1) col = ROBE_SH;
        else if (y > 34 && x < cx - halfW + 4) col = mix(ROBE, ROBE_SH, 0.45); // cloak fold
        else if (y > 34 && x > cx + halfW - 5) col = mix(ROBE, ROBE_SH, 0.6);
        put(x, y, col);
      }
    }
    // hem and belt
    for (let x = cx - 11; x <= cx + 11; x++) put(x, 42, TRIM);
    for (let x = cx - 6; x <= cx + 6; x++) { put(x, 27, TRIM); put(x, 28, mix(TRIM, ROBE_SH, 0.4)); }

    // shoulders
    for (let y = 16; y <= 19; y++) for (let x = cx - 5; x <= cx + 5; x++) put(x, y, y === 16 ? ROBE_HI : ROBE);

    // head: face plane, beard, scarf
    for (let y = 9; y <= 16; y++) for (let x = cx - 3; x <= cx + 3; x++) put(x, y, SKIN);
    for (let x = cx - 3; x <= cx + 2; x++) put(x, 9, '#8f6b48');            // brow shadow
    for (let y = 13; y <= 16; y++) for (let x = cx - 3; x <= cx + 3; x++) put(x, y, '#4a3527'); // beard
    put(cx + 1, 11, '#2a1f18'); put(cx + 2, 11, '#2a1f18');                  // eyes
    for (let y = 6; y <= 8; y++) for (let x = cx - 4; x <= cx + 3; x++) put(x, y, y === 8 ? SCARF_SH : SCARF);
    for (let y = 8; y <= 19; y++) { put(cx - 4, y, SCARF); put(cx - 5, y, SCARF_SH); put(cx + 3, y, y < 12 ? SCARF_SH : SCARF); }

    // arms: folded in front when carrying, otherwise one hangs and one takes the staff
    if (pose === 'carry') {
      for (let x = cx - 6; x <= cx + 6; x++) { put(x, 22, ROBE_HI); put(x, 23, ROBE); }
      put(cx - 6, 21, SKIN); put(cx + 6, 21, SKIN);
    } else {
      for (let y = 19; y <= 26; y++) { put(cx - 6, y, ROBE_HI); put(cx - 7, y, mix(ROBE, ROBE_SH, 0.3)); }
      put(cx - 6, 27, SKIN); put(cx - 7, 27, SKIN);
      for (let i = 0; i <= 5; i++) put(cx + 5 + Math.round(i * 0.4), 20 + i, i === 5 ? SKIN : ROBE_HI);
    }

    // legs
    const swing = pose === 'walk' ? [0, 1, 0, -1][frame] : 0;
    if (pose === 'kneel') {
      for (let x = cx - 7; x <= cx + 3; x++) put(x, 43, ROBE_SH);
      for (let x = cx + 1; x <= cx + 7; x++) { put(x, 44, ROBE_SH); put(x, 45, mix(ROBE_SH, '#000', 0.3)); }
      put(cx - 5, 45, WOOD); put(cx + 6, 45, WOOD);
    } else {
      for (let y = 43; y <= 46; y++) { put(cx - 3 + swing, y, mix(ROBE, '#000', 0.35)); put(cx + 2 - swing, y, mix(ROBE, '#000', 0.35)); }
      put(cx - 4 + swing, 47, WOOD); put(cx + 1 - swing, 47, WOOD);
    }
  });
}

// ---- sheep and lamb ---------------------------------------------------
function sheepSprite(frame, small) {
  const W = small ? 15 : 21, H = small ? 12 : 16;
  return paintCanvas(W, H, put => {
    const woolHi = '#e0d9ca', wool = '#bfb7a7', woolSh = '#8a8274', face = '#241f1b';
    const bob = frame % 2;
    const cy = (small ? 4.6 : 6.2) + bob * 0.5;
    const rx = small ? 4.6 : 6.4, ry = small ? 3.4 : 4.4;
    // fleece: a wide dithered mass, lit from the lantern side
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - W * 0.40) / rx, dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const dith = ((x + y) % 4 < 2) ? 0.55 : 0;
      const shade = (dx * 0.75 + dy * 1.15) * 0.42 + dith * 0.6;
      put(x, y, shade > 0.95 ? woolSh : shade < 0.22 ? woolHi : wool);
    }
    // head, low and forward
    const hx = Math.round(W - (small ? 4.5 : 5.5)), hy = Math.round(cy + (small ? 0.2 : 0.6));
    for (let y = hy - 2; y <= hy + 2; y++) for (let x = hx; x <= hx + 3; x++) put(x, y, face);
    put(hx + 3, hy - 1, '#d8d1c4');          // eye
    put(hx - 1, hy - 2, face);                // ear
    // legs: four, short, dark
    const step = frame % 2 === 0 ? 0 : 1;
    const legTop = Math.round(cy + ry - 0.6), legBot = H - 1;
    for (const lx of [0.22, 0.36, 0.62, 0.76]) {
      const x = Math.round(W * lx);
      for (let y = legTop; y <= legBot; y++) put(x + (y === legTop + 1 ? step : 0), y, face);
    }
  });
}

// ---- props ------------------------------------------------------------
function rockSprite(seed) {
  const W = 34, H = 24;
  return paintCanvas(W, H, put => {
    const top = '#6d7484', lit = '#59606f', mid = '#414857', sh = '#262c39', ink = '#171c26';
    // silhouette from a few vertices, scanned row by row
    const v = [[3, 22], [6, 12], [12, 6], [20, 4], [27, 8], [31, 15], [32, 22]];
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
      // three facets: a top plane catching the lantern, a lit left, a dark right
      const facet = y < 11 - (x - 14) * 0.12 ? 2 : x < 17 ? 1 : 0;
      const dith = ((x + y) % 4 < 2) ? 1 : 0;
      let col = facet === 2 ? (dith ? top : lit) : facet === 1 ? (dith ? lit : mid) : (dith ? sh : ink);
      if (hash(seed + x * 2.1 + y * 5.3) < 0.08) col = ink;
      put(x, y, col);
    }
    // cracks
    for (let i = 0; i < 3; i++) {
      const sx = 8 + Math.floor(hash(seed + i * 3) * 18);
      for (let k = 0; k < 6; k++) put(sx + Math.floor(k * 0.6), 8 + k, ink);
    }
  });
}

function treeSprite(seed, tall) {
  const H = tall ? 56 : 34, W = tall ? 30 : 22;
  return paintCanvas(W, H, put => {
    const trunk = '#2e2a33', leafHi = '#3d5a4a', leaf = '#2a4238', leafSh = '#1c2e2a';
    for (let y = H - 16; y < H; y++) for (let x = W / 2 - 1; x <= W / 2 + 1; x++) put(x, y, trunk);
    const cy = H - 22, rx = W * 0.46, ry = H * 0.34;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (hash(seed + x * 5.3 + y * 2.9) < 0.14) continue;
      const dith = ((x + y) % 4 < 2) ? 0.5 : 0;
      const shade = (dx + dy * 0.8) * 0.55 + dith;
      put(x, y, shade > 0.95 ? leafSh : shade < 0.2 ? leafHi : leaf);
    }
  });
}

function tuftSprite(seed) {
  return paintCanvas(10, 7, put => {
    for (let i = 0; i < 6; i++) {
      const x = 1 + Math.floor(hash(seed + i) * 8);
      const h = 2 + Math.floor(hash(seed + i * 3) * 4);
      for (let y = 0; y < h; y++) put(x, 6 - y, h > 3 ? '#4a6350' : '#33473c');
    }
  });
}

function wallSprite() {
  return paintCanvas(22, 13, put => {
    const hi = '#5a5f6e', mid = '#454a58', sh = '#2f3441';
    for (let y = 2; y < 12; y++) for (let x = 0; x < 22; x++) {
      const row = Math.floor((y - 2) / 3);
      const off = row % 2 ? 3 : 0;
      const mortar = (y - 2) % 3 === 2 || (x + off) % 6 === 0;
      put(x, y, mortar ? sh : (y < 5 ? (hash(x * 2.7 + y) > 0.7 ? hi : mid) : mid));
    }
  });
}

// ---------------------------------------------------------------- camera
let CAM = { x: 0, y: 7, z: 8, f: 380, hy: 150 };
const P = (x, y, z) => {
  const dz = z - CAM.z;
  const s = CAM.f / Math.max(dz, 0.4);
  return { x: ART_W / 2 + (x - CAM.x) * s, y: CAM.hy + (CAM.y - y) * s, s, dz };
};
const fogOf = dz => clamp((dz - 14) / 92) * 0.92;
const lightOf = (x, z, pal, src) => {
  const d = Math.hypot(x - src.x, z - src.z);
  const k = clamp(1 - d / (src.r || 11));
  return clamp(0.06 + Math.pow(k, 0.85) * 0.94);
};

// ---------------------------------------------------------------- sprites registry
const SP = {};
const initSprites = () => {
  SP.shepherd = [0, 1, 2, 3].map(f => shepherdSprite(f, 'walk'));
  SP.shepherdIdle = [shepherdSprite(0, 'idle')];
  SP.shepherdKneel = [shepherdSprite(0, 'kneel')];
  SP.shepherdCarry = [0, 1, 2, 3].map(f => shepherdSprite(f, 'carry'));
  SP.sheep = [0, 1].map(f => sheepSprite(f, false));
  SP.lamb = [0, 1].map(f => sheepSprite(f, true));
  SP.rocks = [rockSprite(1), rockSprite(7), rockSprite(13)];
  SP.trees = [treeSprite(2, true), treeSprite(5, false), treeSprite(9, true)];
  SP.tufts = [tuftSprite(3), tuftSprite(8), tuftSprite(11)];
  SP.wall = wallSprite();
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
    const shW = w * 0.62, shH = Math.max(1.5, h * 0.09);
    const dx = LIGHT_SRC ? (wx - LIGHT_SRC.x) * 0.06 * p.s : 0;
    const alpha = 0.22 * (1 - fog * 0.6);
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
const FOLD = { x: 0, z: 24, r: 5.4 };
const GATE = { a: Math.PI * 1.06 };
const FLOCK = [];
// a jittered grid inside the fold reads as a flock; random points clump
for (let gx = -3.4; gx <= 3.4; gx += 1.15) {
  for (let gz = -2.6; gz <= 2.6; gz += 1.0) {
    const x = FOLD.x + gx + (hash(gx * 7.1 + gz) - 0.5) * 0.7;
    const z = FOLD.z + gz + (hash(gz * 5.3 + gx) - 0.5) * 0.6;
    if (Math.hypot(x - FOLD.x, (z - FOLD.z) / 0.78) > FOLD.r - 1.0) continue;
    const i = FLOCK.length;
    FLOCK.push({ x, z, ph: hash(i * 9.1) * 6.28, small: hash(i * 3.7) > 0.72 });
  }
}

function drawSky(pal, t) {
  const sky = g.createLinearGradient(0, 0, 0, CAM.hy + 40);
  sky.addColorStop(0, pal.skyTop); sky.addColorStop(0.55, pal.skyMid); sky.addColorStop(1, pal.skyLow);
  g.fillStyle = sky; g.fillRect(0, 0, ART_W, CAM.hy + 40);
  // stars, only while it is night
  const night = pal._night ?? 1;
  if (night > 0.05) {
    for (let i = 0; i < 90; i++) {
      const x = hash(i * 2.3) * ART_W, y = hash(i * 5.9) * (CAM.hy - 40);
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      g.fillStyle = `rgba(207,224,255,${(0.25 + 0.55 * hash(i * 7.7)) * night * tw})`;
      g.fillRect(x | 0, y | 0, 1, 1);
    }
    // moon
    const mx = ART_W * 0.76, my = CAM.hy * 0.34;
    glow(mx, my, 70, 'rgb(180,205,255)', 0.16 * night);
    g.fillStyle = pal.moon; g.beginPath(); g.arc(mx, my, 9, 0, 7); g.fill();
    g.fillStyle = mix(pal.moon, pal.skyMid, 0.18);
    g.beginPath(); g.arc(mx - 3, my + 2, 3, 0, 7); g.fill();
  }
}

function drawRidges(pal) {
  // two billboard ridges: far, then near
  for (const [z, amp, col, base] of [[150, 34, mix(pal.fog, pal.skyLow, 0.45), 0], [96, 22, mix(pal.fog, pal.ink, 0.28), 0]]) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, CAM.hy + 6);
    const N2 = 14;
    for (let i = 0; i <= N2; i++) {
      const xw = -70 + (i / N2) * 150;
      const p = P(xw, 0, z);
      const hgt = amp * (0.4 + hash(i * 4.1 + z) * 0.9);
      g.lineTo(p.x, p.y - hgt);
    }
    g.lineTo(ART_W, CAM.hy + 6);
    g.closePath(); g.fill();
  }
}

function drawGround(pal, t) {
  const grd = g.createLinearGradient(0, CAM.hy - 10, 0, ART_H);
  grd.addColorStop(0, pal.fog);
  grd.addColorStop(0.16, mix(pal.ground, pal.fog, 0.55));
  grd.addColorStop(0.62, pal.ground);
  grd.addColorStop(1, mix(pal.ground, pal.ink, 0.45));
  g.fillStyle = grd;
  g.fillRect(0, CAM.hy - 10, ART_W, ART_H - CAM.hy + 10);

  // the path out of the fold, toward the lower left
  const pts = [[-4.4, 21.5], [-6.6, 18], [-9.5, 14], [-13, 9.5], [-18, 4], [-24, -1]];
  const pathG = g.createLinearGradient(0, CAM.hy, 0, ART_H);
  pathG.addColorStop(0, 'rgba(126,112,92,0)');
  pathG.addColorStop(0.45, 'rgba(120,106,88,0.05)');
  pathG.addColorStop(1, 'rgba(120,106,88,0.09)');
  g.fillStyle = pathG;
  g.beginPath();
  pts.forEach(([x, z], i) => {
    const p = P(x, 0, z);
    const w = 0.85 * p.s;
    if (i === 0) g.moveTo(p.x - w, p.y); else g.lineTo(p.x - w, p.y);
  });
  for (let i = pts.length - 1; i >= 0; i--) {
    const [x, z] = pts[i];
    const p = P(x, 0, z);
    g.lineTo(p.x + 0.95 * p.s, p.y);
  }
  g.closePath(); g.fill();

  // grass: thousands of tiny marks would be slow per frame; a few hundred read
  // as a texture once they sit under the fog
  for (let i = 0; i < 300; i++) {
    const x = -26 + hash(i * 1.7) * 58, z = 4 + hash(i * 4.3) * 52;
    if (Math.hypot(x - FOLD.x, z - FOLD.z) < FOLD.r - 0.2) continue;
    const p = P(x, 0, z);
    const dark = hash(i * 9.1) > 0.45;
    g.fillStyle = dark ? 'rgba(12,20,26,0.22)' : 'rgba(150,170,170,0.055)';
    const w = Math.max(1, p.s * 0.09), h = Math.max(1, p.s * 0.05);
    g.fillRect(p.x, p.y, w, h);
  }

  // patches of darker turf to break the plane up
  for (let i = 0; i < 34; i++) {
    const x = -30 + hash(i * 4.7) * 64, z = 3 + hash(i * 8.3) * 46;
    const p = P(x, 0, z);
    g.fillStyle = `rgba(18,26,34,${0.07 + hash(i) * 0.09})`;
    g.beginPath();
    g.ellipse(p.x, p.y, (1.2 + hash(i * 2.2) * 2.4) * p.s * 0.5, (0.5 + hash(i * 3.1)) * p.s * 0.22, 0, 0, 7);
    g.fill();
  }

  // grass tufts scattered on the ground plane
  for (let i = 0; i < 34; i++) {
    const x = -24 + hash(i * 1.3) * 56;
    const z = 5 + hash(i * 2.9) * 55;
    if (Math.hypot(x - FOLD.x, z - FOLD.z) < FOLD.r - 0.4) continue;
    drawSprite(SP.tufts[i % 3], x, 0, z, 0.55 + hash(i * 5.1) * 0.3, pal, { shadow: false });
  }
}

function drawFold(pal, t) {
  const WH = 0.62;                       // wall height, metres
  const N2 = 96, gapW = 0.17;
  const pt = (a, y, r) => P(FOLD.x + Math.cos(a) * r, y, FOLD.z + Math.sin(a) * r);
  const inGap = a => Math.abs(((a - GATE.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > gapW;

  // side face and cap, drawn as overlapping quads so the ring closes cleanly
  const fogged = (col, x, z) => mix(col, pal.fog, fogOf(Math.abs(z - CAM.z)) * 0.95);
  for (let i = 0; i < N2; i++) {
    const a0 = (i / N2) * Math.PI * 2, a1 = ((i + 1.08) / N2) * Math.PI * 2;
    if (!inGap(a0) || !inGap(a1)) continue;
    const zc = FOLD.z + Math.sin(a0) * FOLD.r;
    const xc = FOLD.x + Math.cos(a0) * FOLD.r;
    // face
    const f0 = pt(a0, 0, FOLD.r), f1 = pt(a1, 0, FOLD.r);
    const f2 = pt(a1, WH, FOLD.r), f3 = pt(a0, WH, FOLD.r);
    g.beginPath();
    g.moveTo(f0.x, f0.y); g.lineTo(f1.x, f1.y); g.lineTo(f2.x, f2.y); g.lineTo(f3.x, f3.y);
    g.closePath();
    const stone = mix(pal.fog, i % 2 ? '#6f7686' : '#7b828f', 0.64 - (i % 5) * 0.02);
    g.fillStyle = fogged(stone, xc, zc);
    g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 1; g.stroke();
    // coursing: one horizontal line partway up, like stacked blocks
    const m0 = pt(a0, WH * 0.52, FOLD.r), m1 = pt(a1, WH * 0.52, FOLD.r);
    g.strokeStyle = fogged('#2a2f3c', xc, zc); g.globalAlpha = 0.5;
    g.beginPath(); g.moveTo(m0.x, m0.y); g.lineTo(m1.x, m1.y); g.stroke();
    g.globalAlpha = 1;
    // cap, catching the moon
    const c0 = pt(a0, WH, FOLD.r - 0.24), c1 = pt(a1, WH, FOLD.r - 0.24);
    g.beginPath();
    g.moveTo(c0.x, c0.y); g.lineTo(c1.x, c1.y); g.lineTo(f2.x, f2.y); g.lineTo(f3.x, f3.y);
    g.closePath();
    g.fillStyle = fogged(mix(pal.fog, '#b3bac6', 0.72), xc, zc);
    g.fill(); g.strokeStyle = g.fillStyle; g.stroke();
    // a mortar joint every third block
    if (i % 3 === 0) {
      g.strokeStyle = fogged('rgba(20,24,34,1)', xc, zc);
      g.globalAlpha = 0.35;
      g.beginPath(); g.moveTo(f3.x, f3.y); g.lineTo(f0.x, f0.y); g.stroke();
      g.globalAlpha = 1;
    }
  }

  // lantern post at the fold's heart
  const post = P(LIGHT_SRC.x, 0, LIGHT_SRC.z);
  if (post.dz > 1) {
    const hpx = 2.2 * post.s;
    g.fillStyle = mix('#2a2320', pal.ink, 0.3);
    g.fillRect(post.x - 1, post.y - hpx, 2, hpx);
    const lx = post.x, ly = post.y - hpx;
    g.fillStyle = pal.warm;
    g.fillRect(lx - 2, ly - 4, 5, 5);
    glow(lx, ly - 1, 26, 'rgb(255,179,92)', 0.5);
    glow(lx, ly - 1, 90, 'rgb(255,140,60)', 0.16);
    // pool on the ground
    const pool = g.createRadialGradient(post.x, post.y, 0, post.x, post.y, 5.5 * post.s);
    pool.addColorStop(0, 'rgba(255,186,110,0.42)');
    pool.addColorStop(0.45, 'rgba(255,160,80,0.16)');
    pool.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = pool;
    g.beginPath(); g.ellipse(post.x, post.y, 3.4 * post.s, 1.35 * post.s, 0, 0, 7); g.fill();
  }
}

function drawFlock(pal, t) {
  for (let i = 0; i < FLOCK.length; i++) {
    const s = FLOCK[i];
    const frame = Math.floor((t * 1.5 + s.ph) % 2);
    drawSprite(s.small ? SP.lamb[frame] : SP.sheep[frame], s.x, 0, s.z, s.small ? 0.62 : 0.92, pal);
  }
}

/** A near-camera rock, cropped by the frame and softened by the tilt-shift. */
function drawForeground(pal, x, z, hM, which = 0) {
  drawSprite(SP.rocks[which], x, 0, z, hM, pal, { light: 0.0, shadow: false });
}

function drawTree(x, z, tall, pal) {
  const spr = tall ? SP.trees[0] : SP.trees[1];
  drawSprite(spr, x, 0, z, tall ? 4.6 : 2.6, pal);
}

function drawDust(pal, t) {
  const night = pal._night ?? 1;
  for (let i = 0; i < 46; i++) {
    const ph = hash(i * 1.9);
    const x = LIGHT_SRC.x + Math.sin(t * 0.5 + ph * 8) * (0.6 + ph * 2.6);
    const z = LIGHT_SRC.z + Math.cos(t * 0.42 + ph * 5) * (0.6 + ph * 2.4);
    const y = 0.15 + ((ph * 2.2 + t * 0.14) % 1.7);
    const p = P(x, y, z);
    const a = 0.16 + 0.14 * Math.sin(t * 2 + i);
    g.fillStyle = `rgba(255,196,130,${clamp(a) * (0.4 + night * 0.6)})`;
    g.fillRect(p.x | 0, p.y | 0, 1, 1);
  }
}

// ---------------------------------------------------------------- shots
const SHOTS = [
  { // I — the ninety-nine, wide, from above
    t0: 0, t1: 3.8, cam: { x: 0.4, y: 7.2, z: 8.5, f: 380, hy: 150 },
    focus: 0.60, blur: 5, light: { x: -2.6, z: 22, r: 12 },
    card: { numeral: 'I', title: 'THE NINETY-NINE', in: 0.35, out: 3.1 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal);
      drawGround(pal, t);
      drawTree(-13, 30, true, pal); drawTree(12, 34, false, pal); drawTree(-19, 44, true, pal);
      drawFold(pal, t);
      drawFlock(pal, t);
      drawShepherdAt(-3.4, 21.2, 'idle', t, pal);
      drawDust(pal, t);
      drawForeground(pal, -8.5, 12.5, 1.1, 0);
    },
  },
  { // II — one is missing: the flattened grass outside the gate
    t0: 3.8, t1: 6.8, cam: { x: -4.0, y: 2.7, z: 6.3, f: 430, hy: 150 },
    focus: 0.63, blur: 7, light: { x: -2.6, z: 22, r: 10 },
    sub: { text: 'One is missing.', in: 4.2, out: 6.4 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal);
      drawGround(pal, t);
      drawTree(-18, 40, true, pal); drawTree(6, 44, false, pal);
      drawFold(pal, t);
      drawFlock(pal, t);

      // the place a body should be: grass pressed flat, still warm from lying on
      const p = P(-4.2, 0, 12.4);
      g.save();
      g.translate(p.x, p.y); g.scale(1, 0.34);
      const flat = g.createRadialGradient(0, 0, 0, 0, 0, 0.95 * p.s);
      flat.addColorStop(0, 'rgba(52,62,52,0.55)');
      flat.addColorStop(0.55, 'rgba(44,54,46,0.34)');
      flat.addColorStop(1, 'rgba(40,48,42,0)');
      g.fillStyle = flat;
      g.beginPath(); g.arc(0, 0, 0.95 * p.s, 0, 7); g.fill();
      g.restore();
      // pressed blades, all leaning one way
      g.strokeStyle = 'rgba(128,142,116,0.7)'; g.lineWidth = 1;
      for (let i = 0; i < 22; i++) {
        const a = hash(i * 3.1) * Math.PI * 2, r = hash(i * 7.7) * 0.85 * p.s;
        const x0 = p.x + Math.cos(a) * r, y0 = p.y + Math.sin(a) * r * 0.34;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 3, y0 - 2); g.stroke();
      }
      drawSprite(SP.tufts[0], -4.9, 0, 12.2, 0.28, pal, { shadow: false });
      // a scrap of fleece caught in the grass
      for (const [wx, wz, sz] of [[-3.75, 12.1, 0.11], [-4.6, 12.7, 0.07], [-4.9, 11.9, 0.06]]) {
        const mp = P(wx, 0.04, wz);
        g.fillStyle = '#d6cebd';
        g.fillRect(mp.x, mp.y, Math.max(4, mp.s * sz), Math.max(3, mp.s * sz * 0.6));
        g.fillStyle = '#a89f8e';
        g.fillRect(mp.x + 2, mp.y + 3, Math.max(2, mp.s * sz * 0.5), 2);
      }

      drawDust(pal, t);
      drawForeground(pal, 1.0, 9.4, 1.3, 2);
    },
  },
  { // III — he leaves the ninety-nine, tracking out through the gate
    t0: 6.8, t1: 10.4, cam: { x: -4.2, y: 4.4, z: 6.5, f: 380, hy: 158 },
    focus: 0.58, blur: 5.5, light: { x: -2.6, z: 22, r: 10 },
    sub: { text: 'So he leaves the ninety-nine.', in: 7.4, out: 9.9 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal);
      drawGround(pal, t);
      drawTree(-15, 26, true, pal); drawTree(4, 36, true, pal);
      drawFold(pal, t);
      // he walks the path, lantern in hand
      const k = smooth(seg(t, 6.8, 10.4));
      const x = lerp(-4.6, -9.4, k), z = lerp(20.4, 12.6, k);
      LIGHT_SRC = { x: x + 0.7, z: z + 0.3, r: 7 };
      // the lamp he carries
      const lp = P(x + 0.86, 0.95, z + 0.2);
      glow(lp.x, lp.y, 62, 'rgb(255,150,70)', 0.22);
      glow(lp.x, lp.y, 150, 'rgb(255,130,60)', 0.12);
      const core = g.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 13);
      core.addColorStop(0, 'rgba(255,214,150,0.85)');
      core.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = core; g.beginPath(); g.arc(lp.x, lp.y, 13, 0, 7); g.fill();
      const pool = g.createRadialGradient(lp.x, lp.y + 26, 0, lp.x, lp.y + 26, 54);
      pool.addColorStop(0, 'rgba(255,175,95,0.24)'); pool.addColorStop(1, 'rgba(255,175,95,0)');
      g.fillStyle = pool; g.beginPath(); g.ellipse(lp.x, lp.y + 26, 54, 20, 0, 0, 7); g.fill();
      drawShepherdAt(x, z, 'walk', t, pal);
      drawFlock(pal, t);
      drawDust(pal, t);
      drawForeground(pal, -3.2, 9.5, 1.4, 1);
    },
  },
  { // IV — the search ends: he kneels at the rocks, the lamb under the ledge
    t0: 10.4, t1: 12.8, cam: { x: 10.4, y: 3.4, z: 0.4, f: 430, hy: 168 },
    focus: 0.63, blur: 6, light: { x: 9.6, z: 12.2, r: 9 },
    sub: { text: 'He searches until he finds it.', in: 10.8, out: 12.5 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal);
      drawGround(pal, t);
      drawTree(20, 24, true, pal); drawTree(3, 26, false, pal);
      drawSprite(SP.rocks[0], 13.0, 0, 13.0, 2.1, pal);
      drawSprite(SP.rocks[1], 11.4, 0, 14.2, 1.6, pal);
      drawSprite(SP.rocks[2], 12.2, 0, 12.2, 1.2, pal);
      drawSprite(SP.lamb[Math.floor(t * 2) % 2], 11.35, 0, 13.75, 0.66, pal);
      drawShepherdAt(9.9, 12.4, 'kneel', t, pal);
      const lp = P(10.55, 0.62, 12.9);
      glow(lp.x, lp.y, 46, 'rgb(255,196,120)', 0.5);
      glow(lp.x, lp.y, 150, 'rgb(255,150,70)', 0.20);
      drawDust(pal, t);
      drawForeground(pal, 8.0, 4.2, 1.8, 2);
    },
  },
  { // V — dawn, and he carries it home
    t0: 12.8, t1: 15, cam: { x: -1.0, y: 5.4, z: 7.4, f: 350, hy: 152 },
    focus: 0.66, blur: 5.5, light: { x: -1, z: 20, r: 12 },
    title: { big: 'REJOICE', small: 'LUKE 15 · 4–7', in: 13.3, out: 14.75 },
    draw(t, pal) {
      drawSky(pal, t);
      // the sun clears the ridge behind the fold
      const sun = P(0.5, 1.6, 74);
      const flare = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 210);
      flare.addColorStop(0, 'rgba(255,206,150,0.40)');
      flare.addColorStop(0.35, 'rgba(255,160,105,0.11)');
      flare.addColorStop(1, 'rgba(255,150,90,0)');
      g.fillStyle = flare; g.fillRect(0, 0, ART_W, ART_H);
      g.fillStyle = '#ffeccb'; g.beginPath(); g.arc(sun.x, sun.y, 17, 0, 7); g.fill();
      drawRidges(pal);
      drawGround(pal, t);
      drawTree(-14, 32, true, pal); drawTree(11, 38, true, pal);
      drawFold(pal, t);
      drawFlock(pal, t);
      const k = smooth(seg(t, 12.8, 15));
      const x = lerp(-4.2, -1.6, k), z = lerp(17.5, 15.2, k);
      drawShepherdAt(x, z, 'carry', t, pal);
      drawDust(pal, t);
    },
  },
];

function drawShepherdAt(x, z, pose, t, pal) {
  const frame = Math.floor(t * 8) % 4;
  const sprite = pose === 'walk' ? SP.shepherd[frame]
    : pose === 'carry' ? SP.shepherdCarry[frame]
      : pose === 'kneel' ? SP.shepherdKneel[0] : SP.shepherdIdle[0];
  drawSprite(sprite, x, 0, z, 1.85, pal);
  if (pose === 'carry') {
    // the lamb rides the shoulders
    drawSprite(SP.lamb[0], x + 0.02, 0.96, z + 0.30, 0.60, pal, { shadow: false, light: 0.4 });
  }
  if (pose === 'kneel') {
    drawSprite(SP.lamb[0], x + 0.75, 0.05, z + 0.2, 0.52, pal);
  }
}

// ---------------------------------------------------------------- HUD
const FONT_SERIF = 'DejaVu Serif';

function chapterCard(card, t, pal) {
  const a = smooth(seg(t, card.in, card.in + 0.55)) * (1 - smooth(seg(t, card.out, card.out + 0.6)));
  if (a <= 0.01) return;
  o.save();
  o.globalAlpha = a;
  o.textAlign = 'center';
  o.fillStyle = '#f3ead6';
  o.font = `${44}px ${FONT_SERIF}`;
  o.fillText(card.numeral, OUT_W / 2, OUT_H * 0.30);
  o.font = `${30}px ${FONT_SERIF}`;
  const title = card.title.split('').join(' ');
  o.fillText(title, OUT_W / 2, OUT_H * 0.365);
  o.strokeStyle = 'rgba(232,207,148,0.75)'; o.lineWidth = 1;
  o.beginPath(); o.moveTo(OUT_W / 2 - 150, OUT_H * 0.30 - 26); o.lineTo(OUT_W / 2 + 150, OUT_H * 0.30 - 26); o.stroke();
  o.beginPath(); o.moveTo(OUT_W / 2 - 150, OUT_H * 0.365 + 22); o.lineTo(OUT_W / 2 + 150, OUT_H * 0.365 + 22); o.stroke();
  o.restore();
}

function subtitle(sub, t) {
  const a = smooth(seg(t, sub.in, sub.in + 0.35)) * (1 - smooth(seg(t, sub.out, sub.out + 0.4)));
  if (a <= 0.01) return;
  o.save();
  const band = o.createLinearGradient(0, OUT_H * 0.76, 0, OUT_H);
  band.addColorStop(0, 'rgba(4,6,12,0)');
  band.addColorStop(0.42, `rgba(4,6,12,${0.42 * a})`);
  band.addColorStop(1, `rgba(4,6,12,${0.62 * a})`);
  o.fillStyle = band; o.fillRect(0, OUT_H * 0.76, OUT_W, OUT_H * 0.24);
  o.globalAlpha = a;
  o.textAlign = 'center';
  o.fillStyle = '#f6efe0';
  o.font = `italic 46px ${FONT_SERIF}`;
  o.shadowColor = 'rgba(0,0,0,0.75)'; o.shadowBlur = 12;
  o.fillText(sub.text, OUT_W / 2, OUT_H * 0.895);
  o.restore();
}

function titleCard(card, t) {
  const a = smooth(seg(t, card.in, card.in + 0.6)) * (1 - smooth(seg(t, card.out, card.out + 0.5)));
  if (a <= 0.01) return;
  o.save();
  o.globalAlpha = a;
  o.textAlign = 'center';
  o.fillStyle = '#fdf3dd';
  o.font = `${96}px ${FONT_SERIF}`;
  o.shadowColor = 'rgba(255,180,90,0.35)'; o.shadowBlur = 30;
  o.fillText(card.big.split('').join(' '), OUT_W / 2, OUT_H * 0.26);
  o.shadowBlur = 0;
  o.strokeStyle = 'rgba(232,207,148,0.8)'; o.lineWidth = 1.5;
  o.beginPath(); o.moveTo(OUT_W / 2 - 190, OUT_H * 0.315); o.lineTo(OUT_W / 2 + 190, OUT_H * 0.315); o.stroke();
  o.fillStyle = 'rgba(240,225,200,0.9)';
  o.font = `26px ${FONT_SERIF}`;
  o.fillText(card.small.split('').join(' '), OUT_W / 2, OUT_H * 0.362);
  o.restore();
}

// ---------------------------------------------------------------- post
function bloomAndComposite(focusY, blurPx) {
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
  const bandH = OUT_H * 0.20, feather = OUT_H * 0.28;
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
  o.globalAlpha = 0.42; o.drawImage(blo2, 0, 0, 480, 270, 0, 0, OUT_W, OUT_H);
  o.globalAlpha = 0.30; o.drawImage(blo3, 0, 0, 240, 135, 0, 0, OUT_W, OUT_H);
  o.globalAlpha = 1;
  o.globalCompositeOperation = 'source-over';

  // --- vignette
  const vg = o.createRadialGradient(OUT_W / 2, OUT_H * 0.52, OUT_H * 0.28, OUT_W / 2, OUT_H * 0.52, OUT_H * 0.86);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(3,4,10,0.58)');
  o.fillStyle = vg; o.fillRect(0, 0, OUT_W, OUT_H);
}

// ---------------------------------------------------------------- frame
function shotAt(t) {
  for (const s of SHOTS) if (t >= s.t0 && t < s.t1) return s;
  return SHOTS[SHOTS.length - 1];
}

function renderFrame(t) {
  const shot = shotAt(t);
  const pal = palAt(t);
  // the set never moves; the camera drifts through the shot (STYLE.md §6)
  const k = smooth(seg(t, shot.t0, shot.t1));
  CAM = { ...shot.cam, z: shot.cam.z + k * 0.9, y: shot.cam.y - k * 0.25 };
  LIGHT_SRC = shot.light;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, ART_W, ART_H);
  shot.draw(t, pal);

  bloomAndComposite(OUT_H * shot.focus, shot.blur);
  if (shot.card) chapterCard(shot.card, t, pal);
  if (shot.sub) subtitle(shot.sub, t);
  if (shot.title) titleCard(shot.title, t);

  // fade in from black and out at the end
  const fade = Math.min(1, seg(t, 0, 0.5)) * (1 - seg(t, 14.35, 15));
  if (fade < 1) {
    o.fillStyle = `rgba(0,0,0,${1 - fade})`;
    o.fillRect(0, 0, OUT_W, OUT_H);
  }
}

// ---------------------------------------------------------------- encode
initSprites();
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
