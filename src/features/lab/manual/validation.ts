// Manual vitals (FR-LAB-1): parsing, unit conversion and validation per docs/06_DATA_MODEL.md §3, and the
// observations saved for each entered signal. Pure TypeScript (no React, no DOM).
//
// Validation ranges reject impossible input; they are not clinical thresholds (doc 06 §3). They are our own
// plausibility choices → labeled "Demo parameter" in the UI [SRC_DEMO_QUALITY_SCORES].
import type { NewObservation, Observation } from '../../../domain/types';
import {
  GLUCOSE_MGDL_PER_MMOLL,
  KG_PER_LB,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  kgToLb,
  lbToKg,
  mgdlToMmoll,
  mmollToMgdl,
  roundTo,
} from '../../../domain/units';
import { SYMPTOM_IDS, type SymptomId } from '../checkin/symptoms';

export const VALIDATION_SOURCE_ID = 'SRC_DEMO_QUALITY_SCORES';

export interface Range {
  lo: number;
  hi: number;
}

/** doc 06 §3 "Valid input range", canonical units. */
export const VALID_RANGES = {
  heartRate: { lo: 25, hi: 220 }, // /min
  systolic: { lo: 60, hi: 260 }, // mm[Hg]
  diastolic: { lo: 30, hi: 160 }, // mm[Hg]
  spo2: { lo: 50, hi: 100 }, // %
  bodyTemp: { lo: 30, hi: 45 }, // Cel
  glucose: { lo: 20, hi: 600 }, // mg/dL
  bodyMass: { lo: 30, hi: 200 }, // kg
  sleepHours: { lo: 0, hi: 16 }, // h
  sleepQuality: { lo: 1, hi: 5 }, // 1–5
  mood: { lo: 1, hi: 5 }, // {score}
} as const satisfies Record<string, Range>;

// ---- unit conversions (doc 06 §3) — the domain helpers (src/domain/units.ts) ----
export const GLUCOSE_MGDL_PER_MMOL = GLUCOSE_MGDL_PER_MMOLL;
export { KG_PER_LB, kgToLb, lbToKg };
export const cToF = celsiusToFahrenheit;
export const fToC = fahrenheitToCelsius;
export const mgdlToMmol = mgdlToMmoll;
export const mmolToMgdl = mmollToMgdl;

export type TempUnit = 'C' | 'F';
export type GlucoseUnit = 'mg/dL' | 'mmol/L';
export type MassUnit = 'kg' | 'lb';
export type GlucoseContext = NonNullable<NonNullable<Observation['context']>['glucose']>;
export const GLUCOSE_CONTEXTS: readonly GlucoseContext[] = ['fasting', 'random', 'post-meal'];
export const POSTURES = ['seated', 'standing', 'lying', 'restrained'] as const;
export type Posture = (typeof POSTURES)[number];

const round = roundTo;

/** Entered value → canonical unit. Converted values are rounded to the storage precision. */
export function toCanonical(field: 'bodyTemp', v: number, unit: TempUnit): number;
export function toCanonical(field: 'glucose', v: number, unit: GlucoseUnit): number;
export function toCanonical(field: 'bodyMass', v: number, unit: MassUnit): number;
export function toCanonical(field: 'bodyTemp' | 'glucose' | 'bodyMass', v: number, unit: string): number {
  if (field === 'bodyTemp') return unit === 'F' ? round(fToC(v), 2) : v;
  if (field === 'glucose') return unit === 'mmol/L' ? round(mmolToMgdl(v), 1) : v;
  return unit === 'lb' ? round(lbToKg(v), 2) : v;
}

/** Convert the text of a field when the user flips its unit toggle (display precision). */
export function convertEntry(text: string, field: 'bodyTemp' | 'glucose' | 'bodyMass', from: string, to: string): string {
  const v = parseNumber(text);
  if (from === to || v === null || Number.isNaN(v)) return text;
  if (field === 'bodyTemp') return (to === 'F' ? cToF(v) : fToC(v)).toFixed(1);
  if (field === 'glucose') return to === 'mmol/L' ? mgdlToMmol(v).toFixed(1) : String(Math.round(mmolToMgdl(v)));
  return (to === 'lb' ? kgToLb(v) : lbToKg(v)).toFixed(1);
}

