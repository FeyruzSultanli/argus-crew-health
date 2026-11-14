// Property tests (seeded, deterministic): constant series never flag; shifting the whole series by a constant
// changes no z; mirroring the series and the direction gives the same scores.
import { describe, expect, it } from 'vitest';

import { SIGNALS, signalList } from '../../signals';
import type { Observation } from '../../types';
import type { PersonalDay } from '../engine';
import { PROFILE, buildConstant, days, prng, readings, runAll, withParams } from './helpers';

const HR = SIGNALS.heart_rate_rest;
const UP = withParams(HR, [{ direction: 'up', sigmaFloor: 2, aggregation: 'daily-median' }]);
const DOWN = withParams(HR, [{ direction: 'down', sigmaFloor: 2, aggregation: 'daily-median' }]);

/** Integer heart-rate-like series: 40 pre-flight days, 200 in-flight days, noise ±3 and occasional excursions. */
function randomSeries(seed: number): number[] {
  const r = prng(seed);
  const out: number[] = [];
  let excursion = 0;
  for (let i = 0; i < 240; i += 1) {
    if (excursion === 0 && r() < 0.03) excursion = 3 + Math.floor(r() * 5);
    const bump = excursion > 0 ? 4 + Math.floor(r() * 10) : 0;
    if (excursion > 0) excursion -= 1;
    out.push(60 + Math.floor(r() * 7) - 3 + (r() < 0.5 ? bump : -bump));
  }
  return out;
}

const toObs = (values: readonly number[]): Observation[] => readings('heart_rate_rest', days(-40, values));

const scores = (ds: readonly PersonalDay[]) => ds.map((d) => [d.missionDay, d.z, d.cusum, d.state, d.drift]);

describe('constant series never flag', () => {
  for (const def of signalList.filter((d) => d.personal.enabled)) {
    it(`${def.id}`, () => {
      for (const c of [1, 7, 50, 98]) {
        const o = buildConstant(def, c, 30, -30);
        o.push(...buildConstant(def, c, 200, 1));
        const s = runAll(def, o);
        expect(s.tracks.length).toBeGreaterThan(0);
        for (const t of s.tracks) {
          expect(t.days).toHaveLength(200);
          expect(t.days.filter((d) => d.state !== 'NOMINAL')).toEqual([]);
        }
      }
    });
  }
});

describe('shift invariance: adding a constant to the whole series changes no z', () => {
  it('20 random series × 3 offsets, direction both', () => {
    let flagged = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const base = randomSeries(seed);
      const ref = runAll(HR, toObs(base)).tracks[0]?.days ?? [];
      flagged += ref.filter((d) => d.state !== 'NOMINAL').length;
      for (const k of [-37, 5, 140]) {
        const shifted = runAll(HR, toObs(base.map((v) => v + k))).tracks[0]?.days ?? [];
        expect(scores(shifted)).toEqual(scores(ref));
        expect(shifted.map((d) => d.ref - k)).toEqual(ref.map((d) => d.ref));
      }
    }
    expect(flagged).toBeGreaterThan(0); // the property is exercised on flagged days too
  });
});

describe('direction symmetry', () => {
  it('up on x ≡ down on (200 − x); both on x ≡ both on (200 − x) with up and down swapped', () => {
    const dir = (d: PersonalDay, i: number) => {
      const s = d.directions[i];
      return [s?.z, s?.S, s?.state, s?.drift];
    };
    for (let seed = 21; seed <= 35; seed += 1) {
      const x = randomSeries(seed);
      const mirrored = x.map((v) => 200 - v);
      const up = runAll(UP, toObs(x)).tracks[0]?.days ?? [];
      const down = runAll(DOWN, toObs(mirrored)).tracks[0]?.days ?? [];
      expect(scores(down)).toEqual(scores(up));
      const both = runAll(HR, toObs(x)).tracks[0]?.days ?? [];
      const bothM = runAll(HR, toObs(mirrored)).tracks[0]?.days ?? [];
      expect(bothM.map((d) => d.state)).toEqual(both.map((d) => d.state));
      expect(bothM.map((d) => dir(d, 1))).toEqual(both.map((d) => dir(d, 0)));
      expect(bothM.map((d) => dir(d, 0))).toEqual(both.map((d) => dir(d, 1)));
    }
  });

  it('direction both never mixes: each side equals its single-direction run until the first flag', () => {
    for (let seed = 40; seed <= 50; seed += 1) {
      const x = randomSeries(seed);
      const both = runAll(HR, toObs(x)).tracks[0]?.days ?? [];
      const up = runAll(UP, toObs(x)).tracks[0]?.days ?? [];
      const down = runAll(DOWN, toObs(x)).tracks[0]?.days ?? [];
      const firstFlag = both.findIndex((d) => d.state !== 'NOMINAL');
      const n = firstFlag === -1 ? both.length : firstFlag + 1;
      expect(n).toBeGreaterThan(5);
      expect(both.slice(0, n).map((d) => [d.directions[0]?.z, d.directions[0]?.S])).toEqual(
        up.slice(0, n).map((d) => [d.z, d.cusum]),
      );
      expect(both.slice(0, n).map((d) => [d.directions[1]?.z, d.directions[1]?.S])).toEqual(
        down.slice(0, n).map((d) => [d.z, d.cusum]),
      );
    }
  });
});

describe('a single reading can never give ACT', () => {
  it('any first in-flight value, however large', () => {
    for (const v of [61, 70, 100, 250, 0, -50]) {
      const o = readings('heart_rate_rest', [...days(-7, [58, 60, 59, 61, 57, 60, 59]), [1, v]]);
      expect(runAll(HR, o).tracks[0]?.days[0]?.state).not.toBe('ACT');
    }
  });
});

describe('profile is passed to expectedShift', () => {
  it('ShiftCtx carries missionDay and profile', () => {
    const seen: Array<[number, string]> = [];
    const def = withParams(SIGNALS.sleep_duration, SIGNALS.sleep_duration.personal.params, (c) => {
      seen.push([c.missionDay, c.profile.id]);
      return 0;
    });
    runAll(def, readings('sleep_duration', [...days(-5, [7, 7, 7, 7, 7]), [3, 7]]));
    expect(seen).toEqual([[3, PROFILE.id]]);
  });
});
