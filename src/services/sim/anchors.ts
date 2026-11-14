// Real pre-flight blood anchors from NASA OSDR (seed/osdr/preflight-anchors.json, written by scripts/fetch-data.ts)
// [SRC_OSD569] (CBC) and [SRC_OSD575] (CMP glucose). Typed shape + run-time validation.

export type Range = [number, number];

export interface PreflightAnchor {
  subject: string;
  timepoint: string;     // "L-92" | "L-44" | "L-3"
  missionDay: number;    // -92 | -44 | -3
  hematocrit: number;    // %
  wbc: number;           // 10*3/uL
  hemoglobin?: number;
  lymphocytes?: number;
  lymphocytesAbsolute?: number;
  glucose?: number;      // mg/dL
  ranges: { hematocrit: Range; wbc: Range; hemoglobin?: Range; lymphocytes?: Range; lymphocytesAbsolute?: Range; glucose?: Range };
}

export interface AnchorSet {
  label: string;
  glucosePresent: boolean;
  rangesBySex: { hematocrit: { male: Range; female: Range } };
  subjects: Array<{ subject: string; sex: 'male' | 'female'; preflightHematocritRangeSex: string; rangeConsistent: boolean }>;
  crewMapping: Array<{ crewId: string; crewSex: 'male' | 'female'; subject: string }>;
  anchors: PreflightAnchor[];
}

/** Method string on every OSDR anchor observation. */
export const OSDR_METHOD_CBC = 'NASA OSDR OSD-569';
export const OSDR_METHOD_CMP = 'NASA OSDR OSD-575';

const isRange = (x: unknown): x is Range =>
  Array.isArray(x) && x.length === 2 && x.every((n) => typeof n === 'number' && Number.isFinite(n));

export function validateAnchors(json: unknown): AnchorSet {
  const f = json as Partial<AnchorSet> & Record<string, unknown>;
  const err = (m: string): never => {
    throw new Error(`seed/osdr/preflight-anchors.json: ${m}`);
  };
  if (typeof f.label !== 'string') err('label missing');
  if (typeof f.glucosePresent !== 'boolean') err('glucosePresent missing');
  if (!isRange(f.rangesBySex?.hematocrit?.male) || !isRange(f.rangesBySex?.hematocrit?.female)) err('rangesBySex.hematocrit');
  if (!Array.isArray(f.subjects) || !Array.isArray(f.crewMapping) || !Array.isArray(f.anchors)) err('arrays missing');
  for (const a of f.anchors as PreflightAnchor[]) {
    if (typeof a.subject !== 'string' || !/^L-\d+$/.test(a.timepoint)) err(`bad anchor ${JSON.stringify(a)}`);
    if (!Number.isInteger(a.missionDay) || a.missionDay >= 0) err(`anchor ${a.subject} ${a.timepoint}: missionDay`);
    if (typeof a.hematocrit !== 'number' || typeof a.wbc !== 'number') err(`anchor ${a.subject} ${a.timepoint}: values`);
    if (!isRange(a.ranges?.hematocrit) || !isRange(a.ranges?.wbc)) err(`anchor ${a.subject} ${a.timepoint}: ranges`);
    if (a.glucose !== undefined && typeof a.glucose !== 'number') err(`anchor ${a.subject} ${a.timepoint}: glucose`);
  }
  return f as AnchorSet;
}

/** Anchors of one OSDR subject, oldest first. */
export function anchorsOf(set: AnchorSet, subject: string | undefined): PreflightAnchor[] {
  if (!subject) return [];
  return set.anchors.filter((a) => a.subject === subject).sort((a, b) => a.missionDay - b.missionDay);
}
