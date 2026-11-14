import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import type { Assessment, SignalId } from '../../domain/types';
import { Skeleton } from '../../ui/States';
import { cx } from '../../ui/tone';
import { BodySignalCard } from './BodySignalCard';
import { splitByAttention } from './counters';

export interface SignalPanelProps {
  assessments: Assessment[] | undefined;
  selectedSignalId: SignalId | null;
  onSelect: (id: SignalId | null) => void;
  /** Incremented when a body click selects a signal: scroll its card into view. */
  scrollSeq: number;
  className?: string;
}

function Group({
  id,
  title,
  list,
  selected,
  onSelect,
  refs,
}: {
  id: string;
  title: string;
  list: Assessment[];
  selected: SignalId | null;
  onSelect: (id: SignalId | null) => void;
  refs: React.RefObject<Map<SignalId, HTMLDivElement>>;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-sm font-semibold text-text">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {list.map((a) => (
          <li key={a.signalId}>
            <BodySignalCard
              ref={(el) => {
                if (el) refs.current.set(a.signalId, el);
                else refs.current.delete(a.signalId);
              }}
              assessment={a}
              expanded={selected === a.signalId}
              onToggle={(next) => onSelect(next ? a.signalId : null)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Right panel (doc 11 §5.2): "N need attention" sorted by severity, then "Normal today", then no recent reading. */
export function SignalPanel({
  assessments,
  selectedSignalId,
  onSelect,
  scrollSeq,
  className,
}: SignalPanelProps) {
  const refs = useRef(new Map<SignalId, HTMLDivElement>());
  const panelRef = useRef<HTMLElement>(null);
  const [showNoData, setShowNoData] = useState(false);
  const split = assessments ? splitByAttention(assessments) : undefined;
  const normal = split?.rest.filter((a) => a.verdict !== 'NO_DATA') ?? [];
  const noData = split?.rest.filter((a) => a.verdict === 'NO_DATA') ?? [];
  const selectedIsNoData = noData.some((a) => a.signalId === selectedSignalId);

  useEffect(() => {
    if (scrollSeq === 0 || !selectedSignalId) return;
    const t = window.setTimeout(() => {
      const el = refs.current.get(selectedSignalId);
      const panel = panelRef.current;
      // Scroll only the panel (scrollIntoView would also scroll the window).
      if (el && panel) panel.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' });
      el?.querySelector<HTMLButtonElement>('button[aria-expanded]')?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(t);
    // scroll only on a new body selection, not on every re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollSeq]);

  return (
    <aside
      ref={panelRef}
      aria-label="Signals"
      className={cx('relative flex flex-col gap-5 bg-bg p-3 xl:p-4', className)}
      data-testid="signal-panel"
    >
      {!split ? (
        <Skeleton lines={6} label="Loading signals" />
      ) : (
        <>
          <Group
            id="panel-attention"
            title={
              split.attention.length === 1 ? '1 needs attention' : `${split.attention.length} need attention`
            }
            list={split.attention}
            selected={selectedSignalId}
            onSelect={onSelect}
            refs={refs}
          />
          {normal.length > 0 && (
            <Group
              id="panel-normal"
              title="Normal today"
              list={normal}
              selected={selectedSignalId}
              onSelect={onSelect}
              refs={refs}
            />
          )}
          {noData.length > 0 && (
            <section className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={showNoData || selectedIsNoData}
                onClick={() => setShowNoData((v) => !v)}
                className="flex min-h-target items-center justify-between gap-2 rounded-control px-1 text-left text-sm font-semibold text-text-2 hover:text-text"
              >
                {`No recent reading (${noData.length})`}
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className={cx(
                    'transition-transform duration-200',
                    (showNoData || selectedIsNoData) && 'rotate-180',
                  )}
                />
              </button>
              {(showNoData || selectedIsNoData) && (
                <ul className="flex flex-col gap-2">
                  {noData.map((a) => (
                    <li key={a.signalId}>
                      <BodySignalCard
                        ref={(el) => {
                          if (el) refs.current.set(a.signalId, el);
                          else refs.current.delete(a.signalId);
                        }}
                        assessment={a}
                        expanded={selectedSignalId === a.signalId}
                        onToggle={(next) => onSelect(next ? a.signalId : null)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </aside>
  );
}
