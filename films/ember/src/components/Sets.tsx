import React from 'react';
import { C } from '../theme';
import { Box, makeProj, Poly, Slab, mix, light, dark, Proj } from './Iso';
import { Character, CrowdPal, DisciplePal, JesusPal, ManPal, MarthaPal, MaryPal, Mode } from './Character';
import { clamp, hash, lerp, rng, seg } from '../lib/anim';

/* ------------------------------------------------------------------ backdrop */

export const Sky: React.FC<{ from: string; to: string; horizon?: string; stars?: number; t: number; seed?: number }> = ({
  from,
  to,
  horizon,
  stars = 0,
  t,
  seed = 1,
}) => (
  <g>
    <defs>
      <linearGradient id={`sky-${seed}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="0.55" stopColor={to} />
        {horizon ? <stop offset="1" stopColor={horizon} /> : null}
      </linearGradient>
    </defs>
    <rect x={0} y={0} width={720} height={1280} fill={`url(#sky-${seed})`} />
    {Array.from({ length: stars }).map((_, i) => {
      const x = hash(i * 3.1 + seed) * 720;
      const y = hash(i * 7.7 + seed * 2) * 520;
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.6 + hash(i) * 1.4) + i));
      return <circle key={i} cx={x} cy={y} r={hash(i * 9.2) * 1.4 + 0.5} fill={C.cream} opacity={tw * 0.55} />;
    })}
  </g>
);

export const Hills: React.FC<{ color: string; y?: number; opacity?: number }> = ({ color, y = 500, opacity = 1 }) => (
  <g opacity={opacity}>
    <path d={`M-40 ${y + 70} Q140 ${y - 30} 320 ${y + 20} Q500 ${y - 50} 760 ${y + 30} L760 ${y + 300} L-40 ${y + 300} Z`} fill={color} />
    <path d={`M-40 ${y + 130} Q200 ${y + 60} 400 ${y + 110} Q580 ${y + 40} 760 ${y + 110} L760 ${y + 340} L-40 ${y + 340} Z`} fill={mix(color, '#000000', 0.3)} />
  </g>
);

/* ------------------------------------------------------- the floating diorama */

