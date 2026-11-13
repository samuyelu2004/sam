/**
 * The Tree He Left Standing — a 1:45 essay film in the 2.5D Pixel Art style.
 * Style spec: lemomo-ai/lemo-opuscar · styles/hd-2d/STYLE.md
 *
 * The question: if God knew Eve would eat the fruit, why not remove the tree?
 * The film does not answer it; it lays the classical answers side by side.
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
const FPS = 24, DUR = 105, N = FPS * DUR;
const OUT = 'films/eden/eden.mp4';

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
const DAY = {
  skyTop: '#5f9ec9', skyMid: '#a8cfe2', skyLow: '#f4e3bc',
  fog: '#c2d6dc', ground: '#4f6339', groundLit: '#8fa25c',
  ink: '#20261c', warm: '#ffe0a0', warmDeep: '#ffbe6a', moon: '#fffdf2',
};
const DUSK = {
  skyTop: '#2b2a4e', skyMid: '#8a5c74', skyLow: '#f2a86a',
  fog: '#8a6a80', ground: '#4a4050', groundLit: '#7a5f58',
  ink: '#140f1e', warm: '#ffd0a0', warmDeep: '#ff9a5e', moon: '#ffe9d0',
};
const DAWN = {
  skyTop: '#6a7fb0', skyMid: '#e2a07e', skyLow: '#ffe6be',
  fog: '#c8a892', ground: '#6a5a48', groundLit: '#968062',
  ink: '#1a1410', warm: '#ffe6bc', warmDeep: '#ffb070', moon: '#fff6e2',
};
const lerpPal = (a, b, k) => {
  const o = {};
  for (const key of Object.keys(a)) {
    if (key.startsWith('_')) continue;          // _night is a flag, not a colour
    o[key] = mix(a[key], b[key], k);
  }
  o._night = 0;
  return o;
};
DAY._night = 0; DUSK._night = 1; DAWN._night = 0;
const palAt = t => {
  if (t < 59) return DAY;
  if (t < 64) return lerpPal(DAY, DUSK, smooth(seg(t, 59, 64)));
  if (t < 84) return DUSK;
  if (t < 90) return lerpPal(DUSK, DAWN, smooth(seg(t, 84, 90)));
  return DAWN;
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

// ---- people ----------------------------------------------------------
const EVE_ROBE = '#e6dcc4', EVE_SH = '#b8ad92', EVE_HI = '#f7eeda', EVE_TRIM = '#cdbb92';
const EVE_SKIN = '#d9ad80', EVE_SKIN_SH = '#b4865c', EVE_HAIR = '#3a2a1e', EVE_HAIR_HI = '#5c4530';
const ADAM_SKIN = '#c29468', ADAM_TUNIC = '#b9a781', ADAM_HAIR = '#2b2016';

/** A standing figure: long-haired woman or shorter-haired man, two poses. */
function personSprite(who, pose) {
  const woman = who === 'eve';
  const robe = woman ? EVE_ROBE : ADAM_TUNIC;
  const robeSh = woman ? EVE_SH : '#8f7f5e';
  const skin = woman ? EVE_SKIN : ADAM_SKIN;
  const skinSh = woman ? EVE_SKIN_SH : '#9a6f48';
  const hair = woman ? EVE_HAIR : ADAM_HAIR;
  const cx = 10;
  return paintCanvas(22, 50, put => {
    // robe / tunic: a soft column
    for (let y = 21; y <= 45; y++) {
      const halfW = 3 + Math.round((y - 21) * 0.22) + (woman ? 1 : 0);
      for (let x = cx - halfW; x <= cx + halfW; x++) {
        const d = x - (cx - halfW);
        let col = robe;
        if (d === 0) col = woman ? EVE_HI : '#cdbd97';
        else if (x >= cx + halfW - 1) col = robeSh;
        else if (y > 38 && (x - cx) % 3 === 0) col = robeSh;      // folds
        put(x, y, col);
      }
    }
    for (let x = cx - 7; x <= cx + 7; x++) put(x, 45, woman ? EVE_TRIM : '#8f7f5e');
    // shoulders, neck, head
    for (let y = 18; y <= 21; y++) for (let x = cx - 4; x <= cx + 4; x++) put(x, y, woman ? EVE_HI : robe);
    for (let y = 16; y <= 18; y++) for (let x = cx - 1; x <= cx + 1; x++) put(x, y, skinSh);
    for (let y = 9; y <= 16; y++) for (let x = cx - 3; x <= cx + 3; x++) put(x, y, skin);
    put(cx + 1, 12, '#2a1f18'); put(cx + 2, 12, '#2a1f18');
    // hair
    if (woman) {
      for (let y = 7; y <= 9; y++) for (let x = cx - 4; x <= cx + 3; x++) put(x, y, EVE_HAIR);
      for (let y = 9; y <= 26; y++) { put(cx - 4, y, EVE_HAIR); put(cx - 5, y, EVE_HAIR); put(cx + 4, y, EVE_HAIR); }
      for (let x = cx - 3; x <= cx + 3; x++) put(x, 16, EVE_SKIN_SH);     // jaw in shadow
      for (let y = 8; y <= 12; y++) put(cx - 2, y, EVE_HAIR_HI);
    } else {
      for (let y = 7; y <= 10; y++) for (let x = cx - 3; x <= cx + 3; x++) put(x, y, ADAM_HAIR);
      put(cx - 3, 11, ADAM_HAIR); put(cx + 3, 11, ADAM_HAIR);
      for (let x = cx - 2; x <= cx + 2; x++) put(x, 15, '#3a2a1e');   // beard
    }
    // arms
    if (pose === 'reach') {
      for (let i = 0; i <= 7; i++) put(cx + 4 + Math.round(i * 0.72), 20 - Math.round(i * 0.9), i > 5 ? skin : robe);
      for (let y = 20; y <= 27; y++) put(cx - 5, y, woman ? EVE_HI : robe);
    } else {
      for (let y = 19; y <= 27; y++) { put(cx - 5, y, woman ? EVE_HI : robe); put(cx + 5, y, robeSh); }
      put(cx - 5, 28, skin); put(cx + 5, 28, skin);
    }
    // feet
    put(cx - 3, 46, skinSh); put(cx - 2, 46, skinSh);
    put(cx + 3, 46, skinSh); put(cx + 2, 46, skinSh);
  });
}

