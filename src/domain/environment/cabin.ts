// Cabin environment snapshot maths (doc 10 §9). Pure: built from the simulated cabin observations (crewId 'cabin').
//
// The simulation stores one cabin_co2 observation per flight day: value = that day's latest 1-h average (mmHg),
// components.avg7d = the 7-day average. So:
//   last1hMmHg = value of the latest cabin_co2 reading on or before the day
//   avg7dMmHg  = its components.avg7d, else the mean of the daily means of the 7 days ending at that day
//   dailyMeans = mean of each day's readings (one reading per day in the simulation → that reading)
//   series24h  = 288 points at 5-min resolution synthesised deterministically around last1hMmHg (a small
//                sinusoid + hash ripple; the mean of the last 12 points equals last1hMmHg). It is SIMULATED
//                display texture, not sensor data, and is labeled so.
// Days without cabin data (pre-flight) give NaN numbers and empty series; their assessments are NO_DATA.
import type { Assessment, EnvironmentSnapshot, Observation } from '../types';

/** Lines on the CO₂ chart (doc 10 §9), each with its source. */
export const CO2_LINES = [
  { id: 'std3001', mmHg: 3, label: 'NASA-STD-3001 1-h limit', sourceIds: ['SRC_STD3001_CO2'] },
  { id: 'headache', mmHg: 2.5, label: 'Headache-risk line (7-day)', sourceIds: ['SRC_NASA_CO2_PAGE'] },
  {
    id: 'act',
    mmHg: 6.8,
    label: 'Time-limited exposure band',
    sourceIds: ['SRC_CO2_ICES_LIMITS', 'SRC_DEMO_RULE_BANDS'],
  },
  {
    id: 'earth',
    mmHg: 3.8,
    label: 'Earth workplace comparison (0.5 %)',
    sourceIds: ['SRC_NASA_CO2_PAGE', 'SRC_OSHA_CO2'],
  },
] as const;

/** Comfort zones (doc 10 §9) [SRC_STD3001_ECLSS · verified]. */
export const COMFORT = {
  performance: { tempLo: 20, tempHi: 25, rhLo: 30, rhHi: 60 },
  healthTemp: { lo: 18, hi: 27 },
  sourceIds: ['SRC_STD3001_ECLSS'],
} as const;

export const SERIES_STEP_MIN = 5;
const SERIES_POINTS = (24 * 60) / SERIES_STEP_MIN; // 288

function latestOnOrBefore(obs: readonly Observation[], day: number): Observation | undefined {
  let best: Observation | undefined;
  for (const o of obs) {
    if (o.missionDay > day || o.value === null) continue;
    if (
      !best ||
      o.missionDay > best.missionDay ||
      (o.missionDay === best.missionDay && o.effectiveAt > best.effectiveAt)
    )
      best = o;
  }
  return best;
}

/** Mean per mission day (readings with a value), oldest first, within [fromDay, toDay]. */
export function dailyMeans(
  obs: readonly Observation[],
  fromDay: number,
  toDay: number,
): Array<{ missionDay: number; mmHg: number }> {
  const acc = new Map<number, { s: number; n: number }>();
  for (const o of obs) {
    if (o.value === null || o.missionDay < fromDay || o.missionDay > toDay) continue;
    const a = acc.get(o.missionDay) ?? { s: 0, n: 0 };
    a.s += o.value;
    a.n += 1;
    acc.set(o.missionDay, a);
  }
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([missionDay, a]) => ({ missionDay, mmHg: a.s / a.n }));
}

/** Deterministic 0..1 hash of an integer (display ripple only). */
function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

/** 288 five-minute points ending at `endIso`; the last 12 average exactly `last1h`. SIMULATED texture. */
export function synthSeries24h(
  last1h: number,
  endIso: string,
  seed: number,
): Array<{ t: string; mmHg: number }> {
  const end = Date.parse(endIso);
  const raw: number[] = [];
  for (let i = 0; i < SERIES_POINTS; i++) {
    const phase = (2 * Math.PI * i) / SERIES_POINTS;
    raw.push(
      0.12 * Math.sin(phase * 1 + seed) +
        0.04 * Math.sin(phase * 6 + seed * 2) +
        0.03 * (hash01(seed * 997 + i) - 0.5),
    );
  }
  const last12 = raw.slice(-12).reduce((s, x) => s + x, 0) / 12;
  return raw.map((r, i) => ({
    t: new Date(end - (SERIES_POINTS - 1 - i) * SERIES_STEP_MIN * 60_000).toISOString(),
    mmHg: Math.max(0, Math.round((last1h + r - last12) * 100) / 100),
  }));
}

export interface CabinInputs {
  co2: readonly Observation[];
  temp: readonly Observation[];
  humidity: readonly Observation[];
}

/** EnvironmentSnapshot of `missionDay` from the cabin observations and the three cabin assessments. */
export function buildEnvironmentSnapshot(
  missionDay: number,
  inputs: CabinInputs,
  assessments: Assessment[],
  dailyWindowDays = 30,
): EnvironmentSnapshot {
  const co2 = latestOnOrBefore(inputs.co2, missionDay);
  const temp = latestOnOrBefore(inputs.temp, missionDay);
  const rh = latestOnOrBefore(inputs.humidity, missionDay);
  const means = dailyMeans(inputs.co2, missionDay - dailyWindowDays + 1, missionDay);
  const last1h = co2?.value ?? NaN;
  let avg7d = co2?.components?.avg7d;
  if (avg7d === undefined) {
    const w = means.filter((m) => m.missionDay > missionDay - 7);
    avg7d = w.length > 0 ? w.reduce((s, m) => s + m.mmHg, 0) / w.length : NaN;
  }
  return {
    missionDay,
    co2: {
      last1hMmHg: last1h,
      avg7dMmHg: avg7d,
      series24h: co2 && co2.value !== null ? synthSeries24h(co2.value, co2.effectiveAt, co2.missionDay) : [],
      dailyMeans: means,
    },
    tempC: temp?.value ?? NaN,
    humidityPct: rh?.value ?? NaN,
    assessments,
  };
}
