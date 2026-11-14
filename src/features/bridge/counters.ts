// FR-SIG-6 counters: flags by layer and "caught only by personal baseline" across the visible crew. Pure.
// Counting rule: a layer flag = that layer's verdict is WATCH or ACT; an "Earth false alarm" = the
// earth layer is WATCH/ACT while the combined verdict is NOMINAL or EXPECTED. Cabin assessments are not crew data
// and are skipped. (The Body page keeps its own copy in src/features/body, since feature folders do not import each other.)
import type { Assessment, LayerId, Verdict } from '../../domain/types';

export interface LayerCounts {
  personal: number;
  space: number;
  earth: number;
  /** Assessments whose combined verdict is WATCH or ACT. */
  flagged: number;
  caughtOnlyByPersonal: number;
  earthFalseAlarms: number;
}

export const EMPTY_COUNTS: LayerCounts = {
  personal: 0,
  space: 0,
  earth: 0,
  flagged: 0,
  caughtOnlyByPersonal: 0,
  earthFalseAlarms: 0,
};

export const isFlag = (v: Verdict): boolean => v === 'WATCH' || v === 'ACT';

const LAYERS: readonly LayerId[] = ['personal', 'space', 'earth'];

/** Counts over a list of assessments (any number of crew members). */
export function countLayerFlags(assessments: readonly Assessment[]): LayerCounts {
  const c = { ...EMPTY_COUNTS };
  for (const a of assessments) {
    if (a.crewId === 'cabin') continue;
    for (const l of LAYERS) if (isFlag(a.layers[l].verdict)) c[l]++;
    if (isFlag(a.verdict)) c.flagged++;
    if (a.caughtOnlyByPersonal) c.caughtOnlyByPersonal++;
    if (isFlag(a.layers.earth.verdict) && (a.verdict === 'NOMINAL' || a.verdict === 'EXPECTED'))
      c.earthFalseAlarms++;
  }
  return c;
}

/** Counts over several crew members' assessment lists (e.g. the useAllAssessments record minus 'cabin'). */
export function countAcrossCrew(
  byCrew: Record<string, readonly Assessment[]>,
  crewIds: readonly string[],
): LayerCounts {
  return countLayerFlags(crewIds.flatMap((id) => byCrew[id] ?? []));
}
