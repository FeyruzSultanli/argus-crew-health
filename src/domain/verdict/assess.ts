// assessSignal(): runs one signal's Earth/space rules + quality, takes the injected personal result (baseline engine) and
// combines them into an Assessment (doc 05 §4.2, doc 07 §3). Pure.
import { chronological, median, preflightOf } from '../rules/history';
import { asLayer, notApplicable } from '../rules/layer';
import { evaluateQuality } from '../rules/quality';
import type {
  Assessment,
  LayerResult,
  Observation,
  PersonalResult,
  ProtocolId,
  RuleCtx,
  SignalDef,
  SignalId,
} from '../types';
import { missionDaysBetween } from '../units';
import { GENERIC_ACTIONS, actionFor, toAction } from './actions';
import { combine } from './combine';
import { VERDICT_MEANING, explainStale, remeasureNote } from './explain';

/** Personal layer when no baseline result is supplied: verdict NO_DATA (n/a). */
export function noPersonal(reason = 'Personal baseline not computed yet.'): LayerResult {
  return notApplicable('personal', reason, 'personal.stub');
}

/**
 * The observation the rules judge for the day: aggregated per the signal's first PersonalParams aggregation
 * (doc 08 §7). 'daily-median' → median value and median of every component; 'daily-max' → the reading with the
 * highest value; anything else → the latest reading of the day.
 */
export function dayObservation(def: SignalDef, dayObs: readonly Observation[]): Observation | undefined {
  // Poor readings are left out when the day has at least one better reading; if all are poor they are used (and
  // the poor-quality gate of combine() fires).
  const usable = dayObs.some((o) => o.quality.label !== 'poor')
    ? dayObs.filter((o) => o.quality.label !== 'poor')
    : dayObs;
  const sorted = chronological(usable);
  const latest = sorted.at(-1);
  if (latest === undefined || sorted.length === 1) return latest;
  const agg = def.personal.params[0]?.aggregation;
  if (agg === 'daily-median') {
    const values = sorted.map((o) => o.value).filter((v): v is number => typeof v === 'number');
    const keys = new Set(sorted.flatMap((o) => Object.keys(o.components ?? {})));
    const out: Observation = { ...latest, value: median(values) };
    if (keys.size > 0) {
      const components: Record<string, number> = {};
      for (const k of keys) {
        const m = median(
          sorted.map((o) => o.components?.[k]).filter((v): v is number => typeof v === 'number'),
        );
        if (m !== null) components[k] = m;
      }
      out.components = components;
    }
    return out;
  }
  if (agg === 'daily-max') {
    let best = latest;
    for (const o of sorted)
      if (typeof o.value === 'number' && (best.value === null || o.value > best.value)) best = o;
    return best;
  }
  return latest;
}

/** radiation_dose is judged from ctx.dose; this stands in for a missing observation. */
function doseObservation(ctx: RuleCtx): Observation | undefined {
  const d = ctx.dose;
  if (d === undefined) return undefined;
  return {
    id: `dose-${d.crewId}-${ctx.missionDay}`,
    crewId: d.crewId,
    signalId: 'radiation_dose',
    value: d.totalMsv,
    unit: 'mSv',
    effectiveAt: new Date(0).toISOString(),
    missionDay: ctx.missionDay,
    source: { kind: 'derived', method: 'dose ledger', label: 'SIMULATED' },
    quality: { score: 1, label: 'good', reasons: [] },
  };
}

/** Signals judged from RuleCtx data rather than observations: a present ctx.dose is the source of truth. */
const CTX_DRIVEN: ReadonlySet<SignalId> = new Set<SignalId>(['radiation_dose']);

/** Signals whose WATCH action opens a protocol only when the space layer flags (doc 07 §5 triggers). */
const PROTOCOL_ON_SPACE_WATCH: Partial<Record<SignalId, ProtocolId>> = { amsler: 'vision-change' };

/**
 * @param observations same crew + same signal, up to ctx.missionDay, oldest first (later days are ignored).
 *   They also become ctx.history for the rules, so both always agree.
 * @param personalResult the personal layer (the baseline engine's computePersonal) or noPersonal() when there is none.
 */
