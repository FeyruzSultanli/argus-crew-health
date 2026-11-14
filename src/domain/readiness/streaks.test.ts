import { describe, expect, it } from 'vitest';

import { baselineSet, computeBadges, nightWatch } from './badges';
import { dayRange, mkAssessment, mkObs } from './fixtures.test-utils';
import { lastDays, planFromHistory, daysBySignal, weekSummary } from './planHistory';
import {
  checkinStreak,
  dailyStreak,
  exerciseStreak,
  prevMissionDay,
  reactionTestStreak,
  weeklyStreak,
} from './streaks';

describe('mission-day helpers', () => {
  it('there is no day 0', () => {
    expect(prevMissionDay(1)).toBe(-1);
    expect(prevMissionDay(5)).toBe(4);
    expect(prevMissionDay(-3)).toBe(-4);
    expect(lastDays(2, 4)).toEqual([-2, -1, 1, 2]);
  });
});

describe('dailyStreak', () => {
  it('counts consecutive days up to today', () => {
    expect(dailyStreak([138, 139, 140, 141, 142, 143], 143)).toEqual({
      length: 6,
      unit: 'day',
      includesToday: true,
      lastDay: 143,
    });
  });
  it('stays open (counted to yesterday) when today is not logged yet', () => {
    expect(dailyStreak([140, 141, 142], 143)).toEqual({
      length: 3,
      unit: 'day',
      includesToday: false,
      lastDay: 142,
    });
  });
  it('is 0 when neither today nor yesterday is logged', () => {
    expect(dailyStreak([139, 140, 141], 143).length).toBe(0);
  });
  it('skips the non-existent day 0', () => {
    expect(dailyStreak([-3, -2, -1, 1, 2], 2).length).toBe(5);
  });
  it('a gap breaks it; days after today are ignored by the callers', () => {
    expect(dailyStreak([130, 131, 133, 134], 134).length).toBe(2);
  });
});

describe('weeklyStreak', () => {
  it('counts tests at most 7 days apart; alive while the newest is ≤ 7 days old', () => {
    const tests = [3, 10, 17, 24];
    expect(weeklyStreak(tests, 31)).toMatchObject({
      length: 4,
      unit: 'week',
      includesToday: false,
      lastDay: 24,
    });
    expect(weeklyStreak(tests, 32).length).toBe(0);
  });
  it('a gap above 7 days breaks it (across day 0 too)', () => {
    expect(weeklyStreak([-7, 3, 10], 10).length).toBe(2); // −7 → 3 is 9 days
    expect(weeklyStreak([-4, 3, 10], 10).length).toBe(3); // −4 → 3 is 6 days
  });
  it('ignores entries after today', () => {
    expect(weeklyStreak([3, 10, 17], 12)).toMatchObject({ length: 2, lastDay: 10 });
  });
});

describe('streaks from observations', () => {
  it('check-in streak: mood or sleep on each day', () => {
    const obs = [
      ...[140, 141].map((d) => mkObs('c1', 'mood', d, 4)),
      mkObs('c1', 'sleep_duration', 142, 7),
      mkObs('c1', 'mood', 143, 4),
      mkObs('c1', 'heart_rate_rest', 139, 60), // not a check-in
    ];
    expect(checkinStreak(obs, 143)).toMatchObject({ length: 4, includesToday: true });
    expect(checkinStreak(obs, 141)).toMatchObject({ length: 2, includesToday: true });
  });

  it('reaction-test streak on the generated weekly schedule (3, 10, …, 136) on day 143 = 20 weeks, open today', () => {
    const obs = [
      ...dayRange(-175, -1).filter((d) => (d + 175) % 7 === 0),
      ...dayRange(3, 136).filter((d) => (d - 3) % 7 === 0),
    ].map((d) => mkObs('c1', 'reaction_test', d, 3.6));
    expect(reactionTestStreak(obs, 143)).toMatchObject({ length: 20, includesToday: false, lastDay: 136 });
    expect(reactionTestStreak([...obs, mkObs('c1', 'reaction_test', 143, 3.7)], 143)).toMatchObject({
      length: 21,
      includesToday: true,
    });
  });

  it('exercise streak: days with ≥ 70 % of the plan', () => {
    const obs = [
      mkObs('c1', 'exercise_minutes', 139, 50), // below 84 min
      mkObs('c1', 'exercise_minutes', 140, 90),
      mkObs('c1', 'exercise_minutes', 141, 84),
      mkObs('c1', 'exercise_minutes', 142, 30),
      mkObs('c1', 'exercise_minutes', 142, 120), // the day's latest log counts
      mkObs('c1', 'exercise_minutes', 143, 100),
    ];
    expect(exerciseStreak(obs, 143, 120)).toMatchObject({ length: 4, includesToday: true });
    expect(exerciseStreak(obs, 143, undefined).length).toBe(0);
  });
});

describe('plan history, weekly points and badges', () => {
  const daily = dayRange(-180, 143);
  const history = [
    ...daily.map((d) => mkObs('c1', 'mood', d, 4)),
    ...daily.map((d) => mkObs('c1', 'heart_rate_rest', d, 60)),
  ];

  it('rebuilds a day plan with the service rules (done = reading that day)', () => {
    const plan = planFromHistory('c1', 143, daysBySignal(history));
    expect(plan.find((t) => t.signalId === 'mood')?.status).toBe('done');
    expect(plan.find((t) => t.signalId === 'heart_rate_rest')?.status).toBe('done');
    expect(plan.find((t) => t.signalId === 'symptoms')?.status).toBe('due');
    expect(plan.some((t) => t.signalId === 'face_fluid_index' || t.signalId === 'cabin_co2')).toBe(false);
  });

  it('weekly points = points of done tasks over 7 days (mood 5 + resting HR 10 per day)', () => {
    const w = weekSummary('c1', history, 143);
    expect(w.byDay.map((d) => d.missionDay)).toEqual([137, 138, 139, 140, 141, 142, 143]);
    expect(w.points).toBe(7 * 15);
    // readings after "today" are not counted when scrubbing back
    expect(weekSummary('c1', history, 140).byDay.at(-1)).toMatchObject({ missionDay: 140, points: 15 });
  });

  it('counts overdue tasks of the week (Clean week badge)', () => {
    const bp = [mkObs('c1', 'blood_pressure', 120, 120)]; // every 7 d: overdue above 10.5 d
    const w = weekSummary('c1', [...history, ...bp], 143);
    expect(w.overdue).toBeGreaterThan(0);
    const badges = computeBadges([], history, w, 143);
    expect(badges.find((b) => b.id === 'clean-week')?.earned).toBe(false);
    expect(computeBadges([], history, { overdue: 0 }, 143).find((b) => b.id === 'clean-week')?.earned).toBe(
      true,
    );
  });

  it('Night watch: ≥ 7 h on each of the last 3 nights', () => {
    const s = (d: number, h: number) => mkObs('c1', 'sleep_duration', d, h);
    expect(nightWatch([s(141, 7), s(142, 7.4), s(143, 8)], 143)).toBe(true);
    expect(nightWatch([s(141, 7), s(142, 6.9), s(143, 8)], 143)).toBe(false);
    expect(nightWatch([s(142, 7.4), s(143, 8)], 143)).toBe(false);
  });

  it('Baseline set: near acuity has a personal baseline', () => {
    expect(baselineSet([mkAssessment('c1', 'near_acuity', 'NOMINAL')])).toBe(true);
    expect(baselineSet([mkAssessment('c1', 'near_acuity', 'NOMINAL', { P: 'NO_DATA' })])).toBe(false);
    expect(baselineSet([])).toBe(false);
  });
});
