// Face fluid-shift scan — pure logic: geometry features, IPD normalisation, yaw/pitch from the transformation
// matrix, expression from blendshapes, frame acceptance at each threshold, median aggregation, quality, the index.
import { describe, expect, it } from 'vitest';

import { FACE_SCAN, type FaceFrame, fluidIndex, judgeFrame, median, percentVsReference, qualityOf, relativeSpread, summarizeScan } from './fluidShiftIndex';
import { FACE_LM, FACE_SCAN_LANDMARKS, type FaceFeatures, faceGeometry } from './geometry';
import { expressionFromBlendshapes, matrixFromPose, poseFromMatrix } from './pose';
import { syntheticFace } from './testFaces';

describe('faceGeometry', () => {
  it('known widths → known ratios (normalised by IPD)', () => {
    const g = faceGeometry(syntheticFace({ ipd: 60, cheek: 130, jaw: 100, eyeRight: 10, eyeLeft: 14 }), 640, 480);
    expect(g?.ipdPx).toBeCloseTo(60, 9);
    expect(g?.features.cheekWidth).toBeCloseTo(130 / 60, 9);
    expect(g?.features.jawWidth).toBeCloseTo(100 / 60, 9);
    expect(g?.features.eyeAperture).toBeCloseTo(12 / 60, 9);
  });

  it('invariant to uniform scale (camera distance) and translation', () => {
    const base = faceGeometry(syntheticFace(), 640, 480)?.features;
    for (const o of [{ scale: 0.6 }, { scale: 1.7 }, { dx: 80, dy: -45 }, { scale: 1.3, dx: -60, dy: 30 }]) {
      const f = faceGeometry(syntheticFace(o), 640, 480)?.features;
      expect(f?.cheekWidth).toBeCloseTo(base?.cheekWidth as number, 9);
      expect(f?.jawWidth).toBeCloseTo(base?.jawWidth as number, 9);
      expect(f?.eyeAperture).toBeCloseTo(base?.eyeAperture as number, 9);
    }
  });

  it('measures in pixels: works for a non-4:3 image too', () => {
    const f = faceGeometry(syntheticFace({ width: 1280, height: 720 }), 1280, 720)?.features;
    expect(f?.cheekWidth).toBeCloseTo(130 / 60, 9);
  });

  it('missing landmarks or a tiny IPD → null', () => {
    expect(faceGeometry(syntheticFace().slice(0, 468), 640, 480)).toBeNull();
    expect(faceGeometry(syntheticFace({ ipd: 4 }), 640, 480)).toBeNull();
  });

  it('uses the documented indices (iris centres 468/473, cheek 234/454, jaw 172/397, lids 159/145, 386/374)', () => {
    expect(FACE_LM).toEqual({
      irisRight: 468, irisLeft: 473, cheekA: 234, cheekB: 454, jawA: 172, jawB: 397,
      lidRightUpper: 159, lidRightLower: 145, lidLeftUpper: 386, lidLeftLower: 374,
    });
    expect(FACE_SCAN_LANDMARKS).toHaveLength(10);
  });
});

describe('poseFromMatrix (R = Ry(yaw)·Rx(pitch)·Rz(roll), column-major data)', () => {
  it.each([0, 9, -9, 11, -11])('yaw %s° / pitch round-trip', (deg) => {
    const y = poseFromMatrix(matrixFromPose(deg, 0));
    expect(y?.yawDeg).toBeCloseTo(deg, 6);
    expect(y?.pitchDeg).toBeCloseTo(0, 6);
    const p = poseFromMatrix(matrixFromPose(0, deg));
    expect(p?.pitchDeg).toBeCloseTo(deg, 6);
    expect(p?.yawDeg).toBeCloseTo(0, 6);
  });

  it('combined yaw, pitch and roll, with a uniform scale in the matrix', () => {
    const r = poseFromMatrix(matrixFromPose(7, -4, 12, 3.5));
    expect(r?.yawDeg).toBeCloseTo(7, 6);
    expect(r?.pitchDeg).toBeCloseTo(-4, 6);
    expect(r?.rollDeg).toBeCloseTo(12, 6);
  });

  it('identity and a translation-only matrix give 0°', () => {
    const m = matrixFromPose(0, 0);
    const data = Array.from(m.data);
    data[12] = 5; // translation x (column-major: column 3)
    data[14] = -60;
    const r = poseFromMatrix({ ...m, data });
    expect(r?.yawDeg).toBeCloseTo(0, 9);
    expect(r?.pitchDeg).toBeCloseTo(0, 9);
  });

  it('missing / malformed matrix → null', () => {
    expect(poseFromMatrix(null)).toBeNull();
    expect(poseFromMatrix({ rows: 4, columns: 4, data: [] })).toBeNull();
    expect(poseFromMatrix({ rows: 4, columns: 4, data: new Array(16).fill(0) })).toBeNull();
  });
});

