// Mission profile lookups and mission-day arithmetic used by the shell, the scrubber and every screen.
// Pure functions (no React) so they are unit-tested directly. Profiles come from seed/missions.json.
import missionsJson from '../../seed/missions.json';
import type { MissionProfile, MissionProfileId } from '../domain/types';

/** First simulated mission day (pre-flight L-180, doc 05 §6). */
export const MIN_MISSION_DAY = -180;

/** Source id for modeled / demo comms delays (seed/missions.json: light-time is computed or fixed for the demo). */
export const DELAY_SOURCE_IDS: readonly string[] = ['SRC_DEMO_SIMULATION'];

type RawProfile = (typeof missionsJson.profiles)[number];

function toProfile(p: RawProfile): MissionProfile {
  const delay = p.commsDelayOneWaySec;
  return {
    ...p,
    id: p.id as MissionProfileId,
    resupply: p.resupply as MissionProfile['resupply'],
    shelterPolicyClass: p.shelterPolicyClass as MissionProfile['shelterPolicyClass'],
    commsDelayOneWaySec:
      typeof delay === 'number'
        ? delay
        : { byMissionDay: delay.byMissionDay.map(([d, s]) => [d, s] as [number, number]) },
  };
}

/** All six mission profiles, typed, in seed order. */
export const missionProfiles: readonly MissionProfile[] = missionsJson.profiles.map(toProfile);

/** Default profile of the demo (doc 05 §6). */
export const DEFAULT_PROFILE_ID: MissionProfileId = 'mars-transit';

/** Profile by id; falls back to the default profile for an unknown id (e.g. stale localStorage). */
export function getProfile(id: MissionProfileId): MissionProfile {
  const found =
    missionProfiles.find((p) => p.id === id) ?? missionProfiles.find((p) => p.id === DEFAULT_PROFILE_ID);
  if (!found) throw new Error('seed/missions.json has no mars-transit profile');
  return found;
}

/**
 * One-way comms delay in seconds for a mission day. A fixed number is returned as is; a byMissionDay table is
 * linearly interpolated and clamped to its first/last entry (pre-flight days use the first entry).
 * Mars transit day 143 → 660 s (11 min).
 */
export function commsDelaySec(profile: MissionProfile, missionDay: number): number {
  const d = profile.commsDelayOneWaySec;
  if (typeof d === 'number') return d;
  const table = d.byMissionDay;
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) return 0;
  if (missionDay <= first[0]) return first[1];
  if (missionDay >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1];
    const b = table[i];
    if (!a || !b) continue;
    if (missionDay <= b[0]) return a[1] + ((missionDay - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return last[1];
}

/**
 * True when the profile's delay is a demo model rather than computed light-time: the Mars-transit table, and the
 * Mars-surface fixed 12 min (seed/missions.json commsDelayNote: real range about 3–22 min; fixed 12 min in the demo).
 */
export function isModeledDelay(profile: MissionProfile): boolean {
  return typeof profile.commsDelayOneWaySec !== 'number' || profile.id === 'mars-surface';
}

/** Delay in a display unit: seconds below 90 s, otherwise whole minutes. */
export function delayDisplay(sec: number): { value: number; unit: 's' | 'min'; precision: number } {
  if (sec < 90) return { value: sec, unit: 's', precision: sec < 10 && !Number.isInteger(sec) ? 1 : 0 };
  return { value: Math.round(sec / 60), unit: 'min', precision: 0 };
}

/** Highest reachable mission day: the profile's demo day (nothing is generated after it, doc 05 §6). */
export function maxMissionDay(profile: MissionProfile): number {
  return profile.demoMissionDay;
}

/** Clamp to [MIN_MISSION_DAY, demoMissionDay] and map the non-existent day 0 to launch day 1. */
export function clampMissionDay(day: number, profile: MissionProfile): number {
  const rounded = Math.round(day);
  const clamped = Math.min(maxMissionDay(profile), Math.max(MIN_MISSION_DAY, rounded));
  return clamped === 0 ? 1 : clamped;
}

/** Position of a mission day on the day-0-free axis (L-180 → 0, L-1 → 179, MD 1 → 180). */
export function dayToIndex(day: number): number {
  return day < 0 ? day - MIN_MISSION_DAY : day - MIN_MISSION_DAY - 1;
}

/** Inverse of dayToIndex. */
export function indexToDay(index: number): number {
  const day = index + MIN_MISSION_DAY;
  return day < 0 ? day : day + 1;
}

/** Step by `delta` real days, skipping day 0 (−1 + 1 → 1, 1 − 1 → −1), clamped to the profile range. */
export function stepMissionDay(day: number, delta: number, profile: MissionProfile): number {
  return clampMissionDay(indexToDay(dayToIndex(clampMissionDay(day, profile)) + delta), profile);
}

/** All reachable days in order, without day 0. */
export function missionDayRange(profile: MissionProfile): number[] {
  const out: number[] = [];
  for (let d = MIN_MISSION_DAY; d <= maxMissionDay(profile); d++) if (d !== 0) out.push(d);
  return out;
}

/** "MD 143" in flight, "L-30" pre-flight. */
export function missionDayLabel(day: number): string {
  return day < 0 ? `L${day}` : `MD ${day}`;
}

/** Spoken form for screen readers. */
export function missionDayText(day: number): string {
  return day < 0 ? `Pre-flight, ${-day} days before launch` : `Mission day ${day}`;
}
