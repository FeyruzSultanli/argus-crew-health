// Smoke: the face fluid-shift scan in Chromium with the built-in fake camera (a synthetic test pattern, no
// face). Covers explainer → how-to → live view (MediaPipe from the same origin, ?debug=face panel) → "no face found"
// → poor quality → Save disabled; no console errors, same-origin requests only, axe 0 serious/critical on every
// step. The numbers path (reference + second scan) is covered by src/features/lab/face/FaceScanRoute.test.tsx.
// Run: E2E_PORT=5177 npx playwright test e2e/face-scan.spec.ts --workers=2
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { collectErrors, runAxe, smallTargets } from './helpers';

test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const MEDIAPIPE_READY = { timeout: 75_000 };

async function signInThroughPicker(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole('radio', { name: /^K\. Osei/ }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: 'Sign in as K. Osei' }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[?.]/g, '\\$&')}$`));
}

async function axeCheck(page: Page, info: TestInfo, step: string) {
  const axe = await runAxe(page);
  console.log(`[axe] ${info.project.name} /lab/face ${step}: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
}

test('face scan with a fake camera: no face → poor, Save off; same origin only; axe clean', async ({ page, baseURL }, info) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  const foreign: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(baseURL ?? '') && !url.startsWith('data:') && !url.startsWith('blob:')) foreign.push(url);
  });

  await signInThroughPicker(page, '/lab/face?debug=face');
  await expect(page.getByRole('heading', { level: 1, name: 'Face fluid-shift scan' })).toBeVisible();
  await expect(page.getByText('Measuring: K. Osei')).toBeVisible();
  await expect(page.getByText('Experimental — not validated').first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await axeCheck(page, info, 'explainer');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'How to scan' })).toBeVisible();
  await expect(page.getByText('No pre-flight scan exists in this demo. Your first scan is the reference; later scans are compared with it.').first()).toBeVisible();
  await axeCheck(page, info, 'how-to');

  await page.getByRole('button', { name: /Start 3-second scan/ }).click();
  await expect(page.getByText('Video stays on this device. Only the number is saved.')).toBeVisible();
  await expect(page.getByTestId('face-debug')).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible(MEDIAPIPE_READY);
  // Hold the live view still for the axe pass: a paused video delivers no new frames, so the 3-s window does not
  // advance (the session's watchdog ends it later with what it has).
  await page.evaluate(() => document.querySelector('video')?.pause());
  await expect(page.getByTestId('face-indicators')).toBeVisible();
  await axeCheck(page, info, 'live');
  await page.evaluate(() => void document.querySelector('video')?.play());

  await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Poor quality')).toBeVisible();
  await expect(page.getByTestId('fs-reasons')).toContainText('no face found');
  await expect(page.getByRole('button', { name: 'Save as reference scan' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save as poor quality' })).toHaveCount(0);
  // camera released
  expect(await page.evaluate(() => (document.querySelector('video') as HTMLVideoElement | null)?.srcObject ?? null)).toBeNull();
  await axeCheck(page, info, 'result');

  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

test('Lab hub: the face tile is live and experimental', async ({ page }) => {
  const errors = collectErrors(page);
  await signInThroughPicker(page, '/lab');
  const tile = page.getByTestId('lab-tile-face');
  await expect(tile).toContainText('Experimental — not validated');
  await expect(tile).not.toContainText('Coming next');
  await tile.getByRole('link', { name: 'Start Face fluid-shift scan' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Face fluid-shift scan' })).toBeVisible();
  expect(errors).toEqual([]);
});