export function assessSignal(
  def: SignalDef,
  observations: readonly Observation[],
  ctx: RuleCtx,
  personalResult: PersonalResult | LayerResult,
): Assessment {
  const obs = chronological(observations.filter((o) => o.missionDay <= ctx.missionDay));
  const rctx: RuleCtx = { ...ctx, history: obs };
  const personal = asLayer(personalResult, 'personal');
  const fromCtx = CTX_DRIVEN.has(def.id) ? doseObservation(ctx) : undefined;
  // For ctx-driven signals a current ctx.dose wins over any (possibly old) observation; staleness does not apply.
  const realLatest = fromCtx === undefined ? obs.at(-1) : undefined;
  const latest = fromCtx ?? realLatest;
  const crewId = latest?.crewId ?? ctx.crew?.id ?? 'cabin';

  if (latest === undefined) {
    const quality = evaluateQuality([], null, ctx.missionDay, def.cadenceDays);
    const assessment: Assessment = {
      crewId,
      signalId: def.id,
      missionDay: ctx.missionDay,
      layers: {
        personal,
        space: notApplicable('space', 'No reading yet.', `${def.id}.space.none`),
        earth: notApplicable('earth', 'No reading yet.', `${def.id}.earth.none`),
      },
      quality,
      verdict: 'NO_DATA',
      drivenBy: [],
      caughtOnlyByPersonal: false,
      action: actionFor(def, 'NO_DATA'),
      explanation: VERDICT_MEANING.NO_DATA,
    };
    return assessment;
  }

  const latestDay = latest.missionDay;
  const dayObs = realLatest === undefined ? [latest] : obs.filter((o) => o.missionDay === latestDay);
  const quality = evaluateQuality(dayObs, latestDay, ctx.missionDay, def.cadenceDays);
  const subject = dayObservation(def, dayObs) ?? latest;
  const earth = asLayer(def.earth(subject, rctx), 'earth');
  const space = asLayer(def.space(subject, rctx), 'space');
  const layers = { personal, space, earth };
  const age = Math.max(0, missionDaysBetween(latestDay, ctx.missionDay));
  const base = { crewId, signalId: def.id, missionDay: ctx.missionDay, latest, layers, quality };

  // FR-SIG-5: older than cadence × 3 → NO DATA, whatever the layers say about the old reading.
  if (quality.stale === 'no-data') {
    return {
      ...base,
      verdict: 'NO_DATA',
      drivenBy: [],
      caughtOnlyByPersonal: false,
      action: actionFor(def, 'NO_DATA'),
      explanation: explainStale(age),
    };
  }

  const c = combine(personal, space, earth, quality, def);
  let action = c.action;
  let explanation = c.explanation;

  if (c.rule === 'no-data') {
    // A fresh reading exists but no layer applies (e.g. symptoms, or no pre-flight reference yet): nothing to
    // re-measure, so no action; explain with the first layer reason.
    const why = [space, earth, personal].find((l) => l.reason.length > 0)?.reason ?? '';
    action = toAction(GENERIC_ACTIONS.NOMINAL);
    explanation = `No verdict from the rules: ${why}`.trim();
  }

  const protocolId = PROTOCOL_ON_SPACE_WATCH[def.id];
  if (
    protocolId !== undefined &&
    c.verdict === 'WATCH' &&
    space.verdict === 'WATCH' &&
    c.qualityGate !== 'poor-cap'
  ) {
    action = { ...action, kind: 'protocol', protocolId };
  }

  // FR-SIG-5: older than cadence × 1.5 → re-measure due.
  if (quality.stale === 'remeasure') {
    if (action.kind === 'none') action = actionFor(def, 'NO_DATA');
    explanation = `${explanation} ${remeasureNote(age)}`;
  }

  return {
    ...base,
    verdict: c.verdict,
    drivenBy: c.drivenBy,
    caughtOnlyByPersonal: c.caughtOnlyByPersonal,
    action,
    explanation,
  };
}

/** Per-signal input for assessMany(). */
export interface SignalInput {
  observations: readonly Observation[];
  /** Defaults to preflightOf(observations). */
  preflight?: RuleCtx['preflight'];
  /** Defaults to noPersonal(). */
  personal?: PersonalResult | LayerResult;
}

/**
 * Assesses several signals for one crew member (or the cabin) on one day, in the given order (use `signalList`),
 * filling ctx.sameDay with each space-layer result whose reading is from that day — so the sleep rule sees the
 * day's Reaction Self-Test. Signals for which `inputFor` returns undefined are skipped.
 */
export function assessMany(
  defs: readonly SignalDef[],
  base: Omit<RuleCtx, 'history' | 'preflight' | 'sameDay'>,
  inputFor: (def: SignalDef) => SignalInput | undefined,
): Assessment[] {
  const sameDay: RuleCtx['sameDay'] = {};
  const out: Assessment[] = [];
  for (const def of defs) {
    const input = inputFor(def);
    if (input === undefined) continue;
    const ctx: RuleCtx = {
      ...base,
      history: [...input.observations],
      preflight: input.preflight ?? preflightOf(input.observations),
      sameDay: { ...sameDay },
    };
    const a = assessSignal(def, input.observations, ctx, input.personal ?? noPersonal());
    if (a.latest?.missionDay === base.missionDay) sameDay[def.id] = a.layers.space;
    out.push(a);
  }
  return out;
}
