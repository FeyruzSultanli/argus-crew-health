// Types and small helpers of the camera-pulse capture session (split out of useCameraPulse.ts).
import type { CameraErrorKind } from '../../../measurement/rppg/capture';
import type { RppgEngine } from '../../../measurement/rppg/engine';
import type { RppgEstimate } from '../../../measurement/rppg/types';

/** Distance hint from face width / frame width — demo parameters [SRC_DEMO_QUALITY_SCORES]. */
export const DISTANCE_HINT = { closerBelow: 0.2, backAbove: 0.6, sourceId: 'SRC_DEMO_QUALITY_SCORES' } as const;

export type SessionPhase = 'idle' | 'starting' | 'live' | 'done' | 'error';
export interface SessionError {
  kind: CameraErrorKind | 'tracker' | 'processing';
  message: string;
}
export interface LiveState {
  elapsedSec: number;
  estimate: RppgEstimate | null;
  lum: number | null;
  clip: number | null;
  faceFound: boolean;
  distance: 'closer' | 'ok' | 'back' | null;
  fps: number;
  motionPx: number;
  rollDeg: number | null;
  framesOk: number;
  framesMissed: number;
  delegate: string;
  engineKind: string;
}

export const EMPTY_LIVE: LiveState = {
  elapsedSec: 0,
  estimate: null,
  lum: null,
  clip: null,
  faceFound: false,
  distance: null,
  fps: 0,
  motionPx: 0,
  rollDeg: null,
  framesOk: 0,
  framesMissed: 0,
  delegate: '—',
  engineKind: '—',
};

export interface Session {
  stream: MediaStream | null;
  engine: RppgEngine | null;
  stopLoop: (() => void) | null;
  watchdog: ReturnType<typeof setTimeout> | null;
  done: boolean;
}

export function waitForElement<T>(get: () => T | null, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const el = get();
      if (el) resolve(el);
      else if (Date.now() - t0 > timeoutMs) reject(new Error('video element not mounted'));
      else setTimeout(tick, 16);
    };
    tick();
  });
}

export function radialSd(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let v = 0;
  for (let i = 0; i < n; i++) v += ((xs[i] as number) - mx) ** 2 + ((ys[i] as number) - my) ** 2;
  return Math.sqrt(v / n);
}


export function distanceOf(faceWidthFrac: number): LiveState['distance'] {
  if (faceWidthFrac < DISTANCE_HINT.closerBelow) return 'closer';
  if (faceWidthFrac > DISTANCE_HINT.backAbove) return 'back';
  return 'ok';
}
