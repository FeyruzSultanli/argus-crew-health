import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import { cx } from './tone';

export interface TooltipProps {
  content: ReactNode;
  /** Render the trigger; put `describedBy` on it as aria-describedby. */
  children: (describedBy: string) => ReactNode;
  side?: 'top' | 'bottom';
  align?: 'center' | 'start' | 'end';
  /** Keep open regardless of hover/focus (e.g. after a tap). */
  forceOpen?: boolean;
  className?: string;
}

/**
 * Hover/focus tooltip. The content stays in the DOM (hidden) so it is always the trigger's accessible
 * description; Escape closes it.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  forceOpen = false,
  className,
}: TooltipProps) {
  const id = useId();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const open = forceOpen || hover || focus;
  return (
    <span
      className={cx('relative inline-flex', className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setHover(false);
          setFocus(false);
        }
      }}
    >
      {children(id)}
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={cx(
          'pointer-events-none absolute z-50 w-max max-w-72 rounded-control border border-border-strong bg-surface-2 px-3 py-2',
          'text-left text-xs leading-snug font-normal text-text shadow-overlay',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          align === 'start' && 'left-0',
          align === 'end' && 'right-0',
        )}
      >
        {content}
      </span>
    </span>
  );
}
