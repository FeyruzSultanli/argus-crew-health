import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { MeshStandardMaterial, ShaderMaterial } from 'three';

import type { OrganNodeId } from './anatomyMap';
import type { OrganTarget } from './materials';
import { MaterialTweener } from './tweener';
import type { SkinTarget } from './tweener';

export interface MaterialAnimatorProps {
  materials: Map<OrganNodeId, MeshStandardMaterial>;
  skin: ShaderMaterial;
  targets: Map<OrganNodeId, OrganTarget>;
  skinTarget: SkinTarget;
  reducedMotion: boolean;
}

/**
 * Tweens organ materials towards their verdict targets and pulses ACT organs. The canvas renders on demand, so this
 * invalidates a frame only while something is moving (frameloop="demand").
 */
export function MaterialAnimator({
  materials,
  skin,
  targets,
  skinTarget,
  reducedMotion,
}: MaterialAnimatorProps) {
  const invalidate = useThree((s) => s.invalidate);
  const tweener = useMemo(() => new MaterialTweener(materials, skin), [materials, skin]);

  useEffect(() => {
    tweener.retarget(targets, skinTarget, reducedMotion, performance.now());
    invalidate();
  }, [tweener, targets, skinTarget, reducedMotion, invalidate]);

  useFrame(() => {
    if (tweener.step(performance.now())) invalidate();
  });

  return null;
}
