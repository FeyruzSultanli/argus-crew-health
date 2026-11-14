// Body regions (doc 07 §6) and the lens colouring used by both the 3D scene and the SVG fallback.
// Region ↔ signal mapping is read from SignalDef.bodyRegions (the signal catalog), never from a second table.
// Pure TypeScript: no React, no DOM.
import { signalList } from '../../domain/signals';
import type { Assessment, BodyRegionId, SignalDef, SignalId, Verdict } from '../../domain/types';
import type { BodySystemFilter, LayerLens } from '../../state/ui';
import { VERDICT, worstVerdict } from '../../ui/tone';

export interface RegionMeta {
  id: BodyRegionId;
  label: string;
  /** Quick-jump zone of the centre toolbar (doc 11 §5.2); undefined = whole body. */
  zone?: BodyZone;
}

export type BodyZone = 'head' | 'chest' | 'abdomen' | 'legs';

/** Region order = doc 07 §6 table order. Labels are UI names, not clinical wording. */
export const BODY_REGIONS: readonly RegionMeta[] = [
  { id: 'brain', label: 'Brain', zone: 'head' },
  { id: 'eyes', label: 'Eyes', zone: 'head' },
  { id: 'face', label: 'Face', zone: 'head' },
  { id: 'heart', label: 'Heart', zone: 'chest' },
  { id: 'lungs', label: 'Lungs', zone: 'chest' },
  { id: 'vessels', label: 'Blood and vessels', zone: 'chest' },
  { id: 'pancreas_liver', label: 'Pancreas and liver', zone: 'abdomen' },
  { id: 'kidneys', label: 'Kidneys and bladder', zone: 'abdomen' },
  { id: 'skeleton', label: 'Skeleton', zone: 'legs' },
  { id: 'muscles', label: 'Muscles', zone: 'legs' },
  { id: 'skin', label: 'Skin' },
  { id: 'whole_body', label: 'Whole body' },
];

export const REGION_LABEL = Object.fromEntries(BODY_REGIONS.map((r) => [r.id, r.label])) as Record<
  BodyRegionId,
  string
>;

export const BODY_ZONES: ReadonlyArray<{ id: BodyZone; label: string }> = [
  { id: 'head', label: 'Head' },
  { id: 'chest', label: 'Chest' },
  { id: 'abdomen', label: 'Abdomen' },
  { id: 'legs', label: 'Legs' },
];

/** Signal ids mapped to a region, in catalog evaluation order (from SignalDef.bodyRegions). */
export function regionSignalIds(region: BodyRegionId, defs: readonly SignalDef[] = signalList): SignalId[] {
  return defs.filter((d) => d.bodyRegions.includes(region)).map((d) => d.id);
}

/** First region of a signal (where the camera flies), or undefined for cabin signals. */
export function primaryRegion(
  signalId: SignalId,
  defs: readonly SignalDef[] = signalList,
): BodyRegionId | undefined {
  return defs.find((d) => d.id === signalId)?.bodyRegions[0];
}

/** The verdict a lens shows for one assessment: the combined verdict, or that one layer's verdict. */
export function lensVerdict(a: Assessment, lens: LayerLens): Verdict {
  return lens === 'combined' ? a.verdict : a.layers[lens].verdict;
}

/**
 * Colour of every region under a lens: the worst verdict among the region's signals, using the lens's layer
 * verdict (doc 11 §6 "lens = Earth → colours reflect only the Earth layer"). NO_DATA / not-applicable layers rank
 * below NOMINAL, so they never raise a region; a region with no reading at all is NO_DATA (neutral).
 */
export function regionVerdicts(
  assessments: readonly Assessment[],
  lens: LayerLens,
  defs: readonly SignalDef[] = signalList,
): Record<BodyRegionId, Verdict> {
  const regionsOf = new Map(defs.map((d) => [d.id, d.bodyRegions]));
  const byRegion = new Map<BodyRegionId, Verdict[]>();
  for (const a of assessments) {
    for (const r of regionsOf.get(a.signalId) ?? []) {
      const list = byRegion.get(r) ?? [];
      list.push(lensVerdict(a, lens));
      byRegion.set(r, list);
    }
  }
  const out = {} as Record<BodyRegionId, Verdict>;
  for (const r of BODY_REGIONS) out[r.id] = worstVerdict(byRegion.get(r.id) ?? []);
  return out;
}

const sev = (v: Verdict): number => VERDICT[v].severity;

/**
 * The signal a click on a region opens: highest lens severity, then highest combined severity, then catalog order.
 * Undefined when no assessment maps to the region.
 */
export function worstSignalInRegion(
  assessments: readonly Assessment[],
  region: BodyRegionId,
  lens: LayerLens,
  defs: readonly SignalDef[] = signalList,
): SignalId | undefined {
  const order = regionSignalIds(region, defs);
  const candidates = assessments.filter((a) => order.includes(a.signalId));
  candidates.sort(
    (a, b) =>
      sev(lensVerdict(b, lens)) - sev(lensVerdict(a, lens)) ||
      sev(b.verdict) - sev(a.verdict) ||
      order.indexOf(a.signalId) - order.indexOf(b.signalId),
  );
  return candidates[0]?.signalId;
}

export interface SystemFilterMeta {
  value: BodySystemFilter;
  label: string;
  /** Signal systems the chip covers; empty = all. */
  systems: readonly SignalDef['system'][];
}

/**
 * System filter chips of FR-BODY-3. The store holds one system id per chip; "Brain, eyes & nerves" also covers the
 * behavioural signals (sleep, mood, reaction test), which all map to the brain region.
 */
export const SYSTEM_FILTERS: readonly SystemFilterMeta[] = [
  { value: 'all', label: 'All', systems: [] },
  { value: 'cardio', label: 'Heart & blood', systems: ['cardio'] },
  { value: 'neuro-eye', label: 'Brain, eyes & nerves', systems: ['neuro-eye', 'behavioral'] },
  { value: 'musculoskeletal', label: 'Bones & muscles', systems: ['musculoskeletal'] },
  { value: 'metabolic', label: 'Organs & metabolism', systems: ['metabolic'] },
];

/** Regions that stay highlighted under a system filter (a region matches if any of its signals is in the system). */
export function regionsInFilter(
  filter: BodySystemFilter,
  defs: readonly SignalDef[] = signalList,
): Set<BodyRegionId> {
  const meta = SYSTEM_FILTERS.find((f) => f.value === filter);
  const systems = meta?.systems ?? [filter];
  if (filter === 'all' || systems.length === 0) return new Set(BODY_REGIONS.map((r) => r.id));
  const out = new Set<BodyRegionId>();
  for (const d of defs) if (systems.includes(d.system)) for (const r of d.bodyRegions) out.add(r);
  return out;
}

/** True when the verdict is a flag (WATCH or ACT). */
export function isFlag(v: Verdict): boolean {
  return v === 'WATCH' || v === 'ACT';
}

/** Layer lens options (doc 11 §5.2). */
export const LENS_OPTIONS: ReadonlyArray<{ value: LayerLens; label: string }> = [
  { value: 'combined', label: 'Combined' },
  { value: 'personal', label: 'Personal' },
  { value: 'space', label: 'Space' },
  { value: 'earth', label: 'Earth' },
];
