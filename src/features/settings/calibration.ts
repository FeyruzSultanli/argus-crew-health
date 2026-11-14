// Screen and camera calibration (doc 09 §3.1, FR-SET-1). Pure maths + a per-device localStorage record.
// The user matches an on-screen rectangle to a real ID-1 card (bank card size, 85.60 × 53.98 mm per doc 09 §3.1);
// the card width in CSS pixels gives CSS pixels per millimetre. No source entry exists for the ID-1 size, so the UI
// tags these numbers "Demo parameter" (SRC_DEMO_QUALITY_SCORES). Camera field of view default 65° is a demo
// parameter of the same entry.

export const ID1_CARD_MM = { width: 85.6, height: 53.98 } as const;
export const DEFAULT_CAMERA_FOV_DEG = 65;
export const CALIBRATION_SOURCE_IDS: readonly string[] = ['SRC_DEMO_QUALITY_SCORES'];

/** Slider bounds for the on-screen card width (CSS px). */
export const CARD_PX_RANGE = { min: 200, max: 720 } as const;
/** Slider bounds for the camera field of view (degrees). */
export const FOV_RANGE = { min: 40, max: 120 } as const;

export const CALIBRATION_STORAGE_KEY = 'argus.calibration';

export interface Calibration {
  /** CSS pixels per millimetre on this screen; null = not calibrated. */
  pxPerMm: number | null;
  /** Assumed horizontal field of view of the camera, degrees. */
  cameraFovDeg: number;
}

export const DEFAULT_CALIBRATION: Calibration = { pxPerMm: null, cameraFovDeg: DEFAULT_CAMERA_FOV_DEG };

/** CSS px per mm from the on-screen width (CSS px) that matches the real card. */
export function pxPerMmFromCardWidth(cardWidthPx: number): number {
  if (!Number.isFinite(cardWidthPx) || cardWidthPx <= 0) throw new RangeError('card width must be > 0');
  return cardWidthPx / ID1_CARD_MM.width;
}

/** On-screen card width (CSS px) for a pxPerMm value. */
export function cardWidthPxFromPxPerMm(pxPerMm: number): number {
  return pxPerMm * ID1_CARD_MM.width;
}

/** On-screen card height for a card width, keeping the ID-1 aspect ratio. */
export function cardHeightPx(cardWidthPx: number): number {
  return (cardWidthPx * ID1_CARD_MM.height) / ID1_CARD_MM.width;
}

/** Physical length (mm) → CSS px on this screen. */
export function mmToPx(mm: number, pxPerMm: number): number {
  return mm * pxPerMm;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Validates an unknown stored record; anything malformed falls back to the defaults. */
export function parseCalibration(raw: unknown): Calibration {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_CALIBRATION;
  const o = raw as Record<string, unknown>;
  const px = typeof o.pxPerMm === 'number' && Number.isFinite(o.pxPerMm) && o.pxPerMm > 0 ? o.pxPerMm : null;
  const fov =
    typeof o.cameraFovDeg === 'number' && Number.isFinite(o.cameraFovDeg)
      ? clamp(o.cameraFovDeg, FOV_RANGE.min, FOV_RANGE.max)
      : DEFAULT_CAMERA_FOV_DEG;
  return { pxPerMm: px, cameraFovDeg: fov };
}

export function loadCalibration(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Calibration {
  try {
    const text = storage?.getItem(CALIBRATION_STORAGE_KEY);
    return text ? parseCalibration(JSON.parse(text)) : DEFAULT_CALIBRATION;
  } catch {
    return DEFAULT_CALIBRATION;
  }
}

export function saveCalibration(
  c: Calibration,
  storage: Pick<Storage, 'setItem'> | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(c));
  } catch {
    // private mode / blocked storage: calibration lasts for this page only
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
