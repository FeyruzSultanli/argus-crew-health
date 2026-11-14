import { defineConfig, devices } from '@playwright/test';

// E2E against a real production build (service worker, precache, offline). There is no service worker in dev,
// so e2e/offline.spec.ts and e2e/perf.spec.ts only run here (the default dev config skips them by project name).
//
//   npm run test:e2e:prod            → build at base '/', served by `vite preview`
//   npm run test:e2e:prod:subpath    → ARGUS_BASE=/argus-crew-health/ build + 404.html copy, served by
//                                      scripts/serve-subpath.ts exactly like GitHub Pages (as playwright.subpath.config.ts)
// Both build into dist/: run them one after the other, not in parallel.
const PORT = Number(process.env.E2E_PORT ?? 5187);
const BASE = (() => {
  const t = (process.env.ARGUS_E2E_BASE ?? '/').trim().replace(/^\/+|\/+$/g, '');
  return t ? `/${t}/` : '/';
})();
const SUBPATH = BASE !== '/';
// Read by the specs (here and in the workers, which load this file again) to run only against this build.
process.env.ARGUS_E2E_PROD = '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['offline.spec.ts', 'perf.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  metadata: { base: BASE },
  projects: [
    {
      name: SUBPATH ? 'prod-subpath' : 'prod-root',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: SUBPATH
      ? `ARGUS_BASE=${BASE} npm run build && cp dist/index.html dist/404.html && ` +
        `npx tsx scripts/serve-subpath.ts --dir dist --base ${BASE} --port ${PORT}`
      : `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    // Always rebuild: a server left over from another base would test the wrong build.
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
