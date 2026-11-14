import { useMemo } from 'react';
import { CalendarCheck } from 'lucide-react';

import { computeBadges } from '../../domain/readiness/badges';
import { weekSummary } from '../../domain/readiness/planHistory';
import { computeStreaks } from '../../domain/readiness/streaks';
import type { Assessment, Observation, Task } from '../../domain/types';
import { setTaskStatus } from '../../services/healthService';
import { useUiStore } from '../../state/ui';
import { Card, EmptyState, Skeleton, useToast } from '../../ui';
import { Countermeasures } from './Countermeasures';
import { BadgeRow, PointsLine, StreakRow } from './Gamification';
import { PlanRow } from './PlanRow';

export interface TodayPlanProps {
  crewId: string;
  missionDay: number;
  /** undefined while loading. */
  tasks: readonly Task[] | undefined;
  /** Own assessments (badges). */
  assessments: readonly Assessment[];
  /** Own observation history (streaks, weekly points, badges); undefined while loading. */
  history: readonly Observation[] | undefined;
  exercisePlanMin: number | undefined;
  /** Weekly crew total (CMO view only). */
  crewWeekPoints?: number;
  onFocusCheckin: () => void;
}

/** Today's plan (FR-PLAN-1) with streaks, points and badges (FR-PLAN-2) and countermeasure guidance (FR-PLAN-4). */
export function TodayPlan(props: TodayPlanProps) {
  const { crewId, missionDay, tasks, assessments, history, exercisePlanMin, crewWeekPoints, onFocusCheckin } =
    props;
  const setSelectedCrew = useUiStore((s) => s.setSelectedCrew);
  const toast = useToast();
  const game = useMemo(() => {
    if (!history) return undefined;
    const week = weekSummary(crewId, history, missionDay);
    return {
      week,
      streaks: computeStreaks(history, missionDay, exercisePlanMin),
      badges: computeBadges(assessments, history, week, missionDay),
    };
  }, [crewId, history, missionDay, exercisePlanMin, assessments]);

  const setStatus = (task: Task, status: 'skipped' | 'due') => {
    setTaskStatus(task, status).catch((err: unknown) => {
      toast.show({
        title: 'Could not update the task',
        body: err instanceof Error ? err.message : String(err),
        tone: 'act',
      });
    });
  };

  const done = tasks?.filter((t) => t.status === 'done') ?? [];
  const open = tasks?.filter((t) => t.status === 'due' || t.status === 'overdue') ?? [];
  return (
    <Card
      title="Today's plan"
      subtitle={tasks ? `${open.length} open · ${done.length} done` : 'Loading'}
      data-testid="today-plan"
      aria-label="Today's plan"
    >
      <div className="flex flex-col gap-4">
        {game ? (
          <div className="flex flex-col gap-2">
            <StreakRow streaks={game.streaks} />
            <BadgeRow badges={game.badges} />
          </div>
        ) : (
          <Skeleton lines={2} label="Loading streaks" />
        )}
        {tasks === undefined ? (
          <Skeleton lines={5} label="Loading today's plan" />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Nothing planned today"
            body="No reading is due for this mission day."
          />
        ) : (
          <ul aria-label="Tasks" className="divide-y divide-border">
            {tasks.map((t) => (
              <PlanRow
                key={t.id}
                task={t}
                onStartRoute={() => setSelectedCrew(crewId)}
                onStartCheckin={onFocusCheckin}
                onSkip={(task) => setStatus(task, 'skipped')}
                onUndoSkip={(task) => setStatus(task, 'due')}
              />
            ))}
          </ul>
        )}
        {tasks && game && (
          <PointsLine
            todayDone={done.reduce((s, t) => s + t.points, 0)}
            todayTotal={tasks.filter((t) => t.status !== 'skipped').reduce((s, t) => s + t.points, 0)}
            week={game.week.points}
            crewWeek={crewWeekPoints}
          />
        )}
        <Countermeasures />
      </div>
    </Card>
  );
}
