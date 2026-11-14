// computePersonal / computePersonalSeries: NO_DATA cases, carry-over, multi-series signals, filters,
// aggregations, templates, memo, accept-as-new-normal.
import { beforeEach, describe, expect, it } from 'vitest';

import { obs } from '../../__tests__/fixtures';
import { SIGNALS, signalList } from '../../signals';
import type { SignalDef } from '../../types';
import { clearPersonalCache, fingerprint, personalCacheStats } from '../cache';
import { BASELINE_PARAMS } from '../constants';
import { lowerLabel } from '../explain';
import { computePersonal, computePersonalSeries, personalSeriesMemo } from '../personal';
import { PROFILE, bp, buildConstant, cycle, days, oseiHeartRate, readings, runAll } from './helpers';

beforeEach(() => clearPersonalCache());

const HR = SIGNALS.heart_rate_rest;
const PRE_59 = [58, 60, 59, 61, 57, 60, 59];

describe('NO_DATA cases', () => {
  it('personal layer disabled (hematocrit) → NO_DATA, no sources', () => {
    const o = readings('hematocrit', days(-7, [44, 44, 44, 44, 44, 44, 44]));
    const p = computePersonal(SIGNALS.hematocrit, [...o, obs('hematocrit', 50, 30)], 30, PROFILE);
    expect(p).toMatchObject({ layer: 'personal', verdict: 'NO_DATA', sourceIds: [], series: [] });
    expect(p.reason).toBe('The personal baseline is not used for this signal.');
    expect(computePersonal(SIGNALS.cabin_co2, [], 30, PROFILE).verdict).toBe('NO_DATA');
  });

  it('fewer than 3 pre-flight values → "Not enough readings yet …  k more needed."', () => {
    const o = readings('heart_rate_rest', [...days(-2, [58, 59]), [1, 80], [2, 80]]);
    const p = computePersonal(HR, o, 2, PROFILE);
    expect(p.verdict).toBe('NO_DATA');
    expect(p.reason).toBe('Not enough readings yet to know your usual. 1 more needed.');
    expect(p.numbers).toEqual({ nPre: 2, referenceKind: -1 });
    expect(computePersonal(HR, [], 2, PROFILE).reason).toBe(
      'Not enough readings yet to know your usual. 3 more needed.',
    );
  });

  it('pre-flight day or no in-flight reading yet → NO_DATA "compared from the first in-flight reading"', () => {
    const o = readings('heart_rate_rest', days(-7, PRE_59));
    const p = computePersonal(HR, o, -1, PROFILE);
    expect(p.verdict).toBe('NO_DATA');
    expect(p.reason).toBe('Your personal baseline is compared from the first in-flight reading.');
    expect(p.numbers).toMatchObject({ ref: 59, sigma: 2, nPre: 7, referenceKind: 0 });
    expect(computePersonal(HR, [...o, obs('heart_rate_rest', 59, 5)], 4, PROFILE).verdict).toBe('NO_DATA');
  });
});

describe('carry-over and time index', () => {
  it('days without a reading keep the last state; t counts readings', () => {
    // Readings on days 1, 5, 9: 59, 66, 66 → z 0, 3.5, 3.5 → NOMINAL, WATCH, ACT (consecutive readings).
    const o = readings('heart_rate_rest', [...days(-7, PRE_59), [1, 59], [5, 66], [9, 66]]);
    expect(computePersonal(HR, o, 7, PROFILE).verdict).toBe('WATCH');
    expect(computePersonal(HR, o, 7, PROFILE).numbers?.readingDay).toBe(5);
    expect(computePersonal(HR, o, 9, PROFILE).verdict).toBe('ACT');
    expect(computePersonal(HR, o, 30, PROFILE).verdict).toBe('ACT');
  });

  it('series: lo/hi = ref ∓ 2σ, sliced to the requested day; upToDay limits the run', () => {
    const o = readings('heart_rate_rest', [...days(-7, PRE_59), ...days(1, [59, 60, 61])]);
    const p = computePersonal(HR, o, 2, PROFILE);
    expect(p.series).toEqual([
      { missionDay: 1, value: 59, lo: 55, hi: 63, state: 'NOMINAL' },
      { missionDay: 2, value: 60, lo: 55, hi: 63, state: 'NOMINAL' },
    ]);
    const s = computePersonalSeries(HR, o, { upToDay: 2, profile: PROFILE });
    expect(s.series.map((x) => x.missionDay)).toEqual([1, 2]);
    expect(s.upToDay).toBe(2);
  });
});

