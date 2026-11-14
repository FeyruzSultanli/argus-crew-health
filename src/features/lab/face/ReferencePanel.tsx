// The subject's reference scan on this device, with "Reset reference".
import { RotateCcw } from 'lucide-react';

import { Badge, Button, Value } from '../../../ui';
import { REFERENCE_EXPLAINER, REFERENCE_NAME, REFERENCE_RESET_HELP } from './copy';
import type { FaceReference } from './referenceStore';

const MEASURED = ['SRC_MEDIAPIPE_FACE'];

export function ReferencePanel({ reference, onReset }: { reference: FaceReference | null; onReset: () => void }) {
  return (
    <div className="mt-4 rounded-card border border-border p-3" data-testid="fs-reference">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{REFERENCE_NAME}</Badge>
        {reference ? (
          <span className="text-sm text-text-2">
            set on mission day {reference.missionDay} ({reference.quality.label} quality)
          </span>
        ) : (
          <span className="text-sm text-text-2">not set yet</span>
        )}
      </div>
      {reference ? (
        <>
          <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-text-3">
            Cheek width ÷ pupil distance
            <Value value={reference.features.cheekWidth} precision={3} sourceIds={MEASURED} label="MEASURED" size="sm" title="Reference cheek width / IPD" />
            · jaw width ÷ pupil distance
            <Value value={reference.features.jawWidth} precision={3} sourceIds={MEASURED} label="MEASURED" size="sm" title="Reference jaw width / IPD" />
            · eye opening ÷ pupil distance
            <Value value={reference.features.eyeAperture} precision={3} sourceIds={MEASURED} label="MEASURED" size="sm" title="Reference eye aperture / IPD" />
          </p>
          <p className="mt-2 max-w-prose text-xs text-text-3">{REFERENCE_RESET_HELP}</p>
          <div className="mt-2">
            <Button icon={RotateCcw} onClick={onReset}>
              Reset reference
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-2 max-w-prose text-sm text-text-2">{REFERENCE_EXPLAINER}</p>
      )}
    </div>
  );
}
