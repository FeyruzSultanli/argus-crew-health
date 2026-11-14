// Aggregates that rules compute from ctx.history (same crew + same signal, oldest first, includes today).
import type { Observation } from '../types';
import { missionDayWindow } from '../units';

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const hi = s[mid] as number;
  return s.length % 2 === 1 ? hi : ((s[mid - 1] as number) + hi) / 2;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Stable chronological order: missionDay, then effectiveAt. */
export function chronological(obs: readonly Observation[]): Observation[] {
  return [...obs].sort((a, b) => a.missionDay - b.missionDay || a.effectiveAt.localeCompare(b.effectiveAt));
}

export function readingsOfDay(history: readonly Observation[], day: number): Observation[] {
  return history.filter((o) => o.missionDay === day);
}

/** How the readings of one day collapse to one daily value. */
export type DailyPick = 'last' | 'mean' | 'median' | 'max';

function pick(values: readonly number[], how: DailyPick): number | null {
  if (values.length === 0) return null;
  switch (how) {
    case 'last':
      return values[values.length - 1] as number;
    case 'mean':
      return mean(values);
    case 'median':
      return median(values);
    case 'max':
      return Math.max(...values);
  }
}

/** Daily value of the readings of `day` (primary value, or a component when `component` is given). */
export function dailyValue(
  history: readonly Observation[],
  day: number,
  how: DailyPick,
  component?: string,
): number | null {
  const values = chronological(readingsOfDay(history, day))
    .map((o) => (component === undefined ? o.value : o.components?.[component]))
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return pick(values, how);
}

export interface WindowMean {
  mean: number | null;
  /** Number of days in the window that had a value. */
  n: number;
  days: number[];
}

/**
 * Mean of the daily values over the `nDays` mission days ending at `endDay` (inclusive, no day 0).
 * Days without a reading are skipped (the mean is over the days that have one).
 */
export function windowMean(
  history: readonly Observation[],
  endDay: number,
  nDays: number,
  how: DailyPick,
  component?: string,
): WindowMean {
  const days = missionDayWindow(endDay, nDays);
  const values: number[] = [];
  const used: number[] = [];
  for (const d of days) {
    const v = dailyValue(history, d, how, component);
    if (v !== null) {
      values.push(v);
      used.push(d);
    }
  }
  return { mean: mean(values), n: values.length, days: used };
}

/**
 * Pre-flight medians (missionDay −180…−1) of the value and of every component — the shape of RuleCtx.preflight.
 * Helper for callers that build a RuleCtx (the baseline engine computes its own robust reference).
 */
export function preflightOf(observations: readonly Observation[]): {
  median: number | null;
  n: number;
  components?: Record<string, number>;
} {
  const pre = observations.filter((o) => o.missionDay >= -180 && o.missionDay <= -1);
  const values = pre.map((o) => o.value).filter((v): v is number => typeof v === 'number');
  const keys = new Set(pre.flatMap((o) => Object.keys(o.components ?? {})));
  const components: Record<string, number> = {};
  for (const k of keys) {
    const m = median(pre.map((o) => o.components?.[k]).filter((v): v is number => typeof v === 'number'));
    if (m !== null) components[k] = m;
  }
  const result: { median: number | null; n: number; components?: Record<string, number> } = {
    median: median(values),
    n: pre.length,
  };
  if (keys.size > 0) result.components = components;
  return result;
}
