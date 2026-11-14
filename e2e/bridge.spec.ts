/// <reference lib="dom" />
// Mission Bridge smoke (doc 14 §3 step 1). Sign-in goes through /sign-in directly; the
// unsigned deep-link redirect is covered by e2e/smoke.spec.ts.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { collectErrors, runAxe, smallTargets } from './helpers';

async function signIn(page: Page, who: 'CMO' | 'K. Osei') {
  await page.goto('/sign-in');
  if (who === 'CMO') {
    await page.getByRole('radio', { name: /^CMO/ }).check();
  } else {
    await page.getByRole('radio', { name: /^Crew member/ }).check();
    await page.getByRole('radio', { name: /^K\. Osei/ }).check();
  }
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: `Sign in as ${who}` }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();
  await expect(page.getByTestId('hero')).toBeVisible({ timeout: 20_000 });
}

test('CMO on Mars transit day 143: context, K. Osei Act caught only by personal, scrub back, open body', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await signIn(page, 'CMO');

  await expect(page.getByTestId('bridge-context')).toContainText('Mars transit');
  await expect(page.getByTestId('mission-chip')).toContainText('MD 143');
  const delay = page.getByTestId('earth-delay');
  await expect(delay).toContainText('11');
  await expect(delay).toContainText('min');
  await expect(delay).toContainText('modeled delay (demo)');
  await expect(page.getByTestId('simulated-badge')).toBeVisible();

  // Three-layer idea + headline counter
  await expect(page.getByTestId('layer-counters')).toContainText('Personal · Space · Earth');
  await expect(page.getByTestId('caught-only-counter')).toContainText('2');

  const osei = page.getByTestId('crew-row-c3');
  await expect(osei).toHaveAttribute('data-verdict', 'ACT');
  await expect(osei).toContainText('K. Osei');
  await expect(osei).toContainText('Act');
  await expect(osei).toContainText('Caught only by personal baseline');
  // sorted by severity: K. Osei first
  await expect(page.getByTestId('crew-at-a-glance').getByRole('listitem').first()).toHaveAttribute(
    'data-testid',
    'crew-row-c3',
  );

  // Scrub back with the keyboard: 142 and 141 Watch, 140 Nominal (no Act)
  const slider = page.getByRole('slider', { name: 'Mission day' });
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('mission-chip')).toContainText('MD 142');
  await expect(osei).toHaveAttribute('data-verdict', 'WATCH');
  await page.keyboard.press('ArrowLeft');
  await expect(osei).toHaveAttribute('data-verdict', 'WATCH');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('mission-chip')).toContainText('MD 140');
  await expect(osei).not.toHaveAttribute('data-verdict', 'ACT');
  await expect(osei).not.toHaveAttribute('data-verdict', 'WATCH');
  await expect(osei).not.toContainText('Caught only by personal baseline');
  await expect(page.locator('[data-testid^="crew-row-"][data-verdict="ACT"]')).toHaveCount(0);

  // Back to today, then open K. Osei's body view
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(osei).toHaveAttribute('data-verdict', 'ACT');
  await osei.getByRole('link').click();
  await expect(page).toHaveURL(/\/body\/c3$/);

  expect(errors).toEqual([]);
});

test('crew member K. Osei sees only her own data', async ({ page }) => {
  const errors = collectErrors(page);
  await signIn(page, 'K. Osei');
  await expect(page.getByRole('heading', { level: 2, name: /K\. Osei — your status today/ })).toBeVisible();
  await expect(page.getByTestId('hero')).toHaveAttribute('data-verdict', 'ACT');
  await expect(page.getByTestId('hero-summary')).toContainText('Resting heart rate needs action now');
  await expect(page.getByTestId('readiness-ring')).toHaveAttribute('data-score', '65');
  await expect(page.getByTestId('crew-at-a-glance')).toHaveCount(0);
  await expect(page.getByText('M. Ito')).toHaveCount(0);
  await expect(page.getByText('R. Vance')).toHaveCount(0);
  await expect(page.getByTestId('plan-row-reaction_test')).toHaveAttribute('data-status', 'due');
  await expect(page.getByRole('link', { name: /Start: Measure reaction self-test/ })).toHaveAttribute(
    'href',
    '/lab/pvt',
  );
  expect(errors).toEqual([]);
});

for (const theme of ['dark', 'light', 'hc'] as const)
  test(`axe on / (CMO, ${theme}): 0 serious or critical, targets ≥ 44 px`, async ({ page }, info) => {
    const errors = collectErrors(page);
    await page.addInitScript(
      (t) =>
        localStorage.setItem(
          'argus.ui',
          JSON.stringify({
            state: {
              theme: t,
              gloveMode: false,
              reducedMotion: true,
              units: { temp: 'Cel', glucose: 'mg/dL' },
            },
            version: 1,
          }),
        ),
      theme,
    );
    await signIn(page, 'CMO');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByTestId('crew-row-c3')).toBeVisible();
    await expect(page.getByTestId('points-line')).toBeVisible();
    const axe = await runAxe(page);
    console.log(
      `[axe] ${info.project.name} bridge / ${theme}: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`,
    );
    expect(axe.seriousOrCritical).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
