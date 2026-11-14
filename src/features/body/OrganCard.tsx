import { X } from 'lucide-react';

import { getSignal } from '../../domain/signals';
import type { Assessment, BodyRegionId, SignalId } from '../../domain/types';
import type { LayerLens } from '../../state/ui';
import { Button } from '../../ui/Button';
import { LAYER_NAME } from '../../ui/layers';
import { SourceBadge } from '../../ui/SourceBadge';
import { StatusPill } from '../../ui/StatusPill';
import { cx, worstVerdict } from '../../ui/tone';
import { ORGAN_FUNCTION, spaceFacts } from './organFacts';
import { REGION_LABEL, lensVerdict, regionSignalIds } from './regions';

export interface OrganCardProps {
  region: BodyRegionId;
  assessments: readonly Assessment[];
  lens: LayerLens;
  onSignal: (id: SignalId) => void;
  onClose: () => void;
  /** Corner of the body view the card sits in (the 2D view keeps the region's own label column free). */
  side?: 'left' | 'right';
}

/** FR-BODY-4: function (demo wording), what space does to it (sourced), linked signals with verdicts. */
export function OrganCard({ region, assessments, lens, onSignal, onClose, side = 'left' }: OrganCardProps) {
  const ids = regionSignalIds(region);
  const linked = ids
    .map((id) => assessments.find((a) => a.signalId === id))
    .filter((a): a is Assessment => a !== undefined);
  const verdict = worstVerdict(linked.map((a) => lensVerdict(a, lens)));
  const facts = spaceFacts(region);
  const titleId = `organ-card-${region}`;
  return (
    <section
      aria-labelledby={titleId}
      data-testid="organ-card"
      className={cx(
        'absolute bottom-3 z-10 flex max-h-[calc(100%-1.5rem)] w-[min(320px,45%)] flex-col gap-3 overflow-y-auto rounded-card border border-border bg-surface-1/95 p-4 shadow-lg backdrop-blur-sm',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={titleId} className="text-base font-semibold text-text">
            {REGION_LABEL[region]}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-3">
            <StatusPill verdict={verdict} size="sm" />
            {lens === 'combined' ? 'combined verdict' : `${LAYER_NAME[lens].long} layer`}
          </div>
        </div>
        <Button variant="ghost" icon={X} iconOnly onClick={onClose}>
          Close organ card
        </Button>
      </header>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wider text-text-3 uppercase">Function</h3>
        <p className="text-sm text-text">
          {ORGAN_FUNCTION[region]}{' '}
          <span className="rounded-[4px] border border-border-strong px-1 font-mono text-[10px] leading-4 text-text-2">
            demo wording
          </span>
        </p>
      </div>
      {facts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold tracking-wider text-text-3 uppercase">
            What space does to it
          </h3>
          {facts.map((f) => (
            <p key={f.signal} className="text-sm text-text-2">
              {f.text}{' '}
              <SourceBadge
                sourceIds={f.sourceIds}
                title={`${getSignal(f.signal).label}: why it matters in space`}
              />
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold tracking-wider text-text-3 uppercase">Linked signals</h3>
        {linked.length === 0 ? (
          <p className="text-sm text-text-3">No signals map to this region.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {linked.map((a) => (
              <li key={a.signalId}>
                <button
                  type="button"
                  onClick={() => onSignal(a.signalId)}
                  className="flex min-h-target w-full items-center justify-between gap-2 rounded-control border border-border px-2.5 text-left text-sm text-text hover:bg-surface-2"
                >
                  {getSignal(a.signalId).label}
                  <StatusPill verdict={a.verdict} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
