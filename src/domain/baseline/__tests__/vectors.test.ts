// Test vectors TV-1 … TV-10 of doc 08 §8, asserted row by row.
import { beforeEach, describe, expect, it } from 'vitest';

import { ctx } from '../../__tests__/fixtures';
import { preflightOf } from '../../rules/history';
import { SIGNALS } from '../../signals';
import type { Observation, Verdict } from '../../types';
import { roundTo } from '../../units';
import { ADAPTATION_EXPLANATION } from '../../verdict/explain';
import { assessSignal } from '../../verdict/assess';
import { clearPersonalCache } from '../cache';
import { driftScore } from '../cusum';
import { explainDrift } from '../explain';
import type { PersonalDay } from '../engine';
import { computePersonal } from '../personal';
import type { DayRecord } from '../reference';
import { adaptiveBaseline, preflightBaseline, selectReference } from '../reference';
import { mad, median, robustSigma, robustStats } from '../robust';
import { classify } from '../stateMachine';
import { PROFILE, TAIL_127_140, days, oseiHeartRate, readings, runAll, withParams } from './helpers';

beforeEach(() => clearPersonalCache());

type Row = [day: number, x: number, z: number, S: number, state: Verdict];

function expectRows(got: readonly PersonalDay[], rows: readonly Row[]): void {
  expect(got.map((d) => [d.missionDay, d.value, d.z, d.cusum, d.state])).toEqual(rows);
}

const HR = SIGNALS.heart_rate_rest;
/** TV-1 pre-flight → reference (59, 2). */
const PRE_59 = [58, 60, 59, 61, 57, 60, 59];

describe('TV-1 robust stats', () => {
  it('[58, 60, 59, 61, 57, 60, 59], floor 2 → median 59, MAD 1, 1.48, σ = 2 (floor wins)', () => {
    expect(median(PRE_59)).toBe(59);
    expect(mad(PRE_59)).toBe(1);
    const s = robustStats(PRE_59, 2);
    expect(roundTo(s?.rawSigma ?? 0, 2)).toBe(1.48);
    expect(robustSigma(PRE_59, 2)).toBe(2);
    expect(preflightBaseline(PRE_59, 2)).toEqual({ m: 59, sigma: 2, mad: 1, n: 7, thin: false });
  });
});

describe('TV-2 CuSum and states — reference (59, 2), no adaptive baseline yet', () => {
  it('rows day 1–7', () => {
    const o = readings('heart_rate_rest', [...days(-7, PRE_59), ...days(1, [60, 61, 63, 64, 65, 66, 67])]);
    const t = runAll(HR, o).tracks[0];
    expect(t?.preflight).toMatchObject({ m: 59, sigma: 2 });
    expectRows(t?.days ?? [], [
      [1, 60, 0.5, 0.0, 'NOMINAL'],
      [2, 61, 1.0, 0.5, 'NOMINAL'],
      [3, 63, 2.0, 2.0, 'WATCH'],
      [4, 64, 2.5, 4.0, 'WATCH'],
      [5, 65, 3.0, 6.5, 'WATCH'],
      [6, 66, 3.5, 9.5, 'ACT'],
      [7, 67, 4.0, 13.0, 'ACT'],
    ]);
    expect(t?.days.every((d) => d.referenceKind === 'preflight' && d.side === 'up')).toBe(true);
    expect(t?.days[4]?.driver).toBe('z'); // first z ≥ 3 → WATCH (confirm), not ACT
  });
});

describe('TV-3 floor dominates constant data', () => {
  it('[100 ×5], floor 5 → median 100, MAD 0, σ = 5', () => {
    const v = [100, 100, 100, 100, 100];
    expect(median(v)).toBe(100);
    expect(mad(v)).toBe(0);
    expect(robustSigma(v, 5)).toBe(5);
  });
});

