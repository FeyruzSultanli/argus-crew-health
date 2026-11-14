/// <reference lib="dom" />
// Preference and focus helpers for the accessibility, keyboard and production-build specs.
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export type Theme = 'dark' | 'light' | 'hc';

/** Persisted UI preferences (same shape as e2e/a11y.spec.ts): theme, reduced motion so axe never sees mid-animation. */
export async function setPrefs(page: Page, theme: Theme) {
  await page.addInitScript(
    (t) =>
      localStorage.setItem(
        'argus.ui',
        JSON.stringify({
          state: { theme: t, gloveMode: false, reducedMotion: true, units: { temp: 'Cel', glucose: 'mg/dL' } },
          version: 1,
        }),
      ),
    theme,
  );
}

/** Press Tab until `target` has focus (keyboard-only navigation); fails after `max` presses. */
export async function tabTo(page: Page, target: Locator, max = 80, key: 'Tab' | 'Shift+Tab' = 'Tab') {
  const handle = await target.elementHandle();
  if (!handle) throw new Error('tabTo: target not found');
  for (let i = 0; i < max; i++) {
    if (await handle.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
  }
  await expect(target, `reachable with ${key} within ${max} presses`).toBeFocused();
}

/** The focused element must show a visible focus indicator (outline or box-shadow ring). */
export async function hasFocusRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
    return outline || (s.boxShadow !== 'none' && s.boxShadow !== '');
  });
}
