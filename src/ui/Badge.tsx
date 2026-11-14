import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { TONE, cx } from './tone';
import type { Tone } from './tone';

export type BadgeTone = Tone | 'neutral' | 'brand';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** 'soft' = tinted fill (default), 'outline' = border only (e.g. SIMULATED DATA). */
  variant?: 'soft' | 'outline';
  icon?: LucideIcon;
  /** Monospace uppercase label, for data-mode badges (LIVE, SNAPSHOT, SIMULATED DATA). */
  mono?: boolean;
  children: ReactNode;
}

const NEUTRAL = {
  text: 'text-text-2',
  bg: 'bg-surface-2',
  border: 'border-border-strong',
  icon: 'text-text-2',
};
const BRAND = { text: 'text-brand', bg: 'bg-brand-bg', border: 'border-brand', icon: 'text-brand' };

/** Non-interactive label pill. Always carries a word; colour is never the only signal. */
export function Badge({
  tone = 'neutral',
  variant = 'soft',
  icon: Icon,
  mono = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  const t = tone === 'neutral' ? NEUTRAL : tone === 'brand' ? BRAND : TONE[tone];
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1.5 rounded-pill border px-2.5 text-xs font-medium whitespace-nowrap',
        mono && 'font-mono tracking-wider uppercase',
        t.text,
        t.border,
        variant === 'soft' ? t.bg : 'bg-transparent',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={14} aria-hidden="true" className={t.icon} />}
      {children}
    </span>
  );
}
