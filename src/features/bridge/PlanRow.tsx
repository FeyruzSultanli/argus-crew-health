import { CircleAlert, SquareMinus, Play, Square, SquareCheck, Undo2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { READINESS_SOURCE_IDS } from '../../domain/readiness/readiness';
import type { Task } from '../../domain/types';
import { Badge, Button, LinkButton, Value, cx } from '../../ui';
import type { Tone } from '../../ui';
import { KIND_LABEL, STATUS_LABEL, startTarget } from './planLinks';

export interface PlanRowProps {
  task: Task;
  /** Called before a Lab deep link navigates (sets the selected crew member). */
  onStartRoute: () => void;
  /** "Start" of mood / sleep / symptoms: focus the Quick check-in on this page. */
  onStartCheckin: () => void;
  onSkip: (task: Task) => void;
  onUndoSkip: (task: Task) => void;
}

const STATUS_ICON: Record<Task['status'], { icon: LucideIcon; className: string; tone?: Tone }> = {
  done: { icon: SquareCheck, className: 'text-ok' },
  due: { icon: Square, className: 'text-text-2' },
  overdue: { icon: CircleAlert, className: 'text-watch', tone: 'watch' },
  skipped: { icon: SquareMinus, className: 'text-text-3' },
};

/** One task of the Today plan: checkbox state from task.status, type tag, title, why, points, Start / Skip. */
export function PlanRow({ task, onStartRoute, onStartCheckin, onSkip, onUndoSkip }: PlanRowProps) {
  const s = STATUS_ICON[task.status];
  const Icon = s.icon;
  const open = task.status === 'due' || task.status === 'overdue';
  const target = startTarget(task.signalId);
  return (
    <li
      data-testid={`plan-row-${task.signalId ?? task.id}`}
      data-status={task.status}
      className={cx(
        'flex flex-wrap items-center gap-x-3 gap-y-2',
        open ? 'py-2.5' : 'py-1',
        !open && 'text-text-2',
      )}
    >
      <span
        role="img"
        aria-label={STATUS_LABEL[task.status]}
        data-testid="plan-checkbox"
        className={cx('inline-flex shrink-0', s.className)}
      >
        <Icon size={22} aria-hidden="true" strokeWidth={2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cx(
              'text-sm font-medium',
              open ? 'text-text' : 'text-text-2',
              task.status === 'skipped' && 'line-through',
            )}
          >
            {task.title}
          </span>
          <Badge tone="neutral">{KIND_LABEL[task.kind]}</Badge>
          {task.status === 'overdue' && <Badge tone="watch">Overdue</Badge>}
          {task.status === 'skipped' && <Badge tone="neutral">Skipped</Badge>}
        </span>
        {open && <span className="text-xs text-text-2">{task.why}</span>}
      </div>
      <Value
        value={task.points}
        unit="pts"
        prefix="+"
        sourceIds={READINESS_SOURCE_IDS}
        size="sm"
        title="Task points"
      />
      {open && (
        <span className="flex items-center gap-2">
          {target.kind === 'route' ? (
            <LinkButton
              to={target.to}
              variant="primary"
              icon={Play}
              onClick={onStartRoute}
              aria-label={`Start: ${task.title}`}
            >
              Start
            </LinkButton>
          ) : (
            <Button
              variant="primary"
              icon={Play}
              onClick={onStartCheckin}
              aria-label={`Start: ${task.title}`}
            >
              Start
            </Button>
          )}
          <Button variant="ghost" onClick={() => onSkip(task)} aria-label={`Skip: ${task.title}`}>
            Skip
          </Button>
        </span>
      )}
      {task.status === 'skipped' && (
        <Button
          variant="ghost"
          icon={Undo2}
          onClick={() => onUndoSkip(task)}
          aria-label={`Undo skip: ${task.title}`}
        >
          Undo
        </Button>
      )}
    </li>
  );
}
