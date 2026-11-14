// Viewing distance (doc 09 §3.1). Pure TypeScript: pinhole camera model and the "closer / farther" hint.
//   f_px = (videoWidth / 2) / tan(HFOV / 2)       HFOV default 65° — demo parameter, user-adjustable (Settings)
//   distance_mm = f_px · IPD_mm / IPD_px          IPD ≈ 63 mm adult average [SRC_IPD_DODGSON]
// Expect about ±15 % error; the hint asks to move until the estimate is within ±10 % of the target [demo].

export const ASSUMED_IPD_MM = 63;
export const IPD_SOURCE_IDS: readonly string[] = ['SRC_IPD_DODGSON'];
/** Hint tolerance around the target distance (fraction). Demo parameter (SRC_DEMO_QUALITY_SCORES). */
export const DISTANCE_TOLERANCE = 0.1;
/** Viewing-distance demo parameters of doc 09 §3 (SRC_DEMO_QUALITY_SCORES). */
export const VISION_DEMO_SOURCE_IDS: readonly string[] = ['SRC_DEMO_QUALITY_SCORES'];

/** Amsler grid: 30–35 cm (each 5-mm square ≈ 1° of visual field); target = the middle of that range. */
export const AMSLER_DISTANCE_MM = { min: 300, max: 350, target: 325 } as const;

/** Iris-centre landmarks of the 478-point MediaPipe Face Landmarker (right eye 468, left eye 473). */
export const IRIS_LANDMARKS = { a: 468, b: 473 } as const;

export function focalLengthPx(videoWidthPx: number, hfovDeg: number): number {
  if (!(videoWidthPx > 0) || !(hfovDeg > 0 && hfovDeg < 180)) throw new RangeError('video width and HFOV must be positive');
  return videoWidthPx / 2 / Math.tan(((hfovDeg / 2) * Math.PI) / 180);
}

export function distanceFromIpdMm(ipdPx: number, focalPx: number, ipdMm: number = ASSUMED_IPD_MM): number | null {
  if (!(ipdPx > 0) || !(focalPx > 0)) return null;
  return (focalPx * ipdMm) / ipdPx;
}

/** Inter-pupil distance in pixels from two normalized landmarks (x, y in 0–1) on a video frame. */
export function ipdPixels(
  a: { x: number; y: number },
  b: { x: number; y: number },
  videoWidth: number,
  videoHeight: number,
): number {
  return Math.hypot((a.x - b.x) * videoWidth, (a.y - b.y) * videoHeight);
}

export type DistanceHint = 'closer' | 'farther' | 'ok';

/** 'closer' when farther than target + 10 %, 'farther' when nearer than target − 10 %, otherwise 'ok'. */
export function distanceHint(distanceMm: number, targetMm: number, tolerance: number = DISTANCE_TOLERANCE): DistanceHint {
  if (distanceMm > targetMm * (1 + tolerance)) return 'closer';
  if (distanceMm < targetMm * (1 - tolerance)) return 'farther';
  return 'ok';
}

export const HINT_TEXT: Record<DistanceHint, string> = {
  closer: 'Move closer',
  farther: 'Move farther away',
  ok: 'Distance is right — hold still',
};
