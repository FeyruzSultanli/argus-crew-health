// Mission clock (doc 06 "Mission clock"). Pure functions; the epoch itself is stored in the Dexie `settings` table
// when the demo is seeded or reset (see demo.ts).
//
// missionEpoch = 00:00 UTC of (today's UTC date − (demoMissionDay − 1) days), so the profile's demo day is "today".
// dateOf(day) = epoch + (day − 1) days for day ≥ 1, epoch + day days for negative days. There is no day 0.
import { missionDaysBetween } from '../domain/plan/todayPlan';

const DAY_MS = 86_400_000;
/** Simulated observations are timestamped 07:00 UTC of their mission day (doc 06). */
export const SIMULATED_HOUR_UTC = 7;

function assertMissionDay(day: number): void {
  if (!Number.isInteger(day) || day === 0) throw new RangeError(`Invalid mission day ${day} (integer, no day 0).`);
}

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Days from the epoch (day 1 = offset 0, day −1 = offset −1). */
function offsetOf(day: number): number {
  return day >= 1 ? day - 1 : day;
}

/** ISO string of the mission epoch that makes `demoMissionDay` fall on `now`'s UTC date. */
export function computeMissionEpoch(now: Date, demoMissionDay: number): string {
  assertMissionDay(demoMissionDay);
  return new Date(utcMidnight(now) - offsetOf(demoMissionDay) * DAY_MS).toISOString();
}

/** 00:00 UTC of a mission day. */
export function dateOf(day: number, missionEpoch: string): Date {
  assertMissionDay(day);
  return new Date(Date.parse(missionEpoch) + offsetOf(day) * DAY_MS);
}

/** Mission day that contains the instant `date`. */
export function missionDayOf(date: Date, missionEpoch: string): number {
  const offset = Math.floor((date.getTime() - Date.parse(missionEpoch)) / DAY_MS);
  return offset >= 0 ? offset + 1 : offset;
}

/** `effectiveAt` for a simulated observation: dateOf(day) + 07:00 UTC. */
export function simulatedEffectiveAt(day: number, missionEpoch: string): string {
  return new Date(dateOf(day, missionEpoch).getTime() + SIMULATED_HOUR_UTC * 3_600_000).toISOString();
}

/** `day` moved by `n` calendar days, skipping the non-existent day 0. */
export function addMissionDays(day: number, n: number): number {
  assertMissionDay(day);
  const offset = offsetOf(day) + n;
  return offset >= 0 ? offset + 1 : offset;
}

/** Inclusive list of mission days from `from` to `to`, without day 0. */
export function missionDayRange(from: number, to: number): number[] {
  const out: number[] = [];
  for (let d = from; d <= to; d++) if (d !== 0) out.push(d);
  return out;
}

export { missionDaysBetween };
