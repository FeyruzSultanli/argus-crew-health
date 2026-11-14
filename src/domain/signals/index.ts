// Signal catalog registry (doc 07 §4). One SignalDef per file, registered here.
import type { SignalDef, SignalId } from '../types';
import { amsler } from './amsler';
import { bloodPressure } from './bloodPressure';
import { bodyMass } from './bodyMass';
import { bodyTemp } from './bodyTemp';
import { cabinCo2 } from './cabinCo2';
import { cabinHumidity } from './cabinHumidity';
import { cabinTemp } from './cabinTemp';
import { exerciseMinutes } from './exerciseMinutes';
import { faceFluidIndex } from './faceFluidIndex';
import { glucose } from './glucose';
import { heartRateRest } from './heartRateRest';
import { hematocrit } from './hematocrit';
import { hydration } from './hydration';
import { mood } from './mood';
import { nearAcuity } from './nearAcuity';
import { radiationDose } from './radiationDose';
import { reactionTest } from './reactionTest';
import { sleepDuration } from './sleepDuration';
import { spo2 } from './spo2';
import { symptoms } from './symptoms';
import { wbc } from './wbc';

export const SIGNALS: Record<SignalId, SignalDef> = {
  heart_rate_rest: heartRateRest,
  blood_pressure: bloodPressure,
  spo2,
  body_temp: bodyTemp,
  glucose,
  sleep_duration: sleepDuration,
  mood,
  body_mass: bodyMass,
  reaction_test: reactionTest,
  amsler,
  near_acuity: nearAcuity,
  face_fluid_index: faceFluidIndex,
  hydration,
  exercise_minutes: exerciseMinutes,
  hematocrit,
  wbc,
  symptoms,
  cabin_co2: cabinCo2,
  cabin_temp: cabinTemp,
  cabin_humidity: cabinHumidity,
  radiation_dose: radiationDose,
};

/**
 * Evaluation order. reaction_test comes before sleep_duration so the sleep space rule can read
 * ctx.sameDay.reaction_test. Crew signals first, cabin signals last.
 */
export const signalList: SignalDef[] = [
  SIGNALS.heart_rate_rest,
  SIGNALS.blood_pressure,
  SIGNALS.spo2,
  SIGNALS.body_temp,
  SIGNALS.glucose,
  SIGNALS.reaction_test,
  SIGNALS.sleep_duration,
  SIGNALS.mood,
  SIGNALS.body_mass,
  SIGNALS.exercise_minutes,
  SIGNALS.hydration,
  SIGNALS.amsler,
  SIGNALS.near_acuity,
  SIGNALS.face_fluid_index,
  SIGNALS.hematocrit,
  SIGNALS.wbc,
  SIGNALS.symptoms,
  SIGNALS.radiation_dose,
  SIGNALS.cabin_co2,
  SIGNALS.cabin_temp,
  SIGNALS.cabin_humidity,
];

/** Signals measured on the cabin (crewId = 'cabin'), not per crew member. */
export const CABIN_SIGNAL_IDS: readonly SignalId[] = ['cabin_co2', 'cabin_temp', 'cabin_humidity'];

export function getSignal(id: SignalId): SignalDef {
  return SIGNALS[id];
}

export { SYMPTOM_KEYS, SYMPTOM_LABELS } from './symptoms';
export type { SymptomKey } from './symptoms';
