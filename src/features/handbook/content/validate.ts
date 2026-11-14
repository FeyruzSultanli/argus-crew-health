// Runtime validation of the statically imported content JSON (seed/protocols.json, seed/limits.json).
// Throws ContentValidationError with a path to the bad field; the modules that import the JSON call these at load.
import type { LayerId, SignalId } from '../../../domain/types';
import { SYMPTOM_KEYS } from '../../../domain/signals/symptoms';
import { CANONICAL_UNIT } from '../../../domain/units';
import { PROTOCOL_IDS, isProtocolId } from './protocolIds';
import type {
  DataKind,
  KnownGap,
  LimitsContent,
  LimitsRow,
  Protocol,
  ProtocolStep,
  ProtocolsFile,
  TriggerNode,
  TriggerRule,
  VerdictCondition,
} from './types';

export class ContentValidationError extends Error {
  constructor(path: string, problem: string) {
    super(`${path}: ${problem}`);
    this.name = 'ContentValidationError';
  }
}

type Obj = Record<string, unknown>;

const SIGNAL_IDS = new Set<string>(Object.keys(CANONICAL_UNIT));
const SYMPTOMS = new Set<string>(SYMPTOM_KEYS);
const LAYERS = new Set<string>(['personal', 'space', 'earth'] satisfies LayerId[]);
const AT_LEAST = new Set<string>(['EXPECTED', 'WATCH', 'ACT'] satisfies VerdictCondition['atLeast'][]);
const DATA_KINDS: readonly DataKind[] = ['real', 'measured', 'simulated', 'modeled', 'demo', 'experimental'];
const SOURCE_ID = /^SRC_[A-Z0-9_]+$/;

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    throw new ContentValidationError(path, 'not an object');
  return v as Obj;
}
function str(v: unknown, path: string, { allowEmpty = false } = {}): string {
  if (typeof v !== 'string' || (!allowEmpty && v.trim() === '')) {
    throw new ContentValidationError(path, 'not a non-empty string');
  }
  return v;
}
function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new ContentValidationError(path, 'not an array');
  return v;
}
function strList(v: unknown, path: string): string[] {
  return arr(v, path).map((x, i) => str(x, `${path}[${i}]`));
}
function sourceList(v: unknown, path: string): string[] {
  const ids = strList(v, path);
  ids.forEach((id, i) => {
    if (!SOURCE_ID.test(id)) throw new ContentValidationError(`${path}[${i}]`, `"${id}" is not a SRC_* id`);
  });
  return ids;
}
function signalList(v: unknown, path: string): SignalId[] {
  return strList(v, path).map((s, i) => {
    if (!SIGNAL_IDS.has(s)) throw new ContentValidationError(`${path}[${i}]`, `unknown signal "${s}"`);
    return s as SignalId;
  });
}

// ---- protocols ----

function triggerNode(v: unknown, path: string): TriggerNode {
  const o = obj(v, path);
  if ('all' in o || 'any' in o) return triggerRule(o, path);
  if ('signal' in o) {
    const signal = str(o.signal, `${path}.signal`);
    if (!SIGNAL_IDS.has(signal))
      throw new ContentValidationError(`${path}.signal`, `unknown signal "${signal}"`);
    const atLeast = str(o.atLeast, `${path}.atLeast`);
    if (!AT_LEAST.has(atLeast))
      throw new ContentValidationError(`${path}.atLeast`, `invalid verdict "${atLeast}"`);
    const cond: VerdictCondition = {
      signal: signal as SignalId,
      atLeast: atLeast as VerdictCondition['atLeast'],
    };
    if (o.layer !== undefined) {
      const layer = str(o.layer, `${path}.layer`);
      if (!LAYERS.has(layer)) throw new ContentValidationError(`${path}.layer`, `invalid layer "${layer}"`);
      cond.layer = layer as LayerId;
    }
    return cond;
  }
  if ('symptom' in o) {
    const symptom = str(o.symptom, `${path}.symptom`);
    if (!SYMPTOMS.has(symptom))
      throw new ContentValidationError(`${path}.symptom`, `unknown symptom "${symptom}"`);
    return { symptom: symptom as (typeof SYMPTOM_KEYS)[number] };
  }
  if ('cabin' in o) {
    if (o.cabin !== 'co2Avg7dMmHg') throw new ContentValidationError(`${path}.cabin`, 'unknown cabin metric');
    if (typeof o.atLeast !== 'number') throw new ContentValidationError(`${path}.atLeast`, 'not a number');
    return { cabin: 'co2Avg7dMmHg', atLeast: o.atLeast };
  }
  if ('spaceWeather' in o) {
    if (o.spaceWeather === 's100Alert') return { spaceWeather: 's100Alert' };
    if (o.spaceWeather === 'sScale' && typeof o.atLeast === 'number' && o.atLeast >= 0 && o.atLeast <= 5) {
      return { spaceWeather: 'sScale', atLeast: o.atLeast };
    }
    throw new ContentValidationError(path, 'invalid spaceWeather condition');
  }
  throw new ContentValidationError(path, 'unknown trigger condition');
}

