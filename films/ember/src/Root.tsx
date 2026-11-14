import React from 'react';
import { Composition } from 'remotion';
import { John11 } from './Video';
import data from './data/scenes.json';

const meta = data.meta as any;

export const RemotionRoot: React.FC = () => (
  <Composition
    id="John11"
    component={John11}
    durationInFrames={Math.round(meta.durationInSeconds * meta.fps)}
    fps={meta.fps}
    width={meta.width}
    height={meta.height}
  />
);
