// Display-only unit handling (docs/PROJECT_RULES.md §4: store UCUM, convert only at display). Used by <Value>.
import type { GlucoseUnit, TempUnit } from '../state/ui';

/** UCUM code → short display symbol. Unknown codes are shown as given. */
const DISPLAY: Record<string, string> = {
  '/min': 'bpm',
  'mm[Hg]': 'mmHg',
  Cel: '°C',
  '[degF]': '°F',
  '%': '%',
  h: 'h',
  min: 'min',
  s: 's',
  ms: 'ms',
  kg: 'kg',
  'mg/dL': 'mg/dL',
  'mmol/L': 'mmol/L',
  mSv: 'mSv',
  'mSv/d': 'mSv/day',
  pfu: 'pfu',
  '/s': 's⁻¹',
  '{logMAR}': 'logMAR',
  '{areas}': 'cells',
  '{score}': '/ 5',
  '1': '',
  L: 'L',
  'L/d': 'L/day',
  'min/d': 'min/day',
  '10*3/uL': '×10³/µL',
};

export function unitSymbol(ucum: string | undefined): string {
  if (!ucum) return '';
  return DISPLAY[ucum] ?? ucum;
}

// Molar mass of glucose, 180.16 g/mol → 1 mmol/L = 18.016 mg/dL. A unit identity, not a clinical threshold.
const GLUCOSE_MG_PER_MMOL = 18.016;

export interface DisplayPrefs {
  temp: TempUnit;
  glucose: GlucoseUnit;
}

/** Convert a canonical value into the user's preferred display unit. Returns the unit actually shown. */
export function toDisplayUnit(
  value: number,
  ucum: string | undefined,
  prefs: DisplayPrefs,
): { value: number; unit: string | undefined } {
  if (ucum === 'Cel' && prefs.temp === '[degF]') return { value: (value * 9) / 5 + 32, unit: '[degF]' };
  if (ucum === 'mg/dL' && prefs.glucose === 'mmol/L')
    return { value: value / GLUCOSE_MG_PER_MMOL, unit: 'mmol/L' };
  return { value, unit: ucum };
}

/** Format with fixed precision; when precision is omitted: integers as is, otherwise up to 1 decimal. */
export function formatNumber(value: number, precision?: number): string {
  const p = precision ?? (Number.isInteger(value) ? 0 : 1);
  return value.toLocaleString('en-US', { minimumFractionDigits: p, maximumFractionDigits: p });
}

/** "now", "12 min", "3 h", "2 d" — compact age for freshness labels. */
export function formatAge(minutes: number): string {
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 48) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} d`;
}

/** mm:ss (or h:mm:ss) from milliseconds. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
