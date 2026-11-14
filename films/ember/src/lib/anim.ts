// Small maths helpers. Everything in the film is deterministic: the same frame
// always paints the same picture, which is what lets Remotion render in parallel.

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** 0→1 progress of t inside [a,b], clamped. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

export const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeIn = (k: number) => k * k * k;
export const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
export const easeBackOut = (k: number) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
/** Fade in over `inDur`, out over `outDur`. */
export const window01 = (t: number, a: number, b: number, inDur = 0.25, outDur = 0.25) =>
  Math.min(seg(t, a, a + inDur), 1 - seg(t, b - outDur, b));

/** Deterministic pseudo random in [0,1) from an integer seed. */
export const hash = (n: number) => {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

/** Decaying hand-held wobble. */
export const wobble = (t: number, seed = 0) =>
  Math.sin(t * 1.7 + seed) * 0.45 + Math.sin(t * 2.9 + seed * 2.3) * 0.3;

/** Screen-shake impulse: a list of {at, amount} bursts, each decaying. */
export const shakeAt = (t: number, bursts: { at: number; amount: number }[] = []) => {
  let x = 0;
  let y = 0;
  for (const b of bursts) {
    const d = t - b.at;
    if (d < 0 || d > 0.9) continue;
    const k = Math.pow(1 - d / 0.9, 2) * b.amount;
    x += Math.sin(d * 61) * k;
    y += Math.cos(d * 47) * k * 0.8;
  }
  return { x, y };
};

/** Text that reveals word by word, returning how many words are visible. */
export const wordsIn = (t: number, a: number, b: number, count: number, stagger = 0.12) => {
  if (t < a) return 0;
  const elapsed = t - a;
  return Math.min(count, Math.floor(elapsed / stagger) + 1);
};