/** The valid range in the unit the user sees, for hints and messages. */
export function displayRange(field: keyof typeof VALID_RANGES, unit?: string): string {
  const r = VALID_RANGES[field];
  if (field === 'bodyTemp' && unit === 'F') return `${cToF(r.lo).toFixed(1)}–${cToF(r.hi).toFixed(1)} °F`;
  if (field === 'glucose' && unit === 'mmol/L') return `${mgdlToMmol(r.lo).toFixed(1)}–${mgdlToMmol(r.hi).toFixed(1)} mmol/L`;
  if (field === 'bodyMass' && unit === 'lb') return `${kgToLb(r.lo).toFixed(1)}–${kgToLb(r.hi).toFixed(1)} lb`;
  const u: Record<keyof typeof VALID_RANGES, string> = {
    heartRate: 'bpm',
    systolic: 'mmHg',
    diastolic: 'mmHg',
    spo2: '%',
    bodyTemp: '°C',
    glucose: 'mg/dL',
    bodyMass: 'kg',
    sleepHours: 'h',
    sleepQuality: '',
    mood: '',
  };
  return `${r.lo}–${r.hi}${u[field] ? ` ${u[field]}` : ''}`;
}

const NUMBER_RE = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/;

/** '' → null (not entered); not a plain decimal number → NaN. Accepts ',' as decimal separator. */
export function parseNumber(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  if (!NUMBER_RE.test(t)) return Number.NaN;
  return Number(t.replace(',', '.'));
}

export interface ManualDraft {
  systolic: string;
  diastolic: string;
  heartRate: string;
  spo2: string;
  bodyTemp: string;
  tempUnit: TempUnit;
  glucose: string;
  glucoseUnit: GlucoseUnit;
  glucoseContext: GlucoseContext | '';
  bodyMass: string;
  massUnit: MassUnit;
  sleepHours: string;
  sleepQuality: number | null;
  mood: number | null;
  moodNote: string;
  symptoms: SymptomId[];
  symptomsNone: boolean;
  posture: Posture | '';
  minutesSinceExercise: string;
}

export const EMPTY_DRAFT: ManualDraft = {
  systolic: '',
  diastolic: '',
  heartRate: '',
  spo2: '',
  bodyTemp: '',
  tempUnit: 'C',
  glucose: '',
  glucoseUnit: 'mg/dL',
  glucoseContext: '',
  bodyMass: '',
  massUnit: 'kg',
  sleepHours: '',
  sleepQuality: null,
  mood: null,
  moodNote: '',
  symptoms: [],
  symptomsNone: false,
  posture: '',
  minutesSinceExercise: '',
};

export type ErrorKey =
  | keyof Pick<ManualDraft, 'systolic' | 'diastolic' | 'heartRate' | 'spo2' | 'bodyTemp' | 'glucose' | 'glucoseContext' | 'bodyMass'>
  | keyof Pick<ManualDraft, 'sleepHours' | 'sleepQuality' | 'mood' | 'moodNote' | 'minutesSinceExercise'>
  | 'bloodPressure'
  | 'form';
export type FieldErrors = Partial<Record<ErrorKey, string>>;

export const FIELD_LABELS: Record<Exclude<ErrorKey, 'form'>, string> = {
  systolic: 'Systolic',
  diastolic: 'Diastolic',
  bloodPressure: 'Blood pressure',
  heartRate: 'Heart rate',
  spo2: 'SpO₂',
  bodyTemp: 'Temperature',
  glucose: 'Glucose',
  glucoseContext: 'Glucose context',
  bodyMass: 'Body mass',
  sleepHours: 'Sleep',
  sleepQuality: 'Sleep quality',
  mood: 'Mood',
  moodNote: 'Mood note',
  minutesSinceExercise: 'Time since exercise',
};

export interface ValidationResult {
  ok: boolean;
  errors: FieldErrors;
  /** One observation per entered signal (empty when there are errors). */
  observations: NewObservation[];
}

type RangedField = keyof typeof VALID_RANGES;

/** Parse + range-check one field; returns the canonical value, null if empty, or records an error. */
function checkField(errors: FieldErrors, key: RangedField & ErrorKey, text: string, toCanon: (v: number) => number = (v) => v, unit?: string): number | null {
  const v = parseNumber(text);
  if (v === null) return null;
  if (Number.isNaN(v)) {
    errors[key] = `${FIELD_LABELS[key]}: enter a number.`;
    return null;
  }
  const c = toCanon(v);
  const r = VALID_RANGES[key];
  if (c < r.lo || c > r.hi) {
    errors[key] = `${FIELD_LABELS[key]} must be between ${displayRange(key, unit)}.`;
    return null;
  }
  return c;
}

export interface Subject {
  crewId: string;
  missionDay: number;
}

const MANUAL_SOURCE: NewObservation['source'] = { kind: 'manual', method: 'manual entry', label: 'MEASURED' };
const GOOD: NewObservation['quality'] = { score: 1, label: 'good', reasons: [] };

