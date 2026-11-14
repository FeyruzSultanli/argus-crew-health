// Reaction Self-Test (scripted test mode) end to end through the real sign-in, store and health service —
// result with many lapses, saved (toast + Lab hub "last measured"), no console errors — plus manual vitals
// (blocking + saving) and axe / 44-px target checks on /lab, /lab/pvt (intro and result) and /lab/manual.
import { type Page, expect, test } from '@playwright/test';

import { collectErrors, runAxe, signInAs, smallTargets } from './helpers';

/** Sign in as a crew member through the role picker (demo PIN 2026). */
async function signInViaPicker(page: Page, name = 'K. Osei') {
  await page.goto('/lab');
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole('radio', { name: new RegExp(`^${name.replace('.', '\\.')}`) }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: `Sign in as ${name}` }).click();
  await expect(page).toHaveURL(/\/lab$/);
}

async function axeClean(page: Page, label: string, project: string) {
  const axe = await runAxe(page);
  console.log(`[axe] ${project} ${label}: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
}

/** The slice of src/services/healthService.ts read here (loaded from the dev server inside the page). */
interface AssessSvc {
  healthService: {
    assess(
      crewId: string,
      day: number,
    ): Promise<Array<{ signalId: string; verdict: string; action: { kind: string; text: string } }>>;
  };
}

test('PVT test mode (slow) → result with many lapses → saved → WATCH/ACT verdict → Lab hub shows it', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await signInViaPicker(page);
  // Seeded record: K. Osei's simulated weekly runs (labelled SIMULATED), not a fixture's "Not measured yet".
  const last = page.getByTestId('lab-tile-pvt-last');
  await expect(last).toContainText('Last measured');
  await expect(last).toContainText('SIMULATED');

  await page.goto('/lab/pvt?pvtTest=1&pvtProfile=slow');
  await expect(page.getByRole('heading', { level: 1, name: 'Reaction Self-Test' })).toBeVisible();
  await expect(page.getByText('Measuring: K. Osei').first()).toBeVisible();
  await expect(page.getByTestId('pvt-test-mode').first()).toContainText('TEST MODE — scripted responses');
  await expect(page.getByText('Use the same device for comparable results.')).toBeVisible();
  await page.getByRole('button', { name: 'Start 3-minute test' }).click();
  await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible({ timeout: 10_000 });

  const lapses = Number(await page.getByTestId('pvt-lapses').getAttribute('data-raw'));
  const stimuli = Number(await page.getByTestId('pvt-stimuli').getAttribute('data-raw'));
  const speed = Number(await page.getByTestId('pvt-speed').getAttribute('data-raw'));
  expect(stimuli).toBeGreaterThan(30);
  expect(lapses).toBeGreaterThan(stimuli * 0.6);
  await expect(page.getByRole('heading', { name: "Compared with K. Osei's simulated baseline" })).toBeVisible();
  await expect(page.getByTestId('pvt-verdict-pending')).toHaveText('Verdict appears once the reading is evaluated.');

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved for K. Osei, mission day 143 — labeled SIMULATED (scripted test mode).')).toBeVisible();
  await expect(page.getByText('Reaction Self-Test saved for K. Osei.')).toBeVisible(); // toast

  // Acceptance: deliberately slow responses → WATCH or ACT vs the simulated baseline, with the domain's
  // action text verbatim (doc 07 §4.9 S: lapses ≥ baseline + 3 → WATCH, ≥ + 6 → ACT).
  const verdict = page.getByTestId('pvt-verdict');
  await expect(verdict).toBeVisible();
  const shown = await verdict.locator('[data-verdict]').first().getAttribute('data-verdict');
  expect(['WATCH', 'ACT']).toContain(shown);
  const domain = await page.evaluate(async (path: string) => {
    const svc = (await import(/* @vite-ignore */ path)) as AssessSvc;
    return (await svc.healthService.assess('c3', 143)).find((a) => a.signalId === 'reaction_test');
  }, '/src/services/healthService.ts');
  expect(domain?.verdict).toBe(shown);
  expect(domain?.action.kind).not.toBe('none');
  await expect(verdict.getByTestId('pvt-action')).toHaveText(domain?.action.text ?? '—');
  console.log(`[pvt] slow profile: lapses ${lapses}/${stimuli}, verdict ${shown}, action "${domain?.action.text}"`);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/lab$/);
  await expect(last).toContainText(speed.toFixed(2));
  await expect(last).toContainText('SIMULATED');
  expect(errors).toEqual([]);
});

test('manual vitals: systolic below diastolic is blocked; a valid entry is saved', async ({ page }) => {
  const errors = collectErrors(page);
  await signInAs(page, 'crew', 'c3');
  await page.goto('/lab/manual');
  await expect(page.getByRole('heading', { level: 1, name: 'Manual vitals' })).toBeVisible();
  await page.getByRole('textbox', { name: /^Systolic/ }).fill('80');
  await page.getByRole('textbox', { name: /^Diastolic/ }).fill('95');
  await page.getByRole('button', { name: 'Save entries' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Systolic (80) must be higher than diastolic (95).');

  await page.getByRole('textbox', { name: /^Systolic/ }).fill('118');
  await page.getByRole('textbox', { name: /^Diastolic/ }).fill('76');
  await page.getByRole('textbox', { name: /^Resting heart rate/ }).fill('58');
  await page.getByRole('button', { name: 'Save entries' }).click();
  await expect(page.getByText('Saved: blood pressure, heart rate.')).toBeVisible();
  await expect(page.getByTestId('saved-list')).toContainText('118/76');
  await expect(page.getByRole('link', { name: "Open K. Osei's body view" })).toHaveAttribute('href', '/body/c3');
  expect(errors).toEqual([]);
});

test('axe + 44-px targets: /lab, CMO subject picker, /lab/pvt intro and result, /lab/manual', async ({ page }, info) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await page.goto('/lab');
  const picker = page.getByRole('radiogroup', { name: 'Measurement subject' });
  await expect(picker).toBeVisible();
  // The CMO picks first (doc 09 intro): nobody is selected after a fresh load.
  await expect(page.getByTestId('lab-subject-pick')).toBeVisible();
  await axeClean(page, '/lab (no subject)', info.project.name);
  await picker.getByRole('radio', { name: 'K. Osei' }).click();
  await expect(page.getByText('Measuring: K. Osei')).toBeVisible();
  await axeClean(page, '/lab', info.project.name);

  // A full page load clears the (transient) selection: the flow route asks first.
  const pick = async (h1: string) => {
    await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Who is being measured?' })).toBeVisible();
    await axeClean(page, `${h1} subject picker`, info.project.name);
    await page.getByRole('button', { name: 'K. Osei' }).click();
    await expect(page.getByText('Measuring: K. Osei').first()).toBeVisible();
  };
  await page.goto('/lab/pvt?pvtTest=1&pvtProfile=slow');
  await pick('Reaction Self-Test');
  await expect(page.getByRole('button', { name: 'Start 3-minute test' })).toBeVisible();
  await axeClean(page, '/lab/pvt intro', info.project.name);
  await page.getByRole('button', { name: 'Start 3-minute test' }).click();
  await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible({ timeout: 10_000 });
  await axeClean(page, '/lab/pvt result', info.project.name);

  await page.goto('/lab/manual');
  await pick('Manual vitals');
  for (const t of await page.getByRole('button', { name: 'How to measure' }).all()) await t.click();
  await axeClean(page, '/lab/manual', info.project.name);
  expect(errors).toEqual([]);
});
