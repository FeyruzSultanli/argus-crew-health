// Injectable dependencies of the camera-pulse flow. The defaults use the real camera, MediaPipe and the rPPG
// worker; tests pass fakes (fake MediaStream, mocked landmarker, synthetic frame reader, inline engine).
import { getFaceLandmarker } from '../../../measurement/face/landmarker';
import {
  type FaceTracker,
  type FrameReader,
  createCanvasFrameReader,
  openCamera,
  startFrameLoop,
} from '../../../measurement/rppg/capture';
import { type RppgEngine, createRppgEngine } from '../../../measurement/rppg/engine';

export interface LoadedTracker extends FaceTracker {
  /** Shown on the debug overlay. */
  delegate: string;
}

export interface CameraPulseDeps {
  openCamera: () => Promise<MediaStream>;
  loadTracker: () => Promise<LoadedTracker>;
  createEngine: () => RppgEngine;
  createFrameReader: () => FrameReader;
  startLoop: (video: HTMLVideoElement, cb: (nowMs: number) => void) => () => void;
}

export class TrackerLoadError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'The face tracker could not load.');
    this.name = 'TrackerLoadError';
  }
}

async function loadMediaPipeTracker(): Promise<LoadedTracker> {
  try {
    const { landmarker, delegate } = await getFaceLandmarker({ blendshapes: false });
    return {
      delegate,
      detect(video, ts) {
        return landmarker.detectForVideo(video, ts).faceLandmarks[0] ?? null;
      },
    };
  } catch (e) {
    throw new TrackerLoadError(e);
  }
}

export const defaultCameraPulseDeps: CameraPulseDeps = {
  openCamera,
  loadTracker: loadMediaPipeTracker,
  createEngine: createRppgEngine,
  createFrameReader: createCanvasFrameReader,
  startLoop: startFrameLoop,
};
