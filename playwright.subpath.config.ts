import { defineConfig, devices } from '@playwright/test';

// E2E against a real GitHub Pages-style build. Builds with ARGUS_BASE=/argus-crew-health/, copies
// index.html to 404.html (as .github/workflows/pages.yml does) and serves dist/ under the prefix with
// scripts/serve-subpath.ts, which answers unknown paths with 404.html like Pages.
//   E2E_PORT=5197 npx playwright test -c playwright.subpath.config.ts
const PORT = Number(process.env.E2E_PORT ?? 5197);
const SUBPATH = '/argus-crew-health/';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'subpath.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command:
      `ARGUS_BASE=${SUBPATH} npm run build && cp dist/index.html dist/404.html && ` +
      `npx tsx scripts/serve-subpath.ts --dir dist --base ${SUBPATH} --port ${PORT}`,
    url: `http://localhost:${PORT}${SUBPATH}`,
    // Always rebuild: a server left over from another base would test the wrong build.
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
