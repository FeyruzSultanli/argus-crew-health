// Test fakes for the face scan: fake MediaStream, a fake tracker returning synthetic detections (landmarks +
// transformation matrix + blendshapes) from a mutable spec, and the camera-pulse fast 30-fps loop. Test helper only.
import { type SyntheticFace, syntheticDetection } from '../../../measurement/face/testFaces';
import { fakeStream, fastLoop } from '../camera/testDeps';
import type { FaceScanDeps } from './deps';

export type FaceSpec = (SyntheticFace & { yaw?: number; pitch?: number; jawOpen?: number; smile?: number }) | null;

/** `spec.current` is read on every frame (or called with the frame number); null = no face in the frame. */
export function fakeFaceDeps(initial: FaceSpec = {}) {
  const { stream, track } = fakeStream();
  const spec: { current: FaceSpec | ((frame: number) => FaceSpec) } = { current: initial };
  let n = 0;
  const detect = () => {
    const s = typeof spec.current === 'function' ? spec.current(n++) : spec.current;
    return s ? syntheticDetection(s) : null;
  };
  const deps: FaceScanDeps = {
    openCamera: () => Promise.resolve(stream),
    loadTracker: () => Promise.resolve({ delegate: 'fake', detect }),
    startLoop: fastLoop(),
  };
  return { deps, spec, track };
}
