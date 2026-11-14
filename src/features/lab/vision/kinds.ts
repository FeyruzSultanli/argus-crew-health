// Brush colours and letters of the Amsler grid (on white, whatever the theme) and the "new area" outline colour.
import type { AmslerKind } from '../../../measurement/vision';

export const KIND_STYLE: Record<AmslerKind, { fill: string; letter: string; label: string }> = {
  wavy: { fill: '#F2B33D', letter: 'W', label: 'Wavy' },
  blurred: { fill: '#7FB2E5', letter: 'B', label: 'Blurred' },
  missing: { fill: '#5A5A5A', letter: 'M', label: 'Missing' },
};
export const NEW_OUTLINE = '#C8102E';
