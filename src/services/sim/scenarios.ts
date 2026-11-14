// Demo scenarios (seed/scenarios.json, doc 12 §4): typed shape, run-time validation, and the per-day effect lookup
// the generator uses. All scenario effects are simulated demo content [SRC_DEMO_SIMULATION].
import type { SignalId } from '../../domain/types';

export interface ScenarioEffect {
  absolute?: number[];            // heart_rate_rest: replaces the generated value exactly
  noise?: boolean;
  delta?: number[];               // mood: added to the generated value
  deltaC?: number[];              // body_temp: added to the generated value (°C)
  absoluteMmHg?: number[];        // cabin_co2: replaces the generated value
  absoluteHours?: number[];       // sleep_duration: replaces the generated value
  add?: string[];                 // symptoms: symptom ids reported
  crewIds?: string[];             // symptoms: who reports them
  lapsesDelta?: number;           // reaction_test: added lapses on `onDays` (extra test days)
  onDays?: number[];
  eye?: 'left' | 'right';         // amsler / near_acuity
  newPeripheralCells?: number;
  deltaLogMAR?: number;
  replay?: string;                // radiation (not generated here)
  speed?: number;
  offsetFromPreflightHours?: number; // normal-adaptation: in-flight sleep offset
  sdHours?: number;
}

export interface ScenarioDef {
  id: string;
  label: string;
  crewIds: string[];
  days: number[] | 'all-inflight';
  effects: Partial<Record<SignalId | 'radiation', ScenarioEffect>>;
  demonstrates: string;
}

const EFFECT_KEYS: ReadonlySet<string> = new Set([
  'heart_rate_rest', 'body_temp', 'mood', 'cabin_co2', 'symptoms', 'sleep_duration', 'reaction_test', 'amsler',
  'near_acuity', 'radiation',
]);
const NUMBER_ARRAY_FIELDS = ['absolute', 'delta', 'deltaC', 'absoluteMmHg', 'absoluteHours'] as const;

const isNumArray = (x: unknown): x is number[] => Array.isArray(x) && x.every((n) => typeof n === 'number');
const isStrArray = (x: unknown): x is string[] => Array.isArray(x) && x.every((n) => typeof n === 'string');

function fail(id: string, msg: string): never {
  throw new Error(`seed/scenarios.json: scenario "${id}": ${msg}`);
}

/** Validates the parsed scenarios file against ScenarioDef; throws a descriptive error on any mismatch. */
export function validateScenarios(json: unknown, knownCrewIds: readonly string[]): ScenarioDef[] {
  const list = (json as { scenarios?: unknown }).scenarios;
  if (!Array.isArray(list)) throw new Error('seed/scenarios.json: `scenarios` must be an array');
  const known = new Set([...knownCrewIds, 'cabin']);
  return list.map((raw: unknown): ScenarioDef => {
    const s = raw as Record<string, unknown>;
    const id = typeof s.id === 'string' ? s.id : fail('?', 'id must be a string');
    if (typeof s.label !== 'string') fail(id, 'label must be a string');
    if (typeof s.demonstrates !== 'string') fail(id, 'demonstrates must be a string');
    if (!isStrArray(s.crewIds)) fail(id, 'crewIds must be a string array');
    for (const c of s.crewIds) if (!known.has(c)) fail(id, `unknown crew id ${c}`);
    const days = s.days;
    if (days !== 'all-inflight') {
      if (!isNumArray(days) || days.length === 0) fail(id, 'days must be a non-empty number array or "all-inflight"');
      for (const d of days) if (!Number.isInteger(d) || d === 0) fail(id, `invalid mission day ${d}`);
    }
    if (typeof s.effects !== 'object' || s.effects === null) fail(id, 'effects must be an object');
    const effects = s.effects as Record<string, Record<string, unknown>>;
    for (const [key, eff] of Object.entries(effects)) {
      if (!EFFECT_KEYS.has(key)) fail(id, `unknown effect key ${key}`);
      for (const f of NUMBER_ARRAY_FIELDS) {
        if (eff[f] === undefined) continue;
        if (!isNumArray(eff[f])) fail(id, `${key}.${f} must be a number array`);
        if (Array.isArray(days) && eff[f].length !== days.length) fail(id, `${key}.${f} length ≠ days length`);
      }
      if (eff.onDays !== undefined && !isNumArray(eff.onDays)) fail(id, `${key}.onDays must be a number array`);
      if (eff.add !== undefined && !isStrArray(eff.add)) fail(id, `${key}.add must be a string array`);
      if (eff.crewIds !== undefined) {
        if (!isStrArray(eff.crewIds)) fail(id, `${key}.crewIds must be a string array`);
        for (const c of eff.crewIds) if (!known.has(c)) fail(id, `${key}: unknown crew id ${c}`);
      }
      if (eff.eye !== undefined && eff.eye !== 'left' && eff.eye !== 'right') fail(id, `${key}.eye must be left|right`);
      for (const f of ['lapsesDelta', 'newPeripheralCells', 'deltaLogMAR', 'speed', 'offsetFromPreflightHours', 'sdHours']) {
        if (eff[f] !== undefined && typeof eff[f] !== 'number') fail(id, `${key}.${f} must be a number`);
      }
    }
    return {
      id,
      label: s.label as string,
      crewIds: s.crewIds,
      days: days as number[] | 'all-inflight',
      effects: effects as ScenarioDef['effects'],
      demonstrates: s.demonstrates as string,
    };
  });
}