function triggerRule(v: unknown, path: string): TriggerRule {
  const o = obj(v, path);
  const hasAll = 'all' in o;
  const hasAny = 'any' in o;
  if (hasAll === hasAny) throw new ContentValidationError(path, 'a group needs exactly one of "all" / "any"');
  const key = hasAll ? 'all' : 'any';
  const nodes = arr(o[key], `${path}.${key}`).map((n, i) => triggerNode(n, `${path}.${key}[${i}]`));
  if (nodes.length === 0) throw new ContentValidationError(`${path}.${key}`, 'empty group');
  return hasAll ? { all: nodes } : { any: nodes };
}

function step(v: unknown, path: string): ProtocolStep {
  const o = obj(v, path);
  const tag = str(o.tag, `${path}.tag`);
  if (tag !== 'source' && tag !== 'demo wording')
    throw new ContentValidationError(`${path}.tag`, `invalid tag "${tag}"`);
  const sourceIds = sourceList(o.sourceIds, `${path}.sourceIds`);
  if (tag === 'source' && sourceIds.length === 0) {
    throw new ContentValidationError(`${path}.sourceIds`, 'a "source" step needs at least one source id');
  }
  if (tag === 'demo wording' && sourceIds.length > 0) {
    throw new ContentValidationError(`${path}.sourceIds`, 'a "demo wording" step carries no source id');
  }
  const out: ProtocolStep = {
    id: str(o.id, `${path}.id`),
    text: str(o.text, `${path}.text`),
    tag,
    sourceIds,
    tableText: o.tableText === null ? null : str(o.tableText, `${path}.tableText`),
  };
  if (o.timerSec !== undefined) {
    if (typeof o.timerSec !== 'number' || !Number.isInteger(o.timerSec) || o.timerSec <= 0) {
      throw new ContentValidationError(`${path}.timerSec`, 'not a positive integer');
    }
    out.timerSec = o.timerSec;
  }
  if (o.kind !== undefined) {
    if (o.kind !== 'send-to-surgeon') throw new ContentValidationError(`${path}.kind`, 'invalid kind');
    out.kind = 'send-to-surgeon';
  }
  return out;
}

export const SEND_TO_SURGEON_TEXT = 'Send a report to the flight surgeon.';

function protocol(v: unknown, path: string): Protocol {
  const o = obj(v, path);
  const id = str(o.id, `${path}.id`);
  if (!isProtocolId(id)) throw new ContentValidationError(`${path}.id`, `"${id}" is not a ProtocolId`);
  const steps = arr(o.steps, `${path}.steps`).map((s, i) => step(s, `${path}.steps[${i}]`));
  if (steps.length < 4 || steps.length > 8) {
    throw new ContentValidationError(`${path}.steps`, `doc 07 §5 asks for 4–8 steps, found ${steps.length}`);
  }
  if (new Set(steps.map((s) => s.id)).size !== steps.length) {
    throw new ContentValidationError(`${path}.steps`, 'duplicate step ids');
  }
  steps.forEach((s, i) => {
    const last = i === steps.length - 1;
    if (last !== (s.kind === 'send-to-surgeon')) {
      throw new ContentValidationError(
        `${path}.steps[${i}]`,
        'only the last step is the send-to-surgeon step',
      );
    }
    if (last && s.text !== SEND_TO_SURGEON_TEXT) {
      throw new ContentValidationError(
        `${path}.steps[${i}].text`,
        `end step must read "${SEND_TO_SURGEON_TEXT}"`,
      );
    }
  });
  return {
    id,
    title: str(o.title, `${path}.title`),
    summary: str(o.summary, `${path}.summary`),
    trigger: str(o.trigger, `${path}.trigger`),
    triggerPlain: str(o.triggerPlain, `${path}.triggerPlain`),
    triggerRule: triggerRule(o.triggerRule, `${path}.triggerRule`),
    triggerSourceIds: sourceList(o.triggerSourceIds, `${path}.triggerSourceIds`),
    sourceIds: sourceList(o.sourceIds, `${path}.sourceIds`),
    relatedSignalIds: signalList(o.relatedSignalIds, `${path}.relatedSignalIds`),
    keywords: strList(o.keywords, `${path}.keywords`),
    steps,
  };
}

