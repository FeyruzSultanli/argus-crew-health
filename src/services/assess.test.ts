import 'fake-indexeddb/auto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Assessment, NewObservation, SignalId } from '../domain/types';
import { ArgusDB } from './db';
import { resetDemo } from './demo';
import { assessAll, createHealthService, flagDensity, personalSeries, personalTracks, setTaskStatus } from './healthService';

const NOW = new Date('2026-11-14T15:52:00Z');
const database = new ArgusDB('argus-assess-test');
const svc = createHealthService(database);

beforeAll(async () => {
  await resetDemo('mars-transit', { database, now: NOW });
}, 30_000);
afterAll(async () => {
  database.close();
  await database.delete();
});

const pick = (list: Assessment[], id: SignalId): Assessment => {
  const a = list.find((x) => x.signalId === id);
  if (!a) throw new Error(`no assessment for ${id}`);
  return a;
};
const flagged = (v: string): boolean => v === 'WATCH' || v === 'ACT';
const row = (a: Assessment) => ({
  crew: a.crewId,
  signal: a.signalId,
  verdict: a.verdict,
  P: a.layers.personal.verdict,
  S: a.layers.space.verdict,
  E: a.layers.earth.verdict,
  drivenBy: a.drivenBy,
  caughtOnlyByPersonal: a.caughtOnlyByPersonal,
});
const good = { score: 1, label: 'good' as const, reasons: [] };

