// Badges (doc 11 §9, FR-PLAN-2): "Baseline set" (vision), "Clean week" (no overdue), "Night watch" (sleep ≥ 7 h on
// 3 nights). Demo parameters [SRC_DEMO_READINESS]. Pure TypeScript: no React, no DOM, no Dexie.
import type { Assessment, Observation } from '../types';
import { lastDays } from './planHistory';
import type { WeekSummary } from './planHistory';

export type BadgeId = 'baseline-set' | 'clean-week' | 'night-watch';

export interface EarnedBadge {
  id: BadgeId;
  label: string;
  /** Rule in plain words (tooltip / screen reader). */
  rule: string;
  earned: boolean;
}

/** Night watch: this many nights in a row … */
export const NIGHT_WATCH_NIGHTS = 3;
/** … of at least this many hours (doc 11 §9). */
export const NIGHT_WATCH_HOURS = 7;

/** Vision baseline set: the personal layer of near visual acuity has a baseline (it is not NO_DATA). */
export function baselineSet(assessments: readonly Assessment[]): boolean {
  const a = assessments.find((x) => x.signalId === 'near_acuity');
  return !!a && a.layers.personal.verdict !== 'NO_DATA';
}

/** Night watch: sleep ≥ 7 h on each of the last 3 nights up to today (the day's latest log counts). */
export function nightWatch(observations: readonly Observation[], today: number): boolean {
  const byDay = new Map<number, number>();
  for (const o of observations)
    if (o.signalId === 'sleep_duration' && o.value !== null && o.missionDay <= today)
      byDay.set(o.missionDay, o.value);
  return lastDays(today, NIGHT_WATCH_NIGHTS).every((d) => (byDay.get(d) ?? 0) >= NIGHT_WATCH_HOURS);
}

/** All three badges of one crew member. */
export function computeBadges(
  assessments: readonly Assessment[],
  observations: readonly Observation[],
  week: Pick<WeekSummary, 'overdue'>,
  today: number,
): EarnedBadge[] {
  return [
    {
      id: 'baseline-set',
      label: 'Baseline set',
      rule: 'Your personal vision baseline is set.',
      earned: baselineSet(assessments),
    },
    {
      id: 'clean-week',
      label: 'Clean week',
      rule: 'No overdue task in the last 7 days.',
      earned: week.overdue === 0,
    },
    {
      id: 'night-watch',
      label: 'Night watch',
      rule: 'Sleep of 7 h or more on each of the last 3 nights.',
      earned: nightWatch(observations, today),
    },
  ];
}
