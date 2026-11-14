// Organ card content (FR-BODY-4). The one-sentence function is general anatomy, written plainly and tagged
// "demo wording" in the UI. "What space does to it" is never written here: it comes from the linked signals' own
// whyInSpace texts (signal catalog, each with its sources).
import { signalList } from '../../domain/signals';
import type { BodyRegionId, SignalDef } from '../../domain/types';
import { regionSignalIds } from './regions';

export const ORGAN_FUNCTION: Record<BodyRegionId, string> = {
  brain: 'Controls thinking, sleep, mood and how fast you react.',
  eyes: 'Turn light into the signals the brain uses to see.',
  face: 'The soft tissue over the skull, where shifts of body fluid show first.',
  heart: 'Pumps blood around the body.',
  lungs: 'Take in oxygen and remove carbon dioxide.',
  vessels: 'Carry blood and its cells between the heart and the rest of the body.',
  pancreas_liver:
    'The liver stores and releases energy; the pancreas makes the insulin that controls blood sugar.',
  kidneys: 'Filter the blood and make urine; the bladder stores it.',
  skeleton: 'Holds the body up and stores calcium.',
  muscles: 'Move the body and hold it steady.',
  skin: 'Covers and protects the body and helps control its temperature.',
  whole_body: 'All tissues together, as one target for space radiation.',
};

export interface SpaceFact {
  text: string;
  sourceIds: readonly string[];
  /** The signal the text belongs to. */
  signal: SignalDef['id'];
}

/** Up to `max` distinct whyInSpace texts of the region's signals, in catalog order. */
export function spaceFacts(region: BodyRegionId, max = 2): SpaceFact[] {
  const ids = regionSignalIds(region);
  const seen = new Set<string>();
  const out: SpaceFact[] = [];
  for (const def of signalList) {
    if (!ids.includes(def.id) || seen.has(def.whyInSpace)) continue;
    seen.add(def.whyInSpace);
    out.push({ text: def.whyInSpace, sourceIds: def.sourceIds, signal: def.id });
    if (out.length >= max) break;
  }
  return out;
}