// ---- trees -----------------------------------------------------------
function canopy(put, cx, cy, rx, ry, hi, mid, sh, seed, skip = 0.13) {
  for (let y = 0; y < cy + ry + 2; y++) for (let x = 0; x < cx + rx + 2; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy > 1) continue;
    if (hash(seed + x * 3.1 + y * 7.3) < skip) continue;
    const dith = ((x + y) % 4 < 2) ? 0.55 : 0;
    const shade = (dx * 0.85 + dy * 1.05) * 0.42 + dith * 0.6;
    put(x, y, shade > 0.92 ? sh : shade < 0.2 ? hi : mid);
  }
}

/** The tree in the middle of the garden: fruit hanging low enough to reach. */
function knowledgeTree(withFruit) {
  return paintCanvas(56, 98, put => {
    const bark = '#4c3a29', barkHi = '#6b5238', barkSh = '#2c2117';
    const hi = '#6f9c4e', mid = '#3f6b3a', sh = '#26452b';
    // trunk and two branches
    for (let y = 52; y < 98; y++) {
      const w = 3 + Math.round((y - 52) * 0.06);
      for (let x = 28 - w; x <= 28 + w; x++) put(x, y, x < 28 ? barkHi : x > 28 + w - 2 ? barkSh : bark);
    }
    for (let i = 0; i < 10; i++) { put(28 - 4 - i, 56 - i, bark); put(28 + 4 + i, 58 - i, barkSh); }
    // canopy: tall, narrow, three masses
    canopy(put, 28, 30, 20, 26, hi, mid, sh, 11);
    canopy(put, 18, 40, 13, 15, hi, mid, sh, 23);
    canopy(put, 38, 40, 13, 15, hi, mid, sh, 31);
    if (withFruit) {
      const fruit = [[22, 44], [30, 47], [36, 42], [26, 36], [34, 33], [20, 38], [40, 47]];
      for (const [fx, fy] of fruit) {
        put(fx, fy, '#c93a28'); put(fx + 1, fy, '#e0603c'); put(fx, fy + 1, '#a02a1c');
        put(fx + 1, fy - 1, '#f2a072');
      }
    }
  });
}

/** The other tree: broad, pale, in flower. */
function lifeTree() {
  return paintCanvas(60, 90, put => {
    const bark = '#5b4a36', barkHi = '#7d6647', barkSh = '#33291d';
    const hi = '#8fae6a', mid = '#5c8046', sh = '#3a5730';
    for (let y = 48; y < 90; y++) {
      const w = 4 + Math.round((y - 48) * 0.05);
      for (let x = 30 - w; x <= 30 + w; x++) put(x, y, x < 30 ? barkHi : bark);
    }
    canopy(put, 30, 30, 26, 24, hi, mid, sh, 5);
    canopy(put, 30, 14, 16, 12, hi, mid, sh, 17);
    // blossom
    for (let i = 0; i < 40; i++) {
      const x = 6 + Math.floor(hash(i * 2.7) * 46), y = 6 + Math.floor(hash(i * 5.1) * 34);
      put(x, y, hash(i) > 0.5 ? '#f4ecd2' : '#e8d9a8');
    }
  });
}

/** The serpent, coiled on a branch with its head up. */
function serpentSprite() {
  return paintCanvas(32, 22, put => {
    const body = '#4a6b3a', dark = '#22301a', belly = '#93a86a', eye = '#e8c24a';
    // coil
    for (let x = 2; x <= 20; x++) {
      const y = 13 + Math.round(Math.sin(x * 0.8) * 2);
      put(x, y, body); put(x, y + 1, dark); put(x, y - 1, belly);
    }
    for (let x = 6; x <= 16; x++) { put(x, 17, body); put(x, 18, dark); }
    // raised neck and head
    for (let i = 0; i < 7; i++) put(20 + Math.round(i * 0.4), 12 - i, body);
    put(23, 4, body); put(24, 4, body); put(25, 4, dark);
    put(24, 6, body); put(25, 6, body); put(26, 6, dark);
    put(24, 3, dark); put(25, 3, dark);
    put(25, 5, eye);
  });
}

