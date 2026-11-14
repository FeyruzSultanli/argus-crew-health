/// <reference lib="dom" />
// Accessibility (NFR-4, doc 11 §8): every route in every role that can open it — axe (WCAG 2.0–2.2 A/AA + best practices)
// with 0 serious/critical violations and no interactive target under 44 px. Dark theme on both projects (1440×900 and
// 1024×768); light and high-contrast at 1440×900 for the main routes. Runs on the default dev config.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { runAxe, signInAs, smallTargets } from './helpers';
import type { DemoRole } from './helpers';
import { setPrefs, type Theme } from './helpers.prefs';

const NOAA = /^https:\/\/services\.swpc\.noaa\.gov\//;

const ROUTES: Record<DemoRole, string[]> = {
  crew: [
    '/',
    '/body',
    '/trends',
    '/lab',
    '/lab/camera',
    '/lab/pvt',
    '/lab/manual',
    '/environment',
    '/earth',
    '/handbook',
    '/handbook/sleep',
    '/handbook/suspected-infection',
    '/settings',
    '/limits',
    '/crew', // not allowed for crew: the explanation screen
  ],
  cmo: [
    '/',
    '/body',
    '/body/c3',
    '/body/cabin',
    '/trends',
    '/trends/c3',
    '/lab',
    '/lab/camera',
    '/lab/pvt',
    '/lab/manual',
    '/environment',
    '/crew',
    '/earth',
    '/handbook',
    '/handbook/sleep',
    '/handbook/suspected-infection',
    '/settings',
    '/limits',
    '/no-such-page',
  ],
  surgeon: [
    '/',
    '/trends',
    '/trends/c3',
    '/environment',
    '/crew',
    '/earth',
    '/handbook',
    '/handbook/suspected-infection',
    '/settings',
    '/limits',
    '/body', // not allowed for the flight surgeon
  ],
};

const MAIN_ROUTES = ['/', '/body', '/trends', '/lab', '/environment', '/crew', '/earth', '/handbook', '/settings'];

const CREW_ID: Record<DemoRole, string | null> = { crew: 'c3', cmo: 'c4', surgeon: null };

/** Console errors except the NOAA request this spec blocks on purpose (environment falls back to the snapshot). */
function collectAppErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOAA.test(m.location().url) && !/swpc\.noaa\.gov/.test(m.text()))
      errors.push(`${m.text()} @ ${m.location().url}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function settle(page: Page, path: string) {
  await page.goto(path);
  await expect(
    page.getByRole('heading', { level: 1 }).or(page.getByText('Not available for this role')).first(),
    `${path} rendered`,
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('data-boot-loading')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
}

/**
 * axe's target-size rule counts a target as "obscured" when it sits under the sticky header or the sticky
 * mission-scrubber dock at the current scroll position — content the user reaches by scrolling (and keyboard focus
 * is kept clear of both bars by `scroll-padding` in src/index.css, WCAG 2.4.11). Each flagged target is therefore
 * scrolled to the middle of the viewport and checked again; only a target that still fails there is a violation.
 * Every target that passed only after scrolling is logged as a sticky-bar artefact, never silently dropped.
 */
async function recheckTargetSize(page: Page): Promise<{ real: string[]; artefacts: string[] }> {
  const all = await new AxeBuilder({ page }).withRules(['target-size']).analyze();
  const real: string[] = [];
  const artefacts: string[] = [];
  for (const node of all.violations.flatMap((v) => v.nodes)) {
    const sel = node.target.join(' ');
    const el = page.locator(sel).first();
    await el.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
    const again = await new AxeBuilder({ page }).include(sel).withRules(['target-size']).analyze();
    if (again.violations.length > 0) real.push(`${sel}: ${node.failureSummary?.replace(/\s+/g, ' ') ?? ''}`);
    else artefacts.push(sel);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return { real, artefacts };
}

async function sweep(page: Page, label: string, paths: string[]): Promise<string[]> {
  const failures: string[] = [];
  for (const path of paths) {
    await settle(page, path);
    const axe = await runAxe(page);
    const small = await smallTargets(page);
    let note = '';
    for (const v of axe.seriousOrCritical) {
      if (v.id === 'target-size') {
        const { real, artefacts } = await recheckTargetSize(page);
        for (const r of real) failures.push(`${path} axe target-size (${v.impact}): ${r}`);
        if (artefacts.length) note = ` · target-size only under a sticky bar (passes when scrolled): ${artefacts.join(' | ')}`;
      } else failures.push(`${path} axe ${v.id} (${v.impact}): ${v.help} — ${v.targets.join(' | ')}`);
    }
    for (const s of small) failures.push(`${path} target < 44 px: ${s}`);
    console.log(`[axe] ${label} ${path}: ${JSON.stringify(axe.byImpact)} total ${axe.total} small ${small.length}${note}`);
  }
  return failures;
}

test.describe.configure({ mode: 'parallel' });

for (const role of ['crew', 'cmo', 'surgeon'] as const) {
  test(`axe + 44-px targets, dark theme, every route as ${role}`, async ({ page, context }, info) => {
    test.setTimeout(300_000);
    await context.route(NOAA, (r) => r.abort());
    const errors = collectAppErrors(page);
    await setPrefs(page, 'dark');
    await signInAs(page, role, CREW_ID[role]);
    const failures = await sweep(page, `${info.project.name} dark ${role}`, ROUTES[role]);
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const theme of ['light', 'hc'] as const satisfies readonly Theme[]) {
  test(`axe + 44-px targets, ${theme} theme, main routes as CMO`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'light / high-contrast are checked at 1440×900');
    test.setTimeout(300_000);
    await context.route(NOAA, (r) => r.abort());
    const errors = collectAppErrors(page);
    await setPrefs(page, theme);
    await signInAs(page, 'cmo');
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const failures = await sweep(page, `${info.project.name} ${theme} cmo`, MAIN_ROUTES);
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('axe + 44-px targets, sign-in screen (signed out), dark', async ({ page }, info) => {
  const errors = collectAppErrors(page);
  await setPrefs(page, 'dark');
  const failures = await sweep(page, `${info.project.name} dark signed-out`, ['/sign-in']);
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});
