import { useMemo } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { ChevronRight, Users } from 'lucide-react';

import { computeReadiness } from '../../domain/readiness/readiness';
import type { Readiness } from '../../domain/readiness/readiness';
import { READINESS_SOURCE_IDS } from '../../domain/readiness/readiness';
import { SIGNALS } from '../../domain/signals';
import type { Assessment, CrewMember, Task } from '../../domain/types';
import { useTodayPlan } from '../../services/hooks';
import { useUiStore } from '../../state/ui';
import {
  Card,
  CaughtOnlyByPersonal,
  EmptyState,
  Skeleton,
  StatusPill,
  VERDICT,
  Value,
  worstVerdict,
} from '../../ui';
import { countLayerFlags } from './counters';
import { sortCrewRows } from './crewRows';
import type { CrewRowModel } from './crewRows';
import { topFlag } from './summary';

export interface CrewAtAGlanceProps {
  crew: readonly CrewMember[];
  byCrew: Record<string, readonly Assessment[]>;
  missionDay: number;
}

function CrewRow({ row, missionDay }: { row: CrewRowModel; missionDay: number }) {
  const setSelectedCrew = useUiStore((s) => s.setSelectedCrew);
  const tasks: Task[] | undefined = useTodayPlan(row.member.id, missionDay);
  const readiness: Readiness = useMemo(
    () => computeReadiness({ assessments: row.assessments, tasks }),
    [row.assessments, tasks],
  );
  const counts = countLayerFlags(row.assessments);
  const top = topFlag(row.assessments);
  const empty = row.assessments.every((a) => a.verdict === 'NO_DATA');
  return (
    <li data-testid={`crew-row-${row.member.id}`} data-verdict={row.verdict}>
      <Link
        to={`/body/${row.member.id}`}
        onClick={() => setSelectedCrew(row.member.id)}
        className="grid min-h-target grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1.6fr)_auto] items-center gap-x-4 gap-y-1 rounded-control px-3 py-3 hover:bg-surface-2"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-text">{row.member.displayName}</span>
          <span className="truncate text-xs text-text-2">
            {row.member.role}
            {row.member.isCMO ? ' · CMO' : ''}
          </span>
        </span>
        <span className="flex flex-col items-start gap-1">
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={row.verdict}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="inline-flex"
            >
              <StatusPill verdict={row.verdict} size="sm" />
            </m.span>
          </AnimatePresence>
          <span className="inline-flex items-center gap-1 text-xs text-text-2">
            Readiness
            <Value
              value={readiness.score}
              sourceIds={READINESS_SOURCE_IDS}
              size="sm"
              interactive={false}
              title="Readiness"
            />
          </span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm text-text">
            {empty
              ? 'No readings yet'
              : top
                ? `${SIGNALS[top.signalId].label} · ${VERDICT[top.verdict].word}`
                : 'No flags'}
          </span>
          <span className="font-mono text-xs text-text-2" data-testid="layer-flags">
            <span aria-hidden="true">
              P {counts.personal} · S {counts.space} · E {counts.earth}
            </span>
            <span className="sr-only">
              Flags by layer: personal {counts.personal}, space {counts.space}, earth {counts.earth}
            </span>
          </span>
          {top?.caughtOnlyByPersonal && (
            <span>
              <CaughtOnlyByPersonal />
            </span>
          )}
        </span>
        <ChevronRight size={18} aria-hidden="true" className="text-text-3" />
      </Link>
    </li>
  );
}

/** Crew at a glance (CMO, doc 11 §5.1, FR-CREW-3): rows sorted by severity; click → that crew member's body view. */
export function CrewAtAGlance({ crew, byCrew, missionDay }: CrewAtAGlanceProps) {
  const rows = useMemo(
    () =>
      sortCrewRows(
        crew.map((member) => {
          const assessments = byCrew[member.id] ?? [];
          return { member, assessments, verdict: worstVerdict(assessments.map((a) => a.verdict)) };
        }),
      ),
    [crew, byCrew],
  );
  return (
    <Card
      title="Crew at a glance"
      subtitle="Sorted by severity · select a row for the body view"
      data-testid="crew-at-a-glance"
    >
      {crew.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No crew data"
          body="The crew list is empty. Reset the demo in Settings."
        />
      ) : (
        <ul aria-label="Crew" className="-mx-3 flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <CrewRow key={r.member.id} row={r} missionDay={missionDay} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CrewAtAGlanceSkeleton() {
  return (
    // About the loaded table's height (≈ 410 px at 1350 px) to avoid a layout shift when it arrives (CLS).
    <Card title="Crew at a glance" className="min-h-[25rem]">
      <Skeleton lines={4} label="Loading crew" />
    </Card>
  );
}
