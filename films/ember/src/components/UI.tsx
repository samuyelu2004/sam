import React from 'react';
import { C, FONT } from '../theme';
import { clamp, easeBackOut, easeOut, seg, wordsIn } from '../lib/anim';
import { Flame } from './Sets';

/* ------------------------------------------------------------------ captions */

export type CaptionData = {
  from: number;
  to: number;
  text: string;
  gold?: string[];
  size?: 'huge' | 'big' | 'mid';
  pos?: 'center' | 'mid' | 'low';
  top?: number;
};

const shadow = (k = 1) =>
  `0 ${3 * k}px 0 rgba(0,0,0,0.55), 0 ${10 * k}px ${30 * k}px rgba(0,0,0,0.55)`;

const sizeFor = (s: CaptionData['size']) => (s === 'huge' ? 86 : s === 'big' ? 62 : 46);

const Wrapped: React.FC<{ text: string; gold?: string[]; color?: string }> = ({ text, gold = [], color = C.cream }) => {
  const words = text.split(' ');
  const goldSet = new Set(gold.map((g) => g.toUpperCase().replace(/[.,!?]/g, '')));
  return (
    <>
      {words.map((w, i) => {
        const clean = w.toUpperCase().replace(/[.,!?]/g, '');
        const isGold = goldSet.has(clean);
        return (
          <span key={i} style={{ color: isGold ? C.gold : color }}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </>
  );
};

export const Caption: React.FC<{ data: CaptionData; t: number }> = ({ data, t }) => {
  if (t < data.from || t > data.to) return null;
  const words = data.text.split(' ');
  const shown = wordsIn(t, data.from, data.to, words.length, data.size === 'huge' ? 0.16 : 0.09);
  const inK = easeBackOut(seg(t, data.from, data.from + 0.32));
  const out = 1 - seg(t, data.to - 0.22, data.to);
  const fs = sizeFor(data.size);
  const top = data.top ?? (data.pos === 'low' ? 990 : data.pos === 'mid' ? 830 : 420);
  const goldSet = new Set((data.gold ?? []).map((g) => g.toUpperCase().replace(/[.,!?]/g, '')));

  return (
    <div
      style={{
        position: 'absolute',
        left: 44,
        right: 44,
        top,
        textAlign: 'center',
        fontFamily: FONT.display,
        fontSize: fs,
        lineHeight: 1.02,
        letterSpacing: -1,
        textTransform: 'uppercase',
        textShadow: shadow(fs / 70),
        opacity: out,
        transform: `scale(${0.94 + inK * 0.06})`,
      }}
    >
      {words.map((w, i) => {
        const on = i < shown;
        const clean = w.toUpperCase().replace(/[.,!?]/g, '');
        const isGold = goldSet.has(clean);
        const pop = on ? easeOut(clamp((t - (data.from + i * (data.size === 'huge' ? 0.16 : 0.09))) / 0.2)) : 0;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              color: isGold ? C.gold : C.cream,
              opacity: on ? 1 : 0,
              transform: `translateY(${(1 - pop) * 14}px) scale(${0.9 + pop * 0.1})`,
            }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
};

/* --------------------------------------------------------------- quote cards */

export const QuoteCard: React.FC<{
  data: { from: number; to: number; text: string; ref: string; top?: number; size?: number };
  t: number;
}> = ({ data, t }) => {
  if (t < data.from || t > data.to) return null;
  const k = easeBackOut(seg(t, data.from, data.from + 0.45));
  const out = 1 - seg(t, data.to - 0.3, data.to);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: 700,
        background: C.cream,
        borderRadius: 20,
        padding: '34px 38px 26px',
        boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
        transform: `translateY(${(1 - k) * 26}px) scale(${0.96 + k * 0.04})`,
        opacity: out,
      }}
    >
      <div
        style={{
          fontFamily: FONT.quote,
          fontStyle: 'italic',
          fontSize: data.size ?? 44,
          lineHeight: 1.16,
          color: '#20180f',
          textAlign: 'center',
        }}
      >
        {data.text}
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: FONT.display,
          fontSize: 20,
          letterSpacing: 2.4,
          color: C.rust,
          textAlign: 'center',
          textTransform: 'uppercase',
        }}
      >
        {data.ref}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------- badges */

export const Badge: React.FC<{ data: { from: number; to: number; label: string; index?: string }; t: number }> = ({ data, t }) => {
  if (t < data.from || t > data.to) return null;
  const k = easeBackOut(seg(t, data.from, data.from + 0.35));
  const out = 1 - seg(t, data.to - 0.25, data.to);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 148,
        display: 'flex',
        justifyContent: 'center',
        opacity: out,
        transform: `translateY(${(1 - k) * 24}px) scale(${0.9 + k * 0.1})`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'rgba(12,9,12,0.92)',
          border: `1px solid rgba(242,185,59,0.45)`,
          borderRadius: 999,
          padding: '14px 28px',
          fontFamily: FONT.display,
          fontSize: 26,
          letterSpacing: 1.5,
          color: C.cream,
          textTransform: 'uppercase',
        }}
      >
        {data.index ? <span style={{ color: C.gold }}>{data.index}</span> : null}
        <span>{data.label}</span>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- chat bubbles */

export const ChatBubble: React.FC<{ data: { from: number; to: number; text: string; side?: 'left' | 'right'; top?: number }; t: number }> = ({
  data,
  t,
}) => {
  if (t < data.from || t > data.to) return null;
  const k = easeBackOut(seg(t, data.from, data.from + 0.4));
  const right = data.side === 'right';
  return (
    <div
      style={{
        position: 'absolute',
        top: data.top ?? 560,
        [right ? 'right' : 'left']: 52,
        maxWidth: 470,
        background: C.cream,
        color: '#1d1610',
        borderRadius: 26,
        padding: '22px 30px',
        fontFamily: FONT.quote,
        fontStyle: 'italic',
        fontSize: 40,
        lineHeight: 1.18,
        boxShadow: '0 14px 34px rgba(0,0,0,0.4)',
        transform: `translateY(${(1 - k) * 30}px) scale(${0.86 + k * 0.14})`,
        opacity: clamp(k * 1.4),
      }}
    >
      {data.text}
      <div
        style={{
          position: 'absolute',
          bottom: -12,
          [right ? 'right' : 'left']: 40,
          width: 26,
          height: 26,
          background: C.cream,
          transform: 'rotate(45deg)',
          borderRadius: 4,
        }}
      />
    </div>
  );
};

/* --------------------------------------------------------------- comment box */

export const CommentBox: React.FC<{
  data: { from: number; to: number; prompt: string; typed: string; top?: number };
  t: number;
}> = ({ data, t }) => {
  if (t < data.from || t > data.to) return null;
  const k = easeBackOut(seg(t, data.from, data.from + 0.45));
  const typedChars = Math.floor(seg(t, data.from + 0.45, data.to - 0.2) * (data.typed.length + 4));
  const visible = data.typed.slice(0, typedChars);
  const caret = Math.floor(t * 3) % 2 === 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 46,
        right: 46,
        top: data.top ?? 700,
        background: 'rgba(11,9,12,0.94)',
        border: '1px solid rgba(247,237,217,0.16)',
        borderRadius: 22,
        padding: '24px 26px 28px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        transform: `translateY(${(1 - k) * 26}px)`,
        opacity: clamp(k * 1.2),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: C.gold,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT.display,
            fontSize: 18,
            color: '#1b1410',
          }}
        >
          YOU
        </div>
        <div style={{ fontFamily: FONT.display, fontSize: 17, letterSpacing: 2.6, color: 'rgba(247,237,217,0.55)' }}>
          {data.prompt}
        </div>
      </div>
      <div style={{ fontFamily: FONT.quote, fontStyle: 'italic', fontSize: 46, color: C.cream, minHeight: 56 }}>
        {visible}
        <span style={{ color: C.gold, opacity: caret ? 1 : 0 }}>|</span>
      </div>
      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '1px solid rgba(247,237,217,0.12)',
          fontFamily: FONT.display,
          fontSize: 18,
          letterSpacing: 2.2,
          color: C.gold,
        }}
      >
        {data.prompt}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- label callout */

