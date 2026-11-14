// The app as GitHub Pages serves it — under /argus-crew-health/, unknown paths answered by 404.html.
// Run with: E2E_PORT=5197 npx playwright test -c playwright.subpath.config.ts
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

import { signInAs } from './helpers';

const PREFIX = '/argus-crew-health/';

// Chromium's fake camera (as e2e/camera-pulse.spec.ts); file-level because launchOptions force a new worker.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const NAV: Array<{ label: string; path: string; h1: string }> = [
  // Body page: h1 = the subject's name; /body as the CMO opens the CMO's own record (c4, L. Duarte).
  { label: 'Body', path: 'body', h1: 'L. Duarte' },
  { label: 'Trends', path: 'trends', h1: 'Trends' },
  { label: 'Lab', path: 'lab', h1: 'Measurement Lab' },
  { label: 'Environment', path: 'environment', h1: 'Radiation & cabin' },
  { label: 'Crew', path: 'crew', h1: 'Crew overview' },
  { label: 'Earth', path: 'earth', h1: 'Earth link' },
  { label: 'Handbook', path: 'handbook', h1: 'Handbook' },
  { label: 'Bridge', path: '', h1: 'Mission Bridge' },
];

/** Every same-origin request (page and service worker) whose path is outside the prefix. */
function collectOutsidePrefix(context: BrowserContext, origin: string): string[] {
  const outside: string[] = [];
  context.on('request', (req) => {
    const url = req.url();
    if (url.startsWith(origin) && !url.startsWith(origin + PREFIX)) outside.push(url);
  });
  return outside;
}

/**
 * Console errors and page errors, minus the one Chromium logs for a document answered by the Pages 404.html
 * fallback ("Failed to load resource: … 404" on the navigated deep link itself) — that 404 is how GitHub Pages
 * serves SPA deep links. Any other failed response (status ≥ 400) is reported as an error.
 */
function collectErrors(page: Page): () => string[] {
  const raw: Array<{ text: string; url: string }> = [];
  const fallbackDocs = new Set<string>();
  const badResponses: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') raw.push({ text: msg.text(), url: msg.location().url });
  });
  page.on('pageerror', (err) => raw.push({ text: err.message, url: '' }));
  page.on('response', (r) => {
    if (r.status() < 400) return;
    if (r.status() === 404 && r.request().resourceType() === 'document') fallbackDocs.add(r.url());
    else badResponses.push(`${r.status()} ${r.url()}`);
  });
  return () => [
    ...raw
      .filter((e) => !(fallbackDocs.has(e.url) && /status of 404/.test(e.text)))
      .map((e) => `${e.text}${e.url ? ` @ ${e.url}` : ''}`),
    ...badResponses,
  ];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** URL matcher for a route under the prefix. The router writes the root as `/argus-crew-health` (no slash). */
const at = (path: string) =>
  new RegExp(path ? `^[^?#]*${escape(PREFIX + path)}$` : `^[^?#]*${escape(PREFIX.slice(0, -1))}/?$`);

async function signInWithPin(page: Page, role: 'CMO' | 'K. Osei') {
  if (role === 'CMO') await page.getByRole('radio', { name: /^CMO/ }).check();
  else await page.getByRole('radio', { name: /^K\. Osei/ }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: `Sign in as ${role}` }).click();
}

test('root loads under the prefix, PIN sign-in works, client navigation reaches every nav route', async ({
  page,
  context,
  baseURL,
}) => {
  const errors = collectErrors(page);
  const outside = collectOutsidePrefix(context, baseURL ?? '');

  await page.goto(PREFIX);
  await expect(page).toHaveURL(at('sign-in'));
  await expect(page.getByRole('heading', { level: 1, name: 'Choose who you are' })).toBeVisible();
  await signInWithPin(page, 'CMO');
  await expect(page).toHaveURL(at(''));
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const item of NAV) {
    const link = nav.getByRole('link', { name: item.label, exact: true });
    await expect(link).toHaveAttribute('href', item.path ? PREFIX + item.path : PREFIX.slice(0, -1));
    await link.click();
    await expect(page).toHaveURL(at(item.path));
    await expect(page.getByRole('heading', { level: 1, name: item.h1 })).toBeVisible();
  }

  expect(outside).toEqual([]);
  expect(errors()).toEqual([]);
});

