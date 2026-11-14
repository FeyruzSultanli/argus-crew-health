// LayerResult constructors and severity helpers shared by every rule (doc 07 §3, §4).
import type { LayerId, LayerResult, Verdict } from '../types';

/** Severity order of doc 07 §3 step 3. NO_DATA (n/a) is −1 so it never wins. */
export function sev(v: Verdict): number {
  switch (v) {
    case 'NOMINAL':
      return 0;
    case 'EXPECTED':
      return 1;
    case 'WATCH':
      return 2;
    case 'ACT':
      return 3;
    case 'NO_DATA':
      return -1;
  }
}

/** Shared demo registry entry for every band edge marked [demo] in doc 07 §4. */
export const SRC_DEMO_RULE_BANDS = 'SRC_DEMO_RULE_BANDS';

export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function layerResult(
  layer: LayerId,
  verdict: Verdict,
  reason: string,
  sourceIds: readonly string[],
  ruleId?: string,
  numbers?: Record<string, number>,
): LayerResult {
  const r: LayerResult = { layer, verdict, reason, sourceIds: uniqueIds(sourceIds) };
  if (ruleId !== undefined) r.ruleId = ruleId;
  if (numbers !== undefined) r.numbers = numbers;
  return r;
}

/** A layer that does not apply (no rule, or a needed input is missing) → NO_DATA (n/a). */
export function notApplicable(layer: LayerId, reason: string, ruleId?: string): LayerResult {
  return layerResult(layer, 'NO_DATA', reason, [], ruleId);
}

/**
 * The worst of several partial results of one layer (e.g. systolic vs diastolic, or CO₂ 1-h vs 7-day).
 * Ties keep the first. Source ids of every result at the worst severity are merged; numbers are merged.
 */
export function worstOf(results: readonly LayerResult[]): LayerResult {
  const first = results[0];
  if (first === undefined) throw new Error('worstOf needs at least one result');
  let worst = first;
  for (const r of results) if (sev(r.verdict) > sev(worst.verdict)) worst = r;
  const tied = results.filter((r) => r.verdict === worst.verdict);
  const numbers: Record<string, number> = {};
  for (const r of results) Object.assign(numbers, r.numbers ?? {});
  return layerResult(
    worst.layer,
    worst.verdict,
    worst.reason,
    tied.flatMap((r) => r.sourceIds),
    worst.ruleId,
    Object.keys(numbers).length > 0 ? numbers : undefined,
  );
}

/** Copies a LayerResult (or PersonalResult) into a plain personal LayerResult (drops `series`). */
export function asLayer(r: LayerResult, layer: LayerId): LayerResult {
  return layerResult(layer, r.verdict, r.reason, r.sourceIds, r.ruleId, r.numbers);
}
