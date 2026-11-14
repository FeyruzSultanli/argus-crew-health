// Observation shape of a face scan passes the real validator (doc 06 §3: unit '1', value 0.5–2.0); the reference
// store keeps numbers only and set / reset work.
import { beforeEach, describe, expect, it } from 'vitest';

import { REFERENCE_INDEX, fluidIndex } from '../../../measurement/face/fluidShiftIndex';
import { ObservationValidationError, validateNewObservation } from '../../../services/validation';
import { toFaceObservation } from './observation';
import { REFERENCE_KEY, clearReference, isReferenceValid, loadReference, saveReference } from './referenceStore';

const Q = { score: 0.94, label: 'good' as const, reasons: [] };

describe('toFaceObservation', () => {
  it('reference scan: value 1, ratios 1, passes the validator', () => {
    const o = toFaceObservation({ crewId: 'c3', missionDay: 143, index: REFERENCE_INDEX, quality: Q, acceptedFrames: 88, isReference: true });
    expect(o).toEqual({
      crewId: 'c3',
      signalId: 'face_fluid_index',
      value: 1,
      unit: '1',
      missionDay: 143,
      components: { cheekWidthRatio: 1, jawWidthRatio: 1, eyeApertureRatio: 1, acceptedFrames: 88, referenceScan: 1 },
      source: { kind: 'camera', method: 'face-geometry (MediaPipe landmarks)', label: 'MEASURED' },
      quality: Q,
    });
    expect(() => validateNewObservation(o)).not.toThrow();
  });

  it('later scan: ratios vs the reference; out-of-range index is rejected by the validator', () => {
    const idx = fluidIndex({ cheekWidth: 2.06, jawWidth: 1.648, eyeAperture: 0.19 }, { cheekWidth: 2, jawWidth: 1.6, eyeAperture: 0.2 });
    const o = toFaceObservation({ crewId: 'c3', missionDay: 150, index: idx, quality: Q, acceptedFrames: 80, isReference: false });
    expect(o.value).toBe(1.03);
    expect(o.components).toEqual({ cheekWidthRatio: 1.03, jawWidthRatio: 1.03, eyeApertureRatio: 0.95, acceptedFrames: 80, referenceScan: 0 });
    expect(() => validateNewObservation(o)).not.toThrow();
    const bad = toFaceObservation({ crewId: 'c3', missionDay: 150, index: { ...idx, index: 2.5 }, quality: Q, acceptedFrames: 80, isReference: false });
    expect(() => validateNewObservation(bad)).toThrow(ObservationValidationError);
  });
});

describe('referenceStore', () => {
  beforeEach(() => localStorage.clear());
  const ref = {
    crewId: 'c3',
    features: { cheekWidth: 2.1, jawWidth: 1.7, eyeAperture: 0.2 },
    missionDay: 143,
    quality: { label: 'good' as const, score: 1 },
    observationId: 'obs-1',
    savedAt: '2026-11-14T10:00:00.000Z',
  };

  it('set, load per subject, reset', () => {
    expect(loadReference('c3')).toBeNull();
    saveReference(ref);
    saveReference({ ...ref, crewId: 'c1', observationId: 'obs-2' });
    expect(loadReference('c3')).toEqual(ref);
    expect(loadReference('c1')?.observationId).toBe('obs-2');
    clearReference('c3');
    expect(loadReference('c3')).toBeNull();
    expect(loadReference('c1')).not.toBeNull();
    clearReference('c1');
    expect(localStorage.getItem(REFERENCE_KEY)).toBeNull();
  });

  it('stores numbers only (extra fields are dropped) and ignores garbage', () => {
    saveReference({ ...ref, image: 'data:image/png;base64,AAAA' } as typeof ref);
    expect(localStorage.getItem(REFERENCE_KEY)).not.toMatch(/data:|image/);
    localStorage.setItem(REFERENCE_KEY, '{not json');
    expect(loadReference('c3')).toBeNull();
    localStorage.setItem(REFERENCE_KEY, JSON.stringify({ c3: { features: { cheekWidth: 'x' } } }));
    expect(loadReference('c3')).toBeNull();
  });

  it('valid only while its observation exists in the record', () => {
    expect(isReferenceValid(ref, new Set(['obs-1']))).toBe(true);
    expect(isReferenceValid(ref, new Set())).toBe(false);
    expect(isReferenceValid(null, new Set(['obs-1']))).toBe(false);
  });
});
