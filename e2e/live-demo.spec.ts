// Demo-critical checks of docs/14_QA_AND_VERIFICATION.md §3 against the DEPLOYED site (production build, no access
// to source modules). Run with playwright.live.config.ts; skipped everywhere else.
//   ARGUS_E2E_PROD=1 npx playwright test -c playwright.live.config.ts
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.skip(process.env.ARGUS_E2E_LIVE !== '1', 'runs only against the deployed site (playwright.live.config.ts)');
test.describe.configure({ timeout: 180_000 });
const SLOW = { timeout: 30_000 };
const BASE = '/argus-crew-health/';

async function signIn(page: Page, who: 'CMO' | 'K. Osei') {
  await page.goto(BASE);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose who you are' })).toBeVisible(SLOW);
  await page.getByRole('radio', { name: who === 'CMO' ? /^CMO/ : /^K\. Osei/ }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: `Sign in as ${who}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible(SLOW);
  await expect(page.getByTestId('hero')).toBeVisible(SLOW);
}

test('live 1–4: Bridge context, K. Osei ACT caught only by personal, Body heart, lenses', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await signIn(page, 'CMO');
  await expect(page.getByTestId('bridge-context')).toContainText('Mars transit');
  await expect(page.getByTestId('mission-chip')).toContainText('MD 143');
  await expect(page.getByTestId('earth-delay')).toContainText('modeled delay (demo)');
  await expect(page.getByTestId('simulated-badge')).toHaveText(/simulated data/i);
  const osei = page.getByTestId('crew-row-c3');
  await expect(osei).toHaveAttribute('data-verdict', 'ACT', SLOW);
  await expect(osei).toContainText('Caught only by personal baseline');
  await osei.getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'K. Osei' })).toBeVisible(SLOW);
  const heart = page.locator('[data-region="heart"]');
  await expect(heart).toHaveAttribute('data-verdict', 'ACT', SLOW);
  const lens = page.getByRole('radiogroup', { name: 'Layer lens' });
  for (const [name, verdict] of [
    ['Earth', 'NOMINAL'],
    ['Space', 'NOMINAL'],
    ['Personal', 'ACT'],
  ] as const) {
    await lens.getByRole('radio', { name }).click();
    await expect(heart).toHaveAttribute('data-verdict', verdict, SLOW);
  }
  expect(errors).toEqual([]);
});

test('live 5: Environment replay reaches S2 with the shelter advisory, labeled REPLAY and synthetic', async ({ page }) => {
  await signIn(page, 'CMO');
  await page.goto(`${BASE}environment?replaySpeed=3600`);
  await expect(page.getByRole('heading', { name: 'Radiation & cabin' })).toBeVisible(SLOW);
  await expect(page.getByTestId('dose-projected-c1')).toContainText('498.0', SLOW);
  await page.getByRole('button', { name: 'Replay SPE' }).click();
  await expect(page.getByTestId('s-level')).toHaveText('S2', { timeout: 60_000 });
  const banner = page.getByTestId('shelter-banner');
  await expect(banner).toContainText('Shelter advised.');
  await expect(banner).toContainText("Real shelter calls come from the mission's radiation specialists.");
  await expect(page.getByTestId('flux-chart')).toContainText('synthetic');
  await expect(page.getByTestId('flux-chart')).toContainText('not a recorded event');
  await expect(page.getByTestId('dose-ledger')).toContainText('Modeled — illustrative');
  await page.getByRole('button', { name: 'Stop replay' }).click();
});

test('live 7–8: Earth link packet arrives after the modeled delay; FHIR export parses', async ({ page }) => {
  await signIn(page, 'CMO');
  await page.goto(`${BASE}earth?crew=c3&flags=1`);
  await expect(page.getByTestId('flag-c3-heart_rate_rest')).toBeVisible(SLOW);
  await page.getByTestId('send-packet').click();
  const card = page.getByTestId('packet-card').first();
  await expect(card.getByTestId('packet-arrival')).toHaveText('arrives in 11 min (demo: 11 s)');
  await expect(card.getByTestId('packet-delivered')).toBeVisible({ timeout: 40_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-fhir').click()]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { resourceType: string; entry: unknown[] };
  expect(bundle.resourceType).toBe('Bundle');
  expect(bundle.entry.length).toBeGreaterThan(4);
});

test('live Lab: Vision check and Face fluid-shift scan are live flows; only device import is "Coming next"', async ({ page }) => {
  await signIn(page, 'K. Osei');
  await page.goto(`${BASE}lab`);
  await expect(page.getByRole('heading', { level: 1, name: 'Measurement Lab' })).toBeVisible(SLOW);
  await expect(page.getByText('Coming next')).toHaveCount(1);
  await page.goto(`${BASE}lab/vision`);
  await expect(page.getByRole('heading', { level: 1, name: 'Vision check' })).toBeVisible(SLOW);
  await expect(page.getByText('Screening only — not a diagnosis.').first()).toBeVisible();
  await page.goto(`${BASE}lab/face`);
  await expect(page.getByRole('heading', { level: 1, name: 'Face fluid-shift scan' })).toBeVisible(SLOW);
  await expect(page.getByText('Experimental — not validated').first()).toBeVisible();
});
