import { describe, expect, it } from 'vitest';

import { BASE_URL, ROUTER_BASENAME, assetUrl } from './paths';

// Vitest runs with Vite's default base '/'; the sub-path build is covered by e2e/subpath.spec.ts.
describe('paths', () => {
  it('uses the root base in tests', () => {
    expect(BASE_URL).toBe('/');
    expect(ROUTER_BASENAME).toBe('/');
  });

  it('joins a public path onto the base, with or without a leading slash', () => {
    expect(assetUrl('mediapipe/face_landmarker.task')).toBe('/mediapipe/face_landmarker.task');
    expect(assetUrl('/seed/radiation/snapshot.json')).toBe('/seed/radiation/snapshot.json');
    expect(assetUrl('mediapipe')).toBe('/mediapipe');
  });
});
