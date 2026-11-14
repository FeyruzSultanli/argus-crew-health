// Camera view maths for the 3D body (presets, region fly-to, zoom). Pure functions.
import type { Vector3 } from 'three';

import type { BodyRegionId } from '../domain/types';
import type { CameraRequest } from '../features/body/BodyViewport';
import type { CameraView, Vec3 } from './anatomyMap';
import { HOME_VIEW, REGION_DISTANCE, ZONE_VIEWS } from './anatomyMap';

/** Fly-to duration (doc 11 §6). */
export const FLY_MS = 450;
export const MIN_DISTANCE = 0.6;
export const MAX_DISTANCE = 5;

/** Target view of a camera request, given the current target and distance. */
export function viewFor(
  req: CameraRequest,
  anchors: Record<BodyRegionId, Vec3>,
  current: { target: Vector3; distance: number },
): CameraView {
  switch (req.kind) {
    case 'home':
      return HOME_VIEW;
    case 'zone':
      return ZONE_VIEWS[req.zone];
    case 'region':
      return { target: anchors[req.region], distance: REGION_DISTANCE };
    case 'zoom': {
      const d = current.distance * (req.dir > 0 ? 0.75 : 1 / 0.75);
      return {
        target: [current.target.x, current.target.y, current.target.z],
        distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, d)),
      };
    }
  }
}