export const Diorama: React.FC<{
  p: Proj;
  w?: number;
  d?: number;
  top?: string;
  edgeA?: string;
  edgeB?: string;
  depth?: number;
}> = ({ p, w = 5.4, d = 5.4, top = '#8a6a48', edgeA = '#5f4530', edgeB = '#3e2c1e', depth = 0.7 }) => {
  const x0 = -w / 2;
  const y0 = -d / 2;
  const x1 = w / 2;
  const y1 = d / 2;
  return (
    <g>
      {/* soil under the island */}
      <Poly p={p} pts={[[x0, y1, 0], [x1, y1, 0], [x1, y1, -depth], [x0, y1, -depth]]} fill={edgeA} />
      <Poly p={p} pts={[[x1, y0, 0], [x1, y1, 0], [x1, y1, -depth], [x1, y0, -depth]]} fill={edgeB} />
      <Poly
        p={p}
        pts={[[x0, y1, -depth * 0.34], [x1, y1, -depth * 0.34], [x1, y1, -depth * 0.42], [x0, y1, -depth * 0.42]]}
        fill={mix(edgeA, '#000000', 0.25)}
      />
      <Poly
        p={p}
        pts={[[x1, y0, -depth * 0.24], [x1, y1, -depth * 0.24], [x1, y1, -depth * 0.34], [x1, y0, -depth * 0.34]]}
        fill={mix(edgeB, '#000000', 0.25)}
      />
      <Poly p={p} pts={[[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]} fill={top} />
    </g>
  );
};

/* ---------------------------------------------------------------------- props */

export const House: React.FC<{
  p: Proj;
  x: number;
  y: number;
  w?: number;
  d?: number;
  h?: number;
  color?: string;
  lit?: number;
  faces?: 'y' | 'x';
}> = ({ p, x, y, w = 1.55, d = 1.4, h = 1.65, color = '#9c8258', lit = 0, faces = 'y' }) => (
  <g>
    <Box p={p} x={x} y={y} w={w} d={d} h={h} color={color} top={0.12} sideY={-0.26} sideX={-0.05} />
    {/* parapet */}
    <Box p={p} x={x - 0.06} y={y - 0.06} z={h} w={w + 0.12} d={d + 0.12} h={0.14} color={light(color, 0.14)} sideY={-0.16} />
    {/* door on the face we can see */}
    <Poly
      p={p}
      pts={
        faces === 'y'
          ? [[x + w * 0.3, y + d, 0], [x + w * 0.3, y + d, h * 0.5], [x + w * 0.52, y + d, h * 0.5], [x + w * 0.52, y + d, 0]]
          : [[x + w, y + d * 0.3, 0], [x + w, y + d * 0.3, h * 0.5], [x + w, y + d * 0.5, h * 0.5], [x + w, y + d * 0.5, 0]]
      }
      fill={lit > 0 ? mix('#3a2a1a', C.gold, 0.22 + lit * 0.7) : '#241d16'}
    />
    {/* window, sometimes lit */}
    <Poly
      p={p}
      pts={
        faces === 'y'
          ? [[x + w * 0.66, y + d, h * 0.54], [x + w * 0.66, y + d, h * 0.72], [x + w * 0.82, y + d, h * 0.72], [x + w * 0.82, y + d, h * 0.54]]
          : [[x + w, y + d * 0.62, h * 0.54], [x + w, y + d * 0.62, h * 0.72], [x + w, y + d * 0.8, h * 0.72], [x + w, y + d * 0.8, h * 0.54]]
      }
      fill={lit > 0 ? mix('#3a2a1a', C.goldHot, 0.25 + lit * 0.6) : '#1d1712'}
    />
    {lit > 0.2 ? (
      <Poly
        p={p}
        pts={
          faces === 'y'
            ? [[x + w * 0.66, y + d, h * 0.5], [x + w * 0.66, y + d, 0], [x + w * 0.9, y + d, 0], [x + w * 0.9, y + d, h * 0.5]]
            : [[x + w, y + d * 0.58, h * 0.5], [x + w, y + d * 0.58, 0], [x + w, y + d * 0.92, 0], [x + w, y + d * 0.92, h * 0.5]]
        }
        fill={C.gold}
        opacity={0.06 + lit * 0.1}
      />
    ) : null}
  </g>
);

export const Olive: React.FC<{ p: Proj; x: number; y: number; s?: number; sway?: number }> = ({ p, x, y, s = 1, sway = 0 }) => {
  const [sx, sy] = p(x, y, 0);
  return (
    <g transform={`translate(${sx},${sy}) scale(${s})`}>
      <ellipse cx={0} cy={2} rx={28} ry={8} fill="#000" opacity={0.22} />
      <path d="M-4 0 L-2 -52 L4 -54 L4 0 Z" fill="#4a3a2a" stroke="#241b14" strokeWidth={1.5} />
      <g transform={`rotate(${sway} 0 -50)`}>
        <ellipse cx={-12} cy={-66} rx={24} ry={19} fill={C.olive} stroke="#1f2418" strokeWidth={1.6} />
        <ellipse cx={14} cy={-72} rx={22} ry={17} fill={C.oliveLight} stroke="#1f2418" strokeWidth={1.6} />
        <ellipse cx={0} cy={-86} rx={20} ry={15} fill={mix(C.oliveLight, '#ffffff', 0.1)} />
        <ellipse cx={-4} cy={-58} rx={15} ry={11} fill={dark(C.olive, 0.25)} />
      </g>
    </g>
  );
};

export const Rock: React.FC<{ p: Proj; x: number; y: number; s?: number; color?: string }> = ({ p, x, y, s = 1, color = '#7a6f5f' }) => {
  const [sx, sy] = p(x, y, 0);
  return (
    <g transform={`translate(${sx},${sy}) scale(${s})`}>
      <ellipse cx={0} cy={1} rx={16} ry={5} fill="#000" opacity={0.2} />
      <path d="M-16 0 L-11 -15 L3 -21 L13 -10 L15 0 Z" fill={color} stroke="#2a231b" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M-11 -15 L3 -21 L4 -11 Z" fill={light(color, 0.2)} />
    </g>
  );
};

/* ------------------------------------------------------------------ the tomb */

export const TombCave: React.FC<{ p: Proj; x: number; y: number; stoneOpen?: number; glow?: number; scale?: number }> = ({
  p,
  x,
  y,
  stoneOpen = 0,
  glow = 0,
  scale = 1,
}) => {
  const [sx, sy] = p(x, y, 0);
  const S = 88 * scale;
  return (
    <g transform={`translate(${sx},${sy})`}>
      {/* rock face */}
      <path
        d={`M${-S * 2.3} 0 Q${-S * 1.9} ${-S * 1.5} ${-S * 0.7} ${-S * 1.9} Q${S * 0.6} ${-S * 2.35} ${S * 1.6} ${-S * 1.5} Q${S * 2.4} ${-S * 0.9} ${S * 2.4} 0 Z`}
        fill="#5a5045"
        stroke="#221c17"
        strokeWidth={3}
      />
      <path
        d={`M${-S * 2.3} 0 Q${-S * 1.7} ${-S * 1.2} ${-S * 0.2} ${-S * 1.5} L${-S * 0.4} 0 Z`}
        fill="#6c6254"
      />
      <path
        d={`M${S * 0.9} ${-S * 1.75} Q${S * 1.9} ${-S * 1.1} ${S * 2.0} ${-S * 0.1} L${S * 0.4} ${-S * 0.05} Z`}
        fill="#413930"
      />

      {/* the mouth */}
      <path d={`M${-S * 0.95} 0 L${-S * 0.95} ${-S * 1.05} Q${0} ${-S * 1.5} ${S * 0.95} ${-S * 1.05} L${S * 0.95} 0 Z`} fill="#0e0b09" />
      {glow > 0 ? (
        <path
          d={`M${-S * 0.85} 0 L${-S * 0.85} ${-S * 0.98} Q${0} ${-S * 1.4} ${S * 0.85} ${-S * 0.98} L${S * 0.85} 0 Z`}
          fill={mix('#3a2410', C.goldHot, 0.25 + glow * 0.75)}
          opacity={clamp(glow * 1.3)}
        />
      ) : null}

      {/* the round stone, rolled aside */}
      <g transform={`translate(${stoneOpen * S * 2.05},${-stoneOpen * S * 0.08})`}>
        <circle cx={0} cy={-S * 0.98} r={S * 1.06} fill="#8f8474" stroke="#1d1712" strokeWidth={4} />
        <circle cx={0} cy={-S * 0.98} r={S * 0.8} fill="none" stroke="#736959" strokeWidth={2.6} />
        <circle cx={-S * 0.26} cy={-S * 1.2} r={S * 0.24} fill="#9b9080" opacity={0.55} />
        <circle cx={S * 0.34} cy={-S * 0.72} r={S * 0.16} fill="#6a6053" opacity={0.7} />
      </g>
    </g>
  );
};

/* --------------------------------------------------------------- scene sets */

export type SetProps = { t: number; abs: number; dur: number };

const P = (s = 1) => makeProj(88 * s, 360, 760);

/* 1 — hook: the stone door splits and light comes out of it */
export const HookSet: React.FC<SetProps & { open: number }> = ({ t, open }) => {
  const cx = 360;
  const cy = 700;
  const R = 470;
  const w = 3 + open * 26;
  const glow = 0.14 + open * 0.5;
  const seam: [number, number][] = [
    [360, 250], [346, 330], [370, 408], [342, 496], [376, 588], [348, 686],
    [380, 782], [350, 880], [374, 976], [354, 1072], [366, 1150],
  ];
  const halfWidth = (i: number) => {
    const mid = 1 - Math.abs(i / (seam.length - 1) - 0.5) * 2;
    return w * (0.25 + 0.75 * mid);
  };
  const left = seam.map(([x, y], i) => [x - halfWidth(i), y] as [number, number]);
  const right = seam.map(([x, y], i) => [x + halfWidth(i), y] as [number, number]);
  const crackPath = 'M' + left.map((q) => q.join(' ')).join(' L ') + ' L ' + right.reverse().map((q) => q.join(' ')).join(' L ') + ' Z';
  return (
    <g>
      <rect x={0} y={0} width={720} height={1280} fill="#070506" />
      <defs>
        <radialGradient id="hookGlow" cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor={C.goldHot} stopOpacity={glow} />
          <stop offset="0.45" stopColor={C.gold} stopOpacity={glow * 0.35} />
          <stop offset="1" stopColor={C.gold} stopOpacity={0} />
        </radialGradient>
        <clipPath id="stoneClip">
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
        <filter id="hookBlur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={R * 1.5} fill="url(#hookGlow)" />
      <g clipPath="url(#stoneClip)">
        <circle cx={cx} cy={cy} r={R} fill="#241d1e" />
        {[0.94, 0.82, 0.7, 0.56, 0.42, 0.28].map((k, i) => (
          <circle key={i} cx={cx} cy={cy} r={R * k} fill="none" stroke="#2f2627" strokeWidth={2 + (i % 2) * 1.5} />
        ))}
        {Array.from({ length: 18 }).map((_, i) => {
          const k = hash(i * 4.4);
          const x = cx - R + k * R * 2;
          const y = cy - R + hash(i * 8.1) * R * 2;
          return (
            <path
              key={i}
              d={`M${x} ${y} l${18 + k * 26} ${-6 + hash(i) * 12} l${10 + k * 14} ${16 + k * 10} l${-22 - k * 12} ${8 + hash(i * 2) * 12} Z`}
              fill={mix('#2a2223', '#3a3030', k)}
              opacity={0.55}
            />
          );
        })}
        <g filter="url(#hookBlur)">
          <path d={crackPath} fill={C.gold} opacity={0.85} />
        </g>
        <path d={crackPath} fill="#fff3d4" opacity={0.5} />
        <path d={'M' + seam.map((q) => q.join(' ')).join(' L ')} stroke="#fffaf0" strokeWidth={Math.max(1.6, w * 0.16)} fill="none" opacity={0.9} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={R - 6} fill="none" stroke={mix('#1b1618', C.gold, 0.4 + open * 0.25)} strokeWidth={5} opacity={0.55} />
      </g>
      <g>
        {Array.from({ length: 22 }).map((_, i) => {
          const k = hash(i * 3.7);
          const x = cx + (k - 0.5) * (40 + w * 2.4);
          const y = 260 + hash(i * 5.3) * 900 - ((t * 90 + i * 40) % 900);
          return <circle key={i} cx={x} cy={y} r={1 + k * 2} fill={C.goldHot} opacity={0.35 + 0.65 * open} />;
        })}
      </g>
    </g>
  );
};

/* 2 — the sick room */
export const SickRoomSet: React.FC<SetProps> = ({ t }) => {
  const p = P(1.02);
  const lamp = 0.85 + Math.sin(t * 6.2) * 0.07 + Math.sin(t * 13.1) * 0.04;
  const lx = p(1.3, -1.35, 1.05);
  return (
    <g>
      <Sky from="#151021" to="#2b2139" horizon="#3a2b33" stars={12} t={t} seed={2} />
      <Hills color="#221b2b" y={470} opacity={0.8} />
      <Diorama p={p} w={5.4} d={4.8} top="#6b5238" edgeA="#453222" edgeB="#2e2116" />
      {/* two walls of the room, open toward the camera */}
      <Box p={p} x={-2.5} y={-2.2} w={5} d={0.22} h={2.1} color="#7c6144" top={0.1} sideY={-0.08} />
      <Box p={p} x={-2.5} y={-2.2} w={0.22} d={4.4} h={2.1} color="#6d5539" top={0.1} sideY={-0.18} />
      {/* window in the back wall, night outside */}
      <Poly p={p} pts={[[0.5, -2.2, 1.1], [0.5, -2.2, 1.8], [1.6, -2.2, 1.8], [1.6, -2.2, 1.1]]} fill="#1b2340" />
      <Poly p={p} pts={[[0.5, -2.2, 1.42], [0.5, -2.2, 1.46], [1.6, -2.2, 1.46], [1.6, -2.2, 1.42]]} fill="#6d5539" />

      {/* bed, drawn in screen space so the sleeping figure sits on it */}
      <Bed x={236} y={792} t={t} />
      {/* stool + oil lamp */}
      <Box p={p} x={1.05} y={-1.75} w={0.45} d={0.45} h={0.62} color="#4a3828" />
      <circle cx={lx[0]} cy={lx[1]} r={40 + lamp * 44} fill={C.gold} opacity={0.16} />
      <circle cx={lx[0]} cy={lx[1]} r={9 + lamp * 4} fill={C.goldHot} />
      <circle cx={lx[0]} cy={lx[1]} r={3.4} fill="#fff8e8" />


      <Character x={424} y={862} height={228} mode="kneel" t={t} phase={0.2} pal={MaryPal} headCover />
      <Character x={524} y={892} height={244} mode="idle" t={t} phase={0.6} pal={MarthaPal} headCover />
      <Character x={672} y={918} height={212} mode="run" t={t} phase={0.1} pal={CrowdPal} flip />
    </g>
  );
};


const Bed: React.FC<{ x: number; y: number; t: number }> = ({ x, y, t }) => {
  const breathe = Math.sin(t * 1.4) * 2.6;
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx={0} cy={6} rx={150} ry={16} fill="#000" opacity={0.3} />
      {/* frame + legs */}
      <path d="M-138 0 L132 0 L136 -54 L-134 -54 Z" fill="#5a4230" stroke="#1a140f" strokeWidth={4} />
      <path d="M-126 0 L-120 46 L-108 46 L-114 0 Z" fill="#4a3626" stroke="#1a140f" strokeWidth={3} />
      <path d="M110 0 L104 46 L116 46 L122 0 Z" fill="#4a3626" stroke="#1a140f" strokeWidth={3} />
      {/* mattress */}
      <path d="M-128 -54 L124 -54 L128 -74 L-132 -74 Z" fill={C.cream} stroke="#1a140f" strokeWidth={4} />
      {/* pillow */}
      <ellipse cx={-104} cy={-84} rx={34} ry={17} fill="#fffaf0" stroke="#1a140f" strokeWidth={3.4} />
      {/* the sick man under a blanket */}
      <g transform={`translate(0,${-breathe})`}>
        <path d="M-58 -76 Q-30 -104 26 -100 Q92 -96 108 -78 L108 -72 L-58 -72 Z" fill="#a8694a" stroke="#1a140f" strokeWidth={4} />
        {[-34, -6, 22, 50].map((xx, i) => (
          <path key={i} d={`M${xx} -74 Q${xx + 6} -86 ${xx + 3} -96`} stroke="#8c5138" strokeWidth={3} fill="none" />
        ))}
        <circle cx={-92} cy={-86} r={20} fill={C.skin} stroke="#1a140f" strokeWidth={4} />
        <path d="M-112 -92 Q-92 -112 -72 -92" fill={C.cream} stroke="#1a140f" strokeWidth={3.4} />
        <circle cx={-86} cy={-88} r={1.8} fill="#1a140f" />
        <circle cx={-78} cy={-88} r={1.8} fill="#1a140f" />
      </g>
    </g>
  );
};

const BedFigure: React.FC<{ x: number; y: number; t: number }> = ({ x, y, t }) => {
  const breathe = Math.sin(t * 1.4) * 3;
  return (
    <g transform={`translate(${x},${y})`}>
      <g transform={`translate(0,${-breathe})`}>
        <path d="M-86 0 Q-98 -34 -56 -38 L86 -34 Q118 -26 114 0 Z" fill={C.cream} stroke="#1a140f" strokeWidth={4.4} />
        {[-66, -38, -10, 18, 46, 74].map((xx, i) => (
          <path key={i} d={`M${xx} -4 Q${xx + 6} -20 ${xx + 2} -33`} stroke="#cdbfa4" strokeWidth={3.4} fill="none" />
        ))}
        <circle cx={-100} cy={-18} r={19} fill={C.skin} stroke="#1a140f" strokeWidth={4.4} />
        <path d="M-120 -24 Q-100 -46 -80 -22" fill="#3b2b23" stroke="#1a140f" strokeWidth={3.4} />
      </g>
    </g>
  );
};

/* 3 — the road, Jesus stays put */
export const RoadJesusSet: React.FC<SetProps> = ({ t }) => {
  const p = P(1);
  return (
    <g>
      <Sky from="#141327" to="#3d2a3f" horizon="#8a5438" t={t} seed={3} stars={20} />
      <Hills color="#38293c" y={470} />
      <Diorama p={p} w={5.6} d={5} top="#7d5f42" edgeA="#4d3826" edgeB="#33251a" />
      <Slab p={p} x={-3} y={-1.1} w={6} d={2.2} z={0.01} fill="#96744e" opacity={0.75} />
      <House p={p} x={-2.7} y={-2.9} w={1.7} d={1.5} h={1.7} color="#a8895e" lit={0.4} />
      <House p={p} x={1.35} y={-2.9} w={1.5} d={1.4} h={1.45} color="#96794f" lit={0.2} faces="x" />
      <Olive p={p} x={-2.9} y={0.6} s={0.9} sway={Math.sin(t) * 1.8} />
      <Rock p={p} x={2.6} y={0.4} s={1.1} />
      <Rock p={p} x={-1.9} y={1.9} s={0.8} />

      <Character x={286} y={846} height={252} mode="stand" t={t} phase={0.1} pal={JesusPal} halo={0.18} rim={C.gold} beard />
      <Character x={166} y={890} height={212} mode="idle" t={t} phase={0.5} pal={DisciplePal} flip />
      <Character x={392} y={912} height={222} mode="idle" t={t} phase={0.8} pal={DisciplePal} />
      <Messenger t={t} />
    </g>
  );
};

const Messenger: React.FC<{ t: number }> = ({ t }) => {
  const k = Math.min(1, Math.max(0, (t - 0.2) / 2.4));
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const x = lerp(820, 590, e);
  return <Character x={x} y={900} height={196} mode={t < 2.6 ? 'run' : 'idle'} t={t} phase={0.35} pal={CrowdPal} flip />;
};

/* 4 — they carry him out, the stone shuts */
export const BurialSet: React.FC<SetProps & { shut: number }> = ({ t, shut }) => {
  const p = P(1);
  return (
    <g>
      <Sky from="#100d1c" to="#2c2132" horizon="#4a3230" t={t} seed={4} stars={16} />
      <Hills color="#2b2130" y={480} />
      <Diorama p={p} w={5.4} d={5} top="#6a5138" edgeA="#422f20" edgeB="#2c1f16" />
      <TombCave p={p} x={0.35} y={-0.4} stoneOpen={shut} scale={0.62} />
      <Olive p={p} x={-2.5} y={-0.6} s={0.8} sway={Math.sin(t) * 2} />
      <Rock p={p} x={2.6} y={0.9} s={1} />

      <Character x={196} y={906} height={206} mode="weep" t={t} phase={0.2} pal={MaryPal} headCover />
      <Character x={292} y={918} height={212} mode="weep" t={t} phase={0.6} pal={MarthaPal} headCover />
      <Character x={520} y={898} height={186} mode="weep" t={t} phase={0.9} pal={CrowdPal} />
      <Character x={432} y={872} height={204} mode="carry" t={t} phase={0.3} pal={ManPal} flip />
      <Character x={548} y={884} height={198} mode="carry" t={t} phase={0.7} pal={ManPal} flip />
      <WrappedBody x={492} y={806} />
    </g>
  );
};

const WrappedBody: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x},${y})`}>
    <path d="M-62 0 Q-54 -26 0 -24 Q54 -26 62 0 Q54 11 0 10 Q-54 11 -62 0 Z" fill={C.cream} stroke="#1a140f" strokeWidth={3.6} />
    {[-40, -16, 8, 32].map((xx, i) => (
      <path key={i} d={`M${xx} -19 Q${xx + 4} -8 ${xx} 3`} stroke="#cabd9f" strokeWidth={3} fill="none" />
    ))}
  </g>
);

/* 5 — Martha runs to meet him */
export const MeetSet: React.FC<SetProps> = ({ t }) => {
  const p = P(1);
  const run = Math.min(1, Math.max(0, (t - 0.2) / 3.2));
  const e = run < 0.5 ? 2 * run * run : 1 - Math.pow(-2 * run + 2, 2) / 2;
  const mx = lerp(830, 486, e);
  const raised = t > 3.6;
  return (
    <g>
      <Sky from="#191428" to="#412c3d" horizon="#9a5f3c" t={t} seed={5} stars={12} />
      <Hills color="#3a2a34" y={470} />
      <Diorama p={p} w={5.6} d={5} top="#7f6043" edgeA="#4e3826" edgeB="#34261a" />
      <Slab p={p} x={-3} y={-0.9} w={6} d={1.8} z={0.01} fill="#9a7650" opacity={0.7} />
      <House p={p} x={-2.8} y={-2.9} w={1.6} d={1.4} h={1.55} color="#a98a60" lit={0.3} />
      <Olive p={p} x={2.4} y={-0.2} s={1} sway={Math.sin(t) * 2} />
      <Rock p={p} x={-2.2} y={1.4} s={0.9} />
      <Character x={286} y={858} height={258} beard mode={t > 3 ? 'stand' : 'walk'} t={t} phase={0.15} pal={JesusPal} halo={0.22} rim={C.gold} />
      <Character x={mx} y={906} height={224} mode={raised ? 'raise' : 'run'} t={t} phase={0.55} pal={MarthaPal} flip headCover />
    </g>
  );
};

/* 6 — close on Jesus */
export const CloseJesusSet: React.FC<SetProps> = ({ t }) => (
  <g>
    <Sky from="#1a1122" to="#462e33" horizon="#8a5a34" t={t} seed={6} stars={8} />
    <ellipse cx={360} cy={470} rx={330} ry={470} fill={C.gold} opacity={0.12} filter="url(#blurBig)" />
    <defs>
      <filter id="blurBig" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="28" />
      </filter>
    </defs>
    <Character x={386} y={1128} height={560} mode="stand" t={t} phase={0.2} pal={JesusPal} halo={0.26} rim={C.goldHot} beard />
  </g>
);

/* 7,8,9,10,11 — the tomb mouth, night */
export const TombFrontSet: React.FC<
  SetProps & {
    stoneOpen?: number;
    glow?: number;
    dark?: number;
    variant: 'weep' | 'hand' | 'pull' | 'shout' | 'doorway';
    pull?: number;
  }
> = ({ t, stoneOpen = 0, glow = 0, dark = 0, variant, pull = 0 }) => {
  const p = P(1);
  return (
    <g>
      <Sky
        from={mix('#0d0b18', '#050409', dark)}
        to={mix('#241a2c', '#0a0810', dark)}
        horizon={mix('#4a3230', '#0d0a10', dark)}
        t={t}
        seed={7}
        stars={variant === 'doorway' ? 5 : 18}
      />
      <Hills color={mix('#2a2030', '#0b0810', dark)} y={470} />
      <Diorama p={p} w={5.6} d={5.2} top={mix('#6a5138', '#251a18', dark)} edgeA={mix('#422f20', '#171010', dark)} edgeB={mix('#2c1f16', '#100b0c', dark)} />
      <TombCave p={p} x={0.5} y={-0.7} stoneOpen={stoneOpen} glow={glow} scale={0.72} />
      <Olive p={p} x={-2.6} y={-0.4} s={0.85} sway={Math.sin(t) * 1.6} />
      <Rock p={p} x={2.7} y={0.7} s={1.05} />

      {variant === 'weep' && (
        <g>
          <Character x={286} y={906} height={276} beard mode="idle" t={t} phase={0.1} pal={JesusPal} halo={0.2} rim={C.gold} />
          <Character x={372} y={956} height={186} mode="weep" t={t} phase={0.5} pal={MaryPal} headCover />
          <Character x={168} y={884} height={190} mode="idle" t={t} phase={0.8} pal={CrowdPal} flip />
          <Character x={548} y={900} height={184} mode="idle" t={t} phase={1.3} pal={CrowdPal} />
        </g>
      )}

      {variant === 'hand' && (
        <g>
          <Character x={280} y={902} height={282} beard mode="point" t={t} phase={0.2} pal={JesusPal} halo={0.22} rim={C.gold} />
          <Character x={150} y={948} height={200} mode="gasp" t={t} phase={0.6} pal={CrowdPal} flip />
          <Character x={228} y={878} height={188} mode="gasp" t={t} phase={1.1} pal={CrowdPal} flip />
          <Character x={566} y={932} height={186} mode="gasp" t={t} phase={0.3} pal={CrowdPal} />
        </g>
      )}

      {variant === 'pull' && (
        <g>
          <Character x={214} y={920} height={206} mode="pull" t={t} phase={0.1} pal={ManPal} />
          <Character x={306} y={936} height={200} mode="pull" t={t} phase={0.6} pal={ManPal} />
          <Rope from={[250, 860]} to={[430, 640]} />
          <Character x={130} y={964} height={196} mode="weep" t={t} phase={0.9} pal={MarthaPal} headCover />
        </g>
      )}

      {variant === 'shout' && (
        <g>
          <Character x={244} y={916} height={300} beard mode="raise" t={t} phase={0.1} pal={JesusPal} halo={0.28} rim={C.goldHot} />
          <Character x={126} y={968} height={188} mode="kneel" t={t} phase={0.7} pal={CrowdPal} flip />
          <Character x={588} y={952} height={182} mode="kneel" t={t} phase={0.4} pal={CrowdPal} />
        </g>
      )}

      {variant === 'doorway' && (
        <g>
          <Character x={402} y={800} height={214} mode="idle" t={t} phase={0.9} pal={CrowdPal} wrapped />
          <Character x={214} y={912} height={224} mode="gasp" t={t} phase={0.2} pal={CrowdPal} flip />
          <Character x={560} y={938} height={210} mode="gasp" t={t} phase={0.8} pal={CrowdPal} />
          <Character x={124} y={978} height={196} mode="kneel" t={t} phase={0.5} pal={MaryPal} headCover flip />
        </g>
      )}
      {pull > 0 ? <Smoke x={440} y={700} amount={pull} t={t} /> : null}
    </g>
  );
};

const Rope: React.FC<{ from: [number, number]; to: [number, number]; opacity?: number }> = ({ from, to, opacity = 1 }) => (
  <path
    d={`M${from[0]} ${from[1]} Q${(from[0] + to[0]) / 2} ${(from[1] + to[1]) / 2 + 30} ${to[0]} ${to[1]}`}
    stroke="#b79a63"
    strokeWidth={4}
    fill="none"
    opacity={opacity}
  />
);

const Smoke: React.FC<{ x: number; y: number; amount: number; t: number }> = ({ x, y, amount, t }) => {
  const r = rng(77);
  return (
    <g>
      {Array.from({ length: 26 }).map((_, i) => {
        const life = (t * 0.5 + r()) % 1;
        const px = x + (r() - 0.5) * 240 + life * (r() - 0.5) * 180;
        const py = y + 60 - life * 360;
        const rad = 26 + life * 96;
        return <circle key={i} cx={px} cy={py} r={rad} fill="#b9b0a2" opacity={amount * 0.1 * (1 - life)} />;
      })}
    </g>
  );
};

/* 12 — end card */
export const EndCardSet: React.FC<SetProps & { logo: number }> = ({ t }) => {
  const flick = 0.9 + Math.sin(t * 7.1) * 0.06 + Math.sin(t * 17.3) * 0.04;
  return (
    <g>
      <rect x={0} y={0} width={720} height={1280} fill={C.cream} />
      <g transform="translate(360,470)">
        <ellipse cx={0} cy={0} rx={120 * flick} ry={130 * flick} fill={C.gold} opacity={0.2} filter="url(#blurBig2)" />
        <Flame scale={2.1} flick={flick} />
      </g>
      <defs>
        <filter id="blurBig2" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>
    </g>
  );
};

export const Flame: React.FC<{ scale?: number; flick?: number }> = ({ scale = 1, flick = 1 }) => (
  <g transform={`scale(${scale})`}>
    <path
      d="M0 18 C-16 6 -10 -12 0 -30 C10 -12 16 6 0 18 Z"
      fill={C.red}
      stroke="#2a0f0a"
      strokeWidth={2.4}
      transform={`scale(${flick.toFixed(3)},1)`}
    />
    <path d="M0 12 C-8 4 -5 -6 0 -17 C5 -6 8 4 0 12 Z" fill={C.goldHot} opacity={0.95} />
  </g>
);

/* --------------------------------------------------------------- cast helpers */

export const crowdRow = (
  n: number,
  y: number,
  x0: number,
  x1: number,
  height: number,
  t: number,
  modes: Mode[] = ['idle'],
  pal = CrowdPal,
) =>
  Array.from({ length: n }).map((_, i) => (
    <Character
      key={i}
      x={lerp(x0, x1, n === 1 ? 0.5 : i / (n - 1))}
      y={y + (hash(i * 5.1) - 0.5) * 18}
      height={height + (hash(i * 2.7) - 0.5) * 16}
      mode={modes[i % modes.length]}
      t={t}
      phase={hash(i * 3.3)}
      pal={pal}
      flip={i % 2 === 1}
    />
  ));
