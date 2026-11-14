// Small React hooks over the stores and browser state that several screens need.
import { useEffect, useSyncExternalStore } from 'react';

import crewJson from '../../seed/crew.json';
import { ROLE_LABEL, useSessionStore } from './session';
import { useUiStore } from './ui';
import type { FocusedFlow } from './ui';

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** navigator.onLine, updated on online/offline events. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReduced(cb: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function systemReduced(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_QUERY).matches;
}

/** True when the OS asks for reduced motion OR the in-app setting is on. Use it to skip camera moves etc. */
export function useReducedMotionPreference(): boolean {
  const setting = useUiStore((s) => s.reducedMotion);
  const system = useSyncExternalStore(subscribeReduced, systemReduced, () => false);
  return setting || system;
}

/**
 * Turn on focused-flow mode (thin header with "Exit") while the calling component is mounted.
 * Usage in a Lab flow: `useFocusedFlow({ title: 'Camera pulse', exitTo: '/lab' })`. Pass null to do nothing.
 */
export function useFocusedFlow(flow: FocusedFlow | null): void {
  const setFocusedFlow = useUiStore((s) => s.setFocusedFlow);
  const title = flow?.title;
  const exitTo = flow?.exitTo;
  useEffect(() => {
    if (title === undefined || exitTo === undefined) return;
    setFocusedFlow({ title, exitTo });
    return () => setFocusedFlow(null);
  }, [title, exitTo, setFocusedFlow]);
}

/** Mirror theme / glove / reduced-motion preferences onto <html data-*> so tokens.css can switch live. */
export function useApplyPreferences(): void {
  const theme = useUiStore((s) => s.theme);
  const glove = useUiStore((s) => s.gloveMode);
  const reduced = useUiStore((s) => s.reducedMotion);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.glove = String(glove);
    root.dataset.reducedMotion = String(reduced);
  }, [theme, glove, reduced]);
}

/** "L. Duarte · CMO" or "Flight surgeon". */
export function useSessionIdentity(): { name: string; roleLabel: string; initials: string } {
  const role = useSessionStore((s) => s.role);
  const crewId = useSessionStore((s) => s.crewId);
  const crew = crewJson.crew.find((c) => c.id === crewId);
  const roleLabel = role ? ROLE_LABEL[role] : 'Signed out';
  const name = crew?.displayName ?? (role === 'surgeon' ? 'Earth' : '—');
  const initials = crew
    ? crew.displayName.replace(/[^A-Z]/g, '').slice(0, 2)
    : role === 'surgeon'
      ? 'FS'
      : '?';
  return { name, roleLabel, initials };
}
