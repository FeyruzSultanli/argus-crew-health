// Per-frame ROI statistics — doc 09 §1.2: mean R, G, B over ROI pixels, ROI luminance, % clipped pixels (≥ 250).
// Works on an RGBA pixel buffer that only ever lives in memory (getImageData of the 320×240 analysis canvas).
import type { Box } from './roi';

/** A pixel counts as clipped when any channel reaches this value. */
export const CLIP_LEVEL = 250;

export interface RoiStats {
  r: number;
  g: number;
  b: number;
  /** Rec. 601 luma of the mean colour, 0..255. */
  lum: number;
  /** % of ROI pixels with any channel ≥ CLIP_LEVEL. */
  clip: number;
  pixels: number;
}

/** Means over the union of `boxes` (boxes are assumed not to overlap) in an RGBA buffer of `width` px rows. */
export function roiStats(data: ArrayLike<number>, width: number, boxes: Box[]): RoiStats | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let clipped = 0;
  let n = 0;
  for (const box of boxes) {
    for (let y = box.y0; y < box.y1; y++) {
      let i = (y * width + box.x0) * 4;
      for (let x = box.x0; x < box.x1; x++, i += 4) {
        const pr = data[i] as number;
        const pg = data[i + 1] as number;
        const pb = data[i + 2] as number;
        r += pr;
        g += pg;
        b += pb;
        if (pr >= CLIP_LEVEL || pg >= CLIP_LEVEL || pb >= CLIP_LEVEL) clipped++;
        n++;
      }
    }
  }
  if (n === 0) return null;
  r /= n;
  g /= n;
  b /= n;
  return { r, g, b, lum: 0.299 * r + 0.587 * g + 0.114 * b, clip: (100 * clipped) / n, pixels: n };
}