export function validateManualDraft(d: ManualDraft, subject: Subject): ValidationResult {
  const errors: FieldErrors = {};
  const sys = checkField(errors, 'systolic', d.systolic);
  const dia = checkField(errors, 'diastolic', d.diastolic);
  const hasSys = d.systolic.trim() !== '';
  const hasDia = d.diastolic.trim() !== '';
  if (hasSys !== hasDia) errors.bloodPressure = 'Blood pressure: enter both systolic and diastolic.';
  else if (sys !== null && dia !== null && sys <= dia) {
    errors.bloodPressure = `Systolic (${sys}) must be higher than diastolic (${dia}). Check the order of the two numbers.`;
  }
  const hr = checkField(errors, 'heartRate', d.heartRate);
  const spo2 = checkField(errors, 'spo2', d.spo2);
  const temp = checkField(errors, 'bodyTemp', d.bodyTemp, (v) => toCanonical('bodyTemp', v, d.tempUnit), d.tempUnit);
  const glu = checkField(errors, 'glucose', d.glucose, (v) => toCanonical('glucose', v, d.glucoseUnit), d.glucoseUnit);
  if (d.glucose.trim() !== '' && d.glucoseContext === '') errors.glucoseContext = 'Glucose: choose fasting, random or post-meal.';
  const mass = checkField(errors, 'bodyMass', d.bodyMass, (v) => toCanonical('bodyMass', v, d.massUnit), d.massUnit);
  const sleep = checkField(errors, 'sleepHours', d.sleepHours);
  if (d.sleepQuality !== null && d.sleepHours.trim() === '') errors.sleepQuality = 'Sleep quality: also enter the hours slept.';
  if (d.sleepQuality !== null && !(Number.isInteger(d.sleepQuality) && d.sleepQuality >= 1 && d.sleepQuality <= 5)) {
    errors.sleepQuality = 'Sleep quality must be 1–5.';
  }
  if (d.mood !== null && !(Number.isInteger(d.mood) && d.mood >= 1 && d.mood <= 5)) errors.mood = 'Mood must be 1–5.';
  if (d.mood === null && d.moodNote.trim() !== '') errors.moodNote = 'Mood note: also pick a mood face.';
  const ex = parseNumber(d.minutesSinceExercise);
  if (ex !== null && (Number.isNaN(ex) || ex < 0)) errors.minutesSinceExercise = 'Time since exercise: enter minutes (0 or more).';

  const anySymptoms = d.symptoms.length > 0 || d.symptomsNone;
  const anyValue = [sys, dia, hr, spo2, temp, glu, mass, sleep].some((v) => v !== null) || d.mood !== null || anySymptoms;
  if (!anyValue && Object.keys(errors).length === 0) errors.form = 'Enter at least one value to save.';
  if (Object.keys(errors).length > 0) return { ok: false, errors, observations: [] };

  // Context for the vital signs (doc 09 §5). Time since exercise has no Observation field yet → kept in `note`.
  const vitalContext = d.posture ? { context: { posture: d.posture } } : {};
  const exerciseNote = ex !== null ? { note: `Time since exercise: ${ex} min` } : {};
  const base = { crewId: subject.crewId, missionDay: subject.missionDay, source: MANUAL_SOURCE, quality: GOOD };
  const out: NewObservation[] = [];
  if (sys !== null && dia !== null) {
    out.push({ ...base, signalId: 'blood_pressure', value: null, unit: 'mm[Hg]', components: { systolic: sys, diastolic: dia }, ...vitalContext, ...exerciseNote });
  }
  if (hr !== null) out.push({ ...base, signalId: 'heart_rate_rest', value: hr, unit: '/min', ...vitalContext, ...exerciseNote });
  if (spo2 !== null) out.push({ ...base, signalId: 'spo2', value: spo2, unit: '%', ...vitalContext });
  if (temp !== null) out.push({ ...base, signalId: 'body_temp', value: temp, unit: 'Cel', ...exerciseNote });
  if (glu !== null) out.push({ ...base, signalId: 'glucose', value: glu, unit: 'mg/dL', context: { glucose: d.glucoseContext as GlucoseContext } });
  if (mass !== null) out.push({ ...base, signalId: 'body_mass', value: mass, unit: 'kg' });
  if (sleep !== null) {
    out.push({ ...base, signalId: 'sleep_duration', value: sleep, unit: 'h', ...(d.sleepQuality !== null ? { components: { quality: d.sleepQuality } } : {}) });
  }
  if (d.mood !== null) {
    // The note is stored and shown to the CMO only — never analysed (doc 07 §4.7).
    const note = d.moodNote.trim();
    out.push({ ...base, signalId: 'mood', value: d.mood, unit: '{score}', ...(note ? { note } : {}) });
  }
  if (anySymptoms) {
    const components = Object.fromEntries(SYMPTOM_IDS.map((id) => [id, d.symptoms.includes(id) ? 1 : 0])) as Record<SymptomId, number>;
    out.push({ ...base, signalId: 'symptoms', value: null, unit: '1', components });
  }
  return { ok: true, errors: {}, observations: out };
}
