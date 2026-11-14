// Worker-side state machine: collects frame means, emits a live estimate every second (from LIVE_FROM_SEC on;
// greyed until 10 s) and the final estimate at the end of the capture (30 s) — doc 09 §1.2 step 6.
// Pure and synchronous so it runs identically inside the Web Worker and in the in-thread fallback engine.
import { analyzeTrace } from './analyze';
import type { FrameSample, RppgIn, RppgOut } from './types';

/** Capture length, s (doc 09 §1.4). */
export const CAPTURE_SEC = 30;
/** First live estimate, s. Shown greyed ("stabilising") until STABLE_AFTER_SEC. */
export const LIVE_FROM_SEC = 5;

export class RppgAccumulator {
  private samples: FrameSample[] = [];
  private missed = 0;
  private tStart: number | null = null;
  private nextEmitSec = LIVE_FROM_SEC;
  private finished = false;
  private durationSec = CAPTURE_SEC;

  handle(msg: RppgIn): RppgOut[] {
    switch (msg.type) {
      case 'reset':
        this.samples = [];
        this.missed = 0;
        this.tStart = null;
        this.nextEmitSec = LIVE_FROM_SEC;
        this.finished = false;
        this.durationSec = msg.durationSec ?? CAPTURE_SEC;
        return [];
      case 'finalize':
        return this.finished ? [] : [this.finish()];
      case 'frame':
      case 'miss': {
        if (this.finished) return [];
        if (this.tStart === null) this.tStart = msg.t;
        if (msg.type === 'frame') {
          const { t, r, g, b, lum, clip, cx, cy } = msg;
          this.samples.push({ t, r, g, b, lum, clip, cx, cy });
        } else {
          this.missed++;
        }
        const elapsed = (msg.t - this.tStart) / 1000;
        if (elapsed >= this.durationSec) return [this.finish()];
        if (elapsed >= this.nextEmitSec) {
          this.nextEmitSec = Math.floor(elapsed) + 1;
          return [analyzeTrace({ samples: this.samples, missed: this.missed, elapsedSec: elapsed, final: false })];
        }
        return [];
      }
    }
  }

  private finish(): RppgOut {
    this.finished = true;
    const last = this.samples[this.samples.length - 1];
    const elapsed = this.tStart !== null && last ? (last.t - this.tStart) / 1000 : 0;
    return analyzeTrace({ samples: this.samples, missed: this.missed, elapsedSec: elapsed, final: true });
  }
}
