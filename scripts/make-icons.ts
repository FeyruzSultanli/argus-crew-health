// Rasterise our own mark (public/icons/icon.svg) into the PWA manifest PNGs with Playwright's Chromium
// (already a dev dependency; no image library needed). Our mark only — no agency logos.
//
//   npx tsx scripts/make-icons.ts        → public/icons/icon-192.png, icon-512.png, icon-maskable-512.png,
//                                          apple-touch-icon-180.png
//
// The maskable variant puts the mark inside the 80 % safe zone on a full-bleed background (#07090D, the dark --bg
// token), so launchers that crop to a circle or squircle never cut the ring.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const dir = resolve('public/icons');
const svg = readFileSync(resolve(dir, 'icon.svg'), 'utf8');
const svgUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const BG = '#07090D';

interface Target {
  file: string;
  size: number;
  /** Fraction of the canvas the mark occupies (1 = edge to edge). */
  scale: number;
  /** Full-bleed background behind the mark (maskable icons must not be transparent). */
  bleed: boolean;
}

const TARGETS: Target[] = [
  { file: 'icon-192.png', size: 192, scale: 1, bleed: false },
  { file: 'icon-512.png', size: 512, scale: 1, bleed: false },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72, bleed: true },
  { file: 'apple-touch-icon-180.png', size: 180, scale: 0.86, bleed: true },
];

const browser = await chromium.launch();
try {
  for (const t of TARGETS) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
    const inner = Math.round(t.size * t.scale);
    await page.setContent(
      `<html><body style="margin:0;width:${t.size}px;height:${t.size}px;display:grid;place-items:center;` +
        `background:${t.bleed ? BG : 'transparent'}"><img src="${svgUri}" width="${inner}" height="${inner}"></body></html>`,
    );
    await page.locator('img').evaluate((img: HTMLImageElement) => img.decode());
    const png = await page.screenshot({ omitBackground: !t.bleed, clip: { x: 0, y: 0, width: t.size, height: t.size } });
    writeFileSync(resolve(dir, t.file), png);
    console.log(`${t.file} ${t.size}×${t.size} ${png.length} bytes`);
    await page.close();
  }
} finally {
  await browser.close();
}
