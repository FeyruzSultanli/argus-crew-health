// PVT metrics (doc 09 §4): median RT, mean speed excluding false starts, performance score.
import { describe, expect, it } from 'vitest';

import type { PvtResponse } from './pvtEngine';
import { median, scorePvt } from './pvtScoring';

const stim = (rtMs: number, kind: PvtResponse['kind'], timedOut = false): PvtResponse => ({ kind, rtMs, stimulus: true, timedOut, at: 0 });
const noStim: PvtResponse = { kind: 'false-start', rtMs: null, stimulus: false, timedOut: false, at: 0 };

describe('median', () => {
  it('odd, even, empty', () => {
    expect(median([300, 200, 250])).toBe(250);
    expect(median([200, 300, 250, 400])).toBe(275);
    expect(median([])).toBeNull();
  });
});

describe('scorePvt', () => {
  it('median RT and mean speed use valid responses only (false starts excluded, lapses and timeouts included)', () => {
    const responses = [stim(250, 'valid'), stim(500, 'lapse'), stim(30_000, 'lapse', true), stim(80, 'false-start'), noStim, stim(200, 'valid')];
    const s = scorePvt(responses);
    expect(s.nStimuli).toBe(5); // the press with no stimulus is not a stimulus
    expect(s.nRtResponses).toBe(4);
    expect(s.medianRtMs).toBe((250 + 500) / 2); // of 200, 250, 500, 30 000
    // mean of 1000/RT: (4 + 2 + 0.0333… + 5) / 4
    expect(s.meanSpeed).toBeCloseTo((1000 / 250 + 1000 / 500 + 1000 / 30_000 + 1000 / 200) / 4, 10);
    expect(s.lapses).toBe(2);
    expect(s.falseStarts).toBe(2);
    expect(s.timeouts).toBe(1);
    // 1 − (lapses + false starts) / stimuli = 1 − 4/5
    expect(s.performanceScore).toBeCloseTo(0.2, 10);
  });

  it('a false start with an RT (< 100 ms) never enters speed or median', () => {
    const s = scorePvt([stim(50, 'false-start'), stim(300, 'valid')]);
    expect(s.medianRtMs).toBe(300);
    expect(s.meanSpeed).toBeCloseTo(1000 / 300, 10);
    expect(s.performanceScore).toBe(0.5);
  });

  it('perfect run → score 1; empty run → nulls; many presses without stimuli clamp the score at 0', () => {
    expect(scorePvt([stim(250, 'valid'), stim(260, 'valid')]).performanceScore).toBe(1);
    expect(scorePvt([])).toMatchObject({ nStimuli: 0, medianRtMs: null, meanSpeed: null, performanceScore: null });
    expect(scorePvt([stim(250, 'valid'), noStim, noStim, noStim]).performanceScore).toBe(0);
  });
});
