import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ChevronDown } from 'lucide-react';

import type { Assessment, LayerId, Verdict } from '../domain/types';
import { CaughtOnlyByPersonal, LayerTriad } from './LayerTriad';
import { StatusPill } from './StatusPill';
import { TONE, VERDICT, cx } from './tone';

export interface SignalCardProps {
  title: string;
  verdict: Verdict;
  /** Latest value, normally a <Value>. */
  value?: ReactNode;
  layers?: Assessment['layers'];
  drivenBy?: readonly LayerId[];
  caughtOnlyByPersonal?: boolean;
  /** Normally a <Sparkline> with the personal band. */
  sparkline?: ReactNode;
  /** Controlled expansion; omit both to let the card manage it. */
  expanded?: boolean;
  onToggle?: (next: boolean) => void;
  defaultExpanded?: boolean;
  // Expanded slots, rendered in the order of FR-SIG-4:
  /** 1. <ActionCard> "Do this next". */
  action?: ReactNode;
  /** 2. Why: driving-layer sentence(s). */
  why?: ReactNode;
  /** 3. Layer detail, normally <LayerTriad variant="expanded">. */
  layerDetail?: ReactNode;
  /** 4. <BandChart>. */
  chart?: ReactNode;
  /** 5. About this measurement: what, why in space, <HowTo>, hazard, NASA risk, related study. */
  about?: ReactNode;
  /** 6. Provenance: source kind, method, quality, time and age, sources link. */
  provenance?: ReactNode;
  className?: string;
}

function Slot({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wider text-text-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Signal card shell (doc 11 §4, FR-SIG-4). Collapsed: label, value, triad, sparkline. Expanded: six slots. */
export function SignalCard(props: SignalCardProps) {
  const { title, verdict, value, layers, drivenBy, caughtOnlyByPersonal, sparkline, className } = props;
  const [own, setOwn] = useState(props.defaultExpanded ?? false);
  const expanded = props.expanded ?? own;
  const regionId = useId();
  const toggle = () => {
    const next = !expanded;
    if (props.expanded === undefined) setOwn(next);
    props.onToggle?.(next);
  };
  const t = TONE[VERDICT[verdict].tone];
  const flagged = verdict === 'WATCH' || verdict === 'ACT';
  return (
    <article
      data-verdict={verdict}
      className={cx(
        'rounded-card border bg-surface-1',
        flagged ? cx(t.border, 'border-l-4', t.accent) : 'border-border',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={toggle}
          className="flex min-h-target min-w-0 flex-1 items-center gap-2 rounded-control px-1 text-left"
        >
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={cx(
              'shrink-0 text-text-3 transition-transform duration-200 ease-out',
              expanded && 'rotate-180',
            )}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{title}</span>
          <StatusPill verdict={verdict} size="sm" />
        </button>
        {value && <div className="shrink-0">{value}</div>}
        {layers && <LayerTriad layers={layers} drivenBy={drivenBy} />}
        {sparkline && <div className="shrink-0">{sparkline}</div>}
      </div>
      {caughtOnlyByPersonal && !expanded && (
        <div className="px-4 pb-3">
          <CaughtOnlyByPersonal />
        </div>
      )}
      <AnimatePresence initial={false}>
        {expanded && (
          <m.div
            id={regionId}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 border-t border-border px-4 py-4">
              {props.action}
              {props.why && <Slot title="Why">{props.why}</Slot>}
              {props.layerDetail && <Slot title="Layers">{props.layerDetail}</Slot>}
              {props.chart && <Slot title="Trend vs your band">{props.chart}</Slot>}
              {props.about && <Slot title="About this measurement">{props.about}</Slot>}
              {props.provenance && <Slot title="Provenance">{props.provenance}</Slot>}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </article>
  );
}
