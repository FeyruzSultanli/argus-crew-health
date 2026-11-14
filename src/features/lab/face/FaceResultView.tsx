// Result of one face scan (docs/09 §2): the index vs the reference (or "Reference scan (set on this device)" for the
// first scan), the ratios in plain measurement language, quality with plain-word reasons, Save / Retake.
// Poor quality → Save off; "Save as poor quality" only when a reference exists (a reference needs fair or good).
import { CircleCheck, CircleX, RotateCcw, Save, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Quality } from '../../../domain/types';
import { FACE_SCAN, type FluidIndex, type ScanSummary, percentVsReference } from '../../../measurement/face/fluidShiftIndex';
import { Badge, Button, Card, Value } from '../../../ui';
import { NO_IMAGE_LINE, QUALITY_WORD, REFERENCE_EXPLAINER, REFERENCE_NAME, REFERENCE_NEEDS_QUALITY, TREND_ONLY } from './copy';
import { ExperimentalBadge } from './FaceIntro';

const MEASURED = ['SRC_MEDIAPIPE_FACE'];
const DEMO = [FACE_SCAN.sourceId];

export type FaceSaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; poor: boolean } | { kind: 'error'; message: string };

const PILL = {
  good: { tone: 'ok', icon: CircleCheck },
  fair: { tone: 'watch', icon: TriangleAlert },
  poor: { tone: 'act', icon: CircleX },
} as const;

function QualityPill({ quality }: { quality: Quality }) {
  const { tone, icon } = PILL[quality.label];
  return (
    <Badge tone={tone} icon={icon} className="h-8 text-sm font-semibold">
      {QUALITY_WORD[quality.label]}
    </Badge>
  );
}

function Ratio({ label, ratio }: { label: string; ratio: number }) {
  const pct = percentVsReference(ratio);
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-text-2">{label} relative to your reference:</span>
      <Value value={pct} unit="%" prefix={pct > 0 ? '+' : ''} precision={0} sourceIds={MEASURED} label="MEASURED" size="sm" title={label} />
    </li>
  );
}

export interface FaceResultViewProps {
  result: ScanSummary;
  /** The index vs the reference that was in place when the scan started; null for a reference scan or no face. */
  index: FluidIndex | null;
  /** No reference was in place when the scan started: this scan becomes the reference. */
  isReference: boolean;
  crewName: string;
  save: FaceSaveState;
  onSave: (asPoor: boolean) => void;
  onRetake: () => void;
  onExit?: () => void;
  /** Shown after Save: the rule's verdict, the trend, the reference controls. */
  afterSave?: ReactNode;
}

export function FaceResultView({ result, index, isReference, crewName, save, onSave, onRetake, onExit, afterSave }: FaceResultViewProps) {
  const saved = save.kind === 'saved';
  const busy = save.kind === 'saving';
  const poor = result.quality.label === 'poor';
  const measurable = result.features !== null;
  return (
    <Card title="Result" actions={<ExperimentalBadge />}>
      {isReference && measurable && (
        <div className="mb-3">
          <Badge tone="info" className="h-8 text-sm font-semibold">
            {REFERENCE_NAME}
          </Badge>
          <p className="mt-2 max-w-prose text-sm text-text-2">{REFERENCE_EXPLAINER}</p>
        </div>
      )}
      {measurable ? (
        <div>
          <p className="text-sm text-text-2">Face fluid-shift index</p>
          <div className="flex flex-wrap items-baseline gap-3" data-testid="fs-index">
            <Value value={index?.index ?? 1} precision={2} sourceIds={MEASURED} label="MEASURED" size="xl" title="Face fluid-shift index" />
            {index && (
              <span className="inline-flex items-center gap-1 text-text-2">
                <Value
                  value={percentVsReference(index.index)}
                  unit="%"
                  prefix={percentVsReference(index.index) > 0 ? '+' : ''}
                  precision={0}
                  sourceIds={MEASURED}
                  size="lg"
                  title="Index vs reference"
                />
                vs reference
              </span>
            )}
          </div>
          {index && (
            <ul className="mt-3 flex flex-col gap-1" data-testid="fs-ratios">
              <Ratio label="Cheek width" ratio={index.cheekWidthRatio} />
              <Ratio label="Jaw width" ratio={index.jawWidthRatio} />
              <Ratio label="Eye opening (shown separately, not in the index)" ratio={index.eyeApertureRatio} />
            </ul>
          )}
          <p className="mt-3 text-sm font-semibold text-text">{TREND_ONLY}</p>
        </div>
      ) : (
        <p className="text-text-2">No steady face was found. Please retake the scan.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <QualityPill quality={result.quality} />
        <span className="inline-flex flex-wrap items-center gap-1 text-xs text-text-3">
          steady frames <Value value={result.acceptedFrames} sourceIds={MEASURED} size="sm" title="Accepted frames" /> of{' '}
          <Value value={result.totalFrames} sourceIds={MEASURED} size="sm" title="Frames processed" /> · score{' '}
          <Value value={result.quality.score} precision={2} sourceIds={DEMO} size="sm" title="Quality score (share of steady frames)" />
          <Badge tone="neutral" variant="outline" mono>
            Demo parameter
          </Badge>
        </span>
      </div>
      {result.quality.reasons.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm text-text-2" data-testid="fs-reasons">
          {result.quality.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {poor && measurable && isReference && <p className="mt-2 text-sm text-text-2">{REFERENCE_NEEDS_QUALITY}</p>}
      {poor && measurable && !isReference && <p className="mt-2 text-sm text-text-2">Quality is poor. A retake is recommended.</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        {!saved && (
          <Button variant="primary" icon={Save} disabled={poor || !measurable || busy} onClick={() => onSave(false)}>
            {isReference ? 'Save as reference scan' : 'Save'}
          </Button>
        )}
        {!saved && poor && measurable && !isReference && (
          <Button disabled={busy} onClick={() => onSave(true)}>
            Save as poor quality
          </Button>
        )}
        {saved && onExit && (
          <Button variant="primary" onClick={onExit}>
            Done
          </Button>
        )}
        <Button icon={RotateCcw} onClick={onRetake}>
          {saved ? 'Scan again' : 'Retake'}
        </Button>
        {!saved && onExit && <Button onClick={onExit}>Discard and exit</Button>}
      </div>
      <p className="mt-3 text-sm" role="status" aria-live="polite">
        {save.kind === 'saving' && <span className="text-text-2">Saving…</span>}
        {saved && (
          <span className="text-ok-fg">
            Saved to {crewName}&apos;s health record{save.poor ? ' (marked poor quality)' : ''}. {NO_IMAGE_LINE}
          </span>
        )}
        {save.kind === 'error' && <span className="text-watch-fg">Not saved: {save.message}</span>}
      </p>
      {saved && afterSave}
    </Card>
  );
}
