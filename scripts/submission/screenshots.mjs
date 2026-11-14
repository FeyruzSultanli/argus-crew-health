// Submission screenshots → docs/submission/screenshots/NN-name.png (index: README.md in that folder).
// Real app, real state, no post-editing (only lossless PNG re-compression). Dark theme, CMO unless stated.
//
//   npm run build && npx vite preview --port 5175 --strictPort      # in one terminal
//   node scripts/submission/screenshots.mjs [filter]                  # filter = substring of a shot name
//
// Env: ARGUS_URL (default http://localhost:5175), SHOT_DSF (device scale factor, default 1).
// NOAA: the Environment screen fetches the real NOAA feed; whatever badge it shows (LIVE / CACHED / SNAPSHOT /
// REPLAY) is what the screenshot shows. Nothing is mocked.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import * as L from './lib.mjs';

const { expect } = L;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'submission', 'screenshots');
const DSF = Number(process.env.SHOT_DSF ?? 1);
const FILTER = process.argv[2] ?? '';
mkdirSync(OUT, { recursive: true });

const browser = await L.chromium.launch({
  // Hardware WebGL for the 3D body (headless Chromium on macOS: ANGLE/Metal); SwiftShader is the fallback.
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const errors = [];
const taken = [];

async function save(page, name, opts = {}) {
  const file = join(OUT, `${name}.png`);
  const raw = await page.screenshot({ ...opts, animations: 'disabled' });
  // Lossless re-compression only (same pixels).
  const png = await sharp(raw).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
  writeFileSync(file, png.length < raw.length ? png : raw);
  const kb = Math.round(Math.min(png.length, raw.length) / 1024);
  taken.push(`${name}.png ${kb} kB`);
  console.log(`  saved ${name}.png (${kb} kB)`);
}

async function session(viewport = { width: 1920, height: 1080 }, who = 'CMO') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: DSF });
  await L.setPrefs(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`);
  });
  await L.signIn(page, who);
  await L.waitForData(page);
  return { context, page };
}

const want = (name) => !FILTER || name.includes(FILTER);

// ---------------------------------------------------------------------------------------------------------------
// Sign-in screen (before signing in)
if (want('sign-in')) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: DSF });
  await L.setPrefs(context);
  const page = await context.newPage();
  await page.goto(`${L.BASE}/sign-in`);
  await expect(page.getByRole('heading', { level: 1, name: 'Choose who you are' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('radio', { name: /^CMO/ }).check();
  await page.getByLabel('Demo PIN').fill('2026');
  await page.getByLabel('Demo PIN').blur();
  await save(page, '01-sign-in');
  await context.close();
}

// ---------------------------------------------------------------------------------------------------------------
const { context, page } = await session();
const heart = page.locator('[data-region="heart"]');

if (want('bridge')) {
  await L.open(page, '/', 'Mission Bridge');
  await expect(page.getByTestId('mission-chip')).toContainText('MD 143');
  const osei = page.getByTestId('crew-row-c3');
  await expect(osei).toHaveAttribute('data-verdict', 'ACT', { timeout: 20_000 });
  await expect(osei).toContainText('Caught only by personal baseline');
  await L.expectSimulatedBadge(page);
  await L.sleep(800);
  await save(page, '02-bridge-cmo-md143');
}

async function openBodyHeart(lens) {
  await L.open(page, '/body/c3');
  await L.waitForBody(page);
  await expect(heart).toHaveAttribute('data-verdict', 'ACT', { timeout: 20_000 });
  await heart.dispatchEvent('click'); // region list mirrors the 3D hotspot (e2e/demo.spec.ts)
  const card = page.locator('[data-signal="heart_rate_rest"]');
  await expect(card.getByRole('button', { expanded: true })).toBeVisible({ timeout: 20_000 });
  const lensGroup = page.getByRole('radiogroup', { name: 'Layer lens' });
  await lensGroup.getByRole('radio', { name: lens }).click();
  const expected = { Earth: 'NOMINAL', Space: 'NOMINAL', Personal: 'ACT', Combined: 'ACT' }[lens];
  await expect(heart).toHaveAttribute('data-verdict', expected, { timeout: 20_000 });
  await L.expectSimulatedBadge(page);
  await page.mouse.move(5, 600); // keep the pointer off the scene (no hover tooltips)
  await L.sleep(2500); // let the 3D colour transition settle
  return card;
}

for (const [n, lens] of [
  ['03', 'Earth'],
  ['04', 'Space'],
  ['05', 'Personal'],
  ['06', 'Combined'],
]) {
  const name = `${n}-body-c3-lens-${lens.toLowerCase()}`;
  if (!want(name)) continue;
  await openBodyHeart(lens);
  await save(page, name);
}

if (want('07-heart-card')) {
  const card = await openBodyHeart('Personal');
  await card.scrollIntoViewIfNeeded();
  // Expanded detail: action first, three layers, band chart. Element shot of the card plus a full viewport shot.
  await save(page, '07-heart-card-expanded');
  await card.screenshot({ path: join(OUT, '07b-heart-card-detail.png'), animations: 'disabled' });
  taken.push('07b-heart-card-detail.png');
}

if (want('trends')) {
  await L.open(page, '/trends/c3', 'Trends');
  const hr = page.getByTestId('trend-heart_rate_rest');
  await expect(hr.locator('[data-trend-svg]')).toBeVisible({ timeout: 30_000 });
  await expect(hr.getByTestId('flag-heart_rate_rest-act-143')).toBeVisible();
  await expect(hr.locator('[data-testid="marker-act-143"]')).toHaveCount(1);
  await L.expectSimulatedBadge(page);
  await L.sleep(800);
  await save(page, '08-trends-c3-heart-rate-act');
}

if (want('lab')) {
  await L.open(page, '/lab', 'Measurement Lab');
  const picker = page.getByRole('radiogroup', { name: 'Measurement subject' });
  await picker.getByRole('radio', { name: 'K. Osei' }).click();
  await expect(page.getByText('Measuring: K. Osei').first()).toBeVisible();
  await L.sleep(800);
  await save(page, '09-lab-hub');

  await L.open(page, '/lab/camera', 'Camera pulse');
  await L.pickSubjectIfAsked(page);
  await expect(page.getByText('Video stays on this device. Only the number is saved.')).toBeVisible();
  await L.sleep(500);
  await save(page, '10-camera-pulse-privacy');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'How to measure' })).toBeVisible();
  await L.sleep(500);
  await save(page, '11-camera-pulse-how-to');

  await L.open(page, '/lab/pvt?pvtTest=1&pvtProfile=slow', 'Reaction Self-Test');
  await L.pickSubjectIfAsked(page);
  await expect(page.getByTestId('pvt-test-mode').first()).toContainText('TEST MODE — scripted responses');
  await page.getByRole('button', { name: 'Start 3-minute test' }).click();
  await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('pvt-test-mode').first()).toBeVisible();
  await L.sleep(800);
  await save(page, '12-reaction-test-result-test-mode'); // not saved: no Save click
}

if (want('environment')) {
  await L.open(page, '/environment?replaySpeed=3600');
  await expect(page.getByRole('heading', { name: 'Radiation & cabin' })).toBeVisible();
  const badge = page.getByTestId('data-mode-bar').getByTestId('space-weather-badge');
  await expect(badge).toHaveText(/LIVE|CACHED|SNAPSHOT/, { timeout: 20_000 });
  await L.sleep(1500);
  console.log(`  environment mode before replay: ${(await badge.innerText()).trim()}`);
  await save(page, '13-environment-before-replay');

  await page.getByRole('button', { name: 'Replay SPE' }).click();
  await expect(badge).toHaveText(/REPLAY/);
  await expect(page.getByTestId('s-level')).toHaveText('S2', { timeout: 20_000 });
  await page.getByRole('radio', { name: '600×', exact: true }).click(); // slow down so S2 holds (e2e approach)
  const banner = page.getByTestId('shelter-banner');
  await expect(banner.getByTestId('shelter-text')).toHaveText('Shelter advised.');
  await expect(banner).toContainText('synthetic S2-class profile (demo), not a recorded event');
  await expect(page.getByTestId('s-scale-tile')).toContainText('REPLAY');
  await expect(async () => {
    const v = Number((await page.getByTestId('dose-spe-c4').innerText()).match(/[\d.]+/)?.[0]);
    expect(v).toBeGreaterThan(0);
  }).toPass({ timeout: 10_000 });
  await page.getByRole('radio', { name: '60×', exact: true }).click(); // hold S2 while capturing
  await L.sleep(600);
  await expect(page.getByTestId('s-level')).toHaveText('S2');
  await save(page, '14-environment-replay-s2');
  await save(page, '14b-environment-replay-s2-full', { fullPage: true });
  await page.getByTestId('dose-ledger').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('dose-ledger')).toContainText('Modeled — illustrative');
  await L.sleep(400);
  await save(page, '15-environment-replay-dose-ledger');
  await page.getByRole('button', { name: 'Stop replay' }).click();
  await expect(page.getByTestId('shelter-banner')).toHaveCount(0);
}

if (want('earth')) {
  await L.open(page, '/earth?crew=c3&flags=1', 'Earth link');
  await page.getByTestId('compression-control').getByRole('radio', { name: '60×' }).click();
  await expect(page.getByTestId('flag-c3-heart_rate_rest')).toContainText('Caught only by personal baseline', {
    timeout: 20_000,
  });
  await L.sleep(600);
  await save(page, '16-earth-link-composer');
  await page.getByTestId('send-packet').click();
  const card = page.getByTestId('packet-card').first();
  await expect(card.getByTestId('packet-arrival')).toHaveText('arrives in 11 min (demo: 11 s)');
  await expect(card).toHaveAttribute('data-status', 'in-transit', { timeout: 5_000 });
  await L.sleep(1500);
  await save(page, '17-earth-link-packet-in-transit');
  await expect(card).toHaveAttribute('data-status', 'delivered', { timeout: 20_000 });
  // FHIR JSON preview opened (slide 6), packet card delivered on the right.
  await page.getByText('FHIR JSON preview', { exact: true }).first().click();
  await page.getByText('FHIR JSON preview', { exact: true }).first().scrollIntoViewIfNeeded();
  await L.sleep(600);
  await save(page, '17b-earth-link-fhir-preview');

  // Flight surgeon: a second tab of the same browser profile (as e2e/earthlink.spec.ts).
  const surgeon = await context.newPage();
  surgeon.on('pageerror', (e) => errors.push(`surgeon: ${e.message}`));
  await L.signIn(surgeon, 'Flight surgeon');
  await L.open(surgeon, '/earth', 'Earth link');
  await expect(surgeon.getByTestId('received-packet').first()).toContainText('K. Osei', { timeout: 20_000 });
  await L.sleep(800);
  await save(surgeon, '18-surgeon-view-delivered');
  await surgeon.close();
  // the surgeon sign-in rewrote the shared session: sign the CMO back in
  await L.signIn(page, 'CMO');
}

if (want('crew')) {
  await L.open(page, '/crew', 'Crew overview');
  await expect(page.getByTestId('crew-card-c3')).toHaveAttribute('data-verdict', 'ACT', { timeout: 20_000 });
  await L.expectSimulatedBadge(page);
  await L.sleep(600);
  await save(page, '19-crew-overview');
}

if (want('handbook')) {
  await L.open(page, '/handbook', 'Handbook');
  await expect(page.getByTestId('handbook-results').getByRole('link').first()).toBeVisible();
  await L.sleep(500);
  await save(page, '20-handbook-index');
  await L.open(page, '/handbook/sleep', 'Sleep duration');
  await expect(page.getByTestId('entry-verdict').getByTestId('current-verdict')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-source-status]').first()).toBeVisible();
  await L.sleep(500);
  await save(page, '21-handbook-sleep-entry');
  await L.open(page, '/handbook/suspected-infection', 'Suspected infection');
  await expect(page.getByTestId('protocol-step')).toHaveAttribute('data-step', 's1');
  await page.keyboard.press('Space'); // step 2: shows the runner mid-protocol
  await expect(page.getByTestId('protocol-step')).toHaveAttribute('data-step', 's2');
  await L.sleep(500);
  await save(page, '22-protocol-suspected-infection-step');
}

if (want('limits')) {
  await L.open(page, '/limits', 'Limits');
  await expect(page.getByTestId('limits-table')).toBeVisible();
  await expect(page.getByTestId('not-medical-device')).toBeVisible();
  await L.sleep(500);
  await save(page, '23-limits');
  await save(page, '23b-limits-full', { fullPage: true });
}

if (want('provenance')) {
  // Source drawer on a verified limit: the career dose limit on the Environment dose ledger.
  await L.open(page, '/environment');
  await expect(page.getByRole('heading', { name: 'Radiation & cabin' })).toBeVisible();
  await expect(page.getByTestId('dose-ledger')).toBeVisible({ timeout: 20_000 });
  const verified = page.getByTestId('dose-ledger').locator('button[data-source-status="verified"]').first();
  await verified.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Sources', { exact: true }).first()).toBeVisible();
  await L.sleep(800);
  await save(page, '24-source-drawer-provenance');
  await page.keyboard.press('Escape');

  // "Demo parameter" tag: hover the demo-status badge next to the modeled Earth delay on the Bridge.
  await L.open(page, '/', 'Mission Bridge');
  const demoBadge = page.getByTestId('earth-delay').locator('button[data-source-status="demo"]').first();
  await demoBadge.scrollIntoViewIfNeeded();
  await demoBadge.hover();
  await expect(page.getByText('Demo parameter', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await L.sleep(600);
  await save(page, '25-demo-parameter-tag');
}

if (want('settings')) {
  await L.open(page, '/settings?demo=1', 'Settings');
  await page.getByRole('button', { name: /Jump to scenario: Silent infection/ }).click();
  await expect(page.getByTestId('scenario-result')).toContainText('K. Osei selected');
  await page.getByTestId('demo-controls').scrollIntoViewIfNeeded();
  await L.sleep(500);
  await save(page, '26-settings-demo-controls');
}
// Vision check, scripted test mode: menu, calibration, Amsler grid with 2 scripted peripheral marks, result
// after Save (WATCH + "new area since last test"), near-acuity optotype. The fresh profile is not calibrated: the
// calibration is saved at its default slider value (headless screen, no card) — the screenshots show the flow, not a
// physically calibrated grid.
if (want('vision')) {
  await L.open(page, '/lab/vision?visionTest=1&amslerScript=peripheral', 'Vision check');
  await L.pickSubjectIfAsked(page);
  await expect(page.getByTestId('vision-screening')).toHaveText('Screening only — not a diagnosis.');
  await expect(page.getByTestId('vision-test-mode').first()).toContainText('TEST MODE — scripted input');
  await L.expectSimulatedBadge(page);
  await L.sleep(500);
  await save(page, '31-vision-check-menu');
  await page.getByRole('button', { name: /Amsler grid/ }).click();
  await expect(page.getByRole('heading', { name: 'Screen calibration' })).toBeVisible();
  await L.sleep(500);
  await save(page, '32-vision-screen-calibration');
  await page.getByRole('button', { name: 'Save calibration' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'I measured the distance with a ruler' }).click();
  await expect(page.getByRole('heading', { name: 'Right eye — Amsler grid' })).toBeVisible();
  await page.getByTestId('vision-script-marks').click();
  await expect(page.getByTestId('amsler-marked-count')).toHaveAttribute('data-count', '2');
  await page.mouse.move(5, 500);
  await L.sleep(500);
  await save(page, '33-amsler-grid-two-marks-test-mode');
  await page.getByRole('button', { name: 'Done with this eye' }).click();
  await expect(page.getByRole('heading', { name: 'Left eye — Amsler grid' })).toBeVisible();
  await page.getByRole('button', { name: 'All lines look straight — next' }).click();
  await expect(page.getByRole('heading', { name: 'Amsler result' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('vision-verdict')).toHaveAttribute('data-verdict', 'WATCH', { timeout: 20_000 });
  await expect(page.getByTestId('amsler-diff-right')).toContainText('new area since last test');
  await expect(page.getByTestId('vision-test-mode').first()).toBeVisible();
  await L.sleep(800);
  await save(page, '34-amsler-result-watch-new-area');
  await save(page, '34b-amsler-result-watch-full', { fullPage: true });

  await L.open(page, '/lab/vision?visionTest=1&acuitySeed=7', 'Vision check');
  await L.pickSubjectIfAsked(page);
  await page.getByRole('button', { name: /Near acuity/ }).click();
  await page.getByRole('button', { name: 'Use this calibration' }).click();
  await page.getByRole('button', { name: 'Yes, with glasses' }).click();
  await page.getByRole('button', { name: 'I measured the distance with a ruler' }).click();
  await expect(page.getByRole('heading', { name: 'Right eye — near acuity' })).toBeVisible();
  await page.mouse.move(5, 500);
  await L.sleep(500);
  await save(page, '35-near-acuity-optotype');
}

// Face fluid-shift scan, experimental: explainer and how-to only — the result needs a real face.
if (want('face')) {
  await L.open(page, '/lab/face', 'Face fluid-shift scan');
  await L.pickSubjectIfAsked(page);
  await expect(page.getByText('Experimental — not validated').first()).toBeVisible();
  await L.sleep(500);
  await save(page, '36-face-scan-explainer');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'How to scan' })).toBeVisible();
  await expect(page.getByText('Experimental — not validated').first()).toBeVisible();
  await L.sleep(500);
  await save(page, '37-face-scan-how-to');
  console.log(`  "No image is saved" visible on how-to: ${await page.getByText('No image is saved. Only the numbers are stored.').first().isVisible().catch(() => false)}`);
}
await context.close();

// ---------------------------------------------------------------------------------------------------------------
// Tablet (1024×768) for the README
if (want('tablet')) {
  const t = await session({ width: 1024, height: 768 });
  await L.open(t.page, '/', 'Mission Bridge');
  await expect(t.page.getByTestId('crew-row-c3')).toHaveAttribute('data-verdict', 'ACT', { timeout: 20_000 });
  await L.sleep(800);
  await save(t.page, '27-tablet-bridge');
  await L.open(t.page, '/body/c3');
  await L.waitForBody(t.page);
  await t.page.getByRole('radiogroup', { name: 'Layer lens' }).getByRole('radio', { name: 'Personal' }).click();
  await expect(t.page.locator('[data-region="heart"]')).toHaveAttribute('data-verdict', 'ACT', { timeout: 20_000 });
  await t.page.getByTestId('body-canvas').scrollIntoViewIfNeeded();
  await t.page.mouse.move(5, 400);
  await L.sleep(2500);
  await save(t.page, '28-tablet-body');
  await L.open(t.page, '/environment');
  await expect(t.page.getByTestId('data-mode-bar').getByTestId('space-weather-badge')).toHaveText(
    /LIVE|CACHED|SNAPSHOT/,
    { timeout: 20_000 },
  );
  await L.sleep(1200);
  await save(t.page, '29-tablet-environment');
  await t.context.close();
}

await browser.close();
console.log(`\n${taken.length} files`);
if (errors.length) console.log(`console/page errors:\n  ${errors.join('\n  ')}`);
else console.log('no console or page errors');
