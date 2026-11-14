// One handbook entry (FR-HELP-1): uniform sections, inline source tags as badges, the subject's current verdict for
// signal entries. ErrorState with retry when the file cannot be fetched (offline before first visit).
import { ArrowLeft, FlaskConical } from 'lucide-react';

import { HANDBOOK_CATEGORIES } from './content';
import type { HandbookEntry } from './content';
import { Badge, Card, EmptyState, ErrorState, LinkButton, Skeleton } from '../../ui';
import { CurrentVerdict } from './CurrentVerdict';
import { Markdown } from './Markdown';
import { useHandbookEntry, useSubjectCrewId } from './useHandbook';

const LABEL = new Map(HANDBOOK_CATEGORIES.map((c) => [c.id, c.label]));

function Back({ category }: { category?: string }) {
  return (
    <LinkButton
      to={category ? `/handbook?category=${category}` : '/handbook'}
      variant="ghost"
      icon={ArrowLeft}
      className="self-start"
    >
      Handbook{category ? `: ${LABEL.get(category as HandbookEntry['category']) ?? category}` : ''}
    </LinkButton>
  );
}

function EntryBody({ entry }: { entry: HandbookEntry }) {
  const crewId = useSubjectCrewId();
  const showVerdict = entry.category === 'signals' && entry.signalIds.length > 0;
  return (
    <article className="flex flex-col gap-6" data-testid="handbook-entry" data-entry={entry.id}>
      <header className="flex flex-col gap-2">
        <Back category={entry.category} />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" mono>
            {LABEL.get(entry.category)}
          </Badge>
          {entry.experimental && (
            <Badge icon={FlaskConical} variant="outline">
              Experimental — not validated
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-text">{entry.title}</h1>
        <p className="max-w-[72ch] text-text-2">{entry.summary}</p>
      </header>
      {showVerdict && (
        <Card title="Your current verdict" subtitle="From today's assessment" data-testid="entry-verdict">
          <CurrentVerdict signalIds={entry.signalIds} crewId={crewId} />
        </Card>
      )}
      <div className="flex flex-col gap-6">
        {entry.sections.map((s) => (
          <section key={s.slug} aria-labelledby={`sec-${s.slug}`} className="max-w-[80ch]">
            <h2 id={`sec-${s.slug}`} className="mb-2 text-base font-semibold text-text">
              {s.heading}
            </h2>
            <Markdown markdown={s.markdown} headingOffset={0} />
          </section>
        ))}
      </div>
    </article>
  );
}

export function HandbookEntryView({ id }: { id: string }) {
  const entry = useHandbookEntry(id);
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 lg:px-6">
      {entry.status === 'loading' && <Skeleton lines={8} label="Loading entry" />}
      {entry.status === 'error' &&
        (/no handbook entry/.test(entry.message) ? (
          <>
            <Back />
            <EmptyState
              title="No such handbook entry"
              body="The link may be out of date. Search the handbook instead."
            />
          </>
        ) : (
          <>
            <Back />
            <ErrorState
              title="Entry could not be loaded"
              message="The handbook entry did not load. It is stored for offline use after the first visit."
              detail={entry.message}
              onRetry={entry.retry}
            />
          </>
        ))}
      {entry.status === 'ok' && <EntryBody entry={entry.data} />}
    </div>
  );
}
