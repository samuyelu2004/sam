import React from 'react';

/** 2:1 isometric projector. World units are "tiles"; S is pixels per tile. */
export type Proj = (x: number, y: number, z: number) => [number, number];

export const makeProj = (S: number, ox = 0, oy = 0): Proj => (x, y, z) => [
  ox + (x - y) * S * 0.866,
  oy + (x + y) * S * 0.5 - z * S,
];

export const mix = (hex: string, to: string, k: number) => {
  const a = hex.replace('#', '');
  const b = to.replace('#', '');
  const pa = [0, 2, 4].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [0, 2, 4].map((i) => parseInt(b.slice(i, i + 2), 16));
  const out = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
};

export const light = (hex: string, k: number) => mix(hex, '#ffffff', k);
export const dark = (hex: string, k: number) => mix(hex, '#000000', k);

type Pt3 = [number, number, number];

export const Poly: React.FC<{
  p: Proj;
  pts: Pt3[];
  fill: string;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeLinejoin?: 'round' | 'miter';
}> = ({ p, pts, fill, opacity = 1, stroke, strokeWidth = 0 }) => (
  <polygon
    points={pts.map((q) => p(q[0], q[1], q[2]).map((n) => n.toFixed(2)).join(',')).join(' ')}
    fill={fill}
    opacity={opacity}
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeLinejoin="round"
  />
);

/** An axis-aligned block. The two visible side faces are +x (screen right) and +y (screen left). */
export const Box: React.FC<{
  p: Proj;
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
  color: string;
  top?: number;
  sideX?: number;
  sideY?: number;
  opacity?: number;
  stroke?: string;
}> = ({ p, x, y, z = 0, w, d, h, color, top = 0.16, sideX = -0.06, sideY = -0.2, opacity = 1, stroke }) => {
  const z1 = z + h;
  return (
    <g opacity={opacity}>
      <Poly
        p={p}
        pts={[
          [x, y + d, z],
          [x + w, y + d, z],
          [x + w, y + d, z1],
          [x, y + d, z1],
        ]}
        fill={mix(color, '#000000', -sideY)}
        stroke={stroke}
      />
      <Poly
        p={p}
        pts={[[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z1], [x + w, y, z1]]}
        fill={mix(color, '#ffffff', -sideX)}
      />
      <Poly
        p={p}
        pts={[[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]]}
        fill={light(color, top)}
        stroke={stroke}
      />
    </g>
  );
};

/** Flat patch of ground in the iso plane. */
export const Slab: React.FC<{ p: Proj; x: number; y: number; w: number; d: number; z?: number; fill: string; opacity?: number }> = ({
  p,
  x,
  y,
  w,
  d,
  z = 0,
  fill,
  opacity = 1,
}) => (
  <Poly p={p} pts={[[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]]} fill={fill} opacity={opacity} />
);