// ---- garden dressing --------------------------------------------------
function hedgeSprite() {
  return paintCanvas(34, 20, put => {
    const hi = '#57794a', mid = '#3a5a34', sh = '#22381f';
    for (let y = 3; y < 20; y++) for (let x = 0; x < 34; x++) {
      const top = 3 + Math.round(Math.sin(x * 0.5) * 2 + hash(x * 3.3) * 2);
      if (y < top) continue;
      const dith = ((x + y) % 4 < 2) ? 0.55 : 0;
      const shade = ((y - top) / 14) * 0.8 + dith * 0.4;
      put(x, y, shade > 0.95 ? sh : shade < 0.3 ? hi : mid);
    }
  });
}

function stumpSprite() {
  return paintCanvas(26, 18, put => {
    const bark = '#4c3a29', barkSh = '#2c2117', ring = '#8a6f4c', ringSh = '#6a5236';
    for (let y = 8; y < 18; y++) for (let x = 2; x < 24; x++) put(x, y, x < 12 ? bark : barkSh);
    for (let x = 2; x < 24; x++) { put(x, 7, ring); put(x, 8, ringSh); }
    for (let x = 8; x < 20; x += 3) put(x, 7, ringSh);
    // splinters
    put(6, 5, bark); put(7, 6, barkSh); put(19, 4, bark); put(20, 6, barkSh);
  });
}

function shootSprite() {
  return paintCanvas(16, 22, put => {
    const stem = '#5c8046', hi = '#8fae6a', dark = '#3a5730';
    for (let y = 6; y <= 21; y++) put(8, y, stem);
    for (let x = 3; x <= 7; x++) put(x, 10 - (x === 3 ? 0 : Math.round((7 - x) * 0.5)), hi);
    for (let x = 9; x <= 13; x++) put(x, 8 + Math.round((x - 9) * 0.6), hi);
    put(5, 11, dark); put(11, 11, dark);
    put(8, 21, '#3a5730');
  });
}