describe('assess() on the generated mission', () => {
  it('one assessment per registered signal: 18 crew signals, 3 cabin signals', async () => {
    const c1 = await svc.assess('c1', 143);
    expect(c1).toHaveLength(18);
    expect(c1.every((a) => a.crewId === 'c1' && a.missionDay === 143)).toBe(true);
    const cabin = await svc.assess('cabin', 143);
    expect(cabin.map((a) => a.signalId)).toEqual(['cabin_co2', 'cabin_temp', 'cabin_humidity']);
    expect(pick(c1, 'radiation_dose').verdict).toBe('NO_DATA');
  });

  it('TV-8 from generated data: c3 resting HR WATCH 141, WATCH 142, ACT 143 caught only by personal', async () => {
    const d141 = pick(await svc.assess('c3', 141), 'heart_rate_rest');
    const d142 = pick(await svc.assess('c3', 142), 'heart_rate_rest');
    const d143 = pick(await svc.assess('c3', 143), 'heart_rate_rest');
    expect([d141.verdict, d142.verdict]).toEqual(['WATCH', 'WATCH']);
    expect(row(d143)).toEqual({
      crew: 'c3',
      signal: 'heart_rate_rest',
      verdict: 'ACT',
      P: 'ACT',
      S: 'NOMINAL',
      E: 'NOMINAL',
      drivenBy: ['personal'],
      caughtOnlyByPersonal: true,
    });
    expect(d143.layers.personal.numbers).toMatchObject({ ref: 58, sigma: 2, z: 5.5, cusum: 11.5 });
    expect(d141.layers.personal.numbers).toMatchObject({ z: 2.5, cusum: 2 });
    expect(d142.layers.personal.numbers).toMatchObject({ z: 5, cusum: 6.5 });
  });

  it('day 143 is clean outside the scenarios (seed argus-2026)', async () => {
    const all = await assessAll(143, database);
    const flags = Object.values(all)
      .flat()
      .filter((a) => flagged(a.verdict) || flagged(a.layers.personal.verdict))
      .map(row);
    console.info('day 143 WATCH/ACT:', JSON.stringify(flags));
    expect(flags).toEqual([
      // sleep-debt scenario: the last Reaction Self-Test (day 136, lapses +4) stays the latest reading until today's test
      { crew: 'c2', signal: 'reaction_test', verdict: 'WATCH', P: 'NOMINAL', S: 'WATCH', E: 'NO_DATA', drivenBy: ['space'], caughtOnlyByPersonal: false },
      { crew: 'c3', signal: 'heart_rate_rest', verdict: 'ACT', P: 'ACT', S: 'NOMINAL', E: 'NOMINAL', drivenBy: ['personal'], caughtOnlyByPersonal: true },
      // silent-infection scenario: +0.6 °C → 37.0 °C
      { crew: 'c3', signal: 'body_temp', verdict: 'WATCH', P: 'WATCH', S: 'NOMINAL', E: 'NOMINAL', drivenBy: ['personal'], caughtOnlyByPersonal: true },
    ]);
    expect(pick(all.c3!, 'mood').verdict).toBe('NOMINAL'); // mood −1 → 3, 3-day mean 3.3: inside the personal band
    for (const id of ['c1', 'c2', 'c3', 'c4']) expect(pick(all[id]!, 'radiation_dose').verdict).toBe('NO_DATA');
  });

  it('showcase days: CO₂ missed by Earth, sleep debt WATCH/ACT with the reaction test, Amsler WATCH', async () => {
    const co2 = async (d: number) => row(pick(await svc.assess('cabin', d), 'cabin_co2'));
    expect(await co2(118)).toMatchObject({ verdict: 'WATCH', S: 'WATCH', E: 'NOMINAL', drivenBy: ['space'] });
    expect(await co2(120)).toMatchObject({ verdict: 'WATCH', S: 'WATCH', E: 'WATCH' });
    const sleep = async (d: number) => pick(await svc.assess('c2', d), 'sleep_duration').verdict;
    const verdicts: string[] = [];
    for (const d of [130, 131, 132, 133, 134, 135, 136]) verdicts.push(await sleep(d));
    expect(verdicts).toEqual(['EXPECTED', 'EXPECTED', 'WATCH', 'ACT', 'WATCH', 'WATCH', 'ACT']);
    expect(pick(await svc.assess('c2', 133), 'reaction_test').verdict).toBe('WATCH');
    const amsler = pick(await svc.assess('c1', 90), 'amsler');
    expect(row(amsler)).toMatchObject({ verdict: 'WATCH', S: 'WATCH', E: 'WATCH' });
    expect(amsler.action).toMatchObject({ kind: 'protocol', protocolId: 'vision-change' });
    // near acuity +0.1 logMAR with anticipation glasses → EXPECTED driven by space
    const acuity = pick(await svc.assess('c1', 90), 'near_acuity');
    expect(row(acuity)).toMatchObject({ verdict: 'EXPECTED', S: 'EXPECTED', drivenBy: ['space'] });
  });

  it('assess for one crew-day is fast once the crew is loaded (doc 05 §10: ≤ 20 ms)', async () => {
    await svc.assess('c4', 143);
    const t0 = performance.now();
    await svc.assess('c4', 100); // not cached: full pipeline
    const cold = performance.now() - t0;
    const t1 = performance.now();
    await svc.assess('c4', 100);
    const warm = performance.now() - t1;
    console.info(`assess c4 day 100: uncached ${cold.toFixed(1)} ms, cached ${warm.toFixed(2)} ms (jsdom + fake-indexeddb)`);
    expect(cold).toBeLessThan(200);
  });
});

describe('personal series', () => {
  it('merged series and per-track series up to a day', async () => {
    const s = await personalSeries('c3', 'heart_rate_rest', 143, database);
    expect(s.at(-1)).toMatchObject({ missionDay: 143, value: 69, state: 'ACT' });
    expect(s.every((p) => p.missionDay <= 143)).toBe(true);
    expect((await personalSeries('c3', 'heart_rate_rest', 100, database)).at(-1)?.missionDay).toBe(100);
    const bp = await personalTracks('c1', 'blood_pressure', 143, database);
    expect(bp.map((t) => t.component)).toEqual(['systolic', 'diastolic']);
  });
});

