import { Link } from 'react-router';
import { Box } from 'lucide-react';

import type { Assessment, CrewMember } from '../../domain/types';
import { missionDayLabel } from '../../state/missionSelectors';
import type { LayerLens } from '../../state/ui';
import { LAYER_NAME, LAYER_ORDER } from '../../ui/layers';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { StatusPill } from '../../ui/StatusPill';
import { cx } from '../../ui/tone';
import { layerCounters, subjectSummary } from './counters';
import { LENS_OPTIONS } from './regions';
import { RecentActivity } from './RecentActivity';

export interface LeftRailProps {
  crew: readonly CrewMember[];
  all: Record<string, Assessment[]> | undefined;
  selectedId: string;
  lens: LayerLens;
  onLensChange: (lens: LayerLens) => void;
  missionDay: number;
}

function RailHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-xs font-semibold tracking-wider text-text-3 uppercase">
      {children}
    </h2>
  );
}

function SubjectRow({
  to,
  name,
  sub,
  list,
  current,
}: {
  to: string;
  name: string;
  sub: string;
  list: Assessment[] | undefined;
  current: boolean;
}) {
  const s = list ? subjectSummary(list) : undefined;
  return (
    <li>
      <Link
        to={to}
        aria-current={current ? 'page' : undefined}
        data-subject={to}
        className={cx(
          'flex min-h-target items-center gap-2 rounded-control border px-2.5 py-1.5 transition-colors duration-200 ease-out',
          current ? 'border-brand bg-surface-2' : 'border-transparent hover:bg-surface-2',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-text">{name}</span>
          <span className="truncate text-xs text-text-3">{sub}</span>
        </span>
        {s && (
          <span className="flex flex-col items-end gap-1">
            <StatusPill verdict={s.worst} size="sm" />
            <span className="font-mono text-[11px] text-text-2 tabular-nums">
              <span aria-hidden="true">
                {LAYER_ORDER.map((l) => `${LAYER_NAME[l].short}${s.flags[l]}`).join(' · ')}
              </span>
              <span className="sr-only">
                {LAYER_ORDER.map((l) => `${LAYER_NAME[l].name} flags ${s.flags[l]}`).join(', ')}
              </span>
            </span>
          </span>
        )}
      </Link>
    </li>
  );
}

/** Left rail (doc 11 §5.2): crew list + Cabin, layer lens, counters, recent activity. A strip below 1280 px. */
export function LeftRail({ crew, all, selectedId, lens, onLensChange, missionDay }: LeftRailProps) {
  const crewAssessments = crew.flatMap((c) => all?.[c.id] ?? []);
  const c = layerCounters(crewAssessments);
  const counters: Array<{ label: string; n: number; strong?: boolean }> = [
    { label: 'Earth flags', n: c.earthFlags },
    { label: 'Space flags', n: c.spaceFlags },
    { label: 'Personal flags', n: c.personalFlags },
    { label: 'Caught only by personal', n: c.caughtOnlyByPersonal, strong: true },
    { label: 'Earth false alarms', n: c.earthFalseAlarms },
  ];
  return (
    <aside
      aria-label="Crew and layer lens"
      className="flex flex-wrap gap-x-6 gap-y-4 border-b border-border bg-surface-1 p-3 xl:h-full xl:flex-col xl:flex-nowrap xl:overflow-y-auto xl:border-r xl:border-b-0 xl:p-4"
    >
      <section className="flex min-w-0 flex-col gap-2 xl:w-full" aria-labelledby="rail-crew">
        <RailHeading id="rail-crew">Crew</RailHeading>
        <ul className="flex flex-wrap gap-1 xl:flex-col">
          {crew.map((m) => (
            <SubjectRow
              key={m.id}
              to={`/body/${m.id}`}
              name={m.displayName}
              sub={m.role}
              list={all?.[m.id]}
              current={m.id === selectedId}
            />
          ))}
          <SubjectRow
            to="/body/cabin"
            name="Cabin"
            sub="Air and environment"
            list={all?.cabin}
            current={selectedId === 'cabin'}
          />
        </ul>
      </section>

      <section className="flex flex-col gap-2 xl:w-full" aria-labelledby="rail-lens">
        <div className="flex items-center gap-2">
          <Box size={14} aria-hidden="true" className="text-text-3" />
          <RailHeading id="rail-lens">Layer lens</RailHeading>
        </div>
        <SegmentedControl
          label="Layer lens"
          options={LENS_OPTIONS}
          value={lens}
          onChange={onLensChange}
          className="w-full *:flex-auto *:px-1.5 *:text-[13px]"
        />
        <p className="max-w-[18rem] text-xs text-text-3">
          {lens === 'combined'
            ? 'Body colours show the combined verdict.'
            : `Body colours show only the ${LAYER_NAME[lens].long} layer.`}
        </p>
      </section>

      <section className="flex flex-col gap-2 xl:w-full" aria-labelledby="rail-counters">
        <RailHeading id="rail-counters">{`Flags · all visible crew · ${missionDayLabel(missionDay)}`}</RailHeading>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm" data-testid="layer-counters">
          {counters.map((k) => (
            <div key={k.label} className="contents">
              <dt className={k.strong ? 'font-medium text-brand' : 'text-text-2'}>{k.label}</dt>
              <dd
                className={cx(
                  'text-right font-mono tabular-nums',
                  k.strong ? 'font-semibold text-brand' : 'text-text',
                )}
              >
                {k.n}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <RecentActivity crew={crew} all={all} className="hidden xl:flex" />
    </aside>
  );
}
