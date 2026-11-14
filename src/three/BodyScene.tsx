import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import type { BodyRegionId, CrewMember } from '../domain/types';
import type { CameraRequest } from '../features/body/BodyViewport';
import type { Hotspot } from '../features/body/hotspots';
import type { Theme } from '../state/ui';
import { HOME_VIEW, NODE_REGION, REGION_ANCHORS, REGION_NODES } from './anatomyMap';
import type { OrganNodeId, Vec3 } from './anatomyMap';
import { CameraRig } from './CameraRig';
import { MAX_DISTANCE, MIN_DISTANCE } from './cameraViews';
import { HotspotOverlay } from './Hotspots3D';
import { HotspotProjector } from './HotspotProjector';
import { MaterialAnimator } from './MaterialAnimator';
import type { SkinTarget } from './tweener';
import { createOrganMaterials, createSkinMaterial, organTarget, readPalette } from './materials';
import type { OrganTarget } from './materials';
import { AnatomyModel, ModelBoundary } from './AnatomyModel';
import { ProceduralBody } from './ProceduralBody';

export interface BodySceneProps {
  sex: CrewMember['sex'];
  hotspots: readonly Hotspot[];
  onRegion: (id: BodyRegionId) => void;
  camera: CameraRequest;
  reducedMotion: boolean;
  theme: Theme;
  /** Called when the GPU context is lost or the scene fails, so the page can fall back to 2D. */
  onFailure: () => void;
}

/**
 * 3D crew body (doc 11 §6): translucent Fresnel skin, organs tinted by the selected lens, pulsing ACT organs,
 * hotspots with leader labels, damped orbit controls with a constrained polar angle, presets and fly-to,
 * frameloop="demand" and DPR clamped to [1, 2].
 */
export function BodyScene({
  sex,
  hotspots,
  onRegion,
  camera,
  reducedMotion,
  theme,
  onFailure,
}: BodySceneProps) {
  const materials = useMemo(() => createOrganMaterials(), []);
  const skin = useMemo(() => createSkinMaterial(), []);
  // theme is a dependency on purpose: the status hues are re-read from the CSS tokens when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const palette = useMemo(() => readPalette(), [theme]);
  const [anchors, setAnchors] = useState<Record<BodyRegionId, Vec3>>(REGION_ANCHORS);
  const onOrgan = (id: OrganNodeId) => onRegion(NODE_REGION[id]);
  const procedural = <ProceduralBody materials={materials} skin={skin} onOrgan={onOrgan} />;

  const targets = useMemo(() => {
    const t = new Map<OrganNodeId, OrganTarget>();
    for (const h of hotspots)
      for (const node of REGION_NODES[h.id])
        if (node !== 'skin') t.set(node, organTarget(h.verdict, palette, !h.inFilter));
    return t;
  }, [hotspots, palette]);

  const skinTarget = useMemo<SkinTarget>(() => {
    const whole = hotspots.find((h) => h.id === 'whole_body');
    const skinH = hotspots.find((h) => h.id === 'skin');
    const tint = (h: Hotspot | undefined) =>
      h && h.flagged ? (h.verdict === 'ACT' ? palette.act : palette.watch) : undefined;
    return {
      base: (tint(skinH) ?? palette.neutral).clone(),
      rim: (tint(whole) ?? palette.rim).clone(),
      rimStrength: whole?.flagged ? 0.85 : 0.5,
    };
  }, [hotspots, palette]);

  const registry = useRef(new Map<BodyRegionId, HTMLDivElement>());
  const [cx, cy, cz] = HOME_VIEW.target;
  return (
    <div className="absolute inset-0">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 30, near: 0.05, far: 50, position: [cx, cy, cz + HOME_VIEW.distance] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            onFailure();
          });
        }}
        aria-hidden="true"
        data-testid="body-canvas"
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[1.5, 2.5, 2.5]} intensity={1.4} />
        <directionalLight position={[-2, 1.5, -2.5]} intensity={0.9} color="#9fd8ff" />
        <hemisphereLight args={['#c9d6e3', '#0b1016', 0.35]} />
        {/* HRA reference body; if it cannot load, the procedural stand-in body keeps the scene usable. */}
        <ModelBoundary key={sex} fallback={procedural}>
          <Suspense fallback={null}>
            <AnatomyModel
              sex={sex}
              materials={materials}
              skin={skin}
              onOrgan={onOrgan}
              onAnchors={setAnchors}
            />
          </Suspense>
        </ModelBoundary>
        <HotspotProjector anchors={anchors} registry={registry} />
        <MaterialAnimator
          materials={materials}
          skin={skin}
          targets={targets}
          skinTarget={skinTarget}
          reducedMotion={reducedMotion}
        />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.8}
          minDistance={MIN_DISTANCE}
          maxDistance={MAX_DISTANCE}
          target={[cx, cy, cz]}
        />
        <CameraRig request={camera} anchors={anchors} reducedMotion={reducedMotion} />
      </Canvas>
      <HotspotOverlay
        hotspots={hotspots}
        anchors={anchors}
        onSelect={onRegion}
        reducedMotion={reducedMotion}
        registry={registry}
      />
    </div>
  );
}
