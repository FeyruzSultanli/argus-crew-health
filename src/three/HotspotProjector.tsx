import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

import type { BodyRegionId } from '../domain/types';
import type { Vec3 } from './anatomyMap';
import type { HotspotRegistry } from './Hotspots3D';
import { projectMarkers } from './project';

/** Projects the hotspot anchors to screen space on every rendered frame and moves the overlay markers there. */
export function HotspotProjector({
  anchors,
  registry,
}: {
  anchors: Record<BodyRegionId, Vec3>;
  registry: HotspotRegistry;
}) {
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  // New anchors (reference body loaded) or a new marker set: render one frame so the markers move there.
  useEffect(() => invalidate(), [anchors, registry, invalidate]);
  useFrame(({ camera }) => projectMarkers(registry.current, anchors, camera, size.width, size.height));
  return null;
}