describe('direction both', () => {
  it('a drop is judged in the down direction and named "below"', () => {
    const o = readings('heart_rate_rest', [...days(-7, PRE_59), ...days(1, [59, 52, 51])]);
    const p = computePersonal(HR, o, 3, PROFILE);
    expect(p.verdict).toBe('ACT');
    expect(p.numbers?.direction).toBe(-1);
    expect(p.numbers?.z).toBe(4);
    expect(p.reason).toBe(
      'Resting heart rate is 8 bpm below your usual (59 bpm). That is 4.0× your normal day-to-day variation.',
    );
    const day = runAll(HR, o).tracks[0]?.days[2];
    expect(day?.directions.map((d) => [d.side, d.z, d.state])).toEqual([
      ['up', -4, 'NOMINAL'],
      ['down', 4, 'ACT'],
    ]);
  });
});

describe('blood pressure: systolic and diastolic judged separately, worse reported', () => {
  const pre = [-5, -4, -3, -2, -1].map((d, i) => bp(d, 110 + (i % 2), 70 + (i % 2)));

  it('systolic up → WATCH naming the component', () => {
    const o = [...pre, bp(1, 124, 71)];
    const p = computePersonal(SIGNALS.blood_pressure, o, 1, PROFILE);
    expect(p.verdict).toBe('WATCH');
    expect(p.reason).toBe(
      'Blood pressure (systolic) is 14 mmHg above your usual (110 mmHg). That is 2.8× your normal day-to-day variation.',
    );
    const s = runAll(SIGNALS.blood_pressure, o);
    expect(s.tracks.map((t) => [t.key, t.days[0]?.state])).toEqual([
      ['systolic', 'WATCH'],
      ['diastolic', 'NOMINAL'],
    ]);
    expect(s.series).toEqual([{ missionDay: 1, value: 124, lo: 100, hi: 120, state: 'WATCH' }]);
  });

  it('diastolic worse → names diastolic; both nominal → both ranges', () => {
    const p = computePersonal(SIGNALS.blood_pressure, [...pre, bp(1, 111, 80)], 1, PROFILE);
    expect(p.reason.startsWith('Blood pressure (diastolic) is 10 mmHg above')).toBe(true);
    const n = computePersonal(SIGNALS.blood_pressure, [...pre, bp(1, 111, 71)], 1, PROFILE);
    expect(n.verdict).toBe('NOMINAL');
    expect(n.reason).toBe('Within your usual range (systolic 100–120, diastolic 62–78 mmHg).');
  });
});

describe('glucose: fasting readings only', () => {
  it('random / post-meal / unlabeled readings never enter the personal layer', () => {
    const fasting = { context: { glucose: 'fasting' as const } };
    const o = [
      ...readings('glucose', days(-5, [90, 91, 89, 90, 92]), fasting),
      obs('glucose', 180, -3, { context: { glucose: 'post-meal' } }),
      obs('glucose', 170, 2, { context: { glucose: 'random' } }),
      obs('glucose', 175, 3),
    ];
    expect(computePersonal(SIGNALS.glucose, o, 3, PROFILE).verdict).toBe('NO_DATA');
    const p = computePersonal(SIGNALS.glucose, [...o, obs('glucose', 91, 4, fasting)], 4, PROFILE);
    expect(p.verdict).toBe('NOMINAL');
    expect(p.numbers).toMatchObject({ ref: 90, nPre: 5 });
  });
});

