// Cabin CO₂ chart model (doc 11 §5.3; doc 07 §4.18 thresholds). Pure.
import type { Observation } from '../../domain/types';
import type { ChartReferenceLine } from './chartTypes';
import { dayToIndex, inRange } from './axis';
import type { DayRange } from './axis';
import type { TrendPoint, TrendTrack } from './trendData';

/** Primary lines: the two NASA limits the acceptance names (each with its source badge). */
export const CO2_PRIMARY_LINES: readonly ChartReferenceLine[] = [
  { y: 3, label: 'NASA-STD-3001 1-h limit', sourceIds: ['SRC_STD3001_CO2'], tone: 'watch' },
  { y: 2.5, label: '7-day headache-risk line', sourceIds: ['SRC_NASA_CO2_PAGE'], tone: 'watch' },
];

/** Secondary Earth comparison lines. */
export const CO2_SECONDARY_LINES: readonly ChartReferenceLine[] = [
  {
    y: 3.8,
    label: 'Earth workplace limit (5,000 ppm)',
    sourceIds: ['SRC_NASA_CO2_PAGE', 'SRC_OSHA_CO2'],
    tone: 'muted',
  },
  {
    y: 6.8,
    label: 'Time-limited exposure band',
    sourceIds: ['SRC_CO2_ICES_LIMITS', 'SRC_DEMO_RULE_BANDS'],
    tone: 'muted',
  },
];

/** Latest reading per day (the observation value is that day's latest 1-h average). */
function latestPerDay(obs: readonly Observation[], range: DayRange): Map<number, Observation> {
  const by = new Map<number, Observation>();
  for (const o of obs) {
    if (!inRange(o.missionDay, range)) continue;
    const seen = by.get(o.missionDay);
    if (!seen || o.effectiveAt >= seen.effectiveAt) by.set(o.missionDay, o);
  }
  return by;
}

/** Two tracks: the 1-h average and the 7-day average (components.avg7d). */
export function co2Tracks(obs: readonly Observation[], range: DayRange): TrendTrack[] {
  const days = [...latestPerDay(obs, range).values()].sort((a, b) => a.missionDay - b.missionDay);
  const point = (o: Observation, v: number): TrendPoint => ({
    missionDay: o.missionDay,
    x: dayToIndex(o.missionDay),
    value: v,
    measured: o.source.label === 'MEASURED' || o.source.label === 'LIVE',
  });
  const oneHour: TrendPoint[] = [];
  const sevenDay: TrendPoint[] = [];
  for (const o of days) {
    if (o.value !== null) oneHour.push(point(o, o.value));
    const a = o.components?.avg7d;
    if (typeof a === 'number') sevenDay.push(point(o, a));
  }
  return [
    { key: 'last1h', label: '1-h average', points: oneHour, band: false },
    { key: 'avg7d', label: '7-day average', points: sevenDay, band: false },
  ];
}
