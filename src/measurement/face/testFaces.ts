// Synthetic face landmarks / detections with known geometry, for unit and component tests of the face scan.
// Test helper only (no camera, no MediaPipe).
import type { NormLandmark } from '../rppg/roi';
import { FACE_LM } from './geometry';
import { type MatrixLike, matrixFromPose } from './pose';

export interface SyntheticFace {
  /** Distances in px at scale 1 (image 640 × 480 unless width/height say otherwise). */
  ipd?: number;
  cheek?: number;
  jaw?: number;
  eyeRight?: number;
  eyeLeft?: number;
  /** Uniform scale about the image centre (camera distance) and translation in px. */
  scale?: number;
  dx?: number;
  dy?: number;
  width?: number;
  height?: number;
}

export const DEFAULT_FACE = { ipd: 60, cheek: 130, jaw: 100, eyeRight: 10, eyeLeft: 10 } as const;

export function syntheticFace(o: SyntheticFace = {}): NormLandmark[] {
  const { ipd, cheek, jaw, eyeRight, eyeLeft } = { ...DEFAULT_FACE, ...o };
  const { scale = 1, dx = 0, dy = 0, width = 640, height = 480 } = o;
  const cx = width / 2;
  const cy = height / 2;
  const px: Record<number, [number, number]> = {
    [FACE_LM.irisRight]: [-ipd / 2, -40],
    [FACE_LM.irisLeft]: [ipd / 2, -40],
    [FACE_LM.cheekA]: [-cheek / 2, 0],
    [FACE_LM.cheekB]: [cheek / 2, 0],
    [FACE_LM.jawA]: [-jaw / 2, 60],
    [FACE_LM.jawB]: [jaw / 2, 60],
    [FACE_LM.lidRightUpper]: [-ipd / 2, -40 - eyeRight / 2],
    [FACE_LM.lidRightLower]: [-ipd / 2, -40 + eyeRight / 2],
    [FACE_LM.lidLeftUpper]: [ipd / 2, -40 - eyeLeft / 2],
    [FACE_LM.lidLeftLower]: [ipd / 2, -40 + eyeLeft / 2],
  };
  const lm: NormLandmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [k, [x, y]] of Object.entries(px)) {
    lm[Number(k)] = { x: (cx + dx + x * scale) / width, y: (cy + dy + y * scale) / height, z: 0 };
  }
  return lm;
}

export interface SyntheticDetection {
  landmarks: NormLandmark[];
  matrix: MatrixLike | null;
  blendshapes: Array<{ categoryName: string; score: number }> | null;
}

export function syntheticDetection(
  o: SyntheticFace & { yaw?: number; pitch?: number; jawOpen?: number; smile?: number } = {},
): SyntheticDetection {
  return {
    landmarks: syntheticFace(o),
    matrix: matrixFromPose(o.yaw ?? 0, o.pitch ?? 0, 0, 1),
    blendshapes: [
      { categoryName: 'jawOpen', score: o.jawOpen ?? 0.02 },
      { categoryName: 'mouthSmileLeft', score: o.smile ?? 0.05 },
      { categoryName: 'mouthSmileRight', score: (o.smile ?? 0.05) / 2 },
    ],
  };
}
