// Left-rail counters (doc 11 §5.2, FR-SIG-6) and per-subject summaries. Pure TypeScript.
import type { Assessment, LayerId, Verdict } from '../../domain/types';
import { VERDICT, worstVerdict } from '../../ui/tone';
import { isFlag } from './regions';

export interface LayerCounters {
  earthFlags: number;
  spaceFlags: number;
  personalFlags: number;
  caughtOnlyByPersonal: number;
  /** Earth layer WATCH/ACT while the combined verdict is NOMINAL or EXPECTED. */
  earthFalseAlarms: number;
}

const EMPTY: LayerCounters = {
  earthFlags: 0,
  spaceFlags: 0,
  personalFlags: 0,
  caughtOnlyByPersonal: 0,
  earthFalseAlarms: 0,
};

/** Counts over a list of assessments. A layer "flag" = that layer's verdict is WATCH or ACT. */
export function layerCounters(assessments: readonly Assessment[]): LayerCounters {
  const c = { ...EMPTY };
  for (const a of assessments) {
    if (isFlag(a.layers.earth.verdict)) c.earthFlags += 1;
    if (isFlag(a.layers.space.verdict)) c.spaceFlags += 1;
    if (isFlag(a.layers.personal.verdict)) c.personalFlags += 1;
    if (a.caughtOnlyByPersonal) c.caughtOnlyByPersonal += 1;
    if (isFlag(a.layers.earth.verdict) && (a.verdict === 'NOMINAL' || a.verdict === 'EXPECTED'))
      c.earthFalseAlarms += 1;
  }
  return c;
}

export interface SubjectSummary {
  worst: Verdict;
  /** WATCH/ACT count per layer, for the crew list's mini layer counts. */
  flags: Record<LayerId, number>;
  /** Combined WATCH/ACT count. */
  attention: number;
}

export function subjectSummary(assessments: readonly Assessment[]): SubjectSummary {
  const c = layerCounters(assessments);
  return {
    worst: worstVerdict(assessments.map((a) => a.verdict)),
    flags: { personal: c.personalFlags, space: c.spaceFlags, earth: c.earthFlags },
    attention: assessments.filter((a) => isFlag(a.verdict)).length,
  };
}

/** Most severe first (ACT, WATCH, EXPECTED, NOMINAL, NO_DATA); stable for equal verdicts. */
export function bySeverity(a: Assessment, b: Assessment): number {
  return VERDICT[b.verdict].severity - VERDICT[a.verdict].severity;
}

/** Split for the right panel: "N need attention" (WATCH/ACT) and the rest ("Normal today"). */
export function splitByAttention(assessments: readonly Assessment[]): {
  attention: Assessment[];
  rest: Assessment[];
} {
  const sorted = [...assessments].sort(bySeverity);
  return {
    attention: sorted.filter((a) => isFlag(a.verdict)),
    rest: sorted.filter((a) => !isFlag(a.verdict)),
  };
}
