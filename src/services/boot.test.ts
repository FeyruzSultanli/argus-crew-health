import 'fake-indexeddb/auto';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';

import { useMissionStore } from '../state/mission';
import { bootData, resetBootStateForTests, resetDemoAndStores } from './boot';
import { ArgusDB } from './db';
import { getCurrentMissionDay, getMissionProfileId } from './demo';
import { createHealthService } from './healthService';

const database = new ArgusDB('argus-boot-test');
afterAll(async () => {
  resetBootStateForTests();
  database.close();
  await database.delete();
});
beforeEach(() => {
  resetBootStateForTests();
});

describe('boot and store bridge', () => {
  it('fresh browser: seeds Mars transit and opens on day 143', async () => {
    localStorage.clear();
    useMissionStore.setState({ profileId: 'mars-transit', missionDay: 143 });
    const r = await bootData(database);
    expect(r.seeded?.profileId).toBe('mars-transit');
    expect(r).toMatchObject({ profileId: 'mars-transit', missionDay: 143 });
    expect(await getCurrentMissionDay(database)).toBe(143);
    expect(await bootData(database)).toBe(await bootData(database)); // once per page
  }, 30_000);

  it('scrubber moves are written to Dexie (used as the default day of addObservation)', async () => {
    await bootData(database);
    useMissionStore.getState().setMissionDay(120);
    await waitFor(async () => expect(await getCurrentMissionDay(database)).toBe(120));
    const o = await createHealthService(database).addObservation({
      crewId: 'c1',
      signalId: 'mood',
      value: 4,
      unit: '{score}',
      source: { kind: 'manual', label: 'MEASURED' },
      quality: { score: 1, label: 'good', reasons: [] },
    });
    expect(o.missionDay).toBe(120);
  });

  it('switching profile in the store re-seeds that profile and jumps to its demo day', async () => {
    await bootData(database);
    useMissionStore.getState().setProfile('iss');
    await waitFor(async () => expect(await getMissionProfileId(database)).toBe('iss'), { timeout: 10_000 });
    await waitFor(async () => expect(await getCurrentMissionDay(database)).toBe(90));
    expect(await database.observations.filter((x) => x.missionDay > 90).count()).toBe(0);
  }, 30_000);

  it('a stored profile that differs from Dexie is applied at boot (store is the source of truth)', async () => {
    useMissionStore.setState({ profileId: 'lunar-surface', missionDay: 30 });
    const r = await bootData(database);
    expect(r.profileId).toBe('lunar-surface');
    expect(await getMissionProfileId(database)).toBe('lunar-surface');
  }, 30_000);

  it('resetDemoAndStores re-seeds and puts the store back on the demo day', async () => {
    useMissionStore.setState({ profileId: 'mars-transit', missionDay: 143 });
    await bootData(database);
    useMissionStore.getState().setMissionDay(50);
    const report = await resetDemoAndStores(undefined, database);
    expect(report.profileId).toBe('mars-transit');
    expect(useMissionStore.getState().missionDay).toBe(143);
    expect(await getCurrentMissionDay(database)).toBe(143);
    expect(await getMissionProfileId(database)).toBe('mars-transit');
  }, 30_000);
});
