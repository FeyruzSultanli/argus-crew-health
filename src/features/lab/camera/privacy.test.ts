// Code-level privacy check (docs/PROJECT_RULES.md rule 7): the camera pipeline never encodes, stores or sends frames.
// Scans the source of every non-test file of the rPPG pipeline, the face loader and the flow UI.
import { describe, expect, it } from 'vitest';

const all = import.meta.glob(['../../../measurement/rppg/*.ts', '../../../measurement/face/*.ts', './*.ts', './*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const sources = Object.fromEntries(Object.entries(all).filter(([p]) => !p.includes('.test.')));

const FORBIDDEN: Array<[string, RegExp]> = [
  ['canvas encoding', /\b(toDataURL|toBlob|convertToBlob|transferToImageBitmap)\b/],
  ['network', /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/],
  ['storage', /\b(indexedDB|localStorage|sessionStorage|caches|dexie|Dexie)\b/],
  ['recording', /\b(MediaRecorder|captureStream)\b/],
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('camera privacy', () => {
  it('scans the expected files', () => {
    const names = Object.keys(sources).map((p) => p.split('/').pop());
    for (const f of ['capture.ts', 'rppg.worker.ts', 'landmarker.ts', 'CameraPulseFlow.tsx', 'useCameraPulse.ts', 'overlay.ts']) {
      expect(names).toContain(f);
    }
    expect(names.some((n) => n?.includes('.test.'))).toBe(false);
  });

  for (const [what, re] of FORBIDDEN) {
    it(`no ${what} API in the camera pipeline`, () => {
      const hits = Object.entries(sources)
        .filter(([, src]) => re.test(stripComments(src)))
        .map(([p]) => p);
      expect(hits).toEqual([]);
    });
  }

  it('the worker receives only numbers per frame (no ImageData / bitmaps posted)', () => {
    const hook = stripComments(sources['./useCameraPulse.ts'] as string);
    const posts = hook.match(/engine\.post\(\{[^}]*\}\)/g) ?? [];
    expect(posts.length).toBeGreaterThan(0);
    for (const p of posts) expect(p).not.toMatch(/ImageData|ImageBitmap|VideoFrame|getImageData|data:/);
  });
});