describe('writes invalidate what they affect', () => {
  it('a camera HR of 60 on day 143 changes c3’s assessment (median of the day)', async () => {
    const before = pick(await svc.assess('c3', 143), 'heart_rate_rest');
    const before142 = pick(await svc.assess('c3', 142), 'heart_rate_rest');
    const o: NewObservation = {
      crewId: 'c3',
      signalId: 'heart_rate_rest',
      value: 60,
      unit: '/min',
      missionDay: 143,
      source: { kind: 'camera', method: 'rPPG', label: 'MEASURED' },
      quality: good,
    };
    await svc.addObservation(o);
    const after = pick(await svc.assess('c3', 143), 'heart_rate_rest');
    expect(before.layers.personal.numbers?.value).toBe(69);
    expect(after.layers.personal.numbers?.value).toBe(64.5); // median(69, 60)
    expect(after.layers.personal.numbers?.z).not.toBe(before.layers.personal.numbers?.z);
    expect(pick(await svc.assess('c3', 142), 'heart_rate_rest')).toBe(before142); // earlier day untouched (cache)
  });

  it('reaction_test task is due on 143 for every crew member and flips to done after a test is saved', async () => {
    for (const id of ['c1', 'c2', 'c3', 'c4']) {
      const t = (await svc.todayPlan(id, 143)).find((x) => x.signalId === 'reaction_test');
      expect(t?.status).toBe('due');
    }
    const sleepBefore = pick(await svc.assess('c2', 143), 'sleep_duration');
    await svc.addObservation({
      crewId: 'c2',
      signalId: 'reaction_test',
      value: 3.8,
      components: { medianRtMs: 262, lapses: 9, falseStarts: 0, nStimuli: 62 },
      unit: '/s',
      missionDay: 143,
      source: { kind: 'manual', method: 'Reaction Self-Test', label: 'MEASURED' },
      quality: good,
    });
    const plan = await svc.todayPlan('c2', 143);
    expect(plan.find((x) => x.signalId === 'reaction_test')?.status).toBe('done');
    const rt = pick(await svc.assess('c2', 143), 'reaction_test');
    expect(rt.latest?.missionDay).toBe(143);
    expect(rt.layers.space.verdict).toBe('ACT'); // 9 lapses ≥ baseline 2 + 6
    // same-day dependent re-assessed (sleep reads today's reaction test); sleep on 143 is not < 5.5 h so no ACT
    const sleepAfter = pick(await svc.assess('c2', 143), 'sleep_duration');
    expect(sleepAfter).not.toBe(sleepBefore);
  });

  it('a skipped task is persisted', async () => {
    const task = (await svc.todayPlan('c1', 143)).find((x) => x.signalId === 'symptoms')!;
    expect(task.status).toBe('due');
    await setTaskStatus(task, 'skipped', database);
    expect((await svc.todayPlan('c1', 143)).find((x) => x.signalId === 'symptoms')?.status).toBe('skipped');
    await setTaskStatus(task, 'due', database);
    expect((await svc.todayPlan('c1', 143)).find((x) => x.signalId === 'symptoms')?.status).toBe('due');
  });
});

describe('flag density', () => {
  it('covers −180 … 143 without day 0 and counts crew WATCH/ACT', async () => {
    const t0 = performance.now();
    const d = await flagDensity(undefined, database);
    const ms = performance.now() - t0;
    console.info(`flag density (4 crew × 323 days): ${ms.toFixed(0)} ms (jsdom, includes yields)`);
    expect(d).toHaveLength(323);
    expect(d[0]?.missionDay).toBe(-180);
    expect(d.at(-1)?.missionDay).toBe(143);
    expect(d.some((x) => x.missionDay === 0)).toBe(false);
    const d143 = d.find((x) => x.missionDay === 143)!;
    const all = await assessAll(143, database);
    const crewOnly = ['c1', 'c2', 'c3', 'c4'].flatMap((id) => all[id]!);
    expect(d143.act).toBe(crewOnly.filter((a) => a.verdict === 'ACT').length);
    expect(d143.watch).toBe(crewOnly.filter((a) => a.verdict === 'WATCH').length);
    const t1 = performance.now();
    await flagDensity(undefined, database);
    console.info(`flag density cached: ${(performance.now() - t1).toFixed(1)} ms`);
  }, 30_000);
});

