// The camera-pulse observation passes the health-record validation and round-trips through Dexie (fake IndexedDB).
import 'fake-indexeddb/auto';

import { afterAll, describe, expect, it } from 'vitest';

import { analyzeTrace } from '../../../measurement/rppg/analyze';
import { synthFrames } from '../../../measurement/rppg/testSignals';
import { db } from '../../../services/db';
import { healthService } from '../../../services/healthService';
import { toObservation } from './observation';

afterAll(async () => {
  db.close();
  await db.delete();
});

describe('camera pulse → health record', () => {
  it('saves heart_rate_rest for the subject on the mission day, with source and quality', async () => {
    const est = analyzeTrace({ samples: synthFrames({ seed: 31 }), missed: 0, elapsedSec: 30, final: true });
    const saved = await healthService.addObservation(toObservation(est, 'c3', 143));
    expect(saved).toMatchObject({
      crewId: 'c3',
      signalId: 'heart_rate_rest',
      value: 72,
      unit: '/min',
      missionDay: 143,
      source: { kind: 'camera', method: 'rPPG-POS', label: 'MEASURED' },
      quality: { label: 'good', score: 1, reasons: [] },
    });
    expect(typeof saved.id).toBe('string');
    expect(Number.isNaN(Date.parse(saved.effectiveAt))).toBe(false);
    const back = await healthService.observations({ crewId: 'c3', signalId: 'heart_rate_rest' });
    expect(back.map((o) => o.id)).toContain(saved.id);
    // Only derived numbers are stored — no image, no attachments.
    expect(JSON.stringify(saved)).not.toMatch(/data:|blob:|image/i);
  });
});
