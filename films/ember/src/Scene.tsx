import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C } from './theme';
import { clamp, easeInOut, easeOut, seg, shakeAt } from './lib/anim';
import {
  BurialSet,
  CloseJesusSet,
  EndCardSet,
  HookSet,
  MeetSet,
  RoadJesusSet,
  SickRoomSet,
  TombFrontSet,
} from './components/Sets';
import { LightBeam, Sparkles, Dust, Vignette } from './components/Effects';
import { Badge, Caption, ChatBubble, CommentBox, EndCardCopy, Label, ProgressBar, QuoteCard } from './components/UI';

export type SceneData = {
  id: number;
  from: number;
  to: number;
  title: string;
  set: string;
  camera: { zoomFrom: number; zoomTo: number; panX: [number, number]; panY: [number, number] };
  shake?: { at: number; amount: number }[];
  captions?: any[];
  quotes?: any[];
  badges?: any[];
  bubbles?: any[];
  labels?: any[];
  commentBox?: any;
};

const Camera: React.FC<{ scene: SceneData; t: number; dur: number; children: React.ReactNode }> = ({ scene, t, dur, children }) => {
  const k = easeInOut(clamp(t / Math.max(0.001, dur)));
  const z = scene.camera.zoomFrom + (scene.camera.zoomTo - scene.camera.zoomFrom) * k;
  const px = scene.camera.panX[0] + (scene.camera.panX[1] - scene.camera.panX[0]) * k;
  const py = scene.camera.panY[0] + (scene.camera.panY[1] - scene.camera.panY[0]) * k;
  const sh = shakeAt(t, scene.shake);
  return (
    <g transform={`translate(${360 + sh.x},${640 + sh.y}) scale(${z}) translate(${-360 + px},${-640 + py})`}>
      {children}
    </g>
  );
};

