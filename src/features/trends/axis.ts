// Shared mission-day x-axis of every Trends chart (doc 11 §5.3). Pure.
// Charts plot x = dayToIndex(missionDay) so there is no gap for the non-existent day 0 (L-1 is followed by MD 1).
import { MIN_MISSION_DAY, dayToIndex, indexToDay, missionDayLabel } from '../../state/missionSelectors';

export { dayToIndex, indexToDay };

export type RangePreset = '14' | '30' | '90' | 'all';

export const RANGE_PRESETS: ReadonlyArray<{ value: RangePreset; label: string }> = [
  { value: '14', label: '14 d' },
  { value: '30', label: '30 d' },
  { value: '90', label: '90 d' },
  { value: 'all', label: 'Whole mission' },
];

export const DEFAULT_PRESET: RangePreset = '30';

/** Inclusive mission-day range shown on every chart. */
export interface DayRange {
  fromDay: number;
  toDay: number;
}

/** Move `delta` real days on the day-0-free axis (no clamping beyond L-180). */
export function shiftDay(day: number, delta: number): number {
  return indexToDay(Math.max(0, dayToIndex(day) + delta));
}

/** Number of real days in a range (L-1 … MD 1 is 2 days). */
export function rangeLength(r: DayRange): number {
  return dayToIndex(r.toDay) - dayToIndex(r.fromDay) + 1;
}

/** Range of a preset ending at the selected mission day; 'all' starts at L-180. */
export function presetRange(preset: RangePreset, endDay: number): DayRange {
  if (preset === 'all') return { fromDay: MIN_MISSION_DAY, toDay: endDay };
  const n = Number(preset);
  return { fromDay: shiftDay(endDay, -(n - 1)), toDay: endDay };
}

/** Clamp a custom (brushed) range into [L-180, endDay]; at least 2 days wide; ordered. */
export function clampRange(r: DayRange, endDay: number): DayRange {
  let a = Math.min(dayToIndex(r.fromDay), dayToIndex(r.toDay));
  let b = Math.max(dayToIndex(r.fromDay), dayToIndex(r.toDay));
  const max = dayToIndex(endDay);
  b = Math.min(b, max);
  a = Math.max(0, Math.min(a, b - 1));
  return { fromDay: indexToDay(a), toDay: indexToDay(b) };
}

/** Axis tick label for an x index. */
export function tickLabel(x: number): string {
  return missionDayLabel(indexToDay(x));
}

/** About `count` evenly spaced integer ticks over [fromDay, toDay] (as x indices), always incl. both ends. */
export function axisTicks(r: DayRange, count = 6): number[] {
  const a = dayToIndex(r.fromDay);
  const b = dayToIndex(r.toDay);
  if (b <= a) return [a];
  const step = Math.max(1, Math.ceil((b - a) / (count - 1)));
  const out: number[] = [];
  for (let x = a; x < b; x += step) out.push(x);
  if (b - (out[out.length - 1] ?? a) < step / 2 && out.length > 1) out.pop();
  out.push(b);
  return out;
}

/** True when the mission day lies inside the range. */
export function inRange(day: number, r: DayRange): boolean {
  return day >= r.fromDay && day <= r.toDay && day !== 0;
}
