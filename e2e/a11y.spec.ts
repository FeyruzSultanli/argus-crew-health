/// <reference lib="dom" />
import { expect, test } from '@playwright/test';

import { collectErrors, runAxe, signInAs, smallTargets, waitForData } from './helpers';

const THEMES = ['dark', 'light', 'hc'] as const;

function prefs(theme: (typeof THEMES)[number], glove: boolean) {
  return { theme, gloveMode: glove, reducedMotion: true, units: { temp: 'Cel', glucose: 'mg/dL' } };
}

for (const theme of THEMES) {
  for (const glove of [false, true]) {
    test(`/dev/ui axe + targets — theme ${theme}${glove ? ' + glove' : ''}`, async ({ page }, info) => {
      const errors = collectErrors(page);
      await page.addInitScript(
        (p) => localStorage.setItem('argus.ui', JSON.stringify({ state: p, version: 1 })),
        prefs(theme, glove),
      );
      await page.goto('/dev/ui');
      await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const axe = await runAxe(page);
      console.log(
        `[axe] ${info.project.name} /dev/ui ${theme}${glove ? '+glove' : ''}: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`,
      );
      expect(axe.seriousOrCritical).toEqual([]);
      const small = await smallTargets(page, glove ? 56 : 44);
      expect(small).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

for (const path of ['/', '/environment', '/sign-in']) {
  test(`shell axe + targets at ${path}`, async ({ page }, info) => {
    const errors = collectErrors(page);
    if (path !== '/sign-in') await signInAs(page, 'cmo');
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await waitForData(page);
    const axe = await runAxe(page);
    console.log(
      `[axe] ${info.project.name} ${path}: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`,
    );
    expect(axe.seriousOrCritical).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('shell axe with the user menu and profile picker open', async ({ page }, info) => {
  await signInAs(page, 'cmo');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();
  await waitForData(page); // same loading race as the shell check above (plan rows under the sticky scrubber)
  await page.getByTestId('user-menu').click();
  let axe = await runAxe(page);
  console.log(
    `[axe] ${info.project.name} user menu open: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`,
  );
  expect(axe.seriousOrCritical).toEqual([]);
  expect(await smallTargets(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByTestId('mission-chip').click();
  await expect(page.getByRole('dialog', { name: 'Mission profile' })).toBeVisible();
  axe = await runAxe(page);
  console.log(
    `[axe] ${info.project.name} profile picker open: ${JSON.stringify(axe.byImpact)} total ${axe.total} ${axe.ids.join(' ')}`,
  );
  expect(axe.seriousOrCritical).toEqual([]);
});

test('themes switch live from the user menu', async ({ page }) => {
  await signInAs(page, 'cmo');
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const dark = await bg();
  await page.getByTestId('user-menu').click();
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  const light = await bg();
  await page.getByRole('radio', { name: 'High contrast' }).click();
  await expect(html).toHaveAttribute('data-theme', 'hc');
  const hc = await bg();
  expect(new Set([dark, light, hc]).size).toBe(3);
  await page.getByRole('switch', { name: /Glove mode/ }).click();
  await expect(html).toHaveAttribute('data-glove', 'true');
  const h = await page.getByTestId('user-menu').evaluate((el: Element) => el.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(56);
});

test('scrubber works with the keyboard and updates the mission chip', async ({ page }) => {
  await signInAs(page, 'cmo');
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Mission day' });
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuenow', '142');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuenow', '135');
  await expect(page.getByTestId('mission-chip')).toContainText('MD 135');
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '-180');
  await expect(page.getByTestId('mission-chip')).toContainText('L-180');
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '143');
  // drag: click near the left third lands in pre-flight
  const box = await slider.boundingBox();
  if (!box) throw new Error('no slider box');
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height / 2);
  const v = Number(await slider.getAttribute('aria-valuenow'));
  expect(v).toBeLessThan(0);
});
