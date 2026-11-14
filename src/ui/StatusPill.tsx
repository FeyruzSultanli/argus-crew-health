import type { Verdict } from '../domain/types';
import { TONE, VERDICT, cx } from './tone';

export interface StatusPillProps {
  verdict: Verdict;
  size?: 'sm' | 'md';
  /** Show the one-line meaning next to the word (doc 07 §2). */
  showMeaning?: boolean;
  className?: string;
}

/** Verdict → colour token, lucide icon and the exact word (Nominal / Expected in space / Watch / Act / No data). */
export function StatusPill({ verdict, size = 'md', showMeaning = false, className }: StatusPillProps) {
  const meta = VERDICT[verdict];
  const t = TONE[meta.tone];
  const Icon = meta.icon;
  return (
    <span
      data-verdict={verdict}
      title={meta.meaning}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-pill border font-medium whitespace-nowrap',
        size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
        t.bg,
        t.border,
        t.text,
        className,
      )}
    >
      <Icon size={size === 'sm' ? 13 : 15} aria-hidden="true" className={t.icon} strokeWidth={2.25} />
      <span>{meta.word}</span>
      {showMeaning && <span className="font-normal text-text-2">· {meta.meaning}</span>}
    </span>
  );
}
