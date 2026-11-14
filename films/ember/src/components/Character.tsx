import React from 'react';
import { C } from '../theme';
import { clamp, lerp } from '../lib/anim';

/**
 * A jointed figure. Everything is a shape with a pivot: hips, knees, shoulders,
 * elbows, neck. No two frames are identical — every mode carries a live sine of
 * the film clock, so nobody ever stands completely still.
 *
 * Local units: the figure is 100 tall, origin at the feet, y grows downward
 * (negative values are above the ground).
 */

export type Mode =
  | 'idle'
  | 'walk'
  | 'run'
  | 'kneel'
  | 'weep'
  | 'point'
  | 'raise'
  | 'pull'
  | 'carry'
  | 'stand'
  | 'gasp';

export type Palette = {
  robe: string;
  robeDark: string;
  sash: string;
  skin: string;
  skinDark: string;
  hair: string;
  veil?: string;
  accent?: string;
};

const DEFAULT_PAL: Palette = {
  robe: C.robe,
  robeDark: C.robeDark,
  sash: '#8d6d4a',
  skin: C.skin,
  skinDark: C.skinDark,
  hair: '#3b2b23',
};

const R = (deg: number, len: number): [number, number] => [
  Math.sin((deg * Math.PI) / 180) * len,
  Math.cos((deg * Math.PI) / 180) * len,
];

type Limb = { at: [number, number]; a1: number; l1: number; a2: number; l2: number };

const chain = (at: [number, number], a1: number, l1: number, a2: number, l2: number) => {
  const [dx1, dy1] = R(a1, l1);
  const mid: [number, number] = [at[0] + dx1, at[1] + dy1];
  const [dx2, dy2] = R(a2, l2);
  const end: [number, number] = [mid[0] + dx2, mid[1] + dy2];
  return { at, mid, end };
};

type Pose = {
  bob: number;
  lean: number;
  headTilt: number;
  hipY: number;
  legs: [Limb, Limb];
  arms: [Limb, Limb];
  hands?: [[number, number], [number, number]];
};

