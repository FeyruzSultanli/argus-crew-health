import { expect, test } from '@playwright/test';

import { collectErrors, signInAs } from './helpers';

const NAV = ['Bridge', 'Body', 'Trends', 'Lab', 'Environment', 'Crew', 'Earth', 'Handbook'];

test('sign-in with the demo PIN leads to the Bridge', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/environment');
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole('radio', { name: /^K\. Osei/ }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: 'Sign in as K. Osei' }).click();
  await expect(page).toHaveURL(/\/environment$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Radiation & cabin' })).toBeVisible();
  expect(errors).toEqual([]);
});

// Regression: an unsigned deep link used to loop <Navigate> → "Maximum update depth exceeded" while the lazy
// sign-in chunk was still loading (seen with parallel workers). The chunk is delayed here so the window is wide on
// every run; each route is its own test, so they run on the default parallel workers.
for (const deep of [
  { path: '/environment', h1: 'Radiation & cabin' },
  { path: '/lab', h1: 'Measurement Lab' },
  // /lab/pvt is the Reaction Self-Test flow, not the hub: its own h1.
  { path: '/lab/pvt', h1: 'Reaction Self-Test' },
]) {
  test(`unsigned deep link ${deep.path} redirects to sign-in once and returns after sign-in`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.route(/\/src\/features\/auth\/SignInPage\.tsx/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(deep.path);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Choose who you are' })).toBeVisible();
    await page.getByRole('radio', { name: /^CMO/ }).check();
    await page.getByLabel('Demo PIN').fill('2026');
    await page.getByRole('button', { name: 'Sign in as CMO' }).click();
    await expect(page).toHaveURL(new RegExp(`${deep.path}$`));
    await expect(page.getByRole('heading', { level: 1, name: deep.h1 })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('shell renders with brand, main nav, badges, mission chip and the Bridge placeholder', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toBeVisible();
  for (const label of NAV) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();
  await expect(page.getByTestId('simulated-badge')).toBeVisible();
  // The mode depends on the network at run time: LIVE when the NOAA fetch succeeds, otherwise CACHED or SNAPSHOT.
  await expect(page.getByTestId('space-weather-badge')).toHaveText(/LIVE|CACHED|SNAPSHOT/);
  await expect(page.getByTestId('online-status')).toHaveText(/online/i);
  await expect(page.getByTestId('mission-chip')).toContainText('MD 143');
  await expect(page.getByTestId('mission-scrubber')).toBeVisible();

  await nav.getByRole('link', { name: 'Environment', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Radiation & cabin' })).toBeVisible();
  await expect(page).toHaveURL(/\/environment$/);
  await expect(page.getByTestId('mission-scrubber')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('deep links render their placeholder page', async ({ page }) => {
  await signInAs(page, 'cmo');
  await page.goto('/lab/import');
  await expect(page.getByRole('heading', { level: 1, name: 'Measurement Lab' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Device import — coming next' })).toBeVisible();
});

test('offline dot follows the network state', async ({ page, context }) => {
  await signInAs(page, 'cmo');
  await page.goto('/');
  // Wait for the lazy Bridge chunk before cutting the network, otherwise the route import itself fails.
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByTestId('online-status')).toHaveText(/offline/i);
  await context.setOffline(false);
  await expect(page.getByTestId('online-status')).toHaveText(/online/i);
});

test('mission chip opens the profile picker; switching profile changes day and delay', async ({ page }) => {
  await signInAs(page, 'cmo');
  await page.goto('/');
  await page.getByTestId('mission-chip').click();
  const dialog = page.getByRole('dialog', { name: 'Mission profile' });
  await expect(dialog).toBeVisible();
  // Mars transit (table) and Mars surface (fixed 12 min demo value) are both modeled delays.
  await expect(dialog.getByText('modeled delay (demo)')).toHaveCount(2);
  await expect(dialog.getByText('modeled delay (demo)').first()).toBeVisible();
  await expect(dialog.getByText(/do not occur/)).toBeVisible();
  await dialog.getByRole('button', { name: /International Space Station/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('mission-chip')).toContainText('ISS');
  await expect(page.getByTestId('mission-chip')).toContainText('MD 90');
});
