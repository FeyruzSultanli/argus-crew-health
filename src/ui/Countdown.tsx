import { useEffect, useRef, useState } from 'react';

import { cx } from './tone';
import { formatCountdown } from './units';

export interface CountdownProps {
  /** Epoch ms when the countdown reaches zero. */
  endsAt: number;
  /** Epoch ms when it started (for the progress bar). */
  startedAt?: number;
  /** What is counting down, e.g. "Packet delivery", "Capture". */
  label: string;
  onDone?: () => void;
  /** Extra line, e.g. "11 min (shown as 11 s)". */
  note?: string;
  size?: 'md' | 'lg';
  /** Clock source; injectable for tests. */
  now?: () => number;
}

/** Countdown for Earth-link delivery and rPPG capture (doc 11 §4). role="timer"; announces only when done. */
export function Countdown({
  endsAt,
  startedAt,
  label,
  onDone,
  note,
  size = 'md',
  now = Date.now,
}: CountdownProps) {
  const [t, setT] = useState(now);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    doneRef.current = false;
    const id = window.setInterval(() => {
      const n = now();
      setT(n);
      if (n >= endsAt && !doneRef.current) {
        doneRef.current = true;
        onDoneRef.current?.();
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [endsAt, now]);
  const remaining = endsAt - t;
  const done = remaining <= 0;
  const frac =
    startedAt !== undefined && endsAt > startedAt
      ? Math.min(1, Math.max(0, (t - startedAt) / (endsAt - startedAt)))
      : undefined;
  return (
    <div className="inline-flex min-w-40 flex-col gap-1.5">
      <span className="text-xs text-text-2">{label}</span>
      <span
        role="timer"
        aria-label={`${label}: ${done ? 'done' : `${formatCountdown(remaining)} remaining`}`}
        className={cx('font-mono leading-[1.1] text-text', size === 'lg' ? 'text-3xl' : 'text-xl')}
      >
        {formatCountdown(remaining)}
      </span>
      {frac !== undefined && (
        <span className="h-1 w-full overflow-hidden rounded-pill bg-surface-2" aria-hidden="true">
          <span
            className="block h-full rounded-pill bg-brand transition-[width] duration-200 ease-out"
            style={{ width: `${frac * 100}%` }}
          />
        </span>
      )}
      {note && <span className="font-mono text-xs text-text-3">{note}</span>}
      <span aria-live="polite" className="sr-only">
        {done ? `${label}: done` : ''}
      </span>
    </div>
  );
}
