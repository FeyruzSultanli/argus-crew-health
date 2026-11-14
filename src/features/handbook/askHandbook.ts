// Rule-based Ask box (FR-HELP-2). No AI and no free-text analysis beyond keyword matching against the handbook
// index; never applied to stored notes. Pure: picks the entries an answer is composed from.
import { scoreItem, searchHandbook, tokenize } from './content';
import type { HandbookEntry, HandbookIndexItem } from './content';
import type { SignalId } from '../../domain/types';

export const NO_ANSWER = "I don't have that.";

export interface AskOptions {
  /** At most this many entries per answer. */
  max?: number;
  /** Keep entries scoring at least this share of the best score. */
  ratio?: number;
}

/** Entries an answer uses, best first ([] → "I don't have that."). */
export function matchQuestion(
  index: readonly HandbookIndexItem[],
  question: string,
  { max = 2, ratio = 0.75 }: AskOptions = {},
): HandbookIndexItem[] {
  const ranked = searchHandbook(index, question);
  const top = ranked[0];
  if (!top) return [];
  const tokens = tokenize(question);
  const best = scoreItem(top, tokens);
  return ranked.filter((i) => scoreItem(i, tokens) >= best * ratio).slice(0, max);
}

/** Signals of the used entries (unique, first-seen order) — their current assessments join the answer. */
export function answerSignalIds(items: readonly Pick<HandbookIndexItem, 'signalIds'>[]): SignalId[] {
  return [...new Set(items.flatMap((i) => i.signalIds as SignalId[]))];
}

/** The entry's "What to do" section, verbatim (null when the entry has none, e.g. protocols and hazards). */
export function whatToDo(entry: Pick<HandbookEntry, 'sections'>): string | null {
  return entry.sections.find((s) => s.slug === 'what-to-do')?.markdown ?? null;
}
