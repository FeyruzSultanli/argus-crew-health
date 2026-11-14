import { Component, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Mesh } from 'three';
import type { MeshStandardMaterial, ShaderMaterial } from 'three';

import type { BodyRegionId, CrewMember } from '../domain/types';
import { ORGAN_NODE_IDS, anatomyUrl } from './anatomyMap';
import type { OrganNodeId, Vec3 } from './anatomyMap';
import { anchorsFromMeshes } from './anchors';

const noRaycast = () => undefined;

export interface AnatomyModelProps {
  sex: CrewMember['sex'];
  materials: Map<OrganNodeId, MeshStandardMaterial>;
  skin: ShaderMaterial;
  onOrgan: (id: OrganNodeId) => void;
  onAnchors: (anchors: Record<BodyRegionId, Vec3>) => void;
}

/** HRA reference body (CC BY 4.0): one mesh per stable organ node, materials supplied by the scene. */
export function AnatomyModel({ sex, materials, skin, onOrgan, onAnchors }: AnatomyModelProps) {
  // useGLTF(url, draco = false, meshopt = true): no Draco decoder from a CDN, meshopt decoder is bundled.
  const { nodes } = useGLTF(anatomyUrl(sex), false, true);
  const meshes = useMemo(
    () =>
      ORGAN_NODE_IDS.flatMap((id) => {
        const n = nodes[id];
        return n instanceof Mesh ? [{ id, mesh: n }] : [];
      }),
    [nodes],
  );

  useEffect(() => onAnchors(anchorsFromMeshes(meshes)), [meshes, onAnchors]);

  return (
    <group name={`hra-${sex}`}>
      {meshes.map(({ id, mesh }) =>
        id === 'skin' ? (
          <mesh
            key={id}
            name={id}
            geometry={mesh.geometry}
            position={mesh.position}
            quaternion={mesh.quaternion}
            scale={mesh.scale}
            material={skin}
            raycast={noRaycast}
            renderOrder={10}
          />
        ) : (
          <mesh
            key={id}
            name={id}
            geometry={mesh.geometry}
            position={mesh.position}
            quaternion={mesh.quaternion}
            scale={mesh.scale}
            material={materials.get(id)}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onOrgan(id);
            }}
          />
        ),
      )}
    </group>
  );
}

/** If the reference body cannot load (missing file, offline without cache), show `fallback` instead. */
export class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
