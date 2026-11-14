// Smoke: the camera-pulse flow end to end in Chromium with the built-in fake camera (a synthetic test
// pattern, no face). Checks that MediaPipe loads from the same origin only, the worker runs, the flow reaches a
// result honestly (no face → no pulse / poor quality), nothing leaves the origin, and axe finds no serious issues.
// Run with E2E_PORT=5188 (own dev server) when the default port is in use.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { collectErrors, runAxe, smallTargets } from './helpers';

test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

/**
 * Open `path` signed out: the shell redirects to the role picker once, we sign in as crew member K. Osei (demo PIN
 * 2026) and land back on `path` (query string included).
 */
async function signInThroughPicker(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole('radio', { name: /^K\. Osei/ }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: 'Sign in as K. Osei' }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[?.]/g, '\\$&')}$`));
}

// MediaPipe (WASM + model, self-hosted) compiles in a fresh browser process on first use; with SwiftShader and
// several workers on a loaded machine that took > 30 s (the first batch of workers failed, the warm ones
// passed in 17–36 s). The waits below are for that load, not sleeps.
const MEDIAPIPE_READY = { timeout: 75_000 };

test('camera pulse flow runs with a fake camera, same-origin assets only', async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  const foreign: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(baseURL ?? '') && !url.startsWith('data:') && !url.startsWith('blob:')) foreign.push(url);
  });

  await signInThroughPicker(page, '/lab/camera?debug=rppg');
  await expect(page.getByRole('heading', { level: 1, name: 'Camera pulse' })).toBeVisible();
  await expect(page.getByText('Measuring: K. Osei')).toBeVisible();
  // focused-flow bar replaces the main navigation
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exit' })).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Start 30-second measurement/ }).click();
  await expect(page.getByText('Video stays on this device. Only the number is saved.')).toBeVisible();
  const debug = page.getByTestId('rppg-debug');
  await expect(debug).toBeVisible();
  // Live phase reached (camera open, tracker loaded), then the first processed frame reports delegate + engine.
  // Timer first: on a starved machine the first frame can arrive late in the 30-s window.
  await expect(page.getByRole('timer')).toBeVisible(MEDIAPIPE_READY);
  await expect(debug).toContainText(/(GPU|CPU) \/ worker/, MEDIAPIPE_READY);
  await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible({ timeout: 60_000 });
  // The fake camera shows no face: the result must say so, and Save must be off.
  await expect(page.getByText('Poor quality')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.getByText('How quality is judged').click();
  const axe = await runAxe(page);
  console.log(`[axe] /lab/camera result: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);

  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

test('axe: /lab/camera has no serious or critical issues (explainer, how-to, live)', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await signInThroughPicker(page, '/lab/camera');
  await expect(page.getByRole('heading', { level: 1, name: 'Camera pulse' })).toBeVisible();
  const check = async (step: string) => {
    const axe = await runAxe(page);
    console.log(`[axe] ${info.project.name} /lab/camera ${step}: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`);
    expect(axe.seriousOrCritical).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
  };
  await check('explainer');
  await page.getByRole('button', { name: 'Continue' }).click();
  await check('how-to');
  // Cancel first: the live view lasts 30 s, and a slow axe pass on a loaded machine used to outlast it.
  await page.getByRole('button', { name: /Start 30-second measurement/ }).click();
  await expect(page.getByRole('timer')).toBeVisible(MEDIAPIPE_READY);
  await page.getByRole('button', { name: 'Cancel measurement' }).click();
  await expect(page.getByRole('heading', { name: 'How to measure' })).toBeVisible();
  await page.getByRole('button', { name: /Start 30-second measurement/ }).click();
  await expect(page.getByRole('timer')).toBeVisible(MEDIAPIPE_READY);
  await expect(page.getByRole('button', { name: 'Cancel measurement' })).toBeVisible();
  await check('live');
  expect(errors).toEqual([]);
});