export const pose = (mode: Mode, t: number, phase: number): Pose => {
  const p = t * Math.PI * 2 + phase * Math.PI * 2;
  const flat: Pose = {
    bob: 0,
    lean: 0,
    headTilt: 0,
    hipY: -46,
    legs: [
      { at: [-5, -46], a1: 0, l1: 24, a2: 0, l2: 22 },
      { at: [5, -46], a1: 0, l1: 24, a2: 0, l2: 22 },
    ],
    arms: [
      { at: [-10, -76], a1: 4, l1: 21, a2: 8, l2: 19 },
      { at: [10, -76], a1: -4, l1: 21, a2: -8, l2: 19 },
    ],
  };

  switch (mode) {
    case 'idle': {
      const b = Math.sin(t * 1.9 + phase * 6.2);
      const sway = Math.sin(t * 1.1 + phase * 4.1);
      return {
        ...flat,
        bob: b * 1.1,
        lean: 1.2 + sway * 0.6,
        headTilt: -1.5 + b * 1.2,
        arms: [
          { at: [-10, -76], a1: 5 + sway * 3, l1: 21, a2: 9 + sway * 4, l2: 19 },
          { at: [10, -76], a1: -5 - sway * 3, l1: 21, a2: -9 - sway * 4, l2: 19 },
        ],
      };
    }
    case 'walk': {
      const amp = 26;
      const th1 = amp * Math.sin(p);
      const th2 = amp * Math.sin(p + Math.PI);
      const bend = (q: number) => -8 - 16 * (0.5 + 0.5 * Math.cos(q));
      return {
        bob: -2.3 * Math.abs(Math.cos(p)) - 0.8,
        lean: 4 + Math.sin(p * 2) * 1.2,
        headTilt: -2 + Math.sin(p * 2) * 1.6,
        hipY: -46,
        legs: [
          { at: [-5, -46], a1: th1, l1: 24, a2: th1 + bend(p), l2: 22 },
          { at: [5, -46], a1: th2, l1: 24, a2: th2 + bend(p + Math.PI), l2: 22 },
        ],
        arms: [
          { at: [-10, -76], a1: -18 * Math.sin(p), l1: 21, a2: -18 * Math.sin(p) + 16, l2: 19 },
          { at: [10, -76], a1: -18 * Math.sin(p + Math.PI), l1: 21, a2: -18 * Math.sin(p + Math.PI) + 16, l2: 19 },
        ],
      };
    }
    case 'run': {
      const amp = 46;
      const th1 = amp * Math.sin(p);
      const th2 = amp * Math.sin(p + Math.PI);
      return {
        bob: -3.6 * Math.abs(Math.cos(p)) - 1.6,
        lean: 14,
        headTilt: -8,
        hipY: -45,
        legs: [
          { at: [-5, -45], a1: th1, l1: 24, a2: th1 - 34 - 20 * Math.cos(p), l2: 22 },
          { at: [5, -45], a1: th2, l1: 24, a2: th2 - 34 - 20 * Math.cos(p + Math.PI), l2: 22 },
        ],
        arms: [
          { at: [-10, -74], a1: th2 * 0.9, l1: 20, a2: th2 * 0.9 + 62, l2: 18 },
          { at: [10, -74], a1: th1 * 0.9, l1: 20, a2: th1 * 0.9 + 62, l2: 18 },
        ],
      };
    }
    case 'kneel':
    case 'weep': {
      const sob = mode === 'weep' ? Math.sin(t * 12 + phase * 9) : 0;
      const breath = Math.sin(t * 1.6 + phase * 5);
      return {
        bob: breath * 0.9 + sob * 0.7,
        lean: (mode === 'weep' ? 10 : 3) + sob * 1.2,
        headTilt: mode === 'weep' ? 20 + sob * 2 : 6,
        hipY: -26,
        legs: [
          { at: [-5, -26], a1: 78, l1: 22, a2: -96, l2: 22 },
          { at: [5, -26], a1: 70, l1: 22, a2: -88, l2: 22 },
        ],
        arms: [
          { at: [-10, -58], a1: 26, l1: 19, a2: 66, l2: 17 },
          { at: [10, -58], a1: -26, l1: 19, a2: -66, l2: 17 },
        ],
        hands:
          mode === 'weep'
            ? [
                [-4, -44 + sob * 1.2],
                [4, -44 + sob * 1.2],
              ]
            : [
                [-2.5, -58 + breath],
                [2.5, -58 + breath],
              ],
      };
    }
    case 'point': {
      const b = Math.sin(t * 1.7 + phase * 3);
      return {
        ...flat,
        bob: b * 0.8,
        lean: -3,
        headTilt: -3,
        arms: [
          { at: [-10, -76], a1: 6, l1: 21, a2: 12, l2: 19 },
          { at: [10, -76], a1: 74 + b * 2, l1: 22, a2: 84 + b * 2, l2: 20 },
        ],
      };
    }
    case 'raise': {
      const b = Math.sin(t * 1.8 + phase * 4);
      return {
        ...flat,
        bob: b * 1.2,
        lean: -6 + b * 0.8,
        headTilt: -12,
        arms: [
          { at: [-10, -76], a1: -(158 + b * 4), l1: 21, a2: -(166 + b * 5), l2: 19 },
          { at: [10, -76], a1: 158 + b * 4, l1: 21, a2: 166 + b * 5, l2: 19 },
        ],
      };
    }
    case 'pull': {
      const strain = Math.sin(t * 3.4 + phase * 6);
      return {
        ...flat,
        bob: -1.5 + strain * 1.4,
        lean: -20 + strain * 3,
        headTilt: 8,
        hipY: -42,
        legs: [
          { at: [-5, -42], a1: -30 + strain * 2, l1: 24, a2: -14, l2: 22 },
          { at: [5, -42], a1: 24 + strain * 2, l1: 24, a2: 6, l2: 22 },
        ],
        arms: [
          { at: [-10, -72], a1: -62, l1: 21, a2: -54, l2: 19 },
          { at: [10, -72], a1: -58, l1: 21, a2: -50, l2: 19 },
        ],
      };
    }
    case 'carry': {
      const b = Math.sin(t * 2.4 + phase * 5);
      return {
        ...flat,
        bob: b * 0.8,
        lean: 8,
        headTilt: 4,
        hipY: -44,
        legs: [
          { at: [-5, -44], a1: 8, l1: 24, a2: 2, l2: 22 },
          { at: [5, -44], a1: -8, l1: 24, a2: -4, l2: 22 },
        ],
        arms: [
          { at: [-10, -74], a1: 62, l1: 21, a2: 84, l2: 19 },
          { at: [10, -74], a1: 58, l1: 21, a2: 80, l2: 19 },
        ],
      };
    }
    case 'gasp': {
      const b = Math.sin(t * 2.2 + phase * 3);
      return {
        ...flat,
        bob: 1.5 - Math.abs(b) * 2,
        lean: -16,
        headTilt: -10,
        hipY: -44,
        legs: [
          { at: [-5, -44], a1: -24, l1: 24, a2: -34, l2: 22 },
          { at: [5, -44], a1: 18, l1: 24, a2: 26, l2: 22 },
        ],
        arms: [
          { at: [-10, -74], a1: 118 + b * 5, l1: 20, a2: 140 + b * 6, l2: 18 },
          { at: [10, -74], a1: -118 - b * 5, l1: 20, a2: -140 - b * 6, l2: 18 },
        ],
      };
    }
    case 'stand':
    default: {
      const b = Math.sin(t * 1.5 + phase * 5);
      return {
        ...flat,
        bob: b * 0.9,
        lean: 0,
        headTilt: -2 + b * 0.8,
        arms: [
          { at: [-10, -76], a1: 4 + b * 1.5, l1: 21, a2: 7 + b * 2, l2: 19 },
          { at: [10, -76], a1: -4 - b * 1.5, l1: 21, a2: -7 - b * 2, l2: 19 },
        ],
      };
    }
  }
};

