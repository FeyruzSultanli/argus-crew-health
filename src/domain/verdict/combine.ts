// Combining the three layers + quality into one verdict — doc 07 §3 steps 1–9, implemented exactly.
import { sev } from '../rules/layer';
import type { Assessment, LayerId, LayerResult, Quality, SignalDef, Verdict } from '../types';
import { QUALITY_GATE_ACTION, actionFor, toAction } from './actions';
import { explainCombined } from './explain';

export type CombineRule = 'no-data' | 'adaptation-downgrade' | 'earth-act-softened' | 'max-severity';
export type QualityGate = 'none' | 'poor-cap' | 'fair-personal-act';

export interface CombineResult {
  verdict: Verdict;
  drivenBy: LayerId[];
  caughtOnlyByPersonal: boolean;
  action: Assessment['action'];
  /** Which branch of steps 2/4/5 decided the verdict. */
  rule: CombineRule;
  /** Which quality gate of step 6 fired. */
  qualityGate: QualityGate;
  /** Verdict before the quality gate. */
  preGateVerdict: Verdict;
  explanation: string;
}

const LAYER_ORDER: readonly LayerId[] = ['personal', 'space', 'earth'];
const SEV_TO_VERDICT: readonly Verdict[] = ['NOMINAL', 'EXPECTED', 'WATCH', 'ACT'];

/** Personal ∈ {NOMINAL, EXPECTED, n/a} — the condition of the adaptation downgrade (step 4). */
const personalQuiet = (v: Verdict): boolean => v === 'NOMINAL' || v === 'EXPECTED' || v === 'NO_DATA';

/** Step 7: sev(personal) ≥ 2 AND sev(space) ≤ 1 AND sev(earth) ≤ 1, n/a counted as ≤ 1. */
export function isCaughtOnlyByPersonal(personal: Verdict, space: Verdict, earth: Verdict): boolean {
  return sev(personal) >= 2 && sev(space) <= 1 && sev(earth) <= 1;
}

export function combine(
  personal: LayerResult,
  space: LayerResult,
  earth: LayerResult,
  quality: Quality,
  def: Pick<SignalDef, 'actions' | 'label'>,
): CombineResult {
  const layers: Record<LayerId, LayerResult> = { personal, space, earth };
  const caughtOnlyByPersonal = isCaughtOnlyByPersonal(personal.verdict, space.verdict, earth.verdict);

  // Steps 1–2: ignore NO_DATA layers; none left → NO_DATA.
  const present = LAYER_ORDER.filter((id) => layers[id].verdict !== 'NO_DATA');
  if (present.length === 0) {
    const base = {
      verdict: 'NO_DATA' as const,
      drivenBy: [],
      caughtOnlyByPersonal: false,
      action: actionFor(def, 'NO_DATA'),
      rule: 'no-data' as const,
      qualityGate: 'none' as const,
      preGateVerdict: 'NO_DATA' as const,
    };
    return { ...base, explanation: explainCombined({ ...base, layers, quality, label: def.label }) };
  }

  // Steps 4–5.
  let verdict: Verdict;
  let drivenBy: LayerId[];
  let rule: CombineRule;
  if (earth.verdict === 'WATCH' && space.verdict === 'EXPECTED' && personalQuiet(personal.verdict)) {
    verdict = 'EXPECTED';
    drivenBy = ['space'];
    rule = 'adaptation-downgrade';
  } else if (earth.verdict === 'ACT' && space.verdict === 'EXPECTED' && personalQuiet(personal.verdict)) {
    verdict = 'WATCH';
    drivenBy = ['earth', 'space'];
    rule = 'earth-act-softened';
  } else {
    const max = Math.max(...present.map((id) => sev(layers[id].verdict)));
    verdict = SEV_TO_VERDICT[max] as Verdict;
    drivenBy = present.filter((id) => sev(layers[id].verdict) === max);
    rule = 'max-severity';
  }
  const preGateVerdict = verdict;

  // Step 6: quality gate.
  let qualityGate: QualityGate = 'none';
  if (quality.label === 'poor') {
    if (sev(verdict) > sev('WATCH')) verdict = 'WATCH';
    qualityGate = 'poor-cap';
  } else if (
    quality.label === 'fair' &&
    verdict === 'ACT' &&
    drivenBy.length === 1 &&
    drivenBy[0] === 'personal'
  ) {
    verdict = 'WATCH';
    qualityGate = 'fair-personal-act';
  }

  // Step 8 (step 6 wins: a poor reading keeps the re-measure action).
  const action = qualityGate === 'poor-cap' ? toAction(QUALITY_GATE_ACTION) : actionFor(def, verdict);

  const result = { verdict, drivenBy, caughtOnlyByPersonal, action, rule, qualityGate, preGateVerdict };
  return { ...result, explanation: explainCombined({ ...result, layers, quality, label: def.label }) };
}
