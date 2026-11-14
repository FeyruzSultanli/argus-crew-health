// Face fluid-shift index — docs/09_MEASUREMENT_LAB.md §2 (FR-LAB-5), docs/07 §4.12. Experimental, not validated,
// trend only. Pure functions: frame acceptance, median aggregation over a 3-s capture, quality label, and the index
// against the subject's reference scan.
//
// Reference: no pre-flight scan exists in this demo, so the first accepted scan of a subject on this device is the
// reference ("Reference scan (set on this device)"); later scans are compared with it:
//   face_fluid_index = mean(cheekWidth/IPD ÷ reference, jawWidth/IPD ÷ reference); eye aperture shown separately.
import type { Quality } from '../../domain/types';
import type { FaceFeatures } from './geometry';
import type { Expression, HeadPose } from './pose';

/**
 * Measurement settings. The 3-s window and the four acceptance limits are the numbers of docs/09 §2; the quality
 * thresholds are our own. All are measurement settings of this prototype → "Demo parameter"
 * [SRC_DEMO_QUALITY_SCORES].
 */
export const FACE_SCAN = {
  sourceId: 'SRC_DEMO_QUALITY_SCORES',
  captureSec: 3,
  /** Frame accepted only if |yaw| < maxYawDeg and |pitch| < maxPitchDeg (strict). */
  maxYawDeg: 10,
  maxPitchDeg: 10,
  /** Neutral expression: jawOpen < maxJawOpen and smile < maxSmile (strict). */
  maxJawOpen: 0.1,
  maxSmile: 0.2,
  quality: {
    /** Fewer accepted frames than this → poor ("too few steady frames"). */
    minAcceptedFrames: 15,
    /** Share of accepted frames among all processed frames. */
    goodShare: 0.7,
    fairShare: 0.4,
    /** Relative spread of the width features over accepted frames (MAD ÷ median). */
    goodSpread: 0.02,
    fairSpread: 0.04,
    /** A rejection reason is named when it hit at least this share of all frames. */
    reasonShare: 0.2,
  },
} as const;

export type RejectReason = 'noface' | 'pose' | 'expression';

/** What one processed video frame gave. */
export interface FaceFrame {
  features: FaceFeatures | null;
  pose: HeadPose | null;
  expression: Expression | null;
}

export interface FrameVerdict {
  accepted: boolean;
  /** Every failed condition (empty when accepted). */
  reasons: RejectReason[];
  poseOk: boolean;
  expressionOk: boolean;
}

export function judgeFrame(f: FaceFrame): FrameVerdict {
  if (!f.features) return { accepted: false, reasons: ['noface'], poseOk: false, expressionOk: false };
  const poseOk =
    f.pose !== null && Math.abs(f.pose.yawDeg) < FACE_SCAN.maxYawDeg && Math.abs(f.pose.pitchDeg) < FACE_SCAN.maxPitchDeg;
  const expressionOk =
    f.expression !== null && f.expression.jawOpen < FACE_SCAN.maxJawOpen && f.expression.smile < FACE_SCAN.maxSmile;
  const reasons: RejectReason[] = [];
  if (!poseOk) reasons.push('pose');
  if (!expressionOk) reasons.push('expression');
  return { accepted: reasons.length === 0, reasons, poseOk, expressionOk };
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Median absolute deviation divided by the median (0 when fewer than 2 values). */
export function relativeSpread(xs: readonly number[]): number {
  const m = median(xs);
  if (m === null || xs.length < 2 || m === 0) return 0;
  return (median(xs.map((x) => Math.abs(x - m))) as number) / Math.abs(m);
}

export interface ScanSummary {
  totalFrames: number;
  acceptedFrames: number;
  rejected: Record<RejectReason, number>;
  /** Median features over the accepted frames; null when no frame was accepted. */
  features: FaceFeatures | null;
  /** Largest relative spread of the two width features. */
  spread: number;
  quality: Quality;
}

const REASON_WORD: Record<RejectReason | 'few' | 'spread', string> = {
  noface: 'no face found',
  pose: 'head turned',
  expression: 'mouth open or smiling',
  few: 'too few steady frames',
  spread: 'measurements varied between frames',
};

export function qualityOf(total: number, accepted: number, rejected: Record<RejectReason, number>, spread: number): Quality {
  const q = FACE_SCAN.quality;
  const share = total > 0 ? accepted / total : 0;
  const reasons: string[] = [];
  for (const r of ['noface', 'pose', 'expression'] as const) {
    if (total > 0 && rejected[r] / total >= q.reasonShare) reasons.push(REASON_WORD[r]);
  }
  const enough = accepted >= q.minAcceptedFrames;
  if (!enough || share < q.fairShare) reasons.push(REASON_WORD.few);
  if (enough && spread > q.goodSpread) reasons.push(REASON_WORD.spread);
  let label: Quality['label'];
  if (enough && share >= q.goodShare && spread <= q.goodSpread) label = 'good';
  else if (enough && share >= q.fairShare && spread <= q.fairSpread) label = 'fair';
  else label = 'poor';
  return { score: Math.round(share * 100) / 100, label, reasons };
}

/** Aggregates the frames of one capture: features = median over the accepted frames. */
export function summarizeScan(frames: readonly FaceFrame[]): ScanSummary {
  const rejected: Record<RejectReason, number> = { noface: 0, pose: 0, expression: 0 };
  const ok: FaceFeatures[] = [];
  for (const f of frames) {
    const v = judgeFrame(f);
    if (v.accepted && f.features) ok.push(f.features);
    for (const r of v.reasons) rejected[r]++;
  }
  const cheek = ok.map((f) => f.cheekWidth);
  const jaw = ok.map((f) => f.jawWidth);
  const features =
    ok.length > 0
      ? { cheekWidth: median(cheek) as number, jawWidth: median(jaw) as number, eyeAperture: median(ok.map((f) => f.eyeAperture)) as number }
      : null;
  const spread = Math.max(relativeSpread(cheek), relativeSpread(jaw));
  return {
    totalFrames: frames.length,
    acceptedFrames: ok.length,
    rejected,
    features,
    spread,
    quality: qualityOf(frames.length, ok.length, rejected, spread),
  };
}

/** Ratios of today's features to the reference features, and the index (mean of the two width ratios). */
export interface FluidIndex {
  index: number;
  cheekWidthRatio: number;
  jawWidthRatio: number;
  eyeApertureRatio: number;
}

export function fluidIndex(today: FaceFeatures, reference: FaceFeatures): FluidIndex {
  const cheekWidthRatio = today.cheekWidth / reference.cheekWidth;
  const jawWidthRatio = today.jawWidth / reference.jawWidth;
  return {
    index: (cheekWidthRatio + jawWidthRatio) / 2,
    cheekWidthRatio,
    jawWidthRatio,
    eyeApertureRatio: today.eyeAperture / reference.eyeAperture,
  };
}

/** The reference scan compared with itself: every ratio is exactly 1. */
export const REFERENCE_INDEX: FluidIndex = { index: 1, cheekWidthRatio: 1, jawWidthRatio: 1, eyeApertureRatio: 1 };

/** Percent difference vs the reference, rounded to whole percent (1.034 → 3). */
export function percentVsReference(ratio: number): number {
  return Math.round((ratio - 1) * 100);
}
