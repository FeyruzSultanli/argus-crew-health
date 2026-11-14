/// <reference lib="dom" />
// Performance (doc 05 §10, NFR-2): numbers on the production build, measured with PerformanceObserver —
// Bridge FCP / LCP / CLS on a cold load (no service worker yet), JS the Bridge loads (gzip, from dist/), and the
// longest main-thread task while navigating between routes with the header links (client-side navigation).
// Runs only under playwright.prod.config.ts. Headless Chromium renders WebGL in software (SwiftShader), so the Body
// route's numbers are pessimistic; a check on a real GPU is still to be done by hand.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import { expect, test } from '@playwright/test';

import { signInAs } from './helpers';

test.skip(process.env.ARGUS_E2E_PROD !== '1', 'needs the production build: playwright.prod.config.ts');

const NOAA = /^https:\/\/services\.swpc\.noaa\.gov\//;

function baseOf(): string {
  const b = test.info().config.metadata?.base;
  return typeof b === 'string' ? b : '/';
}

declare global {
  interface Window {
    __perf: { longTasks: Array<{ start: number; duration: number }>; lcp: number; cls: number };
  }
}

test('Bridge cold load and route navigation: FCP, LCP, CLS, initial JS, long tasks', async ({ page, context }) => {
  test.setTimeout(180_000);
  const base = baseOf();
  await context.route(NOAA, (r) => r.abort());
  // cold: measure without the service worker (first visit)
  await context.addInitScript(() => {
    window.__perf = { longTasks: [], lcp: 0, cls: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.longTasks.push({ start: e.startTime, duration: e.duration });
    }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>)
        if (!e.hadRecentInput) window.__perf.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const js: string[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() === 'script' && r.url().includes('/assets/')) js.push(r.url());
  });
  await signInAs(page, 'cmo');
  await page.goto(base);
  await expect(page.getByRole('heading', { level: 1, name: 'Mission Bridge' })).toBeVisible();
  await expect(page.getByTestId('crew-at-a-glance')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  const load = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      fcp: Math.round(fcp),
      lcp: Math.round(window.__perf.lcp),
      cls: Number(window.__perf.cls.toFixed(4)),
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? -1),
      longest: Math.round(Math.max(0, ...window.__perf.longTasks.map((t) => t.duration))),
    };
  });
  const dist = resolve('dist');
  const files = [...new Set(js.map((u) => new URL(u).pathname.slice(base.length)))];
  const gz = files.map((f) => ({ f, kb: gzipSync(readFileSync(resolve(dist, f))).length / 1024 }));
  // Not on the first-paint path: motion's animation features and the SW registration load after first render by
  // design; the bundled GOES snapshot (+ DONKI fixture) is data the space-weather tile imports only because
  // this test blocks NOAA (live → cache → snapshot fallback).
  const deferred = /motionFeatures|workbox-window|virtual_pwa-register|goes-snapshot|donki-sep/;
  const sum = (xs: typeof gz) => xs.reduce((n, x) => n + x.kb, 0);
  const allKb = sum(gz);
  const initialKb = sum(gz.filter((x) => !deferred.test(x.f)));
  console.log(
    `[perf] Bridge cold: FCP ${load.fcp} ms, LCP ${load.lcp} ms, CLS ${load.cls}, DCL ${load.domContentLoaded} ms, ` +
      `longest task during load ${load.longest} ms; first-paint JS ${initialKb.toFixed(1)} kB gzip, all JS loaded by ` +
      `the Bridge ${gz.length} files ${allKb.toFixed(1)} kB gzip: ` +
      gz.map((x) => `${x.f.replace('assets/', '')} ${x.kb.toFixed(1)}`).join(', '),
  );

  // client-side navigation through the header; long tasks measured per hop
  const hops = ['Body', 'Trends', 'Lab', 'Environment', 'Crew', 'Earth', 'Handbook', 'Bridge'];
  const nav = page.getByRole('navigation', { name: 'Main' });
  const results: Array<{ to: string; ms: number; longest: number }> = [];
  for (const to of hops) {
    const mark = await page.evaluate(() => performance.now());
    const t0 = Date.now();
    await nav.getByRole('link', { name: to, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    const ms = Date.now() - t0;
    await page.waitForTimeout(700);
    const longest = await page.evaluate(
      (m) => Math.round(Math.max(0, ...window.__perf.longTasks.filter((t) => t.start >= m).map((t) => t.duration))),
      mark,
    );
    results.push({ to, ms, longest });
  }
  console.log(`[perf] navigation (route → settled ms / longest task ms): ${results.map((r) => `${r.to} ${r.ms}/${r.longest}`).join(', ')}`);

  // budgets (doc 05 §10, NFR-2). Body is excluded from the long-task budget here: software WebGL in headless Chromium.
  expect(initialKb, 'first-paint JS ≤ 300 kB gzip').toBeLessThanOrEqual(300);
  expect(load.lcp, 'Bridge LCP < 2.5 s').toBeLessThan(2500);
  for (const r of results.filter((x) => x.to !== 'Body'))
    expect(r.longest, `longest task navigating to ${r.to}`).toBeLessThan(200);
});
