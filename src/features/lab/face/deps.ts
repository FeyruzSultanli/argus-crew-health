// Injectable dependencies of the face fluid-shift scan. The defaults use the real camera and the shared MediaPipe
// loader with blendshapes + transformation matrix ON (a separately cached instance; the camera-pulse instance with
// both OFF is untouched). Tests pass a fake camera and a fake tracker that returns synthetic landmarks.
import { getFaceLandmarker } from '../../../measurement/face/landmarker';
import type { MatrixLike } from '../../../measurement/face/pose';
import { openCamera, startFrameLoop } from '../../../measurement/rppg/capture';
import type { NormLandmark } from '../../../measurement/rppg/roi';

/** What the tracker returns for one video frame (numbers only — never pixels). */
export interface FaceDetection {
  landmarks: NormLandmark[];
  matrix: MatrixLike | null;
  blendshapes: ReadonlyArray<{ categoryName: string; score: number }> | null;
}

export interface FaceScanTracker {
  delegate: string;
  detect(video: HTMLVideoElement, timestampMs: number): FaceDetection | null;
}

export interface FaceScanDeps {
  openCamera: () => Promise<MediaStream>;
  loadTracker: () => Promise<FaceScanTracker>;
  startLoop: (video: HTMLVideoElement, cb: (nowMs: number) => void) => () => void;
}

export class FaceTrackerLoadError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'The face tracker could not load.');
    this.name = 'FaceTrackerLoadError';
  }
}

async function loadMediaPipeFaceScan(): Promise<FaceScanTracker> {
  try {
    const { landmarker, delegate } = await getFaceLandmarker({ blendshapes: true, transformMatrix: true });
    return {
      delegate,
      detect(video, ts) {
        const r = landmarker.detectForVideo(video, ts);
        const landmarks = r.faceLandmarks[0];
        if (!landmarks) return null;
        return {
          landmarks,
          matrix: r.facialTransformationMatrixes?.[0] ?? null,
          blendshapes: r.faceBlendshapes?.[0]?.categories ?? null,
        };
      },
    };
  } catch (e) {
    throw new FaceTrackerLoadError(e);
  }
}

export const defaultFaceScanDeps: FaceScanDeps = {
  openCamera,
  loadTracker: loadMediaPipeFaceScan,
  startLoop: startFrameLoop,
};
