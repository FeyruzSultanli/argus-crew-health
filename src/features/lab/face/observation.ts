// The health-record observation of a face scan (doc 06 §1, docs/09 §2). Only derived numbers — never frames.
import type { NewObservation, Quality } from '../../../domain/types';
import type { FluidIndex } from '../../../measurement/face/fluidShiftIndex';

export const FACE_SOURCE = { kind: 'camera', method: 'face-geometry (MediaPipe landmarks)', label: 'MEASURED' } as const;

const r4 = (v: number) => Math.round(v * 10_000) / 10_000;

/**
 * value = face_fluid_index (unit '1'; 1.00 = same as the reference). Components are the ratios vs the reference,
 * the number of accepted frames and `referenceScan` (1 for the scan that set the reference, else 0).
 */
export function toFaceObservation(o: {
  crewId: string;
  missionDay: number;
  index: FluidIndex;
  quality: Quality;
  acceptedFrames: number;
  isReference: boolean;
}): NewObservation {
  return {
    crewId: o.crewId,
    signalId: 'face_fluid_index',
    value: r4(o.index.index),
    unit: '1',
    missionDay: o.missionDay,
    components: {
      cheekWidthRatio: r4(o.index.cheekWidthRatio),
      jawWidthRatio: r4(o.index.jawWidthRatio),
      eyeApertureRatio: r4(o.index.eyeApertureRatio),
      acceptedFrames: o.acceptedFrames,
      referenceScan: o.isReference ? 1 : 0,
    },
    source: { ...FACE_SOURCE },
    quality: { score: o.quality.score, label: o.quality.label, reasons: [...o.quality.reasons] },
  };
}
