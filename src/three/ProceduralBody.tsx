import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import {
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Euler,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { MeshStandardMaterial, ShaderMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { OrganNodeId } from './anatomyMap';

type Part = {
  geo: BufferGeometry;
  pos: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
};

function place({ geo, pos, rot = [0, 0, 0], scale = [1, 1, 1] }: Part): BufferGeometry {
  const m = new Matrix4().compose(
    new Vector3(...pos),
    new Quaternion().setFromEuler(new Euler(...rot)),
    new Vector3(...scale),
  );
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.applyMatrix4(m);
  g.deleteAttribute('uv');
  return g;
}

const cap = (r: number, len: number) => new CapsuleGeometry(r, len, 6, 16);
const sph = (r: number) => new SphereGeometry(r, 24, 16);
const cyl = (r: number, len: number) => new CylinderGeometry(r, r, len, 12);

function mirrored(p: Part): Part[] {
  const [x, y, z] = p.pos;
  const rot = p.rot ?? [0, 0, 0];
  return [p, { ...p, geo: p.geo.clone(), pos: [-x, y, z], rot: [rot[0], rot[1], -rot[2]] }];
}

/** Stand-in shell for a 1.75 m body (used until/unless the HRA reference body is available). */
function skinGeometry(): BufferGeometry {
  const parts: Part[] = [
    { geo: sph(0.105), pos: [0, 1.635, 0], scale: [0.86, 1.05, 0.98] },
    { geo: cap(0.05, 0.08), pos: [0, 1.5, -0.01] },
    { geo: cap(0.16, 0.36), pos: [0, 1.24, 0], scale: [1.12, 1, 0.62] },
    { geo: cap(0.15, 0.08), pos: [0, 0.96, 0], scale: [1.05, 1, 0.7] },
    ...mirrored({ geo: cap(0.046, 0.26), pos: [0.215, 1.3, 0], rot: [0, 0, 0.12] }),
    ...mirrored({ geo: cap(0.04, 0.24), pos: [0.255, 1.02, 0.01], rot: [0, 0, 0.04] }),
    ...mirrored({ geo: cap(0.075, 0.34), pos: [0.09, 0.66, 0] }),
    ...mirrored({ geo: cap(0.055, 0.34), pos: [0.09, 0.27, -0.01] }),
    ...mirrored({ geo: cap(0.038, 0.1), pos: [0.09, 0.04, 0.05], rot: [Math.PI / 2, 0, 0] }),
  ];
  return mergeGeometries(parts.map(place)) ?? new BufferGeometry();
}

/** Schematic organs at the reference anchors; node ids match the HRA build (doc 12 §3). */
function organGeometries(): Array<[OrganNodeId, BufferGeometry]> {
  const g = (parts: Part[]) => mergeGeometries(parts.map(place)) ?? new BufferGeometry();
  return [
    ['brain', g([{ geo: sph(0.075), pos: [0, 1.665, -0.01], scale: [0.85, 0.72, 1] }])],
    ['eye_l', g([{ geo: sph(0.012), pos: [0.032, 1.6, 0.078] }])],
    ['eye_r', g([{ geo: sph(0.012), pos: [-0.032, 1.6, 0.078] }])],
    ['heart', g([{ geo: sph(0.052), pos: [0.025, 1.31, 0.045], scale: [0.9, 1.1, 0.8] }])],
    ['lung_l', g([{ geo: cap(0.058, 0.12), pos: [0.088, 1.35, 0.0], scale: [1, 1, 0.9] }])],
    ['lung_r', g([{ geo: cap(0.062, 0.12), pos: [-0.088, 1.35, 0.0], scale: [1, 1, 0.9] }])],
    ['aorta', g([{ geo: cyl(0.011, 0.42), pos: [0.005, 1.15, -0.03] }])],
    ['liver', g([{ geo: sph(0.085), pos: [-0.065, 1.16, 0.035], scale: [1.2, 0.6, 0.8] }])],
    ['pancreas', g([{ geo: cap(0.017, 0.12), pos: [0.02, 1.1, 0.015], rot: [0, 0, Math.PI / 2] }])],
    ['kidney_l', g([{ geo: sph(0.04), pos: [0.07, 1.06, -0.05], scale: [0.7, 1.2, 0.6] }])],
    ['kidney_r', g([{ geo: sph(0.04), pos: [-0.07, 1.05, -0.05], scale: [0.7, 1.2, 0.6] }])],
    ['bladder', g([{ geo: sph(0.034), pos: [0, 0.88, 0.04] }])],
    ['spine', g([{ geo: cyl(0.017, 0.6), pos: [0, 1.22, -0.075] }])],
    [
      'pelvis',
      g([
        {
          geo: new TorusGeometry(0.095, 0.022, 8, 24),
          pos: [0, 0.93, -0.01],
          rot: [Math.PI / 2, 0, 0],
          scale: [1.15, 0.75, 1],
        },
      ]),
    ],
    ['femur_l', g([{ geo: cyl(0.016, 0.42), pos: [0.09, 0.66, 0] }])],
    ['femur_r', g([{ geo: cyl(0.016, 0.42), pos: [-0.09, 0.66, 0] }])],
  ];
}

export interface BodyMeshesProps {
  materials: Map<OrganNodeId, MeshStandardMaterial>;
  skin: ShaderMaterial;
  onOrgan: (id: OrganNodeId) => void;
}

const noRaycast = () => undefined;

/** Procedural reference body (B fallback when the HRA GLB is missing). */
export function ProceduralBody({ materials, skin, onOrgan }: BodyMeshesProps) {
  const shell = useMemo(() => skinGeometry(), []);
  const organs = useMemo(() => organGeometries(), []);
  return (
    <group name="procedural-body">
      {organs.map(([id, geo]) => {
        const mat = materials.get(id);
        return mat ? (
          <mesh
            key={id}
            name={id}
            geometry={geo}
            material={mat}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onOrgan(id);
            }}
          />
        ) : null;
      })}
      <mesh name="skin" geometry={shell} material={skin} raycast={noRaycast} renderOrder={10} />
    </group>
  );
}
