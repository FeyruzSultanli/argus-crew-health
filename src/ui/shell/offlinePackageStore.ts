import { useSyncExternalStore } from 'react';

/**
 * First-run "Preparing offline package" line (doc 05 §8). The service worker precaches ~24 MB (MediaPipe
 * runtime + face model, anatomy GLBs, handbook, fonts, every route chunk) on the first visit; until that finishes a
 * reload without network would fail. This shows calm, non-blocking progress in the header and then "Ready to work
 * offline" for a few seconds. Nothing in dev (no service worker) and nothing on later visits (already controlled).
 *
 * Registration lives here, not in an injected script, so the autoUpdate reload of `virtual:pwa-register` applies:
 * when a new deploy's worker activates, open tabs reload instead of asking for chunk hashes that no longer exist.
 */
export type OfflinePackageState =
  | { phase: 'idle' }
  | { phase: 'preparing'; done: number; total: number | null }
  | { phase: 'ready' }
  | { phase: 'error' };

let state: OfflinePackageState = { phase: 'idle' };
const listeners = new Set<() => void>();
export const setOfflinePackageState = (next: OfflinePackageState) => {
  state = next;
  for (const l of listeners) l();
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const POLL_MS = 400;

/** Number of precache entries in the generated sw.js (`{url:"…",revision:…}` objects); null if it cannot be read. */
async function precacheTotal(swUrl: string): Promise<number | null> {
  try {
    const text = await (await fetch(swUrl, { cache: 'no-store' })).text();
    const n = text.match(/\{url:"/g)?.length ?? 0;
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Entries already written to Workbox's precache (it fills the cache in place while installing). */
async function precacheDone(): Promise<number> {
  const names = (await caches.keys()).filter((n) => n.startsWith('workbox-precache'));
  let n = 0;
  for (const name of names) n += (await (await caches.open(name)).keys()).length;
  return n;
}

function track(swUrl: string, worker: ServiceWorker): void {
  setOfflinePackageState({ phase: 'preparing', done: 0, total: null });
  let total: number | null = null;
  void precacheTotal(swUrl).then((t) => {
    total = t;
  });
  const timer = setInterval(() => {
    if (state.phase !== 'preparing') {
      clearInterval(timer);
      return;
    }
    void precacheDone()
      .then((done) => {
        if (state.phase === 'preparing') setOfflinePackageState({ phase: 'preparing', done, total });
      })
      .catch(() => undefined);
  }, POLL_MS);
  worker.addEventListener('statechange', () => {
    if (worker.state === 'redundant' && state.phase === 'preparing') setOfflinePackageState({ phase: 'error' });
  });
}

let started = false;

/** Register the service worker (production builds only). Called once from src/main.tsx. */
export function startOfflinePackage(): void {
  if (started || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  started = true;
  // Not controlled at boot = first visit (or a hard reload that bypassed the worker): the precache may be pending.
  const firstRun = !navigator.serviceWorker.controller;
  void import('virtual:pwa-register').then(({ registerSW }) =>
    registerSW({
      immediate: true,
      onRegisteredSW(swUrl, reg) {
        const pending = reg?.installing ?? reg?.waiting;
        if (firstRun && pending && !reg?.active) track(swUrl, pending);
      },
      onOfflineReady() {
        setOfflinePackageState({ phase: 'ready' });
      },
      onRegisterError() {
        if (state.phase === 'preparing') setOfflinePackageState({ phase: 'error' });
      },
    }),
  );
}

export function useOfflinePackage(): OfflinePackageState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

