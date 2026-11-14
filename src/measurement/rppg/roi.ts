// Skin regions of interest from MediaPipe face landmarks — docs/09_MEASUREMENT_LAB.md §1.2 "ROI definition".
// Landmark indices are the usual face-mesh ones; confirm them by eye on the ?debug=rppg overlay:
//   10 top of forehead · 152 chin · 234 / 454 left / right face edge · 168 between the eyes ·
//   33 / 263 outer eye corners · 61 / 291 mouth corners.
// With W = |p454 − p234| and F = |p168 − p10| (pixel space):
//   forehead box: centre p10 + 0.45·(p168 − p10), half-width 0.28·W, half-height 0.22·F
//   cheek boxes:  centres at mid(p33, p61) and mid(p263, p291), half-size 0.09·W each way
// Boxes are axis-aligned, clipped to the image; frames with head roll > 15° are rejected.

export const LM = {
  foreheadTop: 10,
  chin: 152,
  faceLeft: 234,
  faceRight: 454,
  midEyes: 168,
  eyeOuterA: 33,
  eyeOuterB: 263,
  mouthA: 61,
  mouthB: 291,
} as const;

/** The nine landmarks the ROI geometry uses (debug overlay draws exactly these). */
export const ROI_LANDMARKS: readonly number[] = [10, 152, 234, 454, 168, 33, 263, 61, 291];

export const MAX_ROLL_DEG = 15;
/** Motion and distance are expressed in px of a frame scaled to this width (doc 09 §1.3 "px at 640 w"). */
export const REFERENCE_WIDTH_PX = 640;

export interface Pt {
  x: number;
  y: number;
}
/** Normalised landmark as MediaPipe returns it (x, y in 0..1 of image width / height). */
export interface NormLandmark {
  x: number;
  y: number;
  z?: number;
}
/** Integer pixel box, [x0, x1) × [y0, y1). */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface RoiResult {
  ok: boolean;
  reason?: 'missing-landmarks' | 'roll' | 'empty-roi';
  rollDeg: number;
  forehead: Box | null;
  leftCheek: Box | null;
  rightCheek: Box | null;
  /** Face width W as a fraction of the image width (for the distance hint). */
  faceWidthFrac: number;
  /** Centroid of the nine landmarks in px at REFERENCE_WIDTH_PX width. */
  centroid: Pt;
  /** The nine landmarks in pixel space of the target image, keyed by index. */
  points: Array<{ index: number; x: number; y: number }>;
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function clipBox(cx: number, cy: number, hw: number, hh: number, width: number, height: number): Box | null {
  const x0 = Math.max(0, Math.floor(cx - hw));
  const y0 = Math.max(0, Math.floor(cy - hh));
  const x1 = Math.min(width, Math.ceil(cx + hw));
  const y1 = Math.min(height, Math.ceil(cy + hh));
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}

/** Head roll from the outer eye corners, degrees, folded into [−90, 90] (works for mirrored input too). */
export function rollDegrees(eyeA: Pt, eyeB: Pt): number {
  let deg = (Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x) * 180) / Math.PI;
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

/** Compute the three ROI boxes for an image of `width` × `height` px from normalised landmarks. */
export function computeRois(landmarks: ArrayLike<NormLandmark>, width: number, height: number): RoiResult {
  const px = (i: number): Pt | null => {
    const l = landmarks[i];
    return l ? { x: l.x * width, y: l.y * height } : null;
  };
  const pts = ROI_LANDMARKS.map((i) => ({ index: i, p: px(i) }));
  const empty: RoiResult = {
    ok: false,
    reason: 'missing-landmarks',
    rollDeg: 0,
    forehead: null,
    leftCheek: null,
    rightCheek: null,
    faceWidthFrac: 0,
    centroid: { x: 0, y: 0 },
    points: [],
  };
  if (pts.some((q) => q.p === null)) return empty;
  const P = (i: number) => (pts.find((q) => q.index === i) as { p: Pt }).p;
  const points = pts.map((q) => ({ index: q.index, x: (q.p as Pt).x, y: (q.p as Pt).y }));

  const scale = REFERENCE_WIDTH_PX / width;
  let sx = 0;
  let sy = 0;
  for (const q of points) {
    sx += q.x;
    sy += q.y;
  }
  const centroid = { x: (sx / points.length) * scale, y: (sy / points.length) * scale };

  const W = dist(P(LM.faceLeft), P(LM.faceRight));
  const F = dist(P(LM.midEyes), P(LM.foreheadTop));
  const rollDeg = rollDegrees(P(LM.eyeOuterA), P(LM.eyeOuterB));
  const top = P(LM.foreheadTop);
  const between = P(LM.midEyes);
  const fc = { x: top.x + 0.45 * (between.x - top.x), y: top.y + 0.45 * (between.y - top.y) };
  const forehead = clipBox(fc.x, fc.y, 0.28 * W, 0.22 * F, width, height);
  const lc = mid(P(LM.eyeOuterA), P(LM.mouthA));
  const rc = mid(P(LM.eyeOuterB), P(LM.mouthB));
  const leftCheek = clipBox(lc.x, lc.y, 0.09 * W, 0.09 * W, width, height);
  const rightCheek = clipBox(rc.x, rc.y, 0.09 * W, 0.09 * W, width, height);

  const res: RoiResult = {
    ok: true,
    rollDeg,
    forehead,
    leftCheek,
    rightCheek,
    faceWidthFrac: W / width,
    centroid,
    points,
  };
  if (Math.abs(rollDeg) > MAX_ROLL_DEG) return { ...res, ok: false, reason: 'roll' };
  if (!forehead && !leftCheek && !rightCheek) return { ...res, ok: false, reason: 'empty-roi' };
  return res;
}

export function roiBoxes(r: RoiResult): Box[] {
  return [r.forehead, r.leftCheek, r.rightCheek].filter((b): b is Box => b !== null);
}

/** Scale a box from one image size to another (e.g. 320×240 analysis canvas → 640×480 overlay). */
export function scaleBox(b: Box, sx: number, sy: number): Box {
  return { x0: b.x0 * sx, y0: b.y0 * sy, x1: b.x1 * sx, y1: b.y1 * sy };
}
