// Shared loader: the camera-pulse option set is unchanged (blendshapes and transformation
// matrix OFF) and the face scan gets its own cached instance with both ON. MediaPipe is mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createFromOptions = vi.fn((_fileset: unknown, opts: Record<string, unknown>) => Promise.resolve({ opts }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: { createFromOptions },
  FilesetResolver: { forVisionTasks: () => Promise.resolve({}) },
}));

const { getFaceLandmarker, FACE_MODEL_PATH } = await import('./landmarker');

beforeEach(() => createFromOptions.mockClear());

describe('getFaceLandmarker options', () => {
  it('camera pulse ({ blendshapes: false }) → exactly the camera-pulse option set', async () => {
    await getFaceLandmarker({ blendshapes: false });
    expect(createFromOptions).toHaveBeenCalledTimes(1);
    expect(createFromOptions.mock.calls[0]?.[1]).toEqual({
      baseOptions: { modelAssetPath: FACE_MODEL_PATH, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
  });

  it('face scan → separate instance with blendshapes and the transformation matrix', async () => {
    const pulse = await getFaceLandmarker({ blendshapes: false });
    const face = await getFaceLandmarker({ blendshapes: true, transformMatrix: true });
    expect(face).not.toBe(pulse);
    expect(createFromOptions).toHaveBeenCalledTimes(1); // the pulse instance was cached by the first test
    expect(createFromOptions.mock.calls[0]?.[1]).toMatchObject({ outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
    expect(await getFaceLandmarker({ blendshapes: true, transformMatrix: true })).toBe(face);
    expect(createFromOptions).toHaveBeenCalledTimes(1);
  });
});