describe('near_acuity: per eye, worse eye reported', () => {
  it('right eye worse → WATCH naming the right eye', () => {
    const eye = (e: 'left' | 'right') => ({ context: { eye: e } });
    const o = [
      ...readings('near_acuity', days(-5, [0, 0, 0, 0, 0]), eye('left')),
      ...readings('near_acuity', days(-5, [0.1, 0.1, 0.1, 0.1, 0.1]), eye('right')),
      obs('near_acuity', 0, 30, eye('left')),
      obs('near_acuity', 0.25, 30, eye('right')),
    ];
    const p = computePersonal(SIGNALS.near_acuity, o, 30, PROFILE);
    expect(p.verdict).toBe('WATCH');
    expect(p.reason).toBe(
      'Near visual acuity (right eye) is 0.15 logMAR above your usual (0.10 logMAR). That is 3.0× your normal day-to-day variation.',
    );
    expect(runAll(SIGNALS.near_acuity, o).tracks.map((t) => t.key)).toEqual(['left', 'right']);
  });
});

describe('aggregation per doc 08 §7', () => {
  it('daily median (HR), daily max (body temp, skin ignored)', () => {
    const o = [
      ...readings('heart_rate_rest', days(-7, PRE_59)),
      obs('heart_rate_rest', 58, 1, {}, 1),
      obs('heart_rate_rest', 70, 1, {}, 2),
      obs('heart_rate_rest', 60, 1, {}, 3),
    ];
    expect(runAll(HR, o).tracks[0]?.days[0]?.value).toBe(60);
    const t = [
      ...readings('body_temp', days(-5, [36.6, 36.6, 36.6, 36.6, 36.6])),
      obs('body_temp', 36.7, 1, {}, 1),
      obs('body_temp', 36.9, 1, {}, 2),
      obs('body_temp', 39, 1, { source: { kind: 'device', method: 'skin', label: 'MEASURED' } }, 3),
    ];
    expect(runAll(SIGNALS.body_temp, t).tracks[0]?.days[0]?.value).toBe(36.9);
  });

  it('mean-2 (hydration) and mean-3 (mood) of the days ending today; references from daily values', () => {
    const h = readings('hydration', [...days(-5, [2.5, 2.4, 2.6, 2.5, 2.5]), [1, 2.5], [2, 1.5]]);
    const hd = runAll(SIGNALS.hydration, h).tracks[0]?.days ?? [];
    expect(hd.map((d) => [d.daily, d.value])).toEqual([
      [2.5, 2.5], // window 1, −1 → (2.5 + 2.5) / 2
      [1.5, 2.0],
    ]);
    const m = readings('mood', [...days(-5, [4, 4, 4, 4, 4]), [1, 4], [2, 3], [3, 2]]);
    const md = runAll(SIGNALS.mood, m).tracks[0]?.days ?? [];
    expect(md.map((d) => d.value)).toEqual([4, 11 / 3, 3]);
    expect(md[0]?.ref).toBe(4);
  });
});

describe('explanation templates', () => {
  it('every enabled signal: reasons ≤ 140 chars and free of diagnosis words', () => {
    const banned = /diagnos|infection|disease|you have|dose of|mg of|take \d/i;
    for (const def of signalList.filter((d) => d.personal.enabled)) {
      for (const jump of [-1000, -3, 0, 3, 1000]) {
        const o = buildConstant(def, 50, 10, -10);
        o.push(...buildConstant(def, 50 + jump, 2, 20));
        const p = computePersonal(def, o, 21, PROFILE);
        expect(p.reason.length, `${def.id} ${jump}: ${p.reason}`).toBeLessThanOrEqual(140);
        expect(p.reason).not.toMatch(banned);
      }
    }
  });

  it('CuSum template counts the readings that added to the sum', () => {
    // z 1.8, 1.8, 1.8 … with σ 2: never ≥ 2, S climbs by 1.3 per reading → WATCH at S ≥ 4 on reading 4.
    const o = readings('heart_rate_rest', [...days(-7, PRE_59), ...days(1, [62.6, 62.6, 62.6, 62.6])]);
    const p = computePersonal(HR, o, 4, PROFILE);
    expect(p.numbers?.cusum).toBe(5.2);
    expect(p.reason).toBe(
      'Resting heart rate has been higher than your usual for 4 days in a row. Small changes are adding up.',
    );
  });

  it('lowerLabel keeps labels with inner capitals', () => {
    expect(lowerLabel('Oxygen saturation')).toBe('oxygen saturation');
    expect(lowerLabel('Reaction Self-Test')).toBe('Reaction Self-Test');
  });
});