const OUTLINE = 3.6;

const LimbPath: React.FC<{ a: [number, number]; b: [number, number]; w: number; stroke: string; fill: string }> = ({
  a,
  b,
  w,
  stroke,
  fill,
}) => (
  <g>
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={stroke} strokeWidth={w + OUTLINE} strokeLinecap="round" />
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={fill} strokeWidth={w} strokeLinecap="round" />
  </g>
);

export type CharacterProps = {
  x: number;
  y: number;
  height?: number;
  mode?: Mode;
  t: number;
  phase?: number;
  flip?: boolean;
  pal?: Partial<Palette>;
  alpha?: number;
  rim?: string;
  wrapped?: boolean;
  halo?: number;
  headCover?: boolean;
  beard?: boolean;
};

export const Character: React.FC<CharacterProps> = ({
  x,
  y,
  height = 120,
  mode = 'idle',
  t,
  phase = 0,
  flip = false,
  pal,
  alpha = 1,
  rim,
  wrapped = false,
  halo = 0,
  headCover = false,
  beard = false,
}) => {
  const P = { ...DEFAULT_PAL, ...pal };
  const s = height / 100;
  const q = pose(mode, t, phase);
  const shadowW = 26 * s;

  const legPts = q.legs.map((l) => chain(l.at, l.a1, l.l1, l.a2, l.l2));
  const armPts = q.arms.map((a) => chain(a.at, a.a1, a.l1, a.a2, a.l2));

  const torsoTop = -78 + q.bob;
  const hipY = q.hipY + q.bob;

  return (
    <g transform={`translate(${x},${y}) scale(${(flip ? -s : s).toFixed(4)},${s.toFixed(4)})`} opacity={alpha}>
      <ellipse cx={0} cy={2} rx={shadowW / s / 2} ry={4.4} fill="#000" opacity={0.3} />

      {wrapped ? (
        <g stroke={P.hair} strokeWidth={OUTLINE / s / 1.6} strokeLinejoin="round">
          <path
            d="M-11 -84 Q0 -92 11 -84 L14 0 Q0 4 -14 0 Z"
            fill={C.cream}
            stroke="#1a140f"
            strokeWidth={OUTLINE / s}
          />
          {[-70, -56, -42, -28, -14].map((yy, i) => (
            <path
              key={i}
              d={`M${-12 + (i % 2) * 1.5} ${yy} Q0 ${yy + 3} ${12 - (i % 2) * 1.5} ${yy}`}
              stroke="#c9bda2"
              strokeWidth={2.2 / s}
              fill="none"
            />
          ))}
          <circle cx={0} cy={-88} r={12} fill={C.cream} stroke="#1a140f" strokeWidth={OUTLINE / s} />
        </g>
      ) : (
        <g>
          {/* back arm */}
          <LimbPath a={armPts[0].at} b={armPts[0].mid} w={7} stroke={P.robeDark} fill={P.robeDark} />
          <LimbPath a={armPts[0].mid} b={q.hands ? q.hands[0] : armPts[0].end} w={6} stroke={P.robeDark} fill={P.robeDark} />
          <circle cx={(q.hands ? q.hands[0] : armPts[0].end)[0]} cy={(q.hands ? q.hands[0] : armPts[0].end)[1]} r={3.4} fill={P.skinDark} stroke={P.hair} strokeWidth={OUTLINE * 0.5} />

          {/* back leg */}
          <LimbPath a={legPts[0].at} b={legPts[0].mid} w={8} stroke={P.robeDark} fill={P.robeDark} />
          <LimbPath a={legPts[0].mid} b={legPts[0].end} w={7} stroke={P.skinDark} fill={P.skinDark} />
          <Foot at={legPts[0].end} color={P.hair} />

          {/* torso */}
          <path
            d={`M-11 ${torsoTop} Q0 ${torsoTop - 4} 11 ${torsoTop} L${9 + q.lean * 0.1} ${hipY - 6} L${13} ${hipY + 14} Q0 ${hipY + 18} ${-13} ${hipY + 14} L${-9 - q.lean * 0.1} ${hipY - 6} Z`}
            fill={P.robe}
            stroke="#1a140f"
            strokeWidth={OUTLINE}
            strokeLinejoin="round"
            transform={`rotate(${q.lean * 0.25} 0 ${hipY})`}
          />
          <path
            d={`M${-11.4 - q.lean * 0.1} ${hipY - 12} L${11.4 + q.lean * 0.1} ${hipY - 12}`}
            stroke={P.sash}
            strokeWidth={4.2}
            strokeLinecap="round"
            opacity={0.9}
          />

          {/* front leg */}
          <LimbPath a={legPts[1].at} b={legPts[1].mid} w={8.5} stroke={P.robe} fill={P.robe} />
          <LimbPath a={legPts[1].mid} b={legPts[1].end} w={7.5} stroke={P.skin} fill={P.skin} />
          <Foot at={legPts[1].end} color={P.hair} />

          {/* front arm */}
          <LimbPath a={armPts[1].at} b={armPts[1].mid} w={7.5} stroke={P.robe} fill={P.robe} />
          <LimbPath a={armPts[1].mid} b={q.hands ? q.hands[1] : armPts[1].end} w={6.5} stroke={P.robe} fill={P.robe} />
          <circle
            cx={(q.hands ? q.hands[1] : armPts[1].end)[0]}
            cy={(q.hands ? q.hands[1] : armPts[1].end)[1]}
            r={3.7}
            fill={P.skin}
            stroke={P.hair}
            strokeWidth={OUTLINE * 0.5}
          />

          {/* head: veil or hair sits behind the face so the eyes always read */}
          <g transform={`rotate(${q.headTilt} 0 ${torsoTop - 2})`}>
            <path
              d={`M-3.6 ${torsoTop + 2} L3.6 ${torsoTop + 2} L3 ${torsoTop - 3} L-3 ${torsoTop - 3} Z`}
              fill={P.skinDark}
            />
            {headCover ? (
              <ellipse
                cx={0}
                cy={torsoTop - 12}
                rx={14}
                ry={15}
                fill={P.veil ?? C.creamDim}
                stroke="#1a140f"
                strokeWidth={OUTLINE}
              />
            ) : null}
            <circle cx={0} cy={torsoTop - 12} r={11} fill={P.skin} stroke="#1a140f" strokeWidth={OUTLINE} />
            {headCover ? (
              <path
                d={`M-12.6 ${torsoTop - 14} Q-12 ${torsoTop - 27} 0 ${torsoTop - 26.4} Q12 ${torsoTop - 27} 12.6 ${torsoTop - 14} Q6 ${torsoTop - 20} 0 ${torsoTop - 19.6} Q-6 ${torsoTop - 20} -12.6 ${torsoTop - 14} Z`}
                fill={P.veil ?? C.creamDim}
                stroke="#1a140f"
                strokeWidth={OUTLINE * 0.8}
              />
            ) : (
              <path
                d={`M-10.5 ${torsoTop - 16} Q-9 ${torsoTop - 25} 0 ${torsoTop - 24.5} Q9 ${torsoTop - 25} 10.5 ${torsoTop - 16} Q5 ${torsoTop - 20} 0 ${torsoTop - 19.5} Q-5 ${torsoTop - 20} -10.5 ${torsoTop - 16} Z`}
                fill={P.hair}
                stroke="#1a140f"
                strokeWidth={OUTLINE * 0.7}
              />
            )}
            <circle cx={-3.7} cy={torsoTop - 11} r={1.6} fill="#1a140f" />
            <circle cx={3.7} cy={torsoTop - 11} r={1.6} fill="#1a140f" />
            {beard ? (
              <path
                d={`M-7 ${torsoTop - 8} Q0 ${torsoTop + 2} 7 ${torsoTop - 8} Q0 ${torsoTop - 4} -7 ${torsoTop - 8} Z`}
                fill={P.hair}
                stroke="#1a140f"
                strokeWidth={OUTLINE * 0.6}
              />
            ) : (
              <path
                d={`M-3.4 ${torsoTop - 5.5} Q0 ${torsoTop - 3} 3.4 ${torsoTop - 5.5}`}
                stroke={P.hair}
                strokeWidth={2.6}
                fill="none"
                opacity={0.85}
                strokeLinecap="round"
              />
            )}
          </g>

          {rim ? (
            <path
              d={`M-13 ${hipY + 16} Q-14 ${(hipY + torsoTop) / 2} -12 ${torsoTop} Q-12.5 ${torsoTop + 4} -13 ${torsoTop + 8}`}
              stroke={rim}
              strokeWidth={3.2}
              fill="none"
              opacity={0.7}
              strokeLinecap="round"
            />
          ) : null}
        </g>
      )}

      {halo > 0 ? (
        <circle cx={0} cy={-94 + q.bob} r={20} fill="none" stroke={C.goldHot} strokeWidth={2.4} opacity={halo} />
      ) : null}
    </g>
  );
};

