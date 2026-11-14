// Parsing of the NASA OSDR Inspiration4 lab files into pre-flight anchors (doc 12 §2 step 2, doc 06 §6).
// Input: the long-format "*.upload_SUBMITTED.csv" files (one row per analyte, with RANGE_MIN / RANGE_MAX,
// SUBJECT_ID, SEX and the time point). Pure functions — the network part lives in scripts/fetch-data.ts.
import { parseCsv } from './csv';

export type Sex = 'male' | 'female';
export type Range = [min: number, max: number];

export interface AnchorRanges {
  hematocrit: Range;
  wbc: Range;
  hemoglobin?: Range;
  lymphocytes?: Range;
  lymphocytesAbsolute?: Range;
  glucose?: Range;
}

export interface PreflightAnchor {
  subject: string;
  timepoint: string;          // "L-92" | "L-44" | "L-3"
  missionDay: number;         // L-92 → -92 (doc 06 mission clock: L-30 → -30)
  hematocrit: number;         // %
  wbc: number;                // 10*3/uL
  hemoglobin?: number;        // g/dL
  lymphocytes?: number;       // % of WBC
  lymphocytesAbsolute?: number; // cells/uL
  glucose?: number;           // mg/dL (OSD-575 CMP)
  ranges: AnchorRanges;       // lab reference ranges exactly as printed for this subject and time point
}

export interface SubjectInfo {
  subject: string;
  sex: Sex;                                   // from the file's SEX column
  preflightHematocritRangeSex: Sex | 'mixed'; // which sex-specific range the lab printed pre-flight
  allTimepointsHematocritRangeSex: { male: number; female: number };
  rangeConsistent: boolean;                   // pre-flight printed range matches the SEX column
}

export interface AnchorFile {
  _note: string;
  label: string;
  sourceIds: string[];
  downloadedAt: string;
  files: { cbc: string; cmp: string };
  glucosePresent: boolean;
  glucoseNote: string;
  units: Record<string, string>;
  rangesBySex: { hematocrit: Record<Sex, Range>; hemoglobin?: Record<Sex, Range> };
  subjects: SubjectInfo[];
  crewMapping: Array<{ crewId: string; crewSex: Sex; subject: string }>;
  anchors: PreflightAnchor[];
}

interface LabRow {
  analyte: string;
  value: number;
  range: Range | null;
  units: string;
  subject: string;
  sex: string;
  timepoint: string;
}

export function parseLabCsv(text: string): LabRow[] {
  return parseCsv(text).map((r) => {
    const value = Number(r.VALUE);
    const min = r.RANGE_MIN === '' || r.RANGE_MIN === undefined ? NaN : Number(r.RANGE_MIN);
    const max = r.RANGE_MAX === '' || r.RANGE_MAX === undefined ? NaN : Number(r.RANGE_MAX);
    const timepoint = r.TEST_DATE ?? r.timepoint ?? r.TIMEPOINT ?? '';
    if (!r.ANALYTE || !r.SUBJECT_ID || !timepoint) {
      throw new Error(`OSDR CSV: unexpected row shape ${JSON.stringify(r)}`);
    }
    return {
      analyte: r.ANALYTE,
      value,
      range: Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null,
      units: r.UNITS ?? '',
      subject: r.SUBJECT_ID,
      sex: r.SEX ?? '',
      timepoint,
    };
  });
}

/** "L-92" → -92; anything that is not a launch-minus time point → null. */
export function preflightDay(timepoint: string): number | null {
  const m = /^L-(\d+)$/.exec(timepoint.trim());
  return m ? -Number(m[1]) : null;
}

const base = (analyte: string): string => analyte.replace(/\s*\((FE)?MALE\)\s*$/i, '').trim().toUpperCase();

const ANALYTES = {
  hematocrit: 'HEMATOCRIT',
  wbc: 'WHITE BLOOD CELL COUNT',
  hemoglobin: 'HEMOGLOBIN',
  lymphocytes: 'LYMPHOCYTES',
  lymphocytesAbsolute: 'ABSOLUTE LYMPHOCYTES',
  glucose: 'GLUCOSE',
} as const;

