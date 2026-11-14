// Scores (doc 08 §3): signed z per direction, one-sided CuSum with the recovery reset, drift.
// z, S and drift are rounded to 2 decimals before any threshold test ((7.1 − 0.9 − 5.3) / 0.3 must be 3.0).
import { roundTo } from '../units';
import { BASELINE_PARAMS as P } from './constants';

export type Side = 'up' | 'down';

export const round2 = (x: number): number => roundTo(x, P.decimals);

/** z_t = (x − m) / σ for up, (m − x) / σ for down; rounded. */
export function signedZ(x: number, m: number, sigma: number, side: Side): number {
  const raw = side === 'up' ? (x - m) / sigma : (m - x) / sigma;
  return round2(raw);
}

export interface CusumStep {
  S: number;
  /** True when the recovery reset fired on this reading. */
  reset: boolean;
}

/**
 * S_t = max(0, S_{t−1} + z_t − k), k = 0.5; recovery reset: z_t < 1.0 and z_{t−1} < 1.0 → S_t = 0.
 * `prevZ` is the z of the previous reading (null for the first in-flight reading).
 */
export function cusumStep(prevS: number, z: number, prevZ: number | null): CusumStep {
  if (prevZ !== null && z < P.resetZ && prevZ < P.resetZ) return { S: 0, reset: true };
  return { S: round2(Math.max(0, prevS + z - P.k)), reset: false };
}

/** drift = (m_ad − m_pre') / σ_pre, signed by direction; rounded (only when B_ad exists). */
export function driftScore(mAdaptive: number, mPre: number, sigmaPre: number, side: Side): number {
  const raw = side === 'up' ? (mAdaptive - mPre) / sigmaPre : (mPre - mAdaptive) / sigmaPre;
  return round2(raw);
}
