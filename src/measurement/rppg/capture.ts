// Camera capture and per-frame processing — docs/09_MEASUREMENT_LAB.md §1.2.
// PRIVACY (docs/PROJECT_RULES.md rule 7): frames are drawn to an in-memory canvas, reduced to a handful of means and dropped.
// Nothing here encodes, stores or sends an image — no toDataURL / toBlob / fetch / storage / MediaRecorder.
import { roiStats } from './frameStats';
import { type NormLandmark, type RoiResult, computeRois, roiBoxes } from './roi';
import type { FrameSample, MissReason } from './types';

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: 'user' },
};
/** Analysis canvas size (doc 09 §1.2: downscaled 320×240). */
export const ANALYSIS_W = 320;
export const ANALYSIS_H = 240;

export type CameraErrorKind = 'denied' | 'no-camera' | 'insecure' | 'unsupported' | 'busy' | 'other';

export class CameraError extends Error {
  readonly kind: CameraErrorKind;
  constructor(kind: CameraErrorKind, message: string) {
    super(message);
    this.name = 'CameraError';
    this.kind = kind;
  }
}

export async function openCamera(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new CameraError('insecure', 'The camera needs a secure page (https or localhost).');
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported', 'This browser does not offer camera access.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied', 'Camera access was blocked.');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CameraError('no-camera', 'No camera was found.');
    if (name === 'NotReadableError' || name === 'AbortError') throw new CameraError('busy', 'The camera is in use by another app.');
    throw new CameraError('other', e instanceof Error ? e.message : 'The camera could not start.');
  }
}

/** Stop every track of a stream (camera light goes off). Safe to call twice. */
export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Calls `cb(nowMs)` once per new video frame (requestVideoFrameCallback), else once per animation frame. */
export function startFrameLoop(video: HTMLVideoElement, cb: (nowMs: number) => void): () => void {
  let stopped = false;
  let handle = 0;
  const rvfc = typeof video.requestVideoFrameCallback === 'function';
  let lastMediaTime = -1;
  const step = (now: number) => {
    if (stopped) return;
    if (rvfc) cb(now);
    else if (video.readyState >= 2 && video.currentTime !== lastMediaTime) {
      // rAF fallback: only process when the video has a frame and it is a new one.
      lastMediaTime = video.currentTime;
      cb(now);
    }
    handle = rvfc ? video.requestVideoFrameCallback(step) : requestAnimationFrame(step);
  };
  handle = rvfc ? video.requestVideoFrameCallback(step) : requestAnimationFrame(step);
  return () => {
    stopped = true;
    if (rvfc) video.cancelVideoFrameCallback(handle);
    else cancelAnimationFrame(handle);
  };
}

/** Anything that finds face landmarks in a video frame (MediaPipe in the app, a fake in tests). */
export interface FaceTracker {
  detect(video: HTMLVideoElement, timestampMs: number): NormLandmark[] | null;
}

export type FrameResult =
  | { kind: 'frame'; sample: FrameSample; roi: RoiResult }
  | { kind: 'miss'; t: number; reason: MissReason; roi: RoiResult | null };

/** Reads ROI means from the current video frame. One instance per capture session. */
export interface FrameReader {
  read(video: HTMLVideoElement, landmarks: NormLandmark[] | null, t: number): FrameResult;
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function createCanvasFrameReader(): FrameReader {
  let ctx: Ctx2D | null = null;
  const getCtx = (): Ctx2D => {
    if (ctx) return ctx;
    const canvas: OffscreenCanvas | HTMLCanvasElement =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(ANALYSIS_W, ANALYSIS_H)
        : Object.assign(document.createElement('canvas'), { width: ANALYSIS_W, height: ANALYSIS_H });
    const c = canvas.getContext('2d', { willReadFrequently: true }) as Ctx2D | null;
    if (!c) throw new Error('2D canvas is not available');
    ctx = c;
    return c;
  };
  return {
    read(video, landmarks, t) {
      if (!landmarks) return { kind: 'miss', t, reason: 'noface', roi: null };
      const roi = computeRois(landmarks, ANALYSIS_W, ANALYSIS_H);
      if (!roi.ok) return { kind: 'miss', t, reason: roi.reason === 'roll' ? 'roll' : 'roi', roi };
      const c = getCtx();
      c.drawImage(video, 0, 0, ANALYSIS_W, ANALYSIS_H);
      const img = c.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H);
      const s = roiStats(img.data, ANALYSIS_W, roiBoxes(roi));
      if (!s) return { kind: 'miss', t, reason: 'roi', roi };
      return {
        kind: 'frame',
        roi,
        sample: { t, r: s.r, g: s.g, b: s.b, lum: s.lum, clip: s.clip, cx: roi.centroid.x, cy: roi.centroid.y },
      };
    },
  };
}
