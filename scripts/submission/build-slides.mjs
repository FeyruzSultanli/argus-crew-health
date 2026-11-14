// Build the 7-slide deck: docs/submission/slides/slides.template.html + deck.config.json
//   → slides.html (fonts embedded, no network), ARGUS-slides.pdf (7 pages, 1920×1080 px), slide-1.png … slide-7.png.
// Run: npm run slides:build
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'docs', 'submission', 'slides');
const SLIDES = 7;

const config = JSON.parse(readFileSync(join(DIR, 'deck.config.json'), 'utf8'));
for (const k of ['teamName', 'members', 'liveUrl', 'repoUrl'])
  if (typeof config[k] !== 'string') throw new Error(`deck.config.json: "${k}" must be a string`);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
const todo = [];
const fill = (key, value) => {
  const placeholder = /<<.*>>/.test(value);
  if (placeholder) todo.push(`${key} = ${value}`);
  return placeholder ? `<span class="todo">${esc(value)}</span>` : esc(value);
};
const values = {
  teamName: fill('teamName', config.teamName),
  members: fill('members', config.members),
  liveUrl: fill('liveUrl', config.liveUrl),
  liveUrlShort: fill('liveUrl', short(config.liveUrl)),
  repoUrlShort: fill('repoUrl', short(config.repoUrl)),
};

// Fonts: IBM Plex (OFL) from @fontsource, embedded as data URIs.
const font = (pkg, family, weight, subset) => {
  const file = join(ROOT, 'node_modules', '@fontsource', pkg, 'files', `${pkg}-${subset}-${weight}-normal.woff2`);
  const b64 = readFileSync(file).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
};
const fonts = [
  ...[400, 500, 600].flatMap((w) => ['latin', 'latin-ext'].map((s) => font('ibm-plex-sans', 'IBM Plex Sans', w, s))),
  ...[400, 500].map((w) => font('ibm-plex-mono', 'IBM Plex Mono', w, 'latin')),
].join('\n');

// Our own mark (public/icons/icon.svg) next to the deck.
copyFileSync(join(ROOT, 'public', 'icons', 'icon.svg'), join(DIR, 'argus-mark.svg'));

// QR code of the live URL. qr-live.svg was made with `npx --yes qrcode@1.5.4` (no runtime dependency); it is only
// regenerated when liveUrl changes (needs the npm registry once).
const qrUrlFile = join(DIR, 'qr-live.url');
const qrUrl = existsSync(qrUrlFile) ? readFileSync(qrUrlFile, 'utf8').trim() : '';
if (qrUrl !== config.liveUrl) {
  try {
    execFileSync(
      'npx',
      ['--yes', 'qrcode@1.5.4', '-t', 'svg', '-e', 'M', '-m', '4', '-d', '#07090D', '-l', '#FFFFFF', '-o', join(DIR, 'qr-live.svg'), config.liveUrl],
      { stdio: 'inherit' },
    );
    writeFileSync(qrUrlFile, `${config.liveUrl}\n`);
  } catch {
    console.error(`!! Could not regenerate qr-live.svg for ${config.liveUrl}: the QR code still encodes ${qrUrl || '(unknown)'}.`);
  }
}

let html = readFileSync(join(DIR, 'slides.template.html'), 'utf8');
html = html.replace('/*{{FONTS}}*/', fonts);
html = html.replace(/\{\{(\w+)\}\}/g, (m, key) => {
  if (!(key in values)) throw new Error(`slides.template.html: unknown placeholder ${m}`);
  return values[key];
});
const htmlPath = join(DIR, 'slides.html');
writeFileSync(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const failed = [];
page.on('requestfailed', (r) => failed.push(r.url()));
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
// Background images (screenshots) load lazily with the style; wait until each has been decoded.
await page.evaluate(() =>
  Promise.all(
    [...document.querySelectorAll('.shot')].map(
      (el) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = () => reject(new Error(`missing image ${el.dataset.src}`));
          img.src = el.dataset.src;
        }),
    ),
  ),
);
const count = await page.locator('section.slide').count();
if (count !== SLIDES) throw new Error(`expected ${SLIDES} slides, found ${count}`);

// Layout check: nothing may run past the slide's bottom margin (40 px) or right edge.
const overflow = await page.evaluate(() => {
  const out = [];
  for (const s of document.querySelectorAll('section.slide')) {
    const box = s.getBoundingClientRect();
    for (const el of s.querySelectorAll('h1, li, figure, figcaption, .shot, .qr, .meta, .icons, p')) {
      const r = el.getBoundingClientRect();
      if (r.bottom > box.bottom - 40 || r.right > box.right - 40)
        out.push(`slide ${s.dataset.slide}: <${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 40)}" bottom ${Math.round(r.bottom - box.top)} right ${Math.round(r.right - box.left)}`);
    }
  }
  return out;
});
for (let i = 1; i <= SLIDES; i++)
  await page.locator(`section[data-slide="${i}"]`).screenshot({ path: join(DIR, `slide-${i}.png`) });
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: join(DIR, 'ARGUS-slides.pdf'),
  width: '1920px',
  height: '1080px',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await browser.close();

const pdf = readFileSync(join(DIR, 'ARGUS-slides.pdf'));
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log(`slides.html, ARGUS-slides.pdf (${pages} pages, ${Math.round(pdf.length / 1024)} kB), slide-1..${SLIDES}.png`);
if (pages !== SLIDES) throw new Error(`PDF has ${pages} pages, expected ${SLIDES}`);
if (failed.length) console.error(`!! failed requests:\n  ${failed.join('\n  ')}`);
if (overflow.length) console.error(`!! layout overflow:\n  ${overflow.join('\n  ')}`);
if (todo.length) console.log(`Placeholders still in deck.config.json (shown with a dashed outline):\n  ${todo.join('\n  ')}`);
