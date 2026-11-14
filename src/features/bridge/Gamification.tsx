import { CalendarCheck, Dumbbell, Eye, Flame, Moon, Timer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { BadgeId, EarnedBadge } from '../../domain/readiness/badges';
import { READINESS_SOURCE_IDS } from '../../domain/readiness/readiness';
import type { Streak, Streaks } from '../../domain/readiness/streaks';
import { Value, cx } from '../../ui';

const S = READINESS_SOURCE_IDS;

function StreakChip({ icon: Icon, streak, what }: { icon: LucideIcon; streak: Streak; what: string }) {
  const unit =
    streak.unit === 'week' ? (streak.length === 1 ? 'week' : 'weeks') : streak.length === 1 ? 'day' : 'days';
  return (
    <li
      className={cx(
        'inline-flex min-h-9 items-center gap-2 rounded-pill border px-3 text-xs',
        streak.length > 0
          ? 'border-border-strong bg-surface-2 text-text'
          : 'border-dashed border-border-strong text-text-2',
      )}
      data-testid={`streak-${what.split(' ')[0]?.toLowerCase()}`}
    >
      <Icon size={15} aria-hidden="true" className="text-text-2" />
      <Value value={streak.length} unit={unit} sourceIds={S} size="sm" title={`${what} streak`} />
      <span>{what}</span>
      {streak.length > 0 && !streak.includesToday && <span className="text-text-3">· today open</span>}
    </li>
  );
}

export function StreakRow({ streaks }: { streaks: Streaks }) {
  return (
    <ul aria-label="Streaks" className="flex flex-wrap gap-2">
      <StreakChip icon={Flame} streak={streaks.checkin} what="Check-in streak" />
      <StreakChip icon={Timer} streak={streaks.reaction} what="Reaction test streak" />
      <StreakChip icon={Dumbbell} streak={streaks.exercise} what="Exercise on plan" />
    </ul>
  );
}

const BADGE_ICON: Record<BadgeId, LucideIcon> = {
  'baseline-set': Eye,
  'clean-week': CalendarCheck,
  'night-watch': Moon,
};

export function BadgeRow({ badges }: { badges: readonly EarnedBadge[] }) {
  return (
    <ul aria-label="Badges" className="flex flex-wrap gap-2">
      {badges.map((b) => {
        const Icon = BADGE_ICON[b.id];
        return (
          <li
            key={b.id}
            title={b.rule}
            data-earned={b.earned}
            className={cx(
              'inline-flex min-h-9 items-center gap-2 rounded-control border px-3 text-xs',
              b.earned ? 'border-brand text-text' : 'border-dashed border-border-strong text-text-3',
            )}
          >
            <Icon size={15} aria-hidden="true" className={b.earned ? 'text-brand' : 'text-text-3'} />
            <span className="font-medium">{b.label}</span>
            <span className={b.earned ? 'text-text-2' : 'text-text-3'}>
              {b.earned ? 'earned' : 'not yet'}
            </span>
            <span className="sr-only">: {b.rule}</span>
          </li>
        );
      })}
    </ul>
  );
}

export interface PointsLineProps {
  todayDone: number;
  todayTotal: number;
  week: number;
  /** Weekly crew total (CMO view). */
  crewWeek?: number;
}

export function PointsLine({ todayDone, todayTotal, week, crewWeek }: PointsLineProps) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-2" data-testid="points-line">
      <span className="inline-flex items-center gap-1.5">
        Today <Value value={todayDone} sourceIds={S} size="sm" title="Points today" /> of{' '}
        <Value value={todayTotal} unit="pts" sourceIds={S} size="sm" title="Points available today" />
      </span>
      <span className="inline-flex items-center gap-1.5">
        This week <Value value={week} unit="pts" sourceIds={S} size="sm" title="Your points over 7 days" />
      </span>
      {crewWeek !== undefined && (
        <span className="inline-flex items-center gap-1.5">
          Crew this week{' '}
          <Value value={crewWeek} unit="pts" sourceIds={S} size="sm" title="Crew points over 7 days" />
        </span>
      )}
    </p>
  );
}
