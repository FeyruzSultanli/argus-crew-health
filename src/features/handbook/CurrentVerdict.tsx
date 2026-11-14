// The subject's CURRENT verdict for a signal, shown on signal entries and in Ask-box answers: StatusPill + LayerTriad +
// the assessment's explanation and action text verbatim, with the layers' sources.
import { ArrowRight } from 'lucide-react';

import { CABIN_SIGNAL_IDS, SIGNALS } from '../../domain/signals';
import type { Assessment, SignalId } from '../../domain/types';
import { useAssessments } from '../../services/hooks';
import { useMissionStore } from '../../state/mission';
import { missionDayLabel } from '../../state/missionSelectors';
import { LayerTriad, LinkButton, Skeleton, SourceBadge, StatusPill } from '../../ui';
import { crewName } from '../settings/crewNames';
import { assessmentSourceIds } from './verdictSources';

export function VerdictBlock({ assessment, subject }: { assessment: Assessment; subject: string }) {
  const label = SIGNALS[assessment.signalId].label;
  const ids = assessmentSourceIds(assessment);
  return (
    <div className="flex flex-col gap-3" data-testid={`verdict-${assessment.signalId}`}>
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill verdict={assessment.verdict} />
        <span className="text-sm font-medium text-text">
          {label} · {subject} · {missionDayLabel(assessment.missionDay)}
        </span>
        {ids.length > 0 && (
          <SourceBadge
            sourceIds={ids}
            title={`${label}: current verdict`}
            label={assessment.latest?.source.label}
          />
        )}
      </div>
      <LayerTriad
        layers={assessment.layers}
        drivenBy={assessment.drivenBy}
        caughtOnlyByPersonal={assessment.caughtOnlyByPersonal}
        variant="compact"
      />
      <p className="text-sm text-text-2">{assessment.explanation}</p>
      {assessment.action.text && (
        <p className="text-sm font-medium text-text" data-testid="verdict-action">
          {assessment.action.text}
        </p>
      )}
    </div>
  );
}

export interface CurrentVerdictProps {
  signalIds: readonly SignalId[];
  crewId: string | null;
}

/** Verdicts of today (store mission day) for the subject; cabin signals use the cabin's assessments. */
export function CurrentVerdict({ signalIds, crewId }: CurrentVerdictProps) {
  const day = useMissionStore((s) => s.missionDay);
  const cabin = signalIds.length > 0 && signalIds.every((s) => CABIN_SIGNAL_IDS.includes(s));
  const subjectId = cabin ? 'cabin' : crewId;
  const list = useAssessments(subjectId ?? '__none__', day);
  if (!subjectId) {
    return (
      <p className="text-sm text-text-2">
        Sign in as a crew member or select one to see the current verdict for this signal.
      </p>
    );
  }
  if (list === undefined) return <Skeleton lines={3} label="Loading current verdict" />;
  const found = signalIds
    .map((id) => list.find((a) => a.signalId === id))
    .filter((a): a is Assessment => a !== undefined);
  const subject = crewName(subjectId);
  return (
    <div className="flex flex-col gap-4" data-testid="current-verdict">
      {found.length === 0 ? (
        <p className="text-sm text-text-2">
          No data for {subject} on {missionDayLabel(day)}.
        </p>
      ) : (
        found.map((a) => <VerdictBlock key={a.signalId} assessment={a} subject={subject} />)
      )}
      {!cabin && (
        <div>
          <LinkButton to={`/body/${subjectId}`} icon={ArrowRight}>
            Open {subject} on Body
          </LinkButton>
        </div>
      )}
    </div>
  );
}
