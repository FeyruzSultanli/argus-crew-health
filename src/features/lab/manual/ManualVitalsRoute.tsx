// /lab/manual — manual vitals wired to the stores (subject, mission day, unit preference) and the health service.
import { useNavigate } from 'react-router';

import type { SignalId } from '../../../domain/types';
import { useFocusedFlow } from '../../../state/hooks';
import { useUiStore } from '../../../state/ui';
import { useToast } from '../../../ui/toastContext';
import { useAssessments } from '../labData';
import { saveObservation, toastSaved } from '../saveWithToast';
import { useLabSubject } from '../subject';
import type { LabSubject } from '../subject';
import { SubjectGate } from '../SubjectGate';
import { ManualVitalsForm } from './ManualVitalsForm';

function ManualVitalsFor({ crewId, subject }: { crewId: string; subject: LabSubject }) {
  const { crewName, missionDay } = subject;
  const units = useUiStore((s) => s.units);
  const navigate = useNavigate();
  const toast = useToast();
  const assessments = useAssessments(crewId, missionDay);
  const verdictFor = assessments
    ? (id: SignalId) => assessments.find((a) => a.signalId === id && a.latest?.missionDay === missionDay)?.verdict
    : undefined;
  return (
    <ManualVitalsForm
      crewId={crewId}
      crewName={crewName}
      missionDay={missionDay}
      initialUnits={{ temp: units.temp === '[degF]' ? 'F' : 'C', glucose: units.glucose }}
      onSave={saveObservation}
      onSaved={(res) => {
        if (res.saved.length > 0) toastSaved(toast, 'Manual entries', crewName);
      }}
      verdictFor={verdictFor}
      bodyLink={`/body/${crewId}`}
      onExit={() => void navigate('/lab')}
    />
  );
}

export function ManualVitalsRoute() {
  useFocusedFlow({ title: 'Manual vitals', exitTo: '/lab' });
  const subject = useLabSubject();
  return (
    <SubjectGate subject={subject} title="Manual vitals">
      {(crewId) => <ManualVitalsFor key={crewId} crewId={crewId} subject={subject} />}
    </SubjectGate>
  );
}
