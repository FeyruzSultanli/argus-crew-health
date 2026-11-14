import { AnimatePresence, m } from 'motion/react';
import { Info } from 'lucide-react';

import { READINESS_FORMULA, READINESS_SOURCE_IDS } from '../../domain/readiness/readiness';
import type { Readiness } from '../../domain/readiness/readiness';
import type { Verdict } from '../../domain/types';
import { Gauge, StatusPill, Tooltip, VERDICT } from '../../ui';

export interface ReadinessRingProps {
  readiness: Readiness;
  /** Worst verdict of the crew member's own signals. */
  verdict: Verdict;
  size?: number;
}

/** Readiness formula with this crew member's terms (tooltip body). */
export function ReadinessBreakdown({ readiness }: { readiness: Readiness }) {
  const shown = readiness.terms.filter((t) => t.count > 0);
  return (
    <span className="flex flex-col gap-1.5">
      <span className="font-medium">Readiness index · demo formula</span>
      <span className="text-text-2">{READINESS_FORMULA}</span>
      <span className="font-mono text-text-2">
        {shown.length === 0
          ? 'No deductions today.'
          : shown
              .map((t) => `−${t.deduction} ${t.label.toLowerCase()} (${t.count})${t.capped ? ' capped' : ''}`)
              .join(' · ')}
      </span>
      <span className="text-text-3">A demo index, not a medical score.</span>
    </span>
  );
}

/** Status ring: readiness 0–100 in the worst verdict's colour, with the verdict word under it (never colour alone). */
export function ReadinessRing({ readiness, verdict, size = 128 }: ReadinessRingProps) {
  return (
    <div
      className="flex flex-col items-center gap-1"
      data-testid="readiness-ring"
      data-score={readiness.score}
    >
      <Gauge
        value={readiness.score}
        max={100}
        label="Readiness"
        sourceIds={READINESS_SOURCE_IDS}
        tone={VERDICT[verdict].tone}
        size={size}
        footer={
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={verdict}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="inline-flex"
            >
              <StatusPill verdict={verdict} />
            </m.span>
          </AnimatePresence>
        }
      />
      <Tooltip content={<ReadinessBreakdown readiness={readiness} />} side="bottom">
        {(describedBy) => (
          <button
            type="button"
            aria-describedby={describedBy}
            className="inline-flex min-h-target items-center gap-1.5 rounded-control px-2 text-xs text-text-2 hover:text-text"
          >
            <Info size={14} aria-hidden="true" />
            How readiness is computed
          </button>
        )}
      </Tooltip>
    </div>
  );
}