export const Label: React.FC<{ data: { from: number; to: number; text: string; x: number; y: number; tx: number; ty: number }; t: number }> = ({
  data,
  t,
}) => {
  if (t < data.from || t > data.to) return null;
  const k = easeOut(seg(t, data.from, data.from + 0.4));
  const out = 1 - seg(t, data.to - 0.3, data.to);
  return (
    <svg width={720} height={1280} style={{ position: 'absolute', left: 0, top: 0, opacity: out }} viewBox="0 0 720 1280">
      <line x1={data.tx} y1={data.ty} x2={data.x} y2={data.y} stroke={C.cream} strokeWidth={1.6} opacity={0.7 * k} />
      <circle cx={data.tx} cy={data.ty} r={5} fill={C.cream} opacity={0.9 * k} />
      <g transform={`translate(${data.x},${data.y})`}>
        <rect x={-92} y={-22} width={184} height={44} rx={8} fill="rgba(12,9,12,0.92)" stroke="rgba(247,237,217,0.28)" />
        <text
          x={0}
          y={8}
          textAnchor="middle"
          fontFamily="Archivo Black"
          fontSize={19}
          letterSpacing={2}
          fill={C.cream}
        >
          {data.text}
        </text>
      </g>
    </svg>
  );
};

/* -------------------------------------------------------------------- header */

