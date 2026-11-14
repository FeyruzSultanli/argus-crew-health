import { useMemo } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowRight } from 'lucide-react';

import { computeReadiness } from '../../domain/readiness/readiness';
import { SIGNALS } from '../../domain/signals';
import type { Assessment, Task } from '../../domain/types';
import { CaughtOnlyByPersonal, LinkButton, TONE, VERDICT, cx, worstVerdict } from '../../ui';
import { useUiStore } from '../../state/ui';
import type { LayerCounts } from './counters';
import { LayerCounters } from './LayerCounters';
import { ReadinessRing } from './ReadinessRing';
import { summarize, topFlag } from './summary';

export interface HeroStripProps {
  crewId: string;
  name: string;
  roleLabel: string;
  /** Own assessments for the day (no cabin). */
  assessments: readonly Assessment[];
  /** Own plan for the day (overdue term of readiness); undefined while loading. */
  tasks: readonly Task[] | undefined;
  counts: LayerCounts;
  countsScope: string;
}

/** Hero strip (doc 11 §5.1): status ring + readiness, one-line summary, next step, and the three-layer counters. */
export function HeroStrip({
  crewId,
  name,
  roleLabel,
  assessments,
  tasks,
  counts,
  countsScope,
}: HeroStripProps) {
  const setSelectedCrew = useUiStore((s) => s.setSelectedCrew);
  const verdict = worstVerdict(assessments.map((a) => a.verdict));
  const readiness = useMemo(() => computeReadiness({ assessments, tasks }), [assessments, tasks]);
  const summary = summarize(assessments);
  const top = topFlag(assessments);
  return (
    <section
      aria-labelledby="hero-title"
      data-testid="hero"
      data-verdict={verdict}
      className="flex flex-col gap-5 rounded-card border border-border bg-surface-1 p-5"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ReadinessRing readiness={readiness} verdict={verdict} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <p className="font-mono text-xs tracking-wider text-text-3 uppercase">{roleLabel}</p>
            <h2 id="hero-title" className="text-xl font-semibold text-text">
              {name} — your status today
            </h2>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <m.p
              key={summary}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="text-lg leading-snug text-text"
              data-testid="hero-summary"
            >
              {summary}
            </m.p>
          </AnimatePresence>
          {top && (
            <div
              className={cx(
                'flex flex-col gap-2 rounded-control border border-l-4 p-3',
                TONE[VERDICT[top.verdict].tone].border,
                TONE[VERDICT[top.verdict].tone].accent,
                TONE[VERDICT[top.verdict].tone].bg,
              )}
              data-testid="hero-next-step"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-text">
                  Do this next · {SIGNALS[top.signalId].label}
                </span>
                {top.caughtOnlyByPersonal && <CaughtOnlyByPersonal />}
              </div>
              <p className="text-sm text-text">{top.action.text}</p>
              <p className="text-sm text-text-2">{top.explanation}</p>
              <div>
                <LinkButton to={`/body/${crewId}`} icon={ArrowRight} onClick={() => setSelectedCrew(crewId)}>
                  Open body view
                </LinkButton>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border pt-4">
        <LayerCounters counts={counts} scope={countsScope} />
      </div>
    </section>
  );
}
