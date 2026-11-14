// One convention for the symptoms observation — value null, components = 0/1 flags keyed by SYMPTOM_KEYS
// (doc comment in src/domain/signals/symptoms.ts). The simulator's output must satisfy the same rule as the Lab.
import { describe, expect, it } from 'vitest';

import type { NewObservation } from '../domain/types';
import { loadSeed, profileById } from './seed';
import { generateObservations } from './sim/generator';
import { ObservationValidationError, validateNewObservation } from './validation';

const base: NewObservation = {
  crewId: 'c3',
  signalId: 'symptoms',
  value: null,
  unit: '1',
  missionDay: 143,
  components: { headache: 1, rash: 0 },
  source: { kind: 'manual', label: 'MEASURED' },
  quality: { score: 1, label: 'good', reasons: [] },
};

describe('symptoms observation shape', () => {
  it('accepts value null with 0/1 flags, including an all-zero "none" list and no components', () => {
    expect(() => validateNewObservation(base)).not.toThrow();
    expect(() => validateNewObservation({ ...base, components: { headache: 0, fatigue: 0 } })).not.toThrow();
    expect(() => validateNewObservation({ ...base, components: undefined })).not.toThrow();
  });

  it('rejects a numeric value (the count is not stored), unknown items and non-flag values', () => {
    expect(() => validateNewObservation({ ...base, value: 1 })).toThrow(/value must be null/);
    expect(() => validateNewObservation({ ...base, components: { sneezing: 1 } })).toThrow(
      /unknown checklist item sneezing/,
    );
    expect(() => validateNewObservation({ ...base, components: { headache: 2 } })).toThrow(
      ObservationValidationError,
    );
  });

  it('every simulated symptoms observation follows the same rule', () => {
    const s = loadSeed();
    const obs = generateObservations(s.crew, profileById('mars-transit'), s.scenarios, s.anchors, undefined, {
      missionEpoch: '2026-06-25T00:00:00.000Z',
    }).filter((o) => o.signalId === 'symptoms');
    expect(obs.length).toBeGreaterThan(0);
    for (const o of obs) expect(() => validateNewObservation(o)).not.toThrow();
  });
});
