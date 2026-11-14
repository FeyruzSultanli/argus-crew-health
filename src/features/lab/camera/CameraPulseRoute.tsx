// /lab/camera — wires the camera-pulse flow to the stores and the health record (doc 09 "Subject and day quality",
// doc 11 §5.4). Subject from the shared Lab rule (subject.ts; the CMO picks first). Saves for mission.missionDay
// through healthService.addObservation; the result compares with the personal band and, once saved, shows the
// domain's verdict for heart_rate_rest.
import { useMemo } from 'react';
import { useNavigate } from 'react-router';

import type { NewObservation } from '../../../domain/types';
import { healthService } from '../../../services/healthService';
import { useFocusedFlow } from '../../../state/hooks';
import { useToast } from '../../../ui';
import { usePersonalSeries } from '../labData';
import { useLabSubject } from '../subject';
import type { LabSubject } from '../subject';
import { ChangeSubjectButton, SubjectGate } from '../SubjectGate';
import { CameraEvaluation } from './CameraEvaluation';
import { CameraPulseFlow } from './CameraPulseFlow';
import { usualBand } from './usual';

function CameraPulseFor({ crewId, subject }: { crewId: string; subject: LabSubject }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { crewName, missionDay } = subject;
  const series = usePersonalSeries(crewId, 'heart_rate_rest', missionDay);
  const usual = useMemo(() => usualBand(series, missionDay), [series, missionDay]);

  const save = async (o: NewObservation) => {
    const saved = await healthService.addObservation(o);
    toast.show({
      title: 'Pulse saved',
      body: `${saved.value ?? '—'} bpm for ${crewName}, mission day ${saved.missionDay}.`,
      tone: 'ok',
    });
    return saved;
  };

  return (
    <CameraPulseFlow
      crewId={crewId}
      crewName={crewName}
      missionDay={missionDay}
      onSave={save}
      onExit={() => void navigate('/lab')}
      usual={usual}
      renderEvaluation={() => <CameraEvaluation crewId={crewId} missionDay={missionDay} />}
      subjectAction={<ChangeSubjectButton subject={subject} />}
    />
  );
}

export function CameraPulseRoute() {
  useFocusedFlow({ title: 'Camera pulse', exitTo: '/lab' });
  const subject = useLabSubject();
  return (
    <SubjectGate subject={subject} title="Camera pulse">
      {/* keyed by crew id: changing the subject resets the flow and stops the camera */}
      {(crewId) => <CameraPulseFor key={crewId} crewId={crewId} subject={subject} />}
    </SubjectGate>
  );
}