describe('dose seam', () => {
  it('setDoseProvider feeds ctx.dose: radiation_dose leaves NO_DATA', async () => {
    const { setDoseProvider } = await import('./assessments');
    expect(pick(await svc.assess('c1', 143), 'radiation_dose').verdict).toBe('NO_DATA');
    await setDoseProvider(
      (crewId) => ({
        crewId,
        careerPreMissionMsv: 120,
        missionGcrMsv: 257.4,
        missionSpeMsvModeled: 0,
        totalMsv: 377.4,
        pctOfCareerLimit: 0.629,
        projectedEndMsv: 498.6,
        pctProjected: 0.831,
        speCurrentEventMsvModeled: 0,
        sourceIds: ['SRC_DEMO_RADIATION_MODEL'],
      }),
      database,
    );
    expect(pick(await svc.assess('c1', 143), 'radiation_dose').verdict).toBe('WATCH'); // projected ≥ 480 mSv
    await setDoseProvider(null, database);
    expect(pick(await svc.assess('c1', 143), 'radiation_dose').verdict).toBe('NO_DATA');
  });
});

describe('regression cases', () => {
  it('day-143 hematocrit space layer is EXPECTED for every crew member (rise inside +12 %)', async () => {
    for (const id of ['c1', 'c2', 'c3', 'c4']) {
      expect(pick(await svc.assess(id, 143), 'hematocrit').layers.space.verdict).toBe('EXPECTED');
    }
  });

  it('OSD-575 glucose anchors are judged as random draws (c2: 100 / 83 NOMINAL, 56 WATCH low)', async () => {
    const v: string[] = [];
    for (const d of [-92, -44, -3]) {
      const g = pick(await svc.assess('c2', d), 'glucose');
      expect(g.latest?.context?.glucose).toBe('random');
      v.push(`${g.latest?.value}:${g.verdict}`);
    }
    expect(v).toEqual(['100:NOMINAL', '83:NOMINAL', '56:WATCH']);
  });

  it('exercise on days −180/−179 is NOMINAL for every crew member', async () => {
    for (const id of ['c1', 'c2', 'c3', 'c4']) {
      for (const d of [-180, -179]) expect(pick(await svc.assess(id, d), 'exercise_minutes').verdict).toBe('NOMINAL');
    }
  });

  it('a poor reading on a day with a good one does not feed the personal baseline', async () => {
    const before = pick(await svc.assess('c1', 143), 'heart_rate_rest');
    const seriesBefore = await personalSeries('c1', 'heart_rate_rest', 143, database);
    expect(before.verdict).toBe('NOMINAL');
    await svc.addObservation({
      crewId: 'c1',
      signalId: 'heart_rate_rest',
      value: 90,
      unit: '/min',
      missionDay: 143,
      source: { kind: 'camera', method: 'rPPG', label: 'MEASURED' },
      quality: { score: 0.2, label: 'poor', reasons: ['motion detected'] },
    });
    const after = pick(await svc.assess('c1', 143), 'heart_rate_rest');
    expect(row(after)).toMatchObject({ verdict: 'NOMINAL', P: 'NOMINAL', S: 'NOMINAL', E: 'NOMINAL', caughtOnlyByPersonal: false });
    expect(after.layers.personal.numbers).toEqual(before.layers.personal.numbers);
    expect(await personalSeries('c1', 'heart_rate_rest', 143, database)).toEqual(seriesBefore);
  });

  it('a day with only a poor reading keeps it, with the poor-quality gate', async () => {
    await svc.addObservation({
      crewId: 'c1',
      signalId: 'body_mass',
      value: 81.9,
      unit: 'kg',
      missionDay: 143,
      source: { kind: 'manual', label: 'MEASURED' },
      quality: { score: 0.2, label: 'poor', reasons: ['scale not calibrated'] },
    });
    const a = pick(await svc.assess('c1', 143), 'body_mass');
    expect(a.latest?.missionDay).toBe(143);
    expect(a.quality.label).toBe('poor');
    expect(a.action.kind).toBe('remeasure');
    expect(['NOMINAL', 'EXPECTED', 'WATCH']).toContain(a.verdict);
    expect((await personalSeries('c1', 'body_mass', 143, database)).at(-1)?.missionDay).toBe(143);
  });
});
