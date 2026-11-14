/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { collectErrors, runAxe, signInAs, smallTargets } from './helpers';

/** Make WebGL unavailable before the app loads (FR-BODY-6 fallback check). */
async function disableWebgl(page: Page) {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith('webgl')) return null;
      return (orig as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

const heartRegion = (page: Page) => page.locator('[data-region="heart"]');

async function openBody(page: Page, path = '/body/c3') {
  await signInAs(page, 'cmo');
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'K. Osei' })).toBeVisible();
}

// SwiftShader (software WebGL) makes the 3D page CPU-heavy when many tests run in parallel: generous timeouts.
// The 3D test took 1.6 min (> 90 s) twice with the full suite at load average 30–38 on 8 cores.
test.describe.configure({ timeout: 180_000 });
const SLOW = { timeout: 20_000 };

async function expectHeartCardActionFirst(page: Page) {
  const card = page.locator('[data-signal="heart_rate_rest"]');
  const toggle = card.getByRole('button', { expanded: true });
  await expect(toggle).toBeVisible(SLOW);
  const detailId = await toggle.getAttribute('aria-controls');
  const detail = page.locator(`[id="${detailId}"]`);
  // FR-SIG-4 step 1: the first child of the expanded detail is the "Do this next" action card.
  const first = detail.locator(':scope > div > *').first();
  await expect(first).toHaveAttribute('aria-label', 'Do this next', SLOW);
  await expect(first).toContainText('Tell the CMO. Check temperature and symptoms.', SLOW);
}

test('3D body at /body/c3 as CMO: lens colours, hotspot click opens the heart-rate card', async ({
  page,
}, info) => {
  const errors = collectErrors(page);
  await openBody(page);
  await expect(page.locator('[data-view="3d"]')).toBeVisible();
  await expect(page.getByTestId('body-canvas').locator('canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('credit-caption')).toHaveText(
    'Reference body, not a scan of this person: HRA 3D Reference Organs (Visible Human), HuBMAP, CC BY 4.0.',
  );

  const lens = page.getByRole('radiogroup', { name: 'Layer lens' });
  await expect(heartRegion(page)).toHaveAttribute('data-verdict', 'ACT');
  for (const [name, verdict] of [
    ['Earth', 'NOMINAL'],
    ['Space', 'NOMINAL'],
    ['Personal', 'ACT'],
    ['Combined', 'ACT'],
  ] as const) {
    await lens.getByRole('radio', { name }).click();
    await expect(heartRegion(page)).toHaveAttribute('data-verdict', verdict, SLOW);
  }

  await page.locator('[data-hotspot="heart"]').click(SLOW);
  await expectHeartCardActionFirst(page);
  await page.screenshot({ path: test.info().outputPath(`body-3d-${info.project.name}.png`) });
  expect(errors).toEqual([]);
});

test('keyboard: the region list reaches the heart and opens its card', async ({ page }) => {
  await openBody(page);
  await expect(page.locator('[data-view="3d"]')).toBeVisible();
  const heart = page
    .getByRole('navigation', { name: 'Body regions' })
    .getByRole('button', { name: /^Heart\s*Act$/ });
  await heart.focus();
  await expect(heart).toBeVisible(); // the list shows itself on focus
  await page.keyboard.press('Enter');
  await expectHeartCardActionFirst(page);
});

test('WebGL disabled: the SVG fallback body renders and works', async ({ page }) => {
  const errors = collectErrors(page);
  await disableWebgl(page);
  await openBody(page);
  await expect(page.getByTestId('body-svg')).toBeVisible();
  await expect(page.locator('[data-view="3d"]')).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Body view' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Earth' }).click();
  await expect(heartRegion(page)).toHaveAttribute('data-verdict', 'NOMINAL');
  await page.getByRole('radio', { name: 'Combined' }).click();
  await heartRegion(page).click();
  await expectHeartCardActionFirst(page);
  expect(errors).toEqual([]);
});

for (const view of ['3d', '2d'] as const) {
  test(`axe + targets on /body (${view}, heart card open)`, async ({ page }, info) => {
    if (view === '2d') await disableWebgl(page);
    await openBody(page);
    // Real data arrives asynchronously: a click before the assessments load selects the region but no signal.
    await expect(heartRegion(page)).toHaveAttribute('data-verdict', 'ACT', SLOW);
    await heartRegion(page).dispatchEvent('click');
    await expectHeartCardActionFirst(page);
    const axe = await runAxe(page);
    console.log(
      `[axe] ${info.project.name} /body/c3 ${view}: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`,
    );
    expect(axe.seriousOrCritical).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
  });
}

test('cabin row and unknown crew id render without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await signInAs(page, 'cmo');
  await page.goto('/body/cabin');
  await expect(page.getByRole('heading', { level: 1, name: 'Cabin' })).toBeVisible();
  await page.goto('/body/zz');
  await expect(page.getByText('Unknown crew member')).toBeVisible();
  expect(errors).toEqual([]);
});
