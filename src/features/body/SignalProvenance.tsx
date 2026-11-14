import { BookMarked } from 'lucide-react';

import type { Assessment, Quality, SignalDef, SourceKind } from '../../domain/types';
import { useMissionStore } from '../../state/mission';
import { missionDayLabel } from '../../state/missionSelectors';
import { Badge } from '../../ui/Badge';
import type { BadgeTone } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { useSourceDrawer } from '../../ui/sourceDrawerContext';
import { cardSourceIds, readingAge } from './cardHelpers';

const KIND_LABEL: Record<SourceKind, string> = {
  manual: 'Manual entry',
  camera: 'Camera',
  device: 'Device',
  import: 'Import',
  lab: 'Lab sample',
  environment: 'Environment sensor',
  simulated: 'Simulation',
  derived: 'Derived',
};

const QUALITY_TONE: Record<Quality['label'], BadgeTone> = { good: 'ok', fair: 'watch', poor: 'act' };

/** FR-SIG-4 step 6: source kind and label, method, quality with reasons, time and age, sources link. */
export function SignalProvenance({ assessment, def }: { assessment: Assessment; def: SignalDef }) {
  const missionDay = useMissionStore((s) => s.missionDay);
  const drawer = useSourceDrawer();
  const o = assessment.latest;
  const q = assessment.quality;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {o ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-text-3">Source</dt>
          <dd className="flex flex-wrap items-center gap-2 text-text">
            {KIND_LABEL[o.source.kind]}
            <span className="rounded-[4px] border border-dashed border-border-strong px-1 font-mono text-[10px] leading-4 tracking-wider text-text-2">
              {o.source.label}
            </span>
          </dd>
          <dt className="text-text-3">Method</dt>
          <dd className="text-text">{o.source.method ?? o.source.deviceId ?? 'Not recorded'}</dd>
          <dt className="text-text-3">Time</dt>
          <dd className="font-mono text-text">
            {missionDayLabel(o.missionDay)} · {o.effectiveAt.replace('T', ' ').slice(0, 16)} UTC
          </dd>
          <dt className="text-text-3">Age</dt>
          <dd className="font-mono text-text">{readingAge(o, missionDay)}</dd>
        </dl>
      ) : (
        <p className="text-text-2">No reading on or before {missionDayLabel(missionDay)}.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={QUALITY_TONE[q.label]}>Quality: {q.label}</Badge>
        {q.reasons.length > 0 && <span className="text-text-2">{q.reasons.join(' · ')}</span>}
      </div>
      {drawer && (
        <div>
          <Button
            variant="secondary"
            icon={BookMarked}
            onClick={() => drawer.open(cardSourceIds(assessment, def), def.label)}
          >
            Sources for this card
          </Button>
        </div>
      )}
    </div>
  );
}
