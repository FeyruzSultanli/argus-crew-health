// Async loaders of handbook content as React state: loading / ok / error, with retry (offline-friendly).
import { useCallback, useEffect, useState } from 'react';

import { loadHandbookEntry, loadHandbookIndex } from './content';
import type { HandbookEntry, HandbookIndexItem } from './content';
import { useSessionStore } from '../../state/session';
import { useUiStore } from '../../state/ui';

export type Loadable<T> =
  { status: 'loading' } | { status: 'ok'; data: T } | { status: 'error'; message: string };

function useLoad<T>(key: string | null, load: () => Promise<T>): Loadable<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string | null; attempt: number; value: Loadable<T> }>({
    key: null,
    attempt: -1,
    value: { status: 'loading' },
  });
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ key, attempt, value: { status: 'ok', data } }),
      (err: unknown) =>
        live &&
        setState({
          key,
          attempt,
          value: { status: 'error', message: err instanceof Error ? err.message : String(err) },
        }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is keyed by `key`
  }, [key, attempt]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const current: Loadable<T> =
    state.key === key && state.attempt === attempt ? state.value : { status: 'loading' };
  return { ...current, retry };
}

export function useHandbookIndex() {
  return useLoad<HandbookIndexItem[]>('index', loadHandbookIndex);
}

export function useHandbookEntry(id: string) {
  return useLoad<HandbookEntry>(id, () => loadHandbookEntry(id));
}

/** Crew member whose data the handbook shows: the selected one, else the signed-in crew member (null: surgeon). */
export function useSubjectCrewId(): string | null {
  const selected = useUiStore((s) => s.selectedCrewId);
  const own = useSessionStore((s) => s.crewId);
  return selected ?? own;
}
