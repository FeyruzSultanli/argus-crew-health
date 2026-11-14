import { Fingerprint } from 'lucide-react';

import type { LayerId } from '../../domain/types';
import { LAYER_NAME, LAYER_ORDER, cx } from '../../ui';
import type { LayerCounts } from './counters';

export interface LayerCountersProps {
  counts: LayerCounts;
  /** Who is counted, e.g. "Your signals today" or "Across 4 crew today". */
  scope: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const LAYER_HINT: Record<LayerId, string> = {
  personal: 'vs your own usual range',
  space: 'NASA space-adapted rules',
  earth: 'Earth clinical ranges',
};

/**
 * The three-layer idea at a glance (FR-SIG-6): flags per layer, Earth false alarms, and the headline counter
 * "Caught only by personal baseline". Counts are tallies of the verdicts on screen (no thresholds of their own).
 */
export function LayerCounters({ counts, scope }: LayerCountersProps) {
  return (
    <section
      aria-labelledby="layer-counters-title"
      className="flex flex-col gap-3"
      data-testid="layer-counters"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="layer-counters-title" className="text-sm font-semibold text-text">
          Every signal judged three ways: Personal · Space · Earth
        </h3>
        <span className="font-mono text-xs text-text-3">{scope}</span>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LAYER_ORDER.map((id) => {
          const n = counts[id];
          return (
            <li
              key={id}
              data-layer={id}
              className="flex flex-col gap-0.5 rounded-control border border-border bg-surface-2 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-text">
                <span
                  aria-hidden="true"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-pill border border-border-strong font-mono text-[11px] text-text-2"
                >
                  {LAYER_NAME[id].short}
                </span>
                {LAYER_NAME[id].name}
              </span>
              <span className={cx('font-mono text-lg tabular-nums', n > 0 ? 'text-text' : 'text-text-2')}>
                {plural(n, 'flag', 'flags')}
              </span>
              <span className="text-xs text-text-3">
                {id === 'earth' && counts.earthFalseAlarms > 0
                  ? `${plural(counts.earthFalseAlarms, 'false alarm', 'false alarms')} avoided`
                  : LAYER_HINT[id]}
              </span>
            </li>
          );
        })}
        <li
          data-testid="caught-only-counter"
          className="flex flex-col gap-0.5 rounded-control border border-brand bg-brand-bg px-3 py-2"
        >
          <span className="flex items-center gap-2 text-sm text-brand">
            <Fingerprint size={16} aria-hidden="true" />
            Caught only by personal baseline
          </span>
          <span className="font-mono text-lg text-text tabular-nums">{counts.caughtOnlyByPersonal}</span>
          <span className="text-xs text-text-2">missed by Space and Earth rules</span>
        </li>
      </ul>
    </section>
  );
}
