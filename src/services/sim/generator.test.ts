import { describe, expect, it } from 'vitest';

import { buildTodayPlan } from '../../domain/plan/todayPlan';
import type { Observation, SignalId } from '../../domain/types';
import { loadSeed, profileById } from '../seed';
import { OSDR_METHOD_CBC, OSDR_METHOD_CMP } from './anchors';
import { generateObservations, reactionTestDays } from './generator';
import { DEFAULT_SEED } from './rng';

const EPOCH = '2026-06-25T00:00:00.000Z'; // mission day 143 = 2026-11-14
const seed = loadSeed();
const mars = profileById('mars-transit');
const gen = (s = DEFAULT_SEED, scenarios = seed.scenarios, profile = mars): Observation[] =>
  generateObservations(seed.crew, profile, scenarios, seed.anchors, s, { missionEpoch: EPOCH });
const obs = gen();
const noScenarios = gen(DEFAULT_SEED, []);

const series = (list: Observation[], crewId: string, signalId: SignalId, eye?: 'left' | 'right'): Observation[] =>
  list.filter((o) => o.crewId === crewId && o.signalId === signalId && (eye === undefined || o.context?.eye === eye));
const on = (list: Observation[], crewId: string, signalId: SignalId, day: number, eye?: 'left' | 'right') =>
  series(list, crewId, signalId, eye).find((o) => o.missionDay === day);
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

describe('generator determinism', () => {
  it('same seed → deep-equal output', () => {
    expect(gen()).toEqual(obs);
  });

  it('different seed → different output', () => {
    const other = gen('argus-2026-b');
    expect(other.length).toBeGreaterThan(0);
    expect(other).not.toEqual(obs);
    expect(series(other, 'c1', 'heart_rate_rest').map((o) => o.value)).not.toEqual(
      series(obs, 'c1', 'heart_rate_rest').map((o) => o.value),
    );
  });

  it('a scenario never shifts the random numbers of other series', () => {
    expect(series(noScenarios, 'c1', 'heart_rate_rest')).toEqual(series(obs, 'c1', 'heart_rate_rest'));
    expect(series(noScenarios, 'c3', 'heart_rate_rest', undefined).filter((o) => o.missionDay < 141)).toEqual(
      series(obs, 'c3', 'heart_rate_rest').filter((o) => o.missionDay < 141),
    );
  });

  it('ids are unique', () => {
    expect(new Set(obs.map((o) => o.id)).size).toBe(obs.length);
  });
});

