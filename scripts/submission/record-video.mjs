// Record the demo-video shots (docs/submission/VIDEO_SCRIPT.md) as real screen recordings of the running app.
// Playwright recordVideo at 1920×1080; one clip per shot in docs/submission/video/raw/ plus raw/marks.json (the
// second, inside each clip, where the usable part starts). Assembly: scripts/submission/assemble-video.sh.
//
//   npm run build && npx vite preview --port 5175 --strictPort     (or ARGUS_URL=https://…/argus-crew-health)
//   node scripts/submission/record-video.mjs [shot …]                e.g. `… record-video.mjs body storm`
//
// Shots: body (1a + 1b), camera-explainer (no-camera cut), pvt (3), storm (4), earth (5), rotate (6).
// The real camera shot (2) cannot be automated (no face): record it by hand as video/shot-camera.mp4.
// Honesty checks are asserted while recording (SIMULATED DATA badge, REPLAY + synthetic, modeled delay, TEST MODE).
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as L from './lib.mjs';

const { expect } = L;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'docs', 'submission', 'video', 'raw');
const TMP = join(RAW, 'tmp');
mkdirSync(TMP, { recursive: true });
const MARKS = join(RAW, 'marks.json');
const marks = existsSync(MARKS) ? JSON.parse(readFileSync(MARKS, 'utf8')) : {};
const only = process.argv.slice(2);
const want = (s) => only.length === 0 || only.includes(s);

const browser = await L.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

/** A large pointer that follows the mouse (Playwright video does not capture the system cursor). */
function cursorScript() {
  const install = () => {
    if (document.getElementById('__rec_cursor')) return;
    const c = document.createElement('div');
    c.id = '__rec_cursor';
    c.innerHTML =
      '<svg width="40" height="40" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.8 L11.6 21.6 L14.6 20.3 L11.6 13.6 L18 13.4 Z" fill="#ffffff" stroke="#07090d" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {
      position: 'fixed', left: '0px', top: '0px', zIndex: '2147483647', pointerEvents: 'none',
      transform: 'translate(-6px,-3px)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))', transition: 'none',
    });
    document.documentElement.appendChild(c);
    const ring = document.createElement('div');
    Object.assign(ring.style, {
      position: 'fixed', width: '44px', height: '44px', borderRadius: '50%', border: '3px solid #2dd4bf',
      zIndex: '2147483646', pointerEvents: 'none', opacity: '0', transform: 'translate(-22px,-22px) scale(.6)',
      transition: 'opacity .35s ease-out, transform .35s ease-out',
    });
    document.documentElement.appendChild(ring);
    window.addEventListener('mousemove', (e) => { c.style.left = `${e.clientX}px`; c.style.top = `${e.clientY}px`; }, true);
    window.addEventListener('mousedown', (e) => {
      ring.style.transition = 'none';
      ring.style.left = `${e.clientX}px`; ring.style.top = `${e.clientY}px`;
      ring.style.opacity = '1'; ring.style.transform = 'translate(-22px,-22px) scale(.6)';
      requestAnimationFrame(() => {
        ring.style.transition = 'opacity .4s ease-out, transform .4s ease-out';
        ring.style.opacity = '0'; ring.style.transform = 'translate(-22px,-22px) scale(1.3)';
      });
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
}

let mouse = { x: 960, y: 540 };
async function glide(page, x, y, ms = 600) {
  const steps = Math.max(8, Math.round(ms / 16));
  const from = { ...mouse };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await L.sleep(ms / steps);
  }
  mouse = { x, y };
}
async function glideTo(page, locator, ms = 600, dx = 0.5, dy = 0.5) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('glideTo: no box');
  await glide(page, b.x + b.width * dx, b.y + b.height * dy, ms);
}
async function clickHere(page) {
  await page.mouse.down();
  await L.sleep(70);
  await page.mouse.up();
}

/**
 * One shot: sign in and prepare on a first (unrecorded-for-use) page, then a fresh recorded page does the shot.
 * `run(page, mark)` calls mark() when the usable part begins; the clip is saved as raw/<name>.webm.
 */