function bushSprite(seed) {
  return paintCanvas(20, 14, put => {
    const hi = '#6d9152', mid = '#456a3a', sh = '#2b452a';
    for (let y = 0; y < 14; y++) for (let x = 0; x < 20; x++) {
      const dx = (x - 10) / 9, dy = (y - 13) / 12;
      if (dx * dx + dy * dy > 1) continue;
      if (hash(seed + x * 2.3 + y * 4.7) < 0.15) continue;
      const dith = ((x + y) % 4 < 2) ? 0.55 : 0;
      put(x, y, ((dx + dy) * 0.5 + dith * 0.5) > 0.8 ? sh : ((dx + dy) * 0.5 + dith * 0.5) < 0.1 ? hi : mid);
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
  SP.eve = personSprite('eve', 'idle');
  SP.eveReach = personSprite('eve', 'reach');
  SP.adam = personSprite('adam', 'idle');
  SP.knowTree = knowledgeTree(true);
  SP.knowTreeBare = knowledgeTree(false);
  SP.lifeTree = lifeTree();
  SP.serpent = serpentSprite();
  SP.hedge = hedgeSprite();
  SP.stump = stumpSprite();
  SP.shoot = shootSprite();
  SP.bushes = [bushSprite(2), bushSprite(9), bushSprite(15)];
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
const GARDEN = { x: 0, z: 26, r: 15.5 };
const KNOW = { x: 5.0, z: 24.5 };     // the tree in the middle of the garden
const LIFE = { x: -6.2, z: 27.5 };    // the other tree, in flower

// scattered dressing: deterministic, so every frame agrees
const BUSHES = [];
for (let i = 0; i < 12; i++) {
  const a = hash(i * 1.7) * Math.PI * 2, r = GARDEN.r - 3.2 + hash(i * 3.3) * 2.6;
  BUSHES.push({ x: GARDEN.x + Math.cos(a) * r, z: GARDEN.z + Math.sin(a) * r * 0.8, s: 0.7 + hash(i * 7.1) * 0.9 });
}
const STONES = [];
for (let i = 0; i < 9; i++) {
  const a = hash(i * 2.9) * Math.PI * 2, r = 5 + hash(i * 6.1) * (GARDEN.r - 4);
  STONES.push({ x: GARDEN.x + Math.cos(a) * r, z: GARDEN.z + Math.sin(a) * r * 0.8 });
}
const TUFT_POS = [];
for (let i = 0; i < 120; i++) {
  TUFT_POS.push({ x: -26 + hash(i * 1.3) * 54, z: 6 + hash(i * 2.9) * 46 });
}

function drawSky(pal, t) {
  const sky = g.createLinearGradient(0, 0, 0, CAM.hy + 60);
  sky.addColorStop(0, pal.skyTop); sky.addColorStop(0.6, pal.skyMid); sky.addColorStop(1, pal.skyLow);
  g.fillStyle = sky; g.fillRect(0, 0, ART_W, CAM.hy + 60);

  // the sun: a disc high behind the garden, bloomed by the post pass
  if ((pal._night ?? 0) < 0.5) {
    const sx = ART_W * 0.72, sy = CAM.hy * 0.42;
    glow(sx, sy, 120, 'rgb(255,236,190)', 0.28);
    g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(sx, sy, 16, 0, 7); g.fill();
  }
  // a few slow cloud bands, dithered so they sit in the pixel grid
  for (let i = 0; i < 5; i++) {
    const cy = CAM.hy * (0.18 + i * 0.11);
    const cw = 260 + hash(i * 3.1) * 240;
    const cx = ((hash(i * 5.7) * ART_W + t * (2 + i)) % (ART_W + 400)) - 200;
    g.globalAlpha = 0.16 + hash(i * 2.2) * 0.1;
    g.fillStyle = mix(pal.skyLow, '#ffffff', 0.5);
    g.beginPath(); g.ellipse(cx, cy, cw * 0.5, 9 + hash(i) * 6, 0, 0, 7); g.fill();
    g.globalAlpha = 1;
  }
  const night = pal._night ?? 0;
  if (night > 0.05) {
    for (let i = 0; i < 80; i++) {
      const x = hash(i * 2.3) * ART_W, y = hash(i * 5.9) * (CAM.hy - 30);
      g.fillStyle = `rgba(230,225,255,${(0.2 + 0.5 * hash(i * 7.7)) * night})`;
      g.fillRect(x | 0, y | 0, 1, 1);
    }
  }
}

function drawRidges(pal) {
  for (const [z, amp, col] of [[210, 13, mix(pal.fog, pal.skyLow, 0.5)], [130, 8, mix(pal.fog, '#7d8f78', 0.55)]]) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, CAM.hy + 10);
    const N2 = 16;
    for (let i = 0; i <= N2; i++) {
      const xw = -120 + (i / N2) * 240;
      const p = P(xw, 0, z);
      g.lineTo(p.x, p.y - amp * (0.5 + hash(i * 4.1 + z) * 0.5));
    }
    g.lineTo(ART_W, CAM.hy + 10); g.closePath(); g.fill();
  }
}

function drawRiver(pal) {
  // a band of water behind the garden; it catches the sky
  const p0 = P(-34, 0, 33), p1 = P(34, 0, 33), p2 = P(34, 0, 39), p3 = P(-34, 0, 39);
  g.beginPath();
  g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y);
  g.closePath();
  // banks first, so the water has an edge instead of a cut
  g.fillStyle = mix(pal.ground, pal.ink, 0.35);
  g.fillRect(0, p0.y - 2, ART_W, 3);
  const wat = g.createLinearGradient(0, p0.y, 0, p3.y);
  wat.addColorStop(0, mix(pal.fog, '#4a7d92', 0.55));
  wat.addColorStop(0.5, mix(pal.fog, '#356072', 0.5));
  wat.addColorStop(1, mix(pal.ground, '#2d4f5c', 0.6));
  g.fillStyle = wat; g.fill();
  g.fillStyle = 'rgba(20,32,34,0.35)';
  g.fillRect(0, p3.y - 2, ART_W, 3);
  // glints
  for (let i = 0; i < 40; i++) {
    const x = -32 + hash(i * 3.7) * 64, z = 33.4 + hash(i * 5.9) * 5.2;
    const p = P(x, 0, z);
    g.fillStyle = `rgba(255,255,255,${0.10 + hash(i) * 0.16})`;
    g.fillRect(p.x, p.y, Math.max(2, p.s * 0.5), 1);
  }
}

function drawGround(pal, t) {
  const grd = g.createLinearGradient(0, CAM.hy - 10, 0, ART_H);
  grd.addColorStop(0, mix(pal.ground, pal.fog, 0.55));
  grd.addColorStop(0.35, mix(pal.ground, pal.fog, 0.22));
  grd.addColorStop(1, mix(pal.ground, pal.ink, 0.28));
  g.fillStyle = grd; g.fillRect(0, CAM.hy - 10, ART_W, ART_H - CAM.hy + 10);
  drawRiver(pal);

  // turf marks
  for (let i = 0; i < 300; i++) {
    const x = -28 + hash(i * 1.7) * 56, z = 6 + hash(i * 4.3) * 42;
    const p = P(x, 0, z);
    if (p.dz <= 1) continue;
    const dark = hash(i * 9.1) > 0.45;
    g.fillStyle = dark ? 'rgba(24,36,20,0.22)' : 'rgba(210,225,190,0.07)';
    g.fillRect(p.x, p.y, Math.max(1, p.s * 0.09), Math.max(1, p.s * 0.05));
  }
  // turf patches
  for (let i = 0; i < 30; i++) {
    const x = -26 + hash(i * 4.7) * 54, z = 7 + hash(i * 8.3) * 38;
    const p = P(x, 0, z);
    if (p.dz <= 1) continue;
    g.fillStyle = `rgba(30,44,24,${0.06 + hash(i) * 0.07})`;
    g.beginPath();
    g.ellipse(p.x, p.y, (1.4 + hash(i * 2.2) * 3) * p.s * 0.5, (0.5 + hash(i * 3.1)) * p.s * 0.22, 0, 0, 7);
    g.fill();
  }
  // dappled light under the canopy
  for (let i = 0; i < 26; i++) {
    const x = -14 + hash(i * 5.3) * 28, z = 12 + hash(i * 7.9) * 22;
    const p = P(x, 0, z);
    if (p.dz <= 1) continue;
    const rad = (0.9 + hash(i * 2.1) * 2.2) * p.s * 0.5;
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
    gr.addColorStop(0, `rgba(255,240,190,${0.07 + hash(i) * 0.06})`);
    gr.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(p.x, p.y, rad, rad * 0.36, 0, 0, 7); g.fill();
  }

  // a path worn between the trees and out of frame
  const pts = [[3.0, 20], [1.5, 16], [-1.0, 12], [-5.0, 8], [-11, 4]];
  const pathG = g.createLinearGradient(0, CAM.hy, 0, ART_H);
  pathG.addColorStop(0, 'rgba(150,132,96,0)');
  pathG.addColorStop(0.5, 'rgba(150,132,96,0.10)');
  pathG.addColorStop(1, 'rgba(150,132,96,0.16)');
  g.fillStyle = pathG;
  g.beginPath();
  pts.forEach(([x, z], i) => { const p = P(x, 0, z); const w = 0.8 * p.s; i ? g.lineTo(p.x - w, p.y) : g.moveTo(p.x - w, p.y); });
  for (let i = pts.length - 1; i >= 0; i--) { const [x, z] = pts[i]; const p = P(x, 0, z); g.lineTo(p.x + 0.9 * p.s, p.y); }
  g.closePath(); g.fill();
}

function drawHedgeRing(pal) {
  // only the far arc, so it frames the garden instead of blocking it
  for (let i = 0; i < 66; i++) {
    const a = (i / 66) * Math.PI * 2;
    if (Math.sin(a) < -0.72) continue;
    const x = GARDEN.x + Math.cos(a) * GARDEN.r;
    const z = GARDEN.z + Math.sin(a) * GARDEN.r;
    drawSprite(SP.hedge, x, 0, z, 1.35 + hash(i * 3.7) * 0.35, pal);
  }
}

function drawGarden(pal, t) {
  drawHedgeRing(pal);
  drawSprite(SP.lifeTree, LIFE.x, 0, LIFE.z, 6.4, pal);
  drawSprite(SP.knowTree, KNOW.x, 0, KNOW.z, 7.4, pal);
  for (let i = 0; i < STONES.length; i++) drawSprite(SP.rocks[i % 3], STONES[i].x, 0, STONES[i].z, 0.5, pal);
  for (const b of BUSHES) drawSprite(SP.bushes[Math.floor(hash(b.x + b.z) * 3) % 3], b.x, 0, b.z, b.s, pal);
  for (let i = 0; i < TUFT_POS.length; i += 3) {
    const p = TUFT_POS[i];
    drawSprite(SP.tufts[i % 3], p.x, 0, p.z, 0.4 + hash(i) * 0.25, pal, { shadow: false });
  }
}

function drawPerson(x, z, who, pose, pal, light) {
  const sprite = who === 'eve' ? (pose === 'reach' ? SP.eveReach : SP.eve) : SP.adam;
  drawSprite(sprite, x, 0, z, 1.72, pal, { light });
}

function drawPollen(pal, t) {
  for (let i = 0; i < 60; i++) {
    const ph = hash(i * 1.9);
    const x = -8 + hash(i * 3.1) * 20 + Math.sin(t * 0.4 + ph * 8) * 1.2;
    const z = 14 + hash(i * 7.3) * 18 + Math.cos(t * 0.33 + ph * 5) * 1.0;
    const y = 0.3 + ((ph * 2.6 + t * 0.11) % 2.6);
    const p = P(x, y, z);
    if (p.dz <= 1) continue;
    g.fillStyle = `rgba(255,242,206,${clamp(0.10 + 0.16 * Math.sin(t * 1.7 + i))})`;
    g.fillRect(p.x | 0, p.y | 0, 1, 1);
  }
}

function drawTree(x, z, tall, pal) {
  drawSprite(tall ? SP.trees[0] : SP.trees[1], x, 0, z, tall ? 5.2 : 3.0, pal);
}

function drawForeground(pal, x, z, hM, which = 0) {
  drawSprite(SP.rocks[which], x, 0, z, hM, pal, { light: 0.05, shadow: false });
}

// rocks and tufts still come from the same painters as the other films
function rockSprite(seed) {
  const W = 34, H = 24;
  return paintCanvas(W, H, put => {
    const top = '#8d9484', lit = '#767c6d', mid = '#5a6154', sh = '#3a4038', ink = '#242a24';
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
      const facet = y < 11 - (x - 14) * 0.12 ? 2 : x < 17 ? 1 : 0;
      const dith = ((x + y) % 4 < 2) ? 1 : 0;
      let col = facet === 2 ? (dith ? top : lit) : facet === 1 ? (dith ? lit : mid) : (dith ? sh : ink);
      if (hash(seed + x * 2.1 + y * 5.3) < 0.08) col = ink;
      put(x, y, col);
    }
  });
}

