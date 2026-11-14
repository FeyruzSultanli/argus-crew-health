// Unit tests: every quality check at its thresholds (doc 09 §1.3; demo parameters SRC_DEMO_QUALITY_SCORES).
import { describe, expect, it } from 'vitest';

import {
  QUALITY_SOURCE_ID,
  assessQuality,
  checkConsistency,
  checkFacePresence,
  checkLighting,
  checkMotion,
  checkSnr,
  combineQuality,
} from './quality';

describe('quality checks at thresholds', () => {
  it('cites the demo-parameter source', () => {
    expect(QUALITY_SOURCE_ID).toBe('SRC_DEMO_QUALITY_SCORES');
  });
  it('SNR: good ≥ 3 dB, fair 0–3, poor < 0', () => {
    expect(checkSnr(3).label).toBe('good');
    expect(checkSnr(2.99).label).toBe('fair');
    expect(checkSnr(0).label).toBe('fair');
    expect(checkSnr(-0.01).label).toBe('poor');
    expect(checkSnr(-Infinity).label).toBe('poor');
  });
  it('consistency: good ≤ 5 bpm, fair ≤ 10, poor > 10', () => {
    expect(checkConsistency(5).label).toBe('good');
    expect(checkConsistency(5.01).label).toBe('fair');
    expect(checkConsistency(10).label).toBe('fair');
    expect(checkConsistency(10.01).label).toBe('poor');
  });
  it('motion: good ≤ 3 px, fair ≤ 8, poor > 8', () => {
    expect(checkMotion(3).label).toBe('good');
    expect(checkMotion(3.01).label).toBe('fair');
    expect(checkMotion(8).label).toBe('fair');
    expect(checkMotion(8.01).label).toBe('poor');
    expect(checkMotion(9).reason).toBe('too much movement');
  });
  it('lighting: good 60–200 & < 2 % clipped, fair 40–220 & < 5 %, otherwise poor', () => {
    expect(checkLighting(60, 0).label).toBe('good');
    expect(checkLighting(200, 1.99).label).toBe('good');
    expect(checkLighting(59.9, 0).label).toBe('fair');
    expect(checkLighting(40, 0).label).toBe('fair');
    expect(checkLighting(39.9, 0).label).toBe('poor');
    expect(checkLighting(39.9, 0).reason).toBe('too dark');
    expect(checkLighting(200.1, 0).label).toBe('fair');
    expect(checkLighting(220, 0).label).toBe('fair');
    expect(checkLighting(220.1, 0).label).toBe('poor');
    expect(checkLighting(221, 0).reason).toBe('too bright');
    expect(checkLighting(120, 2).label).toBe('fair');
    expect(checkLighting(120, 4.99).label).toBe('fair');
    expect(checkLighting(120, 5).label).toBe('poor');
    expect(checkLighting(120, 5).reason).toMatch(/overexposed/);
  });
  it('face presence: good ≥ 95 %, fair ≥ 80, poor < 80', () => {
    expect(checkFacePresence(95).label).toBe('good');
    expect(checkFacePresence(94.9).label).toBe('fair');
    expect(checkFacePresence(80).label).toBe('fair');
    expect(checkFacePresence(79.9).label).toBe('poor');
  });
  it('good checks carry no reason; non-good checks do', () => {
    expect(checkSnr(5).reason).toBeUndefined();
    expect(checkSnr(1).reason).toMatch(/weak pulse signal/);
  });
});

describe('combineQuality', () => {
  it('label = worst check, score = mean of normalised checks, reasons in plain words', () => {
    const q = combineQuality([checkSnr(5), checkMotion(5), checkLighting(30, 0)]);
    expect(q.label).toBe('poor');
    expect(q.score).toBeCloseTo((1 + 0.5 + 0) / 3, 2);
    expect(q.reasons).toEqual(['some movement', 'too dark']);
  });
  it('all good → score 1, no reasons', () => {
    const { quality, checks } = assessQuality({
      snrDb: 6,
      consistencyBpm: 1,
      motionSdPx: 1,
      meanLum: 120,
      clipPct: 0,
      facePct: 100,
    });
    expect(checks.map((c) => c.id)).toEqual(['snr', 'consistency', 'motion', 'lighting', 'face']);
    expect(quality).toEqual({ score: 1, label: 'good', reasons: [] });
  });
  it('omits consistency for live estimates', () => {
    const { checks } = assessQuality({ snrDb: 6, motionSdPx: 1, meanLum: 120, clipPct: 0, facePct: 100 });
    expect(checks.map((c) => c.id)).not.toContain('consistency');
  });
  it('no checks → poor', () => {
    expect(combineQuality([]).label).toBe('poor');
  });
});
