// Unit tests: ROI geometry from synthetic landmarks (doc 09 §1.2), roll rejection, per-frame ROI statistics.
import { describe, expect, it } from 'vitest';

import { roiStats } from './frameStats';
import { type NormLandmark, MAX_ROLL_DEG, ROI_LANDMARKS, computeRois, rollDegrees } from './roi';

const W = 320;
const H = 240;

/** An upright synthetic face in pixel coordinates (320×240), optionally rolled about its centre. */
function face(rollDeg = 0, dx = 0): NormLandmark[] {
  const px: Record<number, [number, number]> = {
    10: [160, 60],
    152: [160, 200],
    234: [110, 120],
    454: [210, 120],
    168: [160, 100],
    33: [130, 105],
    263: [190, 105],
    61: [140, 165],
    291: [180, 165],
  };
  const a = (rollDeg * Math.PI) / 180;
  const lm: NormLandmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  for (const [k, [x, y]] of Object.entries(px)) {
    const ox = x - 160;
    const oy = y - 130;
    const rx = 160 + dx + ox * Math.cos(a) - oy * Math.sin(a);
    const ry = 130 + ox * Math.sin(a) + oy * Math.cos(a);
    lm[Number(k)] = { x: rx / W, y: ry / H };
  }
  return lm;
}

describe('computeRois', () => {
  it('builds forehead and cheek boxes with the doc 09 formulas', () => {
    const r = computeRois(face(), W, H);
    expect(r.ok).toBe(true);
    // W = 100, F = 40; forehead centre (160, 60 + 0.45·40 = 78), half-width 28, half-height 8.8
    expect(r.forehead).toEqual({ x0: 132, y0: 69, x1: 188, y1: 87 });
    // cheeks: centres mid(33,61) = (135, 135) and mid(263,291) = (185, 135); half-size 9
    expect(r.leftCheek).toEqual({ x0: 126, y0: 126, x1: 144, y1: 144 });
    expect(r.rightCheek).toEqual({ x0: 176, y0: 126, x1: 194, y1: 144 });
    expect(r.faceWidthFrac).toBeCloseTo(100 / 320, 6);
    expect(r.rollDeg).toBeCloseTo(0, 6);
    expect(r.points.map((p) => p.index)).toEqual([...ROI_LANDMARKS]);
  });

  it('reports the centroid in px at 640 width', () => {
    const r = computeRois(face(), W, H);
    const xs = [160, 160, 110, 210, 160, 130, 190, 140, 180];
    expect(r.centroid.x).toBeCloseTo((xs.reduce((a, b) => a + b, 0) / 9) * 2, 6);
  });

  it(`accepts a roll of 10° and rejects a roll above ${MAX_ROLL_DEG}°`, () => {
    const ok = computeRois(face(10), W, H);
    expect(ok.ok).toBe(true);
    expect(ok.rollDeg).toBeCloseTo(10, 6);
    const tilted = computeRois(face(20), W, H);
    expect(tilted.ok).toBe(false);
    expect(tilted.reason).toBe('roll');
    expect(computeRois(face(-20), W, H).reason).toBe('roll');
  });

  it('folds the roll angle for mirrored input', () => {
    expect(rollDegrees({ x: 10, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(0, 6);
  });

  it('clips boxes to the image', () => {
    const r = computeRois(face(0, -150), W, H); // face partly off the left edge
    expect(r.forehead?.x0).toBe(0);
    expect(r.leftCheek).toBeNull();
  });

  it('rejects frames with missing landmarks', () => {
    expect(computeRois([], W, H)).toMatchObject({ ok: false, reason: 'missing-landmarks' });
  });
});

describe('roiStats', () => {
  it('averages only ROI pixels and counts clipped pixels', () => {
    const w = 4;
    const h = 2;
    const data = new Uint8ClampedArray(w * h * 4);
    const set = (x: number, y: number, r: number, g: number, b: number) => data.set([r, g, b, 255], (y * w + x) * 4);
    set(0, 0, 100, 50, 0);
    set(1, 0, 200, 150, 100);
    set(2, 0, 255, 255, 255); // outside ROI
    set(0, 1, 250, 10, 10); // clipped (R ≥ 250)
    set(1, 1, 50, 90, 10);
    const s = roiStats(data, w, [{ x0: 0, y0: 0, x1: 2, y1: 2 }]);
    expect(s).not.toBeNull();
    expect(s?.pixels).toBe(4);
    expect(s?.r).toBeCloseTo(150, 6);
    expect(s?.g).toBeCloseTo(75, 6);
    expect(s?.b).toBeCloseTo(30, 6);
    expect(s?.clip).toBeCloseTo(25, 6);
    expect(s?.lum).toBeCloseTo(0.299 * 150 + 0.587 * 75 + 0.114 * 30, 6);
  });
  it('returns null for empty ROIs', () => {
    expect(roiStats(new Uint8ClampedArray(16), 2, [])).toBeNull();
  });
});