function tuftSprite(seed) {
  return paintCanvas(10, 7, put => {
    for (let i = 0; i < 6; i++) {
      const x = 1 + Math.floor(hash(seed + i) * 8);
      const h = 2 + Math.floor(hash(seed + i * 3) * 4);
      for (let y = 0; y < h; y++) put(x, 6 - y, h > 3 ? '#7a9a5e' : '#557a48');
    }
  });
}

function treeSprite(seed, tall) {
  const H = tall ? 56 : 34, W = tall ? 30 : 22;
  return paintCanvas(W, H, put => {
    const trunk = '#3e3226', leafHi = '#6f9455', leaf = '#3f6b3a', leafSh = '#27452b';
    for (let y = H - 16; y < H; y++) for (let x = W / 2 - 1; x <= W / 2 + 1; x++) put(x, y, trunk);
    canopy(put, W / 2, H - 22, W * 0.46, H * 0.34, leafHi, leaf, leafSh, seed);
  });
}

// ---------------------------------------------------------------- shots
const SHOTS = [
  { // I — the garden, whole, and the tree in the middle of it
    t0: 0, t1: 10, cam: { x: 0.5, y: 8.2, z: 4.5, f: 330, hy: 146 },
    focus: 0.62, blur: 5, light: { x: 2.0, z: 21, r: 16 },
    card: { numeral: 'I', title: 'THE QUESTION', in: 0.5, out: 3.8 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal); drawGround(pal, t); drawGarden(pal, t);
      drawPerson(-0.8, 22.6, 'adam', 'idle', pal, 0.55);
      drawPerson(1.3, 22.0, 'eve', 'idle', pal, 0.6);
      drawPollen(pal, t);
    },
  },
  { // II — the tree, and the command that came with it
    t0: 10, t1: 22, cam: { x: 4.2, y: 5.0, z: 11.5, f: 380, hy: 154 },
    focus: 0.58, blur: 5.5, light: { x: 5.0, z: 23, r: 13 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal); drawGround(pal, t); drawGarden(pal, t);
      drawPerson(2.6, 22.4, 'eve', 'idle', pal, 0.75);
      drawPollen(pal, t);
      drawForeground(pal, -0.6, 15.0, 1.0, 1);
    },
  },
  { // III — freedom: she stands where she can still walk away
    t0: 22, t1: 34, cam: { x: -1.0, y: 4.2, z: 12.0, f: 380, hy: 152 },
    focus: 0.60, blur: 5.5, light: { x: 4.6, z: 23.4, r: 12 },
    card: { numeral: 'II', title: 'FREEDOM', in: 22.4, out: 25.4 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal); drawGround(pal, t); drawGarden(pal, t);
      drawPerson(2.9, 22.0, 'eve', 'idle', pal, 0.5);
      drawPollen(pal, t);
      drawForeground(pal, -4.2, 13.0, 1.2, 2);
    },
  },
  { // IV — foreknowledge: the lamp shows the path; it does not walk you down it
    t0: 34, t1: 46, cam: { x: -2.0, y: 3.0, z: 8.6, f: 380, hy: 150 },
    focus: 0.70, blur: 5, light: { x: -2.4, z: 14.5, r: 8 },
    card: { numeral: 'III', title: 'FOREKNOWLEDGE', in: 34.4, out: 37.6 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal); drawGround(pal, t);
      drawSprite(SP.lifeTree, LIFE.x, 0, LIFE.z, 6.4, pal);

      // the path, worn before anyone walks it
      for (let i = 0; i < 26; i++) {
        const fz = 6.5 + i * 1.15, fx = -1.1 - (i * 1.15) * 0.62 + Math.sin(i * 0.55) * 0.4;
        const fp = P(fx, 0, fz);
        if (fp.dz <= 1) continue;
        g.fillStyle = `rgba(74,58,38,${0.30 - i * 0.006})`;
        g.beginPath();
        g.ellipse(fp.x, fp.y, Math.max(2, fp.s * 0.16), Math.max(1, fp.s * 0.07), 0, 0, 7);
        g.fill();
      }

      // the lantern: a post, a flame, and a pool it owns
      const post = P(-2.4, 0, 14.5);
      const lp = P(-2.4, 1.42, 14.5);
      g.fillStyle = mix('#4c3a29', pal.ink, 0.3);
      g.fillRect(post.x - 2, lp.y + 4, 3, post.y - lp.y - 4);
      g.fillStyle = '#2a2018'; g.fillRect(lp.x - 4, lp.y - 1, 9, 3);
      g.fillStyle = pal.warm; g.fillRect(lp.x - 3, lp.y - 6, 7, 6);
      g.fillStyle = '#fff4d8'; g.fillRect(lp.x - 1, lp.y - 5, 3, 4);
      glow(lp.x, lp.y - 3, 90, 'rgb(255,206,140)', 0.42);
      glow(lp.x, lp.y - 3, 220, 'rgb(255,180,110)', 0.16);
      g.save();
      g.translate(post.x, post.y); g.scale(1, 0.4);
      const pool = g.createRadialGradient(0, 0, 0, 0, 0, 5.4 * post.s);
      pool.addColorStop(0, 'rgba(255,206,140,0.34)');
      pool.addColorStop(1, 'rgba(255,190,120,0)');
      g.fillStyle = pool; g.beginPath(); g.arc(0, 0, 5.4 * post.s, 0, 7); g.fill();
      g.restore();

      for (let i = 0; i < 5; i++) {
        drawSprite(SP.tufts[i % 3], -5.5 + i * 0.9, 0, 10.2 + i * 0.4, 0.5, pal, { shadow: false });
      }
      drawPollen(pal, t);
      drawForeground(pal, -5.0, 6.6, 1.0, 0);
    },
  },
  { // V — trust: the fruit within reach, the lie above it
    t0: 46, t1: 59, cam: { x: 5.4, y: 3.0, z: 16.6, f: 430, hy: 152 },
    focus: 0.52, blur: 5.5, light: { x: 5.2, z: 23.5, r: 9 },
    card: { numeral: 'IV', title: 'TRUST', in: 46.4, out: 49.4 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal); drawGround(pal, t);
      drawSprite(SP.bushes[1], 2.2, 0, 19.0, 1.5, pal);
      drawSprite(SP.lifeTree, LIFE.x, 0, LIFE.z, 6.4, pal);
      drawSprite(SP.knowTree, KNOW.x, 0, KNOW.z, 7.4, pal);
      // the serpent is coiled on the lowest branch, just above her hand
      drawSprite(SP.serpent, 6.35, 2.30, 25.3, 0.78, pal, { light: 0.4, shadow: false });
      drawPerson(4.05, 23.2, 'eve', 'reach', pal, 0.85);
      drawPollen(pal, t);
    },
  },
  { // VI — relocation: the stump, and what grows beside it
    t0: 59, t1: 70, cam: { x: 5.2, y: 3.4, z: 17.8, f: 430, hy: 150 },
    focus: 0.62, blur: 5.5, light: { x: 4.4, z: 23, r: 12 },
    card: { numeral: 'V', title: 'RELOCATION', in: 59.4, out: 62.4 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal); drawGround(pal, t); drawHedgeRing(pal);
      drawSprite(SP.lifeTree, LIFE.x, 0, LIFE.z, 6.4, pal);
      drawSprite(SP.stump, KNOW.x, 0, KNOW.z, 0.55, pal);
      drawSprite(SP.shoot, 6.1, 0, 25.4, 0.85, pal, { shadow: false });
      for (let i = 0; i < BUSHES.length; i += 2) {
        const b = BUSHES[i];
        drawSprite(SP.bushes[i % 3], b.x, 0, b.z, b.s, pal);
      }
      drawPollen(pal, t);
    },
  },
  { // VII — a fortunate fall, if that tradition is true
    t0: 70, t1: 84, cam: { x: 5.9, y: 3.5, z: 17.6, f: 410, hy: 148 },
    focus: 0.64, blur: 5.5, light: { x: 0.5, z: 20, r: 16 },
    card: { numeral: 'VI', title: 'FELIX CULPA', in: 70.4, out: 73.6 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal); drawGround(pal, t);
      drawHedgeRing(pal);
      drawSprite(SP.lifeTree, LIFE.x, 0, LIFE.z, 6.4, pal);
      drawSprite(SP.stump, KNOW.x, 0, KNOW.z, 0.55, pal);
      drawSprite(SP.shoot, 5.92, 0, 25.6, 1.0, pal, { shadow: false });
      drawPollen(pal, t);
    },
  },
  { // VIII — the open question
    t0: 84, t1: 105, cam: { x: 0.5, y: 7.6, z: 6.0, f: 330, hy: 148 },
    focus: 0.62, blur: 5, light: { x: 1.0, z: 21, r: 16 },
    card: { numeral: 'VII', title: 'THE OPEN QUESTION', in: 84.4, out: 87.6 },
    draw(t, pal) {
      drawSky(pal, t); drawRidges(pal); drawGround(pal, t); drawGarden(pal, t);
      drawPerson(-0.4, 22.2, 'adam', 'idle', pal, 0.6);
      drawPerson(1.6, 22.6, 'eve', 'idle', pal, 0.65);
      drawPollen(pal, t);
    },
  },
];