describe('expressionFromBlendshapes', () => {
  it('jawOpen and smile = max(left, right)', () => {
    const e = expressionFromBlendshapes([
      { categoryName: 'jawOpen', score: 0.07 },
      { categoryName: 'mouthSmileLeft', score: 0.1 },
      { categoryName: 'mouthSmileRight', score: 0.15 },
    ]);
    expect(e).toEqual({ jawOpen: 0.07, smile: 0.15 });
  });
  it('missing categories → null', () => {
    expect(expressionFromBlendshapes(null)).toBeNull();
    expect(expressionFromBlendshapes([{ categoryName: 'mouthSmileLeft', score: 0.1 }])).toBeNull();
  });
});

const F = { cheekWidth: 2, jawWidth: 1.6, eyeAperture: 0.2 };
const frame = (o: { yaw?: number; pitch?: number; jawOpen?: number; smile?: number; features?: FaceFrame['features'] } = {}): FaceFrame => ({
  features: o.features === undefined ? F : o.features,
  pose: { yawDeg: o.yaw ?? 0, pitchDeg: o.pitch ?? 0, rollDeg: 0 },
  expression: { jawOpen: o.jawOpen ?? 0, smile: o.smile ?? 0 },
});

describe('judgeFrame — the four limits of docs/09 §2 (strict)', () => {
  it('limits are the spec numbers', () => {
    expect([FACE_SCAN.captureSec, FACE_SCAN.maxYawDeg, FACE_SCAN.maxPitchDeg, FACE_SCAN.maxJawOpen, FACE_SCAN.maxSmile]).toEqual([3, 10, 10, 0.1, 0.2]);
    expect(FACE_SCAN.sourceId).toBe('SRC_DEMO_QUALITY_SCORES');
  });
  it('yaw 9.9° accepted, 10° rejected (both signs)', () => {
    expect(judgeFrame(frame({ yaw: 9.9 })).accepted).toBe(true);
    expect(judgeFrame(frame({ yaw: -9.9 })).accepted).toBe(true);
    expect(judgeFrame(frame({ yaw: 10 })).reasons).toEqual(['pose']);
    expect(judgeFrame(frame({ yaw: -10 })).accepted).toBe(false);
  });
  it('pitch 9.9° accepted, 10° rejected', () => {
    expect(judgeFrame(frame({ pitch: 9.9 })).accepted).toBe(true);
    expect(judgeFrame(frame({ pitch: -10 })).reasons).toEqual(['pose']);
  });
  it('jawOpen 0.09 accepted, 0.10 rejected', () => {
    expect(judgeFrame(frame({ jawOpen: 0.09 })).accepted).toBe(true);
    expect(judgeFrame(frame({ jawOpen: 0.1 })).reasons).toEqual(['expression']);
  });
  it('smile 0.19 accepted, 0.20 rejected', () => {
    expect(judgeFrame(frame({ smile: 0.19 })).accepted).toBe(true);
    expect(judgeFrame(frame({ smile: 0.2 })).reasons).toEqual(['expression']);
  });
  it('no face / no pose / no blendshapes → rejected', () => {
    expect(judgeFrame(frame({ features: null })).reasons).toEqual(['noface']);
    expect(judgeFrame({ features: F, pose: null, expression: { jawOpen: 0, smile: 0 } }).reasons).toEqual(['pose']);
    expect(judgeFrame({ features: F, pose: { yawDeg: 0, pitchDeg: 0, rollDeg: 0 }, expression: null }).reasons).toEqual(['expression']);
  });
});