const rangeKey = (r: Range): string => `${r[0]}-${r[1]}`;

/**
 * Detects which printed range is the female and which the male one for an analyte. A range used by a row whose
 * analyte name carries "(FEMALE)", or used only by rows with SEX = F, is the female range; the other one is male.
 */
export function detectSexRanges(rows: LabRow[], analyte: string): Record<Sex, Range> {
  const byRange = new Map<string, { range: Range; sexes: Set<string>; femaleTagged: boolean }>();
  for (const r of rows) {
    if (base(r.analyte) !== analyte || !r.range) continue;
    const k = rangeKey(r.range);
    const e = byRange.get(k) ?? { range: r.range, sexes: new Set<string>(), femaleTagged: false };
    e.sexes.add(r.sex.toUpperCase());
    if (/\(FEMALE\)/i.test(r.analyte)) e.femaleTagged = true;
    byRange.set(k, e);
  }
  const entries = [...byRange.values()];
  if (entries.length !== 2) {
    throw new Error(`OSDR CSV: expected 2 sex-specific ${analyte} ranges, found ${entries.length}`);
  }
  const female =
    entries.find((e) => e.femaleTagged) ?? entries.find((e) => e.sexes.size === 1 && e.sexes.has('F'));
  const male = entries.find((e) => e !== female);
  if (!female || !male) throw new Error(`OSDR CSV: cannot tell the female ${analyte} range from the male one`);
  return { female: female.range, male: male.range };
}

function sexOfColumn(subject: string, rows: LabRow[]): Sex {
  const sexes = new Set(rows.filter((r) => r.subject === subject).map((r) => r.sex.toUpperCase()));
  if (sexes.size !== 1) throw new Error(`OSDR CSV: subject ${subject} has SEX values ${[...sexes].join(',')}`);
  const s = [...sexes][0];
  if (s === 'M') return 'male';
  if (s === 'F') return 'female';
  throw new Error(`OSDR CSV: subject ${subject} has unknown SEX "${s}"`);
}

function rangeSex(range: Range | null, ranges: Record<Sex, Range>): Sex | null {
  if (!range) return null;
  if (rangeKey(range) === rangeKey(ranges.male)) return 'male';
  if (rangeKey(range) === rangeKey(ranges.female)) return 'female';
  return null;
}

