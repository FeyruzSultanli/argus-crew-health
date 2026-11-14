import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { Assessment, Verdict } from '../domain/types';
import { Button, LinkButton } from './Button';
import { TONE, VERDICT, cx } from './tone';
import { Value } from './Value';

export interface ActionCardPrimary {
  label: string;
  icon?: LucideIcon;
  /** Router path (e.g. '/lab/camera', '/handbook/suspected-infection'); or use onClick. */
  to?: string;
  onClick?: () => void;
}

export interface ActionCardProps {
  verdict: Verdict;
  /** Action text — only from doc 07 (Assessment.action.text). */
  text: string;
  kind?: Assessment['action']['kind'];
  dueInHours?: number;
  /** Sources behind the action / due time (e.g. the driving layer's sourceIds). */
  sourceIds?: readonly string[];
  /** Primary button: Measure / Open protocol / Send to Earth. */
  primary?: ActionCardPrimary;
  secondary?: ReactNode;
  /** Wording provenance tag (docs/PROJECT_RULES.md rule 3): 'source' or 'demo wording'. */
  wordingTag?: 'source' | 'demo wording';
  className?: string;
}

const KIND_LABEL: Record<Assessment['action']['kind'], string> = {
  none: 'No action needed',
  remeasure: 'Re-measure',
  'tell-cmo': 'Tell the CMO',
  'notify-surgeon': 'Notify flight surgeon',
  protocol: 'Follow protocol',
};

/** "Do this next" card, tinted by verdict (doc 11 §4). Leads every expanded signal (FR-SIG-4 step 1). */
export function ActionCard({
  verdict,
  text,
  kind = 'none',
  dueInHours,
  sourceIds = [],
  primary,
  secondary,
  wordingTag,
  className,
}: ActionCardProps) {
  const meta = VERDICT[verdict];
  const t = TONE[meta.tone];
  const Icon = meta.icon;
  return (
    <div
      role="group"
      aria-label="Do this next"
      className={cx('rounded-card border border-l-4 p-4', t.bg, t.border, t.accent, className)}
      data-verdict={verdict}
    >
      <div className="flex items-start gap-3">
        <Icon size={20} aria-hidden="true" className={cx('mt-0.5 shrink-0', t.icon)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-xs font-semibold tracking-wider text-text-2 uppercase">Do this next</h3>
            <span className={cx('text-xs font-medium', t.text)}>{KIND_LABEL[kind]}</span>
            {dueInHours !== undefined && (
              <span className="inline-flex items-center gap-1 text-xs text-text-2">
                within <Value value={dueInHours} unit="h" size="sm" sourceIds={sourceIds} title="Due time" />
              </span>
            )}
            {wordingTag && (
              <span className="rounded-[4px] border border-border-strong px-1 font-mono text-[10px] leading-4 text-text-2">
                {wordingTag}
              </span>
            )}
          </div>
          <p className="mt-1 text-base text-text">{text}</p>
          {(primary || secondary) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {primary &&
                (primary.to ? (
                  <LinkButton to={primary.to} variant="primary" icon={primary.icon}>
                    {primary.label}
                  </LinkButton>
                ) : (
                  <Button variant="primary" icon={primary.icon} onClick={primary.onClick}>
                    {primary.label}
                  </Button>
                ))}
              {secondary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
