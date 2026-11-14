// Layer names and order shared by LayerTriad, SignalCard and the layer lens (doc 11 §1.3 "show the layers").
import type { LayerId } from '../domain/types';

export const LAYER_ORDER: readonly LayerId[] = ['personal', 'space', 'earth'];

export const LAYER_NAME: Record<LayerId, { short: string; name: string; long: string }> = {
  personal: { short: 'P', name: 'Personal', long: 'Personal baseline' },
  space: { short: 'S', name: 'Space', long: 'Space-adapted rules' },
  earth: { short: 'E', name: 'Earth', long: 'Earth clinical reference' },
};
