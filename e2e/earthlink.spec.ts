/// <reference lib="dom" />
// Earth link + Crew overview (FR-EARTH-1/2/3, FR-DATA-2, FR-CREW-2/3). Sign-in goes through /sign-in.
import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { collectErrors, runAxe } from './helpers';

async function signIn(page: Page, who: 'CMO' | 'Flight surgeon') {
  await page.goto('/sign-in');
  await page.getByRole('radio', { name: new RegExp(`^${who}`) }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByRole('button', { name: `Sign in as ${who}` }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible({ timeout: 20_000 });
}

/** Client-side navigation keeps the session (no full reload needed, but a reload works too). */
async function open(page: Page, path: string, heading: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: 20_000 });
}

test('CMO sends K. Osei day 143 to Earth: preview, 11 min (demo: 11 s), delivered; export FHIR + CSV', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await signIn(page, 'CMO');
  await open(page, '/earth?crew=c3&flags=1', 'Earth link');
  await expect(page.getByTestId('simulated-delivery')).toContainText('Earth-link delivery is simulated (time-compressed)');
  await page.getByTestId('compression-control').getByRole('radio', { name: '60×' }).click();

  await expect(page.getByTestId('compose-crew-c3')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('compose-crew-c1')).toHaveAttribute('aria-pressed', 'false');
  const hr = page.getByTestId('flag-c3-heart_rate_rest');
  await expect(hr).toContainText('Resting heart rate', { timeout: 20_000 });
  await expect(hr).toContainText('Act');
  await expect(hr).toContainText('Caught only by personal baseline');
  await expect(page.getByTestId('packet-preview')).toContainText('kB');

  const axe = await runAxe(page);
  console.log(`[axe] ${info.project.name} /earth (CMO): ${JSON.stringify(axe.byImpact)} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);

  await page.getByTestId('send-packet').click();
  const card = page.getByTestId('packet-card').first();
  await expect(card.getByTestId('packet-arrival')).toHaveText('arrives in 11 min (demo: 11 s)');
  await expect(card).toContainText('modeled delay (demo)');
  await expect(card).toHaveAttribute('data-status', /queued|in-transit/);
  await expect(card).toHaveAttribute('data-status', 'in-transit', { timeout: 5_000 });
  await expect(card).toHaveAttribute('data-status', 'delivered', { timeout: 15_000 });
  await expect(card.getByTestId('packet-delivered')).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-fhir').click()]);
  expect(download.suggestedFilename()).toBe('argus-fhir-mars-transit-MD143.json');
  const path = await download.path();
  const bundle = JSON.parse(await readFile(path, 'utf8')) as {
    resourceType: string;
    entry: Array<{ resource: { resourceType: string; code?: { coding?: Array<{ code: string }> }; component?: unknown[] } }>;
  };
  expect(bundle.resourceType).toBe('Bundle');
  const bp = bundle.entry.find((e) => e.resource.code?.coding?.[0]?.code === '85354-9');
  expect(bp?.resource.component).toHaveLength(2);

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
  expect(csv.suggestedFilename()).toBe('argus-observations-mars-transit-MD143.csv');
  const text = await readFile(await csv.path(), 'utf8');
  expect(text.split('\r\n')[0]).toBe(
    'id,crewId,signalId,value,unit,components,effectiveAt,missionDay,sourceKind,sourceMethod,sourceLabel,qualityLabel,qualityScore',
  );
  expect(errors).toEqual([]);
});

test('CMO crew overview: K. Osei first with Act, readiness demo parameter, send packet link; axe', async ({ page }, info) => {
  const errors = collectErrors(page);
  await signIn(page, 'CMO');
  await open(page, '/crew', 'Crew overview');
  const cards = page.getByTestId('crew-overview').locator(':scope > li');
  await expect(cards).toHaveCount(4, { timeout: 20_000 });
  const first = cards.first();
  await expect(first).toHaveAttribute('data-testid', 'crew-card-c3');
  await expect(first).toHaveAttribute('data-verdict', 'ACT');
  await expect(first).toContainText('K. Osei');
  await expect(first).toContainText('Act');
  await expect(first).toContainText('Caught only by personal baseline');
  await expect(first).toContainText('Readiness');
  await expect(first).toContainText('Demo parameter');
  await expect(first).toContainText('Last measurement');
  await expect(first.getByTestId('overdue')).toContainText('overdue');
  const axe = await runAxe(page);
  console.log(`[axe] ${info.project.name} /crew (CMO): ${JSON.stringify(axe.byImpact)} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);
  await first.getByRole('link', { name: 'Send packet' }).click();
  await expect(page).toHaveURL(/\/earth\?crew=c3&flags=1$/);
  await expect(page.getByTestId('compose-crew-c3')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('second tab as Flight surgeon sees the packet only after delivery; the reply comes back delayed', async ({ context }, info) => {
  test.setTimeout(120_000);
  const surgeon = await context.newPage();
  const surgeonErrors = collectErrors(surgeon);
  await signIn(surgeon, 'Flight surgeon');
  await open(surgeon, '/earth', 'Earth link');
  await expect(surgeon.getByTestId('received-packets')).toContainText('No packet has arrived yet');

  const crew = await context.newPage();
  const crewErrors = collectErrors(crew);
  await signIn(crew, 'CMO');
  await open(crew, '/earth?crew=c3&flags=1', 'Earth link');
  await crew.getByTestId('compression-control').getByRole('radio', { name: '60×' }).click();
  await expect(crew.getByTestId('flag-c3-heart_rate_rest')).toBeVisible({ timeout: 20_000 });
  await crew.getByTestId('send-packet').click();
  const card = crew.getByTestId('packet-card').first();
  await expect(card).toHaveAttribute('data-status', 'in-transit', { timeout: 5_000 });

  // While the packet is in transit, Earth has nothing.
  await expect(surgeon.getByTestId('received-packet')).toHaveCount(0);
  await surgeon.waitForTimeout(3_000);
  await expect(card).toHaveAttribute('data-status', 'in-transit');
  await expect(surgeon.getByTestId('received-packet')).toHaveCount(0);

  await expect(card).toHaveAttribute('data-status', 'delivered', { timeout: 15_000 });
  const received = surgeon.getByTestId('received-packet');
  await expect(received).toHaveCount(1, { timeout: 5_000 });
  await expect(received).toContainText('K. Osei');
  await expect(received).toContainText('Caught only by personal baseline');
  await expect(received.getByTestId('provenance')).toContainText('modeled delay (demo)');

  const axe = await runAxe(surgeon);
  console.log(`[axe] ${info.project.name} /earth (surgeon): ${JSON.stringify(axe.byImpact)} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);

  // Surgeon crew overview: only what the packet contained.
  await surgeon.getByRole('link', { name: 'Crew', exact: true }).click();
  await expect(surgeon.getByRole('heading', { level: 1, name: 'Crew overview' })).toBeVisible();
  await expect(surgeon.getByTestId('surgeon-scope')).toContainText('only what delivered Earth-link packets contain');
  await expect(surgeon.getByTestId('crew-overview').locator(':scope > li')).toHaveCount(1);
  await expect(surgeon.getByTestId('crew-card-c3')).toHaveAttribute('data-verdict', 'ACT');
  await surgeon.getByRole('link', { name: 'Earth', exact: true }).click();

  const reply = 'Received. Re-measure temperature tonight and send again.';
  await surgeon.getByLabel('Reply to the crew (sent as written)').fill(reply);
  await surgeon.getByTestId('send-reply').click();
  await expect(surgeon.getByTestId('sent-reply').first()).toHaveAttribute('data-status', 'in-transit');
  await expect(crew.getByTestId('inbox')).toContainText('No messages from Earth yet');
  await crew.waitForTimeout(3_000);
  await expect(crew.getByTestId('reply-item')).toHaveCount(0);
  await expect(crew.getByTestId('reply-item')).toHaveCount(1, { timeout: 15_000 });
  await expect(crew.getByTestId('reply-item')).toContainText(reply);
  expect(surgeonErrors).toEqual([]);
  expect(crewErrors).toEqual([]);
});