async function shot(name, run) {
  console.log(`● ${name}`);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: TMP, size: { width: 1920, height: 1080 } },
  });
  await L.setPrefs(context, { reducedMotion: false });
  const prep = await context.newPage();
  await L.signIn(prep, 'CMO');
  await L.waitForData(prep);
  await prep.close();
  await context.addInitScript(cursorScript);
  const page = await context.newPage();
  const started = Date.now();
  mouse = { x: 960, y: 540 };
  await page.mouse.move(mouse.x, mouse.y);
  let t0 = null;
  const mark = () => {
    t0 = (Date.now() - started) / 1000;
  };
  await run(page, mark);
  const video = page.video();
  await context.close();
  const src = await video.path();
  renameSync(src, join(RAW, `${name}.webm`));
  for (const f of [join(TMP)]) rmSync(f, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  marks[name] = { start: Math.round(t0 * 1000) / 1000, recordedAt: new Date().toISOString(), url: L.BASE };
  writeFileSync(MARKS, `${JSON.stringify(marks, null, 2)}\n`);
  console.log(`  raw/${name}.webm, usable from ${t0.toFixed(2)} s`);
}

const heartOf = (page) => page.locator('[data-region="heart"]');

// Shots 1a + 1b — Body, K. Osei: lens Earth (1 s) → Space → Personal, then the "Caught only…" marker.
if (want('body'))
  await shot('shot-1-body', async (page, mark) => {
    await L.open(page, '/body/c3');
    await L.waitForBody(page);
    await expect(heartOf(page)).toHaveAttribute('data-verdict', 'ACT', { timeout: 20_000 });
    await page.locator('[data-hotspot="heart"]').click({ timeout: 20_000 }).catch(() => heartOf(page).dispatchEvent('click'));
    const card = page.locator('[data-signal="heart_rate_rest"]');
    await expect(card.getByRole('button', { expanded: true })).toBeVisible({ timeout: 20_000 });
    const lens = page.getByRole('radiogroup', { name: 'Layer lens' });
    await lens.getByRole('radio', { name: 'Earth' }).click();
    await expect(heartOf(page)).toHaveAttribute('data-verdict', 'NOMINAL');
    await glideTo(page, lens.getByRole('radio', { name: 'Earth' }), 300);
    await L.sleep(2500);
    await L.expectSimulatedBadge(page);
    await expect(page.getByTestId('mission-chip')).toContainText('MD 143');
    mark(); // 1a: 0.0 s Earth (neutral)
    await L.sleep(1100);
    await glideTo(page, lens.getByRole('radio', { name: 'Space' }), 450);
    await clickHere(page); // 1a ~1.6 s: Space (neutral)
    await expect(heartOf(page)).toHaveAttribute('data-verdict', 'NOMINAL');
    await L.sleep(1150);
    await glideTo(page, lens.getByRole('radio', { name: 'Personal' }), 350);
    await clickHere(page); // 1b starts at 3.0 s: Personal → heart Act
    await expect(heartOf(page)).toHaveAttribute('data-verdict', 'ACT');
    await L.sleep(900);
    const marker = card.getByText('Caught only by personal baseline').first();
    await glideTo(page, marker, 900, 0.85, 0.5);
    await L.sleep(800);
    const layers = card.getByRole('group', { name: 'Layer verdicts' }).first();
    await glideTo(page, layers, 700, 0.9, 0.5);
    await L.sleep(2200);
  });

// No-camera cut, shot 2' — the camera explainer with the privacy line (no measurement is shown).
if (want('camera-explainer'))
  await shot('shot-2-camera-explainer', async (page, mark) => {
    await L.open(page, '/lab/camera', 'Camera pulse');
    await L.pickSubjectIfAsked(page);
    const privacy = page.getByText('Video stays on this device. Only the number is saved.');
    await expect(privacy).toBeVisible();
    await L.expectSimulatedBadge(page);
    await glide(page, 700, 520, 200);
    await L.sleep(800);
    mark();
    await glideTo(page, privacy, 900, 0.6, 0.5);
    await L.sleep(1800);
  });