describe('TV-4 down direction with expected shift (sleep)', () => {
  const SLEEP = SIGNALS.sleep_duration;
  const PRE = [7.2, 6.9, 7.5, 7.0, 7.1];
  const preObs = readings('sleep_duration', days(-5, PRE));

  it('reference: median 7.1, MAD 0.1, σ 0.3; in-flight shift −0.9 → 6.2', () => {
    const pre = preflightBaseline(PRE, 0.3);
    expect(pre?.m).toBe(7.1);
    expect(roundTo(pre?.mad ?? 0, 2)).toBe(0.1);
    expect(pre?.sigma).toBe(0.3);
    const ref = selectReference(pre as NonNullable<typeof pre>, -0.9, null);
    expect(roundTo(ref.m, 2)).toBe(6.2);
    expect(ref.kind).toBe('preflight');
  });

  /** One in-flight night on day 143, so its 3-night mean is that value and it is a single point. */
  function assessMean(mean3: number, def = SLEEP) {
    const all: Observation[] = [...preObs, ...readings('sleep_duration', [[143, mean3]])];
    const p = computePersonal(def, all, 143, PROFILE);
    const c = ctx({ history: all, preflight: preflightOf(all) });
    return { p, a: assessSignal(def, all, c, p) };
  }

  it('TV-4a 3-night mean 6.2 → z_down 0, personal NOMINAL → combined EXPECTED, drivenBy [space]', () => {
    const { p, a } = assessMean(6.2);
    expect(p.numbers?.z).toBe(0);
    expect(p.numbers?.direction).toBe(-1);
    expect(p.verdict).toBe('NOMINAL');
    expect(p.reason).toBe('Within your usual range (5.6–6.8 h).');
    expect(p.sourceIds).toContain('SRC_SLEEP_BARGER');
    expect(a.layers.space.verdict).toBe('EXPECTED');
    expect(a.layers.earth.verdict).toBe('WATCH');
    expect(a.verdict).toBe('EXPECTED');
    expect(a.drivenBy).toEqual(['space']);
    expect(a.explanation).toBe(ADAPTATION_EXPLANATION);
  });

  it('TV-4b 3-night mean 5.3 → z_down 3.0, personal WATCH (single point) → WATCH, all three layers', () => {
    const { p, a } = assessMean(5.3);
    expect(p.numbers?.z).toBe(3);
    expect(p.verdict).toBe('WATCH');
    expect(p.reason).toBe(
      'Sleep duration is 0.9 h below your usual (6.2 h). That is 3.0× your normal day-to-day variation.',
    );
    expect(a.verdict).toBe('WATCH');
    expect(a.drivenBy).toEqual(['personal', 'space', 'earth']);
    expect(a.caughtOnlyByPersonal).toBe(false);
  });

  it('TV-4c expectedShift disabled, mean 6.2 → z_down 3.0 → personal WATCH → combined WATCH', () => {
    const noShift = withParams(SLEEP, SLEEP.personal.params);
    const { p, a } = assessMean(6.2, noShift);
    expect(p.numbers?.z).toBe(3);
    expect(p.numbers?.shift).toBe(0);
    expect(p.sourceIds).not.toContain('SRC_SLEEP_BARGER');
    expect(p.verdict).toBe('WATCH');
    expect(a.verdict).toBe('WATCH');
    expect(a.drivenBy).toEqual(['personal', 'earth']);
  });
});