// narration, in the order it is spoken (the .srt is exported from this list)
const SUBS = [
  { text: 'He knew what she would do.', in: 10.6, out: 13.6 },
  { text: 'He made the tree anyway.', in: 14.0, out: 17.2 },
  { text: 'And left it standing in the middle of the garden.', in: 17.6, out: 21.6 },
  { text: 'The first answer is freedom.', in: 23.0, out: 26.4 },
  { text: 'A love that cannot refuse is not love.', in: 26.8, out: 30.2 },
  { text: 'Take the tree away and obedience becomes machinery.', in: 30.6, out: 33.8 },
  { text: 'The second answer: knowing is not causing.', in: 35.0, out: 38.2 },
  { text: 'A lantern shows the path. It does not walk you down it.', in: 38.6, out: 42.6 },
  { text: 'Foreknowledge sees. It does not push.', in: 43.0, out: 45.8 },
  { text: 'The third answer: the command was the relationship.', in: 47.0, out: 50.2 },
  { text: 'One tree, one word — trust me about this one.', in: 50.6, out: 54.2 },
  { text: "The serpent never argued about fruit. It argued about God's character.", in: 54.6, out: 58.8 },
  { text: 'The fourth answer: removing it would have fixed nothing.', in: 60.0, out: 63.6 },
  { text: 'The temptation was never the tree.', in: 64.0, out: 66.8 },
  { text: 'Remove one occasion, and another grows in its place.', in: 67.2, out: 69.8 },
  { text: 'The fifth answer is stranger.', in: 71.0, out: 74.0 },
  { text: 'The cross was not an emergency.', in: 74.4, out: 77.6 },
  { text: 'Some traditions call the fall fortunate: the rescue was planned before the garden.', in: 78.0, out: 83.6 },
  { text: 'These are traditions, not a proof.', in: 85.0, out: 89.0 },
  { text: 'Augustine, Aquinas, Boethius and the Eastern fathers each hold a piece of it.', in: 89.4, out: 95.2 },
  { text: 'The question stays open. Perhaps it was meant to.', in: 95.6, out: 100.0 },
];

