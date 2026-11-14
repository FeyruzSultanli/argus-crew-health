import { useMemo } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Send } from 'lucide-react';

import { READINESS_SOURCE_IDS, computeReadiness } from '../../domain/readiness/readiness';
import { SIGNALS } from '../../domain/signals';
import { useTodayPlan } from '../../services/hooks';
import { useUiStore } from '../../state/ui';
import { Badge, CaughtOnlyByPersonal, Gauge, LinkButton, StatusPill, VERDICT, Value, formatAge } from '../../ui';
import { lastMeasurement, topFlags, type CrewRow } from './crewOverview';

export interface CrewCardProps {
  row: CrewRow;
  missionDay: number;
  /** Reference time for "last measurement" ages (now, or the end of the selected mission day). */
  refMs: number | undefined;
}

/** Shared layer-flag line: never colour alone (letters + numbers + screen-reader text). */
export function LayerFlagLine({ personal, space, earth, caption = 'Flags by layer' }: { personal: number; space: number; earth: number; caption?: string }) {
  return (
    <span className="flex flex-col gap-0.5" data-testid="layer-flags">
      <span className="text-xs text-text-2">{caption}</span>
      <span className="font-mono text-sm text-text" aria-hidden="true">
        Personal {personal} · Space {space} · Earth {earth}
      </span>
      <span className="sr-only">
        {caption}: personal {personal}, space {space}, earth {earth}
      </span>
    </span>
  );
}

/** One crew member, live (CMO): readiness, worst verdict, flags by layer, overdue tasks, last measurement. */
export function CrewCard({ row, missionDay, refMs }: CrewCardProps) {
  const { member, assessments, verdict, flags } = row;
  const setSelectedCrew = useUiStore((s) => s.setSelectedCrew);
  const tasks = useTodayPlan(member.id, missionDay);
  const readiness = useMemo(() => computeReadiness({ assessments, tasks }), [assessments, tasks]);
  const overdue = tasks?.filter((t) => t.status === 'overdue').length;
  const due = tasks?.filter((t) => t.status === 'due').length;
  const last = lastMeasurement(assessments);
  const age = last && refMs !== undefined ? formatAge(Math.max(0, (refMs - Date.parse(last.effectiveAt)) / 60_000)) : undefined;
  const top = topFlags(assessments);
  return (
    <li
      className="flex flex-col gap-4 rounded-card border border-border bg-surface-1 p-5"
      data-testid={`crew-card-${member.id}`}
      data-verdict={verdict}
    >
      <Link
        to={`/body/${member.id}`}
        onClick={() => setSelectedCrew(member.id)}
        className="-m-2 flex min-h-target items-center justify-between gap-3 rounded-control p-2 hover:bg-surface-2"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold text-text">{member.displayName}</span>
          <span className="truncate text-xs text-text-2">
            {member.role}
            {member.isCMO ? ' · CMO' : ''}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <StatusPill verdict={verdict} />
          <ChevronRight size={18} aria-hidden="true" className="text-text-3" />
          <span className="sr-only">open body view</span>
        </span>
      </Link>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
        <Gauge
          value={tasks === undefined ? null : readiness.score}
          max={100}
          label="Readiness"
          sourceIds={READINESS_SOURCE_IDS}
          size={112}
          footer={
            <Badge tone="neutral" variant="outline">
              Demo parameter
            </Badge>
          }
        />
        <div className="flex min-w-0 flex-col gap-3">
          <LayerFlagLine personal={flags.personal} space={flags.space} earth={flags.earth} />
          {flags.caughtOnlyByPersonal > 0 && (
            <span>
              <CaughtOnlyByPersonal />
            </span>
          )}
          <ul className="flex flex-col gap-1 text-sm text-text" aria-label="Top flags">
            {top.length === 0 ? (
              <li className="text-text-2">No flags</li>
            ) : (
              top.map((a) => (
                <li key={a.signalId}>
                  {SIGNALS[a.signalId].label} · {VERDICT[a.verdict].word}
                </li>
              ))
            )}
          </ul>
          <span className="text-sm text-text-2" data-testid="overdue">
            Tasks today: {overdue === undefined ? '…' : `${overdue} overdue · ${due ?? 0} due`}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-xs text-text-2">Last measurement</span>
            {last ? (
              <span className="flex flex-wrap items-center gap-2 text-sm text-text">
                {SIGNALS[last.signalId].label}
                <Value
                  value={last.value}
                  unit={last.unit}
                  sourceIds={last.source.label === 'SIMULATED' ? ['SRC_DEMO_SIMULATION'] : SIGNALS[last.signalId].sourceIds}
                  freshness={age}
                  label={last.source.label}
                  size="sm"
                  title={SIGNALS[last.signalId].label}
                />
              </span>
            ) : (
              <span className="text-sm text-text-3">No readings yet</span>
            )}
          </span>
        </div>
      </div>
      <div>
        <LinkButton to={`/earth?crew=${member.id}&flags=1`} icon={Send} variant="secondary">
          Send packet
        </LinkButton>
      </div>
    </li>
  );
}
