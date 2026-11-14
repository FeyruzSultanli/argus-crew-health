// Keyword + title search over the handbook index. This is the retrieval the rule-based Ask box uses (FR-HELP-2):
// plain token matching, no AI, and never applied to the user's free-text notes.
import type { HandbookCategory, HandbookIndexItem } from './types';

const STOPWORDS = new Set(
  (
    'a an the i im me my mine myself you your yours we our us is are am was were be been being do does did doing ' +
    'should shall what whats how why when where which who whom about of for to in on at by with from and or but ' +
    'can could would will it its this that these those there here have has had get got any some please tell know ' +
    'much many so if then than just also too very really again now today feel feeling me ok okay up'
  ).split(' '),
);

/** Ranking tie-break: signals first, then protocols (doc 11 §5.8 categories). */
const CATEGORY_RANK: Record<HandbookCategory, number> = {
  signals: 0,
  protocols: 1,
  measurements: 2,
  hazards: 3,
  about: 4,
};

const SUBSCRIPTS: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
};

/** Light stemming so "headaches" finds "headache" and "eyes" finds "eye". */
function stem(token: string): string {
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

/** Lowercase word tokens (subscript digits folded, so "CO₂" → "co2"), stemmed, without stopwords. */
export function tokenize(text: string): string[] {
  const folded = text
    .toLowerCase()
    .replace(/[₀-₉]/g, (c) => SUBSCRIPTS[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
  return folded
    .split(' ')
    .filter((t) => t !== '' && !STOPWORDS.has(t))
    .map(stem);
}

export interface ScoredItem {
  item: HandbookIndexItem;
  score: number;
}

/** Score of one entry for already-tokenized query tokens (0 = no match). */
export function scoreItem(item: HandbookIndexItem, queryTokens: readonly string[]): number {
  if (queryTokens.length === 0) return 0;
  const query = new Set(queryTokens);
  const keywordPhrases = item.keywords.map((k) => tokenize(k)).filter((p) => p.length > 0);
  const singleKeywords = new Set(keywordPhrases.filter((p) => p.length === 1).map((p) => p[0] as string));
  const keywordTokens = new Set(keywordPhrases.flat());
  const titleTokens = new Set(tokenize(item.title));
  const summaryTokens = new Set(tokenize(item.summary));
  const idTokens = new Set([...tokenize(item.id), ...item.signalIds.flatMap((s) => tokenize(s))]);

  let score = 0;
  for (const t of query) {
    if (singleKeywords.has(t)) score += 3;
    else if (keywordTokens.has(t)) score += 2;
    else if (t.length >= 4 && [...keywordTokens].some((k) => k.startsWith(t))) score += 1;
    if (titleTokens.has(t)) score += 2;
    if (summaryTokens.has(t)) score += 1;
    if (idTokens.has(t)) score += 1;
  }
  // A multi-word keyword whose every word is in the query ("heart rate", "blood pressure").
  for (const phrase of keywordPhrases) {
    if (phrase.length > 1 && phrase.every((w) => query.has(w))) score += 2;
  }
  return score;
}

/**
 * Entries matching the query, best first. Ties: signals, protocols, measurements, hazards, about; then `order`;
 * then title. An empty or stopword-only query returns [].
 */
export function searchHandbook(
  index: readonly HandbookIndexItem[],
  query: string,
  options: { limit?: number } = {},
): HandbookIndexItem[] {
  const tokens = tokenize(query);
  const scored: ScoredItem[] = index
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        CATEGORY_RANK[a.item.category] - CATEGORY_RANK[b.item.category] ||
        a.item.order - b.item.order ||
        a.item.title.localeCompare(b.item.title),
    );
  const items = scored.map((s) => s.item);
  return options.limit === undefined ? items : items.slice(0, options.limit);
}