export function buildAnchors(
  cbcText: string,
  cmpText: string | null,
): { anchors: PreflightAnchor[]; subjects: SubjectInfo[]; rangesBySex: AnchorFile['rangesBySex']; glucosePresent: boolean } {
  const cbc = parseLabCsv(cbcText);
  const cmp = cmpText ? parseLabCsv(cmpText) : [];
  const hctRanges = detectSexRanges(cbc, ANALYTES.hematocrit);
  let hbRanges: Record<Sex, Range> | undefined;
  try {
    hbRanges = detectSexRanges(cbc, ANALYTES.hemoglobin);
  } catch {
    hbRanges = undefined;
  }
  const glucosePresent = cmp.some((r) => base(r.analyte) === ANALYTES.glucose);

  const subjectIds = [...new Set(cbc.map((r) => r.subject))].sort();
  const subjects: SubjectInfo[] = [];
  const anchors: PreflightAnchor[] = [];

  for (const subject of subjectIds) {
    const sex = sexOfColumn(subject, cbc);
    const hctRows = cbc.filter((r) => r.subject === subject && base(r.analyte) === ANALYTES.hematocrit);
    const all = { male: 0, female: 0 };
    for (const r of hctRows) {
      const s = rangeSex(r.range, hctRanges);
      if (s) all[s]++;
    }
    const preSexes = new Set(
      hctRows.filter((r) => preflightDay(r.timepoint) !== null).map((r) => rangeSex(r.range, hctRanges)),
    );
    const preflightHematocritRangeSex: Sex | 'mixed' =
      preSexes.size === 1 && (preSexes.has('male') || preSexes.has('female')) ? ([...preSexes][0] as Sex) : 'mixed';
    subjects.push({
      subject,
      sex,
      preflightHematocritRangeSex,
      allTimepointsHematocritRangeSex: all,
      rangeConsistent: preflightHematocritRangeSex === sex,
    });

    const timepoints = [...new Set(cbc.filter((r) => r.subject === subject).map((r) => r.timepoint))]
      .filter((tp) => preflightDay(tp) !== null)
      .sort((a, b) => (preflightDay(a) ?? 0) - (preflightDay(b) ?? 0));

    for (const tp of timepoints) {
      const pick = (rows: LabRow[], analyte: string): LabRow | undefined =>
        rows.find((r) => r.subject === subject && r.timepoint === tp && base(r.analyte) === analyte);
      const hct = pick(cbc, ANALYTES.hematocrit);
      const wbc = pick(cbc, ANALYTES.wbc);
      if (!hct?.range || !wbc?.range || !Number.isFinite(hct.value) || !Number.isFinite(wbc.value)) {
        throw new Error(`OSDR CSV: ${subject} ${tp} lacks hematocrit or WBC with a range`);
      }
      const hb = pick(cbc, ANALYTES.hemoglobin);
      const ly = pick(cbc, ANALYTES.lymphocytes);
      const lyAbs = pick(cbc, ANALYTES.lymphocytesAbsolute);
      const glu = pick(cmp, ANALYTES.glucose);
      const ranges: AnchorRanges = { hematocrit: hct.range, wbc: wbc.range };
      if (hb?.range) ranges.hemoglobin = hb.range;
      if (ly?.range) ranges.lymphocytes = ly.range;
      if (lyAbs?.range) ranges.lymphocytesAbsolute = lyAbs.range;
      if (glu?.range) ranges.glucose = glu.range;
      const anchor: PreflightAnchor = {
        subject,
        timepoint: tp,
        missionDay: preflightDay(tp) ?? 0,
        hematocrit: hct.value,
        wbc: wbc.value,
        ranges,
      };
      if (hb && Number.isFinite(hb.value)) anchor.hemoglobin = hb.value;
      if (ly && Number.isFinite(ly.value)) anchor.lymphocytes = ly.value;
      if (lyAbs && Number.isFinite(lyAbs.value)) anchor.lymphocytesAbsolute = lyAbs.value;
      if (glu && Number.isFinite(glu.value)) anchor.glucose = glu.value;
      anchors.push(anchor);
    }
  }

  const rangesBySex: AnchorFile['rangesBySex'] = { hematocrit: hctRanges };
  if (hbRanges) rangesBySex.hemoglobin = hbRanges;
  return { anchors, subjects, rangesBySex, glucosePresent };
}

/**
 * Maps OSDR subjects to crew by sex (doc 06 §6). Keeps a crew member's current subject when its sex matches and it
 * is not taken yet; otherwise assigns the first free subject of the right sex. Throws when that is impossible.
 */
export function mapSubjectsToCrew(
  crew: Array<{ id: string; sex: Sex; osdrSubject?: string }>,
  subjects: Array<{ subject: string; sex: Sex }>,
): Array<{ crewId: string; crewSex: Sex; subject: string; changed: boolean }> {
  const taken = new Set<string>();
  const result = new Map<string, string>();
  for (const c of crew) {
    const cur = subjects.find((s) => s.subject === c.osdrSubject);
    if (cur && cur.sex === c.sex && !taken.has(cur.subject)) {
      result.set(c.id, cur.subject);
      taken.add(cur.subject);
    }
  }
  for (const c of crew) {
    if (result.has(c.id)) continue;
    const free = subjects.find((s) => s.sex === c.sex && !taken.has(s.subject));
    if (!free) throw new Error(`No free ${c.sex} OSDR subject left for crew ${c.id}`);
    result.set(c.id, free.subject);
    taken.add(free.subject);
  }
  return crew.map((c) => {
    const subject = result.get(c.id) ?? '';
    return { crewId: c.id, crewSex: c.sex, subject, changed: subject !== c.osdrSubject };
  });
}
