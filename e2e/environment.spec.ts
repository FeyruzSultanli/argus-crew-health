/// <reference lib="dom" />
// Environment screen — mocked live NOAA (LIVE + header badge), offline → CACHED / SNAPSHOT with age, SPE
// replay → S2 + "Shelter advised." with REPLAY + synthetic wording, modeled dose > 0, radiation_dose WATCH for c1/c4,
// role gating of the dose ledger, axe, both viewports. NOAA is route-mocked: no real network in this spec.
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { collectErrors, runAxe, signInAs } from './helpers';

const SHOTS = process.env.ENV_SHOTS ?? 'test-results/environment-shots';
const snapshot = JSON.parse(readFileSync('seed/radiation/goes-snapshot.json', 'utf8')) as {
  data: Array<{ time_tag: string; satellite: number; flux: number; energy: string }>;
};

/** The bundled 7-day snapshot shifted so its last sample is 5 min before now (a quiet-sun "live" answer). */
function liveBody(): string {
  const last = Date.parse(snapshot.data[snapshot.data.length - 1]!.time_tag);
  const shift = Date.now() - 5 * 60_000 - last;
  const rows = snapshot.data.map((r) => ({
    ...r,
    time_tag: new Date(Date.parse(r.time_tag) + shift).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }));
  return JSON.stringify(rows);
}

async function mockNoaa(context: BrowserContext): Promise<string[]> {
  const hits: string[] = [];
  const body = liveBody();
  await context.route('https://services.swpc.noaa.gov/**', async (route) => {
    hits.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body,
    });
  });
  // Nothing else may leave the machine (DONKI is never called in this build).
  await context.route(/^https:\/\/(?!services\.swpc\.noaa\.gov)/, (route) => {
    hits.push(`BLOCKED ${route.request().url()}`);
    return route.abort();
  });
  return hits;
}

async function openEnvironment(page: Page, query = '') {
  await page.goto(`/environment${query}`);
  await expect(page.getByRole('heading', { name: 'Radiation & cabin' })).toBeVisible();
}

