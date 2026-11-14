// Hotspot model shared by the SVG fallback and the 3D scene. Pure TypeScript.
import type { Assessment, BodyRegionId, Verdict } from '../../domain/types';
import type { BodySystemFilter, LayerLens } from '../../state/ui';
import { VERDICT } from '../../ui/tone';
import { BODY_REGIONS, isFlag, regionSignalIds, regionVerdicts, regionsInFilter } from './regions';

export interface Hotspot {
  id: BodyRegionId;
  label: string;
  verdict: Verdict;
  flagged: boolean;
  /** Part of the active system filter. */
  inFilter: boolean;
  selected: boolean;
  /** Signals mapped to the region (catalog). */
  signalCount: number;
}

export function buildHotspots(
  assessments: readonly Assessment[],
  lens: LayerLens,
  filter: BodySystemFilter,
  selected: BodyRegionId | null,
): Hotspot[] {
  const verdicts = regionVerdicts(assessments, lens);
  const keep = regionsInFilter(filter);
  return BODY_REGIONS.map((r) => ({
    id: r.id,
    label: r.label,
    verdict: verdicts[r.id],
    flagged: isFlag(verdicts[r.id]),
    inFilter: keep.has(r.id),
    selected: selected === r.id,
    signalCount: regionSignalIds(r.id).length,
  }));
}

/** Spoken name of a hotspot: "Heart: Act". */
export function hotspotLabel(h: Hotspot): string {
  return `${h.label}: ${VERDICT[h.verdict].word}`;
}