describe('TV-5 drift', () => {
  it("m_pre' 59, σ_pre 2, m_ad 64 → drift 2.5 → WATCH with the drift explanation even when z ≈ 0", () => {
    const drift = driftScore(64, 59, 2, 'up');
    expect(drift).toBe(2.5);
    expect(classify({ z: 0, prevZ: 0, S: 0, drift, prevState: 'NOMINAL' })).toEqual({
      state: 'WATCH',
      driver: 'drift',
    });
    expect(classify({ z: 0, prevZ: 0, S: 0, drift: 2.49, prevState: 'NOMINAL' }).state).toBe('NOMINAL');
    expect(driftScore(64, 59, 2, 'down')).toBe(-2.5);
    const d = { ref: 64, mPre: 59 } as PersonalDay;
    expect(explainDrift('heart_rate_rest', HR.label, d)).toBe(
      'Your in-flight resting heart rate has settled 5 bpm above your pre-flight normal.',
    );
  });

  it('end to end: a slow climb is learned by the adaptive baseline, then drift ≥ 2.5 flags WATCH', () => {
    const climb = Array.from({ length: 80 }, (_, i) => 59 + Math.floor(i / 8));
    const o = readings('heart_rate_rest', [...days(-7, PRE_59), ...days(1, climb)]);
    const t = runAll(withParams(HR, [{ direction: 'up', sigmaFloor: 2, aggregation: 'daily-median' }]), o)
      .tracks[0];
    const first = t?.days.find((d) => d.state !== 'NOMINAL');
    expect(first?.driver).toBe('drift');
    expect(first?.referenceKind).toBe('adaptive');
    expect(first?.drift).toBeGreaterThanOrEqual(2.5);
    expect(Math.abs(first?.z ?? 99)).toBeLessThan(2);
  });
});

describe('TV-6 thin baseline', () => {
  it('[70, 72, 71], floor 2 → MAD 1 → 1.48 → σ 2 → × 1.5 → σ = 3, thin', () => {
    expect(preflightBaseline([70, 72, 71], 2)).toEqual({ m: 71, sigma: 3, mad: 1, n: 3, thin: true });
    expect(preflightBaseline([70, 72], 2)).toBeNull();
    const o = readings('heart_rate_rest', [...days(-3, [70, 72, 71]), [1, 71]]);
    const p = computePersonal(HR, o, 1, PROFILE);
    expect(p.numbers?.sigma).toBe(3);
    expect(p.numbers?.thin).toBe(1);
    expect(runAll(HR, o).notes).toEqual(['thin baseline']);
  });
});

describe('TV-7 exclusion of flagged days (pure window function)', () => {
  it('days 5–7 ACT, other 11 NOMINAL → baseline from the 11 values only', () => {
    const values = [58, 59, 57, 58, 80, 85, 90, 60, 58, 59, 57, 58, 59, 58];
    const history = new Map<number, DayRecord>(
      values.map((v, i) => [i + 1, { value: v, verdict: i >= 4 && i <= 6 ? 'ACT' : 'NOMINAL' }]),
    );
    const b = adaptiveBaseline(15, history, 2);
    const eleven = values.filter((_, i) => i < 4 || i > 6);
    expect(eleven).toHaveLength(11);
    expect(b?.n).toBe(11);
    expect(b?.days).toEqual([1, 2, 3, 4, 8, 9, 10, 11, 12, 13, 14]);
    expect(b?.m).toBe(median(eleven));
    expect(b?.sigma).toBe(robustSigma(eleven, 2));
    // Only 6 normal days left → no adaptive baseline.
    for (const d of [1, 2, 3, 4, 8]) history.set(d, { value: 58, verdict: 'WATCH' });
    expect(adaptiveBaseline(15, history, 2)).toBeNull();
  });

  it('window = the 14 mission days before today, in-flight only, ≥ 7 needed', () => {
    const history = new Map<number, DayRecord>();
    for (let d = 1; d <= 30; d += 1) history.set(d, { value: d, verdict: 'NOMINAL' });
    expect(adaptiveBaseline(31, history, 0)?.days).toEqual(Array.from({ length: 14 }, (_, i) => 17 + i));
    expect(adaptiveBaseline(8, history, 0)?.n).toBe(7);
    expect(adaptiveBaseline(7, history, 0)).toBeNull();
    history.set(-1, { value: 99, verdict: 'NOMINAL' });
    expect(adaptiveBaseline(8, history, 0)?.days).not.toContain(-1);
  });
});

