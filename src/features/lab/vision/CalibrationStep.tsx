// Screen calibration step of the vision check. Reuses the Settings calibration (ID-1 card slider → px per mm, stored
// per device under the same localStorage key); starts inline when the device is not calibrated yet.
import { useState } from 'react';

import { CalibrationSettings } from '../../settings/CalibrationSettings';
import { CALIBRATION_SOURCE_IDS, loadCalibration } from '../../settings/calibration';
import { Button, Card, ErrorState, Value } from '../../../ui';
import { CALIBRATION_NOT_VERIFIED } from './observations';

export function CalibrationStep({ onReady, onBack }: { onReady: (pxPerMm: number) => void; onBack: () => void }) {
  const [stored, setStored] = useState(() => loadCalibration().pxPerMm);
  const [editing, setEditing] = useState(stored === null);
  const [missing, setMissing] = useState(false);

  const continueFromEdit = () => {
    const px = loadCalibration().pxPerMm;
    if (px === null) {
      setMissing(true);
      return;
    }
    setStored(px);
    onReady(px);
  };

  return (
    <Card title="Screen calibration" headingLevel={2} subtitle="The grid and the letters must have their real size on this screen.">
      {!editing && stored !== null ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-2">
            This device is calibrated: screen scale{' '}
            <Value value={stored} unit="px/mm" precision={2} sourceIds={CALIBRATION_SOURCE_IDS} size="sm" title="Screen scale" />.
          </p>
          <p className="text-sm text-text-2">{CALIBRATION_NOT_VERIFIED}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => onReady(stored)}>
              Use this calibration
            </Button>
            <Button onClick={() => setEditing(true)}>Calibrate again</Button>
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <CalibrationSettings />
          {missing && <ErrorState title="Not calibrated yet" message="Press “Save calibration” first, then continue." />}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={continueFromEdit}>
              Continue
            </Button>
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
