/// <reference lib="dom" />
// Limits page, Settings demo controls (scenario picker), reset demo, axe.
import { expect, test } from '@playwright/test';

import { collectErrors, runAxe, signInAs, smallTargets } from './helpers';

test('/limits shows the data-kind table and the not-a-medical-device statement', async ({ page }, info) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await page.goto('/limits');
  await expect(page.getByRole('heading', { level: 1, name: 'Limits' })).toBeVisible();
  await expect(page.getByTestId('limits-table')).toBeVisible();
  await expect(page.getByTestId('limits-table').getByRole('row')).toHaveCount(22); // header + 21 rows
  await expect(page.getByTestId('not-medical-device')).toContainText(
    'not a diagnostic or certified medical device',
  );
  await expect(page.getByTestId('rppg-placeholder')).toHaveText(
    'No paired validation against a reference device has been done yet.',
  );
  await expect(page.getByText('SIMULATED DATA').first()).toBeVisible();
  const axe = await runAxe(page);
  console.log(`[axe] ${info.project.name} /limits: ${JSON.stringify(axe.byImpact)} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Settings ?demo=1: Silent infection jumps to MD 143 and selects K. Osei; reset demo works', async ({
  page,
}, info) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await page.goto('/settings?demo=1');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByTestId('demo-controls')).toBeVisible();

  const axe = await runAxe(page);
  console.log(
    `[axe] ${info.project.name} /settings?demo=1: ${JSON.stringify(axe.byImpact)} ${axe.ids.join(' ')}`,
  );
  expect(axe.seriousOrCritical).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);

  // Move away from the scenario day first, so the jump is visible.
  await page.getByTestId('day-input').fill('100');
  await page.getByRole('button', { name: 'Go' }).click();
  await expect(page.getByTestId('mission-chip')).toContainText('MD 100');

  await page.getByRole('button', { name: /Jump to scenario: Silent infection/ }).click();
  await expect(page.getByTestId('mission-chip')).toContainText('MD 143');
  await expect(page.getByTestId('demo-selected-crew')).toHaveText('K. Osei');
  await expect(page.getByTestId('scenario-result')).toContainText('K. Osei selected');

  await page.getByTestId('day-input').fill('120');
  await page.getByRole('button', { name: 'Go' }).click();
  await expect(page.getByTestId('mission-chip')).toContainText('MD 120');
  await page.getByTestId('reset-demo').click();
  const dialog = page.getByRole('dialog', { name: 'Reset the demo?' });
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('reset-confirm').click();
  await expect(page.getByText('Demo reset')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('mission-chip')).toContainText('MD 143');
  expect(errors).toEqual([]);
});
