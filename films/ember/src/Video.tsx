import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import data from './data/scenes.json';
import { SceneView } from './Scene';
import { Header } from './components/UI';
import { FontLoader } from './lib/fonts';
import { C } from './theme';

const meta = data.meta as any;
const audioData = data.audio as any;
const SCENES = data.scenes as any[];

/** Scenes overlap by this much so they can cross-fade rather than cut. */
const OVERLAP = 0.45;

const SceneSlot: React.FC<{ scene: any; progress: number }> = ({ scene, progress }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - OVERLAP;
  return <SceneView scene={scene} t={t} progress={progress} />;
};

export const John11: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;
  const now = frame / fps;

  return (
    <AbsoluteFill style={{ background: C.charcoal }}>
      <FontLoader />
      {SCENES.map((s) => {
        const from = Math.max(0, Math.round((s.from - OVERLAP) * fps));
        const to = Math.min(Math.round(65 * fps), Math.round((s.to + OVERLAP) * fps));
        return (
          <Sequence key={s.id} from={from} durationInFrames={to - from} name={`${s.id}. ${s.title}`} layout="none">
            <SceneSlot scene={s} progress={progress} />
          </Sequence>
        );
      })}

      {/* the header sits on top of every scene */}
      <Header series={meta.series} tag={meta.tag} dark={now > 63} />

      {/* voice-over slot: drop a file in public/audio and point scenes.json at it */}
      {audioData.voiceover ? <Audio src={staticFile(audioData.voiceover)} volume={1} /> : null}

      {/* music bed, ducked a little at the top and tail */}
      {audioData.music ? (
        <Audio
          src={staticFile(audioData.music)}
          volume={(f) => {
            const t = f / fps;
            const fadeIn = Math.min(1, t / 1.2);
            const fadeOut = Math.min(1, Math.max(0, (65 - t) / 1.6));
            return audioData.musicVolume * fadeIn * fadeOut;
          }}
        />
      ) : null}

      {/* marked hits: the stone in scenes 4 and 9, the shout in scene 10 */}
      {(audioData.sfx ?? []).map((s: any, i: number) => (
        <Sequence key={i} from={Math.round(s.at * fps)} durationInFrames={Math.round(2.5 * fps)} layout="none">
          <Audio src={staticFile(s.src)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
