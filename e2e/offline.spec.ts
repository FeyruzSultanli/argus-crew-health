// Airplane-mode e2e on a production build (doc 14 §3 item 9, NFR-1). Load once online, let the service worker
// precache, go offline, reload, then hard-load every core route: each must render from the precache alone.
// Runs only under playwright.prod.config.ts (projects prod-root / prod-subpath); the dev config skips it.
//   npm run test:e2e:prod            (base '/')
//   npm run test:e2e:prod:subpath    (base '/argus-crew-health/', GitHub Pages imitation)
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page, Response } from '@playwright/test';

import { signInAs } from './helpers';

test.skip(process.env.ARGUS_E2E_PROD !== '1', 'needs the production build (service worker): playwright.prod.config.ts');

// Chromium's fake camera (as e2e/camera-pulse.spec.ts); file-level because launchOptions force a new worker.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const NOAA = /^https:\/\/services\.swpc\.noaa\.gov\//;
/** The Bridge polls NOAA when online; the tests abort it (hermetic), which logs one failed request. */
const NOAA_PROBLEM = /services\.swpc\.noaa\.gov/;

function baseOf(): string {
  const b = test.info().config.metadata?.base;
  return typeof b === 'string' ? b : '/';
}

/** Console errors, page errors and failed requests. */
function collectProblems(page: Page, context: BrowserContext): () => string[] {
  const out: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') out.push(`console: ${m.text()} @ ${m.location().url}`);
  });
  page.on('pageerror', (e) => out.push(`pageerror: ${e.message}`));
  context.on('requestfailed', (r) => out.push(`failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  return () => [...out];
}

/** Wait until the service worker is active and controls the page (precache complete). */
async function waitForOfflineReady(page: Page, base: string, baseURL: string) {
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(new URL(base, baseURL).href);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });

test('first visit: "Preparing offline package" progress turns into "Ready to work offline"', async ({
  page,
  context,
  baseURL,
}) => {
  const base = baseOf();
  const problems = collectProblems(page, context);
  await context.route(NOAA, (route) => route.abort());
  // Slow the biggest precache file down so the preparing phase is observable on localhost.
  await context.route(/face_landmarker\.task$/, async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await signInAs(page, 'cmo');
  await page.goto(base);
  await expect(h1(page, 'Mission Bridge')).toBeVisible();
  const pkg = page.getByRole('banner').getByTestId('offline-package');
  await expect(pkg).toHaveAttribute('role', 'status');
  await expect(pkg).toHaveAttribute('data-phase', 'preparing', { timeout: 15_000 });
  await expect(pkg).toContainText(/Preparing offline package/i);
  await expect(pkg).toHaveAttribute('data-phase', 'ready', { timeout: 60_000 });
  await expect(pkg).toHaveText(/Ready to work offline/i);
  await waitForOfflineReady(page, base, baseURL ?? '');
  // a second visit is already controlled: no progress line at all
  await page.reload();
  await expect(h1(page, 'Mission Bridge')).toBeVisible();
  await expect(pkg).toHaveAttribute('data-phase', 'idle');
  // The only allowed problem: the NOAA request this test aborts while ONLINE (hermetic); never one while offline.
  expect(problems().filter((p) => !NOAA_PROBLEM.test(p))).toEqual([]);
});

const ROUTES: Array<{ path: string; h1: string }> = [
  { path: 'body', h1: 'L. Duarte' }, // CMO signed in with crewId c4 → own body
  { path: 'body/c4', h1: 'L. Duarte' },
  { path: 'trends/c4', h1: 'Trends' },
  { path: 'lab', h1: 'Measurement Lab' },
  { path: 'lab/pvt', h1: 'Reaction Self-Test' },
  { path: 'lab/manual', h1: 'Manual vitals' },
  { path: 'crew', h1: 'Crew overview' },
  { path: 'earth', h1: 'Earth link' },
  { path: 'handbook', h1: 'Handbook' },
  { path: 'handbook/suspected-infection', h1: 'Suspected infection' },
  { path: 'handbook/sleep', h1: 'Sleep duration' },
  { path: 'settings', h1: 'Settings' },
  { path: 'limits', h1: 'Limits' },
];

test('airplane mode: after one online visit every core route hard-loads offline from the precache', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const base = baseOf();
  const problems = collectProblems(page, context);
  let offline = false;
  const noaaOffline: string[] = [];
  context.on('request', (r) => {
    if (offline && NOAA.test(r.url())) noaaOffline.push(r.url());
  });
  // Hermetic: never reach the real NOAA server from the test.
  await context.route(NOAA, (route) => route.abort());
  const swServed = new Map<string, boolean>();
  const track = (r: Response) => {
    const u = r.url();
    if (/\.(glb|wasm|task|md|woff2)$|handbook\/index\.json$/.test(u)) swServed.set(u, r.fromServiceWorker());
  };
  page.on('response', track);

  // 1. one online visit (sign-in through localStorage, the Bridge only — nothing else is warmed up)
  await signInAs(page, 'cmo');
  await page.goto(base);
  await expect(h1(page, 'Mission Bridge')).toBeVisible();
  await waitForOfflineReady(page, base, baseURL ?? '');

  // 2. airplane mode, reload
  offline = true;
  await context.setOffline(true);
  await page.reload();
  await expect(h1(page, 'Mission Bridge')).toBeVisible();
  await expect(page.getByTestId('online-status')).toHaveText(/offline/i);
  // fonts came from the precache
  const fontsOk = await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded: string[] = [];
    document.fonts.forEach((f) => {
      if (f.status === 'loaded') loaded.push(f.family);
    });
    return { loaded };
  });
  expect(fontsOk.loaded.some((f) => /IBM Plex Sans/.test(f))).toBe(true);
  expect(fontsOk.loaded.some((f) => /IBM Plex Mono/.test(f))).toBe(true);

  // 3. Environment: SNAPSHOT or CACHED with an age — never LIVE while offline
  await page.goto(`${base}environment`);
  await expect(h1(page, 'Radiation & cabin')).toBeVisible();
  const swBadge = page.getByTestId('data-mode-bar').getByTestId('space-weather-badge');
  await expect(swBadge).toHaveText(/SNAPSHOT|CACHED/, { timeout: 15_000 });
  await expect(page.getByTestId('data-freshness')).toContainText(/Bundled snapshot · captured|Cached copy · .* old/);
  await expect(page.getByRole('banner').getByTestId('space-weather-badge')).not.toHaveText(/LIVE/);

  // 4. every other core route as a hard load (deep link answered by navigateFallback = the base's index.html)
  for (const r of ROUTES) {
    await page.goto(base + r.path);
    await expect(h1(page, r.h1), r.path).toBeVisible({ timeout: 20_000 });
  }

  // 5. Body loads its GLB from the service-worker cache (3D in headless SwiftShader, or the 2D fallback)
  await page.goto(`${base}body/c4`);
  await expect(h1(page, 'L. Duarte')).toBeVisible();
  await expect
    .poll(() => [...swServed.keys()].filter((u) => /anatomy\/(male|female)\.glb$/.test(u)).length, {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);

  // 6. Handbook entry markdown + index from the cache
  const hb = [...swServed.keys()].filter((u) => /seed\/handbook\//.test(u)).map((u) => u.split('/').pop());
  expect(hb, 'handbook files fetched offline').toEqual(expect.arrayContaining(['index.json', 'sleep.md']));

  // 7. Lab camera: MediaPipe wasm + face model load offline and the landmarker starts
  await page.goto(`${base}lab/camera?debug=rppg`);
  await expect(h1(page, 'Camera pulse')).toBeVisible();
  await page.getByRole('button', { name: /^L\. Duarte/ }).click(); // the CMO picks who is measured
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Start 30-second measurement/ }).click();
  await expect(page.getByTestId('rppg-debug')).toContainText(/(GPU|CPU) \/ worker/, { timeout: 60_000 });
  expect([...swServed.keys()].some((u) => /face_landmarker\.task$/.test(u))).toBe(true);
  expect([...swServed.keys()].some((u) => /vision_wasm_internal\.wasm$/.test(u))).toBe(true);

  // 8. everything listed above came from the service worker; all URLs stay under the base
  const notFromSw = [...swServed].filter(([, sw]) => !sw).map(([u]) => u);
  expect(notFromSw, 'assets fetched offline without the service worker').toEqual([]);
  expect([...swServed.keys()].every((u) => u.startsWith(new URL(base, baseURL).href))).toBe(true);
  console.log(`[offline] base ${base}: ${swServed.size} cached assets served by the SW: ${[...swServed.keys()]
    .map((u) => u.split('/').pop())
    .join(', ')}`);

  await context.setOffline(false);
  expect(noaaOffline, 'no NOAA request while offline').toEqual([]);
  // The only allowed problem: the NOAA request this test aborts while ONLINE (hermetic); never one while offline.
  expect(problems().filter((p) => !NOAA_PROBLEM.test(p))).toEqual([]);
});
