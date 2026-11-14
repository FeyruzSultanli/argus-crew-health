// Performance: 4 crew × 20 signals × 210 in-flight days (plus 180 pre-flight days) assessed in < 1.5 s in Node.
import { describe, expect, it } from 'vitest';

import { obs } from '../../__tests__/fixtures';
import { preflightOf } from '../../rules/history';
import { signalList } from '../../signals';
import type { Observation, RuleCtx, SignalDef } from '../../types';
import { assessSignal } from '../../verdict/assess';
import { clearPersonalCache } from '../cache';
import { computePersonal, computePersonalSeries } from '../personal';
import { PROFILE, prng } from './helpers';

const CREW = ['c1', 'c2', 'c3', 'c4'];
const SIGNAL_SET: SignalDef[] = signalList.slice(0, 20);
const PRE_DAYS = 180;
const FLIGHT_DAYS = 210;

/** One reading per day (two for near_acuity: one per eye), in the shape each signal expects. */
function generate(def: SignalDef, crewId: string, seed: number): Observation[] {
  const r = prng(seed);
  const out: Observation[] = [];
  const push = (d: number, value: number | null, extra: Partial<Observation> = {}) =>
    out.push(obs(def.id, value, d, { crewId: def.id.startsWith('cabin_') ? 'cabin' : crewId, ...extra }));
  for (let d = -PRE_DAYS; d <= FLIGHT_DAYS; d += 1) {
    if (d === 0) continue;
    const noise = r() - 0.5;
    const spike = r() < 0.02 ? 8 : 0;
    const v = 50 + 4 * noise + spike;
    if (def.id === 'blood_pressure')
      push(d, null, { components: { systolic: 110 + v - 50, diastolic: 70 + v - 50 } });
    else if (def.id === 'glucose') push(d, 40 + v, { context: { glucose: 'fasting' } });
    else if (def.id === 'near_acuity') {
      push(d, v / 500, { context: { eye: 'left' } });
      push(d, v / 400, { context: { eye: 'right' } });
    } else push(d, v);
  }
  return out;
}

// The budget is CPU time of this process, not wall-clock time: on a busy machine (parallel test workers, other
// builds) wall-clock time measures the scheduler, not the engine. Falls back to wall-clock where no process exists.
type CpuUsage = { user: number; system: number };
const proc = (globalThis as { process?: { cpuUsage?: (prev?: CpuUsage) => CpuUsage } }).process;
function startTimer(): () => number {
  const cpu0 = proc?.cpuUsage?.();
  const t0 = performance.now();
  return () => {
    const d = cpu0 && proc?.cpuUsage ? proc.cpuUsage(cpu0) : undefined;
    return d ? (d.user + d.system) / 1000 : performance.now() - t0;
  };
}

describe('performance', () => {
  const data = CREW.flatMap((crewId, ci) =>
    SIGNAL_SET.map((def, si) => ({ crewId, def, observations: generate(def, crewId, ci * 100 + si + 1) })),
  );

  it('personal layer for every crew × signal × in-flight day < 1.5 s (memoised computePersonal)', () => {
    clearPersonalCache();
    const elapsed = startTimer();
    let flagged = 0;
    for (const { def, observations } of data) {
      for (let day = 1; day <= FLIGHT_DAYS; day += 1) {
        const p = computePersonal(def, observations, day, PROFILE);
        if (p.verdict === 'WATCH' || p.verdict === 'ACT') flagged += 1;
      }
    }
    const ms = elapsed();
    expect(data).toHaveLength(80);
    expect(flagged).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1500);
  });

  it('full series for every crew × signal (scrubber flag density) < 1.5 s without memo', () => {
    const elapsed = startTimer();
    for (const { def, observations } of data)
      computePersonalSeries(def, observations, { upToDay: FLIGHT_DAYS, profile: PROFILE });
    expect(elapsed()).toBeLessThan(1500);
  });

  it('assessSignal + computePersonal for 4 crew × 20 signals × 210 days < 1.5 s (whole pipeline)', () => {
    clearPersonalCache();
    const elapsed = startTimer();
    for (const { def, observations } of data) {
      const preflight = preflightOf(observations);
      for (let day = 1; day <= FLIGHT_DAYS; day += 1) {
        const c: RuleCtx = { missionDay: day, profile: PROFILE, history: [], preflight, sameDay: {} };
        assessSignal(def, observations, c, computePersonal(def, observations, day, PROFILE));
      }
    }
    expect(elapsed()).toBeLessThan(1500);
  });
});
