// Test helpers for the baseline engine (not imported by production code).
import { PROFILE, obs } from '../../__tests__/fixtures';
import type { Observation, PersonalParams, SignalDef, SignalId } from '../../types';
import { computePersonalSeries } from '../personal';
import type { PersonalSeriesResult } from '../personal';

export { PROFILE };

/** One reading per [day, value]. */
export function readings(
  signalId: SignalId,
  values: ReadonlyArray<readonly [number, number]>,
  extra: Partial<Observation> = {},
): Observation[] {
  return values.map(([d, v]) => obs(signalId, v, d, extra));
}

/** [day, value] pairs for consecutive days starting at `firstDay` (skipping day 0). */
export function days(firstDay: number, values: readonly number[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let d = firstDay;
  for (const v of values) {
    if (d === 0) d = 1;
    out.push([d, v]);
    d += 1;
  }
  return out;
}

/** The value repeated `n` times following a repeating pattern. */
export function cycle(pattern: readonly number[], n: number): number[] {
  return Array.from({ length: n }, (_, i) => pattern[i % pattern.length] as number);
}

export function runAll(def: SignalDef, observations: readonly Observation[]): PersonalSeriesResult {
  return computePersonalSeries(def, observations, { upToDay: Number.POSITIVE_INFINITY, profile: PROFILE });
}

/** A copy of a signal definition with other personal params (and no expected shift unless given). */
export function withParams(
  def: SignalDef,
  params: PersonalParams[],
  expectedShift?: SignalDef['personal']['expectedShift'],
): SignalDef {
  const personal: SignalDef['personal'] = { enabled: true, params };
  if (expectedShift !== undefined) personal.expectedShift = expectedShift;
  return { ...def, personal };
}

/** Deterministic PRNG (mulberry32). */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pre-flight around 58 (median 58, MAD 1 → σ = floor 2), long in-flight history around 58, then the TV-8 tail. */
export const TAIL_127_140 = [58, 59, 58, 57, 58, 59, 58, 59, 59, 57, 59, 58, 58, 57];
export function oseiHeartRate(after: readonly number[] = []): Observation[] {
  return readings('heart_rate_rest', [
    ...days(-30, cycle([58, 59, 57, 58, 58, 59, 57], 30)),
    ...days(1, cycle([58, 57, 59, 58, 58, 59, 57], 126)),
    ...days(127, TAIL_127_140),
    ...days(141, [63, 68, 69, ...after]),
  ]);
}

export const bp = (day: number, systolic: number, diastolic: number): Observation =>
  obs('blood_pressure', null, day, { components: { systolic, diastolic } });

/** `n` consecutive daily readings of a constant (in the shape each signal expects) from `firstDay`. */
export function buildConstant(def: SignalDef, c: number, n: number, firstDay: number): Observation[] {
  const out: Observation[] = [];
  for (const [d] of days(firstDay, cycle([0], n))) {
    if (def.id === 'blood_pressure') out.push(bp(d, c, c));
    else if (def.id === 'glucose') out.push(obs('glucose', c, d, { context: { glucose: 'fasting' } }));
    else if (def.id === 'near_acuity') {
      out.push(obs('near_acuity', c / 100, d, { context: { eye: 'left' } }));
      out.push(obs('near_acuity', c / 100, d, { context: { eye: 'right' } }));
    } else out.push(obs(def.id, c, d));
  }
  return out;
}
