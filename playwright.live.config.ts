import { defineConfig, devices } from '@playwright/test';

// Checks against the DEPLOYED site (GitHub Pages). No web server is started.
//   ARGUS_E2E_PROD=1 npx playwright test -c playwright.live.config.ts
// The specs are the same ones that run locally against the sub-path build and the production build.
const ORIGIN = process.env.ARGUS_LIVE_ORIGIN ?? 'https://feyruzsultanli.github.io';
process.env.ARGUS_E2E_LIVE = '1';
process.env.ARGUS_E2E_PROD = '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['subpath.spec.ts', 'offline.spec.ts', 'live-demo.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 180_000,
  use: { baseURL: ORIGIN, trace: 'retain-on-failure' },
  // offline.spec.ts reads the base path from here (same key as playwright.prod.config.ts).
  metadata: { base: '/argus-crew-health/' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
