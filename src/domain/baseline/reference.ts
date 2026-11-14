// Reference selection (doc 08 §2): pre-flight baseline, expected spaceflight shift, adaptive in-flight baseline.
import type { MissionProfile, SignalDef, Verdict } from '../types';
import { BASELINE_PARAMS as P } from './constants';
import { robustStats } from './robust';

export interface PreflightBaseline {
  /** m_pre: median of the pre-flight daily values. */
  m: number;
  /** σ_pre: max(1.4826 · MAD, floor), × 1.5 when thin. */
  sigma: number;
  mad: number;
  /** Number of pre-flight daily values. */
  n: number;
  /** 3 ≤ n < 5 → quality note "thin baseline". */
  thin: boolean;
}

/** Daily values with missionDay ∈ [−180, −1], in day order. */
export function preflightValues(daily: ReadonlyMap<number, number>): number[] {
  const out: number[] = [];
  for (const [day, v] of daily) if (day >= P.preflightFromDay && day <= P.preflightToDay) out.push(v);
  return out;
}

/**
 * B_pre = (m_pre, σ_pre). n < 3 → null (personal layer NO_DATA). 3 ≤ n < 5 → σ × 1.5 after the floor (TV-6).
 */
export function preflightBaseline(values: readonly number[], floor: number): PreflightBaseline | null {
  if (values.length < P.minPreflight) return null;
  const s = robustStats(values, floor);
  if (s === null) return null;
  const thin = values.length < P.fullPreflight;
  return { m: s.median, sigma: thin ? s.sigma * P.thinFactor : s.sigma, mad: s.mad, n: s.n, thin };
}

/** expectedShift(ctx) of the signal for that mission day (0 when the signal declares none). */
export function expectedShift(def: SignalDef, missionDay: number, profile: MissionProfile): number {
  return def.personal.expectedShift?.({ missionDay, profile }) ?? 0;
}

export interface DayRecord {
  /** Daily value of that day (see aggregate.ts). */
  value: number;
  /** Personal verdict of that day (worse direction). */
  verdict: Verdict;
}

export interface AdaptiveBaseline {
  m: number;
  sigma: number;
  /** Number of days used. */
  n: number;
  days: number[];
}

/** The latest "Accept as new normal" day before `today`, or null. */
export function lastAcceptedBefore(today: number, accepted: readonly number[] | undefined): number | null {
  let best: number | null = null;
  for (const a of accepted ?? []) if (a < today && (best === null || a > best)) best = a;
  return best;
}

/**
 * B_ad from the last 14 mission days before `today` (in-flight only) whose personal verdict was NOMINAL or
 * EXPECTED; null unless ≥ 7 such days exist. σ_ad = max(1.4826 · MAD, floor) (doc 08 §2.3, TV-7).
 * `accepted`: days on which the CMO accepted a persistent shift as the new normal (FR-BAS-7); on later days the
 * WATCH days up to that acceptance count as normal days too (ACT days never do).
 */
export function adaptiveBaseline(
  today: number,
  history: ReadonlyMap<number, DayRecord>,
  floor: number,
  accepted?: readonly number[],
): AdaptiveBaseline | null {
  const acceptedUpTo = lastAcceptedBefore(today, accepted);
  const values: number[] = [];
  const days: number[] = [];
  const from = Math.max(1, today - P.adaptiveWindowDays);
  for (let d = from; d < today; d += 1) {
    const r = history.get(d);
    if (r === undefined) continue;
    const normal =
      r.verdict === 'NOMINAL' ||
      r.verdict === 'EXPECTED' ||
      (r.verdict === 'WATCH' && acceptedUpTo !== null && d <= acceptedUpTo);
    if (!normal) continue;
    values.push(r.value);
    days.push(d);
  }
  if (values.length < P.adaptiveMinDays) return null;
  const s = robustStats(values, floor);
  if (s === null) return null;
  return { m: s.median, sigma: s.sigma, n: s.n, days };
}

export type ReferenceKind = 'preflight' | 'adaptive';

export interface Reference {
  m: number;
  sigma: number;
  kind: ReferenceKind;
  /** m_pre' = m_pre + expected shift. */
  mPre: number;
  sigmaPre: number;
  shift: number;
  adaptive: AdaptiveBaseline | null;
}

/** ref = B_ad if available, else (m_pre', σ_pre) (doc 08 §2.4). */
export function selectReference(
  pre: PreflightBaseline,
  shift: number,
  adaptive: AdaptiveBaseline | null,
): Reference {
  const mPre = pre.m + shift;
  const base = { mPre, sigmaPre: pre.sigma, shift, adaptive };
  return adaptive === null
    ? { ...base, m: mPre, sigma: pre.sigma, kind: 'preflight' }
    : { ...base, m: adaptive.m, sigma: adaptive.sigma, kind: 'adaptive' };
}
