// Handbook home (doc 11 §5.8, FR-HELP-1): search box + categories, URL-driven (?q=…&category=…).
import { useId } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronRight, FlaskConical, ListChecks, Search } from 'lucide-react';

import { HANDBOOK_CATEGORIES } from './content';
import type { HandbookIndexItem } from './content';
import { Badge, EmptyState, ErrorState, SegmentedControl, Skeleton } from '../../ui';
import { AskBox } from './AskBox';
import { entryPath, filterHandbook, isCategory } from './handbookFilter';
import type { CategoryFilter } from './handbookFilter';
import { useHandbookIndex } from './useHandbook';

const LABEL = new Map(HANDBOOK_CATEGORIES.map((c) => [c.id, c.label]));
const FILTERS: ReadonlyArray<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  ...HANDBOOK_CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
];

function EntryRow({ item }: { item: HandbookIndexItem }) {
  return (
    <li>
      <Link
        to={entryPath(item)}
        className="flex min-h-target items-center gap-4 rounded-control border border-border bg-surface-1 px-4 py-3 hover:border-border-strong"
        data-entry={item.id}
      >
        {item.protocolId && <ListChecks size={18} aria-hidden="true" className="shrink-0 text-text-2" />}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
            {item.title}
            {item.experimental && (
              <Badge icon={FlaskConical} variant="outline">
                Experimental — not validated
              </Badge>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-text-2">{item.summary}</span>
        </span>
        <span className="hidden font-mono text-xs text-text-3 sm:inline">{LABEL.get(item.category)}</span>
        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-text-3" />
      </Link>
    </li>
  );
}

export function HandbookIndex() {
  const searchId = useId();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const rawCat = params.get('category');
  const category: CategoryFilter = isCategory(rawCat) ? rawCat : 'all';
  const index = useHandbookIndex();

  const update = (next: { q?: string; category?: CategoryFilter }) => {
    const p = new URLSearchParams(params);
    const q = next.q ?? query;
    const c = next.category ?? category;
    if (q) p.set('q', q);
    else p.delete('q');
    if (c !== 'all') p.set('category', c);
    else p.delete('category');
    setParams(p, { replace: true });
  };

  return (
    <div
      className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 lg:px-6"
      data-testid="handbook"
    >
      <header>
        <h1 className="text-2xl font-semibold text-text">Handbook</h1>
        <p className="mt-1 text-sm text-text-2">
          Signals, measurements, hazards and protocols. Works offline; every number links to its source.
        </p>
      </header>
      <AskBox index={index.status === 'ok' ? index.data : null} />
      <div className="flex flex-col gap-3">
        <label htmlFor={searchId} className="text-sm font-medium text-text">
          Search the handbook
        </label>
        <div className="relative max-w-xl">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-3"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="For example: sleep, CO2, radiation"
            className="min-h-target w-full rounded-control border border-border-strong bg-surface-2 pr-3 pl-10 text-sm text-text"
            data-testid="handbook-search"
          />
        </div>
        <SegmentedControl<CategoryFilter>
          label="Category"
          options={FILTERS}
          value={category}
          onChange={(c) => update({ category: c })}
          className="flex-wrap self-start"
        />
      </div>
      {index.status === 'loading' && <Skeleton lines={6} label="Loading handbook" />}
      {index.status === 'error' && (
        <ErrorState
          title="Handbook could not be loaded"
          message="The handbook files did not load. They are stored for offline use after the first visit."
          detail={index.message}
          onRetry={index.retry}
        />
      )}
      {index.status === 'ok' && <Results items={filterHandbook(index.data, query, category)} query={query} />}
    </div>
  );
}

function Results({ items, query }: { items: HandbookIndexItem[]; query: string }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No entries match"
        body="Try another word, or clear the search to see all entries."
      />
    );
  }
  return (
    <section aria-label="Handbook entries" className="flex flex-col gap-2">
      <p className="sr-only" aria-live="polite">
        {query ? `Entries matching “${query}”` : 'All entries'}
      </p>
      <ul className="flex flex-col gap-2" data-testid="handbook-results">
        {items.map((i) => (
          <EntryRow key={i.id} item={i} />
        ))}
      </ul>
    </section>
  );
}