test('unsigned deep link goes to sign-in under the prefix and back to the requested route', async ({
  page,
  context,
  baseURL,
}) => {
  const errors = collectErrors(page);
  const outside = collectOutsidePrefix(context, baseURL ?? '');
  const res = await page.goto(`${PREFIX}environment`);
  expect(res?.status()).toBe(404); // served by the 404.html fallback, as on GitHub Pages
  await expect(page).toHaveURL(at('sign-in'));
  await signInWithPin(page, 'K. Osei');
  await expect(page).toHaveURL(at('environment'));
  await expect(page.getByRole('heading', { level: 1, name: 'Radiation & cabin' })).toBeVisible();
  expect(outside).toEqual([]);
  expect(errors()).toEqual([]);
});

for (const deep of [
  { path: 'lab/camera', h1: 'Camera pulse' },
  { path: 'environment', h1: 'Radiation & cabin' },
]) {
  test(`hard load and reload of ${PREFIX}${deep.path} render the app via the 404 fallback`, async ({
    page,
    context,
    baseURL,
  }) => {
    const errors = collectErrors(page);
    const outside = collectOutsidePrefix(context, baseURL ?? '');
    await signInAs(page, 'cmo');
    const res = await page.goto(PREFIX + deep.path);
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: deep.h1 })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(at(deep.path));
    await expect(page.getByRole('heading', { level: 1, name: deep.h1 })).toBeVisible();
    expect(outside).toEqual([]);
    expect(errors()).toEqual([]);
  });
}

test.describe('camera', () => {
  test('MediaPipe wasm and face model load under the prefix with 200', async ({ page, context, baseURL }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    const outside = collectOutsidePrefix(context, baseURL ?? '');
    const assets = new Map<string, number>();
    page.on('response', (r) => {
      const url = r.url();
      if (/vision_wasm_internal\.(wasm|js)$|face_landmarker\.task$/.test(url)) assets.set(url, r.status());
    });

    await signInAs(page, 'crew', 'c3');
    await page.goto(`${PREFIX}lab/camera?debug=rppg`);
    await expect(page.getByRole('heading', { level: 1, name: 'Camera pulse' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /Start 30-second measurement/ }).click();
    await expect(page.getByTestId('rppg-debug')).toContainText(/(GPU|CPU) \/ worker/, { timeout: 45_000 });

    const origin = baseURL ?? '';
    for (const file of ['vision_wasm_internal.wasm', 'vision_wasm_internal.js', 'face_landmarker.task']) {
      const url = `${origin}${PREFIX}mediapipe/${file}`;
      expect(assets.get(url), `${file} requested under the prefix`).toBe(200);
    }
    expect([...assets.keys()].every((u) => u.startsWith(origin + PREFIX))).toBe(true);
    expect(outside).toEqual([]);
    expect(errors()).toEqual([]);
  });
});

test('service worker registers with the prefix scope; offline reload renders the shell', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  const outside = collectOutsidePrefix(context, baseURL ?? '');
  await signInAs(page, 'cmo');
  await page.goto(PREFIX);
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();

  // `ready` resolves once the worker is active, i.e. after the precache (incl. the MediaPipe files) installed.
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(`${baseURL}${PREFIX}`);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const failed: string[] = [];
  context.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();
  await expect(page.getByTestId('online-status')).toHaveText(/offline/i);
  // A deep link offline is answered by the service worker's navigateFallback (the base's index.html).
  await page.goto(`${PREFIX}environment`);
  await expect(page.getByRole('heading', { level: 1, name: 'Radiation & cabin' })).toBeVisible();
  await context.setOffline(false);
  expect(failed, 'nothing needed the network while offline').toEqual([]);

  expect(outside).toEqual([]);
  expect(errors()).toEqual([]);
});
