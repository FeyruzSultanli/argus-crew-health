// Shared types of the camera-pulse (rPPG) pipeline — docs/09_MEASUREMENT_LAB.md §1.2.
// Pure TypeScript: these objects cross the worker boundary (structured clone), so no class instances.
import type { Quality } from '../../domain/types';

/** One analysed video frame: means over the ROI pixels only. No pixels ever leave the main thread. */
export interface FrameSample {
  /** Frame timestamp, ms (monotonic clock). */
  t: number;
  /** Mean R, G, B over forehead + cheek ROI pixels (0..255). */
  r: number;
  g: number;
  b: number;
  /** Mean ROI luminance (Rec. 601 luma, 0..255). */
  lum: number;
  /** Clipped ROI pixels, % (any channel ≥ 250). */
  clip: number;
  /** Landmark centroid, px in a frame scaled to 640 px width (motion check, doc 09 §1.3). */
  cx: number;
  cy: number;
}

export type MissReason = 'noface' | 'roll' | 'roi';

/** Messages into the rPPG worker. */
export type RppgIn =
  | { type: 'reset'; durationSec?: number }
  | ({ type: 'frame' } & FrameSample)
  | { type: 'miss'; t: number; reason: MissReason }
  | { type: 'finalize' };

export type CheckId = 'snr' | 'consistency' | 'motion' | 'lighting' | 'face';
export type CheckLabel = Quality['label'];

export interface QualityCheck {
  id: CheckId;
  label: CheckLabel;
  /** Normalised 0..1 (good 1, fair 0.5, poor 0). */
  norm: number;
  /** Measured value(s) shown in debug / details. */
  value: number;
  value2?: number;
  /** Plain-words reason, only when label is not 'good'. */
  reason?: string;
}

/** Live (every second) or final estimate from the worker. */
export interface RppgEstimate {
  type: 'estimate';
  final: boolean;
  /** true once ≥ 10 s of data are in (the live number stops being greyed). */
  stable: boolean;
  elapsedSec: number;
  /** Heart rate, beats per minute (unrounded); null when there is not enough data. */
  bpm: number | null;
  snrDb: number | null;
  quality: Quality;
  checks: QualityCheck[];
  /** Band-passed pulse spectrum for display, 42..180 bpm in 1-bpm steps, normalised to max 1. */
  spectrum: { bpm: number[]; power: number[] };
  /** Last ≤ 10 s of the band-passed pulse signal at 30 Hz, normalised to [-1, 1]. */
  waveform: number[];
  /** HR of first and last 15 s (final only). */
  hrFirst?: number;
  hrLast?: number;
}

export type RppgOut = RppgEstimate;
