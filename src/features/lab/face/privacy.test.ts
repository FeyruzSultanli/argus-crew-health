// Code-level privacy check of the face scan (docs/PROJECT_RULES.md rule 7), same rules as the camera-pulse scan
// (src/features/lab/camera/privacy.test.ts, which already covers src/measurement/face/*.ts): no frame is encoded,
// stored or sent. Scans every non-test file of the face-scan flow and of src/measurement/face.
// One named exception: referenceStore.ts may use localStorage, and it is checked to touch no frame / image API.
import { describe, expect, it } from 'vitest';

const all = import.meta.glob(['../../../measurement/face/*.ts', './*.ts', './*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const sources = Object.fromEntries(Object.entries(all).filter(([p]) => !p.includes('.test.')));

const STORAGE_EXCEPTION = './referenceStore.ts';

const FORBIDDEN: Array<[string, RegExp]> = [
  ['canvas encoding', /\b(toDataURL|toBlob|convertToBlob|transferToImageBitmap)\b/],
  ['pixel read-back', /\b(getImageData|drawImage|createImageBitmap|VideoFrame)\b/],
  ['network', /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/],
  ['storage', /\b(indexedDB|localStorage|sessionStorage|caches|dexie|Dexie)\b/],
  ['recording', /\b(MediaRecorder|captureStream)\b/],
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('face scan privacy', () => {
  it('scans the expected files', () => {
    const names = Object.keys(sources).map((p) => p.split('/').pop());
    for (const f of [
      'useFaceScan.ts', 'deps.ts', 'overlay.ts', 'FaceScanFlow.tsx', 'FaceLiveView.tsx', 'FaceResultView.tsx',
      'observation.ts', 'referenceStore.ts', 'geometry.ts', 'pose.ts', 'fluidShiftIndex.ts', 'landmarker.ts',
    ]) {
      expect(names).toContain(f);
    }
    expect(names.some((n) => n?.includes('.test.'))).toBe(false);
  });

  for (const [what, re] of FORBIDDEN) {
    it(`no ${what} API in the face-scan pipeline`, () => {
      const hits = Object.entries(sources)
        .filter(([p]) => !(what === 'storage' && p === STORAGE_EXCEPTION))
        .filter(([, src]) => re.test(stripComments(src)))
        .map(([p]) => p);
      expect(hits).toEqual([]);
    });
  }

  it('referenceStore.ts stores numbers only: no frame, video, canvas or image API, only localStorage', () => {
    const src = stripComments(sources[STORAGE_EXCEPTION] as string);
    expect(src).not.toMatch(/\b(HTMLVideoElement|HTMLCanvasElement|ImageData|ImageBitmap|Blob|canvas|video|toDataURL|indexedDB|sessionStorage|fetch)\b/);
    expect(src).toMatch(/localStorage/);
  });

  it('no snapshot: nothing in the flow creates an image attachment', () => {
    for (const [p, src] of Object.entries(sources)) {
      expect(stripComments(src), p).not.toMatch(/attachments|snapshot/i);
    }
  });
});