describe('TV-8 showcase "silent infection" (K. Osei)', () => {
  const o = oseiHeartRate();
  const t = runAll(HR, o).tracks[0];
  const byDay = (d: number) => t?.days.find((x) => x.missionDay === d);

  it('reference (58, 2) adaptive from days 127–140; S₁₄₀ = 0; no flag before day 141', () => {
    expect(t?.days.filter((d) => d.missionDay <= 140).every((d) => d.state === 'NOMINAL')).toBe(true);
    expect(byDay(140)?.cusum).toBe(0);
    const window = t?.days.filter((d) => d.missionDay >= 127 && d.missionDay <= 140) ?? [];
    expect(window.map((d) => d.value)).toEqual(TAIL_127_140);
    expect(byDay(141)).toMatchObject({ ref: 58, sigma: 2, referenceKind: 'adaptive', nAdaptive: 14 });
  });

  it('rows day 141–143', () => {
    expectRows(t?.days.filter((d) => d.missionDay >= 141) ?? [], [
      [141, 63, 2.5, 2.0, 'WATCH'],
      [142, 68, 5.0, 6.5, 'WATCH'],
      [143, 69, 5.5, 11.5, 'ACT'],
    ]);
    // Days 141 and 142 are flagged, so they never enter the adaptive window: the reference stays (58, 2).
    expect([byDay(142)?.ref, byDay(142)?.sigma, byDay(143)?.ref, byDay(143)?.sigma]).toEqual([58, 2, 58, 2]);
  });

  it('day 143 through assessSignal → ACT, drivenBy [personal], caughtOnlyByPersonal', () => {
    const p = computePersonal(HR, o, 143, PROFILE);
    expect(p.verdict).toBe('ACT');
    expect(p.reason).toBe(
      'Resting heart rate is 11 bpm above your usual (58 bpm). That is 5.5× your normal day-to-day variation.',
    );
    expect(p.numbers).toMatchObject({
      ref: 58,
      sigma: 2,
      z: 5.5,
      cusum: 11.5,
      drift: 0,
      nPre: 30,
      nAdaptive: 12, // window 129–142 without the flagged days 141 and 142
      referenceKind: 1,
    });
    expect(p.sourceIds).toEqual(['SRC_DEMO_BASELINE_ENGINE', 'SRC_ALAVI_2022', 'SRC_MISHRA_2020']);
    const a = assessSignal(HR, o, ctx({ missionDay: 143, history: o, preflight: preflightOf(o) }), p);
    expect(a.layers.earth.verdict).toBe('NOMINAL');
    expect(a.layers.space.verdict).toBe('NOMINAL');
    expect(a.verdict).toBe('ACT');
    expect(a.drivenBy).toEqual(['personal']);
    expect(a.caughtOnlyByPersonal).toBe(true);
  });
});

describe('TV-9 recovery and reset', () => {
  it('days 144–146 = 58 → WATCH (S ≥ 4), then reset → NOMINAL', () => {
    const t = runAll(HR, oseiHeartRate([58, 58, 58])).tracks[0];
    const tail = t?.days.filter((d) => d.missionDay >= 144) ?? [];
    expectRows(tail, [
      [144, 58, 0.0, 11.0, 'WATCH'],
      [145, 58, 0.0, 0.0, 'NOMINAL'],
      [146, 58, 0.0, 0.0, 'NOMINAL'],
    ]);
    expect(tail.map((d) => [d.ref, d.sigma])).toEqual([
      [58, 2],
      [58, 2],
      [58, 2],
    ]);
    expect(tail[0]?.driver).toBe('cusum');
    expect(tail[1]?.directions[0]?.reset).toBe(true);
  });
});

describe('TV-10 one outlier never gives ACT', () => {
  it('reference (59, 2), [59, 77, 59, 59]', () => {
    const o = readings('heart_rate_rest', [...days(-7, PRE_59), ...days(1, [59, 77, 59, 59])]);
    const t = runAll(HR, o).tracks[0];
    expectRows(t?.days ?? [], [
      [1, 59, 0.0, 0.0, 'NOMINAL'],
      [2, 77, 9.0, 8.5, 'WATCH'],
      [3, 59, 0.0, 8.0, 'WATCH'],
      [4, 59, 0.0, 0.0, 'NOMINAL'],
    ]);
    expect(computePersonal(HR, o, 3, PROFILE).reason).toBe(
      'Resting heart rate has been higher than your usual for 1 day in a row. Small changes are adding up.',
    );
  });
});
