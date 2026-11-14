// Vision check (Amsler grid + near acuity) in scripted test mode, end to end through the real sign-in,
// subject rule, Dexie record and domain rules. Acceptance: vs a stored baseline of 0 cells,
// 2 new peripheral cells → WATCH with "new area since last test"; a central cell → ACT; the grid is
// 100 × pxPerMm CSS px. Plus near acuity saving two per-eye observations with withGlasses, axe and 44-px checks.
import { type Page, expect, test } from '@playwright/test';

import { collectErrors, runAxe, signInAs, smallTargets } from './helpers';

const PX_PER_MM = 4;

async function calibrate(page: Page) {
  await page.addInitScript((px) => {
    localStorage.setItem('argus.calibration', JSON.stringify({ pxPerMm: px, cameraFovDeg: 65 }));
  }, PX_PER_MM);
}

async function axeClean(page: Page, label: string, project: string) {
  // let entry animations (the save toast fades in) finish: axe measures contrast mid-fade otherwise
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const axe = await runAxe(page);
  console.log(`[axe] ${project} ${label}: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`);
  expect(axe.seriousOrCritical).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
}

interface ObsSvc {
  healthService: {
    observations(q: { crewId: string; signalId: string; fromDay?: number }): Promise<
      Array<{ value: number | null; missionDay: number; context?: { eye?: string; withGlasses?: boolean }; source: { label: string; method?: string }; components?: Record<string, number>; attachments?: Array<{ kind: string; ref: string }> }>
    >;
  };
}