/** Validates seed/protocols.json: exactly the five ProtocolIds, in doc 07 §5 table order. */
export function validateProtocols(raw: unknown): ProtocolsFile {
  const o = obj(raw, 'protocols.json');
  const protocols = arr(o.protocols, 'protocols').map((p, i) => protocol(p, `protocols[${i}]`));
  const ids = protocols.map((p) => p.id);
  if (ids.join(',') !== PROTOCOL_IDS.join(',')) {
    throw new ContentValidationError(
      'protocols',
      `ids must be exactly ${PROTOCOL_IDS.join(', ')} in this order`,
    );
  }
  return { _note: str(o._note, '_note'), protocols };
}

// ---- limits ----

function row(v: unknown, path: string): LimitsRow {
  const o = obj(v, path);
  const kind = str(o.kind, `${path}.kind`);
  if (!(DATA_KINDS as readonly string[]).includes(kind)) {
    throw new ContentValidationError(`${path}.kind`, `invalid kind "${kind}"`);
  }
  const out: LimitsRow = {
    id: str(o.id, `${path}.id`),
    kind: kind as DataKind,
    label: str(o.label, `${path}.label`),
    detail: str(o.detail, `${path}.detail`),
    sourceIds: sourceList(o.sourceIds, `${path}.sourceIds`),
  };
  if (o.availability !== undefined) {
    if (o.availability !== 'unavailable' && o.availability !== 'not-built') {
      throw new ContentValidationError(`${path}.availability`, 'invalid availability');
    }
    out.availability = o.availability;
  }
  return out;
}

function gap(v: unknown, path: string): KnownGap {
  const o = obj(v, path);
  return {
    id: str(o.id, `${path}.id`),
    label: str(o.label, `${path}.label`),
    detail: str(o.detail, `${path}.detail`),
    sourceIds: sourceList(o.sourceIds, `${path}.sourceIds`),
  };
}

/** Validates seed/limits.json. */
export function validateLimits(raw: unknown): LimitsContent {
  const o = obj(raw, 'limits.json');
  const labels = obj(o.kindLabels, 'kindLabels');
  const kindLabels = Object.fromEntries(
    DATA_KINDS.map((k) => [k, str(labels[k], `kindLabels.${k}`)]),
  ) as Record<DataKind, string>;
  const dataKinds = arr(o.dataKinds, 'dataKinds').map((r, i) => row(r, `dataKinds[${i}]`));
  for (const k of DATA_KINDS) {
    if (!dataKinds.some((r) => r.kind === k))
      throw new ContentValidationError('dataKinds', `no row of kind "${k}"`);
  }
  const ids = dataKinds.map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new ContentValidationError('dataKinds', 'duplicate row ids');
  const v = obj(o.rppgValidation, 'rppgValidation');
  if (typeof v.done !== 'boolean') throw new ContentValidationError('rppgValidation.done', 'not a boolean');
  return {
    _note: str(o._note, '_note'),
    kindLabels,
    dataKinds,
    notMedicalDevice: str(o.notMedicalDevice, 'notMedicalDevice'),
    nonGoals: strList(o.nonGoals, 'nonGoals'),
    knownGaps: arr(o.knownGaps, 'knownGaps').map((g, i) => gap(g, `knownGaps[${i}]`)),
    rppgValidation: { done: v.done, placeholder: str(v.placeholder, 'rppgValidation.placeholder') },
  };
}
