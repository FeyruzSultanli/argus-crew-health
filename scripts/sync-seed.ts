// Copies the fetched (not statically imported) seed folders into public/seed/ so they are served at /seed/...
// (doc 05 §8). Runs before `npm run dev` and `npm run build`. Missing folders are skipped because later work
// packages create them.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const FOLDERS = ['radiation', 'handbook', 'import-samples'] as const;
const target = join(root, 'public', 'seed');

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

for (const folder of FOLDERS) {
  const from = join(root, 'seed', folder);
  if (!existsSync(from)) {
    console.log(`sync:seed: seed/${folder} not present yet — skipped`);
    continue;
  }
  cpSync(from, join(target, folder), { recursive: true });
  console.log(`sync:seed: copied seed/${folder} → public/seed/${folder}`);
}