async function openAmsler(page: Page, script: 'peripheral' | 'central') {
  await page.goto(`/lab/vision?visionTest=1&amslerScript=${script}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Vision check' })).toBeVisible();
  await expect(page.getByTestId('vision-screening')).toHaveText('Screening only — not a diagnosis.');
  await expect(page.getByTestId('vision-test-mode').first()).toContainText('TEST MODE — scripted input');
  await page.getByRole('button', { name: /Amsler grid/ }).click();
  await expect(page.getByRole('heading', { name: 'Screen calibration' })).toBeVisible();
  await page.getByRole('button', { name: 'Use this calibration' }).click();
  await page.getByRole('button', { name: 'I measured the distance with a ruler' }).click();
  await expect(page.getByRole('heading', { name: 'Right eye — Amsler grid' })).toBeVisible();
}

test('Amsler: 2 new peripheral cells vs a 0-cell baseline → WATCH "new area since last test"; grid = 100 mm', async ({ page }, info) => {
  const errors = collectErrors(page);
  await calibrate(page);
  await signInAs(page, 'crew', 'c3'); // K. Osei: simulated Amsler history of 0 cells per eye
  await openAmsler(page, 'peripheral');
  await expect(page.getByText('Measuring: K. Osei').first()).toBeVisible();

  const grid = page.getByTestId('amsler-grid');
  await expect(grid).toHaveAttribute('data-grid-mm', '100');
  await expect(grid).toHaveAttribute('data-grid-px', String(100 * PX_PER_MM));
  const box = await grid.locator('canvas').boundingBox();
  expect(box?.width).toBeCloseTo(100 * PX_PER_MM, 0);
  expect(box?.height).toBeCloseTo(100 * PX_PER_MM, 0);
  await page.screenshot({ path: `test-results/vision-amsler-grid-${info.project.name}.png` });
  await axeClean(page, 'amsler grid', info.project.name);

  // Keyboard path: cursor starts at row 10 / col 10 (1-based) → move to row 1, col 1; Space marks; → Space.
  const canvas = grid.locator('canvas');
  await canvas.focus();
  for (let i = 0; i < 9; i += 1) await page.keyboard.press('ArrowUp');
  for (let i = 0; i < 9; i += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('amsler-cursor')).toHaveText('Row 1, column 1: wavy.');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('amsler-marked-count')).toHaveAttribute('data-count', '2');
  await page.getByRole('button', { name: 'Done with this eye' }).click();
  await expect(page.getByRole('heading', { name: 'Left eye — Amsler grid' })).toBeVisible();
  await page.getByRole('button', { name: 'All lines look straight — next' }).click();

  await expect(page.getByRole('heading', { name: 'Amsler result' })).toBeVisible();
  await expect(page.getByTestId('amsler-count-right')).toHaveAttribute('data-raw', '2');
  await expect(page.getByTestId('vision-verdict-pending')).toBeVisible();
  await axeClean(page, 'amsler result (before save)', info.project.name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved for K. Osei, mission day 143 — labeled SIMULATED (scripted test mode).')).toBeVisible();

  const verdict = page.getByTestId('vision-verdict');
  await expect(verdict).toHaveAttribute('data-verdict', 'WATCH');
  await expect(page.getByTestId('amsler-diff-right')).toContainText('new area since last test');
  await expect(page.getByTestId('amsler-new-right')).toHaveAttribute('data-raw', '2');
  await expect(page.getByTestId('vision-action')).toHaveText('Schedule imaging/remote eye exam.');
  await expect(page.getByRole('link', { name: 'Open protocol' })).toHaveAttribute('href', /\/handbook\/vision-change$/);
  await page.screenshot({ path: `test-results/vision-amsler-result-${info.project.name}.png`, fullPage: true });
  await axeClean(page, 'amsler result (saved)', info.project.name);

  const obs = await page.evaluate(async (path: string) => {
    const svc = (await import(/* @vite-ignore */ path)) as ObsSvc;
    return (await svc.healthService.observations({ crewId: 'c3', signalId: 'amsler', fromDay: 143 })).filter((o) => o.source.label === 'SIMULATED' && o.source.method?.startsWith('Amsler grid (on-screen)'));
  }, '/src/services/healthService.ts');
  expect(obs).toHaveLength(2);
  const right = obs.find((o) => o.context?.eye === 'right');
  expect(right?.value).toBe(2);
  expect(right?.components).toMatchObject({ newCells: 2, newCentralCells: 0 });
  expect(right?.attachments?.[0]?.kind).toBe('amsler-map');
  console.log(`[vision] peripheral: verdict WATCH, components ${JSON.stringify(right?.components)}`);
  expect(errors).toEqual([]);
});

test('Amsler: a central cell → ACT', async ({ page }) => {
  const errors = collectErrors(page);
  await calibrate(page);
  await signInAs(page, 'crew', 'c3');
  await openAmsler(page, 'central');
  await page.getByTestId('vision-script-marks').click();
  await expect(page.getByTestId('amsler-marked-count')).toHaveAttribute('data-count', '1');
  await page.getByRole('button', { name: 'Done with this eye' }).click();
  await page.getByRole('button', { name: 'All lines look straight — next' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('vision-verdict')).toHaveAttribute('data-verdict', 'ACT');
  await expect(page.getByTestId('amsler-diff-right')).toContainText('new area since last test');
  const action = await page.getByTestId('vision-action').textContent();
  console.log(`[vision] central: verdict ACT, action "${action}"`);
  expect(errors).toEqual([]);
});

test('Near acuity: scripted run saves two per-eye observations with withGlasses', async ({ page }, info) => {
  const errors = collectErrors(page);
  await calibrate(page);
  await signInAs(page, 'crew', 'c3');
  await page.goto('/lab/vision?visionTest=1&acuitySeed=7');
  await page.getByRole('button', { name: /Near acuity/ }).click();
  await page.getByRole('button', { name: 'Use this calibration' }).click();
  await page.getByRole('button', { name: 'Yes, with glasses' }).click();
  await expect(page.getByText('This is an intermediate-distance screen test, not a 40-cm near card.')).toBeVisible();
  await page.getByRole('button', { name: 'I measured the distance with a ruler' }).click();
  await expect(page.getByRole('heading', { name: 'Right eye — near acuity' })).toBeVisible();
  await expect(page.getByTestId('acuity-position')).toHaveAttribute('data-logmar', '1');
  // one real key answer, then the script
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('acuity-position')).toContainText('letter 2 of 5');
  await page.screenshot({ path: `test-results/vision-acuity-${info.project.name}.png` });
  await axeClean(page, 'acuity test', info.project.name);
  await page.getByTestId('vision-script-answers').click();
  await expect(page.getByRole('heading', { name: 'Left eye — near acuity' })).toBeVisible();
  await page.getByTestId('vision-script-answers').click();
  await expect(page.getByRole('heading', { name: 'Near acuity result' })).toBeVisible();
  const right = Number(await page.getByTestId('acuity-score-right').getAttribute('data-raw'));
  const left = Number(await page.getByTestId('acuity-score-left').getAttribute('data-raw'));
  console.log(`[vision] acuity scores right ${right} left ${left}`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Saved for K\. Osei, mission day 143/)).toBeVisible();
  const verdict = page.getByTestId('vision-verdict');
  await expect(verdict).toBeVisible();
  console.log(`[vision] acuity verdict ${await verdict.getAttribute('data-verdict')}`);
  await axeClean(page, 'acuity result', info.project.name);
  const obs = await page.evaluate(async (path: string) => {
    const svc = (await import(/* @vite-ignore */ path)) as ObsSvc;
    return (await svc.healthService.observations({ crewId: 'c3', signalId: 'near_acuity', fromDay: 143 })).filter((o) => o.source.label === 'SIMULATED' && o.source.method?.startsWith('Tumbling E (on-screen)'));
  }, '/src/services/healthService.ts');
  expect(obs).toHaveLength(2);
  expect(obs.map((o) => o.context).sort((a, b) => String(a?.eye).localeCompare(String(b?.eye)))).toEqual([
    { eye: 'left', withGlasses: true },
    { eye: 'right', withGlasses: true },
  ]);
  expect(obs.find((o) => o.context?.eye === 'right')?.value).toBe(right);
  expect(obs[0]?.source.method).toMatch(/seed \d+/);
  expect(errors).toEqual([]);
});

test('Lab hub: the vision tile is live and opens the flow; menu + calibration screens pass axe', async ({ page }, info) => {
  const errors = collectErrors(page);
  await signInAs(page, 'crew', 'c3');
  await page.goto('/lab');
  await page.getByRole('link', { name: 'Start Vision check' }).click();
  await expect(page).toHaveURL(/\/lab\/vision$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Vision check' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'About the ISS laptop vision tests and SANS' })).toHaveAttribute('href', /\/handbook\/measure-vision-check$/);
  await axeClean(page, 'vision menu', info.project.name);
  await page.getByRole('button', { name: /Amsler grid/ }).click();
  // not calibrated on this device → the Settings calibration inline
  await expect(page.getByTestId('calibration-card')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Press “Save calibration” first, then continue.')).toBeVisible();
  await page.getByRole('button', { name: 'Save calibration' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Viewing distance' })).toBeVisible();
  await expect(page.getByText('Video stays on this device. Only the number is saved.')).toBeVisible();
  await axeClean(page, 'distance step', info.project.name);
  expect(errors).toEqual([]);
});
