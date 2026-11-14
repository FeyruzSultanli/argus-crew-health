/// <reference lib="dom" />
// Handbook search → entry with the current verdict, protocol runner with the keyboard only, axe.
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { collectErrors, runAxe, signInAs, smallTargets } from './helpers';

async function axeClean(page: Page, info: TestInfo, what: string) {
  const axe = await runAxe(page);
  console.log(`[axe] ${info.project.name} ${what}: ${JSON.stringify(axe.byImpact)} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
}

test('/handbook: search "sleep" → open the entry → current verdict visible', async ({ page }, info) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { level: 1, name: 'Handbook' })).toBeVisible();
  await expect(page.getByTestId('handbook-results').getByRole('link').first()).toBeVisible();
  await axeClean(page, info, '/handbook');

  await page.getByTestId('handbook-search').fill('sleep');
  const first = page.getByTestId('handbook-results').getByRole('link').first();
  await expect(first).toHaveAttribute('href', '/handbook/sleep');
  await first.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sleep duration' })).toBeVisible();
  const verdict = page.getByTestId('entry-verdict');
  await expect(verdict.getByTestId('current-verdict')).toBeVisible({ timeout: 30_000 });
  await expect(verdict.getByTestId('verdict-sleep_duration')).toBeVisible();
  await expect(verdict.getByRole('link', { name: /on Body/ })).toBeVisible();
  await expect(page.getByText('SIMULATED DATA').first()).toBeVisible();
  await axeClean(page, info, '/handbook/sleep');
  expect(errors).toEqual([]);
});

test('/handbook?category=protocols lists the five protocols', async ({ page }) => {
  await signInAs(page, 'cmo');
  await page.goto('/handbook?category=protocols');
  await expect(page.getByTestId('handbook-results').getByRole('link')).toHaveCount(5);
});

test('/handbook/suspected-infection runs to the last step with the keyboard only', async ({ page }, info) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await page.goto('/handbook/suspected-infection');
  await expect(page.getByRole('heading', { level: 1, name: 'Suspected infection' })).toBeVisible();
  await expect(page.getByTestId('protocol-step')).toHaveAttribute('data-step', 's1');
  await axeClean(page, info, '/handbook/suspected-infection');

  const steps = ['s1', 's2', 's3', 's4', 's5', 's6'];
  for (let i = 0; i < steps.length - 1; i++) {
    await expect(page.getByTestId('protocol-step')).toHaveAttribute('data-step', steps[i] as string);
    await page.keyboard.press(i % 2 === 0 ? 'Space' : 'Enter');
  }
  const last = page.getByTestId('protocol-step');
  await expect(last).toHaveAttribute('data-step', 's6');
  await expect(last.getByTestId('step-counter')).toHaveText('Step 6 of 6');
  await expect(last.getByRole('link', { name: 'Send report to flight surgeon' })).toHaveAttribute(
    'href',
    /\/earth\?crew=c4&flags=1$/,
  );
  await page.keyboard.press('Space');
  await expect(page.getByTestId('protocol-complete')).toBeVisible();
  const runs = await page.evaluate(
    () => JSON.parse(localStorage.getItem('argus.protocolRuns') ?? '[]') as unknown[],
  );
  expect(runs).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('Ask box: "What should I do about my sleep?" answers from the sleep entry and the current verdict', async ({
  page,
}, info) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await page.goto('/handbook');
  await page.getByTestId('ask-input').fill('What should I do about my sleep?');
  await page.getByRole('button', { name: 'Ask' }).click();
  const answer = page.getByTestId('ask-answer');
  await expect(answer.getByTestId('answer-entry-sleep')).toContainText('Keep doing your countermeasures');
  await expect(answer.getByTestId('verdict-sleep_duration')).toBeVisible({ timeout: 30_000 });
  await expect(answer.getByTestId('entries-used')).toContainText('Sleep duration');
  await axeClean(page, info, '/handbook ask answer');
  await page.getByTestId('ask-input').fill('xyzzy blorp');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByTestId('ask-no-answer')).toHaveText("I don't have that.");
  expect(errors).toEqual([]);
});
