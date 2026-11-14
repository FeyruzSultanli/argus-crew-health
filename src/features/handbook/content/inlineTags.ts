// Inline tags in handbook text: `[SRC_…]` (a source in seed/sources.json) and `[demo wording]` (our own wording,
// no source). The UI renders them as chips; tests use them to check that every number carries a source.

export const INLINE_SOURCE_TAG = /\[(SRC_[A-Z0-9_]+)\]/g;
export const DEMO_WORDING_TAG = '[demo wording]';

export type InlinePart =
  { kind: 'text'; text: string } | { kind: 'source'; id: string } | { kind: 'demo-wording' };

/** Splits a line of text into plain text, source tags and demo-wording tags (in order). */
export function splitInlineTags(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const re = /\[(SRC_[A-Z0-9_]+)\]|\[demo wording\]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index;
    if (at > last) parts.push({ kind: 'text', text: text.slice(last, at) });
    parts.push(m[1] !== undefined ? { kind: 'source', id: m[1] } : { kind: 'demo-wording' });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/** Unique `[SRC_…]` ids in a text, in first-seen order. */
export function extractInlineSourceIds(text: string): string[] {
  return [...new Set([...text.matchAll(INLINE_SOURCE_TAG)].map((m) => m[1] as string))];
}

/** The text without its inline tags (for search snippets and plain-text answers). */
export function stripInlineTags(text: string): string {
  return text
    .replace(/\s*\[(?:SRC_[A-Z0-9_]+|demo wording)\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
