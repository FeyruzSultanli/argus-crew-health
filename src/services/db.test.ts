import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import type { NewObservation } from '../domain/types';
import { ArgusDB } from './db';
import {
  getCurrentMissionDay,
  getMissionEpoch,
  getMissionProfileId,
  listCrew,
  missionDateOf,
  resetDemo,
  seedIfEmpty,
  setCurrentMissionDay,
} from './demo';
import { createHealthService } from './healthService';
import { ObservationValidationError } from './validation';

let n = 0;
const open: ArgusDB[] = [];
const freshDb = (name = `argus-test-${++n}`): ArgusDB => {
  const d = new ArgusDB(name);
  open.push(d);
  return d;
};
afterEach(async () => {
  for (const d of open.splice(0)) {
    d.close();
    await d.delete();
  }
});

const hr = (value: number, extra: Partial<NewObservation> = {}): NewObservation => ({
  crewId: 'c1',
  signalId: 'heart_rate_rest',
  value,
  unit: '/min',
  source: { kind: 'manual', label: 'MEASURED' },
  quality: { score: 1, label: 'good', reasons: [] },
  ...extra,
});
const NOW = new Date('2026-11-14T15:52:00Z');

describe('Dexie round-trip', () => {
  it('add → query → survives a new Dexie instance', async () => {
    const name = `argus-test-roundtrip-${++n}`;
    const a = freshDb(name);
    const svc = createHealthService(a);
    const saved = await svc.addObservation(hr(61, { missionDay: 12, effectiveAt: '2026-07-06T08:00:00.000Z' }));
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await svc.observations({ crewId: 'c1', signalId: 'heart_rate_rest' })).toEqual([saved]);
    a.close();

    const b = new ArgusDB(name);
    open.push(b);
    const again = await createHealthService(b).observations({ crewId: 'c1', fromDay: 12, toDay: 12 });
    expect(again).toEqual([saved]);
  });

  it('addObservation without missionDay uses the stored current mission day', async () => {
    const d = freshDb();
    await resetDemo('mars-transit', { database: d, now: NOW });
    await setCurrentMissionDay(140, d);
    const svc = createHealthService(d);
    const o = await svc.addObservation(hr(60));
    expect(o.missionDay).toBe(140);
    expect(Date.parse(o.effectiveAt)).not.toBeNaN();
    await expect(setCurrentMissionDay(0, d)).rejects.toThrow(RangeError);
    await expect(setCurrentMissionDay(144, d)).rejects.toThrow(RangeError);
  });

  it('rejects impossible input', async () => {
    const svc = createHealthService(freshDb());
    await expect(svc.addObservation(hr(300, { missionDay: 1 }))).rejects.toBeInstanceOf(ObservationValidationError);
    await expect(svc.addObservation(hr(60, { missionDay: 0 }))).rejects.toThrow(/missionDay/);
    await expect(svc.addObservation(hr(60, { missionDay: 1, unit: 'bpm' }))).rejects.toThrow(/unit/);
    await expect(
      svc.addObservation({ ...hr(0, { missionDay: 1 }), signalId: 'blood_pressure', unit: 'mm[Hg]', value: null, components: { systolic: 70, diastolic: 80 } }),
    ).rejects.toThrow(/systolic/);
  });

  it('query filters by crew, signal and day range, oldest first', async () => {
    const svc = createHealthService(freshDb());
    await svc.addObservation(hr(62, { missionDay: 3 }));
    await svc.addObservation(hr(60, { missionDay: -2 }));
    await svc.addObservation(hr(70, { missionDay: 5, crewId: 'c2' }));
    expect((await svc.observations({ crewId: 'c1' })).map((o) => o.missionDay)).toEqual([-2, 3]);
    expect((await svc.observations({ signalId: 'heart_rate_rest', fromDay: 1 })).map((o) => o.value)).toEqual([62, 70]);
    expect(await svc.observations({ crewId: 'c1', signalId: 'heart_rate_rest', toDay: -1 })).toHaveLength(1);
    expect(await svc.observations({})).toHaveLength(3);
  });
});

describe('seeding and reset', () => {
  it('seedIfEmpty seeds once: Mars transit day 143, 4 crew, epoch fixed so day 143 is today', async () => {
    const d = freshDb();
    const report = await seedIfEmpty(undefined, { database: d, now: NOW });
    expect(report).not.toBeNull();
    console.info(
      `seed (fake-indexeddb): ${report!.observations} observations, generate ${report!.generateMs.toFixed(0)} ms, ` +
        `bulk insert ${report!.insertMs.toFixed(0)} ms`,
    );
    expect(await getMissionProfileId(d)).toBe('mars-transit');
    expect(await getCurrentMissionDay(d)).toBe(143);
    expect(await getMissionEpoch(d)).toBe('2026-06-25T00:00:00.000Z');
    expect((await missionDateOf(143, d)).toISOString()).toBe('2026-11-14T00:00:00.000Z');
    expect((await listCrew(d)).map((c) => c.displayName)).toEqual(['R. Vance', 'M. Ito', 'K. Osei', 'L. Duarte']);
    expect(await d.observations.count()).toBe(report!.observations);
    expect(await seedIfEmpty(undefined, { database: d, now: NOW })).toBeNull();

    const svc = createHealthService(d);
    const c3 = await svc.observations({ crewId: 'c3', signalId: 'heart_rate_rest', fromDay: 141 });
    expect(c3.map((o) => o.value)).toEqual([63, 68, 69]);
  });

  it('concurrent first-run calls seed only once', async () => {
    const d = freshDb();
    const [a, b] = await Promise.all([
      seedIfEmpty(undefined, { database: d, now: NOW }),
      seedIfEmpty(undefined, { database: d, now: NOW }),
    ]);
    expect(a).toBe(b);
  });

  it('reset wipes added data and caches, keeps the space-weather cache, re-seeds', async () => {
    const d = freshDb();
    const first = await resetDemo('mars-transit', { database: d, now: NOW });
    const svc = createHealthService(d);
    await svc.addObservation(hr(99, { missionDay: 143 }));
    await setCurrentMissionDay(100, d);
    await d.spaceWeather.put({ id: 'goes', kind: 'protons', timeTag: '2026-11-14T13:10:00Z' });
    await d.tasks.put({ id: 't', crewId: 'c1', missionDay: 143, kind: 'measure', title: 't', why: 'w', status: 'due', points: 10 });

    const second = await resetDemo(undefined, { database: d, now: NOW });
    expect(second.observations).toBe(first.observations);
    expect(await d.observations.count()).toBe(first.observations);
    expect((await svc.observations({ crewId: 'c1', fromDay: 143 })).some((o) => o.value === 99)).toBe(false);
    expect(await d.tasks.count()).toBe(0);
    expect(await d.spaceWeather.count()).toBe(1);
    expect(await getCurrentMissionDay(d)).toBe(143);
  });

  it('switching profile re-seeds truncated at that demo day', async () => {
    const d = freshDb();
    await resetDemo('iss', { database: d, now: NOW });
    expect(await getCurrentMissionDay(d)).toBe(90);
    const last = await d.observations.orderBy('[crewId+missionDay]').last();
    expect(last?.missionDay).toBeLessThanOrEqual(90);
    expect(await d.observations.filter((o) => o.missionDay > 90).count()).toBe(0);
  });
});
