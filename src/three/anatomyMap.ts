// Region ↔ organ node map for the 3D body (doc 07 §6 "Mesh/organ" column, doc 12 §3 stable node ids).
// Coordinates are metres for a reference body with the feet at y = 0, facing +z (doc 12 §3 normalisation).
import { assetUrl } from '../config/paths';
import type { BodyRegionId, CrewMember } from '../domain/types';
import type { BodyZone } from '../features/body/regions';

/** Stable node ids written by scripts/build-anatomy.ts (doc 12 §3). */
export const ORGAN_NODE_IDS = [
  'skin',
  'brain',
  'eye_l',
  'eye_r',
  'heart',
  'lung_l',
  'lung_r',
  'aorta',
  'liver',
  'pancreas',
  'kidney_l',
  'kidney_r',
  'bladder',
  'spine',
  'pelvis',
  'femur_l',
  'femur_r',
] as const;
export type OrganNodeId = (typeof ORGAN_NODE_IDS)[number];

/** Organ meshes per region; [] = hotspot without a mesh (face, muscles) or the skin rim (whole body). */
export const REGION_NODES: Record<BodyRegionId, readonly OrganNodeId[]> = {
  brain: ['brain'],
  eyes: ['eye_l', 'eye_r'],
  face: [],
  heart: ['heart'],
  lungs: ['lung_l', 'lung_r'],
  vessels: ['aorta'],
  pancreas_liver: ['pancreas', 'liver'],
  kidneys: ['kidney_l', 'kidney_r', 'bladder'],
  skeleton: ['spine', 'pelvis', 'femur_l', 'femur_r'],
  muscles: [],
  skin: ['skin'],
  whole_body: [],
};

export const NODE_REGION: Record<OrganNodeId, BodyRegionId> = Object.fromEntries(
  (Object.entries(REGION_NODES) as Array<[BodyRegionId, readonly OrganNodeId[]]>).flatMap(([r, nodes]) =>
    nodes.map((n) => [n, r]),
  ),
) as Record<OrganNodeId, BodyRegionId>;

export type Vec3 = readonly [number, number, number];

/**
 * Hotspot anchors for a 1.75 m reference body (used by the procedural body and for regions without a mesh).
 * The GLB body replaces anchors of regions with meshes by the centre of their nodes' bounding boxes.
 */
export const REGION_ANCHORS: Record<BodyRegionId, Vec3> = {
  brain: [0, 1.66, -0.01],
  eyes: [0.032, 1.6, 0.08],
  face: [-0.05, 1.55, 0.085],
  heart: [0.025, 1.31, 0.05],
  lungs: [-0.08, 1.35, 0.02],
  vessels: [0.0, 1.12, -0.02],
  pancreas_liver: [-0.07, 1.16, 0.05],
  kidneys: [0.07, 1.06, -0.05],
  skeleton: [0.1, 0.68, 0.0],
  muscles: [-0.1, 0.4, 0.03],
  skin: [-0.27, 0.95, 0.02],
  whole_body: [0.0, 1.82, 0.0],
};

export interface CameraView {
  target: Vec3;
  distance: number;
}

/** Region presets (doc 11 §6) and the default view. */
export const HOME_VIEW: CameraView = { target: [0, 0.9, 0], distance: 3.9 };
export const ZONE_VIEWS: Record<BodyZone, CameraView> = {
  head: { target: [0, 1.6, 0], distance: 0.95 },
  chest: { target: [0, 1.3, 0], distance: 1.25 },
  abdomen: { target: [0, 1.08, 0], distance: 1.25 },
  legs: { target: [0, 0.55, 0], distance: 2.0 },
};
export const REGION_DISTANCE = 1.4;

/** Built by scripts/build-anatomy.ts (doc 12 §3). Meshopt-compressed; the decoder ships in the JS bundle. */
// Base-path aware: '/anatomy/x.glb' at the domain root would miss the GitHub Pages prefix.
export const anatomyUrl = (sex: CrewMember['sex']): string => assetUrl(`anatomy/${sex}.glb`);
