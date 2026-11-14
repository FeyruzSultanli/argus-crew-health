// What was just saved from the manual form / check-in: each signal with its value (<Value>), the verdict pill when
// the domain has evaluated it, otherwise an honest neutral line.
import type { NewObservation, SignalId, Verdict } from '../../../domain/types';
import { getSignal } from '../../../domain/signals';
import { StatusPill } from '../../../ui/StatusPill';
import { Value } from '../../../ui/Value';
import { SYMPTOM_IDS, SYMPTOM_LABELS } from '../checkin/symptoms';
import { readingSourceIds } from '../provenance';
import { SIGNAL_NAMES } from './saveAll';

export const VERDICT_PENDING = 'Verdict appears once the reading is evaluated.';

export interface SavedListProps {
  observations: readonly NewObservation[];
  /** Verdict of the saved signal (from the domain); undefined → not evaluated yet. */
  verdictFor?: (signalId: SignalId) => Verdict | undefined;
}

function Shown({ o }: { o: NewObservation }) {
  const sourceIds = readingSourceIds(o);
  const label = o.source.label;
  if (o.signalId === 'symptoms') {
    const ticked = SYMPTOM_IDS.filter((id) => o.components?.[id] === 1).map((id) => SYMPTOM_LABELS[id]);
    return <span className="text-sm text-text">{ticked.length ? ticked.join(', ') : 'No symptoms'}</span>;
  }
  if (o.signalId === 'blood_pressure') {
    const sys = o.components?.systolic ?? null;
    const dia = o.components?.diastolic ?? null;
    return <Value value={dia} prefix={`${sys ?? '—'}/`} unit="mm[Hg]" precision={0} sourceIds={sourceIds} label={label} title="Blood pressure" />;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Value value={o.value} unit={o.unit} sourceIds={sourceIds} label={label} title={getSignal(o.signalId).label} />
      {o.signalId === 'sleep_duration' && o.components?.quality !== undefined && (
        <span className="text-xs text-text-2">
          quality <Value value={o.components.quality} unit="{score}" precision={0} sourceIds={sourceIds} size="sm" title="Sleep quality" />
        </span>
      )}
    </span>
  );
}

export function SavedList({ observations, verdictFor }: SavedListProps) {
  const anyVerdict = observations.some((o) => verdictFor?.(o.signalId) !== undefined);
  return (
    <div data-testid="saved-list">
      <ul className="flex flex-col gap-2">
        {observations.map((o) => {
          const v = verdictFor?.(o.signalId);
          return (
            <li key={o.signalId} className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-surface-2 px-3 py-2">
              <span className="min-w-32 text-sm font-medium text-text capitalize">{SIGNAL_NAMES[o.signalId] ?? o.signalId}</span>
              <Shown o={o} />
              {v && <StatusPill verdict={v} size="sm" />}
            </li>
          );
        })}
      </ul>
      {!anyVerdict && <p className="mt-2 text-sm text-text-2">{VERDICT_PENDING}</p>}
    </div>
  );
}
