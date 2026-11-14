import { describe, expect, it } from 'vitest';

import { NotImplementedError, placeholderHealthService as svc } from './healthService';

describe('placeholderHealthService', () => {
  it('rejects every call with NotImplementedError', async () => {
    const calls: Array<Promise<unknown>> = [
      svc.observations({}),
      svc.assess('c1', 1),
      svc.todayPlan('c1', 1),
      svc.environment(1),
      svc.spaceWeather(),
      svc.sendPacket({ crewIds: ['c1'], fromDay: 1, toDay: 1, flagsOnly: true }),
    ];
    for (const call of calls) await expect(call).rejects.toBeInstanceOf(NotImplementedError);
    await expect(
      svc.addObservation({
        crewId: 'c1',
        signalId: 'heart_rate_rest',
        value: 60,
        unit: '/min',
        source: { kind: 'manual', label: 'MEASURED' },
        quality: { score: 1, label: 'good', reasons: [] },
      }),
    ).rejects.toThrow(/addObservation/);
  });
});
