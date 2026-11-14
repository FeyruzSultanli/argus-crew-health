// Ask box (FR-HELP-2, doc 11 §5.8): a question is matched to handbook entries by keywords only; the answer is
// composed ONLY of the entries' summary / "What to do" text and the subject's current assessments (verdict,
// explanation, action — verbatim), each with its source badges, plus the list of entries used.
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowRight, MessageCircleQuestion } from 'lucide-react';

import { CABIN_SIGNAL_IDS } from '../../domain/signals';
import type { HandbookIndexItem } from './content';
import { Button, Card, LinkButton, Skeleton } from '../../ui';
import { NO_ANSWER, answerSignalIds, matchQuestion, whatToDo } from './askHandbook';
import { CurrentVerdict } from './CurrentVerdict';
import { entryPath } from './handbookFilter';
import { Markdown } from './Markdown';
import { useHandbookEntry, useSubjectCrewId } from './useHandbook';

function EntryAnswer({ item }: { item: HandbookIndexItem }) {
  const entry = useHandbookEntry(item.id);
  const todo = entry.status === 'ok' ? whatToDo(entry.data) : null;
  return (
    <div className="flex flex-col gap-2" data-testid={`answer-entry-${item.id}`}>
      <h3 className="text-sm font-semibold text-text">{item.title}</h3>
      <p className="text-sm text-text-2">{item.summary}</p>
      {entry.status === 'loading' && <Skeleton lines={2} label="Loading entry" />}
      {todo && (
        <div>
          <p className="text-xs font-medium tracking-wide text-text-3 uppercase">What to do</p>
          <Markdown markdown={todo} />
        </div>
      )}
      {item.protocolId && (
        <div>
          <LinkButton to={entryPath(item)} icon={ArrowRight}>
            Open protocol
          </LinkButton>
        </div>
      )}
    </div>
  );
}

function Answer({ items }: { items: HandbookIndexItem[] }) {
  const crewId = useSubjectCrewId();
  const signals = answerSignalIds(items);
  const crewSignals = signals.filter((s) => !CABIN_SIGNAL_IDS.includes(s));
  const cabinSignals = signals.filter((s) => CABIN_SIGNAL_IDS.includes(s));
  return (
    <div className="flex flex-col gap-5" data-testid="ask-answer">
      {items.map((i) => (
        <EntryAnswer key={i.id} item={i} />
      ))}
      {(crewSignals.length > 0 || cabinSignals.length > 0) && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-text">Your current verdict</h3>
          {crewSignals.length > 0 && <CurrentVerdict signalIds={crewSignals} crewId={crewId} />}
          {cabinSignals.length > 0 && <CurrentVerdict signalIds={cabinSignals} crewId={crewId} />}
        </div>
      )}
      <div className="border-t border-border pt-3">
        <p className="text-xs font-medium tracking-wide text-text-3 uppercase">Entries used</p>
        <ul className="mt-1 flex flex-wrap gap-x-4" data-testid="entries-used">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                to={entryPath(i)}
                className="inline-flex min-h-target items-center text-sm text-brand underline underline-offset-2"
              >
                {i.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AskBox({ index }: { index: readonly HandbookIndexItem[] | null }) {
  const id = useId();
  const [text, setText] = useState('');
  const [asked, setAsked] = useState<{ q: string; items: HandbookIndexItem[] } | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!index || text.trim() === '') return;
    setAsked({ q: text, items: matchQuestion(index, text) });
  };
  return (
    <Card
      title="Ask the handbook"
      subtitle="Rule-based: answers come only from the handbook and your current data"
    >
      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-2"
        role="search"
        aria-label="Ask the handbook"
      >
        <label htmlFor={id} className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium text-text">
          Your question
          <input
            id={id}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="For example: What should I do about my sleep?"
            className="min-h-target rounded-control border border-border-strong bg-surface-2 px-3 text-sm font-normal text-text"
            data-testid="ask-input"
          />
        </label>
        <Button type="submit" variant="primary" icon={MessageCircleQuestion} disabled={!index}>
          Ask
        </Button>
      </form>
      <div aria-live="polite" className="mt-4">
        {asked &&
          (asked.items.length === 0 ? (
            <p className="text-sm text-text" data-testid="ask-no-answer">
              {NO_ANSWER}
            </p>
          ) : (
            <Answer key={asked.q} items={asked.items} />
          ))}
      </div>
    </Card>
  );
}