// Shot 3 — Reaction Self-Test in scripted test mode: Start → result (not saved).
if (want('pvt'))
  await shot('shot-3-pvt', async (page, mark) => {
    await L.open(page, '/lab/pvt?pvtTest=1&pvtProfile=slow', 'Reaction Self-Test');
    await L.pickSubjectIfAsked(page);
    await expect(page.getByTestId('pvt-test-mode').first()).toContainText('TEST MODE — scripted responses (slow)');
    const start = page.getByRole('button', { name: 'Start 3-minute test' });
    await glide(page, 900, 700, 200);
    await L.sleep(800);
    mark();
    await glideTo(page, start, 500);
    await clickHere(page);
    await expect(page.getByRole('heading', { name: 'Result' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('pvt-test-mode').first()).toBeVisible();
    await L.expectSimulatedBadge(page);
    await glide(page, 1180, 300, 900);
    await L.sleep(4500);
  });

// Shot 4 — Environment, Replay SPE at 3600×: S1 ~2 s, S2 + "Shelter advised." ~3–7 s after the click.
if (want('storm'))
  await shot('shot-4-storm', async (page, mark) => {
    await L.open(page, '/environment?replaySpeed=3600');
    await expect(page.getByRole('heading', { name: 'Radiation & cabin' })).toBeVisible();
    const badge = page.getByTestId('data-mode-bar').getByTestId('space-weather-badge');
    await expect(badge).toHaveText(/LIVE|CACHED|SNAPSHOT/, { timeout: 20_000 });
    await expect(page.getByRole('radio', { name: '3600×', exact: true })).toHaveAttribute('aria-checked', 'true');
    const replay = page.getByRole('button', { name: 'Replay SPE' });
    await glide(page, 600, 400, 200);
    await L.sleep(800);
    await glideTo(page, replay, 600);
    await clickHere(page);
    mark(); // t = click; the clip uses click+1 s … click+7 s
    const clickAt = Date.now();
    await L.sleep(400);
    await expect(badge).toHaveText(/REPLAY/);
    await expect(page.getByRole('banner').getByTestId('space-weather-badge')).toHaveText(/REPLAY/);
    await glide(page, 1500, 560, 700);
    await expect(page.getByTestId('s-level')).toHaveText('S2', { timeout: 6_000 });
    const banner = page.getByTestId('shelter-banner');
    await expect(banner.getByTestId('shelter-text')).toHaveText('Shelter advised.');
    await expect(banner).toContainText('synthetic S2-class profile (demo), not a recorded event');
    await expect(page.getByTestId('s-scale-tile')).toContainText('not a recorded event');
    await expect(page.getByTestId('modeled-label')).toBeVisible();
    await L.expectSimulatedBadge(page);
    const s2At = (Date.now() - clickAt) / 1000;
    console.log(`  S2 + shelter banner on screen ${s2At.toFixed(1)} s after the click`);
    await L.sleep(Math.max(0, 7600 - (Date.now() - clickAt)));
    await expect(badge).toHaveText(/REPLAY/); // still REPLAY at the end of the window
    await page.getByRole('button', { name: 'Stop replay' }).click();
  });

// Shot 5 — Earth link: Send to flight surgeon → "arrives in 11 min (demo: 11 s)", countdown, steps.
if (want('earth'))
  await shot('shot-5-earth', async (page, mark) => {
    await L.open(page, '/earth?crew=c3&flags=1', 'Earth link');
    await page.getByTestId('compression-control').getByRole('radio', { name: '60×' }).click();
    await expect(page.getByTestId('flag-c3-heart_rate_rest')).toContainText('Caught only by personal baseline', { timeout: 20_000 });
    await expect(page.getByText('modeled delay (demo)').first()).toBeVisible();
    await L.expectSimulatedBadge(page);
    const send = page.getByTestId('send-packet');
    await send.scrollIntoViewIfNeeded();
    await glide(page, 700, 700, 200);
    await L.sleep(800);
    mark();
    await glideTo(page, send, 500);
    await clickHere(page);
    const card = page.getByTestId('packet-card').first();
    await expect(card.getByTestId('packet-arrival')).toHaveText('arrives in 11 min (demo: 11 s)');
    await expect(card).toContainText('modeled delay (demo)');
    await expect(card.getByText('Demo parameter', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await glideTo(page, card.getByTestId('packet-arrival'), 800, 0.9, 0.5);
    await expect(card).toHaveAttribute('data-status', 'in-transit', { timeout: 5_000 });
    await L.sleep(4200);
  });

// Shot 6 — Body, lens Combined, slow drag-rotate (end card is overlaid at assembly).
if (want('rotate'))
  await shot('shot-6-rotate', async (page, mark) => {
    await L.open(page, '/body/c3');
    await L.waitForBody(page);
    await page.getByRole('radiogroup', { name: 'Layer lens' }).getByRole('radio', { name: 'Combined' }).click();
    await expect(heartOf(page)).toHaveAttribute('data-verdict', 'ACT', { timeout: 20_000 });
    await L.expectSimulatedBadge(page);
    const canvas = page.getByTestId('body-canvas');
    const b = await canvas.boundingBox();
    const cx = b.x + b.width * 0.5 + 220;
    const cy = b.y + b.height * 0.5;
    await glide(page, cx, cy, 300);
    await L.sleep(1500);
    mark();
    await page.mouse.down();
    await glide(page, cx - 420, cy - 10, 4200);
    await page.mouse.up();
    await L.sleep(500);
  });

await browser.close();
rmSync(TMP, { recursive: true, force: true });
console.log(`marks: ${MARKS}`);
