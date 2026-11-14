// Where a plan task's "Start" goes (FR-PLAN-1). Pure.
import type { SignalId, Task } from '../../domain/types';

export type StartTarget = { kind: 'route'; to: string } | { kind: 'checkin' };

/** Signals logged in the Quick check-in on the Bridge itself. */
const CHECKIN_ON_PAGE: ReadonlySet<SignalId> = new Set<SignalId>(['mood', 'sleep_duration', 'symptoms']);

export function startTarget(signalId: SignalId | undefined): StartTarget {
  switch (signalId) {
    case 'heart_rate_rest':
      return { kind: 'route', to: '/lab/camera' };
    case 'reaction_test':
      return { kind: 'route', to: '/lab/pvt' };
    case 'amsler':
    case 'near_acuity':
      return { kind: 'route', to: '/lab/vision' };
    default:
      if (signalId && CHECKIN_ON_PAGE.has(signalId)) return { kind: 'checkin' };
      return { kind: 'route', to: '/lab/manual' };
  }
}

export const KIND_LABEL: Record<Task['kind'], string> = {
  measure: 'Measure',
  checkin: 'Check-in',
  exam: 'Exam',
  countermeasure: 'Countermeasure',
};

export const STATUS_LABEL: Record<Task['status'], string> = {
  done: 'Done',
  due: 'Due',
  overdue: 'Overdue',
  skipped: 'Skipped',
};

/** Element id of the Quick check-in wrapper the "Start" of mood / sleep / symptoms focuses. */
export const QUICK_CHECKIN_ID = 'quick-checkin';
