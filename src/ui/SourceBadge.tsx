import { useState } from 'react';

import { useSourceDrawer } from './sourceDrawerContext';
import { SOURCE_STATUS, getSources, worstStatus } from './sources';
import { Tooltip } from './Tooltip';
import { cx } from './tone';
import type { Observation } from '../domain/types';

export type DataLabel = Observation['source']['label'];

export interface SourceBadgeProps {
  sourceIds: readonly string[];
  /** What the sources back (drawer subtitle, tooltip heading), e.g. "Resting heart rate". */
  title?: string;
  freshness?: string;
  label?: DataLabel;
  /** false = static chip (inside another button, e.g. the mission chip); no drawer. */
  interactive?: boolean;
}

const CHIP: Record<string, string> = {
  verified: 'border-ok-border text-ok-fg',
  partial: 'border-watch-border text-watch-fg',
  demo: 'border-border-strong text-text-2 border-dashed',
};

/**
 * ✓ verified / ~ partial / D demo (worst of the ids). Hover/focus shows provenance and, for demo sources, the tag
 * "Demo parameter"; click/tap opens the SourceDrawer (and keeps the tag visible).
 */
export function SourceBadge({ sourceIds, title, freshness, label, interactive = true }: SourceBadgeProps) {
  const drawer = useSourceDrawer();
  const [tapped, setTapped] = useState(false);
  const status = worstStatus(sourceIds);
  const meta = SOURCE_STATUS[status];
  const sources = getSources(sourceIds);
  const chip = (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border bg-surface-2 px-1 font-mono text-[11px] leading-none font-medium',
        CHIP[status],
      )}
    >
      {meta.glyph}
    </span>
  );
  const name = `${meta.label}${sources.length ? `: ${sources.map((s) => s.title).join('; ')}` : ''}`;

  if (!interactive || !drawer) {
    return (
      <span className="inline-flex items-center" data-source-status={status}>
        {chip}
        <span className="sr-only">{name}</span>
      </span>
    );
  }

  const content = (
    <span className="flex flex-col gap-1">
      {meta.tag && (
        <span className="self-start rounded-pill border border-border-strong px-2 py-0.5 font-mono text-[11px] tracking-wide text-text uppercase">
          {meta.tag}
        </span>
      )}
      {title && <span className="font-medium">{title}</span>}
      <span className="text-text-2">{meta.label}</span>
      {sources.slice(0, 3).map((s) => (
        <span key={s.id}>· {s.title}</span>
      ))}
      {sources.length > 3 && <span className="text-text-2">+ {sources.length - 3} more</span>}
      {(freshness || label) && (
        <span className="font-mono text-[11px] text-text-2">
          {[label, freshness && `updated ${freshness} ago`].filter(Boolean).join(' · ')}
        </span>
      )}
      <span className="text-text-2">Select to see all sources.</span>
    </span>
  );

  return (
    <Tooltip content={content} forceOpen={tapped}>
      {(describedBy) => (
        <button
          type="button"
          data-source-status={status}
          aria-label={`Sources: ${meta.label}`}
          aria-describedby={describedBy}
          onClick={() => {
            setTapped(false);
            drawer.open(sourceIds, title);
          }}
          onPointerDown={(e) => {
            if (e.pointerType === 'touch') setTapped(true);
          }}
          onBlur={() => setTapped(false)}
          className="-mx-3 -my-3 inline-flex h-target w-target cursor-pointer items-center justify-center rounded-control hover:[&>span]:bg-surface-1"
        >
          {chip}
        </button>
      )}
    </Tooltip>
  );
}
