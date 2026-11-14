// Explanation templates of doc 08 §5 (FR-BAS-5). Plain words, no diagnosis wording, ≤ 140 characters.
import type { SignalId } from '../types';
import { DISPLAY_PRECISION, DISPLAY_UNIT, formatNumber } from '../units';
import type { PersonalDay } from './engine';

/** Unit used inside the templates: the display unit, except mood (a 1–5 score, no unit). */
export function templateUnit(signalId: SignalId): string {
  return signalId === 'mood' ? '' : DISPLAY_UNIT[signalId];
}

const unitSuffix = (unit: string): string => (unit === '' ? '' : unit === '%' ? '%' : ` ${unit}`);

/** Number at display precision followed by the template unit ("58 bpm", "97%", "3.8"). */
export function withUnit(signalId: SignalId, v: number): string {
  return `${formatNumber(v, DISPLAY_PRECISION[signalId])}${unitSuffix(templateUnit(signalId))}`;
}

const num = (signalId: SignalId, v: number): string => formatNumber(v, DISPLAY_PRECISION[signalId]);

/** "Resting heart rate" → "resting heart rate"; labels with other capitals ("Reaction Self-Test") stay. */
export function lowerLabel(label: string): string {
  const rest = label.slice(1);
  return rest === rest.toLowerCase() ? label.charAt(0).toLowerCase() + rest : label;
}

/** z-driven: "{label} is {Δ} {unit} {above/below} your usual ({ref.m} {unit}). That is {z:.1f}× your normal …" */
export function explainZ(signalId: SignalId, label: string, d: PersonalDay): string {
  const where = d.value >= d.ref ? 'above' : 'below';
  return (
    `${label} is ${withUnit(signalId, Math.abs(d.value - d.ref))} ${where} your usual ` +
    `(${withUnit(signalId, d.ref)}). That is ${formatNumber(d.z, 1)}× your normal day-to-day variation.`
  );
}

/** CuSum-driven: "{label} has been {higher/lower} than your usual for {n} days in a row. Small changes …" */
export function explainCusum(label: string, d: PersonalDay): string {
  const n = Math.max(1, d.run);
  const how = d.side === 'up' ? 'higher' : 'lower';
  return `${label} has been ${how} than your usual for ${n} ${n === 1 ? 'day' : 'days'} in a row. Small changes are adding up.`;
}

/** drift: "Your in-flight {label} has settled {Δ} {unit} {above/below} your pre-flight normal." */
export function explainDrift(signalId: SignalId, label: string, d: PersonalDay): string {
  const where = d.ref >= d.mPre ? 'above' : 'below';
  return `Your in-flight ${lowerLabel(label)} has settled ${withUnit(signalId, Math.abs(d.ref - d.mPre))} ${where} your pre-flight normal.`;
}

/** nominal: "Within your usual range ({lo}–{hi} {unit})." — one range, or one per series ("systolic 108–128, …"). */
export function explainNominal(
  signalId: SignalId,
  ranges: ReadonlyArray<{ name?: string; lo: number; hi: number }>,
): string {
  const parts = ranges.map(
    (r) => `${r.name === undefined ? '' : `${r.name} `}${num(signalId, r.lo)}–${num(signalId, r.hi)}`,
  );
  return `Within your usual range (${parts.join(', ')}${unitSuffix(templateUnit(signalId))}).`;
}

/** no baseline: "Not enough readings yet to know your usual. {k} more needed." */
export function explainNoBaseline(k: number): string {
  return `Not enough readings yet to know your usual. ${k} more needed.`;
}

/** Personal layer switched off for the signal (doc 08 §7: hematocrit, wbc; signals without personal params). */
export const PERSONAL_DISABLED_REASON = 'The personal baseline is not used for this signal.';
/** Pre-flight day, or no in-flight reading yet: the engine starts at the first in-flight reading (doc 08 §3). */
export const PERSONAL_NOT_STARTED_REASON =
  'Your personal baseline is compared from the first in-flight reading.';

/** The reason for a WATCH/ACT/NOMINAL day of one series. */
export function explainDay(signalId: SignalId, label: string, d: PersonalDay): string {
  switch (d.driver) {
    case 'z':
    case 'hysteresis':
      return explainZ(signalId, label, d);
    case 'cusum':
      return explainCusum(label, d);
    case 'drift':
      return explainDrift(signalId, label, d);
    case 'none':
      return explainNominal(signalId, [{ lo: d.lo, hi: d.hi }]);
  }
}
