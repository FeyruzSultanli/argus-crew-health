// Builds the personal LayerResult of one mission day from a computed series (doc 08 §5 templates, numbers).
import type { PersonalResult, SignalDef } from '../types';
import {
  BASELINE_DEMO_SOURCE,
  BASELINE_PARAMS as P,
  BASELINE_PRECEDENT_SOURCES,
  DIRECTION_CODE,
  EXPECTED_SHIFT_SOURCES,
  REFERENCE_KIND,
} from './constants';
import type { PersonalDay } from './engine';
import {
  PERSONAL_DISABLED_REASON,
  PERSONAL_NOT_STARTED_REASON,
  explainDay,
  explainNoBaseline,
  explainNominal,
} from './explain';
import type { PersonalSeriesResult, PersonalTrackSeries, SeriesPoint } from './personal';
import type { PreflightBaseline } from './reference';
import { ENGINE_SEVERITY } from './stateMachine';

/** Last reading day ≤ missionDay (binary search; days are ascending). */
function dayAt(days: readonly PersonalDay[], missionDay: number): PersonalDay | undefined {
  let lo = 0;
  let hi = days.length - 1;
  let found: PersonalDay | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = days[mid] as PersonalDay;
    if (d.missionDay <= missionDay) {
      found = d;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

function sourcesFor(def: SignalDef, d: PersonalDay): string[] {
  const ids = [BASELINE_DEMO_SOURCE, ...BASELINE_PRECEDENT_SOURCES];
  if (d.shift !== 0) ids.push(...(EXPECTED_SHIFT_SOURCES[def.id] ?? []));
  return [...new Set(ids)];
}

function numbersFor(t: PersonalTrackSeries, d: PersonalDay): Record<string, number> {
  const pre = t.preflight as PreflightBaseline;
  const persistent = d.watchStreakDays >= P.persistentShiftDays ? 1 : 0;
  return {
    ref: d.ref,
    sigma: d.sigma,
    z: d.z,
    cusum: d.cusum,
    drift: d.drift ?? 0,
    nPre: pre.n,
    nAdaptive: d.nAdaptive,
    referenceKind: d.referenceKind === 'adaptive' ? REFERENCE_KIND.adaptive : REFERENCE_KIND.preflight,
    value: d.value,
    lo: d.lo,
    hi: d.hi,
    mPre: d.mPre,
    sigmaPre: d.sigmaPre,
    shift: d.shift,
    direction: DIRECTION_CODE[d.side],
    thin: pre.thin ? 1 : 0,
    readingDay: d.missionDay,
    watchStreakDays: d.watchStreakDays,
    persistentShift: persistent,
  };
}

function noData(
  def: SignalDef,
  reason: string,
  ruleKey: string,
  series: SeriesPoint[],
  numbers?: Record<string, number>,
  sourceIds: string[] = [],
): PersonalResult {
  const r: PersonalResult = {
    layer: 'personal',
    verdict: 'NO_DATA',
    reason,
    ruleId: `${def.id}.personal.${ruleKey}`,
    sourceIds,
    series,
  };
  if (numbers !== undefined) r.numbers = numbers;
  return r;
}

/** The PersonalResult for `missionDay` from an already computed series (z, S and state carry over gaps). */
export function personalFromSeries(
  def: SignalDef,
  s: PersonalSeriesResult,
  missionDay: number,
): PersonalResult {
  const series = s.series.filter((p) => p.missionDay <= missionDay);
  if (!def.personal.enabled || def.personal.params.length === 0)
    return noData(def, PERSONAL_DISABLED_REASON, 'disabled', []);
  const withBaseline = s.tracks.filter((t) => t.preflight !== null);
  if (withBaseline.length === 0) {
    const nPre = Math.max(0, ...s.tracks.map((t) => t.nPreflight));
    const k = P.minPreflight - nPre;
    return noData(
      def,
      explainNoBaseline(k),
      'no-baseline',
      [],
      { nPre, referenceKind: REFERENCE_KIND.none },
      [BASELINE_DEMO_SOURCE],
    );
  }
  const current = withBaseline
    .map((t) => ({ t, d: dayAt(t.days, missionDay) }))
    .filter((x): x is { t: PersonalTrackSeries; d: PersonalDay } => x.d !== undefined);
  if (current.length === 0) {
    const pre = withBaseline[0]?.preflight as PreflightBaseline;
    return noData(
      def,
      PERSONAL_NOT_STARTED_REASON,
      'not-started',
      series,
      {
        ref: pre.m,
        sigma: pre.sigma,
        nPre: pre.n,
        nAdaptive: 0,
        referenceKind: REFERENCE_KIND.preflight,
        thin: pre.thin ? 1 : 0,
      },
      [BASELINE_DEMO_SOURCE],
    );
  }
  // Worse series; tie → larger z; tie → first (param / eye order).
  let top = current[0] as { t: PersonalTrackSeries; d: PersonalDay };
  for (const c of current) {
    const a = ENGINE_SEVERITY[c.d.state];
    const b = ENGINE_SEVERITY[top.d.state];
    if (a > b || (a === b && c.d.z > top.d.z)) top = c;
  }
  const multi = current.length > 1;
  const reason =
    top.d.state === 'NOMINAL' && multi
      ? explainNominal(
          def.id,
          current.map((c) => ({
            name: c.t.component ?? (c.t.eye === undefined ? c.t.key : `${c.t.eye} eye`),
            lo: c.d.lo,
            hi: c.d.hi,
          })),
        )
      : explainDay(def.id, top.t.label, top.d);
  const driverKey = top.d.driver === 'none' ? 'nominal' : top.d.driver;
  return {
    layer: 'personal',
    verdict: top.d.state,
    reason,
    ruleId: `${def.id}.personal.${driverKey}`,
    sourceIds: sourcesFor(def, top.d),
    numbers: numbersFor(top.t, top.d),
    series,
  };
}
