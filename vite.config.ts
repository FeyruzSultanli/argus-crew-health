/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Public base path. '/' for dev, `npm run preview`, the default e2e and Vercel; the GitHub Pages workflow
 * builds with ARGUS_BASE=/argus-crew-health/. Normalised to a leading and trailing slash.
 */
function resolveBase(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}
const base = resolveBase(process.env.ARGUS_BASE);

// Dark theme --bg token (src/ui/tokens.css): manifest theme/background and the maskable icon background.
const DARK_BG = '#07090D';

/**
 * PWA / offline (doc 05 §8). Deliberate Workbox configuration — every line below is load-bearing:
 * - Precache = app shell + every file the core features fetch at run time, so a cold reload with the network off works
 *   at any base: JS/CSS/HTML chunks, public/seed/** (handbook index.json + 40 .md), public/anatomy/** (2 GLBs),
 *   public/mediapipe/** (wasm runtime + face_landmarker.task), woff2 fonts, the icons. Workbox would otherwise keep
 *   only js/css/html and silently skip files > 2 MiB (the 14.7 MB wasm), hence the patterns and the 30 MB limit.
 * - Excluded on purpose: `mediapipe/vision_wasm_module_internal.*` (ES-module variant the app never loads, 14.7 MB) and
 *   `*.woff` (the fontsource CSS lists woff2 first; every supported browser takes woff2).
 * - registerType 'autoUpdate' makes the plugin force skipWaiting + clientsClaim; cleanupOutdatedCaches (default in
 *   generateSW, set explicitly) deletes the previous precache. The registration script reloads open tabs once the new
 *   worker activates, so a deploy never leaves a stale shell asking for chunk hashes that are gone (404).
 * - navigateFallback 'index.html' resolves against sw.js, i.e. `${base}index.html`: offline deep links work under
 *   the GitHub Pages sub-path as well as at '/'.
 * - No runtimeCaching for NOAA: src/services/adapters/noaaSource.ts labels any `ok` fetch response LIVE with
 *   fetchedAt = now, so a Workbox NetworkFirst cache hit (served after the 3-s network timeout, or when NOAA is
 *   down) would show stale data as LIVE. The app's own chain (Dexie cache → bundled snapshot) already covers
 *   offline and is labeled CACHED/SNAPSHOT honestly. DONKI is cut from the build (no requests to cache).
 */
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered by startOfflinePackage() (src/ui/shell/OfflinePackage.tsx, called in src/main.tsx on every page,
      // sign-in included) through `virtual:pwa-register`, which also performs the autoUpdate reload. No injected script.
      injectRegister: false,
      // public/icons/** is already matched by globPatterns (png/svg); listing it again only duplicated the entries.
      includeManifestIcons: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,md,csv,wasm,task,glb,woff2,svg,png,ico}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        globIgnores: ['**/node_modules/**', 'mediapipe/vision_wasm_module_internal.*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        id: base,
        name: 'ARGUS — Crew health autonomy',
        short_name: 'ARGUS',
        description: 'Offline-first crew health monitoring prototype (NASA Space Apps Challenge 2026).',
        lang: 'en',
        theme_color: DARK_BG,
        background_color: DARK_BG,
        display: 'standalone',
        // start_url / scope follow the base; icon src is relative to manifest.webmanifest (served at the base).
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  build: {
    // doc 05 §10 budget: initial JS ≤ 300 kB gzip. The only chunk over 500 kB is BodyScene (three.js + R3F + drei,
    // ~1 MB min / ~281 kB gzip), lazy on /body only, so the default warning is raised just above it.
    chunkSizeWarningLimit: 1100,
  },
  test: {
    // Run once and exit; `npm test -- --watch` opts into watch mode.
    watch: false,
    // Generous timeouts: the suite must not flake when the machine is busy (seeding 9k observations in
    // fake-indexeddb, lazy routes). Real performance budgets are asserted inside the tests themselves.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**'],
      reporter: ['text', 'html', 'json-summary'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/domain/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/domain/**', '**/node_modules/**'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
});
