// Builds the handbook's generated files. Runs first in `npm run sync:seed` (so before every
// `npm run dev` and `npm run build`), which keeps them from going stale:
//   1. seed/handbook/protocol-<id>.md — one handbook entry per protocol, rendered from seed/protocols.json;
//   2. seed/handbook/index.json — { id, file, title, category, order, signalIds, keywords, sourceIds, summary, … }
//      for every seed/handbook/*.md.
// Fails (exit 1) on a malformed protocols.json, a handbook parse error or warning, or a duplicate id.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  INDEX_FILE,
  buildHandbookIndex,
  serializeHandbookIndex,
} from '../src/features/handbook/content/buildIndex';
import { protocolFileName, renderProtocolMarkdown } from '../src/features/handbook/content/renderProtocol';
import { validateProtocols } from '../src/features/handbook/content/validate';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const handbookDir = join(root, 'seed', 'handbook');

function writeIfChanged(path: string, text: string): boolean {
  if (existsSync(path) && readFileSync(path, 'utf8') === text) return false;
  writeFileSync(path, text);
  return true;
}

function main(): void {
  const { protocols } = validateProtocols(
    JSON.parse(readFileSync(join(root, 'seed', 'protocols.json'), 'utf8')),
  );

  const wanted = new Set(protocols.map(protocolFileName));
  for (const name of readdirSync(handbookDir)) {
    if (name.startsWith('protocol-') && name.endsWith('.md') && !wanted.has(name)) {
      rmSync(join(handbookDir, name));
      console.log(`build-handbook-index: removed stale ${name}`);
    }
  }
  let written = 0;
  for (const p of protocols) {
    if (writeIfChanged(join(handbookDir, protocolFileName(p)), renderProtocolMarkdown(p))) written++;
  }

  const files = readdirSync(handbookDir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((file) => ({ file, markdown: readFileSync(join(handbookDir, file), 'utf8') }));
  const index = buildHandbookIndex(files);
  const changed = writeIfChanged(join(handbookDir, INDEX_FILE), serializeHandbookIndex(index));
  console.log(
    `build-handbook-index: ${index.entries.length} entries (${written} protocol file(s) rewritten, index ${
      changed ? 'updated' : 'unchanged'
    })`,
  );
}

try {
  main();
} catch (err) {
  console.error(`build-handbook-index: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
