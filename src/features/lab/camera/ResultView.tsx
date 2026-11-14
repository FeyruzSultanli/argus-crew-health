// Result (doc 09 §1.4 step 3): big bpm, quality pill with reasons, compare-with-usual band, Save / Retake.
// Poor → Save disabled; "Save as poor quality" keeps it for the record. After Save: "Done" and "Measure again".
import type { ReactNode } from 'react';
import { Check, RotateCcw, Save } from 'lucide-react';

import type { RppgEstimate } from '../../../measurement/rppg/types';
import { Button, Card, Value } from '../../../ui';
import { QualityPill } from './bits';
import { QualityDetails } from './QualityDetails';
import { DEMO_BASELINE, DEMO_QUALITY, POS_SOURCE } from './sources';

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; poor: boolean }
  | { kind: 'error'; message: string };

interface ResultViewProps {
  result: RppgEstimate;
  crewName: string;
  usual?: { lo: number; hi: number };
  /** Verdict block from the domain, rendered under the comparison once the reading is saved. */
  evaluation?: ReactNode;
  save: SaveState;
  onSave: (asPoor: boolean) => void;
  onRetake: () => void;
  onExit?: () => void;
}

function UsualBand({ bpm, usual }: { bpm: number; usual: { lo: number; hi: number } }) {
  const lo = Math.min(usual.lo, bpm) - 10;
  const hi = Math.max(usual.hi, bpm) + 10;
  const pct = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div data-testid="cp-usual">
      <div className="relative mt-2 h-3 rounded-pill bg-surface-2" aria-hidden="true">
        <div
          className="absolute inset-y-0 rounded-pill bg-info-bg"
          style={{ left: pct(usual.lo), width: `calc(${pct(usual.hi)} - ${pct(usual.lo)})` }}
        />
        <div className="absolute -top-1 h-5 w-1 rounded bg-text" style={{ left: `calc(${pct(bpm)} - 2px)` }} />
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-text-3">
        usual <Value value={usual.lo} precision={0} sourceIds={DEMO_BASELINE} size="sm" label="SIMULATED" /> to
        <Value value={usual.hi} unit="/min" precision={0} sourceIds={DEMO_BASELINE} size="sm" label="SIMULATED" />
      </p>
    </div>
  );
}

export function ResultView({ result, crewName, usual, evaluation, save, onSave, onRetake, onExit }: ResultViewProps) {
  const bpm = result.bpm === null ? null : Math.round(result.bpm);
  const poor = result.quality.label === 'poor';
  const saved = save.kind === 'saved';
  const busy = save.kind === 'saving' || saved;
  return (
    <Card title="Result" aria-label="Result">
      <div aria-live="polite" role="status">
        <div data-testid="cp-bpm" data-bpm={bpm ?? ''}>
          <Value
            value={bpm}
            unit="/min"
            sourceIds={POS_SOURCE}
            label="MEASURED"
            size="xl"
            title="Resting heart rate (camera, rPPG)"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <QualityPill quality={result.quality} />
          <span className="inline-flex items-center gap-1 text-xs text-text-3">
            score <Value value={result.quality.score} precision={2} sourceIds={DEMO_QUALITY} size="sm" title="Quality score" />
          </span>
        </div>
        {bpm === null && <p className="mt-2 text-text-2">No pulse was found. Please retake the measurement.</p>}
        {result.quality.reasons.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-text-2">
            {result.quality.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {poor && bpm !== null && <p className="mt-2 text-sm text-text-2">Quality is poor. A retake is recommended.</p>}
      </div>
      {bpm !== null && (usual || (saved && evaluation)) && (
        <div className="mt-4">
          <p className="text-sm text-text-2">Compared with {crewName}&apos;s simulated baseline</p>
          {usual && <UsualBand bpm={bpm} usual={usual} />}
          {saved && evaluation}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {!saved && (
          <Button variant="primary" icon={Save} disabled={poor || bpm === null || busy} onClick={() => onSave(false)}>
            Save
          </Button>
        )}
        {!saved && poor && bpm !== null && (
          <Button disabled={busy} onClick={() => onSave(true)}>
            Save as poor quality
          </Button>
        )}
        {saved && onExit && (
          <Button variant="primary" icon={Check} onClick={onExit}>
            Done
          </Button>
        )}
        <Button icon={RotateCcw} onClick={onRetake}>
          {saved ? 'Measure again' : 'Retake'}
        </Button>
        {!saved && onExit && <Button onClick={onExit}>Discard and exit</Button>}
      </div>
      <p className="mt-3 text-sm" role="status" aria-live="polite">
        {save.kind === 'saving' && <span className="text-text-2">Saving…</span>}
        {saved && (
          <span className="text-ok-fg">
            Saved to {crewName}&apos;s health record{save.poor ? ' (marked poor quality)' : ''}.
          </span>
        )}
        {save.kind === 'error' && <span className="text-watch-fg">Not saved: {save.message}</span>}
      </p>
      <QualityDetails result={result} />
    </Card>
  );
}
