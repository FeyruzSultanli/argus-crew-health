// Which series the engine judges for a signal, and how readings collapse to one value per day (doc 08 §1, §7).
//
// A signal has one "track" per judged series: one per PersonalParams entry (blood_pressure: systolic and
// diastolic), and for near_acuity one per eye. Glucose uses fasting readings only; body_temp ignores wearable skin
// temperature (trend-only stream with another scale, see signals/bodyTemp.ts).
//
// Daily value (used for the pre-flight and adaptive references): daily-median → median of the day's readings;
// daily-max → maximum; single / mean-3 / mean-2 → the day's single value (the latest if there are several).
// Judged value x_t (what z compares with the reference): the daily value, except mean-3 / mean-2 → mean of the
// daily values of the 3 / 2 mission days ending at t (no day 0; days without a value are skipped) — the same
// window the sleep, mood and hydration rules use, so the UI shows one "3-night mean".
import { chronological, mean, median } from '../rules/history';
import type { Aggregation, Observation, PersonalParams, SignalDef, SignalId } from '../types';
import { missionDayWindow } from '../units';

export type Eye = 'left' | 'right' | 'unspecified';

export interface TrackSpec {
  /** 'value', the component name, or the eye. */
  key: string;
  /** Label used in explanation templates, e.g. "Blood pressure (systolic)". */
  label: string;
  params: PersonalParams;
  component?: string;
  eye?: Eye;
}

/** Signals whose personal layer uses fasting readings only. */
export const FASTING_ONLY: ReadonlySet<SignalId> = new Set<SignalId>(['glucose']);
/** Signals judged per eye (doc 08 §7 "per eye"). */
export const PER_EYE: ReadonlySet<SignalId> = new Set<SignalId>(['near_acuity']);

const EYES: readonly Eye[] = ['left', 'right', 'unspecified'];
const eyeOf = (o: Observation): Eye => o.context?.eye ?? 'unspecified';

/** Readings of this signal that the personal layer may use at all. */
export function eligible(def: SignalDef, o: Observation): boolean {
  if (o.signalId !== def.id) return false;
  if (FASTING_ONLY.has(def.id) && o.context?.glucose !== 'fasting') return false;
  if (def.id === 'body_temp' && o.source.method === 'skin') return false;
  return true;
}

/** The judged series of a signal (empty when the personal layer is disabled or has no params). */
export function tracksFor(def: SignalDef, observations: readonly Observation[]): TrackSpec[] {
  if (!def.personal.enabled) return [];
  const tracks: TrackSpec[] = [];
  for (const params of def.personal.params) {
    if (PER_EYE.has(def.id)) {
      const present = new Set(observations.filter((o) => eligible(def, o)).map(eyeOf));
      for (const eye of EYES) {
        if (!present.has(eye)) continue;
        tracks.push({
          key: eye,
          label: eye === 'unspecified' ? def.label : `${def.label} (${eye} eye)`,
          params,
          eye,
        });
      }
      continue;
    }
    if (params.component !== undefined) {
      tracks.push({
        key: params.component,
        label: `${def.label} (${params.component})`,
        params,
        component: params.component,
      });
    } else {
      tracks.push({ key: 'value', label: def.label, params });
    }
  }
  return tracks;
}

export interface Reading {
  missionDay: number;
  value: number;
}

/** The track's numeric readings, chronological. */
export function trackReadings(
  def: SignalDef,
  track: TrackSpec,
  observations: readonly Observation[],
): Reading[] {
  const out: Reading[] = [];
  for (const o of chronological(observations)) {
    if (!eligible(def, o)) continue;
    if (track.eye !== undefined && eyeOf(o) !== track.eye) continue;
    const v = track.component === undefined ? o.value : o.components?.[track.component];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out.push({ missionDay: o.missionDay, value: v });
  }
  return out;
}

/** Collapses one day's readings (chronological) to the daily value. */
export function dailyAggregate(values: readonly number[], aggregation: Aggregation): number | null {
  if (values.length === 0) return null;
  switch (aggregation) {
    case 'daily-median':
      return median(values);
    case 'daily-max':
      return Math.max(...values);
    case 'single':
    case 'mean-3':
    case 'mean-2':
      return values[values.length - 1] as number;
  }
}

/** Daily values by mission day (chronological readings in, Map ordered by day out). */
export function dailyValues(readings: readonly Reading[], aggregation: Aggregation): Map<number, number> {
  const byDay = new Map<number, number[]>();
  for (const r of readings) {
    const list = byDay.get(r.missionDay);
    if (list === undefined) byDay.set(r.missionDay, [r.value]);
    else list.push(r.value);
  }
  const out = new Map<number, number>();
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    const v = dailyAggregate(byDay.get(day) as number[], aggregation);
    if (v !== null) out.set(day, v);
  }
  return out;
}

/** Number of days in the mean window, or 1 for the daily aggregations. */
export function windowDays(aggregation: Aggregation): number {
  return aggregation === 'mean-3' ? 3 : aggregation === 'mean-2' ? 2 : 1;
}

/** The value the engine judges on `day` (null when the day has no reading of its own). */
export function judgedValue(
  daily: ReadonlyMap<number, number>,
  day: number,
  aggregation: Aggregation,
): number | null {
  const own = daily.get(day);
  if (own === undefined) return null;
  const n = windowDays(aggregation);
  if (n === 1) return own;
  const values: number[] = [];
  for (const d of missionDayWindow(day, n)) {
    const v = daily.get(d);
    if (v !== undefined) values.push(v);
  }
  return mean(values);
}
