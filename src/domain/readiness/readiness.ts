// Readiness index 0–100 (doc 11 §9, FR-PLAN-3). A transparent demo formula, not a medical score:
//   100 − 25·#ACT − 10·#WATCH − 2·#overdue (max −10) − 3·#core daily signals in NO DATA (max −15)
//       − 5·(sleep 3-night mean < 5.5 h); clamp 0–100.
// #ACT and #WATCH count the crew member's own signals (radiation_dose included), never cabin signals and never the
// shelter advisory. Every weight and cap is a demo parameter [SRC_DEMO_READINESS].
// Pure TypeScript: no React, no DOM, no Dexie.
import { CABIN_SIGNAL_IDS, SIGNALS } from '../signals';
import type { Assessment, SignalId, Task } from '../types';

export const READINESS_SOURCE_IDS: readonly string[] = ['SRC_DEMO_READINESS'];

/** The formula as shown in the tooltip (doc 11 §9). */
export const READINESS_FORMULA =
  '100 − 25·#Act − 10·#Watch − 2·#overdue tasks (max −10) − 3·#core daily signals with no data (max −15) − 5 if the ' +
  'sleep 3-night mean is under 5.5 h; clamped to 0–100.';

/** Weights and caps of doc 11 §9 [SRC_DEMO_READINESS]. */
export const READINESS_WEIGHTS = {
  act: 25,
  watch: 10,
  overdue: 2,
  overdueCap: 10,
  noData: 3,
  noDataCap: 15,
  shortSleep: 5,
  shortSleepBelowH: 5.5,
} as const;

/** Core signals of FR-SIG-1 (P0), as registered. Cabin CO₂ is core too but is not a crew member's own signal. */
export const CORE_P0_SIGNALS: readonly SignalId[] = [
  'heart_rate_rest',
  'blood_pressure',
  'spo2',
  'body_temp',
  'glucose',
  'sleep_duration',
  'mood',
  'body_mass',
  'reaction_test',
  'amsler',
  'near_acuity',
  'radiation_dose',
];

/**
 * Signals that do not count in the NO DATA term although they are core and daily: radiation_dose is computed by the
 * dose model, not read by the crew, so "no data" there says nothing about the crew member's routine.
 */
const NO_DATA_EXEMPT: ReadonlySet<SignalId> = new Set<SignalId>(['radiation_dose']);

/**
 * Core daily signals: the P0 core signals whose registry cadence is 1 day (minus radiation_dose, see above).
 * With the current registry: heart_rate_rest, body_temp, sleep_duration, mood.
 */
export const CORE_DAILY_SIGNALS: readonly SignalId[] = CORE_P0_SIGNALS.filter(
  (id) => SIGNALS[id].cadenceDays === 1 && !NO_DATA_EXEMPT.has(id),
);

const CABIN: ReadonlySet<SignalId> = new Set<SignalId>(CABIN_SIGNAL_IDS);

export type ReadinessTermId = 'act' | 'watch' | 'overdue' | 'noData' | 'shortSleep';

export interface ReadinessTerm {
  id: ReadinessTermId;
  label: string;
  /** How many items the term counts (for shortSleep: 1 when the condition holds, else 0). */
  count: number;
  /** Points taken off (≥ 0), after the cap. */
  deduction: number;
  /** True when the cap limited the deduction. */
  capped: boolean;
  /** Signal ids behind the count (act / watch / noData). */
  signalIds: SignalId[];
}

export interface Readiness {
  /** Clamped 0–100. */
  score: number;
  /** 100 minus all deductions, before the clamp. */
  raw: number;
  terms: ReadinessTerm[];
  /** Sleep 3-night mean in hours, or null when unknown. */
  sleepMean3h: number | null;
}

export interface ReadinessInput {
  /** One crew member's assessments for the day (cabin assessments are ignored if passed). */
  assessments: readonly Assessment[];
  /** That crew member's plan for the day (only `status` is read). */
  tasks?: readonly Pick<Task, 'status'>[];
  /** Override for the sleep 3-night mean (h); default: read from the sleep_duration assessment. */
  sleepMean3h?: number | null;
  /** Override for the core daily signal list (tests); default CORE_DAILY_SIGNALS. */
  coreDailySignals?: readonly SignalId[];
}

/**
 * Sleep 3-night mean (h) from the sleep_duration assessment: the band rules put the judged value in
 * `layers.<layer>.numbers.value` (space first, then earth). Null when the signal has no recent nights.
 */
export function sleepMean3FromAssessments(assessments: readonly Assessment[]): number | null {
  const a = assessments.find((x) => x.signalId === 'sleep_duration');
  if (!a) return null;
  for (const layer of ['space', 'earth'] as const) {
    const r = a.layers[layer];
    const v = r.verdict === 'NO_DATA' ? undefined : r.numbers?.value;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The five terms of the formula, in formula order. */
export function readinessTerms(input: ReadinessInput): ReadinessTerm[] {
  const W = READINESS_WEIGHTS;
  const own = input.assessments.filter((a) => a.crewId !== 'cabin' && !CABIN.has(a.signalId));
  const ids = (v: Assessment['verdict']) => own.filter((a) => a.verdict === v).map((a) => a.signalId);
  const act = ids('ACT');
  const watch = ids('WATCH');
  const overdue = (input.tasks ?? []).filter((t) => t.status === 'overdue').length;
  const noData = (input.coreDailySignals ?? CORE_DAILY_SIGNALS).filter((id) => {
    const a = own.find((x) => x.signalId === id);
    return !a || a.verdict === 'NO_DATA';
  });
  const sleep = input.sleepMean3h !== undefined ? input.sleepMean3h : sleepMean3FromAssessments(own);
  const short = sleep !== null && sleep < W.shortSleepBelowH ? 1 : 0;

  const overdueRaw = overdue * W.overdue;
  const noDataRaw = noData.length * W.noData;
  return [
    {
      id: 'act',
      label: 'Act',
      count: act.length,
      deduction: act.length * W.act,
      capped: false,
      signalIds: act,
    },
    {
      id: 'watch',
      label: 'Watch',
      count: watch.length,
      deduction: watch.length * W.watch,
      capped: false,
      signalIds: watch,
    },
    {
      id: 'overdue',
      label: 'Overdue tasks',
      count: overdue,
      deduction: Math.min(overdueRaw, W.overdueCap),
      capped: overdueRaw > W.overdueCap,
      signalIds: [],
    },
    {
      id: 'noData',
      label: 'Core daily signals with no data',
      count: noData.length,
      deduction: Math.min(noDataRaw, W.noDataCap),
      capped: noDataRaw > W.noDataCap,
      signalIds: noData,
    },
    {
      id: 'shortSleep',
      label: 'Sleep 3-night mean under 5.5 h',
      count: short,
      deduction: short * W.shortSleep,
      capped: false,
      signalIds: short ? ['sleep_duration'] : [],
    },
  ];
}

/** Readiness index of one crew member on one day (doc 11 §9). */
export function computeReadiness(input: ReadinessInput): Readiness {
  const terms = readinessTerms(input);
  const raw = 100 - terms.reduce((s, t) => s + t.deduction, 0);
  const sleep =
    input.sleepMean3h !== undefined ? input.sleepMean3h : sleepMean3FromAssessments(input.assessments);
  return { score: clamp(raw, 0, 100), raw, terms, sleepMean3h: sleep };
}
