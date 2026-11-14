// Static server that imitates GitHub Pages for a project site: `dist/` is mounted under a sub-path
// (default /argus-crew-health/), `<prefix>` without the slash redirects to `<prefix>/`, a directory serves its
// index.html, and any unknown path is answered with dist/404.html and status 404 — the SPA fallback Pages uses.
// Paths outside the prefix get a plain 404 (on Pages they belong to the user site, not to this app).
//
//   npx tsx scripts/serve-subpath.ts [--dir dist] [--base /argus-crew-health/] [--port 5197]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : fallback;
}

const root = resolve(arg('dir', 'dist'));
const base = `/${arg('base', '/argus-crew-health/').replace(/^\/+|\/+$/g, '')}/`;
const port = Number(arg('port', process.env.E2E_PORT ?? '5197'));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain; charset=utf-8',
};

function fileFor(urlPath: string): string | null {
  const rel = normalize(decodeURIComponent(urlPath.slice(base.length)));
  const full = join(root, rel);
  if (full !== root && !full.startsWith(root + sep)) return null; // path traversal
  if (!existsSync(full)) return null;
  const st = statSync(full);
  if (st.isFile()) return full;
  const index = join(full, 'index.html');
  return st.isDirectory() && existsSync(index) ? index : null;
}

createServer((req, res) => {
  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;
  const send = (status: number, file: string) => {
    res.writeHead(status, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    createReadStream(file).pipe(res);
  };
  if (urlPath === base.slice(0, -1)) {
    res.writeHead(301, { Location: base });
    res.end();
    return;
  }
  if (!urlPath.startsWith(base)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`404 outside ${base}: ${urlPath}`);
    return;
  }
  const file = fileFor(urlPath);
  if (file) return send(200, file);
  const fallback = join(root, '404.html');
  if (existsSync(fallback)) return send(404, fallback);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 (no 404.html in the build)');
}).listen(port, () => {
  console.log(`serve-subpath: ${root} at http://localhost:${port}${base}`);
});
