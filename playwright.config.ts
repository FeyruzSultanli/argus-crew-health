import { defineConfig, devices } from '@playwright/test';

// E2E_PORT sets the dev-server port (default 5180), e.g. when 5180 is already in use.
const PORT = Number(process.env.E2E_PORT ?? 5180);

export default defineConfig({
  testDir: './e2e',
  // e2e/subpath.spec.ts needs the GitHub Pages-style build: playwright.subpath.config.ts.
  testIgnore: 'subpath.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
