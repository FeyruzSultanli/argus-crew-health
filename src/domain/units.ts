// Unit conversions and display formatting (doc 06 §3). Pure TypeScript.
// Values are stored in canonical UCUM units; conversion happens only at display (docs/PROJECT_RULES.md §4).
import type { SignalId } from './types';

/** mg/dL ↔ mmol/L divisor for glucose (doc 06 §3). */
export const GLUCOSE_MGDL_PER_MMOLL = 18.016;
/** International avoirdupois pound, exact definition. */
export const KG_PER_LB = 0.45359237;

export const celsiusToFahrenheit = (c: number): number => (c * 9) / 5 + 32;
export const fahrenheitToCelsius = (f: number): number => ((f - 32) * 5) / 9;
export const mgdlToMmoll = (mgdl: number): number => mgdl / GLUCOSE_MGDL_PER_MMOLL;
export const mmollToMgdl = (mmoll: number): number => mmoll * GLUCOSE_MGDL_PER_MMOLL;
export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;

/**
 * Rounds half away from zero to `decimals` places, without binary artefacts
 * (roundTo(1.005, 2) = 1.01, roundTo(36.95, 1) = 37.0).
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const text = String(abs);
  // Exponential notation (very small/large numbers) cannot be shifted by string; fall back to arithmetic.
  const rounded = text.includes('e')
    ? Math.round(abs * 10 ** decimals) / 10 ** decimals
    : Number(`${Math.round(Number(`${text}e${decimals}`))}e-${decimals}`);
  return rounded === 0 ? 0 : sign * rounded;
}

/** Display precision (decimals) per signal — doc 07 §4 band rule; also used before every band test. */
export const DISPLAY_PRECISION: Record<SignalId, number> = {
  heart_rate_rest: 0,
  blood_pressure: 0,
  spo2: 0,
  body_temp: 1,
  glucose: 0,
  sleep_duration: 1,
  mood: 1,
  body_mass: 1,
  reaction_test: 2,
  amsler: 0,
  near_acuity: 2,
  face_fluid_index: 2,
  hydration: 1,
  exercise_minutes: 0,
  hematocrit: 1,
  wbc: 1,
  symptoms: 0,
  cabin_co2: 1,
  cabin_temp: 1,
  cabin_humidity: 0,
  radiation_dose: 1,
};

/** Canonical UCUM unit per signal (doc 06 §3). */
export const CANONICAL_UNIT: Record<SignalId, string> = {
  heart_rate_rest: '/min',
  blood_pressure: 'mm[Hg]',
  spo2: '%',
  body_temp: 'Cel',
  glucose: 'mg/dL',
  sleep_duration: 'h',
  mood: '{score}',
  body_mass: 'kg',
  reaction_test: '/s',
  amsler: '{areas}',
  near_acuity: '{logMAR}',
  face_fluid_index: '1',
  hydration: 'L/d',
  exercise_minutes: 'min/d',
  hematocrit: '%',
  wbc: '10*3/uL',
  symptoms: '{count}',
  cabin_co2: 'mm[Hg]',
  cabin_temp: 'Cel',
  cabin_humidity: '%',
  radiation_dose: 'mSv',
};

/** Default display unit label per signal (doc 06 §3 "Display options", first option). */
export const DISPLAY_UNIT: Record<SignalId, string> = {
  heart_rate_rest: 'bpm',
  blood_pressure: 'mmHg',
  spo2: '%',
  body_temp: '°C',
  glucose: 'mg/dL',
  sleep_duration: 'h',
  mood: '/5',
  body_mass: 'kg',
  reaction_test: 's⁻¹',
  amsler: 'cells',
  near_acuity: 'logMAR',
  face_fluid_index: '',
  hydration: 'L',
  exercise_minutes: 'min',
  hematocrit: '%',
  wbc: '×10³/µL',
  symptoms: 'symptoms',
  cabin_co2: 'mmHg',
  cabin_temp: '°C',
  cabin_humidity: '% RH',
  radiation_dose: 'mSv',
};

/** Fixed-decimals number string (rounded half away from zero). */
export function formatNumber(value: number, decimals: number): string {
  return roundTo(value, decimals).toFixed(decimals);
}

/** "58 bpm", "36.6 °C", "3.4 mmHg" — canonical unit, default display unit. */
export function formatSignalValue(signalId: SignalId, value: number): string {
  const unit = DISPLAY_UNIT[signalId];
  const text = formatNumber(value, DISPLAY_PRECISION[signalId]);
  if (unit === '') return text;
  if (unit === '%' || unit === '/5') return `${text}${unit}`;
  return `${text} ${unit}`;
}

/** Blood pressure as "118/76 mmHg". */
export function formatBloodPressure(systolic: number, diastolic: number): string {
  return `${formatNumber(systolic, 0)}/${formatNumber(diastolic, 0)} mmHg`;
}

/** Hours as h:mm (sleep display, doc 06 §3): 6.2 → "6:12". */
export function formatHoursMinutes(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin - h * 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export type TemperatureUnit = 'C' | 'F';
/** Body or cabin temperature in °C or °F, one decimal. */
export function formatTemperature(celsius: number, unit: TemperatureUnit = 'C'): string {
  return unit === 'C'
    ? `${formatNumber(celsius, 1)} °C`
    : `${formatNumber(celsiusToFahrenheit(celsius), 1)} °F`;
}

export type GlucoseUnit = 'mg/dL' | 'mmol/L';
/** Glucose in mg/dL (integer) or mmol/L (one decimal). */
export function formatGlucose(mgdl: number, unit: GlucoseUnit = 'mg/dL'): string {
  return unit === 'mg/dL' ? `${formatNumber(mgdl, 0)} mg/dL` : `${formatNumber(mgdlToMmoll(mgdl), 1)} mmol/L`;
}

export type MassUnit = 'kg' | 'lb';
/** Body mass in kg or lb, one decimal. */
export function formatMass(kg: number, unit: MassUnit = 'kg'): string {
  return unit === 'kg' ? `${formatNumber(kg, 1)} kg` : `${formatNumber(kgToLb(kg), 1)} lb`;
}

/**
 * Whole days between two mission days. There is no mission day 0 (launch day = 1, the day before = −1),
 * so −1 → 1 is one day.
 */
export function missionDaysBetween(fromDay: number, toDay: number): number {
  const raw = toDay - fromDay;
  if (fromDay < 0 && toDay > 0) return raw - 1;
  if (fromDay > 0 && toDay < 0) return raw + 1;
  return raw;
}

/** The `n` mission days ending at `endDay` (inclusive), newest first, skipping day 0. */
export function missionDayWindow(endDay: number, n: number): number[] {
  const days: number[] = [];
  let d = endDay;
  while (days.length < n) {
    if (d !== 0) days.push(d);
    d -= 1;
  }
  return days;
}
