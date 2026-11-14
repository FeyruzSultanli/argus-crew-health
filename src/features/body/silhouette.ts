// Front silhouette for the 2D fallback (FR-BODY-6). Our own drawing in a 480 × 460 view box (body centred at x = 240,
// head top y ≈ 20, feet y ≈ 440). Organ outlines are schematic, not anatomical.
import type { BodyRegionId } from '../../domain/types';

const RIGHT_ARM = 'M286 100 L300 110 L314 190 L322 252 L314 262 L304 254 L298 196 L284 128 Z';
const RIGHT_LEG = 'M242 250 L279 238 L277 330 L271 420 L276 438 L252 440 L252 420 L247 330 Z';
const mirror = (d: string) =>
  d.replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${480 - Number(x)} ${y}`);

export const SILHOUETTE_PATHS: readonly string[] = [
  // torso
  'M206 92 Q240 84 274 92 L288 104 L284 160 Q276 190 274 200 L281 236 L279 256 L201 256 L199 236 L206 200 Q204 190 196 160 L192 104 Z',
  RIGHT_ARM,
  mirror(RIGHT_ARM),
  RIGHT_LEG,
  mirror(RIGHT_LEG),
  // neck
  'M231 70 L249 70 L251 92 L229 92 Z',
];

export interface OrganShape {
  region: BodyRegionId;
  kind: 'ellipse' | 'path';
  /** ellipse: cx cy rx ry; path: d */
  d: string;
}

/** Schematic organs drawn inside the silhouette and tinted by their region's verdict. */
export const ORGAN_SHAPES: readonly OrganShape[] = [
  { region: 'brain', kind: 'ellipse', d: '240 40 17 13' },
  { region: 'eyes', kind: 'ellipse', d: '231 56 4 3' },
  { region: 'eyes', kind: 'ellipse', d: '249 56 4 3' },
  { region: 'lungs', kind: 'ellipse', d: '223 130 15 26' },
  { region: 'lungs', kind: 'ellipse', d: '257 130 15 26' },
  { region: 'heart', kind: 'ellipse', d: '246 138 10 12' },
  { region: 'vessels', kind: 'path', d: 'M240 120 L240 230 M240 230 L224 250 M240 230 L256 250' },
  { region: 'pancreas_liver', kind: 'ellipse', d: '226 172 20 11' },
  { region: 'pancreas_liver', kind: 'ellipse', d: '250 180 13 4' },
  { region: 'kidneys', kind: 'ellipse', d: '224 190 6 10' },
  { region: 'kidneys', kind: 'ellipse', d: '256 190 6 10' },
  { region: 'kidneys', kind: 'ellipse', d: '240 240 8 6' },
  {
    region: 'skeleton',
    kind: 'path',
    d: 'M240 96 L240 226 M222 230 Q240 214 258 230 M228 248 L222 334 M252 248 L258 334',
  },
];

export const SILHOUETTE_HEAD = { cx: 240, cy: 46, rx: 23, ry: 28 };
