// Routine streaks (doc 11 §9, FR-PLAN-2): daily check-in, weekly reaction test, exercise adherence. Computed purely
// from observation history; demo parameters [SRC_DEMO_READINESS]. There is no mission day 0 (−1 is followed by 1).
// Pure TypeScript: no React, no DOM, no Dexie.
import { missionDaysBetween as daysBetween } from '../plan/todayPlan';
import type { Observation, SignalId } from '../types';

export const STREAK_SOURCE_IDS: readonly string[] = ['SRC_DEMO_READINESS'];

/** Signals whose daily log counts as a check-in (mood or sleep, doc 11 §9 / FR-PLAN-1). */
export const CHECKIN_STREAK_SIGNALS: readonly SignalId[] = ['mood', 'sleep_duration'];

/** A reaction-test week: at most this many days between two tests keeps the weekly streak going. */
export const WEEKLY_GAP_DAYS = 7;

/**
 * A day counts as "exercise on plan" when the logged minutes reach this share of the crew member's plan. It is the
 * WATCH line of the exercise space rule (doc 07 §4.14, 70 % adherence) applied to a single day [SRC_DEMO_READINESS].
 */
export const EXERCISE_ON_PLAN_SHARE = 0.7;

export interface Streak {
  /** Consecutive days (daily streaks) or weeks (weekly streak). 0 = no streak. */
  length: number;
  unit: 'day' | 'week';
  /** True when today already counts; false when the streak is still open (today's entry not logged yet). */
  includesToday: boolean;
  /** Last mission day that counted, or null. */
  lastDay: number | null;
}

/** Mission day before `day` (no day 0). */
export function prevMissionDay(day: number): number {
  return day === 1 ? -1 : day - 1;
}

/**
 * Consecutive mission days up to `today` that are in `days`. If today is not logged yet the streak counts up to
 * yesterday (still open); it is 0 when neither today nor yesterday is logged.
 */
export function dailyStreak(days: Iterable<number>, today: number): Streak {
  const set = new Set(days);
  const includesToday = set.has(today);
  let d = includesToday ? today : prevMissionDay(today);
  if (!set.has(d)) return { length: 0, unit: 'day', includesToday: false, lastDay: null };
  const lastDay = d;
  let length = 0;
  while (set.has(d)) {
    length++;
    d = prevMissionDay(d);
  }
  return { length, unit: 'day', includesToday, lastDay };
}

/**
 * Consecutive weeks with at least one entry: entries ≤ today, newest first, each at most `gap` days after the
 * previous one. Alive while the newest entry is at most `gap` days old (so a test due today keeps the streak).
 */
export function weeklyStreak(days: Iterable<number>, today: number, gap = WEEKLY_GAP_DAYS): Streak {
  const sorted = [...new Set(days)].filter((d) => d <= today && d !== 0).sort((a, b) => b - a);
  const newest = sorted[0];
  if (newest === undefined || daysBetween(newest, today) > gap) {
    return { length: 0, unit: 'week', includesToday: false, lastDay: null };
  }
  let length = 1;
  for (let i = 1; i < sorted.length; i++) {
    const later = sorted[i - 1] as number;
    const earlier = sorted[i] as number;
    if (daysBetween(earlier, later) > gap) break;
    length++;
  }
  return { length, unit: 'week', includesToday: newest === today, lastDay: newest };
}

const daysOf = (obs: readonly Observation[], signals: readonly SignalId[], today: number): number[] =>
  obs.filter((o) => signals.includes(o.signalId) && o.missionDay <= today).map((o) => o.missionDay);

/** Daily check-in streak: consecutive mission days with a mood or sleep log. */
export function checkinStreak(observations: readonly Observation[], today: number): Streak {
  return dailyStreak(daysOf(observations, CHECKIN_STREAK_SIGNALS, today), today);
}

/** Weekly Reaction Self-Test streak. */
export function reactionTestStreak(observations: readonly Observation[], today: number): Streak {
  return weeklyStreak(daysOf(observations, ['reaction_test'], today), today);
}

/**
 * Exercise adherence streak: consecutive days whose logged minutes reach EXERCISE_ON_PLAN_SHARE of `planMin`
 * (crew.simulatedBaseline.exercise_plan_min). No plan → no streak.
 */
export function exerciseStreak(
  observations: readonly Observation[],
  today: number,
  planMin: number | undefined,
): Streak {
  if (typeof planMin !== 'number' || planMin <= 0)
    return { length: 0, unit: 'day', includesToday: false, lastDay: null };
  const minDay = planMin * EXERCISE_ON_PLAN_SHARE;
  const byDay = new Map<number, number>();
  for (const o of observations) {
    if (o.signalId !== 'exercise_minutes' || o.missionDay > today || o.value === null) continue;
    byDay.set(o.missionDay, o.value); // the day's latest log counts (doc 07 §4.14); history is oldest first
  }
  const onPlan = [...byDay].filter(([, v]) => v >= minDay).map(([d]) => d);
  return dailyStreak(onPlan, today);
}

export interface Streaks {
  checkin: Streak;
  reaction: Streak;
  exercise: Streak;
}

/** All three streaks of one crew member on `today`. */
export function computeStreaks(
  observations: readonly Observation[],
  today: number,
  exercisePlanMin: number | undefined,
): Streaks {
  return {
    checkin: checkinStreak(observations, today),
    reaction: reactionTestStreak(observations, today),
    exercise: exerciseStreak(observations, today, exercisePlanMin),
  };
}
