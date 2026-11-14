// One-line status summary for the hero strip (doc 11 §5.1). Built only from assessments: ACT first, then WATCH,
// then EXPECTED adaptations. Uses signal labels and the verdict words of doc 07 §2 / doc 11 §7 only; anything more
// specific is shown elsewhere verbatim from assessment.action.text / explanation. Pure.
import { SIGNALS } from '../../domain/signals';
import type { Assessment, Verdict } from '../../domain/types';

const MAX_NAMED = 3;

/** Label inside a sentence: lower-case first letter, except names with inner capitals (Reaction Self-Test, Cabin CO₂) or proper names. */
export function labelInSentence(label: string): string {
  if (/[A-Z]/.test(label.slice(1)) || /^Amsler\b/.test(label)) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function listOf(labels: string[]): string {
  const shown = labels.slice(0, MAX_NAMED);
  const more = labels.length - shown.length;
  const parts = more > 0 ? [...shown, `${more} more`] : shown;
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const labelsWith = (list: readonly Assessment[], v: Verdict): string[] =>
  list.filter((a) => a.verdict === v).map((a) => labelInSentence(SIGNALS[a.signalId].label));

/**
 * E.g. "Resting heart rate needs action now; body temperature is on watch. Expected in space: sleep duration and
 * hematocrit." At most two sentences (doc 11 §7). Cabin assessments are ignored.
 */
export function summarize(assessments: readonly Assessment[]): string {
  const own = assessments.filter((a) => a.crewId !== 'cabin');
  if (own.length === 0 || own.every((a) => a.verdict === 'NO_DATA'))
    return 'No recent readings. Measure to update.';
  const act = labelsWith(own, 'ACT');
  const watch = labelsWith(own, 'WATCH');
  const expected = labelsWith(own, 'EXPECTED');
  const flags: string[] = [];
  if (act.length) flags.push(`${listOf(act)} ${act.length > 1 ? 'need' : 'needs'} action now`);
  if (watch.length) flags.push(`${listOf(watch)} ${watch.length > 1 ? 'are' : 'is'} on watch`);
  const first = flags.length
    ? `${cap(flags.join('; '))}.`
    : expected.length
      ? 'Nothing on Watch or Act.'
      : 'All signals within your usual range.';
  return expected.length ? `${first} Expected in space: ${listOf(expected)}.` : first;
}

/** The most severe assessment with an action (ACT before WATCH; registry order breaks ties), or undefined. */
export function topFlag(assessments: readonly Assessment[]): Assessment | undefined {
  const own = assessments.filter((a) => a.crewId !== 'cabin');
  return own.find((a) => a.verdict === 'ACT') ?? own.find((a) => a.verdict === 'WATCH');
}
