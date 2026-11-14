// "Today" plan: tasks from cadence and staleness (FR-PLAN-1, FR-SIG-5), vision exams on a fixed schedule,
// points per task kind (doc 11 §9). Pure: the caller passes, per signal, its cadence and the last reading day.
// Points and the task-kind mapping are demo parameters [SRC_DEMO_READINESS]; the vision schedule is modeled on the
// research cadence [SRC_OCULAR_CADENCE].
import type { SignalId, Task } from '../types';

/** Points per completed task kind (doc 11 §9) [SRC_DEMO_READINESS]. */
export const PLAN_POINTS: Record<Task['kind'], number> = {
  measure: 10,
  exam: 25,
  checkin: 5,
  countermeasure: 10, // not listed in doc 11 §9; counted like a measurement [SRC_DEMO_READINESS]
};

/** Vision exam flight days: 10, 30, 60, 90, 120, then every 30 days (doc 07 §4.10) [SRC_OCULAR_CADENCE]. */
export const VISION_EXAM_DAYS: readonly number[] = [10, 30, 60, 90, 120];
const VISION_REPEAT_DAYS = 30;
const VISION_SIGNALS: ReadonlySet<SignalId> = new Set<SignalId>(['amsler', 'near_acuity']);

/** Self-reported items logged in the daily check-in (5 points) [SRC_DEMO_READINESS]. */
const CHECKIN_SIGNALS: ReadonlySet<SignalId> = new Set<SignalId>([
  'mood',
  'symptoms',
  'sleep_duration',
  'hydration',
  'exercise_minutes',
]);
/** Cabin and ledger signals never become personal tasks. */
const NON_TASK_SIGNALS: ReadonlySet<SignalId> = new Set<SignalId>([
  'cabin_co2',
  'cabin_temp',
  'cabin_humidity',
  'radiation_dose',
]);

/** FR-SIG-5: a reading older than cadence × 1.5 is overdue ("re-measure"). */
export const STALE_FACTOR = 1.5;

export function isVisionExamDay(day: number): boolean {
  if (day < 1) return false;
  if (VISION_EXAM_DAYS.includes(day)) return true;
  const last = VISION_EXAM_DAYS[VISION_EXAM_DAYS.length - 1] ?? 0;
  return day > last && (day - last) % VISION_REPEAT_DAYS === 0;
}

/** Most recent scheduled vision exam day ≤ `day` (in flight), or null before the first one. */
export function lastVisionExamDay(day: number): number | null {
  if (day < (VISION_EXAM_DAYS[0] ?? 1)) return null;
  const last = VISION_EXAM_DAYS[VISION_EXAM_DAYS.length - 1] ?? 0;
  if (day >= last) return last + Math.floor((day - last) / VISION_REPEAT_DAYS) * VISION_REPEAT_DAYS;
  let best: number | null = null;
  for (const d of VISION_EXAM_DAYS) if (d <= day) best = d;
  return best;
}

/** Calendar days from mission day `a` to mission day `b` (there is no day 0: −1 → 1 is one day). */
export function missionDaysBetween(a: number, b: number): number {
  const diff = b - a;
  if (a < 0 && b > 0) return diff - 1;
  if (a > 0 && b < 0) return diff + 1;
  return diff;
}

export interface PlanSignalInput {
  signalId: SignalId;
  cadenceDays: number;
  /** Newest mission day with a reading strictly before the plan day (null = never measured). */
  lastObservationDay: number | null;
  /** True when a reading exists on the plan day itself → the task is done. */
  observedToday?: boolean;
  /** Display label (Part 2 passes SignalDef.label); falls back to the signal id. */
  label?: string;
}

export interface PlanInput {
  crewId: string;
  missionDay: number;
  signals: PlanSignalInput[];
}

function kindOf(signalId: SignalId): Task['kind'] {
  if (VISION_SIGNALS.has(signalId)) return 'exam';
  if (CHECKIN_SIGNALS.has(signalId)) return 'checkin';
  return 'measure';
}

const fallbackLabel = (id: SignalId): string => {
  const s = id.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const STATUS_ORDER: Record<Task['status'], number> = { overdue: 0, due: 1, done: 2, skipped: 3 };
const KIND_ORDER: Record<Task['kind'], number> = { exam: 0, measure: 1, countermeasure: 2, checkin: 3 };

/** Plan status for one signal on `missionDay`, or null when nothing is planned for it that day. */
function planStatus(s: PlanSignalInput, missionDay: number): { status: Task['status']; why: string } | null {
  const elapsed = s.lastObservationDay === null ? null : missionDaysBetween(s.lastObservationDay, missionDay);

  if (VISION_SIGNALS.has(s.signalId) && missionDay >= 1) {
    const scheduled = lastVisionExamDay(missionDay);
    if (scheduled === null) return null;
    const doneSinceScheduled = s.lastObservationDay !== null && s.lastObservationDay >= scheduled;
    if (s.observedToday) return { status: 'done', why: `Scheduled vision exam (flight day ${scheduled}).` };
    if (scheduled === missionDay) return { status: 'due', why: `Scheduled vision exam today (flight day ${missionDay}).` };
    if (!doneSinceScheduled) return { status: 'overdue', why: `Vision exam of flight day ${scheduled} not done yet.` };
    return null;
  }

  const cadence = Math.max(1, s.cadenceDays);
  if (cadence === 1) {
    return s.observedToday
      ? { status: 'done', why: 'Daily reading done.' }
      : { status: 'due', why: 'Daily reading.' };
  }
  const isDue = elapsed === null || elapsed >= cadence;
  if (s.observedToday) {
    return isDue ? { status: 'done', why: `Every ${cadence} days — done today.` } : null;
  }
  if (!isDue) return null;
  if (elapsed === null) return { status: 'due', why: `No reading yet (every ${cadence} days).` };
  if (elapsed > cadence * STALE_FACTOR) {
    return { status: 'overdue', why: `Last reading ${elapsed} d ago (every ${cadence} days). Re-measure.` };
  }
  return { status: 'due', why: `Last reading ${elapsed} d ago (every ${cadence} days).` };
}

/** Builds the task list for one crew member and mission day. Sorted overdue → due → done. */
export function buildTodayPlan(input: PlanInput): Task[] {
  const tasks: Task[] = [];
  for (const s of input.signals) {
    if (NON_TASK_SIGNALS.has(s.signalId)) continue;
    const st = planStatus(s, input.missionDay);
    if (!st) continue;
    const kind = kindOf(s.signalId);
    const label = s.label ?? fallbackLabel(s.signalId);
    const verb = kind === 'exam' ? 'Vision exam' : kind === 'checkin' ? 'Log' : 'Measure';
    tasks.push({
      id: `${input.crewId}:${input.missionDay}:${s.signalId}`,
      crewId: input.crewId,
      missionDay: input.missionDay,
      kind,
      signalId: s.signalId,
      title: kind === 'exam' ? `${verb}: ${label}` : `${verb} ${label.toLowerCase()}`,
      why: st.why,
      status: st.status,
      points: PLAN_POINTS[kind],
    });
  }
  return tasks.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}
