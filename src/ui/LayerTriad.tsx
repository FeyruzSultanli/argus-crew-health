import { useState } from 'react';
import { Fingerprint } from 'lucide-react';

import type { Assessment, LayerId } from '../domain/types';
import { StatusPill } from './StatusPill';
import { Tooltip } from './Tooltip';
import { TONE, VERDICT, cx } from './tone';
import { Value } from './Value';
import { LAYER_NAME, LAYER_ORDER } from './layers';

export interface LayerTriadProps {
  layers: Assessment['layers'];
  /** Layers that produced the final verdict; marked "drove verdict". */
  drivenBy?: readonly LayerId[];
  /** compact = three mini pills "P · S · E" (cards, lists); expanded = three panels with reason and numbers. */
  variant?: 'compact' | 'expanded';
  /** Show the "Caught only by personal baseline" marker (Assessment.caughtOnlyByPersonal). */
  caughtOnlyByPersonal?: boolean;
  className?: string;
}

/** Marker for the headline case: only the personal baseline flagged it. */
export function CaughtOnlyByPersonal() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-brand px-2.5 py-0.5 text-xs font-medium text-brand">
      <Fingerprint size={14} aria-hidden="true" />
      Caught only by personal baseline
    </span>
  );
}

function MiniPill({
  layer,
  result,
  driving,
}: {
  layer: LayerId;
  result: Assessment['layers'][LayerId];
  driving: boolean;
}) {
  const [tapped, setTapped] = useState(false);
  const meta = VERDICT[result.verdict];
  const t = TONE[meta.tone];
  const Icon = meta.icon;
  const n = LAYER_NAME[layer];
  return (
    <Tooltip
      forceOpen={tapped}
      content={
        <span className="flex flex-col gap-1">
          <span className="font-medium">
            {n.long}: {meta.word}
            {driving ? ' · drove the verdict' : ''}
          </span>
          <span className="text-text-2">{result.reason}</span>
        </span>
      }
    >
      {(describedBy) => (
        <button
          type="button"
          aria-label={`${n.long}: ${meta.word}`}
          aria-describedby={describedBy}
          aria-expanded={tapped}
          onClick={() => setTapped((v) => !v)}
          onBlur={() => setTapped(false)}
          className="inline-flex h-target min-w-target items-center justify-center rounded-control"
        >
          <span
            className={cx(
              'inline-flex h-6 items-center gap-1 rounded-pill border px-1.5 font-mono text-xs font-medium',
              t.bg,
              t.text,
              driving ? 'border-current' : t.border,
            )}
          >
            <span aria-hidden="true">{n.short}</span>
            <Icon size={12} aria-hidden="true" className={t.icon} strokeWidth={2.5} />
          </span>
        </button>
      )}
    </Tooltip>
  );
}

/** The three layer verdicts. Colour never alone: each pill carries a letter, an icon and a spoken name. */
export function LayerTriad({
  layers,
  drivenBy = [],
  variant = 'compact',
  caughtOnlyByPersonal = false,
  className,
}: LayerTriadProps) {
  if (variant === 'compact') {
    return (
      <span role="group" aria-label="Layer verdicts" className={cx('inline-flex items-center', className)}>
        {LAYER_ORDER.map((id) => (
          <MiniPill key={id} layer={id} result={layers[id]} driving={drivenBy.includes(id)} />
        ))}
      </span>
    );
  }
  return (
    <div className={cx('flex flex-col gap-3', className)}>
      {caughtOnlyByPersonal && (
        <div>
          <CaughtOnlyByPersonal />
        </div>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {LAYER_ORDER.map((id) => {
          const r = layers[id];
          const driving = drivenBy.includes(id);
          return (
            <li
              key={id}
              className={cx(
                'flex flex-col gap-2 rounded-control border bg-surface-2 p-3',
                driving ? TONE[VERDICT[r.verdict].tone].border : 'border-border',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-text">{LAYER_NAME[id].name}</h4>
                {driving && (
                  <span className="font-mono text-[11px] tracking-wide text-text-2 uppercase">
                    drove verdict
                  </span>
                )}
              </div>
              <StatusPill verdict={r.verdict} size="sm" className="self-start" />
              <p className="text-sm text-text-2">{r.reason}</p>
              {r.numbers && Object.keys(r.numbers).length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
                  {Object.entries(r.numbers).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-mono text-xs text-text-3">{k}</dt>
                      <dd>
                        <Value
                          value={v}
                          sourceIds={r.sourceIds}
                          size="sm"
                          title={`${LAYER_NAME[id].long}: ${k}`}
                          convert={false}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