export const Header: React.FC<{ series: string; tag: string; dark?: boolean }> = ({ series, tag, dark }) => (
  <div
    style={{
      position: 'absolute',
      top: 54,
      left: 40,
      right: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      opacity: dark ? 0.75 : 0.92,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={30} height={34} viewBox="-18 -34 36 56">
        <Flame scale={0.85} />
      </svg>
      <span style={{ fontFamily: FONT.display, fontSize: 16, letterSpacing: 2.4, color: dark ? '#6b5b4a' : C.cream }}>
        THE EMBER NETWORK
      </span>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: FONT.display, fontSize: 15, letterSpacing: 2.6, color: dark ? '#4a3a2a' : C.cream }}>{series}</div>
      <div style={{ fontFamily: FONT.display, fontSize: 12, letterSpacing: 3, color: dark ? C.rust : C.gold, marginTop: 4 }}>{tag}</div>
    </div>
  </div>
);

/* ------------------------------------------------------------- progress bar */

export const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'rgba(247,237,217,0.14)' }}>
    <div
      style={{
        width: `${clamp(progress) * 100}%`,
        height: '100%',
        background: `linear-gradient(90deg, ${C.goldDeep}, ${C.goldHot})`,
      }}
    />
  </div>
);

/* ------------------------------------------------------------------ end card */

export const EndCardCopy: React.FC<{ t: number; network: string; tagline: string; follow: string }> = ({ t, network, tagline, follow }) => {
  const k = easeOut(seg(t, 0.1, 0.7));
  const k2 = easeOut(seg(t, 0.5, 1.1));
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          top: 596,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONT.display,
          fontSize: 40,
          letterSpacing: 3.4,
          color: '#241a12',
          opacity: k,
          transform: `translateY(${(1 - k) * 16}px)`,
        }}
      >
        {network}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 660,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONT.quote,
          fontStyle: 'italic',
          fontSize: 36,
          color: '#6f5c47',
          opacity: k,
        }}
      >
        “{tagline}”
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 96,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONT.display,
          fontSize: 24,
          letterSpacing: 2.6,
          color: C.rust,
          opacity: k2,
        }}
      >
        {follow}
      </div>
    </div>
  );
};
