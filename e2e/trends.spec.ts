/// <reference lib="dom" />
// Trends (doc 11 §5.3, FR-BAS-6): K. Osei heart-rate excursion with the ACT marker, cabin CO₂ limits,
// View data, CSV export, scrubbing, axe. Sign-in goes through /sign-in (CMO, PIN 2026).
import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { parseCsv } from '../src/features/trends/csv';
import { collectErrors, runAxe, smallTargets } from './helpers';

const SHOTS = process.env.TRENDS_SHOTS;

async function signInCmo(page: Page) {
  await page.goto('/sign-in');
  await page.getByRole('radio', { name: /^CMO/ }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: 'Sign in as CMO' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible({
    timeout: 30_000,
  });
}

async function openTrends(page: Page) {
  await page.goto('/trends/c3');
  await expect(page.getByRole('heading', { level: 1, name: 'Trends' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('trend-heart_rate_rest').locator('[data-trend-svg]')).toBeVisible({
    timeout: 30_000,
  });
}

test('CMO → K. Osei trends: HR excursion with ACT marker, CO₂ limits, View data, CSV, scrub to MD 140', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await signInCmo(page);
  await openTrends(page);

  const hr = page.getByTestId('trend-heart_rate_rest');
  await expect(hr.getByRole('heading', { name: 'Resting heart rate' })).toBeVisible();
  // accessible ACT marker for MD 143 (flagged-days list) + the SVG glyph
  const act = hr.getByTestId('flag-heart_rate_rest-act-143');
  await expect(act).toBeVisible();
  await expect(act).toContainText('MD 143');
  await expect(act).toContainText('Act');
  await expect(act).toContainText('69');
  await expect(hr.getByTestId('flag-heart_rate_rest-watch-142')).toBeVisible();
  await expect(hr.getByTestId('flag-heart_rate_rest-watch-141')).toBeVisible();
  await expect(hr.locator('[data-testid="marker-act-143"]')).toHaveCount(1);
  await expect(hr.getByTestId('event-silent-infection')).toContainText('Silent infection');
  await expect(hr).toContainText('Pre-flight band');
  await expect(hr).toContainText('Personal band');

  const co2 = page.getByTestId('trend-cabin_co2');
  await co2.scrollIntoViewIfNeeded();
  const limit = co2.getByRole('listitem').filter({ hasText: 'NASA-STD-3001 1-h limit' });
  await expect(limit).toContainText('3');
  await expect(limit).toContainText('mmHg');
  await expect(limit.locator('[data-source-status]').first()).toBeVisible();
  const sevenDay = co2.getByRole('listitem').filter({ hasText: '7-day headache-risk line' });
  await expect(sevenDay).toContainText('2.5');
  await expect(sevenDay).toContainText('mmHg');
  await expect(sevenDay.locator('[data-source-status]').first()).toBeVisible();

  const axe = await runAxe(page);
  console.log(`[axe] ${info.project.name} /trends/c3: ${JSON.stringify(axe.byImpact)} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);
  const small = await smallTargets(page);
  console.log(`[targets<44] ${info.project.name}: ${small.length} ${small.slice(0, 8).join(' | ')}`);

  if (SHOTS) await page.screenshot({ path: `${SHOTS}/trends-${info.project.name}.png`, fullPage: true });

  // View data
  await hr.getByRole('button', { name: /View data/ }).click();
  const row = hr.locator('tr[data-day="143"]');
  await expect(row).toContainText('MD 143');
  await expect(row).toContainText('69');
  await expect(row).toContainText('Act');

  // CSV export
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-csv').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^argus-trends-c3-.*\.csv$/);
  const rows = parseCsv(await readFile(await download.path(), 'utf8'));
  expect(rows[0]).toEqual([
    'signal',
    'track',
    'crew',
    'missionDay',
    'value',
    'unit',
    'bandLo',
    'bandHi',
    'personalVerdict',
    'sourceLabel',
  ]);
  const hr143 = rows.find((r) => r[0] === 'heart_rate_rest' && r[3] === '143');
  expect(hr143?.slice(2, 6)).toEqual(['K. Osei', '143', '69', 'bpm']);
  expect(hr143?.[8]).toBe('ACT');
  expect(rows.some((r) => r[0] === 'cabin_co2' && r[3] === '120' && r[4] === '4.2')).toBe(true);

  // Scrub the mission day to 140 (scrubber slider, keyboard): the excursion leaves the right edge
  const slider = page.getByRole('slider', { name: 'Mission day' });
  await slider.focus();
  for (let i = 0; i < 3; i++) await slider.press('ArrowLeft');
  await expect(page.getByTestId('range-label')).toContainText('MD 140', { timeout: 15_000 });
  await expect(hr.getByTestId('flag-heart_rate_rest-act-143')).toHaveCount(0);
  await expect(hr.locator('[data-testid="marker-act-143"]')).toHaveCount(0);
  await expect(hr.locator('tr[data-day="143"]')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('brush: keyboard range control applies to every chart; Reset range restores 30 d', async ({ page }) => {
  test.setTimeout(90_000);
  await signInCmo(page);
  await openTrends(page);
  const start = page.getByRole('slider', { name: 'Range start' });
  await start.focus();
  for (let i = 0; i < 10; i++) await start.press('ArrowRight');
  await expect(page.getByTestId('range-label')).toHaveText('MD 124 – MD 143');
  await page.getByRole('button', { name: 'Reset range' }).click();
  await expect(page.getByTestId('range-label')).toHaveText('MD 114 – MD 143');
});

test('compare crew overlay (CMO) and PNG export of the current view', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await signInCmo(page);
  await openTrends(page);
  const hr = page.getByTestId('trend-heart_rate_rest');
  await page.getByRole('switch', { name: /Compare crew/ }).click();
  await expect(hr).toContainText('R. Vance', { timeout: 15_000 });
  await expect(hr).toContainText('M. Ito');
  await expect(hr).toContainText('L. Duarte');
  await expect(hr).toContainText('Their own personal bands are not drawn.');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-png').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^argus-trends-c3-.*\.png$/);
  const png = await readFile(await download.path());
  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(png.length).toBeGreaterThan(20_000);
  if (SHOTS) {
    await download.saveAs(`${SHOTS}/export-${info.project.name}.png`);
    await hr.screenshot({ path: `${SHOTS}/compare-${info.project.name}.png` });
  }
  expect(errors).toEqual([]);
});

test('flight surgeon gets the Earth-link notice and no crew data', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('radio', { name: /^Flight surgeon/ }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: 'Sign in as Flight surgeon' }).click();
  await page.waitForURL(/\/$/);
  await page.goto('/trends/c3');
  await expect(page.getByText('Trends for the flight surgeon come from received packets')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('link', { name: 'Open Earth link' })).toBeVisible();
  await expect(page.getByTestId('trend-heart_rate_rest')).toHaveCount(0);
});
