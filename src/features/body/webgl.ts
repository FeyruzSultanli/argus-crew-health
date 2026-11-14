// WebGL capability check for the 3D body (doc 11 §6 fallback rule). Cached after the first call.
let cached: boolean | undefined;

export function webglAvailable(): boolean {
  if (cached !== undefined) return cached;
  try {
    // No DOM, or jsdom (unit tests: it has no WebGL and logs "not implemented" for getContext).
    if (typeof document === 'undefined' || navigator.userAgent.includes('jsdom')) return (cached = false);
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    cached = gl !== null && gl !== undefined;
    // Release the probe context right away.
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

/** Test hook: forget the cached result. */
export function resetWebglProbe(): void {
  cached = undefined;
}
