// Credits shown on the Limits page (FR-SET-3). Copied row by row from CREDITS.md at the repository root — this file
// adds nothing of its own. When CREDITS.md changes, update this list to match.

export interface CreditRow {
  asset: string;
  source: string;
  license: string;
  whereUsed: string;
}

export const CREDITS: readonly CreditRow[] = [
  {
    asset: '3D reference bodies and organs (Visible Human male/female)',
    source: 'HRA 3D Reference Library, HuBMAP Consortium / NIH 3D (3DPX-021022, 3DPX-021627)',
    license: 'CC BY 4.0',
    whereUsed: 'public/anatomy/ (simplified and compressed)',
  },
  {
    asset:
      'Face Landmarker model (face_landmarker.task, float16, v1) and Tasks Vision WASM runtime (from npm @mediapipe/tasks-vision 1.2.3)',
    source: 'Google MediaPipe',
    license: 'Apache-2.0',
    whereUsed: 'public/mediapipe/ (self-hosted, camera pulse)',
  },
  {
    asset: 'IBM Plex Sans / Mono',
    source: 'IBM via @fontsource',
    license: 'SIL OFL 1.1',
    whereUsed: 'UI typography',
  },
  { asset: 'Lucide icons', source: 'lucide.dev', license: 'ISC', whereUsed: 'UI icons' },
  {
    asset: 'Blood count and metabolic panel data',
    source:
      'NASA Open Science Data Repository, OSD-569 (Inspiration4 complete blood count) and OSD-575 (Inspiration4 metabolic panel) — https://osdr.nasa.gov/bio/repo/data/studies/OSD-569, https://osdr.nasa.gov/bio/repo/data/studies/OSD-575',
    license: 'NASA open data',
    whereUsed: 'seed/osdr/ — pre-flight anchors only (anonymised commercial crew subjects)',
  },
  {
    asset: 'Space weather data',
    source:
      'NOAA SWPC GOES primary integral proton flux JSON (live at run time; snapshot captured 2026-11-14)',
    license: 'US Government public',
    whereUsed:
      'Environment screen, seed/radiation/goes-snapshot.json. The NASA CCMC DONKI event list was not reachable on build day and is not used. seed/radiation/spe-replay.json is our own synthetic profile, not NOAA data',
  },
  {
    asset: 'Open-source libraries',
    source:
      'React, React Router, Vite, Tailwind CSS, Zustand, three.js, @react-three/fiber, @react-three/drei, Recharts, Motion, vite-plugin-pwa (MIT); Dexie, dexie-react-hooks (Apache-2.0)',
    license: 'MIT / Apache-2.0',
    whereUsed: 'application code',
  },
  {
    asset: 'Test-only tools (not shipped)',
    source:
      'axe-core, @axe-core/playwright (MPL-2.0); fake-indexeddb (Apache-2.0); Vitest, Playwright, Testing Library',
    license: 'as listed',
    whereUsed: 'tests',
  },
];

/** CREDITS.md closing line, verbatim. */
export const CREDITS_MARK_NOTE =
  'The ARGUS mark is original. No NASA logos, flags or mission insignia are used.';
