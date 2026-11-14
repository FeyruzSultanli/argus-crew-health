import { useEffect } from 'react';
import { CloudAlert, CloudCheck, CloudDownload } from 'lucide-react';

import { cx } from '../tone';
import { setOfflinePackageState, useOfflinePackage, type OfflinePackageState } from './offlinePackageStore';

const READY_VISIBLE_MS = 8000;

function label(s: OfflinePackageState): string {
  switch (s.phase) {
    case 'preparing':
      return s.total
        ? `Preparing offline package ${Math.min(100, Math.round((100 * s.done) / s.total))} %`
        : 'Preparing offline package';
    case 'ready':
      return 'Ready to work offline';
    case 'error':
      return 'Offline package not stored — stay online';
    default:
      return '';
  }
}

/** Header status next to the online dot. The live region always exists so screen readers announce the changes. */
export function OfflinePackage({ className }: { className?: string }) {
  const s = useOfflinePackage();
  useEffect(() => {
    if (s.phase !== 'ready') return;
    const t = setTimeout(() => setOfflinePackageState({ phase: 'idle' }), READY_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [s.phase]);
  const Icon = s.phase === 'ready' ? CloudCheck : s.phase === 'error' ? CloudAlert : CloudDownload;
  const text = label(s);
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="offline-package"
      data-phase={s.phase}
      title={
        s.phase === 'preparing' && s.total
          ? `${s.done} of ${s.total} files stored for offline use`
          : undefined
      }
      className={cx(
        'inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-text-2 uppercase',
        s.phase === 'idle' ? 'sr-only' : 'h-6',
        className,
      )}
    >
      {s.phase !== 'idle' && (
        <Icon
          size={13}
          aria-hidden="true"
          className={s.phase === 'ready' ? 'text-ok' : s.phase === 'error' ? 'text-watch' : 'text-text-2'}
        />
      )}
      {text}
    </span>
  );
}
