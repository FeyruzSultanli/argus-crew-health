// Face geometry features for the fluid-shift scan — docs/09_MEASUREMENT_LAB.md §2 (FR-LAB-5).
// Pure functions on MediaPipe face landmarks (478-point model with iris refinement) [SRC_MEDIAPIPE_FACE].
// Every distance is normalised by the inter-pupillary distance (IPD), so the features do not depend on how far
// the face is from the camera (uniform scale) or where it is in the frame (translation).
//
// Landmark indices (MediaPipe face-mesh numbering; checked against the connection lists that ship with
// @mediapipe/tasks-vision 1.2.3; to be confirmed by eye on the ?debug=face overlay):
//   468 / 473  iris centres (right / left eye of the subject; contours 469–472 and 474–477)
//   234 / 454  face edge at cheek level (FACE_OVAL, 10 steps from the chin on each side; also used by rPPG)
//   172 / 397  lower jaw (FACE_OVAL, 6 steps from the chin on each side)
//   159 / 145  right eye, middle of the upper / lower lid contour
//   386 / 374  left eye, middle of the upper / lower lid contour
import type { NormLandmark } from '../rppg/roi';

export const FACE_LM = {
  irisRight: 468,
  irisLeft: 473,
  cheekA: 234,
  cheekB: 454,
  jawA: 172,
  jawB: 397,
  lidRightUpper: 159,
  lidRightLower: 145,
  lidLeftUpper: 386,
  lidLeftLower: 374,
} as const;

/** The landmarks the scan uses (the ?debug=face overlay draws exactly these). */
export const FACE_SCAN_LANDMARKS: readonly number[] = Object.values(FACE_LM);

/** The three measured segments plus the IPD, as landmark pairs (for the overlay). */
export const FACE_SEGMENTS: ReadonlyArray<{ name: string; a: number; b: number }> = [
  { name: 'IPD', a: FACE_LM.irisRight, b: FACE_LM.irisLeft },
  { name: 'cheek', a: FACE_LM.cheekA, b: FACE_LM.cheekB },
  { name: 'jaw', a: FACE_LM.jawA, b: FACE_LM.jawB },
  { name: 'eye R', a: FACE_LM.lidRightUpper, b: FACE_LM.lidRightLower },
  { name: 'eye L', a: FACE_LM.lidLeftUpper, b: FACE_LM.lidLeftLower },
];

/** Features of one frame, each divided by the IPD (dimensionless). */
export interface FaceFeatures {
  cheekWidth: number;
  jawWidth: number;
  /** Mean of the two upper–lower lid distances. */
  eyeAperture: number;
}

export interface FaceGeometry {
  /** Inter-pupillary distance in px of the image the landmarks belong to. */
  ipdPx: number;
  features: FaceFeatures;
}

/** Below this IPD (px) the face is too small or the irises were not found; the frame is not used. */
export const MIN_IPD_PX = 8;

/**
 * Features from normalised landmarks of an image of `width` × `height` px. MediaPipe normalises x by the width and
 * y by the height, so both are scaled back to pixels before measuring (2-D distances in the image plane).
 * Returns null when a landmark is missing or the IPD is implausibly small.
 */
export function faceGeometry(landmarks: ArrayLike<NormLandmark>, width: number, height: number): FaceGeometry | null {
  const p = (i: number) => {
    const l = landmarks[i];
    return l ? { x: l.x * width, y: l.y * height } : null;
  };
  const d = (a: number, b: number): number | null => {
    const pa = p(a);
    const pb = p(b);
    return pa && pb ? Math.hypot(pb.x - pa.x, pb.y - pa.y) : null;
  };
  const ipd = d(FACE_LM.irisRight, FACE_LM.irisLeft);
  const cheek = d(FACE_LM.cheekA, FACE_LM.cheekB);
  const jaw = d(FACE_LM.jawA, FACE_LM.jawB);
  const eyeR = d(FACE_LM.lidRightUpper, FACE_LM.lidRightLower);
  const eyeL = d(FACE_LM.lidLeftUpper, FACE_LM.lidLeftLower);
  if (ipd === null || cheek === null || jaw === null || eyeR === null || eyeL === null) return null;
  if (!Number.isFinite(ipd) || ipd < MIN_IPD_PX) return null;
  return {
    ipdPx: ipd,
    features: { cheekWidth: cheek / ipd, jawWidth: jaw / ipd, eyeAperture: (eyeR + eyeL) / 2 / ipd },
  };
}
