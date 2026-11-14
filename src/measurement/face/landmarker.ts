// Shared MediaPipe Face Landmarker loader (camera pulse; reused by the vision check and the face scan).
// Offline-first (docs/PROJECT_RULES.md rule 4): the WASM runtime and the model are self-hosted under public/mediapipe/ and load
// from the same origin only — never from a CDN. MediaPipe Face Landmarker [SRC_MEDIAPIPE_FACE], Apache-2.0.
// The @mediapipe/tasks-vision JS bundle is imported dynamically so it stays out of the main chunk.
import type { FaceLandmarker } from '@mediapipe/tasks-vision';

import { assetUrl } from '../../config/paths';

export const MEDIAPIPE_BASE = assetUrl('mediapipe');
export const FACE_MODEL_PATH = `${MEDIAPIPE_BASE}/face_landmarker.task`;

export interface FaceLandmarkerOpts {
  /** Blendshapes are off for rPPG; the face scan may turn them on. */
  blendshapes?: boolean;
  /** Facial transformation matrix (head pose); off for rPPG, on for the face scan. Default false. */
  transformMatrix?: boolean;
  /** Try 'GPU' first (default) and fall back to 'CPU' when it fails. */
  delegate?: 'GPU' | 'CPU';
  numFaces?: number;
}

export interface LoadedFaceLandmarker {
  landmarker: FaceLandmarker;
  delegate: 'GPU' | 'CPU';
}

const cache = new Map<string, Promise<LoadedFaceLandmarker>>();

/** MediaPipe's WASM build prints informational glog/TFLite lines on stderr (console.error), e.g.
 * "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." Re-route only those info lines to console.info so real
 * errors stay visible as errors. Installed once, the first time a landmarker is created. */
const INFO_LINE = /^(INFO: |I\d{4} )/;
let consoleFilterInstalled = false;
function installMediaPipeInfoFilter(): void {
  if (consoleFilterInstalled || typeof console === 'undefined') return;
  consoleFilterInstalled = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && INFO_LINE.test(args[0])) console.info('[mediapipe]', ...args);
    else original(...args);
  };
}

async function create(opts: Required<FaceLandmarkerOpts>): Promise<LoadedFaceLandmarker> {
  installMediaPipeInfoFilter();
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_BASE);
  const build = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL_PATH, delegate },
      runningMode: 'VIDEO',
      numFaces: opts.numFaces,
      outputFaceBlendshapes: opts.blendshapes,
      outputFacialTransformationMatrixes: opts.transformMatrix,
    });
  if (opts.delegate === 'GPU') {
    try {
      return { landmarker: await build('GPU'), delegate: 'GPU' };
    } catch {
      // Some GPUs / browsers cannot run the WebGL delegate; the CPU (WASM) path always works.
    }
  }
  return { landmarker: await build('CPU'), delegate: 'CPU' };
}

/**
 * Cached Face Landmarker in VIDEO mode (one instance per option set). Callers must pass monotonically increasing
 * timestamps to `detectForVideo` (use performance.now()). A failed load is not cached, so a retry can succeed.
 */
export function getFaceLandmarker(opts: FaceLandmarkerOpts = {}): Promise<LoadedFaceLandmarker> {
  const full: Required<FaceLandmarkerOpts> = {
    blendshapes: opts.blendshapes ?? false,
    transformMatrix: opts.transformMatrix ?? false,
    delegate: opts.delegate ?? 'GPU',
    numFaces: opts.numFaces ?? 1,
  };
  const key = JSON.stringify(full);
  let p = cache.get(key);
  if (!p) {
    p = create(full);
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}
