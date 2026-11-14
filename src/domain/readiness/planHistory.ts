// Past "Today" plans rebuilt from observation history, for weekly points and the "Clean week" badge (doc 11 §9).
// Uses the same inputs as the service's todayPlan (registry cadence and label, newest reading strictly before the
// day, reading on the day). Persisted skips are not part of the history and are ignored here.
// Pure TypeScript: no React, no DOM, no Dexie.
import { buildTodayPlan } from '../plan/todayPlan';
import type { PlanSignalInput } from '../plan/todayPlan';
import { CABIN_SIGNAL_IDS, signalList } from '../signals';
import type { Observation, SignalId, Task } from '../types';
import { prevMissionDay } from './streaks';

/** Signals the service never plans (doc 07 §4.12: the experimental face index). */
const PLAN_EXCLUDED: ReadonlySet<SignalId> = new Set<SignalId>(['face_fluid_index', ...CABIN_SIGNAL_IDS]);

/** Days per week for the weekly points total. */
export const WEEK_DAYS = 7;

/** Sorted unique observation days per signal (≤ any day; callers pass a day bound). */
export function daysBySignal(observations: readonly Observation[]): Map<SignalId, number[]> {
  const m = new Map<SignalId, Set<number>>();
  for (const o of observations) {
    let s = m.get(o.signalId);
    if (!s) m.set(o.signalId, (s = new Set()));
    s.add(o.missionDay);
  }
  const out = new Map<SignalId, number[]>();
  for (const [k, s] of m)
    out.set(
      k,
      [...s].sort((a, b) => a - b),
    );
  return out;
}

/** The plan of `crewId` on `day` as the service would have built it from this history (skips not included). */
export function planFromHistory(crewId: string, day: number, byDay: Map<SignalId, number[]>): Task[] {
  const signals: PlanSignalInput[] = signalList
    .filter((d) => !PLAN_EXCLUDED.has(d.id))
    .map((def) => {
      const days = byDay.get(def.id) ?? [];
      let last: number | null = null;
      let today = false;
      for (const d of days) {
        if (d < day) last = d;
        else if (d === day) today = true;
        else break;
      }
      return {
        signalId: def.id,
        cadenceDays: def.cadenceDays,
        lastObservationDay: last,
        observedToday: today,
        label: def.label,
      };
    });
  return buildTodayPlan({ crewId, missionDay: day, signals });
}

/** The `n` mission days ending at `today`, oldest first (no day 0). */
export function lastDays(today: number, n: number): number[] {
  const out: number[] = [];
  let d = today;
  for (let i = 0; i < n; i++) {
    out.unshift(d);
    d = prevMissionDay(d);
  }
  return out;
}

export interface WeekSummary {
  /** Points of completed tasks over the 7 days ending today (doc 11 §9: measure 10, exam 25, check-in 5). */
  points: number;
  /** Points per day, oldest first. */
  byDay: Array<{ missionDay: number; points: number; overdue: number }>;
  /** Overdue tasks over the week. */
  overdue: number;
}

/** Weekly points and overdue count of one crew member from observation history. */
export function weekSummary(
  crewId: string,
  observations: readonly Observation[],
  today: number,
): WeekSummary {
  const byDay = daysBySignal(observations.filter((o) => o.missionDay <= today));
  const days = lastDays(today, WEEK_DAYS).map((d) => {
    const plan = planFromHistory(crewId, d, byDay);
    return {
      missionDay: d,
      points: plan.filter((t) => t.status === 'done').reduce((s, t) => s + t.points, 0),
      overdue: plan.filter((t) => t.status === 'overdue').length,
    };
  });
  return {
    points: days.reduce((s, d) => s + d.points, 0),
    byDay: days,
    overdue: days.reduce((s, d) => s + d.overdue, 0),
  };
}
