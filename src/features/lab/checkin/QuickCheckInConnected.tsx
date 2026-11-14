// Drop-in quick check-in for the Bridge: subject and mission day from the stores, save through the health service,
// one toast per check-in, verdict pills from the domain when available.
import type { SignalId } from '../../../domain/types';
import { useToast } from '../../../ui/toastContext';
import { useAssessments } from '../labData';
import { saveObservation, toastSaved } from '../saveWithToast';
import { useSelfSubject } from '../subject';
import { QuickCheckIn } from './QuickCheckIn';

export function QuickCheckInConnected() {
  const { crewId, crewName, missionDay } = useSelfSubject();
  const toast = useToast();
  const assessments = useAssessments(crewId ?? '—', missionDay);
  const verdictFor = assessments
    ? (id: SignalId) => assessments.find((a) => a.signalId === id && a.latest?.missionDay === missionDay)?.verdict
    : undefined;
  if (!crewId) return null;
  return (
    <QuickCheckIn
      crewId={crewId}
      crewName={crewName}
      missionDay={missionDay}
      verdictFor={verdictFor}
      onSave={saveObservation}
      onSaved={(res) => {
        if (res.saved.length > 0) toastSaved(toast, 'Check-in', crewName);
      }}
    />
  );
}
