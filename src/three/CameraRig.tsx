import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';

import type { BodyRegionId } from '../domain/types';
import type { CameraRequest } from '../features/body/BodyViewport';
import type { Vec3 } from './anatomyMap';
import { FLY_MS, viewFor } from './cameraViews';

interface OrbitLike {
  target: Vector3;
  update: () => void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Smooth camera moves for presets, region selection and zoom (450 ms, instant under reduced motion). */
export function CameraRig({
  request,
  anchors,
  reducedMotion,
}: {
  request: CameraRequest;
  anchors: Record<BodyRegionId, Vec3>;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null;
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{
    fromPos: Vector3;
    toPos: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    start: number;
  } | null>(null);
  const lastSeq = useRef(-1);

  useEffect(() => {
    if (!controls || request.seq === lastSeq.current) return;
    const first = lastSeq.current === -1;
    lastSeq.current = request.seq;
    const curTarget = controls.target.clone();
    const dir = camera.position.clone().sub(curTarget);
    const distance = dir.length();
    if (distance < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    const view = viewFor(request, anchors, { target: curTarget, distance });
    const toTarget = new Vector3(...view.target);
    // Presets and region jumps look from the front-ish side; zoom keeps the current direction.
    const useDir =
      request.kind === 'zoom'
        ? dir
        : new Vector3(dir.x * 0.5, 0.08, Math.max(0.6, Math.abs(dir.z))).normalize();
    const toPos = toTarget.clone().add(useDir.multiplyScalar(view.distance));
    if (first || reducedMotion) {
      camera.position.copy(toPos);
      controls.target.copy(toTarget);
      controls.update();
      anim.current = null;
    } else {
      anim.current = {
        fromPos: camera.position.clone(),
        toPos,
        fromTarget: curTarget,
        toTarget,
        start: performance.now(),
      };
    }
    invalidate();
  }, [request, anchors, camera, controls, reducedMotion, invalidate]);

  useFrame(() => {
    const a = anim.current;
    if (!a || !controls) return;
    const p = Math.min(1, (performance.now() - a.start) / FLY_MS);
    const k = ease(p);
    camera.position.lerpVectors(a.fromPos, a.toPos, k);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
    controls.update();
    if (p < 1) invalidate();
    else anim.current = null;
  });

  return null;
}
