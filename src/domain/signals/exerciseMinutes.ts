// doc 07 §4.14 Exercise minutes — `exercise_minutes`.
// Observation: value = minutes of exercise done that mission day (the day's total; if several, the latest counts).
// Space rule: 7-day adherence = sum of minutes over the window ÷ (crew.simulatedBaseline.exercise_plan_min × days in
// the window) × 100, rounded to an integer %. The window is the 7 mission days ending at the reading's day (no day 0);
// in flight it holds only in-flight days, so on mission day 3 it is days 1–3. A day without a log counts as 0 min.
// Pre-flight the window starts no earlier than the first logged day.
// Earth: n/a.
import type { BandRule } from '../rules/bands';
import { evaluateBands } from '../rules/bands';
import { dailyValue } from '../rules/history';
import { notApplicable } from '../rules/layer';
import type { LayerResult, Observation, RuleCtx, SignalDef } from '../types';
import { missionDayWindow, roundTo } from '../units';
import { NASA_RISKS, earthNotApplicable } from './common';

export const EXERCISE_WINDOW_DAYS = 7;

export const EXERCISE_SPACE_RULE: BandRule = {
  id: 'exercise_minutes.space.adherence7',
  layer: 'space',
  precision: 0,
  unit: '%',
  bands: [
    {
      verdict: 'ACT',
      max: 40,
      maxExclusive: true,
      demo: true,
      reason: '7-day adherence {v} of plan is under 40%.',
    },
    {
      verdict: 'WATCH',
      max: 70,
      maxExclusive: true,
      demo: true,
      reason: '7-day adherence {v} of plan is under 70%.',
    },
  ],
  sourceIds: ['SRC_EXERCISE_2H', 'SRC_BONE_NASA'],
  nominalReason: '7-day adherence {v} of plan is 70% or more.',
};

/**
 * The adherence window: 7 mission days ending at `endDay`; in flight only in-flight days (day ≥ 1). Pre-flight, the
 * window starts no earlier than `firstLoggedDay` (the earliest exercise log in the history), so the first days of a
 * record are not judged against days before logging began. In flight, missing days still count as 0.
 */
export function exerciseWindow(endDay: number, firstLoggedDay?: number): number[] {
  const days = missionDayWindow(endDay, EXERCISE_WINDOW_DAYS);
  if (endDay >= 1) return days.filter((d) => d >= 1);
  return firstLoggedDay === undefined ? days : days.filter((d) => d >= firstLoggedDay);
}

function space(o: Observation, ctx: RuleCtx): LayerResult {
  const plan = ctx.crew?.simulatedBaseline.exercise_plan_min;
  if (typeof plan !== 'number' || plan <= 0) {
    return notApplicable('space', 'No exercise plan set for this crew member.', 'exercise_minutes.space.na');
  }
  const firstLogged = ctx.history.reduce<number | undefined>(
    (min, h) => (h.signalId === 'exercise_minutes' && (min === undefined || h.missionDay < min) ? h.missionDay : min),
    undefined,
  );
  const days = exerciseWindow(o.missionDay, firstLogged);
  const logged = days.map((d) => dailyValue(ctx.history, d, 'last')).filter((v): v is number => v !== null);
  if (logged.length === 0)
    return notApplicable('space', 'No exercise logged in the last 7 days.', 'exercise_minutes.space.na');
  const totalMin = logged.reduce((a, b) => a + b, 0);
  const adherencePct = (totalMin / (plan * days.length)) * 100;
  return evaluateBands(EXERCISE_SPACE_RULE, adherencePct, {
    totalMin: roundTo(totalMin, 0),
    planMin: plan,
    windowDays: days.length,
    n: logged.length,
  });
}

export const exerciseMinutes: SignalDef = {
  id: 'exercise_minutes',
  label: 'Exercise minutes',
  shortWhat: 'Minutes of countermeasure exercise you did in the day, compared with your plan.',
  whyInSpace:
    'Bones lose about 1–1.5% of their density per month in flight. ISS crew average about two hours of exercise ' +
    'a day to protect bone, muscle and fitness.',
  howToMeasure: ['Log the minutes of each exercise session.', 'Count active exercise time, not set-up.'],
  hazard: 'gravity',
  nasaRiskIds: [NASA_RISKS],
  bodyRegions: ['skeleton', 'muscles'],
  system: 'musculoskeletal',
  cadenceDays: 1,
  concerningDirection: 'down',
  personal: { enabled: false, params: [] },
  earth: earthNotApplicable('exercise_minutes'),
  space,
  actions: {},
  sourceIds: ['SRC_EXERCISE_2H', 'SRC_BONE_NASA', NASA_RISKS, 'SRC_DEMO_RULE_BANDS', 'SRC_DEMO_SIMULATION'],
};
