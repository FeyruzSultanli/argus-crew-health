// ?visionTest=1 — scripted vision check for the e2e acceptance (like ?pvtTest=1). Results are badged
// "TEST MODE — scripted input" and saved labeled SIMULATED, never MEASURED.
//   &amslerScript=peripheral → "Apply scripted marks" paints 2 peripheral cells (row 1, columns 1–2)
//   &amslerScript=central    → paints 1 central cell (row 11, column 11; touches the fixation dot)
//   &acuitySeed=<uint32>     → orientation seed (default 2026); "Answer scripted" passes every line down to
//                              logMAR 0.3 and gets 2 of 5 on the next line (score 0.26) or stops at the screen limit.
import { cellIndex } from '../../../measurement/vision';

export type AmslerScript = 'peripheral' | 'central';

export interface VisionTestMode {
  amslerScript: AmslerScript;
  seed: number;
}

export const DEFAULT_VISION_TEST_SEED = 2026;
/** Scripted acuity answers: lines down to this logMAR all correct, then 2 of 5. */
export const SCRIPTED_ACUITY_LAST_LINE = 0.3;

export const SCRIPTED_CELLS: Record<AmslerScript, readonly number[]> = {
  peripheral: [cellIndex(0, 0), cellIndex(0, 1)],
  central: [cellIndex(10, 10)],
};

export function visionTestModeFromSearch(search: string): VisionTestMode | null {
  const q = new URLSearchParams(search);
  if (q.get('visionTest') !== '1') return null;
  const raw = Number(q.get('acuitySeed'));
  return {
    amslerScript: q.get('amslerScript') === 'central' ? 'central' : 'peripheral',
    seed: Number.isInteger(raw) && raw > 0 ? raw >>> 0 : DEFAULT_VISION_TEST_SEED,
  };
}