/** What the scenarios do to one (crew, signal, day[, eye]) reading. */
export interface DayEffect {
  absolute?: number;
  delta?: number;
  lapsesDelta?: number;
  symptoms?: string[];
  scenarioIds: string[];
}

export interface ScenarioIndex {
  get(crewId: string, signalId: SignalId, day: number, eye?: 'left' | 'right'): DayEffect | undefined;
  /** Extra reaction-test days per crew (scenario `onDays`). */
  extraReactionDays(crewId: string): number[];
  /** First day of a near_acuity scenario for this crew member (anticipation glasses in use from then on). */
  acuityGlassesFrom(crewId: string): number | undefined;
  /** In-flight sleep adaptation (normal-adaptation scenario), if present. */
  inflightSleep: { offsetHours: number; sdHours: number } | null;
}

const key = (crewId: string, signalId: string, day: number, eye?: string): string =>
  `${crewId}|${signalId}|${day}|${eye ?? ''}`;

export function indexScenarios(scenarios: readonly ScenarioDef[]): ScenarioIndex {
  const map = new Map<string, DayEffect>();
  const extra = new Map<string, number[]>();
  const glasses = new Map<string, number>();
  let inflightSleep: ScenarioIndex['inflightSleep'] = null;

  const add = (k: string, scenarioId: string, patch: Omit<DayEffect, 'scenarioIds'>): void => {
    const cur = map.get(k) ?? { scenarioIds: [] };
    if (patch.absolute !== undefined) cur.absolute = patch.absolute;
    if (patch.delta !== undefined) cur.delta = (cur.delta ?? 0) + patch.delta;
    if (patch.lapsesDelta !== undefined) cur.lapsesDelta = (cur.lapsesDelta ?? 0) + patch.lapsesDelta;
    if (patch.symptoms) cur.symptoms = [...(cur.symptoms ?? []), ...patch.symptoms];
    if (!cur.scenarioIds.includes(scenarioId)) cur.scenarioIds.push(scenarioId);
    map.set(k, cur);
  };

  for (const s of scenarios) {
    const e = s.effects;
    if (s.days === 'all-inflight') {
      const sl = e.sleep_duration;
      if (sl?.offsetFromPreflightHours !== undefined) {
        inflightSleep = { offsetHours: sl.offsetFromPreflightHours, sdHours: sl.sdHours ?? 0.35 };
      }
      continue;
    }
    const days = s.days;
    const crewOnly = s.crewIds.filter((c) => c !== 'cabin');
    days.forEach((day, i) => {
      for (const c of crewOnly) {
        if (e.heart_rate_rest?.absolute) add(key(c, 'heart_rate_rest', day), s.id, { absolute: e.heart_rate_rest.absolute[i] });
        if (e.body_temp?.deltaC) add(key(c, 'body_temp', day), s.id, { delta: e.body_temp.deltaC[i] });
        if (e.mood?.delta) add(key(c, 'mood', day), s.id, { delta: e.mood.delta[i] });
        if (e.sleep_duration?.absoluteHours) add(key(c, 'sleep_duration', day), s.id, { absolute: e.sleep_duration.absoluteHours[i] });
        if (e.amsler?.newPeripheralCells !== undefined && e.amsler.eye) {
          add(key(c, 'amsler', day, e.amsler.eye), s.id, { delta: e.amsler.newPeripheralCells });
        }
        if (e.near_acuity?.deltaLogMAR !== undefined && e.near_acuity.eye) {
          add(key(c, 'near_acuity', day, e.near_acuity.eye), s.id, { delta: e.near_acuity.deltaLogMAR });
          glasses.set(c, Math.min(glasses.get(c) ?? Infinity, day));
        }
      }
      if (e.cabin_co2?.absoluteMmHg && s.crewIds.includes('cabin')) {
        add(key('cabin', 'cabin_co2', day), s.id, { absolute: e.cabin_co2.absoluteMmHg[i] });
      }
      if (e.symptoms?.add) {
        for (const c of e.symptoms.crewIds ?? crewOnly) add(key(c, 'symptoms', day), s.id, { symptoms: e.symptoms.add });
      }
    });
    const rt = e.reaction_test;
    if (rt?.lapsesDelta !== undefined) {
      for (const c of crewOnly) {
        for (const day of rt.onDays ?? days) {
          add(key(c, 'reaction_test', day), s.id, { lapsesDelta: rt.lapsesDelta });
          extra.set(c, [...(extra.get(c) ?? []), day]);
        }
      }
    }
  }

  return {
    get: (crewId, signalId, day, eye) => map.get(key(crewId, signalId, day, eye)),
    extraReactionDays: (crewId) => extra.get(crewId) ?? [],
    acuityGlassesFrom: (crewId) => glasses.get(crewId),
    inflightSleep,
  };
}
