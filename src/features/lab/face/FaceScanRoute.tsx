// /lab/face — wires the face scan to the stores and the health record (doc 09 intro "Subject", docs/09 §2).
// Subject from the shared Lab rule (subject.ts + SubjectGate). The reference comes from this device's
// referenceStore and counts only while its observation is still in the record. After Save: the real domain verdict
// for face_fluid_index (useAssessments) and the subject's trend.
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import type { NewObservation } from '../../../domain/types';
import { healthService } from '../../../services/healthService';
import { useObservations } from '../../../services/hooks';
import { useFocusedFlow } from '../../../state/hooks';
import { useToast } from '../../../ui';
import { ChangeSubjectButton, SubjectGate } from '../SubjectGate';
import { useLabSubject } from '../subject';
import type { LabSubject } from '../subject';
import { TITLE } from './copy';
import type { FaceScanDeps } from './deps';
import { FaceEvaluation } from './FaceEvaluation';
import { FaceScanFlow } from './FaceScanFlow';
import { FaceTrend } from './FaceTrend';
import { type FaceReference, clearReference, isReferenceValid, loadReference, saveReference } from './referenceStore';

export interface FaceScanRouteProps {
  deps?: Partial<FaceScanDeps>;
  debug?: boolean;
}

function FaceScanFor({ crewId, subject, deps, debug }: { crewId: string; subject: LabSubject } & FaceScanRouteProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { crewName, missionDay } = subject;
  const history = useObservations({ crewId, signalId: 'face_fluid_index' });
  const [stored, setStored] = useState<FaceReference | null>(() => loadReference(crewId));
  const ids = useMemo(() => new Set((history ?? []).map((o) => o.id)), [history]);
  // While the record loads, keep the stored reference; afterwards it counts only if its observation still exists.
  const reference = history === undefined ? stored : isReferenceValid(stored, ids) ? stored : null;

  const onSave = useCallback(
    async (o: NewObservation) => {
      const saved = await healthService.addObservation(o);
      toast.show({ title: 'Face scan saved', body: `Saved for ${crewName}, mission day ${saved.missionDay}.`, tone: 'ok' });
      return saved;
    },
    [crewName, toast],
  );
  const onReferenceSet = useCallback((ref: FaceReference) => {
    saveReference(ref);
    setStored(ref);
  }, []);
  const onResetReference = useCallback(() => {
    clearReference(crewId);
    setStored(null);
  }, [crewId]);

  return (
    <FaceScanFlow
      crewId={crewId}
      crewName={crewName}
      missionDay={missionDay}
      reference={reference}
      onSave={onSave}
      onReferenceSet={onReferenceSet}
      onResetReference={onResetReference}
      onExit={() => void navigate('/lab')}
      subjectAction={<ChangeSubjectButton subject={subject} />}
      renderAfterSave={(savedId) => (
        <>
          <FaceEvaluation crewId={crewId} missionDay={missionDay} savedId={savedId} />
          <FaceTrend history={history ?? []} />
        </>
      )}
      deps={deps}
      debug={debug}
    />
  );
}

export function FaceScanRoute({ deps, debug }: FaceScanRouteProps) {
  useFocusedFlow({ title: TITLE, exitTo: '/lab' });
  const subject = useLabSubject();
  return (
    <SubjectGate subject={subject} title={TITLE}>
      {/* keyed by crew id: changing the subject resets the flow and stops the camera */}
      {(crewId) => <FaceScanFor key={crewId} crewId={crewId} subject={subject} deps={deps} debug={debug} />}
    </SubjectGate>
  );
}
