// Input validation for addObservation (doc 06 §3): canonical UCUM unit and the "valid input range" column, which
// rejects impossible input. These are not clinical thresholds and are never shown as such.
import { SYMPTOM_KEYS } from '../domain/signals/symptoms';
import type { NewObservation, SignalId } from '../domain/types';

interface Spec {
  unit: string;
  range?: [number, number];
  /** value must be null and these components present (blood pressure, symptoms). */
  components?: Record<string, [number, number]>;
  nullValue?: boolean;
  /** Checklist (symptoms): every component is a 0/1 flag whose key is in this list; a missing key counts as 0. */
  flags?: readonly string[];
}

export const OBSERVATION_SPECS: Record<SignalId, Spec> = {
  heart_rate_rest: { unit: '/min', range: [25, 220] },
  blood_pressure: { unit: 'mm[Hg]', nullValue: true, components: { systolic: [60, 260], diastolic: [30, 160] } },
  spo2: { unit: '%', range: [50, 100] },
  body_temp: { unit: 'Cel', range: [30, 45] },
  glucose: { unit: 'mg/dL', range: [20, 600] },
  sleep_duration: { unit: 'h', range: [0, 16] },
  mood: { unit: '{score}', range: [1, 5] },
  body_mass: { unit: 'kg', range: [30, 200] },
  reaction_test: { unit: '/s', range: [1, 10] },
  amsler: { unit: '{areas}', range: [0, 400] },
  near_acuity: { unit: '{logMAR}', range: [-0.3, 1.3] },
  face_fluid_index: { unit: '1', range: [0.5, 2] },
  hydration: { unit: 'L/d', range: [0, 8] },
  exercise_minutes: { unit: 'min/d', range: [0, 300] },
  hematocrit: { unit: '%', range: [20, 70] },
  wbc: { unit: '10*3/uL', range: [0.5, 50] },
  symptoms: { unit: '1', nullValue: true, flags: SYMPTOM_KEYS },
  cabin_co2: { unit: 'mm[Hg]', range: [0, 30] },
  cabin_temp: { unit: 'Cel', range: [5, 40] },
  cabin_humidity: { unit: '%', range: [0, 100] },
  radiation_dose: { unit: 'mSv', range: [0, 2000] },
};

export class ObservationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObservationValidationError';
  }
}

const CABIN_SIGNALS: ReadonlySet<SignalId> = new Set<SignalId>(['cabin_co2', 'cabin_temp', 'cabin_humidity']);

/** Throws ObservationValidationError when `o` cannot be stored. */
export function validateNewObservation(o: NewObservation): void {
  const bad = (m: string): never => {
    throw new ObservationValidationError(`${o.signalId}: ${m}`);
  };
  const spec = OBSERVATION_SPECS[o.signalId];
  if (!spec) throw new ObservationValidationError(`unknown signal ${String(o.signalId)}`);
  if (typeof o.crewId !== 'string' || o.crewId === '') bad('crewId missing');
  if (CABIN_SIGNALS.has(o.signalId) !== (o.crewId === 'cabin')) bad(`crewId must ${CABIN_SIGNALS.has(o.signalId) ? '' : 'not '}be "cabin"`);
  if (o.unit !== spec.unit) bad(`unit must be ${spec.unit} (got ${o.unit})`);
  if (o.missionDay !== undefined && (!Number.isInteger(o.missionDay) || o.missionDay === 0)) bad('missionDay must be a non-zero integer');
  if (o.effectiveAt !== undefined && Number.isNaN(Date.parse(o.effectiveAt))) bad('effectiveAt is not an ISO date');
  if (spec.nullValue) {
    if (o.value !== null) bad('value must be null (use components)');
  } else if (typeof o.value !== 'number' || !Number.isFinite(o.value)) {
    bad('value must be a finite number');
  } else if (spec.range && (o.value < spec.range[0] || o.value > spec.range[1])) {
    bad(`value ${o.value} outside valid input range ${spec.range[0]}–${spec.range[1]}`);
  }
  if (spec.components) {
    for (const [k, [lo, hi]] of Object.entries(spec.components)) {
      const v = o.components?.[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) bad(`component ${k} missing`);
      else if (v < lo || v > hi) bad(`${k} ${v} outside valid input range ${lo}–${hi}`);
    }
    if (o.signalId === 'blood_pressure' && (o.components?.systolic ?? 0) <= (o.components?.diastolic ?? 0)) {
      bad('systolic must be greater than diastolic');
    }
  }
  if (spec.flags) {
    for (const [k, v] of Object.entries(o.components ?? {})) {
      if (!spec.flags.includes(k)) bad(`unknown checklist item ${k}`);
      if (v !== 0 && v !== 1) bad(`${k} must be 0 or 1 (got ${v})`);
    }
  }
  if (typeof o.quality?.score !== 'number' || !['good', 'fair', 'poor'].includes(o.quality.label)) bad('quality missing');
  if (!o.source || !['SIMULATED', 'MEASURED', 'LIVE', 'REPLAY'].includes(o.source.label)) bad('source.label missing');
}