describe('memo', () => {
  it('one engine run serves every day; equal content hits; changed content misses; same result as no memo', () => {
    const o = oseiHeartRate([58, 58, 58]);
    for (let d = 1; d <= 146; d += 1) computePersonal(HR, o, d, PROFILE);
    expect(personalCacheStats()).toMatchObject({ misses: 1, hits: 145 });
    computePersonal(HR, [...o], 143, PROFILE);
    expect(personalCacheStats().misses).toBe(1);
    const changed = o.map((x) => (x.missionDay === 142 ? { ...x, value: 58 } : x));
    expect(fingerprint(changed)).not.toBe(fingerprint(o));
    expect(computePersonal(HR, changed, 143, PROFILE).verdict).not.toBe('ACT');
    expect(personalCacheStats().misses).toBe(2);
    for (const d of [1, 120, 141, 142, 143, 144, 145]) {
      expect(computePersonal(HR, o, d, PROFILE)).toEqual(computePersonal(HR, o, d, PROFILE, { memo: false }));
    }
    expect(personalSeriesMemo(HR, o, PROFILE).series).toHaveLength(146);
  });

  it('a different SignalDef object with the same id is a different key', () => {
    const o = oseiHeartRate();
    const copy: SignalDef = { ...HR, personal: { enabled: false, params: [] } };
    expect(computePersonal(HR, o, 143, PROFILE).verdict).toBe('ACT');
    expect(computePersonal(copy, o, 143, PROFILE).verdict).toBe('NO_DATA');
  });
});

describe('persistent shift and "Accept as new normal" (FR-BAS-7)', () => {
  const o = readings('heart_rate_rest', [...days(-7, PRE_59), ...days(1, cycle([61.5], 40))]);

  it('a permanent +2.5 bpm (z 1.25: CuSum WATCH, never ACT) stays WATCH; ≥ 14 days → persistentShift', () => {
    const p = computePersonal(HR, o, 20, PROFILE);
    expect(p.verdict).toBe('WATCH');
    expect(p.numbers?.watchStreakDays).toBe(15); // WATCH since day 6 (S = 0.75 · t ≥ 4)
    expect(p.numbers?.persistentShift).toBe(1);
    expect(computePersonal(HR, o, 13, PROFILE).numbers?.persistentShift).toBe(0);
    expect(BASELINE_PARAMS.persistentShiftDays).toBe(14);
  });

  it('accepted on day 20 → from day 21 the adaptive window includes those days → NOMINAL', () => {
    const before = computePersonal(HR, o, 20, PROFILE, { accepted: [20] });
    expect(before.verdict).toBe('WATCH');
    const p = computePersonal(HR, o, 21, PROFILE, { accepted: [20] });
    expect(p.verdict).toBe('NOMINAL');
    expect(p.numbers).toMatchObject({ ref: 61.5, referenceKind: 1, drift: 1.25, z: 0, cusum: 0 });
    expect(computePersonal(HR, o, 40, PROFILE, { accepted: [20] }).verdict).toBe('NOMINAL');
    expect(computePersonal(HR, o, 21, PROFILE).verdict).toBe('WATCH');
  });
});
