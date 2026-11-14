/// <reference lib="dom" />
// Keyboard (doc 11 §8): keyboard-only smoke of four flows — quick check-in on the Bridge, the
// Reaction Self-Test started and answered with Space, a protocol run to the end with Enter/Space, and the mission
// scrubber with ←/→ and Shift+←/→. No mouse: focus moves with Tab only; every focused control shows a focus ring.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { collectErrors, signInAs } from './helpers';
import { hasFocusRing, setPrefs, tabTo } from './helpers.prefs';

const NOAA = /^https:\/\/services\.swpc\.noaa\.gov\//;
const appErrors = (errors: string[]) => errors.filter((e) => !/swpc\.noaa\.gov|net::ERR_FAILED/.test(e));

async function ready(page: Page, path: string, h1: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('data-boot-loading')).toHaveCount(0, { timeout: 30_000 });
}

test.beforeEach(async ({ page, context }) => {
  await context.route(NOAA, (r) => r.abort());
  await setPrefs(page, 'dark');
});

test('quick check-in on the Bridge with the keyboard only', async ({ page }) => {
  const errors = collectErrors(page);
  await signInAs(page, 'crew', 'c3');
  await ready(page, '/', 'Mission Bridge');

  const mood = page.locator('input[type="radio"][name^="qc-mood-"]');
  await expect(mood.first()).toBeAttached({ timeout: 20_000 });
  await tabTo(page, mood.first());
  await page.keyboard.press('ArrowRight'); // arrow keys move and select inside the radio group
  await expect(mood.nth(1)).toBeChecked();
  await expect(mood.nth(1)).toBeFocused();

  const sleep = page.locator('input[id^="qc-sleep-"]');
  await tabTo(page, sleep);
  await page.keyboard.type('7.5');
  const none = page.locator('#symptom-none');
  await tabTo(page, none);
  await page.keyboard.press('Space');
  await expect(none).toBeChecked();

  const save = page.getByRole('button', { name: 'Save', exact: true }).first();
  await tabTo(page, save);
  expect(await hasFocusRing(page)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Saved/).first()).toBeVisible({ timeout: 10_000 });
  expect(appErrors(errors)).toEqual([]);
});

test('Reaction Self-Test: start with Space, respond to a stimulus with Space, stop with Esc', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await signInAs(page, 'crew', 'c3');
  await ready(page, '/lab/pvt', 'Reaction Self-Test');

  const start = page.getByRole('button', { name: 'Start 3-minute test' });
  await tabTo(page, start);
  expect(await hasFocusRing(page)).toBe(true);
  await page.keyboard.press('Space');
  const dialog = page.getByRole('dialog', { name: 'Reaction Self-Test' });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('pvt-target')).toBeFocused();
  // first stimulus arrives after a random 2–10 s interval
  await expect(page.getByTestId('pvt-stimulus')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Space');
  await expect(page.getByTestId('pvt-stimulus')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  expect(appErrors(errors)).toEqual([]);
});

test('protocol run: /handbook/suspected-infection to the last step with Enter / Space', async ({ page }) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await ready(page, '/handbook/suspected-infection', 'Suspected infection');
  const step = page.getByTestId('protocol-step');
  await expect(step).toHaveAttribute('data-step', 's1');
  for (const [i, id] of ['s1', 's2', 's3', 's4', 's5'].entries()) {
    await expect(step).toHaveAttribute('data-step', id);
    await page.keyboard.press(i % 2 === 0 ? 'Enter' : 'Space');
  }
  await expect(step).toHaveAttribute('data-step', 's6');
  await expect(step.getByTestId('step-counter')).toHaveText('Step 6 of 6');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('protocol-complete')).toBeVisible();
  expect(appErrors(errors)).toEqual([]);
});

test('mission scrubber: ←/→ move one day, Shift+←/→ one week', async ({ page }) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await ready(page, '/', 'Mission Bridge');
  const slider = page.getByRole('slider', { name: 'Mission day' });
  await tabTo(page, slider, 150);
  expect(await hasFocusRing(page)).toBe(true);
  const day = async () => Number(await slider.getAttribute('aria-valuenow'));
  const today = await day();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(day).toBe(today - 1);
  await page.keyboard.press('Shift+ArrowLeft');
  await expect.poll(day).toBe(today - 8);
  await page.keyboard.press('ArrowRight');
  await expect.poll(day).toBe(today - 7);
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(day).toBe(today);
  await expect(slider).toHaveAttribute('aria-valuetext', /today/);
  expect(appErrors(errors)).toEqual([]);
});
