// Summarise the generated precache manifest of a build (counts and bytes by extension) and fail when a file
// the offline features need is missing. `npx tsx scripts/precache-report.ts [dist]`
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const dist = resolve(process.argv[2] ?? 'dist');
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
const urls = [...sw.matchAll(/\{url:"([^"]+)"/g)].map((m) => m[1] as string);
const rows = new Map<string, { n: number; bytes: number }>();
let total = 0;
for (const u of urls) {
  const ext = extname(u).slice(1) || '(none)';
  const bytes = statSync(join(dist, u)).size;
  total += bytes;
  const r = rows.get(ext) ?? { n: 0, bytes: 0 };
  rows.set(ext, { n: r.n + 1, bytes: r.bytes + bytes });
}
console.log(`precache: ${urls.length} entries, ${(total / 1024 / 1024).toFixed(2)} MiB`);
for (const [ext, r] of [...rows].sort((a, b) => b[1].bytes - a[1].bytes))
  console.log(`  ${ext.padEnd(12)} ${String(r.n).padStart(4)}  ${(r.bytes / 1024).toFixed(1).padStart(10)} KiB`);

const handbook = readdirSync(join(dist, 'seed/handbook'));
const required = [
  'index.html',
  'manifest.webmanifest',
  'mediapipe/vision_wasm_internal.wasm',
  'mediapipe/vision_wasm_internal.js',
  'mediapipe/face_landmarker.task',
  'anatomy/male.glb',
  'anatomy/female.glb',
  'anatomy/manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  ...handbook.map((f) => `seed/handbook/${f}`),
];
const missing = required.filter((f) => !urls.includes(f));
const fonts = urls.filter((u) => u.endsWith('.woff2')).length;
console.log(`required present: ${required.length - missing.length}/${required.length}; woff2 fonts: ${fonts}`);
if (missing.length || fonts === 0) {
  console.error('MISSING from precache:', missing);
  process.exit(1);
}
