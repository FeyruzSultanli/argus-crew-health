// Test fakes for the camera-pulse flow: fake MediaStream, mocked landmarker, synthetic frame reader, a frame loop
// that replays 30 fps timestamps quickly, and the in-thread engine. Test helper only.
import type { FrameReader } from '../../../measurement/rppg/capture';
import { createInlineEngine } from '../../../measurement/rppg/engine';
import { type NormLandmark, computeRois } from '../../../measurement/rppg/roi';
import { gauss, rng } from '../../../measurement/rppg/testSignals';
import type { CameraPulseDeps } from './deps';

export interface FakeTrack {
  kind: 'video';
  stop: () => void;
  stopped: boolean;
}

export function fakeStream(): { stream: MediaStream; track: FakeTrack } {
  const track: FakeTrack = {
    kind: 'video',
    stopped: false,
    stop() {
      track.stopped = true;
    },
  };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track], active: true } as unknown as MediaStream;
  return { stream, track };
}

/** An upright face roughly centred in the frame (normalised coordinates). */
export function fakeLandmarks(): NormLandmark[] {
  const px: Record<number, [number, number]> = {
    10: [160, 60],
    152: [160, 200],
    234: [110, 120],
    454: [210, 120],
    168: [160, 100],
    33: [130, 105],
    263: [190, 105],
    61: [140, 165],
    291: [180, 165],
  };
  const lm: NormLandmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  for (const [k, [x, y]] of Object.entries(px)) lm[Number(k)] = { x: x / 320, y: y / 240 };
  return lm;
}

/** Frame reader that returns synthetic ROI means: a pulse of `pulseHz` in G (0 = noise only). */
export function syntheticReader(pulseHz: number, seed = 1): FrameReader {
  const n = gauss(rng(seed));
  return {
    read(_video, landmarks, t) {
      if (!landmarks) return { kind: 'miss', t, reason: 'noface', roi: null };
      const roi = computeRois(landmarks, 320, 240);
      const s = t / 1000;
      const pulse = pulseHz > 0 ? 0.6 * Math.sin(2 * Math.PI * pulseHz * s) : 0;
      const sd = pulseHz > 0 ? 0.3 : 0.5;
      return {
        kind: 'frame',
        roi,
        sample: {
          t,
          r: 150 + n() * sd,
          g: 110 + pulse + n() * sd,
          b: 90 + n() * sd,
          lum: 120,
          clip: 0,
          cx: roi.centroid.x + n() * 0.5,
          cy: roi.centroid.y + n() * 0.5,
        },
      };
    },
  };
}

/** Replays 30 fps frame timestamps in chunks (macrotasks) until stopped. */
export function fastLoop(totalFrames = 1000): CameraPulseDeps['startLoop'] {
  return (_video, cb) => {
    let stopped = false;
    let i = 0;
    const tick = () => {
      for (let k = 0; k < 60 && !stopped && i < totalFrames; k++) cb(1000 + (i++ * 1000) / 30);
      if (!stopped && i < totalFrames) setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
    return () => {
      stopped = true;
    };
  };
}

export function fakeDeps(o: { pulseHz?: number; openCamera?: CameraPulseDeps['openCamera'] } = {}) {
  const { stream, track } = fakeStream();
  const deps: CameraPulseDeps = {
    openCamera: o.openCamera ?? (() => Promise.resolve(stream)),
    loadTracker: () => Promise.resolve({ delegate: 'fake', detect: () => fakeLandmarks() }),
    createEngine: createInlineEngine,
    createFrameReader: () => syntheticReader(o.pulseHz ?? 1.2),
    startLoop: fastLoop(),
  };
  return { deps, stream, track };
}
