/// <reference lib="dom" />
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export type DemoRole = 'crew' | 'cmo' | 'surgeon';

/** Sign in through localStorage before the app loads (same shape as useSessionStore's persisted state). */
export async function signInAs(
  page: Page,
  role: DemoRole = 'cmo',
  crewId: string | null = role === 'cmo' ? 'c4' : null,
) {
  await page.addInitScript(
    ([r, c]) => {
      if (!localStorage.getItem('argus.session')) {
        localStorage.setItem(
          'argus.session',
          JSON.stringify({ state: { role: r, crewId: c, signedIn: true }, version: 0 }),
        );
      }
    },
    [role, crewId] as const,
  );
}

/** Collect console errors and page errors. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

export interface AxeSummary {
  total: number;
  byImpact: Record<string, number>;
  ids: string[];
  seriousOrCritical: Array<{
    id: string;
    impact: string | null | undefined;
    help: string;
    targets: string[];
  }>;
}

/** Run axe (WCAG 2.0/2.1/2.2 A+AA + best practices) and summarise. */
export async function runAxe(page: Page): Promise<AxeSummary> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const byImpact: Record<string, number> = {};
  for (const v of results.violations)
    byImpact[v.impact ?? 'unknown'] = (byImpact[v.impact ?? 'unknown'] ?? 0) + v.nodes.length;
  const seriousOrCritical = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    }));
  const ids = results.violations.map(
    (v) =>
      `${v.id}(${v.impact}):${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(',')}`,
  );
  return {
    total: results.violations.reduce((n, v) => n + v.nodes.length, 0),
    byImpact,
    seriousOrCritical,
    ids,
  };
}

/** Every visible interactive element smaller than `min` px in either dimension. */
export async function smallTargets(page: Page, min = 44): Promise<string[]> {
  return page.evaluate((m) => {
    const sel =
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="slider"], [role="tab"], [role="radio"], [role="switch"], [tabindex]:not([tabindex="-1"])';
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel)) as HTMLElement[]) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || style.display === 'none')
        continue;
      // visually-hidden helpers (skip link before focus) are 1 px by design
      if (r.width <= 1 && r.height <= 1) continue;
      // focusable regions (tab panels, scroll containers) are not pointer targets
      if (el.getAttribute('role') === 'tabpanel') continue;
      // a native input covered by its label: measure the label
      const box =
        el instanceof HTMLInputElement && style.opacity === '0' && el.parentElement
          ? el.parentElement.getBoundingClientRect()
          : r;
      if (box.width < m - 0.5 || box.height < m - 0.5) {
        const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? el.tagName;
        out.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(box.width)}×${Math.round(box.height)}`);
      }
    }
    return out;
  }, min);
}

/**
 * Wait until the screen has its real data: the boot placeholder and every design-system Skeleton (role="status"
 * with pulsing bars) are gone. Data arrives asynchronously from IndexedDB; layout checks (axe target-size, which
 * also looks at overlap with the sticky scrubber) must not run against a half-loaded page.
 */
export async function waitForData(page: Page, timeout = 20_000) {
  await expect(page.getByTestId('data-boot-loading')).toHaveCount(0, { timeout });
  await expect(page.locator('[role="status"] > .animate-pulse')).toHaveCount(0, { timeout });
}
