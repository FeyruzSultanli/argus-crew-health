// Robust statistics (doc 08 §1): median, MAD and the floored robust sigma.
import { median } from '../rules/history';
import { BASELINE_PARAMS } from './constants';

export { median };

/** Median absolute deviation: median(|x − median(X)|). null for an empty list. */
export function mad(values: readonly number[]): number | null {
  const m = median(values);
  if (m === null) return null;
  return median(values.map((v) => Math.abs(v - m)));
}

/** σ = max(1.4826 · MAD, floor). null for an empty list. */
export function robustSigma(values: readonly number[], floor: number): number | null {
  const d = mad(values);
  if (d === null) return null;
  return Math.max(BASELINE_PARAMS.madToSigma * d, floor);
}

export interface RobustStats {
  median: number;
  mad: number;
  /** 1.4826 · MAD before the floor. */
  rawSigma: number;
  /** max(rawSigma, floor). */
  sigma: number;
  n: number;
}

/** Median, MAD and floored sigma in one pass. null for an empty list. */
export function robustStats(values: readonly number[], floor: number): RobustStats | null {
  const m = median(values);
  if (m === null) return null;
  const d = median(values.map((v) => Math.abs(v - m))) as number;
  const rawSigma = BASELINE_PARAMS.madToSigma * d;
  return { median: m, mad: d, rawSigma, sigma: Math.max(rawSigma, floor), n: values.length };
}
