// Vision check (FR-LAB-4, doc 09 §3): pick a test → screen calibration → the Amsler or near-acuity flow.
// "Screening only — not a diagnosis." is shown on every vision screen. No store access: subject, day and save
// functions come in as props (VisionCheckRoute wires them).
import { Grid3x3, ScanEye } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { SourceBadge } from '../../../ui';
import { Button, Card } from '../../../ui';
import { SubjectChip } from '../SubjectChip';
import { AcuityFlow, type AcuityFlowProps } from './AcuityFlow';
import { AmslerFlow, type AmslerFlowProps } from './AmslerFlow';
import { HandbookLink, ScreeningBanner, VisionTestModeBadge } from './bits';
import { CalibrationStep } from './CalibrationStep';
import type { VisionTestMode } from './testMode';

type TestKind = 'amsler' | 'acuity';
type Step = { k: 'menu' } | { k: 'calibrate'; test: TestKind } | { k: 'run'; test: TestKind; pxPerMm: number };

export interface VisionCheckFlowProps {
  crewId: string;
  crewName: string;
  missionDay: number;
  testMode: VisionTestMode | null;
  onSaveAmsler: AmslerFlowProps['onSave'];
  onSaveAcuity: AcuityFlowProps['onSave'];
  onExit: () => void;
  renderCamera?: AmslerFlowProps['renderCamera'];
  /** Extra header controls (e.g. the CMO's "Change" subject button). */
  headerExtra?: ReactNode;
}

function Menu({ onPick }: { onPick: (t: TestKind) => void }) {
  return (
    <Card title="Choose a test" headingLevel={2}>
      <p className="mb-4 text-sm text-text-2">
        Modeled on the ISS in-flight vision exam, which includes acuity software and an Amsler grid on a laptop{' '}
        <SourceBadge sourceIds={['SRC_VISION_ISS']} title="ISS vision exam" />. Eye changes (SANS) are common in long-duration crew{' '}
        <SourceBadge sourceIds={['SRC_SANS_CAMBRIDGE']} title="SANS" />. Test one eye at a time; the screen is calibrated first.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="primary" icon={Grid3x3} className="h-auto min-h-16 justify-start py-3 text-left" onClick={() => onPick('amsler')}>
          <span className="flex flex-col">
            <span className="font-semibold">Amsler grid</span>
            <span className="text-sm font-normal">Mark squares that look wavy, blurred or missing.</span>
          </span>
        </Button>
        <Button icon={ScanEye} className="h-auto min-h-16 justify-start py-3 text-left" onClick={() => onPick('acuity')}>
          <span className="flex flex-col">
            <span className="font-semibold">Near acuity (tumbling E)</span>
            <span className="text-sm font-normal">Give the direction of smaller and smaller letters.</span>
          </span>
        </Button>
      </div>
      <div className="mt-4">
        <HandbookLink />
      </div>
    </Card>
  );
}

export function VisionCheckFlow(props: VisionCheckFlowProps) {
  const { crewId, crewName, missionDay, testMode, onSaveAmsler, onSaveAcuity, onExit, renderCamera, headerExtra } = props;
  const [step, setStep] = useState<Step>({ k: 'menu' });
  const toMenu = () => setStep({ k: 'menu' });
  return (
    <section aria-labelledby="vision-title" className="mx-auto flex max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 id="vision-title" className="text-2xl font-semibold">
          Vision check
        </h1>
        <SubjectChip name={crewName} />
        {headerExtra}
        {testMode && <VisionTestModeBadge />}
      </header>
      <ScreeningBanner />
      {step.k === 'menu' && <Menu onPick={(test) => setStep({ k: 'calibrate', test })} />}
      {step.k === 'calibrate' && <CalibrationStep onBack={toMenu} onReady={(pxPerMm) => setStep({ k: 'run', test: step.test, pxPerMm })} />}
      {step.k === 'run' && step.test === 'amsler' && (
        <AmslerFlow
          crewId={crewId}
          crewName={crewName}
          missionDay={missionDay}
          pxPerMm={step.pxPerMm}
          testMode={testMode}
          onSave={onSaveAmsler}
          onExit={onExit}
          renderCamera={renderCamera}
        />
      )}
      {step.k === 'run' && step.test === 'acuity' && (
        <AcuityFlow
          crewId={crewId}
          crewName={crewName}
          missionDay={missionDay}
          pxPerMm={step.pxPerMm}
          testMode={testMode}
          onSave={onSaveAcuity}
          onExit={onExit}
          renderCamera={renderCamera}
        />
      )}
    </section>
  );
}
