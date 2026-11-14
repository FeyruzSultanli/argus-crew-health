// Mounted once by the shell providers: seeds / syncs the data layer before the routes render (Skeleton meanwhile)
// and feeds the scrubber's flag density into the UI store.
import { useEffect, useState, type ReactNode } from 'react';

import { useUiStore } from '../state/ui';
import { ErrorState, Skeleton } from '../ui/States';
import { bootData } from './boot';
import { useFlagDensity } from './hooks';

function FlagDensityBridge() {
  const density = useFlagDensity();
  const setFlagDensity = useUiStore((s) => s.setFlagDensity);
  useEffect(() => {
    if (density) setFlagDensity(density);
  }, [density, setFlagDensity]);
  return null;
}

export function DataBoot({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | { error: string }>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    bootData()
      .then((r) => {
        if (!alive) return;
        performance.mark('argus:data-ready', { detail: r });
        setState('ready');
      })
      .catch((err: unknown) => {
        if (alive) setState({ error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (state === 'loading') {
    return (
      <div className="mx-auto max-w-5xl p-6" data-testid="data-boot-loading">
        <Skeleton variant="block" label="Loading mission data" className="h-64" />
      </div>
    );
  }
  if (typeof state === 'object') {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorState
          title="Mission data could not be loaded"
          message="The offline database did not open. Reload the page or reset the demo in Settings."
          detail={state.error}
          onRetry={() => {
            setState('loading');
            setAttempt((a) => a + 1);
          }}
        />
      </div>
    );
  }
  return (
    <>
      <FlagDensityBridge />
      {children}
    </>
  );
}
