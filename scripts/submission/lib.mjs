// Shared helpers for the submission-asset scripts (screenshots). Plain Node ESM + Playwright; no app code.
// The app must already be served, e.g. `npm run build && npx vite preview --port 5175 --strictPort`.
import { chromium, expect } from '@playwright/test';

export { chromium, expect };

export const BASE = (process.env.ARGUS_URL ?? 'http://localhost:5175').replace(/\/$/, '');

/** Persisted UI preferences (same shape as e2e/helpers.prefs.ts setPrefs): dark theme. */
export async function setPrefs(context, { theme = 'dark', reducedMotion = true } = {}) {
  await context.addInitScript(
    ([t, rm]) => {
      if (!localStorage.getItem('argus.ui'))
        localStorage.setItem(
          'argus.ui',
          JSON.stringify({
            state: { theme: t, gloveMode: false, reducedMotion: rm, units: { temp: 'Cel', glucose: 'mg/dL' } },
            version: 1,
          }),
        );
    },
    [theme, reducedMotion],
  );
}

/** Sign in through the real role picker (/sign-in), demo PIN 2026. `who` = 'CMO' | 'Flight surgeon' | 'K. Osei'. */
export async function signIn(page, who = 'CMO', { beforeSubmit } = {}) {
  await page.goto(`${BASE}/sign-in`);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose who you are' })).toBeVisible({ timeout: 30_000 });
  if (who === 'CMO' || who === 'Flight surgeon') {
    await page.getByRole('radio', { name: new RegExp(`^${who}`) }).check();
  } else {
    await page.getByRole('radio', { name: /^Crew member/ }).check();
    await page.getByRole('radio', { name: new RegExp(`^${who.replace('.', '\\.')}`) }).check();
  }
  await page.getByLabel('Demo PIN').fill('2026');
  if (beforeSubmit) await beforeSubmit(page);
  await page.getByRole('button', { name: `Sign in as ${who}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible({ timeout: 30_000 });
}

/** Same as e2e/helpers.ts waitForData: no boot placeholder, no skeletons. */
export async function waitForData(page, timeout = 30_000) {
  await expect(page.getByTestId('data-boot-loading')).toHaveCount(0, { timeout });
  await expect(page.locator('[role="status"] > .animate-pulse')).toHaveCount(0, { timeout });
}

/** Header honesty: the SIMULATED DATA badge is on screen (crew data visible). */
export async function expectSimulatedBadge(page) {
  await expect(page.getByTestId('simulated-badge').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('simulated-badge').first()).toHaveText(/simulated data/i);
}

/** Open a route with a full load and wait for its h1. */
export async function open(page, path, heading, timeout = 30_000) {
  await page.goto(`${BASE}${path}`);
  if (heading) await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout });
  await waitForData(page);
}

/** CMO Lab flows ask "Who is being measured?" after a full load: pick K. Osei if asked. */
export async function pickSubjectIfAsked(page, name = 'K. Osei') {
  const ask = page.getByRole('heading', { name: 'Who is being measured?' });
  if (await ask.isVisible().catch(() => false)) await page.getByRole('button', { name }).click();
  await expect(page.getByText(`Measuring: ${name}`).first()).toBeVisible({ timeout: 15_000 });
}

/** The 3D body is idle when the canvas is there and the heart region carries a verdict. */
export async function waitForBody(page) {
  await expect(page.getByRole('heading', { level: 1, name: 'K. Osei' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('body-canvas').locator('canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-region="heart"]')).toHaveAttribute('data-verdict', /ACT|WATCH|NOMINAL/, {
    timeout: 30_000,
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
