// Pure evaluator for protocol trigger rules (seed/protocols.json `triggerRule`). The UI / Ask box fills the facts
// from today's assessments, symptom checklist, cabin snapshot and space-weather state.
import type { LayerId, SignalId, Verdict } from '../../../domain/types';
import type { SymptomKey } from '../../../domain/signals/symptoms';
import type { TriggerNode, TriggerRule } from './types';

export interface TriggerFacts {
  /** Per signal: the combined verdict and (optionally) each layer's verdict. */
  verdicts?: Partial<Record<SignalId, { combined?: Verdict } & Partial<Record<LayerId, Verdict>>>>;
  /** Symptoms ticked today. */
  symptoms?: readonly SymptomKey[];
  cabin?: { co2Avg7dMmHg?: number };
  spaceWeather?: { sScale?: number; s100Alert?: boolean };
}

const SEVERITY: Record<Verdict, number> = { NO_DATA: -1, NOMINAL: 0, EXPECTED: 1, WATCH: 2, ACT: 3 };

/** True when the node holds for the facts. Missing facts never satisfy a condition. */
export function evaluateTrigger(node: TriggerNode | TriggerRule, facts: TriggerFacts): boolean {
  if ('all' in node) return node.all.every((n) => evaluateTrigger(n, facts));
  if ('any' in node) return node.any.some((n) => evaluateTrigger(n, facts));
  if ('signal' in node) {
    const v = facts.verdicts?.[node.signal];
    const verdict = node.layer === undefined ? v?.combined : v?.[node.layer];
    return verdict !== undefined && SEVERITY[verdict] >= SEVERITY[node.atLeast];
  }
  if ('symptom' in node) return facts.symptoms?.includes(node.symptom) ?? false;
  if ('cabin' in node) {
    const value = facts.cabin?.co2Avg7dMmHg;
    return value !== undefined && value >= node.atLeast;
  }
  if (node.spaceWeather === 's100Alert') return facts.spaceWeather?.s100Alert === true;
  const s = facts.spaceWeather?.sScale;
  return s !== undefined && s >= node.atLeast;
}
