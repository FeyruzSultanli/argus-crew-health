// Label layout of the 2D fallback body. Pure TypeScript.
import type { BodyRegionId } from '../../domain/types';

/** Anchor on the 2D silhouette and the label column (L = viewer's left). */
export const ANCHORS: Record<BodyRegionId, { x: number; y: number; side: 'L' | 'R' }> = {
  brain: { x: 240, y: 36, side: 'L' },
  eyes: { x: 249, y: 56, side: 'R' },
  face: { x: 228, y: 66, side: 'L' },
  whole_body: { x: 282, y: 100, side: 'R' },
  lungs: { x: 220, y: 124, side: 'L' },
  heart: { x: 247, y: 138, side: 'R' },
  vessels: { x: 300, y: 152, side: 'R' },
  pancreas_liver: { x: 224, y: 172, side: 'L' },
  kidneys: { x: 257, y: 192, side: 'R' },
  skin: { x: 172, y: 226, side: 'L' },
  skeleton: { x: 258, y: 300, side: 'R' },
  muscles: { x: 222, y: 372, side: 'L' },
};

export const VIEW_W = 480;
export const VIEW_H = 460;
export const LABEL_W = 134;
export const LABEL_H = 56;
const LABEL_GAP = 6;

/** Label y per region: as close to the anchor as possible, without overlaps, inside the view box. */
export function layoutLabels(ids: readonly BodyRegionId[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const side of ['L', 'R'] as const) {
    const items = ids.filter((id) => ANCHORS[id].side === side).sort((a, b) => ANCHORS[a].y - ANCHORS[b].y);
    let prev = -Infinity;
    const ys = items.map((id) => {
      const y = Math.max(ANCHORS[id].y - LABEL_H / 2, prev + LABEL_H + LABEL_GAP, 4);
      prev = y;
      return y;
    });
    const overflow = (ys[ys.length - 1] ?? 0) + LABEL_H - (VIEW_H - 4);
    items.forEach((id, i) => (out[id] = (ys[i] ?? 0) - Math.max(0, overflow)));
  }
  return out;
}
