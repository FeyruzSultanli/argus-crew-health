// /lab/vision — vision check wired to the subject gate, mission day and the health service. Lazy-loaded by
// LabPage (React.lazy) so the Lab chunk does not grow for users who never open it.
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';

import type { NewObservation } from '../../../domain/types';
import { useFocusedFlow } from '../../../state/hooks';
import { useToast } from '../../../ui/toastContext';
import { toastSaved } from '../saveWithToast';
import { useLabSubject } from '../subject';
import type { LabSubject } from '../subject';
import { ChangeSubjectButton, SubjectGate } from '../SubjectGate';
import type { AmslerEyeResult } from './AmslerResult';
import { CameraDistance } from './CameraDistance';
import type { DistanceMethod } from './observations';
import { saveAmslerResults, saveObservations } from './saveVision';
import { visionTestModeFromSearch } from './testMode';
import { VisionCheckFlow } from './VisionCheckFlow';

function VisionFor({ crewId, subject }: { crewId: string; subject: LabSubject }) {
  const { crewName, missionDay } = subject;
  const navigate = useNavigate();
  const toast = useToast();
  const testMode = useMemo(() => (typeof window === 'undefined' ? null : visionTestModeFromSearch(window.location.search)), []);

  const onSaveAmsler = useCallback(
    async (results: readonly AmslerEyeResult[], distance: DistanceMethod) => {
      const ids = await saveAmslerResults(results, { crewId, missionDay, distance, testMode: testMode !== null });
      toastSaved(toast, 'Amsler grid', crewName);
      return ids;
    },
    [crewId, missionDay, testMode, toast, crewName],
  );
  const onSaveAcuity = useCallback(
    async (list: readonly NewObservation[]) => {
      const ids = await saveObservations(list);
      toastSaved(toast, 'Near acuity', crewName);
      return ids;
    },
    [toast, crewName],
  );
  return (
    <VisionCheckFlow
      crewId={crewId}
      crewName={crewName}
      missionDay={missionDay}
      testMode={testMode}
      onSaveAmsler={onSaveAmsler}
      onSaveAcuity={onSaveAcuity}
      onExit={() => void navigate('/lab')}
      renderCamera={(targetMm, onReady) => <CameraDistance targetMm={targetMm} onReady={onReady} />}
      headerExtra={<ChangeSubjectButton subject={subject} />}
    />
  );
}

export function VisionCheckRoute() {
  useFocusedFlow({ title: 'Vision check', exitTo: '/lab' });
  const subject = useLabSubject();
  return (
    <SubjectGate subject={subject} title="Vision check">
      {(crewId) => <VisionFor key={crewId} crewId={crewId} subject={subject} />}
    </SubjectGate>
  );
}
