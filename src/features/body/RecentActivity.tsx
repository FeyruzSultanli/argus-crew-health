import { getSignal } from '../../domain/signals';
import type { Assessment, CrewMember } from '../../domain/types';
import { missionDayLabel } from '../../state/missionSelectors';
import { cx } from '../../ui/tone';
import { LatestValue } from './LatestValue';

export interface RecentActivityProps {
  crew: readonly CrewMember[];
  all: Record<string, Assessment[]> | undefined;
  className?: string;
  limit?: number;
}

/** Newest readings across the visible crew and the cabin (from Assessment.latest). */
export function RecentActivity({ crew, all, className, limit = 5 }: RecentActivityProps) {
  const names = new Map<string, string>(crew.map((c) => [c.id, c.displayName]));
  names.set('cabin', 'Cabin');
  const rows = [...names.keys()]
    .flatMap((id) => all?.[id] ?? [])
    .filter((a): a is Assessment & { latest: NonNullable<Assessment['latest']> } => a.latest !== undefined)
    .sort(
      (a, b) =>
        b.latest.missionDay - a.latest.missionDay || b.latest.effectiveAt.localeCompare(a.latest.effectiveAt),
    )
    .slice(0, limit);
  return (
    <section className={cx('flex-col gap-2 xl:w-full', className)} aria-labelledby="rail-activity">
      <h2 id="rail-activity" className="text-xs font-semibold tracking-wider text-text-3 uppercase">
        Recent activity
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-text-3">No readings on this day.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((a) => (
            <li key={a.latest.id} className="flex flex-col gap-0.5 border-l border-border pl-3">
              <span className="text-xs text-text-3">
                <span className="font-mono">{missionDayLabel(a.latest.missionDay)}</span> ·{' '}
                {names.get(a.crewId) ?? a.crewId}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 text-sm text-text">
                {getSignal(a.signalId).label}
                <LatestValue assessment={a} size="sm" />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
