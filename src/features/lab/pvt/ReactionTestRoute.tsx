// /lab/pvt — Reaction Self-Test wired to the stores (subject, mission day) and the health service.
// Practice = the subject has no earlier reaction_test that was actually measured (label MEASURED, kind not
// 'simulated'); the simulated crew's weekly pre-flight runs do not count (doc 09 §4).
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import type { NewObservation } from '../../../domain/types';
import { useObservations } from '../../../services/hooks';
import { useFocusedFlow } from '../../../state/hooks';
import { useToast } from '../../../ui/toastContext';
import { saveObservation, toastSaved } from '../saveWithToast';
import { useLabSubject } from '../subject';
import type { LabSubject } from '../subject';
import { SubjectGate } from '../SubjectGate';
import { PvtEvaluation } from './PvtEvaluation';
import { ReactionTestFlow } from './ReactionTestFlow';

function ReactionTestFor({ crewId, subject }: { crewId: string; subject: LabSubject }) {
  const { crewName, missionDay } = subject;
  const navigate = useNavigate();
  const toast = useToast();
  const runs = useObservations({ crewId, signalId: 'reaction_test' });
  const isPractice = runs !== undefined && !runs.some((o) => o.source.label === 'MEASURED' && o.source.kind !== 'simulated');
  const onSave = useCallback(
    async (o: NewObservation) => {
      const saved = await saveObservation(o);
      toastSaved(toast, 'Reaction Self-Test', crewName);
      return saved;
    },
    [toast, crewName],
  );
  return (
    <ReactionTestFlow
      crewId={crewId}
      crewName={crewName}
      missionDay={missionDay}
      onSave={onSave}
      onExit={() => void navigate('/lab')}
      isPractice={isPractice}
      renderEvaluation={({ saved }) => <PvtEvaluation crewId={crewId} crewName={crewName} missionDay={missionDay} saved={saved} />}
    />
  );
}

export function ReactionTestRoute() {
  useFocusedFlow({ title: 'Reaction Self-Test', exitTo: '/lab' });
  const subject = useLabSubject();
  return (
    <SubjectGate subject={subject} title="Reaction Self-Test">
      {(crewId) => <ReactionTestFor key={crewId} crewId={crewId} subject={subject} />}
    </SubjectGate>
  );
}
