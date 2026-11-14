import type { HTMLAttributes, ReactNode } from 'react';

import { TONE, cx } from './tone';
import type { Tone } from './tone';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Card heading (rendered as h2 unless headingLevel says otherwise). */
  title?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  /** Small line under the title (mono caption). */
  subtitle?: ReactNode;
  /** Right side of the header: badges, buttons. */
  actions?: ReactNode;
  /** Status tint (left accent + tinted border). Neutral when omitted. */
  tone?: Tone;
  /** Remove the 20 px padding (for full-bleed charts or lists). */
  flush?: boolean;
  as?: 'section' | 'article' | 'div';
  children?: ReactNode;
}

/** Surface container: 12 px radius, 20 px padding, hairline border (doc 11 §2). */
export function Card({
  title,
  headingLevel = 2,
  subtitle,
  actions,
  tone,
  flush = false,
  as: Tag = 'section',
  className,
  children,
  ...rest
}: CardProps) {
  const H = `h${headingLevel}` as const;
  return (
    <Tag
      className={cx(
        'rounded-card border bg-surface-1',
        tone ? cx(TONE[tone].border, 'border-l-4', TONE[tone].accent) : 'border-border',
        flush ? '' : 'p-5',
        className,
      )}
      {...rest}
    >
      {(title || actions) && (
        <header
          className={cx(
            'flex flex-wrap items-start justify-between gap-3',
            flush ? 'px-5 pt-5' : '',
            children ? 'mb-4' : '',
          )}
        >
          <div className="min-w-0">
            {title && <H className="text-base font-semibold text-text">{title}</H>}
            {subtitle && <p className="mt-0.5 font-mono text-xs text-text-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}
