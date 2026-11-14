import type { ReactNode } from 'react';
import { CircleDashed, RefreshCw, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from './Button';
import { cx } from './tone';

export interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  icon?: LucideIcon;
  /** Usually a <Button> or <LinkButton>. */
  action?: ReactNode;
  className?: string;
}

/** Nothing to show yet (doc 11 §4). Calm, with one next step. */
export function EmptyState({ title, body, icon: Icon = CircleDashed, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong px-6 py-10 text-center',
        className,
      )}
    >
      <Icon size={28} aria-hidden="true" className="text-text-3" />
      <p className="text-base font-medium text-text">{title}</p>
      {body && <p className="max-w-md text-sm text-text-2">{body}</p>}
      {action}
    </div>
  );
}

export interface SkeletonProps {
  variant?: 'text' | 'block' | 'circle';
  /** Number of text lines (variant 'text'). */
  lines?: number;
  className?: string;
  /** Spoken while loading. */
  label?: string;
}

/** Loading placeholder; announces `label` once via role="status". Pulse is disabled with reduced motion. */
export function Skeleton({ variant = 'text', lines = 3, className, label = 'Loading' }: SkeletonProps) {
  const base = 'animate-pulse bg-surface-2';
  return (
    <div role="status" className={cx('flex flex-col gap-2', className)}>
      <span className="sr-only">{label}</span>
      {variant === 'text' &&
        Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cx(base, 'block h-3 rounded-pill', i === lines - 1 ? 'w-2/3' : 'w-full')}
          />
        ))}
      {variant === 'block' && (
        <span aria-hidden="true" className={cx(base, 'block h-32 w-full rounded-card')} />
      )}
      {variant === 'circle' && (
        <span aria-hidden="true" className={cx(base, 'block h-24 w-24 rounded-pill')} />
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  /** Technical detail, collapsed. */
  detail?: string;
  className?: string;
}

/** Something failed (doc 11 §4). Says what failed and offers a retry; never blames the user. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  detail,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col gap-3 rounded-card border border-l-4 border-act-border border-l-act bg-act-bg p-5',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <TriangleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-act" />
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium text-text">{title}</p>
          <p className="text-sm text-text-2">{message}</p>
        </div>
      </div>
      {detail && (
        <details className="text-xs text-text-2">
          <summary className="flex min-h-target cursor-pointer items-center">Technical detail</summary>
          <pre className="mt-1 overflow-auto font-mono whitespace-pre-wrap">{detail}</pre>
        </details>
      )}
      {onRetry && (
        <div>
          <Button icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
