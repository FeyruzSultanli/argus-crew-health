// Source registry lookups for <Value>, <SourceBadge> and <SourceDrawer> (seed/sources.json, docs/PROJECT_RULES.md rule 1).
import sourcesJson from '../../seed/sources.json';
import type { SourceRef, SourceStatus } from '../domain/types';

const registry = new Map<string, SourceRef>(
  sourcesJson.sources.map((s): [string, SourceRef] => [
    s.id,
    { ...s, publisher: s.publisher ?? undefined, status: s.status as SourceStatus },
  ]),
);

/** The registry entry, or undefined for an unregistered id. */
export function getSource(id: string): SourceRef | undefined {
  return registry.get(id);
}

/** Registered entries for ids, in the given order; unknown ids are dropped. */
export function getSources(ids: readonly string[]): SourceRef[] {
  return ids.map((id) => registry.get(id)).filter((s): s is SourceRef => s !== undefined);
}

const RANK: Record<SourceStatus, number> = { verified: 0, partial: 1, demo: 2 };

/**
 * Worst status of the ids: demo > partial > verified. An unregistered id counts as 'partial' (never silently
 * verified); an empty list is 'demo' — a number without a source is not allowed to look verified.
 */
export function worstStatus(ids: readonly string[]): SourceStatus {
  if (ids.length === 0) return 'demo';
  let worst: SourceStatus = 'verified';
  for (const id of ids) {
    const status = registry.get(id)?.status ?? 'partial';
    if (RANK[status] > RANK[worst]) worst = status;
  }
  return worst;
}

export interface StatusMeta {
  /** Glyph on the badge (doc 11 §4): ✓ verified, ~ partial, D demo. */
  glyph: string;
  label: string;
  /** Extra tag shown on hover/focus/tap; only demo has one (doc 11 §7). */
  tag?: string;
}

export const SOURCE_STATUS: Record<SourceStatus, StatusMeta> = {
  verified: { glyph: '✓', label: 'Verified source' },
  partial: { glyph: '~', label: 'Partially verified source' },
  demo: { glyph: 'D', label: 'Demo parameter', tag: 'Demo parameter' },
};