export const SceneView: React.FC<{ scene: SceneData; t: number; progress: number }> = ({ scene, t, progress }) => {
  const dur = scene.to - scene.from;
  const abs = scene.from + t;

  const hookOpen = easeOut(seg(t, 0.05, 1.25));
  const shut = 1 - easeInOut(seg(t, 3.3, 4.5));
  const pullOpen = easeInOut(seg(t, 0.4, 2.3));
  const smoke = seg(t, 1.8, 3.6);
  const shoutFlash = Math.max(0, 1 - Math.abs(t - 4.45) / 0.5);
  const doorwayGlow = 0.55 + 0.45 * Math.sin(t * 1.4);

  let body: React.ReactNode = null;
  let fx: React.ReactNode = null;
  let overlay: React.ReactNode = null;

  switch (scene.set) {
    case 'hook':
      body = <HookSet t={t} abs={abs} dur={dur} open={hookOpen} />;
      fx = <Sparkles count={26} t={t} seed={3} area={[220, 240, 500, 1080]} rise={90} />;
      break;
    case 'sickroom':
      body = <SickRoomSet t={t} abs={abs} dur={dur} />;
      fx = <Dust count={50} t={t} seed={4} opacity={0.28} />;
      break;
    case 'roadJesus':
      body = <RoadJesusSet t={t} abs={abs} dur={dur} />;
      fx = (
        <>
          <Dust count={60} t={t} seed={5} opacity={0.3} />
          <Sparkles count={14} t={t} seed={6} area={[420, 320, 720, 900]} rise={40} />
        </>
      );
      break;
    case 'burial':
      body = <BurialSet t={t} abs={abs} dur={dur} shut={shut} />;
      fx = <Dust count={55} t={t} seed={7} opacity={0.35} />;
      break;
    case 'meet':
      body = <MeetSet t={t} abs={abs} dur={dur} />;
      fx = (
        <>
          <Dust count={45} t={t} seed={8} opacity={0.25} />
          <Sparkles count={12} t={t} seed={9} area={[120, 380, 620, 900]} rise={34} />
        </>
      );
      break;
    case 'closeJesus':
      body = <CloseJesusSet t={t} abs={abs} dur={dur} />;
      fx = (
        <>
          <LightBeam x={360} y={-140} angle={90} width={210} length={980} intensity={0.34} seed={11} t={t} />
          <Sparkles count={34} t={t} seed={12} area={[140, 220, 580, 1000]} rise={70} />
        </>
      );
      break;
    case 'tombWeep':
      body = <TombFrontSet t={t} abs={abs} dur={dur} variant="weep" glow={0.1} />;
      fx = (
        <>
          <LightBeam x={200} y={-40} angle={76} width={160} length={900} intensity={0.24} seed={13} t={t} />
          <Dust count={50} t={t} seed={14} opacity={0.3} />
        </>
      );
      break;
    case 'tombHand':
      body = <TombFrontSet t={t} abs={abs} dur={dur} variant="hand" glow={0.18} />;
      fx = <Dust count={45} t={t} seed={15} opacity={0.25} />;
      break;
    case 'tombPull':
      body = (
        <TombFrontSet
          t={t}
          abs={abs}
          dur={dur}
          variant="pull"
          stoneOpen={pullOpen}
          pull={smoke}
          glow={0.05 + smoke * 0.25}
          dark={seg(t, 2.2, 4.2) * 0.55}
        />
      );
      fx = <Dust count={70} t={t} seed={16} opacity={0.4} />;
      overlay = (
        <div style={{ position: 'absolute', inset: 0, background: '#05040a', opacity: seg(t, 2.4, 4.2) * 0.45 }} />
      );
      break;
    case 'tombShout':
      body = (
        <TombFrontSet
          t={t}
          abs={abs}
          dur={dur}
          variant="shout"
          stoneOpen={1}
          glow={0.35 + Math.min(1, t / 4) * 0.5}
          dark={0.2}
        />
      );
      fx = (
        <>
          <LightBeam x={250} y={780} angle={350} width={130} length={560} intensity={0.42 + Math.min(1, t / 4) * 0.3} seed={17} t={t} />
          <Sparkles count={40} t={t} seed={18} area={[150, 200, 620, 900]} rise={100} />
        </>
      );
      overlay = <div style={{ position: 'absolute', inset: 0, background: C.cream, opacity: clamp(shoutFlash) }} />;
      break;
    case 'tombDoorway':
      body = <TombFrontSet t={t} abs={abs} dur={dur} variant="doorway" stoneOpen={1} glow={doorwayGlow} dark={0.35} />;
      fx = (
        <>
          <LightBeam x={392} y={560} angle={95} width={140} length={700} intensity={0.36} seed={19} t={t} />
          <Sparkles count={26} t={t} seed={20} area={[240, 300, 560, 900]} rise={60} />
        </>
      );
      break;
    case 'endcard':
      body = <EndCardSet t={t} abs={abs} dur={dur} logo={1} />;
      break;
  }

  const fadeIn = scene.from === 0 ? 1 : easeOut(seg(t, 0, 0.45));
  const fadeOut = scene.to >= 65 ? 1 : 1 - seg(t, dur - 0.45, dur);

  return (
    <AbsoluteFill style={{ background: C.charcoal, opacity: Math.min(fadeIn, fadeOut) }}>
      <svg width={720} height={1280} viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        <Camera scene={scene} t={t} dur={dur}>
          {body}
        </Camera>
      </svg>

      <svg width={720} height={1280} viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {fx}
      </svg>

      {overlay}
      <Vignette strength={scene.set === 'endcard' ? 0.3 : 0.95} />
      {scene.set !== 'endcard' ? (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(18,14,38,0.75) 0%, rgba(18,14,38,0.05) 38%, rgba(10,7,14,0.15) 66%, rgba(5,4,9,0.72) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(46% 30% at 50% 62%, rgba(242,185,59,0.22) 0%, rgba(242,185,59,0.05) 55%, rgba(0,0,0,0) 100%)',
              mixBlendMode: 'screen',
            }}
          />
        </>
      ) : null}

      {(scene.captions ?? []).map((c, i) => (
        <Caption key={i} data={c} t={t} />
      ))}
      {(scene.quotes ?? []).map((q, i) => (
        <QuoteCard key={i} data={q} t={t} />
      ))}
      {(scene.badges ?? []).map((b, i) => (
        <Badge key={i} data={b} t={t} />
      ))}
      {(scene.bubbles ?? []).map((b, i) => (
        <ChatBubble key={i} data={b} t={t} />
      ))}
      {(scene.labels ?? []).map((l, i) => (
        <Label key={i} data={l} t={t} />
      ))}
      {scene.commentBox ? <CommentBox data={scene.commentBox} t={t} /> : null}
      {scene.set === 'endcard' ? (
        <EndCardCopy t={t} network="THE EMBER NETWORK" tagline="Scripture, one story at a time." follow="FOLLOW FOR THE NEXT BIBLE STORY" />
      ) : null}
      <ProgressBar progress={progress} />
    </AbsoluteFill>
  );
};
