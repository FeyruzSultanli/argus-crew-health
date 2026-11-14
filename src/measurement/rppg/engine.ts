// Engine facade over the rPPG worker. Falls back to running the same accumulator on the main thread when
// Web Workers are unavailable (jsdom tests, very old browsers).
import { RppgAccumulator } from './accumulator';
import type { RppgIn, RppgOut } from './types';

export interface RppgEngine {
  post(msg: RppgIn): void;
  onEstimate(cb: (e: RppgOut) => void): void;
  dispose(): void;
  readonly kind: 'worker' | 'inline';
}

export function createInlineEngine(): RppgEngine {
  const acc = new RppgAccumulator();
  let listener: ((e: RppgOut) => void) | null = null;
  let disposed = false;
  return {
    kind: 'inline',
    post(msg) {
      if (disposed) return;
      for (const out of acc.handle(msg)) listener?.(out);
    },
    onEstimate(cb) {
      listener = cb;
    },
    dispose() {
      disposed = true;
      listener = null;
    },
  };
}

export function createWorkerEngine(): RppgEngine {
  const worker = new Worker(new URL('./rppg.worker.ts', import.meta.url), { type: 'module', name: 'rppg' });
  let listener: ((e: RppgOut) => void) | null = null;
  worker.onmessage = (e: MessageEvent<RppgOut>) => listener?.(e.data);
  return {
    kind: 'worker',
    post(msg) {
      worker.postMessage(msg);
    },
    onEstimate(cb) {
      listener = cb;
    },
    dispose() {
      listener = null;
      worker.terminate();
    },
  };
}

export function createRppgEngine(): RppgEngine {
  if (typeof Worker === 'undefined') return createInlineEngine();
  try {
    return createWorkerEngine();
  } catch {
    return createInlineEngine();
  }
}
