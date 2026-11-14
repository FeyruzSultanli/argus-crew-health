// Handbook index filtering (search + category), and the URL ↔ entry routing rules. Pure.
import { HANDBOOK_CATEGORIES, isProtocolId, protocols, searchHandbook } from './content';
import type { HandbookCategory, HandbookIndexItem } from './content';
import type { ProtocolId } from '../../domain/types';

export type CategoryFilter = HandbookCategory | 'all';

export function isCategory(x: string | null): x is HandbookCategory {
  return HANDBOOK_CATEGORIES.some((c) => c.id === x);
}

const CATEGORY_POS = new Map(HANDBOOK_CATEGORIES.map((c, i) => [c.id, i]));

/** Search results (ranked) or the full list (category order, then `order`), limited to one category if set. */
export function filterHandbook(
  index: readonly HandbookIndexItem[],
  query: string,
  category: CategoryFilter,
): HandbookIndexItem[] {
  const inCategory = (i: HandbookIndexItem) => category === 'all' || i.category === category;
  if (query.trim() !== '') return searchHandbook(index, query).filter(inCategory);
  return index
    .filter(inCategory)
    .sort(
      (a, b) =>
        (CATEGORY_POS.get(a.category) ?? 0) - (CATEGORY_POS.get(b.category) ?? 0) ||
        a.order - b.order ||
        a.title.localeCompare(b.title),
    );
}

/** Route target of an index item: protocols open the runner at /handbook/<protocolId>. */
export function entryPath(item: Pick<HandbookIndexItem, 'id' | 'protocolId'>): string {
  return item.protocolId ? `/handbook/${item.protocolId}` : `/handbook/${item.id}`;
}

/** `/handbook/<x>`: a protocol id or its entry id `protocol-<id>` → the protocol runner; otherwise an entry. */
export function resolveHandbookParam(
  param: string,
): { kind: 'protocol'; id: ProtocolId } | { kind: 'entry'; id: string } {
  if (isProtocolId(param)) return { kind: 'protocol', id: param };
  const p = protocols.find((x) => `protocol-${x.id}` === param);
  return p ? { kind: 'protocol', id: p.id } : { kind: 'entry', id: param };
}
