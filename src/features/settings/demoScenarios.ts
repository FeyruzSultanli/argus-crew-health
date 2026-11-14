// Demo scenario picker logic (FR-SET-2). Pure: every scenario of seed/scenarios.json lives on ONE Mars-transit
// timeline; picking one jumps to its last day and selects its crew member. On another profile the timeline is
// truncated at that profile's demo day (doc 05 §6), so a scenario after that day does not occur there.
import scenariosJson from '../../../seed/scenarios.json';
import type { MissionProfile } from '../../domain/types';
import { MIN_MISSION_DAY, clampMissionDay } from '../../state/missionSelectors';

export interface DemoScenario {
  id: string;
  label: string;
  demonstrates: string;
  /** Crew ids as in the seed ('cabin' included where the cabin is affected). */
  crewIds: string[];
  /** Explicit days, or every in-flight day. */
  days: number[] | 'all-inflight';
}

export const DEMO_SCENARIOS: readonly DemoScenario[] = scenariosJson.scenarios.map((s) => ({
  id: s.id,
  label: s.label,
  demonstrates: s.demonstrates,
  crewIds: s.crewIds,
  days: Array.isArray(s.days) ? s.days : 'all-inflight',
}));

/** Scenarios whose effect is seen on the Environment screen (cabin / space weather). */
const ENVIRONMENT_SCENARIOS = new Set(['co2-spike', 'spe-event']);

export interface ScenarioTarget {
  /** Mission day to jump to (the scenario's last day on this profile). */
  day: number;
  /** The one crew member to select, or null when the scenario affects the whole crew. */
  crewId: string | null;
  /** Where the scenario is best seen. */
  link: { to: string; label: string };
  /** False when the profile's timeline ends before the scenario starts (it does not occur there). */
  occurs: boolean;
}

/** Last day of the scenario on the given profile (all-inflight → the profile's demo day). */
export function scenarioLastDay(s: DemoScenario, profile: MissionProfile): number {
  if (s.days === 'all-inflight') return profile.demoMissionDay;
  return Math.max(...s.days);
}

export function scenarioTarget(s: DemoScenario, profile: MissionProfile): ScenarioTarget {
  const people = s.crewIds.filter((id) => id !== 'cabin');
  const crewId = people.length === 1 ? (people[0] ?? null) : null;
  const lastDay = scenarioLastDay(s, profile);
  const firstDay = s.days === 'all-inflight' ? 1 : Math.min(...s.days);
  const occurs = firstDay <= profile.demoMissionDay;
  const link = ENVIRONMENT_SCENARIOS.has(s.id)
    ? { to: '/environment', label: 'Open Environment' }
    : { to: crewId ? `/body/${crewId}` : '/body', label: 'Open Body' };
  return { day: clampMissionDay(lastDay, profile), crewId, link, occurs };
}

export type DayInputResult = { ok: true; day: number; clamped: boolean } | { ok: false; error: string };

/**
 * Parses the "jump to day" field: an integer, negative for pre-flight ("-30" or "L-30"). Clamped to the profile's
 * range [−180 … demo day]; day 0 does not exist and becomes launch day 1.
 */
export function parseDayInput(text: string, profile: MissionProfile): DayInputResult {
  const t = text
    .trim()
    .replace(/^L(?=-)/i, '')
    .replace(/^MD\s*/i, '');
  if (!/^-?\d+$/.test(t)) return { ok: false, error: 'Enter a whole mission day, for example 143 or -30.' };
  const asked = Number(t);
  const day = clampMissionDay(asked, profile);
  return { ok: true, day, clamped: day !== asked };
}

export { MIN_MISSION_DAY };
