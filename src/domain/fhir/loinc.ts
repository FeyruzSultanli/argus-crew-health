// Code table for the FHIR export (doc 06 §3 "LOINC (verify)" column, doc 06 §5). Pure TypeScript.
//
// LOINC codes are the ones doc 06 §3 lists, with the display names as written there. `loincVerified`: doc 06 §3
// asks for each code to be confirmed before release; the 11 codes of that table matched the NLM LOINC API
// (docs/DECISIONS.md, decision 14), so every LOINC code of that table is marked verified with that reference
// (LOINC_VERIFICATION). Signals without a LOINC code in doc 06 §3 use the local system https://argus.local/codes and
// the local code from that table; where the table says only "local" (cabin_temp, cabin_humidity) or has no row
// (symptoms), the local code here is our own name.
import { CANONICAL_UNIT } from '../units';
import type { SignalId } from '../types';

export const LOINC_SYSTEM = 'http://loinc.org';
export const LOCAL_CODE_SYSTEM = 'https://argus.local/codes';
export const UCUM_SYSTEM = 'http://unitsofmeasure.org';

/** Where the `loincVerified: true` flags come from. */
export const LOINC_VERIFICATION = 'Checked against the NLM LOINC API on 14 Nov 2026 (docs/DECISIONS.md, decision 14)';

export interface CodeEntry {
  system: typeof LOINC_SYSTEM | typeof LOCAL_CODE_SYSTEM;
  code: string;
  display: string;
  /** LOINC codes only: confirmed against loinc.org (see LOINC_VERIFICATION). */
  loincVerified?: boolean;
}

export interface ComponentCoding {
  code: CodeEntry;
  /** UCUM unit of the component value. */
  ucum: string;
}

export interface SignalCoding {
  code: CodeEntry;
  /** UCUM canonical unit of the primary value (doc 06 §3). */
  ucum: string;
  /** Known component keys (Observation.components) and their coding. */
  components?: Record<string, ComponentCoding>;
}

const loinc = (code: string, display: string): CodeEntry => ({
  system: LOINC_SYSTEM,
  code,
  display,
  loincVerified: true,
});
const local = (code: string, display: string): CodeEntry => ({ system: LOCAL_CODE_SYSTEM, code, display });
const count = (code: string, display: string): ComponentCoding => ({ code: local(code, display), ucum: '{count}' });

const SYMPTOM_KEYS = [
  'headache',
  'congestion',
  'nausea',
  'rash',
  'back_pain',
  'vision_change',
  'insomnia',
  'low_mood',
  'fatigue',
] as const;

/** doc 06 §3, row by row. */
export const SIGNAL_CODES: Record<SignalId, SignalCoding> = {
  heart_rate_rest: { code: loinc('8867-4', 'Heart rate'), ucum: CANONICAL_UNIT.heart_rate_rest },
  blood_pressure: {
    code: loinc('85354-9', 'Blood pressure panel'),
    ucum: CANONICAL_UNIT.blood_pressure,
    components: {
      systolic: { code: loinc('8480-6', 'Systolic blood pressure'), ucum: 'mm[Hg]' },
      diastolic: { code: loinc('8462-4', 'Diastolic blood pressure'), ucum: 'mm[Hg]' },
    },
  },
  spo2: { code: loinc('59408-5', 'SpO2 by pulse oximetry'), ucum: CANONICAL_UNIT.spo2 },
  body_temp: { code: loinc('8310-5', 'Body temperature'), ucum: CANONICAL_UNIT.body_temp },
  glucose: { code: loinc('2339-0', 'Glucose [Mass/volume] in Blood'), ucum: CANONICAL_UNIT.glucose },
  sleep_duration: { code: loinc('93832-4', 'Sleep duration'), ucum: CANONICAL_UNIT.sleep_duration },
  mood: { code: local('argus-mood', 'Mood (1–5)'), ucum: CANONICAL_UNIT.mood },
  body_mass: { code: loinc('29463-7', 'Body weight'), ucum: CANONICAL_UNIT.body_mass },
  reaction_test: {
    code: local('argus-pvt', 'Reaction Self-Test mean response speed'),
    ucum: CANONICAL_UNIT.reaction_test,
    components: {
      medianRtMs: { code: local('argus-pvt-median-rt', 'Median reaction time'), ucum: 'ms' },
      lapses: count('argus-pvt-lapses', 'Lapses'),
      falseStarts: count('argus-pvt-false-starts', 'False starts'),
      nStimuli: count('argus-pvt-stimuli', 'Number of stimuli'),
    },
  },
  amsler: {
    code: local('argus-amsler', 'Amsler grid marked cells'),
    ucum: CANONICAL_UNIT.amsler,
    components: {
      peripheralCells: { code: local('argus-amsler-peripheral', 'Peripheral marked cells'), ucum: '{areas}' },
      centralCells: { code: local('argus-amsler-central', 'Central marked cells'), ucum: '{areas}' },
    },
  },
  near_acuity: { code: local('argus-acuity', 'Near visual acuity'), ucum: CANONICAL_UNIT.near_acuity },
  face_fluid_index: { code: local('argus-face', 'Face fluid index'), ucum: CANONICAL_UNIT.face_fluid_index },
  hydration: { code: local('argus-water', 'Water intake'), ucum: CANONICAL_UNIT.hydration },
  exercise_minutes: { code: local('argus-exercise', 'Exercise minutes'), ucum: CANONICAL_UNIT.exercise_minutes },
  hematocrit: { code: loinc('4544-3', 'Hematocrit'), ucum: CANONICAL_UNIT.hematocrit },
  wbc: { code: loinc('6690-2', 'Leukocytes'), ucum: CANONICAL_UNIT.wbc },
  symptoms: {
    code: local('argus-symptoms', 'Symptom checklist'),
    ucum: CANONICAL_UNIT.symptoms,
    components: Object.fromEntries(
      SYMPTOM_KEYS.map((k) => [k, { code: local(`argus-symptom-${k.replace(/_/g, '-')}`, k), ucum: '1' }]),
    ),
  },
  cabin_co2: {
    code: local('argus-ppco2', 'Cabin CO2 partial pressure'),
    ucum: CANONICAL_UNIT.cabin_co2,
    components: { avg7d: { code: local('argus-ppco2-avg7d', 'Cabin CO2 7-day mean'), ucum: 'mm[Hg]' } },
  },
  cabin_temp: { code: local('argus-cabin-temp', 'Cabin temperature'), ucum: CANONICAL_UNIT.cabin_temp },
  cabin_humidity: { code: local('argus-cabin-humidity', 'Cabin relative humidity'), ucum: CANONICAL_UNIT.cabin_humidity },
  radiation_dose: { code: local('argus-dose', 'Radiation dose (modeled)'), ucum: CANONICAL_UNIT.radiation_dose },
};

/** Coding of one component; unknown keys get a local code `argus-<signal>-<key>` and the observation's unit. */
export function componentCoding(signalId: SignalId, key: string, fallbackUnit: string): ComponentCoding {
  const known = SIGNAL_CODES[signalId].components?.[key];
  if (known) return known;
  const slug = `${signalId}-${key}`.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  return { code: local(`argus-${slug}`, key), ucum: fallbackUnit };
}

/** Signals whose primary code is LOINC (doc 06 §3). */
export const LOINC_MAPPED_SIGNALS: readonly SignalId[] = (Object.keys(SIGNAL_CODES) as SignalId[]).filter(
  (id) => SIGNAL_CODES[id].code.system === LOINC_SYSTEM,
);
