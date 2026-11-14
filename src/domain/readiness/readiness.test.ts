import { describe, expect, it } from 'vitest';

import type { Assessment, SignalId, Verdict } from '../types';
import { mkAssessment } from './fixtures.test-utils';
import { CORE_DAILY_SIGNALS, computeReadiness, readinessTerms, sleepMean3FromAssessments } from './readiness';

/** A clean day: every core daily signal NOMINAL with a 7 h sleep mean. */
function cleanDay(over: Partial<Record<SignalId, Verdict>> = {}, sleepMean = 7): Assessment[] {
  const ids: SignalId[] = [
    'heart_rate_rest',
    'body_temp',
    'sleep_duration',
    'mood',
    'blood_pressure',
    'radiation_dose',
  ];
  return ids.map((id) =>
    mkAssessment(
      'c1',
      id,
      over[id] ?? 'NOMINAL',
      id === 'sleep_duration' ? { numbers: { value: sleepMean } } : {},
    ),
  );
}
const term = (
  a: Assessment[],
  id: string,
  tasks: Array<{ status: 'done' | 'due' | 'overdue' | 'skipped' }> = [],
) => readinessTerms({ assessments: a, tasks }).find((t) => t.id === id);

describe('core daily signals', () => {
  it('are the P0 core signals with a 1-day cadence, minus radiation_dose', () => {
    expect(CORE_DAILY_SIGNALS).toEqual(['heart_rate_rest', 'body_temp', 'sleep_duration', 'mood']);
  });
});

describe('readiness terms (doc 11 §9)', () => {
  it('clean day = 100', () => {
    const r = computeReadiness({ assessments: cleanDay(), tasks: [] });
    expect(r.score).toBe(100);
    expect(r.terms.every((t) => t.deduction === 0)).toBe(true);
  });

  it('−25 per ACT', () => {
    const t = term(cleanDay({ heart_rate_rest: 'ACT', body_temp: 'ACT' }), 'act');
    expect(t).toMatchObject({ count: 2, deduction: 50, signalIds: ['heart_rate_rest', 'body_temp'] });
  });

  it('−10 per WATCH', () => {
    expect(term(cleanDay({ mood: 'WATCH' }), 'watch')).toMatchObject({ count: 1, deduction: 10 });
  });

  it('radiation_dose counts in ACT / WATCH', () => {
    expect(term(cleanDay({ radiation_dose: 'WATCH' }), 'watch')).toMatchObject({
      count: 1,
      signalIds: ['radiation_dose'],
    });
  });

  it('cabin assessments never count', () => {
    const a = [
      ...cleanDay(),
      mkAssessment('cabin', 'cabin_co2', 'ACT'),
      mkAssessment('c1', 'cabin_temp', 'WATCH'),
    ];
    expect(computeReadiness({ assessments: a }).score).toBe(100);
  });

  it('−2 per overdue task, capped at −10', () => {
    const od = (n: number) => Array.from({ length: n }, () => ({ status: 'overdue' as const }));
    expect(term(cleanDay(), 'overdue', [...od(3), { status: 'due' }, { status: 'done' }])).toMatchObject({
      count: 3,
      deduction: 6,
      capped: false,
    });
    expect(term(cleanDay(), 'overdue', od(5))).toMatchObject({ deduction: 10, capped: false });
    expect(term(cleanDay(), 'overdue', od(6))).toMatchObject({ count: 6, deduction: 10, capped: true });
  });

  it('−3 per core daily signal in NO DATA (missing counts as NO DATA), capped at −15', () => {
    expect(term(cleanDay({ mood: 'NO_DATA' }), 'noData')).toMatchObject({
      count: 1,
      deduction: 3,
      signalIds: ['mood'],
    });
    const missing = cleanDay().filter((a) => a.signalId !== 'body_temp');
    expect(term(missing, 'noData')).toMatchObject({ count: 1, signalIds: ['body_temp'] });
    // radiation_dose and non-daily signals do not count
    expect(term(cleanDay({ radiation_dose: 'NO_DATA', blood_pressure: 'NO_DATA' }), 'noData')).toMatchObject({
      count: 0,
    });
    // all four core daily signals missing: 12 (cap 15 not reached)
    expect(term([], 'noData')).toMatchObject({ count: 4, deduction: 12, capped: false });
  });

  it("caps the NO DATA term at −15 (unreachable with today's 4 core daily signals; checked with a longer list)", () => {
    const coreDailySignals: SignalId[] = [
      'heart_rate_rest',
      'body_temp',
      'sleep_duration',
      'mood',
      'hydration',
      'symptoms',
    ];
    const t = readinessTerms({ assessments: [], coreDailySignals }).find((x) => x.id === 'noData');
    expect(t).toMatchObject({ count: 6, deduction: 15, capped: true });
    const five = readinessTerms({ assessments: [], coreDailySignals: coreDailySignals.slice(0, 5) }).find(
      (x) => x.id === 'noData',
    );
    expect(five).toMatchObject({ count: 5, deduction: 15, capped: false });
  });

  it('−5 when the sleep 3-night mean is under 5.5 h (5.5 itself does not count)', () => {
    expect(term(cleanDay({}, 5.4), 'shortSleep')).toMatchObject({ count: 1, deduction: 5 });
    expect(term(cleanDay({}, 5.5), 'shortSleep')).toMatchObject({ count: 0, deduction: 0 });
    expect(
      readinessTerms({ assessments: cleanDay({}, 7), sleepMean3h: 4.9 }).find((t) => t.id === 'shortSleep')
        ?.deduction,
    ).toBe(5);
    expect(
      readinessTerms({ assessments: cleanDay({}, 4), sleepMean3h: null }).find((t) => t.id === 'shortSleep')
        ?.deduction,
    ).toBe(0);
  });

  it('day-143 K. Osei shape: 1 ACT + 1 WATCH → 65', () => {
    const r = computeReadiness({
      assessments: cleanDay({ heart_rate_rest: 'ACT', body_temp: 'WATCH' }, 7.1),
      tasks: [{ status: 'due' }],
    });
    expect(r.score).toBe(65);
    expect(r.raw).toBe(65);
  });

  it('clamps at 0 (raw below zero is kept in `raw`)', () => {
    const a = cleanDay(
      { heart_rate_rest: 'ACT', body_temp: 'ACT', mood: 'ACT', sleep_duration: 'ACT', blood_pressure: 'ACT' },
      4,
    );
    const r = computeReadiness({
      assessments: a,
      tasks: Array.from({ length: 9 }, () => ({ status: 'overdue' as const })),
    });
    expect(r.raw).toBe(100 - 125 - 10 - 5);
    expect(r.score).toBe(0);
  });

  it('never exceeds 100', () => {
    expect(computeReadiness({ assessments: cleanDay(), tasks: [{ status: 'done' }] }).score).toBe(100);
  });
});

describe('sleepMean3FromAssessments', () => {
  it('reads the judged value from the space layer, then the earth layer; null without data', () => {
    expect(
      sleepMean3FromAssessments([
        mkAssessment('c1', 'sleep_duration', 'EXPECTED', { numbers: { value: 6.4, n: 3 } }),
      ]),
    ).toBe(6.4);
    expect(sleepMean3FromAssessments([mkAssessment('c1', 'sleep_duration', 'NO_DATA')])).toBeNull();
    expect(sleepMean3FromAssessments([])).toBeNull();
  });
});