describe('timeline bounds and labels', () => {
  it('covers −180 … demo day, no day 0, nothing after the demo day', () => {
    const days = obs.map((o) => o.missionDay);
    expect(days).not.toContain(0);
    expect(Math.min(...days)).toBe(-180);
    expect(Math.max(...days)).toBe(143);
    const iss = gen(DEFAULT_SEED, seed.scenarios, profileById('iss'));
    expect(Math.max(...iss.map((o) => o.missionDay))).toBe(90);
    expect(iss.some((o) => o.missionDay === 0)).toBe(false);
    // scenarios after the ISS demo day (silent infection on 141–143) simply do not occur
    expect(on(iss, 'c3', 'heart_rate_rest', 141)).toBeUndefined();
  });

  it('every observation is SIMULATED except the OSDR anchors (MEASURED, method NASA OSDR OSD-569 / OSD-575)', () => {
    for (const o of obs) {
      if (o.source.kind === 'lab') {
        expect(o.source.label).toBe('MEASURED');
        expect(o.missionDay).toBeLessThan(0);
        expect(o.source.method).toBe(o.signalId === 'glucose' ? OSDR_METHOD_CMP : OSDR_METHOD_CBC);
      } else {
        expect(o.source).toEqual({ kind: 'simulated', method: 'ARGUS simulator', label: 'SIMULATED' });
      }
      expect(o.quality).toEqual({ score: 1, label: 'good', reasons: [] });
    }
    const anchors = obs.filter((o) => o.source.label === 'MEASURED');
    expect(anchors.filter((o) => o.source.method === 'NASA OSDR OSD-569')).toHaveLength(4 * 3 * 2); // Hct + WBC
    expect(anchors.filter((o) => o.source.method === 'NASA OSDR OSD-575')).toHaveLength(4 * 3); // glucose
  });

  it('simulated readings are stamped 07:00 UTC of their mission day', () => {
    expect(on(obs, 'c3', 'heart_rate_rest', 143)?.effectiveAt).toBe('2026-11-14T07:00:00.000Z');
    expect(on(obs, 'c3', 'heart_rate_rest', 1)?.effectiveAt).toBe('2026-06-25T07:00:00.000Z');
    expect(on(obs, 'c3', 'heart_rate_rest', -1)?.effectiveAt).toBe('2026-06-24T07:00:00.000Z');
  });

  it('observation shapes match what the domain rules expect', () => {
    const bp = on(obs, 'c1', 'blood_pressure', 141)!;
    expect(bp.value).toBeNull();
    expect(bp.components!.systolic).toBeGreaterThan(bp.components!.diastolic!);
    const rt = series(obs, 'c1', 'reaction_test')[0]!;
    expect(Object.keys(rt.components!).sort()).toEqual(['falseStarts', 'lapses', 'medianRtMs', 'nStimuli']);
    expect(rt.unit).toBe('/s');
    const glu = series(obs, 'c1', 'glucose');
    expect(glu.filter((o) => o.source.label === 'SIMULATED').every((o) => o.context?.glucose === 'fasting')).toBe(true);
    // OSD-575 does not record the fasting state → anchors stored as 'random'
    expect(glu.filter((o) => o.source.label === 'MEASURED').every((o) => o.context?.glucose === 'random')).toBe(true);
    expect(series(obs, 'c1', 'amsler').every((o) => o.context?.eye === 'left' || o.context?.eye === 'right')).toBe(true);
    const co2 = series(obs, 'cabin', 'cabin_co2');
    expect(co2.every((o) => typeof o.components?.avg7d === 'number')).toBe(true);
    expect(obs.some((o) => o.signalId === 'radiation_dose')).toBe(false);
    expect(Number.isInteger(on(obs, 'c2', 'heart_rate_rest', 50)!.value)).toBe(true);
  });

  it('pre-flight blood comes from the OSDR anchors of the subject mapped by sex', () => {
    const c2Hct = series(obs, 'c2', 'hematocrit').filter((o) => o.source.label === 'MEASURED');
    expect(c2Hct.map((o) => [o.missionDay, o.value])).toEqual([
      [-92, 49.1],
      [-44, 50],
      [-3, 49],
    ]);
    for (const c of seed.crew) {
      const subj = seed.anchors.subjects.find((s) => s.subject === c.osdrSubject);
      expect(subj?.sex).toBe(c.sex);
    }
    const inflight = series(obs, 'c1', 'hematocrit').filter((o) => o.missionDay > 0);
    expect(inflight.map((o) => o.missionDay)).toEqual([30, 60, 90, 120]);
    // in flight = median of the whole pre-flight series (anchors + interpolations) × 1.05 + noise
    for (const c of seed.crew) {
      const pre = median(series(obs, c.id, 'hematocrit').filter((o) => o.missionDay < 0).map((o) => o.value!));
      for (const o of series(obs, c.id, 'hematocrit').filter((x) => x.missionDay > 0)) {
        expect(o.value! / pre).toBeGreaterThan(1.0);
        expect(o.value! / pre).toBeLessThanOrEqual(1.12);
      }
    }
  });
});

