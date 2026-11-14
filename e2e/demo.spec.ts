/// <reference lib="dom" />
// The demo-critical checks of docs/14_QA_AND_VERIFICATION.md §3 against the whole app with the real
// seeded record (fresh browser context → boot seeding → Mars transit day 143), no fixtures. Desktop only.
// Items 5, 7, 8 and 9 are covered by their own spec files (environment, earthlink, offline): fixme stubs here.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { collectErrors } from './helpers';

const DESKTOP_ONLY = 'demo checks run once (desktop project)';
// The 3D body page is CPU-heavy on SwiftShader when the suite runs in parallel.
test.describe.configure({ timeout: 120_000 });
const SLOW = { timeout: 20_000 };

/** The slice of src/services/healthService.ts read here (loaded from the dev server inside the page). */
interface AssessSvc {
  healthService: {
    assess(
      crewId: string,
      day: number,
    ): Promise<Array<{ signalId: string; verdict: string; action: { kind: string; text: string } }>>;
  };
}
const SVC_PATH = '/src/services/healthService.ts';

/** The domain's assessment of one signal, read through the app's own service (for verbatim text checks). */
async function domainAssessment(page: Page, crewId: string, day: number, signalId: string) {
  const all = await page.evaluate(
    async ([path, c, d]) => {
      const svc = (await import(/* @vite-ignore */ path)) as AssessSvc;
      return svc.healthService.assess(c, d);
    },
    [SVC_PATH, crewId, day] as [string, string, number],
  );
  const a = all.find((x) => x.signalId === signalId);
  if (!a) throw new Error(`no assessment for ${signalId}`);
  return a;
}

/** Fresh load of `/` → redirected to the role picker → sign in with the demo PIN → the Bridge with data. */
async function signInFresh(page: Page, who: 'CMO' | 'K. Osei') {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose who you are' })).toBeVisible();
  if (who === 'CMO') await page.getByRole('radio', { name: /^CMO/ }).check();
  else await page.getByRole('radio', { name: /^K\. Osei/ }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: `Sign in as ${who}` }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();
  await expect(page.getByTestId('hero')).toBeVisible(SLOW);
}

test('demo 1–4: CMO → Bridge (Mars transit, day 143, delay, SIMULATED) → K. Osei ACT → Body heart → lenses', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', DESKTOP_ONLY);
  const errors = collectErrors(page);

  // 1. Fresh load → role picker → CMO (PIN 2026) → Bridge context.
  await signInFresh(page, 'CMO');
  await expect(page.getByTestId('bridge-context')).toContainText('Mars transit');
  await expect(page.getByTestId('mission-chip')).toContainText('MD 143');
  const delay = page.getByTestId('earth-delay');
  await expect(delay).toContainText('11');
  await expect(delay).toContainText('min');
  await expect(delay).toContainText('modeled delay (demo)');
  await expect(page.getByTestId('simulated-badge')).toBeVisible();
  await expect(page.getByTestId('simulated-badge')).toHaveText(/simulated data/i);
  console.log(`[demo] 1: context "${await page.getByTestId('bridge-context').innerText()}" · delay "${await delay.innerText()}"`);

  // 2. Crew at a glance: K. Osei = Act, caught only by the personal baseline.
  const osei = page.getByTestId('crew-row-c3');
  await expect(osei).toHaveAttribute('data-verdict', 'ACT', SLOW);
  await expect(osei).toContainText('K. Osei');
  await expect(osei).toContainText('Act');
  await expect(osei).toContainText('Caught only by personal baseline');

  // 3. Body → K. Osei → heart region ACT → heart-rate card: action first, layers P = Act, S = Nominal, E = Nominal.
  await osei.getByRole('link').click();
  await expect(page).toHaveURL(/\/body\/c3$/);
  await expect(page.getByRole('heading', { level: 1, name: 'K. Osei' })).toBeVisible();
  const heart = page.locator('[data-region="heart"]');
  await expect(heart).toHaveAttribute('data-verdict', 'ACT', SLOW);
  await heart.dispatchEvent('click'); // the region list mirrors the 3D hotspots (visually hidden until focus)
  const card = page.locator('[data-signal="heart_rate_rest"]');
  const toggle = card.getByRole('button', { expanded: true });
  await expect(toggle).toBeVisible(SLOW);
  const detail = page.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`);
  const first = detail.locator(':scope > div > *').first();
  await expect(first).toHaveAttribute('aria-label', 'Do this next');
  const hr = await domainAssessment(page, 'c3', 143, 'heart_rate_rest');
  expect(hr.verdict).toBe('ACT');
  await expect(first).toContainText(hr.action.text);
  console.log(`[demo] 3: heart_rate_rest ${hr.verdict}, action first: "${hr.action.text}"`);
  const layers = card.getByRole('group', { name: 'Layer verdicts' }).first();
  await expect(layers.getByRole('button', { name: 'Personal baseline: Act' })).toBeVisible();
  await expect(layers.getByRole('button', { name: 'Space-adapted rules: Nominal' })).toBeVisible();
  await expect(layers.getByRole('button', { name: 'Earth clinical reference: Nominal' })).toBeVisible();

  // 4. Lens = Earth → heart neutral; Space → neutral; Personal → ACT.
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

test('demo 6: Lab → Reaction Self-Test (test mode) → saved → Bridge plan item ticked', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', DESKTOP_ONLY);
  const errors = collectErrors(page);
  await signInFresh(page, 'K. Osei');
  const row = page.getByTestId('plan-row-reaction_test');
  await expect(row).toHaveAttribute('data-status', 'due', SLOW);
  await expect(row.getByTestId('plan-checkbox')).not.toHaveAttribute('aria-label', 'Done');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Lab', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Measurement Lab' })).toBeVisible();
  await page.goto('/lab/pvt?pvtTest=1&pvtProfile=slow');
  await expect(page.getByRole('heading', { level: 1, name: 'Reaction Self-Test' })).toBeVisible();
  await page.getByRole('button', { name: 'Start 3-minute test' }).click();
  await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible(SLOW);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByText('Saved for K. Osei, mission day 143 — labeled SIMULATED (scripted test mode).'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/lab$/);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Bridge', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();
  await expect(row).toHaveAttribute('data-status', 'done', SLOW);
  await expect(row.getByTestId('plan-checkbox')).toHaveAttribute('aria-label', 'Done');
  expect(errors).toEqual([]);
});

test.fixme('demo 5: Environment → replay SPE → S2+ and shelter advisory; dose ledger moves; "Modeled — illustrative" visible', () => {
  // Covered by e2e/environment.spec.ts.
});

test.fixme('demo 7: Earth link → send packet → countdown → delivered (surgeon tab receives in multi-page test)', () => {
  // Covered by e2e/earthlink.spec.ts.
});

test.fixme('demo 8: Settings → export FHIR → file downloads and parses', () => {
  // The FHIR export is covered by e2e/earthlink.spec.ts.
});

test.fixme('demo 9: Offline: reload with network disabled → Bridge/Body/Lab/Environment(SNAPSHOT) render', () => {
  // Needs the production service worker (vite preview): covered by e2e/offline.spec.ts.
});
