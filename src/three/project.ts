// Screen projection of the hotspot anchors (imperative DOM writes, called from the render loop).
import { Vector3 } from 'three';
import type { Camera } from 'three';

import type { BodyRegionId } from '../domain/types';
import type { Vec3 } from './anatomyMap';

const v = new Vector3();

/** Move every marker element to its anchor's screen position; hide markers behind the camera or off screen. */
export function projectMarkers(
  markers: Map<BodyRegionId, HTMLDivElement>,
  anchors: Record<BodyRegionId, Vec3>,
  camera: Camera,
  width: number,
  height: number,
): void {
  for (const [id, el] of markers) {
    const a = anchors[id];
    v.set(a[0], a[1], a[2]).project(camera);
    const visible = v.z < 1 && Math.abs(v.x) <= 1.1 && Math.abs(v.y) <= 1.1;
    const x = ((v.x + 1) / 2) * width;
    const y = ((1 - v.y) / 2) * height;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    el.style.visibility = visible ? 'visible' : 'hidden';
  }
}
