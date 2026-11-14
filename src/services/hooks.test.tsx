import 'fake-indexeddb/auto';

import { renderHook, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db } from './db';
import { resetDemo } from './demo';
import { healthService } from './healthService';
import {
  useAllAssessments,
  useAssessments,
  useCrew,
  useFlagDensity,
  useMissionClock,
  useObservations,
  usePersonalSeries,
  usePersonalTracks,
  useTodayPlan,
} from './hooks';

beforeAll(async () => {
  await resetDemo('mars-transit', { now: new Date('2026-11-14T15:52:00Z') });
}, 30_000);
afterAll(async () => {
  db.close();
  await db.delete();
});

const good = { score: 1, label: 'good' as const, reasons: [] };

describe('live hooks', () => {
  it('useCrew and useMissionClock read the seeded state', async () => {
    const crew = renderHook(() => useCrew());
    await waitFor(() => expect(crew.result.current).toHaveLength(4));
    const clock = renderHook(() => useMissionClock());
    await waitFor(() =>
      expect(clock.result.current).toEqual({
        profileId: 'mars-transit',
        missionEpoch: '2026-06-25T00:00:00.000Z',
        currentDay: 143,
      }),
    );
  });

  it('useAllAssessments, usePersonalSeries and usePersonalTracks', async () => {
    const all = renderHook(() => useAllAssessments(143));
    await waitFor(() => expect(Object.keys(all.result.current ?? {}).sort()).toEqual(['c1', 'c2', 'c3', 'c4', 'cabin']));
    const s = renderHook(() => usePersonalSeries('c3', 'heart_rate_rest', 143));
    await waitFor(() => expect(s.result.current?.at(-1)).toMatchObject({ missionDay: 143, state: 'ACT' }));
    const t = renderHook(() => usePersonalTracks('c1', 'near_acuity', 143));
    await waitFor(() => expect(t.result.current?.map((x) => x.eye).sort()).toEqual(['left', 'right']));
  });

  it('useFlagDensity returns −180 … 143', async () => {
    const { result } = renderHook(() => useFlagDensity());
    await waitFor(() => expect(result.current).toHaveLength(323), { timeout: 10_000 });
    expect(result.current?.find((d) => d.missionDay === 143)?.act).toBeGreaterThanOrEqual(1);
  }, 20_000);

  it('observations, assessments and the plan re-render after a write', async () => {
    const obs = renderHook(() => useObservations({ crewId: 'c4', signalId: 'reaction_test', fromDay: 143 }));
    const plan = renderHook(() => useTodayPlan('c4', 143));
    const assess = renderHook(() => useAssessments('c4', 143));
    await waitFor(() => expect(obs.result.current).toEqual([]));
    await waitFor(() => expect(plan.result.current?.find((x) => x.signalId === 'reaction_test')?.status).toBe('due'));
    await waitFor(() => expect(assess.result.current?.find((a) => a.signalId === 'reaction_test')?.latest?.missionDay).toBe(136));
    await healthService.addObservation({
      crewId: 'c4',
      signalId: 'reaction_test',
      value: 3.7,
      components: { medianRtMs: 270, lapses: 2, falseStarts: 0, nStimuli: 62 },
      unit: '/s',
      source: { kind: 'manual', method: 'Reaction Self-Test', label: 'MEASURED' },
      quality: good,
    });
    await waitFor(() => expect(obs.result.current?.map((o) => o.missionDay)).toEqual([143]));
    await waitFor(() => expect(plan.result.current?.find((x) => x.signalId === 'reaction_test')?.status).toBe('done'));
    await waitFor(() =>
      expect(assess.result.current?.find((a) => a.signalId === 'reaction_test')?.latest?.missionDay).toBe(143),
    );
  });
});
