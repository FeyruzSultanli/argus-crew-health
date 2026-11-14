// The band evaluation rule of doc 07 §4, implemented once:
//   1. round the value to the signal's display precision;
//   2. test bands in the order ACT → WATCH → EXPECTED → NOMINAL and return the first match;
//   3. a value that matches no listed band is NOMINAL.
// Ranges `a–b` include both ends. Every band edge marked [demo] cites SRC_DEMO_RULE_BANDS.
import type { LayerId, LayerResult } from '../types';
import { roundTo } from '../units';
import { SRC_DEMO_RULE_BANDS, layerResult } from './layer';

export type BandVerdict = 'ACT' | 'WATCH' | 'EXPECTED' | 'NOMINAL';

export interface Band {
  verdict: BandVerdict;
  /** Lower edge (inclusive unless minExclusive). Omitted = no lower edge. */
  min?: number;
  minExclusive?: boolean;
  /** Upper edge (inclusive unless maxExclusive). Omitted = no upper edge. */
  max?: number;
  maxExclusive?: boolean;
  /** Band edge marked [demo] in doc 07 → cites SRC_DEMO_RULE_BANDS. */
  demo?: boolean;
  /** Plain-language reason; `{v}` is replaced by the rounded value with unit. ≤ 140 chars after substitution. */
  reason: string;
  /** Extra sources for this band only (added to the rule's sourceIds). */
  sourceIds?: string[];
}

export interface BandRule {
  id: string;
  layer: LayerId;
  /** Decimals of the display precision (doc 07 §4). */
  precision: number;
  /** Unit shown after the value in reasons ("bpm", "°C", "%"). */
  unit: string;
  bands: Band[];
  /** Sources cited by every result of this rule (the real id from the doc line). */
  sourceIds: string[];
  /** Reason for the "matches no band" NOMINAL fallback. */
  nominalReason: string;
}

/** Decimals kept when stripping floating-point noise before display rounding. */
export const FP_GUARD_DECIMALS = 9;

const ORDER: readonly BandVerdict[] = ['ACT', 'WATCH', 'EXPECTED', 'NOMINAL'];

export function inBand(value: number, band: Band): boolean {
  if (band.min !== undefined && (band.minExclusive === true ? value <= band.min : value < band.min))
    return false;
  if (band.max !== undefined && (band.maxExclusive === true ? value >= band.max : value > band.max))
    return false;
  return true;
}

export interface BandMatch {
  verdict: BandVerdict;
  band?: Band;
  rounded: number;
}

/** Steps 1–3 of the band rule. */
export function matchBand(value: number, precision: number, bands: readonly Band[]): BandMatch {
  // Strip floating-point noise first (e.g. 6.949999999999999 from a mean of three 6.95) so it cannot push a
  // value across a .5 rounding edge; then round to the display precision.
  const rounded = roundTo(roundTo(value, FP_GUARD_DECIMALS), precision);
  for (const verdict of ORDER) {
    const band = bands.find((b) => b.verdict === verdict && inBand(rounded, b));
    if (band !== undefined) return { verdict, band, rounded };
  }
  return { verdict: 'NOMINAL', rounded };
}

function withUnit(rounded: number, precision: number, unit: string): string {
  const text = rounded.toFixed(precision);
  if (unit === '') return text;
  return unit === '%' ? `${text}%` : `${text} ${unit}`;
}

/** Evaluates a BandRule into a LayerResult with reason, sourceIds and numbers { value }. */
export function evaluateBands(
  rule: BandRule,
  value: number,
  extraNumbers?: Record<string, number>,
): LayerResult {
  const m = matchBand(value, rule.precision, rule.bands);
  const anyDemo = rule.bands.some((b) => b.demo === true);
  const demo = m.band !== undefined ? m.band.demo === true : anyDemo;
  const template = m.band?.reason ?? rule.nominalReason;
  const reason = template.replaceAll('{v}', withUnit(m.rounded, rule.precision, rule.unit));
  const sourceIds = [...rule.sourceIds, ...(m.band?.sourceIds ?? []), ...(demo ? [SRC_DEMO_RULE_BANDS] : [])];
  return layerResult(rule.layer, m.verdict, reason, sourceIds, rule.id, {
    value: m.rounded,
    ...extraNumbers,
  });
}