// ---------------------------------------------------------------- HUD
const FONT_SERIF = 'DejaVu Serif';

function chapterCard(card, t, pal) {
  const a = smooth(seg(t, card.in, card.in + 0.55)) * (1 - smooth(seg(t, card.out, card.out + 0.6)));
  if (a <= 0.01) return;
  o.save();
  o.globalAlpha = a;
  o.textAlign = 'center';
  // plate: a dark swell so cream type never sits on a pale sky
  const plate = o.createRadialGradient(OUT_W / 2, OUT_H * 0.175, 0, OUT_W / 2, OUT_H * 0.175, OUT_W * 0.34);
  plate.addColorStop(0, 'rgba(8,12,14,0.62)');
  plate.addColorStop(0.55, 'rgba(8,12,14,0.34)');
  plate.addColorStop(1, 'rgba(8,12,14,0)');
  o.fillStyle = plate;
  o.fillRect(0, 0, OUT_W, OUT_H * 0.42);
  o.fillStyle = '#fdf6e6';
  o.shadowColor = 'rgba(0,0,0,0.8)'; o.shadowBlur = 14;
  o.font = `${44}px ${FONT_SERIF}`;
  o.fillText(card.numeral, OUT_W / 2, OUT_H * 0.145);
  o.font = `${30}px ${FONT_SERIF}`;
  const title = card.title.split('').join(' ');
  o.fillText(title, OUT_W / 2, OUT_H * 0.205);
  o.strokeStyle = 'rgba(232,207,148,0.75)'; o.lineWidth = 1;
  o.beginPath(); o.moveTo(OUT_W / 2 - 150, OUT_H * 0.145 - 26); o.lineTo(OUT_W / 2 + 150, OUT_H * 0.145 - 26); o.stroke();
  o.beginPath(); o.moveTo(OUT_W / 2 - 150, OUT_H * 0.205 + 22); o.lineTo(OUT_W / 2 + 150, OUT_H * 0.205 + 22); o.stroke();
  o.shadowBlur = 0;
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

function endCard(t) {
  const a = smooth(seg(t, 100.4, 101.2)) * (1 - smooth(seg(t, 104.0, 104.8)));
  if (a <= 0.01) return;
  o.save();
  o.globalAlpha = a;
  o.textAlign = 'center';
  const plate = o.createRadialGradient(OUT_W / 2, OUT_H * 0.52, 0, OUT_W / 2, OUT_H * 0.52, OUT_W * 0.36);
  plate.addColorStop(0, 'rgba(8,10,14,0.72)');
  plate.addColorStop(0.6, 'rgba(8,10,14,0.42)');
  plate.addColorStop(1, 'rgba(8,10,14,0)');
  o.fillStyle = plate;
  o.fillRect(0, OUT_H * 0.18, OUT_W, OUT_H * 0.66);
  o.fillStyle = '#fdf7e8';
  o.shadowColor = 'rgba(0,0,0,0.75)'; o.shadowBlur = 16;
  o.font = `38px ${FONT_SERIF}`;
  o.fillText('G E N E S I S   2 – 3', OUT_W / 2, OUT_H * 0.45);
  o.strokeStyle = 'rgba(232,207,148,0.7)'; o.lineWidth = 1;
  o.beginPath(); o.moveTo(OUT_W / 2 - 170, OUT_H * 0.485); o.lineTo(OUT_W / 2 + 170, OUT_H * 0.485); o.stroke();
  o.fillStyle = 'rgba(240,231,214,0.92)';
  o.font = `24px ${FONT_SERIF}`;
  o.fillText('A  Q U E S T I O N ,   N O T   A   V E R D I C T', OUT_W / 2, OUT_H * 0.535);
  o.fillStyle = 'rgba(226,214,190,0.62)';
  o.font = `${16}px ${FONT_SERIF}`;
  o.fillText('AUGUSTINE  ·  AQUINAS  ·  BOETHIUS  ·  THE EASTERN FATHERS', OUT_W / 2, OUT_H * 0.60);
  o.shadowBlur = 0;
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

  bloomAndComposite(OUT_H * shot.focus, shot.blur, 0.45 + 0.55 * (pal._night ?? 0));
  if (shot.card) chapterCard(shot.card, t, pal);
  for (const sub of SUBS) if (t >= sub.in - 0.4 && t <= sub.out + 0.5) subtitle(sub, t);
  if (t > 100.3) endCard(t);

  // fade in from black and out at the end
  const fade = Math.min(1, seg(t, 0, 0.8)) * (1 - seg(t, 104.2, 105));
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
