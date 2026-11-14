// featureFlags.faceFluidScan: on → the face tile is live and /lab/face is the scan; off → the existing
// "Coming next" tile and card. Both states are checked through the pure helpers and the entry component.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { featureFlags } from '../../../config/featureFlags';
import { TILES, comingFlows, faceTile, isComingNext } from '../hub/tiles';
import { FaceScanRoute } from './FaceScanEntry';

describe('faceFluidScan feature flag', () => {
  it('is on in this build: tile live, not "coming next"', () => {
    expect(featureFlags.faceFluidScan).toBe(true);
    const t = TILES.find((x) => x.id === 'face');
    expect(t).toMatchObject({ live: true, experimental: true, signals: ['face_fluid_index'], kinds: ['camera'] });
    expect(t?.duration).toEqual({ value: 3, unit: 's', sourceIds: ['SRC_DEMO_QUALITY_SCORES'] });
    expect(isComingNext('face')).toBe(false);
    expect(isComingNext('vision')).toBe(false); // live
    expect(isComingNext('import')).toBe(true);
  });

  it('on/off states of the helpers', () => {
    expect(faceTile(true).live).toBe(true);
    expect(faceTile(false)).toMatchObject({ live: false, experimental: true, signals: [] });
    expect(comingFlows(true)).toEqual(['import']);
    expect(comingFlows(false)).toEqual(['import', 'face']);
  });

  it('flag off → the entry renders the existing "Coming next" card', () => {
    render(
      <MemoryRouter>
        <FaceScanRoute enabled={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Face fluid-shift scan — coming next' })).toBeInTheDocument();
    expect(screen.getByText('Experimental — not validated')).toBeInTheDocument();
  });
});
