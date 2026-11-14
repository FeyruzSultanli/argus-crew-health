// Hotspot anchors from the loaded reference body: organ bounding-box centres, scaled constants for the rest.
import { Box3, Vector3 } from 'three';
import type { Mesh } from 'three';

import type { BodyRegionId } from '../domain/types';
import { REGION_ANCHORS } from './anatomyMap';
import type { OrganNodeId, Vec3 } from './anatomyMap';

/** Organ whose centre marks the region (one organ, so paired organs do not average into the midline). */
const ANCHOR_NODE: Partial<Record<BodyRegionId, OrganNodeId>> = {
  brain: 'brain',
  eyes: 'eye_l',
  heart: 'heart',
  lungs: 'lung_r',
  vessels: 'aorta',
  pancreas_liver: 'liver',
  kidneys: 'kidney_l',
  skeleton: 'femur_l',
};

/** Height of the procedural / constant anchor table (REGION_ANCHORS). */
const REFERENCE_HEIGHT = 1.75;

export function anchorsFromMeshes(
  meshes: ReadonlyArray<{ id: OrganNodeId; mesh: Mesh }>,
): Record<BodyRegionId, Vec3> {
  const box = new Box3();
  const centre = new Vector3();
  const byId = new Map(meshes.map((m) => [m.id, m.mesh]));
  const skin = byId.get('skin');
  let scale = 1;
  if (skin) {
    skin.updateMatrixWorld(true);
    box.setFromObject(skin);
    const h = box.max.y - box.min.y;
    if (h > 0.5) scale = h / REFERENCE_HEIGHT;
  }
  const out = {} as Record<BodyRegionId, Vec3>;
  for (const [region, base] of Object.entries(REGION_ANCHORS) as Array<[BodyRegionId, Vec3]>) {
    const nodeId = ANCHOR_NODE[region];
    const mesh = nodeId ? byId.get(nodeId) : undefined;
    if (mesh) {
      mesh.updateMatrixWorld(true);
      box.setFromObject(mesh).getCenter(centre);
      out[region] = [centre.x, centre.y, centre.z];
    } else {
      out[region] = [base[0] * scale, base[1] * scale, base[2] * scale];
    }
  }
  return out;
}
