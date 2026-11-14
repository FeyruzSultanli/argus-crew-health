# Credits and licenses

| Asset | Source | License | Where used |
|-------|--------|---------|-----------|
| 3D reference bodies and organs (Visible Human male and female, "united" bodies v1.10) | HRA 3D Reference Organs, HuBMAP Consortium — https://humanatlas.io/3d-reference-library (NIH 3D entries 3DPX-021022, 3DPX-021627) | CC BY 4.0 | `public/anatomy/male.glb`, `female.glb` (simplified to about 139k triangles each and meshopt-compressed by `scripts/build-anatomy.ts`). Reference bodies, not scans of any crew member |
| Face Landmarker model (`face_landmarker.task`, float16, v1) and Tasks Vision WASM runtime (from npm `@mediapipe/tasks-vision` 1.2.3) | Google MediaPipe | Apache-2.0 | `public/mediapipe/` (self-hosted, camera pulse) |
| IBM Plex Sans / Mono | IBM via `@fontsource` | SIL OFL 1.1 | UI typography |
| Lucide icons | lucide.dev | ISC | UI icons |
| Blood count and metabolic panel data | NASA Open Science Data Repository, OSD-569 (Inspiration4 complete blood count) and OSD-575 (Inspiration4 metabolic panel) — https://osdr.nasa.gov/bio/repo/data/studies/OSD-569, https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 | NASA open data | `seed/osdr/` — pre-flight anchors only (anonymised commercial crew subjects) |
| Space weather data | NOAA SWPC GOES primary integral proton flux JSON (live at run time; snapshot captured 2026-11-14) | US Government public | Environment screen, `seed/radiation/goes-snapshot.json`. The NASA CCMC DONKI event list was not reachable on build day and is not used. `seed/radiation/spe-replay.json` is our own synthetic profile, not NOAA data |
| Open-source libraries | React, React Router, Vite, Tailwind CSS, Zustand, three.js, @react-three/fiber, @react-three/drei, Recharts, Motion, vite-plugin-pwa (MIT); Dexie, dexie-react-hooks (Apache-2.0) | MIT / Apache-2.0 | application code |
| Test- and build-only tools (not shipped) | axe-core, @axe-core/playwright (MPL-2.0); fake-indexeddb (Apache-2.0); @gltf-transform/core, functions, extensions and meshoptimizer (MIT, anatomy build script); Vitest, Playwright, Testing Library | as listed | tests |

BodyParts3D (DBCLS) is not used in this build. License page checked on 14 Nov 2026: CC BY 4.0 since 2025-02-27
(https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html); required credit: "BodyParts3D, © The Database Center
for Life Science licensed under CC Attribution 4.0 International". Older archive releases and the comments inside
some OBJ files still say CC BY-SA 2.1 Japan — download from the LATEST archive folder.
The ARGUS mark is original. No NASA logos, flags or mission insignia are used.
