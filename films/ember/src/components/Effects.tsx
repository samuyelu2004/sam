import React from 'react';
import { C } from '../theme';
import { clamp, hash, lerp, rng } from '../lib/anim';

/** A shaft of light: a soft-edged wedge with a hot core. */
export const LightBeam: React.FC<{
  x: number;
  y: number;
  angle?: number;
  width?: number;
  length?: number;
  color?: string;
  intensity?: number;
  seed?: number;
  t?: number;
}> = ({ x, y, angle = 90, width = 220, length = 900, color = C.gold, intensity = 0.5, seed = 1, t = 0 }) => {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  const flick = 0.92 + Math.sin(t * 3.1 + seed) * 0.05 + Math.sin(t * 7.7 + seed * 2) * 0.03;
  const w1 = width * 0.18;
  const w2 = width;
  const pts = [
    [x + px * w1, y + py * w1],
    [x - px * w1, y - py * w1],
    [x - px * w2 + dx * length, y - py * w2 + dy * length],
    [x + px * w2 + dx * length, y + py * w2 + dy * length],
  ];
  return (
    <g opacity={clamp(intensity * flick)} style={{ mixBlendMode: 'screen' }}>
      <defs>
        <linearGradient id={`beam-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.85" />
          <stop offset="0.55" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`beamBlur-${seed}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>
      <polygon points={pts.map((q) => q.join(',')).join(' ')} fill={`url(#beam-${seed})`} filter={`url(#beamBlur-${seed})`} />
      <polygon
        points={[
          [x + px * w1 * 0.5, y + py * w1 * 0.5],
          [x - px * w1 * 0.5, y - py * w1 * 0.5],
          [x - px * w1 * 1.6 + dx * length, y - py * w1 * 1.6 + dy * length],
          [x + px * w1 * 1.6 + dx * length, y + py * w1 * 1.6 + dy * length],
        ]
          .map((q) => q.join(','))
          .join(' ')}
        fill="#fff3d2"
        opacity={0.22}
        filter={`url(#beamBlur-${seed})`}
      />
    </g>
  );
};

/** Floating embers / sparks. Deterministic per index. */
export const Sparkles: React.FC<{ count?: number; t: number; seed?: number; area?: [number, number, number, number]; color?: string; rise?: number }> = ({
  count = 40,
  t,
  seed = 1,
  area = [0, 300, 720, 800],
  color = C.goldHot,
  rise = 60,
}) => {
  const r = rng(seed * 977 + 3);
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const x0 = area[0] + r() * (area[2] - area[0]);
        const y0 = area[1] + r() * (area[3] - area[1]);
        const speed = 0.25 + r() * 0.9;
        const drift = Math.sin(t * (0.6 + r()) + i) * 12;
        const y = y0 - ((t * rise * speed) % (area[3] - area[1]));
        const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * (1.4 + r() * 2) + i * 1.7));
        const rad = 1 + r() * 2.2;
        return <circle key={i} cx={x0 + drift} cy={y} r={rad} fill={color} opacity={tw * 0.85} />;
      })}
    </g>
  );
};

/** Fine dust caught in the light. */
export const Dust: React.FC<{ count?: number; t: number; seed?: number; opacity?: number }> = ({ count = 70, t, seed = 2, opacity = 0.35 }) => {
  const r = rng(seed * 131 + 7);
  return (
    <g opacity={opacity}>
      {Array.from({ length: count }).map((_, i) => {
        const x0 = r() * 720;
        const y0 = 380 + r() * 820;
        const sp = 0.15 + r() * 0.5;
        const y = y0 - ((t * 40 * sp) % 700);
        const x = x0 + Math.sin(t * 0.7 + i * 2.1) * 20;
        return <circle key={i} cx={x} cy={y} r={0.8 + r() * 1.6} fill={C.cream} opacity={0.5 * (1 - (y0 - y) / 900 + 0.3)} />;
      })}
    </g>
  );
};

export const Vignette: React.FC<{ strength?: number; color?: string }> = ({ strength = 0.9, color = '#05040a' }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(120% 78% at 50% 46%, rgba(0,0,0,0) 38%, rgba(5,4,10,${strength * 0.75}) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

export const Flash: React.FC<{ amount: number }> = ({ amount }) =>
  amount <= 0.001 ? null : (
    <div style={{ position: 'absolute', inset: 0, background: C.cream, opacity: clamp(amount) }} />
  );

/** Big soft glow behind a point. */
export const Glow: React.FC<{ x: number; y: number; r: number; color?: string; opacity?: number; id: string }> = ({
  x,
  y,
  r,
  color = C.gold,
  opacity = 0.5,
  id,
}) => (
  <g>
    <defs>
      <radialGradient id={id}>
        <stop offset="0" stopColor={color} stopOpacity={opacity} />
        <stop offset="0.6" stopColor={color} stopOpacity={opacity * 0.35} />
        <stop offset="1" stopColor={color} stopOpacity={0} />
      </radialGradient>
    </defs>
    <circle cx={x} cy={y} r={r} fill={`url(#${id})`} />
  </g>
);
