import { describe, expect, it } from 'vitest';

import {
  buildTodayPlan,
  isVisionExamDay,
  lastVisionExamDay,
  missionDaysBetween,
  PLAN_POINTS,
  type PlanSignalInput,
} from './todayPlan';

const plan = (missionDay: number, signals: PlanSignalInput[]) => buildTodayPlan({ crewId: 'c1', missionDay, signals });
const one = (missionDay: number, s: PlanSignalInput) => plan(missionDay, [s])[0];

describe('vision schedule', () => {
  it('FD 10/30/60/90/120 then every 30', () => {
    for (const d of [10, 30, 60, 90, 120, 150, 180, 210]) expect(isVisionExamDay(d)).toBe(true);
    for (const d of [-30, 1, 45, 100, 135, 143]) expect(isVisionExamDay(d)).toBe(false);
    expect(lastVisionExamDay(9)).toBeNull();
    expect(lastVisionExamDay(45)).toBe(30);
    expect(lastVisionExamDay(143)).toBe(120);
    expect(lastVisionExamDay(150)).toBe(150);
  });

  it('exam due on the day, overdue when missed, absent when done', () => {
    expect(one(90, { signalId: 'amsler', cadenceDays: 30, lastObservationDay: 60 })).toMatchObject({
      kind: 'exam',
      status: 'due',
      points: 25,
    });
    expect(one(91, { signalId: 'amsler', cadenceDays: 30, lastObservationDay: 60 })?.status).toBe('overdue');
    expect(one(91, { signalId: 'amsler', cadenceDays: 30, lastObservationDay: 90 })).toBeUndefined();
    expect(one(143, { signalId: 'near_acuity', cadenceDays: 30, lastObservationDay: 120 })).toBeUndefined();
    expect(
      one(90, { signalId: 'amsler', cadenceDays: 30, lastObservationDay: 60, observedToday: true })?.status,
    ).toBe('done');
  });
});

describe('cadence and staleness (FR-SIG-5, FR-PLAN-1)', () => {
  it('daily signals are due every day and done once measured', () => {
    expect(one(143, { signalId: 'heart_rate_rest', cadenceDays: 1, lastObservationDay: 142 })).toMatchObject({
      kind: 'measure',
      status: 'due',
      points: 10,
    });
    expect(
      one(143, { signalId: 'heart_rate_rest', cadenceDays: 1, lastObservationDay: 142, observedToday: true })?.status,
    ).toBe('done');
    expect(one(143, { signalId: 'mood', cadenceDays: 1, lastObservationDay: 100 })).toMatchObject({
      kind: 'checkin',
      status: 'due',
      points: 5,
    });
  });

  it('weekly reaction test: due at 7 d, overdue beyond 1.5 × cadence, done after the test', () => {
    const rt = (last: number | null, observedToday = false): PlanSignalInput => ({
      signalId: 'reaction_test',
      cadenceDays: 7,
      lastObservationDay: last,
      observedToday,
    });
    expect(one(143, rt(136))?.status).toBe('due');
    expect(one(143, rt(140))).toBeUndefined();
    expect(one(143, rt(132))?.status).toBe('overdue'); // 11 d > 10.5 d
    expect(one(143, rt(133))?.status).toBe('due'); // 10 d ≤ 10.5 d
    expect(one(143, rt(null))?.status).toBe('due');
    expect(one(143, rt(136, true))?.status).toBe('done');
    expect(one(143, rt(140, true))).toBeUndefined(); // extra test, nothing was planned
  });

  it('counts calendar days across launch (no day 0)', () => {
    expect(missionDaysBetween(-1, 1)).toBe(1);
    expect(missionDaysBetween(-3, 4)).toBe(6);
    expect(one(1, { signalId: 'blood_pressure', cadenceDays: 7, lastObservationDay: -7 })?.status).toBe('due');
    expect(one(1, { signalId: 'blood_pressure', cadenceDays: 7, lastObservationDay: -6 })).toBeUndefined();
  });

  it('skips cabin and ledger signals; sorts overdue → due → done; ids are stable', () => {
    const tasks = plan(143, [
      { signalId: 'cabin_co2', cadenceDays: 1, lastObservationDay: 142 },
      { signalId: 'radiation_dose', cadenceDays: 1, lastObservationDay: 142 },
      { signalId: 'heart_rate_rest', cadenceDays: 1, lastObservationDay: 142, observedToday: true },
      { signalId: 'reaction_test', cadenceDays: 7, lastObservationDay: 136, label: 'Reaction Self-Test' },
      { signalId: 'body_mass', cadenceDays: 7, lastObservationDay: 120 },
    ]);
    expect(tasks.map((t) => [t.signalId, t.status])).toEqual([
      ['body_mass', 'overdue'],
      ['reaction_test', 'due'],
      ['heart_rate_rest', 'done'],
    ]);
    expect(tasks[1]).toMatchObject({ id: 'c1:143:reaction_test', title: 'Measure reaction self-test', crewId: 'c1' });
  });

  it('points follow doc 11 §9', () => {
    expect(PLAN_POINTS).toMatchObject({ measure: 10, exam: 25, checkin: 5 });
  });
});
