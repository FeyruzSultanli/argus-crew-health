import { createContext, useContext } from 'react';

import type { Tone } from './tone';

export interface ToastInput {
  title: string;
  body?: string;
  /** Status colour of the left border; neutral 'muted' by default. */
  tone?: Tone;
  /** Milliseconds; default 4000 (doc 11 §4). */
  durationMs?: number;
}

export interface ToastApi {
  show: (t: ToastInput) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Toasts (bottom-right, 4 s). Outside <ToastProvider> calls are ignored. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { show: () => {} };
}