async function shot(page: Page, name: string, project: string) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${project}-${name}.png`, fullPage: true });
}

test('mocked live NOAA → LIVE (screen + header badge); ledger c1/c4 WATCH; cabin; DONKI card; axe', async ({
  page,
  context,
}, info) => {
  const hits = await mockNoaa(context);
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await openEnvironment(page);
  const bar = page.getByTestId('data-mode-bar');
  await expect(bar.getByTestId('space-weather-badge')).toHaveText(/LIVE/, { timeout: 15_000 });
  await expect(page.getByRole('banner').getByTestId('space-weather-badge')).toHaveText(/LIVE/);
  await expect(page.getByTestId('data-freshness')).toContainText('Live NOAA GOES feed · fetched');
  expect(hits.some((u) => u.endsWith('integral-protons-7-day.json'))).toBe(true);
  await expect(page.getByTestId('s-level')).toHaveText('S0');
  await expect(page.getByTestId('shelter-banner')).toHaveCount(0);
  // dose ledger: projected 498.0 / 558.0 mSv, radiation_dose WATCH for c1 and c4, NOMINAL for c2 and c3
  await expect(page.getByTestId('dose-projected-c1')).toContainText('498.0');
  await expect(page.getByTestId('dose-projected-c1')).toContainText('83');
  await expect(page.getByTestId('dose-projected-c4')).toContainText('558.0');
  await expect(page.getByTestId('dose-projected-c4')).toContainText('93');
  for (const [id, word] of [
    ['c1', 'Watch'],
    ['c2', 'Nominal'],
    ['c3', 'Nominal'],
    ['c4', 'Watch'],
  ] as const)
    await expect(page.getByTestId(`dose-verdict-${id}`)).toContainText(word, { timeout: 15_000 });
  await expect(page.getByTestId('alara-note')).toHaveText('Keep exposure as low as reasonably achievable.');
  await expect(page.getByTestId('dose-ledger')).toContainText(
    'Modeled — illustrative. Real crew dose comes from personal dosimeters.',
  );
  await expect(page.getByTestId('dose-ledger')).toContainText(
    'Modeled SPE dose covers events in the displayed window.',
  );
  await expect(page.getByTestId('dose-row-c4')).not.toContainText('includes modeled SPE dose'); // quiet sun: SPE 0
  await expect(page.getByText('dose equivalent, published measurements', { exact: false })).toBeVisible();
  await expect(page.getByTestId('modeled-label')).toHaveText(
    'Modeled — illustrative. Real crew dose comes from personal dosimeters.',
  );
  await expect(page.getByTestId('donki-card')).toContainText(
    'The NASA DONKI event list is unavailable in this build.',
  );
  await expect(page.getByTestId('co2-card')).toContainText('SIMULATED');
  await expect(page.getByTestId('comfort-plot')).toBeVisible();
  // "View data" table alternative of the flux chart
  await page.getByTestId('flux-chart').getByRole('button', { name: 'View data' }).click();
  await expect(page.getByTestId('flux-chart').getByRole('table')).toBeVisible();
  await page.getByTestId('flux-chart').getByRole('button', { name: 'Hide data' }).click();
  await page.getByRole('radio', { name: '7 d' }).click();
  await shot(page, 'live', info.project.name);
  const axe = await runAxe(page);
  console.log(
    `[axe] ${info.project.name} /environment: ${JSON.stringify(axe.byImpact)} ${axe.ids.join(' ')}`,
  );
  expect(axe.seriousOrCritical).toEqual([]);
  expect(hits.filter((h) => h.startsWith('BLOCKED'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('network off: CACHED with age after a live load; SNAPSHOT with capture date on a fresh browser', async ({
  page,
  context,
  browser,
}, info) => {
  await mockNoaa(context);
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await openEnvironment(page);
  const badge = page.getByTestId('data-mode-bar').getByTestId('space-weather-badge');
  await expect(badge).toHaveText(/LIVE/, { timeout: 15_000 });
  // going offline while on screen: the live view becomes the cached copy
  await context.setOffline(true);
  await expect(badge).toHaveText(/CACHED/);
  await expect(page.getByRole('banner').getByTestId('space-weather-badge')).toHaveText(/CACHED/);
  await context.setOffline(false);
  // reload with the network off (dev server has no service worker, so navigator.onLine is forced false instead)
  await context.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }),
  );
  await page.reload();
  await expect(badge).toHaveText(/CACHED/, { timeout: 15_000 });
  await expect(page.getByTestId('data-freshness')).toContainText(
    /Cached copy · .* old \(fetched .* UTC\) · live feed unavailable: offline/,
  );
  await shot(page, 'cached', info.project.name);
  expect(errors).toEqual([]);

  const fresh = await browser.newContext({ viewport: page.viewportSize() ?? undefined });
  await mockNoaa(fresh);
  await fresh.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }));
  const p2 = await fresh.newPage();
  const errors2 = collectErrors(p2);
  await signInAs(p2, 'cmo');
  await openEnvironment(p2);
  await expect(p2.getByTestId('data-mode-bar').getByTestId('space-weather-badge')).toHaveText(/SNAPSHOT/, {
    timeout: 15_000,
  });
  await expect(p2.getByTestId('data-freshness')).toContainText(
    'Bundled snapshot · captured 14 Nov 2026, 13:26 UTC',
  );
  await expect(p2.getByTestId('s-level')).toHaveText('S0');
  expect(errors2).toEqual([]);
  await fresh.close();
});

test('Replay SPE (3600×): S2 → "Shelter advised." with REPLAY + synthetic wording, modeled dose > 0; stop restores', async ({
  page,
  context,
}, info) => {
  await mockNoaa(context);
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await openEnvironment(page, '?replaySpeed=3600');
  const badge = page.getByTestId('data-mode-bar').getByTestId('space-weather-badge');
  await expect(badge).toHaveText(/LIVE/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Replay SPE' }).click();
  await expect(badge).toHaveText(/REPLAY/);
  await expect(page.getByRole('banner').getByTestId('space-weather-badge')).toHaveText(/REPLAY/);
  await expect(page.getByTestId('s-level')).toHaveText('S2', { timeout: 15_000 });
  await page.getByRole('radio', { name: '600×', exact: true }).click(); // slow down: S2 lasts ~20 s more at 600×
  const banner = page.getByTestId('shelter-banner');
  await expect(banner.getByTestId('shelter-text')).toHaveText('Shelter advised.');
  await expect(banner).toContainText("Real shelter calls come from the mission's radiation specialists.");
  await expect(banner).toContainText('REPLAY');
  await expect(banner).toContainText('synthetic S2-class profile (demo), not a recorded event');
  await expect(page.getByTestId('modeled-label')).toBeVisible();
  for (const id of ['flux-chart', 's-scale-tile']) {
    await expect(page.getByTestId(id)).toContainText('REPLAY');
    await expect(page.getByTestId(id)).toContainText('synthetic');
    await expect(page.getByTestId(id)).toContainText('not a recorded event');
  }
  await expect(page.getByRole('banner').getByTestId('space-weather-badge')).toHaveAttribute(
    'title',
    'Replaying a synthetic solar-event profile (demo), not a recorded event',
  );
  const dose = page.getByTestId('spe-event-dose');
  await expect(async () => {
    const v = Number((await dose.locator('[data-value]').first().innerText()).match(/[\d.]+/)?.[0]);
    expect(v).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  // the ledger moves (modeled SPE added to today) but radiation_dose stays WATCH, not ACT — the banner is no verdict
  await expect(async () => {
    const v = Number((await page.getByTestId('dose-spe-c4').innerText()).match(/[\d.]+/)?.[0]);
    expect(v).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  await expect(page.getByTestId('dose-row-c4')).toContainText('includes modeled SPE dose');
  await expect(page.getByTestId('dose-verdict-c4')).toContainText('Watch');
  await expect(page.getByText(/\b(live|real) (event|SPE)\b/i)).toHaveCount(0);
  await shot(page, 'replay', info.project.name);
  await page.getByRole('button', { name: 'Stop replay' }).click();
  await expect(badge).toHaveText(/LIVE/);
  await expect(page.getByTestId('shelter-banner')).toHaveCount(0);
  await expect(page.getByTestId('s-level')).toHaveText('S0');
  expect(errors).toEqual([]);
});

test('dose ledger is crew data: crew see their own row, the flight surgeon none', async ({ browser }) => {
  for (const [role, crewId, rows] of [
    ['crew', 'c2', ['c2']],
    ['surgeon', null, []],
  ] as const) {
    const ctx = await browser.newContext();
    await mockNoaa(ctx);
    const page = await ctx.newPage();
    await signInAs(page, role, crewId);
    await openEnvironment(page);
    await expect(page.getByTestId('co2-card')).toBeVisible({ timeout: 15_000 });
    for (const id of ['c1', 'c2', 'c3', 'c4'])
      await expect(page.getByTestId(`dose-row-${id}`)).toHaveCount(
        (rows as readonly string[]).includes(id) ? 1 : 0,
      );
    if (role === 'surgeon') await expect(page.getByText('Per-crew dose is crew data')).toBeVisible();
    await ctx.close();
  }
});
