import { ExternalLink } from 'lucide-react';

import type { SignalDef } from '../../domain/types';
import { Badge } from '../../ui/Badge';
import { HowTo } from '../../ui/HowTo';
import { SourceBadge } from '../../ui/SourceBadge';
import { getSource } from '../../ui/sources';
import { HAZARD_LABEL } from './cardHelpers';

/** FR-SIG-4 step 5: what, why in space, how to measure, hazard tag, NASA risk link. Texts from the signal catalog. */
export function SignalAbout({ def }: { def: SignalDef }) {
  const risks = def.nasaRiskIds.map((id) => ({ id, src: getSource(id) }));
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-text">{def.shortWhat}</p>
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-medium text-text-2">Why it matters in space</h4>
        <p className="text-text">
          {def.whyInSpace}{' '}
          <SourceBadge sourceIds={def.sourceIds} title={`${def.label}: why it matters in space`} />
        </p>
      </div>
      <HowTo
        defaultOpen={false}
        steps={def.howToMeasure.map((text) => ({ text, tag: 'demo wording' as const }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">Hazard: {HAZARD_LABEL[def.hazard]}</Badge>
        <SourceBadge sourceIds={['SRC_NASA_HAZARDS']} title="NASA's five hazards of human spaceflight" />
      </div>
      {risks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {risks.map(({ id, src }) => (
            <li key={id} className="flex flex-wrap items-center gap-2">
              {src?.url ? (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-target items-center gap-1.5 text-brand underline-offset-2 hover:underline"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  {src.title}
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <span className="text-text-2">{src?.title ?? id}</span>
              )}
              <SourceBadge sourceIds={[id]} title="Linked NASA risk" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
