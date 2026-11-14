// Verifies that every SRC_* id used under src/ and docs/ exists in seed/sources.json (doc 12 §5, docs/PROJECT_RULES.md rule 1).
// Usage: npm run check:sources   (exit code 1 and a list of unknown ids on failure)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import sourcesJson from '../seed/sources.json';

export const SOURCE_ID_PATTERN = /SRC_[A-Z0-9_]+/g;

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html']);
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git']);

export const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

export interface SourceUsage {
  id: string;
  files: string[];
}

export interface CheckResult {
  registered: number;
  used: number;
  missing: SourceUsage[];
}

/** All ids registered in seed/sources.json. */
export function registeredSourceIds(): Set<string> {
  return new Set(sourcesJson.sources.map((s) => s.id));
}

/** Extracts SRC_* ids from a text. */
export function extractSourceIds(text: string): string[] {
  return [...text.matchAll(SOURCE_ID_PATTERN)].map((m) => m[0]);
}

function extensionOf(file: string): string {
  const dot = file.lastIndexOf('.');
  return dot === -1 ? '' : file.slice(dot);
}

function listFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const name of entries) {
    if (SKIPPED_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else if (SCANNED_EXTENSIONS.has(extensionOf(name))) files.push(full);
  }
  return files;
}

/** Maps each SRC_* id found under the given directories to the files that use it. */
export function collectSourceUsage(dirs: string[], root = repoRoot): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  for (const dir of dirs) {
    for (const file of listFiles(resolve(root, dir))) {
      const rel = relative(root, file);
      for (const id of new Set(extractSourceIds(readFileSync(file, 'utf8')))) {
        const list = usage.get(id) ?? [];
        list.push(rel);
        usage.set(id, list);
      }
    }
  }
  return usage;
}

/** Compares used ids with the registry. */
export function findMissing(usage: Map<string, string[]>, registered: Set<string>): SourceUsage[] {
  return [...usage.entries()]
    .filter(([id]) => !registered.has(id))
    .map(([id, files]) => ({ id, files }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function checkSources(dirs: string[] = ['src', 'docs'], root = repoRoot): CheckResult {
  const usage = collectSourceUsage(dirs, root);
  const registered = registeredSourceIds();
  return { registered: registered.size, used: usage.size, missing: findMissing(usage, registered) };
}

function main(): void {
  const result = checkSources();
  if (result.missing.length > 0) {
    console.error(`check-sources: ${result.missing.length} source id(s) not found in seed/sources.json:`);
    for (const m of result.missing) console.error(`  ${m.id}  (${m.files.join(', ')})`);
    process.exit(1);
  }
  console.log(
    `check-sources: OK — ${result.used} id(s) used in src/ and docs/, ${result.registered} registered.`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) main();
