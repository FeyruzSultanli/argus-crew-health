// Screen-size (ID-1 card) and camera field-of-view calibration, stored per device in localStorage.
import { useId, useState } from 'react';

import { Button, Value } from '../../ui';
import {
  CALIBRATION_SOURCE_IDS as SRC,
  CARD_PX_RANGE,
  DEFAULT_CAMERA_FOV_DEG,
  FOV_RANGE,
  ID1_CARD_MM,
  cardHeightPx,
  cardWidthPxFromPxPerMm,
  loadCalibration,
  pxPerMmFromCardWidth,
  saveCalibration,
} from './calibration';

const DEFAULT_CARD_PX = 324; // ≈ 96 CSS px per inch, the CSS reference pixel

export function CalibrationSettings() {
  const cardId = useId();
  const fovId = useId();
  const [stored, setStored] = useState(loadCalibration);
  const [cardPx, setCardPx] = useState(() =>
    Math.round(stored.pxPerMm ? cardWidthPxFromPxPerMm(stored.pxPerMm) : DEFAULT_CARD_PX),
  );
  const [fov, setFov] = useState(stored.cameraFovDeg);
  const [saved, setSaved] = useState(false);
  const pxPerMm = pxPerMmFromCardWidth(cardPx);

  const save = () => {
    const next = { pxPerMm, cameraFovDeg: fov };
    saveCalibration(next);
    setStored(next);
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-2">
        Hold a bank card (ID-1 size,{' '}
        <Value
          value={ID1_CARD_MM.width}
          unit="mm"
          precision={2}
          sourceIds={SRC}
          size="sm"
          title="ID-1 card width"
        />{' '}
        ×{' '}
        <Value
          value={ID1_CARD_MM.height}
          unit="mm"
          precision={2}
          sourceIds={SRC}
          size="sm"
          title="ID-1 card height"
        />
        ) against the screen and move the slider until the outline matches its width.
      </p>
      <div className="overflow-hidden">
        <div
          aria-hidden="true"
          className="rounded-[10px] border-2 border-dashed border-text-2"
          style={{ width: cardPx, height: cardHeightPx(cardPx), maxWidth: '100%' }}
          data-testid="calibration-card"
        />
      </div>
      <label htmlFor={cardId} className="flex flex-col gap-1 text-sm text-text">
        Card width on screen
        <input
          id={cardId}
          type="range"
          min={CARD_PX_RANGE.min}
          max={CARD_PX_RANGE.max}
          value={cardPx}
          onChange={(e) => {
            setCardPx(Number(e.target.value));
            setSaved(false);
          }}
          className="h-target w-full accent-[var(--brand)]"
        />
      </label>
      <p className="text-sm text-text-2">
        Screen scale{' '}
        <Value value={pxPerMm} unit="px/mm" precision={2} sourceIds={SRC} size="sm" title="Screen scale" />
        {stored.pxPerMm === null && ' (not calibrated yet)'}
      </p>
      <label htmlFor={fovId} className="flex flex-col gap-1 text-sm text-text">
        Camera field of view
        <input
          id={fovId}
          type="range"
          min={FOV_RANGE.min}
          max={FOV_RANGE.max}
          value={fov}
          onChange={(e) => {
            setFov(Number(e.target.value));
            setSaved(false);
          }}
          className="h-target w-full accent-[var(--brand)]"
        />
      </label>
      <p className="text-sm text-text-2">
        Camera field of view{' '}
        <Value value={fov} unit="deg" sourceIds={SRC} size="sm" title="Camera field of view" /> (default{' '}
        <Value
          value={DEFAULT_CAMERA_FOV_DEG}
          unit="deg"
          sourceIds={SRC}
          size="sm"
          title="Default camera field of view"
        />
        )
      </p>
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save}>
          Save calibration
        </Button>
        <span aria-live="polite" className="text-sm text-text-2">
          {saved ? 'Saved on this device.' : ''}
        </span>
      </div>
    </div>
  );
}
