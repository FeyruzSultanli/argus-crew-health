/// <reference lib="webworker" />
// rPPG worker — doc 09 §1.2. Receives per-frame ROI means (never pixels), returns estimates.
// Orchestration only; all signal processing lives in pure modules (analyze/pos/filters/spectrum/quality).
import { RppgAccumulator } from './accumulator';
import type { RppgIn } from './types';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const acc = new RppgAccumulator();

scope.onmessage = (e: MessageEvent<RppgIn>) => {
  for (const out of acc.handle(e.data)) scope.postMessage(out);
};
