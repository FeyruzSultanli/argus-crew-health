// Reference scan of the face fluid-shift index, per subject, on this device.
// No pre-flight scan exists in this demo, so the first accepted scan of a subject becomes their reference. Stored in
// localStorage under `argus.faceReference` as NUMBERS ONLY: the three normalised features, the mission day, the
// quality and the id of the saved reference observation. No image, no frame data.
//
// "Reset demo" wipes the observations but not localStorage; a reference whose observation no longer exists in the
// health record is treated as absent (isReferenceValid), so Reset demo also resets the reference without a hook.
import type { FaceFeatures } from '../../../measurement/face/geometry';

export const REFERENCE_KEY = 'argus.faceReference';

export interface FaceReference {
  crewId: string;
  features: FaceFeatures;
  missionDay: number;
  quality: { label: 'good' | 'fair' | 'poor'; score: number };
  /** The face_fluid_index observation (value 1.00) saved for this reference scan. */
  observationId: string;
  savedAt: string;
}

type Stored = Record<string, FaceReference>;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parse(raw: string | null): Stored {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return {};
    const out: Stored = {};
    for (const [k, r] of Object.entries(v as Record<string, Partial<FaceReference>>)) {
      const f = r?.features;
      if (f && isNum(f.cheekWidth) && isNum(f.jawWidth) && isNum(f.eyeAperture) && typeof r.observationId === 'string') {
        out[k] = r as FaceReference;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function readAll(): Stored {
  try {
    return parse(window.localStorage.getItem(REFERENCE_KEY));
  } catch {
    return {};
  }
}

function writeAll(all: Stored): void {
  try {
    if (Object.keys(all).length === 0) window.localStorage.removeItem(REFERENCE_KEY);
    else window.localStorage.setItem(REFERENCE_KEY, JSON.stringify(all));
  } catch {
    // storage blocked (private mode): the reference lasts for this page only
  }
}

export function loadReference(crewId: string): FaceReference | null {
  return readAll()[crewId] ?? null;
}

export function saveReference(ref: FaceReference): void {
  const all = readAll();
  all[ref.crewId] = {
    crewId: ref.crewId,
    features: { cheekWidth: ref.features.cheekWidth, jawWidth: ref.features.jawWidth, eyeAperture: ref.features.eyeAperture },
    missionDay: ref.missionDay,
    quality: { label: ref.quality.label, score: ref.quality.score },
    observationId: ref.observationId,
    savedAt: ref.savedAt,
  };
  writeAll(all);
}

export function clearReference(crewId: string): void {
  const all = readAll();
  delete all[crewId];
  writeAll(all);
}

/** The reference counts only while its observation is still in the health record (cleared by Reset demo). */
export function isReferenceValid(ref: FaceReference | null, recordIds: ReadonlySet<string>): ref is FaceReference {
  return ref !== null && recordIds.has(ref.observationId);
}