describe('aggregation', () => {
  it('median of odd / even / empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it('relative spread = MAD / median', () => {
    expect(relativeSpread([1, 1, 1])).toBe(0);
    expect(relativeSpread([1, 1.1, 0.9, 1, 1])).toBeCloseTo(0, 9);
    expect(relativeSpread([0.9, 1, 1.1])).toBeCloseTo(0.1, 9);
  });
  it('features = median over accepted frames only (rejected outliers ignored)', () => {
    const frames = [
      ...[1.9, 2.0, 2.1, 2.0, 2.0].map((c) => frame({ features: { cheekWidth: c, jawWidth: 1.6, eyeAperture: 0.2 } })),
      frame({ yaw: 30, features: { cheekWidth: 9, jawWidth: 9, eyeAperture: 9 } }),
      frame({ features: null }),
    ];
    const s = summarizeScan(frames);
    expect(s.features).toEqual({ cheekWidth: 2.0, jawWidth: 1.6, eyeAperture: 0.2 });
    expect(s.acceptedFrames).toBe(5);
    expect(s.totalFrames).toBe(7);
    expect(s.rejected).toEqual({ noface: 1, pose: 1, expression: 0 });
  });
  it('no accepted frame → features null, poor', () => {
    const s = summarizeScan([frame({ features: null }), frame({ features: null })]);
    expect(s.features).toBeNull();
    expect(s.quality.label).toBe('poor');
    expect(s.quality.reasons).toEqual(['no face found', 'too few steady frames']);
  });
});

describe('quality labels (demo parameters)', () => {
  const none = { noface: 0, pose: 0, expression: 0 };
  it('good: ≥ 70 % accepted, spread ≤ 0.02', () => {
    expect(qualityOf(90, 90, none, 0.005)).toEqual({ score: 1, label: 'good', reasons: [] });
    expect(qualityOf(100, 70, { ...none, pose: 30 }, 0.02).label).toBe('good');
  });
  it('fair: ≥ 40 % accepted or spread ≤ 0.04', () => {
    const q = qualityOf(100, 60, { ...none, expression: 40 }, 0.01);
    expect(q.label).toBe('fair');
    expect(q.reasons).toEqual(['mouth open or smiling']);
    expect(qualityOf(90, 90, none, 0.03)).toEqual({ score: 1, label: 'fair', reasons: ['measurements varied between frames'] });
  });
  it('poor: < 40 % accepted, too few frames, or spread > 0.04', () => {
    const q = qualityOf(100, 30, { ...none, pose: 70 }, 0.01);
    expect(q.label).toBe('poor');
    expect(q.reasons).toEqual(['head turned', 'too few steady frames']);
    expect(qualityOf(20, 14, { ...none, noface: 6 }, 0).label).toBe('poor');
    expect(qualityOf(90, 90, none, 0.05).label).toBe('poor');
  });
});

describe('fluidIndex', () => {
  it('index = mean of the two width ratios; eye aperture separate', () => {
    const ref = { cheekWidth: 2, jawWidth: 1.6, eyeAperture: 0.2 };
    const r = fluidIndex({ cheekWidth: 2.06, jawWidth: 1.6 * 1.03, eyeAperture: 0.18 }, ref);
    expect(r.cheekWidthRatio).toBeCloseTo(1.03, 9);
    expect(r.jawWidthRatio).toBeCloseTo(1.03, 9);
    expect(r.index).toBeCloseTo(1.03, 9);
    expect(r.eyeApertureRatio).toBeCloseTo(0.9, 9);
    expect(fluidIndex({ cheekWidth: 2.2, jawWidth: 1.6, eyeAperture: 0.2 }, ref).index).toBeCloseTo(1.05, 9);
  });
  it('percent vs reference', () => {
    expect(percentVsReference(1.034)).toBe(3);
    expect(percentVsReference(1)).toBe(0);
    expect(percentVsReference(0.97)).toBe(-3);
  });
  it('end to end from synthetic landmarks: 3 % wider cheek and jaw → 1.03, same at another distance', () => {
    const ref = faceGeometry(syntheticFace(), 640, 480)?.features;
    const today = faceGeometry(syntheticFace({ cheek: 130 * 1.03, jaw: 103, scale: 0.8 }), 640, 480)?.features;
    expect(fluidIndex(today as FaceFeatures, ref as FaceFeatures).index).toBeCloseTo(1.03, 9);
  });
});