describe('scenario placement', () => {
  it('silent-infection: c3 RHR exactly 63/68/69 on 141–143; temp and mood deltas added', () => {
    expect([141, 142, 143].map((d) => on(obs, 'c3', 'heart_rate_rest', d)?.value)).toEqual([63, 68, 69]);
    [0.3, 0.5, 0.6].forEach((delta, i) => {
      const d = 141 + i;
      const base = on(noScenarios, 'c3', 'body_temp', d)!.value!;
      expect(Math.abs(on(obs, 'c3', 'body_temp', d)!.value! - (base + delta))).toBeLessThanOrEqual(0.051);
    });
    [0, -1, -1].forEach((delta, i) => {
      const d = 141 + i;
      const base = on(noScenarios, 'c3', 'mood', d)!.value!;
      expect(on(obs, 'c3', 'mood', d)!.value).toBe(Math.min(5, Math.max(1, base + delta)));
    });
  });

  it('TV-8 pre-check: c3 adaptive window 127–140 has median 58 and MAD ≤ 1', () => {
    const w = series(obs, 'c3', 'heart_rate_rest')
      .filter((o) => o.missionDay >= 127 && o.missionDay <= 140)
      .map((o) => o.value!);
    expect(w).toHaveLength(14);
    const m = median(w);
    expect(m).toBe(58);
    expect(median(w.map((x) => Math.abs(x - m)))).toBeLessThanOrEqual(1);
    console.info(
      'c3 heart_rate_rest days 127–143:',
      series(obs, 'c3', 'heart_rate_rest')
        .filter((o) => o.missionDay >= 127)
        .map((o) => `${o.missionDay}:${o.value}`)
        .join(' '),
    );
  });

  it('sleep-debt: c2 sleep absolute 5.6/5.4/5.2/5.5/5.3/5.6/5.4 on 130–136; lapses +4 on 133 and 136', () => {
    expect([130, 131, 132, 133, 134, 135, 136].map((d) => on(obs, 'c2', 'sleep_duration', d)?.value)).toEqual([
      5.6, 5.4, 5.2, 5.5, 5.3, 5.6, 5.4,
    ]);
    const preLapses = median(
      series(obs, 'c2', 'reaction_test')
        .filter((o) => o.missionDay < 0)
        .map((o) => o.components!.lapses!),
    );
    for (const d of [133, 136]) {
      const lapses = on(obs, 'c2', 'reaction_test', d)!.components!.lapses!;
      expect(lapses - 4).toBeGreaterThanOrEqual(1);
      expect(lapses - 4).toBeLessThanOrEqual(3);
      expect(lapses).toBeGreaterThanOrEqual(preLapses + 3); // space rule WATCH (doc 07 §4.9)
    }
    // other crew have no extra test on 133 and no added lapses
    expect(on(obs, 'c1', 'reaction_test', 133)).toBeUndefined();
    expect(on(obs, 'c1', 'reaction_test', 136)!.components!.lapses).toBeLessThanOrEqual(3);
  });

  it('co2-spike: cabin CO₂ 3.4/3.8/4.2/3.9/3.5 on 118–122 with headaches for c2 and c4 only', () => {
    expect([118, 119, 120, 121, 122].map((d) => on(obs, 'cabin', 'cabin_co2', d)?.value)).toEqual([
      3.4, 3.8, 4.2, 3.9, 3.5,
    ]);
    const sym = obs.filter((o) => o.signalId === 'symptoms');
    expect(sym.map((o) => `${o.crewId}@${o.missionDay}`).sort()).toEqual(
      ['c2', 'c4'].flatMap((c) => [118, 119, 120, 121, 122].map((d) => `${c}@${d}`)).sort(),
    );
    for (const s of sym) {
      expect(s.value).toBeNull();
      expect(s.components).toEqual({ headache: 1 });
    }
    const normal = series(obs, 'cabin', 'cabin_co2').filter((o) => o.missionDay < 118 || o.missionDay > 122);
    expect(normal.every((o) => o.value! >= 2.0 && o.value! <= 2.6)).toBe(true);
    expect(series(obs, 'cabin', 'cabin_temp').every((o) => o.value! >= 21 && o.value! <= 23)).toBe(true);
    expect(series(obs, 'cabin', 'cabin_humidity').every((o) => o.value! >= 40 && o.value! <= 55)).toBe(true);
  });

  it('sans-drift: c1 Amsler +2 cells right eye on day 90 only', () => {
    expect(on(obs, 'c1', 'amsler', 90, 'right')?.value).toBe(2);
    expect(on(obs, 'c1', 'amsler', 90, 'left')?.value).toBe(0);
    const others = obs.filter((o) => o.signalId === 'amsler' && !(o.crewId === 'c1' && o.missionDay === 90 && o.context?.eye === 'right'));
    expect(others.every((o) => o.value === 0)).toBe(true);
    // anticipation glasses in use from the scenario day on (in flight), not before
    expect(on(obs, 'c1', 'near_acuity', 90, 'right')?.context).toEqual({ eye: 'right', withGlasses: true });
    expect(on(obs, 'c1', 'near_acuity', 120, 'left')?.context).toEqual({ eye: 'left', withGlasses: true });
    expect(on(obs, 'c1', 'near_acuity', 60, 'right')?.context).toEqual({ eye: 'right' });
    expect(on(obs, 'c2', 'near_acuity', 90, 'right')?.context).toEqual({ eye: 'right' });
    const acu = on(obs, 'c1', 'near_acuity', 90, 'right')!.value!;
    const base = on(noScenarios, 'c1', 'near_acuity', 90, 'right')!.value!;
    expect(acu - base).toBeCloseTo(0.1, 2);
  });

  it('normal-adaptation: in-flight sleep means 6.0–6.4 h (sleep-debt nights excluded)', () => {
    for (const c of seed.crew) {
      const nights = series(obs, c.id, 'sleep_duration').filter(
        (o) => o.missionDay >= 1 && !(c.id === 'c2' && o.missionDay >= 130 && o.missionDay <= 136),
      );
      const mean = nights.reduce((s, o) => s + o.value!, 0) / nights.length;
      expect(mean).toBeGreaterThanOrEqual(5.95);
      expect(mean).toBeLessThanOrEqual(6.45);
    }
  });
});

describe('reaction test schedule and the day-143 plan', () => {
  it('weekly from −175, in flight on the demo day weekday, never on the demo day itself', () => {
    const days = reactionTestDays(143, []);
    expect(days[0]).toBe(-175);
    expect(days.filter((d) => d < 0).every((d) => (d + 175) % 7 === 0)).toBe(true);
    expect(days.filter((d) => d > 0).every((d) => (143 - d) % 7 === 0)).toBe(true);
    expect(days).not.toContain(143);
    expect(days[days.length - 1]).toBe(136);
  });

  it('every crew member has a reaction_test task due on day 143 (last test day 136)', () => {
    for (const c of seed.crew) {
      const rts = series(obs, c.id, 'reaction_test');
      const last = rts[rts.length - 1]!.missionDay;
      expect(last).toBe(136);
      const plan = buildTodayPlan({
        crewId: c.id,
        missionDay: 143,
        signals: [{ signalId: 'reaction_test', cadenceDays: 7, lastObservationDay: last, observedToday: false }],
      });
      expect(plan).toHaveLength(1);
      expect(plan[0]!.status).toBe('due');
    }
  });
});
