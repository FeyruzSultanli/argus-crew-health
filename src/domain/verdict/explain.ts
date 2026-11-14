// Plain-language explanation strings for a combined verdict (FR-SIG-2). 1–2 sentences, no diagnosis wording.
import type { LayerId, LayerResult, Quality, Verdict } from '../types';

export const LAYER_NAMES: Record<LayerId, string> = {
  personal: 'Personal baseline',
  space: 'Space rule',
  earth: 'Earth reference',
};

/** UI copy of doc 07 §2. */
export const VERDICT_MEANING: Record<Verdict, string> = {
  NOMINAL: 'Within your usual range.',
  EXPECTED: 'A known change in space. Keep doing your countermeasures.',
  WATCH: 'Unusual. Re-measure and keep an eye on it.',
  ACT: 'Needs action now. Follow the next step and tell the CMO.',
  NO_DATA: 'No recent reading. Measure to update.',
};

export const ADAPTATION_EXPLANATION = 'Earth would flag this, but it is a known adaptation in space.';
export const EARTH_ACT_SOFTENED_EXPLANATION =
  'Earth would rate this as urgent, but it is a known adaptation in space, so it is softened by one level to Watch.';
export const CAUGHT_ONLY_BY_PERSONAL_NOTE =
  'Only your personal baseline caught this; the Earth and space rules do not flag it.';
export const POOR_QUALITY_NOTE = 'Reading quality is poor, so the verdict is capped at Watch. Re-measure.';
export const FAIR_PERSONAL_ACT_NOTE =
  'Reading quality is only fair, so a personal-only Act is shown as Watch until it is confirmed.';

export interface ExplainInput {
  verdict: Verdict;
  rule: 'no-data' | 'adaptation-downgrade' | 'earth-act-softened' | 'max-severity';
  drivenBy: LayerId[];
  caughtOnlyByPersonal: boolean;
  qualityGate: 'none' | 'poor-cap' | 'fair-personal-act';
  layers: Record<LayerId, LayerResult>;
  quality: Quality;
  label: string;
}

function ensureStop(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Layer names inside a sentence. */
const INLINE_NAMES: Record<LayerId, string> = {
  personal: 'personal baseline',
  space: 'space rule',
  earth: 'Earth reference',
};

function joinNames(ids: readonly LayerId[]): string {
  const names = ids.map((id) => INLINE_NAMES[id]);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/** The main sentence: which layer decided, in its own words. */
function primary(input: ExplainInput): string {
  const { rule, drivenBy, layers, verdict } = input;
  if (rule === 'no-data') return VERDICT_MEANING.NO_DATA;
  if (rule === 'adaptation-downgrade') return ADAPTATION_EXPLANATION;
  if (rule === 'earth-act-softened') return EARTH_ACT_SOFTENED_EXPLANATION;
  const lead = drivenBy[0];
  if (lead === undefined) return VERDICT_MEANING[verdict];
  const reason = ensureStop(layers[lead].reason);
  if (verdict === 'NOMINAL') return `${LAYER_NAMES[lead]}: ${reason}`;
  if (drivenBy.length === 1) return `${LAYER_NAMES[lead]}: ${reason}`;
  return `Flagged by the ${joinNames(drivenBy)}. ${LAYER_NAMES[lead]}: ${reason}`;
}

/** One optional second sentence, by priority: quality gate, then "caught only by personal". */
function note(input: ExplainInput): string | undefined {
  if (input.qualityGate === 'poor-cap') return POOR_QUALITY_NOTE;
  if (input.qualityGate === 'fair-personal-act') return FAIR_PERSONAL_ACT_NOTE;
  if (input.caughtOnlyByPersonal && input.rule !== 'no-data') return CAUGHT_ONLY_BY_PERSONAL_NOTE;
  return undefined;
}

export function explainCombined(input: ExplainInput): string {
  const n = note(input);
  const p = primary(input);
  return n === undefined ? p : `${p} ${n}`;
}

/** Explanation when the newest reading is too old to judge (FR-SIG-5 'no-data'). */
export function explainStale(ageDays: number | null): string {
  if (ageDays === null) return VERDICT_MEANING.NO_DATA;
  return `No recent reading: the last one is ${ageDays} d old. Measure to update.`;
}

/** Extra sentence when a re-measure is due (FR-SIG-5 'remeasure'). */
export function remeasureNote(ageDays: number): string {
  return `The last reading is ${ageDays} d old; re-measure soon.`;
}
