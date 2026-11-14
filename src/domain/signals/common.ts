// Small helpers shared by the signal definitions.
import type { LayerId, LayerResult, Observation } from '../types';
import { notApplicable } from '../rules/layer';

/** NASA HRP risk page used for every signal's `nasaRiskIds` (doc 07 §4, FR-SIG-7). */
export const NASA_RISKS = 'SRC_NASA_RISKS';

/** Earth layer for signals with no Earth rule (doc 07 §4 "E: n/a"). */
export function earthNotApplicable(signal: string): () => LayerResult {
  return () =>
    notApplicable('earth', 'No Earth reference rule is used for this signal.', `${signal}.earth.na`);
}

/** Space layer for signals with no space rule. */
export function spaceNotApplicable(signal: string, reason: string): () => LayerResult {
  return () => notApplicable('space', reason, `${signal}.space.na`);
}

/** The primary numeric value, or an n/a result when the reading has none. */
export function valueOf(o: Observation, layer: LayerId, ruleId: string): number | LayerResult {
  if (typeof o.value === 'number' && Number.isFinite(o.value)) return o.value;
  return notApplicable(layer, 'This reading has no numeric value.', ruleId);
}

export function isResult(x: number | LayerResult): x is LayerResult {
  return typeof x !== 'number';
}
