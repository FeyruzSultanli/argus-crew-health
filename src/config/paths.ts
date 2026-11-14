// Base-path aware URLs. The app is served at the domain root in dev/preview/Vercel and under a sub-path on
// GitHub Pages (`/argus-crew-health/`). Vite's `base` (vite.config.ts, env ARGUS_BASE) sets import.meta.env.BASE_URL;
// every same-origin asset URL that is not imported through the bundler goes through `assetUrl`.

/** Vite base, always with a trailing slash ('/' or '/argus-crew-health/'). */
export const BASE_URL: string = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** React Router `basename`: the base without its trailing slash ('/' stays '/'). */
export const ROUTER_BASENAME: string = BASE_URL === '/' ? '/' : BASE_URL.replace(/\/+$/, '');

/**
 * URL of a file in `public/` (or `public/seed/`), e.g. `assetUrl('seed/radiation/x.json')` or
 * `assetUrl('/mediapipe/face_landmarker.task')`. A leading slash is accepted and treated as base-relative.
 */
export function assetUrl(path: string): string {
  return `${BASE_URL}${path.replace(/^\/+/, '')}`;
}