const Foot: React.FC<{ at: [number, number]; color: string }> = ({ at, color }) => (
  <path
    d={`M${at[0] - 3.4} ${at[1]} L${at[0] + 5.6} ${at[1]} L${at[0] + 5.4} ${at[1] + 3.4} L${at[0] - 3.6} ${at[1] + 3.2} Z`}
    fill={color}
    stroke="#1a140f"
    strokeWidth={2.4}
    strokeLinejoin="round"
  />
);

export const JesusPal: Partial<Palette> = { robe: '#efe6d2', robeDark: '#d8cbb0', sash: '#b4553c', skin: C.skin, hair: '#4a3225' };
export const DisciplePal: Partial<Palette> = { robe: '#a89473', robeDark: '#867354', sash: '#6a533a' };
export const MarthaPal: Partial<Palette> = { robe: '#b4563c', robeDark: '#8f4029', sash: '#6e3a2c', veil: '#8f6b4a' };
export const MaryPal: Partial<Palette> = { robe: '#4c6b8a', robeDark: '#3b556e', sash: '#2f3f52', veil: '#3b4d63' };
export const ManPal: Partial<Palette> = { robe: '#8a7554', robeDark: '#6b583d', sash: '#4e3f2c' };
export const CrowdPal: Partial<Palette> = { robe: '#7d6e57', robeDark: '#635645', sash: '#4a3f31' };
export const RomanPal: Partial<Palette> = { robe: '#8f4b3c', robeDark: '#713a2f', sash: '#c9a961' };
